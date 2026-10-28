<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { profile } from '../../app/auth'
import { institutionContext } from '../../app/institution'
import { request } from '../../lib/backend'
import { localDate, addDays } from '../../lib/dates'
import { language as l, errorMessage } from '../../lib/i18n'
import { useCommand } from '../../lib/commands'
import CommandStatus from '../../components/CommandStatus.vue'
import PageState from '../../components/PageState.vue'
import TimezonePicker from '../../components/TimezonePicker.vue'
import {
  PhCalendarCheck,
  PhCalendarPlus,
  PhHandPointing,
  PhInfo,
  PhLightning,
} from '@phosphor-icons/vue'
const props = defineProps<{ assignment: string; startsOn: string; endsOn: string | null }>()
const emit = defineEmits<{ changed: [] }>()
const context = institutionContext()
type Rule = {
  id: string
  revision: number
  state: string
  starts_on: string
  ends_on: string
  timezone: string
  weekdays: number[]
  local_time: string | null
  duration_minutes: number | null
  issue: string | null
  last_generated_on: string | null
}
const rules = ref<Rule[]>([]),
  loading = ref(true),
  error = ref(''),
  editing = ref(false),
  mode = ref('weekly'),
  zone = ref(profile.value?.timezone || 'UTC')
const start = ref([props.startsOn, localDate(zone.value)].sort().at(-1)!),
  end = ref([props.endsOn || addDays(start.value, 27), addDays(start.value, 27)].sort()[0]),
  weekdays = ref<number[]>([1, 3, 5]),
  time = ref('09:00'),
  minutes = ref(60)
const enabled = ref(true)
const current = computed(() => rules.value.find((r) => r.state === 'active'))
let disposed = false
onUnmounted(() => {
  disposed = true
})
async function load() {
  loading.value = true
  error.value = ''
  try {
    const result = await request<{ items: Rule[]; scheduler_enabled: boolean }>(
      `/v1/institution/workout-rules?view=${context.view}&assignment=${props.assignment}`,
      { feedback: 'none' },
    )
    if (!disposed) {
      rules.value = result.items
      enabled.value = result.scheduler_enabled
    }
  } catch (e) {
    if (!disposed) error.value = errorMessage(e)
  } finally {
    if (!disposed) loading.value = false
  }
}
const command = useCommand(
  `workout-rule:${context.institution}:${props.assignment}`,
  async () => {
    if (!disposed) {
      editing.value = false
      await load()
      if (!disposed) emit('changed')
    }
  },
  (_, args) =>
    request('/v1/institution/workout-rules', { method: 'POST', body: JSON.stringify(args) }),
  {
    successMessage: (name) =>
      name === 'stop'
        ? l(
            'Automatic scheduling stopped. Existing workouts are unchanged.',
            'توقفت الجدولة التلقائية. لم تتغير التمارين الحالية.',
          )
        : l('Scheduling rule saved.', 'حُفظت قاعدة الجدولة.'),
  },
)
const locked = computed(
  () => !command.state.ready || command.state.busy || !!command.state.pending || loading.value,
)
function edit() {
  const r = current.value
  if (r) {
    mode.value = r.local_time ? 'weekly' : 'automatic'
    start.value = r.starts_on.slice(0, 10)
    end.value = r.ends_on.slice(0, 10)
    zone.value = r.timezone
    weekdays.value = r.weekdays
    time.value = r.local_time?.slice(11, 16) || '09:00'
    minutes.value = r.duration_minutes || 60
  }
  editing.value = true
}
function submit(stop = false) {
  void command.run(stop ? 'stop' : 'save', {
    operation: crypto.randomUUID(),
    action: stop ? 'stop-workout-rule' : 'set-workout-rule',
    view: context.view,
    assignment_id: props.assignment,
    rule_id: current.value?.id || null,
    revision: current.value?.revision || null,
    ...(!stop
      ? {
          mode: mode.value,
          starts_on: start.value,
          ends_on: end.value,
          timezone: zone.value,
          ...(mode.value === 'weekly'
            ? { weekdays: weekdays.value, local_time: time.value, duration_minutes: minutes.value }
            : {}),
        }
      : {}),
  })
}
const issue = (value: string) =>
  (
    ({
      previous_workout_unresolved: l(
        'Waiting for the existing workout to be completed or explicitly skipped.',
        'بانتظار إكمال التمرين الحالي أو تخطيه صراحةً.',
      ),
      time_unavailable: l(
        'This appointment conflicts with an existing booking. Change its time or resolve the booking.',
        'يتعارض الموعد مع حجز قائم. غيّر الوقت أو راجع الحجز.',
      ),
      rest_day: l(
        'Recovery day: no automatic workout prepared.',
        'يوم تعافٍ: لم يُجهّز تمرين تلقائي.',
      ),
      waiting_for_day: l('Waiting for the next eligible day.', 'بانتظار اليوم المؤهل التالي.'),
      participation_unavailable: l(
        'Preparation is blocked by the current participation restriction.',
        'التجهيز متوقف بسبب قيد المشاركة الحالي.',
      ),
      ambiguous_local_time: l(
        'This time occurs twice because of daylight saving. Choose another time.',
        'يتكرر هذا الوقت بسبب التوقيت الصيفي. اختر وقتاً آخر.',
      ),
      nonexistent_local_time: l(
        'This local time does not exist because of daylight saving. Choose another time.',
        'لا يوجد هذا الوقت المحلي بسبب التوقيت الصيفي. اختر وقتاً آخر.',
      ),
      scheduling_authority_unavailable: l(
        'The rule owner no longer has scheduling access. Save a new rule with authorized staff.',
        'لم يعد منشئ القاعدة مخوّلاً بالجدولة. احفظ قاعدة جديدة بحساب موظف مخوّل.',
      ),
      scheduling_window_ended: l('The scheduling period has ended.', 'انتهت فترة الجدولة.'),
    }) as Record<string, string>
  )[value] ||
  l(
    'Scheduling needs attention. Review the rule and calendar, then retry on the next poll.',
    'تحتاج الجدولة إلى مراجعة. راجع القاعدة والتقويم ثم انتظر المحاولة التالية.',
  )
onMounted(load)
</script>
<template>
  <section
    class="workout-rule-settings panel"
    :aria-label="l('Scheduling policy', 'سياسة الجدولة')"
  >
    <header class="rule-header">
      <div>
        <h2>{{ l('Plan scheduling', 'جدولة الخطة') }}</h2>
        <p class="small-print">
          {{
            l(
              'Schedule weekly appointments or opt this plan into daily workout preparation. Each plan progresses independently.',
              'جدول مواعيد أسبوعية أو فعّل تجهيز التمارين اليومية لهذه الخطة. تتقدم كل خطة بشكل مستقل.',
            )
          }}
        </p>
      </div>
      <button v-if="!editing" class="button secondary small" :disabled="locked" @click="edit">
        <PhCalendarPlus :size="18" aria-hidden="true" />{{
          current
            ? l('Change future scheduling', 'تغيير الجدولة القادمة')
            : l('Set up scheduling', 'إعداد الجدولة')
        }}
      </button>
    </header>
    <CommandStatus :command="command" />
    <p v-if="!enabled" class="notice" role="status">
      {{
        l(
          'Automatic preparation is paused by the server operator. Saved rules will run when it is enabled.',
          'أوقف مشغّل الخادم التجهيز التلقائي. تُنفذ القواعد المحفوظة عند تفعيله.',
        )
      }}
    </p>
    <PageState :loading="loading && !rules.length" :error="error" @retry="load">
      <!-- Current policy as one status line. -->
      <div class="rule-status">
        <span class="rule-status-icon" :data-active="!!current"
          ><component
            :is="current ? (current.local_time ? PhCalendarCheck : PhLightning) : PhHandPointing"
            :size="18"
            aria-hidden="true"
        /></span>
        <p v-if="!current" class="rule-status-text">
          {{
            l(
              'Manual scheduling. Automatic preparation is off.',
              'جدولة يدوية. التجهيز التلقائي غير مفعّل.',
            )
          }}
        </p>
        <template v-else
          ><div class="rule-status-text">
            <p>
              <strong>{{
                current.local_time
                  ? l('Weekly appointments', 'مواعيد أسبوعية')
                  : l('Automatic daily preparation', 'تجهيز يومي تلقائي')
              }}</strong>
              · {{ current.starts_on.slice(0, 10) }} – {{ current.ends_on.slice(0, 10) }} ·
              {{ current.timezone }}
            </p>
            <p v-if="current.issue" class="small-print" role="status">{{ issue(current.issue) }}</p>
          </div>
          <button class="text-link danger-action" :disabled="locked" @click="submit(true)">
            {{ l('Stop future scheduling', 'إيقاف الجدولة القادمة') }}
          </button></template
        >
      </div>
    </PageState>
    <form v-if="editing" class="rule-form" @submit.prevent="submit()">
      <fieldset :disabled="locked" class="rule-form-body">
        <legend class="sr-only">{{ l('Scheduling setup', 'إعداد الجدولة') }}</legend>
        <fieldset class="rule-group">
          <legend>{{ l('Scheduling method', 'طريقة الجدولة') }}</legend>
          <div class="rule-methods">
            <label class="rule-method"
              ><input
                type="radio"
                v-model="mode"
                value="weekly"
                :aria-label="l('Weekly appointments', 'مواعيد أسبوعية')"
                aria-describedby="rule-method-weekly"
              /><PhCalendarCheck :size="22" aria-hidden="true" /><span
                ><strong>{{ l('Weekly appointments', 'مواعيد أسبوعية') }}</strong
                ><small id="rule-method-weekly">{{
                  l('Fixed days and a start time each week.', 'أيام ثابتة ووقت بدء كل أسبوع.')
                }}</small></span
              ></label
            ><label class="rule-method"
              ><input
                type="radio"
                v-model="mode"
                value="automatic"
                :aria-label="l('Automatic daily preparation', 'تجهيز يومي تلقائي')"
                aria-describedby="rule-method-automatic"
              /><PhLightning :size="22" aria-hidden="true" /><span
                ><strong>{{ l('Automatic daily preparation', 'تجهيز يومي تلقائي') }}</strong
                ><small id="rule-method-automatic">{{
                  l(
                    'Prepares today’s next workout without a clock time. Recovery days follow the published cycle, anchored to the plan start. Cannot-train restrictions still apply.',
                    'يجهّز تمرين اليوم التالي دون وقت محدد. تتبع أيام التعافي الدورة المنشورة بدءاً من تاريخ الخطة. تظل قيود منع التدريب سارية.',
                  )
                }}</small></span
              ></label
            >
          </div>
        </fieldset>
        <fieldset class="rule-group">
          <legend>{{ l('Dates', 'التواريخ') }}</legend>
          <div class="rule-fields">
            <label
              >{{ l('From', 'من')
              }}<input
                type="date"
                v-model="start"
                :min="startsOn"
                :max="endsOn || undefined"
                required /></label
            ><label
              >{{ l('Until', 'حتى')
              }}<input
                type="date"
                v-model="end"
                :min="start"
                :max="[endsOn || addDays(start, 366), addDays(start, 366)].sort()[0]"
                required /></label
            ><TimezonePicker v-model="zone" :label="l('Timezone', 'المنطقة الزمنية')" />
          </div>
        </fieldset>
        <fieldset v-if="mode === 'weekly'" class="rule-group">
          <legend>{{ l('Weekly appointment', 'الموعد الأسبوعي') }}</legend>
          <fieldset class="rule-weekdays">
            <legend>{{ l('Repeat on', 'التكرار في') }}</legend>
            <label
              v-for="(label, i) in [
                l('Mon', 'الاثنين'),
                l('Tue', 'الثلاثاء'),
                l('Wed', 'الأربعاء'),
                l('Thu', 'الخميس'),
                l('Fri', 'الجمعة'),
                l('Sat', 'السبت'),
                l('Sun', 'الأحد'),
              ]"
              :key="i"
              ><input type="checkbox" v-model="weekdays" :value="i + 1" />{{ label }}</label
            >
          </fieldset>
          <div class="rule-fields rule-time">
            <label
              >{{ l('Local time', 'الوقت المحلي')
              }}<input type="time" v-model="time" required /></label
            ><label
              >{{ l('Duration (minutes)', 'المدة (دقيقة)')
              }}<input type="number" min="1" max="480" step="1" v-model.number="minutes" required
            /></label>
          </div>
        </fieldset>
        <p class="rule-note">
          <PhInfo :size="16" aria-hidden="true" />{{
            l(
              'Updates within about a minute; refresh workouts to see prepared work. Unfinished work blocks only this plan. Changes and stopping apply to subsequent work; reschedule or skip the existing workout separately. No missed dates are backfilled.',
              'يُحدّث خلال نحو دقيقة؛ حدّث التمارين لرؤية العمل المجهّز. يمنع العمل غير المكتمل هذه الخطة وحدها. تطبق التغييرات والإيقاف على العمل اللاحق؛ أعد جدولة التمرين الحالي أو تخطه منفصلاً. لا تُنشأ تمارين للتواريخ الفائتة.',
            )
          }}
        </p>
        <div class="rule-actions">
          <button class="button" :disabled="mode === 'weekly' && !weekdays.length">
            {{ l('Save scheduling', 'حفظ الجدولة') }}</button
          ><button type="button" class="button secondary danger-action" @click="editing = false">
            {{ l('Cancel', 'إلغاء') }}
          </button>
        </div>
      </fieldset>
    </form>
  </section>
</template>
<style scoped>
.workout-rule-settings {
  display: grid;
  gap: var(--space-4);
  margin: 0;
}
.rule-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}
.rule-header h2 {
  margin: 0;
  font-size: var(--text-panel);
}
.rule-header .small-print {
  margin: var(--space-1) 0 0;
  color: var(--muted);
  max-width: 65ch;
}
/* Current policy: icon, one line of state, optional stop action. */
.rule-status {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-control);
  background: var(--surface-soft);
}
.rule-status-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 34px;
  height: 34px;
  border-radius: 999px;
  background: var(--surface);
  color: var(--muted);
}
.rule-status-icon[data-active='true'] {
  background: var(--tint);
  color: var(--accent);
}
.rule-status-text {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: var(--text-small);
  overflow-wrap: anywhere;
}
.rule-status-text p {
  margin: 0;
}
.rule-form {
  border-block-start: 1px solid var(--line);
  padding-block-start: var(--space-5);
}
.rule-form fieldset {
  border: 0;
  padding: 0;
  margin: 0;
  min-inline-size: 0;
}
.rule-form-body {
  display: grid;
  gap: var(--space-6);
}
.rule-group {
  display: grid;
  gap: var(--space-3);
}
.rule-group > legend {
  margin-block-end: var(--space-3);
  font-weight: 650;
  font-size: var(--text-small);
}
/* Method choice as selectable cards. */
.rule-methods {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}
.rule-method {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: var(--space-3);
  margin: 0;
  padding: var(--space-4);
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--field);
  cursor: pointer;
  font-weight: 400;
}
/* The real radio covers the card invisibly, so clicks, keyboard and assistive tech all reach it. */
.rule-method input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}
.rule-method svg {
  color: var(--muted);
}
.rule-method span {
  display: grid;
  gap: var(--space-1);
}
.rule-method strong {
  font-size: var(--text-small);
}
.rule-method small {
  color: var(--muted);
  line-height: 1.45;
}
.rule-method:hover {
  border-color: var(--control-border);
}
.rule-method:has(input:checked) {
  border-color: var(--accent);
  background: var(--tint);
}
.rule-method:has(input:checked) svg {
  color: var(--accent);
}
.rule-method:has(input:focus-visible) {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}
/* Date/time fields share one aligned grid. */
.rule-fields {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: end;
  gap: var(--space-4);
}
.rule-fields > * {
  min-width: 0;
  margin: 0;
}
.rule-fields :deep(.timezone-picker > label) {
  margin-bottom: 7px;
  line-height: 1.5;
}
.rule-fields label > input {
  margin-top: 7px;
}
.rule-time {
  grid-template-columns: repeat(2, minmax(0, 220px));
}
/* Weekdays as toggle chips. */
.rule-weekdays {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.rule-weekdays legend {
  margin-block-end: var(--space-2);
  padding: 0;
  font-size: var(--text-small);
  color: var(--muted);
}
.rule-weekdays label {
  position: relative;
  display: inline-grid;
  place-items: center;
  min-width: 52px;
  min-height: 40px;
  padding: 0 var(--space-3);
  border: 1px solid var(--control-border);
  border-radius: 999px;
  background: var(--field);
  font-size: var(--text-small);
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.rule-weekdays input {
  position: absolute;
  opacity: 0;
  inset: 0;
  margin: 0;
  cursor: pointer;
}
.rule-weekdays label:has(input:checked) {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--on-accent);
}
.rule-weekdays label:has(input:focus-visible) {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}
.rule-note {
  display: flex;
  gap: var(--space-2);
  align-items: flex-start;
  margin: 0;
  color: var(--muted);
  font-size: var(--text-caption);
  line-height: 1.5;
}
.rule-note svg {
  flex: none;
  margin-block-start: 2px;
}
.rule-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}
.rule-actions .button {
  margin: 0;
}
@media (max-width: 700px) {
  .rule-methods,
  .rule-fields,
  .rule-time {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
