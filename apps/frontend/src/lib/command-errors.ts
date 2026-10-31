// A definite HTTP rejection means the transaction did not commit. Network errors and
// server failures remain ambiguous: retain the exact command for idempotent replay.
export function commandRejected(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    [400, 403, 409, 422].includes(Number(error.statusCode))
  )
}
