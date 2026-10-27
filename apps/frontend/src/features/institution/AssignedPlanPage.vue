<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  PhArrowLeft,
  PhBarbell,
  PhChartLine,
  PhUser,
  PhPencilSimple,
  PhStopCircle,
} from '@phosphor-icons/vue'
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from 'reka-ui'
import OverflowMenu from '../../components/OverflowMenu.vue'
import { formatDate } from '../../lib/dates'
import type { AthletePlanPage, AthletePlanSummary } from '@rafik/shared/contracts'
import { institutionContext } from '../../app/institution'
import { request } from '../../lib/backend'
import { language as l, locale, errorMessage } from '../../lib/i18n'
import { exerciseName, targetLabel } from '../../lib/prescriptions'
import type { Prescription } from '../../lib/domain'
import PageHeading from '../../components/PageHeading.vue'
import PageState from '../../components/PageState.vue'
import CommandStatus from '../../components/CommandStatus.vue'
import { useCommand } from '../../lib/commands'
import WorkoutAgenda from './WorkoutAgenda.vue'
import WorkoutRuleSettings from './WorkoutRuleSettings.vue'
import PlanEditor from '../coaching/PlanEditor.vue'
const route = useRoute(),
  router = useRouter(),
  context = institutionContext()
const detail = ref<AthletePlanSummary>(),
  loading = ref(true),
  error = ref('')
const workoutRevision = ref(0)
const adapting = computed(() => route.query.adapt === '1')
const prescription = () => detail.value?.version.prescription as Prescription | undefined
let disposed = false,
  generation = 0
onUnmounted(() => {
  disposed = true
  generation++
})
async function load() {
  const seq = ++generation
  loading.value = true
  error.value = ''
  try {
    const page = await request<AthletePlanPage>(
      '/v1/institution/athlete-plans?view=' +
        context.view +
        '&assignment=' +
        encodeURIComponent(String(route.params.assignment)),
    )
    if (disposed || seq !== generation) return
    detail.value = page.items[0]
    if (!detail.value) throw Error('assignment_unavailable')
  } catch (e) {
    if (!disposed && seq === generation) {
      error.value = errorMessage(e)
      detail.value = undefined
    }
  } finally {
    if (!disposed && seq === generation) loading.value = false
  }
}
const ending = useCommand(
  'assigned-plan-end:' + context.institution + ':' + route.params.assignment,
  async () => {
    if (!disposed) await load()
  },
  (_, args) => request('/v1/institution/delivery', { method: 'POST', body: JSON.stringify(args) }),
  { successMessage: l('Plan ended.', 'تم إنهاء الخطة.') },
)
const endPlan = () =>
  ending.run('end', {
    operation: crypto.randomUUID(),
    action: 'end',
    view: context.view,
    assignment: detail.value!.id,
    revision: detail.value!.revision,
  })
// A Schedule link from Athlete plans opens the scheduling panel once, then clears the query.
const scheduleOnOpen = route.query.schedule === '1'
if (scheduleOnOpen) void router.replace({ query: { ...route.query, schedule: undefined } })
const confirmingEnd = ref(false)
const endLocked = computed(() => !ending.state.ready || ending.state.busy || !!ending.state.pending)
async function confirmEnd() {
  await endPlan()
  if (!disposed && !ending.state.pending && !ending.state.error) confirmingEnd.value = false
}
function adapt() {
  return router.replace({
    query: {
      ...route.query,
      adapt: adapting.value ? undefined : '1',
      member: detail.value!.member_id,
    },
  })
}
async function adapted() {
  if (disposed) return
  await load()
  if (!disposed) await router.replace({ query: { ...route.query, adapt: undefined } })
}
watch(() => route.params.assignment, load)
onMounted(load)
</script>
<template>
  <section
    class="container page assigned-plan-page"
    :aria-label="l('Assigned plan', 'الخطة المعيّنة')"
  >
    <RouterLink
      class="back-link"
      :to="{
        path: '/training',
        query: {
          search: route.query.search,
          status: route.query.status,
          limit: route.query.limit,
          offset: route.query.offset,
        },
      }"
      ><PhArrowLeft :size="18" aria-hidden="true" class="directional" />{{
        l('Athlete plans', 'خطط الرياضيين')
      }}</RouterLink
    >
    <PageState :loading="loading" :error="error" @retry="load"
      ><template v-if="detail">
        <PageHeading
          ><div>
            <p class="overline">{{ l('Assigned plan', 'الخطة المعيّنة') }}</p>
            <h1>
              <bdi>{{ detail.version.title }}</bdi>
            </h1>
            <p>
              <RouterLink :to="'/athletes/' + detail.member_id"
                ><bdi dir="auto">{{ detail.member_name }}</bdi></RouterLink
              >
              ·
              <span v-if="detail.goal || detail.sport"
                >{{ [detail.goal, detail.sport].filter(Boolean).join(' · ') }} ·
              </span>
              {{
                detail.adaptation_revision
                  ? l('Personalized plan · revision', 'خطة مخصصة · مراجعة')
                  : l('Library version', 'نسخة المكتبة')
              }}
              {{ detail.adaptation_revision || detail.version.revision }}
            </p>
          </div>
          <span class="tag" :data-status="detail.status">{{
            detail.status === 'active'
              ? l('Active', 'نشط')
              : detail.status === 'upcoming'
                ? l('Upcoming', 'قادم')
                : detail.status === 'expired'
                  ? l('Expired', 'منتهي المدة')
                  : l('Ended / replaced', 'متوقف / مستبدل')
          }}</span></PageHeading
        >
        <ul class="context-links" :aria-label="l('Related records', 'سجلات مرتبطة')">
          <li>
            <RouterLink :to="'/athletes/' + detail.member_id"
              ><PhUser :size="18" aria-hidden="true" />{{
                l('Athlete profile', 'ملف الرياضي')
              }}</RouterLink
            >
          </li>
          <li>
            <RouterLink :to="{ path: '/workouts', query: { search: detail.member_name } }"
              ><PhBarbell :size="18" aria-hidden="true" />{{
                l('Workout history', 'سجل التمارين')
              }}</RouterLink
            >
          </li>
          <li>
            <RouterLink :to="'/assessments/' + detail.member_id"
              ><PhChartLine :size="18" aria-hidden="true" />{{
                l('Assessment history', 'سجل التقييمات')
              }}</RouterLink
            >
          </li>
        </ul>
        <div class="assigned-actions" role="group" :aria-label="l('Plan actions', 'إجراءات الخطة')">
          <button class="button" @click="adapt">
            <PhPencilSimple :size="18" aria-hidden="true" />{{
              adapting
                ? l('View assigned plan', 'عرض الخطة المعيّنة')
                : l('Adapt athlete plan', 'تعديل خطة الرياضي')
            }}
          </button>
          <OverflowMenu
            v-if="detail.state === 'active'"
            :label="l('More plan actions', 'إجراءات أخرى للخطة')"
            :items="[
              {
                key: 'end',
                label: l('End plan…', 'إنهاء الخطة…'),
                icon: PhStopCircle,
                danger: true,
                disabled: endLocked,
              },
            ]"
            @select="confirmingEnd = true"
          />
        </div>
        <DialogRoot v-model:open="confirmingEnd">
          <DialogPortal>
            <DialogOverlay class="ui-dialog-overlay" />
            <DialogContent
              class="ui-dialog"
              :dir="locale === 'ar' ? 'rtl' : 'ltr'"
              @interact-outside="endLocked && $event.preventDefault()"
              @escape-key-down="endLocked && $event.preventDefault()"
            >
              <DialogTitle>{{ l('End this plan?', 'إنهاء هذه الخطة؟') }}</DialogTitle>
              <DialogDescription>
                {{
                  l(
                    'The plan stops for ' +
                      detail.member_name +
                      '. Recorded workouts and history are kept; unfinished work stays visible for review.',
                    'تتوقف الخطة لـ ' +
                      detail.member_name +
                      '. تبقى التمارين المسجلة والسجل محفوظة، ويظل العمل غير المكتمل ظاهراً للمراجعة.',
                  )
                }}
              </DialogDescription>
              <CommandStatus :command="ending" />
              <div class="ui-dialog-actions">
                <DialogClose as-child
                  ><button type="button" class="button secondary" :disabled="endLocked">
                    {{ l('Keep plan', 'الإبقاء على الخطة') }}
                  </button></DialogClose
                ><button
                  type="button"
                  class="button danger-button"
                  :disabled="endLocked"
                  @click="confirmEnd"
                >
                  <PhStopCircle :size="18" aria-hidden="true" />{{ l('End plan', 'إنهاء الخطة') }}
                </button>
              </div>
            </DialogContent>
          </DialogPortal>
        </DialogRoot>
        <CommandStatus :command="ending" />
        <PlanEditor v-if="adapting" :key="detail.id" :assigned-plan="detail" @adapted="adapted" />
        <div v-else class="assigned-layout">
          <div class="assigned-main">
            <p v-if="prescription()?.description" class="plan-description">
              {{
                locale === 'ar'
                  ? prescription()?.descriptionAr || prescription()?.description
                  : prescription()?.description
              }}
            </p>
            <WorkoutAgenda
              :key="detail.id"
              :assignment="detail.id"
              :refresh-token="workoutRevision"
              :auto-schedule="scheduleOnOpen"
            />
            <WorkoutRuleSettings
              :key="'rule:' + detail.id"
              :assignment="detail.id"
              :starts-on="detail.start_date.slice(0, 10)"
              :ends-on="detail.end_date?.slice(0, 10) || null"
              @changed="workoutRevision++"
            />
            <section :aria-label="l('Assigned prescription', 'الوصفة المعيّنة')">
              <h2>{{ l('Program preview', 'معاينة البرنامج') }}</h2>
              <details v-for="day in prescription()?.days || []" :key="day.id" class="plan-day">
                <summary>
                  <bdi>{{ locale === 'ar' ? day.nameAr || day.name : day.name }}</bdi> ·
                  {{
                    day.restDay ? l('Recovery', 'تعافٍ') : day.minutes + ' ' + l('minutes', 'دقيقة')
                  }}
                </summary>
                <p>
                  {{ l('Week', 'الأسبوع') }} {{ day.week || 1 }} · {{ l('Day', 'اليوم') }}
                  {{ (day.weekday || 0) + 1 }}
                </p>
                <ul>
                  <li v-for="exercise in day.exercises" :key="exercise.key">
                    <strong>{{ exerciseName(exercise) }}</strong>
                    <p>
                      {{ exercise.group ? exercise.group + ' · ' : '' }}{{ exercise.sets }}
                      {{ l('sets', 'مجموعات') }} · {{ targetLabel(exercise) }} · {{ exercise.rest }}
                      {{ l('sec rest', 'ث راحة') }}
                    </p>
                    <p v-for="(target, index) in exercise.targets || []" :key="index">
                      {{ index + 1 }}. {{ targetLabel(exercise, target) }}
                    </p>
                    <p v-if="exercise.note">{{ exercise.note }}</p>
                  </li>
                </ul>
              </details>
            </section>
          </div>
          <aside class="assigned-summary panel" :aria-label="l('Plan summary', 'ملخص الخطة')">
            <dl>
              <div>
                <dt>{{ l('Athlete', 'الرياضي') }}</dt>
                <dd>
                  <RouterLink :to="'/athletes/' + detail.member_id"
                    ><bdi dir="auto">{{ detail.member_name }}</bdi></RouterLink
                  >
                </dd>
              </div>
              <div>
                <dt>{{ l('Dates', 'التواريخ') }}</dt>
                <dd>
                  {{ formatDate(detail.start_date, locale) }} –
                  {{
                    detail.end_date
                      ? formatDate(detail.end_date, locale)
                      : l('No end date', 'دون تاريخ انتهاء')
                  }}
                </dd>
              </div>
              <div>
                <dt>{{ l('Version', 'النسخة') }}</dt>
                <dd>
                  {{
                    detail.adaptation_revision
                      ? l('Personalized · revision ', 'مخصصة · مراجعة ') +
                        detail.adaptation_revision
                      : l('Library version ', 'نسخة المكتبة ') + detail.version.revision
                  }}
                </dd>
              </div>
              <div v-if="detail.goal || detail.sport">
                <dt>{{ l('Goal and sport', 'الهدف والرياضة') }}</dt>
                <dd>
                  <bdi dir="auto">{{
                    [detail.goal, detail.sport].filter(Boolean).join(' · ')
                  }}</bdi>
                </dd>
              </div>
              <div>
                <dt>{{ l('Schedule type', 'نوع الجدولة') }}</dt>
                <dd>
                  {{
                    detail.schedule_mode === 'cycle'
                      ? l('Repeating cycle', 'دورة متكررة')
                      : l('Flexible schedule', 'جدول مرن')
                  }}
                </dd>
              </div>
            </dl>
          </aside>
        </div>
      </template></PageState
    >
  </section>
</template>
<style scoped>
.assigned-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  margin-block: var(--space-5);
}
.assigned-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 320px);
  gap: var(--space-8);
  align-items: start;
}
.assigned-main {
  min-width: 0;
}
.assigned-main > :first-child {
  margin-block-start: 0;
}
.assigned-summary {
  position: sticky;
  top: var(--space-4);
  margin: 0;
}
.assigned-summary dl {
  display: grid;
  gap: var(--space-4);
  margin: 0;
}
.assigned-summary dt {
  color: var(--muted);
  font-size: var(--text-caption);
}
.assigned-summary dd {
  margin: 2px 0 0;
}
@media (max-width: 1100px) {
  .assigned-layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .assigned-summary {
    position: static;
    grid-row: 1;
  }
}
.assigned-actions .button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}
.plan-description {
  max-width: 75ch;
  line-height: 1.7;
}
.plan-day {
  padding-block: var(--space-4);
  border-block-end: 1px solid var(--line);
}
.plan-day li {
  margin-block: var(--space-4);
}
.assigned-plan-page {
  overflow-wrap: anywhere;
}
</style>
