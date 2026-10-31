<script setup lang="ts">
import WorkoutExerciseCard from './WorkoutExerciseCard.vue'
import EmptyState from '../../components/EmptyState.vue'
import { PhPlus } from '@phosphor-icons/vue'
import type { PlanDay, Exercise } from '../../lib/domain'
import { language as l } from '../../lib/i18n'
const day = defineModel<PlanDay>({ required: true })
defineProps<{ catalog: Exercise[]; disabled?: boolean }>()
function add() {
  day.value.exercises.push({
    key: crypto.randomUUID(),
    exerciseId: '',
    kind: 'strength',
    sets: 3,
    reps: 10,
    load: 0,
    unit: 'kg',
    rest: 60,
    note: '',
  })
}
function move(index: number, delta: number) {
  const [ex] = day.value.exercises.splice(index, 1)
  day.value.exercises.splice(index + delta, 0, ex!)
}
function pair(index: number) {
  const previous = day.value.exercises[index - 1]!
  previous.group ||= l('Superset', 'مجموعة مركبة') + ' ' + index
  day.value.exercises[index]!.group = previous.group
}
</script>
<template>
  <fieldset class="workout-fields" :disabled="disabled">
    <legend class="sr-only">{{ l('Workout prescription', 'وصفة التمرين') }}</legend>
    <div class="workout-fields-heading">
      <h2>{{ l('Exercises', 'التمارين') }}</h2>
      <label class="workout-duration"
        >{{ l('Duration (minutes)', 'المدة (دقائق)')
        }}<input v-model.number="day.minutes" type="number" min="1" max="480" required
      /></label>
    </div>
    <EmptyState
      v-if="!day.exercises.length"
      class="workout-empty-state"
      :title="l('No exercises yet', 'لا توجد تمارين بعد')"
      :description="
        l(
          'Add exercises and set the prescription before saving.',
          'أضف التمارين وحدد الوصفة قبل الحفظ.',
        )
      "
    >
      <button type="button" class="button secondary add-workout-exercise" @click="add">
        <PhPlus :size="18" aria-hidden="true" />{{ l('Add exercise', 'إضافة تمرين') }}
      </button>
    </EmptyState>
    <WorkoutExerciseCard
      v-for="(ex, index) in day.exercises"
      :key="ex.key"
      :model-value="ex"
      :catalog="catalog"
      :index="index"
      :total="day.exercises.length"
      :previous-group="day.exercises[index - 1]?.group"
      :disabled="disabled"
      @update:model-value="day.exercises[index] = $event"
      @move="move(index, $event)"
      @remove="day.exercises.splice(index, 1)"
      @pair="pair(index)"
    />
    <button
      v-if="day.exercises.length && day.exercises.length < 12"
      type="button"
      class="button secondary add-workout-exercise"
      @click="add"
    >
      <PhPlus :size="18" />{{ l('Add exercise', 'إضافة تمرين') }}
    </button>
  </fieldset>
</template>
<style scoped>
.workout-fields {
  display: grid;
  gap: var(--space-4);
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
}
.workout-fields-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  justify-content: space-between;
  gap: var(--space-4);
}
.workout-fields-heading h2 {
  margin: 0;
  font-size: var(--text-section);
}
.workout-duration {
  flex: 0 1 180px;
  display: grid;
  gap: var(--space-2);
  margin: 0;
  font-size: var(--text-small);
}
.workout-duration input {
  margin: 0;
}
.add-workout-exercise {
  width: 100%;
  margin: 0;
}
.workout-empty-state {
  margin: 0;
}
.workout-empty-state :deep(.actions) {
  width: 100%;
}
@media (max-width: 600px) {
  .workout-duration {
    flex-basis: 100%;
  }
}
</style>
