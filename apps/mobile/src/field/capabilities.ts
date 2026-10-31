import type { FieldCapabilities } from '@rafik/shared/contracts'
import { ApiFailure } from './model.ts'

export type CapabilityCheck = { state: 'available'; value: FieldCapabilities } | { state: 'legacy' }

export function fieldCapabilities(input: unknown): FieldCapabilities {
  const value = input as FieldCapabilities | null
  const keys: (keyof FieldCapabilities['features'])[] = [
    'attendance',
    'assessments',
    'event_completion',
    'individual_workout_recording',
    'group_workout_recording',
    'day_only_calendar',
  ]
  if (
    !value ||
    value.protocol !== 1 ||
    !value.features ||
    keys.some((key) => typeof value.features[key] !== 'boolean')
  )
    throw Error(
      'The server compatibility response is unsupported. Ask your institution to check the app and server versions.',
    )
  return {
    protocol: 1,
    features: Object.fromEntries(
      keys.map((key) => [key, value.features[key]]),
    ) as FieldCapabilities['features'],
  }
}

/** A missing endpoint is different from a failed connection or revoked session. */
export async function checkCapabilities(
  request: (path: string) => Promise<unknown>,
): Promise<CapabilityCheck> {
  try {
    return { state: 'available', value: fieldCapabilities(await request('/mobile/capabilities')) }
  } catch (error) {
    if (error instanceof ApiFailure && error.status === 404 && error.code === 'not_found')
      return { state: 'legacy' }
    throw error
  }
}
