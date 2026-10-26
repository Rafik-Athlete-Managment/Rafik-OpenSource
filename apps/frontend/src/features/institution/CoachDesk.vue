<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { PhCalendarBlank, PhHeartbeat, PhArrowClockwise } from '@phosphor-icons/vue'
import { request } from '../../lib/backend'
import { language as l, dateLabel, errorMessage } from '../../lib/i18n'
import { institutionContext } from '../../app/institution'
import { useCommand } from '../../lib/commands'
import CommandStatus from '../../components/CommandStatus.vue'
import { profile } from '../../app/auth'
import { localDate } from '../../lib/dates'
import WorkoutAgenda from './WorkoutAgenda.vue'
import UpcomingSessions from './UpcomingSessions.vue'
import FollowUpPanel from './FollowUpPanel.vue'
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
onMounted(loadStatus)
onUnmounted(() => {
  disposed = true
  generation++
})
</script>
<template>
  <div class="coach-desk">
    <CommandStatus :command="previousDashboard" />
    <CommandStatus :command="previousToday" />
    <div class="desk-columns">
      <section class="desk-today" aria-labelledby="desk-today-title">
        <header class="desk-section-heading">
          <div>
            <p class="overline">
              {{ localDate(zone) }} · <bdi>{{ zone }}</bdi>
            </p>
            <h2 id="desk-today-title">
              <PhCalendarBlank :size="24" aria-hidden="true" />{{ l('Today’s work', 'عمل اليوم') }}
            </h2>
          </div>
          <RouterLink to="/schedule" class="button small secondary">{{
            l('Open schedule', 'فتح الجدول')
          }}</RouterLink>
        </header>
        <WorkoutAgenda
          queue="actionable"
          command-scope="recording"
          :refresh-token="revision + actionableRevision"
          :limit="4"
          :heading-level="3"
          @changed="planningRevision++"
        />
        <UpcomingSessions :key="'events:' + revision" today-only omit-workouts :heading-level="3" />
      </section>
      <aside class="desk-status panel" aria-labelledby="desk-status-title">
        <header class="desk-section-heading">
          <h2 id="desk-status-title">
            <PhHeartbeat :size="24" aria-hidden="true" />{{ l('Athlete status', 'حالة الرياضيين') }}
          </h2>
          <button
            class="button small secondary"
            :disabled="loading"
            @click="loadStatus"
            :aria-label="l('Refresh athlete status', 'تحديث حالة الرياضيين')"
          >
            <PhArrowClockwise :size="18" aria-hidden="true" />
          </button>
        </header>
        <p class="small-print">
          {{
            l(
              'Shared participation restrictions from your primary roster. No clinical details.',
              'قيود المشاركة المشتركة من قائمتك الأساسية. دون تفاصيل طبية.',
            )
          }}
        </p>
        <p v-if="loading" class="small-print" role="status">
          {{ l('Checking shared status…', 'جارٍ التحقق من الحالة المشتركة…') }}
        </p>
        <p v-if="error" class="notice error" role="alert">{{ error }}</p>
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
            <small>{{ l('Effective', 'سارية منذ') }} {{ dateLabel(item.effective_from) }}</small>
          </li>
        </ul>
        <p v-else-if="!loading && !error" class="small-print">
          {{ l('No active shared restrictions returned.', 'لم تُرجع الخدمة قيوداً نشطة مشتركة.') }}
        </p>
        <p class="desk-status-boundary small-print">
          {{
            l(
              'No shared status means unknown, not cleared to train. Confirm participation with the athlete before recording.',
              'عدم مشاركة حالة يعني أنها غير معروفة، وليس تصريحاً بالتدريب. أكد المشاركة مع الرياضي قبل التسجيل.',
            )
          }}
        </p>
        <RouterLink to="/injuries" class="text-link">{{
          l('View participation status', 'عرض حالة المشاركة')
        }}</RouterLink>
      </aside>
    </div>
    <section class="desk-planning" :aria-label="l('Planning', 'التخطيط')">
      <WorkoutAgenda
        queue="planning"
        :refresh-token="revision + planningRevision"
        :limit="4"
        hide-empty
        @changed="actionableRevision++"
      />
    </section>
    <FollowUpPanel compact />
  </div>
</template>
<style scoped>
.coach-desk {
  display: grid;
  gap: var(--space-6);
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
.desk-status h2 {
  font-size: var(--text-panel);
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
  padding-block-start: var(--space-4);
  border-block-start: 1px solid var(--line);
}
.desk-planning :deep(.workout-agenda) {
  margin-block: 0;
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
