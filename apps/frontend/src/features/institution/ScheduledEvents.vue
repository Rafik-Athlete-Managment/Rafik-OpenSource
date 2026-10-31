<script setup lang="ts">
import { institutionContext } from '../../app/institution'

import { PhTray } from '@phosphor-icons/vue'
import { useListPageSize } from '../../lib/list-page-size'
import ScheduleViewSwitch from '../../components/ScheduleViewSwitch.vue'
import { useLiveSearch } from '../../lib/live-search'
import PageHeading from '../../components/PageHeading.vue'
import { calendarStatusLabel as stateLabel } from '../../lib/calendar-status'
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { request } from '../../lib/backend'
import { language as l, errorMessage, locale } from '../../lib/i18n'
import { preferredTimezone } from '../../lib/display-time'
import { localDate } from '../../lib/dates'
import ListPagination from '../../components/ListPagination.vue'
import PageState from '../../components/PageState.vue'
import type { CalendarEvent } from './service-types'
const route = useRoute(),
  router = useRouter()
const view = institutionContext().view;
const base = ''
const zone = preferredTimezone
const format = (value: string, parts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar-AE' : 'en-GB', {
    ...parts,
    timeZone: zone.value,
  }).format(new Date(value))
/** Same-day events show one date and a time range; longer events show both ends. */
function when(event: Pick<CalendarEvent, 'starts_at' | 'ends_at' | 'training_date'>) {
  if (!event.starts_at || !event.ends_at)
    return event.training_date + ' · ' + l('No fixed time', 'دون وقت محدد')
  const day = { weekday: 'short', day: 'numeric', month: 'short' } as const,
    clock = { hour: '2-digit', minute: '2-digit' } as const
  return localDate(zone.value, new Date(event.starts_at)) ===
    localDate(zone.value, new Date(event.ends_at))
    ? `${format(event.starts_at, day)} · ${format(event.starts_at, clock)}–${format(event.ends_at, clock)}`
    : `${format(event.starts_at, { ...day, ...clock })} — ${format(event.ends_at, { ...day, ...clock })}`
}
type Page = {
  items: (Pick<
    CalendarEvent,
    | 'id'
    | 'title'
    | 'kind'
    | 'state'
    | 'starts_at'
    | 'ends_at'
    | 'timezone'
    | 'location'
    | 'training_date'
  > & { athlete_count: number })[]
  total: number
  next: number | null
}
const data = ref<Page>(),
  loading = ref(false),
  error = ref('')
const search = ref(String(route.query.search || '')),
  kind = ref(String(route.query.kind || 'all')),
  state = ref(String(route.query.state || 'all')),
  offset = ref(0)
let generation = 0,
  disposed = false
const { recordLimit, appliedLimit, pageSizes, acceptLimit, changeLimit } = useListPageSize(
  10,
  () => {
    void load()
  },
)
async function load() {
  const stamp = ++generation
  loading.value = true
  error.value = ''
  const page = Math.max(0, Number(route.query.offset) || 0)
  const query = new URLSearchParams({
    view,
    kind: String(route.query.kind || 'all'),
    state: String(route.query.state || 'all'),
    search: String(route.query.search || ''),
    limit: String(recordLimit.value),
    offset: String(page),
  })
  try {
    const result = await request<Page>(
      `/v1/institution/scheduled-events?includeDayOnly=true&${query}`,
    )
    if (disposed || stamp !== generation) return
    data.value = result
    acceptLimit()
    offset.value = page
  } catch (e) {
    if (!disposed && stamp === generation) {
      error.value = errorMessage(e)
      if ((e as { statusCode?: number }).statusCode === 403) data.value = undefined
    }
  } finally {
    if (!disposed && stamp === generation) loading.value = false
  }
}
function navigate(page = 0, replace = false) {
  return router[replace ? 'replace' : 'push']({
    query: {
      from: route.query.from,
      day: route.query.day,
      mode: route.query.mode,
      limit: route.query.limit,
      ...(search.value.trim() ? { search: search.value.trim() } : {}),
      ...(kind.value !== 'all' ? { kind: kind.value } : {}),
      ...(state.value !== 'all' ? { state: state.value } : {}),
      ...(page ? { offset: page } : {}),
    },
  })
}
const live = useLiveSearch(search, () => navigate(0, true))
watch(
  () => route.fullPath,
  () => {
    live.restore(String(route.query.search || ''))
    kind.value = String(route.query.kind || 'all')
    state.value = String(route.query.state || 'all')
    void load()
  },
)
onMounted(load)
onUnmounted(() => {
  disposed = true
  generation++
})
</script>
<template>
  <div class="container page scheduled-events-page">
    <PageHeading class="work-heading">
      <div>
        <p class="overline">{{ l('Scheduled activity', 'النشاط المجدول') }}</p>
        <h1>{{ l('Schedule', 'الجدول') }}</h1>
        <p>
          {{
            l(
              'Group training and assessments, newest scheduled date first. Open an event for attendance, results and correction history.',
              'التدريبات الجماعية والتقييمات، بدءاً بأحدث موعد. افتح الموعد لعرض الحضور والنتائج وتاريخ التصحيحات.',
            )
          }}
        </p>
      </div>
      <div class="actions">
        <ScheduleViewSwitch :base="base" view="list" />
        <RouterLink class="button" :to="base + '/schedule/new'">{{
          l('Schedule event', 'جدولة موعد')
        }}</RouterLink>
      </div>
    </PageHeading>
    <p class="small-print">
      {{ l('Times shown in', 'تُعرض الأوقات حسب') }} <bdi>{{ zone }}</bdi>
    </p>
    <div class="list-toolbar">
      <form class="event-filters schedule-list-filters" @submit.prevent="live.submit()">
        <label
          >{{ l('Search schedule', 'البحث في الجدول')
          }}<input
            :placeholder="l('Search event titles…', 'ابحث بعناوين المواعيد…')"
            v-model="search"
            type="search"
        /></label>
        <label
          >{{ l('Activity type', 'نوع النشاط')
          }}<select v-model="kind" @change="navigate()">
            <option value="all">{{ l('All activities', 'جميع الأنشطة') }}</option>
            <option value="training">{{ l('Training sessions', 'حصص التدريب') }}</option>
            <option value="assessment">{{ l('Assessments', 'التقييمات') }}</option>
          </select></label
        >
        <label
          >{{ l('Status', 'الحالة')
          }}<select v-model="state" @change="navigate()">
            <option value="all">{{ l('All statuses', 'جميع الحالات') }}</option>
            <option
              v-for="value in ['scheduled', 'completed', 'cancelled']"
              :key="value"
              :value="value"
            >
              {{ stateLabel(value) }}
            </option>
          </select></label
        >
      </form>
      <div class="list-toolbar-pagination">
        <ListPagination
          :label="l('Schedule pages', 'صفحات الجدول')"
          :offset="offset"
          :page-size="appliedLimit"
          :sizes="pageSizes"
          @page-size="changeLimit"
          :total="data?.total || 0"
          :disabled="loading"
          @page="navigate"
        />
      </div>
    </div>
    <p v-if="loading && data" role="status" class="small-print">
      {{ l('Updating events…', 'جارٍ تحديث المواعيد…') }}
    </p>
    <p v-if="error && data" role="alert">
      {{ error }}
      <button class="text-link" @click="load">{{ l('Retry', 'إعادة المحاولة') }}</button>
    </p>
    <PageState :loading="loading && !data" :error="!data ? error : ''" @retry="load">
      <template v-if="data">
        <p class="list-summary">{{ data.total }} {{ l('matching activities', 'أنشطة مطابقة') }}</p>
        <section v-if="!data.items.length" class="empty-state panel">
          <PhTray :size="28" aria-hidden="true" />
          <h2>{{ l('No events match this view.', 'لا توجد مواعيد مطابقة لهذا العرض.') }}</h2>
          <p>
            {{
              l(
                'Adjust the search or filters, or schedule a training session or assessment.',
                'عدّل البحث أو المرشحات، أو جدول حصة تدريب أو تقييماً.',
              )
            }}
          </p>
        </section>
        <ol v-else class="event-list">
          <li
            v-for="event in data.items"
            :key="event.id"
            :data-status="event.state"
            :class="{ assessment: event.kind === 'assessment' }"
          >
            <div>
              <p class="overline">
                {{
                  event.kind === 'assessment'
                    ? l('Assessment', 'تقييم')
                    : l('Training session', 'حصة تدريب')
                }}
              </p>
              <h2 dir="auto">
                <RouterLink :to="base + '/schedule/' + event.id">{{ event.title }}</RouterLink>
              </h2>
              <p class="event-when">
                <bdi>{{ when(event) }}</bdi>
              </p>
              <p class="small-print">
                {{ l('Athletes:', 'الرياضيون:') }} {{ event.athlete_count
                }}<span v-if="event.location" dir="auto"> · {{ event.location }}</span>
              </p>
            </div>
            <span class="tag" :data-status="event.state">{{ stateLabel(event.state) }}</span>
          </li>
        </ol>
      </template>
    </PageState>
    <p class="small-print">
      <RouterLink :to="base + '/workouts'">{{
        l(
          'Looking for athletes’ recorded workouts? Open Session history.',
          'هل تبحث عن تمارين الرياضيين المسجلة؟ افتح سجل الحصص.',
        )
      }}</RouterLink>
    </p>
  </div>
</template>
<style scoped>
.event-filters label {
  min-width: 0;
  margin: 0;
}
.event-list {
  list-style: none;
  margin: 0 0 24px;
  padding: 0;
  display: grid;
  gap: 12px;
}
.event-list li {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 16px;
  border: 1px solid var(--line);
  border-inline-start: 3px solid var(--accent);
  border-radius: var(--radius-panel);
  padding: 16px 20px;
  background: var(--surface);
}
.event-when {
  margin: 0 0 4px;
  font-size: var(--text-small);
  font-variant-numeric: tabular-nums;
}
.event-list li[data-status='completed'] {
  border-inline-start-color: var(--completion-accent);
}
.event-list li.assessment {
  background: var(--surface-soft);
}
.event-list li > div {
  min-width: 0;
  overflow-wrap: anywhere;
}
.event-list h2 {
  font-size: 1.125rem;
  margin: 4px 0 8px;
}
.event-list .tag {
  flex-shrink: 0;
}

@media (max-width: 700px) {
  .event-list li {
    flex-direction: column;
    padding: 18px;
  }
}
</style>
