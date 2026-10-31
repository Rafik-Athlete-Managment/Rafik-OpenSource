import type { Unit, Prescription, Entry, Session } from '@rafik/shared/workouts'
export type {
  Unit,
  ExerciseKind,
  Target,
  Exercise,
  PrescriptionExercise,
  PlanDay,
  Prescription,
  Entry,
  Session,
} from '@rafik/shared/workouts'

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

/** Hydrate old local metadata without changing owner IDs or exact pending operation payloads. */
export function restoreInstitution(row: LocalSession | undefined) {
  if (row) {
    const previous = row.session as Session & { workspace_id?: string }
    if (!previous.institution_id && previous.workspace_id)
      previous.institution_id = previous.workspace_id
  }
  return row
}
