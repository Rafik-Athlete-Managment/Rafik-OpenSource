import { getCurrentInstance, onUnmounted, watch, type Ref } from 'vue'

/**
 * Search as the person types; Enter (submit) applies at once. The caller still owns
 * the request and must keep its latest-response guard, so a slower earlier search can
 * never replace newer results. Call `restore` with the URL value when the route changes:
 * it ignores the echo of a search this helper applied, so a late URL update can never
 * overwrite text typed since, and adopts genuinely different values (back/forward).
 */
export function useLiveSearch(term: Ref<string>, apply: () => unknown, delay = 350) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let applied = term.value.trim()
  const cancel = () => {
    if (timer) clearTimeout(timer)
    timer = undefined
  }
  const submit = () => {
    cancel()
    applied = term.value.trim()
    return apply()
  }
  const restore = (value: string) => {
    if (value.trim() === applied) return
    cancel()
    applied = value.trim()
    term.value = value
  }
  watch(term, (value) => {
    cancel()
    if (value.trim() !== applied) timer = setTimeout(submit, delay)
  })
  if (getCurrentInstance()) onUnmounted(cancel)
  return { submit, restore, cancel }
}
