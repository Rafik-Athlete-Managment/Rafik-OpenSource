<!-- Athlete search: filters the supplied athlete list and returns the selected person. -->
<script setup lang="ts">
import { language as l } from '../lib/i18n'
defineProps<{ modelValue: string }>()
defineEmits<{ 'update:modelValue': [value: string] }>()
</script>
<template>
  <label class="athlete-search"
    >{{ l('Search athletes', 'البحث عن رياضيين') }}
    <input
      type="search"
      :value="modelValue"
      :placeholder="l('Search athlete names…', 'ابحث بأسماء الرياضيين…')"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
  </label>
</template>
<style scoped>
.athlete-search {
  min-width: 0;
  width: 100%;
  margin: 0;
}
</style>
