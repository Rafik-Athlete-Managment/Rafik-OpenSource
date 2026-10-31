import type { ApiErrorBody, ApiUser } from '@rafik/shared/contracts'
import { errorMessage } from './i18n'
import { notifyErrorOnce, notifySuccess } from './feedback'
export type { ApiUser } from '@rafik/shared/contracts'
const url =
  import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://127.0.0.1:55331' : '/api')
if (url.includes('pexviywnztvqomfosvho')) throw new Error('The retired backend cannot be used.')
export const configured = Boolean(url)
export const localPreview =
  import.meta.env.DEV &&
  import.meta.env.VITE_LOCAL_PREVIEW === 'true' &&
  ['127.0.0.1', 'localhost'].includes(new URL(url).hostname)
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message)
  }
}
type RequestOptions = RequestInit & {
  feedback?: 'errors' | 'success' | 'none'
  successMessage?: string
}
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { feedback = 'errors', successMessage, ...init } = options
  const method = (init.method || 'GET').toUpperCase()
  try {
    const response = await fetch(url + path, {
      ...init,
      credentials: 'include',
      cache: 'no-store',
      headers: {
        'x-rafik-client': 'web',
        ...(init.body instanceof Blob ? {} : { 'Content-Type': 'application/json' }),
        ...init.headers,
      },
    })
    if (!response.ok) {
      const body = await response
        .json()
        .catch((): ApiErrorBody => ({ message: 'service_unavailable' }))
      throw new ApiError(response.status, body.message)
    }
    const result = (await response.json()) as T
    if (feedback === 'success' && successMessage && !['GET', 'HEAD'].includes(method))
      notifySuccess(successMessage)
    return result
  } catch (error) {
    if (feedback !== 'none') notifyErrorOnce(error, errorMessage(error))
    throw error
  }
}
const listeners = new Set<(user: ApiUser | null) => void>()
const channel =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('rafik-session') : null
function changed(user: ApiUser | null, broadcast = true) {
  if (user) localStorage.setItem('rafik.cached-user', JSON.stringify(user))
  else localStorage.removeItem('rafik.cached-user')
  listeners.forEach((fn) => fn(user))
  if (broadcast) channel?.postMessage(user)
}
if (channel) channel.onmessage = (event) => changed(event.data, false)
export const api = {
  async session() {
    try {
      const result = await request<{ user: ApiUser | null }>('/v1/auth/session')
      changed(result.user, false)
      return result.user
    } catch (e) {
      if (!navigator.onLine) {
        try {
          return JSON.parse(localStorage.getItem('rafik.cached-user') || 'null') as ApiUser | null
        } catch {
          return null
        }
      }
      throw e
    }
  },
  onSession(fn: (user: ApiUser | null) => void) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
  setupStatus() {
    return request<{ initialized: boolean }>('/v1/auth/setup-status')
  },
  async setup(input: { email: string; name: string; institution: string; password: string }) {
    const result = await request<{ user: ApiUser }>('/v1/auth/setup', {
      method: 'POST',
      body: JSON.stringify(input),
      feedback: 'none',
    })
    changed(result.user)
    return result.user
  },
  async login(email: string, password: string) {
    const result = await request<{ user: ApiUser }>('/v1/auth/password-login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      feedback: 'none',
    })
    changed(result.user)
    return result.user
  },
  async acceptInvitation(input: { token: string; email: string; name: string; password: string }) {
    const result = await request<{ user: ApiUser; institution_id: string; role: string }>(
      '/v1/auth/accept-invitation',
      {
        method: 'POST',
        body: JSON.stringify(input),
        feedback: 'none',
      },
    )
    changed(result.user)
    return result
  },
  async completePasswordSetup(token: string, password: string) {
    const result = await request<{ user: ApiUser }>('/v1/auth/complete-password-setup', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
      feedback: 'none',
    })
    changed(result.user)
    return result.user
  },
  async preview(email: string) {
    if (!localPreview) throw new ApiError(403, 'forbidden')
    const result = await request<{ user: ApiUser }>('/v1/auth/local-preview', {
      method: 'POST',
      body: JSON.stringify({ email }),
      feedback: 'none',
    })
    changed(result.user)
    return result.user
  },
  async logout() {
    await request('/v1/auth/logout', { method: 'POST', body: '{}', feedback: 'none' })
    changed(null)
  },
}
export const programImage = (id: string) => url + '/v1/program-media/' + encodeURIComponent(id)
export const instanceLogo = (version: string) =>
  url + '/v1/instance/branding/logo?v=' + encodeURIComponent(version)
