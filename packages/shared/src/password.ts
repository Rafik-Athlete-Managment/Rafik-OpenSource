export const passwordPattern = '(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[\\p{P}\\p{S}]).{8,128}'

/** Checks the password rules shared by the web, phone and backend applications. */
export const strongPassword = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length >= 8 &&
  value.length <= 128 &&
  /[a-z]/.test(value) &&
  /[A-Z]/.test(value) &&
  /[0-9]/.test(value) &&
  /[\p{P}\p{S}]/u.test(value)
