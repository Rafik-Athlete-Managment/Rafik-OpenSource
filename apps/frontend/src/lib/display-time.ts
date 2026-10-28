import { computed } from 'vue'
import { profile } from '../app/auth'
import { locale } from './i18n'
import { displayTimezone, formatDate, formatInstant } from './dates'

export const preferredTimezone = computed(() => displayTimezone(profile.value?.timezone))
export const dateLabel = (value: string) => formatDate(value, locale.value, preferredTimezone.value)
export const timestampLabel = (value: string | Date, options?: Intl.DateTimeFormatOptions) =>
  formatInstant(value, locale.value, preferredTimezone.value, options)
