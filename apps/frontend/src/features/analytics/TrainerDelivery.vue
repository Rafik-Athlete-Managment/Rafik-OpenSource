<script setup lang="ts">
import { language as l } from '../../lib/i18n'
import MetricChart from './MetricChart.vue'
defineProps<{
  items: { id: string; name: string; completed_sessions: number; present: number; absent: number }[]
  base: string
}>()
</script>
<template>
  <section class="trainer-delivery">
    <MetricChart
      counts
      :title="l('Coach session delivery', 'الجلسات التي قدمها المدربون')"
      :description="
        l(
          'Completed training appointments in the selected period, credited to the staff assigned to each event. Team-wide; the athlete filter does not apply. Co-led sessions appear for each coach. Counts describe delivery, not quality.',
          'مواعيد التدريب المكتملة خلال الفترة، منسوبة لموظفي كل جلسة. للمؤسسة كاملة دون مرشح الرياضي. تُحسب الجلسات المشتركة لكل مدرب. الأعداد تصف تقديم الخدمة لا جودتها.',
        )
      "
      :items="
        items.map((x) => ({ label: x.name, value: x.completed_sessions, href: base + '/schedule' }))
      "
      :unit="l('sessions', 'جلسة')"
    />
    <details>
      <summary>{{ l('Attendance by coach', 'الحضور حسب المدرب') }}</summary>
      <div
        class="table-scroll"
        tabindex="0"
        :aria-label="l('Coach attendance table', 'جدول حضور المدربين')"
      >
        <table>
          <caption>
            {{
              l(
                'Participant outcomes in these completed sessions',
                'نتائج المشاركين في هذه الجلسات المكتملة',
              )
            }}
          </caption>
          <thead>
            <tr>
              <th scope="col">{{ l('Coach', 'المدرب') }}</th>
              <th scope="col">{{ l('Sessions delivered', 'الجلسات المقدمة') }}</th>
              <th scope="col">{{ l('Present', 'حاضر') }}</th>
              <th scope="col">{{ l('Absent / excused', 'غائب / بعذر') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.id">
              <th scope="row" dir="auto">{{ item.name }}</th>
              <td>{{ item.completed_sessions }}</td>
              <td>{{ item.present }}</td>
              <td>{{ item.absent }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  </section>
</template>
<style scoped>
.trainer-delivery {
  min-width: 0;
  margin-block: 1.5rem;
}
.table-scroll {
  max-width: 100%;
  overflow: auto;
}
table {
  border-collapse: collapse;
  width: 100%;
  font-size: 0.85rem;
}
th,
td {
  padding: 0.75rem;
  text-align: start;
  border-bottom: 1px solid var(--line);
}
caption {
  text-align: start;
  padding: 1rem 0;
  color: var(--muted);
}
summary {
  cursor: pointer;
  color: var(--accent);
  padding: 1rem 0;
}
</style>
