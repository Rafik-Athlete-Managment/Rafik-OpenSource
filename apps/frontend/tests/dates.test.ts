import { afterAll, expect, test, vi } from 'vitest'
import { formatDate, localDate, addDays, formatInstant, displayTimezone } from '../src/lib/dates'
const originalTimezone = process.env.TZ
afterAll(() => {
  if (originalTimezone === undefined) delete process.env.TZ
  else process.env.TZ = originalTimezone
  vi.useRealTimers()
})
test('calendar dates do not move backward for clients west of UTC', () => {
  process.env.TZ = 'America/Los_Angeles'
  expect(formatDate('2026-09-22')).toContain('22')
  expect(formatDate('2026-09-22T00:00:00Z')).toContain('22')
  expect(formatDate('2026-09-22', 'en', 'Pacific/Kiritimati')).toContain('22')
  expect(formatDate('2026-09-22', 'en', 'America/Los_Angeles')).toContain('22')
})

test('account display timezone overrides the device and crosses midnight without changing the instant', () => {
  process.env.TZ = 'America/Los_Angeles'
  const instant = '2026-10-28T01:15:00Z'
  expect(formatDate(instant, 'en', 'Asia/Dubai')).toContain('28')
  expect(formatDate(instant, 'en', 'America/Los_Angeles')).toContain('27')
  expect(
    formatInstant(instant, 'en', 'Asia/Dubai', {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }),
  ).toBe('05:15')
})

test('timezone offsets follow daylight saving and stale preferences fall back safely', () => {
  expect(
    formatInstant('2026-01-15T12:00:00Z', 'en', 'Europe/London', {
      hour: '2-digit',
      hourCycle: 'h23',
    }),
  ).toBe('12')
  expect(
    formatInstant('2026-07-15T12:00:00Z', 'en', 'Europe/London', {
      hour: '2-digit',
      hourCycle: 'h23',
    }),
  ).toBe('13')
  expect(displayTimezone('Asia/Dubai', 'Europe/London')).toBe('Asia/Dubai')
  expect(displayTimezone('retired/invalid', 'Europe/London')).toBe('Europe/London')
  expect(displayTimezone('retired/invalid', 'invalid/device')).toBe('UTC')
})
test('client-local today and cycle date arithmetic survive timezone and month boundaries', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-22T01:00:00Z'))
  expect(localDate('America/Los_Angeles')).toBe('2026-09-21')
  expect(localDate('Asia/Dubai')).toBe('2026-09-22')
  expect(addDays('2028-02-28', 2)).toBe('2028-03-01')
  expect(addDays('2026-03-08', 7)).toBe('2026-03-15')
})
