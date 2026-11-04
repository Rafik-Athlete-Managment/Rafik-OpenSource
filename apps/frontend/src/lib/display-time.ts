import { computed } from 'vue'
import { profile } from '../app/auth'
import { locale } from './i18n'
import { displayTimezone, formatDate, formatInstant } from './dates'

export const preferredTimezone = computed(() => displayTimezone(profile.value?.timezone))
/** Formats a calendar date for the signed-in user's language and timezone. */
export const dateLabel = (value: string) => formatDate(value, locale.value, preferredTimezone.value)
/** Formats a saved moment in the signed-in user's language and preferred timezone. */
export const timestampLabel = (value: string | Date, options?: Intl.DateTimeFormatOptions) =>
  formatInstant(value, locale.value, preferredTimezone.value, options)
