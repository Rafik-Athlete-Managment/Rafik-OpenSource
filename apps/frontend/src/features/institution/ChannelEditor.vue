<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { user } from '../../app/auth'
import { request } from '../../lib/backend'
import { getDraft, storeDraft, removeDraft } from '../../lib/storage'
import { language as l, errorMessage } from '../../lib/i18n'
import { useCommand } from '../../lib/commands'
import CommandStatus from '../../components/CommandStatus.vue'
import MemberPicker from './MemberPicker.vue'
import PageState from '../../components/PageState.vue'
import type { Institution } from './types'
const props = defineProps<{
  institution: string
  view: string
  initialMembers?: string[]
  initialTitle?: string
  initial?: {
    id: string
    title: string
    revision: number
    people: { id: string; manager: boolean }[]
  }
}>()
const emit = defineEmits<{ saved: [id: string]; close: [] }>()
const key = `channel-editor:${user.value!.id}:${props.institution}:${props.view}:${props.initial?.id || 'new'}:${[...(props.initialMembers || [])].sort().join(',')}`
const people = ref<Institution>(),
  loading = ref(true),
  error = ref('')
const ready = ref(false),
  saved = ref(false)
const draft = ref({
  id: props.initial?.id || crypto.randomUUID(),
  title: props.initial?.title || props.initialTitle || '',
  members: props.initial?.people.map((p) => p.id) || ([] as string[]),
  managers: props.initial?.people.filter((p) => p.manager).map((p) => p.id) || ([] as string[]),
})

const missing = computed(() =>
  draft.value.members.filter((id) => !people.value?.members.some((m) => m.id === id && m.active)),
)
const command = useCommand<'save'>(
  key,
  async (_, result) => {
    ready.value = false
    await removeDraft(key)
    emit('saved', (result as { id: string }).id)
  },
  (_, args) =>
    request(`/v1/institution/communication`, {
      method: 'POST',
      body: JSON.stringify(args),
    }),
  { successMessage: l('Conversation details updated.', 'تم تحديث تفاصيل المحادثة.') },
)
const locked = computed(() => command.state.busy || !!command.state.pending || !command.state.ready)
async function load() {
  loading.value = true
  error.value = ''
  try {
    people.value = await request(`/v1/institution?view=${props.view}&summary=true`)
    if (!people.value!.members.some((m) => m.id === people.value!.self.id)) {
      const own = people.value!.self
      people.value!.members.unshift({
        id: own.id,
        name: people.value!.names.find((m) => m.id === own.id)?.name || l('You', 'أنت'),
        roles: own.roles,
        active: true,
        user_id: user.value!.id,
        revision: 0,
        trainer_id: null,
      })
    }
    if (!props.initial) {
      draft.value.members = [...new Set([people.value!.self.id, ...(props.initialMembers || [])])]
      draft.value.managers = [people.value!.self.id]
      if (props.initialMembers?.length === 1 && !draft.value.title) {
        draft.value.title =
          people.value!.members.find((m) => m.id === props.initialMembers![0])?.name ||
          people.value!.names.find((m) => m.id === props.initialMembers![0])?.name ||
          ''
      }
    }
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
function remove(id: string) {
  draft.value.members = draft.value.members.filter((x) => x !== id)
  draft.value.managers = draft.value.managers.filter((x) => x !== id)
}
function save() {
  return command.run('save', {
    ...draft.value,
    managers: draft.value.managers.filter((id) => draft.value.members.includes(id)),
    action: props.initial ? 'members' : 'create',
    view: props.view,
    revision: props.initial?.revision || 0,
    operation: crypto.randomUUID(),
  })
}
watch(
  draft,
  async () => {
    if (!ready.value) return
    saved.value = false
    try {
      await storeDraft(key, draft.value)
      saved.value = true
    } catch (e) {
      error.value = errorMessage(e)
    }
  },
  { deep: true },
)
onMounted(async () => {
  await load()
  const stored = await getDraft<typeof draft.value>(key).catch(() => undefined)
  if (stored) draft.value = stored
  ready.value = true
})
</script>
<template>
  <section class="channel-editor panel">
    <div class="heading-actions">
      <h2>
        {{
          initial
            ? l('Conversation participants', 'المشاركون في المحادثة')
            : l('New conversation', 'محادثة جديدة')
        }}
      </h2>
      <button class="text-link" @click="emit('close')" :disabled="locked">
        {{ l('Close', 'إغلاق') }}
      </button>
    </div>
    <CommandStatus :command="command" />
    <PageState :loading="loading" :error="error" @retry="load"
      ><form v-if="people" @submit.prevent="save">
        <fieldset class="form-fields" :disabled="locked">
          <label v-if="!initial"
            >{{ l('Conversation name', 'اسم المحادثة')
            }}<input
              v-model="draft.title"
              maxlength="100"
              required
              :placeholder="l('e.g. Tuesday training group', 'مثلاً مجموعة تدريب الثلاثاء')"
          /></label>
          <p>
            {{
              !initial && draft.members.length === 2
                ? l(
                    'Private conversation for these two people. Other staff cannot join or read its messages and files.',
                    'محادثة خاصة بهذين الشخصين. لا يستطيع الموظفون الآخرون الانضمام أو قراءة الرسائل والملفات.',
                  )
                : l(
                    'Only the people listed here can read and send messages. New participants can see the existing history. Institution administrators may explicitly join; they appear in this list.',
                    'الأشخاص المدرجون هنا فقط يستطيعون قراءة الرسائل وإرسالها. يرى المشاركون الجدد السجل السابق. يمكن لمسؤولي المؤسسة الانضمام بشكل صريح ويظهرون في هذه القائمة.',
                  )
            }}
          </p>
          <MemberPicker
            :institution="institution"
            :view="view"
            v-model="draft.members"
            include-self
            :required-ids="[people.self.id]"
            :disabled="locked"
            @options="people.members = $event"
          />
          <fieldset>
            <legend>{{ l('Conversation managers', 'مديرو المحادثة') }}</legend>
            <label
              v-for="person in people.members.filter(
                (m) =>
                  draft.members.includes(m.id) &&
                  (m.roles.includes('admin') || m.roles.includes('trainer')),
              )"
              :key="person.id"
              class="check-label"
              ><input
                v-model="draft.managers"
                type="checkbox"
                :value="person.id"
                :disabled="
                  person.id === people.self.id ||
                  (!draft.managers.includes(person.id) && draft.managers.length >= 8)
                "
              />{{ person.name }}</label
            >
          </fieldset>
          <p v-for="id in missing" :key="id" class="notice">
            {{ l('A selected person is unavailable.', 'أحد الأشخاص المحددين غير متاح.') }}
            <button type="button" class="text-link danger-action" @click="remove(id)">
              {{ l('Remove', 'إزالة') }}
            </button>
          </p>
          <p role="status" class="small-print draft-status">
            {{
              saved
                ? l('Draft saved on this device.', 'حُفظت المسودة على هذا الجهاز.')
                : l(
                    'Changes stay on this device until confirmed.',
                    'تبقى التغييرات على هذا الجهاز حتى التأكيد.',
                  )
            }}
          </p>
          <button class="button" :disabled="draft.members.length < 2 || !!missing.length">
            {{
              initial
                ? l('Confirm participants', 'تأكيد المشاركين')
                : l('Create conversation', 'إنشاء المحادثة')
            }}
          </button>
        </fieldset>
      </form></PageState
    >
  </section>
</template>
<style scoped>
.channel-editor {
  margin-block: 20px;
}
.channel-editor h2 {
  font-size: 1.2rem;
}
.channel-editor label {
  margin-block: 12px;
}
.channel-person-choice {
  border-block-end: 1px solid var(--line);
  padding-block: 8px;
}
.channel-editor p {
  overflow-wrap: anywhere;
}
</style>
