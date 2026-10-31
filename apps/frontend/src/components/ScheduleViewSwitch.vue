<script setup lang="ts">
import { useRoute } from 'vue-router'
import { PhCalendarBlank, PhListBullets } from '@phosphor-icons/vue'
import { language as l } from '../lib/i18n'
defineProps<{ base: string; view: 'calendar' | 'list' }>()
const route = useRoute()
</script>
<template>
  <RouterLink
    class="button secondary schedule-view-button"
    :to="{ path: base + (view === 'calendar' ? '/events' : '/schedule'), query: route.query }"
  >
    <Transition name="schedule-switch" mode="out-in" appear>
      <span :key="view" class="schedule-view-label">
        <component
          :is="view === 'calendar' ? PhListBullets : PhCalendarBlank"
          :size="18"
          aria-hidden="true"
        />
        {{
          view === 'calendar' ? l('List view', 'عرض القائمة') : l('Calendar view', 'عرض التقويم')
        }}
      </span>
    </Transition>
  </RouterLink>
</template>
<style scoped>
.schedule-view-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.schedule-view-button {
  transition:
    background-color 160ms ease,
    border-color 160ms ease,
    color 160ms ease;
}
.schedule-switch-enter-active,
.schedule-switch-leave-active {
  transition:
    opacity 160ms ease,
    transform 160ms ease;
}
.schedule-switch-enter-from {
  opacity: 0;
  transform: translateY(3px);
}
.schedule-switch-leave-to {
  opacity: 0;
  transform: translateY(-3px);
}
@media (prefers-reduced-motion: reduce) {
  .schedule-view-button,
  .schedule-switch-enter-active,
  .schedule-switch-leave-active {
    transition: none;
  }
  .schedule-switch-enter-from,
  .schedule-switch-leave-to {
    transform: none;
  }
}
</style>
