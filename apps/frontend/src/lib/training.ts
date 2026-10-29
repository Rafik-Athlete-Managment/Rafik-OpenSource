import { api, request } from './backend'
import { clone, type Session, type LocalSession, type PlanDay } from './domain'
import {
  editLocalSession,
  event,
  getLocalSession,
  localSessions,
  putLocalSession,
  storeDraft,
  getDraft,
  removeDraft,
} from './storage'
const syncing = new Map<string, Promise<LocalSession | undefined>>()
export async function startWorkout(
  day: PlanDay,
  title: string,
  versionId: string,
  owner: string,
  assignmentId?: string,
  scheduledDate?: string,
  institution?: string,
) {
  if (owner === 'guest' || !institution) throw new Error('institution_required')
  const existing = (await localSessions(owner)).find(
    (x) =>
      x.session.status === 'in_progress' &&
      x.session.version_id === versionId &&
      x.session.day_id === day.id &&
      x.session.assignment_id === (assignmentId || null) &&
      (!assignmentId || x.session.occurrence_key === `${assignmentId}:${scheduledDate}:${day.id}`),
  )
  if (existing) return existing
  const startKey = `start:${owner}:${assignmentId || versionId}:${day.id}:${scheduledDate || 'flexible'}`
  const id = (await getDraft<string>(startKey)) || crypto.randomUUID()
  await storeDraft(startKey, id)
  const session = await request<Session>(`/v1/institution/sessions`, {
    method: 'POST',
    body: JSON.stringify({
      operation: id,
      action: 'start',
      view: 'trainee',
      id,
      assignment_id: assignmentId,
      day_id: day.id,
    }),
  })
  const current = await getLocalSession(session.id)
  if (current?.owner === owner) return current
  const row: LocalSession = {
    id: session.id,
    owner,
    session,
    localRevision: 0,
    syncedRevision: 0,
    updatedAt: new Date().toISOString(),
  }
  await putLocalSession(row)
  await removeDraft(startKey)
  await event('session_started', session.id)
  return row
}
export async function loadWorkout(id: string, owner: string, institution?: string) {
  const local = await getLocalSession(id)
  if (local && local.owner === owner) {
    if (local.session.source_kind === 'additional') throw Error('group_workout_read_only')
    if (local.pending || local.localRevision > local.syncedRevision || !navigator.onLine)
      return local
    try {
      const remote = await readSession(id, institution || local.session.institution_id)
      if (remote?.client_id === owner)
        return editLocalSession(id, (current) => {
          // Another tab may have edited while this read was in flight.
          if (
            !current.pending &&
            current.localRevision === local.localRevision &&
            current.syncedRevision === local.syncedRevision
          )
            current.session = remote
        })
    } catch {
      /* Offline work remains readable. */
    }
    return local
  }
  if (owner === 'guest') throw new Error('unauthenticated')
  const session = await readSession(id, institution)
  if (!session) throw new Error('forbidden')
  if (session.source_kind === 'additional') throw Error('group_workout_read_only')
  // Coach review reads server data separately; this is the client's editing store.
  if (session.client_id !== owner) throw new Error('forbidden')
  return putLocalSession({
    id,
    owner,
    session,
    localRevision: 0,
    syncedRevision: 0,
    updatedAt: new Date().toISOString(),
  })
}
export async function changeWorkout(id: string, fn: (s: Session) => void) {
  const row = await editLocalSession(id, (r) => {
    fn(r.session)
    r.localRevision++
    r.syncError = undefined
  })
  await event(
    row.session.status === 'completed' ? 'session_completed_local' : 'set_saved_local',
    id,
  )
  return row
}
export async function syncWorkout(id: string, owner: string) {
  if (owner === 'guest') return getLocalSession(id)
  if (syncing.has(id)) return syncing.get(id)!
  const run = async () => {
    let row = await getLocalSession(id)
    while (
      row &&
      row.owner === owner &&
      !row.conflict &&
      (row.pending || row.localRevision > row.syncedRevision)
    ) {
      if (!navigator.onLine) return row
      const current = await api.session()
      if (current?.id !== owner) return row
      if (!row.pending)
        row = await editLocalSession(id, (r) => {
          r.pending = {
            id: crypto.randomUUID(),
            expectedVersion: r.session.version,
            entries: clone(r.session.entries),
            note: r.session.note,
            complete: r.session.status === 'completed',
            localRevision: r.localRevision,
          }
        })
      const op = row.pending!
      try {
        if (!row.session.institution_id) throw new Error('retired_workout')
        const result = await request<Session>(`/v1/institution/sessions`, {
          method: 'POST',
          body: JSON.stringify({
            operation: op.id,
            action: 'save',
            view: 'trainee',
            id,
            revision: op.expectedVersion,
            entries: op.entries,
            note: op.note,
            complete: op.complete,
          }),
        })
        row = await editLocalSession(id, (r) => {
          if (r.pending?.id !== op.id) return
          r.session.version = result.version
          r.session.coach_note = result.coach_note
          r.session.reviewed_at = result.reviewed_at
          r.session.completed_at = result.completed_at || r.session.completed_at
          r.syncedRevision = op.localRevision
          r.pending = undefined
          r.syncError = undefined
        })
        if (result.status === 'completed') await event('session_synced', id)
      } catch (error) {
        const message = (error as { message?: string }).message || 'network_error'
        row = await editLocalSession(id, (r) => {
          r.syncError = message
          r.conflict = message.includes('conflict') || message.includes('operation_reused')
        })
        return row
      }
    }
    return row
  }
  const task = Promise.resolve(
    navigator.locks ? navigator.locks.request('rafik-sync:' + id, run) : run(),
  )
  syncing.set(id, task)
  try {
    return await task
  } finally {
    syncing.delete(id)
  }
}
export async function reloadServerSession(id: string, owner: string) {
  const previous = await getLocalSession(id)
  if (!previous || previous.owner !== owner) throw new Error('forbidden')
  const remote = await readSession(id, previous.session.institution_id)
  if (!remote) throw Error('session_missing')
  await storeDraft('conflict-backup:' + owner + ':' + id, previous)
  return putLocalSession({
    id,
    owner,
    session: remote,
    localRevision: 0,
    syncedRevision: 0,
    updatedAt: new Date().toISOString(),
  })
}
export async function syncPending(owner: string) {
  for (const row of await localSessions(owner)) await syncWorkout(row.id, owner)
}

async function readSession(id: string, institution?: string) {
  if (!institution) throw new Error('retired_workout')
  return request<Session>(`/v1/workouts/${id}`)
}
