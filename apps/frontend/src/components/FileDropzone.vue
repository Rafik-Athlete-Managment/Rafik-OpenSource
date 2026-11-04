<!-- Shared file picker: accepts drag-and-drop or button selection and reports chosen files. -->
<script setup lang="ts">
import { ref, useId } from 'vue'
import { PhUploadSimple } from '@phosphor-icons/vue'
import { language as l } from '../lib/i18n'
const props = defineProps<{
  label: string
  hint: string
  accept: string
  disabled?: boolean
  multiple?: boolean
}>()
const emit = defineEmits<{ change: [event: Event] }>()
const input = ref<HTMLInputElement>(),
  dragging = ref(false),
  hintId = useId()
function drop(event: DragEvent) {
  dragging.value = false
  if (props.disabled || !input.value || !event.dataTransfer?.files.length) return
  const transfer = new DataTransfer()
  const files = Array.from(event.dataTransfer.files)
  for (const file of props.multiple ? files : files.slice(0, 1)) transfer.items.add(file)
  input.value.files = transfer.files
  input.value.dispatchEvent(new Event('change', { bubbles: true }))
}
</script>
<template>
  <div
    class="file-dropzone"
    :class="{ dragging, disabled }"
    @dragover.prevent="dragging = !disabled"
    @dragleave="dragging = false"
    @drop.prevent="drop"
  >
    <PhUploadSimple :size="28" aria-hidden="true" />
    <strong>{{ label }}</strong>
    <p :id="hintId">{{ hint }}</p>
    <button
      type="button"
      class="button secondary"
      :disabled="disabled"
      :aria-describedby="hintId"
      @click="input?.click()"
    >
      {{ l('Choose a file', 'اختر ملفاً') }}
    </button>
    <span class="drop-hint">{{ l('or drag and drop it here', 'أو اسحبه وأفلته هنا') }}</span>
    <input
      ref="input"
      class="sr-only"
      tabindex="-1"
      type="file"
      :aria-label="label"
      :aria-describedby="hintId"
      :accept="accept"
      :multiple="multiple"
      :disabled="disabled"
      @change="emit('change', $event)"
    />
  </div>
</template>
<style scoped>
.file-dropzone {
  position: relative;
  min-width: 0;
  display: grid;
  justify-items: center;
  gap: var(--space-3);
  text-align: center;
  padding: var(--space-6);
  border: 1px dashed var(--line);
  border-radius: var(--radius-panel);
  background: var(--surface-soft);
  transition:
    border-color var(--motion-fast) var(--motion-ease),
    background-color var(--motion-fast) var(--motion-ease);
}
.file-dropzone.dragging {
  border-color: var(--accent);
  background: var(--tint);
}
.file-dropzone:focus-within {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
.file-dropzone > svg {
  color: var(--accent);
}
.file-dropzone strong {
  font-size: var(--text-small);
}
.file-dropzone p,
.drop-hint {
  margin: 0;
  color: var(--muted);
  font-size: var(--text-caption);
  line-height: 1.65;
  max-width: 50ch;
}
.file-dropzone.disabled {
  opacity: 0.65;
}
</style>
