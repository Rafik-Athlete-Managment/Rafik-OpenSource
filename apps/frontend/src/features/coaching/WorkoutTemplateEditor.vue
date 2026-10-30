<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { institutionContext } from '../../app/institution'
import { user } from '../../app/auth'
import { request } from '../../lib/backend'
import { getDraft, storeDraft, removeDraft } from '../../lib/storage'
import { useCommand } from '../../lib/commands'
import { language as l, errorMessage } from '../../lib/i18n'
import type { Exercise, PlanDay } from '../../lib/domain'
import type { WorkoutTemplate } from '../../lib/workout-templates'
import PageHeading from '../../components/PageHeading.vue'
import PageState from '../../components/PageState.vue'
import CommandStatus from '../../components/CommandStatus.vue'
import WorkoutFields from './WorkoutFields.vue'
import WorkoutPreview from './WorkoutPreview.vue'
const route = useRoute(),
  router = useRouter(),
  context = institutionContext(),
  isNew = route.params.id === 'new',
  origin = route.fullPath
const key = `workout-template:${user.value!.id}:${context.institution}:${route.params.id}`
const id = ref(isNew ? crypto.randomUUID() : String(route.params.id)),
  title = ref(''),
  revision = ref(0),
  archived = ref(false),
  editable = ref(true),
  preview = ref(!isNew),
  loading = ref(true),
  error = ref(''),
  draftError = ref(''),
  catalog = ref<Exercise[]>([])
const workout = ref<PlanDay>({
  id: crypto.randomUUID(),
  name: '',
  nameAr: '',
  minutes: 30,
  exercises: [],
})
let initialized = false,
  disposed = false,
  generation = 0
onUnmounted(() => {
  disposed = true
  generation++
})
async function load() {
  loading.value = true
  error.value = ''
  try {
    catalog.value = (
      await request<Exercise[]>(`/v1/institution/catalog?view=${context.view}`, {
        feedback: 'none',
      })
    ).filter((e) => e.scope !== 'private' && e.active !== false)
    if (!isNew) {
      const data = await request<{ items: WorkoutTemplate[] }>(
        `/v1/institution/workout-templates?view=${context.view}&id=${id.value}`,
        { feedback: 'none' },
      )
      const item = data.items[0]
      if (!item) throw Error('workout_template_unavailable')
      if (disposed) return
      title.value = item.title
      workout.value = item.workout
      revision.value = item.revision
      archived.value = item.archived
      editable.value = item.can_edit
    }
    if (editable.value) {
      const stored = await getDraft<{
        id: string
        title: string
        workout: PlanDay
        revision: number
      }>(key)
      if (stored && !disposed) {
        id.value = stored.id
        title.value = stored.title
        workout.value = stored.workout
        revision.value = stored.revision
        preview.value = false
      }
    }
  } catch (e) {
    if (!disposed) error.value = errorMessage(e)
  } finally {
    if (!disposed) {
      initialized = true
      loading.value = false
    }
  }
}
watch(
  [title, workout],
  () => {
    if (!initialized || !editable.value) return
    const stamp = ++generation
    void storeDraft(key, {
      id: id.value,
      title: title.value,
      workout: workout.value,
      revision: revision.value,
    }).catch((e) => {
      if (!disposed && stamp === generation) draftError.value = errorMessage(e)
    })
  },
  { deep: true },
)
const command = useCommand(
  `workout-template-editor:${key}`,
  async (action, result) => {
    const row = result as WorkoutTemplate
    id.value = row.id
    revision.value = row.revision
    archived.value = row.archived
    await removeDraft(key)
    if (!disposed && route.fullPath === origin) {
      if (action === 'archive') await router.push('/workout-templates')
      else if (isNew) await router.replace('/workout-templates/' + id.value)
      else preview.value = true
    }
  },
  (_, args) =>
    request('/v1/institution/workout-templates', { method: 'POST', body: JSON.stringify(args) }),
  {
    successMessage: (action) =>
      action === 'archive'
        ? l('Workout template archive status updated.', 'تم تحديث حالة أرشفة القالب.')
        : l(
            'Workout template saved. Existing copies are unchanged.',
            'حُفظ قالب التمرين. لم تتغير النسخ السابقة.',
          ),
  },
)
const locked = computed(
  () => loading.value || !command.state.ready || command.state.busy || !!command.state.pending,
)
function save() {
  return command.run('save', {
    operation: crypto.randomUUID(),
    action: 'save',
    view: context.view,
    id: id.value,
    revision: revision.value,
    title: title.value,
    workout: { ...workout.value, name: title.value.trim() },
  })
}
function archive() {
  if (
    !window.confirm(
      l(
        'Change the archive status of this template? Existing copies will remain.',
        'هل تريد تغيير أرشفة القالب؟ ستبقى النسخ السابقة.',
      ),
    )
  )
    return
  return command.run('archive', {
    operation: crypto.randomUUID(),
    action: 'archive',
    view: context.view,
    id: id.value,
    revision: revision.value,
    archived: !archived.value,
  })
}
async function reloadSaved() {
  if (
    locked.value ||
    !window.confirm(
      l(
        'Discard this local draft and reload the saved template?',
        'هل تريد تجاهل المسودة المحلية وإعادة تحميل القالب المحفوظ؟',
      ),
    )
  )
    return
  try {
    await removeDraft(key)
    initialized = false
    await load()
    if (!disposed && !error.value) preview.value = true
  } catch (e) {
    if (!disposed) draftError.value = errorMessage(e)
  }
}
onMounted(load)
</script>
<template>
  <div class="container page workout-template-editor">
    <RouterLink class="back-link" to="/workout-templates">{{
      l('Workout templates', 'قوالب التمارين')
    }}</RouterLink
    ><PageHeading class="heading-actions"
      ><div>
        <h1>{{ isNew ? l('Create workout template', 'إنشاء قالب تمرين') : title }}</h1>
        <p>
          {{
            l(
              'Build a reusable workout for programs and group sessions. Existing copies stay unchanged.',
              'أنشئ تمريناً قابلاً لإعادة الاستخدام في البرامج والحصص الجماعية. تبقى النسخ السابقة دون تغيير.',
            )
          }}
        </p>
      </div>
      <div class="actions">
        <button
          v-if="editable && !isNew && !preview"
          type="button"
          class="button secondary danger-action"
          :disabled="locked"
          @click="reloadSaved"
        >
          {{ l('Reload saved template', 'إعادة تحميل القالب المحفوظ') }}
        </button>
        <button
          v-if="editable && !isNew"
          type="button"
          class="button secondary"
          :disabled="locked"
          @click="preview = !preview"
        >
          {{
            preview ? l('Edit template', 'تعديل القالب') : l('Preview workout', 'معاينة التمرين')
          }}</button
        ><button
          v-if="editable && !isNew"
          type="button"
          :class="archived ? 'button secondary' : 'button secondary danger-action'"
          :disabled="locked"
          @click="archive"
        >
          {{
            archived
              ? l('Restore template', 'استعادة القالب')
              : l('Archive template', 'أرشفة القالب')
          }}</button
        ><RouterLink
          v-if="!isNew && !archived"
          class="button secondary"
          :to="{ path: '/plans/new', query: { workoutTemplate: id } }"
          >{{ l('Use in a new program', 'استخدامه في برنامج جديد') }}</RouterLink
        >
      </div></PageHeading
    >
    <p v-if="draftError" class="notice" role="alert">{{ draftError }}</p>
    <CommandStatus v-if="!loading" :command="command" /><PageState
      :loading="loading"
      :error="error"
      @retry="load"
      ><WorkoutPreview
        v-if="preview || !editable"
        class="panel"
        :workout="workout"
        :catalog="catalog"
      />
      <form v-else @submit.prevent="save">
        <fieldset :disabled="locked" class="form-fields template-editor-fields">
          <section
            class="panel form-stack template-identity"
            aria-labelledby="workout-details-heading"
          >
            <h2 id="workout-details-heading">{{ l('Workout details', 'تفاصيل التمرين') }}</h2>
            <div class="field-pair">
              <label
                >{{ l('Workout name', 'اسم التمرين')
                }}<input
                  v-model="title"
                  maxlength="80"
                  required
                  :placeholder="
                    l('For example: Full-body strength', 'مثال: قوة الجسم بالكامل')
                  " /></label
              ><label
                >{{ l('Arabic workout name (optional)', 'اسم التمرين بالعربية (اختياري)')
                }}<input v-model="workout.nameAr" maxlength="80" dir="auto"
              /></label>
              <p class="small-print">
                {{
                  l(
                    'Shared templates use reference or institution exercises. Private exercises remain private.',
                    'تستخدم القوالب المشتركة تمارين مرجعية أو تابعة للمؤسسة. تبقى التمارين الخاصة خاصة.',
                  )
                }}
              </p>
            </div>
          </section>
          <WorkoutFields v-model="workout" :catalog="catalog" :disabled="locked" />
          <div class="editor-footer actions">
            <button class="button" :disabled="locked || !workout.exercises.length">
              {{ l('Save workout template', 'حفظ قالب التمرين') }}</button
            ><RouterLink class="button secondary danger-action" to="/workout-templates">{{
              l('Cancel', 'إلغاء')
            }}</RouterLink>
          </div>
        </fieldset>
      </form></PageState
    >
  </div>
</template>
<style scoped>
.template-editor-fields {
  display: grid;
  gap: var(--space-6);
}
.template-identity .field-pair {
  margin: 0;
  align-items: start;
}
.template-identity label {
  margin: 0;
  font-size: var(--text-small);
}
.template-identity input {
  margin: 0;
}
.template-identity .small-print {
  grid-column: 1 / -1;
  margin: 0;
}
.template-identity h2 {
  font-size: var(--text-panel);
  margin: 0;
}
.template-editor-fields > .editor-footer {
  margin: 0;
}
@media (max-width: 600px) {
  .template-identity .field-pair {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
