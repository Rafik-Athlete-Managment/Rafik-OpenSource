<script setup lang="ts">
import { preferredTimezone } from '../../lib/display-time'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { user } from '../../app/auth'
import { request } from '../../lib/backend'
import { getDraft, storeDraft, removeDraft } from '../../lib/storage'
import { language as l, errorMessage, locale } from '../../lib/i18n'
import { useCommand } from '../../lib/commands'
import CommandStatus from '../../components/CommandStatus.vue'
import ResourceUpload, { type UploadedAsset } from '../../components/ResourceUpload.vue'
import ResourceAsset from '../../components/ResourceAsset.vue'
import ChannelEditor from './ChannelEditor.vue'
import { PhImage, PhPaperclip, PhPaperPlaneRight, PhX } from '@phosphor-icons/vue'
const props = defineProps<{ institution: string; view: string; id: string; base: string }>(),
  emit = defineEmits<{ refresh: [] }>()
type Message = {
  id: string
  sequence: number
  sender_id: string
  asset_id?: string
  asset_ids?: string[]
  attachments?: { id: string; filename: string; media_type: string }[]
  body: string
  name: string
  created_at: string
}
type Detail = {
  channel: { id: string; title: string; revision: number; archived: boolean; private_pair: boolean }
  self: string
  canManage: boolean
  people: { id: string; name: string; manager: boolean; active: boolean }[]
  messages: Message[]
  more: boolean
}
const endpoint = `/v1/institution/communication`,
  key = `org-message:${user.value!.id}:${props.institution}:${props.view}:${props.id}`
const data = ref<Detail>(),
  messages = ref<Message[]>([]),
  text = ref(''),
  attachments = ref<UploadedAsset[]>([]),
  uploadVersion = ref(0),
  uploading = ref(false),
  error = ref(''),
  loading = ref(true),
  more = ref(false),
  newMessages = ref(false),
  editing = ref(false),
  showPeople = ref(false),
  ready = ref(false),
  draftError = ref(''),
  draftSaved = ref(false),
  historyGap = ref(false),
  log = ref<HTMLElement>(),
  composer = ref<HTMLTextAreaElement>()
let disposed = false,
  lastRead = 0,
  reading = false,
  poll: ReturnType<typeof setInterval>
let draftWrite = Promise.resolve()
const post = (args: Record<string, unknown>) =>
  request(endpoint, {
    method: 'POST',
    body: JSON.stringify({
      id: props.id,
      view: props.view,
      operation: crypto.randomUUID(),
      ...args,
    }),
  })
const command = useCommand<'send' | 'archive'>(
  key,
  async (name) => {
    if (name === 'send') {
      ready.value = false
      await draftWrite
      await removeDraft(key)
      text.value = ''
      attachments.value = []
      uploadVersion.value++
      draftSaved.value = false
      draftError.value = ''
      ready.value = !disposed
    }
    await load(false, true)
    emit('refresh')
    await nextTick()
    composer.value?.focus()
  },
  (_, args) => request(endpoint, { method: 'POST', body: JSON.stringify(args) }),
  {
    successMessage: (name, args) =>
      name === 'send'
        ? false
        : args.archived
          ? l('Conversation archived.', 'تمت أرشفة المحادثة.')
          : l('Conversation restored.', 'تمت استعادة المحادثة.'),
  },
)
const locked = computed(
  () =>
    !ready.value ||
    uploading.value ||
    command.state.busy ||
    !!command.state.pending ||
    !command.state.ready,
)
async function observe() {
  const el = log.value,
    last = messages.value.at(-1)
  if (
    reading ||
    !last ||
    last.sequence <= lastRead ||
    document.hidden ||
    disposed ||
    !el ||
    el.scrollHeight - el.scrollTop - el.clientHeight > 70
  )
    return
  reading = true
  try {
    await post({ action: 'read', sequence: last.sequence })
    lastRead = last.sequence
    newMessages.value = false
    emit('refresh')
  } catch {
    /* A later visible refresh retries the read cursor. */
  } finally {
    reading = false
  }
}
async function bottom() {
  await nextTick()
  if (log.value) log.value.scrollTop = log.value.scrollHeight
  await observe()
}
async function load(older = false, forceBottom = false) {
  if (disposed) return
  error.value = ''
  const el = log.value,
    atBottom = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 70,
    oldHeight = el?.scrollHeight || 0,
    oldTop = el?.scrollTop || 0
  try {
    const result = await request<Detail>(
      endpoint +
        `?view=${props.view}&id=${props.id}${older && messages.value.length ? '&before=' + messages.value[0]!.sequence : ''}`,
    )
    if (disposed) return
    data.value = result
    if (older) {
      messages.value = [...result.messages, ...messages.value]
      more.value = result.more
      await nextTick()
      if (log.value) log.value.scrollTop = oldTop + log.value.scrollHeight - oldHeight
    } else {
      if (!messages.value.length) more.value = result.more
      const previous = messages.value.at(-1)?.sequence || 0
      const separated =
        previous > 0 && result.more && !result.messages.some((m) => m.sequence === previous)
      if (separated) {
        messages.value = result.messages
        more.value = result.more
        historyGap.value = true
      } else {
        messages.value = Array.from(
          new Map([...messages.value, ...result.messages].map((m) => [m.id, m])).values(),
        ).sort((a, b) => a.sequence - b.sequence)
      }
      if (forceBottom || atBottom) await bottom()
      else if ((messages.value.at(-1)?.sequence || 0) > previous) newMessages.value = true
    }
  } catch (e) {
    error.value = errorMessage(e)
    if ((e as { statusCode?: number }).statusCode === 403) {
      data.value = undefined
      messages.value = []
    }
  } finally {
    loading.value = false
  }
}
async function afterMembers() {
  editing.value = false
  await load()
}
defineExpose({ refresh: () => load() })
function send() {
  if (locked.value || (!text.value.trim() && !attachments.value.length)) return
  return command.run('send', {
    action: 'send',
    id: props.id,
    view: props.view,
    operation: crypto.randomUUID(),
    message: crypto.randomUUID(),
    body:
      text.value.trim() ||
      attachments.value
        .map((a) => a.filename)
        .join(', ')
        .slice(0, 4000),
    asset_ids: attachments.value.map((a) => a.id),
  })
}
function archive() {
  return command.run('archive', {
    action: 'archive',
    id: props.id,
    view: props.view,
    operation: crypto.randomUUID(),
    revision: data.value!.channel.revision,
    archived: !data.value!.channel.archived,
  })
}
function stamp(value: string) {
  return new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar-AE' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: preferredTimezone.value,
  }).format(new Date(value))
}
watch(
  [text, attachments],
  () => {
    draftSaved.value = false
    if (!ready.value) return
    const draft = { text: text.value, attachments: attachments.value }
    draftWrite = draftWrite.then(async () => {
      try {
        await storeDraft(key, draft)
        if (disposed || !ready.value) return
        draftSaved.value = draft.text === text.value && draft.attachments === attachments.value
        draftError.value = ''
      } catch (e) {
        if (!disposed) draftError.value = errorMessage(e)
      }
    })
  },
  { flush: 'sync' },
)
function messageAssets(message: Message) {
  if (message.attachments?.length) return message.attachments
  return (message.asset_ids?.length ? message.asset_ids : [message.asset_id!]).map((id) => ({
    id,
    filename: undefined,
  }))
}
function removeAttachment(id: string) {
  attachments.value = attachments.value.filter((a) => a.id !== id)
  uploadVersion.value++
}
function addAttachment(asset: UploadedAsset) {
  if (attachments.value.length < 10 && !attachments.value.some((a) => a.id === asset.id))
    attachments.value = [...attachments.value, asset]
}
onMounted(async () => {
  const draft = await getDraft<
    string | { text: string; attachment?: UploadedAsset; attachments?: UploadedAsset[] }
  >(key).catch(() => undefined)
  text.value = typeof draft === 'string' ? draft : draft?.text || ''
  attachments.value =
    typeof draft === 'object'
      ? draft.attachments || (draft.attachment ? [draft.attachment] : [])
      : []
  ready.value = true
  await load(false, true)
  await nextTick()
  // Opening a chat puts the cursor in the message box, unless focus already moved elsewhere
  // (route changes focus <main> for screen readers; that still counts as "not moved").
  // Touch devices are skipped so the on-screen keyboard does not cover the history.
  const active = document.activeElement
  if (
    !disposed &&
    !window.matchMedia?.('(pointer: coarse)').matches &&
    (!active ||
      active === document.body ||
      active.matches('main') ||
      !!active.closest('.conversation-inbox'))
  )
    composer.value?.focus({ preventScroll: true })
  poll = setInterval(() => {
    if (!document.hidden && !editing.value) void load()
  }, 20000)
})
onUnmounted(() => {
  disposed = true
  clearInterval(poll)
})
</script>
<template>
  <section class="conversation-thread">
    <header class="thread-heading">
      <div class="thread-person">
        <RouterLink :to="base" class="conversation-back text-link">{{
          l('Back', 'رجوع')
        }}</RouterLink>
        <h2>{{ data?.channel.title || l('Conversation', 'المحادثة') }}</h2>
      </div>
      <button v-if="data" class="text-link" @click="showPeople = !showPeople">
        {{ l('Participants', 'المشاركون') }} ({{ data.people.length }})
      </button>
    </header>
    <div v-if="showPeople && data" class="channel-people">
      <p>
        {{
          l('Everyone below can read this history.', 'يستطيع جميع الأشخاص أدناه قراءة هذا السجل.')
        }}
      </p>
      <ul>
        <li v-for="p in data.people" :key="p.id">
          {{ p.name }}
          {{ !p.active ? l('(inactive)', '(غير نشط)') : p.manager ? l('· manager', '· مدير') : '' }}
        </li>
      </ul>
      <div v-if="data.canManage" class="actions">
        <button
          v-if="!data.channel.private_pair"
          class="text-link"
          @click="editing = !editing"
          :disabled="locked"
        >
          {{ l('Manage participants', 'إدارة المشاركين') }}</button
        ><button class="text-link" @click="archive" :disabled="locked">
          {{
            data.channel.archived
              ? l('Reopen conversation', 'إعادة فتح المحادثة')
              : l('Archive conversation', 'أرشفة المحادثة')
          }}
        </button>
      </div>
    </div>
    <ChannelEditor
      v-if="editing && data"
      :institution="institution"
      :view="view"
      :initial="{ ...data.channel, people: data.people }"
      @close="editing = false"
      @saved="afterMembers"
    />
    <p v-if="loading" role="status" class="notice">
      {{ l('Loading messages…', 'جارٍ تحميل الرسائل…') }}
    </p>
    <p v-if="error" role="alert" class="notice error">
      {{ error }}
      <button class="text-link" @click="load()">{{ l('Try again', 'حاول مجدداً') }}</button>
    </p>
    <p v-if="historyGap" class="small-print">
      {{
        l(
          'Showing the latest messages. Use Earlier messages to continue through the history.',
          'نعرض أحدث الرسائل. استخدم الرسائل الأقدم لمتابعة السجل.',
        )
      }}
    </p>
    <div
      v-if="data && !editing"
      ref="log"
      class="message-log"
      role="log"
      tabindex="0"
      :aria-label="l('Conversation messages', 'رسائل المحادثة')"
      aria-live="polite"
      @scroll="observe"
    >
      <button v-if="more" class="text-link earlier-messages" @click="load(true)">
        {{ l('Earlier messages', 'الرسائل الأقدم') }}
      </button>
      <p v-if="!messages.length" class="small-print">
        {{ l('Start with a useful update or a question.', 'ابدأ بتحديث مفيد أو سؤال.') }}
      </p>
      <article
        v-for="message in messages"
        :key="message.id"
        class="message-bubble"
        :class="{ own: message.sender_id === data.self }"
      >
        <p class="overline">
          {{ message.sender_id === data.self ? l('You', 'أنت') : message.name }}
        </p>
        <p dir="auto">{{ message.body }}</p>
        <div v-if="message.asset_ids?.length || message.asset_id" class="message-asset-list">
          <ResourceAsset
            v-for="asset in messageAssets(message)"
            :key="asset.id"
            :id="asset.id"
            :name="asset.filename"
            compact
          />
        </div>
        <time :datetime="message.created_at">{{ stamp(message.created_at) }}</time>
      </article>
    </div>
    <button v-if="newMessages" class="text-link new-messages" @click="bottom">
      {{ l('New messages ↓', 'رسائل جديدة ↓') }}
    </button>
    <form v-if="data && !editing" class="message-compose" @submit.prevent="send">
      <CommandStatus :command="command" :show-notice="false" />
      <p v-if="draftError" role="alert" class="notice error">{{ draftError }}</p>
      <p v-if="data.channel.archived" class="notice">
        {{
          l(
            'Archived. History stays available; new messages are paused.',
            'مؤرشفة. يبقى السجل متاحاً ويتوقف إرسال الرسائل الجديدة.',
          )
        }}
      </p>
      <template v-else>
        <section
          v-if="attachments.length"
          class="pending-attachments"
          :aria-label="l('Attachments', 'المرفقات')"
        >
          <h3>{{ l('Attachments', 'المرفقات') }} ({{ attachments.length }}/10)</h3>
          <div class="pending-attachment-list">
            <div v-for="attachment in attachments" :key="attachment.id" class="pending-attachment">
              <div class="pending-attachment-name">
                <PhImage
                  v-if="attachment.media_type.startsWith('image/')"
                  :size="20"
                  aria-hidden="true"
                />
                <PhPaperclip v-else :size="20" aria-hidden="true" />
                <span dir="auto">{{ attachment.filename }}</span>
              </div>
              <button
                type="button"
                class="attachment-remove danger-action"
                :disabled="locked"
                :aria-label="l('Remove attachment', 'إزالة المرفق')"
                :title="l('Remove attachment', 'إزالة المرفق')"
                @click="removeAttachment(attachment.id)"
              >
                <PhX :size="18" aria-hidden="true" />
              </button>
              <ResourceAsset
                :key="attachment.id"
                :id="attachment.id"
                :name="attachment.filename"
                compact
              />
            </div>
          </div>
        </section>
        <label class="sr-only" :for="'compose-' + id">{{
          l('Write a message', 'اكتب رسالة')
        }}</label
        ><textarea
          :id="'compose-' + id"
          ref="composer"
          v-model="text"
          :disabled="locked"
          maxlength="4000"
          rows="2"
          :placeholder="l('Write a message…', 'اكتب رسالة…')"
          @keydown="
            (event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
                event.preventDefault()
                void send()
              }
            }
          "
        />
        <div class="composer-actions">
          <ResourceUpload
            :key="uploadVersion"
            :institution="institution"
            :view="view"
            :channel="id"
            purpose="message"
            composer
            :remaining="10 - attachments.length"
            :disabled="locked || attachments.length >= 10"
            @busy="uploading = $event"
            @uploaded="addAttachment"
          />
          <small class="composer-note">{{
            data.channel.private_pair
              ? l('Private to the two participants', 'خاص بالمشاركين الاثنين')
              : l(
                  'Group conversation · institution admins can join',
                  'محادثة جماعية · يمكن لمديري المؤسسة الانضمام',
                )
          }}</small
          ><button
            class="button composer-send"
            :disabled="locked || (!text.trim() && !attachments.length)"
            :aria-label="l('Send message', 'إرسال الرسالة')"
          >
            <PhPaperPlaneRight :size="18" aria-hidden="true" class="send-icon" />
            <span>{{ l('Send', 'إرسال') }}</span>
          </button>
        </div></template
      >
    </form>
  </section>
</template>
<style scoped>
.channel-people {
  padding: 16px 20px;
  border-bottom: 1px solid var(--line);
  max-height: 35%;
  overflow: auto;
  font-size: 0.85rem;
}
.channel-people ul {
  padding-inline-start: 20px;
}
.conversation-thread :deep(.channel-editor) {
  overflow: auto;
  max-height: 100%;
  margin: 0;
  border: 0;
}
.thread-heading {
  flex-wrap: wrap;
}
.message-bubble p {
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.pending-attachments {
  display: grid;
  gap: 0.4rem;
  min-width: 0;
}
.pending-attachments h3 {
  margin: 0;
  font-size: 0.8rem;
  color: var(--muted);
}
.pending-attachment {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.5rem;
  align-items: center;
  padding: 0.6rem;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--page);
}
.pending-attachment-list,
.message-asset-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr));
  gap: 0.5rem;
  min-width: 0;
}
.pending-attachment-list {
  max-height: 180px;
  overflow-y: auto;
}
.pending-attachment-name {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  font-size: 0.85rem;
}
.pending-attachment-name svg {
  flex: none;
}
.pending-attachment-name span {
  overflow-wrap: anywhere;
  min-width: 0;
}
.attachment-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  color: var(--ink);
  cursor: pointer;
}
.pending-attachment :deep(.organization-asset) {
  grid-column: 1 / -1;
}
.pending-attachment :deep(img),
.pending-attachment :deep(video) {
  max-height: 110px;
}
</style>
