<script setup lang="ts">
import EmptyState from '../../components/EmptyState.vue'
import PageHeading from '../../components/PageHeading.vue'
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { programContext } from '../coaching/program-context'
import ResourceUpload from '../../components/ResourceUpload.vue'
import ResourceAsset from '../../components/ResourceAsset.vue'
import { request } from '../../lib/backend'
import { language as l, errorMessage } from '../../lib/i18n'
import { user } from '../../app/auth'
import { useCommand } from '../../lib/commands'
import CommandStatus from '../../components/CommandStatus.vue'
import { PhUploadSimple } from '@phosphor-icons/vue'
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from 'reka-ui'
import { locale } from '../../lib/i18n'
const context = programContext(useRoute()),
  search = ref(''),
  archived = ref(false),
  loading = ref(true),
  error = ref(''),
  next = ref<number | null>(null)
type Asset = {
  id: string
  filename: string
  media_type: string
  bytes: number
  retired: boolean
  revision: number
  editable: boolean
}
const assets = ref<Asset[]>([]),
  selected = ref<Asset>(),
  uploading = ref(false)
let serial = 0,
  disposed = false,
  timer: ReturnType<typeof setTimeout>
async function load(more = false) {
  const current = ++serial
  loading.value = true
  error.value = ''
  try {
    const result = await request<{ items: Asset[]; next: number | null }>(
      `/v1/institution/assets?` +
        new URLSearchParams({
          view: context.view,
          search: search.value,
          archived: String(archived.value),
          offset: String(more ? next.value || 0 : 0),
        }),
    )
    if (disposed || current !== serial) return
    assets.value = more ? [...assets.value, ...result.items] : result.items
    next.value = result.next
    selected.value = assets.value.find((a) => a.id === selected.value?.id) || assets.value[0]
  } catch (e) {
    if (!disposed && current === serial) error.value = errorMessage(e)
  } finally {
    if (!disposed && current === serial) loading.value = false
  }
}
const command = useCommand<'archive'>(
  `org-assets:${user.value!.id}:${context.key}`,
  () => load(),
  (_, args) =>
    request(`/v1/institution/assets`, {
      method: 'POST',
      body: JSON.stringify(args),
    }),
  {
    successMessage: (_, args) =>
      args.retired
        ? l('Resource archived.', 'تمت أرشفة المورد.')
        : l('Resource restored.', 'تمت استعادة المورد.'),
  },
)
const fileSize = (bytes: number) =>
  bytes < 1048576
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1048576).toFixed(1)} MB`
const change = (a: Asset) =>
  command.run('archive', {
    action: 'archive',
    operation: crypto.randomUUID(),
    view: context.view,
    id: a.id,
    revision: a.revision,
    retired: !a.retired,
  })
watch([search, archived], () => {
  serial++
  loading.value = true
  clearTimeout(timer)
  timer = setTimeout(() => load(), 200)
})
const uploadOpen = ref(false)
// An empty library shows the inline dropzone instead of a second upload entry point.
const firstUse = computed(
  () => !loading.value && !assets.value.length && !search.value && !archived.value,
)
function uploaded() {
  uploadOpen.value = false
  archived.value = false
  void load()
}
onMounted(() => load())
onUnmounted(() => {
  disposed = true
  clearTimeout(timer)
})
</script>
<template>
  <div class="container page institution-resources">
    <PageHeading class="page-heading"
      ><div>
        <p class="overline">{{ l('Your coaching toolkit', 'أدواتك التدريبية') }}</p>
        <h1>{{ l('Resources', 'الموارد') }}</h1>
        <p>
          {{
            l(
              'Manage exercise media here, or upload while creating an exercise. Private conversation files stay in their conversation.',
              'أدر وسائط التمارين هنا أو ارفعها أثناء إنشاء تمرين. تبقى ملفات المحادثات الخاصة في محادثاتها.',
            )
          }}
        </p>
      </div>
      <button
        v-if="!firstUse"
        type="button"
        class="button"
        aria-haspopup="dialog"
        @click="uploadOpen = true"
      >
        <PhUploadSimple :size="18" aria-hidden="true" />{{ l('Upload file', 'رفع ملف') }}
      </button></PageHeading
    >
    <DialogRoot v-model:open="uploadOpen">
      <DialogPortal>
        <DialogOverlay class="ui-dialog-overlay" />
        <DialogContent
          class="ui-dialog"
          :dir="locale === 'ar' ? 'rtl' : 'ltr'"
          @interact-outside="uploading && $event.preventDefault()"
          @escape-key-down="uploading && $event.preventDefault()"
        >
          <DialogTitle>{{ l('Upload a demonstration', 'رفع شرح') }}</DialogTitle>
          <DialogDescription>{{
            l(
              'New uploads are private until included in an institution-shared exercise or a published assignment.',
              'تكون الملفات الجديدة خاصة حتى تضمينها في تمرين مشترك للمؤسسة أو تكليف منشور.',
            )
          }}</DialogDescription>
          <ResourceUpload
            :institution="context.institution"
            :view="context.view"
            purpose="exercise"
            @uploaded="uploaded"
            @busy="uploading = $event"
          />
          <div class="ui-dialog-actions">
            <DialogClose as-child
              ><button type="button" class="button secondary" :disabled="uploading">
                {{ l('Close', 'إغلاق') }}
              </button></DialogClose
            >
          </div>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
    <CommandStatus :command="command" />
    <p v-if="error" role="alert" class="notice error">
      {{ error }}
      <button class="text-link" @click="load()">{{ l('Retry', 'إعادة المحاولة') }}</button>
    </p>
    <div class="field-pair resource-filters">
      <label
        >{{ l('Search files', 'البحث عن ملف')
        }}<input
          :placeholder="l('Search filenames…', 'ابحث بأسماء الملفات…')"
          v-model="search"
          type="search" /></label
      ><label
        >{{ l('Show', 'عرض')
        }}<select v-model="archived">
          <option :value="false">{{ l('Available files', 'الملفات المتاحة') }}</option>
          <option :value="true">{{ l('Archived files', 'الملفات المؤرشفة') }}</option>
        </select></label
      >
    </div>
    <div class="resource-columns" :class="{ 'with-selection': !!selected }">
      <section class="panel resource-list">
        <p v-if="loading" role="status">{{ l('Loading files…', 'جارٍ تحميل الملفات…') }}</p>
        <EmptyState
          v-if="!loading && !assets.length"
          compact
          :title="l('No files in this view', 'لا توجد ملفات في هذا العرض')"
          :description="
            search || archived
              ? l('Adjust the search and archive filter.', 'عدّل البحث ومرشح الأرشفة.')
              : l('Upload your first exercise demonstration below.', 'ارفع أول شرح لتمرين أدناه.')
          "
        />
        <ul class="resource-items" tabindex="0" :aria-label="l('Files', 'الملفات')">
          <li v-for="a in assets" :key="a.id">
            <button
              class="resource-row"
              :class="{ selected: selected?.id === a.id }"
              @click="selected = a"
            >
              <strong>{{ a.filename }}</strong
              ><small
                >{{ fileSize(a.bytes) }} ·
                {{
                  a.editable ? l('Your upload', 'ملفك') : l('Institution library', 'مكتبة المؤسسة')
                }}</small
              >
            </button>
          </li>
        </ul>
        <button
          v-if="next !== null"
          class="button secondary"
          :disabled="loading"
          @click="load(true)"
        >
          {{ l('More files', 'المزيد من الملفات') }}
        </button>
        <template v-if="firstUse && !uploadOpen">
          <ResourceUpload
            :institution="context.institution"
            :view="context.view"
            purpose="exercise"
            @uploaded="uploaded"
            @busy="uploading = $event"
          />
          <small>{{
            l(
              'New uploads are private until included in an institution-shared exercise or a published assignment.',
              'تكون الملفات الجديدة خاصة حتى تضمينها في تمرين مشترك للمؤسسة أو تكليف منشور.',
            )
          }}</small>
        </template>
      </section>
      <section class="panel resource-detail" v-if="selected">
        <h2>{{ selected.filename }}</h2>
        <ResourceAsset :id="selected.id" :name="selected.filename" />
        <p class="small-print">
          {{
            l(
              'Use “Choose an uploaded file” in the exercise editor to reuse this demonstration. Archiving removes it from new selections; published plans and existing exercise references retain access.',
              'استخدم «اختر ملفاً مرفوعاً» في محرر التمرين لإعادة استخدامه. تمنع الأرشفة الاختيارات الجديدة وتحتفظ الخطط المنشورة والمراجع الحالية بالملف.',
            )
          }}
        </p>
        <button
          v-if="selected.editable"
          class="button secondary"
          :disabled="command.state.busy || !!command.state.pending"
          @click="change(selected)"
        >
          {{
            selected.retired ? l('Restore file', 'استعادة الملف') : l('Archive file', 'أرشفة الملف')
          }}
        </button>
      </section>
    </div>
  </div>
</template>
<style scoped>
.resource-filters {
  margin-block: 0 var(--space-4);
}
.resource-columns > .panel {
  margin: 0;
}
.resource-columns {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
  min-height: 0;
}
.resource-columns.with-selection {
  grid-template-columns: minmax(260px, 0.8fr) minmax(0, 1.2fr);
}
.resource-list,
.resource-detail {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.resource-items {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 320px;
  overflow: auto;
}
.resource-row {
  width: 100%;
  text-align: start;
  display: grid;
  gap: 0.3rem;
  padding: 0.85rem;
  border: 0;
  border-bottom: 1px solid var(--line);
  color: var(--ink);
  background: transparent;
  overflow-wrap: anywhere;
}
.resource-row.selected {
  background: var(--tint);
}
h2 {
  overflow-wrap: anywhere;
  font-size: 1.2rem;
}
@media (max-width: 760px) {
  .resource-columns,
  .resource-columns.with-selection {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
