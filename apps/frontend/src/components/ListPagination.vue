<!-- Shared list controls: changes page and page size while reporting the current range. -->
<script setup lang="ts">
import { computed } from 'vue'
import { language as l, locale } from '../lib/i18n'
const props = defineProps<{
  offset: number
  pageSize: number
  total: number
  disabled?: boolean
  sizes?: number[]
  label?: string
}>()
const emit = defineEmits<{ page: [offset: number]; pageSize: [size: number] }>()
const page = computed(() => Math.floor(props.offset / props.pageSize) + 1),
  pages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
</script>
<template>
  <nav
    v-if="total > 0 || offset > 0"
    class="list-pagination"
    :dir="locale === 'ar' ? 'rtl' : 'ltr'"
    :aria-label="label || l('Pagination', 'التنقل بين الصفحات')"
  >
    <label v-if="sizes?.length" class="pagination-size"
      >{{ l('Per page', 'لكل صفحة') }}
      <select
        :value="pageSize"
        :disabled="disabled"
        :aria-label="l('Records per page', 'عدد السجلات لكل صفحة')"
        @change="emit('pageSize', Number(($event.target as HTMLSelectElement).value))"
      >
        <option v-for="size in sizes" :key="size" :value="size">{{ size }}</option>
      </select>
    </label>
    <span class="pagination-steps"
      ><span dir="ltr" class="pagination-range" aria-live="polite"
        >{{ total ? offset + 1 : 0 }}–{{ Math.min(offset + pageSize, total) }} / {{ total }}</span
      ><button
        type="button"
        class="pagination-button"
        :disabled="disabled || offset === 0"
        :aria-label="l('Previous page', 'الصفحة السابقة')"
        @click="emit('page', Math.max(0, offset - pageSize))"
      >
        <svg
          viewBox="0 0 20 20"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          aria-hidden="true"
        >
          <path :d="locale === 'ar' ? 'm7 4 6 6-6 6' : 'm13 4-6 6 6 6'" />
        </svg></button
      ><span class="pagination-page"
        >{{ l('Page', 'صفحة') }} <bdi dir="ltr">{{ page }} / {{ pages }}</bdi></span
      ><button
        type="button"
        class="pagination-button"
        :disabled="disabled || offset + pageSize >= total"
        :aria-label="l('Next page', 'الصفحة التالية')"
        @click="emit('page', offset + pageSize)"
      >
        <svg
          viewBox="0 0 20 20"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          aria-hidden="true"
        >
          <path :d="locale === 'ar' ? 'm13 4-6 6 6 6' : 'm7 4 6 6-6 6'" />
        </svg></button
    ></span>
  </nav>
</template>
<style scoped>
.list-pagination {
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 0.875rem;
  flex-shrink: 0;
}
.pagination-size {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-weight: 400;
}
.pagination-size select {
  width: auto;
  min-width: 80px;
  min-height: 44px;
  margin: 0;
  margin-inline-end: 12px;
  padding-block: 8px;
}
.pagination-steps {
  /* Range and previous/next stay together; only the size control wraps away. */
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
.pagination-range {
  color: var(--muted);
  font-variant-numeric: tabular-nums;
  margin-inline-end: 6px;
}
.pagination-page {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.pagination-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  color: var(--ink);
  cursor: pointer;
}
.pagination-button:disabled {
  opacity: 0.45;
  cursor: default;
}
@media (max-width: 540px) {
  .list-pagination {
    justify-content: flex-start;
    gap: 6px;
  }
}
</style>
