<script setup lang="ts">
import { useLiveSearch } from '../../lib/live-search'
import { institutionContext } from '../../app/institution'

import PageHeading from '../../components/PageHeading.vue'
import { computed, onMounted, ref, onUnmounted } from 'vue'
import { profile } from '../../app/auth'
import { request } from '../../lib/backend'
import { language as l, errorMessage } from '../../lib/i18n'
import { localDate, addDays } from '../../lib/dates'
import PageState from '../../components/PageState.vue'
import MetricChart from './MetricChart.vue'
import TrainerDelivery from './TrainerDelivery.vue'
import ExperienceReport, { type Experience } from './ExperienceReport.vue'
import { TabsRoot, TabsList, TabsTrigger, TabsContent } from 'reka-ui'
const institution = institutionContext().institution,
  view = institutionContext().view,
  base = ''
const from = ref(addDays(localDate(profile.value?.timezone || 'UTC'), -27)),
  to = ref(localDate(profile.value?.timezone || 'UTC')),
  loading = ref(true),
  error = ref(''),
  selected = ref(''),
  search = ref('')
type Report = {
  performance?: {
    id: string
    name: string
    completed_sessions: number
    present: number
    absent: number
  }[]
  experience?: Experience
  workloadNext: number | null
  programNext: number | null
  people: { id: string; name: string }[]
  window: { zone: string; from: string; to: string }
  summary: Record<string, number>
  daily: { date: string; value: number }[]
  attendance: { label: string; value: number }[]
  workload: { id: string; label: string; value: number }[]
  programs: { id: string; label: string; value: number }[]
}
const data = ref<Report>()
const period = ref('28'),
  section = ref('activity')
function setPeriod() {
  if (period.value !== 'custom') {
    to.value = localDate(profile.value?.timezone || 'UTC')
    from.value = addDays(to.value, 1 - Number(period.value))
    void load()
  }
}
const selectedPerson = ref<{ id: string; name: string }>()
const people = computed(() => [
  ...new Map(
    [...(data.value?.people || []), ...(selectedPerson.value ? [selectedPerson.value] : [])].map(
      (p) => [p.id, p],
    ),
  ).values(),
])
function selectPerson() {
  selectedPerson.value = people.value.find((p) => p.id === selected.value)
  void load()
}
let generation = 0
onUnmounted(() => generation++)
async function load(part?: 'workload' | 'program') {
  const current = ++generation
  loading.value = true
  error.value = ''
  try {
    const result = await request<Report>(
      `${'/v1/institution' + '/analytics'}?view=${view}&from=${from.value}&to=${to.value}&member=${selected.value}&search=${encodeURIComponent(search.value)}&workloadOffset=${part === 'workload' ? data.value?.workloadNext || 0 : 0}&programOffset=${part === 'program' ? data.value?.programNext || 0 : 0}`,
    )
    if (current !== generation) return
    if (part && data.value) {
      if (part === 'workload') {
        data.value.workload.push(...result.workload)
        data.value.performance?.push(...(result.performance || []))
        data.value.workloadNext = result.workloadNext
      } else {
        data.value.programs.push(...result.programs)
        data.value.programNext = result.programNext
      }
    } else data.value = result
  } catch (e) {
    if (current !== generation) return
    error.value = errorMessage(e)
    // Keep the last successful report visible with an explicit refresh error.
  } finally {
    if (current === generation) loading.value = false
  }
}
const trend = computed(() => {
  if (!data.value || !data.value.daily.length) return []
  const values = new Map(data.value.daily.map((x) => [x.date, x.value])),
    result = []
  for (let day = data.value.window.from; day <= data.value.window.to; day = addDays(day, 1))
    result.push({
      label: day,
      value: values.get(day) || 0,
      href: base + '/training',
    })
  return result
})
const attendance = computed(
  () =>
    data.value?.attendance.map((a) => ({
      ...a,
      label: l(
        (
          {
            present: 'Present',
            absent: 'Absent',
            excused: 'Excused',
            unmarked: 'Not recorded',
            booked: 'Not recorded',
            attended: 'Attended',
            missed: 'Missed',
          } as Record<string, string>
        )[a.label] || a.label,
        (
          {
            present: 'حاضر',
            absent: 'غائب',
            excused: 'بعذر',
            unmarked: 'لم يسجل',
            booked: 'لم يسجل',
            attended: 'حضر',
            missed: 'لم يحضر',
          } as Record<string, string>
        )[a.label] || a.label,
      ),
    })) || [],
)
onMounted(() => load())
const live = useLiveSearch(search, () => load())
</script>
<template>
  <div class="container page analytics-page">
    <PageHeading class="work-heading">
      <div>
        <h1>
          {{
            view === 'admin'
              ? l('Institution analytics', 'تحليلات المؤسسة')
              : l('Coaching analytics', 'تحليلات التدريب')
          }}
        </h1>
        <p>
          {{
            view === 'admin'
              ? l('Participation, delivery and team capacity.', 'المشاركة والتدريب وقدرة الفريق.')
              : l(
                  'Training activity and the people who need your attention.',
                  'النشاط التدريبي والأشخاص الذين يحتاجون متابعتك.',
                )
          }}
        </p>
      </div>
      <label class="period-picker"
        ><span class="sr-only">{{ l('Reporting period', 'فترة التقرير') }}</span
        ><select v-model="period" @change="setPeriod">
          <option value="7">{{ l('Last 7 days', 'آخر 7 أيام') }}</option>
          <option value="28">{{ l('Last 28 days', 'آخر 28 يوماً') }}</option>
          <option value="90">{{ l('Last 90 days', 'آخر 90 يوماً') }}</option>
          <option value="custom">{{ l('Custom dates', 'تواريخ مخصصة') }}</option>
        </select></label
      >
    </PageHeading>
    <div class="analytics-toolbar">
      <p class="report-scope">
        {{
          view === 'admin'
            ? l('Institution overview', 'نظرة عامة على المؤسسة')
            : l('Your current roster', 'قائمتك الحالية')
        }}<span v-if="data">
          · {{ data.window.from }} – {{ data.window.to }} · {{ data.window.zone }}</span
        >
      </p>
      <details class="analytics-person-filter">
        <summary>{{ selectedPerson?.name || l('Filter by athlete', 'تصفية حسب الرياضي') }}</summary>
        <div class="person-filter-panel">
          <form @submit.prevent="live.submit()">
            <label
              >{{ l('Find an athlete', 'البحث عن رياضي')
              }}<input
                :placeholder="l('Search athlete names…', 'ابحث بأسماء الرياضيين…')"
                type="search"
                v-model="search"
                maxlength="100"
            /></label>
          </form>
          <label
            >{{ l('Athlete', 'الرياضي')
            }}<select v-model="selected" @change="selectPerson">
              <option value="">{{ l('Everyone in this scope', 'الجميع في هذا النطاق') }}</option>
              <option v-for="person in people" :key="person.id" :value="person.id">
                {{ person.name }}
              </option>
            </select></label
          >
          <p class="small-print">
            {{
              l(
                'Search the full roster; up to 25 matching people are shown.',
                'ابحث في القائمة الكاملة؛ يعرض حتى 25 شخصاً مطابقاً.',
              )
            }}
          </p>
        </div>
      </details>
    </div>
    <form v-if="period === 'custom'" class="analytics-filters" @submit.prevent="load()">
      <label>{{ l('From', 'من') }}<input type="date" v-model="from" :max="to" required /></label
      ><label
        >{{ l('Through', 'حتى') }}<input type="date" v-model="to" :min="from" required /></label
      ><button class="button small secondary" :disabled="loading">
        {{ l('Update view', 'تحديث العرض') }}
      </button>
    </form>
    <p v-if="loading && data" class="small-print" role="status">
      {{ l('Updating report…', 'جارٍ تحديث التقرير…') }}
    </p>
    <div v-if="error && data" class="notice error" role="alert">
      {{ error }} {{ l('Showing the last successful report.', 'نعرض آخر تقرير ناجح.') }}
      <button class="text-link" @click="load()">{{ l('Try again', 'حاول مجدداً') }}</button>
    </div>
    <PageState :loading="loading && !data" :error="!data ? error : ''" @retry="load()">
      <template v-if="data">
        <div class="analytics-numbers">
          <RouterLink :to="base + '/people'"
            ><span>{{ l('Active athletes now', 'الرياضيون النشطون الآن') }}</span
            ><strong>{{ data.summary.active }}</strong
            ><small>{{ l('View roster', 'عرض القائمة') }} ↗</small></RouterLink
          >
          <RouterLink :to="base + '/training'"
            ><span>{{ l('Completed workouts', 'التمارين المكتملة') }}</span
            ><strong>{{ data.summary.completed }}</strong
            ><small>{{
              data.summary.coach_recorded
                ? l('Coach-recorded: ', 'سجّلها مدرب: ') + data.summary.coach_recorded
                : l('In this period', 'خلال الفترة')
            }}</small></RouterLink
          >
          <div>
            <span>{{ l('Current athletes who trained', 'رياضيون حاليون تدربوا') }}</span
            ><strong dir="ltr"
              >{{ data.summary.participating }}<small> / {{ data.summary.active }}</small></strong
            ><small>{{ l('From the active roster', 'من القائمة النشطة') }}</small>
          </div>
          <RouterLink :to="base + '/training'"
            ><span>{{ l('Session reviews outstanding', 'حصص بانتظار المراجعة') }}</span
            ><strong>{{ data.summary.pending_review }}</strong
            ><small>{{ l('Review training', 'مراجعة التدريب') }} ↗</small></RouterLink
          >
        </div>
        <TabsRoot
          activation-mode="manual"
          v-model="section"
          default-value="activity"
          class="analytics-sections"
        >
          <TabsList class="report-tabs ui-tabs" :aria-label="l('Analytics views', 'عروض التحليلات')"
            ><TabsTrigger value="activity">{{
              l('Training activity', 'النشاط التدريبي')
            }}</TabsTrigger
            ><TabsTrigger value="delivery">{{
              institution
                ? l('Delivery & capacity', 'التدريب وقدرة الفريق')
                : l('Follow-up', 'المتابعة')
            }}</TabsTrigger
            ><TabsTrigger value="experience">{{
              l('Experience', 'التجربة')
            }}</TabsTrigger></TabsList
          >
          <TabsContent v-if="data.experience" value="experience" tabindex="0"
            ><ExperienceReport :report="data.experience" :base="base"
          /></TabsContent>
          <TabsContent value="activity" class="analytics-charts" tabindex="0">
            <MetricChart
              counts
              :title="l('Training over time', 'التدريب عبر الوقت')"
              :description="
                l(
                  'Completed workouts per day. Each completion is counted once.',
                  'التمارين المكتملة يومياً. يحتسب كل تمرين مرة واحدة.',
                )
              "
              :items="trend"
              :unit="l('sessions', 'حصة')"
              timeline
            />
            <MetricChart
              counts
              :title="l('Attendance', 'الحضور')"
              :description="
                l(
                  'Events that have started. Not recorded does not mean absent.',
                  'المواعيد التي بدأت. عدم التسجيل لا يعني الغياب.',
                )
              "
              :items="attendance"
              donut
            />
          </TabsContent>
          <TabsContent value="delivery" class="delivery-section" tabindex="0">
            <TrainerDelivery
              v-if="view === 'admin' && data.performance"
              :items="data.performance"
              :base="base"
            />
            <section
              class="analytics-attention"
              v-if="data.summary.without_program || data.summary.unassigned"
            >
              <h2>{{ l('Where to follow up', 'ما يحتاج المتابعة') }}</h2>
              <RouterLink v-if="data.summary.unassigned" :to="base + '/people'" class="text-link"
                >{{ data.summary.unassigned }}
                {{ l('athletes need a responsible coach', 'رياضيين يحتاجون مدرباً مسؤولاً') }}
                ↗</RouterLink
              ><RouterLink
                v-if="data.summary.without_program"
                :to="base + '/training'"
                class="text-link"
                >{{ data.summary.without_program }}
                {{ l('active athletes have no current program', 'رياضيين نشطين بلا برنامج حالي') }}
                ↗</RouterLink
              >
            </section>
            <div class="analytics-charts">
              <div v-if="view === 'admin'" class="chart-page">
                <MetricChart
                  counts
                  :title="l('Coach responsibility', 'مسؤولية المدربين')"
                  :description="
                    l(
                      'Current active athletes per coach, across the institution. This is workload, not quality.',
                      'الرياضيون النشطون لكل مدرب في المؤسسة كاملة. هذا حجم العمل وليس الجودة.',
                    )
                  "
                  :items="data.workload.map((x) => ({ ...x, href: base + '/people' }))"
                /><button
                  v-if="data.workloadNext != null"
                  :disabled="loading"
                  class="text-link"
                  @click="load('workload')"
                >
                  {{ l('Load more coaches', 'تحميل المزيد من المدربين') }}
                </button>
              </div>
              <div class="chart-page">
                <MetricChart
                  counts
                  :title="l('Programs in use', 'البرامج المستخدمة')"
                  :description="
                    l(
                      'Current active assignments by published program.',
                      'التعيينات النشطة الحالية حسب البرنامج المنشور.',
                    )
                  "
                  :items="data.programs.map((x) => ({ ...x, href: base + '/training' }))"
                /><button
                  v-if="data.programNext != null"
                  :disabled="loading"
                  class="text-link"
                  @click="load('program')"
                >
                  {{ l('Load more programs', 'تحميل المزيد من البرامج') }}
                </button>
              </div>
            </div>
          </TabsContent>
        </TabsRoot>
        <details class="analytics-method">
          <summary>{{ l('How to read these numbers', 'كيفية قراءة الأرقام') }}</summary>
          <p>
            {{
              l(
                'The date window uses your account timezone. Participation uses the active roster; completed sessions include retained history. Corrections do not count as new sessions. Cancelled events are excluded from attendance.',
                'تستخدم الفترة توقيت حسابك. المشاركة للقائمة النشطة والحصص المكتملة تشمل السجل المحفوظ. التصحيحات لا تضيف حصصاً جديدة والمواعيد الملغاة مستبعدة من الحضور.',
              )
            }}
          </p>
          <p>
            {{
              l(
                'Coach reports use current responsibility. Admins see their institution, including history preserved after reassignment. Workload always covers the whole institution, regardless of athlete filter. These counts are not adherence, health, retention or revenue scores.',
                'تقارير المدرب بحسب مسؤوليته الحالية والمسؤول يرى مؤسسته وسجلها المحفوظ بعد إعادة التعيين. حجم عمل المدربين يشمل المؤسسة كاملة بغض النظر عن مرشح الرياضي. هذه ليست درجات التزام أو صحة أو احتفاظ أو إيرادات.',
              )
            }}
          </p>
          <p>
            {{
              l(
                'Experience ratings are optional and shown separately by source; they are not an overall coach score. Coach workplace ratings are separate from athlete feedback and ignore the date and athlete filters.',
                'تقييمات التجربة اختيارية وتُعرض حسب المصدر؛ ليست تقييماً عاماً للمدرب. تقييمات بيئة عمل المدربين منفصلة عن تقييمات الرياضيين ولا تتأثر بمرشحات الفترة والرياضي.',
              )
            }}
          </p>
        </details>
      </template>
    </PageState>
  </div>
</template>
<style scoped>
.analytics-page {
  max-width: 1440px;
}
.work-heading {
  margin-bottom: 16px;
}
.period-picker {
  margin: 0;
  flex-shrink: 0;
}
.period-picker select {
  margin: 0;
  min-width: 160px;
}
.analytics-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--line);
}
.report-scope {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 650;
}
.report-scope span {
  color: var(--muted);
  font-weight: 400;
}
.analytics-person-filter {
  position: relative;
  font-size: 0.8rem;
}
.analytics-person-filter summary {
  cursor: pointer;
  color: var(--accent);
  padding: 8px 0;
}
.person-filter-panel {
  position: absolute;
  z-index: 15;
  inset-inline-end: 0;
  top: 100%;
  width: min(340px, calc(100vw - 48px));
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
  box-shadow: var(--shadow);
  padding: 16px;
}
.person-filter-panel form {
  display: flex;
  gap: 8px;
  align-items: end;
  margin-bottom: 12px;
}
.person-filter-panel label {
  flex: 1;
  min-width: 0;
}
.analytics-filters {
  display: flex;
  gap: 12px;
  align-items: end;
  margin-top: 16px;
  flex-wrap: wrap;
}
.analytics-filters label {
  max-width: 200px;
  min-width: 0;
}
.analytics-numbers {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin: 20px 0 24px;
}
.analytics-numbers > * {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.analytics-numbers > a:hover {
  border-color: var(--accent);
}
.analytics-numbers span {
  color: var(--muted);
  font-size: 0.78rem;
}
.analytics-numbers strong {
  font-size: 2rem;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}
.analytics-numbers small {
  font-size: 0.75rem;
  color: var(--muted);
  font-weight: 400;
}
.analytics-numbers strong small {
  font-size: 1.1rem;
}
.analytics-charts {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
  gap: 20px;
  align-items: stretch;
}
.analytics-charts[data-state='inactive'] {
  display: none;
}
.chart-page {
  min-width: 0;
  display: grid;
  gap: 12px;
}
.chart-page > button {
  justify-self: start;
}
.analytics-attention {
  background: var(--tint);
  border-radius: 8px;
  padding: 14px 18px;
  margin-bottom: 20px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px 24px;
  align-items: center;
  font-size: 0.85rem;
}
.analytics-attention h2 {
  font-size: 0.9rem;
  margin: 0;
}
.analytics-method {
  padding-block: 18px;
  color: var(--muted);
  font-size: 0.78rem;
}
.analytics-method summary {
  cursor: pointer;
}
.analytics-method p {
  max-width: 100ch;
  line-height: 1.7;
}
.report-next {
  padding: 24px;
}
.report-next h2 {
  font-size: 1.15rem;
}
@media (max-width: 1100px) {
  .analytics-charts {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 650px) {
  .analytics-numbers {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  .analytics-numbers > * {
    padding: 14px;
  }
  .analytics-numbers strong {
    font-size: 1.7rem;
  }
  .analytics-filters {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }
  .analytics-filters label {
    max-width: none;
  }
  .report-scope span {
    display: block;
    margin-top: 6px;
  }
  .person-filter-panel {
    inset-inline-start: 0;
    inset-inline-end: auto;
  }
}
</style>
