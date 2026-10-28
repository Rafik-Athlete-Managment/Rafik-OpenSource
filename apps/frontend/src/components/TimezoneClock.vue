<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { PhClock } from '@phosphor-icons/vue'
import { preferredTimezone, timestampLabel } from '../lib/display-time'
import { language as l } from '../lib/i18n'

const now = ref(new Date())
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timer = setInterval(() => {
    now.value = new Date()
  }, 1000)
})
onUnmounted(() => clearInterval(timer))
const clock = computed(() =>
  timestampLabel(now.value, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }),
)
const description = computed(
  () =>
    l('Your time', 'توقيتك') + ' · ' + preferredTimezone.value + ' · ' + timestampLabel(now.value),
)
</script>
<template>
  <RouterLink
    class="timezone-clock"
    to="/settings"
    :title="description"
    :aria-label="
      description + ' · ' + l('Change timezone in settings', 'غيّر المنطقة الزمنية في الإعدادات')
    "
  >
    <PhClock :size="18" aria-hidden="true" />
    <span
      ><time :datetime="now.toISOString()" dir="ltr" aria-live="off">{{ clock }}</time
      ><small dir="ltr">{{ preferredTimezone }}</small></span
    >
  </RouterLink>
</template>
<style scoped>
.timezone-clock {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 4px 8px;
  color: var(--ink);
  border-radius: var(--radius-control);
}
.timezone-clock:hover {
  background: var(--surface-soft);
}
.timezone-clock > span {
  display: grid;
  gap: 1px;
  min-width: 0;
}
.timezone-clock time {
  font-size: 0.85rem;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  line-height: 1.4;
  white-space: nowrap;
}
.timezone-clock small {
  max-width: 170px;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--muted);
  font-size: 0.75rem;
  white-space: nowrap;
}
.timezone-clock svg {
  flex: none;
  color: var(--muted);
}
</style>
