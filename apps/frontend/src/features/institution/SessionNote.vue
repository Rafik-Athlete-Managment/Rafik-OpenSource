<script setup lang="ts">
import { nextTick } from 'vue'
import { ref, computed, onMounted, watch } from 'vue'
import { user } from '../../app/auth'
import { getDraft, storeDraft, removeDraft } from '../../lib/storage'
import { request } from '../../lib/backend'
import { language as l, errorMessage } from '../../lib/i18n'
import { useCommand } from '../../lib/commands'
import CommandStatus from '../../components/CommandStatus.vue'
const props = defineProps<{
    institution: string
    view: string
    event: string
    member: string
    name: string
    note: string
    revision: number
    writable: boolean
  }>(),
  emit = defineEmits<{ saved: [] }>(),
  key = `session-note:${user.value!.id}:${props.institution}:${props.event}:${props.member}`
const text = ref(props.note),
  revision = ref(props.revision),
  ready = ref(false),
  saved = ref(false),
  error = ref(''),
  editing = ref(false)
let generation = 0
const command = useCommand<'note'>(
  key,
  async (_, result) => {
    ready.value = false
    revision.value = (result as { revision: number }).revision
    text.value = (result as { session_note: string }).session_note
    await nextTick()
    await removeDraft(key)
    saved.value = false
    ready.value = true
    editing.value = false
  },
  (_, args) =>
    request(`/v1/institution/calendar`, {
      method: 'POST',
      body: JSON.stringify(args),
    }),
  { successMessage: l('Session note updated.', 'تم تحديث ملاحظة الجلسة.') },
)
const locked = computed(() => command.state.busy || !!command.state.pending || !command.state.ready)
watch(
  () => command.state.notice,
  (value) => {
    if (value) emit('saved')
  },
)
watch(text, async () => {
  if (!ready.value) return
  const current = ++generation
  saved.value = false
  try {
    await storeDraft(key, { note: text.value, revision: revision.value })
    if (current === generation) {
      saved.value = true
      error.value = ''
    }
  } catch (e) {
    error.value = errorMessage(e)
  }
})
onMounted(async () => {
  const draft = await getDraft<{ note: string; revision: number }>(key).catch(() => undefined)
  if (draft) {
    text.value = draft.note
    revision.value = draft.revision
    saved.value = true
  }
  ready.value = true
})
async function reloadSaved() {
  try {
    const latest = await request<{
      people: { member_id: string; session_note: string; revision: number }[]
    }>(`/v1/institution/calendar?view=${props.view}&id=${props.event}`)
    const person = latest.people.find((p) => p.member_id === props.member)
    if (!person) throw Error('trainee_unavailable')
    ready.value = false
    text.value = person.session_note
    revision.value = person.revision
    saved.value = false
    await removeDraft(key)
    ready.value = true
    command.state.error = ''
    emit('saved')
  } catch (e) {
    error.value = errorMessage(e)
    ready.value = true
  }
}
function save() {
  return command.run('note', {
    action: 'session-note',
    view: props.view,
    id: props.event,
    member: props.member,
    revision: revision.value,
    note: text.value,
    operation: crypto.randomUUID(),
  })
}
</script>
<template>
  <div class="session-note">
    <p v-if="note && !editing" class="session-note-copy">{{ note }}</p>
    <button
      v-if="writable && !editing"
      type="button"
      class="text-link"
      :disabled="locked"
      @click="editing = true"
    >
      {{
        saved
          ? l('Continue session note', 'متابعة ملاحظة الجلسة')
          : note
            ? l('Edit session note', 'تعديل ملاحظة الجلسة')
            : l('Add session note', 'إضافة ملاحظة للجلسة')
      }}</button
    ><CommandStatus :command="command" /><button
      v-if="command.state.error && !command.state.pending"
      type="button"
      class="text-link"
      @click="reloadSaved"
    >
      {{
        l('Reload saved note (discard this draft)', 'إعادة تحميل الملاحظة المحفوظة وحذف المسودة')
      }}
    </button>
    <form v-if="editing && writable" @submit.prevent="save">
      <fieldset :disabled="locked" class="form-fields">
        <label
          >{{ l('Session note for', 'ملاحظة جلسة') }} {{ name
          }}<textarea v-model="text" maxlength="2000" rows="3" />
        </label>
        <p class="small-print">
          {{
            l(
              'Visible to this athlete and authorized session staff.',
              'مرئية لهذا الرياضي وموظفي الجلسة المصرح لهم.',
            )
          }}
        </p>
        <p v-if="saved" role="status" class="small-print">
          {{ l('Draft saved on this device.', 'حُفظت المسودة على هذا الجهاز.') }}
        </p>
        <p v-if="error" role="alert" class="notice error">{{ error }}</p>
        <div class="actions">
          <button class="button secondary small">
            {{ l('Save session note', 'حفظ ملاحظة الجلسة') }}</button
          ><button type="button" class="text-link" @click="editing = false">
            {{ l('Close', 'إغلاق') }}
          </button>
        </div>
      </fieldset>
    </form>
  </div>
</template>
<style scoped>
.session-note {
  width: 100%;
  min-width: 0;
}
.session-note-copy {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.session-note form {
  margin-top: 0.75rem;
}
</style>
