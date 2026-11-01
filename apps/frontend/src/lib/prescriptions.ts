import type { Entry, Prescription, PrescriptionExercise, Target } from './domain'
import sample from '../content/sample.json'
import { language, locale, t } from './i18n'
/** Joins the exercise details used in program and workout previews. */
export const exerciseInfo = (e: PrescriptionExercise) =>
  e.info || sample.exercises.find((x) => x.id === e.exerciseId)
/** Returns the displayed exercise name, including any chosen alternative. */
export const exerciseName = (e: PrescriptionExercise) => {
  const info = exerciseInfo(e)
  return (locale.value === 'ar' ? info?.name_ar || info?.name : info?.name) || e.exerciseId
}
/** Formats the actual exercise values an athlete recorded. */
export const actualLabel = (e: Entry, kind = 'strength') => {
  const base =
    kind === 'timed'
      ? `${e.seconds ?? 0} ${language('sec', 'ث')}`
      : kind === 'distance'
        ? `${e.metres ?? 0} ${language('m', 'م')}`
        : `${e.load} ${t(e.unit)} × ${e.reps}`
  return base + (e.effort ? ` · RPE ${e.effort}` : '')
}
/** Formats the prescribed target values shown before an exercise is logged. */
export const targetLabel = (e: PrescriptionExercise, target: Target = e) => {
  const base =
    e.kind === 'timed'
      ? `${target.seconds ?? 0} ${language('sec', 'ث')}`
      : e.kind === 'distance'
        ? `${target.metres ?? 0} ${language('m', 'م')}`
        : `${target.reps} ${t('reps')} · ${target.load} ${t(e.unit)}`
  return base + (target.effort ? ` · RPE ${target.effort}` : '')
}
/** Adds defaults for older saved prescriptions before current views edit them. */
export function upgradePrescription(p: Prescription): Prescription {
  p.days.forEach((d) =>
    d.exercises.forEach((e) => {
      e.kind ||= 'strength'
      e.seconds ||= 30
      e.metres ||= 100
    }),
  )
  if (p.schema === 2) return p
  p.schema = 2
  p.cycleWeeks = Math.max(1, Math.ceil(p.days.length / 7))
  p.days.forEach((d, i) => {
    d.week = Math.floor(i / 7) + 1
    d.weekday = i % 7
  })
  return p
}

/** Project actual identity without changing the immutable prescribed targets. */
/** Builds the recorded exercise entry while keeping missing actual values distinct from zero. */
export function performedExercise(
  exercise: PrescriptionExercise,
  entries: Entry[],
): PrescriptionExercise {
  const id = entries.find((e) => e.exercise_key === exercise.key)?.exercise_id
  const alternative = exercise.alternatives?.find((a) => a.exerciseId === id)
  return alternative
    ? { ...exercise, exerciseId: alternative.exerciseId, info: alternative.info }
    : exercise
}
