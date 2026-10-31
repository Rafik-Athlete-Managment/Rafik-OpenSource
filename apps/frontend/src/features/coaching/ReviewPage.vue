<script setup lang="ts">
import PageHeading from '../../components/PageHeading.vue'
import { onMounted, ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { PhArrowLeft, PhArrowRight, PhCheckCircle, PhCheck } from '@phosphor-icons/vue'
import { user } from '../../app/auth'
import { request } from '../../lib/backend'
import type { Session } from '../../lib/domain'
import { language,  t, errorMessage } from '../../lib/i18n'
import { dateLabel } from '../../lib/display-time'
import { exerciseName, targetLabel, actualLabel, performedExercise } from '../../lib/prescriptions'
import PageState from '../../components/PageState.vue'
import { programContext } from './program-context'
import { useCommand } from '../../lib/commands'
import CommandStatus from '../../components/CommandStatus.vue'
import { getDraft, storeDraft, removeDraft } from '../../lib/storage'
const props = defineProps<{ embedded?: boolean; workoutId?: string }>()
const emit = defineEmits<{ record: []; locked: [boolean] }>()
const route = useRoute()
const context = programContext(route)
const draftKey = `review:${user.value!.id}:${context.key}:${props.workoutId || route.params.id}`
const id = props.workoutId || String(route.params.id)
// Return to the list or page that opened this review; otherwise Workout history.
const previous = (window.history.state as { back?: unknown } | null)?.back
const back =
  typeof previous === 'string' &&
  /^\/(dashboard|training|workouts|members|athletes|people|schedule)(\/|\?|$)/.test(previous)
    ? previous
    : { path: context.base + '/workouts', query: { search: route.query.search } }
const next = ref<string | null>()
async function findNext() {
  if (session.value?.source_kind === 'additional') {
    next.value = undefined
    return
  }
  try {
    const result = await request<{ sessions: { id: string }[] }>(
      `/v1/institution/delivery?view=${context.view}&history=true&status=awaiting_review&limit=2&offset=0`,
      { feedback: 'none' },
    )
    next.value = result.sessions.find((s) => s.id !== id)?.id || null
  } catch {
    next.value = null
  }
}
const state = computed(() =>
  !session.value || session.value.status !== 'completed'
    ? 'in_progress'
    : session.value.reviewed_at
      ? 'reviewed'
      : 'awaiting_review',
)
const session = ref<Session>(),
  person = ref<{ display_name: string }>()
const note = ref(''),
  error = ref(''),
  message = ref('')
const loading = ref(true)
async function load() {
  loading.value = true
  error.value = ''
  try {
    const result = await request<Session & { member_name: string }>(
      `/v1/workouts/${id}?view=${context.view}`,
    )
    session.value = result
    person.value = { display_name: result.member_name }
    note.value = result.coach_note
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
const command = useCommand<'review'>(
  draftKey,
  async () => {
    await removeDraft(draftKey)
    await load()
    await findNext()
    message.value = language(
      'Review saved. Your athlete can see this feedback in their session.',
      'حُفظت المراجعة. يمكن لرياضيك رؤية الملاحظات ضمن حصته.',
    )
  },
  (_, args) =>
    request(`/v1/institution/sessions`, {
      method: 'POST',
      body: JSON.stringify(args),
    }),
  { successMessage: language('Workout review saved.', 'حُفظت مراجعة التمرين.') },
)
const busy = computed(
  () => loading.value || command.state.busy || !!command.state.pending || !command.state.ready,
)
watch(busy, (value) => emit('locked', value), { immediate: true })
async function save() {
  message.value = ''
  await command.run('review', {
    operation: crypto.randomUUID(),
    action: 'review',
    view: context.view,
    id,
    revision: session.value!.version,
    note: note.value,
  })
}
let draftWrites: Promise<void> = Promise.resolve()
async function flushDraft() {
  await draftWrites
  return !error.value && !busy.value
}
defineExpose({ flushDraft })
let draftReady = false
watch(note, () => {
  if (draftReady) {
    const snapshot = note.value
    draftWrites = draftWrites
      .then(() => storeDraft(draftKey, snapshot))
      .catch((e) => {
        error.value = errorMessage(e)
      })
  }
})
onMounted(async () => {
  await load()
  const draft = await getDraft<string>(draftKey)
  if (draft !== undefined) note.value = draft
  draftReady = true
})
</script>
<template>
  <div :class="{ 'container page': !embedded, 'embedded-review': embedded }">
    <RouterLink v-if="!embedded" :to="back" class="back-link"
      ><PhArrowLeft :size="18" class="directional" />{{ language('Back', 'رجوع') }}</RouterLink
    ><PageState :loading="loading" :error="!session ? error : ''" @retry="load"
      ><template v-if="session"
        ><PageHeading class="page-heading"
          ><div>
            <p class="overline">{{ language('Session review', 'مراجعة الحصة') }}</p>
            <component :is="embedded ? 'h3' : 'h1'">{{ person?.display_name }}</component>
            <p>
              {{ session.prescription.name }} ·
              {{ dateLabel(session.completed_at || session.started_at) }}
            </p>
          </div>
          <span class="tag review-state" :data-status="state">{{
            state === 'reviewed'
              ? language('Reviewed', 'تمت المراجعة')
              : state === 'awaiting_review'
                ? language('Awaiting review', 'بانتظار المراجعة')
                : language('In progress', 'قيد التنفيذ')
          }}</span></PageHeading
        >
        <CommandStatus :command="command" :show-notice="false" />
        <RouterLink
          v-if="session.can_record && !embedded"
          class="button review-continuation"
          :to="'/record/' + session.id"
          >{{ language('Continue workout for athlete', 'متابعة تمرين الرياضي') }}</RouterLink
        >
        <button
          v-if="embedded && session.can_record"
          type="button"
          class="button review-continuation"
          :disabled="busy"
          @click="emit('record')"
        >
          {{ language('Back to recording', 'العودة إلى التسجيل') }}
        </button>
        <div class="review-layout">
          <section>
            <article
              v-for="ex in session.prescription.exercises"
              :key="ex.key"
              class="review-exercise"
            >
              <h2>
                {{ exerciseName(performedExercise(ex, session.entries)) }}
              </h2>
              <p class="subtle">
                {{ language('Planned', 'المخطط') }}: {{ exerciseName(ex) }} · {{ ex.sets }} ×
                {{ targetLabel(ex) }}
              </p>
              <table>
                <caption class="sr-only">
                  {{
                    language('Actual sets', 'المجموعات الفعلية')
                  }}
                </caption>
                <thead>
                  <tr>
                    <th>{{ language('Set', 'المجموعة') }}</th>
                    <th>{{ language('Target', 'الهدف') }}</th>
                    <th>{{ language('Actual', 'النتيجة') }}</th>
                    <th>{{ language('Recorded', 'مسجلة') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="entry in session.entries.filter((e) => e.exercise_key === ex.key)"
                    :key="entry.set_index"
                  >
                    <td>{{ entry.set_index + 1 }}</td>
                    <td class="subtle">
                      {{ targetLabel(ex, ex.targets?.[entry.set_index] || ex) }}
                    </td>
                    <td>
                      <strong v-if="entry.completed">{{ actualLabel(entry, ex.kind) }}</strong
                      ><span v-else class="subtle">–</span>
                    </td>
                    <td>
                      <span v-if="entry.completed" class="recorded-yes"
                        ><PhCheck :size="16" weight="bold" aria-hidden="true" />{{
                          language('Yes', 'نعم')
                        }}</span
                      ><span v-else class="subtle">{{ language('No', 'لا') }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </article>
          </section>
          <aside>
            <section v-if="session.note" class="panel">
              <h2>{{ language('Athlete note', 'ملاحظة الرياضي') }}</h2>
              <p class="preserve-lines">{{ session.note }}</p>
            </section>
            <form
              v-if="context.view !== 'trainee'"
              class="panel feedback-form"
              @submit.prevent="save"
            >
              <h2>{{ language('Make your feedback useful.', 'قدّم ملاحظات مفيدة.') }}</h2>
              <p>
                {{
                  language(
                    'Acknowledge the session and suggest one adjustment for next time.',
                    'علّق على الحصة واقترح تعديلاً واحداً للمرة القادمة.',
                  )
                }}
              </p>
              <label for="review-note"
                >{{ t('feedback') }} <span class="subtle">{{ t('optional') }}</span></label
              ><textarea id="review-note" v-model="note" rows="6" maxlength="2000"></textarea>
              <p v-if="session.status !== 'completed'" class="small-print">
                {{
                  language(
                    'You can save a review once the workout is finished.',
                    'يمكنك حفظ المراجعة بعد إنهاء التمرين.',
                  )
                }}
              </p>
              <button class="button full" :disabled="busy || session.status !== 'completed'">
                <PhCheckCircle :size="20" />{{
                  busy ? t('loading') : language('Save review', 'حفظ المراجعة')
                }}
              </button>
              <template v-if="message && !embedded">
                <RouterLink v-if="next" class="button secondary full" :to="'/review/' + next"
                  >{{ language('Next to review', 'المراجعة التالية')
                  }}<PhArrowRight :size="18" class="directional" aria-hidden="true"
                /></RouterLink>
                <p v-else-if="next === null" class="small-print">
                  {{
                    language(
                      'No other workouts are awaiting review.',
                      'لا توجد تمارين أخرى بانتظار المراجعة.',
                    )
                  }}
                </p>
                <RouterLink class="text-link" :to="back">{{
                  language('Continue reviewing', 'متابعة المراجعات')
                }}</RouterLink>
              </template>
              <p v-if="error" class="notice error" role="alert">{{ error }}</p>
            </form>
            <section v-if="context.view === 'trainee' && session.coach_note" class="panel">
              <h2>{{ language('Coach feedback', 'ملاحظات المدرب') }}</h2>
              <p class="preserve-lines">{{ session.coach_note }}</p>
            </section>
          </aside>
        </div></template
      ></PageState
    >
  </div>
</template>

<style scoped>
:deep(.page-heading h3) {
  margin: 0;
  font-size: var(--text-section);
}
.embedded-review .review-layout {
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-5);
}
.embedded-review .review-layout > aside {
  position: static;
  grid-row: auto;
}
.embedded-review .review-exercise {
  min-width: 0;
  overflow-x: auto;
}
.review-continuation {
  display: inline-flex;
  margin-block: var(--space-2) var(--space-6);
}
.review-layout {
  margin-block-start: var(--space-5);
}
.review-exercise + .review-exercise {
  margin-block-start: var(--space-6);
}
.feedback-form {
  display: grid;
  gap: var(--space-4);
}
.review-state {
  align-self: flex-start;
}
.recorded-yes {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--accent);
  font-weight: 600;
}
@media (min-width: 981px) {
  .review-layout aside {
    position: sticky;
    top: var(--space-4);
    align-self: start;
  }
}
.feedback-form > h2,
.feedback-form > p {
  margin: 0;
}
</style>
