import type { Database } from './store.ts'
import { ownerKey, type Owner } from './model.ts'
import {
  workoutPackage,
  validateEntries,
  startTimeReached,
  type FieldWorkoutEntry,
  type FieldWorkoutPackage,
  type WorkoutRecord,
} from './workout-model.ts'
type Lane = <T>(task: (db: Database) => Promise<T>) => Promise<T>
const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
export class WorkoutStore {
  private lane: Lane
  constructor(lane: Lane) {
    this.lane = lane
  }
  private async read(db: Database, owner: Owner, id: string) {
    const row = await db.getFirstAsync<{ payload: string }>(
      'SELECT payload FROM field_workouts WHERE owner=? AND id=?',
      ownerKey(owner),
      id,
    )
    if (!row) throw Error('Download this workout online first.')
    return JSON.parse(row.payload) as WorkoutRecord
  }
  private write(db: Database, owner: Owner, r: WorkoutRecord) {
    return db.runAsync(
      'INSERT OR REPLACE INTO field_workouts(owner,id,payload) VALUES(?,?,?)',
      ownerKey(owner),
      r.package.id,
      JSON.stringify(r),
    )
  }
  list(owner: Owner, offset = 0, search = '') {
    return this.lane(async (db) =>
      (
        await db.getAllAsync<{ payload: string }>(
          "SELECT payload FROM field_workouts WHERE owner=? AND instr(lower(json_extract(payload,'$.package.member_name')),lower(?))>0 ORDER BY id LIMIT 10 OFFSET ?",
          ownerKey(owner),
          search,
          offset,
        )
      ).map((x) => JSON.parse(x.payload) as WorkoutRecord),
    )
  }
  count(owner: Owner, search = '') {
    return this.lane(
      async (db) =>
        (
          await db.getFirstAsync<{ n: number }>(
            "SELECT count(*) AS n FROM field_workouts WHERE owner=? AND instr(lower(json_extract(payload,'$.package.member_name')),lower(?))>0",
            ownerKey(owner),
            search,
          )
        )?.n || 0,
    )
  }
  ids(owner: Owner) {
    return this.lane(async (db) =>
      (
        await db.getAllAsync<{ id: string }>(
          'SELECT id FROM field_workouts WHERE owner=?',
          ownerKey(owner),
        )
      ).map((r) => r.id),
    )
  }
  get(owner: Owner, id: string) {
    return this.lane((db) => this.read(db, owner, id))
  }
  put(owner: Owner, input: FieldWorkoutPackage) {
    return this.lane(async (db) => {
      const p = workoutPackage(input)
      if (p.institution_id !== owner.institution)
        throw Error('This workout belongs to another institution.')
      const old = await db.getFirstAsync<{ payload: string }>(
        'SELECT payload FROM field_workouts WHERE owner=? AND id=?',
        ownerKey(owner),
        p.id,
      )
      if (old) {
        const r = JSON.parse(old.payload) as WorkoutRecord
        if (r.pending || r.intent || r.localRevision !== r.syncedRevision)
          throw Error('Resolve saved workout changes before downloading a newer package.')
        if (r.session && p.session?.id === r.session.id && p.session.version < r.session.version)
          throw Error('A newer workout is already saved on this device.')
        if (r.session && !p.session) throw Error('A newer workout is already saved on this device.')
        if (r.session && p.session && r.session.id !== p.session.id)
          throw Error('The server workout identity changed. Keep the recovery copy for review.')
      }
      const r: WorkoutRecord = {
        package: p,
        entries: copy(p.entries).map((e) =>
          p.session || e.completed ? e : { ...e, seconds: null, metres: null },
        ),
        note: p.session?.note || '',
        session: p.session
          ? { id: p.session.id, version: p.session.version, completed_at: p.session.completed_at }
          : null,
        localRevision: 0,
        syncedRevision: 0,
        pending: null,
        intent: null,
        blocked: false,
        error: '',
        saved_at: new Date().toISOString(),
      }
      await this.write(db, owner, r)
      return r
    })
  }
  start(owner: Owner, id: string, session: string, operation: string) {
    return this.lane(async (db) => {
      const r = await this.read(db, owner, id),
        p = r.package
      if (
        r.blocked ||
        !p.allow_provisional_start ||
        !p.occurrence_id ||
        r.session ||
        r.pending ||
        !startTimeReached(p)
      )
        throw Error('This downloaded workout cannot be started yet. Refresh it online.')
      r.session = { id: session, version: 0, completed_at: null }
      r.pending = {
        state: 'queued',
        payload: {
          action: 'start',
          view: 'trainer',
          id: session,
          operation,
          assignment_id: p.assignment_id,
          day_id: p.day_id,
          occurrence_id: p.occurrence_id,
        },
      }
      await this.write(db, owner, r)
      return r
    })
  }
  edit(owner: Owner, id: string, entries: FieldWorkoutEntry[], note: string) {
    return this.lane(async (db) => {
      const r = await this.read(db, owner, id)
      if (
        r.blocked ||
        !r.session ||
        r.session.completed_at ||
        r.intent?.complete ||
        r.pending?.payload.complete
      )
        throw Error('This workout is read-only until its saved change is resolved.')
      if (!r.package.can_record && r.session.version > 0) throw Error('This workout is read-only.')
      if (note.length > 2000) throw Error('Keep workout notes within 2000 characters.')
      validateEntries(r.package, entries, false)
      r.entries = copy(entries)
      r.note = note
      r.localRevision++
      r.saved_at = new Date().toISOString()
      await this.write(db, owner, r)
      return r
    })
  }
  save(owner: Owner, id: string, complete: boolean, operation: string) {
    return this.lane(async (db) => {
      const r = await this.read(db, owner, id)
      if (
        r.blocked ||
        !r.session ||
        r.session.completed_at ||
        r.intent ||
        r.pending?.payload.action === 'save'
      )
        throw Error('Resolve the saved workout change first.')
      validateEntries(r.package, r.entries, complete)
      r.intent = {
        entries: copy(r.entries),
        note: r.note,
        complete,
        operation,
        localRevision: r.localRevision,
      }
      await this.write(db, owner, r)
      return r
    })
  }
  next(owner: Owner) {
    return this.lane(async (db) => {
      const row = await db.getFirstAsync<{ payload: string }>(
        "SELECT payload FROM field_workouts WHERE owner=? AND json_extract(payload,'$.blocked')=0 AND (json_extract(payload,'$.pending.state') IN ('queued','uncertain','sending') OR (json_type(payload,'$.pending')='null' AND json_type(payload,'$.intent')='object' AND json_extract(payload,'$.session.version')>0)) ORDER BY id LIMIT 1",
        ownerKey(owner),
      )
      if (!row) return null
      const r = JSON.parse(row.payload) as WorkoutRecord
      if (r.pending) return r
      if (!r.intent || !r.session) return null
      const i = r.intent
      r.pending = {
        state: 'queued',
        payload: {
          action: 'save',
          view: 'trainer',
          id: r.session.id,
          revision: r.session.version,
          operation: i.operation,
          entries: copy(i.entries),
          note: i.note,
          complete: i.complete,
        },
      }
      await this.write(db, owner, r)
      return r
    })
  }
  state(
    owner: Owner,
    id: string,
    operation: unknown,
    state: NonNullable<WorkoutRecord['pending']>['state'],
    error = '',
  ) {
    return this.lane(async (db) => {
      const r = await this.read(db, owner, id)
      if (!r.pending || r.pending.payload.operation !== operation)
        throw Error('The saved workout command changed.')
      r.pending.state = state
      r.error = error
      if (state === 'blocked') r.blocked = true
      await this.write(db, owner, r)
    })
  }
  acknowledge(owner: Owner, id: string, operation: unknown, input: unknown) {
    return this.lane(async (db) => {
      const r = await this.read(db, owner, id),
        p = r.pending,
        doc = input as { id: string; version: number; completed_at?: string | null }
      if (
        !p ||
        p.payload.operation !== operation ||
        doc?.id !== r.session?.id ||
        !Number.isInteger(doc.version) ||
        doc.version < 1 ||
        (doc.completed_at !== undefined &&
          doc.completed_at !== null &&
          !Number.isFinite(Date.parse(doc.completed_at))) ||
        (p.payload.action === 'start' && (doc.version !== 1 || !!doc.completed_at)) ||
        (p.payload.action === 'save' && doc.version !== Number(p.payload.revision) + 1)
      )
        throw Error('Invalid workout acknowledgment. Saved work is retained.')
      if (p.payload.action === 'save' && !!p.payload.complete !== !!doc.completed_at)
        throw Error('Invalid workout acknowledgment. Saved work is retained.')
      r.session = { id: doc.id, version: doc.version, completed_at: doc.completed_at || null }
      if (p.payload.action === 'save') {
        r.syncedRevision = r.intent!.localRevision
        r.intent = null
      }
      r.package.can_record = !r.session.completed_at
      r.pending = null
      r.error = ''
      await this.write(db, owner, r)
      return r
    })
  }
  block(owner: Owner, id?: string) {
    return this.lane(async (db) => {
      await db.runAsync(
        "UPDATE field_workouts SET payload=json_set(payload,'$.blocked',json('true')) WHERE owner=? AND (? IS NULL OR id=?)",
        ownerKey(owner),
        id || null,
        id || null,
      )
    })
  }
  remove(owner: Owner, id: string) {
    return this.lane(async (db) => {
      const r = await this.read(db, owner, id)
      if (r.pending || r.intent || r.localRevision !== r.syncedRevision)
        throw Error('Resolve saved workout changes before removing this package.')
      await db.runAsync('DELETE FROM field_workouts WHERE owner=? AND id=?', ownerKey(owner), id)
    })
  }
  retry(owner: Owner, id: string) {
    return this.lane(async (db) => {
      const r = await this.read(db, owner, id)
      if (!r.pending || r.pending.state === 'sending')
        throw Error('Wait for the saved request to settle.')
      r.pending.state = 'queued'
      r.blocked = false
      r.error = ''
      await this.write(db, owner, r)
    })
  }
  replaceRejected(owner: Owner, id: string, input: unknown) {
    return this.lane(async (db) => {
      const r = await this.read(db, owner, id),
        doc = input as {
          id: string
          version: number
          completed_at: string | null
          note: string
          entries: FieldWorkoutEntry[]
          can_record: boolean
        }
      if (
        (r.pending &&
          (r.pending.state !== 'needs_attention' || r.pending.payload.action !== 'save')) ||
        doc?.id !== r.session?.id ||
        doc.version < r.session.version ||
        typeof doc.can_record !== 'boolean'
      )
        throw Error(
          'Only a rejected save can be replaced after reviewing the current server version.',
        )
      const p = workoutPackage({
        ...r.package,
        allow_provisional_start: false,
        can_record: doc.can_record,
        entries: doc.entries,
        session: {
          id: doc.id,
          version: doc.version,
          note: doc.note,
          completed_at: doc.completed_at,
        },
      })
      const replacement: WorkoutRecord = {
        package: p,
        entries: copy(p.entries),
        note: doc.note,
        session: p.session,
        localRevision: 0,
        syncedRevision: 0,
        pending: null,
        intent: null,
        blocked: false,
        error: '',
        saved_at: new Date().toISOString(),
      }
      await this.write(db, owner, replacement)
      return replacement
    })
  }
  restoreAccess(owner: Owner, id: string, input: unknown) {
    return this.lane(async (db) => {
      const r = await this.read(db, owner, id),
        doc = input as { id: string; version: number; can_record: boolean }
      if (
        r.pending ||
        doc?.id !== r.session?.id ||
        doc.version !== r.session.version ||
        doc.can_record !== true
      )
        throw Error('Review the changed server workout before restoring this device draft.')
      r.blocked = false
      r.package.can_record = true
      await this.write(db, owner, r)
    })
  }
}
