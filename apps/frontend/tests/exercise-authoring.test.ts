import { describe, expect, it } from 'vitest'
import type { Exercise, PrescriptionExercise } from '../src/lib/domain'
import { addExerciseAlternative, selectMovement } from '../src/lib/exercise-authoring'
import { exerciseThumbnail, exerciseVideos, hasExerciseMedia } from '../src/lib/exercise-media'

const exercise = (id: string, kind: Exercise['kind'] = 'strength'): Exercise => ({
  id,
  kind,
  name: id,
  name_ar: id,
  equipment: '',
  equipment_ar: '',
  instructions: '',
  instructions_ar: '',
  movement: '',
})
const prescription = (): PrescriptionExercise => ({
  key: 'position',
  exerciseId: 'main',
  kind: 'strength',
  sets: 3,
  reps: 8,
  load: 0,
  unit: 'kg',
  rest: 60,
  note: 'Keep controlled',
})

describe('shared exercise authoring', () => {
  it('retains the same-type, three-alternative limit and rejects duplicates, self and inactive movements', () => {
    const ex = prescription(),
      catalog = [
        exercise('main'),
        ...['a', 'b', 'c', 'd'].map((id) => exercise(id)),
        exercise('timed', 'timed'),
        { ...exercise('inactive'), active: false },
      ]
    for (const id of ['main', 'missing', 'timed', 'inactive'])
      expect(addExerciseAlternative(ex, id, catalog)).toBe(false)
    expect(addExerciseAlternative(ex, 'a', catalog)).toBe(true)
    expect(addExerciseAlternative(ex, 'a', catalog)).toBe(false)
    expect(addExerciseAlternative(ex, 'b', catalog)).toBe(true)
    expect(addExerciseAlternative(ex, 'c', catalog)).toBe(true)
    expect(addExerciseAlternative(ex, 'd', catalog)).toBe(false)
    expect(ex.alternatives?.map((item) => item.exerciseId)).toEqual(['a', 'b', 'c'])
    expect([ex.load, ex.sets, ex.reps, ex.note]).toEqual([0, 3, 8, 'Keep controlled'])
  })
  it('clears alternatives and old metadata only on a genuine valid primary movement change', () => {
    const ex = { ...prescription(), info: exercise('main'), alternatives: [{ exerciseId: 'a' }] }
    const catalog = [exercise('main'), exercise('timer', 'timed')]
    expect(selectMovement(ex, 'main', catalog)).toBe(false)
    expect(selectMovement(ex, 'missing', catalog)).toBe(false)
    expect(ex.alternatives).toHaveLength(1)
    expect(selectMovement(ex, 'timer', catalog)).toBe(true)
    expect(ex.kind).toBe('timed')
    expect(ex.alternatives).toEqual([])
    expect(ex.info).toBeUndefined()
    expect(ex.key).toBe('position')
    expect(ex.load).toBe(0)
  })
})

describe('media discovery without private-byte shortcuts', () => {
  it('uses the pinned reference video poster and does not reinterpret it as an uploaded thumbnail', () => {
    const reference = exercise(exerciseVideos[0]!.exerciseId)
    expect(exerciseThumbnail(reference)).toContain(exerciseVideos[0]!.poster.path)
    const uploaded = { ...reference, institution_id: 'institution', media_asset: 'private-id' }
    expect(hasExerciseMedia(uploaded)).toBe(true)
    expect(exerciseThumbnail(uploaded)).toBeUndefined()
    expect(
      exerciseThumbnail({ ...reference, media_url: 'https://example.invalid/demo' }),
    ).toBeUndefined()
  })
  it('exposes no media affordance or invented thumbnail for a movement with no media', () => {
    expect(hasExerciseMedia(exercise('no-media-fixture'))).toBe(false)
    expect(exerciseThumbnail(exercise('no-media-fixture'))).toBeUndefined()
  })
})
