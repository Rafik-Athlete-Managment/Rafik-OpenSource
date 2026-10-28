<script setup lang="ts">
import { language as l } from '../../lib/i18n'
import MetricChart from './MetricChart.vue'
export type Experience = {
  client: { source: string; score: number | null; value: number }[]
  workplace: { score: number | null; value: number }[] | null
  workplaceMonth: string
}
defineProps<{ report: Experience; base: string }>()
const sources = ['calendar', 'workout']
const ratings = (items: { score: number | null; value: number }[]) =>
  Array.from({ length: 5 }, (_, i) => ({
    label: String(i + 1) + ' / 5',
    value: items.filter((x) => x.score === i + 1).reduce((n, x) => n + x.value, 0),
  }))
const count = (items: { score: number | null; value: number }[], responded = false) =>
  items.filter((x) => !responded || x.score !== null).reduce((n, x) => n + x.value, 0)
const average = (items: { score: number | null; value: number }[]) => {
  const n = count(items, true)
  return n ? (items.reduce((sum, x) => sum + (x.score || 0) * x.value, 0) / n).toFixed(1) : '—'
}
type Rated = { score: number | null; value: number }[]
const ratingsOrEmpty = (items: Rated) => (count(items, true) ? ratings(items) : [])
// Average and response coverage first, then the scale; missing ratings stay unknown.
const summary = (items: Rated, noun: 'sessions' | 'coaches') => {
  const rated = count(items, true),
    total = count(items)
  const coaches = (n: number) => (n === 1 ? 'active coach' : 'active coaches')
  const coverage = !total
    ? noun === 'sessions'
      ? l('No eligible sessions in this period.', 'لا جلسات مؤهلة في هذه الفترة.')
      : l('No active coaches this month.', 'لا مدربين نشطين هذا الشهر.')
    : !rated
      ? noun === 'sessions'
        ? l(
            `No ratings yet from ${total} eligible sessions.`,
            `لا تقييمات بعد من ${total} جلسة مؤهلة.`,
          )
        : l(
            `No responses yet from ${total} ${coaches(total)}.`,
            `لا إجابات بعد من ${total} مدرب نشط.`,
          )
      : noun === 'sessions'
        ? l(
            `Average ${average(items)} out of 5, from ${rated} of ${total} eligible sessions.`,
            `المتوسط ${average(items)} من 5، من ${rated} من أصل ${total} جلسة مؤهلة.`,
          )
        : l(
            `Average ${average(items)} out of 5, from ${rated} of ${total} ${coaches(total)}.`,
            `المتوسط ${average(items)} من 5، من ${rated} من أصل ${total} مدرب نشط.`,
          )
  return (
    coverage +
    ' ' +
    l(
      '1 = very dissatisfied, 5 = very satisfied. Missing ratings are not neutral.',
      '1 = غير راضٍ جداً، 5 = راضٍ جداً. عدم الإجابة لا يعني الحياد.',
    )
  )
}
</script>
<template>
  <div class="analytics-charts experience-report">
    <MetricChart
      v-for="source in sources"
      :key="source"
      counts
      :title="
        source === 'calendar'
          ? l('Scheduled session satisfaction', 'الرضا عن الجلسات المجدولة')
          : l('Workout satisfaction', 'الرضا عن التمارين')
      "
      :description="
        summary(
          report.client.filter((x) => x.source === source),
          'sessions',
        )
      "
      :items="ratingsOrEmpty(report.client.filter((x) => x.source === source))"
      :unit="l('responses', 'إجابة')"
    />
    <MetricChart
      v-if="report.workplace"
      counts
      :title="l('Coach workplace satisfaction', 'رضا المدربين عن بيئة العمل')"
      :description="
        l('Current month', 'الشهر الحالي') +
        ': ' +
        report.workplaceMonth.slice(0, 7) +
        ' (UTC). ' +
        summary(report.workplace, 'coaches')
      "
      :items="ratingsOrEmpty(report.workplace)"
      :unit="l('coaches', 'مدرب')"
    />
  </div>
</template>
<style scoped>
.analytics-charts.experience-report {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
@media (max-width: 1050px) {
  .analytics-charts.experience-report {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
