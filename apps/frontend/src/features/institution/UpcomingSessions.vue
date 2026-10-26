<script setup lang="ts">
import { institutionContext } from '../../app/institution'

import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { profile } from '../../app/auth'
import { request } from '../../lib/backend'
import { localDate, addDays } from '../../lib/dates'
import { language as l, errorMessage, locale } from '../../lib/i18n'
import type { CalendarEvent } from './service-types'
const props = defineProps<{ todayOnly?: boolean; omitWorkouts?: boolean; headingLevel?: number }>()
const route = useRoute(),
  id = institutionContext().institution,
  view = institutionContext().view,
  base = '',
  zone = profile.value?.timezone || 'UTC',
  today = localDate(zone)
const events = ref<CalendarEvent[]>([]),
  error = ref(''),
  loading = ref(true)
const label = (date: string) =>
  new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar-AE' : 'en-GB', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: zone,
  }).format(new Date(date))
onMounted(async () => {
  try {
    const result = await request<{ items: CalendarEvent[] }>(
      `/v1/institution/calendar?view=${view}&from=${today}&to=${props.todayOnly ? today : addDays(today, 7)}&zone=${encodeURIComponent(zone)}`,
    )
    events.value = result.items
      .filter(
        (e) =>
          e.state === 'scheduled' &&
          (!props.omitWorkouts || !e.workout_snapshot?.assignment_id) &&
          (props.todayOnly || Date.parse(e.ends_at) > Date.now()),
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
      <RouterLink :to="base + '/schedule'" class="text-link"
        >{{ l('Open calendar', 'فتح التقويم') }} ↗</RouterLink
      >
    </div>
    <p v-if="loading" class="small-print">
      {{ l('Loading upcoming events…', 'تحميل المواعيد القادمة…') }}
    </p>
    <p v-else-if="error" class="notice error" role="alert">{{ error }}</p>
    <p v-else-if="!events.length" class="small-print">
      {{
        todayOnly
          ? l(
              'No group sessions or assessments scheduled today.',
              'لا توجد حصص جماعية أو تقييمات مجدولة اليوم.',
            )
          : l('No scheduled events in the next week.', 'لا توجد مواعيد مجدولة في الأسبوع القادم.')
      }}
    </p>
    <RouterLink
      v-for="e in events"
      :key="e.id"
      class="upcoming-event"
      :to="base + '/schedule/' + e.id"
      ><span
        ><strong>{{ e.title }}</strong
        ><small>{{ label(e.starts_at) }} · {{ zone }}</small></span
      ><span aria-hidden="true">↗</span></RouterLink
    >
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
.upcoming-event {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 20px 0;
  border-bottom: 1px solid var(--line);
}
.upcoming-event > span:first-child {
  display: grid;
  gap: 6px;
  min-width: 0;
  overflow-wrap: anywhere;
}
.upcoming-event small {
  color: var(--muted);
}
</style>
