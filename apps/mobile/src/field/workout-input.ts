export type WorkoutMeasure = 'load' | 'reps' | 'seconds' | 'metres' | 'effort'
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
  raw = raw
    .trim()
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x6f0))
    .replaceAll('٫', '.')
  const integer = field === 'reps' || field === 'seconds'
  if (raw !== '' && !(integer ? /^\d+$/ : /^\d+(?:\.\d*)?$|^\.\d+$/).test(raw))
    return { valid: false, value: null }
  const value = raw === '' ? (field === 'reps' || field === 'load' ? 0 : null) : Number(raw)
  const max = { load: 1000, reps: 200, seconds: 86400, metres: 1000000, effort: 10 }[field]
  return {
    value,
    valid:
      value === null ||
      (Number.isFinite(value) &&
        value >= (field === 'effort' ? 1 : 0) &&
        value <= max &&
        (!integer || Number.isInteger(value))),
  }
}
