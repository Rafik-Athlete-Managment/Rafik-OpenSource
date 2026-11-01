<!-- Draws one analytics measure over time with labels for its values and period. -->
<script setup lang="ts">
import { computed, ref, watch, useId } from 'vue'
import {
  VisXYContainer,
  VisAxis,
  VisLine,
  VisArea,
  VisScatter,
  VisGroupedBar,
  VisCrosshair,
  VisTooltip,
  VisSingleContainer,
  VisDonut,
} from '@unovis/vue'
import { PhChartLine, PhCaretLeft, PhCaretRight } from '@phosphor-icons/vue'
import { language as l, locale } from '../../lib/i18n'
type Item = { label: string; value: number; href?: string; at?: string }
type Point = Item & { x: number }
const props = defineProps<{
  title: string
  description: string
  items: Item[]
  unit?: string
  timeline?: boolean
  donut?: boolean
  counts?: boolean
}>()
const id = useId(),
  active = ref(0)
const points = computed<Point[]>(() =>
  props.items.map((item, i) => ({
    ...item,
    x:
      props.timeline && (item.at || /^\d{4}-\d{2}-\d{2}$/.test(item.label))
        ? Date.parse(item.at || item.label + 'T12:00:00Z')
        : i,
  })),
)
watch(
  () => props.items,
  () => {
    active.value = props.timeline ? Math.max(0, props.items.length - 1) : 0
  },
  { immediate: true },
)
const chartPoints = computed(() =>
  props.timeline
    ? points.value
    : points.value.slice(Math.floor(active.value / 8) * 8, Math.floor(active.value / 8) * 8 + 8),
)
const maximum = computed(() => Math.max(1, ...props.items.map((p) => p.value)))
const minimum = computed(() => Math.min(0, ...props.items.map((p) => p.value)))
const countTicks = computed(() => {
  if (!props.counts) return undefined
  const step = Math.max(1, Math.ceil(maximum.value / 4))
  return Array.from({ length: Math.floor(maximum.value / step) + 1 }, (_, i) => i * step)
})
const total = computed(() => props.items.reduce((n, p) => n + p.value, 0))
const current = computed(() => points.value[active.value])
const number = (value: number) =>
  new Intl.NumberFormat(locale.value, { maximumFractionDigits: 2 }).format(value)
const date = (value: number) =>
  new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar-AE' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(value)
const tick = (value: number | Date) => {
  const n = Number(value)
  if (props.timeline && points.value[0]?.x > 100000) return date(n)
  const label = points.value[n]?.label || ''
  return label.length > 14 ? label.slice(0, 13) + '…' : label
}
const colors = ['var(--accent)', '#b5793b', '#648892', 'var(--muted)']
function tip(point: Point) {
  const el = document.createElement('div')
  el.className = 'metric-tooltip'
  el.textContent = `${point.label}: ${number(point.value)} ${props.unit || ''}`
  return el
}
function track(_x?: number | Date, _point?: Point, index?: number) {
  if (index !== undefined)
    active.value = props.timeline ? index : Math.floor(active.value / 8) * 8 + index
}
</script>
<template>
  <section class="metric-chart" :aria-labelledby="id">
    <header class="metric-heading">
      <h2 :id="id">{{ title }}</h2>
      <p class="small-print">{{ description }}</p>
    </header>
    <div v-if="!items.length" class="chart-empty">
      <PhChartLine :size="28" aria-hidden="true" /><strong>{{
        l('No records in this period', 'لا توجد سجلات في هذه الفترة')
      }}</strong
      ><span>{{
        l(
          'Try a wider date range or review the underlying work.',
          'جرّب فترة أوسع أو راجع السجلات الأصلية.',
        )
      }}</span>
    </div>
    <template v-else>
      <div v-if="donut" class="donut-layout">
        <div
          class="donut-plot"
          role="img"
          :aria-label="title + ': ' + items.map((p) => p.label + ' ' + p.value).join(', ')"
        >
          <VisSingleContainer :data="points" :height="190" :duration="0">
            <VisDonut
              :value="(d: Point) => d.value"
              :color="(_d: Point, i: number) => colors[i % colors.length]"
              :arc-width="26"
              :pad-angle="0.025"
              :central-label="number(total)"
              :central-sub-label="l('records', 'سجل')"
              :duration="0"
            />
          </VisSingleContainer>
        </div>
        <ul class="chart-legend">
          <li v-for="(item, i) in items" :key="item.label">
            <span
              class="legend-color"
              :style="{ background: colors[i % colors.length] }"
              aria-hidden="true"
            ></span
            ><span>{{ item.label }}</span
            ><strong>{{ number(item.value) }}</strong
            ><small>{{ total ? Math.round((item.value / total) * 100) : 0 }}%</small>
          </li>
        </ul>
      </div>
      <template v-else>
        <div v-if="!timeline && items.length > 8" class="category-pages">
          <span
            >{{ Math.floor(active / 8) * 8 + 1 }}–{{
              Math.min(items.length, (Math.floor(active / 8) + 1) * 8)
            }}
            / {{ items.length }}</span
          ><button
            type="button"
            class="text-link"
            :disabled="active < 8"
            @click="active = (Math.floor(active / 8) - 1) * 8"
          >
            {{ l('Previous 8', 'الثمانية السابقة') }}</button
          ><button
            type="button"
            class="text-link"
            :disabled="(Math.floor(active / 8) + 1) * 8 >= items.length"
            @click="active = (Math.floor(active / 8) + 1) * 8"
          >
            {{ l('Next 8', 'الثمانية التالية') }}
          </button>
        </div>
        <div class="chart-plot" dir="ltr" role="img" :aria-label="title">
          <VisXYContainer
            :data="chartPoints"
            :height="230"
            :duration="0"
            :y-domain="[minimum, maximum]"
            :padding="{ top: 12, bottom: 4, left: 8, right: 12 }"
          >
            <template v-if="timeline">
              <VisArea
                :x="(d: Point) => d.x"
                :y="(d: Point) => d.value"
                color="var(--tint)"
                :opacity="0.7"
                :duration="0"
              />
              <VisLine
                :x="(d: Point) => d.x"
                :y="(d: Point) => d.value"
                color="var(--accent)"
                :line-width="2.5"
                curve-type="linear"
                :duration="0"
              />
              <VisScatter
                v-if="points.length < 35"
                :x="(d: Point) => d.x"
                :y="(d: Point) => d.value"
                color="var(--accent)"
                :size="points.length === 1 ? 9 : 5"
                :duration="0"
              />
            </template>
            <VisGroupedBar
              v-else
              :x="(d: Point) => d.x"
              :y="(d: Point) => d.value"
              color="var(--accent)"
              :rounded-corners="4"
              :group-max-width="44"
              :duration="0"
            />
            <VisAxis
              type="x"
              :tick-format="tick"
              :tick-values="timeline ? undefined : chartPoints.map((d) => d.x)"
              :num-ticks="4"
              :tick-line="false"
              :domain-line="false"
              :grid-line="false"
              tick-text-color="var(--muted)"
              :tick-text-width="70"
              tick-text-fit-mode="trim"
              tick-text-font-size="12px"
            />
            <VisAxis
              type="y"
              :tick-values="countTicks"
              :num-ticks="4"
              :tick-format="(v: number | Date) => number(Number(v))"
              :tick-line="false"
              :domain-line="false"
              tick-text-color="var(--muted)"
              tick-text-font-size="12px"
              grid-line-color="var(--line)"
            />
            <VisTooltip />
            <VisCrosshair
              :x="(d: Point) => d.x"
              :y="(d: Point) => d.value"
              :template="tip"
              color="var(--accent)"
              :on-crosshair-move="track"
            />
          </VisXYContainer>
        </div>
        <div class="chart-inspector" v-if="current">
          <span
            ><span>{{ current.label }}</span
            ><strong>{{ number(current.value) }} {{ unit }}</strong></span
          >
          <div>
            <button
              type="button"
              class="icon-button"
              :disabled="active === 0"
              :aria-label="l('Previous data point', 'النقطة السابقة') + ' · ' + title"
              @click="active--"
            >
              <PhCaretLeft :size="16" /></button
            ><button
              type="button"
              class="icon-button"
              :disabled="active === items.length - 1"
              :aria-label="l('Next data point', 'النقطة التالية') + ' · ' + title"
              @click="active++"
            >
              <PhCaretRight :size="16" />
            </button>
          </div>
        </div>
      </template>
      <details class="chart-table">
        <summary>{{ l('View data table', 'عرض جدول البيانات') }}</summary>
        <div class="table-scroll" tabindex="0" :aria-label="title + ' ' + l('data', 'البيانات')">
          <table>
            <caption class="sr-only">
              {{
                title
              }}
            </caption>
            <thead>
              <tr>
                <th scope="col">{{ l('Record', 'السجل') }}</th>
                <th scope="col">{{ l('Value', 'القيمة') }} {{ unit }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, i) in items" :key="i">
                <th scope="row">
                  <RouterLink v-if="item.href" :to="item.href" class="text-link">{{
                    item.label
                  }}</RouterLink
                  ><span v-else>{{ item.label }}</span>
                </th>
                <td>{{ number(item.value) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </template>
  </section>
</template>
<style scoped>
.metric-chart {
  min-width: 0;
  padding: 20px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-panel);
  --vis-font-family: inherit;
  --vis-donut-central-label-text-color: var(--ink);
  --vis-donut-central-label-font-size: 30px;
  --vis-donut-central-sub-label-text-color: var(--muted);
  --vis-donut-background-color: var(--line);
  --vis-tooltip-background-color: var(--surface);
  --vis-tooltip-text-color: var(--ink);
  --vis-tooltip-border-color: var(--line);
}
.metric-heading h2 {
  font-size: 1rem;
  margin: 0 0 6px;
}
.metric-heading p {
  margin: 0;
  font-size: var(--text-small);
  line-height: 1.6;
}
.chart-plot {
  width: 100%;
  min-width: 0;
  margin-top: 14px;
}
.chart-inspector {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 46px;
  padding: 8px 0;
  border-top: 1px solid var(--line);
  font-size: var(--text-small);
}
.chart-inspector > span {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 14px;
  min-width: 0;
  overflow-wrap: anywhere;
}
.chart-inspector strong {
  font-variant-numeric: tabular-nums;
}
.chart-inspector > div {
  display: flex;
  flex-shrink: 0;
}
.chart-inspector button {
  width: 44px;
  min-height: 44px;
}
.chart-table {
  margin-top: 10px;
  font-size: var(--text-small);
}
.chart-table summary {
  color: var(--accent);
  cursor: pointer;
  padding: 6px 0;
}
.table-scroll {
  overflow: auto;
  max-height: 240px;
  margin-top: 12px;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th,
td {
  text-align: start;
  padding: 10px;
  border-bottom: 1px solid var(--line);
  overflow-wrap: anywhere;
}
tbody th {
  font-weight: 500;
}
.chart-empty {
  display: flex;
  min-height: 250px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 12px;
  color: var(--muted);
  font-size: 0.85rem;
}
.chart-empty strong {
  color: var(--ink);
}
.donut-layout {
  display: grid;
  grid-template-columns: minmax(120px, 0.9fr) minmax(0, 1fr);
  align-items: center;
  min-height: 290px;
  gap: 18px;
}
.donut-plot {
  min-width: 0;
  direction: ltr;
}
.chart-legend {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 16px;
  font-size: var(--text-small);
}
.chart-legend li {
  display: grid;
  grid-template-columns: 8px 1fr auto auto;
  gap: 8px;
  align-items: center;
}
.chart-legend small {
  color: var(--muted);
  min-width: 32px;
  text-align: end;
}
.legend-color {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}
@media (max-width: 500px) {
  .metric-chart {
    padding: 16px;
  }
  .donut-layout {
    grid-template-columns: 1fr;
    gap: 0;
    padding-bottom: 12px;
  }
  .donut-plot {
    max-width: 220px;
    width: 100%;
    margin: auto;
  }
}
</style>

<style scoped>
.category-pages {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  font-size: var(--text-caption);
  align-items: center;
  margin-top: 12px;
}
</style>
