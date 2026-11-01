import { openDB, type DBSchema } from 'idb'
import { restoreInstitution, type LocalSession } from './domain'
interface RafikDB extends DBSchema {
  sessions: { key: string; value: LocalSession }
  drafts: { key: string; value: { key: string; value: unknown; savedAt: string } }
  events: { key: string; value: { id: string; name: string; at: string } }
}
const db = openDB<RafikDB>('rafik-revamp', 1, {
  upgrade(db) {
    db.createObjectStore('sessions', { keyPath: 'id' })
    db.createObjectStore('drafts', { keyPath: 'key' })
    db.createObjectStore('events', { keyPath: 'id' })
  },
})
/** Loads one workout saved on this browser for offline access. */
export const getLocalSession = async (id: string) =>
  restoreInstitution(await (await db).get('sessions', id))
/** Saves a workout and its sync state to this browser's local database. */
export const putLocalSession = async (value: LocalSession) => {
  await (await db).put('sessions', value)
  return value
}
/** Lists local workouts that belong to the signed-in account. */
export async function localSessions(owner: string) {
  return (await (await db).getAll('sessions'))
    .map((row) => restoreInstitution(row)!)
    .filter((s) => s.owner === owner)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}
/** Updates one saved workout inside a local database transaction. */
export async function editLocalSession(id: string, fn: (row: LocalSession) => void) {
  const tx = (await db).transaction('sessions', 'readwrite')
  const value = restoreInstitution(await tx.store.get(id))
  if (!value) throw new Error('session_missing')
  fn(value)
  value.updatedAt = new Date().toISOString()
  await tx.store.put(value)
  await tx.done
  return value
}
/** Saves a small user draft locally so it remains available after navigation or reload. */
export async function storeDraft(key: string, value: unknown) {
  await (
    await db
  ).put('drafts', {
    key,
    value: JSON.parse(JSON.stringify(value)),
    savedAt: new Date().toISOString(),
  })
}
/** Reads a locally saved draft and returns it as the requested draft type. */
export const getDraft = async <T>(key: string) =>
  (await (await db).get('drafts', key))?.value as T | undefined
/** Deletes a saved draft from this browser after it is no longer needed. */
export const removeDraft = async (key: string) => {
  await (await db).delete('drafts', key)
}
/** Adds a local diagnostic event without storing private workout content. */
export async function event(name: string, id: string) {
  const database = await db
  await database.put('events', { id: name + ':' + id, name, at: new Date().toISOString() })
  const all = await database.getAll('events')
  if (all.length > 300) {
    for (const e of all.sort((a, b) => a.at.localeCompare(b.at)).slice(0, all.length - 300))
      await database.delete('events', e.id)
  }
}
/** Reads local diagnostic events for support and recovery screens. */
export const diagnosticEvents = async () => (await db).getAll('events')
/** Removes local sessions and drafts owned by an account that is signing out or deleting. */
export async function removeAccountLocalData(owner: string) {
  const database = await db
  const tx = database.transaction(['sessions', 'drafts'], 'readwrite')
  for (const row of await tx.objectStore('sessions').getAll())
    if (row.owner === owner) await tx.objectStore('sessions').delete(row.id)
  for (const row of await tx.objectStore('drafts').getAll())
    if (row.key.includes(owner)) await tx.objectStore('drafts').delete(row.key)
  await tx.done
}

// Remove only retired Tasks drafts and exact pending command scopes for this account.
export async function removeRetiredTaskDrafts(owner: string) {
  const tx = (await db).transaction('drafts', 'readwrite')
  const prefixes = [`trainer-tasks:${owner}:`, `r4-command:${owner}:trainer-tasks:${owner}:`]
  for (const key of await tx.store.getAllKeys())
    if (prefixes.some((prefix) => key.startsWith(prefix))) await tx.store.delete(key)
  await tx.done
}
