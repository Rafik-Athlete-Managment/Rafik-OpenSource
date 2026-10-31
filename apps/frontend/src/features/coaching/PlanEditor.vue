<script setup lang="ts">
import PageHeading from '../../components/PageHeading.vue'
import WorkoutTemplatePicker from './WorkoutTemplatePicker.vue'
import SidePanel from '../../components/SidePanel.vue'
import { copyWorkout, type WorkoutTemplate } from '../../lib/workout-templates'
import WorkoutExerciseCard from './WorkoutExerciseCard.vue'
import WorkoutPreview from './WorkoutPreview.vue'
import EmptyState from '../../components/EmptyState.vue'
import ProgramCover from './ProgramCover.vue'
import { request } from '../../lib/backend'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { PhArrowLeft, PhPlus, PhTrash, PhEye, PhBarbell, PhCopy } from '@phosphor-icons/vue'
import { user } from '../../app/auth'
import { duplicateSession, duplicateWeek } from './program-structure'
import { programContext } from './program-context'
import { useCommand } from '../../lib/commands'
import CommandStatus from '../../components/CommandStatus.vue'
import { clone, type Plan, type PlanVersion, type Prescription } from '../../lib/domain'
import { getDraft, storeDraft, removeDraft } from '../../lib/storage'
import { language, locale, t, errorMessage } from '../../lib/i18n'
import { upgradePrescription } from '../../lib/prescriptions'
import type { Exercise } from '../../lib/domain'
import PageState from '../../components/PageState.vue'
import type { AthletePlanSummary } from '@rafik/shared/contracts'
const props = defineProps<{ assignedPlan?: AthletePlanSummary }>()
const emit = defineEmits<{ adapted: [] }>()
const route = useRoute(),
  router = useRouter()
const context = programContext(route)
const editable = ref(context.view !== 'trainee')
const isNew = !!props.assignedPlan || route.params.id === 'new'
const id = ref(isNew ? crypto.randomUUID() : String(route.params.id))
const title = ref(language('New program', 'برنامج جديد'))
const blankPrescription = (): Prescription => ({
  schema: 2,
  cycleWeeks: 1,
  days: [
    {
      id: crypto.randomUUID(),
      name: language('Session 1', 'الحصة ١'),
      nameAr: '',
      minutes: 30,
      week: 1,
      weekday: 0,
      exercises: [],
    },
  ],
})
const draft = ref<Prescription>(blankPrescription())
const version = ref<number | null>(null)
const selected = ref(0)
const loadedSuccessfully = ref(false)
const loading = ref(true),
  preview = ref(false),
  restored = ref(false)
const error = ref(''),
  message = ref('')
const published = ref<PlanVersion>()
const assignableVersionId = ref('')
const uploading = ref(false)
const form = ref<HTMLFormElement>()
const coverInput = ref<HTMLInputElement>()
const coverDrag = ref(false)
let initialized = false
const keyFor = (id: string) => `plan:${user.value!.id}:${context.key}:${id}`
const key =
  keyFor(
    props.assignedPlan
      ? `assignment:${props.assignedPlan.id}:${props.assignedPlan.version.id}`
      : String(route.params.id),
  ) +
  (route.query.source ? `:source:${route.query.source}:member:${route.query.member || ''}` : '') +
  (!props.assignedPlan && isNew && route.query.workoutTemplate
    ? `:workout-template:${route.query.workoutTemplate}`
    : '')
const importingWorkout = ref(false)
function importWorkout(template: WorkoutTemplate) {
  const replace =
    draft.value.days.length === 1 &&
    !draft.value.days[0]!.exercises.length &&
    !draft.value.days[0]!.restDay
  const slot = replace
    ? { week: draft.value.days[0]!.week || 1, weekday: draft.value.days[0]!.weekday || 0 }
    : freeSlot()
  if (!slot) {
    error.value = language(
      'Add a cycle week before importing another workout.',
      'أضف أسبوعاً للدورة قبل استيراد تمرين آخر.',
    )
    return
  }
  const copied = copyWorkout(template.workout, slot)
  if (replace) draft.value.days.splice(0, 1, copied)
  else draft.value.days.push(copied)
  selected.value = draft.value.days.length - 1
  importingWorkout.value = false
}
const day = computed(() => draft.value.days[selected.value]!)
const catalog = ref<Exercise[]>([])
const activeCatalog = computed(() => catalog.value.filter((exercise) => exercise.active !== false))
function restDay() {
  if (day.value.restDay) day.value.exercises = []
}
function freeSlot() {
  for (let week = 1; week <= (draft.value.cycleWeeks || 1); week++)
    for (let weekday = 0; weekday < 7; weekday++)
      if (!draft.value.days.some((d) => d.week === week && d.weekday === weekday))
        return { week, weekday }
  return null
}
async function load(recover = true) {
  loadedSuccessfully.value = false
  loading.value = true
  error.value = ''
  try {
    if (isNew) {
      catalog.value = await context.catalog()
      if (props.assignedPlan) {
        title.value = props.assignedPlan.version.title
        draft.value = upgradePrescription(
          clone(props.assignedPlan.version.prescription as Prescription),
        )
        version.value = null
      } else if (route.query.source) {
        const source = await context.load(String(route.query.source))
        title.value = source.program.title.slice(0, 85) + language(' copy', ' نسخة')
        draft.value = upgradePrescription(clone(source.program.draft))
        version.value = null
      }
    } else {
      const loaded = await context.load(id.value)
      if (!loaded.program) throw Error('not_found')
      catalog.value = loaded.catalog
      editable.value = loaded.editable
      title.value = loaded.program.title
      draft.value = upgradePrescription(clone(loaded.program.draft))
      version.value = loaded.program.draft_version
      assignableVersionId.value = loaded.versions[0]?.id || ''
      if (!loaded.editable) {
        preview.value = true
        initialized = true
        loadedSuccessfully.value = true
        return
      }
    }
    if (recover) {
      const local = await getDraft<{
        id: string
        title: string
        draft: Prescription
        version: number | null
      }>(key)
      if (local && (isNew || local.id === id.value)) {
        id.value = local.id
        title.value = local.title
        draft.value = upgradePrescription(local.draft)
        version.value = local.version
        restored.value = true
        initialized = true
        loadedSuccessfully.value = true
        return
      }
    }
    if (isNew && !props.assignedPlan && route.query.workoutTemplate) {
      const page = await request<{ items: WorkoutTemplate[] }>(
        `/v1/institution/workout-templates?view=${context.view}&id=${encodeURIComponent(String(route.query.workoutTemplate))}`,
        { feedback: 'none' },
      )
      const template = page.items[0]
      if (!template || template.archived) throw Error('workout_template_unavailable')
      importWorkout(template)
    }
    initialized = true
    loadedSuccessfully.value = true
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
watch(
  [title, draft],
  () => {
    if (initialized) {
      message.value = ''
      void storeDraft(key, {
        id: id.value,
        title: title.value,
        draft: draft.value,
        version: version.value,
      }).catch(() => {
        error.value = language(
          'This browser could not save the draft. Save your plan before leaving.',
          'تعذر حفظ المسودة في المتصفح. احفظ الخطة قبل المغادرة.',
        )
      })
    }
  },
  { deep: true },
)
// Old assignment-editor commands meant library publication. Never replay them as adaptation.
const previousCopy = props.assignedPlan
  ? useCommand<'save' | 'publish'>(
      `program:${key}`,
      async () => {},
      (action, args) => context.command(action, args),
      { successToast: false },
    )
  : undefined
const command = useCommand<'save' | 'publish'>(
  props.assignedPlan ? `athlete-plan-adaptation:${key}` : `program:${key}`,
  async (action, result) => {
    if (props.assignedPlan) {
      await removeDraft(key)
      restored.value = false
      emit('adapted')
      return
    }
    const value = result as { plan: Plan; version?: PlanVersion }
    version.value = value.plan.draft_version
    restored.value = false
    if (action === 'publish') {
      published.value = value.version
      assignableVersionId.value = value.version?.id || assignableVersionId.value
      await removeDraft(key)
    } else
      await storeDraft(key, {
        id: id.value,
        title: title.value,
        draft: draft.value,
        version: version.value,
      })
    message.value =
      action === 'publish'
        ? language(
            'Published and added to the institution program library.',
            'تم النشر وإضافته إلى مكتبة برامج المؤسسة.',
          )
        : language(
            'Draft saved. Current assignments are unchanged.',
            'حُفظت المسودة. التعيينات الحالية لم تتغير.',
          )
  },
  (action, args) =>
    props.assignedPlan
      ? request('/v1/institution/delivery', {
          method: 'POST',
          body: JSON.stringify({
            ...args,
            action: 'adapt',
            view: context.view,
          }),
        })
      : context.command(action, args),
  {
    successMessage: (action) =>
      props.assignedPlan
        ? language(
            'Athlete plan updated. Existing scheduled workouts are unchanged.',
            'تم تحديث خطة الرياضي. لم تتغير التمارين المجدولة الحالية.',
          )
        : action === 'publish'
          ? language(
              'Program published to the institution library.',
              'تم نشر البرنامج في مكتبة المؤسسة.',
            )
          : language('Program draft saved.', 'تم حفظ مسودة البرنامج.'),
  },
)
const busy = computed(
  () =>
    uploading.value ||
    command.state.busy ||
    !!command.state.pending ||
    !command.state.ready ||
    !!previousCopy?.state.pending ||
    (previousCopy ? !previousCopy.state.ready : false),
)
async function execute(action: 'save' | 'publish') {
  if (!editable.value || !form.value?.reportValidity()) return
  error.value = ''
  message.value = ''
  const wasBusy = busy.value
  await command.run(action, {
    operation: crypto.randomUUID(),
    id: id.value,
    title: title.value,
    draft: clone(draft.value),
    revision: props.assignedPlan ? props.assignedPlan.revision : version.value,
    ...(props.assignedPlan
      ? {
          assignment: props.assignedPlan.id,
          source_version_id: props.assignedPlan.version.id,
        }
      : {}),
  })
  if (
    action === 'save' &&
    !wasBusy &&
    !command.state.busy &&
    !command.state.pending &&
    !command.state.error
  ) {
    document
      .querySelector<HTMLElement>('.dashboard-frame > main')
      ?.scrollTo({ top: 0, behavior: 'smooth' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}
const save = () => execute('save')
const publish = () => execute('publish')
async function uploadCoverFile(file?: File) {
  if (!file) return
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2097152) {
    error.value = language(
      'Choose a JPG, PNG or WebP image up to 2 MB.',
      'اختر صورة JPG أو PNG أو WebP حتى ٢ ميغابايت.',
    )
    if (coverInput.value) coverInput.value.value = ''
    return
  }
  const institution = context.institution
  if (!institution) return
  uploading.value = true
  error.value = ''
  try {
    const digest = [
      ...new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer())),
    ]
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('')
    const prior = await getDraft<{ digest: string; id: string }>(key + ':cover-upload')
    const mediaId = prior?.digest === digest ? prior.id : crypto.randomUUID()
    await storeDraft(key + ':cover-upload', { digest, id: mediaId })
    await request(`/v1/program-media/${mediaId}?institution=${institution}`, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
      feedback: 'success',
      successMessage: language('Program cover uploaded.', 'تم رفع صورة البرنامج.'),
    })
    draft.value.presentation ||= {}
    draft.value.presentation.cover = mediaId
    await removeDraft(key + ':cover-upload')
  } catch (e) {
    error.value =
      errorMessage(e) +
      ' ' +
      language('Choose the same file again to retry.', 'اختر الملف نفسه لإعادة المحاولة.')
  } finally {
    uploading.value = false
    if (coverInput.value) coverInput.value.value = ''
  }
}
function uploadCover(event: Event) {
  void uploadCoverFile((event.target as HTMLInputElement).files?.[0])
}
function dropCover(event: DragEvent) {
  event.preventDefault()
  coverDrag.value = false
  void uploadCoverFile(event.dataTransfer?.files[0])
}
function addExercise() {
  const first = activeCatalog.value[0]
  if (!first) {
    error.value = language(
      'Add an exercise to your library before building this session.',
      'أضف تمريناً إلى مكتبتك قبل إنشاء هذه الحصة.',
    )
    return
  }
  day.value.exercises.push({
    key: crypto.randomUUID(),
    exerciseId: first.id,
    kind: first.kind || 'strength',
    seconds: 30,
    metres: 100,
    sets: 3,
    reps: 10,
    load: 0,
    unit: 'kg',
    rest: 60,
    note: '',
  })
}
function addDay() {
  const slot = freeSlot()
  if (!slot) {
    error.value = language(
      'Add a cycle week before adding more days.',
      'أضف أسبوعاً للدورة قبل إضافة أيام.',
    )
    return
  }
  const d = clone(
    draft.value.days.find((d) => !d.restDay) || {
      id: crypto.randomUUID(),
      name: '',
      minutes: 30,
      exercises: [],
    },
  )
  Object.assign(d, slot)
  d.id = crypto.randomUUID()
  d.name = language('New session', 'حصة جديدة')
  d.nameAr = ''
  d.exercises.forEach((e) => (e.key = crypto.randomUUID()))
  draft.value.days.push(d)
  selected.value = draft.value.days.length - 1
}
function joinPrevious(index: number) {
  const previous = day.value.exercises[index - 1]!
  previous.group ||= language('Superset', 'مجموعة مركبة') + ' ' + index
  day.value.exercises[index]!.group = previous.group
}
function move(index: number, offset: number) {
  const ex = day.value.exercises.splice(index, 1)[0]!
  day.value.exercises.splice(index + offset, 0, ex)
}
async function discard() {
  initialized = false
  await removeDraft(key)
  restored.value = false
  selected.value = 0
  if (props.assignedPlan) await load(false)
  else if (isNew) {
    title.value = language('New program', 'برنامج جديد')
    draft.value = blankPrescription()
    version.value = null
    id.value = crypto.randomUUID()
    initialized = true
  } else await load(false)
}
async function duplicate() {
  const newId = crypto.randomUUID()
  await storeDraft(keyFor(newId), {
    id: newId,
    title: title.value.slice(0, 85) + language(' copy', ' نسخة'),
    draft: clone(draft.value),
    version: null,
  })
  await storeDraft(keyFor('new'), {
    id: newId,
    title: title.value.slice(0, 85) + language(' copy', ' نسخة'),
    draft: clone(draft.value),
    version: null,
  })
  await router.push(
    context.base + '/plans/new' + (route.query.member ? '?member=' + route.query.member : ''),
  )
}
onMounted(() => load())
function copySession() {
  try {
    draft.value = duplicateSession(draft.value, selected.value, language(' copy', ' نسخة'))
    selected.value = draft.value.days.length - 1
  } catch (e) {
    error.value = errorMessage(e)
  }
}
function copyWeek() {
  try {
    const old = day.value.week || 1
    draft.value = duplicateWeek(draft.value, old)
    selected.value = draft.value.days.findIndex((d) => d.week === draft.value.cycleWeeks)
  } catch (e) {
    error.value = errorMessage(e)
  }
}
function removeDay() {
  draft.value.days.splice(selected.value, 1)
  selected.value = 0
}
</script>
<template>
  <div :class="assignedPlan ? 'editor-page assigned-editor' : 'container page editor-page'">
    <RouterLink v-if="!assignedPlan" class="back-link" :to="context.base + '/plans'"
      ><PhArrowLeft :size="18" aria-hidden="true" class="directional" />{{
        language('Programs', 'البرامج')
      }}</RouterLink
    >
    <PageHeading class="page-heading heading-actions">
      <div>
        <p class="overline">
          {{
            context.view === 'trainee'
              ? language('My program', 'برنامجي')
              : language('Plan studio', 'تصميم الخطة')
          }}
        </p>
        <component :is="assignedPlan ? 'h2' : 'h1'">
          {{
            assignedPlan
              ? language('Adapt athlete plan', 'تعديل خطة الرياضي')
              : route.query.source
                ? language('Create a program copy', 'إنشاء نسخة من البرنامج')
                : isNew
                  ? language('Create a program', 'إنشاء برنامج')
                  : editable
                    ? language('Edit program', 'تعديل البرنامج')
                    : title
          }}
        </component>
      </div>
    </PageHeading>
    <!-- One sticky action bar keeps preview, assign, save and publish reachable while editing. -->
    <div
      v-if="!loading && context.view !== 'trainee' && (editable || assignableVersionId || !isNew)"
      class="editor-toolbar"
      role="toolbar"
      :aria-label="language('Program actions', 'إجراءات البرنامج')"
    >
      <!-- View and copy tools sit apart from the save/assign/publish flow. -->
      <div v-if="!editable" class="editor-toolbar-tools">
        <button type="button" class="button secondary small" :disabled="busy" @click="duplicate">
          <PhCopy :size="18" aria-hidden="true" />{{
            language('Make an editable copy', 'إنشاء نسخة للتعديل')
          }}
        </button>
      </div>
      <div v-if="editable" class="editor-toolbar-tools">
        <button type="button" class="button secondary small" @click="preview = !preview">
          <PhEye :size="18" aria-hidden="true" />{{
            preview
              ? language('Edit program', 'تعديل البرنامج')
              : language('Athlete preview', 'معاينة الرياضي')
          }}
        </button>
        <button
          v-if="!isNew"
          type="button"
          class="button secondary small"
          :disabled="busy"
          @click="duplicate"
        >
          <PhCopy :size="18" aria-hidden="true" />{{ language('Duplicate', 'إنشاء نسخة') }}
        </button>
      </div>
      <div class="editor-toolbar-actions">
        <RouterLink
          v-if="assignableVersionId && !published && context.view !== 'trainee'"
          class="button small"
          :class="{ secondary: editable }"
          :to="context.base + '/deliver/' + assignableVersionId"
        >
          {{ language('Assign this program', 'تعيين هذا البرنامج') }}
        </RouterLink>
        <template v-if="editable">
          <button
            v-if="!assignedPlan"
            type="submit"
            form="program-editor-form"
            class="button secondary small"
            :disabled="busy"
          >
            {{ language('Save draft', 'حفظ المسودة') }}</button
          ><button type="button" class="button small" :disabled="busy" @click="publish">
            {{
              busy
                ? t('loading')
                : assignedPlan
                  ? language('Apply changes to athlete plan', 'تطبيق التعديلات على خطة الرياضي')
                  : language('Publish program', 'نشر البرنامج')
            }}
          </button>
        </template>
      </div>
    </div>
    <p v-if="editable && !loading" class="small-print editor-publish-note">
      {{
        assignedPlan
          ? language(
              'Changes apply only to this athlete plan and future workouts. Existing scheduled/started workouts and the library program remain unchanged.',
              'تخص التعديلات خطة هذا الرياضي وتمارينه المستقبلية فقط. لا تتغير التمارين المجدولة أو التي بدأت ولا برنامج المكتبة.',
            )
          : language(
              'Publishing creates a fixed version and makes it available in the institution program library. Assignments remain a separate step.',
              'ينشئ النشر نسخة ثابتة ويتيحها في مكتبة برامج المؤسسة. يبقى التعيين خطوة منفصلة.',
            )
      }}
    </p>
    <PageState :loading="loading" :error="!loadedSuccessfully ? error : ''" @retry="load()"
      ><p v-if="restored" class="notice">
        {{ language('Your local draft has been restored.', 'تم استرداد مسودتك المحلية.') }}
        <button class="text-link danger-action" @click="discard">
          {{ language('Discard local changes', 'تجاهل التعديلات المحلية') }}
        </button>
      </p>
      <p v-if="error" class="notice error" role="alert">
        {{ error }}
        <button v-if="!isNew" class="text-link danger-action" @click="discard">
          {{
            language(
              'Reload saved plan (discards this draft)',
              'إعادة تحميل الخطة المحفوظة وحذف هذه المسودة',
            )
          }}
        </button>
      </p>
      <p v-if="published && !command.state.busy && !command.state.pending" class="actions">
        <RouterLink
          v-if="published"
          :to="
            context.base +
            '/deliver/' +
            published.id +
            (route.query.member ? '?member=' + route.query.member : '')
          "
          class="text-link"
          >{{ language('Assign this plan', 'تعيين هذه الخطة') }}</RouterLink
        >
      </p>
      <template v-if="previousCopy?.state.pending">
        <p class="notice">
          {{
            language(
              'An earlier library-copy operation is awaiting confirmation. Resolve its saved request first; it does not update this athlete plan.',
              'تنتظر عملية سابقة لنسخ البرنامج تأكيداً. عالج طلبها المحفوظ أولاً؛ فهي لا تحدّث خطة الرياضي.',
            )
          }}
        </p>
        <CommandStatus :command="previousCopy" />
      </template>
      <CommandStatus :command="command" :show-notice="false" />
      <form id="program-editor-form" ref="form" @submit.prevent="assignedPlan ? publish() : save()">
        <fieldset :disabled="busy" class="form-fields">
          <section v-if="!preview" class="program-identity-card">
            <div
              class="program-cover-drop"
              :class="{ dragging: coverDrag }"
              @dragover.prevent="coverDrag = true"
              @dragleave="coverDrag = false"
              @drop="dropCover"
            >
              <ProgramCover v-if="draft.presentation?.cover" :id="draft.presentation.cover" />
              <div v-else class="cover-placeholder">
                <PhBarbell :size="36" aria-hidden="true" />
              </div>
              <button type="button" class="cover-change" @click="coverInput?.click()">
                {{
                  draft.presentation?.cover
                    ? language('Change cover image', 'تغيير صورة الغلاف')
                    : language('Add a cover image', 'إضافة صورة غلاف')
                }}
              </button>
              <input
                ref="coverInput"
                class="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                :aria-label="language('Upload a program cover image', 'تحميل صورة غلاف البرنامج')"
                @change="uploadCover"
              />
              <button
                v-if="draft.presentation?.cover"
                type="button"
                class="text-link danger-action"
                @click="delete draft.presentation.cover"
              >
                {{ language('Remove cover', 'إزالة الغلاف') }}
              </button>
              <small>{{
                language(
                  'Drop JPG, PNG or WebP · up to 2 MB',
                  'أفلت JPG أو PNG أو WebP · حتى ٢ ميغابايت',
                )
              }}</small>
            </div>
            <div class="program-identity-fields">
              <label for="plan-title">{{
                assignedPlan
                  ? language('Plan name', 'اسم الخطة')
                  : language('Program name', 'اسم البرنامج')
              }}</label>
              <input id="plan-title" v-model="title" required maxlength="100" class="title-input" />
              <label for="program-description">{{
                language('What athletes can expect', 'ماذا يتوقع الرياضيون')
              }}</label>
              <textarea
                id="program-description"
                v-model="draft.description"
                maxlength="1000"
                rows="3"
              />
              <label for="program-description-ar">{{
                language('Arabic description (optional)', 'الوصف بالعربية (اختياري)')
              }}</label>
              <textarea
                id="program-description-ar"
                v-model="draft.descriptionAr"
                maxlength="1000"
                rows="2"
              />
              <div class="program-recognition-fields">
                <label for="program-goal"
                  >{{ language('Main goal', 'الهدف الرئيسي')
                  }}<input
                    id="program-goal"
                    :value="draft.presentation?.goal"
                    maxlength="160"
                    @input="
                      draft.presentation = {
                        ...draft.presentation,
                        goal: ($event.target as HTMLInputElement).value,
                      }
                    "
                /></label>
                <label for="program-level"
                  >{{ language('Experience level', 'مستوى الخبرة')
                  }}<select
                    id="program-level"
                    :value="draft.presentation?.level || 'mixed'"
                    @change="
                      draft.presentation = {
                        ...draft.presentation,
                        level: ($event.target as HTMLSelectElement).value as
                          'beginner' | 'mixed' | 'experienced',
                      }
                    "
                  >
                    <option value="mixed">{{ language('Adaptable', 'قابل للتكييف') }}</option>
                    <option value="beginner">{{ language('Getting started', 'للمبتدئين') }}</option>
                    <option value="experienced">{{ language('Experienced', 'ذوو خبرة') }}</option>
                  </select></label
                >
              </div>
              <p class="small-print">
                {{
                  language(
                    'Changes stay on this device until you save as a draft or publish.',
                    'تبقى التغييرات على هذا الجهاز حتى تحفظها كمسودة أو تنشرها.',
                  )
                }}
              </p>
            </div>
          </section>
          <section v-else class="program-preview-heading">
            <ProgramCover :id="draft.presentation?.cover" />
            <div>
              <template v-if="editable">
                <p class="overline">{{ language('Program preview', 'معاينة البرنامج') }}</p>
                <h2>{{ title }}</h2>
              </template>
              <p v-if="draft.description">
                {{ locale === 'ar' ? draft.descriptionAr || draft.description : draft.description }}
              </p>
              <p v-if="draft.presentation?.goal">{{ draft.presentation.goal }}</p>
            </div>
          </section>
          <details open v-if="!preview" class="program-schedule">
            <summary>
              {{ language('Program schedule', 'جدول البرنامج') }}
            </summary>
            <label v-if="!assignedPlan" class="program-preparation">
              <input v-model="draft.automaticPreparation" type="checkbox" />
              {{
                language(
                  'Default to automatic daily preparation',
                  'التحضير اليومي التلقائي افتراضياً',
                )
              }}
            </label>
            <p v-if="!assignedPlan" class="small-print">
              {{
                language(
                  'Suggested for new athlete plans. Confirm dates and timezone when assigning; each plan can override this. Editing the program never changes existing scheduling policies.',
                  'اقتراح للخطط الجديدة. أكّد التواريخ والمنطقة الزمنية عند التعيين؛ يمكن تغييره لكل خطة. تعديل البرنامج لا يغيّر سياسات الجدولة الحالية.',
                )
              }}
            </p>
            <label
              >{{ language('Repeat every (weeks)', 'التكرار كل (أسابيع)')
              }}<input v-model.number="draft.cycleWeeks" type="number" min="1" max="12" required
            /></label>
            <p v-if="!preview" class="small-print">
              {{
                language(
                  `This ${draft.cycleWeeks || 1}-week plan repeats every ${(draft.cycleWeeks || 1) * 7} days from the assignment start date. Days without a workout are rest days. Use one week for a simple weekly routine.`,
                  `تتكرر الخطة كل ${(draft.cycleWeeks || 1) * 7} أيام من تاريخ البدء. الأيام دون تمارين أيام راحة. اختر أسبوعاً واحداً لروتين أسبوعي بسيط.`,
                )
              }}
              <RouterLink :to="context.base + '/exercises'" target="_blank"
                >{{
                  language('Manage your exercise library', 'إدارة مكتبة التمارين')
                }}
                ↗</RouterLink
              >
            </p>
          </details>
          <div v-if="!preview" class="actions">
            <button type="button" class="button secondary" @click="importingWorkout = true">
              {{ language('Import workout template', 'استيراد قالب تمرين') }}
            </button>
          </div>
          <SidePanel
            v-model:open="importingWorkout"
            :title="language('Import workout template', 'استيراد قالب تمرين')"
            :description="
              language(
                'Adds an independent copy to this program. Later template edits do not change it.',
                'يضيف نسخة مستقلة إلى البرنامج. لا تغيرها تعديلات القالب اللاحقة.',
              )
            "
            ><WorkoutTemplatePicker @choose="importWorkout"
          /></SidePanel>
          <div class="day-tabs">
            <button
              v-for="(d, i) in draft.days"
              :key="d.id"
              type="button"
              :class="{ selected: selected === i }"
              @click="selected = i"
            >
              {{ language('W', 'أ') }}{{ d.week }} ·
              {{ locale === 'ar' ? d.nameAr || d.name : d.name }}</button
            ><button v-if="!preview && draft.days.length < 84" type="button" @click="addDay">
              <PhPlus :size="18" />{{ language('Add day', 'إضافة يوم') }}
            </button>
          </div>
          <section v-if="day" class="editor-day">
            <div v-if="!preview" class="actions session-reuse">
              <button type="button" class="text-link" @click="copySession">
                {{ language('Duplicate session', 'نسخ الحصة') }}</button
              ><button type="button" class="text-link" @click="copyWeek">
                {{ language('Duplicate this week', 'نسخ هذا الأسبوع') }}
              </button>
            </div>
            <div v-if="!preview" class="day-settings">
              <label
                >{{ language('Session name', 'اسم الحصة')
                }}<input v-model="day.name" required maxlength="80" /></label
              ><label
                >{{ language('Arabic name (optional)', 'الاسم بالعربية (اختياري)')
                }}<input v-model="day.nameAr" maxlength="80" /></label
              ><label
                >{{ language('Minutes', 'الدقائق')
                }}<input
                  v-model.number="day.minutes"
                  type="number"
                  min="5"
                  max="180"
                  required /></label
              ><button
                v-if="draft.days.length > 1"
                class="icon-button danger danger-action"
                type="button"
                :aria-label="language('Remove this day', 'حذف اليوم')"
                @click="removeDay"
              >
                <PhTrash :size="20" />
              </button>
            </div>
            <div v-if="!preview" class="field-pair cycle-settings">
              <label
                >{{ language('Cycle week', 'أسبوع الدورة')
                }}<input
                  v-model.number="day.week"
                  type="number"
                  min="1"
                  :max="draft.cycleWeeks"
                  required /></label
              ><label
                >{{ language('Day of cycle week', 'اليوم في أسبوع الدورة')
                }}<select v-model.number="day.weekday">
                  <option v-for="n in 7" :key="n" :value="n - 1">
                    {{ language('Day', 'اليوم') }} {{ n }}
                  </option>
                </select></label
              ><label class="check-label"
                ><input v-model="day.restDay" type="checkbox" @change="restDay" />{{
                  language('Rest day', 'يوم راحة')
                }}</label
              >
            </div>
            <p v-if="day.restDay" class="notice">
              {{
                language('Recovery day. No workout to record.', 'يوم تعافٍ. لا يوجد تمرين للتسجيل.')
              }}
            </p>
            <h2 v-if="!preview && !day.restDay" class="program-exercises-heading">
              {{ language('Exercises', 'التمارين') }}
            </h2>
            <EmptyState
              v-if="!preview && !day.restDay && !day.exercises.length"
              class="program-workout-empty"
              :title="language('Start with a real exercise', 'ابدأ بتمرين فعلي')"
              :description="
                language(
                  'Choose an exercise from your library. Nothing is prefilled.',
                  'اختر تمريناً من مكتبتك. لا توجد تمارين مضافة مسبقاً.',
                )
              "
            >
              <button type="button" class="button secondary full" @click="addExercise">
                <PhPlus :size="18" />{{ language('Add exercise', 'إضافة تمرين') }}
              </button>
            </EmptyState>
            <div v-if="!preview && !day.restDay" class="program-exercise-cards">
              <WorkoutExerciseCard
                v-for="(ex, i) in day.exercises"
                :key="ex.key"
                :model-value="ex"
                :catalog="catalog"
                :index="i"
                :total="day.exercises.length"
                :previous-group="day.exercises[i - 1]?.group"
                :disabled="busy"
                :remove-disabled="day.exercises.length === 1"
                @update:model-value="day.exercises[i] = $event"
                @move="move(i, $event)"
                @remove="day.exercises.splice(i, 1)"
                @pair="joinPrevious(i)"
              />
              <button
                v-if="day.exercises.length && day.exercises.length < 12"
                type="button"
                class="button secondary full"
                @click="addExercise"
              >
                <PhPlus :size="18" />{{ language('Add exercise', 'إضافة تمرين') }}
              </button>
            </div>
            <WorkoutPreview
              v-if="preview && !day.restDay"
              :workout="day"
              :catalog="catalog"
              show-instructions
            />
          </section>
        </fieldset></form
    ></PageState>
  </div>
</template>

<style scoped>
.program-exercise-cards {
  display: grid;
  gap: var(--space-4);
}
.program-workout-empty :deep(.actions) {
  width: 100%;
}
.program-exercises-heading {
  font-size: var(--text-section);
  margin: 0 0 var(--space-4);
}
</style>
<style>
.editor-toolbar {
  position: sticky;
  /* Below the sticky phone/tablet header; 0 where the institution itself scrolls. */
  top: var(--dashboard-sticky-top, 0);
  z-index: 5;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 16px;
  margin-block: 0 8px;
  padding: 12px 0;
  border-block-end: 1px solid var(--line);
  background: var(--page);
}
.editor-toolbar .button {
  margin: 0;
}
.editor-toolbar-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}
.editor-toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px 12px;
  margin-inline-start: auto;
}
@media (max-width: 600px) {
  /* The wrapped phone bar would cover a fifth of the screen; keep it at the top, unpinned. */
  .editor-toolbar {
    position: static;
  }
}
.editor-publish-note {
  max-width: 72ch;
  margin: 0 0 20px;
}
.program-identity-card {
  display: grid;
  grid-template-columns: minmax(220px, 0.72fr) minmax(0, 1.5fr);
  gap: 24px;
  align-items: start;
  margin: 0 0 28px;
  padding: 24px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--surface);
  text-align: start;
}
.program-cover-drop {
  display: grid;
  justify-items: start;
  align-content: start;
  gap: 10px;
  min-height: 220px;
  padding: 12px;
  border: 1px dashed var(--line);
  border-radius: 12px;
  background: var(--surface-soft);
  transition:
    border-color 120ms ease,
    background-color 120ms ease;
}
.program-cover-drop.dragging {
  border-color: var(--accent);
  background: var(--tint);
}
.program-cover-drop .program-cover {
  width: 100%;
  max-height: 230px;
  margin: 0;
}
.cover-placeholder {
  display: grid;
  place-items: center;
  width: 100%;
  min-height: 170px;
  border-radius: 8px;
  color: var(--muted);
  background: var(--surface);
}
.cover-change {
  padding: 0;
  border: 0;
  color: var(--accent);
  background: none;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.program-cover-drop small {
  color: var(--muted);
  font-size: 0.72rem;
}
.program-identity-fields,
.program-recognition-fields {
  display: grid;
  gap: 10px;
  min-width: 0;
  text-align: start;
}
.program-identity-fields .title-input {
  margin: 0 0 8px;
}
.program-recognition-fields {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 4px;
}
.program-identity-fields .small-print {
  margin: 0;
}
.program-preview-heading {
  display: grid;
  grid-template-columns: minmax(220px, 0.72fr) minmax(0, 1.5fr);
  gap: 24px;
  align-items: center;
  margin-bottom: 28px;
  text-align: start;
}
.program-preview-heading .program-cover {
  margin: 0;
}
@media (max-width: 680px) {
  .program-identity-card,
  .program-preview-heading {
    grid-template-columns: minmax(0, 1fr);
    padding: 16px;
  }
  .program-cover-drop {
    width: 100%;
    min-height: 0;
  }
  .cover-placeholder {
    min-height: 145px;
  }
  .program-recognition-fields {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>

<style scoped>
.program-schedule .program-preparation {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-block: var(--space-3);
}
.program-preparation input[type='checkbox'] {
  inline-size: 1.15rem;
  block-size: 1.15rem;
  min-inline-size: 1.15rem;
  padding: 0;
  margin: 0;
  flex: 0 0 auto;
}
</style>
