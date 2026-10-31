export type Nutrients = Partial<Record<'kcal' | 'protein_g' | 'carb_g' | 'fat_g', number | null>>
export type Meal = {
  name: string
  meal: string
  quantity: number
  basis: number
  unit: string
  nutrients: Nutrients
  source: string
}
export const nutrientKeys = ['kcal', 'protein_g', 'carb_g', 'fat_g'] as const
export function nutrientTotals(meals: Pick<Meal, 'quantity' | 'basis' | 'nutrients'>[]) {
  return Object.fromEntries(
    nutrientKeys.map((k) => {
      const known = meals.filter(
        (m) =>
          typeof m.nutrients[k] === 'number' &&
          Number.isFinite(m.nutrients[k]) &&
          Number.isFinite(m.quantity) &&
          m.quantity > 0 &&
          Number.isFinite(m.basis) &&
          m.basis > 0,
      )
      return [
        k,
        {
          value: known.length
            ? Math.round(
                known.reduce((n, m) => n + (m.nutrients[k]! * m.quantity) / m.basis, 0) * 10,
              ) / 10
            : null,
          missing: meals.length - known.length,
        },
      ]
    }),
  ) as Record<(typeof nutrientKeys)[number], { value: number | null; missing: number }>
}

/** Snapshot values always describe `basis` units; scaling never mutates source data. */
export type PlannedFood = Pick<
  Meal,
  'name' | 'meal' | 'quantity' | 'basis' | 'unit' | 'nutrients' | 'source'
>
export type CatalogFood = {
  id: string
  name: string
  name_ar: string
  basis: number
  unit: 'g'
  nutrients: Nutrients
  source: string
  sourceUrl: string
  portions: { name: string; name_ar?: string; grams: number }[]
}
export function macroEnergy(n: Nutrients): number | null {
  if (['protein_g', 'carb_g', 'fat_g'].some((k) => typeof n[k as keyof Nutrients] !== 'number'))
    return null
  return Math.round((n.protein_g! * 4 + n.carb_g! * 4 + n.fat_g! * 9) * 10) / 10
}
export function allocateMacros(
  kcal: number,
  proteinPercent: number,
  fatPercent: number,
): Nutrients | null {
  if (
    ![kcal, proteinPercent, fatPercent].every(Number.isFinite) ||
    kcal <= 0 ||
    kcal > 10000 ||
    proteinPercent < 0 ||
    fatPercent < 0 ||
    proteinPercent + fatPercent > 100
  )
    return null
  const round = (n: number) => Math.round(n * 10) / 10
  return {
    kcal,
    protein_g: round((kcal * proteinPercent) / 400),
    fat_g: round((kcal * fatPercent) / 900),
    carb_g: round((kcal * (100 - proteinPercent - fatPercent)) / 400),
  }
}
