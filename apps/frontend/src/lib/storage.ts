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
export const getLocalSession = async (id: string) =>
  restoreInstitution(await (await db).get('sessions', id))
export const putLocalSession = async (value: LocalSession) => {
  await (await db).put('sessions', value)
  return value
}
export async function localSessions(owner: string) {
  return (await (await db).getAll('sessions'))
    .map((row) => restoreInstitution(row)!)
    .filter((s) => s.owner === owner)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}
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
export async function storeDraft(key: string, value: unknown) {
  await (
    await db
  ).put('drafts', {
    key,
    value: JSON.parse(JSON.stringify(value)),
    savedAt: new Date().toISOString(),
  })
}
export const getDraft = async <T>(key: string) =>
  (await (await db).get('drafts', key))?.value as T | undefined
export const removeDraft = async (key: string) => {
  await (await db).delete('drafts', key)
}
export async function event(name: string, id: string) {
  const database = await db
  await database.put('events', { id: name + ':' + id, name, at: new Date().toISOString() })
  const all = await database.getAll('events')
  if (all.length > 300) {
    for (const e of all.sort((a, b) => a.at.localeCompare(b.at)).slice(0, all.length - 300))
      await database.delete('events', e.id)
  }
}
export const diagnosticEvents = async () => (await db).getAll('events')
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
