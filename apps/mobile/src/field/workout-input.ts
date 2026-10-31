import { measureLimits } from '@rafik/shared/workout-measures'
import type { MeasureField } from '@rafik/shared/workout-measures'

export type WorkoutMeasure = MeasureField
/** Raw input stays in the editor so a trailing decimal point is not destroyed. */
export function workoutNumber(
  field: WorkoutMeasure,
  raw: string,
): { valid: boolean; value: number | null } {
  raw = raw
    .trim()
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x6f0))
    .replaceAll('٫', '.')
  const integer = field === 'reps' || field === 'seconds'
  if (raw !== '' && !(integer ? /^\d+$/ : /^\d+(?:\.\d*)?$|^\.\d+$/).test(raw))
    return { valid: false, value: null }
  const value = raw === '' ? (field === 'reps' || field === 'load' ? 0 : null) : Number(raw)
  const { min, max } = measureLimits[field]
  return {
    value,
    valid:
      value === null ||
      (Number.isFinite(value) &&
        value >= min &&
        value <= max &&
        (!integer || Number.isInteger(value))),
  }
}
