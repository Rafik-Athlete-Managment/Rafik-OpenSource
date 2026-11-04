import type { WorkoutTemplate as TemplateDTO } from '@rafik/shared/contracts'
import type { PlanDay } from './domain.ts'
import { clone } from './domain.ts'
export type WorkoutTemplate = Omit<TemplateDTO, 'workout'> & { workout: PlanDay }
/** Imports own their identities. A later template edit never rewrites the copy. */
export function copyWorkout(workout: PlanDay, slot?: { week: number; weekday: number }): PlanDay {
  const day = clone(workout)
  day.id = crypto.randomUUID()
  day.restDay = false
  if (slot) Object.assign(day, slot)
  day.exercises.forEach((ex) => (ex.key = crypto.randomUUID()))
  return day
}
