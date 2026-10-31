<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { language as l } from '../lib/i18n'
const props = defineProps<{ id: string; name?: string; compact?: boolean }>()
const source = ref(''),
  type = ref(''),
  error = ref(false),
  loading = ref(true)
let controller: AbortController | undefined
function clear() {
  controller?.abort()
  if (source.value) URL.revokeObjectURL(source.value)
  source.value = ''
}
async function load() {
  clear()
  const current = new AbortController()
  controller = current
  error.value = false
  loading.value = true
  try {
    const r = await fetch(
      (import.meta.env.VITE_API_URL || 'http://127.0.0.1:55331') + `/v1/assets/${props.id}`,
      { credentials: 'include', cache: 'no-store', signal: current.signal },
    )
    if (!r.ok) throw Error()
    const blob = await r.blob()
    if (current.signal.aborted) return
    type.value = blob.type
    source.value = URL.createObjectURL(blob)
  } catch {
    if (!current.signal.aborted) error.value = true
  } finally {
    if (!current.signal.aborted) loading.value = false
  }
}
watch(() => props.id, load, { immediate: true })
onUnmounted(clear)
</script>
<template>
  <div class="organization-asset" :class="{ compact }">
    <p v-if="loading" role="status">{{ l('Loading media…', 'جارٍ تحميل الوسائط…') }}</p>
    <p v-else-if="error" class="small-print">
      {{ l('Media unavailable.', 'الوسائط غير متاحة.') }}
      <button type="button" class="text-link" @click="load">
        {{ l('Retry', 'إعادة المحاولة') }}
      </button>
    </p>
    <template v-else>
      <video
        v-if="type === 'video/mp4'"
        :src="source"
        controls
        playsinline
        loop
        preload="metadata"
        :aria-label="name || l('Exercise demonstration', 'شرح التمرين')"
      />
      <img
        v-else-if="type.startsWith('image/')"
        :src="source"
        :alt="name || l('Attached image', 'الصورة المرفقة')"
      />
      <a :href="source" :download="name || 'attachment'" class="text-link"
        >{{ l('Download', 'تنزيل') }}{{ name ? ' · ' + name : '' }}</a
      >
    </template>
  </div>
</template>
<style scoped>
.organization-asset {
  display: grid;
  justify-items: start;
  gap: 0.5rem;
  min-width: 0;
  max-width: 100%;
}
img,
video {
  display: block;
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 360px;
  object-fit: contain;
  border-radius: 10px;
  background: var(--page);
}
.compact img,
.compact video {
  max-height: 220px;
}
a {
  font-size: 0.85rem;
  overflow-wrap: anywhere;
}
</style>
