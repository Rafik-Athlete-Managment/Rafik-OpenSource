<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { PhCalendarBlank, PhHeartbeat, PhInfo, PhArrowClockwise } from '@phosphor-icons/vue'
import { request } from '../../lib/backend'
import { language as l, errorMessage } from '../../lib/i18n'
import { dateLabel } from '../../lib/display-time'
import { institutionContext } from '../../app/institution'
import { useCommand } from '../../lib/commands'
import CommandStatus from '../../components/CommandStatus.vue'
import { profile } from '../../app/auth'
import { localDate } from '../../lib/dates'
import WorkoutAgenda from './WorkoutAgenda.vue'
import UpcomingSessions from './UpcomingSessions.vue'
import FollowUpPanel, { type FollowUpQueue } from './FollowUpPanel.vue'
type SharedStatus = {
  id: string
  athlete_name: string
  participation: string
  effective_from: string
}
const statuses = ref<SharedStatus[]>([]),
  loading = ref(true),
  error = ref('')
const revision = ref(0),
  actionableRevision = ref(0),
  planningRevision = ref(0)
// Keep the previous dashboard's exact pending command reachable after the layout upgrade.
const previousDashboard = useCommand(
  `workout-agenda:${institutionContext().institution}:due`,
  async () => {
    revision.value++
  },
  (name, args) =>
    request(`/v1/institution/${name === 'start' ? 'sessions' : 'workout-scheduling'}`, {
      method: 'POST',
      body: JSON.stringify(args),
    }),
  { successMessage: l('Workout change confirmed.', 'تم تأكيد تعديل التمرين.') },
)
// Pending commands from the former separate Due workouts panel retain their exact scope.
const previousToday = useCommand(
  `workout-agenda:${institutionContext().institution}:today`,
  async () => {
    revision.value++
  },
  (name, args) =>
    request(`/v1/institution/${name === 'start' ? 'sessions' : 'workout-scheduling'}`, {
      method: 'POST',
      body: JSON.stringify(args),
    }),
  { successMessage: l('Workout change confirmed.', 'تم تأكيد تعديل التمرين.') },
)
const zone = profile.value?.timezone || 'UTC'
let disposed = false,
  generation = 0
async function loadStatus() {
  const current = ++generation
  loading.value = true
  error.value = ''
  try {
    const result = await request<{ items: SharedStatus[] }>(
      '/v1/institution/injuries?view=trainer',
      { feedback: 'none' },
    )
    if (!disposed && current === generation) statuses.value = result.items
  } catch (e) {
    if (!disposed && current === generation) {
      error.value = errorMessage(e)
      if ([401, 403].includes((e as { statusCode?: number }).statusCode || 0)) statuses.value = []
    }
  } finally {
    if (!disposed && current === generation) loading.value = false
  }
}
// Each status read is access-logged per athlete, so it refreshes only on request.
onMounted(loadStatus)
// Separate counts per record type; they overlap in meaning and are never summed.
const counts = ref<{ record?: number; planning?: number } & Partial<Record<FollowUpQueue, number>>>(
  {},
)
const followUpQueue = ref<FollowUpQueue>('reviews')
const strip = computed(() => [
  {
    key: 'record',
    target: 'desk-record',
    label: l('To record', 'للتسجيل'),
    value: counts.value.record,
  },
  {
    key: 'planning',
    target: 'desk-planning',
    label: l('Need scheduling', 'تحتاج إلى جدولة'),
    value: counts.value.planning,
  },
  {
    key: 'reviews',
    target: 'follow-up',
    label: l('To review', 'للمراجعة'),
    value: counts.value.reviews,
  },
  {
    key: 'missed',
    target: 'follow-up',
    label: l('Missed sessions', 'جلسات فائتة'),
    value: counts.value.missed,
  },
  {
    key: 'outcomes',
    target: 'follow-up',
    label: l('Outcomes needed', 'نتائج مطلوبة'),
    value: counts.value.outcomes,
  },
  {
    key: 'unplanned',
    target: 'follow-up',
    label: l('Without a plan', 'بلا خطة'),
    value: counts.value.unplanned,
  },
  {
    key: 'restricted',
    target: 'desk-status',
    label: l('Shared restrictions', 'قيود مشتركة'),
    value: loading.value || error.value ? undefined : statuses.value.length,
  },
])
async function jump(key: string, target: string) {
  if (['reviews', 'missed', 'outcomes', 'unplanned'].includes(key))
    followUpQueue.value = key as FollowUpQueue
  await nextTick()
  const element = document.getElementById(target)
  element?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  element?.focus({ preventScroll: true })
}
onUnmounted(() => {
  disposed = true
  generation++
})
</script>
<template>
  <div class="coach-desk">
    <CommandStatus :command="previousDashboard" />
    <CommandStatus :command="previousToday" />
    <nav :aria-label="l('Needs your attention', 'يحتاج إلى انتباهك')">
      <ul class="attention-strip">
        <li v-for="item in strip" :key="item.key">
          <a
            :href="'#' + item.target"
            :data-zero="item.value === 0"
            @click.prevent="jump(item.key, item.target)"
            ><strong>{{ item.value ?? '–' }}</strong
            ><span>{{ item.label }}</span></a
          >
        </li>
      </ul>
    </nav>
    <div class="desk-columns">
      <section class="desk-today panel" aria-labelledby="desk-today-title">
        <header class="desk-section-heading">
          <div>
            <p class="overline">
              {{ localDate(zone) }} · <bdi>{{ zone }}</bdi>
            </p>
            <h2 id="desk-today-title">
              <PhCalendarBlank :size="24" aria-hidden="true" />{{ l('Today’s work', 'عمل اليوم') }}
            </h2>
          </div>
          <RouterLink to="/schedule" class="text-link">{{
            l('Open schedule', 'فتح الجدول')
          }}</RouterLink>
        </header>
        <div id="desk-record" tabindex="-1" class="desk-anchor">
          <WorkoutAgenda
            queue="actionable"
            command-scope="recording"
            compact
            :refresh-token="revision + actionableRevision"
            :limit="10"
            :heading-level="3"
            @changed="planningRevision++"
            @loaded="counts.record = $event"
          />
        </div>
        <UpcomingSessions
          :key="'events:' + revision"
          today-only
          omit-workouts
          hide-link
          :heading-level="3"
        />
      </section>
      <aside
        id="desk-status"
        tabindex="-1"
        class="desk-status panel"
        aria-labelledby="desk-status-title"
      >
        <header class="desk-section-heading">
          <h2 id="desk-status-title">
            <PhHeartbeat :size="22" aria-hidden="true" />{{ l('Athlete health', 'صحة الرياضي') }}
          </h2>
          <button
            class="button small secondary icon-only"
            :disabled="loading"
            :aria-label="l('Refresh athlete health', 'تحديث صحة الرياضي')"
            :title="l('Refresh athlete health', 'تحديث صحة الرياضي')"
            @click="loadStatus"
          >
            <PhArrowClockwise :size="18" aria-hidden="true" />
          </button>
        </header>
        <p v-if="loading && !statuses.length" class="small-print" role="status">
          {{ l('Checking shared status…', 'جارٍ التحقق من الحالة المشتركة…') }}
        </p>
        <p v-if="error" class="notice error" role="alert">
          {{ error }}
          <button class="text-link" @click="loadStatus">{{ l('Retry', 'إعادة المحاولة') }}</button>
        </p>
        <ul
          v-if="statuses.length"
          class="desk-status-list"
          tabindex="0"
          :aria-label="l('Shared participation restrictions', 'قيود المشاركة المشتركة')"
        >
          <li v-for="item in statuses" :key="item.id">
            <strong dir="auto">{{ item.athlete_name }}</strong>
            <span
              class="tag"
              :data-status="item.participation === 'unavailable' ? 'unavailable' : 'paused'"
              >{{
                item.participation === 'unavailable'
                  ? l('Unavailable', 'غير متاح')
                  : l('Modified participation', 'مشاركة معدلة')
              }}</span
            >
            <small
              >{{ l('Effective', 'سارية منذ') }}
              {{ dateLabel(item.effective_from.slice(0, 10)) }}</small
            >
          </li>
        </ul>
        <p v-else-if="!loading && !error" class="small-print">
          {{ l('No restrictions shared with you.', 'لا توجد قيود مشتركة معك.') }}
        </p>
        <p class="desk-status-boundary small-print">
          <PhInfo :size="16" aria-hidden="true" />{{
            l(
              'No shared status means unknown, not cleared to train. Confirm with the athlete before recording.',
              'عدم مشاركة حالة يعني أنها غير معروفة، وليس تصريحاً بالتدريب. أكد مع الرياضي قبل التسجيل.',
            )
          }}
        </p>
        <RouterLink to="/injuries" class="text-link">{{
          l('View athlete health', 'عرض صحة الرياضي')
        }}</RouterLink>
      </aside>
    </div>
    <section
      id="desk-planning"
      tabindex="-1"
      class="desk-planning desk-anchor"
      :aria-label="l('Planning', 'التخطيط')"
    >
      <WorkoutAgenda
        queue="planning"
        compact
        hide-empty
        :refresh-token="revision + planningRevision"
        :limit="10"
        @changed="actionableRevision++"
        @loaded="counts.planning = $event"
      />
    </section>
    <FollowUpPanel
      v-model:queue="followUpQueue"
      :refresh-token="revision + actionableRevision"
      @counts="counts = { ...counts, ...$event }"
    />
  </div>
</template>
<style scoped>
.coach-desk {
  display: grid;
  gap: var(--space-8);
}
.desk-columns {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
  gap: var(--space-6);
  align-items: start;
}
.desk-today,
.desk-status {
  min-width: 0;
}
.desk-status {
  margin: 0;
  position: sticky;
  top: var(--space-5);
}
.desk-section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
}
.desk-section-heading h2 {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  font-size: var(--text-section);
}
.desk-section-heading .overline {
  margin-block: 0 var(--space-2);
}
/* Today's work is one card: a header, then each queue as its own bordered list. */
.desk-today {
  display: grid;
  gap: var(--space-6);
  margin: 0;
}
.desk-today > .desk-section-heading {
  align-items: flex-end;
  padding-block-end: var(--space-4);
  border-block-end: 1px solid var(--line);
}
.desk-today :deep(.workout-agenda),
.desk-today :deep(.organization-upcoming) {
  margin: 0;
}
.desk-today :deep(.organization-upcoming h3) {
  font-size: var(--text-panel);
  margin: 0;
}
.desk-planning :deep(.workout-agenda) {
  margin: 0;
  padding: var(--space-6);
  border: 1px solid var(--line);
  border-radius: var(--radius-panel);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}
.desk-status h2 {
  font-size: var(--text-panel);
}
.desk-status > .small-print {
  margin-block: var(--space-3);
}
.desk-status-list {
  list-style: none;
  padding: 0;
  margin-block: var(--space-4);
  display: grid;
  gap: var(--space-4);
  max-height: 360px;
  overflow: auto;
}
.desk-status-list li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  padding-block-end: var(--space-3);
  border-block-end: 1px solid var(--line);
}
.desk-status-list strong,
.desk-status-list small {
  flex-basis: 100%;
  overflow-wrap: anywhere;
}
.desk-status-list .tag {
  width: fit-content;
}
.desk-status-boundary {
  display: flex;
  gap: var(--space-2);
  align-items: flex-start;
  padding-block-start: var(--space-3);
  border-block-start: 1px solid var(--line);
}
.desk-status-boundary svg {
  flex: 0 0 auto;
  margin-block-start: 3px;
}
.desk-anchor:focus,
.desk-status:focus {
  outline: none;
}
.coach-desk > nav {
  min-width: 0;
}
.attention-strip {
  margin: 0;
}
@media (max-width: 520px) {
  .desk-today,
  .desk-planning :deep(.workout-agenda) {
    padding: var(--space-4);
  }
}
@media (max-width: 1050px) {
  .desk-columns {
    grid-template-columns: minmax(0, 1fr);
  }
  .desk-status {
    position: static;
  }
}
</style>
