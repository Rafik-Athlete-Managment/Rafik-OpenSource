import { beforeEach, expect, test, vi } from 'vitest'

const fixture = vi.hoisted(() => ({
  mounted: [] as (() => Promise<void>)[],
  drafts: new Map<string, unknown>(),
  success: vi.fn(),
  error: vi.fn(),
}))
vi.mock('vue', () => ({
  onMounted: (fn: () => Promise<void>) => fixture.mounted.push(fn),
  shallowReactive: (state: unknown) => state,
}))
vi.mock('../src/app/auth', () => ({ user: { value: { id: 'navigation-test' } } }))
vi.mock('../src/lib/storage', () => ({
  getDraft: async (key: string) => structuredClone(fixture.drafts.get(key)),
  storeDraft: async (key: string, value: unknown) => {
    fixture.drafts.set(key, structuredClone(value))
  },
  removeDraft: async (key: string) => {
    fixture.drafts.delete(key)
  },
}))
vi.mock('../src/lib/backend', () => ({ rpc: vi.fn() }))
vi.mock('../src/lib/i18n', () => ({ errorMessage: (error: Error) => error.message }))
vi.mock('../src/lib/feedback', () => ({
  notifySuccess: fixture.success,
  notifyErrorOnce: fixture.error,
}))
vi.mock('../src/lib/command-errors', () => ({ commandRejected: () => false }))
import { useCommand } from '../src/lib/commands'
import { loadEditorDraft } from '../src/lib/editor-draft'

beforeEach(() => {
  fixture.mounted.length = 0
  fixture.drafts.clear()
  fixture.success.mockClear()
})
const mount = () => fixture.mounted.shift()!()

test('a remounted command waits for the original dispatch before offering replay', async () => {
  let acknowledge!: () => void
  const dispatch = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        acknowledge = resolve
      }),
  )
  const first = useCommand<'save'>('navigation', async () => {}, dispatch, {
    successMessage: 'Task saved.',
  })
  await mount()
  const write = first.run('save', { operation: 'same-operation' })
  await vi.waitFor(() => expect(dispatch).toHaveBeenCalledOnce())
  const next = useCommand<'save'>('navigation', async () => {}, dispatch)
  const initialization = mount()
  expect(next.state.busy).toBe(true)
  expect(next.state.ready).toBe(false)
  await next.run('save', { operation: 'must-not-dispatch' })
  expect(dispatch).toHaveBeenCalledOnce()
  acknowledge()
  await write
  await initialization
  expect(next.state.pending).toBeNull()
  expect(next.state.busy).toBe(false)
  expect(next.state.ready).toBe(true)
  expect(fixture.success).toHaveBeenCalledExactlyOnceWith('Task saved.')
})

test('settled uncertain commands retain their exact operation for explicit replay', async () => {
  const dispatch = vi.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValueOnce({})
  const first = useCommand<'save'>('retry-navigation', async () => {}, dispatch)
  await mount()
  await first.run('save', { operation: 'original', value: 4 })
  const next = useCommand<'save'>('retry-navigation', async () => {}, dispatch)
  await mount()
  expect(next.state.pending?.args.operation).toBe('original')
  await next.run()
  expect(dispatch.mock.calls[1]).toEqual(['save', { operation: 'original', value: 4 }])
  expect(next.state.pending).toBeNull()
})

test('legacy editor drafts migrate by record and are never adopted by another editor', async () => {
  fixture.drafts.set('legacy', { id: 'record-a', revision: 2, title: 'Kept' })
  expect(await loadEditorDraft('legacy', 'record-b')).toBeUndefined()
  expect(fixture.drafts.has('legacy')).toBe(true)
  expect(await loadEditorDraft('legacy', '')).toEqual({
    id: 'record-a',
    revision: 2,
    title: 'Kept',
  })
  expect(fixture.drafts.get('legacy:record-a')).toEqual({
    id: 'record-a',
    revision: 2,
    title: 'Kept',
  })
  expect(fixture.drafts.has('legacy')).toBe(false)
  expect(await loadEditorDraft('legacy', 'new')).toBeUndefined()
})
