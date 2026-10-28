<script setup lang="ts">
import { institutionContext } from '../../app/institution'

import PageHeading from '../../components/PageHeading.vue'
import TimezonePicker from '../../components/TimezonePicker.vue'
import { computed, onMounted, ref, watch, nextTick, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { user, profile } from '../../app/auth'
import { request } from '../../lib/backend'
import { getDraft, storeDraft, removeDraft } from '../../lib/storage'
import { localDate, addDays } from '../../lib/dates'
import { language as l, errorMessage, locale } from '../../lib/i18n'
import { useCommand } from '../../lib/commands'
import CommandStatus from '../../components/CommandStatus.vue'
import MemberPicker from './MemberPicker.vue'
import WorkoutAgenda from './WorkoutAgenda.vue'
import { useLiveSearch } from '../../lib/live-search'
import { PhBarbell, PhListChecks } from '@phosphor-icons/vue'
import PageState from '../../components/PageState.vue'
import type { Institution } from './types'
import type { TrainingGroup, AssessmentTemplate, CalendarEvent } from './service-types'
const route = useRoute(),
  router = useRouter(),
  id = institutionContext().institution,
  view = institutionContext().view,
  base = '',
  key = `event-composer:${user.value!.id}:${id}:${view}:${route.query.makeup || 'general'}`
const stepPanel = ref<HTMLElement>()
const entryRoute = route.fullPath
const entry = ref<'workout' | 'event'>('workout')
const workoutLocked = ref(false)
const workoutSearch = ref('')
const appliedWorkoutSearch = ref('')
const workoutSearchControl = useLiveSearch(workoutSearch, () => {
  appliedWorkoutSearch.value = workoutSearch.value.trim()
})
function chooseEntry(kind: 'workout' | 'training' | 'assessment') {
  entry.value = kind === 'workout' ? 'workout' : 'event'
  if (kind !== 'workout') {
    if (draft.value.kind !== kind) step.value = 1
    draft.value.kind = kind
  }
}
async function workoutScheduled() {
  if (!disposed && entry.value === 'workout' && route.fullPath === entryRoute)
    await router.push('/schedule')
}
const data = ref<Institution>(),
  templates = ref<AssessmentTemplate[]>([]),
  groups = ref<TrainingGroup[]>([]),
  loading = ref(true),
  error = ref(''),
  loadError = ref(''),
  saved = ref(false),
  step = ref(1),
  ready = ref(false),
  group = ref(''),
  times = ref<{ starts_at: string; ends_at: string }[]>([])
const draft = ref({
  id: crypto.randomUUID() as string,
  title: '',
  kind: 'training',
  template: '',
  staff: [] as string[],
  participants: [] as string[],
  local:
    addDays(
      localDate(
        profile.value?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      ),
      1,
    ) + 'T09:00',
  zone: profile.value?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  minutes: 60,
  count: 1,
  every: 7,
  location: '',
})
let disposed = false,
  draftGeneration = 0
const templateChannel =
  typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel(`rafik-templates:${user.value!.id}:${id}`)
    : undefined
async function refreshTemplates() {
  if (disposed || catalogBusy.value.templates) return
  await findCatalog('templates')
}
if (templateChannel)
  templateChannel.onmessage = async ({ data: message }) => {
    if (
      disposed ||
      !message ||
      typeof message !== 'object' ||
      message.event !== draft.value.id ||
      typeof message.template !== 'string'
    )
      return
    try {
      const page = await request<{ items: AssessmentTemplate[] }>(
        `/v1/institution/services?view=${view}&kind=templates&id=${encodeURIComponent(message.template)}`,
      )
      if (disposed) return
      const created = page.items.find((item) => item.id === message.template)
      if (created && !locked.value) {
        templates.value = [created, ...templates.value.filter((item) => item.id !== created.id)]
        draft.value.template = created.id
      }
    } catch (e) {
      if (!disposed) error.value = errorMessage(e)
    }
  }
onUnmounted(() => {
  disposed = true
  window.removeEventListener('focus', refreshTemplates)
  templateChannel?.close()
})
watch(step, async () => {
  await nextTick()
  stepPanel.value?.focus()
})
const trainerOptions = ref<Institution['members']>([])
const people = computed(
    () => data.value?.members.filter((m) => m.active && m.roles.includes('trainee')) || [],
  ),
  staff = computed(() => trainerOptions.value)
const chosen = computed(() => people.value.filter((m) => draft.value.participants.includes(m.id)))
const retainedTemplate = ref<AssessmentTemplate>()
const selectedTemplate = computed(
  () =>
    templates.value.find((t) => t.id === draft.value.template) ||
    (retainedTemplate.value?.id === draft.value.template ? retainedTemplate.value : undefined),
)
function chooseTemplate(template: AssessmentTemplate) {
  retainedTemplate.value = template
  draft.value.template = template.id
}
const testCount = (count: number) =>
  l(`${count} ${count === 1 ? 'test' : 'tests'}`, `عدد الاختبارات: ${count}`)
const templateSearch = ref(''),
  groupSearch = ref(''),
  templateNext = ref<number | null>(null),
  groupNext = ref<number | null>(null)
const catalogBusy = ref({ templates: false, groups: false })
async function catalogPage(kind: 'templates' | 'groups', append = false) {
  const q = new URLSearchParams({
    view,
    kind,
    search: kind === 'templates' ? templateSearch.value : groupSearch.value,
    ...(kind === 'templates' ? { limit: '5' } : {}),
    offset: String(append ? (kind === 'templates' ? templateNext.value : groupNext.value) || 0 : 0),
  })
  const page = await request<{ items: any[]; next: number | null }>(`/v1/institution/services?${q}`)
  if (kind === 'templates') {
    const selected = selectedTemplate.value
    templates.value = append
      ? Array.from(new Map([...templates.value, ...page.items].map((t) => [t.id, t])).values())
      : page.items
    if (selected) retainedTemplate.value = selected
    templateNext.value = page.next
  } else {
    groups.value = append ? [...groups.value, ...page.items] : page.items
    groupNext.value = page.next
  }
}
const templateLive = useLiveSearch(templateSearch, () => findCatalog('templates'))
const whenLabel = computed(() => {
  if (!draft.value.local) return ''
  return new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar-AE' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(draft.value.local + ':00Z'))
})
async function findCatalog(kind: 'templates' | 'groups', append = false) {
  if (catalogBusy.value[kind]) return
  catalogBusy.value[kind] = true
  error.value = ''
  try {
    await catalogPage(kind, append)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    catalogBusy.value[kind] = false
  }
}
async function load() {
  loading.value = true
  loadError.value = ''
  try {
    data.value = await request<Institution>(`/v1/institution?view=${view}&summary=true`)
    await Promise.all([catalogPage('templates'), catalogPage('groups')])
    if (view === 'trainer') draft.value.staff = [data.value.self.id]
  } catch (e) {
    loadError.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
const command = useCommand<'create'>(
  key,
  async (_, result) => {
    ready.value = false
    await removeDraft(key)
    if (!disposed && route.fullPath === entryRoute)
      await router.push(base + '/schedule/' + (result as CalendarEvent[])[0]!.id)
  },
  (_, args) => request(`/v1/institution/calendar`, { method: 'POST', body: JSON.stringify(args) }),
  { successMessage: l('Calendar event scheduled.', 'تمت جدولة الحدث في التقويم.') },
)
const locked = computed(() => command.state.busy || !!command.state.pending || !command.state.ready)
watch(
  () => command.state.pending,
  (pending) => {
    if (pending) entry.value = 'event'
  },
  { immediate: true },
)
function groupMembers() {
  const selected = groups.value.find((g) => g.id === group.value)
  if (selected) {
    draft.value.participants = selected.members
      .filter((m) => m.active && m.roles.includes('trainee') && !draft.value.staff.includes(m.id))
      .map((m) => m.id)
    // Add the group's coaches; never drop a coach already chosen for this event.
    if (view === 'admin')
      draft.value.staff = [
        ...new Set([
          ...draft.value.staff,
          ...selected.members
            .filter((m) => m.active && m.roles.includes('trainer'))
            .map((m) => m.id),
        ]),
      ]
  }
}
async function advance() {
  error.value = ''
  if (step.value === 1) {
    if (draft.value.kind === 'assessment' && !selectedTemplate.value) {
      error.value = l('Choose an assessment template first.', 'اختر قالب تقييم أولاً.')
      return
    }
    step.value = 2
    return
  }
  try {
    times.value = await request(`/v1/institution/calendar-preview`, {
      method: 'POST',
      body: JSON.stringify({ ...draft.value, view }),
    })
    step.value = 3
  } catch (e) {
    error.value = errorMessage(e)
  }
}
function submit() {
  return command.run('create', {
    ...draft.value,
    view,
    action: 'create',
    operation: crypto.randomUUID(),
    template_revision: selectedTemplate.value?.revision,
    makeups: draft.value.participants
      .filter((member) => route.query.makeup && member === String(route.query.member))
      .map((member) => ({
        member,
        makeup_for: String(route.query.makeup),
      })),
  })
}
const timeLabel = (value: string) =>
  new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar-AE' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'shortOffset',
    timeZone: draft.value.zone,
  }).format(new Date(value))
watch(
  draft,
  async () => {
    if (!ready.value) return
    try {
      const current = ++draftGeneration
      saved.value = false
      await storeDraft(key, JSON.parse(JSON.stringify(draft.value)))
      if (!disposed && current === draftGeneration) saved.value = true
    } catch (e) {
      error.value = errorMessage(e)
    }
  },
  { deep: true },
)
onMounted(async () => {
  window.addEventListener('focus', refreshTemplates)
  await load()
  const stored = await getDraft<typeof draft.value>(key).catch(() => undefined)
  if (stored) {
    if (stored.title || stored.template || stored.participants?.length) entry.value = 'event'
    draft.value = { ...draft.value, ...stored }
    try {
      if (stored.template && !templates.value.some((t) => t.id === stored.template)) {
        const page = await request<{ items: AssessmentTemplate[] }>(
          `/v1/institution/services?view=${view}&kind=templates&id=${stored.template}`,
        )
        templates.value.push(...page.items)
      }
    } catch (e) {
      error.value = errorMessage(e)
    }
  }
  if (!stored && route.query.makeup && route.query.member) {
    entry.value = 'event'
    draft.value.participants = [String(route.query.member)]
    draft.value.title = l('Makeup session', 'جلسة تعويضية')
  } else if (!stored && route.query.member) {
    // Started from an athlete: preselect them; the people step still verifies authority.
    draft.value.participants = [String(route.query.member)]
  }
  ready.value = true
})
</script>
<template>
  <div class="container page event-composer">
    <RouterLink class="back-link" :to="base + '/schedule'">{{
      l('Back to calendar', 'العودة للتقويم')
    }}</RouterLink>
    <PageHeading class="work-heading">
      <div>
        <h1>{{ l('Schedule an event', 'جدولة موعد') }}</h1>
        <p>
          {{
            l(
              'Schedule a plan workout, a custom event or an assessment.',
              'جدول تمريناً من خطة أو موعداً مخصصاً أو تقييماً.',
            )
          }}
        </p>
      </div>
    </PageHeading>
    <PageState v-if="!ready" loading />
    <fieldset
      class="event-kind scheduling-entry"
      :disabled="!ready || (entry === 'workout' ? workoutLocked : locked)"
    >
      <legend>{{ l('What are you scheduling?', 'ماذا تريد أن تجدول؟') }}</legend>
      <label class="kind-card" :class="{ selected: entry === 'workout' }">
        <input
          type="radio"
          name="scheduling-entry"
          :checked="entry === 'workout'"
          @change="chooseEntry('workout')"
        />
        <PhBarbell :size="24" aria-hidden="true" />
        <span
          ><strong>{{ l('Workout from a plan', 'تمرين من خطة') }}</strong
          ><small>{{
            l(
              'Choose an athlete’s next workout and set its time.',
              'اختر التمرين التالي للرياضي وحدد موعده.',
            )
          }}</small></span
        >
      </label>
      <label
        class="kind-card"
        :class="{ selected: entry === 'event' && draft.kind === 'training' }"
      >
        <input
          type="radio"
          name="scheduling-entry"
          :checked="entry === 'event' && draft.kind === 'training'"
          @change="chooseEntry('training')"
        />
        <PhBarbell :size="24" aria-hidden="true" />
        <span
          ><strong>{{ l('Custom event', 'موعد مخصص') }}</strong
          ><small>{{
            l(
              'A named training event with attendance, separate from plan progression.',
              'موعد تدريبي باسم وحضور، مستقل عن تقدم الخطط.',
            )
          }}</small></span
        >
      </label>
      <label
        class="kind-card"
        :class="{ selected: entry === 'event' && draft.kind === 'assessment' }"
      >
        <input
          type="radio"
          name="scheduling-entry"
          :checked="entry === 'event' && draft.kind === 'assessment'"
          @change="chooseEntry('assessment')"
        />
        <PhListChecks :size="24" aria-hidden="true" />
        <span
          ><strong>{{ l('Assessor-led assessment', 'تقييم بإشراف مقيم') }}</strong
          ><small>{{
            l(
              'Choose a template and record participant results.',
              'اختر قالباً وسجل نتائج المشاركين.',
            )
          }}</small></span
        >
      </label>
    </fieldset>
    <section
      v-if="ready"
      v-show="entry === 'workout'"
      :aria-label="l('Plan workout scheduling', 'جدولة تمارين الخطط')"
    >
      <form class="workout-search" @submit.prevent="workoutSearchControl.submit()">
        <label
          >{{ l('Search athletes', 'البحث عن الرياضيين')
          }}<input
            v-model="workoutSearch"
            type="search"
            :placeholder="l('Search athlete names…', 'ابحث بأسماء الرياضيين…')"
            :disabled="workoutLocked"
        /></label>
      </form>
      <WorkoutAgenda
        queue="planning"
        command-scope="event-composer"
        :search="appliedWorkoutSearch"
        @locked="workoutLocked = $event"
        @changed="workoutScheduled"
      />
      <p class="small-print">
        {{
          l(
            'Only plans without scheduled or unfinished work appear here. To reschedule or resolve existing work, open its athlete plan.',
            'تظهر هنا الخطط التي لا يوجد لها تمرين مجدول أو غير مكتمل. لإعادة جدولة تمرين قائم أو تسويته، افتح خطة الرياضي.',
          )
        }}
        <RouterLink to="/training">{{ l('Athlete plans', 'خطط الرياضيين') }}</RouterLink>
      </p>
    </section>
    <div v-show="entry === 'event'">
      <ol class="composer-steps" :aria-label="l('Scheduling steps', 'خطوات الجدولة')">
        <li
          v-for="(label, index) in [
            l('Details', 'التفاصيل'),
            l('People', 'الأشخاص'),
            l('Review', 'المراجعة'),
          ]"
          :key="index"
          :aria-current="step === index + 1 ? 'step' : undefined"
          :class="{ current: step === index + 1 }"
        >
          {{ index + 1 }}. {{ label }}
        </li>
      </ol>
      <CommandStatus :command="command" />
      <p v-if="error && !loading" role="alert" class="notice error">{{ error }}</p>
      <PageState :loading="loading" :error="loadError" @retry="load">
        <div v-if="data" class="composer-layout" :class="{ reviewing: step === 3 }">
          <form @submit.prevent="step === 3 ? submit() : advance()">
            <fieldset :disabled="locked" class="form-fields">
              <section
                v-if="step === 1"
                ref="stepPanel"
                tabindex="-1"
                :aria-label="l('Event details', 'تفاصيل الموعد')"
                class="panel"
              >
                <label
                  >{{ l('Event name', 'اسم الموعد')
                  }}<input
                    v-model="draft.title"
                    required
                    maxlength="100"
                    :placeholder="
                      draft.kind === 'assessment'
                        ? l(
                            'For example: Pre-season fitness assessment',
                            'مثال: تقييم اللياقة قبل الموسم',
                          )
                        : l('For example: First-team training', 'مثال: تدريب الفريق الأول')
                    "
                /></label>
                <section
                  v-if="draft.kind === 'assessment'"
                  class="template-picker"
                  :aria-label="l('Assessment template', 'قالب التقييم')"
                >
                  <div class="template-picker-heading">
                    <h2>{{ l('Assessment template', 'قالب التقييم') }}</h2>
                    <RouterLink
                      :to="base + '/assessment-templates/new?forEvent=' + draft.id"
                      target="_blank"
                      rel="noopener"
                      class="text-link"
                      >{{
                        l('Create a template ↗ (new tab)', 'إنشاء قالب ↗ (تبويب جديد)')
                      }}</RouterLink
                    >
                  </div>
                  <p class="small-print">
                    {{
                      l(
                        'Choose the tests you will record. Search the library or create a new template.',
                        'اختر الاختبارات التي ستسجلها. ابحث في المكتبة أو أنشئ قالباً جديداً.',
                      )
                    }}
                  </p>
                  <div class="template-search-row">
                    <label
                      >{{ l('Find an assessment template', 'البحث عن قالب تقييم')
                      }}<input
                        v-model="templateSearch"
                        type="search"
                        :placeholder="l('Search templates by name…', 'ابحث عن القوالب بالاسم…')"
                        @keydown.enter.prevent="templateLive.submit()"
                    /></label>
                  </div>
                  <p v-if="selectedTemplate" class="template-selection" role="status">
                    {{ l('Selected:', 'المحدد:') }}
                    <strong dir="auto">{{ selectedTemplate.title }}</strong> ·
                    {{ testCount(selectedTemplate.definition.length) }}
                  </p>
                  <div
                    class="template-options"
                    role="radiogroup"
                    :aria-label="l('Choose an assessment template', 'اختر قالب تقييم')"
                    :aria-busy="catalogBusy.templates"
                  >
                    <label
                      v-for="template in templates"
                      :key="template.id"
                      class="template-option"
                      :class="{ selected: draft.template === template.id }"
                    >
                      <input
                        type="radio"
                        name="assessment-template"
                        :value="template.id"
                        :checked="draft.template === template.id"
                        @change="chooseTemplate(template)"
                      />
                      <span
                        ><strong dir="auto">{{ template.title }}</strong
                        ><small>{{ testCount(template.definition.length) }}</small></span
                      >
                    </label>
                  </div>
                  <p v-if="!catalogBusy.templates && !templates.length" class="small-print">
                    {{
                      l(
                        'No templates match. Try another name or create a template.',
                        'لا توجد قوالب مطابقة. جرّب اسماً آخر أو أنشئ قالباً.',
                      )
                    }}
                  </p>
                  <div class="actions">
                    <button
                      v-if="templateNext !== null"
                      type="button"
                      class="button small secondary"
                      :disabled="catalogBusy.templates"
                      @click="findCatalog('templates', true)"
                    >
                      {{ l('More templates', 'المزيد من القوالب') }}
                    </button>
                    <button
                      type="button"
                      class="text-link"
                      :disabled="catalogBusy.templates"
                      @click="refreshTemplates"
                    >
                      {{ l('Refresh templates', 'تحديث القوالب') }}
                    </button>
                  </div>
                </section>
                <div class="service-field-row">
                  <label
                    >{{ l('Local date and time', 'التاريخ والوقت المحلي')
                    }}<input v-model="draft.local" type="datetime-local" required /></label
                  ><TimezonePicker
                    v-model="draft.zone"
                    :label="l('Timezone', 'المنطقة الزمنية')"
                    :disabled="locked"
                  />
                </div>
                <label
                  >{{ l('Duration', 'المدة')
                  }}<select v-model.number="draft.minutes">
                    <option v-for="n in [15, 30, 45, 60, 90, 120]" :key="n" :value="n">
                      {{ n }} {{ l('minutes', 'دقيقة') }}
                    </option>
                  </select></label
                >
                <label
                  >{{ l('Location or meeting link', 'الموقع أو رابط الاجتماع')
                  }}<input v-model="draft.location" maxlength="500"
                /></label>
                <details>
                  <summary>{{ l('Repeat this event', 'تكرار الموعد') }}</summary>
                  <div class="service-field-row">
                    <label
                      >{{ l('Occurrences (up to 8)', 'عدد المواعيد (حتى 8)')
                      }}<input
                        v-model.number="draft.count"
                        type="number"
                        min="1"
                        max="8"
                        required /></label
                    ><label
                      >{{ l('Repeat every', 'التكرار كل')
                      }}<select v-model.number="draft.every">
                        <option :value="7">{{ l('Week', 'أسبوع') }}</option>
                        <option :value="14">{{ l('Two weeks', 'أسبوعين') }}</option>
                      </select></label
                    >
                  </div>
                </details>
              </section>
              <section
                v-else-if="step === 2"
                ref="stepPanel"
                tabindex="-1"
                :aria-label="l('Choose people', 'اختيار الأشخاص')"
                class="panel"
              >
                <MemberPicker
                  v-if="view === 'admin'"
                  :institution="id"
                  :view="view"
                  role="trainer"
                  :max="8"
                  v-model="draft.staff"
                  :exclude-ids="draft.participants"
                  :label="l('Coaches / assessors', 'المدربون / المقيمون')"
                  @options="trainerOptions = $event"
                />
                <p v-else>
                  {{
                    l(
                      'You are the assigned coach for this event.',
                      'أنت المدرب المعيّن لهذا الموعد.',
                    )
                  }}
                </p>
                <h2>{{ l('Athletes', 'الرياضيون') }}</h2>
                <details class="group-shortcut">
                  <summary>{{ l('Start with a training group', 'ابدأ بمجموعة تدريب') }}</summary>
                  <div class="form-fields">
                    <label
                      >{{ l('Find a group (optional)', 'البحث عن مجموعة (اختياري)')
                      }}<input
                        :placeholder="l('Type to search…', 'اكتب للبحث…')"
                        v-model="groupSearch"
                        type="search"
                        @keydown.enter.prevent="findCatalog('groups')" /></label
                    ><button
                      type="button"
                      class="text-link"
                      :disabled="catalogBusy.groups"
                      @click="findCatalog('groups')"
                    >
                      {{ l('Search groups', 'البحث في المجموعات') }}</button
                    ><button
                      v-if="groupNext !== null"
                      type="button"
                      class="text-link"
                      :disabled="catalogBusy.groups"
                      @click="findCatalog('groups', true)"
                    >
                      {{ l('More groups', 'المزيد من المجموعات') }}
                    </button>
                  </div>
                  <label v-if="groups.length"
                    >{{ l('Start with a group (optional)', 'ابدأ بمجموعة (اختياري)')
                    }}<select v-model="group" @change="groupMembers">
                      <option value="">
                        {{ l('Choose people individually', 'اختيار الأشخاص فردياً') }}
                      </option>
                      <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
                    </select></label
                  >
                </details>
                <MemberPicker
                  :institution="id"
                  :view="view"
                  role="trainee"
                  v-model="draft.participants"
                  :exclude-ids="draft.staff"
                  :label="l('Find athletes', 'البحث عن رياضيين')"
                  @options="data!.members = $event"
                />
              </section>
              <section
                v-else
                ref="stepPanel"
                tabindex="-1"
                :aria-label="l('Review schedule', 'مراجعة الجدول')"
                class="panel event-review"
              >
                <h2>{{ draft.title }}</h2>
                <p>{{ draft.location }} · {{ draft.zone }}</p>
                <p v-if="selectedTemplate">
                  {{ selectedTemplate.title }} · {{ selectedTemplate.definition.length }}
                  {{ l('drills', 'اختبارات') }}
                </p>
                <h3>{{ l('People', 'الأشخاص') }}</h3>
                <p>
                  {{ l('Coaches / assessors', 'المدربون / المقيمون') }}:
                  {{
                    view === 'trainer'
                      ? profile?.display_name
                      : staff
                          .filter((m) => draft.staff.includes(m.id))
                          .map((m) => m.name)
                          .join(' · ')
                  }}
                </p>
                <ul>
                  <li v-for="m in chosen" :key="m.id">
                    {{ m.name }}
                  </li>
                </ul>
                <h3>{{ l('Dates to schedule', 'المواعيد للجدولة') }}</h3>
                <ol>
                  <li v-for="time in times" :key="time.starts_at">
                    {{ timeLabel(time.starts_at) }} — {{ timeLabel(time.ends_at) }}
                  </li>
                </ol>
                <p class="small-print">
                  {{
                    l(
                      'These dates and people are fixed for this series. Later group changes will not add or remove event participants. Any conflict rejects the entire series.',
                      'هذه التواريخ والأشخاص ثابتون لهذه السلسلة. تغييرات المجموعة لاحقاً لا تضيف أو تحذف المشاركين. أي تعارض يرفض السلسلة كاملة.',
                    )
                  }}
                </p>
                <p class="small-print">
                  {{
                    l(
                      'During a repeated daylight-saving hour, preview uses standard time. Review the displayed instants before confirming.',
                      'خلال ساعة مكررة بسبب التوقيت الصيفي تستخدم المعاينة التوقيت القياسي. راجع الأوقات قبل التأكيد.',
                    )
                  }}
                </p>
              </section>
              <div class="actions">
                <button v-if="step > 1" type="button" class="button secondary" @click="step--">
                  {{ l('Back', 'رجوع') }}</button
                ><button
                  class="button"
                  :disabled="
                    step === 2 &&
                    (!draft.staff.length ||
                      !chosen.length ||
                      chosen.length !== draft.participants.length ||
                      (view === 'admin' &&
                        draft.staff.some(
                          (id) =>
                            !staff.some(
                              (m) => m.id === id && m.active && m.roles.includes('trainer'),
                            ),
                        )))
                  "
                >
                  {{
                    step === 3
                      ? l('Confirm schedule', 'تأكيد الجدول')
                      : step === 2
                        ? l('Review schedule', 'مراجعة الجدول')
                        : l('Choose people', 'اختيار الأشخاص')
                  }}
                </button>
              </div>
              <p class="small-print draft-status" role="status">
                {{
                  saved
                    ? l('Draft saved on this device.', 'حُفظت المسودة على هذا الجهاز.')
                    : l(
                        'Changes are saved on this device as you type.',
                        'تُحفظ التغييرات على هذا الجهاز أثناء الكتابة.',
                      )
                }}
              </p>
            </fieldset>
          </form>
          <aside
            v-if="step < 3"
            class="composer-summary panel"
            :aria-label="l('Summary', 'الملخص')"
          >
            <h2>{{ l('Summary', 'الملخص') }}</h2>
            <dl>
              <div>
                <dt>{{ l('Type', 'النوع') }}</dt>
                <dd>
                  {{
                    draft.kind === 'assessment'
                      ? l('Assessor-led assessment', 'تقييم بإشراف مقيم')
                      : l('Training session', 'حصة تدريب')
                  }}
                </dd>
              </div>
              <div>
                <dt>{{ l('Name', 'الاسم') }}</dt>
                <dd>
                  <bdi dir="auto">{{ draft.title || l('Not named yet', 'لم يُسمَّ بعد') }}</bdi>
                </dd>
              </div>
              <div v-if="draft.kind === 'assessment'">
                <dt>{{ l('Template', 'القالب') }}</dt>
                <dd>
                  <bdi dir="auto">{{
                    selectedTemplate?.title || l('Not chosen yet', 'لم يُختر بعد')
                  }}</bdi>
                </dd>
              </div>
              <div>
                <dt>{{ l('When', 'الموعد') }}</dt>
                <dd>
                  {{ whenLabel }} · <bdi>{{ draft.zone }}</bdi> · {{ draft.minutes }}
                  {{ l('minutes', 'دقيقة') }}
                  <template v-if="draft.count > 1"
                    ><br />{{ draft.count }} {{ l('occurrences', 'مواعيد') }}</template
                  >
                </dd>
              </div>
              <div v-if="draft.location">
                <dt>{{ l('Location', 'الموقع') }}</dt>
                <dd>
                  <bdi dir="auto">{{ draft.location }}</bdi>
                </dd>
              </div>
              <div>
                <dt>{{ l('Athletes', 'الرياضيون') }}</dt>
                <dd>{{ draft.participants.length }}</dd>
              </div>
            </dl>
          </aside>
        </div>
      </PageState>
    </div>
  </div>
</template>
<style scoped>
.scheduling-entry {
  margin-block-end: var(--space-6);
}
.workout-search {
  margin-block-end: var(--space-5);
}
.composer-layout {
  display: grid;
  grid-template-columns: minmax(0, 760px) minmax(240px, 320px);
  gap: var(--space-8);
  align-items: start;
}
.composer-layout.reviewing {
  grid-template-columns: minmax(0, 760px);
}
.composer-layout > form {
  min-width: 0;
}
.composer-summary {
  position: sticky;
  top: var(--space-4);
  margin: 0;
}
.composer-summary h2 {
  margin: 0 0 var(--space-4);
  font-size: var(--text-panel);
}
.composer-summary dl {
  display: grid;
  gap: var(--space-3);
  margin: 0;
}
.composer-summary dt {
  color: var(--muted);
  font-size: var(--text-caption);
}
.composer-summary dd {
  margin: 2px 0 0;
  overflow-wrap: anywhere;
}
.event-kind {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  gap: var(--space-3);
  margin: 0 0 var(--space-5);
  padding: 0;
  border: 0;
}
.event-kind legend {
  margin-block-end: var(--space-2);
  font-weight: 600;
}
.event-composer .kind-card {
  position: relative;
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
  margin: 0;
  padding: var(--space-4);
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--field);
  cursor: pointer;
}
.kind-card input {
  position: absolute;
  opacity: 0;
  inset: 0;
  margin: 0;
  cursor: pointer;
}
.kind-card > svg {
  flex: 0 0 auto;
  color: var(--accent);
}
.kind-card span {
  display: grid;
  gap: var(--space-1);
}
.kind-card small {
  color: var(--muted);
  font-weight: 400;
}
.event-composer .kind-card.selected {
  border-color: var(--accent);
  background: var(--tint);
}
.kind-card:has(input:focus-visible) {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}
@media (max-width: 1100px) {
  .composer-layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .composer-summary {
    position: static;
  }
}
.template-picker {
  margin-block: var(--space-5);
  padding-block: var(--space-4);
  border-block: 1px solid var(--line);
}
.template-picker-heading,
.template-search-row {
  display: flex;
  gap: var(--space-3);
  align-items: end;
  flex-wrap: wrap;
}
.template-picker-heading {
  align-items: center;
  justify-content: space-between;
}
.template-picker-heading h2 {
  margin: 0;
  font-size: var(--text-section);
}
.event-composer .template-search-row > label {
  flex: 1 1 240px;
  margin: 0;
  min-width: 0;
}
.template-search-row {
  margin-block: var(--space-4);
}
.template-selection {
  color: var(--muted);
}
.template-options {
  display: grid;
  gap: var(--space-2);
  margin-block: var(--space-3);
}
.event-composer .template-option {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: 0;
  padding: var(--space-3);
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  cursor: pointer;
}
.template-option.selected {
  border-color: var(--accent);
  background: var(--surface);
}
.template-option input[type='radio'] {
  inline-size: 1.15rem;
  block-size: 1.15rem;
  min-inline-size: 1.15rem;
  flex: 0 0 auto;
  margin: 0;
  padding: 0;
}
.template-option span {
  min-width: 0;
  overflow-wrap: anywhere;
}
.template-option small {
  display: block;
  color: var(--muted);
  margin-block-start: var(--space-1);
}

.event-composer {
}
.composer-steps {
  list-style: none;
  display: flex;
  gap: 24px;
  padding: 0;
  margin-block: 24px;
  font-size: 0.9rem;
  color: var(--muted);
}
.composer-steps .current {
  color: var(--ink);
  font-weight: 700;
}
.event-composer .panel {
  margin-bottom: 24px;
}
.event-composer label {
  margin-block: 16px;
}
.service-field-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  align-items: start;
}
.event-composer .service-field-row > label,
.event-composer .service-field-row :deep(.timezone-picker > label) {
  margin: 0;
}
.service-field-row > label,
.service-field-row :deep(.timezone-picker) {
  display: grid;
  gap: 8px;
}
.service-field-row input[type='datetime-local'],
.service-field-row :deep(.timezone-anchor) {
  min-height: 48px;
  box-sizing: border-box;
}
.event-composer h2 {
  font-size: 1.2rem;
}
.event-review h3 {
  margin-top: 24px;
  font-size: 1rem;
}
.event-review li {
  margin-block: 8px;
  overflow-wrap: anywhere;
}
@media (max-width: 650px) {
  .service-field-row {
    grid-template-columns: minmax(0, 1fr);
  }
  .composer-steps {
    gap: 14px;
  }
  .event-composer .panel {
    padding: 20px;
  }
}
</style>
