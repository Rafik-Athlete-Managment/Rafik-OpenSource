import { computed } from 'vue'
import { contexts } from './auth'
export const institution = computed(() => contexts.value.find((c) => c.kind === 'institution'))
export function institutionContext() {
  const current = institution.value
  return { institution: current?.institution_id || '', view: current?.role || '', base: '' }
}
