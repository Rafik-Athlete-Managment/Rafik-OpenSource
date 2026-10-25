<script setup lang="ts">
import { PhTray } from '@phosphor-icons/vue'
import AthleteSearch from '../../components/AthleteSearch.vue'
import WorkoutAgenda from './WorkoutAgenda.vue'
import { useListPageSize } from '../../lib/list-page-size'
import PageHeading from '../../components/PageHeading.vue'
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type {
  AthletePlanPage,
  AthletePlanSummary,
  AthletePlanStatus,
} from '@rafik/shared/contracts'
import { request } from '../../lib/backend'
import { language as l, locale, errorMessage } from '../../lib/i18n'
import { formatDate } from '../../lib/dates'
import { exerciseName, targetLabel } from '../../lib/prescriptions'
import type { Prescription } from '../../lib/domain'
import { programContext } from '../coaching/program-context'
import ListPagination from '../../components/ListPagination.vue'
import PageState from '../../components/PageState.vue'
import { useCommand } from '../../lib/commands'
import CommandStatus from '../../components/CommandStatus.vue'
const route = useRoute(),
  router = useRouter(),
  context = programContext(route)
const data = ref<AthletePlanPage>(),
  loading = ref(false),
  error = ref(''),
  appliedOffset = ref(0)
const search = ref(String(route.query.search || '')),
  status = ref(String(route.query.status || 'active')),
  detail = ref<AthletePlanSummary>(),
  detailError = ref(''),
  detailBusy = ref(false),
  detailHeading = ref<HTMLElement>()
let generation = 0,
  detailGeneration = 0,
  disposed = false
const labels: Record<AthletePlanStatus, [string, string]> = {
  active: ['Active', 'نشط'],
  upcoming: ['Upcoming', 'قادم'],
  expired: ['Expired', 'منتهي المدة'],
  ended: ['Ended / replaced', 'متوقف / مستبدل'],
}
const label = (value: AthletePlanStatus) => l(...labels[value])
const prescription = () => detail.value?.version.prescription as Prescription | undefined
const { recordLimit, appliedLimit, pageSizes, acceptLimit, changeLimit } = useListPageSize(
  24,
  () => {
    void load()
  },
)
async function load() {
  const current = ++generation
  loading.value = true
  error.value = ''
  const offset = Math.max(0, Number(route.query.offset) || 0)
  const query = new URLSearchParams({
    view: context.view,
    status: String(route.query.status || 'active'),
    search: String(route.query.search || ''),
    limit: String(recordLimit.value),
    offset: String(offset),
  })
  try {
    const result = await request<AthletePlanPage>(`/v1/institution/athlete-plans?${query}`)
    if (disposed || current !== generation) return
    data.value = result
    acceptLimit()
    appliedOffset.value = offset
  } catch (e) {
    if (!disposed && current === generation) {
      error.value = errorMessage(e)
      if ((e as { statusCode?: number }).statusCode === 403) data.value = undefined
    }
  } finally {
    if (!disposed && current === generation) loading.value = false
  }
}
function navigate(offset = 0) {
  return router.push({
    query: {
      limit: route.query.limit,
      ...(search.value.trim() ? { search: search.value.trim() } : {}),
      ...(status.value !== 'active' ? { status: status.value } : {}),
      ...(offset ? { offset } : {}),
      ...(route.query.assignment ? { assignment: route.query.assignment } : {}),
    },
  })
}
async function loadDetail() {
  const current = ++detailGeneration
  detail.value = undefined
  detailError.value = ''
  if (!route.query.assignment) {
    detailBusy.value = false
    return
  }
  detailBusy.value = true
  try {
    const result = await request<AthletePlanPage>(
      `/v1/institution/athlete-plans?view=${context.view}&assignment=${encodeURIComponent(String(route.query.assignment))}`,
    )
    if (disposed || current !== detailGeneration) return
    detail.value = result.items[0]
    await nextTick()
    if (!disposed) detailHeading.value?.focus()
  } catch (e) {
    if (!disposed && current === detailGeneration) detailError.value = errorMessage(e)
  } finally {
    if (!disposed && current === detailGeneration) detailBusy.value = false
  }
}
function selectAssignment(id?: string) {
  const query = { ...route.query }
  if (id) query.assignment = id
  else delete query.assignment
  return router.push({ query })
}
watch(
  () => [route.query.status, route.query.search, route.query.offset],
  () => {
    status.value = String(route.query.status || 'active')
    search.value = String(route.query.search || '')
    void load()
  },
)
watch(() => route.query.assignment, loadDetail)
const planLabel = (plan: AthletePlanSummary) => [plan.goal, plan.sport].filter(Boolean).join(' · ')
// Ending archives one plan; recorded sessions and the published version stay in history.
const ending = useCommand<'end-plan'>(
  `athlete-plan-end:${context.institution}:${context.view}`,
  async () => {
    await Promise.all([loadDetail(), load()])
  },
  (_, args) =>
    request(`/v1/institution/delivery`, {
      method: 'POST',
      body: JSON.stringify(args),
    }),
  { successMessage: l('Plan ended.', 'تم إنهاء الخطة.') },
)
const endPlan = (plan: AthletePlanSummary) =>
  ending.run('end-plan', {
    operation: crypto.randomUUID(),
    action: 'end',
    view: context.view,
    assignment: plan.id,
    revision: plan.revision,
  })
onMounted(() => {
  void load()
  void loadDetail()
})
onUnmounted(() => {
  disposed = true
  generation++
  detailGeneration++
})
</script>
<template>
  <div class="container page athlete-plans-page">
    <PageHeading class="work-heading">
      <div>
        <p class="overline">{{ l('Assigned programs', 'البرامج المعيّنة') }}</p>
        <h1>{{ l('Athlete plans', 'خطط الرياضيين') }}</h1>
        <p>
          {{
            l(
              'Active assignments across your athletes. Open a plan to review the assigned version.',
              'الخطط النشطة لرياضييك. افتح خطة لمراجعة النسخة المعيّنة.',
            )
          }}
        </p>
      </div>
      <div class="actions">
        <RouterLink class="button secondary" :to="context.base + '/workouts'">{{
          l('Workout history', 'سجل التمارين')
        }}</RouterLink
        ><RouterLink class="button" :to="context.base + '/plans'">{{
          l('Assign a program', 'تعيين برنامج')
        }}</RouterLink>
      </div>
    </PageHeading>
    <div class="list-toolbar">
      <form class="plan-filters" @submit.prevent="navigate()">
        <AthleteSearch v-model="search" />
        <label
          >{{ l('Plan status', 'حالة الخطة') }}
          <select v-model="status" @change="navigate()">
            <option
              v-for="value in ['active', 'upcoming', 'expired', 'ended'] as const"
              :key="value"
              :value="value"
            >
              {{ label(value) }}
            </option>
            <option value="all">{{ l('All plans', 'جميع الخطط') }}</option>
          </select>
        </label>
        <button class="button secondary" :disabled="loading">{{ l('Search', 'بحث') }}</button>
      </form>
      <div class="list-toolbar-pagination">
        <ListPagination
          :label="l('Plan pages', 'صفحات الخطط')"
          :offset="appliedOffset"
          :page-size="appliedLimit"
          :sizes="pageSizes"
          @page-size="changeLimit"
          :total="data?.total || 0"
          :disabled="loading"
          @page="navigate"
        />
      </div>
    </div>

    <p v-if="loading && data" role="status" class="small-print">
      {{ l('Updating plans…', 'جارٍ تحديث الخطط…') }}
    </p>
    <p v-if="error && data" role="alert" class="notice error">
      {{ error }}
      <button class="text-link" @click="load">{{ l('Retry', 'إعادة المحاولة') }}</button>
    </p>
    <section
      v-if="route.query.assignment"
      class="panel assigned-plan-detail"
      :aria-label="l('Assigned plan', 'الخطة المعيّنة')"
    >
      <button class="text-link" @click="selectAssignment()">
        {{ l('Close plan', 'إغلاق الخطة') }}
      </button>
      <PageState :loading="detailBusy" :error="detailError" @retry="loadDetail"
        ><template v-if="detail">
          <h2 ref="detailHeading" tabindex="-1">{{ detail.version.title }}</h2>
          <p v-if="planLabel(detail)" class="tag" dir="auto">{{ planLabel(detail) }}</p>
          <p>
            {{ detail.member_name }} · {{ l('Version', 'النسخة') }} {{ detail.version.revision }} ·
            {{ label(detail.status) }}
          </p>
          <p v-if="prescription()?.description">
            {{
              locale === 'ar'
                ? prescription()?.descriptionAr || prescription()?.description
                : prescription()?.description
            }}
          </p>
          <p class="small-print">
            {{ detail.start_date }} — {{ detail.end_date || l('No end date', 'دون تاريخ انتهاء') }}
          </p>
          <WorkoutAgenda :key="detail.id" :assignment="detail.id" />
          <details v-for="day in prescription()?.days || []" :key="day.id" class="plan-day">
            <summary>
              {{ locale === 'ar' ? day.nameAr || day.name : day.name }} ·
              {{ day.restDay ? l('Recovery', 'تعافٍ') : day.minutes + ' ' + l('minutes', 'دقيقة') }}
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
          <div class="actions">
            <RouterLink
              class="button secondary"
              :to="context.base + '/workouts?member=' + detail.member_id"
              >{{ l('Workout history', 'سجل التمارين') }}</RouterLink
            ><RouterLink
              class="text-link"
              :to="context.base + '/assessments/' + detail.member_id"
              >{{ l('Assessment history', 'سجل التقييمات') }}</RouterLink
            ><RouterLink class="text-link" :to="context.base + '/athletes/' + detail.member_id">{{
              l('Athlete profile', 'ملف الرياضي')
            }}</RouterLink
            ><RouterLink
              class="text-link"
              :to="
                context.base +
                '/plans/new?source=' +
                detail.version.program_id +
                '&member=' +
                detail.member_id
              "
              >{{ l('Adapt this program', 'تكييف هذا البرنامج') }}</RouterLink
            ><button
              v-if="detail.state === 'active'"
              type="button"
              class="button secondary"
              :disabled="ending.state.busy || !!ending.state.pending || !ending.state.ready"
              @click="endPlan(detail)"
            >
              {{ l('End plan', 'إنهاء الخطة') }}
            </button>
          </div>
          <CommandStatus :command="ending" /> </template
      ></PageState>
    </section>
    <PageState :loading="loading && !data" :error="!data ? error : ''" @retry="load"
      ><template v-if="data">
        <p class="list-summary">
          {{ data.total }} {{ l('matching assignments', 'خطط مطابقة') }} · {{ data.today }} ·
          {{ data.zone }}
        </p>
        <section v-if="!data.items.length" class="empty-state panel">
          <PhTray :size="28" aria-hidden="true" />
          <h2>{{ l('No plans match this view.', 'لا توجد خطط مطابقة لهذا العرض.') }}</h2>
          <p>
            {{
              l(
                'Try another status or search, or assign a published program.',
                'جرّب حالة أو بحثاً آخر، أو عيّن برنامجاً منشوراً.',
              )
            }}
          </p>
          <RouterLink class="button secondary" :to="context.base + '/plans'">{{
            l('Browse programs', 'استعراض البرامج')
          }}</RouterLink>
        </section>
        <div v-else class="athlete-plan-grid">
          <article v-for="plan in data.items" :key="plan.id" class="athlete-plan-card">
            <div class="heading-actions">
              <p class="plan-athlete" dir="auto">{{ plan.member_name }}</p>
              <span class="tag">{{ label(plan.status) }}</span>
            </div>
            <h2 dir="auto">{{ plan.version.title }}</h2>
            <p v-if="planLabel(plan)" class="tag plan-sport" dir="auto">{{ planLabel(plan) }}</p>
            <p class="small-print">
              {{ l('Version', 'النسخة') }} {{ plan.version.revision }} ·
              {{
                plan.schedule_mode === 'cycle'
                  ? l('Repeating cycle', 'دورة متكررة')
                  : l('Flexible schedule', 'جدول مرن')
              }}
            </p>
            <dl>
              <div>
                <dt>{{ l('Starts', 'البداية') }}</dt>
                <dd>{{ formatDate(plan.start_date, locale) }}</dd>
              </div>
              <div>
                <dt>{{ l('Ends', 'النهاية') }}</dt>
                <dd>
                  {{
                    plan.end_date
                      ? formatDate(plan.end_date, locale)
                      : l('No end date', 'دون تاريخ انتهاء')
                  }}
                </dd>
              </div>
            </dl>
            <p v-if="!plan.member_active" class="small-print">
              {{ l('Inactive institution membership', 'عضوية المؤسسة غير نشطة') }}
            </p>
            <button class="button secondary" @click="selectAssignment(plan.id)">
              {{ l('View assigned plan', 'عرض الخطة المعيّنة') }}
            </button>
          </article>
        </div>
      </template></PageState
    >
  </div>
</template>
<style scoped>
.plan-filters {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) auto;
  gap: 16px;
  align-items: end;
}
.plan-filters label {
  margin: 0;
  min-width: 0;
}
.athlete-filter {
  margin-block: 18px;
}
.athlete-plan-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 310px), 1fr));
  gap: 18px;
}
.athlete-plan-card {
  display: flex;
  flex-direction: column;
  padding: var(--space-6);
  border: 1px solid var(--line);
  border-radius: var(--radius-panel);
  background: var(--surface);
  min-width: 0;
}
.athlete-plan-card h2 {
  font-size: var(--text-panel);
  margin-block: 12px 4px;
  overflow-wrap: anywhere;
}
.plan-athlete {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.plan-sport {
  align-self: flex-start;
  max-width: 100%;
  margin-block: 4px;
}
.athlete-plan-card dl {
  display: flex;
  flex-wrap: wrap;
  gap: 16px 32px;
  margin-block: 20px;
}
.athlete-plan-card dt {
  font-size: 0.8rem;
  color: var(--muted);
}
.athlete-plan-card dd {
  margin: 4px 0 0;
}
.athlete-plan-card > button {
  margin-top: auto;
  align-self: start;
}

.assigned-plan-detail {
  margin-block: 24px;
  min-width: 0;
  overflow-wrap: anywhere;
}
.assigned-plan-detail h2 {
  font-size: 1.4rem;
}
.plan-day {
  padding-block: 14px;
  border-top: 1px solid var(--line);
}
.plan-day li {
  margin-block: 12px;
}
.plan-day p {
  margin-block: 5px;
}
@media (max-width: 650px) {
  .plan-filters {
    grid-template-columns: minmax(0, 1fr);
  }
  .athlete-plan-card,
  .assigned-plan-detail {
    padding: 20px;
  }
}
</style>
