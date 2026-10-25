<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { WorkoutAgenda, WorkoutAgendaItem } from '@rafik/shared/contracts'
import { institutionContext } from '../../app/institution'
import { profile } from '../../app/auth'
import { request } from '../../lib/backend'
import { language as l, locale, errorMessage } from '../../lib/i18n'
import { localDate } from '../../lib/dates'
import { useCommand } from '../../lib/commands'
import PageState from '../../components/PageState.vue'
import EmptyState from '../../components/EmptyState.vue'
import ListPagination from '../../components/ListPagination.vue'
import TimezonePicker from '../../components/TimezonePicker.vue'
import CommandStatus from '../../components/CommandStatus.vue'

const props = withDefaults(defineProps<{ assignment?: string; due?: boolean; limit?: number }>(), {
  due: false,
  limit: 10,
})
const context = institutionContext(),
  route = useRoute(),
  router = useRouter()
const data = ref<WorkoutAgenda>(),
  loading = ref(true),
  error = ref(''),
  offset = ref(0)
const selected = ref<WorkoutAgendaItem>(),
  action = ref<'schedule-workout' | 'reschedule-workout' | 'skip-workout'>('schedule-workout')
const timezone = ref(profile.value?.timezone || 'UTC'),
  local = ref(''),
  minutes = ref(60),
  reason = ref('')
let disposed = false,
  generation = 0
onUnmounted(() => {
  disposed = true
  generation++
})
async function load() {
  const seq = ++generation
  loading.value = true
  error.value = ''
  try {
    const query = new URLSearchParams({
      view: context.view,
      limit: String(props.limit),
      offset: String(offset.value),
    })
    if (props.assignment) query.set('assignment', props.assignment)
    if (props.due) query.set('due', 'true')
    const result = await request<WorkoutAgenda>(`/v1/institution/workout-scheduling?${query}`, {
      feedback: 'none',
    })
    if (!disposed && generation === seq) data.value = result
  } catch (e) {
    if (!disposed && generation === seq) {
      error.value = errorMessage(e)
      if ([401, 403].includes((e as { statusCode?: number }).statusCode || 0))
        data.value = undefined
    }
  } finally {
    if (!disposed && generation === seq) loading.value = false
  }
}
const started = ref('')
const startedMode = ref('')
const preparing = ref(false)
const command = useCommand(
  `workout-agenda:${context.institution}:${props.assignment || (props.due ? 'due' : 'all')}`,
  async (name, result) => {
    if (name === 'start') {
      started.value = (result as { id: string }).id
      startedMode.value = (result as { recorded_mode: string }).recorded_mode
    }
    if (!disposed) {
      selected.value = undefined
      await load()
    }
  },
  (name, args) =>
    request(`/v1/institution/${name === 'start' ? 'sessions' : 'workout-scheduling'}`, {
      method: 'POST',
      body: JSON.stringify(args),
    }),
  {
    successMessage: (name) =>
      name === 'start'
        ? false
        : name === 'skip-workout'
          ? l(
              'Workout skipped. The next workout is available for scheduling.',
              'تم تخطي التمرين. التمرين التالي متاح للجدولة.',
            )
          : l('Workout scheduled.', 'تمت جدولة التمرين.'),
  },
)
const locked = computed(
  () => preparing.value || !command.state.ready || command.state.busy || !!command.state.pending,
)
function edit(item: WorkoutAgendaItem, next: typeof action.value) {
  selected.value = item
  action.value = next
  reason.value = ''
  timezone.value = item.occurrence?.timezone || profile.value?.timezone || 'UTC'
  const instant = item.occurrence ? new Date(item.occurrence.starts_at) : new Date()
  local.value =
    localDate(timezone.value, instant) +
    'T' +
    (item.occurrence
      ? new Intl.DateTimeFormat('en-GB', {
          timeZone: timezone.value,
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
        }).format(instant)
      : '09:00')
  minutes.value = item.occurrence
    ? Math.round(
        (Date.parse(item.occurrence.ends_at) - Date.parse(item.occurrence.starts_at)) / 60000,
      )
    : 60
}
function changePage(value: number) {
  offset.value = value
  void load()
}
async function submit() {
  const item = selected.value
  if (!item || locked.value) return
  preparing.value = true
  error.value = ''
  try {
    let slot = {}
    if (action.value !== 'skip-workout') {
      const times = await request<{ starts_at: string; ends_at: string }[]>(
        '/v1/institution/calendar-preview',
        {
          method: 'POST',
          body: JSON.stringify({
            view: context.view,
            local: local.value,
            zone: timezone.value,
            minutes: minutes.value,
            count: 1,
            every: 7,
          }),
        },
      )
      slot = { ...times[0], timezone: timezone.value }
    }
    if (disposed) return
    await command.run(action.value, {
      operation: crypto.randomUUID(),
      action: action.value,
      view: context.view,
      assignment_id: item.assignment_id,
      cursor: item.cursor,
      occurrence_id: item.occurrence?.id,
      revision: item.occurrence?.revision,
      reason: reason.value,
      ...slot,
    })
  } catch (e) {
    if (!disposed) error.value = errorMessage(e)
  } finally {
    preparing.value = false
  }
}
async function start(item: WorkoutAgendaItem) {
  const origin = route.fullPath
  started.value = ''
  const id = crypto.randomUUID()
  await command.run('start', {
    operation: id,
    action: 'start',
    view: context.view,
    id,
    assignment_id: item.assignment_id,
    occurrence_id: item.occurrence!.id,
    day_id: item.day!.id,
  })
  if (started.value && !disposed && route.fullPath === origin && !command.state.pending)
    await router.push(
      context.view === 'trainee'
        ? `/workout/${started.value}?institution=${context.institution}`
        : startedMode.value === 'delegated'
          ? `/record/${started.value}`
          : `/review/${started.value}`,
    )
}
function sessionLink(item: WorkoutAgendaItem) {
  if (item.state === 'paused' && context.view !== 'trainee') return `/review/${item.session!.id}`
  return context.view === 'trainee'
    ? `/workout/${item.session!.id}?institution=${context.institution}`
    : item.session!.recorded_mode === 'delegated' && context.view === 'trainer'
      ? `/record/${item.session!.id}`
      : `/review/${item.session!.id}`
}
const states: Record<WorkoutAgendaItem['state'], [string, string]> = {
  unscheduled: ['Awaiting schedule', 'بانتظار الجدولة'],
  scheduled: ['Scheduled', 'مجدول'],
  ready: ['Ready to start', 'جاهز للبدء'],
  overdue: ['Overdue · still actionable', 'متأخر · متاح للبدء'],
  in_progress: ['In progress', 'قيد التنفيذ'],
  paused: ['Paused · staff action needed', 'متوقف مؤقتاً · يتطلب إجراء من الطاقم'],
}
const blockedLabel = (item: WorkoutAgendaItem) =>
  item.blocked === 'participation_unavailable'
    ? l(
        'Training is currently restricted. Contact your coach.',
        'المشاركة في التدريب مقيدة حالياً. تواصل مع مدربك.',
      )
    : item.blocked === 'assignment_unavailable'
      ? l(
          'This plan is outside its active dates or has ended.',
          'الخطة خارج تواريخها النشطة أو انتهت.',
        )
      : l('This plan has no workout days.', 'لا تتضمن هذه الخطة أيام تدريب.')
const when = (item: WorkoutAgendaItem) =>
  new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar-AE' : 'en-GB', {
    timeZone: item.occurrence!.timezone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(item.occurrence!.starts_at))
watch(
  () => props.assignment,
  () => {
    offset.value = 0
    selected.value = undefined
    void load()
  },
)
onMounted(load)
</script>
<template>
  <section class="workout-agenda" :aria-label="l('Next workouts', 'التمارين التالية')">
    <header class="agenda-heading">
      <div>
        <h2>
          {{
            due ? l('Today and overdue', 'اليوم والمتأخر') : l('Next workouts', 'التمارين التالية')
          }}
        </h2>
        <p>
          {{
            l(
              'Each plan progresses independently. Unfinished work stays here until completed or explicitly skipped.',
              'تتقدم كل خطة بشكل مستقل. يبقى التمرين غير المنجز هنا حتى إتمامه أو تخطيه صراحةً.',
            )
          }}
        </p>
      </div>
      <RouterLink v-if="due" class="text-link" to="/training">{{
        l('Athlete plans', 'خطط الرياضيين')
      }}</RouterLink>
      <button class="button small secondary" :disabled="loading || locked" @click="load">
        {{ l('Refresh workouts', 'تحديث التمارين') }}
      </button>
    </header>
    <CommandStatus :command="command" />
    <p v-if="error && data" class="notice error" role="alert">{{ error }}</p>
    <PageState :loading="loading && !data" :error="!data ? error : ''" @retry="load">
      <template v-if="data">
        <EmptyState
          v-if="!data.items.length"
          compact
          :title="
            due
              ? l('No workouts due.', 'لا توجد تمارين مستحقة.')
              : l('No active workouts yet.', 'لا توجد تمارين نشطة بعد.')
          "
          :description="
            l(
              'Scheduled workouts appear here. Ask your coach about plans and training times.',
              'تظهر التمارين المجدولة هنا. اسأل مدربك عن الخطط وأوقات التدريب.',
            )
          "
        />
        <ul v-else class="agenda-list">
          <li v-for="item in data.items" :key="item.assignment_id" class="agenda-row">
            <div class="agenda-copy">
              <p v-if="context.view !== 'trainee' && !assignment" class="overline">
                <bdi dir="auto">{{ item.member_name }}</bdi>
              </p>
              <h3>
                <bdi dir="auto">{{
                  assignment
                    ? locale === 'ar'
                      ? item.day?.nameAr || item.day?.name
                      : item.day?.name
                    : item.title
                }}</bdi>
              </h3>
              <p v-if="!assignment">
                <bdi dir="auto">{{
                  locale === 'ar' ? item.day?.nameAr || item.day?.name : item.day?.name
                }}</bdi
                ><span v-if="item.goal">
                  · <bdi dir="auto">{{ item.goal }}</bdi></span
                >
              </p>
              <span class="tag">{{ l(...states[item.state]) }}</span>
              <p v-if="item.occurrence">
                {{ when(item) }} · <bdi>{{ item.occurrence.timezone }}</bdi>
              </p>
              <p v-if="item.blocked" class="small-print">{{ blockedLabel(item) }}</p>
              <p v-else-if="item.state === 'scheduled'" class="small-print">
                {{
                  l(
                    'Recording opens at the scheduled start time.',
                    'يفتح التسجيل عند موعد البدء المحدد.',
                  )
                }}
              </p>
              <p
                v-else-if="item.state === 'unscheduled' && context.view === 'trainee'"
                class="small-print"
              >
                {{
                  l(
                    'Your coach needs to schedule this workout before you can start.',
                    'يحتاج مدربك إلى جدولة هذا التمرين قبل أن تبدأ.',
                  )
                }}
              </p>
            </div>
            <div class="agenda-actions">
              <RouterLink
                v-if="item.session && (item.state !== 'paused' || context.view !== 'trainee')"
                class="button small secondary"
                :to="sessionLink(item)"
                >{{
                  item.state === 'paused' ||
                  (context.view !== 'trainee' && item.session.recorded_mode !== 'delegated')
                    ? l('View workout', 'عرض التمرين')
                    : l('Resume workout', 'متابعة التمرين')
                }}</RouterLink
              ><button
                v-if="item.can_start"
                class="button small"
                :disabled="locked"
                @click="start(item)"
              >
                {{ l('Start workout', 'بدء التمرين') }}</button
              ><button
                v-if="item.can_schedule"
                class="button small secondary"
                :disabled="locked"
                @click="edit(item, 'schedule-workout')"
              >
                {{ l('Schedule workout', 'جدولة التمرين') }}</button
              ><template
                v-if="
                  context.view !== 'trainee' &&
                  item.occurrence &&
                  ['scheduled', 'ready', 'overdue', 'paused', 'in_progress'].includes(item.state)
                "
                ><button
                  v-if="!item.session && !item.blocked && item.state !== 'paused'"
                  class="button small secondary"
                  :disabled="locked"
                  @click="edit(item, 'reschedule-workout')"
                >
                  {{ l('Reschedule', 'إعادة الجدولة') }}</button
                ><button class="text-link" :disabled="locked" @click="edit(item, 'skip-workout')">
                  {{ l('Skip with reason', 'تخطي مع ذكر السبب') }}
                </button></template
              >
            </div>
            <form
              v-if="selected?.assignment_id === item.assignment_id"
              class="agenda-form"
              @submit.prevent="submit"
            >
              <h3>
                {{
                  action === 'skip-workout'
                    ? l('Skip this workout', 'تخطي هذا التمرين')
                    : l('Schedule the next workout', 'جدولة التمرين التالي')
                }}
              </h3>
              <template v-if="action !== 'skip-workout'"
                ><label
                  >{{ l('Date and time', 'التاريخ والوقت')
                  }}<input
                    v-model="local"
                    type="datetime-local"
                    required
                    :disabled="locked" /></label
                ><TimezonePicker
                  v-model="timezone"
                  :label="l('Timezone', 'المنطقة الزمنية')"
                  :disabled="locked" /><label
                  >{{ l('Duration (minutes)', 'المدة (دقائق)')
                  }}<input
                    v-model="minutes"
                    type="number"
                    min="1"
                    max="480"
                    required
                    :disabled="locked" /></label
              ></template>
              <label v-else
                >{{ l('Reason for skipping', 'سبب التخطي')
                }}<textarea v-model="reason" required maxlength="2000" :disabled="locked" />
              </label>
              <div class="actions">
                <button class="button small" :disabled="locked">
                  {{
                    action === 'skip-workout'
                      ? l('Skip workout', 'تخطي التمرين')
                      : l('Save schedule', 'حفظ الموعد')
                  }}</button
                ><button
                  type="button"
                  class="button small secondary"
                  :disabled="locked"
                  @click="selected = undefined"
                >
                  {{ l('Cancel', 'إلغاء') }}
                </button>
              </div>
            </form>
          </li>
        </ul>
        <ListPagination
          v-if="data.total > limit || offset > 0"
          :offset="offset"
          :page-size="limit"
          :total="data.total"
          :disabled="loading || locked"
          @page="changePage"
        />
      </template>
    </PageState>
  </section>
</template>
<style scoped>
.workout-agenda {
  margin-block: var(--space-6);
}
.agenda-heading,
.agenda-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
  flex-wrap: wrap;
}
.agenda-heading > div,
.agenda-copy {
  min-width: 0;
  flex: 1 1 240px;
  overflow-wrap: anywhere;
}
.agenda-heading p,
.agenda-copy p {
  color: var(--muted);
  margin-block: var(--space-2);
}
.agenda-heading h2,
.agenda-copy h3 {
  margin: 0;
}
.agenda-list {
  list-style: none;
  padding: 0;
}
.agenda-row {
  padding-block: var(--space-5);
  border-block-end: 1px solid var(--line);
}
.agenda-actions {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  flex-wrap: wrap;
}
.agenda-form {
  flex-basis: 100%;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  gap: var(--space-4);
  padding-block: var(--space-4);
}
.agenda-form h3,
.agenda-form .actions {
  grid-column: 1 / -1;
}
@media (max-width: 600px) {
  .agenda-actions {
    width: 100%;
  }
}
</style>
