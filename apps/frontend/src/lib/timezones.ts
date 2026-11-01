/** Browser IANA catalog; persisted aliases remain selectable without rewriting history. */
export function timezoneOptions(selected = ''): string[] {
  const values = Intl.supportedValuesOf('timeZone')
  try {
    if (selected) new Intl.DateTimeFormat('en', { timeZone: selected }).format()
    else selected = 'UTC'
  } catch {
    selected = 'UTC'
  }
  return [...new Set(['UTC', selected, ...values])].sort()
}

/** Shows a timezone name and its current UTC offset in the selector. */
export function timezoneLabel(zone: string, at = new Date()): string {
  const offset = new Intl.DateTimeFormat('en', {
    timeZone: zone,
    timeZoneName: 'shortOffset',
  })
    .formatToParts(at)
    .find((p) => p.type === 'timeZoneName')
    ?.value.replace('GMT', 'UTC')
    .replace(/^UTC[+-]0$/, 'UTC')
  return `${zone.replaceAll('_', ' ')} · ${offset}`
}

/** Match common city renames without changing the browser's valid persisted IANA value. */
export function timezoneSearchText(zone: string): string {
  const aliases = [
    ['Kathmandu', 'Katmandu'],
    ['Kolkata', 'Calcutta'],
    ['Kyiv', 'Kiev'],
    ['Yangon', 'Rangoon'],
    ['Ho_Chi_Minh', 'Saigon'],
    ['Nuuk', 'Godthab'],
  ]
  const city = zone.split('/').at(-1) || zone
  const related = aliases.find((names) => names.includes(city)) || []
  return [zone, ...related].join(' ').replaceAll('_', ' ')
}
