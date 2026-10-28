<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { TabsRoot, TabsList, TabsTrigger, TabsContent } from 'reka-ui'
import { PhCheckCircle } from '@phosphor-icons/vue'
import { programContext } from '../coaching/program-context'
import { request } from '../../lib/backend'
import { language as l, errorMessage, dateLabel, locale } from '../../lib/i18n'
import { useFocusRefresh } from '../../lib/focus-refresh'

export type FollowUpQueue = 'missed' | 'reviews' | 'outcomes' | 'unplanned'
type Result = {
  missed: {
    total: number
    items: { id: string; member_id: string; name: string; title: string; starts_at: string }[]
  }
  reviews: {
    total: number
    items: { id: string; name: string; title: string; completed_at: string }[]
  }
  outcomes: { total: number; items: { id: string; title: string; ends_at: string }[] }
  unplanned: { total: number; items: { id: string; name: string }[] }
}
const props = defineProps<{ refreshToken?: number }>()
const emit = defineEmits<{ counts: [counts: Record<FollowUpQueue, number>] }>()
/** The selected queue; the parent can open one from its attention strip. */
const active = defineModel<FollowUpQueue>('queue', { default: 'reviews' })
const context = programContext(useRoute()),
  loading = ref(true),
  error = ref(''),
  data = ref<Result>()
let disposed = false,
  generation = 0
const queues = computed(() =>
  (['reviews', 'missed', 'outcomes', 'unplanned'] as const).filter(
    (key) => (data.value?.[key].total || 0) > 0,
  ),
)
const names: Record<FollowUpQueue, [string, string]> = {
  missed: ['Missed sessions', 'جلسات فائتة'],
  reviews: ['Training to review', 'تدريب للمراجعة'],
  outcomes: ['Outcomes needed', 'نتائج مطلوبة'],
  unplanned: ['Without a plan', 'بلا خطة'],
}
async function load() {
  const current = ++generation
  loading.value = true
  error.value = ''
  try {
    const result = await request<Result>(`/v1/institution/follow-up?view=${context.view}`, {
      feedback: 'none',
    })
    if (disposed || current !== generation) return
    data.value = result
    emit('counts', {
      missed: result.missed.total,
      reviews: result.reviews.total,
      outcomes: result.outcomes.total,
      unplanned: result.unplanned.total,
    })
  } catch (e) {
    if (!disposed && current === generation) error.value = errorMessage(e)
  } finally {
    if (!disposed && current === generation) loading.value = false
  }
}
watch(queues, (available) => {
  if (available.length && !available.includes(active.value)) active.value = available[0]!
})
watch(
  () => props.refreshToken,
  () => void load(),
)
useFocusRefresh(load)
onMounted(load)
onUnmounted(() => {
  disposed = true
  generation++
})
</script>
<template>
  <section
    id="follow-up"
    class="daily-followup panel"
    aria-labelledby="follow-up-title"
    tabindex="-1"
  >
    <header class="followup-heading">
      <h2 id="follow-up-title">{{ l('Follow-up', 'المتابعة') }}</h2>
      <p class="small-print">
        {{
          l(
            'Your primary roster. Supporting sport work appears in the workout queues above.',
            'قائمتك الأساسية. يظهر عملك المساند حسب الرياضة في قوائم التمارين أعلاه.',
          )
        }}
      </p>
    </header>
    <p v-if="loading && !data" role="status" class="small-print">
      {{ l('Checking recent activity…', 'جارٍ مراجعة النشاط…') }}
    </p>
    <p v-if="error" class="notice error" role="alert">
      {{ error }}
      <button class="text-link" @click="load">{{ l('Retry', 'إعادة المحاولة') }}</button>
    </p>
    <p v-if="data && !queues.length" class="followup-clear">
      <PhCheckCircle :size="22" aria-hidden="true" />{{
        l(
          'All caught up: no missed sessions, reviews, outcomes or athletes without a plan.',
          'لا شيء معلق: لا جلسات فائتة أو مراجعات أو نتائج أو رياضيين بلا خطة.',
        )
      }}
    </p>
    <TabsRoot
      v-else-if="data"
      v-model="active"
      class="followup-tabs"
      :dir="locale === 'ar' ? 'rtl' : 'ltr'"
    >
      <TabsList class="ui-tabs" :aria-label="l('Follow-up queues', 'قوائم المتابعة')">
        <TabsTrigger v-for="key in queues" :key="key" :value="key"
          >{{ l(...names[key]) }} <span class="count">{{ data[key].total }}</span></TabsTrigger
        >
      </TabsList>
      <TabsContent value="reviews">
        <ul class="record-list">
          <li v-for="s in data.reviews.items" :key="s.id" class="record-row">
            <div class="record-title">
              <RouterLink :to="context.base + '/review/' + s.id"
                ><bdi dir="auto">{{ s.name }}</bdi></RouterLink
              ><small
                ><bdi dir="auto">{{ s.title }}</bdi> · {{ l('Completed', 'اكتمل') }}
                {{ dateLabel(s.completed_at) }}</small
              >
            </div>
            <div class="record-meta" />
            <div class="record-actions">
              <span class="tag" data-status="awaiting_review">{{
                l('Awaiting review', 'بانتظار المراجعة')
              }}</span>
            </div>
          </li>
        </ul>
        <RouterLink
          v-if="data.reviews.total > data.reviews.items.length"
          class="text-link"
          :to="context.base + '/workouts?status=awaiting_review'"
          >{{ l('All workouts awaiting review', 'كل التمارين بانتظار المراجعة') }}</RouterLink
        >
      </TabsContent>
      <TabsContent value="missed">
        <p class="small-print">
          {{
            l(
              'Review attendance with the athlete before scheduling a replacement.',
              'راجع الحضور مع الرياضي قبل جدولة حصة بديلة.',
            )
          }}
        </p>
        <ul class="record-list">
          <li v-for="s in data.missed.items" :key="s.id + s.member_id" class="record-row">
            <div class="record-title">
              <strong
                ><bdi dir="auto">{{ s.name }}</bdi></strong
              ><small
                ><bdi dir="auto">{{ s.title }}</bdi> · {{ dateLabel(s.starts_at) }}</small
              >
            </div>
            <div class="record-meta" />
            <div class="record-actions">
              <RouterLink
                class="button small secondary"
                :to="context.base + '/schedule/new?makeup=' + s.id + '&member=' + s.member_id"
                >{{ l('Arrange a replacement', 'ترتيب جلسة بديلة') }}</RouterLink
              >
            </div>
          </li>
        </ul>
        <RouterLink
          v-if="data.missed.total > data.missed.items.length"
          class="text-link"
          :to="context.base + '/schedule'"
          >{{ l('Open calendar', 'فتح التقويم') }}</RouterLink
        >
      </TabsContent>
      <TabsContent value="outcomes">
        <p class="small-print">
          {{
            l(
              'Past bookings still marked scheduled. Confirm what happened before arranging a replacement.',
              'مواعيد سابقة ما زالت مجدولة. أكد ما حدث قبل ترتيب حصة بديلة.',
            )
          }}
        </p>
        <ul class="record-list">
          <li v-for="s in data.outcomes.items" :key="s.id" class="record-row">
            <div class="record-title">
              <RouterLink :to="context.base + '/schedule/' + s.id"
                ><bdi dir="auto">{{ s.title }}</bdi></RouterLink
              ><small>{{ dateLabel(s.ends_at) }}</small>
            </div>
            <div class="record-meta" />
            <div class="record-actions">
              <span class="tag" data-status="pending">{{
                l('Outcome needed', 'تحتاج إلى نتيجة')
              }}</span>
            </div>
          </li>
        </ul>
        <RouterLink
          v-if="data.outcomes.total > data.outcomes.items.length"
          class="text-link"
          :to="context.base + '/schedule'"
          >{{ l('Open calendar', 'فتح التقويم') }}</RouterLink
        >
      </TabsContent>
      <TabsContent value="unplanned">
        <p class="small-print">
          {{
            l(
              'No plan is marked active for these athletes. Check plan dates in Athlete plans.',
              'لا توجد خطة نشطة لهؤلاء الرياضيين. راجع تواريخ الخطط في خطط الرياضيين.',
            )
          }}
        </p>
        <ul class="record-list">
          <li v-for="m in data.unplanned.items" :key="m.id" class="record-row">
            <div class="record-title">
              <RouterLink :to="context.base + '/members/' + m.id"
                ><bdi dir="auto">{{ m.name }}</bdi></RouterLink
              ><small>{{
                l('Review their training and choose a program', 'راجع التدريب واختر برنامجاً')
              }}</small>
            </div>
            <div class="record-meta" />
            <div class="record-actions">
              <RouterLink
                class="button small secondary"
                :to="context.base + '/plans?athlete=' + m.id"
                >{{ l('Assign a program', 'تعيين برنامج') }}</RouterLink
              >
            </div>
          </li>
        </ul>
        <RouterLink
          v-if="data.unplanned.total > data.unplanned.items.length"
          class="text-link"
          :to="context.base + '/people'"
          >{{ l('Open people', 'فتح الأشخاص') }}</RouterLink
        >
      </TabsContent>
    </TabsRoot>
  </section>
</template>
<style scoped>
.daily-followup {
  display: grid;
  gap: var(--space-4);
  margin: 0;
}
.daily-followup:focus {
  outline: none;
}
.followup-heading h2 {
  margin: 0;
  font-size: var(--text-section);
}
.followup-heading p {
  margin: var(--space-2) 0 0;
}
.followup-heading p {
  color: var(--muted);
}
.followup-clear {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: 0;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-control);
  background: var(--tint);
  color: var(--ink);
  font-size: var(--text-small);
}
.followup-clear svg {
  flex: 0 0 auto;
  color: var(--accent);
}
.followup-tabs {
  margin: 0;
  min-width: 0;
}
.followup-tabs .ui-tabs {
  margin-block-end: var(--space-3);
}
.count {
  display: inline-grid;
  place-items: center;
  min-width: 24px;
  margin-inline-start: var(--space-2);
  padding: 0 6px;
  border: 1px solid var(--line);
  border-radius: 999px;
  font-size: var(--text-caption);
  font-variant-numeric: tabular-nums;
}
.followup-tabs .record-row {
  grid-template-columns: minmax(0, 1fr) 0 auto;
}
@media (max-width: 520px) {
  .daily-followup {
    padding: var(--space-4);
  }
  .followup-tabs .record-row {
    grid-template-columns: minmax(0, 1fr);
  }
  .followup-tabs .record-meta,
  .followup-tabs .record-actions {
    grid-column: 1;
    grid-row: auto;
  }
  .followup-tabs .record-actions {
    justify-content: flex-start;
  }
}
/* Same bordered list as the workout queues; the tab rule already separates it from the tabs. */
.followup-tabs .record-list {
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--surface);
  overflow: hidden;
}
.followup-tabs .record-row:last-child {
  border-block-end: 0;
}
</style>
