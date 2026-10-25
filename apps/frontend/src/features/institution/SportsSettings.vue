<script setup lang="ts">
import SectionHeader from '../../components/SectionHeader.vue'
import { computed, onMounted, ref } from 'vue'
import { request } from '../../lib/backend'
import { language as l, errorMessage } from '../../lib/i18n'
import { useCommand } from '../../lib/commands'
import CommandStatus from '../../components/CommandStatus.vue'
import type { Sport } from './types'
const props = defineProps<{ institutionId: string }>()
const emit = defineEmits<{ changed: [] }>()
const endpoint = `/v1/institution/sports`
const items = ref<Sport[]>([]),
  loading = ref(true),
  error = ref(''),
  name = ref(''),
  kind = ref<Sport['kind']>('sport'),
  editing = ref(''),
  editName = ref('')
async function load() {
  loading.value = true
  error.value = ''
  try {
    items.value = (await request<{ items: Sport[] }>(`${endpoint}?view=admin`)).items
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
const command = useCommand<'sports'>(
  `organization-sports:${props.institutionId}`,
  async (_, __, args) => {
    if (!args.revision) name.value = ''
    editing.value = ''
    await load()
    emit('changed')
  },
  (_, args) => request(endpoint, { method: 'POST', body: JSON.stringify(args) }),
  { successMessage: l('Sports and specialties saved.', 'تم حفظ الرياضات والتخصصات.') },
)
const locked = computed(() => command.state.busy || !!command.state.pending || !command.state.ready)
const save = (sport: Pick<Sport, 'id' | 'name' | 'kind' | 'archived' | 'revision'>) =>
  command.run('sports', {
    operation: crypto.randomUUID(),
    action: 'sport',
    view: 'admin',
    ...sport,
  })
const groups = computed(() => [
  {
    kind: 'sport' as const,
    title: l('Sports', 'الرياضات'),
    items: items.value.filter((s) => s.kind === 'sport'),
  },
  {
    kind: 'specialty' as const,
    title: l('Coaching specialties', 'تخصصات التدريب'),
    items: items.value.filter((s) => s.kind === 'specialty'),
  },
])
const add = () =>
  save({
    id: crypto.randomUUID(),
    name: name.value,
    kind: kind.value,
    archived: false,
    revision: 0,
  })
function startEdit(sport: Sport) {
  editing.value = sport.id
  editName.value = sport.name
}
onMounted(load)
</script>
<template>
  <section class="sports-settings form-stack" aria-labelledby="sports-settings-heading">
    <SectionHeader
      id="sports-settings-heading"
      :title="l('Sports and specialties', 'الرياضات والتخصصات')"
      :description="
        l(
          'Athletes take part in sports; coaches cover sports or specialties. These labels do not change permissions.',
          'يمارس الرياضيون الرياضات، ويغطي المدربون الرياضات أو التخصصات. لا تغيّر هذه التسميات الصلاحيات.',
        )
      "
    />
    <CommandStatus :command="command" />
    <form class="sports-add" @submit.prevent="add">
      <label
        >{{ l('Name', 'الاسم') }}<input v-model="name" maxlength="80" required :disabled="locked"
      /></label>
      <fieldset class="role-choices">
        <legend>{{ l('Type', 'النوع') }}</legend>
        <label
          ><input v-model="kind" type="radio" value="sport" :disabled="locked" />{{
            l('Sport', 'رياضة')
          }}</label
        ><label
          ><input v-model="kind" type="radio" value="specialty" :disabled="locked" />{{
            l('Coaching specialty', 'تخصص تدريبي')
          }}</label
        >
      </fieldset>
      <button class="button secondary" :disabled="locked || !name.trim()">
        {{ l('Add', 'إضافة') }}
      </button>
    </form>
    <p v-if="loading" role="status" class="small-print">{{ l('Loading…', 'جارٍ التحميل…') }}</p>
    <p v-else-if="error" role="alert" class="notice error">
      {{ error }}
      <button type="button" class="text-link" @click="load">
        {{ l('Retry', 'إعادة المحاولة') }}
      </button>
    </p>
    <div v-else class="sports-groups">
      <section v-for="group in groups" :key="group.kind" :aria-label="group.title">
        <h3>{{ group.title }} ({{ group.items.length }})</h3>
        <p v-if="!group.items.length" class="small-print">
          {{ l('None yet.', 'لا يوجد بعد.') }}
        </p>
        <ul class="sports-list">
          <li v-for="sport in group.items" :key="sport.id">
            <form
              v-if="editing === sport.id"
              class="sports-edit"
              @submit.prevent="save({ ...sport, name: editName })"
            >
              <label class="sr-only" :for="'sport-' + sport.id">{{ l('Name', 'الاسم') }}</label
              ><input
                :id="'sport-' + sport.id"
                v-model="editName"
                maxlength="80"
                required
                :disabled="locked"
              /><button class="button small" :disabled="locked || !editName.trim()">
                {{ l('Save', 'حفظ') }}</button
              ><button type="button" class="text-link danger-action" @click="editing = ''">
                {{ l('Cancel', 'إلغاء') }}
              </button>
            </form>
            <template v-else>
              <span dir="auto" :class="{ muted: sport.archived }">{{ sport.name }}</span>
              <span v-if="sport.archived" class="tag">{{ l('Archived', 'مؤرشف') }}</span>
              <span class="sports-actions"
                ><button
                  type="button"
                  class="text-link"
                  :disabled="locked"
                  :aria-label="l('Rename ', 'إعادة تسمية ') + sport.name"
                  @click="startEdit(sport)"
                >
                  {{ l('Rename', 'إعادة تسمية') }}</button
                ><button
                  type="button"
                  class="text-link"
                  :disabled="locked"
                  :aria-label="
                    (sport.archived ? l('Restore ', 'استعادة ') : l('Archive ', 'أرشفة ')) +
                    sport.name
                  "
                  @click="save({ ...sport, archived: !sport.archived })"
                >
                  {{ sport.archived ? l('Restore', 'استعادة') : l('Archive', 'أرشفة') }}
                </button></span
              >
            </template>
          </li>
        </ul>
      </section>
    </div>
  </section>
</template>
<style scoped>
.sports-add {
  display: grid;
  grid-template-columns: minmax(200px, 1fr) auto auto;
  align-items: end;
  gap: 16px;
  margin: 0;
}
.sports-add > label {
  display: grid;
  gap: 8px;
  margin: 0;
  min-width: 0;
}
.sports-add input:not([type='radio']),
.sports-add > .button {
  height: 44px;
  min-height: 44px;
  margin: 0;
}
.sports-add .role-choices {
  /* A shared form rule spans role choices across the row; keep this one inline. */
  grid-column: auto;
  margin: 0;
}
.sports-groups {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
  gap: 16px 32px;
  align-items: start;
}
.sports-groups h3 {
  margin: 0 0 8px;
}
@media (max-width: 700px) {
  .sports-add {
    grid-template-columns: minmax(0, 1fr);
  }
  .sports-add > .button {
    justify-self: start;
  }
  .sports-add > label,
  .sports-add .role-choices {
    grid-column: 1 / -1;
  }
}
.sports-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 6px;
}
.sports-list li,
.sports-edit {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  min-width: 0;
}
.sports-list li > span[dir] {
  overflow-wrap: anywhere;
}
.sports-actions {
  margin-inline-start: auto;
  display: flex;
  gap: 12px;
}
.sports-edit input {
  flex: 1 1 160px;
  min-width: 0;
}
</style>
