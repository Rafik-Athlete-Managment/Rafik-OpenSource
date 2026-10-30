<script setup lang="ts">
import ExercisePicker from '../../components/ExercisePicker.vue'
import EmptyState from '../../components/EmptyState.vue'
import PrescriptionFields from './PrescriptionFields.vue'
import { PhPlus, PhTrash, PhArrowUp, PhArrowDown } from '@phosphor-icons/vue'
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
function choose(index: number, id: string, catalog: Exercise[]) {
  const ex = day.value.exercises[index]!
  ex.exerciseId = id
  ex.kind = catalog.find((e) => e.id === id)?.kind || 'strength'
  ex.alternatives = []
  delete ex.info
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
    <article v-for="(ex, index) in day.exercises" :key="ex.key" class="workout-exercise panel">
      <div class="workout-exercise-heading">
        <ExercisePicker
          :model-value="ex.exerciseId"
          :exercises="catalog"
          :fallback-name="ex.info?.name"
          :label="l('Exercise', 'التمرين') + ' ' + (index + 1)"
          :disabled="disabled"
          @update:model-value="choose(index, $event, catalog)"
        />
        <div class="actions">
          <button
            type="button"
            class="button secondary icon-only"
            :aria-label="l('Move exercise up', 'نقل التمرين للأعلى')"
            :disabled="index === 0"
            @click="move(index, -1)"
          >
            <PhArrowUp :size="18" /></button
          ><button
            type="button"
            class="button secondary icon-only"
            :aria-label="l('Move exercise down', 'نقل التمرين للأسفل')"
            :disabled="index === day.exercises.length - 1"
            @click="move(index, 1)"
          >
            <PhArrowDown :size="18" /></button
          ><button
            type="button"
            class="button secondary danger-action icon-only"
            :aria-label="l('Remove exercise', 'إزالة التمرين')"
            @click="day.exercises.splice(index, 1)"
          >
            <PhTrash :size="18" />
          </button>
        </div>
      </div>
      <PrescriptionFields :model-value="ex" @update:model-value="day.exercises[index] = $event" />
      <label
        >{{ l('Coaching notes', 'ملاحظات التدريب')
        }}<textarea v-model="ex.note" maxlength="500" rows="2" />
      </label>
    </article>
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
.workout-exercise {
  display: grid;
  gap: var(--space-4);
  margin: 0;
}
.workout-fields-heading,
.workout-exercise-heading {
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
}
.workout-exercise-heading > :first-child {
  flex: 1 1 240px;
  min-width: 0;
}
.workout-fields :deep(label:not(.check-label)) {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  min-width: 0;
  font-size: var(--text-small);
}
.workout-fields :deep(label input),
.workout-fields :deep(label select),
.workout-fields :deep(label textarea) {
  margin: 0;
}
.workout-fields :deep(.exercise-fields) {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 140px), 1fr));
  gap: var(--space-4);
}
.workout-fields :deep(.exercise-picker) {
  display: grid;
  gap: var(--space-2);
}
.workout-fields :deep(.advanced-prescription) {
  margin: 0;
  border-block-start: 1px solid var(--line);
  padding-block-start: var(--space-4);
}
.workout-fields :deep(.advanced-prescription > div) {
  padding-block: 0;
}
.workout-fields :deep(.prescription-label) {
  margin: 0 0 var(--space-4);
  font-size: var(--text-small);
  font-weight: 600;
}
.workout-exercise-heading .actions {
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
  .workout-fields :deep(.exercise-fields) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: end;
  }
}
</style>
