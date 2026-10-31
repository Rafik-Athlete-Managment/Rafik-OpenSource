/** Keep saved work reviewable, but never strand selection in a removed empty institution. */
export function selectedInstitution(
  current: string,
  available: readonly { institution_id: string }[],
  saved: readonly string[],
) {
  const ids = [...new Set([...available.map((c) => c.institution_id), ...saved])]
  return ids.includes(current) ? current : ids[0] || ''
}
