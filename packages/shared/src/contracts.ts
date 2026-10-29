export type ApiUser = {
  id: string
  email: string | null
  user_metadata: Record<string, unknown>
}

export type ApiErrorBody = { message: string }

export type WorkoutTemplate = {
  id: string
  institution_id: string
  title: string
  revision: number
  archived: boolean
  can_edit: boolean
  workout: import('./database.types.ts').Json
  updated_at: string
}

/** Minimal calendar projection retained by the Android attendance client. */
export type FieldAttendance = 'unmarked' | 'present' | 'absent' | 'excused'
export type FieldEvent = {
  id: string
  title: string
  kind: 'training' | 'assessment'
  starts_at: string
  ends_at: string
  timezone: string
  location: string
  state: 'scheduled' | 'cancelled' | 'completed'
  revision: number
}
export type FieldPerson = {
  member_id: string
  name: string
  duty: 'staff' | 'trainee'
  attendance: FieldAttendance
  revision: number
  active: boolean
}
export type FieldDrill = {
  key: string
  name: string
  kind: 'number' | 'text'
  unit: string
  min?: number
  max?: number
}
export type FieldResult = {
  event_id: string
  member_id: string
  values: Record<string, string | number>
  note: string
  revision: number
  recorded_at: string
  recorded_by: string
}
export type FieldRoster = {
  event: FieldEvent
  people: FieldPerson[]
  /** Absent on older attendance-only device packages; refresh online before scoring. */
  definition?: FieldDrill[]
  results?: FieldResult[]
}
export type FieldAttendanceCommand = {
  action: 'attendance'
  view: 'trainer'
  id: string
  member: string
  attendance: FieldAttendance
  revision: number
  operation: string
}
export type FieldResultCommand = {
  action: 'result'
  view: 'trainer'
  id: string
  member: string
  values: Record<string, string | number>
  note: string
  revision: number
  operation: string
}
export type FieldFinishCommand = {
  action: 'finish'
  view: 'trainer'
  id: string
  member?: never
  revision: number
  operation: string
}
export type FieldCommand = FieldAttendanceCommand | FieldResultCommand | FieldFinishCommand

/** Server-derived sequence state; clients must not select a different plan day. */
export type WorkoutAgendaItem = {
  assignment_id: string
  member_id: string
  member_name: string
  title: string
  goal: string | null
  cursor: number
  preview?: {
    minutes: number | null
    exercise_count: number
    prescribed_sets: number
    exercises: { name: string; name_ar?: string; sets: number; kind: string }[]
    muscle_focus: string[]
    cover?: string
  }
  day: { id: string; name: string; nameAr?: string } | null
  state: 'unscheduled' | 'scheduled' | 'ready' | 'overdue' | 'in_progress' | 'paused'
  blocked: 'participation_unavailable' | 'assignment_unavailable' | 'no_workout_days' | null
  occurrence: {
    id: string
    revision: number
    starts_at: string | null
    ends_at: string | null
    timezone: string
    training_date: string
  } | null
  session: { id: string; recorded_mode: string; can_record?: boolean } | null
  can_start: boolean
  can_schedule: boolean
}
export type WorkoutAgenda = {
  queue?: 'recording' | 'today' | 'planning' | 'actionable' | null
  items: WorkoutAgendaItem[]
  total: number
  offset: number
  limit: number
}

export type AthletePlanStatus = 'active' | 'upcoming' | 'expired' | 'ended'
export type AthletePlanSummary = {
  id: string
  member_id: string
  member_name: string
  member_active: boolean
  start_date: string
  end_date: string | null
  state: string
  status: AthletePlanStatus
  schedule_mode: string
  /** Optional goal and sport label; an athlete can hold several active plans. */
  goal: string | null
  sport: string | null
  revision: number
  adaptation_revision?: number
  /** Read-only next-workout summary for current plans (same state rule as the workout agenda); null otherwise. */
  next_workout?: {
    state: WorkoutAgendaItem['state']
    starts_at: string | null
    training_date: string | null
    timezone: string | null
  } | null
  version: {
    id: string
    title: string
    revision: number
    program_id: string
    prescription?: unknown
  }
}
export type AthletePlanPage = {
  items: AthletePlanSummary[]
  total: number
  next: number | null
  today: string
  zone: string
}

/** Online-only participant history; never part of the offline event package. */
export type FieldHistoryEntry = {
  id: string
  member_id: string
  recorded_at: string
  recorded_by: string | null
  recorded_name: string | null
} & (
  | { kind: 'attendance'; previous_attendance: FieldAttendance; attendance: FieldAttendance }
  | { kind: 'results'; revision: number; values: Record<string, string | number>; note: string }
)
export type FieldHistoryPage = { items: FieldHistoryEntry[]; next: number | null }
