import type { Exercise, PrescriptionExercise } from './domain'

/** Picker integrity only; publishing authority and snapshot validation remain on the server. */
export function selectMovement(ex: PrescriptionExercise, id: string, catalog: Exercise[]) {
  const selected = catalog.find((item) => item.id === id && item.active !== false)
  if (!selected || id === ex.exerciseId) return false
  ex.exerciseId = id
  ex.kind = selected.kind || 'strength'
  ex.seconds ||= 30
  ex.metres ||= 100
  ex.alternatives = []
  delete ex.info
  return true
}

export function addExerciseAlternative(ex: PrescriptionExercise, id: string, catalog: Exercise[]) {
  const alternatives = ex.alternatives || []
  const selected = catalog.find((item) => item.id === id && item.active !== false)
  if (
    !selected ||
    id === ex.exerciseId ||
    alternatives.length >= 3 ||
    alternatives.some((item) => item.exerciseId === id) ||
    (selected.kind || 'strength') !== (ex.kind || 'strength')
  )
    return false
  ex.alternatives = [...alternatives, { exerciseId: id }]
  return true
}
