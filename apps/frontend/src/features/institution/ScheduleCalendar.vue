<script setup lang="ts">
import { institutionContext } from '../../app/institution'

import { PhCaretLeft, PhCaretRight, PhTray } from '@phosphor-icons/vue'
import ScheduleViewSwitch from '../../components/ScheduleViewSwitch.vue'
import ListPagination from '../../components/ListPagination.vue'
import PageHeading from '../../components/PageHeading.vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { profile } from '../../app/auth'
import { request } from '../../lib/backend'
import { localDate, addDays } from '../../lib/dates'
import { language as l, errorMessage, locale } from '../../lib/i18n'
import MonthCalendar from '../../components/MonthCalendar.vue'
import PageState from '../../components/PageState.vue'
import type { CalendarEvent } from './service-types'
const route = useRoute(),
  router = useRouter(),
  id = institutionContext().institution,
  view = institutionContext().view,
  base = '',
  zone = profile.value?.timezone || 'UTC'
const today = localDate(zone),
  start = ref(String(route.query.from || today.slice(0, 7) + '-01')),
  mode = ref(String(route.query.mode || 'month')),
  selectedDay = ref(String(route.query.day ?? today)),
  cardOffset = ref(0),
  end = computed(() =>
    mode.value === 'week'
      ? addDays(start.value, 6)
      : new Date(Date.UTC(Number(start.value.slice(0, 4)), Number(start.value.slice(5, 7)), 0))
          .toISOString()
          .slice(0, 10),
  ),
  items = ref<CalendarEvent[]>([]),
  loading = ref(true),
  error = ref(''),
  showCancelled = ref(false)
const visible = computed(() =>
  items.value.filter(
    (e) =>
      (showCancelled.value || e.state !== 'cancelled') &&
      (!selectedDay.value ||
        (e.starts_at ? localDate(zone, new Date(e.starts_at)) : e.training_date) ===
          selectedDay.value),
  ),
)
watch([selectedDay, showCancelled], () => {
  cardOffset.value = 0
})
const pagedBookings = computed(() => visible.value.slice(cardOffset.value, cardOffset.value + 4))
const weekDays = computed(() =>
  Array.from({ length: 7 }, (_, index) => addDays(start.value, index)),
)
const bookingsOn = (day: string) =>
  items.value.filter(
    (event) =>
      (showCancelled.value || event.state !== 'cancelled') &&
      (event.starts_at ? localDate(zone, new Date(event.starts_at)) : event.training_date) === day,
  ).length
const date = (value: string) =>
  new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar-AE' : 'en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: zone,
  }).format(new Date(value))
const time = (value: string) =>
  new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar-AE' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: zone,
  }).format(new Date(value))
const periodLabel = computed(() =>
  mode.value === 'month'
    ? new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar-AE' : 'en-GB', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(start.value + 'T12:00:00Z'))
    : l('Week of', 'أسبوع') +
      ' ' +
      new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar-AE' : 'en-GB', {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      }).format(new Date(start.value + 'T12:00:00Z')),
)
const missingStaff = (e: CalendarEvent) =>
  !e.people?.some((p) => p.duty === 'staff' && p.active && p.roles.includes('trainer'))
let generation = 0
onUnmounted(() => generation++)
async function load() {
  const current = ++generation
  loading.value = true
  error.value = ''
  try {
    const collected: CalendarEvent[] = []
    let cursor: number | null = 0
    while (cursor !== null) {
      const result: { items: CalendarEvent[]; next: number | null } = await request(
        `/v1/institution/calendar?includeDayOnly=true&view=${view}&from=${start.value}&to=${end.value}&zone=${encodeURIComponent(zone)}&offset=${cursor}`,
      )
      if (current !== generation) return
      collected.push(...result.items)
      cursor = result.next
    }
    items.value = collected
    cardOffset.value = 0
    await router.replace({
      query: { ...route.query, from: start.value, day: selectedDay.value, mode: mode.value },
    })
  } catch (e) {
    if (current === generation) error.value = errorMessage(e)
  } finally {
    if (current === generation) loading.value = false
  }
}
function move(days: number) {
  selectedDay.value = ''
  start.value =
    mode.value === 'week'
      ? addDays(start.value, days)
      : new Date(
          Date.UTC(
            Number(start.value.slice(0, 4)),
            Number(start.value.slice(5, 7)) - 1 + Math.sign(days),
            1,
          ),
        )
          .toISOString()
          .slice(0, 10)
  void load()
}
function changeMode() {
  selectedDay.value = ''
  if (mode.value === 'month') start.value = start.value.slice(0, 7) + '-01'
  void load()
}
watch(selectedDay, () => {
  void router.replace({ query: { ...route.query, day: selectedDay.value } })
})
onMounted(() => load())
</script>
<template>
  <div class="container page institution-calendar">
    <PageHeading class="work-heading">
      <div>
        <p class="overline">{{ l('Plan the training day', 'خطّط ليوم التدريب') }}</p>
        <h1>{{ l('Schedule', 'الجدول') }}</h1>
        <p>
          {{
            view === 'trainee'
              ? l('Your institution sessions and assessments.', 'حصصك وتقييماتك في المؤسسة.')
              : l(
                  'Coordinate people, review attendance, and keep assessments moving.',
                  'نسّق الأشخاص وراجع الحضور وتابع التقييمات.',
                )
          }}
        </p>
      </div>
      <div class="actions">
        <ScheduleViewSwitch v-if="view !== 'trainee'" :base="base" view="calendar" />
        <RouterLink v-if="view !== 'trainee'" class="button" :to="base + '/schedule/new'">{{
          l('Schedule event', 'جدولة موعد')
        }}</RouterLink>
      </div>
    </PageHeading>
    <div class="calendar-controls-layout">
      <div>
        <form class="calendar-toolbar" @submit.prevent="load()">
          <div class="calendar-filters">
            <label class="view-control"
              ><span>{{ l('View', 'العرض') }}</span>
              <select
                :aria-label="l('Calendar view', 'عرض التقويم')"
                v-model="mode"
                @change="changeMode"
              >
                <option value="month">{{ l('Month', 'شهر') }}</option>
                <option value="week">{{ l('Week agenda', 'جدول الأسبوع') }}</option>
              </select>
            </label>
            <label class="date-control"
              ><span>{{
                mode === 'month' ? l('Month', 'الشهر') : l('Week starting', 'أسبوع يبدأ')
              }}</span>
              <input type="date" v-model="start" required @change="changeMode()" />
            </label>
            <label class="check-label"
              ><input type="checkbox" v-model="showCancelled" />{{
                l('Show cancelled', 'عرض الملغى')
              }}</label
            >
          </div>
          <div
            class="calendar-period-actions"
            role="group"
            :aria-label="l('Change period', 'تغيير الفترة')"
          >
            <button
              type="button"
              class="button secondary period-button"
              :aria-label="
                mode === 'month'
                  ? l('Previous month', 'الشهر السابق')
                  : l('Previous week', 'الأسبوع السابق')
              "
              :title="
                mode === 'month'
                  ? l('Previous month', 'الشهر السابق')
                  : l('Previous week', 'الأسبوع السابق')
              "
              @click="move(-7)"
              :disabled="loading"
            >
              <PhCaretLeft :size="18" class="directional" aria-hidden="true" />
            </button>
            <span class="period-label" aria-live="polite">{{ periodLabel }}</span>
            <button
              type="button"
              class="button secondary period-button"
              :aria-label="
                mode === 'month'
                  ? l('Next month', 'الشهر التالي')
                  : l('Next week', 'الأسبوع التالي')
              "
              :title="
                mode === 'month'
                  ? l('Next month', 'الشهر التالي')
                  : l('Next week', 'الأسبوع التالي')
              "
              @click="move(7)"
              :disabled="loading"
            >
              <PhCaretRight :size="18" class="directional" aria-hidden="true" />
            </button>
          </div>
        </form>
        <p class="date-range">
          <bdi>{{ start }} — {{ end }}</bdi> · <bdi>{{ zone }}</bdi>
        </p>
      </div>
    </div>
    <div class="calendar-layout">
      <section class="calendar-surface" :aria-label="l('Calendar dates', 'تواريخ التقويم')">
        <MonthCalendar
          v-if="mode === 'month'"
          :month="start"
          :selected="selectedDay"
          :zone="zone"
          :events="items.filter((e) => showCancelled || e.state !== 'cancelled')"
          @select="selectedDay = $event"
        />
        <div v-else class="week-agenda">
          <button
            v-for="day in weekDays"
            :key="day"
            type="button"
            class="week-day"
            :class="{ selected: selectedDay === day }"
            :aria-pressed="selectedDay === day"
            @click="selectedDay = day"
          >
            <strong>{{ date(day + 'T12:00:00') }}</strong>
            <span>{{ bookingsOn(day) }} {{ l('bookings', 'حجوزات') }}</span>
          </button>
        </div>
      </section>
      <aside class="bookings-panel">
        <div class="section-heading">
          <div>
            <p class="overline">
              {{ selectedDay ? date(selectedDay + 'T12:00:00') : l('Schedule', 'الجدول') }}
            </p>
            <h2>{{ l('Booked sessions', 'الحصص المحجوزة') }}</h2>
          </div>
          <button v-if="selectedDay" class="text-link" @click="selectedDay = ''">
            {{ l('All dates', 'كل التواريخ') }}
          </button>
        </div>
        <PageState :loading="loading" :error="error" @retry="load()">
          <section v-if="!visible.length" class="empty-state empty-state--compact">
            <PhTray :size="28" aria-hidden="true" />
            <h3>{{ l('No bookings for these dates', 'لا توجد حجوزات لهذه التواريخ') }}</h3>
            <p>
              {{ l('Choose another day or schedule a session.', 'اختر يوماً آخر أو جدول حصة.') }}
            </p>
          </section>
          <ol v-else class="agenda-list">
            <li
              v-for="e in pagedBookings"
              :key="e.id"
              :class="{ 'assessment-booking': e.kind === 'assessment' }"
            >
              <RouterLink :to="base + '/schedule/' + e.id + '?from=' + start" class="agenda-event">
                <div class="agenda-time">
                  <strong>{{ e.starts_at ? date(e.starts_at) : e.training_date }}</strong>
                  <span v-if="e.starts_at && e.ends_at"
                    >{{ time(e.starts_at) }} — {{ time(e.ends_at) }}</span
                  ><span v-else>{{ l('No fixed time', 'دون وقت محدد') }}</span>
                </div>
                <div class="agenda-content">
                  <span class="tag">{{
                    e.kind === 'assessment' ? l('Assessment', 'تقييم') : l('Training', 'تدريب')
                  }}</span>
                  <h2>{{ e.title }}</h2>
                  <p class="agenda-location" dir="auto">
                    {{ e.location || l('Location to be agreed', 'الموقع يحدد لاحقاً') }}
                  </p>
                  <p class="small-print">
                    {{
                      e.people
                        ?.filter((p) => p.duty === 'staff')
                        .map((p) => p.name)
                        .join(' · ')
                    }}
                  </p>
                  <p v-if="e.state === 'scheduled' && missingStaff(e)" class="attention-label">
                    {{ l('Coach reassignment needed', 'يلزم إعادة تعيين المدرب') }}
                  </p>
                </div>
                <span class="event-state">
                  {{
                    e.state === 'completed'
                      ? l('Completed', 'مكتمل')
                      : e.state === 'cancelled'
                        ? l('Cancelled', 'ملغي')
                        : l('Open event', 'فتح الموعد')
                  }}
                  ↗
                </span>
              </RouterLink>
            </li>
          </ol>
          <ListPagination
            v-if="visible.length > 4"
            :label="l('Booked session pages', 'صفحات الحصص المحجوزة')"
            :offset="cardOffset"
            :page-size="4"
            :total="visible.length"
            @page="cardOffset = $event"
          />
        </PageState>
      </aside>
    </div>
  </div>
</template>
<style scoped>
.institution-calendar {
  max-width: 1440px;
}
.calendar-layout,
.calendar-controls-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.8fr) minmax(280px, 1fr);
  align-items: start;
  gap: 24px;
}
.calendar-surface,
.bookings-panel {
  min-width: 0;
}
.bookings-panel {
  padding-inline-start: 20px;
  border-inline-start: 1px solid var(--line);
}
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.section-heading h2 {
  margin: 4px 0 0;
  font-size: 1.25rem;
}
.week-agenda {
  display: grid;
  gap: 8px;
}
.week-day {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  text-align: start;
  padding: 12px;
  background: var(--surface);
}
.week-day span {
  color: var(--muted);
  font-size: 0.85rem;
}
.week-day.selected {
  border-color: var(--accent);
  background: var(--tint);
}
.agenda-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.agenda-event {
  display: block;
  padding: 16px;
  margin-block: 10px;
  border: 1px solid var(--line);
  border-inline-start: 4px solid var(--accent);
  border-radius: var(--radius-panel);
  background: var(--surface);
  color: inherit;
  text-decoration: none;
}
.assessment-booking .agenda-event {
  background: var(--surface-soft);
}
.agenda-event:hover {
  border-color: var(--accent);
}
.agenda-time {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
  margin-bottom: 10px;
  font-size: 0.85rem;
}
.agenda-time span,
.event-state {
  color: var(--muted);
  font-size: 0.8rem;
}
.agenda-content {
  min-width: 0;
  overflow-wrap: anywhere;
}
.agenda-content h2 {
  font-size: 1.05rem;
  margin: 6px 0;
}
.agenda-content p {
  margin: 4px 0;
}
.attention-label {
  color: var(--accent);
  font-weight: 650;
}
.event-state {
  display: block;
  margin-top: 12px;
}
.load-more {
  width: 100%;
}
@media (max-width: 900px) {
  .calendar-layout,
  .calendar-controls-layout {
    grid-template-columns: minmax(0, 1.5fr) minmax(240px, 1fr);
    gap: 16px;
  }
  .bookings-panel {
    padding-inline-start: 14px;
  }
}
@media (max-width: 720px) {
  .calendar-layout,
  .calendar-controls-layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .bookings-panel {
    padding: 18px 0 0;
    border-inline-start: 0;
    border-block-start: 1px solid var(--line);
  }
}
@media (max-width: 650px) {
  .agenda-event {
    padding: 12px;
  }
  .agenda-content h2 {
    font-size: 1rem;
  }
}
@media (max-width: 380px) {
  .week-day {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
  }
}

.calendar-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: end;
  flex-wrap: wrap;
  gap: 16px 24px;
  margin-block: 16px 12px;
}
.calendar-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 16px;
  min-width: 0;
}
.calendar-filters label {
  display: grid;
  gap: 8px;
  margin: 0;
  min-width: 0;
  font-size: var(--text-small);
}
.calendar-filters input[type='date'],
.calendar-filters select {
  height: 44px;
  min-height: 44px;
  margin: 0;
  width: auto;
  max-width: 100%;
}
.calendar-filters .check-label {
  display: flex;
  gap: 8px;
  align-items: center;
  min-height: 44px;
}
.calendar-period-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-inline-start: auto;
}
.calendar-period-actions .period-button {
  width: 44px;
  min-width: 44px;
  height: 44px;
  min-height: 44px;
  padding: 0;
  margin: 0;
}
.period-label {
  min-width: 9.5em;
  text-align: center;
  font-weight: 600;
  white-space: nowrap;
}
.agenda-location {
  color: var(--muted);
  font-size: var(--text-small);
}
.date-range {
  color: var(--muted);
  font-size: var(--text-caption);
  margin: 0 0 20px;
  font-variant-numeric: tabular-nums;
}
@media (max-width: 600px) {
  .calendar-filters {
    width: 100%;
    gap: 12px;
  }
  .calendar-filters .view-control,
  .calendar-filters .date-control {
    flex: 1 1 120px;
  }
  .calendar-filters input[type='date'],
  .calendar-filters select {
    width: 100%;
  }
  .calendar-period-actions {
    width: 100%;
    margin: 0;
    justify-content: space-between;
  }
}
</style>
