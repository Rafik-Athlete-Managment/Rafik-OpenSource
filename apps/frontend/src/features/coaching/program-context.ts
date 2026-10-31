import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { institutionContext } from '../../app/institution'
import { contexts } from '../../app/auth'
import { request } from '../../lib/backend'
import type { Exercise, Plan, PlanVersion } from '../../lib/domain'
export function programContext(_route: RouteLocationNormalizedLoaded) {
  const { institution, view } = institutionContext(),
    base = '',
    endpoint = `/v1/institution`
  const self = () =>
    contexts.value.find((c) => c.institution_id === institution && c.role === view)?.member_id
  return {
    institution,
    view,
    base,
    key: `${institution}:${view}`,
    catalog: () => request<Exercise[]>(`${endpoint}/catalog?view=${view}`),
    load: (id: string) =>
      request<{ program: Plan; editable: boolean; versions: PlanVersion[]; catalog: Exercise[] }>(
        `${endpoint}/programs?view=${view}&program=${id}`,
      ),
    command: (action: 'save' | 'publish', args: Record<string, unknown>) =>
      request<{ plan: Plan; version?: PlanVersion }>(`${endpoint}/programs`, {
        method: 'POST',
        body: JSON.stringify({ ...args, action, view }),
      }),
    editableExercise: (e: Exercise) =>
      !!e.institution_id &&
      ((view === 'admin' && e.scope !== 'private') || e.created_by === self()),
    exercise: (
      id: string,
      data: Record<string, unknown>,
      revision: number,
      operation: string = crypto.randomUUID(),
    ) =>
      request(`${endpoint}/catalog`, {
        method: 'POST',
        body: JSON.stringify({ operation, view, action: 'exercise', id, data, revision }),
      }),
    exerciseActive: (e: Exercise, operation: string = crypto.randomUUID()) =>
      request(`${endpoint}/catalog`, {
        method: 'POST',
        body: JSON.stringify({
          operation,
          view,
          action: 'exercise-active',
          id: e.id,
          revision: e.revision,
          active: e.active === false,
        }),
      }),
  }
}
