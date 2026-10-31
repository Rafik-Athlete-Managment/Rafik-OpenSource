<script setup lang="ts">
import { measureFields, measureLimits, hasActualResult } from '../../lib/set-measures'
import ExerciseDemo from '../../components/ExerciseDemo.vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute } from 'vue-router'
import {
  PhArrowLeft,
  PhArrowRight,
  PhCheck,
  PhCheckCircle,
  PhCloudCheck,
  PhCloudSlash,
  PhClock,
  PhDownloadSimple,
} from '@phosphor-icons/vue'
import PageState from '../../components/PageState.vue'
import { user } from '../../app/auth'
import { language, locale, t, errorMessage } from '../../lib/i18n'
import { convertLoad, type LocalSession, type Session, type Unit } from '../../lib/domain'
import { loadWorkout, changeWorkout, syncWorkout, reloadServerSession } from '../../lib/training'
import { editLocalSession, getLocalSession } from '../../lib/storage'
import { request } from '../../lib/backend'
import { institutionContext } from '../../app/institution'
import {
  exerciseInfo,
  exerciseName,
  targetLabel,
  actualLabel,
  performedExercise,
} from '../../lib/prescriptions'
import type { Entry, PrescriptionExercise } from '../../lib/domain'
const route = useRoute()

const id = String(route.params.id)
const row = ref<LocalSession>()
const loading = ref(true)
const error = ref('')
const selected = ref(0)
const working = ref(false)
const syncing = ref(false)
const finishConfirm = ref(false)
const now = ref(Date.now())
let clock: ReturnType<typeof setInterval> | undefined
let mutation = Promise.resolve()
const correcting = ref(false)
const savingLocal = ref(0)
const noteDraft = ref<string>()
onBeforeRouteLeave(async () => {
  if (
    session.value?.status === 'in_progress' &&
    !window.confirm(
      language(
        'Leave this workout? Saved progress stays available so you can resume.',
        'هل تريد مغادرة التمرين؟ يبقى التقدم المحفوظ متاحاً للمتابعة.',
      ),
    )
  )
    return false
  await mutation
})
const owner = computed(() => user.value!.id)
const session = computed(() => row.value?.session)
const returnPath = '/training'
const current = computed(() => session.value?.prescription.exercises[selected.value])
watch(
  () => current.value?.key,
  (key, previous) => {
    if (key && previous && key !== previous && row.value?.restUntil) {
      mutation = mutation.then(async () => {
        try {
          row.value = await editLocalSession(id, (local) => {
            local.restUntil = undefined
          })
        } catch (cause) {
          error.value = errorMessage(cause)
        }
      })
    }
  },
)
function warnBeforeUnload(event: BeforeUnloadEvent) {
  if (session.value?.status !== 'in_progress') return
  event.preventDefault()
  event.returnValue = ''
}
const groupBounds = computed(() => {
  const list = session.value?.prescription.exercises || [],
    label = current.value?.group
  if (!label) return { start: selected.value, end: selected.value }
  let start = selected.value,
    end = selected.value
  while (start > 0 && list[start - 1]?.group === label) start--
  while (end < list.length - 1 && list[end + 1]?.group === label) end++
  return { start, end }
})
const grouped = computed(() => groupBounds.value.end > groupBounds.value.start)
const nextIndex = computed(() => {
  if (grouped.value && selected.value === groupBounds.value.end) {
    const list = session.value!.prescription.exercises
    const firstIncomplete = list.findIndex(
      (e, i) =>
        i >= groupBounds.value.start &&
        i <= groupBounds.value.end &&
        session.value!.entries.some((a) => a.exercise_key === e.key && !a.completed),
    )
    if (firstIncomplete >= 0) return firstIncomplete
  }
  return selected.value + 1
})
const performed = computed(() =>
  current.value ? performedExercise(current.value, session.value?.entries || []) : undefined,
)
const info = computed(() => (performed.value ? exerciseInfo(performed.value) : undefined))
function chooseExercise(event: Event) {
  const choice = (event.target as HTMLSelectElement).value
  const key = current.value!.key
  void mutate((s) => {
    s.entries
      .filter((e) => e.exercise_key === key)
      .forEach((e) => {
        e.exercise_id = choice
      })
  })
}
const firstField = computed(() => measureFields(current.value?.kind).first)
const secondField = computed(() => measureFields(current.value?.kind).second)
const fieldLabel = (field: string) =>
  field === 'seconds'
    ? language('seconds', 'ثوانٍ')
    : field === 'metres'
      ? language('metres', 'أمتار')
      : field === 'effort'
        ? 'RPE'
        : field === 'load'
          ? language('load', 'وزن')
          : language('reps', 'تكرارات')
const entries = computed(
  () => session.value?.entries.filter((e) => e.exercise_key === current.value?.key) || [],
)
const doneCount = computed(() => session.value?.entries.filter((e) => e.completed).length || 0)
const total = computed(() => session.value?.entries.length || 0)
const finished = computed(() => session.value?.status === 'completed')
const remaining = computed(() =>
  Math.max(0, Math.ceil(((row.value?.restUntil || 0) - now.value) / 1000)),
)
const status = computed(() =>
  savingLocal.value
    ? language('Saving on this device…', 'جارٍ الحفظ على الجهاز…')
    : !row.value
      ? ''
      : syncing.value
        ? t('syncing')
        : row.value.syncError
          ? t('syncFailed')
          : row.value.localRevision > row.value.syncedRevision
            ? t('waiting')
            : t('synced'),
)
async function load() {
  loading.value = true
  error.value = ''
  try {
    row.value = await loadWorkout(id, owner.value, institutionContext().institution)
    if (
      row.value.owner !== owner.value ||
      row.value.session.institution_id !== institutionContext().institution
    ) {
      row.value = undefined
      throw new Error('forbidden')
    }
    void sync()
    void getPrevious()
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
let syncAgain = false
async function sync() {
  if (!row.value || row.value.owner === 'guest') return
  if (syncing.value) {
    syncAgain = true
    return
  }
  syncing.value = true
  try {
    do {
      syncAgain = false
      await syncWorkout(id, owner.value)
      row.value = await getLocalSession(id)
    } while (syncAgain)
  } finally {
    syncing.value = false
  }
}
function mutate(fn: (s: Session) => void) {
  savingLocal.value++
  mutation = mutation.then(async () => {
    error.value = ''
    try {
      row.value = await changeWorkout(id, fn)
      void sync()
    } catch (e) {
      error.value = errorMessage(e)
    } finally {
      savingLocal.value--
    }
  })
  return mutation
}
const fieldDrafts = ref<Record<string, string>>({})
const invalidFields = ref<Record<string, boolean>>({})
const fieldKey = (index: number, field: string) => `${current.value!.key}:${index}:${field}`
const hasInvalid = computed(() => Object.values(invalidFields.value).some(Boolean))
function changeEntry(
  index: number,
  field: 'load' | 'reps' | 'seconds' | 'metres' | 'effort',
  event: Event,
) {
  const input = event.target as HTMLInputElement
  const key = fieldKey(index, field)
  fieldDrafts.value[key] = input.value
  if (field === 'effort' && input.value === '') {
    invalidFields.value[key] = false
    const exerciseKey = current.value!.key
    void mutate((s) => {
      s.entries.find((e) => e.exercise_key === exerciseKey && e.set_index === index)!.effort = null
    })
    return
  }
  const valid = input.value !== '' && input.checkValidity() && Number.isFinite(Number(input.value))
  invalidFields.value[key] = !valid
  if (!valid) {
    error.value = language(
      'Enter a valid number before saving this set.',
      'أدخل رقماً صالحاً قبل حفظ المجموعة.',
    )
    return
  }
  const exerciseKey = current.value!.key,
    value = Number(input.value)
  void mutate((s) => {
    s.entries.find((e) => e.exercise_key === exerciseKey && e.set_index === index)![field] = value
  })
}
async function toggle(index: number) {
  if (hasInvalid.value) return
  const key = current.value!.key
  const entry = entries.value.find((e) => e.set_index === index)!
  if (!entry.completed && !hasActualResult(entry, current.value!.kind)) {
    error.value = language(
      'Record a positive result before completing this set.',
      'سجّل نتيجة موجبة قبل إكمال المجموعة.',
    )
    return
  }
  await mutate((s) => {
    const e = s.entries.find((e) => e.exercise_key === key && e.set_index === index)!
    e.completed = !e.completed
  })
  if (!entry.completed && (!grouped.value || selected.value === groupBounds.value.end)) {
    row.value = await editLocalSession(id, (r) => {
      r.restUntil = Date.now() + current.value!.rest * 1000
    })
  }
}
function units(event: Event) {
  fieldDrafts.value = {}
  invalidFields.value = {}
  const unit = (event.target as HTMLSelectElement).value as Unit
  const key = current.value!.key
  void mutate((s) => {
    s.entries
      .filter((e) => e.exercise_key === key)
      .forEach((e) => {
        e.load = convertLoad(e.load, e.unit, unit)
        e.unit = unit
      })
  })
}
async function finish() {
  if (hasInvalid.value) return
  if (doneCount.value === 0) {
    error.value = errorMessage(new Error('no_completed_sets'))
    return
  }
  if (doneCount.value < total.value && !finishConfirm.value) {
    finishConfirm.value = true
    return
  }
  working.value = true
  await mutate((s) => {
    s.status = 'completed'
    s.completed_at ||= new Date().toISOString()
  })
  row.value = await editLocalSession(id, (r) => {
    r.restUntil = undefined
  })
  finishConfirm.value = false
  correcting.value = false
  working.value = false
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
async function latest() {
  working.value = true
  try {
    row.value = await reloadServerSession(id, owner.value)
    fieldDrafts.value = {}
    invalidFields.value = {}
    noteDraft.value = undefined
    error.value = ''
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    working.value = false
  }
}
async function skipRest() {
  row.value = await editLocalSession(id, (r) => {
    r.restUntil = undefined
  })
}
function exportDraft() {
  if (!row.value) return
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(row.value.session, null, 2)], { type: 'application/json' }),
  )
  const a = document.createElement('a')
  a.href = url
  a.download = 'rafik-workout-draft.json'
  a.click()
  URL.revokeObjectURL(url)
}
function updateNote(event: Event) {
  const note = (event.target as HTMLTextAreaElement).value
  noteDraft.value = note
  void mutate((s) => {
    s.note = note
  })
}
const previous = ref<Record<string, string>>({})
async function getPrevious() {
  if (!user.value || !session.value) return
  try {
    const results = await request<
      { exercise_id: string; prescription: PrescriptionExercise; entries: Entry[] }[]
    >(`/v1/workouts/${id}/previous`)
    previous.value = Object.fromEntries(
      results.map((r) => [
        r.exercise_id,
        r.entries.map((e) => actualLabel(e, r.prescription.kind)).join(' · '),
      ]),
    )
  } catch {
    /* Optional evidence: omit on failure rather than inventing an actual. */
  }
}
onMounted(() => {
  void load()
  clock = setInterval(() => {
    now.value = Date.now()
  }, 1000)
  window.addEventListener('online', sync)
  window.addEventListener('beforeunload', warnBeforeUnload)
})
onUnmounted(() => {
  clearInterval(clock)
  window.removeEventListener('online', sync)
  window.removeEventListener('beforeunload', warnBeforeUnload)
})
function correctSets() {
  correcting.value = true
  finishConfirm.value = false
}
</script>
<template>
  <div class="container page workout-page">
    <RouterLink class="back-link" :to="returnPath"
      ><PhArrowLeft :size="18" class="directional" aria-hidden="true" />{{ t('today') }}</RouterLink
    ><PageState :loading="loading" :error="!row ? error : ''" @retry="load"
      ><template v-if="row && session">
        <p
          v-if="session.recorded_mode !== 'delegated' && session.completed_by_role === 'trainer'"
          class="notice"
          role="note"
        >
          {{
            language(
              `Completed by ${session.completed_by_name || 'your coach'}. You started this workout; its changes remain attributed in the record history.`,
              `أكمل التمرين ${session.completed_by_name || 'مدربك'}. أنت من بدأ هذا التمرين؛ وتبقى التعديلات منسوبة لأصحابها في السجل.`,
            )
          }}
        </p>
        <p v-if="session.recorded_mode === 'delegated'" class="notice" role="note" dir="auto">
          {{
            language(
              `Recorded by ${session.recorded_by_name || 'your coach'} on your behalf. Check it and correct anything that is wrong; every change is kept in the record history.`,
              `سجّلها ${session.recorded_by_name || 'مدربك'} نيابة عنك. راجعها وصحّح أي خطأ؛ يُحفظ كل تعديل في سجل التعديلات.`,
            )
          }}
        </p>
        <div class="workout-heading">
          <div>
            <span class="overline">{{ session.title }}</span>
            <h1>
              {{
                finished
                  ? language('Session complete.', 'اكتملت الحصة.')
                  : locale === 'ar'
                    ? session.prescription.nameAr || session.prescription.name
                    : session.prescription.name
              }}
            </h1>
          </div>
          <span class="save-status" role="status"
            ><PhCloudSlash v-if="row.syncError" :size="19" aria-hidden="true" /><PhCloudCheck
              v-else
              :size="19"
              aria-hidden="true"
            />{{ status }}</span
          >
        </div>
        <div v-if="error" class="notice error" role="alert">{{ error }}</div>
        <div v-if="row.conflict" class="notice error">
          <strong>{{
            language('Another device saved a newer version.', 'حفظ جهاز آخر نسخة أحدث.')
          }}</strong>
          <p>
            {{
              language(
                'Your draft is still here. Download it before loading the server version. We also keep a local recovery copy.',
                'مسودتك ما زالت هنا. نزّلها قبل تحميل نسخة الخادم. نحتفظ أيضاً بنسخة استرداد محلية.',
              )
            }}
          </p>
          <div class="actions">
            <button class="button small secondary" @click="exportDraft">
              <PhDownloadSimple :size="17" aria-hidden="true" />{{
                language('Download my draft', 'تنزيل مسودتي')
              }}</button
            ><button class="button small" :disabled="working" @click="latest">
              {{ language('Load latest version', 'تحميل أحدث نسخة') }}
            </button>
          </div>
        </div>
        <div v-else-if="row.syncError" class="notice">
          <p>{{ errorMessage(new Error(row.syncError)) }}</p>
          <button class="button small secondary" @click="sync">{{ t('retry') }}</button>
        </div>
        <template v-if="!finished || correcting"
          ><div class="workout-progress">
            <span
              >{{ doneCount }} / {{ total }} {{ language('sets recorded', 'مجموعة مسجلة') }}</span
            ><progress
              :value="doneCount"
              :max="total"
              :aria-label="language('Sets completed', 'المجموعات المكتملة')"
            ></progress>
          </div>
          <div class="logger-layout">
            <aside class="exercise-nav" :aria-label="t('exercises')">
              <button
                v-for="(ex, i) in session.prescription.exercises"
                :key="ex.key"
                @click="selected = i"
                :class="{ selected: i === selected }"
                :aria-current="i === selected ? 'step' : undefined"
              >
                <span class="exercise-index"
                  ><PhCheck
                    v-if="
                      session.entries.filter((e) => e.exercise_key === ex.key && e.completed)
                        .length === ex.sets
                    "
                    :size="18"
                    aria-hidden="true"
                  /><template v-else>{{ i + 1 }}</template></span
                ><span
                  >{{ exerciseName(performedExercise(ex, session.entries))
                  }}<small
                    >{{
                      session.entries.filter((e) => e.exercise_key === ex.key && e.completed).length
                    }}
                    / {{ ex.sets }} {{ t('sets') }}</small
                  ></span
                >
              </button>
            </aside>
            <section v-if="current" class="logger-main">
              <div class="logger-exercise-heading">
                <div>
                  <h2>{{ locale === 'ar' ? info?.name_ar : info?.name }}</h2>
                  <p>
                    {{ locale === 'ar' ? info?.equipment_ar : info?.equipment
                    }}<span class="inline-rest"
                      ><PhClock :size="16" aria-hidden="true" />{{ current.rest }}
                      {{ language('sec rest', 'ثانية راحة') }}</span
                    >
                  </p>
                </div>
                <label v-if="firstField === 'load'" class="unit-control"
                  ><span class="sr-only">{{ t('units') }}</span
                  ><select
                    :value="entries[0]?.unit || current.unit"
                    @change="units"
                    :disabled="row.conflict"
                  >
                    <option value="kg">{{ t('kg') }}</option>
                    <option value="lb">{{ t('lb') }}</option>
                  </select></label
                >
              </div>
              <details v-if="current.alternatives?.length" class="workout-alternatives">
                <summary>{{ language('Choose an alternative', 'اختر تمريناً بديلاً') }}</summary>
                <label
                  >{{ language('Exercise to perform', 'التمرين الذي ستؤديه')
                  }}<select
                    :value="performed?.exerciseId"
                    :disabled="row.conflict || savingLocal > 0"
                    @change="chooseExercise"
                  >
                    <option :value="current.exerciseId">
                      {{ exerciseName(current) }} · {{ language('Original', 'الأصلي') }}
                    </option>
                    <option
                      v-for="alternative in current.alternatives"
                      :key="alternative.exerciseId"
                      :value="alternative.exerciseId"
                    >
                      {{ locale === 'ar' ? alternative.info?.name_ar : alternative.info?.name }}
                    </option>
                  </select></label
                >
                <p class="subtle">
                  {{
                    language(
                      'Your coach approved these options with the same targets. Switching keeps recorded sets and values. Adjust them if needed.',
                      'اعتمد مدربك هذه الخيارات بالأهداف نفسها. التبديل يحتفظ بالمجموعات والقيم المسجلة. عدّلها عند الحاجة.',
                    )
                  }}
                </p>
              </details>
              <p v-if="performed?.exerciseId !== current.exerciseId" class="subtle">
                {{ language('Alternative to', 'بديل عن') }} {{ exerciseName(current) }}
              </p>
              <p class="instruction">
                {{ locale === 'ar' ? info?.instructions_ar : info?.instructions }}
              </p>
              <p v-if="current.group" class="tag">
                {{ language('Group', 'المجموعة') }}: {{ current.group }}
              </p>
              <p v-if="grouped" class="small-print">
                {{
                  language(
                    'Alternate the exercises in this group. Rest after the last exercise in each round.',
                    'تناوب بين تمارين هذه المجموعة. استرح بعد آخر تمرين في كل جولة.',
                  )
                }}
              </p>
              <p class="prescription-line">
                {{ language('Target', 'الهدف') }}: {{ targetLabel(current) }}
              </p>
              <ExerciseDemo :exercise="info" />
              <p v-if="current.note" class="coach-prescription">{{ current.note }}</p>
              <p v-if="previous[performed!.exerciseId]" class="previous-result">
                {{ t('previous') }}:
                <strong dir="ltr">{{ previous[performed!.exerciseId] }}</strong>
              </p>
              <div v-if="current.targets" class="set-target-list">
                <small v-for="(target, n) in current.targets" :key="n"
                  >{{ language('Set', 'المجموعة') }} {{ n + 1 }}: {{ targetLabel(current, target)
                  }}<br
                /></small>
              </div>
              <div class="set-grid set-head" aria-hidden="true">
                <span>{{ language('Set', 'المجموعة') }}</span
                ><span>{{
                  firstField === 'load'
                    ? t('load') + ' (' + t(entries[0]?.unit || current.unit) + ')'
                    : fieldLabel(firstField)
                }}</span
                ><span>{{
                  secondField === 'reps' ? t('reps') : language('RPE (optional)', 'RPE (اختياري)')
                }}</span
                ><span>{{ t('done') }}</span>
              </div>
              <div
                v-for="entry in entries"
                :key="entry.set_index"
                class="set-grid set-row"
                :class="{ recorded: entry.completed }"
              >
                <span class="set-number">{{ entry.set_index + 1 }}</span
                ><input
                  type="number"
                  inputmode="decimal"
                  min="0"
                  :max="measureLimits[firstField].max"
                  :step="measureLimits[firstField].step"
                  :value="fieldDrafts[fieldKey(entry.set_index, firstField)] ?? entry[firstField]"
                  :disabled="row.conflict"
                  :aria-label="
                    language(
                      `Set ${entry.set_index + 1} ${fieldLabel(firstField)}`,
                      `وزن المجموعة ${entry.set_index + 1}`,
                    )
                  "
                  @input="changeEntry(entry.set_index, firstField, $event)"
                /><input
                  type="number"
                  inputmode="numeric"
                  :min="measureLimits[secondField].min"
                  :max="measureLimits[secondField].max"
                  :step="measureLimits[secondField].step"
                  :value="fieldDrafts[fieldKey(entry.set_index, secondField)] ?? entry[secondField]"
                  :disabled="row.conflict"
                  :aria-label="
                    language(
                      `Set ${entry.set_index + 1} ${fieldLabel(secondField)}`,
                      `تكرارات المجموعة ${entry.set_index + 1}`,
                    )
                  "
                  @input="changeEntry(entry.set_index, secondField, $event)"
                /><button
                  class="record-button"
                  :class="{ checked: entry.completed }"
                  :disabled="row.conflict || hasInvalid"
                  :aria-pressed="entry.completed"
                  :aria-label="
                    language(
                      `Mark set ${entry.set_index + 1} ${entry.completed ? 'incomplete' : 'done'}`,
                      `تسجيل المجموعة ${entry.set_index + 1}`,
                    )
                  "
                  @click="toggle(entry.set_index)"
                >
                  <PhCheck :size="23" weight="bold" aria-hidden="true" />
                </button>
              </div>
              <details v-if="firstField === 'load'" class="advanced-prescription">
                <summary>
                  {{ language('Record effort (optional)', 'تسجيل الجهد (اختياري)') }}
                </summary>
                <div class="field-pair">
                  <label v-for="entry in entries" :key="entry.set_index"
                    >{{ language('Set', 'المجموعة') }} {{ entry.set_index + 1 }} · RPE<input
                      type="number"
                      min="1"
                      max="10"
                      step="0.5"
                      :disabled="row.conflict"
                      :value="fieldDrafts[fieldKey(entry.set_index, 'effort')] ?? entry.effort"
                      @input="changeEntry(entry.set_index, 'effort', $event)"
                  /></label>
                </div>
              </details>
              <div v-if="remaining > 0" class="rest-timer">
                <PhClock :size="22" aria-hidden="true" />
                <div>
                  <span>{{ t('rest') }}</span
                  ><strong dir="ltr"
                    >{{ Math.floor(remaining / 60) }}:{{
                      String(remaining % 60).padStart(2, '0')
                    }}</strong
                  >
                </div>
                <button class="text-link" @click="skipRest">{{ t('skipRest') }}</button>
              </div>
              <div class="logger-bottom">
                <button
                  v-if="nextIndex < session.prescription.exercises.length"
                  class="button secondary full"
                  @click="selected = nextIndex"
                >
                  {{
                    nextIndex <= selected
                      ? language('Next round', 'الجولة التالية')
                      : t('nextExercise')
                  }}<PhArrowRight :size="20" class="directional" aria-hidden="true" />
                </button>
                <p v-if="firstField === 'load'" class="small-print">
                  {{
                    language(
                      'Record the weight for one dumbbell. For bodyweight exercises, leave the load at 0.',
                      'سجّل وزن دمبل واحد. في تمارين وزن الجسم اترك الوزن ٠.',
                    )
                  }}
                </p>
              </div>
            </section>
          </div>
          <div class="finish-section">
            <div>
              <h2>{{ language('Ready to wrap up?', 'جاهز لإنهاء الحصة؟') }}</h2>
              <p>
                {{
                  language(
                    'Finish when you are done. Unrecorded sets stay uncompleted.',
                    'أنهِ الحصة عند الانتهاء. تبقى المجموعات غير المسجلة غير مكتملة.',
                  )
                }}
              </p>
            </div>
            <button
              class="button"
              :disabled="working || doneCount === 0 || row.conflict || hasInvalid"
              @click="finish"
            >
              {{ correcting ? language('Save correction', 'حفظ التصحيح') : t('finish')
              }}<PhCheckCircle :size="20" aria-hidden="true" />
            </button>
          </div>
          <div v-if="finishConfirm" class="notice">
            <p>
              {{
                language(
                  `Finish with ${total - doneCount} unrecorded sets?`,
                  `إنهاء الحصة مع ${total - doneCount} مجموعات غير مسجلة؟`,
                )
              }}
            </p>
            <div class="actions">
              <button class="button small" @click="finish">
                {{ language('Finish with recorded sets', 'إنهاء بالمجموعات المسجلة') }}</button
              ><button class="button small secondary" @click="finishConfirm = false">
                {{ language('Keep training', 'متابعة التمرين') }}
              </button>
            </div>
          </div></template
        >
        <section v-else class="completion-layout">
          <div class="completion-main">
            <div class="completion-icon">
              <PhCheckCircle :size="44" weight="light" aria-hidden="true" />
            </div>
            <h2>
              {{ language('You showed up. Here’s what you did.', 'أنجزت حصتك. إليك ما سجّلته.') }}
            </h2>
            <div class="result-facts">
              <div>
                <strong>{{ doneCount }}</strong
                ><span>{{ language('sets recorded', 'مجموعات مسجلة') }}</span>
              </div>
              <div>
                <strong>{{
                  session.prescription.exercises.filter((x) =>
                    session!.entries.some((e) => e.exercise_key === x.key && e.completed),
                  ).length
                }}</strong
                ><span>{{ t('exercises') }}</span>
              </div>
            </div>
            <button class="text-link" @click="correctSets">
              {{ language('Correct recorded sets', 'تصحيح المجموعات المسجلة') }}
            </button>
            <div class="summary-exercises">
              <div v-for="ex in session.prescription.exercises" :key="ex.key">
                <span>{{ exerciseName(performedExercise(ex, session.entries)) }}</span
                ><strong
                  >{{
                    session.entries.filter((e) => e.exercise_key === ex.key && e.completed).length
                  }}
                  / {{ ex.sets }}</strong
                >
              </div>
            </div>
            <RouterLink v-if="session.institution_id" :to="'/feedback'" class="text-link">{{
              language('Rate your session (optional)', 'قيّم جلستك (اختياري)')
            }}</RouterLink>
            <RouterLink :to="returnPath" class="button secondary"
              >{{ language('Back to training', 'العودة إلى التدريب')
              }}<PhArrowRight :size="19" class="directional" aria-hidden="true"
            /></RouterLink>
          </div>
          <aside class="completion-aside">
            <div class="panel">
              <label for="session-note"
                ><h3>
                  {{ t('note') }}
                </h3>
                <span class="subtle">{{ t('optional') }}</span></label
              ><textarea
                id="session-note"
                :value="noteDraft ?? session.note"
                maxlength="2000"
                rows="4"
                :placeholder="
                  language(
                    'What felt good? Anything to adjust?',
                    'ما الذي كان جيداً؟ هل هناك ما يحتاج إلى تعديل؟',
                  )
                "
                @input="updateNote"
              ></textarea
              ><small>{{ status }}</small>
            </div>
            <div v-if="session.coach_note" class="panel feedback-panel">
              <h3>{{ t('feedback') }}</h3>
              <p>{{ session.coach_note }}</p>
            </div>
          </aside>
        </section>
      </template></PageState
    >
  </div>
</template>
