import { ApiFailure, failureText, type FieldRoster, type Owner } from './model.ts'
import type { FieldStore } from './store.ts'

export type AttendanceSender = (path: string, body: string) => Promise<unknown>

/** One runner per signed-in runtime. Payload strings and operation IDs never change on replay. */
export class AttendanceSync {
  private flight: Promise<void> | null = null
  private stopped = false
  private store: FieldStore
  private owner: Owner
  private send: AttendanceSender
  constructor(store: FieldStore, owner: Owner, send: AttendanceSender) {
    this.store = store
    this.owner = owner
    this.send = send
  }

  stop() {
    this.stopped = true
  }

  run(changed: (completed?: FieldRoster) => void = () => undefined): Promise<void> {
    if (this.flight) return this.flight
    this.flight = this.drain(changed).finally(() => {
      this.flight = null
    })
    return this.flight
  }

  private async drain(changed: (completed?: FieldRoster) => void) {
    while (!this.stopped) {
      const command = await this.store.next(this.owner)
      if (!command || !['queued', 'uncertain'].includes(command.state)) return
      // Stop/account-switch may happen while SQLite is resolving the head.
      if (this.stopped) return
      await this.store.setState(this.owner, command, 'sending', null)
      changed()
      try {
        if (this.stopped) {
          await this.store.setState(this.owner, command, command.state, command.error)
          return
        }
        const result = await this.send(`/institution/calendar`, JSON.stringify(command.payload))
        // Persist an in-flight acknowledgment for its original owner even if the screen closes.
        const completed = await this.store.acknowledge(this.owner, command, result)
        changed(completed)
      } catch (error) {
        const rejected = error instanceof ApiFailure
        const state =
          rejected && error.status === 403
            ? 'blocked'
            : rejected && [400, 404, 409, 422].includes(error.status)
              ? 'needs_attention'
              : 'uncertain'
        await this.store.setState(
          this.owner,
          command,
          state,
          rejected
            ? failureText(error)
            : 'Confirmation unknown. Retry sends this exact change; do not re-enter it.',
        )
        changed()
        return
      }
      changed()
    }
  }
}
