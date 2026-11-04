import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { useLiveSearch } from '../src/lib/live-search'

describe('search as you type', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('applies once after typing pauses', async () => {
    const term = ref(''),
      apply = vi.fn()
    useLiveSearch(term, apply, 300)
    term.value = 'sa'
    await nextTick()
    vi.advanceTimersByTime(200)
    term.value = 'sara'
    await nextTick()
    vi.advanceTimersByTime(299)
    expect(apply).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(apply).toHaveBeenCalledTimes(1)
  })

  it('Enter applies at once and cancels the pending search', async () => {
    const term = ref(''),
      apply = vi.fn()
    const search = useLiveSearch(term, apply, 300)
    term.value = 'sara'
    await nextTick()
    search.submit()
    vi.advanceTimersByTime(1000)
    expect(apply).toHaveBeenCalledTimes(1)
  })

  it('ignores whitespace-only changes and values restored from the URL', async () => {
    const term = ref('sara'),
      apply = vi.fn()
    const search = useLiveSearch(term, apply, 300)
    term.value = 'sara '
    await nextTick()
    vi.advanceTimersByTime(1000)
    search.restore('amir')
    expect(term.value).toBe('amir')
    await nextTick()
    vi.advanceTimersByTime(1000)
    expect(apply).not.toHaveBeenCalled()
  })

  it('a late URL echo of the applied search never overwrites newer typing', async () => {
    const term = ref(''),
      apply = vi.fn()
    const search = useLiveSearch(term, apply, 300)
    term.value = 'sa'
    await nextTick()
    search.submit()
    term.value = 'sara'
    search.restore('sa')
    expect(term.value).toBe('sara')
    await nextTick()
    vi.advanceTimersByTime(300)
    expect(apply).toHaveBeenCalledTimes(2)
  })
})
