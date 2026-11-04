<!-- Shared loading/error state: explains when page content is loading or cannot be shown. -->
<script setup lang="ts">
import { t } from '../lib/i18n'
defineProps<{ loading?: boolean; error?: string }>()
defineEmits<{ retry: [] }>()
</script>
<template>
  <div v-if="loading" class="loading-state" role="status">
    <span class="sr-only">{{ t('loading') }}</span>
    <div class="skeleton heading"></div>
    <div class="skeleton line"></div>
    <div class="skeleton block"></div>
  </div>
  <div v-else-if="error" class="notice error" role="alert">
    <p>{{ error }}</p>
    <button class="button small secondary" @click="$emit('retry')">{{ t('retry') }}</button>
  </div>
  <slot v-else />
</template>
