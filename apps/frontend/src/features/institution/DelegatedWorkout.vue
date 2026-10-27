<script setup lang="ts">
import { institutionContext } from '../../app/institution'

import { PhCheck, PhArrowLeft, PhClockCounterClockwise } from '@phosphor-icons/vue'
import SidePanel from '../../components/SidePanel.vue'
import PageHeading from '../../components/PageHeading.vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { AthletePlanPage, WorkoutAgenda } from '@rafik/shared/contracts'
import { request } from '../../lib/backend'
import { language as l, errorMessage, dateLabel, locale } from '../../lib/i18n'
import { exerciseName } from '../../lib/prescriptions'
import {
  measureFields,
  measureLimits,
  hasActualResult,
  type MeasureField,
} from '../../lib/set-measures'
import type { Entry, ExerciseKind, PlanDay, Prescription, Session } from '../../lib/domain'
import { useCommand } from '../../lib/commands'
import CommandStatus from '../../components/CommandStatus.vue'

/**
 * A coach records a workout on an athlete's behalf. Every write uses the coach's own session
 * and is attributed to the coach; the athlete sees who recorded it and can correct it.
 * Online only: unlike the athlete's own workout screen, there is no device queue here.
 */
type Delegated = Session & {
  member_id: string
  member_name?: string
  recorded_mode?: 'self' | 'delegated'
  recorded_by_name?: string | null
  can_record?: boolean
}
type Version = {
  version: number
  action: 'start' | 'save'
  created_at: string
  actor_name: string
  by: 'athlete' | 'coach'
  completed: boolean
}
const route = useRoute(),
  router = useRouter(),
  institution = institutionContext().institution,
  view = institutionContext().view,
  base = '',
  ws = `/v1/institution`
const sessionId = computed(() => String(route.params.session))
const loading = ref(true),
  error = ref(''),
  plan = ref<AthletePlanPage['items'][number] & { version: { prescription?: Prescription } }>(),
  session = ref<Delegated>(),
  entries = ref<Entry[]>([]),
  note = ref(''),
  history = ref<Version[]>([])
const get = <T,>(path: string) => request<T>(path, { feedback: 'none' })
const nextWorkout = ref<WorkoutAgenda['items'][number]>()
async function load() {
  loading.value = true
  error.value = ''
  try {
    if (sessionId.value === 'new') {
      const page = await get<AthletePlanPage>(
        `${ws}/athlete-plans?view=${view}&assignment=${encodeURIComponent(String(route.query.assignment))}`,
      )
      plan.value = page.items[0] as typeof plan.value
      const agenda = await get<WorkoutAgenda>(
        `${ws}/workout-scheduling?view=${view}&assignment=${encodeURIComponent(String(route.query.assignment))}`,
      )
      if (disposed) return
      nextWorkout.value = agenda.items[0]
      if (!nextWorkout.value?.can_start) throw new Error('workout_not_actionable')
    } else {
      session.value = await get<Delegated>(`/v1/workouts/${sessionId.value}?view=${view}`)
      entries.value = session.value.entries.map((e) => ({ ...e }))
      note.value = session.value.note
      history.value = (
        await get<{ items: Version[] }>(`/v1/workouts/${sessionId.value}/history?view=${view}`)
      ).items
    }
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
const days = computed(
  () =>
    plan.value?.version.prescription?.days.filter(
      (d: PlanDay) => nextWorkout.value?.can_start && d.id === nextWorkout.value.day?.id,
    ) || [],
)
// Navigate only after the start command has fully settled: the page may remount on a route
// change, and a new instance must not adopt the still-saved start command as pending.
const started = ref('')
const starting = useCommand<'start'>(
  `delegated-start:${institution}`,
  async (_, result) => {
    started.value = (result as Session).id
  },
  (_, args) => request(`${ws}/sessions`, { method: 'POST', body: JSON.stringify(args) }),
)
let commandOrigin = route.fullPath
const completedDestination = ref('')
const saving = useCommand<'save'>(
  `delegated-save:${institution}:${sessionId.value}`,
  async (_, _result, args) => {
    await load()
    if (args.complete && !disposed && route.fullPath === commandOrigin)
      completedDestination.value = String(args.id)
  },
  (_, args) => request(`${ws}/sessions`, { method: 'POST', body: JSON.stringify(args) }),
  { successMessage: l('Saved on the athlete’s record.', 'حُفظ في سجل الرياضي.') },
)
const locked = computed(
  () =>
    saving.state.busy ||
    !!saving.state.pending ||
    !saving.state.ready ||
    starting.state.busy ||
    !!starting.state.pending,
)
let disposed = false
onUnmounted(() => {
  disposed = true
})
async function start(day: PlanDay) {
  const id = crypto.randomUUID(),
    origin = route.fullPath
  started.value = ''
  await starting.run('start', {
    operation: id,
    action: 'start',
    view,
    id,
    assignment_id: plan.value!.id,
    day_id: day.id,
    occurrence_id: nextWorkout.value?.occurrence?.id,
  })
  // The write stands even if the coach left; only move them if this screen is still current.
  if (started.value && !starting.state.pending && !disposed && route.fullPath === origin)
    await router.replace(`${base}/record/${started.value}`)
}
watch(sessionId, load)
watch(
  () => saving.state.busy,
  async (busy) => {
    if (
      !busy &&
      completedDestination.value &&
      !saving.state.pending &&
      !saving.state.error &&
      !disposed &&
      route.fullPath === commandOrigin
    ) {
      const id = completedDestination.value
      completedDestination.value = ''
      await router.replace('/review/' + id)
    }
  },
)
const save = (complete: boolean) => {
  if (
    entries.value.some(
      (e) =>
        e.completed &&
        (!hasActualResult(e, kindOf(e)) || !measured(e, measureFields(kindOf(e)).first)),
    )
  ) {
    setError.value = l(
      'Record the actual result for every completed set.',
      'سجّل النتيجة الفعلية لكل مجموعة مكتملة.',
    )
    return
  }
  commandOrigin = route.fullPath
  return saving.run('save', {
    operation: crypto.randomUUID(),
    action: 'save',
    view,
    id: session.value!.id,
    revision: session.value!.version,
    entries: entries.value,
    note: note.value,
    complete,
  })
}
const exercises = computed(() => session.value?.prescription.exercises || [])
const setError = ref('')
// Timed and distance sets start from the prescription; the coach must enter the actual
// duration or distance (or the set was already completed in a saved version).
const entered = ref(new Set<string>())
const entryKey = (entry: Entry, field: MeasureField) =>
  `${entry.exercise_key}:${entry.set_index}:${field}`
const measured = (entry: Entry, field: MeasureField) =>
  !['seconds', 'metres'].includes(field) ||
  entry.completed ||
  entered.value.has(entryKey(entry, field))
// The same measurement rules as the athlete logger: strength records load and reps (effort
// optional); timed and distance record actual seconds or metres (effort optional).
function setFields(kind?: ExerciseKind): MeasureField[] {
  const { first, second } = measureFields(kind)
  return second === 'reps' ? [first, second, 'effort'] : [first, second]
}
const fieldLabel = (field: MeasureField, unit: string) =>
  field === 'load'
    ? l('Load', 'الحمل') + ' (' + unit + ')'
    : field === 'reps'
      ? l('Reps', 'التكرارات')
      : field === 'seconds'
        ? l('Seconds', 'الثواني')
        : field === 'metres'
          ? l('Metres', 'الأمتار')
          : l('Effort (RPE, optional)', 'الجهد (RPE، اختياري)')
function setField(entry: Entry, field: MeasureField, event: Event) {
  const raw = (event.target as HTMLInputElement).value
  entered.value = new Set(entered.value).add(entryKey(entry, field))
  // Clearing a measured value removes it rather than keeping the prescribed figure.
  if (raw === '') {
    if (field === 'reps' || field === 'load') entry[field] = 0
    else entry[field] = null
  } else entry[field] = Number(raw)
  if (entry.completed && !hasActualResult(entry, kindOf(entry))) entry.completed = false
}
const kindOf = (entry: Entry) => exercises.value.find((e) => e.key === entry.exercise_key)?.kind
function toggleDone(entry: Entry, kind: ExerciseKind | undefined) {
  const checked = !entry.completed
  setError.value = ''
  const actual = measureFields(kind).first
  if (checked && (!measured(entry, actual) || !hasActualResult(entry, kind))) {
    setError.value = l(
      'Record the actual result for this set before marking it done.',
      'سجّل النتيجة الفعلية لهذه المجموعة قبل تحديدها كمكتملة.',
    )
    return
  }
  entry.completed = checked
}
const historyOpen = ref(false)
const setsDone = computed(() => entries.value.filter((e) => e.completed).length)
// Return to wherever recording was opened from (dashboard, plan or history).
const backTarget = computed(() => {
  const previous = (window.history.state as { back?: unknown } | null)?.back
  return typeof previous === 'string' && !previous.startsWith('/record/')
    ? previous
    : base + '/training'
})
const dayName = (d: PlanDay) => (locale.value === 'ar' ? d.nameAr || d.name : d.name)
onMounted(load)
</script>
<template>
  <div class="container page delegated-workout">
    <RouterLink class="back-link" :to="backTarget"
      ><PhArrowLeft :size="18" class="back-arrow" aria-hidden="true" />{{
        l('Back', 'رجوع')
      }}</RouterLink
    >
    <p v-if="loading" role="status">{{ l('Loading…', 'جارٍ التحميل…') }}</p>
    <p v-else-if="error" role="alert" class="notice error">
      {{ error }}
      <button type="button" class="text-link" @click="load">
        {{ l('Retry', 'إعادة المحاولة') }}
      </button>
    </p>
    <template v-else-if="sessionId === 'new' && plan">
      <PageHeading class="work-heading">
        <div>
          <p class="recording-for">{{ l('Record on behalf of', 'تسجيل نيابة عن') }}</p>
          <h1 dir="auto">{{ plan.member_name }}</h1>
          <p dir="auto">{{ plan.version.title }}</p>
        </div>
      </PageHeading>
      <p class="notice">
        {{
          l(
            'You are recording for the athlete under your own name. They will see that you recorded it and can correct it.',
            'تسجّل للرياضي باسمك. سيرى أنك سجّلت الحصة ويمكنه تصحيحها.',
          )
        }}
      </p>
      <CommandStatus :command="starting" />
      <section class="panel">
        <h2>{{ l('Which session?', 'أي حصة؟') }}</h2>
        <div v-for="day in days" :key="day.id" class="organization-session-row">
          <div>
            <strong dir="auto">{{ dayName(day) }}</strong>
            <p>{{ day.minutes }} {{ l('minutes', 'دقيقة') }}</p>
          </div>
          <button
            type="button"
            class="button small"
            :disabled="locked"
            :aria-label="l('Record ', 'تسجيل ') + dayName(day)"
            @click="start(day)"
          >
            {{ l('Record', 'تسجيل') }}
          </button>
        </div>
      </section>
    </template>
    <template v-else-if="session">
      <PageHeading class="work-heading">
        <div>
          <p class="recording-for">
            {{
              session.recorded_mode === 'delegated'
                ? l('Recorded on behalf of', 'مسجّلة نيابة عن')
                : l('Athlete-recorded session', 'حصة سجّلها الرياضي')
            }}
          </p>
          <h1 dir="auto">{{ session.member_name }}</h1>
          <p dir="auto">{{ session.title }} · {{ session.prescription.name }}</p>
        </div>
      </PageHeading>
      <p v-if="session.recorded_mode !== 'delegated'" class="notice">
        {{
          l(
            'The athlete started this workout. Authorized coaches can finish it; every saved change keeps its author.',
            'بدأ الرياضي هذا التمرين. يستطيع المدرب المخوّل إكماله؛ ويُحفظ صاحب كل تعديل مسجّل.',
          )
        }}
      </p>
      <CommandStatus :command="saving" />
      <RouterLink
        v-if="!session.can_record"
        class="button secondary"
        :to="'/review/' + session.id"
        >{{ l('Review workout', 'مراجعة التمرين') }}</RouterLink
      >
      <form v-if="session.can_record" class="form-stack" @submit.prevent="save(true)">
        <div class="record-toolbar">
          <p class="record-progress" role="status">
            <strong>{{ setsDone }} / {{ entries.length }}</strong>
            {{ l('sets checked', 'مجموعات محددة') }}
          </p>
          <div class="actions">
            <button
              type="button"
              class="button secondary small"
              :aria-expanded="historyOpen"
              @click="historyOpen = true"
            >
              <PhClockCounterClockwise :size="18" aria-hidden="true" />{{
                l('Record history', 'سجل التعديلات')
              }}</button
            ><button
              type="button"
              class="button secondary small"
              :disabled="locked"
              @click="save(false)"
            >
              {{ l('Save progress', 'حفظ التقدم') }}</button
            ><button class="button small" :disabled="locked || !entries.some((e) => e.completed)">
              {{ l('Finish session', 'إنهاء الحصة') }}
            </button>
          </div>
        </div>
        <p class="small-print">
          {{
            l(
              'Enter actual results, then check each completed set. Targets are suggestions, not recorded results.',
              'أدخل النتائج الفعلية ثم حدد كل مجموعة مكتملة. الأهداف مقترحات وليست نتائج مسجّلة.',
            )
          }}
        </p>
        <fieldset class="command-fields delegated-fields" :disabled="locked">
          <section v-for="exercise in exercises" :key="exercise.key" class="panel">
            <h2 dir="auto">{{ exerciseName(exercise) }}</h2>
            <div
              v-for="entry in entries.filter((e) => e.exercise_key === exercise.key)"
              :key="entry.set_index"
              class="delegated-set"
              :aria-label="
                exerciseName(exercise) + ' · ' + l('Set', 'المجموعة') + ' ' + (entry.set_index + 1)
              "
              role="group"
            >
              <span>{{ l('Set', 'المجموعة') }} {{ entry.set_index + 1 }}</span>
              <label v-for="field in setFields(exercise.kind)" :key="field"
                ><span class="set-field-label">{{ fieldLabel(field, entry.unit) }}</span
                ><input
                  type="number"
                  :inputmode="field === 'reps' ? 'numeric' : 'decimal'"
                  :min="measureLimits[field].min"
                  :max="measureLimits[field].max"
                  :step="measureLimits[field].step"
                  :value="measured(entry, field) ? (entry[field] ?? '') : ''"
                  :placeholder="
                    measured(entry, field) || entry[field] == null
                      ? undefined
                      : l('Target ', 'الهدف ') + entry[field]
                  "
                  @input="setField(entry, field, $event)"
              /></label>
              <button
                type="button"
                class="record-button"
                :class="{ checked: entry.completed }"
                :aria-pressed="entry.completed"
                :aria-label="
                  l('Mark set ', 'تحديد المجموعة ') +
                  (entry.set_index + 1) +
                  ' · ' +
                  l('Done', 'تمت')
                "
                @click="toggleDone(entry, exercise.kind)"
              >
                <PhCheck :size="23" weight="bold" aria-hidden="true" />
              </button>
            </div>
          </section>
          <p v-if="setError" role="alert" class="notice error">{{ setError }}</p>
          <label
            >{{ l('Note', 'ملاحظة') }}<textarea v-model="note" maxlength="2000" rows="2" />
          </label>
        </fieldset>
      </form>
      <SidePanel
        v-if="session.can_record"
        v-model:open="historyOpen"
        :title="l('Record history', 'سجل التعديلات')"
        :description="session.member_name + ' · ' + session.prescription.name"
      >
        <ol class="record-history">
          <li v-for="item in history" :key="item.version">
            <strong dir="auto">{{ item.actor_name }}</strong>
            ·
            {{
              item.action === 'start'
                ? l('started', 'بدأ')
                : item.by === 'athlete'
                  ? l('corrected (athlete)', 'صحّح (الرياضي)')
                  : item.completed
                    ? l('saved as completed', 'حفظ كمكتملة')
                    : l('saved progress', 'حفظ التقدم')
            }}
            · {{ dateLabel(item.created_at) }}
          </li>
        </ol>
      </SidePanel>
      <section v-else class="panel" aria-labelledby="record-history">
        <h2 id="record-history">{{ l('Record history', 'سجل التعديلات') }}</h2>
        <ol class="record-history">
          <li v-for="item in history" :key="item.version">
            <strong dir="auto">{{ item.actor_name }}</strong>
            ·
            {{
              item.action === 'start'
                ? l('started', 'بدأ')
                : item.by === 'athlete'
                  ? l('corrected (athlete)', 'صحّح (الرياضي)')
                  : item.completed
                    ? l('saved as completed', 'حفظ كمكتملة')
                    : l('saved progress', 'حفظ التقدم')
            }}
            · {{ dateLabel(item.created_at) }}
          </li>
        </ol>
      </section>
    </template>
  </div>
</template>
<style scoped>
.delegated-workout {
  display: grid;
  gap: var(--space-5);
}
.delegated-fields {
  display: grid;
  gap: var(--space-5);
  min-width: 0;
}
.delegated-fields .panel {
  margin: 0;
}
.recording-for {
  margin: 0 0 4px;
  font-weight: 650;
}
.delegated-set {
  display: grid;
  grid-template-columns: 64px repeat(3, minmax(0, 1fr)) 50px;
  gap: 10px 14px;
  align-items: end;
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
}
.delegated-set > label {
  min-width: 0;
  display: grid;
  gap: var(--space-2);
}
.delegated-set > span {
  align-self: center;
}
.delegated-set .record-button {
  grid-column: -2;
  align-self: end;
  min-width: 44px;
  min-height: 44px;
}
.delegated-set input[type='number'] {
  width: 100%;
  min-width: 0;
}
@media (max-width: 520px) {
  .delegated-set {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .delegated-set > span {
    grid-column: 1 / -1;
  }
}
.record-toolbar {
  position: sticky;
  top: var(--dashboard-sticky-top, 0);
  z-index: 5;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3) var(--space-4);
  padding: var(--space-3) 0;
  border-block-end: 1px solid var(--line);
  background: var(--page);
}
.record-toolbar .actions {
  gap: var(--space-2);
}
.record-toolbar .button {
  margin: 0;
}
.record-progress {
  margin: 0;
  color: var(--muted);
}
.record-progress strong {
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}
.back-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}
.back-arrow:dir(rtl) {
  transform: scaleX(-1);
}
/* Desktop: name each measure once per exercise; inputs keep their accessible labels. */
@media (min-width: 521px) {
  .delegated-set:not(:first-of-type) .set-field-label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .delegated-set:not(:first-of-type) {
    align-items: center;
  }
}
.record-history {
  margin: 0;
  padding-inline-start: 20px;
  display: grid;
  gap: 6px;
  overflow-wrap: anywhere;
}
</style>
