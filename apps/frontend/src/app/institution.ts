import { computed } from 'vue'
import { contexts } from './auth'
export const institution = computed(() => contexts.value.find((c) => c.kind === 'institution'))
/** Returns the active institution and role used by the current page. */
export function institutionContext() {
  const current = institution.value
  return { institution: current?.institution_id || '', view: current?.role || '', base: '' }
}
