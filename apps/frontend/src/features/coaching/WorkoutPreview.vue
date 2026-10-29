<script setup lang="ts">
import type { PlanDay } from '../../lib/domain'
import { exerciseName, targetLabel } from '../../lib/prescriptions'
import { language as l } from '../../lib/i18n'
defineProps<{ workout: PlanDay }>()
</script>
<template>
  <div class="workout-preview">
    <p class="small-print">
      {{ workout.minutes }} {{ l('minutes', 'دقيقة') }} · {{ workout.exercises.length }}
      {{ l('exercises', 'تمارين') }}
    </p>
    <ol>
      <li v-for="ex in workout.exercises" :key="ex.key">
        <strong dir="auto">{{ exerciseName(ex) }}</strong>
        <p>{{ ex.sets }} × {{ targetLabel(ex) }}</p>
        <p v-if="ex.note" class="small-print preserve-lines">{{ ex.note }}</p>
      </li>
    </ol>
  </div>
</template>
<style scoped>
.workout-preview ol {
  display: grid;
  gap: var(--space-4);
  padding-inline-start: var(--space-6);
}
.workout-preview li {
  padding-block: var(--space-3);
  border-bottom: 1px solid var(--line);
}
.workout-preview p {
  margin-block: var(--space-2) 0;
}
</style>
