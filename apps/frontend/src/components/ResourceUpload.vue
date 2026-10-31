<script setup lang="ts">
import FileDropzone from './FileDropzone.vue'
import { ref, onUnmounted } from 'vue'
import { request } from '../lib/backend'
import { getDraft, storeDraft, removeDraft } from '../lib/storage'
import { user } from '../app/auth'
import { language as l, errorMessage } from '../lib/i18n'
import { PhImage, PhPaperclip } from '@phosphor-icons/vue'
export type UploadedAsset = { id: string; filename: string; media_type: string; bytes?: number }
const props = defineProps<{
  institution: string
  view: string
  purpose: 'exercise' | 'message'
  channel?: string
  disabled?: boolean
  composer?: boolean
  remaining?: number
}>()
const emit = defineEmits<{ uploaded: [asset: UploadedAsset]; busy: [value: boolean] }>()
const busy = ref(false),
  error = ref(''),
  filename = ref(''),
  photoInput = ref<HTMLInputElement>(),
  fileInput = ref<HTMLInputElement>()
let disposed = false
onUnmounted(() => {
  disposed = true
})
async function upload(event: Event) {
  const input = event.target as HTMLInputElement,
    files = Array.from(input.files || [])
  if (!files.length || props.disabled || busy.value) return
  error.value = ''
  filename.value = ''
  if (props.composer && files.length > (props.remaining ?? 10)) {
    error.value = l(
      'Attach up to 10 files per message. Remove a file or choose fewer files.',
      'أرفق حتى 10 ملفات لكل رسالة. أزل ملفاً أو اختر عدداً أقل.',
    )
    input.value = ''
    return
  }
  if (files.some((file) => !file.size || file.size > 26214400)) {
    error.value = l('Choose a file up to 25 MB.', 'اختر ملفاً حتى 25 ميغابايت.')
    input.value = ''
    return
  }
  busy.value = true
  emit('busy', true)
  let currentFile = ''
  try {
    for (const file of files) {
      if (disposed) break
      currentFile = file.name
      const digest = Array.from(
        new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer())),
      )
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
      const key = `org-upload:${user.value!.id}:${props.institution}:${props.purpose}:${props.channel || ''}:${digest}:${file.name}`
      let id = await getDraft<string>(key)
      if (!id) {
        id = crypto.randomUUID()
        await storeDraft(key, id)
      }
      const query = new URLSearchParams({
        institution: props.institution,
        view: props.view,
        purpose: props.purpose,
        filename: file.name,
        ...(props.channel ? { channel: props.channel } : {}),
      })
      const asset = await request<UploadedAsset>(`/v1/assets/${id}?${query}`, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })
      await removeDraft(key)
      if (!disposed) {
        filename.value = asset.filename
        emit('uploaded', asset)
      }
    }
  } catch (e) {
    if (!disposed)
      error.value = props.composer
        ? `${currentFile}: ${errorMessage(e)} ${l('Earlier uploads remain attached. Choose the failed and remaining files to continue.', 'تبقى الملفات المرفوعة سابقاً مرفقة. اختر الملف المتعذر والملفات المتبقية للمتابعة.')}`
        : errorMessage(e)
  } finally {
    if (!disposed) {
      busy.value = false
      emit('busy', false)
      input.value = ''
    }
  }
}
</script>
<template>
  <div class="organization-upload" :class="{ 'composer-upload': composer }">
    <template v-if="composer">
      <div class="upload-buttons">
        <button
          type="button"
          class="upload-trigger"
          :disabled="disabled || busy"
          :aria-label="l('Attach a photo', 'إرفاق صورة')"
          :title="l('Attach a photo', 'إرفاق صورة')"
          @click="photoInput?.click()"
        >
          <PhImage :size="22" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="upload-trigger"
          :disabled="disabled || busy"
          :aria-label="l('Attach a file or document', 'إرفاق ملف أو مستند')"
          :title="l('Attach a file or document', 'إرفاق ملف أو مستند')"
          @click="fileInput?.click()"
        >
          <PhPaperclip :size="22" aria-hidden="true" />
        </button>
      </div>
      <input
        ref="photoInput"
        type="file"
        multiple
        hidden
        accept="image/png,image/jpeg,image/webp,image/gif"
        :disabled="disabled || busy"
        @change="upload"
      />
      <input
        ref="fileInput"
        type="file"
        multiple
        hidden
        accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,application/pdf"
        :disabled="disabled || busy"
        @change="upload"
      />
    </template>
    <FileDropzone
      v-else
      :label="
        purpose === 'exercise'
          ? l('Upload demonstration', 'رفع شرح التمرين')
          : l('Attach a file', 'إرفاق ملف')
      "
      :hint="
        purpose === 'exercise'
          ? l(
              'PNG, JPEG, WebP, GIF or MP4 · up to 25 MB',
              'PNG أو JPEG أو WebP أو GIF أو MP4 · حتى 25 ميغابايت',
            )
          : l('Image, MP4 or PDF · up to 25 MB', 'صورة أو MP4 أو PDF · حتى 25 ميغابايت')
      "
      :accept="
        purpose === 'exercise'
          ? 'image/png,image/jpeg,image/webp,image/gif,video/mp4'
          : 'image/png,image/jpeg,image/webp,image/gif,video/mp4,application/pdf'
      "
      :disabled="disabled || busy"
      @change="upload"
    />
    <p v-if="busy" role="status">
      {{ l('Uploading… Keep this page open.', 'جارٍ الرفع… أبقِ الصفحة مفتوحة.') }}
    </p>
    <p v-else-if="filename && !composer" role="status">
      {{ l('Uploaded: ', 'تم الرفع: ') + filename }}
    </p>
    <p v-if="error" class="notice error" role="alert">
      {{ error }}
      <template v-if="!composer">{{
        l('Choose the same file to retry safely.', 'اختر الملف نفسه للمحاولة مجدداً بأمان.')
      }}</template>
    </p>
  </div>
</template>
<style scoped>
.organization-upload {
  min-width: 0;
  display: grid;
  gap: 0.4rem;
}
input {
  max-width: 100%;
  min-width: 0;
}
small {
  color: var(--muted);
}
p {
  overflow-wrap: anywhere;
}
.upload-buttons {
  display: flex;
  gap: 0.25rem;
}
.upload-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
}
.upload-trigger:hover:not(:disabled) {
  color: var(--ink);
  background: var(--page);
}
.upload-trigger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.composer-upload {
  grid-column: 1 / -1;
}
</style>
