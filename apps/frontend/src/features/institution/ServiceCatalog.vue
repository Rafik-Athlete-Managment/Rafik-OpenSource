<script setup lang="ts">
import { institutionContext } from '../../app/institution'

import { useListPageSize } from '../../lib/list-page-size'
import EmptyState from '../../components/EmptyState.vue'
import { loadEditorDraft } from '../../lib/editor-draft'
import PageHeading from '../../components/PageHeading.vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { user } from '../../app/auth'
import { request } from '../../lib/backend'
import { storeDraft, removeDraft } from '../../lib/storage'
import { language as l, errorMessage } from '../../lib/i18n'
import { useCommand } from '../../lib/commands'
import CommandStatus from '../../components/CommandStatus.vue'
import MemberPicker from './MemberPicker.vue'
import ListPagination from '../../components/ListPagination.vue'
import { useLiveSearch } from '../../lib/live-search'
import PageState from '../../components/PageState.vue'
import { PhChatCircle, PhUsersThree } from '@phosphor-icons/vue'
import type { Institution } from './types'
import type { Drill, TrainingGroup, AssessmentTemplate } from './service-types'
const route = useRoute(),
  router = useRouter(),
  editor = String(route.params.editor || ''),
  initialPath = route.path,
  forEvent = String(route.query.forEvent || ''),
  id = institutionContext().institution,
  view = institutionContext().view,
  base = '',
  templates = route.path.includes('/assessment-templates'),
  kind = templates ? 'templates' : 'groups',
  key = `service-catalog:${user.value!.id}:${id}:${view}:${kind}`
const listPath = base + (templates ? '/assessment-templates' : '/groups'),
  draftKey = key + ':' + (editor || 'new'),
  resume = ref('')
const items = ref<(TrainingGroup & AssessmentTemplate)[]>([]),
  organization = ref<Institution>(),
  loading = ref(true),
  error = ref(''),
  offset = ref(0),
  total = ref(0),
  search = ref(''),
  archived = ref(false),
  editing = ref(false),
  draftReady = ref(false),
  draftError = ref(''),
  saved = ref(false)
const fresh = () => ({
  id: crypto.randomUUID() as string,
  name: '',
  title: '',
  revision: 0,
  archived: false,
  members: [] as string[],
  coaches: [] as string[],
  definition: [{ key: crypto.randomUUID(), name: '', kind: 'number', unit: '', min: 0 } as Drill],
})
const draft = ref(fresh())
let generation = 0,
  disposed = false
onUnmounted(() => {
  disposed = true
  generation++
})
const { recordLimit, appliedLimit, pageSizes, acceptLimit, changeLimit } = useListPageSize(
  templates ? 24 : 10,
  () => {
    void load(0)
  },
)
const live = useLiveSearch(search, () => load())
async function load(page = 0) {
  if (disposed) return
  const current = ++generation
  loading.value = true
  error.value = ''
  try {
    const [result, people] = await Promise.all([
      request<{
        items: (TrainingGroup & AssessmentTemplate)[]
        next: number | null
        total: number
      }>(
        `/v1/institution/services?view=${view}&kind=${kind}&search=${encodeURIComponent(search.value)}&archived=${archived.value}&limit=${recordLimit.value}&offset=${page}`,
      ),
      request<Institution>(`/v1/institution?view=${view}&summary=true`),
    ])
    if (disposed || current !== generation) return
    items.value = result.items
    offset.value = page
    total.value = result.total
    acceptLimit()
    organization.value = people
  } catch (e) {
    error.value = errorMessage(e)
    items.value = []
  } finally {
    loading.value = false
  }
}
const returnToList = ref(false)
const command = useCommand<'save'>(
  key,
  async () => {
    if (templates && forEvent && typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(`rafik-templates:${user.value!.id}:${id}`)
      channel.postMessage({ event: forEvent, template: draft.value.id })
      channel.close()
    }
    editing.value = false
    await removeDraft(draftKey)
    draft.value = fresh()
    if (!disposed && route.path === initialPath && editor) returnToList.value = true
    else if (!disposed) await load()
  },
  (_, args) => request(`/v1/institution/services`, { method: 'POST', body: JSON.stringify(args) }),
  {
    successMessage: (_, args) =>
      args.action === 'template'
        ? l('Assessment template saved.', 'تم حفظ قالب التقييم.')
        : l('Training group saved.', 'تم حفظ المجموعة التدريبية.'),
  },
)
watch(
  () => command.state.busy,
  (busy) => {
    if (
      !busy &&
      !command.state.pending &&
      returnToList.value &&
      !disposed &&
      route.path === initialPath
    )
      void router.replace(listPath)
  },
)
const locked = computed(() => command.state.busy || !!command.state.pending || !command.state.ready)
function addDrill() {
  draft.value.definition.push({ key: crypto.randomUUID(), name: '', kind: 'number', unit: '' })
}
function edit(item?: TrainingGroup & AssessmentTemplate) {
  if (!editor) {
    void router.push({
      path: listPath + '/' + (item?.id || 'new'),
      query: { ...(forEvent ? { forEvent } : {}), ...(item?.archived ? { archived: '1' } : {}) },
    })
    return
  }
  draft.value = item
    ? {
        id: item.id,
        name: item.name || '',
        title: item.title || '',
        revision: item.revision,
        archived: item.archived,
        members: item.members?.filter((m) => m.roles.includes('trainee')).map((m) => m.id) || [],
        coaches: item.members?.filter((m) => m.roles.includes('trainer')).map((m) => m.id) || [],
        definition: JSON.parse(JSON.stringify(item.definition || [])),
      }
    : fresh()
  editing.value = true
}
async function close() {
  editing.value = false
  await removeDraft(draftKey)
  draft.value = fresh()
  if (!disposed && editor && route.path === initialPath) await router.push(listPath)
}
function save() {
  return command.run('save', {
    ...draft.value,
    members: [...new Set([...draft.value.members, ...draft.value.coaches])],
    view,
    action: templates ? 'template' : 'group',
    operation: crypto.randomUUID(),
  })
}
watch(
  draft,
  async () => {
    if (!draftReady.value || !editing.value) return
    try {
      saved.value = false
      await storeDraft(draftKey, draft.value)
      saved.value = true
      draftError.value = ''
    } catch (e) {
      draftError.value = errorMessage(e)
    }
  },
  { deep: true },
)
async function initialize() {
  await load()
  if (disposed) return
  const stored = await loadEditorDraft<ReturnType<typeof fresh>>(key, editor).catch(() => undefined)
  if (disposed) return
  if (!editor) {
    resume.value = stored ? (stored.revision ? stored.id : 'new') : ''
    if (route.query.create === '1')
      await router.replace({ path: listPath + '/new', query: forEvent ? { forEvent } : {} })
  } else if (stored && (editor === 'new' ? !stored.revision : stored.id === editor)) {
    draft.value = { ...fresh(), ...stored, coaches: stored.coaches || [] }
    editing.value = true
  } else if (editor === 'new') edit()
  else {
    try {
      const result = await request<{ items: (TrainingGroup & AssessmentTemplate)[] }>(
        `/v1/institution/services?view=${view}&kind=${kind}&id=${encodeURIComponent(editor)}&archived=${route.query.archived === '1'}`,
      )
      if (disposed) return
      if (!result.items[0]) throw Error(l('This item is unavailable.', 'هذا العنصر غير متاح.'))
      edit(result.items[0])
    } catch (e) {
      if (!disposed) error.value = errorMessage(e)
    }
  }
  draftReady.value = true
}
onMounted(initialize)
</script>
<template>
  <div class="container page institution-service-page">
    <RouterLink v-if="editor" class="back-link" :to="listPath">{{
      templates
        ? l('Back to templates', 'العودة إلى القوالب')
        : l('Back to groups', 'العودة إلى المجموعات')
    }}</RouterLink>
    <PageHeading class="work-heading">
      <div>
        <p class="overline">{{ l('Institution library', 'مكتبة المؤسسة') }}</p>
        <h1>
          {{
            editor
              ? templates
                ? editor === 'new'
                  ? l('Create assessment template', 'إنشاء قالب تقييم')
                  : l('Edit assessment template', 'تعديل قالب تقييم')
                : editor === 'new'
                  ? l('Create training group', 'إنشاء مجموعة تدريبية')
                  : l('Edit training group', 'تعديل مجموعة تدريبية')
              : templates
                ? l('Assessment templates', 'قوالب التقييم')
                : l('Training groups', 'مجموعات التدريب')
          }}
        </h1>
        <p>
          {{
            templates
              ? l(
                  'Define the drills once. Each scheduled assessment keeps its own fixed copy.',
                  'حدّد الاختبارات مرة؛ يحتفظ كل تقييم مجدول بنسخته الثابتة.',
                )
              : l(
                  'Bring people together for scheduling. Existing event rosters stay unchanged.',
                  'اجمع الأشخاص للجدولة؛ تبقى قوائم المواعيد السابقة كما هي.',
                )
          }}
        </p>
      </div>
      <button v-if="!editor" class="button" @click="edit()" :disabled="locked || !organization">
        {{ templates ? l('New template', 'قالب جديد') : l('New group', 'مجموعة جديدة') }}
      </button>
    </PageHeading>
    <CommandStatus :command="command" />
    <PageState v-if="editor && !editing" :loading="loading" :error="error" @retry="initialize" />
    <p v-if="draftError" role="alert" class="notice error">{{ draftError }}</p>
    <form v-if="editing && organization" class="panel service-editor" @submit.prevent="save">
      <fieldset class="form-fields" :disabled="locked">
        <div class="heading-actions">
          <h2>
            {{
              draft.revision ? l('Edit details', 'تعديل التفاصيل') : l('Set it up', 'إعداد جديد')
            }}
          </h2>
          <button type="button" class="text-link danger-action" @click="close">
            {{ l('Discard changes', 'تجاهل التغييرات') }}
          </button>
        </div>
        <label
          >{{ l('Name', 'الاسم')
          }}<input v-if="templates" v-model="draft.title" maxlength="100" required /><input
            v-else
            v-model="draft.name"
            maxlength="100"
            required
        /></label>
        <template v-if="templates"
          ><section
            v-for="(drill, index) in draft.definition"
            :key="drill.key"
            class="assessment-drill-editor"
          >
            <div class="heading-actions">
              <h3>{{ l('Drill', 'اختبار') }} {{ index + 1 }}</h3>
              <button
                type="button"
                class="text-link danger-action"
                :disabled="draft.definition.length === 1"
                @click="draft.definition.splice(index, 1)"
              >
                {{ l('Remove drill', 'حذف الاختبار') }} {{ index + 1 }}
              </button>
            </div>
            <label
              >{{ l('Drill name', 'اسم الاختبار')
              }}<input v-model="drill.name" maxlength="100" required
            /></label>
            <div class="service-field-row">
              <label
                >{{ l('Result type', 'نوع النتيجة')
                }}<select v-model="drill.kind">
                  <option value="number">{{ l('Number', 'رقم') }}</option>
                  <option value="text">{{ l('Observation', 'ملاحظة') }}</option>
                </select></label
              ><label v-if="drill.kind === 'number'"
                >{{ l('Unit', 'الوحدة')
                }}<input
                  v-model="drill.unit"
                  maxlength="30"
                  :placeholder="l('e.g. seconds, repetitions', 'مثلاً ثوانٍ أو تكرارات')"
              /></label>
            </div>
            <details v-if="drill.kind === 'number'">
              <summary>{{ l('Optional result bounds', 'حدود اختيارية للنتيجة') }}</summary>
              <div class="service-field-row">
                <label
                  >{{ l('Minimum', 'الحد الأدنى')
                  }}<input v-model.number="drill.min" type="number" step="any" /></label
                ><label
                  >{{ l('Maximum', 'الحد الأقصى')
                  }}<input v-model.number="drill.max" type="number" step="any"
                /></label>
              </div>
            </details>
          </section>
          <button
            type="button"
            class="button secondary add-drill"
            :disabled="draft.definition.length >= 12"
            @click="addDrill"
          >
            {{ l('Add drill', 'إضافة اختبار') }}
          </button></template
        >
        <div v-else class="service-field-row">
          <MemberPicker
            :institution="id"
            :view="view"
            role="trainee"
            v-model="draft.members"
            :label="l('Find athletes', 'البحث عن رياضيين')"
            @options="organization!.members = $event"
          />
          <MemberPicker
            v-if="!templates && view === 'admin'"
            :institution="id"
            :view="view"
            role="trainer"
            v-model="draft.coaches"
            :label="l('Add coaches to this group', 'إضافة مدربين إلى هذه المجموعة')"
            @options="
              organization!.members = [
                ...new Map([...organization!.members, ...$event].map((m) => [m.id, m])).values(),
              ]
            "
          />
        </div>
        <label v-if="draft.revision" class="check-label"
          ><input v-model="draft.archived" type="checkbox" />{{
            l('Archive from new scheduling', 'أرشفة من الجدولة الجديدة')
          }}</label
        >
        <div class="editor-footer">
          <button class="button">
            {{ templates ? l('Save template', 'حفظ القالب') : l('Save group', 'حفظ المجموعة') }}
          </button>
          <p class="small-print" role="status">
            {{
              l(
                saved
                  ? 'Draft saved on this device.'
                  : 'Changes are saved on this device as you type.',
                saved
                  ? 'حُفظت المسودة على هذا الجهاز.'
                  : 'تُحفظ التغييرات على هذا الجهاز أثناء الكتابة.',
              )
            }}
          </p>
        </div>
      </fieldset>
    </form>
    <template v-if="!editor">
      <p v-if="resume" class="notice">
        {{
          l(
            'An unfinished draft is saved on this device.',
            'توجد مسودة غير مكتملة محفوظة على هذا الجهاز.',
          )
        }}
        <RouterLink class="text-link" :to="listPath + '/' + resume">{{
          l('Continue draft', 'متابعة المسودة')
        }}</RouterLink>
      </p>
      <div class="list-toolbar">
        <form class="catalog-search-form" @submit.prevent="live.submit()">
          <label
            >{{
              templates
                ? l('Search templates', 'البحث في القوالب')
                : l('Search groups', 'البحث في المجموعات')
            }}<input
              :placeholder="
                templates
                  ? l('Search template names…', 'ابحث بأسماء القوالب…')
                  : l('Search group names…', 'ابحث بأسماء المجموعات…')
              "
              v-model="search"
              type="search" /></label
          ><label class="check-label"
            ><input v-model="archived" type="checkbox" @change="load()" />{{
              l('Archived', 'مؤرشف')
            }}</label
          >
        </form>
        <div class="list-toolbar-pagination">
          <ListPagination
            :offset="offset"
            :page-size="appliedLimit"
            :sizes="pageSizes"
            @page-size="changeLimit"
            :total="total"
            :disabled="loading"
            @page="load"
          />
        </div>
      </div>
      <PageState :loading="loading" :error="error" @retry="load()"
        ><EmptyState
          v-if="!items.length"
          :title="
            templates
              ? l('No assessment templates', 'لا توجد قوالب تقييم')
              : l('No training groups', 'لا توجد مجموعات تدريبية')
          "
          :description="
            search || archived
              ? l(
                  'Nothing matches. Try another name or clear the archive filter.',
                  'لا توجد نتائج مطابقة. جرّب اسماً آخر أو أزل مرشح الأرشفة.',
                )
              : templates
                ? l(
                    'Create a template to define the drills you record in assessments.',
                    'أنشئ قالباً لتحديد الاختبارات التي تسجلها في التقييمات.',
                  )
                : view === 'trainer'
                  ? l(
                      'Groups you create or belong to appear here. Create one to schedule people together.',
                      'تظهر هنا المجموعات التي أنشأتها أو تنتمي إليها. أنشئ مجموعة لجدولة الأشخاص معاً.',
                    )
                  : l(
                      'Create a group to schedule people together.',
                      'أنشئ مجموعة لجدولة الأشخاص معاً.',
                    )
          "
        />
        <div v-if="templates" class="assessment-template-grid">
          <article v-for="item in items" :key="item.id" class="service-library-row">
            <div>
              <h2>{{ item.title }}</h2>
              <p>
                {{ item.definition.length }}
                {{ item.definition.length === 1 ? l('drill', 'اختبار') : l('drills', 'اختبارات') }}
              </p>
            </div>
            <button
              v-if="item.canEdit !== false"
              class="button secondary small"
              @click="edit(item)"
              :disabled="locked"
            >
              {{ l('Edit', 'تعديل') }}
            </button>
          </article>
        </div>
        <!-- Groups: one compact row each — icon, name with member summary, then actions. -->
        <div v-else-if="items.length" class="group-list">
          <article v-for="item in items" :key="item.id" class="service-library-row group-row">
            <span class="group-icon" aria-hidden="true"><PhUsersThree :size="20" /></span>
            <div class="group-text">
              <h2>
                <bdi dir="auto">{{ item.name }}</bdi
                ><span v-if="item.archived" class="tag" data-status="archived">{{
                  l('Archived', 'مؤرشفة')
                }}</span>
              </h2>
              <p>
                <strong
                  >{{ item.members.length }}
                  {{
                    item.members.length === 1 ? l('person', 'شخص') : l('people', 'أشخاص')
                  }}</strong
                ><template v-if="item.members.length">
                  ·
                  <bdi dir="auto">{{
                    item.members
                      .slice(0, 4)
                      .map((m) => m.name)
                      .join(' · ')
                  }}</bdi
                  ><template v-if="item.members.length > 4">
                    · +{{ item.members.length - 4 }}</template
                  ></template
                >
              </p>
            </div>
            <div class="group-actions">
              <RouterLink
                v-if="!item.archived && item.members.some((m) => m.active)"
                class="button secondary small icon-only"
                :to="base + '/messages?group=' + encodeURIComponent(item.id)"
                :aria-label="l('Open group conversation', 'فتح محادثة المجموعة')"
                :title="l('Open group conversation', 'فتح محادثة المجموعة')"
                ><PhChatCircle :size="18" aria-hidden="true"
              /></RouterLink>
              <button
                v-if="item.canEdit !== false"
                class="button secondary small"
                @click="edit(item)"
                :disabled="locked"
              >
                {{ l('Edit', 'تعديل') }}
              </button>
            </div>
          </article>
        </div>
        <RouterLink :to="base + '/schedule/new'" class="text-link"
          >{{ l('Schedule an event', 'جدولة موعد') }} ↗</RouterLink
        ></PageState
      >
    </template>
  </div>
</template>
<style scoped>
.service-editor {
  margin-bottom: 28px;
}
.service-editor label {
  margin-block: 12px;
}
.service-editor h2 {
  font-size: 1.2rem;
}
.assessment-drill-editor {
  padding: 20px 0;
  border-block-end: 1px solid var(--line);
}
.assessment-drill-editor h3 {
  font-size: 1rem;
}
.service-field-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.service-library-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  padding: 22px 0;
  border-bottom: 1px solid var(--line);
  margin-bottom: 16px;
}
.service-library-row > div {
  min-width: 0;
  overflow-wrap: anywhere;
}
.service-library-row h2 {
  font-size: 1.05rem;
  margin: 0;
}
.service-library-row p {
  margin: 6px 0;
}
.service-library-row button {
  flex-shrink: 0;
}
.group-list {
  margin-block: var(--space-4) var(--space-5);
  border: 1px solid var(--line);
  border-radius: var(--radius-panel);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}
.group-list .group-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3) var(--space-4);
  margin: 0;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--line);
}
.group-list .group-row:last-child {
  border-bottom: 0;
}
.group-list .group-row:hover {
  background: var(--surface-soft);
}
.group-icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: var(--radius-control);
  background: var(--tint);
  color: var(--accent);
}
.group-text {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.group-text h2 {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-body);
  font-weight: 650;
}
.group-text p {
  margin: 0;
  color: var(--muted);
  font-size: var(--text-small);
  overflow-wrap: anywhere;
}
.group-text p strong {
  color: var(--ink);
  font-weight: 600;
}
.group-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.group-actions .button {
  margin: 0;
}
@media (max-width: 520px) {
  .group-list .group-row {
    grid-template-columns: auto minmax(0, 1fr);
  }
  .group-actions {
    grid-column: 2;
  }
}
@media (max-width: 550px) {
  .service-field-row {
    grid-template-columns: minmax(0, 1fr);
  }
}

.assessment-template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
  gap: 16px;
  margin-block: 20px;
}
.assessment-template-grid .service-library-row {
  align-items: stretch;
  flex-direction: column;
  gap: 20px;
  margin: 0;
  padding: 24px;
  border: 1px solid var(--line);
  border-radius: var(--radius-panel);
  background: var(--surface);
}
.assessment-template-grid h2 {
  font-size: var(--text-panel);
}
.assessment-template-grid .button {
  align-self: start;
  margin-top: auto;
}
@media (max-width: 600px) {
  .assessment-template-grid .service-library-row {
    padding: 16px;
  }
}
</style>
