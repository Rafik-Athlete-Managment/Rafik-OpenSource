import { clone, type Prescription, type PlanDay } from '../../lib/domain'
function copy(day: PlanDay) {
  const result = clone(day)
  result.id = crypto.randomUUID()
  result.exercises.forEach((e) => (e.key = crypto.randomUUID()))
  return result
}
/** Copies one workout day and gives the copy a new name and stable identity. */
export function duplicateSession(plan: Prescription, index: number, suffix: string) {
  const result = clone(plan)
  let slot: { week: number; weekday: number } | undefined
  for (let w = 1; w <= (result.cycleWeeks || 1) && !slot; w++)
    for (let d = 0; d < 7; d++)
      if (!result.days.some((x) => x.week === w && x.weekday === d)) {
        slot = { week: w, weekday: d }
        break
      }
  if (!slot) {
    if ((result.cycleWeeks || 1) >= 12) throw Error('invalid_day_count')
    result.cycleWeeks = (result.cycleWeeks || 1) + 1
    slot = { week: result.cycleWeeks, weekday: 0 }
  }
  const day = copy(result.days[index]!)
  Object.assign(day, slot)
  day.name = (day.name + suffix).slice(0, 80)
  result.days.push(day)
  return result
}
/** Copies a program week so the coach can reuse its workout days. */
export function duplicateWeek(plan: Prescription, week: number) {
  if ((plan.cycleWeeks || 1) >= 12) throw Error('invalid_day_count')
  const result = clone(plan),
    next = (result.cycleWeeks || 1) + 1,
    days = result.days.filter((d) => (d.week || 1) === week)
  if (!days.length) throw Error('invalid_day')
  result.days.push(...days.map((d) => ({ ...copy(d), week: next })))
  result.cycleWeeks = next
  return result
}
