<script setup lang="ts">
import type { PlanDay, Exercise, PrescriptionExercise } from '../../lib/domain'
import ExerciseMediaPreview from '../../components/ExerciseMediaPreview.vue'
import ExerciseDemo from '../../components/ExerciseDemo.vue'
import { hasExerciseMedia } from '../../lib/exercise-media'
import { exerciseName, targetLabel } from '../../lib/prescriptions'
import { language as l, locale } from '../../lib/i18n'
import { PhBarbell, PhClock } from '@phosphor-icons/vue'
const props = withDefaults(
  defineProps<{
    workout: PlanDay
    headingLevel?: 'h2' | 'h3'
    catalog?: Exercise[]
    showInstructions?: boolean
  }>(),
  {
    headingLevel: 'h2',
    catalog: () => [],
    showInstructions: false,
  },
)
const movement = (ex: PrescriptionExercise) =>
  props.catalog.find((item) => item.id === ex.exerciseId) || ex.info
const name = (ex: PrescriptionExercise) => exerciseName({ ...ex, info: movement(ex) })
const alternativeName = (id: string, info?: Exercise) => {
  const item = props.catalog.find((item) => item.id === id) || info
  return (locale.value === 'ar' ? item?.name_ar || item?.name : item?.name) || id
}
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
        <div
          class="workout-preview-exercise"
          :class="{ 'has-media': hasExerciseMedia(movement(ex)) }"
        >
          <div class="workout-preview-details">
            <strong dir="auto">{{ name(ex) }}</strong>
            <p>{{ ex.sets }} × {{ targetLabel(ex) }}</p>
            <p v-if="ex.group">
              {{ l('Superset / circuit', 'مجموعة مركبة / دائرة') }} · <bdi>{{ ex.group }}</bdi>
            </p>
            <p v-for="(target, setIndex) in ex.targets" :key="setIndex">
              {{ l('Set', 'المجموعة') }} {{ setIndex + 1 }} · {{ targetLabel(ex, target) }}
            </p>
            <p>{{ l('Rest', 'الراحة') }} · {{ ex.rest }} {{ l('seconds', 'ثانية') }}</p>
            <p v-if="ex.alternatives?.length">
              {{ l('Approved alternatives', 'البدائل المعتمدة') }}:
              {{
                ex.alternatives
                  .map((item) => alternativeName(item.exerciseId, item.info))
                  .join(' · ')
              }}
            </p>
            <p v-if="ex.note" class="small-print preserve-lines">{{ ex.note }}</p>
            <p v-if="showInstructions" dir="auto">
              {{ locale === 'ar' ? movement(ex)?.instructions_ar : movement(ex)?.instructions }}
            </p>
            <ExerciseDemo
              v-if="showInstructions && !hasExerciseMedia(movement(ex))"
              :exercise="movement(ex)"
            />
          </div>
          <ExerciseMediaPreview :exercise="movement(ex)" />
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
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  gap: var(--space-4);
  flex: 1;
  min-width: 0;
}
.workout-preview-exercise.has-media {
  grid-template-columns: auto minmax(0, 1fr);
}
.workout-preview-exercise.has-media > .workout-preview-details {
  grid-column: 2;
  grid-row: 1;
}
.workout-preview-exercise.has-media > :deep(.exercise-media-preview) {
  grid-column: 1;
  grid-row: 1;
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
@media (max-width: 600px) {
  .workout-preview-exercise.has-media {
    grid-template-columns: minmax(0, 1fr);
  }
  .workout-preview-exercise.has-media > .workout-preview-details {
    grid-column: 1;
    grid-row: 1;
  }
  .workout-preview-exercise.has-media > :deep(.exercise-media-preview) {
    grid-column: 1;
    grid-row: 2;
  }
}
</style>
