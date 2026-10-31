import { shallowRef, ref } from 'vue'
import { api, configured, request, type ApiUser } from '../lib/backend'
import type { Profile } from '../lib/domain'
import type { Context } from '../features/institution/types'
import { removeRetiredTaskDrafts } from '../lib/storage'
import { locale } from '../lib/i18n'
export const user = shallowRef<ApiUser | null>(null)
export const profile = ref<Profile | null>(null)
export const contexts = ref<Context[]>([])
export const platform = ref(false)
export async function refreshContexts() {
  const id = user.value?.id
  if (!id) {
    contexts.value = []
    platform.value = false
    return
  }
  const data = await request<{ contexts: Context[]; platform: boolean }>('/v1/institution/context')
  if (user.value?.id === id) {
    if (data.contexts.filter((c) => c.kind === 'institution').length > 1) {
      contexts.value = []
      platform.value = data.platform
      throw new Error('multiple_institutions_not_supported')
    }
    contexts.value = data.contexts
      .filter((c) => c.kind === 'institution')
      .map((c) => ({ ...c, path: '/dashboard' }))
    platform.value = data.platform
  }
}
let init: Promise<void> | undefined
export async function refreshProfile() {
  if (!user.value) {
    profile.value = null
    contexts.value = []
    platform.value = false
    return
  }
  const id = user.value.id
  const p = await request<Profile>('/v1/account/profile', {
    method: 'POST',
    body: JSON.stringify({
      p_name: user.value.user_metadata?.display_name || null,
      p_locale: locale.value,
      p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    }),
  })
  if (user.value?.id === id) {
    // Storage can be unavailable in restricted browsers; never block sign-in on cleanup.
    await removeRetiredTaskDrafts(id).catch(() => {})
    if (user.value?.id !== id) return
    localStorage.removeItem('rafik.workspace:' + id)
    profile.value = p
    await refreshContexts()
  }
}
export function ready() {
  return (init ||= (async () => {
    if (!configured) return
    user.value = await api.session().catch(() => null)
    if (user.value) await refreshProfile().catch(() => {})
    api.onSession((current) => {
      const changed = user.value?.id !== current?.id
      user.value = current
      if (changed) {
        profile.value = null
        contexts.value = []
        platform.value = false
        setTimeout(() => void refreshProfile().catch(() => {}), 0)
      }
    })
  })())
}
export async function logout() {
  await api.logout()
  user.value = null
  profile.value = null
  contexts.value = []
  platform.value = false
}
