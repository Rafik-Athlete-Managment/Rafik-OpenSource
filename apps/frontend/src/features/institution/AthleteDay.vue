<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { request } from '../../lib/backend'
import { errorMessage } from '../../lib/i18n'
import PageState from '../../components/PageState.vue'
import { PhForkKnife, PhChatCircle, PhUserCircle } from '@phosphor-icons/vue'
import { language as l } from '../../lib/i18n'
import type { Institution } from './types'
import WorkoutAgenda from './WorkoutAgenda.vue'
import UpcomingSessions from './UpcomingSessions.vue'
const props = defineProps<{ institution: Institution }>()
const self = computed(() =>
  props.institution.members.find((m) => m.id === props.institution.self.id),
)
const coaches = ref<{ id: string; name: string; roles: string[]; active: boolean }[]>([])
const loading = ref(true),
  error = ref('')
let disposed = false
onUnmounted(() => {
  disposed = true
})
async function loadCoaches() {
  loading.value = true
  error.value = ''
  try {
    const result = await request<{ members: typeof coaches.value }>(
      '/v1/institution/communication?view=trainee&contacts=true',
      { feedback: 'none' },
    )
    if (!disposed)
      coaches.value = result.members.filter((m) => m.active && m.roles.includes('trainer'))
  } catch (e) {
    if (!disposed) {
      error.value = errorMessage(e)
      coaches.value = []
    }
  } finally {
    if (!disposed) loading.value = false
  }
}
onMounted(loadCoaches)
</script>
<template>
  <div class="role-dashboard">
    <div class="role-dashboard-columns">
      <div class="role-dashboard-main">
        <WorkoutAgenda due :limit="4" />
        <UpcomingSessions omit-workouts />
      </div>
      <aside class="role-dashboard-context">
        <section class="panel dashboard-action-panel">
          <h2><PhForkKnife aria-hidden="true" />{{ l('Food diary', 'سجل الطعام') }}</h2>
          <p>
            {{
              l(
                'Record what you ate today. Your food log is separate from your prescribed meals.',
                'سجّل ما تناولته اليوم. سجل طعامك منفصل عن الوجبات الموصوفة.',
              )
            }}
          </p>
          <RouterLink class="button" to="/nutrition?section=diary">{{
            l('Log food', 'تسجيل الطعام')
          }}</RouterLink>
          <RouterLink class="text-link" to="/nutrition">{{
            l('View nutrition guidance', 'عرض إرشادات التغذية')
          }}</RouterLink>
        </section>
        <section class="panel dashboard-action-panel">
          <h2><PhUserCircle aria-hidden="true" />{{ l('Your coaches', 'مدربوك') }}</h2>
          <PageState :loading="loading" :error="error" @retry="loadCoaches"
            ><ul v-if="coaches.length" class="dashboard-coaches">
              <li v-for="coach in coaches" :key="coach.id">
                <span
                  ><strong dir="auto">{{ coach.name }}</strong
                  ><small>{{
                    coach.id === self?.trainer_id
                      ? l('Primary coach', 'المدرب الأساسي')
                      : l('Supporting coach', 'مدرب مساند')
                  }}</small></span
                >
                <RouterLink
                  class="button small secondary"
                  :to="{ path: '/messages', query: { to: coach.id } }"
                  ><PhChatCircle aria-hidden="true" />{{ l('Message', 'مراسلة')
                  }}<span class="sr-only"> {{ coach.name }}</span></RouterLink
                >
              </li>
            </ul>
            <p v-else>
              {{
                l(
                  'No coach is assigned yet. Ask your institution administrator to connect you with one.',
                  'لم يُعيّن مدرب بعد. اطلب من مسؤول المؤسسة تعيين مدرب لك.',
                )
              }}
            </p>
          </PageState>
          <RouterLink class="text-link" to="/messages">{{
            l('Open messages', 'فتح الرسائل')
          }}</RouterLink>
        </section>
      </aside>
    </div>
  </div>
</template>
