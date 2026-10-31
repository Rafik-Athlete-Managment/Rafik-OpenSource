import { ApiFailure, ConnectionFailure, failureText, type Owner } from './model.ts'
import { checkCapabilities } from './capabilities.ts'
import type { WorkoutStore } from './workout-store.ts'
export async function requireWorkoutSupport(request: (path: string) => Promise<unknown>) {
  try {
    const result = await checkCapabilities(request)
    if (result.state !== 'available' || !result.value.features.individual_workout_recording)
      throw new ApiFailure(409, 'native_workout_upgrade_required')
  } catch (error) {
    if (error instanceof ApiFailure || error instanceof ConnectionFailure) throw error
    throw new ApiFailure(409, 'native_workout_upgrade_required')
  }
}
/** Acknowledged starts bind the first save's revision, never another allocator. */
export class WorkoutSync {
  private flight: Promise<void> | null = null
  private stopped = false
  private repeat = false
  private paused = false
  private store: WorkoutStore
  private owner: Owner
  private send: (path: string, body: string) => Promise<unknown>
  constructor(
    store: WorkoutStore,
    owner: Owner,
    send: (path: string, body: string) => Promise<unknown>,
  ) {
    this.store = store
    this.owner = owner
    this.send = send
  }
  stop() {
    this.stopped = true
  }
  run(changed: () => void = () => {}): Promise<void> {
    if (this.flight) {
      this.repeat = true
      return this.flight
    }
    this.repeat = false
    this.paused = false
    this.flight = this.drain(changed).finally(() => {
      this.flight = null
      if (this.repeat && !this.paused && !this.stopped) return this.run(changed)
    })
    return this.flight
  }
  private async drain(changed: () => void) {
    while (!this.stopped) {
      const r = await this.store.next(this.owner),
        p = r?.pending
      if (!r || !p || !['queued', 'uncertain'].includes(p.state) || this.stopped) return
      const operation = p.payload.operation
      await this.store.state(this.owner, r.package.id, operation, 'sending')
      try {
        changed()
      } catch {
        /* Observers never determine command success. */
      }
      if (this.stopped) {
        await this.store.state(this.owner, r.package.id, operation, p.state)
        return
      }
      try {
        const result = await this.send('/institution/sessions', JSON.stringify(p.payload))
        await this.store.acknowledge(this.owner, r.package.id, operation, result)
      } catch (error) {
        this.paused = true
        const denied = error instanceof ApiFailure
        await this.store.state(
          this.owner,
          r.package.id,
          operation,
          denied &&
            ([401, 403].includes(error.status) || error.code === 'native_workout_upgrade_required')
            ? 'blocked'
            : denied && [400, 404, 409, 422].includes(error.status)
              ? 'needs_attention'
              : 'uncertain',
          failureText(error),
        )
        try {
          changed()
        } catch {
          /* UI observers cannot alter persisted state. */
        }
        return
      }
      try {
        changed()
      } catch {
        /* A UI observer is never a failed write. */
      }
    }
  }
}
