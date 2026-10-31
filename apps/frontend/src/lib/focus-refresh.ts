import { onMounted, onUnmounted } from 'vue'

/**
 * Refresh read-only collections when the person returns to the tab, replacing manual
 * refresh buttons. Calls are throttled; `mark` records a refresh made for another reason.
 */
export function useFocusRefresh(refresh: () => unknown, minInterval = 30_000) {
  let last = Date.now()
  const handler = () => {
    if (document.visibilityState !== 'visible' || Date.now() - last < minInterval) return
    last = Date.now()
    void refresh()
  }
  onMounted(() => {
    document.addEventListener('visibilitychange', handler)
    window.addEventListener('focus', handler)
  })
  onUnmounted(() => {
    document.removeEventListener('visibilitychange', handler)
    window.removeEventListener('focus', handler)
  })
  return {
    mark: () => {
      last = Date.now()
    },
  }
}
