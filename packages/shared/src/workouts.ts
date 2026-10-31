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
  /** Default for new assignments; never changes existing plan policies. */
  automaticPreparation?: boolean
  presentation?: { goal?: string; level?: 'beginner' | 'mixed' | 'experienced'; cover?: string }
  schema: number
  cycleWeeks?: number
  description?: string
  descriptionAr?: string
  days: PlanDay[]
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
  source_kind?: 'assignment' | 'additional'
  occurrence_id?: string
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
