import { describe, expect, it } from 'vitest'
import { sectionPath } from '../src/features/navigation/section-path'

describe('sidebar ownership for supported detail routes', () => {
  it.each([
    ['/members/person', '/people'],
    ['/athletes/person', '/people'],
    ['/record/new', '/training'],
    ['/record/workout', '/workouts'],
    ['/review/workout', '/workouts/workout'],
    ['/deliver/version', '/plans/version'],
    ['/assessments/person', '/training/person'],
    ['/events', '/schedule'],
    ['/events-other', '/events-other'],
    ['/assessment-templates/new', '/assessment-templates/new'],
    ['/plans/new', '/plans/new'],
  ])('%s highlights %s', (path, section) => {
    expect(sectionPath(path)).toBe(section)
  })
})
