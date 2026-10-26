<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { PhUsers, PhGear, PhChartLine } from '@phosphor-icons/vue'
import { profile } from '../../app/auth'
import { request } from '../../lib/backend'
import { language as l, errorMessage } from '../../lib/i18n'
import { localDate, addDays } from '../../lib/dates'
import MetricChart from '../analytics/MetricChart.vue'
import PageState from '../../components/PageState.vue'
import UpcomingSessions from './UpcomingSessions.vue'
import type { Institution } from './types'
import { institutionContext } from '../../app/institution'
import { useCommand } from '../../lib/commands'
import CommandStatus from '../../components/CommandStatus.vue'
defineProps<{ institution: Institution }>()
type Report = {
  window: { from: string; to: string; zone: string }
  summary: {
    active: number
    participating: number
    completed: number
    without_program: number
    unassigned: number
  }
  daily: { date: string; value: number }[]
  attendance: { label: string; value: number }[]
}
const period = ref('28'),
  data = ref<Report>(),
  loading = ref(true),
  error = ref('')
let generation = 0
onUnmounted(() => generation++)
async function load() {
  const current = ++generation
  loading.value = true
  error.value = ''
  const to = localDate(profile.value?.timezone || 'UTC')
  try {
    const result = await request<Report>(
      `/v1/institution/analytics?view=admin&from=${addDays(to, 1 - Number(period.value))}&to=${to}`,
      { feedback: 'none' },
    )
    if (current === generation) data.value = result
  } catch (e) {
    if (current === generation) {
      error.value = errorMessage(e)
      if ([401, 403].includes((e as { statusCode?: number }).statusCode || 0))
        data.value = undefined
    }
  } finally {
    if (current === generation) loading.value = false
  }
}
const trend = computed(() => {
  if (!data.value || !data.value.daily.length) return []
  const values = new Map(data.value.daily.map((d) => [d.date, d.value])),
    result = []
  for (let day = data.value.window.from; day <= data.value.window.to; day = addDays(day, 1))
    result.push({ label: day, value: values.get(day) || 0 })
  return result
})
const attendance = computed(() =>
  (data.value?.attendance || []).map((a) => ({
    value: a.value,
    label:
      (
        {
          present: l('Present', 'حاضر'),
          absent: l('Absent', 'غائب'),
          excused: l('Excused', 'بعذر'),
          unmarked: l('Not recorded', 'لم يسجل'),
          booked: l('Not recorded', 'لم يسجل'),
        } as Record<string, string>
      )[a.label] || a.label,
  })),
)
onMounted(load)
// Keep exact pending scheduling commands from the former administrator agenda reachable.
const previousAgenda = useCommand(
  `workout-agenda:${institutionContext().institution}:due`,
  async () => {
    await load()
  },
  (name, args) =>
    request(`/v1/institution/${name === 'start' ? 'sessions' : 'workout-scheduling'}`, {
      method: 'POST',
      body: JSON.stringify(args),
    }),
  { successMessage: l('Workout change confirmed.', 'تم تأكيد تعديل التمرين.') },
)
</script>
<template>
  <div class="role-dashboard">
    <CommandStatus :command="previousAgenda" />
    <header class="dashboard-period">
      <h2>{{ l('Participation and activity', 'المشاركة والنشاط') }}</h2>
      <label
        >{{ l('Reporting period', 'فترة التقرير')
        }}<select v-model="period" @change="load">
          <option value="7">{{ l('Last 7 days', 'آخر 7 أيام') }}</option>
          <option value="28">{{ l('Last 28 days', 'آخر 28 يوماً') }}</option>
          <option value="90">{{ l('Last 90 days', 'آخر 90 يوماً') }}</option>
        </select></label
      >
    </header>
    <PageState :loading="loading && !data" :error="!data ? error : ''" @retry="load">
      <template v-if="data">
        <p v-if="error" role="alert" class="notice error">
          {{ error }}
          <button class="text-link" @click="load">{{ l('Retry', 'إعادة المحاولة') }}</button>
        </p>
        <p class="small-print" :aria-busy="loading">
          {{ data.window.from }} – {{ data.window.to }} · {{ data.window.zone }} ·
          {{
            l(
              'Last loaded period; current roster is counted now.',
              'الفترة المحمّلة؛ تُحسب القائمة الحالية الآن.',
            )
          }}
        </p>
        <div class="dashboard-metrics">
          <div>
            <span>{{ l('Completed workouts', 'التمارين المكتملة') }}</span
            ><strong>{{ data.summary.completed }}</strong
            ><small>{{
              l('Recorded completions in this period', 'إكمالات مسجلة خلال الفترة')
            }}</small>
          </div>
          <div>
            <span>{{ l('Current athletes who trained', 'رياضيون حاليون تدربوا') }}</span
            ><strong dir="ltr">{{ data.summary.participating }} / {{ data.summary.active }}</strong
            ><small>{{
              l(
                'Distinct current athletes with a recorded completion',
                'رياضيون حاليون مختلفون لديهم تمرين مكتمل مسجل',
              )
            }}</small>
          </div>
          <RouterLink to="/analytics"
            ><span>{{ l('Explore the report', 'استكشاف التقرير') }}</span
            ><PhChartLine :size="28" aria-hidden="true" /><small
              >{{ l('Activity, delivery and experience', 'النشاط والتدريب والتجربة') }} ↗</small
            ></RouterLink
          >
        </div>
        <div class="dashboard-charts">
          <MetricChart
            counts
            timeline
            :title="l('Workout activity', 'نشاط التمارين')"
            :description="
              l(
                'Recorded workout completions per day. Missing records do not prove inactivity.',
                'إكمالات التمارين المسجلة يومياً. غياب السجلات لا يثبت عدم النشاط.',
              )
            "
            :items="trend"
            :unit="l('workouts', 'تمرين')"
          />
          <MetricChart
            counts
            donut
            :title="l('Event attendance', 'حضور المواعيد')"
            :description="
              l(
                'Athlete attendance entries for non-cancelled events that started in this period. Not unique athletes; unmarked is unknown.',
                'سجلات حضور الرياضيين للمواعيد غير الملغاة التي بدأت خلال الفترة. ليست أعداد رياضيين مختلفين؛ غير المسجل مجهول.',
              )
            "
            :items="attendance"
            :unit="l('entries', 'سجل')"
          />
        </div>
      </template>
    </PageState>
    <div class="role-dashboard-columns dashboard-operations">
      <div class="role-dashboard-main">
        <h2>{{ l('Institution coverage', 'تغطية المؤسسة') }}</h2>
        <div class="dashboard-metrics">
          <RouterLink to="/people"
            ><span>{{ l('Active athletes', 'الرياضيون النشطون') }}</span
            ><strong>{{ institution.summary.trainees }}</strong></RouterLink
          >
          <RouterLink to="/people?filter=trainer"
            ><span>{{ l('Coaches', 'المدربون') }}</span
            ><strong>{{ institution.summary.trainers }}</strong></RouterLink
          >
          <RouterLink to="/people"
            ><span>{{ l('Without a primary coach', 'دون مدرب أساسي') }}</span
            ><strong>{{ institution.summary.unassigned }}</strong
            ><small
              >{{ l('Review coaching assignments', 'مراجعة تعيينات التدريب') }} ↗</small
            ></RouterLink
          >
        </div>
        <UpcomingSessions />
      </div>
      <aside class="role-dashboard-context">
        <section class="panel dashboard-action-panel">
          <h2><PhUsers aria-hidden="true" />{{ l('Manage your people', 'إدارة الأشخاص') }}</h2>
          <p>
            {{
              l(
                'Review profiles, roles and coaching responsibility. Invite people using the action above.',
                'راجع الملفات والأدوار ومسؤولية التدريب. ادعُ الأشخاص من الإجراء أعلاه.',
              )
            }}
          </p>
          <RouterLink class="button" to="/people">{{ l('Open people', 'فتح الأشخاص') }}</RouterLink>
          <RouterLink class="text-link" to="/training">{{
            l('Review athlete plans', 'مراجعة خطط الرياضيين')
          }}</RouterLink>
        </section>
        <section class="panel dashboard-action-panel">
          <h2><PhGear aria-hidden="true" />{{ l('Institution controls', 'ضبط المؤسسة') }}</h2>
          <p>
            {{
              l(
                'Manage sports, branding and institution details.',
                'أدر الرياضات والهوية وتفاصيل المؤسسة.',
              )
            }}
          </p>
          <RouterLink class="button secondary" to="/institution-settings">{{
            l('Institution settings', 'إعدادات المؤسسة')
          }}</RouterLink>
        </section>
      </aside>
    </div>
  </div>
</template>
