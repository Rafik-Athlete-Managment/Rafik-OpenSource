<script setup lang="ts">
import { institutionContext } from '../../app/institution'

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
const saving = useCommand<'save'>(
  `delegated-save:${institution}:${sessionId.value}`,
  async () => {
    await load()
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
function toggleDone(entry: Entry, kind: ExerciseKind | undefined, event: Event) {
  const box = event.target as HTMLInputElement
  setError.value = ''
  const actual = measureFields(kind).first
  if (box.checked && (!measured(entry, actual) || !hasActualResult(entry, kind))) {
    box.checked = false
    setError.value = l(
      'Record the actual result for this set before marking it done.',
      'سجّل النتيجة الفعلية لهذه المجموعة قبل تحديدها كمكتملة.',
    )
    return
  }
  entry.completed = box.checked
}
const dayName = (d: PlanDay) => (locale.value === 'ar' ? d.nameAr || d.name : d.name)
onMounted(load)
</script>
<template>
  <div class="container page delegated-workout">
    <RouterLink class="back-link" :to="base + '/training'">{{
      l('Back to athlete plans', 'العودة إلى خطط الرياضيين')
    }}</RouterLink>
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
        <fieldset class="command-fields" :disabled="locked">
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
                >{{ fieldLabel(field, entry.unit)
                }}<input
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
              <label class="check-label"
                ><input
                  type="checkbox"
                  :checked="entry.completed"
                  @change="toggleDone(entry, exercise.kind, $event)"
                />{{ l('Done', 'تمت') }}</label
              >
            </div>
          </section>
          <p v-if="setError" role="alert" class="notice error">{{ setError }}</p>
          <label
            >{{ l('Note', 'ملاحظة') }}<textarea v-model="note" maxlength="2000" rows="2" />
          </label>
          <div class="actions">
            <button type="button" class="button secondary" @click="save(false)">
              {{ l('Save progress', 'حفظ التقدم') }}</button
            ><button class="button" :disabled="!entries.some((e) => e.completed)">
              {{ l('Finish session', 'إنهاء الحصة') }}
            </button>
          </div>
        </fieldset>
      </form>
      <section class="panel" aria-labelledby="record-history">
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
}
.recording-for {
  margin: 0 0 4px;
  font-weight: 650;
}
.delegated-workout .panel {
  margin-bottom: 16px;
}
.delegated-set {
  display: grid;
  grid-template-columns: minmax(64px, auto) repeat(auto-fit, minmax(110px, 1fr));
  gap: 10px 14px;
  align-items: end;
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
}
.delegated-set input[type='number'] {
  width: 100%;
  min-width: 0;
}
@media (max-width: 520px) {
  .delegated-set {
    grid-template-columns: repeat(2, minmax(0, 1fr));
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
