<script setup lang="ts">
import PageHeading from '../../components/PageHeading.vue'
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { programContext } from '../coaching/program-context'
import { request } from '../../lib/backend'
import { language as l, errorMessage } from '../../lib/i18n'
import { dateLabel } from '../../lib/display-time'
import RatingForm from './RatingForm.vue'
const context = programContext(useRoute()),
  endpoint = `/v1/institution/feedback`
type Item = {
  month?: string
  id: string
  source: string
  title: string
  at: string
  score: number | null
  revision: number
}
type Report = {
  items: Item[]
  next: number | null
  month?: string
  own?: { score: number; revision: number } | null
}
const data = ref<Report>(),
  loading = ref(false),
  error = ref('')
let generation = 0
async function load(more = false) {
  const current = ++generation
  loading.value = true
  error.value = ''
  try {
    const result = await request<Report>(
      endpoint + `?view=${context.view}&offset=${more ? data.value?.next || 0 : 0}`,
    )
    if (current !== generation) return
    data.value =
      more && data.value ? { ...result, items: [...data.value.items, ...result.items] } : result
  } catch (e) {
    if (current === generation) error.value = errorMessage(e)
  } finally {
    if (current === generation) loading.value = false
  }
}
onMounted(() => load())
onUnmounted(() => generation++)
</script>
<template>
  <div class="container page feedback-page">
    <PageHeading class="page-heading"
      ><div>
        <h1>
          {{
            context.view === 'trainer'
              ? l('Workplace feedback', 'تقييم بيئة العمل')
              : l('Session feedback', 'تقييم الجلسات')
          }}
        </h1>
        <p>
          {{
            context.view === 'trainer'
              ? l(
                  'How is working here going for you? One optional response each month.',
                  'كيف تسير تجربة العمل هنا؟ إجابة اختيارية واحدة كل شهر.',
                )
              : l(
                  'Tell us how your completed training felt. Every response is optional.',
                  'أخبرنا عن تجربتك في التدريب المكتمل. كل إجابة اختيارية.',
                )
          }}
        </p>
      </div></PageHeading
    >
    <p class="notice">
      {{
        context.view === 'trainer'
          ? l(
              'Your response is linked to your account and reported to institution administrators. It is not anonymous. Other coaches cannot view your response.',
              'ترتبط إجابتك بحسابك وتُعرض لمسؤولي المؤسسة. ليست مجهولة الهوية. لا يراها المدربون الآخرون.',
            )
          : l(
              'Your session rating is linked to you. Institution administrators and your current coach can use it in session-experience reports. It is not an overall coach rating.',
              'يرتبط تقييم الجلسة بك. يستخدمه مسؤولو المؤسسة ومدربك الحالي في تقارير تجربة الجلسات. ليس تقييماً عاماً للمدرب.',
            )
      }}
    </p>
    <p v-if="loading" role="status">{{ l('Loading feedback…', 'تحميل التقييمات…') }}</p>
    <p v-if="error" role="alert" class="notice error">
      {{ error }}
      <button class="text-link" @click="load()">{{ l('Retry', 'إعادة المحاولة') }}</button>
    </p>
    <template v-if="data">
      <RatingForm
        v-if="context.view === 'trainer' && data.month"
        :key="data.month + ':' + (data.own?.revision || 0)"
        :institution="context.institution"
        view="trainer"
        source="workplace"
        :subject="data.month"
        :score="data.own?.score || null"
        :revision="data.own?.revision || 0"
        :title="
          l('Your workplace experience', 'تجربتك في بيئة العمل') +
          ' · ' +
          data.month.slice(0, 7) +
          ' (UTC)'
        "
        @saved="load()"
      />
      <template v-else
        ><p v-if="!data.items.length" class="panel">
          {{
            l(
              'No completed sessions to rate yet. Your completed workouts and attended training sessions will appear here.',
              'لا توجد جلسات مكتملة للتقييم بعد. تظهر هنا تمارينك المكتملة وجلسات التدريب التي حضرتها.',
            )
          }}
        </p>
        <RatingForm
          v-for="item in data.items"
          :key="item.source + item.id + ':' + item.revision"
          :institution="context.institution"
          view="trainee"
          :source="item.source"
          :subject="item.id"
          :score="item.score"
          :revision="item.revision"
          :title="item.title"
          :subtitle="
            dateLabel(item.at) +
            ' · ' +
            (item.source === 'workout'
              ? l('Workout', 'تمرين')
              : l('Scheduled training session', 'جلسة تدريب مجدولة'))
          "
          @saved="load()"
      /></template>
      <details
        v-if="context.view === 'trainer' && data.items.some((item) => item.month !== data!.month)"
        class="panel"
      >
        <summary>{{ l('Previous workplace ratings', 'تقييمات بيئة العمل السابقة') }}</summary>
        <ul>
          <li
            v-for="item in data.items.filter((item) => item.month !== data!.month)"
            :key="item.month"
          >
            {{ item.month?.slice(0, 7) }} (UTC) · {{ item.score }} / 5
          </li>
        </ul>
      </details>
      <button
        v-if="data.next !== null"
        class="button secondary"
        :disabled="loading"
        @click="load(true)"
      >
        {{
          context.view === 'trainer'
            ? l('More ratings', 'المزيد من التقييمات')
            : l('More sessions', 'المزيد من الجلسات')
        }}
      </button>
    </template>
  </div>
</template>
<style scoped>
.feedback-page {
}
.feedback-page > .notice {
  margin-bottom: 1.5rem;
}
</style>
