<script setup lang="ts">
import WorkoutAgenda from './WorkoutAgenda.vue'
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { programContext } from '../coaching/program-context'
import { request } from '../../lib/backend'
import { language as l, errorMessage, dateLabel } from '../../lib/i18n'
const props = defineProps<{ compact?: boolean }>()
const context = programContext(useRoute()),
  loading = ref(true),
  error = ref('')
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
const data = ref<Result>()
let disposed = false
async function load() {
  loading.value = true
  error.value = ''
  try {
    const result = await request<Result>(`/v1/institution/follow-up?view=${context.view}`)
    if (!disposed) data.value = result
  } catch (e) {
    if (!disposed) error.value = errorMessage(e)
  } finally {
    if (!disposed) loading.value = false
  }
}
onMounted(load)
onUnmounted(() => {
  disposed = true
})
</script>
<template>
  <section class="daily-followup" aria-labelledby="follow-up-title">
    <div class="section-heading">
      <div>
        <h2 id="follow-up-title">
          {{
            compact
              ? l('Primary-roster follow-up', 'متابعة القائمة الأساسية')
              : l('Your coaching priorities', 'أولوياتك التدريبية')
          }}
        </h2>
        <p class="small-print">
          {{
            l(
              'Schedule upcoming work, record due workouts and resolve follow-up.',
              'جدول التمارين القادمة وسجل المستحق منها وتابع ما يحتاج إلى مراجعة.',
            )
          }}
        </p>
      </div>
    </div>
    <p v-if="loading" role="status">{{ l('Checking recent activity…', 'جارٍ مراجعة النشاط…') }}</p>
    <p v-if="error" class="notice error" role="alert">
      {{ error }}
      <button class="text-link" @click="load">{{ l('Retry', 'إعادة المحاولة') }}</button>
    </p>
    <WorkoutAgenda v-if="!compact" due :limit="4" />
    <p v-if="compact" class="small-print">
      {{
        l(
          'These queues cover your primary roster. Supporting sport work appears in the workout queues above. Plan gaps here mean no assignment marked active; check plan dates in Athlete plans.',
          'تغطي هذه القوائم الرياضيين الأساسيين لك. يظهر عملك المساند حسب الرياضة في قوائم التمارين أعلاه. تعني فجوات الخطط هنا عدم وجود تعيين بحالة نشطة؛ راجع تواريخ الخطط في صفحة خطط الرياضيين.',
        )
      }}
    </p>
    <div v-if="data" :class="compact ? 'compact-followup' : 'followup-columns'">
      <component :is="compact ? 'details' : 'section'" class="panel followup-queue">
        <component :is="compact ? 'summary' : 'div'" class="queue-summary"
          ><h3>
            {{ l('Missed sessions to follow up', 'جلسات فائتة للمتابعة') }}
            <span class="count">{{ data.missed.total }}</span>
          </h3></component
        >
        <p class="small-print">
          {{
            l(
              'Review attendance with the athlete before scheduling a replacement.',
              'راجع الحضور مع الرياضي قبل جدولة حصة بديلة.',
            )
          }}
        </p>
        <p v-if="!data.missed.total" class="small-print">
          {{ l('No missed sessions awaiting a replacement.', 'لا توجد جلسات فائتة بانتظار بديل.') }}
        </p>
        <ul>
          <li v-for="s in data.missed.items" :key="s.id + s.member_id">
            <RouterLink
              :to="context.base + '/schedule/new?makeup=' + s.id + '&member=' + s.member_id"
              ><strong>{{ s.name }}</strong
              ><span>{{ s.title }}</span
              ><small>{{ l('Arrange a replacement', 'ترتيب جلسة بديلة') }}</small></RouterLink
            >
          </li>
        </ul>
        <RouterLink
          v-if="data.missed.total > 8"
          class="text-link"
          :to="context.base + '/schedule'"
          >{{ l('Open calendar', 'فتح التقويم') }}</RouterLink
        >
      </component>
      <component :is="compact ? 'details' : 'section'" class="panel followup-queue">
        <component :is="compact ? 'summary' : 'div'" class="queue-summary"
          ><h3>
            {{ l('Training to review', 'تدريب للمراجعة') }}
            <span class="count">{{ data.reviews.total }}</span>
          </h3></component
        >
        <p v-if="!data.reviews.total" class="small-print">
          {{
            l('No completed training awaiting feedback.', 'لا يوجد تدريب مكتمل بانتظار الملاحظات.')
          }}
        </p>
        <ul>
          <li v-for="s in data.reviews.items" :key="s.id">
            <RouterLink :to="context.base + '/review/' + s.id"
              ><strong>{{ s.name }}</strong
              ><span>{{ s.title }}</span
              ><small
                >{{ l('Completed', 'اكتمل') }} {{ dateLabel(s.completed_at) }}</small
              ></RouterLink
            >
          </li>
        </ul>
        <RouterLink
          v-if="data.reviews.total > 8"
          class="text-link"
          :to="context.base + '/workouts'"
          >{{ l('Workout history', 'سجل التمارين') }}</RouterLink
        >
      </component>
      <component :is="compact ? 'details' : 'section'" class="panel followup-queue">
        <component :is="compact ? 'summary' : 'div'" class="queue-summary"
          ><h3>
            {{ l('Session outcomes needed', 'حصص تحتاج إلى نتيجة') }}
            <span class="count">{{ data.outcomes.total }}</span>
          </h3></component
        >
        <p class="small-print">
          {{
            l(
              'Past bookings still marked scheduled. Confirm what happened before arranging a replacement.',
              'مواعيد سابقة ما زالت مجدولة. أكد ما حدث قبل ترتيب حصة بديلة.',
            )
          }}
        </p>
        <p v-if="!data.outcomes.total" class="small-print">
          {{ l('No past bookings to resolve.', 'لا توجد مواعيد سابقة تحتاج إلى تحديث.') }}
        </p>
        <ul>
          <li v-for="s in data.outcomes.items" :key="s.id">
            <RouterLink :to="context.base + '/schedule/' + s.id"
              ><strong>{{ s.title }}</strong
              ><small>{{ dateLabel(s.ends_at) }}</small></RouterLink
            >
          </li>
        </ul>
        <RouterLink
          v-if="data.outcomes.total > 8"
          class="text-link"
          :to="context.base + '/schedule'"
          >{{ l('Open calendar', 'فتح التقويم') }}</RouterLink
        >
      </component>
      <component :is="compact ? 'details' : 'section'" class="panel followup-queue">
        <component :is="compact ? 'summary' : 'div'" class="queue-summary"
          ><h3>
            {{ l('Athletes without a plan', 'رياضيون بلا خطة') }}
            <span class="count">{{ data.unplanned.total }}</span>
          </h3></component
        >
        <p v-if="!data.unplanned.total" class="small-print">
          {{ l('Every active athlete has a program assignment.', 'لكل رياضي نشط تكليف ببرنامج.') }}
        </p>
        <ul>
          <li v-for="m in data.unplanned.items" :key="m.id">
            <RouterLink :to="context.base + '/training?member=' + m.id"
              ><strong>{{ m.name }}</strong
              ><small>{{
                l('Review their training and choose a program', 'راجع التدريب واختر برنامجاً')
              }}</small></RouterLink
            >
          </li>
        </ul>
        <RouterLink
          v-if="data.unplanned.total > 8"
          class="text-link"
          :to="context.base + '/people'"
          >{{ l('Open people', 'فتح الأشخاص') }}</RouterLink
        >
      </component>
    </div>
  </section>
</template>
<style scoped>
.daily-followup {
  margin-block: 1.5rem;
}
.followup-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}
.followup-columns > .panel {
  margin: 0;
  min-width: 0;
}
h3 {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  font-size: 1rem;
}
.count {
  font-variant-numeric: tabular-nums;
  color: var(--accent);
}
ul {
  list-style: none;
  padding: 0;
  max-height: 320px;
  overflow: auto;
}
li + li {
  border-top: 1px solid var(--line);
}
li a {
  display: grid;
  gap: 0.25rem;
  padding: 0.75rem 0;
  overflow-wrap: anywhere;
}
li span,
li small {
  color: var(--muted);
  font-size: 0.85rem;
}
@media (max-width: 1000px) {
  .followup-columns {
    grid-template-columns: minmax(0, 1fr);
  }
}
.compact-followup {
  display: grid;
  gap: var(--space-3);
}
.compact-followup .panel {
  padding: var(--space-4);
  margin: 0;
}
.queue-summary h3 {
  margin: 0;
}
.compact-followup summary {
  cursor: pointer;
}
.compact-followup .count {
  min-width: 2rem;
  text-align: center;
}
</style>
