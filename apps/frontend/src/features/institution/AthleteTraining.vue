<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { user } from '../../app/auth'
import { institutionContext } from '../../app/institution'
import { localSessions } from '../../lib/storage'
import { language as l } from '../../lib/i18n'
import PageHeading from '../../components/PageHeading.vue'
import WorkoutAgenda from './WorkoutAgenda.vue'
const localWork = ref<{ id: string; title: string }[]>([])
let disposed = false
onUnmounted(() => {
  disposed = true
})
onMounted(async () => {
  const rows = await localSessions(user.value!.id)
  if (!disposed)
    localWork.value = rows
      .filter(
        (r) =>
          r.session.institution_id === institutionContext().institution &&
          (r.pending || r.localRevision > r.syncedRevision),
      )
      .map((r) => ({ id: r.id, title: r.session.title }))
})
</script>
<template>
  <div class="container page">
    <PageHeading
      ><div>
        <h1>{{ l('Your workouts', 'تمارينك') }}</h1>
        <p>
          {{
            l(
              'Follow the next workout in each plan. Your coach sets the training time.',
              'اتبع التمرين التالي في كل خطة. يحدد مدربك وقت التدريب.',
            )
          }}
        </p>
      </div>
      <RouterLink class="button secondary" to="/workouts">{{
        l('Workout history', 'سجل التمارين')
      }}</RouterLink></PageHeading
    >
    <section v-if="localWork.length" class="notice">
      <h2>{{ l('Work saved on this device', 'تمارين محفوظة على هذا الجهاز') }}</h2>
      <p>
        {{
          l(
            'Open these records to continue or sync your latest changes.',
            'افتح هذه السجلات للمتابعة أو مزامنة أحدث تعديلاتك.',
          )
        }}
      </p>
      <ul>
        <li v-for="work in localWork" :key="work.id">
          <RouterLink class="text-link" :to="'/workout/' + work.id">{{ work.title }}</RouterLink>
        </li>
      </ul>
    </section>
    <WorkoutAgenda />
  </div>
</template>
