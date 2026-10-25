<script setup lang="ts">
import SectionHeader from '../../components/SectionHeader.vue'
import { computed, ref } from 'vue'
import { request } from '../../lib/backend'
import { language as l } from '../../lib/i18n'
import { useCommand } from '../../lib/commands'
import CommandStatus from '../../components/CommandStatus.vue'
import MemberPicker from './MemberPicker.vue'
import type { Member, Sport } from './types'
const props = defineProps<{
  institutionId: string
  member: Member
  sports: Sport[]
  names: { id: string; name: string }[]
}>()
const emit = defineEmits<{ saved: [] }>()
const coach = ref(''),
  sport = ref(''),
  filter = ref(''),
  candidates = ref<Member[]>([])
const supporting = computed(() =>
  (props.member.coaches || []).filter((c) => c.kind === 'supporting'),
)
const nameOf = (id: string) => props.names.find((n) => n.id === id)?.name || l('Coach', 'مدرب')
const sportOf = (id: string | null) => props.sports.find((s) => s.id === id)?.name || ''
// A supporting coach covers one of the athlete's sports, or a general coaching specialty.
const choices = computed(() =>
  props.sports.filter(
    (s) => !s.archived && (s.kind === 'specialty' || (props.member.sports || []).includes(s.id)),
  ),
)
const scopes = computed(() =>
  choices.value.filter((scope) =>
    candidates.value.find((person) => person.id === coach.value)?.sports?.includes(scope.id),
  ),
)
function selectCoach(ids: string[]) {
  if (locked.value) return
  coach.value = ids[0] || ''
  sport.value = ''
  if (scopes.value.length === 1) {
    sport.value = scopes.value[0]!.id
    void add()
  }
}
const command = useCommand<'coaching'>(
  `organization-coaching:${props.institutionId}`,
  async (_, __, args) => {
    if (args.action === 'link-coach') {
      coach.value = ''
      sport.value = ''
    }
    emit('saved')
  },
  (_, args) => request(`/v1/institution`, { method: 'POST', body: JSON.stringify(args) }),
  { successMessage: l('Coaching team updated.', 'تم تحديث فريق التدريب.') },
)
const locked = computed(() => command.state.busy || !!command.state.pending || !command.state.ready)
const add = () =>
  command.run('coaching', {
    operation: crypto.randomUUID(),
    action: 'link-coach',
    id: crypto.randomUUID(),
    athlete: props.member.id,
    coach: coach.value,
    sport: sport.value,
  })
const remove = (link: { id: string; revision: number }) =>
  command.run('coaching', {
    operation: crypto.randomUUID(),
    action: 'end-coach-link',
    id: link.id,
    revision: link.revision,
  })
</script>
<template>
  <section class="form-stack coaching-team" aria-labelledby="supporting-coaches-heading">
    <SectionHeader
      id="supporting-coaches-heading"
      :title="l('Supporting coaches', 'المدربون المساندون')"
      :description="
        l(
          'Choose a coach to add them immediately. If they cover several eligible specialties, choose their access scope. Nutrition and participation status remain with the primary coach.',
          'اختر مدرباً لإضافته مباشرة. إذا كان يغطي عدة تخصصات مؤهلة، اختر نطاق صلاحياته. تبقى التغذية وحالة المشاركة لدى المدرب الأساسي.',
        )
      "
    />
    <CommandStatus :command="command" />
    <p v-if="!supporting.length" class="small-print">{{ l('None yet.', 'لا يوجد بعد.') }}</p>
    <ul v-else class="coaching-links">
      <li v-for="link in supporting" :key="link.id">
        <span dir="auto"
          ><strong>{{ nameOf(link.coach) }}</strong> · {{ sportOf(link.sport) }}</span
        ><button
          type="button"
          class="text-link danger-action"
          :disabled="locked"
          :aria-label="l('Remove supporting coach ', 'إزالة المدرب المساند ') + nameOf(link.coach)"
          @click="remove(link)"
        >
          {{ l('Remove', 'إزالة') }}
        </button>
      </li>
    </ul>
    <form class="form-stack" @submit.prevent>
      <fieldset class="command-fields" :disabled="locked">
        <details>
          <summary>{{ l('Filter coaches', 'تصفية المدربين') }}</summary>
          <label
            >{{ l('Sport or specialty they cover', 'الرياضة أو التخصص الذي يغطيه')
            }}<select v-model="filter">
              <option value="">
                {{ l('All sports and specialties', 'كل الرياضات والتخصصات') }}
              </option>
              <option v-for="s in choices" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select></label
          >
        </details>
        <MemberPicker
          :sport="filter"
          :institution="institutionId"
          view="admin"
          role="trainer"
          single
          :label="l('Add a supporting coach', 'إضافة مدرب مساند')"
          :model-value="coach ? [coach] : []"
          :exclude-ids="[
            member.id,
            ...(member.trainer_id ? [member.trainer_id] : []),
            ...supporting.map((c) => c.coach),
          ]"
          @options="candidates = $event"
          @update:model-value="selectCoach"
          ><template #default="{ member: person }"
            ><small style="display: block; color: var(--muted)">{{
              (person.sports || [])
                .map((id) => sports.find((s) => s.id === id)?.name)
                .filter(Boolean)
                .join(' · ')
            }}</small></template
          ></MemberPicker
        >
        <p v-if="!choices.length" class="small-print">
          {{
            l(
              'Link this athlete to a sport first, or add a coaching specialty in Institution settings.',
              'اربط هذا الرياضي برياضة أولاً، أو أضف تخصصاً تدريبياً من إعدادات المؤسسة.',
            )
          }}
        </p>
        <label v-if="coach && scopes.length > 1"
          >{{ l('Access scope', 'نطاق الصلاحيات')
          }}<select v-model="sport" @change="add">
            <option value="" disabled>
              {{ l('Choose a scope to add this coach', 'اختر النطاق لإضافة المدرب') }}
            </option>
            <option v-for="scope in scopes" :key="scope.id" :value="scope.id">
              {{ scope.name }}
            </option>
          </select></label
        >
        <p v-if="coach && !scopes.length" class="small-print">
          {{
            l(
              'This coach has no eligible sport or specialty in common. Update their specialties or choose another coach.',
              'لا يوجد نطاق رياضي أو تخصص مؤهل لهذا المدرب. حدّث تخصصاته أو اختر مدرباً آخر.',
            )
          }}
        </p>
      </fieldset>
    </form>
  </section>
</template>
<style scoped>
.coaching-team h2 {
  margin-top: 0;
  font-size: 1.1rem;
}
.coaching-links {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 8px;
}
.coaching-links li {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 6px 12px;
  min-width: 0;
}
.coaching-links span {
  overflow-wrap: anywhere;
}
.coaching-team fieldset {
  border: 0;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 12px;
}
</style>
