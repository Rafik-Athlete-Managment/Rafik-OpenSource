<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { institutionContext } from '../../app/institution'
import { user } from '../../app/auth'
import { request } from '../../lib/backend'
import { clone, type PlanDay, type Exercise } from '../../lib/domain'
import { getDraft, storeDraft, removeDraft } from '../../lib/storage'
import { useCommand } from '../../lib/commands'
import { language as l, errorMessage, locale } from '../../lib/i18n'
import WorkoutPreview from '../coaching/WorkoutPreview.vue'
import WorkoutFields from '../coaching/WorkoutFields.vue'
import PageState from '../../components/PageState.vue'
import CommandStatus from '../../components/CommandStatus.vue'
import SidePanel from '../../components/SidePanel.vue'
import ListPagination from '../../components/ListPagination.vue'
import EmptyState from '../../components/EmptyState.vue'
import DelegatedWorkout from './DelegatedWorkout.vue'
import ReviewPage from '../coaching/ReviewPage.vue'
import {
  ComboboxRoot,
  ComboboxAnchor,
  ComboboxInput,
  ComboboxTrigger,
  ComboboxContent,
  ComboboxItem,
  ComboboxPortal,
} from 'reka-ui'
import { PhCaretDown } from '@phosphor-icons/vue'
type Person = {
  member_id: string
  name: string
  revision: number
  attendance: string
  skip_reason: string
  can_start: boolean
  can_skip: boolean
  blocked: string | null
  session: { id: string; completed_at: string | null; version: number } | null
}
type Group = { workout: { title: string; day: PlanDay } | null; participants: Person[] }
const props = defineProps<{ event: string; refreshToken?: number | string }>()
const emit = defineEmits<{ ready: [boolean]; locked: [boolean] }>()
const context = institutionContext(),
  route = useRoute(),
  router = useRouter(),
  owner = user.value!.id
const data = ref<Group>(),
  loading = ref(true),
  error = ref(''),
  catalog = ref<Exercise[]>([]),
  selected = ref<Person>(),
  workout = ref<PlanDay>(),
  reason = ref(''),
  mode = ref<'start' | 'skip'>('start'),
  open = ref(false),
  preparing = ref(false)
const adapting = ref(false)
const offset = ref(Math.floor(Math.max(0, Number(route.query.rosterPage) || 0) / 10) * 10),
  search = ref(String(route.query.rosterSearch || ''))
const activeMember = ref(String(route.query.groupAthlete || ''))
const reviewing = ref(context.view !== 'trainer' || route.query.groupReview === 'true')
const childLocked = ref(false)
const reviewer = ref<InstanceType<typeof ReviewPage>>()
const recorder = ref<InstanceType<typeof DelegatedWorkout>>()
const activePerson = computed(() =>
  data.value?.participants.find((p) => p.member_id === activeMember.value),
)
const nextPerson = computed(() =>
  data.value?.participants.find(
    (p) =>
      p.member_id !== activeMember.value &&
      !p.skip_reason &&
      !p.session?.completed_at &&
      (p.can_start || p.session),
  ),
)
const phoneQuery = ref('')
const phonePeople = computed(
  () =>
    data.value?.participants.filter((p) =>
      p.name.toLocaleLowerCase().includes(phoneQuery.value.toLocaleLowerCase()),
    ) || [],
)
async function remember() {
  if (disposed) return
  await router.replace({
    query: {
      ...route.query,
      groupAthlete: activeMember.value || undefined,
      rosterSearch: search.value || undefined,
      rosterPage: offset.value ? String(offset.value) : undefined,
      groupReview: reviewing.value ? 'true' : undefined,
    },
  })
}
watch([activeMember, search, offset, reviewing], () => {
  void remember()
})
async function choose(member: string) {
  if (member === activeMember.value || childLocked.value || locked.value) return
  if (recorder.value && !(await recorder.value.flushDraft())) return
  if (reviewer.value && !(await reviewer.value.flushDraft())) return
  activeMember.value = member
  reviewing.value = context.view !== 'trainer' || !!activePerson.value?.session?.completed_at
  childLocked.value = false
}
async function completed() {
  reviewing.value = true
  childLocked.value = false
  await load()
}
async function nextAthlete() {
  if (!nextPerson.value) return
  search.value = ''
  await nextTick()
  const position = data.value!.participants.indexOf(nextPerson.value)
  offset.value = Math.floor(position / 10) * 10
  await choose(nextPerson.value.member_id)
}
const filtered = computed(
  () =>
    data.value?.participants.filter((p) =>
      p.name.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase()),
    ) || [],
)
const visible = computed(() => filtered.value.slice(offset.value, offset.value + 10))
watch(search, () => {
  offset.value = 0
})
let generation = 0,
  disposed = false,
  selectionGeneration = 0
onUnmounted(() => {
  disposed = true
  generation++
  selectionGeneration++
})
const draftKey = (member: string) =>
  `group-workout-draft:${owner}:${context.institution}:${props.event}:${member}`
const resolved = computed(
  () =>
    !!data.value &&
    data.value.participants.every(
      (p) =>
        p.attendance !== 'unmarked' &&
        (!(p.attendance === 'present' || p.session) ||
          !!p.session?.completed_at ||
          !!p.skip_reason),
    ),
)
watch(resolved, (value) => emit('ready', value), { immediate: true })
async function load() {
  const seq = ++generation
  loading.value = true
  error.value = ''
  try {
    const result = await request<Group>(
      `/v1/institution/group-workouts?view=${context.view}&event=${props.event}`,
      { feedback: 'none' },
    )
    if (!disposed && seq === generation) {
      data.value = result
      if (!result.participants.some((p) => p.member_id === activeMember.value)) {
        activeMember.value = result.participants[0]?.member_id || ''
        reviewing.value = context.view !== 'trainer' || !!activePerson.value?.session?.completed_at
      }
      offset.value = Math.min(
        offset.value,
        Math.max(0, Math.ceil(filtered.value.length / 10) - 1) * 10,
      )
    }
  } catch (e) {
    if (!disposed && seq === generation) {
      error.value = errorMessage(e)
      data.value = undefined
    }
  } finally {
    if (!disposed && seq === generation) loading.value = false
  }
}
watch(
  () => props.refreshToken,
  () => {
    void load()
  },
)
const started = ref('')
const command = useCommand(
  `group-workout:${owner}:${context.institution}:${props.event}`,
  async (action, result) => {
    if (action === 'start') {
      const session = result as { id: string; member_id: string }
      started.value = session.id
      await removeDraft(draftKey(session.member_id))
    }
    if (!disposed) {
      open.value = false
      selected.value = undefined
      // A roster refresh is independent of the acknowledged write. In particular,
      // never hold start navigation behind a potentially slow follow-up read.
      void load()
    }
  },
  (_, args) =>
    request('/v1/institution/group-workouts', { method: 'POST', body: JSON.stringify(args) }),
  {
    successMessage: (action) =>
      action === 'start'
        ? false
        : l(
            'Participant workout skipped. Existing records are preserved.',
            'تم تخطي تمرين المشارك مع الاحتفاظ بالسجلات السابقة.',
          ),
  },
)
const locked = computed(
  () =>
    loading.value ||
    preparing.value ||
    !command.state.ready ||
    command.state.busy ||
    !!command.state.pending,
)
async function prepare(person: Person, action: 'start' | 'skip') {
  const stamp = ++selectionGeneration
  preparing.value = true
  error.value = ''
  try {
    const stored = await getDraft<{ workout: PlanDay; reason: string; adapting?: boolean }>(
      draftKey(person.member_id),
    )
    if (action === 'start' && !catalog.value.length)
      catalog.value = (
        await request<Exercise[]>(`/v1/institution/catalog?view=${context.view}`, {
          feedback: 'none',
        })
      ).filter((e) => e.scope !== 'private' && e.active !== false)
    if (disposed || stamp !== selectionGeneration) return
    selected.value = person
    mode.value = action
    adapting.value = !!stored?.adapting
    workout.value = clone(stored?.workout || data.value!.workout!.day)
    reason.value = stored?.reason || ''
    open.value = true
  } catch (e) {
    if (!disposed) error.value = errorMessage(e)
  } finally {
    if (!disposed && stamp === selectionGeneration) preparing.value = false
  }
}
watch(
  [workout, reason, adapting],
  () => {
    if (!selected.value || !open.value || !workout.value) return
    void storeDraft(draftKey(selected.value.member_id), {
      workout: workout.value,
      reason: reason.value,
      adapting: adapting.value,
    }).catch((e) => {
      if (!disposed) error.value = errorMessage(e)
    })
  },
  { deep: true },
)
async function submit(action: 'start' | 'skip') {
  const person = activePerson.value
  if (!person || locked.value) return
  const origin = route.fullPath
  started.value = ''
  await command.run(action, {
    operation: crypto.randomUUID(),
    action,
    event: props.event,
    view: context.view,
    member_id: person.member_id,
    revision: person.revision,
    id: crypto.randomUUID(),
    ...(action === 'start' ? { workout: workout.value } : { reason: reason.value }),
  })
  if (started.value && !command.state.pending && !disposed && route.fullPath === origin) {
    reviewing.value = false
    await load()
  }
}
watch(
  () => locked.value || childLocked.value,
  (value) => emit('locked', value),
  { immediate: true },
)
watch(
  () => [activeMember.value, activePerson.value?.can_start] as const,
  ([, canStart]) => {
    if (
      canStart &&
      activePerson.value &&
      !activePerson.value.session &&
      selected.value?.member_id !== activeMember.value
    )
      void prepare(activePerson.value, 'start')
  },
)
function blockedLabel(reason: string) {
  return reason === 'cancelled'
    ? l(
        'This event was cancelled. Existing records remain available.',
        'أُلغي الموعد وتبقى السجلات السابقة متاحة.',
      )
    : reason === 'not_started'
      ? l('Recording opens at the scheduled start time.', 'يفتح التسجيل عند حلول الموعد المحدد.')
      : reason === 'inactive'
        ? l(
            'This athlete is no longer active. Existing records remain available.',
            'لم يعد هذا الرياضي نشطاً وتبقى السجلات السابقة متاحة.',
          )
        : reason === 'participation_unavailable'
          ? l(
              'A participation restriction prevents starting this workout.',
              'تمنع قيود المشاركة بدء هذا التمرين.',
            )
          : l('Record attendance as present before starting.', 'حدد الحضور أولاً قبل بدء التسجيل.')
}
function status(person: Person) {
  return person.skip_reason
    ? l('Skipped', 'متخطى')
    : person.session?.completed_at
      ? l('Completed', 'مكتمل')
      : person.session
        ? l('In progress', 'قيد التنفيذ')
        : l('Not recorded', 'لم يُسجل')
}
onMounted(load)
</script>
<template>
  <section class="group-workout-section">
    <CommandStatus :command="command" />
    <PageState :loading="loading && !data" :error="error" @retry="load">
      <template v-if="data?.workout">
        <details class="shared-workout-preview" :open="!activePerson?.session && !adapting">
          <summary>
            {{ l('Shared workout preview', 'معاينة التمرين المشترك') }} ·
            <bdi>{{ data.workout.title }}</bdi>
          </summary>
          <p class="small-print">
            {{
              l(
                'Additional training. Each athlete has separate results; individual plans do not advance.',
                'تدريب إضافي. لكل رياضي نتائج مستقلة ولا تتقدم خطط الأفراد.',
              )
            }}
          </p>
          <WorkoutPreview :workout="data.workout.day" heading-level="h2" />
        </details>
        <div v-if="context.view === 'trainee'" class="group-own-result">
          <RouterLink
            v-if="activePerson?.session"
            class="button secondary"
            :to="'/review/' + activePerson.session.id"
            >{{ l('View workout', 'عرض التمرين') }}</RouterLink
          >
          <p v-else class="small-print">
            {{ l('Your coach records your workout results.', 'يسجل مدربك نتائج تمرينك.') }}
          </p>
        </div>
        <div v-if="context.view !== 'trainee'" class="group-recording-heading">
          <h2>{{ l('Athlete recording', 'تسجيل الرياضيين') }}</h2>
          <button
            type="button"
            class="button secondary small"
            :disabled="loading || locked || childLocked"
            @click="load"
          >
            {{ l('Refresh results', 'تحديث النتائج') }}
          </button>
        </div>
        <div v-if="context.view !== 'trainee'" class="group-recording-layout">
          <aside
            class="group-athlete-sidebar"
            :aria-label="l('Workout athletes', 'رياضيو التمرين')"
          >
            <label class="group-roster-search"
              >{{ l('Search athletes', 'البحث عن الرياضيين')
              }}<input
                v-model="search"
                type="search"
                :placeholder="l('Search athlete names…', 'ابحث بأسماء الرياضيين…')"
            /></label>
            <ul class="group-athlete-list">
              <li v-for="person in visible" :key="person.member_id">
                <button
                  type="button"
                  :aria-current="activeMember === person.member_id ? 'true' : undefined"
                  :disabled="locked || childLocked"
                  @click="choose(person.member_id)"
                >
                  <bdi>{{ person.name }}</bdi
                  ><span
                    class="tag"
                    :data-status="
                      person.skip_reason
                        ? 'skipped'
                        : person.session?.completed_at
                          ? 'completed'
                          : person.session
                            ? 'in_progress'
                            : 'pending'
                    "
                    >{{ status(person) }}</span
                  >
                </button>
              </li>
            </ul>
            <EmptyState
              v-if="!filtered.length"
              compact
              :title="l('No matching athletes', 'لا يوجد رياضيون مطابقون')"
              :description="l('Try another athlete name.', 'جرّب اسم رياضي آخر.')"
            />
            <ListPagination
              v-if="filtered.length > 10"
              :offset="offset"
              :page-size="10"
              :total="filtered.length"
              @page="offset = $event"
            />
          </aside>
          <div class="group-athlete-phone">
            <label id="group-athlete-label">{{ l('Selected athlete', 'الرياضي المحدد') }}</label>
            <ComboboxRoot
              :dir="locale === 'ar' ? 'rtl' : 'ltr'"
              :model-value="activeMember"
              :disabled="locked || childLocked"
              ignore-filter
              :reset-search-term-on-select="true"
              @update:model-value="choose(String($event))"
              @update:open="
                (value) => {
                  if (!value) phoneQuery = ''
                }
              "
            >
              <ComboboxAnchor class="group-athlete-anchor">
                <ComboboxInput
                  aria-labelledby="group-athlete-label"
                  :display-value="() => activePerson?.name || ''"
                  :placeholder="l('Search athlete names…', 'ابحث بأسماء الرياضيين…')"
                  @input.capture="phoneQuery = ($event.target as HTMLInputElement).value"
                />
                <ComboboxTrigger
                  type="button"
                  class="button secondary icon-only"
                  :aria-label="l('Choose athlete', 'اختيار الرياضي')"
                  ><PhCaretDown :size="18"
                /></ComboboxTrigger>
              </ComboboxAnchor>
              <ComboboxPortal
                ><ComboboxContent
                  class="group-athlete-options"
                  position="popper"
                  :collision-padding="12"
                  :side-offset="6"
                >
                  <ComboboxItem
                    v-for="person in phonePeople"
                    :key="person.member_id"
                    :value="person.member_id"
                    ><bdi>{{ person.name }}</bdi> · {{ status(person) }}</ComboboxItem
                  >
                  <p v-if="!phonePeople.length">
                    {{ l('No matching athletes', 'لا يوجد رياضيون مطابقون') }}
                  </p>
                </ComboboxContent></ComboboxPortal
              >
            </ComboboxRoot>
          </div>
          <div
            class="group-athlete-sheet"
            :aria-label="l('Selected athlete workout', 'تمرين الرياضي المحدد')"
            role="region"
          >
            <template v-if="activePerson">
              <div class="group-sheet-toolbar">
                <span
                  class="tag"
                  :data-status="
                    activePerson.skip_reason
                      ? 'skipped'
                      : activePerson.session?.completed_at
                        ? 'completed'
                        : activePerson.session
                          ? 'in_progress'
                          : 'pending'
                  "
                  >{{ status(activePerson) }}</span
                >
                <button
                  v-if="activePerson.can_skip"
                  type="button"
                  class="button secondary small danger-action"
                  :disabled="locked || childLocked"
                  @click="prepare(activePerson, 'skip')"
                >
                  {{ l('Skip with reason', 'تخطي مع ذكر السبب') }}
                </button>
              </div>
              <template v-if="activePerson.session">
                <ReviewPage
                  v-if="reviewing"
                  ref="reviewer"
                  :key="'review:' + activePerson.session.id"
                  embedded
                  :workout-id="activePerson.session.id"
                  @locked="childLocked = $event"
                  @record="reviewing = false"
                />
                <DelegatedWorkout
                  v-else
                  ref="recorder"
                  :key="activePerson.session.id"
                  embedded
                  :workout-id="activePerson.session.id"
                  @locked="childLocked = $event"
                  @completed="completed"
                />
                <button
                  v-if="nextPerson"
                  type="button"
                  class="button secondary group-next"
                  :disabled="locked || childLocked"
                  @click="nextAthlete"
                >
                  {{ l('Record next athlete', 'تسجيل الرياضي التالي') }}
                </button>
              </template>
              <template v-else>
                <h3 dir="auto">{{ activePerson.name }}</h3>
                <p v-if="context.view === 'admin'" class="small-print">
                  {{
                    l(
                      'Only designated session coaches record athlete results. You can review results here once recorded.',
                      'يسجل مدربو الجلسة المحددون نتائج الرياضيين فقط. يمكنك مراجعة النتائج هنا بعد تسجيلها.',
                    )
                  }}
                </p>
                <p v-if="activePerson.skip_reason" class="small-print preserve-lines">
                  {{ activePerson.skip_reason }}
                </p>
                <p v-else-if="activePerson.blocked" class="small-print">
                  {{ blockedLabel(activePerson.blocked) }}
                </p>
                <form
                  v-else-if="
                    activePerson.can_start &&
                    workout &&
                    selected?.member_id === activePerson.member_id
                  "
                  class="form-stack group-participant-form"
                  @submit.prevent="submit('start')"
                >
                  <button
                    type="button"
                    class="button secondary"
                    :disabled="locked"
                    :aria-expanded="adapting"
                    @click="adapting = !adapting"
                  >
                    {{ l('Adapt workout for this athlete', 'تكييف التمرين لهذا الرياضي') }}
                  </button>
                  <template v-if="adapting"
                    ><p class="small-print">
                      {{
                        l(
                          'Changes apply to this athlete only. The shared baseline remains unchanged.',
                          'تطبق التغييرات على هذا الرياضي فقط وتبقى الوصفة المشتركة كما هي.',
                        )
                      }}
                    </p>
                    <WorkoutFields v-model="workout" :catalog="catalog" :disabled="locked"
                  /></template>
                  <div class="editor-footer">
                    <button class="button" :disabled="locked">
                      {{ l('Start recording', 'بدء التسجيل') }}
                    </button>
                  </div>
                </form>
                <button
                  v-else-if="activePerson.can_start"
                  type="button"
                  class="button"
                  :disabled="locked"
                  @click="prepare(activePerson, 'start')"
                >
                  {{ l('Prepare recording', 'تحضير التسجيل') }}
                </button>
              </template>
            </template>
          </div>
        </div>
        <p v-if="context.view !== 'trainee' && !resolved" class="small-print">
          {{
            l(
              'Before finishing the event, complete or explicitly skip each present athlete’s workout and any unfinished recording.',
              'قبل إنهاء الموعد، أكمل أو تخطّ صراحة تمرين كل حاضر وأي تسجيل غير مكتمل.',
            )
          }}
        </p>
      </template>
    </PageState>
    <SidePanel
      v-if="mode === 'skip'"
      v-model:open="open"
      :locked="locked"
      :title="l('Skip participant workout', 'تخطي تمرين المشارك')"
      :description="selected?.name"
    >
      <form
        v-if="selected"
        class="form-stack group-participant-form"
        @submit.prevent="submit('skip')"
      >
        <label
          >{{ l('Reason (no health details)', 'السبب (دون تفاصيل صحية)')
          }}<textarea v-model="reason" required maxlength="2000" :disabled="locked" />
        </label>
        <div class="actions editor-footer">
          <button class="button danger-action" :disabled="locked">
            {{ l('Confirm skip', 'تأكيد التخطي') }}</button
          ><button type="button" class="button secondary" :disabled="locked" @click="open = false">
            {{ l('Cancel', 'إلغاء') }}
          </button>
        </div>
      </form>
    </SidePanel>
  </section>
</template>
<style scoped>
.group-workout-section {
  display: grid;
  gap: var(--space-5);
  margin-block: var(--space-5);
  min-width: 0;
}
.shared-workout-preview {
  padding: var(--space-4);
  border: 1px solid var(--line);
  border-radius: var(--radius-panel);
  background: var(--surface);
}
.shared-workout-preview summary {
  font-weight: 600;
  cursor: pointer;
}
.shared-workout-preview > :deep(section) {
  margin-block-start: var(--space-4);
}
.group-recording-heading,
.group-sheet-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
.group-recording-heading h2 {
  margin: 0;
  font-size: var(--text-section);
}
.group-recording-layout {
  display: grid;
  grid-template-columns: minmax(200px, 260px) minmax(0, 1fr);
  gap: var(--space-5);
  align-items: start;
}
.group-athlete-sidebar {
  min-width: 0;
  border-inline-end: 1px solid var(--line);
  padding-inline-end: var(--space-4);
}
.group-roster-search {
  display: grid;
  gap: var(--space-2);
  margin: 0;
}
.group-roster-search input {
  margin: 0;
}
.group-athlete-list {
  list-style: none;
  padding: 0;
  margin: var(--space-3) 0;
  display: grid;
  gap: var(--space-2);
}
.group-athlete-list button {
  width: 100%;
  display: grid;
  justify-items: start;
  gap: var(--space-2);
  text-align: start;
  padding: var(--space-3);
  border: 1px solid transparent;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--ink);
  min-height: 44px;
}
.group-athlete-list button[aria-current='true'] {
  border-color: var(--accent);
  background: var(--surface);
}
.group-athlete-list bdi {
  overflow-wrap: anywhere;
}
.group-athlete-sheet {
  display: grid;
  gap: var(--space-4);
  min-width: 0;
}
.group-athlete-sheet h3 {
  margin: 0;
  font-size: var(--text-section);
}
.group-participant-form > .button,
.group-sheet-toolbar .button {
  margin: 0;
}
.group-athlete-phone {
  display: none;
}
.group-next {
  justify-self: start;
}
@media (max-width: 980px) {
  .group-recording-layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .group-athlete-sidebar {
    display: none;
  }
  .group-athlete-phone {
    display: grid;
    gap: var(--space-2);
  }
  .group-athlete-phone label {
    margin: 0;
  }
  .group-athlete-anchor {
    gap: var(--space-2);
    display: flex;
    min-width: 0;
  }
  .group-athlete-anchor input {
    flex: 1;
    min-width: 0;
    margin: 0;
  }
  .group-athlete-anchor button {
    flex: 0 0 44px;
  }
}
</style>
<style>
.group-athlete-options {
  z-index: 120;
  background: var(--surface);
  color: var(--ink);
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  padding: var(--space-2);
  width: var(--reka-combobox-trigger-width);
  max-width: calc(100vw - 24px);
  max-height: min(320px, var(--reka-combobox-content-available-height));
  overflow-y: auto;
}
.group-athlete-options [data-reka-collection-item] {
  padding: var(--space-3);
  min-height: 44px;
  cursor: pointer;
  overflow-wrap: anywhere;
}
.group-athlete-options [data-highlighted] {
  background: var(--page);
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
</style>
