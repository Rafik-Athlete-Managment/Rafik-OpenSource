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
  <section class="workout-rule-settings" :aria-label="l('Scheduling policy', 'سياسة الجدولة')">
    <div class="heading-actions">
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
      <button class="button secondary" :disabled="locked" @click="edit">
        {{
          current
            ? l('Change future scheduling', 'تغيير الجدولة القادمة')
            : l('Set up scheduling', 'إعداد الجدولة')
        }}
      </button>
    </div>
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
      <p v-if="!current" class="small-print">
        {{
          l(
            'Manual scheduling. Automatic preparation is off.',
            'جدولة يدوية. التجهيز التلقائي غير مفعّل.',
          )
        }}
      </p>
      <template v-else
        ><p>
          <strong>{{
            current.local_time
              ? l('Weekly appointments', 'مواعيد أسبوعية')
              : l('Automatic daily preparation', 'تجهيز يومي تلقائي')
          }}</strong>
          · {{ current.starts_on.slice(0, 10) }} – {{ current.ends_on.slice(0, 10) }} ·
          {{ current.timezone }}
        </p>
        <p v-if="current.issue" class="small-print" role="status">{{ issue(current.issue) }}</p>
        <button
          class="button small secondary danger-action"
          :disabled="locked"
          @click="submit(true)"
        >
          {{ l('Stop future scheduling', 'إيقاف الجدولة القادمة') }}
        </button></template
      >
    </PageState>
    <form v-if="editing" class="form-stack rule-form" @submit.prevent="submit()">
      <fieldset :disabled="locked" class="form-stack">
        <legend>{{ l('Scheduling method', 'طريقة الجدولة') }}</legend>
        <div class="role-choices">
          <label
            ><input type="radio" v-model="mode" value="weekly" />{{
              l('Weekly appointments', 'مواعيد أسبوعية')
            }}</label
          ><label
            ><input type="radio" v-model="mode" value="automatic" />{{
              l('Automatic daily preparation', 'تجهيز يومي تلقائي')
            }}</label
          >
        </div>
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
        <template v-if="mode === 'weekly'"
          ><fieldset class="rule-weekdays">
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
          <div class="rule-fields">
            <label
              >{{ l('Local time', 'الوقت المحلي')
              }}<input type="time" v-model="time" required /></label
            ><label
              >{{ l('Duration (minutes)', 'المدة (دقيقة)')
              }}<input type="number" min="1" max="480" step="1" v-model.number="minutes" required
            /></label></div
        ></template>
        <p v-else class="small-print">
          {{
            l(
              'Prepares today’s next workout without a clock time. Recovery days follow the published cycle, anchored to the plan start. Cannot-train restrictions still apply.',
              'يجهّز تمرين اليوم التالي دون وقت محدد. تتبع أيام التعافي الدورة المنشورة بدءاً من تاريخ الخطة. تظل قيود منع التدريب سارية.',
            )
          }}
        </p>
        <p class="small-print">
          {{
            l(
              'Updates within about a minute; refresh workouts to see prepared work. Unfinished work blocks only this plan. Changes and stopping apply to subsequent work; reschedule or skip the existing workout separately. No missed dates are backfilled.',
              'يُحدّث خلال نحو دقيقة؛ حدّث التمارين لرؤية العمل المجهّز. يمنع العمل غير المكتمل هذه الخطة وحدها. تطبق التغييرات والإيقاف على العمل اللاحق؛ أعد جدولة التمرين الحالي أو تخطه منفصلاً. لا تُنشأ تمارين للتواريخ الفائتة.',
            )
          }}
        </p>
        <div class="actions">
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
  border-block-start: 1px solid var(--line);
  padding-block: var(--space-5);
}
.workout-rule-settings h2 {
  font-size: var(--text-section);
}
.rule-form {
  border-block-start: 1px solid var(--line);
  padding-block-start: var(--space-4);
}
.rule-fields {
  display: flex;
  align-items: end;
  flex-wrap: wrap;
  gap: var(--space-4);
}
.rule-fields > * {
  flex: 1 1 180px;
  min-width: 0;
}
.rule-weekdays {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}
.rule-weekdays label {
  flex: 0 0 auto;
  min-inline-size: max-content;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.rule-form fieldset {
  border: 0;
  padding: 0;
  margin: 0;
  min-inline-size: 0;
}
.rule-weekdays input {
  flex: none;
  inline-size: 1.1rem;
  block-size: 1.1rem;
}
.rule-weekdays legend {
  margin-block-end: var(--space-3);
  padding: 0;
}
</style>
