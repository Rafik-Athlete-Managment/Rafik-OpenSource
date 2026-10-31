import { onMounted, shallowReactive } from 'vue'
import { user } from '../app/auth'
import { getDraft, storeDraft, removeDraft } from './storage'
import { errorMessage } from './i18n'
import { commandRejected } from './command-errors'
import { notifyErrorOnce, notifySuccess } from './feedback'
// A remounted screen must wait for the original dispatch before offering replay.
const activeCommands = new Map<string, Promise<void>>()
type Name = string
type Pending<N extends string> = { name: N; args: Record<string, unknown> }
// One explicit user command, persisted before dispatch. This is not a background queue.
export function useCommand<N extends string = Name>(
  scope: string,
  after: (name: N, result: unknown, args: Record<string, unknown>) => Promise<void>,
  dispatch: (name: N, args: Record<string, unknown>) => Promise<unknown>,
  options: {
    successToast?: boolean
    successMessage?: string | ((name: N, args: Record<string, unknown>) => string | false)
  } = {},
) {
  const key = `r4-command:${user.value!.id}:${scope}`
  const state = shallowReactive({
    ready: false,
    busy: false,
    pending: null as Pending<N> | null,
    error: '',
    notice: '',
  })
  let noticeTimer: ReturnType<typeof setTimeout> | undefined
  onMounted(async () => {
    try {
      const active = activeCommands.get(key)
      if (active) {
        state.busy = true
        await active.catch(() => undefined)
      }
      state.pending = (await getDraft<Pending<N>>(key)) || null
    } catch (e) {
      state.error = errorMessage(e)
    } finally {
      state.ready = true
      state.busy = false
    }
  })
  async function execute(name?: N, args: Record<string, unknown> = {}) {
    if (state.busy || !state.ready) return
    state.busy = true
    state.error = ''
    state.notice = ''
    try {
      if (!state.pending && name)
        state.pending = JSON.parse(JSON.stringify({ name, args })) as Pending<N>
      if (!state.pending) return
      await storeDraft(key, state.pending)
      const pending = state.pending
      const result = await dispatch(pending.name, pending.args)
      await after(pending.name, result, pending.args)
      await removeDraft(key)
      state.pending = null
      const message =
        typeof options.successMessage === 'function'
          ? options.successMessage(pending.name, pending.args)
          : options.successMessage
      state.notice = typeof message === 'string' ? message : ''
      if (noticeTimer) clearTimeout(noticeTimer)
      if (state.notice) {
        noticeTimer = setTimeout(() => {
          if (state.notice === message) state.notice = ''
        }, 5000)
        if (options.successToast !== false) notifySuccess(state.notice)
      }
    } catch (e) {
      if (commandRejected(e)) {
        state.pending = null
        await removeDraft(key)
      }
      state.error = errorMessage(e)
      notifyErrorOnce(e, state.error)
    } finally {
      state.busy = false
    }
  }
  function run(name?: N, args: Record<string, unknown> = {}): Promise<void> {
    if (activeCommands.has(key)) return Promise.resolve()
    const work = execute(name, args)
    activeCommands.set(key, work)
    const clear = () => {
      if (activeCommands.get(key) === work) activeCommands.delete(key)
    }
    void work.then(clear, clear)
    return work
  }
  return { state, run }
}
