import type {
  FieldAttendance,
  FieldAttendanceCommand,
  FieldEvent,
  FieldPerson,
  FieldRoster,
  FieldDrill,
  FieldResult,
  FieldCommand,
} from '@rafik/shared/contracts'

export type {
  FieldAttendance,
  FieldAttendanceCommand,
  FieldEvent,
  FieldPerson,
  FieldRoster,
  FieldDrill,
  FieldResult,
  FieldCommand,
}
export type Owner = { instance: string; user: string; institution: string }
export const ownerKey = (owner: Owner) =>
  JSON.stringify([owner.instance, owner.user, owner.institution])
export type CommandState =
  'queued' | 'sending' | 'uncertain' | 'acknowledged' | 'needs_attention' | 'blocked'
export type Command = {
  seq: number
  owner: string
  event_id: string
  payload: FieldCommand
  state: CommandState
  error: string | null
}
export type CachedRoster = FieldRoster & { saved_at: string; blocked: boolean }
export type ScoreDraft = { member: string; values: Record<string, string>; note: string }
export type EventSnapshot = { roster: CachedRoster; commands: Command[]; drafts: ScoreDraft[] }

export class ApiFailure extends Error {
  status: number
  code: string
  constructor(status: number, code: string) {
    super(code)
    this.status = status
    this.code = code
  }
}

export class ConnectionFailure extends Error {
  constructor() {
    super('Could not reach your institution. Check your connection and try again.')
  }
}

export function failureText(error: unknown): string {
  if (error instanceof ApiFailure) {
    const messages: Record<string, string> = {
      invalid_credentials: 'The email or password is incorrect. Check your institution URL too.',
      rate_limited: 'Too many attempts. Wait a few minutes before trying again.',
      conflict: 'Someone changed this record. Review the server event before correcting it.',
      operation_reused: 'The server rejected this operation ID. Review before making a new change.',
      forbidden: 'Your current account no longer has permission for this event.',
      event_unavailable: 'This event is no longer available to your account.',
      workspace_unavailable: 'Your institution access is no longer available.',
      unauthenticated: 'Sign in again to the same account and institution to send saved work.',
      invalid_mobile_session:
        'Sign in again to the same account and institution to send saved work.',
      event_not_started: 'The event has not started or was cancelled. Review the server event.',
      group_workout_results_required:
        'Complete or explicitly skip participant workouts in the web app before finishing this group event.',
      results_required: 'Assessment results are required. Complete this correction in the web app.',
      attendance_required: 'Confirm attendance before saving scores or completing this event.',
      invalid_results: 'Check every assessment value and its limits before correcting this record.',
    }
    return (
      messages[error.code] || `The server rejected this request (${error.status}: ${error.code}).`
    )
  }
  return error instanceof Error ? error.message : 'The request could not be completed.'
}

const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error('Invalid server data.')
  return value as Record<string, unknown>
}
const string = (value: unknown): string => {
  if (typeof value !== 'string') throw Error('Invalid server data.')
  return value
}
const revision = (value: unknown): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw Error('Invalid server revision.')
  return value as number
}
export function attendance(value: unknown): FieldAttendance {
  if (!['unmarked', 'present', 'absent', 'excused'].includes(String(value)))
    throw Error('Invalid attendance data.')
  return value as FieldAttendance
}
export function fieldEvent(input: unknown): FieldEvent {
  const e = record(input)
  if (
    !['training', 'assessment'].includes(String(e.kind)) ||
    !['scheduled', 'cancelled', 'completed'].includes(String(e.state))
  )
    throw Error('Invalid event data.')
  return {
    id: string(e.id),
    title: string(e.title),
    kind: e.kind as FieldEvent['kind'],
    state: e.state as FieldEvent['state'],
    revision: revision(e.revision),
    starts_at: string(e.starts_at),
    ends_at: string(e.ends_at),
    timezone: string(e.timezone),
    location: string(e.location),
  }
}
export function fieldPerson(input: unknown): FieldPerson {
  const p = record(input)
  if (!['staff', 'trainee'].includes(String(p.duty)) || typeof p.active !== 'boolean')
    throw Error('Invalid roster data.')
  return {
    member_id: string(p.member_id),
    name: string(p.name),
    duty: p.duty as FieldPerson['duty'],
    attendance: attendance(p.attendance),
    revision: revision(p.revision),
    active: p.active,
  }
}
export function fieldRoster(input: unknown, id: string): FieldRoster {
  const data = record(input)
  const event = fieldEvent(data.event)
  if (event.id !== id || !Array.isArray(data.people)) throw Error('Invalid event roster.')
  const people = data.people.map(fieldPerson)
  if (event.kind !== 'assessment') return { event, people }
  const raw = record(data.event)
  if (!Array.isArray(raw.definition) || !raw.definition.length || !Array.isArray(data.results))
    throw Error('This assessment is missing its score definition. Refresh from your institution.')
  const definition = raw.definition.map((value): FieldDrill => {
    const d = record(value)
    if (!['number', 'text'].includes(String(d.kind))) throw Error('Invalid score definition.')
    const drill: FieldDrill = {
      key: string(d.key),
      name: string(d.name),
      unit: string(d.unit),
      kind: d.kind as FieldDrill['kind'],
    }
    for (const bound of ['min', 'max'] as const)
      if (d[bound] !== undefined && d[bound] !== null) {
        if (typeof d[bound] !== 'number' || !Number.isFinite(d[bound]))
          throw Error('Invalid score limits.')
        drill[bound] = d[bound]
      }
    return drill
  })
  const results = data.results.map((value) => fieldResult(value, id))
  if (results.some((r) => !people.some((p) => p.member_id === r.member_id && p.duty === 'trainee')))
    throw Error('Invalid assessment participants.')
  return { event, people, definition, results }
}

export function fieldResult(input: unknown, event: string): FieldResult {
  const r = record(input)
  if (r.event_id !== event) throw Error('Invalid assessment event.')
  const values = record(r.values)
  for (const v of Object.values(values))
    if (typeof v !== 'string' && (typeof v !== 'number' || !Number.isFinite(v)))
      throw Error('Invalid assessment values.')
  return {
    event_id: event,
    member_id: string(r.member_id),
    values: values as FieldResult['values'],
    note: string(r.note),
    revision: revision(r.revision),
    recorded_at: string(r.recorded_at),
    recorded_by: string(r.recorded_by),
  }
}

/** Usability validation only. Server assessment validation remains authoritative. */
export function scoreValues(definition: FieldDrill[], draft: ScoreDraft): FieldResult['values'] {
  const values: FieldResult['values'] = {}
  for (const drill of definition) {
    const raw = (draft.values[drill.key] || '').trim()
    if (!raw) throw Error(`Enter ${drill.name}${drill.unit ? ` (${drill.unit})` : ''}.`)
    if (drill.kind === 'text') {
      if (raw.length > 1000) throw Error(`${drill.name} must be at most 1000 characters.`)
      values[drill.key] = raw
    } else {
      // Preserve source-backed fractional values; never truncate to integers.
      const value = Number(
        raw
          .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
          .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0))
          .replace(/٫/g, '.'),
      )
      if (
        !Number.isFinite(value) ||
        Math.abs(value) > 1e9 ||
        (drill.min !== undefined && value < drill.min) ||
        (drill.max !== undefined && value > drill.max)
      )
        throw Error(
          `Check ${drill.name}${drill.unit ? ` (${drill.unit})` : ''} and its allowed limits.`,
        )
      values[drill.key] = value
    }
  }
  if (draft.note.trim().length > 2000)
    throw Error('Assessor notes must be at most 2000 characters.')
  return values
}

export function finishProblems(roster: FieldRoster): string[] {
  const athletes = roster.people.filter((p) => p.duty === 'trainee')
  const problems: string[] = []
  const unmarked = athletes.filter((p) => p.attendance === 'unmarked').length
  if (unmarked)
    problems.push(`Confirm attendance for ${unmarked} athlete${unmarked === 1 ? '' : 's'}.`)
  if (roster.event.kind === 'assessment') {
    if (!roster.definition?.length || !roster.results)
      problems.push('Download the assessment definition and results online.')
    const missing = athletes.filter(
      (p) =>
        p.attendance === 'present' && !roster.results?.some((r) => r.member_id === p.member_id),
    ).length
    if (missing)
      problems.push(`Confirm scores for ${missing} present athlete${missing === 1 ? '' : 's'}.`)
  }
  return problems
}

export const stateText: Record<CommandState, string> = {
  queued: 'Saved on device — waiting to send',
  sending: 'Sending to institution…',
  uncertain: 'Saved on device — server confirmation unknown',
  acknowledged: 'Confirmed by institution',
  needs_attention: 'Needs your review — sending paused',
  blocked: 'Access blocked — saved work retained',
}
