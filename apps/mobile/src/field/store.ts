import type {
  CachedRoster,
  Command,
  EventSnapshot,
  FieldCommand,
  FieldRoster,
  ScoreDraft,
  Owner,
} from './model.ts'
import { ownerKey, fieldResult, finishProblems, scoreValues } from './model.ts'
import { WorkoutStore } from './workout-store.ts'

/** Small adapter so queue logic can be checked using real SQLite without a native runtime. */
export interface Database {
  execAsync(sql: string): Promise<void>
  runAsync(sql: string, ...params: (string | number | null)[]): Promise<unknown>
  getFirstAsync<T>(sql: string, ...params: (string | number | null)[]): Promise<T | null>
  getAllAsync<T>(sql: string, ...params: (string | number | null)[]): Promise<T[]>
  withTransactionAsync(task: () => Promise<void>): Promise<void>
}
type EventRow = { payload: string; saved_at: string; blocked: number }
type CommandRow = Omit<Command, 'payload'> & { payload: string }
const decode = (row: CommandRow): Command => ({ ...row, payload: JSON.parse(row.payload) })

export class FieldStore {
  readonly workouts: WorkoutStore
  private tail: Promise<unknown> = Promise.resolve()
  private db: Database
  constructor(db: Database) {
    this.db = db
    this.workouts = new WorkoutStore((task) => this.serial(() => task(this.db)))
  }

  // Every connection operation goes through this lane. No async reads can interleave a transaction.
  private serial<T>(task: () => Promise<T>): Promise<T> {
    const next = this.tail.then(task)
    this.tail = next.catch(() => undefined)
    return next
  }

  initialize() {
    return this.serial(async () => {
      await this.db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = FULL;
        CREATE TABLE IF NOT EXISTS field_workouts (owner TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(owner,id));
        UPDATE field_workouts SET payload=json_set(payload,'$.pending.state','uncertain') WHERE json_extract(payload,'$.pending.state')='sending';
        CREATE TABLE IF NOT EXISTS attendance_events (
          owner TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL,
          saved_at TEXT NOT NULL, blocked INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY(owner,id)
        );
        CREATE TABLE IF NOT EXISTS attendance_commands (
          seq INTEGER PRIMARY KEY AUTOINCREMENT, operation TEXT NOT NULL UNIQUE,
          owner TEXT NOT NULL, event_id TEXT NOT NULL, member TEXT NOT NULL,
          payload TEXT NOT NULL, state TEXT NOT NULL, error TEXT
        );
        CREATE INDEX IF NOT EXISTS attendance_owner ON attendance_commands(owner,event_id,seq);
        CREATE TABLE IF NOT EXISTS field_score_drafts (
          owner TEXT NOT NULL, event_id TEXT NOT NULL, member TEXT NOT NULL, payload TEXT NOT NULL,
          PRIMARY KEY(owner,event_id,member)
        );
        UPDATE attendance_commands SET state='uncertain',
          error='The app stopped before server confirmation. Retry sends the exact original change.'
          WHERE state='sending';
      `)
    })
  }

  list(owner: Owner): Promise<CachedRoster[]> {
    return this.serial(async () => {
      const rows = await this.db.getAllAsync<EventRow>(
        'SELECT payload,saved_at,blocked FROM attendance_events WHERE owner=? ORDER BY saved_at DESC',
        ownerKey(owner),
      )
      return rows.map((r) => ({
        ...JSON.parse(r.payload),
        saved_at: r.saved_at,
        blocked: !!r.blocked,
      }))
    })
  }

  institutions(instance: string, user: string): Promise<string[]> {
    return this.serial(async () => {
      const rows = await this.db.getAllAsync<{ owner: string }>(
        "SELECT DISTINCT owner FROM (SELECT owner FROM attendance_events UNION SELECT owner FROM field_workouts) WHERE json_extract(owner,'$[0]')=? AND json_extract(owner,'$[1]')=?",
        instance,
        user,
      )
      return rows.map((row) => (JSON.parse(row.owner) as string[])[2])
    })
  }

  snapshot(owner: Owner, id: string): Promise<EventSnapshot | null> {
    return this.serial(async () => {
      const key = ownerKey(owner)
      const row = await this.db.getFirstAsync<EventRow>(
        'SELECT payload,saved_at,blocked FROM attendance_events WHERE owner=? AND id=?',
        key,
        id,
      )
      if (!row) return null
      const commands = await this.db.getAllAsync<CommandRow>(
        'SELECT * FROM attendance_commands WHERE owner=? AND event_id=? ORDER BY seq',
        key,
        id,
      )
      const drafts = await this.db.getAllAsync<{ payload: string }>(
        'SELECT payload FROM field_score_drafts WHERE owner=? AND event_id=?',
        key,
        id,
      )
      return {
        roster: { ...JSON.parse(row.payload), saved_at: row.saved_at, blocked: !!row.blocked },
        commands: commands.map(decode),
        drafts: drafts.map((d) => JSON.parse(d.payload)),
      }
    })
  }

  saveRoster(owner: Owner, roster: FieldRoster) {
    return this.serial(async () => {
      await this.db.withTransactionAsync(async () => {
        const key = ownerKey(owner)
        const pending = await this.db.getFirstAsync<{ n: number }>(
          "SELECT count(*) AS n FROM attendance_commands WHERE owner=? AND event_id=? AND state!='acknowledged'",
          key,
          roster.event.id,
        )
        // Pending commands retain their original base and payload; a late read cannot rewrite it.
        if (pending?.n) throw Error('Resolve saved changes before replacing this offline roster.')
        const drafts = await this.db.getFirstAsync<{ n: number }>(
          'SELECT count(*) AS n FROM field_score_drafts WHERE owner=? AND event_id=?',
          key,
          roster.event.id,
        )
        if (drafts?.n) throw Error('Save or discard score drafts before downloading a newer event.')
        await this.db.runAsync(
          'DELETE FROM attendance_commands WHERE owner=? AND event_id=?',
          key,
          roster.event.id,
        )
        if (roster.event.state === 'completed' || roster.event.state === 'cancelled') {
          await this.db.runAsync(
            'DELETE FROM attendance_events WHERE owner=? AND id=?',
            key,
            roster.event.id,
          )
          return
        }
        await this.db.runAsync(
          'INSERT OR REPLACE INTO attendance_events(owner,id,payload,saved_at,blocked) VALUES(?,?,?,?,0)',
          key,
          roster.event.id,
          JSON.stringify(roster),
          new Date().toISOString(),
        )
      })
    })
  }

  enqueue(owner: Owner, payload: FieldCommand) {
    return this.serial(async () => {
      await this.db.withTransactionAsync(async () => {
        const key = ownerKey(owner)
        const row = await this.db.getFirstAsync<EventRow>(
          'SELECT payload,saved_at,blocked FROM attendance_events WHERE owner=? AND id=?',
          key,
          payload.id,
        )
        if (!row || row.blocked)
          throw Error('Open an authorized event online before recording field work.')
        const roster = JSON.parse(row.payload) as FieldRoster
        if (roster.event.state !== 'scheduled' || Date.parse(roster.event.starts_at) > Date.now())
          throw Error('Field capture is available after a scheduled event starts.')
        const pending = (
          await this.db.getAllAsync<CommandRow>(
            "SELECT * FROM attendance_commands WHERE owner=? AND event_id=? AND state!='acknowledged' ORDER BY seq",
            key,
            payload.id,
          )
        ).map(decode)
        if (
          pending.some(
            (c) =>
              ['needs_attention', 'blocked'].includes(c.state) || c.payload.action === 'finish',
          )
        )
          throw Error('Resolve the earlier saved change before editing this event.')
        if (payload.action === 'finish') {
          if (pending.length)
            throw Error('Confirm every saved attendance and score before completing this event.')
          const drafts = await this.db.getFirstAsync<{ n: number }>(
            'SELECT count(*) AS n FROM field_score_drafts WHERE owner=? AND event_id=?',
            key,
            payload.id,
          )
          if (drafts?.n) throw Error('Save or discard score drafts before completing this event.')
          if (roster.event.revision !== payload.revision)
            throw Error('Event revision changed. Refresh before completing it.')
          const problems = finishProblems(roster)
          if (problems.length) throw Error(problems.join(' '))
        } else {
          const person = roster.people.find(
            (p) => p.member_id === payload.member && p.duty === 'trainee',
          )
          if (!person?.active) throw Error('This athlete is unavailable for field capture.')
          const previous = pending.filter((c) => c.payload.member === payload.member)
          if (payload.action === 'attendance') {
            if (previous.length)
              throw Error('Resolve this athlete’s previous change before editing attendance.')
            if (person.revision !== payload.revision)
              throw Error('Attendance changed. Reopen the athlete before saving.')
          } else {
            if (roster.event.kind !== 'assessment' || !roster.definition?.length || !roster.results)
              throw Error('Download the assessment definition online before entering scores.')
            if (
              previous.some(
                (c) => c.payload.action !== 'attendance' || c.payload.attendance !== 'present',
              )
            )
              throw Error(
                'Confirm this athlete’s earlier score or attendance before recording another result.',
              )
            if (
              person.attendance !== 'present' &&
              !previous.some(
                (c) => c.payload.action === 'attendance' && c.payload.attendance === 'present',
              )
            )
              throw Error('Mark this athlete present before recording scores.')
            if (
              (roster.results.find((r) => r.member_id === payload.member)?.revision || 0) !==
              payload.revision
            )
              throw Error('Assessment scores changed. Reopen the athlete before correcting them.')
            scoreValues(roster.definition, {
              member: payload.member,
              note: payload.note,
              values: Object.fromEntries(
                Object.entries(payload.values).map(([key, value]) => [key, String(value)]),
              ),
            })
          }
        }
        await this.db.runAsync(
          "INSERT INTO attendance_commands(operation,owner,event_id,member,payload,state) VALUES(?,?,?,?,?,'queued')",
          payload.operation,
          key,
          payload.id,
          payload.member || '__event__',
          JSON.stringify(payload),
        )
        if (payload.action === 'result')
          await this.db.runAsync(
            'DELETE FROM field_score_drafts WHERE owner=? AND event_id=? AND member=?',
            key,
            payload.id,
            payload.member,
          )
      })
    })
  }

  next(owner: Owner) {
    return this.serial(async () => {
      const row = await this.db.getFirstAsync<CommandRow>(
        "SELECT * FROM attendance_commands WHERE owner=? AND state!='acknowledged' ORDER BY seq LIMIT 1",
        ownerKey(owner),
      )
      return row ? decode(row) : null
    })
  }

  setState(owner: Owner, command: Command, state: Command['state'], error: string | null) {
    return this.serial(async () => {
      if (command.owner !== ownerKey(owner))
        throw Error('Saved change belongs to another account or institution.')
      await this.db.withTransactionAsync(async () => {
        const key = ownerKey(owner)
        await this.db.runAsync(
          'UPDATE attendance_commands SET state=?,error=? WHERE owner=? AND operation=?',
          state,
          error,
          key,
          command.payload.operation,
        )
        if (state === 'blocked')
          await this.db.runAsync(
            'UPDATE attendance_events SET blocked=1 WHERE owner=? AND id=?',
            key,
            command.event_id,
          )
      })
    })
  }

  acknowledge(owner: Owner, command: Command, response: unknown) {
    return this.serial(async () => {
      if (command.owner !== ownerKey(owner))
        throw Error('Saved change belongs to another account or institution.')
      let completed: FieldRoster | undefined
      await this.db.withTransactionAsync(async () => {
        const key = ownerKey(owner)
        const row = await this.db.getFirstAsync<EventRow>(
          'SELECT payload,saved_at,blocked FROM attendance_events WHERE owner=? AND id=?',
          key,
          command.event_id,
        )
        if (!row)
          throw Error(
            'The saved event is unavailable; attendance acknowledgment is retained for retry.',
          )
        const roster = JSON.parse(row.payload) as FieldRoster
        const payload = command.payload
        if (payload.action === 'attendance') {
          const value = response as {
            member_id?: string
            event_id?: string
            attendance?: string
            revision?: number
          }
          if (
            !value ||
            value.member_id !== payload.member ||
            value.event_id !== command.event_id ||
            value.attendance !== payload.attendance ||
            value.revision !== payload.revision + 1
          )
            throw Error(
              'Unexpected attendance acknowledgment. The original change is retained for retry.',
            )
          roster.people = roster.people.map((p) =>
            p.member_id === value.member_id
              ? { ...p, attendance: payload.attendance, revision: value.revision! }
              : p,
          )
        } else if (payload.action === 'result') {
          const value = fieldResult(response, command.event_id)
          if (
            value.member_id !== payload.member ||
            value.revision !== payload.revision + 1 ||
            value.note !== payload.note.trim() ||
            Object.keys(value.values).length !== Object.keys(payload.values).length ||
            Object.entries(payload.values).some(([key, entry]) => value.values[key] !== entry)
          )
            throw Error(
              'Unexpected assessment acknowledgment. The original result is retained for retry.',
            )
          roster.results = [
            ...(roster.results || []).filter((r) => r.member_id !== value.member_id),
            value,
          ]
        } else {
          const value = response as { id?: string; state?: string; revision?: number }
          if (
            !value ||
            value.id !== command.event_id ||
            value.state !== 'completed' ||
            value.revision !== payload.revision + 1
          )
            throw Error(
              'Unexpected completion acknowledgment. Retry the original finish operation.',
            )
          roster.event = { ...roster.event, state: 'completed', revision: value.revision }
          completed = roster
        }
        await this.db.runAsync(
          'UPDATE attendance_events SET payload=? WHERE owner=? AND id=?',
          JSON.stringify(roster),
          key,
          command.event_id,
        )
        await this.db.runAsync(
          "UPDATE attendance_commands SET state='acknowledged',error=NULL WHERE owner=? AND operation=?",
          key,
          command.payload.operation,
        )
        if (completed) {
          // No later command can be queued while a finish is pending. Evict sensitive event data atomically.
          await this.db.runAsync(
            'DELETE FROM attendance_commands WHERE owner=? AND event_id=?',
            key,
            command.event_id,
          )
          await this.db.runAsync(
            'DELETE FROM field_score_drafts WHERE owner=? AND event_id=?',
            key,
            command.event_id,
          )
          await this.db.runAsync(
            'DELETE FROM attendance_events WHERE owner=? AND id=?',
            key,
            command.event_id,
          )
        }
      })
      return completed
    })
  }

  block(owner: Owner, id: string) {
    return this.serial(async () => {
      await this.db.withTransactionAsync(async () => {
        const key = ownerKey(owner)
        await this.db.runAsync(
          'UPDATE attendance_events SET blocked=1 WHERE owner=? AND id=?',
          key,
          id,
        )
        await this.db.runAsync(
          "UPDATE attendance_commands SET state='blocked',error='Your current account cannot access this event.' WHERE owner=? AND event_id=? AND state!='acknowledged'",
          key,
          id,
        )
      })
    })
  }

  remove(owner: Owner, id: string) {
    return this.serial(async () => {
      await this.db.withTransactionAsync(async () => {
        const key = ownerKey(owner)
        const sending = await this.db.getFirstAsync<{ n: number }>(
          "SELECT count(*) AS n FROM attendance_commands WHERE owner=? AND event_id=? AND state='sending'",
          key,
          id,
        )
        if (sending?.n)
          throw Error('Wait for the current request to settle before removing saved work.')
        await this.db.runAsync(
          'DELETE FROM attendance_commands WHERE owner=? AND event_id=?',
          key,
          id,
        )
        await this.db.runAsync('DELETE FROM attendance_events WHERE owner=? AND id=?', key, id)
        await this.db.runAsync(
          'DELETE FROM field_score_drafts WHERE owner=? AND event_id=?',
          key,
          id,
        )
      })
    })
  }

  saveDraft(owner: Owner, id: string, draft: ScoreDraft) {
    return this.serial(async () => {
      await this.db.withTransactionAsync(async () => {
        const key = ownerKey(owner)
        const row = await this.db.getFirstAsync<EventRow>(
          'SELECT payload,saved_at,blocked FROM attendance_events WHERE owner=? AND id=?',
          key,
          id,
        )
        if (
          !row ||
          row.blocked ||
          (JSON.parse(row.payload) as FieldRoster).event.state !== 'scheduled'
        )
          throw Error('This event is unavailable for score drafts.')
        const roster = JSON.parse(row.payload) as FieldRoster
        if (
          roster.event.kind !== 'assessment' ||
          !roster.definition?.length ||
          !roster.people.some(
            (p) => p.member_id === draft.member && p.duty === 'trainee' && p.active,
          )
        )
          throw Error('Open this athlete’s assessment package before saving a score draft.')
        const finishing = await this.db.getFirstAsync<{ n: number }>(
          "SELECT count(*) AS n FROM attendance_commands WHERE owner=? AND event_id=? AND state!='acknowledged' AND (member=? OR member='__event__') AND json_extract(payload,'$.action')!='attendance'",
          key,
          id,
          draft.member,
        )
        if (finishing?.n)
          throw Error(
            'Resolve this athlete’s saved result or event completion before editing a draft.',
          )
        await this.db.runAsync(
          'INSERT OR REPLACE INTO field_score_drafts(owner,event_id,member,payload) VALUES(?,?,?,?)',
          key,
          id,
          draft.member,
          JSON.stringify(draft),
        )
      })
    })
  }

  discardDraft(owner: Owner, id: string, member: string) {
    return this.serial(async () => {
      await this.db.runAsync(
        'DELETE FROM field_score_drafts WHERE owner=? AND event_id=? AND member=?',
        ownerKey(owner),
        id,
        member,
      )
    })
  }
}
