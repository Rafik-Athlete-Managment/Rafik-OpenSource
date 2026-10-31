<script setup lang="ts">
import { computed, ref } from 'vue'
import { language as l } from '../lib/i18n'
const props = defineProps<{
  label: string
  options: { value: string; label: string }[]
  disabled?: boolean
}>()
const model = defineModel<string[]>({ default: () => [] })
const search = ref('')
const visible = computed(() =>
  props.options.filter((o) => o.label.toLowerCase().includes(search.value.toLowerCase())),
)
</script>
<template>
  <fieldset class="multi-choice" :disabled="disabled">
    <legend>{{ label }}</legend>
    <div v-if="model.length" class="choice-chips">
      <button
        v-for="value in model"
        :key="value"
        type="button"
        class="choice-chip danger-action"
        @click="model = model.filter((v) => v !== value)"
        :aria-label="
          l('Remove ', 'إزالة ') + (options.find((o) => o.value === value)?.label || value)
        "
      >
        {{ options.find((o) => o.value === value)?.label || value }}
        <span aria-hidden="true">×</span>
      </button>
    </div>
    <details>
      <summary>
        {{ l('Choose ', 'اختر ') + label.toLowerCase() }}
        <span class="subtle">{{
          model.length ? `(${model.length})` : l('(optional)', '(اختياري)')
        }}</span>
      </summary>
      <label v-if="options.length > 12" class="choice-search"
        >{{ l('Filter ', 'تصفية ') + label.toLowerCase()
        }}<input
          :placeholder="l('Type to filter options…', 'اكتب لتصفية الخيارات…')"
          type="search"
          v-model="search"
      /></label>
      <div class="choice-options">
        <label v-for="option in visible" :key="option.value"
          ><input type="checkbox" :value="option.value" v-model="model" />{{ option.label }}</label
        >
        <p v-if="!visible.length">{{ l('No matching options.', 'لا توجد خيارات مطابقة.') }}</p>
      </div>
    </details>
  </fieldset>
</template>
<style scoped>
.multi-choice {
  min-width: 0;
  padding: 0;
  border: 0;
  margin: 0;
}
legend {
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}
details {
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 0;
  background: var(--surface);
}
summary {
  padding: 0.7rem;
  cursor: pointer;
}
.choice-search {
  padding: 0.5rem 0.75rem;
}
.choice-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.25rem 0.75rem;
  max-height: 220px;
  overflow: auto;
  padding: 0.5rem 0.75rem;
}
.choice-options label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0;
  font-weight: 400;
}
.choice-options input {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
}
.choice-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.5rem;
}
.choice-chip {
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink);
  border-radius: 6px;
  padding: 0.3rem 0.5rem;
  font-size: 0.82rem;
}
</style>
