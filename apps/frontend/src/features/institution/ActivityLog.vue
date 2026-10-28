<script setup lang="ts">
import { computed } from 'vue'
import {
  PhUsers,
  PhCalendarBlank,
  PhBarbell,
  PhChatCircle,
  PhGear,
  PhHeartbeat,
  PhBowlFood,
  PhClockCounterClockwise,
} from '@phosphor-icons/vue'
import { language as l, dateLabel, locale } from '../../lib/i18n'
import type { Institution } from './types'

const props = defineProps<{ data: Institution; loading: boolean }>()
defineEmits<{ more: [] }>()

type Category =
  'people' | 'schedule' | 'training' | 'messages' | 'settings' | 'health' | 'nutrition'
// Audit kinds written by the server, in plain words. Unknown kinds fall back to a readable form.
const kinds: Record<string, [Category, string, string]> = {
  member_invited: ['people', 'Invitation created', 'إنشاء دعوة'],
  invitation_revoked: ['people', 'Invitation revoked', 'إلغاء دعوة'],
  member_joined: ['people', 'Member joined', 'انضمام عضو'],
  member_password_setup_issued: [
    'people',
    'Password setup link issued',
    'إصدار رابط تعيين كلمة المرور',
  ],
  trainer_assigned: ['people', 'Primary coach updated', 'تحديث المدرب الأساسي'],
  coach_linked: ['people', 'Supporting coach added', 'إضافة مدرب مساند'],
  coach_link_ended: ['people', 'Supporting coach removed', 'إزالة مدرب مساند'],
  member_roles_changed: ['people', 'Member role updated', 'تحديث دور العضو'],
  member_removed: ['people', 'Membership deactivated', 'إلغاء تنشيط عضوية'],
  member_sports_changed: ['people', 'Member sports updated', 'تحديث رياضات العضو'],
  organization_created: ['settings', 'Institution created', 'إنشاء المؤسسة'],
  organization_renamed: ['settings', 'Institution renamed', 'تغيير اسم المؤسسة'],
  organization_closed: ['settings', 'Institution closed', 'إغلاق المؤسسة'],
  sport_updated: ['settings', 'Sport or specialty updated', 'تحديث رياضة أو تخصص'],
  group_updated: ['settings', 'Group updated', 'تحديث مجموعة'],
  assessment_template_updated: ['settings', 'Assessment template updated', 'تحديث قالب تقييم'],
  exercise_updated: ['training', 'Exercise updated', 'تحديث تمرين'],
  program_saved: ['training', 'Program draft saved', 'حفظ مسودة برنامج'],
  program_published: ['training', 'Program published', 'نشر برنامج'],
  program_assigned: ['training', 'Program assigned', 'تعيين برنامج'],
  athlete_plan_adapted: ['training', 'Athlete plan adapted', 'تعديل خطة رياضي'],
  assignment_ended: ['training', 'Athlete plan ended', 'إنهاء خطة رياضي'],
  workout_scheduled: ['training', 'Workout scheduled', 'جدولة تمرين'],
  workout_rescheduled: ['training', 'Workout rescheduled', 'إعادة جدولة تمرين'],
  workout_skipped: ['training', 'Workout skipped', 'تخطي تمرين'],
  workout_cancelled: ['training', 'Workout cancelled', 'إلغاء تمرين'],
  workout_paused: ['training', 'Workout paused', 'إيقاف تمرين مؤقتاً'],
  workout_resolved: ['training', 'Workout completed', 'إكمال تمرين'],
  workout_rule_saved: ['training', 'Automatic preparation saved', 'حفظ التحضير التلقائي'],
  workout_rule_stopped: ['training', 'Automatic preparation stopped', 'إيقاف التحضير التلقائي'],
  session_note_recorded: ['training', 'Session note recorded', 'تسجيل ملاحظة جلسة'],
  feedback_recorded: ['training', 'Session feedback recorded', 'تسجيل تقييم جلسة'],
  calendar_scheduled: ['schedule', 'Event scheduled', 'جدولة موعد'],
  calendar_rescheduled: ['schedule', 'Event rescheduled', 'إعادة جدولة موعد'],
  calendar_cancelled: ['schedule', 'Event cancelled', 'إلغاء موعد'],
  calendar_completed: ['schedule', 'Event completed', 'إكمال موعد'],
  calendar_staff_reassigned: ['schedule', 'Event staff reassigned', 'إعادة تعيين طاقم الموعد'],
  attendance_recorded: ['schedule', 'Attendance recorded', 'تسجيل حضور'],
  assessment_result_recorded: ['schedule', 'Assessment result recorded', 'تسجيل نتيجة تقييم'],
  conversation_created: ['messages', 'Conversation started', 'بدء محادثة'],
  conversation_joined: ['messages', 'Conversation joined', 'الانضمام إلى محادثة'],
  conversation_admin_joined: [
    'messages',
    'Administrator joined a conversation',
    'انضمام مسؤول إلى محادثة',
  ],
  conversation_participants_changed: [
    'messages',
    'Conversation participants changed',
    'تغيير المشاركين في محادثة',
  ],
  injury_consent_configured: [
    'health',
    'Injury-status consent set up',
    'إعداد موافقة حالة الإصابة',
  ],
  injury_athlete_assented: [
    'health',
    'Athlete agreed to injury-status sharing',
    'موافقة الرياضي على مشاركة حالة الإصابة',
  ],
  injury_consent_withdrawn: [
    'health',
    'Injury-status consent withdrawn',
    'سحب موافقة حالة الإصابة',
  ],
  nutrition_plan_published: ['nutrition', 'Nutrition plan published', 'نشر خطة تغذية'],
  nutrition_sharing_changed: ['nutrition', 'Nutrition sharing changed', 'تغيير مشاركة التغذية'],
}
const icons = {
  people: PhUsers,
  schedule: PhCalendarBlank,
  training: PhBarbell,
  messages: PhChatCircle,
  settings: PhGear,
  health: PhHeartbeat,
  nutrition: PhBowlFood,
}
function describe(kind: string) {
  const known = kinds[kind]
  if (known) return { icon: icons[known[0]], label: l(known[1], known[2]) }
  const words = kind.replace(/_/g, ' ')
  const prefix = kind.split('_')[0]
  return {
    icon:
      prefix === 'conversation'
        ? PhChatCircle
        : prefix === 'program' || prefix === 'workout'
          ? PhBarbell
          : PhClockCounterClockwise,
    label: l(words.charAt(0).toUpperCase() + words.slice(1), 'تحديث في المؤسسة'),
  }
}
function memberName(id: unknown) {
  if (typeof id !== 'string') return ''
  return props.data.members.find((m) => m.id === id || m.user_id === id)?.name || ''
}
const time = (value: string) =>
  new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
// Newest first, grouped under one heading per calendar day.
const days = computed(() => {
  const groups: {
    day: string
    items: (Institution['events'][number] & {
      icon: unknown
      label: string
      actor: string
      subject: string
    })[]
  }[] = []
  for (const event of props.data.events) {
    const day = dateLabel(event.created_at)
    let group = groups.at(-1)
    if (!group || group.day !== day) groups.push((group = { day, items: [] }))
    const { icon, label } = describe(event.kind)
    const actor = event.actor_name || memberName(event.actor_id)
    const subject =
      event.subject_name ||
      memberName(event.subject_id) ||
      memberName((event.detail as { member?: unknown })?.member)
    group.items.push({ ...event, icon, label, actor, subject: subject === actor ? '' : subject })
  }
  return groups
})
</script>
<template>
  <section
    class="activity-log"
    :aria-label="l('Recent institution changes', 'تغييرات المؤسسة الأخيرة')"
  >
    <div v-if="!data.events.length" class="empty-state panel">
      <PhClockCounterClockwise :size="28" aria-hidden="true" />
      <h2>{{ l('No changes recorded yet', 'لا تغييرات مسجلة بعد') }}</h2>
      <p>
        {{
          l(
            'Invitations, membership, scheduling and configuration changes appear here.',
            'تظهر هنا الدعوات والعضوية والجدولة وتغييرات الإعدادات.',
          )
        }}
      </p>
    </div>
    <section v-for="group in days" :key="group.day" class="activity-day">
      <h2>{{ group.day }}</h2>
      <ol>
        <li v-for="event in group.items" :key="event.id" class="activity-item">
          <span class="activity-icon"
            ><component :is="event.icon" :size="18" aria-hidden="true"
          /></span>
          <span class="activity-text">
            <strong>{{ event.label }}</strong>
            <small v-if="event.subject || event.actor">
              <bdi v-if="event.subject" dir="auto">{{ event.subject }}</bdi
              ><template v-if="event.subject && event.actor"> · </template
              ><template v-if="event.actor"
                >{{ l('by ', 'بواسطة ') }}<bdi dir="auto">{{ event.actor }}</bdi></template
              >
            </small>
          </span>
          <time :datetime="event.created_at">{{ time(event.created_at) }}</time>
        </li>
      </ol>
    </section>
    <button
      v-if="data.eventsNext !== null"
      type="button"
      class="button secondary"
      :disabled="loading"
      @click="$emit('more')"
    >
      {{ l('Show earlier activity', 'عرض نشاط أقدم') }}
    </button>
  </section>
</template>
<style scoped>
.activity-log {
  display: grid;
  gap: var(--space-6);
  justify-items: start;
}
.activity-log > * {
  width: 100%;
}
.activity-log > .button {
  width: auto;
}
.activity-day h2 {
  margin: 0 0 var(--space-2);
  font-size: var(--text-small);
  font-weight: 650;
  color: var(--muted);
}
.activity-day ol {
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--line);
  border-radius: var(--radius-panel);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}
.activity-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
}
.activity-item + .activity-item {
  border-top: 1px solid var(--line);
}
.activity-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 999px;
  background: var(--tint);
  color: var(--accent);
}
.activity-text {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.activity-text strong {
  font-size: var(--text-small);
  font-weight: 600;
}
.activity-text small {
  color: var(--muted);
  overflow-wrap: anywhere;
}
.activity-item time {
  color: var(--muted);
  font-size: var(--text-caption);
  font-variant-numeric: tabular-nums;
}
</style>
