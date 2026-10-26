<script setup lang="ts">
import SectionHeader from '../../components/SectionHeader.vue'
import { computed, ref, watch, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { request } from '../../lib/backend'
import { language as l } from '../../lib/i18n'
import { refreshContexts, contexts } from '../../app/auth'
import { useCommand } from '../../lib/commands'
import CommandStatus from '../../components/CommandStatus.vue'
import MemberPicker from './MemberPicker.vue'
import MemberSports from './MemberSports.vue'
import CoachingTeam from './CoachingTeam.vue'
import type { Member, Role, Sport } from './types'
const props = defineProps<{
  institutionId: string
  member: Member
  sports: Sport[]
  names: { id: string; name: string }[]
}>()
const emit = defineEmits<{ saved: [] }>()
const editRoles = ref<Role[]>([]),
  active = ref(true),
  trainer = ref(''),
  displayName = ref(''),
  passwordLink = ref('')
const roleName = (r: string) =>
  l(
    { admin: 'Administrator', trainer: 'Coach', trainee: 'Athlete' }[r] || r,
    { admin: 'مسؤول', trainer: 'مدرب', trainee: 'رياضي' }[r] || r,
  )
watch(
  () => props.member,
  (m, old) => {
    if (!old || old.id !== m.id || editRoles.value.join() === old.roles.join())
      editRoles.value = [...m.roles]
    if (!old || old.id !== m.id || active.value === old.active) active.value = m.active
    if (!old || old.id !== m.id || trainer.value === (old.trainer_id || ''))
      trainer.value = m.trainer_id || ''
    if (!old || old.id !== m.id || displayName.value === old.name) displayName.value = m.name
  },
  { immediate: true },
)

const router = useRouter()
let mounted = true
onUnmounted(() => (mounted = false))
const command = useCommand<'member'>(
  'member-management:' + props.institutionId + ':' + props.member.id,
  async (_, __, args) => {
    if (!mounted) return
    if (args.action === 'password-link')
      passwordLink.value = location.origin + '/password-setup/' + args.token
    await refreshContexts()
    if (!mounted) return
    if (
      !contexts.value.some((c) => c.institution_id === props.institutionId && c.role === 'admin')
    ) {
      await router.replace('/access')
      return
    }
    emit('saved')
  },
  (_, args) => request('/v1/institution', { method: 'POST', body: JSON.stringify(args) }),
  {
    successMessage: (_, args) =>
      args.action === 'password-link'
        ? l('Password setup link created.', 'تم إنشاء رابط إعداد كلمة المرور.')
        : l('Member details updated.', 'تم تحديث بيانات العضو.'),
  },
)
const locked = computed(() => command.state.busy || !!command.state.pending || !command.state.ready)
const run = (args: Record<string, unknown>) =>
  command.run('member', { operation: crypto.randomUUID(), ...args })
function selectPrimary(ids: string[]) {
  const selected = ids[0] || ''
  if (locked.value || selected === (props.member.trainer_id || '')) return
  trainer.value = selected
  void run({
    action: 'assign-trainer',
    id: props.member.id,
    revision: props.member.revision,
    trainer: selected || null,
  })
}
function resetPassword() {
  const token = [...crypto.getRandomValues(new Uint8Array(32))]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('')
  void run({ action: 'password-link', id: props.member.id, token })
}
</script>
<template>
  <div class="member-management">
    <CommandStatus :command="command" />
    <div v-if="passwordLink" class="notice success">
      <label
        >{{ l('Private password setup link (24 hours)', 'رابط خاص لإعداد كلمة المرور (٢٤ ساعة)')
        }}<input
          :value="passwordLink"
          readonly
          @focus="($event.target as HTMLInputElement).select()"
      /></label>
    </div>
    <fieldset class="command-fields management-grid" :disabled="locked">
      <form
        class="form-stack panel management-card identity-card"
        @submit.prevent="
          run({
            action: 'member',
            id: member.id,
            revision: member.revision,
            roles: editRoles,
            name: displayName,
            active,
          })
        "
      >
        <h2>{{ l('Identity and access', 'الهوية والوصول') }}</h2>
        <label
          >{{ l('Display name', 'الاسم المعروض')
          }}<input v-model="displayName" required maxlength="120" autocomplete="name"
        /></label>
        <fieldset class="role-choices">
          <legend>{{ l('Institution roles', 'أدوار المؤسسة') }}</legend>
          <label
            v-for="role in ['admin', 'trainer', 'trainee'] as Role[]"
            :key="role"
            class="role-button"
            :class="{ selected: editRoles.includes(role) }"
            ><input
              type="radio"
              :name="'membership-role-' + member.id"
              :checked="editRoles.includes(role)"
              @change="editRoles = [role]"
            />{{ roleName(role) }}</label
          >
        </fieldset>
        <label class="check-label"
          ><input type="checkbox" v-model="active" />{{
            l('Active membership', 'عضوية نشطة')
          }}</label
        >
        <p
          v-if="!active || (!editRoles.includes('trainer') && member.roles.includes('trainer'))"
          class="notice"
        >
          {{
            l(
              'Any assigned athletes will need a new coach. Their institution records remain available. Access ends immediately when membership is deactivated.',
              'سيحتاج الرياضيون المعيّنون إلى مدرب جديد. تبقى سجلاتهم بالمؤسسة. ينتهي الوصول فور إلغاء تنشيط العضوية.',
            )
          }}
        </p>
        <button class="button" :disabled="!editRoles.length">
          {{ l('Save membership', 'حفظ العضوية') }}
        </button>
      </form>
      <form
        v-if="member.active && member.roles.includes('trainee')"
        class="form-stack panel management-card primary-coach-card"
        @submit.prevent
      >
        <SectionHeader
          :title="l('Primary coach', 'المدرب الأساسي')"
          :description="
            l(
              'Responsible for ongoing follow-up, nutrition and participation status. Search the full coaching directory below.',
              'مسؤول عن المتابعة والتغذية وحالة المشاركة. ابحث في دليل المدربين الكامل أدناه.',
            )
          "
        />
        <MemberPicker
          :institution="institutionId"
          view="admin"
          role="trainer"
          single
          :label="l('Choose primary coach', 'اختيار المدرب الأساسي')"
          inline-selection
          :model-value="trainer ? [trainer] : []"
          :exclude-ids="[member.id]"
          @update:model-value="selectPrimary"
          ><template #default="{ member: coach }"
            ><small class="coach-specialties">{{
              (coach.sports || [])
                .map((id) => sports.find((s) => s.id === id)?.name)
                .filter(Boolean)
                .join(' · ') ||
              l('No sports or specialties listed', 'لا توجد رياضات أو تخصصات مسجلة')
            }}</small></template
          ></MemberPicker
        >
      </form>
      <div
        v-if="member.active && member.roles.includes('trainee')"
        class="panel management-card supporting-coach-card"
      >
        <CoachingTeam
          v-if="member.active && member.roles.includes('trainee')"
          :institution-id="institutionId"
          :member="member"
          :sports="sports"
          :names="names"
          @saved="emit('saved')"
        />
      </div>

      <div
        v-if="member.active && !member.roles.includes('admin')"
        class="panel management-card sports-card"
      >
        <MemberSports
          v-if="member.active && !member.roles.includes('admin')"
          :institution-id="institutionId"
          :member="member"
          :sports="sports"
          @saved="emit('saved')"
        />
      </div>

      <div
        v-if="member.user_id && member.active"
        class="form-stack panel management-card recovery-card"
      >
        <h2>{{ l('Account recovery', 'استعادة الحساب') }}</h2>
        <p class="small-print">
          {{
            l(
              'Issue a single-use, 24-hour link so this person can choose a new password. Existing sessions will be signed out when it is used.',
              'أصدر رابطاً لمرة واحدة صالحاً ٢٤ ساعة ليختار هذا الشخص كلمة مرور جديدة. ستُنهى الجلسات الحالية عند استخدامه.',
            )
          }}
        </p>
        <button type="button" class="button secondary" :disabled="locked" @click="resetPassword">
          {{ l('Create password setup link', 'إنشاء رابط إعداد كلمة المرور') }}
        </button>
      </div>
    </fieldset>
  </div>
</template>
<style scoped>
.management-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
  padding: 0;
  border: 0;
  margin: 0;
}
.management-card {
  min-width: 0;
  height: 100%;
  margin: 0;
}
.identity-card {
  grid-column: 1 / -1;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-content: start;
  align-items: start;
}
.identity-card > h2,
.identity-card > .notice {
  grid-column: 1 / -1;
}
.identity-card > .button {
  justify-self: end;
}
.management-card h2 {
  margin-top: 0;
  font-size: 1.1rem;
}
.member-management .management-card {
  margin: 0;
  align-content: start;
}
.role-choices {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  border: 0;
  padding: 0;
}
.role-choices legend {
  margin-bottom: 8px;
}
.role-button {
  position: relative;
  padding: 10px 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  cursor: pointer;
  background: var(--surface-soft);
}
.role-button.selected {
  background: var(--accent);
  color: var(--on-accent);
  border-color: var(--accent);
}
.role-button:focus-within {
  outline: 2px solid var(--ink);
  outline-offset: 3px;
}
.role-button input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}
.coach-specialties {
  display: block;
  color: var(--muted);
  font-weight: normal;
}
@media (max-width: 800px) {
  .management-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .identity-card {
    grid-template-columns: minmax(0, 1fr);
  }
  .identity-card > .button {
    justify-self: start;
  }
}
.member-management fieldset {
  min-width: 0;
}
.member-management input:not([type='radio']):not([type='checkbox']) {
  width: 100%;
}
</style>
