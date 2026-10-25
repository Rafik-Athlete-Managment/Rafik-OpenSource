export type Unit = 'kg' | 'lb'
export type ExerciseKind = 'strength' | 'timed' | 'distance'
export interface Target {
  reps: number
  load: number
  seconds?: number | null
  metres?: number | null
  effort?: number | null
}
export interface Exercise {
  id: string
  name: string
  name_ar: string
  equipment: string
  equipment_ar: string
  instructions: string
  instructions_ar: string
  movement: string
  institution_id?: string
  created_by?: string
  owner_id?: string | null
  active?: boolean
  revision?: number
  kind?: ExerciseKind
  source_ref?: string | null
  category?: string | null
  body_part?: string | null
  target_muscle?: string | null
  media_ref?: string | null
  scope?: 'private' | 'organization'
  body_parts?: string[]
  muscles?: string[]
  equipment_items?: string[]
  media_asset?: string
  media_type?: string
  media_filename?: string
  media_url?: string
}
export interface PrescriptionExercise {
  alternatives?: { exerciseId: string; info?: Exercise }[]
  key: string
  exerciseId: string
  kind?: ExerciseKind
  group?: string
  seconds?: number
  metres?: number
  effort?: number | null
  targets?: Target[]
  info?: Exercise
  sets: number
  reps: number
  load: number
  unit: Unit
  rest: number
  note: string
}
export interface PlanDay {
  id: string
  name: string
  nameAr?: string
  minutes: number
  week?: number
  weekday?: number
  restDay?: boolean
  exercises: PrescriptionExercise[]
}
export interface Prescription {
  presentation?: { goal?: string; level?: 'beginner' | 'mixed' | 'experienced'; cover?: string }
  schema: number
  cycleWeeks?: number
  description?: string
  descriptionAr?: string
  days: PlanDay[]
}
export interface Plan {
  listed?: boolean
  revision?: number
  id: string
  coach_id: string
  title: string
  draft: Prescription
  draft_version: number
  archived: boolean
  updated_at: string
}
export interface PlanVersion {
  id: string
  plan_id: string
  coach_id: string
  revision: number
  title: string
  prescription: Prescription
  is_public: boolean
}
export interface Profile {
  id: string
  display_name: string
  locale: 'en' | 'ar'
  units: Unit
  timezone: string
}
export interface Assignment {
  id: string
  relationship_id: string
  client_id: string
  coach_id: string
  version_id: string
  start_date: string
  end_date?: string | null
  schedule_mode?: 'flexible' | 'cycle'
  revision?: number
  state: string
}
export interface Relationship {
  id: string
  coach_id: string
  client_id: string
  state: string
}
export interface Invitation {
  id: string
  intended_email: string
  version_id: string
  status: string
  expires_at: string
  created_at: string
}
export interface Entry {
  exercise_id?: string | null
  exercise_key: string
  set_index: number
  reps: number
  load: number
  unit: Unit
  completed: boolean
  seconds?: number | null
  metres?: number | null
  effort?: number | null
}
export interface Session {
  institution_id?: string
  member_id?: string
  id: string
  client_id: string
  coach_id: string | null
  assignment_id: string | null
  version_id: string | null
  day_id: string
  occurrence_key?: string
  local_date?: string
  title: string
  prescription: PlanDay
  status: 'in_progress' | 'completed'
  entries: Entry[]
  note: string
  coach_note: string
  reviewed_at: string | null
  started_at: string
  completed_at: string | null
  version: number
  /** Institution sessions recorded by a coach on the athlete's behalf. */
  recorded_mode?: 'self' | 'delegated'
  recorded_by?: string | null
  recorded_by_name?: string | null
  can_record?: boolean
  completed_by?: string
  completed_by_name?: string
  completed_by_role?: 'trainer' | 'trainee'
}
export interface PendingOperation {
  id: string
  expectedVersion: number
  entries: Entry[]
  note: string
  complete: boolean
  localRevision: number
}
export interface LocalSession {
  id: string
  owner: string
  session: Session
  localRevision: number
  syncedRevision: number
  pending?: PendingOperation
  syncError?: string
  conflict?: boolean
  restUntil?: number
  updatedAt: string
}
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
export const convertLoad = (value: number, from: Unit, to: Unit) =>
  from === to
    ? value
    : Math.round((from === 'kg' ? value * 2.2046226218 : value / 2.2046226218) * 100) / 100

export interface ClientContext {
  id: string
  goals: string
  constraints: string
  notes: string
  revision: number
}
export interface ScheduledDay {
  date: string
  scheduled_date: string
  day: PlanDay
  state: string
  session_id: string | null
}

/** Hydrate old local metadata without changing owner IDs or exact pending operation payloads. */
export function restoreInstitution(row: LocalSession | undefined) {
  if (row) {
    const previous = row.session as Session & { workspace_id?: string }
    if (!previous.institution_id && previous.workspace_id)
      previous.institution_id = previous.workspace_id
  }
  return row
}
