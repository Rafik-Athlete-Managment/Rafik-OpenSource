type ExerciseKind = 'strength' | 'timed' | 'distance'
type ActualResult = { reps: number; seconds?: number | null; metres?: number | null }

/**
 * Measurement rules shared by the athlete workout logger and coach-recorded sessions.
 * Strength sets record load and reps; timed and distance sets record seconds or metres,
 * with optional effort. Server validation (validate_session_actuals) remains authoritative.
 */
export type MeasureField = 'load' | 'reps' | 'seconds' | 'metres' | 'effort'

export function measureFields(kind?: ExerciseKind): { first: MeasureField; second: MeasureField } {
  const first = kind === 'timed' ? 'seconds' : kind === 'distance' ? 'metres' : 'load'
  return { first, second: first === 'load' ? 'reps' : 'effort' }
}

export const measureLimits: Record<MeasureField, { min: number; max: number; step: number }> = {
  load: { min: 0, max: 1000, step: 0.01 },
  reps: { min: 0, max: 200, step: 1 },
  seconds: { min: 0, max: 86400, step: 1 },
  metres: { min: 0, max: 1000000, step: 0.01 },
  effort: { min: 1, max: 10, step: 0.5 },
}

/** A set can be completed only with a positive actual result for its measurement. */
export function hasActualResult(entry: ActualResult, kind?: ExerciseKind) {
  return kind === 'timed'
    ? (entry.seconds || 0) >= 1
    : kind === 'distance'
      ? (entry.metres || 0) >= 1
      : entry.reps >= 1
}
