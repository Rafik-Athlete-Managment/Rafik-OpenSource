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
import {
  PhBarbell,
  PhPlay,
  PhClockCounterClockwise,
  PhArrowClockwise,
  PhCalendarBlank,
} from '@phosphor-icons/vue'
import SidePanel from '../../components/SidePanel.vue'
import OverflowMenu, { type OverflowItem } from '../../components/OverflowMenu.vue'
import { useFocusRefresh } from '../../lib/focus-refresh'
import ProgramCover from '../coaching/ProgramCover.vue'

const props = withDefaults(
  defineProps<{
    assignment?: string
    due?: boolean
    limit?: number
    pageHeading?: boolean
    queue?: 'recording' | 'today' | 'planning' | 'actionable'
    commandScope?: string
    refreshToken?: number
    hideEmpty?: boolean
    headingLevel?: number
    /** Dense staff rows with one primary action and a menu for the rest. */
    compact?: boolean
  }>(),
  {
    due: false,
    compact: false,
    limit: 10,
    pageHeading: false,
  },
)
const emit = defineEmits<{ changed: []; loaded: [total: number] }>()
watch(
  () => props.refreshToken,
  () => {
    void load()
  },
)
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
    if (props.queue) query.set('queue', props.queue)
    const result = await request<WorkoutAgenda>(`/v1/institution/workout-scheduling?${query}`, {
      feedback: 'none',
    })
    if (!disposed && generation === seq) {
      if (props.queue && result.queue !== props.queue) {
        data.value = undefined
        error.value = l(
          'The backend does not confirm this workout queue. Update and restart the backend, then retry.',
          'الخادم لا يؤكد قائمة التمارين المطلوبة. حدّث الخادم وأعد تشغيله ثم حاول مجدداً.',
        )
        return
      }
      data.value = result
      emit('loaded', result.total)
    }
  } catch (e) {
    if (!disposed && generation === seq) {
      error.value = errorMessage(e)
      if (
        props.queue === 'actionable' &&
        (e as { statusCode?: number }).statusCode === 400 &&
        (e as Error).message === 'invalid_request'
      ) {
        data.value = undefined
        error.value = l(
          'Update and restart the backend to load the current workout queues, then retry.',
          'حدّث الخادم وأعد تشغيله لتحميل قوائم التمارين الحالية ثم حاول مجدداً.',
        )
      }
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
  `workout-agenda:${context.institution}:${props.assignment || props.commandScope || props.queue || (props.due ? 'due' : 'all')}`,
  async (name, result) => {
    if (name === 'start') {
      started.value = (result as { id: string }).id
      startedMode.value = (result as { recorded_mode: string }).recorded_mode
    }
    if (!disposed) {
      selected.value = undefined
      await load()
      if (!disposed) emit('changed')
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
let lastEdited = ''
const returnFocus = () =>
  document.querySelector<HTMLElement>(`[data-row-id="${lastEdited}"] .overflow-trigger`) ||
  document.querySelector<HTMLElement>(
    `[data-row-id="${lastEdited}"] :is(.agenda-actions, .record-actions) button`,
  )
function edit(item: WorkoutAgendaItem, next: typeof action.value) {
  lastEdited = item.assignment_id
  selected.value = item
  action.value = next
  reason.value = ''
  timezone.value = item.occurrence?.timezone || profile.value?.timezone || 'UTC'
  const instant = item.occurrence?.starts_at ? new Date(item.occurrence.starts_at) : new Date()
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
  minutes.value =
    item.occurrence?.starts_at && item.occurrence.ends_at
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
    : item.session!.can_record && context.view === 'trainer'
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
  !item.occurrence?.starts_at
    ? item.occurrence?.training_date + ' · ' + l('No fixed time', 'دون وقت محدد')
    : new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar-AE' : 'en-GB', {
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
useFocusRefresh(() => {
  if (!selected.value && !locked.value) return load()
})
const panelOpen = computed({
  get: () => !!selected.value,
  set: (open) => {
    if (!open && !locked.value) selected.value = undefined
  },
})
const dayName = (item: WorkoutAgendaItem) =>
  (locale.value === 'ar' ? item.day?.nameAr || item.day?.name : item.day?.name) ||
  l('Workout', 'تمرين')
const canChange = (item: WorkoutAgendaItem) =>
  context.view !== 'trainee' &&
  !!item.occurrence &&
  ['scheduled', 'ready', 'overdue', 'paused', 'in_progress'].includes(item.state)
function rowMenu(item: WorkoutAgendaItem): OverflowItem[] {
  return [
    ...(context.view !== 'trainee' && !props.assignment
      ? [{ key: 'plan', label: l('View plan', 'عرض الخطة'), to: '/training/' + item.assignment_id }]
      : []),
    ...(canChange(item) && !item.session && !item.blocked && item.state !== 'paused'
      ? [{ key: 'reschedule', label: l('Reschedule', 'إعادة الجدولة'), disabled: locked.value }]
      : []),
    ...(canChange(item)
      ? [{ key: 'skip', label: l('Skip with reason', 'تخطي مع ذكر السبب'), disabled: locked.value }]
      : []),
  ]
}
function menuSelect(item: WorkoutAgendaItem, key: string) {
  if (key === 'reschedule') edit(item, 'reschedule-workout')
  if (key === 'skip') edit(item, 'skip-workout')
}
const muscleNames: Record<string, [string, string]> = {
  quadriceps: ['Quadriceps', 'عضلات الفخذ الأمامية'],
  hamstrings: ['Hamstrings', 'عضلات الفخذ الخلفية'],
  glutes: ['Glutes', 'عضلات الأرداف'],
  lats: ['Lats', 'عضلات الظهر العريضة'],
  pectorals: ['Chest', 'عضلات الصدر'],
  abdominals: ['Abdominals', 'عضلات البطن'],
  deltoids: ['Shoulders', 'عضلات الكتف'],
  biceps: ['Biceps', 'العضلة ذات الرأسين'],
  triceps: ['Triceps', 'العضلة ثلاثية الرؤوس'],
  calves: ['Calves', 'عضلات الساق'],
  trapezius: ['Trapezius', 'العضلة شبه المنحرفة'],
  core: ['Core', 'عضلات الجذع'],
}
const muscleName = (name: string) => (muscleNames[name] ? l(...muscleNames[name]!) : name)
</script>
<template>
  <section
    v-if="!hideEmpty || loading || error || (data?.total || 0) > 0"
    class="workout-agenda"
    :class="{
      'athlete-workout-preview': pageHeading,
      'staff-workout-cards': !pageHeading && !compact,
      'is-compact': compact,
    }"
    :aria-label="
      queue === 'actionable'
        ? l('Workouts to record', 'تمارين للتسجيل')
        : queue === 'recording'
          ? l('Continue recording', 'متابعة التسجيل')
          : queue === 'today'
            ? l('Due workouts', 'التمارين المستحقة')
            : queue === 'planning'
              ? l('Needs scheduling', 'تحتاج إلى جدولة')
              : l('Next workouts', 'التمارين التالية')
    "
  >
    <header class="agenda-heading">
      <div>
        <component :is="pageHeading ? 'h1' : headingLevel === 3 ? 'h3' : 'h2'">
          {{
            queue === 'actionable'
              ? l('Workouts to record', 'تمارين للتسجيل')
              : queue === 'recording'
                ? l('Continue recording', 'متابعة التسجيل')
                : queue === 'today'
                  ? l('Due workouts', 'التمارين المستحقة')
                  : queue === 'planning'
                    ? l('Needs scheduling', 'تحتاج إلى جدولة')
                    : pageHeading
                      ? l('Your workouts', 'تمارينك')
                      : due
                        ? context.view === 'trainee'
                          ? l('Your workouts', 'تمارينك')
                          : l('Workouts to manage', 'تمارين تحتاج إلى إجراء')
                        : l('Next workouts', 'التمارين التالية')
          }}
        </component>
        <p v-if="queue === 'actionable'">
          {{
            l(
              'Due workouts and unfinished recordings. Start a scheduled workout or resume its existing record.',
              'التمارين المستحقة والتسجيلات غير المكتملة. ابدأ تمريناً مجدولاً أو تابع سجله الحالي.',
            )
          }}
        </p>
        <p v-else-if="queue === 'planning'">
          {{
            l(
              'Plans with no scheduled workout or unfinished recording. Choose a time before training.',
              'خطط دون تمرين مجدول أو تسجيل غير مكتمل. اختر موعداً قبل التدريب.',
            )
          }}
        </p>
        <p v-else-if="!queue">
          {{
            l(
              'Each plan progresses independently. Unfinished work stays here until completed or explicitly skipped.',
              'تتقدم كل خطة بشكل مستقل. يبقى التمرين غير المنجز هنا حتى إتمامه أو تخطيه صراحةً.',
            )
          }}
        </p>
      </div>
      <div class="agenda-toolbar-actions">
        <RouterLink
          v-if="pageHeading || (due && context.view === 'trainee')"
          class="button secondary"
          to="/workouts"
          ><PhClockCounterClockwise :size="18" aria-hidden="true" />{{
            l('Workout history', 'سجل التمارين')
          }}</RouterLink
        ><RouterLink v-if="due && !queue" class="text-link" to="/training">{{
          context.view === 'trainee'
            ? l('All my workouts', 'كل تماريني')
            : l('Athlete plans', 'خطط الرياضيين')
        }}</RouterLink>
        <button
          v-if="pageHeading || (due && context.view === 'trainee')"
          :class="pageHeading ? 'button' : 'button small secondary'"
          :disabled="loading || locked"
          @click="load"
        >
          <PhArrowClockwise :size="18" aria-hidden="true" />
          {{ l('Refresh workouts', 'تحديث التمارين') }}
        </button>
      </div>
    </header>
    <CommandStatus :command="command" />
    <p v-if="error && data" class="notice error" role="alert">{{ error }}</p>
    <PageState :loading="loading && !data" :error="!data ? error : ''" @retry="load">
      <template v-if="data">
        <p v-if="queue && !data.items.length" class="small-print">
          {{ l('Nothing in this queue right now.', 'لا يوجد شيء في هذه القائمة حالياً.') }}
        </p>
        <EmptyState
          v-else-if="!data.items.length"
          compact
          :title="
            due
              ? l(
                  queue === 'today'
                    ? 'No workouts due. Check today’s events below.'
                    : 'No workouts need action.',
                  queue === 'today'
                    ? 'لا توجد تمارين مستحقة. راجع مواعيد اليوم أدناه.'
                    : 'لا توجد تمارين تحتاج إلى إجراء.',
                )
              : l('No active workouts yet.', 'لا توجد تمارين نشطة بعد.')
          "
          :description="
            l(
              'Scheduled workouts appear here. Ask your coach about plans and training times.',
              'تظهر التمارين المجدولة هنا. اسأل مدربك عن الخطط وأوقات التدريب.',
            )
          "
        />
        <ul v-else-if="compact" class="record-list agenda-compact">
          <li
            v-for="item in data.items"
            :key="item.assignment_id"
            class="record-row"
            :data-row-id="item.assignment_id"
          >
            <div class="record-title">
              <small class="agenda-when"
                ><PhCalendarBlank :size="14" aria-hidden="true" />{{
                  item.occurrence
                    ? when(item) + ' · ' + item.occurrence.timezone
                    : l('Not scheduled yet', 'لم يُجدول بعد')
                }}</small
              >
              <component :is="headingLevel === 3 ? 'h4' : 'h3'" class="agenda-compact-name">
                <bdi dir="auto">{{ item.member_name }}</bdi>
              </component>
              <small
                ><bdi dir="auto">{{ dayName(item) }}</bdi> · <bdi dir="auto">{{ item.title }}</bdi
                ><template v-if="item.goal">
                  · <bdi dir="auto">{{ item.goal }}</bdi></template
                ></small
              >
            </div>
            <div class="record-meta">
              <span class="tag" :data-status="item.state">{{ l(...states[item.state]) }}</span>
              <small v-if="item.preview"
                >{{
                  item.preview.minutes
                    ? item.preview.minutes + ' ' + l('min', 'دقيقة') + ' · '
                    : ''
                }}{{ item.preview.exercise_count }} {{ l('exercises', 'تمارين') }} ·
                {{ item.preview.prescribed_sets }} {{ l('sets', 'مجموعات') }}</small
              >
              <small v-if="item.blocked">{{ blockedLabel(item) }}</small>
              <small v-else-if="item.state === 'scheduled'">{{
                l(
                  'Recording opens at the scheduled start time.',
                  'يفتح التسجيل عند موعد البدء المحدد.',
                )
              }}</small>
            </div>
            <div class="record-actions">
              <RouterLink
                v-if="item.session"
                class="button small"
                :class="{
                  secondary: item.state === 'paused' || !item.session.can_record,
                }"
                :to="sessionLink(item)"
                ><PhPlay :size="18" aria-hidden="true" />{{
                  item.state === 'paused' || !item.session.can_record
                    ? l('View workout', 'عرض التمرين')
                    : l('Resume', 'متابعة')
                }}</RouterLink
              ><button
                v-else-if="item.can_start"
                class="button small"
                :disabled="locked"
                @click="start(item)"
              >
                <PhPlay :size="18" aria-hidden="true" />{{ l('Start', 'بدء') }}</button
              ><button
                v-else-if="item.can_schedule"
                class="button small secondary"
                :disabled="locked"
                @click="edit(item, 'schedule-workout')"
              >
                {{ l('Schedule', 'جدولة') }}
              </button>
              <OverflowMenu
                v-if="rowMenu(item).length"
                compact
                :label="l('More actions for ', 'إجراءات أخرى لـ ') + item.member_name"
                :items="rowMenu(item)"
                @select="menuSelect(item, $event)"
              />
            </div>
          </li>
        </ul>
        <ul v-else class="agenda-list">
          <li
            v-for="item in data.items"
            :key="item.assignment_id"
            class="agenda-row"
            :data-row-id="item.assignment_id"
          >
            <div v-if="pageHeading" class="workout-preview-art" aria-hidden="true">
              <PhBarbell :size="44" />
              <ProgramCover :id="item.preview?.cover" />
            </div>
            <div class="agenda-copy">
              <p v-if="context.view !== 'trainee' && !assignment" class="overline">
                <bdi dir="auto">{{ item.member_name }}</bdi>
              </p>
              <component :is="pageHeading ? 'h2' : headingLevel === 3 ? 'h4' : 'h3'">
                <bdi dir="auto">{{
                  (locale === 'ar' ? item.day?.nameAr || item.day?.name : item.day?.name) ||
                  l('Workout', 'تمرين')
                }}</bdi>
              </component>
              <p>
                <bdi dir="auto">{{ item.title }}</bdi
                ><span v-if="item.goal">
                  · <bdi dir="auto">{{ item.goal }}</bdi></span
                >
              </p>
              <span class="tag" :data-status="item.state">{{ l(...states[item.state]) }}</span>
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
            <div v-if="item.preview" class="workout-preview-details">
              <dl class="workout-preview-metrics">
                <div v-if="item.preview.minutes">
                  <dt>{{ l('Planned time', 'الوقت المخطط') }}</dt>
                  <dd>{{ item.preview.minutes }} {{ l('min', 'دقيقة') }}</dd>
                </div>
                <div>
                  <dt>{{ l('Exercises', 'التمارين') }}</dt>
                  <dd>{{ item.preview.exercise_count }}</dd>
                </div>
                <div>
                  <dt>{{ l('Prescribed sets', 'المجموعات الموصوفة') }}</dt>
                  <dd>{{ item.preview.prescribed_sets }}</dd>
                </div>
              </dl>
              <div class="workout-preview-sections">
                <section v-if="item.preview.exercises.length">
                  <component :is="pageHeading ? 'h3' : 'h4'">{{
                    l('In this workout', 'في هذا التمرين')
                  }}</component>
                  <ol class="workout-preview-exercises">
                    <li v-for="(exercise, index) in item.preview.exercises" :key="index">
                      <span
                        ><bdi>{{
                          locale === 'ar' ? exercise.name_ar || exercise.name : exercise.name
                        }}</bdi></span
                      ><small>{{ exercise.sets }} {{ l('sets', 'مجموعات') }}</small>
                    </li>
                  </ol>
                  <p
                    v-if="item.preview.exercise_count > 3"
                    class="small-print workout-preview-more-mobile"
                  >
                    + {{ item.preview.exercise_count - 3 }} {{ l('more exercises', 'تمارين أخرى') }}
                  </p>
                  <p
                    v-if="item.preview.exercise_count > item.preview.exercises.length"
                    class="small-print workout-preview-more-desktop"
                  >
                    + {{ item.preview.exercise_count - item.preview.exercises.length }}
                    {{ l('more exercises', 'تمارين أخرى') }}
                  </p>
                </section>
                <section v-if="item.preview.muscle_focus.length">
                  <component :is="pageHeading ? 'h3' : 'h4'">{{
                    l('Muscle focus', 'العضلات المستهدفة')
                  }}</component>
                  <div class="workout-muscles">
                    <span v-for="muscle in item.preview.muscle_focus" :key="muscle" class="tag"
                      ><bdi>{{ muscleName(muscle) }}</bdi></span
                    >
                  </div>
                  <p class="small-print">
                    {{
                      l('From the prescribed exercise metadata.', 'حسب بيانات التمارين الموصوفة.')
                    }}
                  </p>
                </section>
              </div>
            </div>
            <div class="agenda-actions">
              <RouterLink
                v-if="context.view !== 'trainee' && !assignment"
                class="button small secondary"
                :to="'/training/' + item.assignment_id"
                >{{ l('View plan', 'عرض الخطة') }}</RouterLink
              >
              <RouterLink
                v-if="item.session && (item.state !== 'paused' || context.view !== 'trainee')"
                class="button small"
                :to="sessionLink(item)"
                ><PhPlay :size="18" aria-hidden="true" />{{
                  item.state === 'paused' ||
                  (context.view !== 'trainee' && !item.session.can_record)
                    ? l('View workout', 'عرض التمرين')
                    : l('Resume workout', 'متابعة التمرين')
                }}</RouterLink
              ><button
                v-if="item.can_start"
                class="button small"
                :disabled="locked"
                @click="start(item)"
              >
                <PhPlay :size="18" aria-hidden="true" />{{
                  l('Start workout', 'بدء التمرين')
                }}</button
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
          </li>
        </ul>
        <SidePanel
          v-model:open="panelOpen"
          :locked="locked"
          :return-focus="returnFocus"
          :title="
            action === 'skip-workout'
              ? l('Skip this workout', 'تخطي هذا التمرين')
              : l('Schedule the next workout', 'جدولة التمرين التالي')
          "
          :description="
            selected
              ? (context.view !== 'trainee' ? selected.member_name + ' · ' : '') +
                dayName(selected) +
                ' · ' +
                selected.title
              : ''
          "
        >
          <form v-if="selected" class="agenda-form" @submit.prevent="submit">
            <template v-if="action !== 'skip-workout'"
              ><label
                >{{ l('Date and time', 'التاريخ والوقت')
                }}<input v-model="local" type="datetime-local" required :disabled="locked" /></label
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
                class="button small secondary danger-action"
                :disabled="locked"
                @click="selected = undefined"
              >
                {{ l('Cancel', 'إلغاء') }}
              </button>
            </div>
          </form>
          <CommandStatus :command="command" />
          <p v-if="error" class="notice error" role="alert">{{ error }}</p>
        </SidePanel>
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
.is-compact .agenda-heading p {
  max-width: 70ch;
  font-size: var(--text-small);
}
.agenda-compact {
  margin-block-start: var(--space-4);
}
.agenda-compact .record-row {
  grid-template-columns: minmax(180px, 1.1fr) minmax(0, 1fr) auto;
}
.agenda-compact-name {
  margin: 2px 0 0;
  font-size: var(--text-body);
  font-weight: 650;
  overflow-wrap: anywhere;
}
.agenda-when {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}
.agenda-compact .record-meta {
  gap: var(--space-1) var(--space-3);
}
.agenda-compact .record-meta small {
  flex-basis: 100%;
}
@media (max-width: 760px) {
  .agenda-compact .record-row {
    grid-template-columns: minmax(0, 1fr) auto;
  }
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
.agenda-heading h3,
.agenda-copy h3,
.agenda-copy h4,
.agenda-copy h2 {
  margin: 0;
  font-size: var(--text-panel);
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

.agenda-toolbar-actions {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  flex-wrap: wrap;
}
.agenda-toolbar-actions .button,
.agenda-actions .button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}
.athlete-workout-preview {
  margin-block: 0;
}
.athlete-workout-preview .agenda-heading h1 {
  font-size: var(--text-page);
  line-height: 1.2;
  margin: 0;
}
.athlete-workout-preview .agenda-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 360px), 1fr));
  gap: var(--space-5);
  margin-block: var(--space-6);
}
.athlete-workout-preview .agenda-row {
  border: 1px solid var(--line);
  border-radius: var(--radius-panel);
  padding: var(--space-6);
  background: var(--surface);
  align-items: stretch;
  gap: var(--space-5);
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease;
}
.athlete-workout-preview .agenda-row:hover,
.athlete-workout-preview .agenda-row:focus-within {
  border-color: var(--accent);
  box-shadow: 0 6px 22px color-mix(in srgb, var(--accent), transparent 92%);
}
.workout-preview-art {
  flex: 0 0 88px;
  display: grid;
  place-items: center;
  min-height: 112px;
  border-radius: var(--radius-panel);
  color: var(--accent);
  background: linear-gradient(
    140deg,
    var(--surface-soft),
    color-mix(in srgb, var(--accent), transparent 85%)
  );
}
.athlete-workout-preview .agenda-copy {
  flex-basis: 200px;
}
.athlete-workout-preview .agenda-actions {
  flex-basis: 100%;
  justify-content: flex-end;
}
@media (prefers-reduced-motion: reduce) {
  .athlete-workout-preview .agenda-row {
    transition: none;
  }
}
@media (max-width: 480px) {
  .workout-preview-art {
    flex-basis: 100%;
    min-height: 100px;
  }
}

.workout-preview-art {
  position: relative;
  overflow: hidden;
}
.workout-preview-art :deep(.program-cover) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  max-height: none;
  border-radius: inherit;
}
.workout-preview-details {
  flex-basis: 100%;
  min-width: 0;
}
.workout-preview-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-3);
  margin: 0 0 var(--space-5);
  padding-block: var(--space-4);
  border-block: 1px solid var(--line);
}
.workout-preview-metrics dt {
  font-size: var(--text-caption);
  color: var(--muted);
}
.workout-preview-metrics dd {
  margin: var(--space-2) 0 0;
  font-weight: 650;
  font-size: var(--text-panel);
}
.workout-preview-sections {
  display: grid;
  gap: var(--space-5);
}
.workout-preview-sections h3 {
  margin: 0 0 var(--space-3);
  font-size: var(--text-small);
}
.workout-preview-exercises {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: var(--space-3);
}
.workout-preview-exercises li {
  display: flex;
  gap: var(--space-3);
  justify-content: space-between;
  align-items: baseline;
  min-width: 0;
}
.workout-preview-exercises li span {
  min-width: 0;
  overflow-wrap: anywhere;
}
.workout-preview-exercises small {
  flex-shrink: 0;
  color: var(--muted);
}
.workout-muscles {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.athlete-workout-preview .agenda-actions {
  margin-block-start: auto;
}
@media (min-width: 1200px) {
  .workout-preview-sections {
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  }
}

.agenda-heading h2 {
  font-size: var(--text-section);
}
.workout-preview-more-mobile {
  display: none;
}
@media (max-width: 600px) {
  .athlete-workout-preview .agenda-actions {
    order: 2;
    margin-block-start: 0;
  }
  .workout-preview-details {
    order: 3;
  }
  .workout-preview-exercises li:nth-child(n + 4) {
    display: none;
  }
  .workout-preview-more-mobile {
    display: block;
  }
  .workout-preview-more-desktop {
    display: none;
  }
}

.staff-workout-cards .agenda-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 360px), 1fr));
  gap: var(--space-4);
  margin-block: var(--space-5);
}
.staff-workout-cards .agenda-row {
  padding: var(--space-5);
  border: 1px solid var(--line);
  border-radius: var(--radius-panel);
  background: var(--surface);
  align-items: stretch;
}
.staff-workout-cards .agenda-actions {
  flex-basis: 100%;
  justify-content: flex-end;
}
.staff-workout-cards .workout-preview-sections {
  display: none;
}
.staff-workout-cards .workout-preview-metrics {
  margin: 0;
  padding-block: var(--space-3);
}
.agenda-form {
  align-items: end;
  min-width: 0;
}
.agenda-form > label,
.agenda-form :deep(.timezone-picker) {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
  margin: 0;
}
.agenda-form :deep(label) {
  margin: 0;
}
.agenda-form input,
.agenda-form :deep(.timezone-anchor) {
  min-height: 44px;
  margin: 0;
}
.agenda-form h3 {
  margin: 0;
  font-size: var(--text-panel);
}
.workout-preview-sections h4 {
  margin: 0 0 var(--space-3);
  font-size: var(--text-small);
}
</style>
