<script setup lang="ts">
import type { PlanDay } from '../../lib/domain'
import { exerciseName, targetLabel } from '../../lib/prescriptions'
import { language as l } from '../../lib/i18n'
import { PhBarbell, PhClock } from '@phosphor-icons/vue'
withDefaults(defineProps<{ workout: PlanDay; headingLevel?: 'h2' | 'h3' }>(), {
  headingLevel: 'h2',
})
</script>
<template>
  <div class="workout-preview">
    <header class="workout-preview-heading">
      <component :is="headingLevel">{{ l('Workout prescription', 'وصفة التمرين') }}</component>
      <div class="workout-preview-meta small-print">
        <span
          ><PhClock :size="18" aria-hidden="true" />{{ workout.minutes }}
          {{ l('minutes', 'دقيقة') }}</span
        >
        <span
          ><PhBarbell :size="18" aria-hidden="true" />{{ workout.exercises.length }}
          {{ l('exercises', 'تمارين') }}</span
        >
      </div>
    </header>
    <ol>
      <li v-for="(ex, index) in workout.exercises" :key="ex.key">
        <span class="workout-preview-number" aria-hidden="true">{{ index + 1 }}</span>
        <div class="workout-preview-exercise">
          <strong dir="auto">{{ exerciseName(ex) }}</strong>
          <p>{{ ex.sets }} × {{ targetLabel(ex) }}</p>
          <p v-if="ex.note" class="small-print preserve-lines">{{ ex.note }}</p>
        </div>
      </li>
    </ol>
  </div>
</template>
<style scoped>
.workout-preview {
  display: grid;
  gap: var(--space-4);
  min-width: 0;
}
.workout-preview-heading {
  display: grid;
  gap: var(--space-2);
}
.workout-preview-heading :is(h2, h3) {
  margin: 0;
  font-size: var(--text-panel);
  font-weight: 600;
  line-height: 1.4;
}
.workout-preview-meta,
.workout-preview-meta > span {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.workout-preview-meta {
  gap: var(--space-4);
}
.workout-preview ol {
  display: grid;
  list-style: none;
  padding: 0;
  margin: 0;
}
.workout-preview li {
  display: flex;
  gap: var(--space-3);
  padding-block: var(--space-4);
  border-block-start: 1px solid var(--line);
}
.workout-preview li:last-child {
  padding-block-end: 0;
}
.workout-preview-number {
  color: var(--muted);
  font-size: var(--text-small);
  line-height: 1.6;
  min-inline-size: 24px;
}
.workout-preview-exercise {
  min-width: 0;
}
.workout-preview-exercise strong {
  font-size: var(--text-body);
  font-weight: 600;
  overflow-wrap: anywhere;
}
.workout-preview p {
  margin: var(--space-2) 0 0;
  font-size: var(--text-small);
  color: var(--muted);
  line-height: 1.65;
}
</style>
