<!-- Selects and previews the image attached to a program. -->
<script setup lang="ts">
import { ref, watch } from 'vue'
import { programImage } from '../../lib/backend'
const props = defineProps<{ id?: string }>(),
  unavailable = ref(false)
watch(
  () => props.id,
  () => (unavailable.value = false),
)
</script>
<template>
  <img
    v-if="id && !unavailable"
    class="program-cover"
    :src="programImage(id)"
    alt=""
    loading="lazy"
    @error="unavailable = true"
  />
</template>
<style scoped>
.program-cover {
  display: block;
  width: 100%;
  max-height: 300px;
  aspect-ratio: 16/9;
  object-fit: cover;
  border-radius: 8px;
  margin-bottom: 20px;
  background: var(--surface-soft);
}
</style>
