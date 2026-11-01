import { ApiFailure, ConnectionFailure } from './model.ts'

/** Validates and normalizes the institution API address entered during phone setup. */
export function instanceUrl(input: string) {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    throw Error('Enter your institution HTTPS API URL without credentials, a query or a fragment.')
  }
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw Error('Enter your institution HTTPS API URL without credentials, a query or a fragment.')
  if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '10.0.2.2'].includes(url.hostname))
    throw Error(
      'Remote institutions require HTTPS. Local HTTP is limited to localhost or the Android emulator.',
    )
  return url.toString().replace(/\/+$/, '')
}

/** Transport failure never implies that a submitted command was rejected. */
export async function jsonRequest<T>(url: string, init: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20_000)
  try {
    let response: Response
    try {
      response = await fetch(url, {
        ...init,
        signal: controller.signal,
        credentials: 'omit',
        redirect: 'error',
      })
    } catch {
      throw new ConnectionFailure()
    }
    let body
    try {
      body = await response.json()
    } catch (error) {
      if (response.ok && !(error instanceof SyntaxError)) throw new ConnectionFailure()
      body = null
    }
    if (!response.ok) throw new ApiFailure(response.status, body?.message || 'request_rejected')
    if (!body || typeof body !== 'object') throw Error('The server returned an invalid response.')
    return body as T
  } finally {
    clearTimeout(timeout)
  }
}
