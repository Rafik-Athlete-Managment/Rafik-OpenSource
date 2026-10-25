<script setup lang="ts">
import { PhTray } from '@phosphor-icons/vue'
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
function selectAssignment(id?: string) {
  if (id)
    return router.push({
      path: '/training/' + id,
      query: { ...route.query, assignment: undefined },
    })
}
watch(
  () => [route.query.status, route.query.search, route.query.offset],
  () => {
    status.value = String(route.query.status || 'active')
    search.value = String(route.query.search || '')
    void load()
  },
)
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

@media (max-width: 650px) {
  .plan-filters {
    grid-template-columns: minmax(0, 1fr);
  }
  .athlete-plan-card {
    padding: 20px;
  }
}
</style>
