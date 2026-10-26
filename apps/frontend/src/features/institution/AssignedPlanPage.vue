<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  PhArrowLeft,
  PhBarbell,
  PhChartLine,
  PhUser,
  PhPencilSimple,
  PhStopCircle,
} from '@phosphor-icons/vue'
import type { AthletePlanPage, AthletePlanSummary } from '@rafik/shared/contracts'
import { institutionContext } from '../../app/institution'
import { request } from '../../lib/backend'
import { language as l, locale, errorMessage } from '../../lib/i18n'
import { exerciseName, targetLabel } from '../../lib/prescriptions'
import type { Prescription } from '../../lib/domain'
import PageHeading from '../../components/PageHeading.vue'
import PageState from '../../components/PageState.vue'
import CommandStatus from '../../components/CommandStatus.vue'
import { useCommand } from '../../lib/commands'
import WorkoutAgenda from './WorkoutAgenda.vue'
import PlanEditor from '../coaching/PlanEditor.vue'
const route = useRoute(),
  router = useRouter(),
  context = institutionContext()
const detail = ref<AthletePlanSummary>(),
  loading = ref(true),
  error = ref('')
const adapting = computed(() => route.query.adapt === '1')
const prescription = () => detail.value?.version.prescription as Prescription | undefined
let disposed = false,
  generation = 0
onUnmounted(() => {
  disposed = true
  generation++
})
async function load() {
  const seq = ++generation
  loading.value = true
  error.value = ''
  try {
    const page = await request<AthletePlanPage>(
      '/v1/institution/athlete-plans?view=' +
        context.view +
        '&assignment=' +
        encodeURIComponent(String(route.params.assignment)),
    )
    if (disposed || seq !== generation) return
    detail.value = page.items[0]
    if (!detail.value) throw Error('assignment_unavailable')
  } catch (e) {
    if (!disposed && seq === generation) {
      error.value = errorMessage(e)
      detail.value = undefined
    }
  } finally {
    if (!disposed && seq === generation) loading.value = false
  }
}
const ending = useCommand(
  'assigned-plan-end:' + context.institution + ':' + route.params.assignment,
  async () => {
    if (!disposed) await load()
  },
  (_, args) => request('/v1/institution/delivery', { method: 'POST', body: JSON.stringify(args) }),
  { successMessage: l('Plan ended.', 'تم إنهاء الخطة.') },
)
const endPlan = () =>
  ending.run('end', {
    operation: crypto.randomUUID(),
    action: 'end',
    view: context.view,
    assignment: detail.value!.id,
    revision: detail.value!.revision,
  })
function adapt() {
  return router.replace({
    query: {
      ...route.query,
      adapt: adapting.value ? undefined : '1',
      member: detail.value!.member_id,
    },
  })
}
watch(() => route.params.assignment, load)
onMounted(load)
</script>
<template>
  <section
    class="container page assigned-plan-page"
    :aria-label="l('Assigned plan', 'الخطة المعيّنة')"
  >
    <RouterLink
      class="back-link"
      :to="{
        path: '/training',
        query: {
          search: route.query.search,
          status: route.query.status,
          limit: route.query.limit,
          offset: route.query.offset,
        },
      }"
      ><PhArrowLeft :size="18" aria-hidden="true" class="directional" />{{
        l('Athlete plans', 'خطط الرياضيين')
      }}</RouterLink
    >
    <PageState :loading="loading" :error="error" @retry="load"
      ><template v-if="detail">
        <PageHeading
          ><div>
            <p class="overline">
              <bdi>{{ detail.member_name }}</bdi> · {{ l('Assigned plan', 'الخطة المعيّنة') }}
            </p>
            <h1>
              <bdi>{{ detail.version.title }}</bdi>
            </h1>
            <p>
              <span v-if="detail.goal || detail.sport"
                >{{ [detail.goal, detail.sport].filter(Boolean).join(' · ') }} ·
              </span>
              {{ l('Version', 'النسخة') }} {{ detail.version.revision }}
            </p>
          </div>
          <span class="tag" :data-status="detail.status">{{
            detail.status === 'active'
              ? l('Active', 'نشط')
              : detail.status === 'upcoming'
                ? l('Upcoming', 'قادم')
                : detail.status === 'expired'
                  ? l('Expired', 'منتهي المدة')
                  : l('Ended / replaced', 'متوقف / مستبدل')
          }}</span></PageHeading
        >
        <nav class="assigned-actions" :aria-label="l('Plan actions', 'إجراءات الخطة')">
          <button class="button" @click="adapt">
            <PhPencilSimple :size="18" aria-hidden="true" />{{
              adapting
                ? l('View assigned plan', 'عرض الخطة المعيّنة')
                : l('Adapt this program', 'تكييف هذا البرنامج')
            }}
          </button>
          <RouterLink class="button secondary" :to="'/workouts?member=' + detail.member_id"
            ><PhBarbell :size="18" aria-hidden="true" />{{
              l('Workout history', 'سجل التمارين')
            }}</RouterLink
          >
          <RouterLink class="button secondary" :to="'/assessments/' + detail.member_id"
            ><PhChartLine :size="18" aria-hidden="true" />{{
              l('Assessment history', 'سجل التقييمات')
            }}</RouterLink
          >
          <RouterLink class="button secondary" :to="'/athletes/' + detail.member_id"
            ><PhUser :size="18" aria-hidden="true" />{{
              l('Athlete profile', 'ملف الرياضي')
            }}</RouterLink
          >
          <button
            v-if="detail.state === 'active'"
            class="button danger-button"
            :disabled="!ending.state.ready || ending.state.busy || !!ending.state.pending"
            @click="endPlan"
          >
            <PhStopCircle :size="18" aria-hidden="true" />{{ l('End plan', 'إنهاء الخطة') }}
          </button>
        </nav>
        <CommandStatus :command="ending" />
        <PlanEditor v-if="adapting" :key="detail.id" :assigned-plan="detail" />
        <template v-else>
          <p v-if="prescription()?.description" class="plan-description">
            {{
              locale === 'ar'
                ? prescription()?.descriptionAr || prescription()?.description
                : prescription()?.description
            }}
          </p>
          <p class="small-print">
            {{ detail.start_date }} — {{ detail.end_date || l('No end date', 'دون تاريخ انتهاء') }}
          </p>
          <WorkoutAgenda :key="detail.id" :assignment="detail.id" />
          <section :aria-label="l('Assigned prescription', 'الوصفة المعيّنة')">
            <h2>{{ l('Program preview', 'معاينة البرنامج') }}</h2>
            <details v-for="day in prescription()?.days || []" :key="day.id" class="plan-day">
              <summary>
                <bdi>{{ locale === 'ar' ? day.nameAr || day.name : day.name }}</bdi> ·
                {{
                  day.restDay ? l('Recovery', 'تعافٍ') : day.minutes + ' ' + l('minutes', 'دقيقة')
                }}
              </summary>
              <p>
                {{ l('Week', 'الأسبوع') }} {{ day.week || 1 }} · {{ l('Day', 'اليوم') }}
                {{ (day.weekday || 0) + 1 }}
              </p>
              <ul>
                <li v-for="exercise in day.exercises" :key="exercise.key">
                  <strong>{{ exerciseName(exercise) }}</strong>
                  <p>
                    {{ exercise.group ? exercise.group + ' · ' : '' }}{{ exercise.sets }}
                    {{ l('sets', 'مجموعات') }} · {{ targetLabel(exercise) }} · {{ exercise.rest }}
                    {{ l('sec rest', 'ث راحة') }}
                  </p>
                  <p v-for="(target, index) in exercise.targets || []" :key="index">
                    {{ index + 1 }}. {{ targetLabel(exercise, target) }}
                  </p>
                  <p v-if="exercise.note">{{ exercise.note }}</p>
                </li>
              </ul>
            </details>
          </section>
        </template>
      </template></PageState
    >
  </section>
</template>
<style scoped>
.assigned-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  margin-block: var(--space-5);
}
.assigned-actions .button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}
.plan-description {
  max-width: 75ch;
  line-height: 1.7;
}
.plan-day {
  padding-block: var(--space-4);
  border-block-end: 1px solid var(--line);
}
.plan-day li {
  margin-block: var(--space-4);
}
.assigned-plan-page {
  overflow-wrap: anywhere;
}
</style>
