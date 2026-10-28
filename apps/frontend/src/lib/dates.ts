/** Calendar dates are not UTC instants. Keep date-only labels on their original day. */
export function formatDate(value: string, locale: 'en' | 'ar' = 'en', timezone = 'UTC') {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-AE' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: dateOnly ? 'UTC' : timezone,
  }).format(new Date(dateOnly ? value + 'T12:00:00Z' : value))
}
/** Display preferences never change the stored instant or an appointment's authoring zone. */
export function formatInstant(
  value: string | Date,
  locale: 'en' | 'ar',
  timezone: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' },
) {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-AE' : 'en-GB', {
    ...options,
    timeZone: timezone,
  }).format(typeof value === 'string' ? new Date(value) : value)
}
export function displayTimezone(
  preference?: string | null,
  device = Intl.DateTimeFormat().resolvedOptions().timeZone,
) {
  for (const zone of [preference, device, 'UTC']) {
    if (!zone) continue
    try {
      new Intl.DateTimeFormat('en', { timeZone: zone }).format()
      return zone
    } catch {
      /* A stale preference must not make every date on the page fail. */
    }
  }
  return 'UTC'
}
export function localDate(timezone: string, instant: Date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant)
}
export function addDays(date: string, days: number) {
  const d = new Date(date + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
