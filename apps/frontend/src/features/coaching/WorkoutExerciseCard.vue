<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import ExercisePicker from '../../components/ExercisePicker.vue'
import ExerciseMediaPreview from '../../components/ExerciseMediaPreview.vue'
import PrescriptionFields from './PrescriptionFields.vue'
import { PhPlus, PhTrash, PhArrowUp, PhArrowDown, PhX } from '@phosphor-icons/vue'
import type { Exercise, PrescriptionExercise } from '../../lib/domain'
import { addExerciseAlternative, selectMovement } from '../../lib/exercise-authoring'
import { language as l, locale } from '../../lib/i18n'

const ex = defineModel<PrescriptionExercise>({ required: true })
const props = defineProps<{
  catalog: Exercise[]
  index: number
  total: number
  disabled?: boolean
  removeDisabled?: boolean
  previousGroup?: string
}>()
const emit = defineEmits<{ move: [number]; remove: []; pair: [] }>()
const adding = ref(false),
  addButton = ref<HTMLButtonElement>(),
  alternativesHeading = ref<HTMLElement>()
const movement = computed(
  () => props.catalog.find((item) => item.id === ex.value.exerciseId) || ex.value.info,
)
const alternatives = computed(() => ex.value.alternatives || [])
function alternativeName(id: string) {
  const item =
    props.catalog.find((item) => item.id === id) ||
    alternatives.value.find((item) => item.exerciseId === id)?.info
  return (locale.value === 'ar' ? item?.name_ar || item?.name : item?.name) || id
}
function choose(id: string) {
  if (selectMovement(ex.value, id, props.catalog)) adding.value = false
}
function stopAdding() {
  adding.value = false
  void nextTick(() => (addButton.value || alternativesHeading.value)?.focus())
}
function addAlternative(id: string) {
  if (addExerciseAlternative(ex.value, id, props.catalog)) stopAdding()
}
watch(
  () => ex.value.kind,
  (kind, previous) => {
    if ((kind || 'strength') !== (previous || 'strength')) {
      ex.value.alternatives = []
      adding.value = false
    }
  },
)
</script>
<template>
  <article class="workout-exercise panel">
    <p v-if="ex.group" class="workout-group-label small-print">
      {{ l('Superset / circuit', 'مجموعة مركبة / دائرة') }} · <bdi>{{ ex.group }}</bdi>
      <span v-if="previousGroup === ex.group">
        · {{ l('Continue together', 'تابع ضمن المجموعة') }}</span
      >
    </p>
    <div class="workout-exercise-heading">
      <div class="workout-exercise-identity">
        <ExercisePicker
          :model-value="ex.exerciseId"
          :exercises="catalog"
          :fallback-name="locale === 'ar' ? movement?.name_ar || movement?.name : movement?.name"
          :label="l('Exercise', 'التمرين') + ' ' + (index + 1)"
          :disabled="disabled"
          @update:model-value="choose"
        />
        <ExerciseMediaPreview :exercise="movement" />
      </div>
      <div class="actions">
        <button
          type="button"
          class="button secondary icon-only"
          :aria-label="l('Move exercise up', 'نقل التمرين للأعلى')"
          :disabled="disabled || index === 0"
          @click="emit('move', -1)"
        >
          <PhArrowUp :size="18" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="button secondary icon-only"
          :aria-label="l('Move exercise down', 'نقل التمرين للأسفل')"
          :disabled="disabled || index === total - 1"
          @click="emit('move', 1)"
        >
          <PhArrowDown :size="18" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="button secondary danger-action icon-only"
          :aria-label="l('Remove exercise', 'إزالة التمرين')"
          :disabled="disabled || removeDisabled"
          @click="emit('remove')"
        >
          <PhTrash :size="18" aria-hidden="true" />
        </button>
      </div>
    </div>
    <button
      v-if="index > 0 && !ex.group"
      type="button"
      class="text-link workout-pair-action"
      :disabled="disabled"
      @click="emit('pair')"
    >
      {{ l('Pair with previous exercise', 'اربط بالتمرين السابق') }}
    </button>
    <div class="workout-prescription">
      <PrescriptionFields :model-value="ex" @update:model-value="ex = $event" />
    </div>
    <section
      class="workout-alternatives"
      :aria-label="l('Approved alternatives', 'البدائل المعتمدة') + ' ' + (index + 1)"
    >
      <div class="workout-alternatives-heading">
        <h3 ref="alternativesHeading" tabindex="-1">{{ l('Alternatives', 'البدائل') }}</h3>
        <span class="small-print" dir="ltr">{{ alternatives.length }} / 3</span>
      </div>
      <p class="small-print">
        {{
          l(
            'Up to three exercises of the same recording type, using these sets and targets.',
            'حتى ثلاثة تمارين من نوع التسجيل نفسه، باستخدام هذه المجموعات والأهداف.',
          )
        }}
      </p>
      <ul v-if="alternatives.length" class="workout-alternative-list">
        <li v-for="alternative in alternatives" :key="alternative.exerciseId">
          <bdi>{{ alternativeName(alternative.exerciseId) }}</bdi>
          <button
            type="button"
            class="button secondary danger-action icon-only"
            :disabled="disabled"
            :aria-label="
              l('Remove alternative', 'إزالة البديل') +
              ' ' +
              alternativeName(alternative.exerciseId)
            "
            @click="
              ex.alternatives = alternatives.filter(
                (item) => item.exerciseId !== alternative.exerciseId,
              )
            "
          >
            <PhX :size="18" aria-hidden="true" />
          </button>
        </li>
      </ul>
      <div v-if="adding" class="workout-alternative-search">
        <ExercisePicker
          model-value=""
          :exercises="catalog"
          :excluded-ids="[ex.exerciseId, ...alternatives.map((item) => item.exerciseId)]"
          :kind="ex.kind || 'strength'"
          :disabled="disabled"
          :label="l('Add approved alternative', 'إضافة بديل معتمد') + ' ' + (index + 1)"
          :placeholder="l('Search same-type exercises', 'ابحث عن تمارين من النوع نفسه')"
          @update:model-value="addAlternative"
        />
        <button
          type="button"
          class="text-link danger-action"
          :disabled="disabled"
          @click="stopAdding"
        >
          {{ l('Cancel', 'إلغاء') }}
        </button>
      </div>
      <button
        v-else-if="alternatives.length < 3"
        ref="addButton"
        type="button"
        class="button secondary small workout-add-alternative"
        :disabled="disabled || !ex.exerciseId"
        @click="adding = true"
      >
        <PhPlus :size="18" aria-hidden="true" />{{ l('Add alternative', 'إضافة بديل') }}
      </button>
    </section>
    <label
      >{{ l('Coaching notes', 'ملاحظات التدريب')
      }}<textarea v-model="ex.note" maxlength="500" rows="2" :disabled="disabled" />
    </label>
  </article>
</template>
<style scoped>
.workout-exercise {
  display: grid;
  gap: var(--space-4);
  margin: 0;
  min-width: 0;
}
.workout-exercise-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  justify-content: space-between;
  gap: var(--space-4);
}
.workout-exercise-identity {
  flex: 1 1 240px;
  display: flex;
  align-items: end;
  gap: var(--space-4);
  min-width: 0;
}
.workout-exercise-identity > .exercise-picker {
  flex: 1;
  min-width: 0;
}
.workout-exercise-heading .actions {
  margin: 0;
}
.workout-exercise :deep(label:not(.check-label)) {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  min-width: 0;
  font-size: var(--text-small);
}
.workout-exercise :deep(label input),
.workout-exercise :deep(label select),
.workout-exercise :deep(label textarea) {
  margin: 0;
}
.workout-exercise :deep(.exercise-picker) {
  display: grid;
  gap: var(--space-2);
}
.workout-exercise :deep(.exercise-fields) {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 140px), 1fr));
  gap: var(--space-4);
}
.workout-exercise :deep(.advanced-prescription) {
  margin: 0;
  border-block-start: 1px solid var(--line);
  padding-block-start: var(--space-4);
}
.workout-exercise :deep(.advanced-prescription > div) {
  padding-block: 0;
}
.workout-exercise :deep(.prescription-label) {
  margin: 0 0 var(--space-4);
  font-size: var(--text-small);
  font-weight: 600;
}
.workout-prescription {
  min-width: 0;
}
.workout-alternatives {
  display: grid;
  gap: var(--space-3);
  padding-block-start: var(--space-4);
  border-block-start: 1px solid var(--line);
}
.workout-alternatives-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
}
.workout-alternatives h3 {
  margin: 0;
  font-size: var(--text-panel);
  line-height: 1.4;
}
.workout-alternatives p,
.workout-group-label {
  margin: 0;
}
.workout-alternative-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: var(--space-2);
}
.workout-alternative-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
}
.workout-alternative-list bdi {
  min-width: 0;
  overflow-wrap: anywhere;
}
.workout-add-alternative,
.workout-pair-action {
  justify-self: start;
  margin: 0;
}
.workout-alternative-search {
  display: grid;
  gap: var(--space-2);
}
.workout-alternative-search > .text-link {
  justify-self: start;
}
@media (max-width: 600px) {
  .workout-exercise-identity {
    flex-wrap: wrap;
  }
  .workout-exercise-identity > .exercise-picker {
    flex-basis: 100%;
  }
  .workout-exercise :deep(.exercise-fields) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: end;
  }
}
</style>
