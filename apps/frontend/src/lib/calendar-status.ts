import { language } from './i18n'

/** Status comes from the event lifecycle, never from its date or participant counts. */
/** Turns a saved event state into the label shown in calendar cards and lists. */
export const calendarStatusLabel = (state: string) =>
  state === 'completed'
    ? language('Completed', 'مكتمل')
    : state === 'cancelled'
      ? language('Cancelled', 'ملغي')
      : state === 'scheduled'
        ? language('Scheduled', 'مجدول')
        : language('Unknown status', 'حالة غير معروفة')
