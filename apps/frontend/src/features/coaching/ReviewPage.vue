<script setup lang="ts">
import PageHeading from '../../components/PageHeading.vue'
import { onMounted, ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { PhArrowLeft, PhCheckCircle } from '@phosphor-icons/vue'
import { user } from '../../app/auth'
import { request } from '../../lib/backend'
import type { Session } from '../../lib/domain'
import { language, locale, t, errorMessage, dateLabel } from '../../lib/i18n'
import { exerciseName, targetLabel, actualLabel, performedExercise } from '../../lib/prescriptions'
import PageState from '../../components/PageState.vue'
import { programContext } from './program-context'
import { useCommand } from '../../lib/commands'
import CommandStatus from '../../components/CommandStatus.vue'
import { getDraft, storeDraft, removeDraft } from '../../lib/storage'
const route = useRoute()
const context = programContext(route)
const draftKey = `review:${user.value!.id}:${context.key}:${route.params.id}`
const id = String(route.params.id)
const back = {
  path: context.base + '/workouts',
  query: { view: String(route.query.view || 'all'), search: route.query.search },
}
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
)
const busy = computed(() => command.state.busy || !!command.state.pending || !command.state.ready)
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
let draftReady = false
watch(note, () => {
  if (draftReady)
    void storeDraft(draftKey, note.value).catch((e) => (error.value = errorMessage(e)))
})
onMounted(async () => {
  await load()
  const draft = await getDraft<string>(draftKey)
  if (draft !== undefined) note.value = draft
  draftReady = true
})
</script>
<template>
  <div class="container page">
    <RouterLink :to="back" class="back-link"
      ><PhArrowLeft :size="18" class="directional" />{{
        language('Review list', 'قائمة المراجعة')
      }}</RouterLink
    ><PageState :loading="loading" :error="!session ? error : ''" @retry="load"
      ><template v-if="session"
        ><PageHeading class="page-heading"
          ><div>
            <p class="overline">{{ language('Session review', 'مراجعة الحصة') }}</p>
            <h1>{{ person?.display_name }}</h1>
            <p>
              {{ session.prescription.name }} ·
              {{ dateLabel(session.completed_at || session.started_at) }}
            </p>
          </div></PageHeading
        >
        <CommandStatus :command="command" :show-notice="false" />
        <RouterLink v-if="session.can_record" class="button" :to="'/record/' + session.id">{{
          language('Continue workout for athlete', 'متابعة تمرين الرياضي')
        }}</RouterLink>
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
                    <th>{{ language('Actual', 'النتيجة') }}</th>
                    <th>{{ language('Target', 'الهدف') }}</th>
                    <th>{{ language('Recorded', 'مسجلة') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="entry in session.entries.filter((e) => e.exercise_key === ex.key)"
                    :key="entry.set_index"
                  >
                    <td>{{ entry.set_index + 1 }}</td>
                    <td>
                      {{ entry.completed ? actualLabel(entry, ex.kind) : '–' }}
                    </td>
                    <td>{{ targetLabel(ex, ex.targets?.[entry.set_index] || ex) }}</td>
                    <td>{{ entry.completed ? language('Yes', 'نعم') : language('No', 'لا') }}</td>
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
            <form class="panel feedback-form" @submit.prevent="save">
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
              ><textarea id="review-note" v-model="note" rows="6" maxlength="2000"></textarea
              ><button class="button full" :disabled="busy || session.status !== 'completed'">
                <PhCheckCircle :size="20" />{{
                  busy ? t('loading') : language('Save review', 'حفظ المراجعة')
                }}
              </button>
              <p v-if="message" class="notice success" role="status">{{ message }}</p>
              <RouterLink v-if="message" class="button secondary full" :to="back"
                >{{ language('Continue reviewing', 'متابعة المراجعات') }} →</RouterLink
              >
              <p v-if="error" class="notice error" role="alert">{{ error }}</p>
            </form>
          </aside>
        </div></template
      ></PageState
    >
  </div>
</template>
