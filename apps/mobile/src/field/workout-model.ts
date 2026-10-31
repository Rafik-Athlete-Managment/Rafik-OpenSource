import type { FieldWorkoutEntry, FieldWorkoutPackage } from '@rafik/shared/contracts'
export type { FieldWorkoutEntry, FieldWorkoutPackage }

const invalid = () => Error('Invalid workout package. Refresh it online before recording.')
const text = (v: unknown): v is string => typeof v === 'string'
const uuid = (v: unknown): v is string => text(v) && /^[a-f0-9-]{36}$/i.test(v)
export function workoutPackage(input: unknown): FieldWorkoutPackage {
  const p = input as FieldWorkoutPackage
  if (
    !p ||
    ![p.id, p.institution_id, p.assignment_id, p.member_id].every(uuid) ||
    !text(p.day_id) ||
    !p.day_id ||
    (p.occurrence_id !== null && !uuid(p.occurrence_id)) ||
    ![p.title, p.day_name, p.member_name, p.timezone].every(text) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(p.training_date) ||
    (p.starts_at !== null && !Number.isFinite(Date.parse(p.starts_at))) ||
    typeof p.allow_provisional_start !== 'boolean' ||
    typeof p.can_record !== 'boolean' ||
    !Array.isArray(p.exercises) ||
    !p.exercises.length ||
    p.exercises.length > 500 ||
    p.exercises.some(
      (e) =>
        !e ||
        !text(e.key) ||
        !text(e.name) ||
        !text(e.name_ar) ||
        !text(e.note) ||
        !Number.isFinite(e.rest) ||
        !['strength', 'timed', 'distance'].includes(e.kind),
    ) ||
    new Set(p.exercises.map((e) => e.key)).size !== p.exercises.length ||
    (p.session !== null &&
      (!uuid(p.session?.id) ||
        !Number.isInteger(p.session.version) ||
        p.session.version < 1 ||
        !text(p.session.note) ||
        (p.session.completed_at !== null && !Number.isFinite(Date.parse(p.session.completed_at)))))
  )
    throw invalid()
  try {
    new Intl.DateTimeFormat('en', { timeZone: p.timezone })
  } catch {
    throw invalid()
  }
  validateEntries(p, p.entries, false)
  if (p.targets !== undefined) validateEntries(p, p.targets, false)
  return {
    id: p.id,
    institution_id: p.institution_id,
    assignment_id: p.assignment_id,
    member_id: p.member_id,
    member_name: p.member_name,
    occurrence_id: p.occurrence_id,
    title: p.title,
    day_id: p.day_id,
    day_name: p.day_name,
    day_name_ar: text(p.day_name_ar) ? p.day_name_ar : '',
    starts_at: p.starts_at,
    training_date: p.training_date,
    timezone: p.timezone,
    allow_provisional_start: p.allow_provisional_start,
    can_record: p.can_record,
    exercises: p.exercises.map((e) => ({
      key: e.key,
      name: e.name,
      name_ar: e.name_ar,
      kind: e.kind,
      rest: e.rest,
      note: e.note,
    })),
    targets: p.targets?.map(projectEntry),
    entries: p.entries.map(projectEntry),
    session: p.session
      ? {
          id: p.session.id,
          version: p.session.version,
          note: p.session.note,
          completed_at: p.session.completed_at,
        }
      : null,
  }
}
export function validateEntries(
  p: FieldWorkoutPackage,
  entries: FieldWorkoutEntry[],
  complete: boolean,
) {
  if (
    !Array.isArray(entries) ||
    !entries.length ||
    entries.length > 10000 ||
    entries.some((e) => !e || typeof e !== 'object') ||
    new Set(entries.map((e) => e.exercise_key + ':' + e.set_index)).size !== entries.length ||
    (p.entries && entries.length !== p.entries.length)
  )
    throw invalid()
  const expected = new Set(p.entries.map((e) => e.exercise_key + ':' + e.set_index)),
    exercises = new Map(p.exercises.map((e) => [e.key, e]))
  for (const e of entries) {
    const exercise = exercises.get(e.exercise_key)
    if (
      !exercise ||
      !expected.has(e.exercise_key + ':' + e.set_index) ||
      (e.exercise_id !== null && e.exercise_id !== undefined && !text(e.exercise_id)) ||
      !Number.isInteger(e.set_index) ||
      e.set_index < 0 ||
      !['kg', 'lb'].includes(e.unit) ||
      !Number.isInteger(e.reps) ||
      e.reps < 0 ||
      e.reps > 200 ||
      !Number.isFinite(e.load) ||
      e.load < 0 ||
      e.load > 1000 ||
      typeof e.completed !== 'boolean' ||
      (e.seconds !== null &&
        (!Number.isInteger(e.seconds) || e.seconds < 0 || e.seconds > 86400)) ||
      (e.metres !== null && (!Number.isFinite(e.metres) || e.metres < 0 || e.metres > 1000000)) ||
      (e.effort !== null && (!Number.isFinite(e.effort) || e.effort < 1 || e.effort > 10))
    )
      throw invalid()
    if (
      e.completed &&
      (exercise.kind === 'timed'
        ? (e.seconds || 0) < 1
        : exercise.kind === 'distance'
          ? (e.metres || 0) < 1
          : e.reps < 1)
    )
      throw Error('Record an actual result before marking the set done.')
  }
  if (complete && entries.some((e) => !e.completed))
    throw Error('Mark every set done before finishing the workout.')
}
export function startTimeReached(p: FieldWorkoutPackage, now = new Date()) {
  if (p.starts_at) return now.getTime() >= Date.parse(p.starts_at)
  const parts = new Intl.DateTimeFormat('en', {
    calendar: 'gregory',
    numberingSystem: 'latn',
    timeZone: p.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const part = (name: string) => parts.find((p) => p.type === name)!.value
  return `${part('year')}-${part('month')}-${part('day')}` >= p.training_date
}
export type WorkoutPending = {
  payload: Record<string, unknown>
  state: 'queued' | 'sending' | 'uncertain' | 'needs_attention' | 'blocked'
}
export type WorkoutRecord = {
  package: FieldWorkoutPackage
  entries: FieldWorkoutEntry[]
  note: string
  localRevision: number
  syncedRevision: number
  session: { id: string; version: number; completed_at: string | null } | null
  pending: WorkoutPending | null
  intent: {
    entries: FieldWorkoutEntry[]
    note: string
    complete: boolean
    localRevision: number
    operation: string
  } | null
  blocked: boolean
  error: string
  saved_at: string
}

// Project only transport fields; never persist extra properties from a response.
function projectEntry(e: FieldWorkoutEntry): FieldWorkoutEntry {
  return {
    exercise_id: e.exercise_id ?? null,
    exercise_key: e.exercise_key,
    set_index: e.set_index,
    reps: e.reps,
    load: e.load,
    unit: e.unit,
    seconds: e.seconds,
    metres: e.metres,
    effort: e.effort,
    completed: e.completed,
  }
}
