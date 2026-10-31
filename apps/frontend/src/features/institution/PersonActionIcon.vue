<script setup lang="ts">
defineProps<{ kind: 'profile' | 'message' | 'manage' }>()
</script>
<template>
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <template v-if="kind === 'profile'">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
    </template>
    <path
      v-else-if="kind === 'message'"
      d="M21 11.5a8.4 8.4 0 0 1-9 8.5 10 10 0 0 1-4-.8L3 21l1.8-5A8.5 8.5 0 1 1 21 11.5Z"
    />
    <template v-else><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15Z" /></template>
  </svg>
</template>
