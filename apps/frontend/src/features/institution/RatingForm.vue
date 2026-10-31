<script setup lang="ts">
import { nextTick } from 'vue'
import { ref, computed, onMounted, watch } from 'vue'
import { user } from '../../app/auth'
import { request } from '../../lib/backend'
import { getDraft, storeDraft, removeDraft } from '../../lib/storage'
import { language as l, errorMessage } from '../../lib/i18n'
import { useCommand } from '../../lib/commands'
import CommandStatus from '../../components/CommandStatus.vue'
const props = defineProps<{
    institution: string
    view: string
    source: string
    subject: string
    score: number | null
    revision: number
    title: string
    subtitle?: string
  }>(),
  emit = defineEmits<{ saved: [] }>()
const key = `rating:${user.value!.id}:${props.institution}:${props.source}:${props.subject}`,
  score = ref<number | null>(props.score),
  revision = ref(props.revision),
  ready = ref(false),
  saved = ref(false),
  error = ref(''),
  editing = ref(!props.score)
let generation = 0
const command = useCommand<'save'>(
  key,
  async (_, result) => {
    ready.value = false
    revision.value = (result as { revision: number }).revision
    score.value = (result as { score: number }).score
    await nextTick()
    await removeDraft(key)
    saved.value = false
    editing.value = false
    ready.value = true
  },
  (_, args) =>
    request(`/v1/institution/feedback`, {
      method: 'POST',
      body: JSON.stringify(args),
    }),
  { successMessage: l('Feedback submitted.', 'تم إرسال التقييم.') },
)
watch(
  () => command.state.notice,
  (value) => {
    if (value) emit('saved')
  },
)
const locked = computed(
  () => !ready.value || !command.state.ready || command.state.busy || !!command.state.pending,
)
watch(score, async () => {
  if (!ready.value) return
  const current = ++generation
  command.state.notice = ''
  saved.value = false
  try {
    await storeDraft(key, { score: score.value, revision: revision.value })
    if (current === generation) saved.value = true
  } catch (e) {
    error.value = errorMessage(e)
  }
})
onMounted(async () => {
  try {
    const draft = await getDraft<{ score: number | null; revision: number }>(key)
    if (draft) {
      score.value = draft.score
      revision.value = draft.revision
      saved.value = true
      editing.value = true
    }
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    ready.value = true
  }
})
function save() {
  return command.run('save', {
    operation: crypto.randomUUID(),
    view: props.view,
    source: props.source,
    ...(props.source === 'workplace' ? { month: props.subject } : { id: props.subject }),
    score: score.value,
    revision: revision.value,
  })
}
async function discard() {
  try {
    ready.value = false
    await removeDraft(key)
    score.value = props.score
    revision.value = props.revision
    saved.value = false
    command.state.error = ''
    emit('saved')
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    ready.value = true
  }
}
const labels = computed(() => [
  l('Very dissatisfied', 'غير راضٍ جداً'),
  l('Dissatisfied', 'غير راضٍ'),
  l('Neutral', 'محايد'),
  l('Satisfied', 'راضٍ'),
  l('Very satisfied', 'راضٍ جداً'),
])
</script>
<template>
  <section class="panel rating-form">
    <header class="rating-heading">
      <div>
        <h2 dir="auto">{{ title }}</h2>
        <p v-if="subtitle" class="small-print">{{ subtitle }}</p>
      </div>
      <!-- Lets a long list be scanned for what still needs a response. -->
      <span class="tag" :data-status="props.score ? 'completed' : 'pending'">{{
        props.score ? l('Rated', 'تم التقييم') : l('Not rated yet', 'لم يُقيَّم بعد')
      }}</span>
    </header>
    <p v-if="!editing">
      {{ l('Your rating', 'تقييمك') }}: {{ score }} / 5 · {{ labels[(score || 1) - 1] }}
      <button class="text-link" :disabled="locked" @click="editing = true">
        {{ l('Change rating', 'تعديل التقييم') }}
      </button>
    </p>
    <form v-else @submit.prevent="save">
      <fieldset :disabled="locked">
        <legend>
          {{
            source === 'workplace'
              ? l(
                  'How satisfied are you with working at this institution this month?',
                  'ما مدى رضاك عن العمل في هذه المؤسسة هذا الشهر؟',
                )
              : l('How satisfied were you with this session?', 'ما مدى رضاك عن هذه الجلسة؟')
          }}
        </legend>
        <div class="rating-choices">
          <label
            v-for="(label, index) in labels"
            :key="index"
            :class="{ selected: score === index + 1 }"
            ><input
              v-model="score"
              type="radio"
              :name="key"
              :value="index + 1"
              required
            /><strong>{{ index + 1 }}</strong
            ><span>{{ label }}</span></label
          >
        </div>
        <button class="button small" :disabled="score === null || score === props.score">
          {{ l('Save rating', 'حفظ التقييم') }}
        </button>
      </fieldset>
    </form>
    <p v-if="saved" role="status" class="small-print">
      {{ l('Draft saved on this device.', 'حُفظت المسودة على هذا الجهاز.') }}
    </p>
    <p v-if="error" role="alert" class="notice error">{{ error }}</p>
    <CommandStatus :command="command" /><button
      v-if="command.state.error && !command.state.pending"
      class="text-link danger-action"
      @click="discard"
    >
      {{ l('Reload rating and discard draft', 'إعادة تحميل التقييم وحذف المسودة') }}
    </button>
  </section>
</template>
<style scoped>
.rating-form {
  margin-block: 1rem;
}
.rating-form h2 {
  font-size: 1.1rem;
  margin: 0;
}
.rating-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}
.rating-heading .small-print {
  margin: var(--space-1) 0 0;
  color: var(--muted);
}
.rating-form fieldset {
  border: 0;
  padding: 0;
  min-width: 0;
}
.rating-form legend {
  margin-block: 1rem;
  font-weight: 600;
}
.rating-choices {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.5rem;
  margin-block: 1rem;
}
.rating-choices label {
  display: flex;
  flex-wrap: wrap;
  align-content: start;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 0.5rem;
  border: 1px solid var(--line);
  border-radius: 8px;
  text-align: center;
  cursor: pointer;
  min-width: 0;
}
.rating-choices label.selected {
  background: var(--tint);
  border-color: var(--accent);
}
.rating-choices input {
  width: 18px;
  height: 18px;
  min-height: 0;
  padding: 0;
  margin: 0;
}
.rating-choices span {
  width: 100%;
  font-size: 0.8rem;
  overflow-wrap: anywhere;
}
@media (max-width: 540px) {
  .rating-choices {
    grid-template-columns: minmax(0, 1fr);
  }
  .rating-choices label {
    justify-content: start;
    text-align: start;
  }
  .rating-choices span {
    width: auto;
    flex: 1;
  }
}
</style>
