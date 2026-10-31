<script setup lang="ts">
import { PhTray, PhCalendarPlus } from '@phosphor-icons/vue'
import OverflowMenu from '../../components/OverflowMenu.vue'
import { useLiveSearch } from '../../lib/live-search'
import type { WorkoutAgendaItem } from '@rafik/shared/contracts'
import AthleteSearch from '../../components/AthleteSearch.vue'
import { useListPageSize } from '../../lib/list-page-size'
import PageHeading from '../../components/PageHeading.vue'
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type {
  AthletePlanPage,
  AthletePlanSummary,
  AthletePlanStatus,
} from '@rafik/shared/contracts'
import { request } from '../../lib/backend'
import { language as l, locale, errorMessage } from '../../lib/i18n'
import { formatDate } from '../../lib/dates'
import { timestampLabel } from '../../lib/display-time'
import { programContext } from '../coaching/program-context'
import ListPagination from '../../components/ListPagination.vue'
import PageState from '../../components/PageState.vue'
const route = useRoute(),
  router = useRouter(),
  context = programContext(route)
const data = ref<AthletePlanPage>(),
  loading = ref(false),
  error = ref(''),
  appliedOffset = ref(0)
const search = ref(String(route.query.search || '')),
  status = ref(String(route.query.status || 'active'))
let generation = 0,
  disposed = false
const labels: Record<AthletePlanStatus, [string, string]> = {
  active: ['Active', 'نشط'],
  upcoming: ['Upcoming', 'قادم'],
  expired: ['Expired', 'منتهي المدة'],
  ended: ['Ended / replaced', 'متوقف / مستبدل'],
}
const label = (value: AthletePlanStatus) => l(...labels[value])
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
function navigate(offset = 0, replace = false) {
  return router[replace ? 'replace' : 'push']({
    query: {
      limit: route.query.limit,
      ...(search.value.trim() ? { search: search.value.trim() } : {}),
      ...(status.value !== 'active' ? { status: status.value } : {}),
      ...(offset ? { offset } : {}),
      ...(route.query.assignment ? { assignment: route.query.assignment } : {}),
    },
  })
}
const live = useLiveSearch(search, () => navigate(0, true))
watch(
  () => [route.query.status, route.query.search, route.query.offset],
  () => {
    status.value = String(route.query.status || 'active')
    live.restore(String(route.query.search || ''))
    void load()
  },
)
const nextStates: Record<WorkoutAgendaItem['state'], [string, string]> = {
  unscheduled: ['Awaiting schedule', 'بانتظار الجدولة'],
  scheduled: ['Scheduled', 'مجدول'],
  ready: ['Ready to start', 'جاهز للبدء'],
  overdue: ['Overdue', 'متأخر'],
  in_progress: ['In progress', 'قيد التنفيذ'],
  paused: ['Paused', 'متوقف مؤقتاً'],
}
const nextWhen = (plan: AthletePlanSummary) => {
  const next = plan.next_workout
  if (!next?.training_date) return ''
  if (!next.starts_at) return formatDate(next.training_date, locale.value)
  return timestampLabel(next.starts_at)
}
const planLabel = (plan: AthletePlanSummary) => [plan.goal, plan.sport].filter(Boolean).join(' · ')
onMounted(() => {
  void load()
  if (route.query.assignment)
    void router.replace({
      path: '/training/' + String(route.query.assignment),
      query: { ...route.query, assignment: undefined },
    })
})
onUnmounted(() => {
  disposed = true
  generation++
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
      <form class="plan-filters" @submit.prevent="live.submit()">
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
        <ul v-else class="record-list athlete-plan-list">
          <li v-for="plan in data.items" :key="plan.id" class="record-row">
            <div class="record-title">
              <RouterLink :to="'/training/' + plan.id"
                ><bdi dir="auto">{{ plan.member_name }}</bdi></RouterLink
              >
              <small
                ><bdi dir="auto">{{ plan.version.title }}</bdi
                ><template v-if="plan.adaptation_revision">
                  · {{ l('Personalized', 'مخصصة') }}</template
                ><template v-if="planLabel(plan)">
                  · <bdi dir="auto">{{ planLabel(plan) }}</bdi></template
                ></small
              >
              <small v-if="!plan.member_active">{{
                l('Inactive institution membership', 'عضوية المؤسسة غير نشطة')
              }}</small>
            </div>
            <div class="record-meta">
              <span class="tag" :data-status="plan.status">{{ label(plan.status) }}</span>
              <span v-if="plan.next_workout"
                ><small>{{ l('Next workout', 'التمرين التالي') }}</small
                ><span
                  >{{ l(...nextStates[plan.next_workout.state])
                  }}<template v-if="nextWhen(plan)"> · {{ nextWhen(plan) }}</template></span
                ></span
              >
              <span
                ><small>{{ l('Dates', 'التواريخ') }}</small
                >{{ formatDate(plan.start_date, locale) }} –
                {{
                  plan.end_date
                    ? formatDate(plan.end_date, locale)
                    : l('No end date', 'دون تاريخ انتهاء')
                }}</span
              >
            </div>
            <div class="record-actions">
              <RouterLink
                v-if="plan.next_workout?.state === 'unscheduled'"
                class="button small secondary"
                :to="{ path: '/training/' + plan.id, query: { schedule: '1' } }"
                ><PhCalendarPlus :size="18" aria-hidden="true" />{{
                  l('Schedule', 'جدولة')
                }}</RouterLink
              >
              <OverflowMenu
                compact
                :label="l('More actions for ', 'إجراءات أخرى لـ ') + plan.member_name"
                :items="[
                  {
                    key: 'plan',
                    label: l('View assigned plan', 'عرض الخطة المعيّنة'),
                    to: '/training/' + plan.id,
                  },
                  {
                    key: 'history',
                    label: l('Workout history', 'سجل التمارين'),
                    to: { path: '/workouts', query: { search: plan.member_name } },
                  },
                  {
                    key: 'profile',
                    label: l('Athlete profile', 'ملف الرياضي'),
                    to: '/members/' + plan.member_id,
                  },
                ]"
              />
            </div>
          </li>
        </ul> </template
    ></PageState>
  </div>
</template>
<style scoped>
.plan-filters {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 16px;
  align-items: end;
}
.plan-filters label {
  margin: 0;
  min-width: 0;
}
.athlete-plan-list .record-row {
  grid-template-columns: minmax(180px, 1fr) minmax(0, 1.8fr) 170px;
}
.athlete-plan-list .record-meta {
  display: grid;
  grid-template-columns: 7.5rem minmax(0, 1.2fr) minmax(0, 1fr);
}
.athlete-plan-list .record-meta > .tag {
  align-self: center;
}
@media (max-width: 760px) {
  .athlete-plan-list .record-row {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .athlete-plan-list .record-meta {
    display: flex;
  }
}
@media (max-width: 650px) {
  .plan-filters {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
