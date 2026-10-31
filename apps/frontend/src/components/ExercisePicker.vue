<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxPortal,
  ComboboxRoot,
  ComboboxTrigger,
} from 'reka-ui'
import { PhCaretDown, PhCheck, PhVideoCamera } from '@phosphor-icons/vue'
import { videoForExercise } from '../lib/exercise-media'
import type { Exercise, ExerciseKind } from '../lib/domain'
import {
  categoryLabel,
  equipmentCategories,
  equipmentLabel,
     exerciseAreas,
} from '../lib/exercise-catalog'
import { language, locale } from '../lib/i18n'

type SearchableExercise = Exercise & {
  category?: string | null
  body_part?: string | null
  target_muscle?: string | null
}

const RESULT_LIMIT = 40
const props = withDefaults(
  defineProps<{
    modelValue: string
    exercises: SearchableExercise[]
    label: string
    disabled?: boolean
    excludedIds?: string[]
    fallbackName?: string
    hideLabel?: boolean
    id?: string
    kind?: ExerciseKind
    placeholder?: string
  }>(),
  {
    disabled: false,
    excludedIds: () => [],
    fallbackName: '',
    hideLabel: false,
    id: undefined,
    kind: undefined,
    placeholder: '',
  },
)
const emit = defineEmits<{ 'update:modelValue': [string] }>()

const generatedId = useId()
const inputId = computed(() => props.id || `exercise-picker-${generatedId}`)
const hintId = computed(() => `${inputId.value}-hint`)
const listId = computed(() => `${inputId.value}-options`)
const open = ref(false)
const query = ref('')
const equipment = ref('')
const bodyArea = ref('')
const recordingType = ref<ExerciseKind | ''>('')
const filtersOpen = ref(false)
const activeFilterCount = computed(
  () => [equipment.value, bodyArea.value, recordingType.value].filter(Boolean).length,
)

function normalize(value: unknown) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim()
}

function exerciseName(exercise?: SearchableExercise) {
  if (!exercise) return props.fallbackName || props.modelValue
  return locale.value === 'ar' ? exercise.name_ar?.trim() || exercise.name : exercise.name
}

function equipmentName(exercise: SearchableExercise) {
  return locale.value === 'ar'
    ? exercise.equipment_ar?.trim() || exercise.equipment
    : exercise.equipment
}

function kindName(kind?: ExerciseKind) {
  if (kind === 'timed') return language('Timed', 'زمني')
  if (kind === 'distance') return language('Distance', 'مسافة')
  return language('Strength', 'قوة')
}

function searchText(exercise: SearchableExercise) {
  return [
    exercise.name,
    exercise.name_ar,
    exercise.equipment,
    exercise.equipment_ar,
    exercise.kind || 'strength',
    exercise.category,
    exercise.body_part,
    exercise.target_muscle,
  ]
    .filter(Boolean)
    .join(' ')
}

const uniqueExercises = computed(() => {
  const seen = new Set<string>()
  return props.exercises.filter((exercise) => {
    if (seen.has(exercise.id)) return false
    seen.add(exercise.id)
    return true
  })
})

const selectedExercise = computed(() =>
  uniqueExercises.value.find((exercise) => exercise.id === props.modelValue),
)

const baseExercises = computed(() =>
  uniqueExercises.value.filter(
    (exercise) =>
      (exercise.active !== false || exercise.id === props.modelValue) &&
      (!props.excludedIds.includes(exercise.id) || exercise.id === props.modelValue) &&
      (!props.kind || (exercise.kind || 'strength') === props.kind),
  ),
)

const kindOptions = computed(() => {
  const kinds = new Set(baseExercises.value.map((exercise) => exercise.kind || 'strength'))
  return (['strength', 'timed', 'distance'] as ExerciseKind[]).filter((kind) => kinds.has(kind))
})

const equipmentOptions = computed(() => {
  const options = new Set(baseExercises.value.flatMap(equipmentCategories).filter(Boolean))
  return [...options].sort((a, b) =>
    equipmentLabel(a).localeCompare(equipmentLabel(b), locale.value),
  )
})

const bodyAreaOptions = computed(() =>
  [...new Set(baseExercises.value.flatMap(exerciseAreas).filter(Boolean))].sort((a, b) =>
    categoryLabel(a).localeCompare(categoryLabel(b), locale.value),
  ),
)

const matches = computed(() => {
  const normalizedQuery = normalize(query.value)
  const terms = normalizedQuery.split(/\s+/).filter(Boolean)
  return baseExercises.value
    .map((exercise, index) => ({ exercise, index }))
    .filter(({ exercise }) => {
      if (recordingType.value && (exercise.kind || 'strength') !== recordingType.value) return false
      if (equipment.value && !equipmentCategories(exercise).includes(equipment.value)) return false
      if (bodyArea.value && !exerciseAreas(exercise).includes(bodyArea.value)) return false
      const haystack = normalize(searchText(exercise))
      return terms.every((term) => haystack.includes(term))
    })
    .sort((a, b) => {
      if (!normalizedQuery) return a.index - b.index
      const rank = (exercise: SearchableExercise) => {
        const names = [exercise.name, exercise.name_ar].filter(Boolean).map(normalize)
        if (names.includes(normalizedQuery)) return 0
        if (names.some((name) => name.startsWith(normalizedQuery))) return 1
        return 2
      }
      return rank(a.exercise) - rank(b.exercise) || a.index - b.index
    })
    .map(({ exercise }) => exercise)
})

const visibleExercises = computed(() => {
  const first = matches.value.slice(0, RESULT_LIMIT)
  if (query.value.trim() || !selectedExercise.value || first.some((x) => x.id === props.modelValue))
    return first
  if (!matches.value.some((x) => x.id === props.modelValue)) return first
  return [selectedExercise.value, ...first.slice(0, RESULT_LIMIT - 1)]
})

const resultsHint = computed(() => {
  const shown = visibleExercises.value.length
  const total = matches.value.length
  if (!total) return language('No matching exercises.', 'لا توجد تمارين مطابقة.')
  if (total > RESULT_LIMIT)
    return language(
      `Showing ${shown} of ${total} exercises. Refine your search to see more.`,
      `يتم عرض ${shown} من ${total} تمريناً. حدّد البحث لعرض المزيد.`,
    )
  return language(
    `Showing ${shown} exercise${shown === 1 ? '' : 's'}.`,
    `يتم عرض ${shown} تمريناً.`,
  )
})

function displayValue(value: unknown) {
  const selected = uniqueExercises.value.find((exercise) => exercise.id === String(value || ''))
  return exerciseName(selected)
}

function setOpen(value: boolean) {
  open.value = value
  if (!value) {
    query.value = ''
    filtersOpen.value = false
  }
}

function clearFilters() {
  equipment.value = ''
  bodyArea.value = ''
  recordingType.value = ''
}

function captureInput(event: Event) {
  // Read the native edit directly. Reka resets its internal display model on
  // a timer after Escape; those programmatic resets do not overwrite search.
  query.value = (event.target as HTMLInputElement).value
}

function select(value: unknown) {
  if (value) emit('update:modelValue', String(value))
}
</script>

<template>
  <div class="exercise-picker">
    <label :for="inputId" :class="{ 'sr-only': hideLabel }">{{ label }}</label>
    <ComboboxRoot
      :model-value="modelValue"
      :open="open"
      :disabled="disabled"
      :dir="locale === 'ar' ? 'rtl' : 'ltr'"
      ignore-filter
      open-on-click
      @update:open="setOpen"
      @update:model-value="select"
    >
      <ComboboxAnchor class="exercise-picker-anchor">
        <ComboboxInput
          :id="inputId"
          :display-value="displayValue"
          :aria-describedby="open ? hintId : undefined"
          :aria-controls="open ? listId : undefined"
          aria-haspopup="dialog"
          :placeholder="placeholder || language('Search exercises', 'ابحث عن تمرين')"
          autocomplete="off"
          @input.capture="captureInput"
        />
        <ComboboxTrigger type="button" :aria-label="language('Choose an exercise', 'اختيار تمرين')">
          <PhCaretDown :size="17" aria-hidden="true" />
        </ComboboxTrigger>
      </ComboboxAnchor>
      <ComboboxPortal>
        <section
          v-if="open"
          class="exercise-picker-region"
          role="region"
          :aria-label="label + ' · ' + language('Options', 'الخيارات')"
        >
          <ComboboxContent
            role="dialog"
            :id="listId"
            :aria-label="label + ' · ' + language('Options', 'الخيارات')"
            :aria-orientation="undefined"
            :aria-multiselectable="undefined"
            :dir="locale === 'ar' ? 'rtl' : 'ltr'"
            class="exercise-picker-options"
            position="popper"
            :side-offset="6"
            :collision-padding="12"
          >
            <div class="exercise-picker-scroll">
              <div class="exercise-picker-filter-actions">
                <button
                  type="button"
                  class="exercise-picker-filter-toggle"
                  :aria-expanded="filtersOpen"
                  @click.stop="filtersOpen = !filtersOpen"
                >
                  {{ language('Filters', 'المرشحات')
                  }}<span v-if="activeFilterCount"> · {{ activeFilterCount }}</span>
                </button>
                <button
                  v-if="activeFilterCount"
                  type="button"
                  class="exercise-picker-clear-filters"
                  @click.stop="clearFilters"
                >
                  {{ language('Clear filters', 'مسح المرشحات') }}
                </button>
              </div>
              <div v-if="filtersOpen" class="exercise-picker-tools">
                <label v-if="!kind">
                  <span>{{ language('Recording type', 'نوع التسجيل') }}</span>
                  <select v-model="recordingType" @keydown.stop>
                    <option value="">{{ language('All types', 'كل الأنواع') }}</option>
                    <option v-for="option in kindOptions" :key="option" :value="option">
                      {{ kindName(option) }}
                    </option>
                  </select>
                </label>
                <label>
                  <span>{{ language('Equipment', 'المعدات') }}</span>
                  <select v-model="equipment" @keydown.stop>
                    <option value="">{{ language('All equipment', 'كل المعدات') }}</option>
                    <option v-for="option in equipmentOptions" :key="option" :value="option">
                      {{ equipmentLabel(option) }}
                    </option>
                  </select>
                </label>
                <label>
                  <span>{{ language('Body area', 'منطقة الجسم') }}</span>
                  <select v-model="bodyArea" @keydown.stop>
                    <option value="">{{ language('All body areas', 'كل مناطق الجسم') }}</option>
                    <option v-for="option in bodyAreaOptions" :key="option" :value="option">
                      {{ categoryLabel(option) }}
                    </option>
                  </select>
                </label>
              </div>
              <p :id="hintId" class="exercise-picker-hint">{{ resultsHint }}</p>
              <div role="listbox" :aria-label="label" class="exercise-picker-viewport" tabindex="0">
                <ComboboxEmpty class="exercise-picker-empty">
                  {{
                    language(
                      'No exercise found. Try another name or filter.',
                      'لم نجد تمريناً. جرّب اسماً أو تصفية أخرى.',
                    )
                  }}
                </ComboboxEmpty>
                <ComboboxItem
                  v-for="exercise in visibleExercises"
                  :key="exercise.id"
                  :value="exercise.id"
                  :text-value="searchText(exercise)"
                  class="exercise-picker-option"
                >
                  <span class="exercise-picker-copy">
                    <strong dir="auto">{{ exerciseName(exercise) }}</strong>
                    <span
                      v-if="videoForExercise(exercise) || exercise.media_type?.startsWith('video/')"
                      :title="language('Video available', 'يتوفر فيديو')"
                      :aria-label="language('Video available', 'يتوفر فيديو')"
                      ><PhVideoCamera :size="18" aria-hidden="true"
                    /></span>
                    <small>
                      {{ equipmentName(exercise) || language('No equipment', 'بدون معدات') }} ·
                      {{ kindName(exercise.kind) }}
                    </small>
                  </span>
                  <ComboboxItemIndicator
                    ><PhCheck :size="17" aria-hidden="true"
                  /></ComboboxItemIndicator>
                </ComboboxItem>
              </div>
            </div>
          </ComboboxContent>
        </section>
      </ComboboxPortal>
    </ComboboxRoot>
  </div>
</template>

<style>
.exercise-picker {
  min-width: 0;
  width: 100%;
}
.exercise-picker > label:not(.sr-only) {
  display: block;
  margin-bottom: 6px;
}
.exercise-picker-anchor {
  display: flex;
  align-items: center;
  min-width: 0;
  width: 100%;
  border: 1px solid var(--control-border);
  border-radius: 8px;
  background: var(--field);
  box-shadow: var(--shadow-xs);
}
.exercise-picker-anchor:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--ring);
}
.exercise-picker-anchor input {
  box-shadow: none;
  width: 100%;
  min-width: 0;
  margin: 0;
  border: 0;
  background: transparent;
  font-size: 1rem;
  font-weight: 600;
  text-overflow: ellipsis;
}
.exercise-picker-anchor input:focus,
.exercise-picker-anchor input:focus-visible {
  box-shadow: none;
  outline: 0;
}
.exercise-picker-anchor button {
  display: grid;
  place-items: center;
  min-width: 42px;
  min-height: 44px;
  border: 0;
  background: transparent;
  color: var(--muted);
}
.exercise-picker-options {
  z-index: 120;
  width: var(--reka-combobox-trigger-width);
  min-width: min(340px, calc(100vw - 24px));
  max-width: calc(100vw - 24px);
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
  color: var(--ink);
  box-shadow: var(--shadow);
}
.exercise-picker-scroll {
  width: 100%;
  max-height: min(430px, var(--reka-combobox-content-available-height));
  overflow-y: auto;
  overscroll-behavior: contain;
}
.exercise-picker-filter-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--line);
}
.exercise-picker-filter-actions button {
  min-height: 34px;
  padding: 6px 9px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--surface);
  color: var(--ink);
  font-size: 0.76rem;
}
.exercise-picker-filter-actions button:hover {
  border-color: var(--accent);
}
.exercise-picker-clear-filters {
  color: var(--accent) !important;
}
.exercise-picker-tools {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(135px, 1fr));
  gap: 8px;
  padding: 10px;
  border-bottom: 1px solid var(--line);
}
.exercise-picker-tools label {
  min-width: 0;
  font-size: 0.7rem;
  color: var(--muted);
}
.exercise-picker-tools select {
  width: 100%;
  min-width: 0;
  margin-top: 4px;
  padding: 7px 26px 7px 8px;
  font-size: 0.78rem;
}
[dir='rtl'] .exercise-picker-tools select {
  padding: 7px 8px 7px 26px;
}
.exercise-picker-hint {
  margin: 0;
  padding: 9px 12px;
  border-bottom: 1px solid var(--line);
  color: var(--muted);
  font-size: 0.73rem;
}
.exercise-picker-viewport {
  padding: 5px;
}
.exercise-picker-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 48px;
  padding: 8px 10px;
  border-radius: 7px;
  cursor: pointer;
}
.exercise-picker-option[data-highlighted] {
  outline: 1px solid var(--accent);
  outline-offset: -1px;
  background: var(--tint);
}
.exercise-picker-option[data-state='checked'] {
  color: var(--accent);
}
.exercise-picker-copy {
  display: grid;
  min-width: 0;
  gap: 2px;
}
.exercise-picker-copy strong,
.exercise-picker-copy small {
  overflow-wrap: anywhere;
}
.exercise-picker-copy strong {
  font-size: 0.86rem;
}
.exercise-picker-copy small {
  color: var(--muted);
  font-size: 0.72rem;
}
.exercise-picker-empty {
  padding: 18px 10px;
  font-size: 0.85rem;
}
@media (max-width: 400px) {
  .exercise-picker-tools {
    grid-template-columns: 1fr;
  }
}
</style>
