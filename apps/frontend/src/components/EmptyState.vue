<!-- Shared empty state: explains why a list has no results and shows its next action. -->
<script setup lang="ts">
import { PhTray } from '@phosphor-icons/vue'
withDefaults(defineProps<{ title: string; description?: string; compact?: boolean }>(), {
  compact: false,
})
</script>
<template>
  <section class="empty-state ui-empty-state" :class="{ 'is-compact': compact }">
    <PhTray :size="28" aria-hidden="true" />
    <h2>{{ title }}</h2>
    <p v-if="description">{{ description }}</p>
    <div v-if="$slots.default" class="actions"><slot /></div>
  </section>
</template>
<style scoped>
.ui-empty-state {
  width: 100%;
  max-width: none;
  display: grid;
  justify-items: start;
  gap: var(--space-3);
  padding: var(--space-6);
  margin-block: var(--space-4);
  text-align: start;
}
.ui-empty-state h2 {
  font-size: var(--text-section);
  margin: 0;
  line-height: 1.4;
}
.ui-empty-state p {
  max-width: 60ch;
  margin: 0;
  color: var(--muted);
  line-height: 1.65;
}
.ui-empty-state > svg {
  margin: 0;
  color: var(--accent);
}
.ui-empty-state .actions {
  margin: 0;
}
.ui-empty-state.is-compact {
  padding: var(--space-4) 0;
  margin: 0;
  border: 0;
  background: transparent;
}
@media (max-width: 600px) {
  .ui-empty-state {
    padding: var(--space-4);
  }
}
</style>
