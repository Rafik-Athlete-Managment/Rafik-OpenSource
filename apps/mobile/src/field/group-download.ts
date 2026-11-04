import type { NativeClient } from './native.ts'
import type { Owner } from './model.ts'
import type { FieldStore } from './store.ts'
import { workoutPackage, type FieldWorkoutPackage } from './workout-model.ts'
import { requireWorkoutSupport } from './workout-sync.ts'

/** Downloads one group event's participant sheets without replacing unsent device work. */
export async function downloadGroupEvent(
  client: NativeClient,
  store: FieldStore,
  owner: Owner,
  event: string,
) {
  await requireWorkoutSupport((path) => client.request(path), true)
  const result = await client.request<{
    workout: { source?: string } | null
    participants: { member_id: string; field_workout?: FieldWorkoutPackage }[]
  }>(`/institution/group-workouts?view=trainer&event=${event}&fieldPackages=true`)
  if (!result.workout) return { group: false, packages: [], saved: 0, protected: 0, errors: [] }
  if (result.workout.source !== 'group' || !Array.isArray(result.participants))
    throw Error('Invalid group workout response. Keep existing device work and refresh online.')
  const packages = result.participants.map((person) => {
    const p = workoutPackage(person.field_workout)
    if (
      p.group?.event_id !== event ||
      p.institution_id !== owner.institution ||
      p.member_id !== person.member_id
    )
      throw Error('A group sheet has the wrong event or athlete. Nothing was replaced.')
    return p
  })
  if (new Set(packages.map((p) => p.id)).size !== packages.length)
    throw Error('Duplicate group sheets were returned. Nothing was replaced.')
  const existing = new Map(
    (await store.workouts.groupList(owner, event)).map((r) => [r.package.id, r]),
  )
  let saved = 0,
    protectedCount = 0
  const errors: string[] = []
  for (const p of packages) {
    const old = existing.get(p.id)
    if (old && (old.pending || old.intent || old.localRevision !== old.syncedRevision)) {
      protectedCount++
      continue
    }
    try {
      await store.workouts.put(owner, p)
      saved++
    } catch (error) {
      // Keep the other participant packages available, but report a partial download.
      errors.push(error instanceof Error ? error.message : 'Could not save a group sheet.')
    }
  }
  return { group: true, packages, saved, protected: protectedCount, errors }
}
