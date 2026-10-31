import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FieldStore, type Database } from '../src/field/store.ts'
import { AttendanceSync } from '../src/field/sync.ts'
import { WorkoutSync } from '../src/field/workout-sync.ts'
import type { FieldWorkoutPackage } from '../src/field/workout-model.ts'
import { randomUUID } from 'node:crypto'
import {
  ApiFailure,
  fieldRoster,
  scoreValues,
  type FieldCommand,
  type FieldAttendanceCommand,
  type FieldRoster,
  type Owner,
} from '../src/field/model.ts'

// Real SQLite and disk restart exercise our SQL and transaction boundaries, not SQLCipher/native storage.
function adapter(db: DatabaseSync): Database {
  return {
    async execAsync(sql) {
      db.exec(sql)
    },
    async runAsync(sql, ...params) {
      return db.prepare(sql).run(...params)
    },
    async getFirstAsync<T>(sql: string, ...params: (string | number | null)[]) {
      return (db.prepare(sql).get(...params) as T | undefined) || null
    },
    async getAllAsync<T>(sql: string, ...params: (string | number | null)[]) {
      return db.prepare(sql).all(...params) as T[]
    },
    async withTransactionAsync(task) {
      db.exec('BEGIN')
      try {
        await task()
        db.exec('COMMIT')
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
    },
  }
}
const owner: Owner = {
  instance: 'https://a.example.edu/api',
  user: 'coach-a',
  institution: 'university-a',
}
const roster: FieldRoster = {
  event: {
    id: 'event-a',
    title: 'Rugby field session',
    kind: 'training',
    state: 'scheduled',
    starts_at: '2020-01-01T08:00:00Z',
    ends_at: '2020-01-01T09:00:00Z',
    timezone: 'UTC',
    revision: 1,
    location: 'Pitch 2',
  },
  people: [
    {
      member_id: 'athlete-a',
      name: 'Athlete A',
      duty: 'trainee',
      attendance: 'unmarked',
      revision: 1,
      active: true,
    },
    {
      member_id: 'athlete-b',
      name: 'Athlete B',
      duty: 'trainee',
      attendance: 'unmarked',
      revision: 4,
      active: true,
    },
  ],
}
const command = (overrides: Partial<FieldAttendanceCommand> = {}): FieldAttendanceCommand => ({
  action: 'attendance',
  view: 'trainer',
  id: 'event-a',
  member: 'athlete-a',
  attendance: 'present',
  revision: 1,
  operation: 'operation-a',
  ...overrides,
})
const acknowledgment = (c: FieldCommand) =>
  c.action === 'attendance'
    ? {
        event_id: c.id,
        member_id: c.member,
        attendance: c.attendance,
        revision: c.revision + 1,
      }
    : c.action === 'result'
      ? {
          event_id: c.id,
          member_id: c.member,
          values: c.values,
          note: c.note.trim(),
          revision: c.revision + 1,
          recorded_at: '2026-10-18T12:00:00Z',
          recorded_by: 'assessor-a',
        }
      : { id: c.id, state: 'completed', revision: c.revision + 1 }
async function setup() {
  const db = new DatabaseSync(':memory:')
  const store = new FieldStore(adapter(db))
  await store.initialize()
  await store.saveRoster(owner, roster)
  return { db, store }
}

test('lost acknowledgment retries identical bytes and adopts revision before the second edit', async () => {
  const { db, store } = await setup()
  try {
    const payload = command()
    await store.enqueue(owner, payload)
    const requests: string[] = []
    let committed = 0
    const receipts = new Map<string, unknown>()
    const runner = new AttendanceSync(store, owner, async (_path, body) => {
      requests.push(body)
      const c = JSON.parse(body) as FieldAttendanceCommand
      if (!receipts.has(c.operation)) {
        committed++
        receipts.set(c.operation, acknowledgment(c))
      }
      if (requests.length === 1) throw Error('Response dropped after commit')
      return receipts.get(c.operation)
    })
    await runner.run()
    assert.equal((await store.next(owner))?.state, 'uncertain')
    assert.equal((await store.snapshot(owner, 'event-a'))?.roster.people[0].revision, 1)
    await assert.rejects(
      store.enqueue(owner, command({ operation: 'changed', attendance: 'absent' })),
    )
    await runner.run()
    assert.equal(requests[0], requests[1])
    assert.equal(committed, 1)
    const saved = await store.snapshot(owner, 'event-a')
    assert.equal(saved?.roster.people[0].revision, 2)
    assert.equal(saved?.commands[0].state, 'acknowledged')
    await store.enqueue(
      owner,
      command({ operation: 'operation-b', revision: 2, attendance: 'excused' }),
    )
    await runner.run()
    assert.equal(committed, 2)
    assert.equal((await store.snapshot(owner, 'event-a'))?.roster.people[0].revision, 3)
  } finally {
    db.close()
  }
})

test('on-disk restart preserves queued work and recovers a sending command as uncertain', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'rafik-field-'))
  const path = join(dir, 'attendance.db')
  let db = new DatabaseSync(path)
  try {
    let store = new FieldStore(adapter(db))
    await store.initialize()
    await store.saveRoster(owner, roster)
    await store.enqueue(owner, command())
    const head = (await store.next(owner))!
    await store.setState(owner, head, 'sending', null)
    db.close()
    db = new DatabaseSync(path)
    store = new FieldStore(adapter(db))
    await store.initialize()
    assert.equal((await store.next(owner))?.state, 'uncertain')
    assert.deepEqual((await store.next(owner))?.payload, command())
    assert.equal((await store.list(owner)).length, 1)
  } finally {
    db.close()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('account, institution URL and institution isolation apply to reads, replay and discard', async () => {
  const { db, store } = await setup()
  try {
    await store.enqueue(owner, command())
    for (const other of [
      { ...owner, user: 'coach-b' },
      { ...owner, instance: 'https://b.example.edu/api' },
      { ...owner, institution: 'university-b' },
    ]) {
      assert.equal(await store.snapshot(other, 'event-a'), null)
      assert.equal(await store.next(other), null)
      assert.equal((await store.list(other)).length, 0)
      let sent = 0
      await new AttendanceSync(store, other, async () => {
        sent++
        return {}
      }).run()
      assert.equal(sent, 0)
      await store.remove(other, 'event-a')
    }
    assert.deepEqual(await store.institutions(owner.instance, owner.user), [owner.institution])
    assert.deepEqual(await store.institutions(owner.instance, 'coach-b'), [])
    assert.equal((await store.next(owner))?.payload.operation, 'operation-a')
  } finally {
    db.close()
  }
})

for (const status of [403, 409])
  test(`${status} stops dependent replay and retains the exact saved command`, async () => {
    const { db, store } = await setup()
    try {
      await store.enqueue(owner, command())
      await store.enqueue(
        owner,
        command({ member: 'athlete-b', revision: 4, operation: 'operation-b' }),
      )
      let sent = 0
      const runner = new AttendanceSync(store, owner, async () => {
        sent++
        throw new ApiFailure(status, status === 403 ? 'event_unavailable' : 'conflict')
      })
      await runner.run()
      await runner.run()
      assert.equal(sent, 1)
      const saved = (await store.snapshot(owner, 'event-a'))!
      assert.equal(saved.commands[0].state, status === 403 ? 'blocked' : 'needs_attention')
      assert.equal(saved.commands[1].state, 'queued')
      assert.deepEqual(saved.commands[0].payload, command())
      assert.equal(saved.roster.blocked, status === 403)
      await assert.rejects(store.enqueue(owner, command({ operation: 'new-operation' })))
    } finally {
      db.close()
    }
  })

test('a late roster refresh cannot replace pending work; interrupted acknowledgment rolls back atomically', async () => {
  const { db, store } = await setup()
  try {
    await store.enqueue(owner, command())
    await assert.rejects(store.saveRoster(owner, { ...roster, people: [] }))
    const head = (await store.next(owner))!
    db.exec(
      "CREATE TRIGGER fail_ack BEFORE UPDATE OF state ON attendance_commands WHEN NEW.state='acknowledged' BEGIN SELECT RAISE(ABORT,'storage failure'); END",
    )
    await assert.rejects(store.acknowledge(owner, head, acknowledgment(head.payload)))
    assert.equal((await store.snapshot(owner, 'event-a'))?.roster.people[0].revision, 1)
    assert.equal((await store.next(owner))?.state, 'queued')
    db.exec('DROP TRIGGER fail_ack')
    await store.acknowledge(owner, head, acknowledgment(head.payload))
    const completed = { ...roster, event: { ...roster.event, state: 'completed' as const } }
    await store.saveRoster(owner, completed)
    assert.equal(await store.snapshot(owner, 'event-a'), null)
  } finally {
    db.close()
  }
})

test('single-flight runner drains a second athlete queued during an active request', async () => {
  const { db, store } = await setup()
  try {
    await store.enqueue(owner, command())
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let entered!: () => void
    const started = new Promise<void>((resolve) => {
      entered = resolve
    })
    let sent = 0
    const runner = new AttendanceSync(store, owner, async (_path, body) => {
      sent++
      entered()
      if (sent === 1) await gate
      return acknowledgment(JSON.parse(body))
    })
    const first = runner.run()
    await started
    await assert.rejects(store.remove(owner, 'event-a'))
    await store.enqueue(
      owner,
      command({ member: 'athlete-b', revision: 4, operation: 'operation-b' }),
    )
    assert.equal(first, runner.run())
    release()
    await first
    assert.equal(sent, 2)
    assert.equal(await store.next(owner), null)
  } finally {
    db.close()
  }
})

test('stopping a runtime preserves the in-flight acknowledgment and sends no later commands', async () => {
  const { db, store } = await setup()
  try {
    await store.enqueue(owner, command())
    await store.enqueue(
      owner,
      command({ member: 'athlete-b', revision: 4, operation: 'operation-b' }),
    )
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let entered!: () => void
    const started = new Promise<void>((resolve) => {
      entered = resolve
    })
    let sent = 0
    const runner = new AttendanceSync(store, owner, async (_path, body) => {
      sent++
      entered()
      await gate
      return acknowledgment(JSON.parse(body))
    })
    const flight = runner.run()
    await started
    runner.stop()
    release()
    await flight
    assert.equal(sent, 1)
    assert.equal((await store.snapshot(owner, 'event-a'))?.commands[0].state, 'acknowledged')
    assert.equal((await store.next(owner))?.payload.member, 'athlete-b')
  } finally {
    db.close()
  }
})

test('roster projection excludes notes, results, history and unrelated response properties', () => {
  const data = {
    ...roster,
    results: [{ values: { private: 'sensitive' } }],
    history: [],
    people: roster.people.map((p) => ({ ...p, session_note: 'private note', user_id: 'unneeded' })),
  }
  assert.deepEqual(fieldRoster(data, 'event-a'), roster)
  assert.throws(() => fieldRoster(data, 'wrong-event'))
})

test('storage rejection exposes no queued change and a mismatched receipt remains uncertain', async () => {
  const { db, store } = await setup()
  try {
    db.exec(
      "CREATE TRIGGER fail_save BEFORE INSERT ON attendance_commands BEGIN SELECT RAISE(ABORT,'storage full'); END",
    )
    await assert.rejects(store.enqueue(owner, command()))
    assert.equal(await store.next(owner), null)
    db.exec('DROP TRIGGER fail_save')
    await store.enqueue(owner, command())
    const runner = new AttendanceSync(store, owner, async () => ({
      ...acknowledgment(command()),
      member_id: 'wrong-athlete',
    }))
    await runner.run()
    assert.equal((await store.next(owner))?.state, 'uncertain')
    assert.equal((await store.snapshot(owner, 'event-a'))?.roster.people[0].attendance, 'unmarked')
    assert.equal((await store.snapshot(owner, 'event-a'))?.roster.people[0].revision, 1)
  } finally {
    db.close()
  }
})

test('acknowledgment and state transitions reject a command from another owner', async () => {
  const { db, store } = await setup()
  try {
    await store.enqueue(owner, command())
    const other = { ...owner, user: 'coach-b' }
    await store.saveRoster(other, roster)
    const head = (await store.next(owner))!
    await assert.rejects(store.setState(other, head, 'sending', null))
    await assert.rejects(store.acknowledge(other, head, acknowledgment(head.payload)))
    assert.equal((await store.snapshot(other, 'event-a'))?.roster.people[0].revision, 1)
    assert.equal((await store.next(owner))?.state, 'queued')
  } finally {
    db.close()
  }
})

const assessment = (): FieldRoster => ({
  ...roster,
  event: { ...roster.event, kind: 'assessment' },
  people: roster.people.map((person) => ({
    ...person,
    attendance: person.member_id === 'athlete-a' ? 'unmarked' : 'absent',
  })),
  definition: [
    { key: 'sprint', name: 'Sprint time', kind: 'number', unit: 's', min: 0, max: 60 },
    { key: 'technique', name: 'Technique', kind: 'text', unit: '' },
  ],
  results: [],
})
const scores = (
  overrides: Record<string, unknown> = {},
): Extract<FieldCommand, { action: 'result' }> => ({
  action: 'result',
  view: 'trainer',
  id: 'event-a',
  member: 'athlete-a',
  values: { sprint: 12.345, technique: 'Good control' },
  note: 'Assessed on pitch',
  revision: 0,
  operation: 'score-a',
  ...overrides,
})
const finishCommand = (): FieldCommand => ({
  action: 'finish',
  view: 'trainer',
  id: 'event-a',
  revision: 1,
  operation: 'finish-a',
})

test('assessment capture sequences attendance, precise scores, correction and confirmed completion', async () => {
  const { db, store } = await setup()
  try {
    const event = assessment()
    await store.saveRoster(owner, event)
    await assert.rejects(store.enqueue(owner, scores()), /present/)
    await store.enqueue(owner, command())
    const draft = {
      member: 'athlete-a',
      values: { sprint: '12.345', technique: 'Good control' },
      note: 'Assessed on pitch',
    }
    await store.saveDraft(owner, 'event-a', draft)
    await store.enqueue(owner, scores({ values: scoreValues(event.definition!, draft) }))
    assert.equal((await store.snapshot(owner, 'event-a'))?.drafts.length, 0)
    await assert.rejects(store.enqueue(owner, finishCommand()), /Confirm every/)
    const sent: FieldCommand[] = []
    const runner = new AttendanceSync(store, owner, async (_path, body) => {
      const c = JSON.parse(body) as FieldCommand
      sent.push(c)
      return acknowledgment(c)
    })
    await runner.run()
    assert.deepEqual(
      sent.map((c) => c.action),
      ['attendance', 'result'],
    )
    const saved = (await store.snapshot(owner, 'event-a'))!
    assert.equal(saved.roster.results?.[0].values.sprint, 12.345)
    assert.equal(saved.roster.results?.[0].revision, 1)
    await store.enqueue(
      owner,
      scores({
        operation: 'score-correction',
        revision: 1,
        values: { sprint: 12.3001, technique: 'Corrected control' },
      }),
    )
    await runner.run()
    assert.equal((await store.snapshot(owner, 'event-a'))?.roster.results?.[0].revision, 2)
    assert.equal(
      (await store.snapshot(owner, 'event-a'))?.roster.results?.[0].values.sprint,
      12.3001,
    )
    await store.enqueue(owner, finishCommand())
    let completed: FieldRoster | undefined
    await runner.run((value) => {
      if (value) completed = value
    })
    assert.equal(completed?.event.state, 'completed')
    assert.equal(completed?.results?.[0].revision, 2)
    assert.equal(await store.snapshot(owner, 'event-a'), null)
    assert.equal(await store.next(owner), null)
  } finally {
    db.close()
  }
})

test('score draft survives disk restart, remains owner-scoped and prevents stale refresh/completion', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'rafik-scores-'))
  const path = join(dir, 'scores.db')
  let db = new DatabaseSync(path)
  try {
    let store = new FieldStore(adapter(db))
    await store.initialize()
    const event = assessment()
    event.people[0].attendance = 'absent'
    await store.saveRoster(owner, event)
    await store.saveDraft(owner, 'event-a', {
      member: 'athlete-a',
      values: { sprint: '0.125' },
      note: 'Pending values',
    })
    db.close()
    db = new DatabaseSync(path)
    store = new FieldStore(adapter(db))
    await store.initialize()
    assert.equal((await store.snapshot(owner, 'event-a'))?.drafts[0].values.sprint, '0.125')
    await assert.rejects(store.saveRoster(owner, event), /draft/)
    await assert.rejects(store.enqueue(owner, finishCommand()), /draft/)
    await store.discardDraft({ ...owner, user: 'another-coach' }, 'event-a', 'athlete-a')
    assert.equal((await store.snapshot(owner, 'event-a'))?.drafts.length, 1)
    await store.discardDraft(owner, 'event-a', 'athlete-a')
    await store.enqueue(owner, finishCommand())
    await assert.rejects(
      store.saveDraft(owner, 'event-a', { member: 'athlete-a', values: {}, note: '' }),
      /completion/,
    )
    await assert.rejects(store.enqueue(owner, command({ operation: 'too-late' })), /earlier/)
  } finally {
    db.close()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('lost completion acknowledgment retries the same command and evicts only its event after commit', async () => {
  const { db, store } = await setup()
  try {
    const event = {
      ...roster,
      people: roster.people.map((p) => ({ ...p, attendance: 'absent' as const })),
    }
    await store.saveRoster(owner, event)
    const other = { ...owner, institution: 'other-university' }
    await store.saveRoster(other, event)
    await store.enqueue(owner, finishCommand())
    const requests: string[] = []
    let commits = 0
    let receipt: unknown
    const runner = new AttendanceSync(store, owner, async (_path, body) => {
      requests.push(body)
      if (!receipt) {
        commits++
        receipt = acknowledgment(JSON.parse(body))
      }
      if (requests.length === 1) throw Error('lost finish response')
      return receipt
    })
    await runner.run()
    assert.equal((await store.next(owner))?.state, 'uncertain')
    db.exec(
      "CREATE TRIGGER fail_evict BEFORE DELETE ON attendance_events WHEN OLD.owner NOT LIKE '%other-university%' BEGIN SELECT RAISE(ABORT,'disk failure'); END",
    )
    await runner.run()
    assert.equal((await store.next(owner))?.state, 'uncertain')
    assert.equal((await store.snapshot(owner, 'event-a'))?.roster.event.state, 'scheduled')
    db.exec('DROP TRIGGER fail_evict')
    await runner.run()
    assert.equal(requests[0], requests[1])
    assert.equal(requests[1], requests[2])
    assert.equal(commits, 1)
    assert.equal(await store.snapshot(owner, 'event-a'), null)
    assert.equal((await store.snapshot(other, 'event-a'))?.roster.event.state, 'scheduled')
  } finally {
    db.close()
  }
})

test('a rejected attendance dependency prevents assessment dispatch and preserves its score payload', async () => {
  const { db, store } = await setup()
  try {
    await store.saveRoster(owner, assessment())
    await store.enqueue(owner, command())
    await store.enqueue(owner, scores())
    const sent: string[] = []
    await new AttendanceSync(store, owner, async (_path, body) => {
      sent.push(body)
      throw new ApiFailure(403, 'event_unavailable')
    }).run()
    const saved = (await store.snapshot(owner, 'event-a'))!
    assert.equal(sent.length, 1)
    assert.equal(saved.commands[1].state, 'queued')
    assert.deepEqual(saved.commands[1].payload, scores())
    assert.equal(saved.roster.results?.length, 0)
  } finally {
    db.close()
  }
})

test('assessment usability validation distinguishes zero, missing and fractional values', () => {
  const drills = assessment().definition!
  const draft = { member: 'athlete-a', values: { sprint: '0', technique: 'Good' }, note: '' }
  assert.equal(scoreValues(drills, draft).sprint, 0)
  assert.equal(
    scoreValues(drills, { ...draft, values: { ...draft.values, sprint: '0.000125' } }).sprint,
    0.000125,
  )
  assert.throws(
    () => scoreValues(drills, { ...draft, values: { ...draft.values, sprint: '' } }),
    /Enter Sprint/,
  )
  assert.throws(
    () => scoreValues(drills, { ...draft, values: { ...draft.values, sprint: '61' } }),
    /limits/,
  )
  assert.throws(
    () => scoreValues(drills, { ...draft, values: { ...draft.values, sprint: '-1' } }),
    /limits/,
  )
})

test('assessment projection keeps only supported definition/results without history or unrelated notes', () => {
  const event = assessment()
  const response = {
    ...event,
    event: { ...event.event, definition: event.definition },
    history: ['private history'],
    results: [],
    notes: 'unrelated',
  }
  assert.deepEqual(fieldRoster(response, 'event-a'), event)
})

test('an uncertain score retries unchanged and rejects a mismatched receipt before adopting its revision', async () => {
  const { db, store } = await setup()
  try {
    const event = assessment()
    event.people[0].attendance = 'present'
    await store.saveRoster(owner, event)
    await store.enqueue(owner, scores())
    const requests: string[] = []
    let commits = 0
    let receipt: unknown
    const runner = new AttendanceSync(store, owner, async (_path, body) => {
      requests.push(body)
      if (!receipt) {
        commits++
        receipt = acknowledgment(JSON.parse(body))
      }
      if (requests.length === 1) throw Error('score response lost after commit')
      if (requests.length === 2)
        return { ...(receipt as object), values: { sprint: 99, technique: 'Wrong result' } }
      return receipt
    })
    await runner.run()
    await runner.run()
    assert.equal((await store.next(owner))?.state, 'uncertain')
    assert.equal((await store.snapshot(owner, 'event-a'))?.roster.results?.length, 0)
    await assert.rejects(store.enqueue(owner, scores({ operation: 'edited', revision: 0 })))
    await runner.run()
    assert.equal(commits, 1)
    assert.equal(requests[0], requests[1])
    assert.equal(requests[1], requests[2])
    assert.equal((await store.snapshot(owner, 'event-a'))?.roster.results?.[0].revision, 1)
    await store.enqueue(owner, scores({ operation: 'new-correction', revision: 1 }))
  } finally {
    db.close()
  }
})

test('offline workout start and completion survive disk restart; lost acknowledgments replay exact payloads without losing newer edits', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'rafik-workout-')),
    file = join(directory, 'workouts.db')
  let sqlite = new DatabaseSync(file),
    store = new FieldStore(adapter(sqlite))
  const institution = randomUUID(),
    scope = { ...owner, institution }
  const p: FieldWorkoutPackage = {
    id: randomUUID(),
    institution_id: institution,
    assignment_id: randomUUID(),
    member_id: randomUUID(),
    member_name: 'Synthetic athlete',
    occurrence_id: randomUUID(),
    title: 'Strength plan',
    day_id: randomUUID(),
    day_name: 'Field work',
    starts_at: '2020-01-01T10:00:00Z',
    training_date: '2020-01-01',
    timezone: 'UTC',
    allow_provisional_start: true,
    can_record: false,
    exercises: [
      { key: 'bench', name: 'Bench press', name_ar: 'ضغط', kind: 'strength', rest: 60, note: '' },
      { key: 'hold', name: 'Hold', name_ar: 'ثبات', kind: 'timed', rest: 30, note: '' },
    ],
    entries: [
      {
        exercise_key: 'bench',
        set_index: 0,
        reps: 10,
        load: 0,
        unit: 'kg',
        seconds: null,
        metres: null,
        effort: null,
        completed: false,
      },
      {
        exercise_key: 'hold',
        set_index: 0,
        reps: 0,
        load: 0,
        unit: 'kg',
        seconds: 30,
        metres: null,
        effort: null,
        completed: false,
      },
    ],
    session: null,
  }
  try {
    await store.initialize()
    await store.workouts.put(scope, p)
    assert.deepEqual(await store.institutions(scope.instance, scope.user), [institution])
    const id = randomUUID(),
      start = randomUUID()
    await store.workouts.start(scope, p.id, id, start)
    const entries = p.entries.map((e) => ({ ...e, completed: true }))
    await store.workouts.edit(scope, p.id, entries, 'captured offline')
    await store.workouts.save(scope, p.id, true, randomUUID())
    await assert.rejects(store.workouts.put(scope, p), /Resolve/)
    assert.equal((await store.workouts.list({ ...scope, user: 'other' })).length, 0)
    await store.workouts.state(scope, p.id, start, 'sending')
    sqlite.close()
    sqlite = new DatabaseSync(file)
    store = new FieldStore(adapter(sqlite))
    await store.initialize()
    assert.equal((await store.workouts.get(scope, p.id)).pending?.state, 'uncertain')
    let calls: string[] = [],
      lost = true
    const send = async (_path: string, body: string) => {
      calls.push(body)
      const command = JSON.parse(body)
      if (command.action === 'start' && lost) {
        lost = false
        throw Error('lost acknowledgment')
      }
      return {
        id,
        version: command.action === 'start' ? 1 : 2,
        completed_at: command.complete ? '2026-10-31T10:00:00Z' : null,
      }
    }
    await new WorkoutSync(store.workouts, scope, send).run(() => {
      throw Error('observer failure')
    })
    assert.equal((await store.workouts.get(scope, p.id)).pending?.state, 'uncertain')
    await new WorkoutSync(store.workouts, scope, send).run()
    assert.equal(calls[0], calls[1])
    assert.equal(calls.length, 3)
    const saved = await store.workouts.get(scope, p.id)
    assert.equal(saved.pending, null)
    assert.equal(saved.intent, null)
    assert.equal(saved.entries[0].load, 0)
    assert.equal(saved.session?.version, 2)
    assert.ok(saved.session?.completed_at)
    assert.equal(saved.note, 'captured offline')
    assert.equal(saved.localRevision, saved.syncedRevision)
    await assert.rejects(store.workouts.edit(scope, p.id, entries, 'after completion'), /read-only/)
  } finally {
    sqlite.close()
    rmSync(directory, { recursive: true, force: true })
  }
})

test('workout denial/conflict preserves exact command and draft; edits during a held save remain unsynced', async () => {
  const sqlite = new DatabaseSync(':memory:'),
    store = new FieldStore(adapter(sqlite))
  await store.initialize()
  const scope = { ...owner, institution: randomUUID() },
    sid = randomUUID()
  const p: FieldWorkoutPackage = {
    id: randomUUID(),
    institution_id: scope.institution,
    assignment_id: randomUUID(),
    member_id: randomUUID(),
    member_name: 'Synthetic',
    occurrence_id: randomUUID(),
    title: 'Plan',
    day_id: randomUUID(),
    day_name: 'Distance',
    starts_at: '2020-01-01T10:00:00Z',
    training_date: '2020-01-01',
    timezone: 'UTC',
    allow_provisional_start: false,
    can_record: true,
    exercises: [{ key: 'run', name: 'Run', name_ar: 'جري', kind: 'distance', rest: 0, note: '' }],
    entries: [
      {
        exercise_key: 'run',
        set_index: 0,
        reps: 0,
        load: 0,
        unit: 'kg',
        seconds: null,
        metres: 100,
        effort: null,
        completed: false,
      },
    ],
    session: { id: sid, version: 3, note: '', completed_at: null },
  }
  try {
    await store.workouts.put(scope, p)
    const e = p.entries.map((e) => ({ ...e, metres: 123.45, completed: true }))
    await store.workouts.edit(scope, p.id, e, 'first')
    await store.workouts.save(scope, p.id, false, randomUUID())
    let begin!: () => void, release!: () => void
    const started = new Promise<void>((r) => {
        begin = r
      }),
      gate = new Promise<void>((r) => {
        release = r
      })
    const runner = new WorkoutSync(store.workouts, scope, async () => {
      begin()
      await gate
      return { id: sid, version: 4, completed_at: null }
    })
    const sending = runner.run()
    await started
    await store.workouts.edit(scope, p.id, e, 'newer while sending')
    release()
    await sending
    let r = await store.workouts.get(scope, p.id)
    assert.equal(r.note, 'newer while sending')
    assert.notEqual(r.localRevision, r.syncedRevision)
    await store.workouts.save(scope, p.id, true, randomUUID())
    const deny = new WorkoutSync(store.workouts, scope, async () => {
      throw new ApiFailure(403, 'forbidden')
    })
    await deny.run()
    r = await store.workouts.get(scope, p.id)
    const payload = JSON.stringify(r.pending?.payload)
    assert.equal(r.blocked, true)
    assert.equal(r.pending?.state, 'blocked')
    assert.ok(r.intent)
    await store.workouts.retry(scope, p.id)
    await new WorkoutSync(store.workouts, scope, async () => {
      throw new ApiFailure(409, 'conflict')
    }).run()
    r = await store.workouts.get(scope, p.id)
    assert.equal(r.pending?.state, 'needs_attention')
    assert.equal(JSON.stringify(r.pending?.payload), payload)
    await assert.rejects(store.workouts.remove(scope, p.id), /Resolve saved workout/)
    const bad = { ...p, entries: p.entries.map((e) => ({ ...e, metres: 0, completed: true })) }
    await assert.rejects(store.workouts.edit(scope, p.id, bad.entries, ''))
    await store.workouts.replaceRejected(scope, p.id, {
      id: sid,
      version: 5,
      completed_at: null,
      note: 'reviewed server copy',
      entries: e,
      can_record: true,
    })
    r = await store.workouts.get(scope, p.id)
    assert.equal(r.pending, null)
    assert.equal(r.intent, null)
    assert.equal(r.note, 'reviewed server copy')
    await store.workouts.edit(scope, p.id, e, 'retained device draft')
    await store.workouts.block(scope)
    await assert.rejects(
      store.workouts.restoreAccess(scope, p.id, { id: sid, version: 6, can_record: true }),
      /Review/,
    )
    await store.workouts.restoreAccess(scope, p.id, { id: sid, version: 5, can_record: true })
    r = await store.workouts.get(scope, p.id)
    assert.equal(r.blocked, false)
    assert.equal(r.note, 'retained device draft')
    for (let i = 0; i < 11; i++)
      await store.workouts.put(scope, {
        ...p,
        id: randomUUID(),
        member_name: 'Second page athlete ' + i,
      })
    assert.equal((await store.workouts.list(scope, 0, 'Second page')).length, 10)
    assert.equal((await store.workouts.list(scope, 10, 'Second page')).length, 1)
    assert.equal(await store.workouts.count(scope, 'Second page'), 11)
    const originalNext = store.workouts.next.bind(store.workouts)
    let injected = false,
      sends = 0
    const reentrant = new WorkoutSync(store.workouts, scope, async () => {
      sends++
      return { id: sid, version: 6, completed_at: null }
    })
    store.workouts.next = async (owner) => {
      const next = await originalNext(owner)
      if (!next && !injected) {
        injected = true
        await store.workouts.save(scope, p.id, false, randomUUID())
        void reentrant.run()
      }
      return next
    }
    await reentrant.run()
    assert.equal(sends, 1, 'a save queued at the final empty read schedules another pass')
    assert.equal((await store.workouts.get(scope, p.id)).session?.version, 6)
    store.workouts.next = originalNext
    assert.equal(
      (await store.workouts.list({ ...scope, user: 'other' }, 0, 'Second page')).length,
      0,
    )
  } finally {
    sqlite.close()
  }
})
