<script setup lang="ts">
import { institutionContext } from '../../app/institution'
import { PhCalendarBlank, PhCaretRight } from '@phosphor-icons/vue'

import { onMounted, ref } from 'vue'
import { preferredTimezone } from '../../lib/display-time'
import { request } from '../../lib/backend'
import { localDate, addDays } from '../../lib/dates'
import { language as l, errorMessage, locale } from '../../lib/i18n'
import type { CalendarEvent } from './service-types'
const props = defineProps<{
  todayOnly?: boolean
  omitWorkouts?: boolean
  headingLevel?: number
  hideLink?: boolean
}>()
const view = institutionContext().view,
  base = '',
  zone = preferredTimezone,
  today = localDate(zone.value)
const events = ref<CalendarEvent[]>([]),
  error = ref(''),
  loading = ref(true)
const label = (date: string) =>
  new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar-AE' : 'en-GB', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: zone.value,
  }).format(new Date(date))
onMounted(async () => {
  try {
    const result = await request<{ items: CalendarEvent[] }>(
      `/v1/institution/calendar?view=${view}&from=${today}&to=${props.todayOnly ? today : addDays(today, 7)}&zone=${encodeURIComponent(zone.value)}`,
    )
    events.value = result.items
      .filter(
        (e) =>
          e.state === 'scheduled' &&
          !!e.starts_at &&
          !!e.ends_at &&
          (!props.omitWorkouts || !e.workout_snapshot?.assignment_id) &&
          (props.todayOnly || Date.parse(e.ends_at || '') > Date.now()),
      )
      .slice(0, 3)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
})
</script>
<template>
  <section class="organization-upcoming">
    <div class="heading-actions">
      <component :is="headingLevel === 3 ? 'h3' : 'h2'">{{
        todayOnly ? l('Today’s events', 'مواعيد اليوم') : l('Coming up', 'القادم')
      }}</component>
      <RouterLink v-if="!hideLink" :to="base + '/schedule'" class="text-link"
        >{{ l('Open calendar', 'فتح التقويم') }} ↗</RouterLink
      >
    </div>
    <p v-if="loading" class="small-print">
      {{ l('Loading upcoming events…', 'تحميل المواعيد القادمة…') }}
    </p>
    <p v-else-if="error" class="notice error" role="alert">{{ error }}</p>
    <p v-else-if="!events.length" class="upcoming-empty">
      {{
        todayOnly
          ? l(
              'No group sessions or assessments scheduled today.',
              'لا توجد حصص جماعية أو تقييمات مجدولة اليوم.',
            )
          : l('No scheduled events in the next week.', 'لا توجد مواعيد مجدولة في الأسبوع القادم.')
      }}
    </p>
    <ul v-else class="upcoming-list">
      <li v-for="e in events" :key="e.id">
        <RouterLink class="upcoming-event" :to="base + '/schedule/' + e.id"
          ><span class="upcoming-icon" aria-hidden="true"><PhCalendarBlank :size="18" /></span
          ><span class="upcoming-text"
            ><strong dir="auto">{{ e.title }}</strong
            ><small>{{ label(e.starts_at || '') }} · {{ zone }}</small></span
          ><PhCaretRight class="upcoming-caret" :size="16" aria-hidden="true"
        /></RouterLink>
      </li>
    </ul>
  </section>
</template>
<style scoped>
.organization-upcoming {
  margin-block: 28px;
}
.organization-upcoming h2,
.organization-upcoming h3 {
  font-size: 1.15rem;
}
.organization-upcoming .heading-actions {
  margin-block-end: var(--space-3);
}
.organization-upcoming .heading-actions > * {
  margin: 0;
}
/* One bordered list; each row leads with its time and opens the event. */
.upcoming-list {
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--surface);
  overflow: hidden;
}
.upcoming-list li + li {
  border-top: 1px solid var(--line);
}
.upcoming-event {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  color: var(--ink);
}
.upcoming-event:hover {
  background: var(--surface-soft);
}
.upcoming-icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-control);
  background: var(--tint);
  color: var(--accent);
}
.upcoming-text {
  display: grid;
  gap: 2px;
  min-width: 0;
  overflow-wrap: anywhere;
}
.upcoming-text strong {
  font-weight: 650;
}
.upcoming-event small {
  color: var(--muted);
}
.upcoming-caret {
  color: var(--muted);
}
.upcoming-caret:dir(rtl) {
  transform: scaleX(-1);
}
.upcoming-empty {
  margin: 0;
  padding: var(--space-3) var(--space-4);
  border: 1px dashed var(--line);
  border-radius: var(--radius-control);
  color: var(--muted);
  font-size: var(--text-small);
}
</style>
