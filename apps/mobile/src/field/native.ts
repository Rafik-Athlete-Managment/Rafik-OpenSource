import * as Crypto from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'
import * as SQLite from 'expo-sqlite'
import { FieldStore } from './store.ts'
import { instanceUrl, jsonRequest } from './request.ts'

type Session = {
  user: { id: string; email: string | null }
  access_token: string
  access_expires_at: string
  refresh_token: string
  refresh_expires_at: string
}
export type CoachContext = {
  institution_id: string
  member_id: string
  name: string
  role: 'trainer'
}
type Credentials = { instance: string; session: Session; contexts: CoachContext[] }
const CREDENTIALS = 'rafik.field.credentials.v1'
const DB_KEY = 'rafik.field.database-key.v1'
let storeFlight: Promise<FieldStore> | null = null

export const operationId = () => Crypto.randomUUID()

export function privateStore(): Promise<FieldStore> {
  if (!storeFlight)
    storeFlight = (async () => {
      let key = await SecureStore.getItemAsync(DB_KEY)
      if (!key) {
        key = Array.from(await Crypto.getRandomBytesAsync(32), (v) =>
          v.toString(16).padStart(2, '0'),
        ).join('')
        await SecureStore.setItemAsync(DB_KEY, key)
      }
      if (!/^[a-f0-9]{64}$/.test(key))
        throw Error('The encrypted cache key needs recovery. No records were removed.')
      const db = await SQLite.openDatabaseAsync('field-attendance-v1.db')
      try {
        // key is strictly hex; never interpolate user input in a PRAGMA.
        await db.execAsync(`PRAGMA key = "x'${key}'";`)
        const cipher = await db.getFirstAsync<Record<string, unknown>>('PRAGMA cipher_version')
        if (!cipher || !Object.values(cipher).some((v) => typeof v === 'string' && v.length > 0))
          throw Error(
            'Encrypted storage is unavailable. Install the native SQLCipher build; Expo Go is unsupported.',
          )
        const store = new FieldStore(db)
        await store.initialize()
        return store
      } catch (error) {
        await db.closeAsync()
        throw error
      }
    })().catch((error) => {
      storeFlight = null
      throw error
    })
  return storeFlight
}

const headers = { 'content-type': 'application/json', 'x-rafik-client': 'android' }

function validSession(value: Session) {
  if (
    !value?.user?.id ||
    !/^[a-f0-9]{64}$/.test(value.access_token) ||
    !/^[a-f0-9]{64}$/.test(value.refresh_token) ||
    !Number.isFinite(Date.parse(value.access_expires_at)) ||
    !Number.isFinite(Date.parse(value.refresh_expires_at))
  )
    throw Error('The server session is invalid. Sign in again.')
  return value
}

export class NativeClient {
  private responseListeners = new Set<() => void>()
  private refreshFlight: Promise<void> | null = null
  private storageFlight: Promise<void> = Promise.resolve()
  private stopped = false
  constructor(private credentials: Credentials) {}
  get instance() {
    return this.credentials.instance
  }
  get user() {
    return this.credentials.session.user
  }
  get contexts() {
    return this.credentials.contexts
  }

  onAuthorizedResponse(listener: () => void) {
    this.responseListeners.add(listener)
    return () => {
      this.responseListeners.delete(listener)
    }
  }

  static async restore(): Promise<NativeClient | null> {
    const saved = await SecureStore.getItemAsync(CREDENTIALS)
    if (!saved) return null
    const data = JSON.parse(saved) as Credentials
    data.instance = instanceUrl(data.instance)
    validSession(data.session)
    if (!Array.isArray(data.contexts))
      throw Error('Saved institution access needs a fresh sign-in.')
    // Rename cached credentials in memory; never change the v1 SQLite owner tuple or queued payload.
    data.contexts = data.contexts.map((context) => {
      const previous = context as CoachContext & { workspace_id?: string }
      return { ...context, institution_id: context.institution_id || previous.workspace_id || '' }
    })
    return new NativeClient(data)
  }

  static async login(input: string, email: string, password: string) {
    const instance = instanceUrl(input)
    const session = validSession(
      await jsonRequest<Session>(`${instance}/v1/mobile/auth/login`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email, password, device_name: 'Rafik Field Android' }),
      }),
    )
    const client = new NativeClient({ instance, session, contexts: [] })
    await client.persist()
    return client
  }

  private persist() {
    // Instance and credentials are acknowledged in one secure-storage write.
    const payload = JSON.stringify(this.credentials)
    const write = this.storageFlight
      .catch(() => undefined)
      .then(() => {
        if (this.stopped) throw Error('This sign-in session is closed.')
        return SecureStore.setItemAsync(CREDENTIALS, payload)
      })
    this.storageFlight = write
    return write
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (this.stopped) throw Error('This sign-in session is closed.')
    if (Date.parse(this.credentials.session.access_expires_at) <= Date.now() + 30_000) {
      if (!this.refreshFlight)
        this.refreshFlight = (async () => {
          const session = validSession(
            await jsonRequest<Session>(`${this.instance}/v1/mobile/auth/refresh`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ refresh_token: this.credentials.session.refresh_token }),
            }),
          )
          if (session.user.id !== this.user.id)
            throw Error('The refreshed session changed identity.')
          if (this.stopped) throw Error('This sign-in session is closed.')
          this.credentials = { ...this.credentials, session }
          await this.persist()
        })().finally(() => {
          this.refreshFlight = null
        })
      await this.refreshFlight
    }
    if (this.stopped) throw Error('This sign-in session is closed.')
    const result = await jsonRequest<T>(`${this.instance}/v1${path}`, {
      ...init,
      headers: { ...headers, authorization: `Bearer ${this.credentials.session.access_token}` },
    })
    if (!this.stopped)
      for (const listener of this.responseListeners) {
        // UI recovery must never turn an acknowledged write into a transport failure.
        try {
          listener()
        } catch {
          /* The response remains successful. */
        }
      }
    return result
  }

  async refreshContexts() {
    const data = await this.request<{
      contexts: Array<CoachContext & { role: string; kind: string }>
    }>('/institution/context')
    if (!Array.isArray(data.contexts) || data.contexts.some((c) => !c || typeof c !== 'object'))
      throw Error(
        'The server returned invalid institution access. Check the API URL and server version.',
      )
    const contexts = data.contexts
      .filter((c) => c.role === 'trainer' && c.kind === 'institution' && c.institution_id)
      .map(({ institution_id, member_id, name }) => {
        if (
          ![institution_id, member_id, name].every(
            (value) => typeof value === 'string' && value.length,
          )
        )
          throw Error(
            'The server returned invalid institution access. Check the API URL and server version.',
          )
        return { institution_id, member_id, name, role: 'trainer' as const }
      })
    if (this.stopped) throw Error('This sign-in session is closed.')
    this.credentials = { ...this.credentials, contexts }
    await this.persist()
    return contexts
  }

  async logout(): Promise<boolean> {
    this.stopped = true
    // Wait for a token rotation to settle before revocation and deletion. No late refresh can revive sign-in.
    await this.refreshFlight?.catch(() => undefined)
    let revoked = false
    try {
      await jsonRequest(`${this.instance}/v1/mobile/auth/logout`, {
        method: 'POST',
        headers: { ...headers, authorization: `Bearer ${this.credentials.session.access_token}` },
        body: JSON.stringify({ refresh_token: this.credentials.session.refresh_token }),
      })
      revoked = true
    } catch {
      /* Local sign-out still removes credentials; server revocation is explicitly reported. */
    }
    await this.storageFlight.catch(() => undefined)
    await SecureStore.deleteItemAsync(CREDENTIALS)
    return revoked
  }
}
