<script setup lang="ts">
import { preferredTimezone } from '../../lib/display-time'
import { institutionContext } from '../../app/institution'

import PageHeading from '../../components/PageHeading.vue'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { profile } from '../../app/auth'
import { request } from '../../lib/backend'
import { localDate, addDays } from '../../lib/dates'
import { language as l, errorMessage, locale } from '../../lib/i18n'
import PageState from '../../components/PageState.vue'
import MetricChart from '../analytics/MetricChart.vue'
import type { Drill, AssessmentResult } from './service-types'
type Result = AssessmentResult & {
  title: string
  starts_at: string
  template_id: string
  template_revision: number
  definition: Drill[]
  attendance: string
}
const route = useRoute();
const view = institutionContext().view,
member = String(route.params.member || ''),
base = '';
const from = ref(addDays(localDate(profile.value?.timezone || 'UTC'), -89)),
  to = ref(localDate(profile.value?.timezone || 'UTC')),
  items = ref<Result[]>([]),
  next = ref<number | null>(null),
  loading = ref(true),
  error = ref(''),
  selected = ref(''),
  name = ref('')
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar-AE' : 'en-GB', {
    dateStyle: 'medium',
    timeZone: preferredTimezone.value,
  }).format(new Date(value))
const key = (r: Result, d: Drill) =>
  r.template_id + ':' + r.template_revision + ':' + d.key + ':' + JSON.stringify(r.definition)
const options = computed(() =>
  Array.from(
    new Map(
      items.value.flatMap((r) =>
        r.definition
          .filter((d) => d.kind === 'number')
          .map((d) => [
            key(r, d),
            { key: key(r, d), drill: d, title: r.title, revision: r.template_revision },
          ]),
      ),
    ).values(),
  ),
)
const chosen = computed(() => options.value.find((o) => o.key === selected.value))
const series = computed(() =>
  chosen.value
    ? items.value
        .filter(
          (r) =>
            r.attendance === 'present' &&
            r.definition.some((d) => key(r, d) === selected.value) &&
            typeof r.values[chosen.value!.drill.key] === 'number',
        )
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
        .map((r) => ({
          label: dateLabel(r.starts_at),
          at: r.starts_at,
          value: r.values[chosen.value!.drill.key] as number,
        }))
    : [],
)
async function load(append = false) {
  loading.value = true
  error.value = ''
  try {
    const result = await request<{
      items: Result[]
      next: number | null
      person: { name: string }
    }>(
      `/v1/institution/assessment-history?view=${view}&member=${member}&from=${from.value}&to=${to.value}&offset=${append ? next.value || 0 : 0}`,
    )
    name.value = result.person.name
    items.value = append ? [...items.value, ...result.items] : result.items
    next.value = result.next
    if (!options.value.some((o) => o.key === selected.value))
      selected.value = options.value[0]?.key || ''
  } catch (e) {
    error.value = errorMessage(e)
    items.value = []
  } finally {
    loading.value = false
  }
}
onMounted(() => load())
</script>
<template>
  <div class="container page assessment-history">
    <RouterLink class="back-link" :to="base + '/training?member=' + member">{{
      l('Back to training', 'العودة للتدريب')
    }}</RouterLink>
    <PageHeading class="work-heading">
      <div>
        <p class="overline">{{ name }}</p>
        <h1>{{ l('Assessment history', 'سجل التقييمات') }}</h1>
        <p>
          {{
            l(
              'Compare the same drill, definition and unit over time.',
              'قارن نفس الاختبار والتعريف والوحدة عبر الوقت.',
            )
          }}
        </p>
      </div>
    </PageHeading>
    <form class="history-filters" @submit.prevent="load()">
      <label>{{ l('From', 'من') }}<input type="date" v-model="from" :max="to" required /></label
      ><label
        >{{ l('Through', 'حتى') }}<input type="date" v-model="to" :min="from" required /></label
      ><button class="button secondary" :disabled="loading">
        {{ l('Update view', 'تحديث العرض') }}
      </button>
    </form>
    <PageState :loading="loading" :error="error" @retry="load()"
      ><p v-if="!items.length" class="notice">
        {{
          l(
            'No recorded assessment results in this period.',
            'لا توجد نتائج تقييم مسجلة في هذه الفترة.',
          )
        }}
      </p>
      <template v-else
        ><label v-if="options.length"
          >{{ l('Comparable drill', 'الاختبار للمقارنة')
          }}<select v-model="selected">
            <option v-for="o in options" :key="o.key" :value="o.key">
              {{ o.title }} · {{ o.drill.name }} ({{ o.drill.unit }}) ·
              {{ l('definition', 'التعريف') }} {{ o.revision }}
            </option>
          </select></label
        ><MetricChart
          v-if="chosen"
          :title="chosen.drill.name"
          :description="
            l(
              'Current corrected results for this definition. One point is a first result, not a trend. Absent/excused participants are excluded.',
              'النتائج المصححة الحالية لهذا التعريف. نقطة واحدة هي نتيجة أولى وليست اتجاهاً. الغياب والعذر مستبعدان.',
            )
          "
          :items="series"
          :unit="chosen.drill.unit"
          timeline
        />
        <p v-if="next !== null" class="small-print">
          {{
            l(
              'The chart uses the loaded results below. Load earlier results to extend it.',
              'يستخدم الرسم النتائج المحملة أدناه. حمّل الأقدم لتوسيعه.',
            )
          }}
        </p>
        <article v-for="r in items" :key="r.event_id" class="history-result">
          <div>
            <h2>{{ r.title }}</h2>
            <p>{{ dateLabel(r.starts_at) }} · {{ l('Revision', 'النسخة') }} {{ r.revision }}</p>
          </div>
          <dl>
            <template v-for="d in r.definition" :key="d.key"
              ><dt>{{ d.name }}</dt>
              <dd>{{ r.values[d.key] }} {{ d.unit }}</dd></template
            >
          </dl>
          <p v-if="r.note">{{ r.note }}</p>
        </article>
        <button v-if="next !== null" class="button secondary" @click="load(true)">
          {{ l('Load earlier results', 'تحميل النتائج الأقدم') }}
        </button></template
      ></PageState
    >
  </div>
</template>
<style scoped>
.assessment-history {
}
.history-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: end;
  margin-bottom: 24px;
}
.history-filters label {
  min-width: 0;
  flex: 1;
}
.history-result {
  border-top: 1px solid var(--line);
  padding-block: 24px;
  overflow-wrap: anywhere;
}
.history-result h2 {
  font-size: 1.1rem;
  margin: 0;
}
.history-result dl {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 10px;
}
.history-result dd {
  margin: 0;
  font-weight: 650;
}
@media (max-width: 520px) {
  .history-filters {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
