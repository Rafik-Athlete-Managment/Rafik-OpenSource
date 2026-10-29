<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { institutionContext } from '../../app/institution'
import { user } from '../../app/auth'
import { request } from '../../lib/backend'
import { clone, type PlanDay, type Exercise } from '../../lib/domain'
import { getDraft, storeDraft, removeDraft } from '../../lib/storage'
import { useCommand } from '../../lib/commands'
import { language as l, errorMessage } from '../../lib/i18n'
import WorkoutPreview from '../coaching/WorkoutPreview.vue'
import WorkoutFields from '../coaching/WorkoutFields.vue'
import PageState from '../../components/PageState.vue'
import CommandStatus from '../../components/CommandStatus.vue'
import SidePanel from '../../components/SidePanel.vue'
import ListPagination from '../../components/ListPagination.vue'
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
const emit = defineEmits<{ ready: [boolean] }>()
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
const offset = ref(0),
  search = ref('')
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
    if (!disposed && seq === generation) data.value = result
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
async function submit() {
  const person = selected.value
  if (!person || locked.value) return
  const origin = route.fullPath
  started.value = ''
  await command.run(mode.value, {
    operation: crypto.randomUUID(),
    action: mode.value,
    event: props.event,
    view: context.view,
    member_id: person.member_id,
    revision: person.revision,
    id: crypto.randomUUID(),
    ...(mode.value === 'start' ? { workout: workout.value } : { reason: reason.value }),
  })
  if (started.value && !command.state.pending && !disposed && route.fullPath === origin)
    await router.push('/record/' + started.value)
}
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
    <div class="heading-actions">
      <div>
        <h2>{{ l('Group workout', 'التمرين الجماعي') }}</h2>
        <p class="small-print">
          {{
            l(
              'Additional training. Each athlete has separate results; individual plans do not advance.',
              'تدريب إضافي. لكل رياضي نتائج مستقلة ولا تتقدم خطط الأفراد.',
            )
          }}
        </p>
      </div>
      <button
        type="button"
        class="button secondary small"
        :disabled="loading || locked"
        @click="load"
      >
        {{ l('Refresh results', 'تحديث النتائج') }}
      </button>
    </div>
    <CommandStatus :command="command" />
    <PageState :loading="loading && !data" :error="error" @retry="load"
      ><template v-if="data?.workout"
        ><details>
          <summary>
            {{ l('Shared workout prescription', 'وصفة التمرين المشتركة') }} ·
            <bdi>{{ data.workout.title }}</bdi>
          </summary>
          <WorkoutPreview :workout="data.workout.day" />
        </details>
        <div class="list-toolbar">
          <label
            >{{ l('Search athletes', 'البحث عن الرياضيين')
            }}<input
              v-model="search"
              type="search"
              :placeholder="l('Search athlete names…', 'ابحث بأسماء الرياضيين…')" /></label
          ><ListPagination
            v-if="filtered.length > 10"
            :offset="offset"
            :page-size="10"
            :total="filtered.length"
            @page="offset = $event"
          />
        </div>
        <p v-if="!filtered.length" class="small-print">
          {{ l('No athletes match this search.', 'لا يوجد رياضيون مطابقون للبحث.') }}
        </p>
        <ul class="group-workout-roster">
          <li v-for="person in visible" :key="person.member_id">
            <div>
              <h3>
                <bdi>{{ person.name }}</bdi>
              </h3>
              <span
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
              <p
                v-if="person.blocked && !person.skip_reason && !person.session?.completed_at"
                class="small-print"
              >
                {{ blockedLabel(person.blocked) }}
              </p>
              <p v-if="person.skip_reason" class="small-print preserve-lines">
                {{ person.skip_reason }}
              </p>
            </div>
            <div class="actions">
              <RouterLink
                v-if="person.session"
                class="button secondary"
                :to="'/review/' + person.session.id"
                >{{ l('View workout', 'عرض التمرين') }}</RouterLink
              ><button
                v-if="person.can_start"
                type="button"
                class="button"
                :disabled="locked"
                @click="prepare(person, 'start')"
              >
                {{ l('Record workout', 'تسجيل التمرين') }}</button
              ><button
                v-if="person.can_skip"
                type="button"
                class="button secondary danger-action"
                :disabled="locked"
                @click="prepare(person, 'skip')"
              >
                {{ l('Skip with reason', 'تخطي مع ذكر السبب') }}
              </button>
            </div>
          </li>
        </ul>
        <p v-if="context.view !== 'trainee' && !resolved" class="small-print">
          {{
            l(
              'Before finishing the event, complete or explicitly skip each present athlete’s workout and any unfinished recording.',
              'قبل إنهاء الموعد، أكمل أو تخطّ صراحة تمرين كل حاضر وأي تسجيل غير مكتمل.',
            )
          }}
        </p></template
      ></PageState
    >
    <SidePanel
      v-model:open="open"
      :locked="locked"
      :title="
        mode === 'start'
          ? l('Prepare participant workout', 'تحضير تمرين المشارك')
          : l('Skip participant workout', 'تخطي تمرين المشارك')
      "
      :description="selected?.name"
      ><form v-if="selected" @submit.prevent="submit">
        <p class="small-print">
          {{
            l(
              'Changes apply to this athlete only. The shared baseline remains unchanged.',
              'تطبق التغييرات على هذا الرياضي فقط وتبقى الوصفة المشتركة كما هي.',
            )
          }}
        </p>
        <template v-if="mode === 'start' && workout"
          ><WorkoutPreview v-if="!adapting" :workout="workout" /><button
            type="button"
            class="button secondary"
            :disabled="locked"
            @click="adapting = !adapting"
          >
            {{
              adapting
                ? l('Preview participant workout', 'معاينة تمرين المشارك')
                : l('Adapt workout for this athlete', 'تكييف التمرين لهذا الرياضي')
            }}
          </button></template
        >
        <WorkoutFields
          v-if="mode === 'start' && workout && adapting"
          v-model="workout"
          :catalog="catalog"
          :disabled="locked"
        /><label v-if="mode === 'skip'"
          >{{ l('Reason (no health details)', 'السبب (دون تفاصيل صحية)')
          }}<textarea v-model="reason" required maxlength="2000" :disabled="locked" />
        </label>
        <div class="actions">
          <button class="button" :disabled="locked">
            {{
              mode === 'start'
                ? l('Start recording', 'بدء التسجيل')
                : l('Confirm skip', 'تأكيد التخطي')
            }}</button
          ><button
            type="button"
            class="button secondary danger-action"
            :disabled="locked"
            @click="open = false"
          >
            {{ l('Cancel', 'إلغاء') }}
          </button>
        </div>
      </form></SidePanel
    >
  </section>
</template>
<style scoped>
.group-workout-section {
  display: grid;
  gap: var(--space-5);
  margin-block: var(--space-6);
}
.group-workout-roster {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: var(--space-3);
}
.group-workout-roster > li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-4);
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--surface);
}
.group-workout-roster h3 {
  margin-block: 0 var(--space-2);
}
.group-workout-roster p {
  margin-block: var(--space-2) 0;
}
@media (max-width: 650px) {
  .group-workout-roster > li {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
