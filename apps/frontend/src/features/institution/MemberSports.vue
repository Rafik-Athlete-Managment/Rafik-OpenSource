<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { request } from '../../lib/backend'
import { language as l } from '../../lib/i18n'
import { useCommand } from '../../lib/commands'
import CommandStatus from '../../components/CommandStatus.vue'
import type { Member, Sport } from './types'
const props = defineProps<{ institutionId: string; member: Member; sports: Sport[] }>()
const emit = defineEmits<{ saved: [] }>()
const chosen = ref<string[]>([])
watch(
  () => [props.member.id, props.member.sports],
  () => (chosen.value = [...(props.member.sports || [])]),
  { immediate: true },
)
const athlete = computed(() => props.member.roles.includes('trainee'))
// Athletes take part in sports; coaches can also cover general specialties.
// Archived entries stay visible while linked so they can be removed, but cannot be newly added.
const options = computed(() =>
  props.sports.filter(
    (s) =>
      (!athlete.value || s.kind === 'sport') &&
      (!s.archived || props.member.sports?.includes(s.id)),
  ),
)
const command = useCommand<'member-sports'>(
  `organization-member-sports:${props.institutionId}`,
  async () => emit('saved'),
  (_, args) =>
    request(`/v1/institution/sports`, {
      method: 'POST',
      body: JSON.stringify(args),
    }),
  { successMessage: l('Sports saved.', 'تم حفظ الرياضات.') },
)
const locked = computed(() => command.state.busy || !!command.state.pending || !command.state.ready)
const changed = computed(
  () => [...chosen.value].sort().join() !== [...(props.member.sports || [])].sort().join(),
)
function toggle(id: string, on: boolean) {
  chosen.value = on ? [...chosen.value, id] : chosen.value.filter((x) => x !== id)
}
const save = () =>
  command.run('member-sports', {
    operation: crypto.randomUUID(),
    action: 'member-sports',
    view: 'admin',
    member: props.member.id,
    sports: chosen.value,
    previous: props.member.sports || [],
  })
</script>
<template>
  <form class="form-stack member-sports" @submit.prevent="save">
    <fieldset :disabled="locked">
      <legend>
        {{ athlete ? l('Sports', 'الرياضات') : l('Sports and specialties', 'الرياضات والتخصصات') }}
      </legend>
      <p v-if="!options.length" class="small-print">
        {{
          l(
            'No sports yet. Add them in Institution settings.',
            'لا توجد رياضات بعد. أضفها من إعدادات المؤسسة.',
          )
        }}
      </p>
      <label v-for="sport in options" :key="sport.id" class="check-label"
        ><input
          type="checkbox"
          :checked="chosen.includes(sport.id)"
          :disabled="sport.archived && !chosen.includes(sport.id)"
          @change="toggle(sport.id, ($event.target as HTMLInputElement).checked)"
        /><span dir="auto">{{ sport.name }}</span
        ><small v-if="sport.kind === 'specialty'" class="muted">
          · {{ l('Specialty', 'تخصص') }}</small
        ><small v-if="sport.archived" class="muted"> · {{ l('Archived', 'مؤرشف') }}</small></label
      >
    </fieldset>
    <CommandStatus :command="command" />
    <button v-if="options.length" class="button secondary" :disabled="locked || !changed">
      {{ l('Save sports', 'حفظ الرياضات') }}
    </button>
  </form>
</template>
<style scoped>
.member-sports fieldset {
  border: 0;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 8px;
}
.member-sports legend {
  font-weight: 650;
  margin-bottom: 6px;
}
</style>
