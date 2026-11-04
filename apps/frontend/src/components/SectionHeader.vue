<!-- Section heading: labels a related block of page content and optional actions. -->
<script setup lang="ts">
withDefaults(
  defineProps<{ title: string; description?: string; id?: string; level?: 'h2' | 'h3' }>(),
  { level: 'h2' },
)
</script>
<template>
  <header class="section-header">
    <component :is="level" :id="id">{{ title }}</component>
    <p v-if="description" class="small-print">{{ description }}</p>
  </header>
</template>
<style scoped>
.section-header {
  display: grid;
  gap: var(--space-2, 8px);
  min-width: 0;
}
.section-header h2,
.section-header h3 {
  margin: 0;
  font-size: var(--text-panel, 1.125rem);
  line-height: 1.4;
}
.section-header p {
  margin: 0;
  padding: 0;
}
</style>
