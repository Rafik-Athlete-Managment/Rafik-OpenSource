import { test } from 'vitest'
import assert from 'node:assert/strict'
import { copyWorkout } from '../src/lib/workout-templates.ts'
import type { PlanDay } from '../src/lib/domain.ts'
test('template copies preserve targets but isolate workout/exercise identity and subsequent edits', () => {
  const day: PlanDay = {
    id: 'source',
    name: 'Strength',
    minutes: 30,
    week: 3,
    weekday: 4,
    exercises: [
      {
        key: 'source-exercise',
        exerciseId: 'squat',
        kind: 'strength',
        sets: 1,
        reps: 10,
        load: 0,
        unit: 'kg',
        rest: 60,
        note: 'Keep controlled',
        targets: [{ reps: 10, load: 0 }],
      },
    ],
  }
  const copy = copyWorkout(day, { week: 1, weekday: 2 })
  assert.notEqual(copy.id, day.id)
  assert.notEqual(copy.exercises[0]!.key, day.exercises[0]!.key)
  assert.equal(copy.week, 1)
  assert.equal(copy.weekday, 2)
  copy.exercises[0]!.targets![0]!.reps = 12
  assert.equal(day.exercises[0]!.targets![0]!.reps, 10)
})
