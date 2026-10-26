<script setup lang="ts">
import { institutionContext } from '../../app/institution'

import PageHeading from '../../components/PageHeading.vue'
import SessionNote from './SessionNote.vue'
import TimezonePicker from '../../components/TimezonePicker.vue'
import { computed, onMounted, ref, watch, nextTick, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { user } from '../../app/auth'
import { request } from '../../lib/backend'
import { getDraft, storeDraft, removeDraft } from '../../lib/storage'
import { language as l, errorMessage, locale } from '../../lib/i18n'
import { useCommand } from '../../lib/commands'
import CommandStatus from '../../components/CommandStatus.vue'
import MemberPicker from './MemberPicker.vue'
import PageState from '../../components/PageState.vue'
import type { EventDetail, EventPerson } from './service-types'
import type { Institution } from './types'
const route = useRoute(),
  id = institutionContext().institution,
  view = institutionContext().view,
  eid = String(route.params.id),
  base = '',
  endpoint = `/v1/institution/calendar`,
  scope = `event:${id}:${eid}:${view}`
const data = ref<EventDetail>(),
  organization = ref<Institution>(),
  loading = ref(true),
  error = ref(''),
  attendance = ref<Record<string, string>>({}),
  correctionReason = ref<Record<string, string>>({}),
  selected = ref(''),
  values = ref<Record<string, number | string>>({}),
  note = ref(''),
  revision = ref(0),
  draftReady = ref(false),
  draftError = ref(''),
  editingTime = ref(false),
  cancelOpen = ref(false),
  futureSeries = ref(false),
  newStaff = ref<string[]>([]),
  changingStaff = ref(false),
  local = ref(''),
  zone = ref('UTC'),
  minutes = ref(60),
  previewTimes = ref<{ starts_at: string; ends_at: string }[]>([]),
  previewError = ref('')
const histories = ref<
  Record<
    string,
    { items: EventDetail['history']; next: number | null; loading: boolean; error: string }
  >
>({})
async function loadHistory(member: string, more = false) {
  const previous = histories.value[member]
  histories.value[member] = {
    items: previous?.items || [],
    next: previous?.next ?? null,
    loading: true,
    error: '',
  }
  try {
    const result = await request<EventDetail>(
      endpoint +
        `?view=${view}&id=${eid}&historyMember=${member}&historyOffset=${more ? previous?.next || 0 : 0}`,
    )
    histories.value[member] = {
      items: more ? [...(previous?.items || []), ...result.history] : result.history,
      next: result.historyNext,
      loading: false,
      error: '',
    }
  } catch (e) {
    histories.value[member]!.error = errorMessage(e)
    histories.value[member]!.loading = false
  }
}
const trainees = computed(() => data.value?.people.filter((p) => p.duty === 'trainee') || []),
  person = computed(() => trainees.value.find((p) => p.member_id === selected.value)),
  result = computed(() => data.value?.results.find((r) => r.member_id === selected.value))
const now = ref(Date.now())
const clock = window.setInterval(() => {
  now.value = Date.now()
}, 15000)
onUnmounted(() => window.clearInterval(clock))
const started = computed(
    () => !!data.value && new Date(data.value.event.starts_at).getTime() <= now.value,
  ),
  writable = computed(
    () => view !== 'trainee' && data.value?.event.state !== 'cancelled' && started.value,
  )
const attendanceDirty = (p: EventPerson) => attendance.value[p.member_id] !== p.attendance
const draftKey = () => `assessment-result:${user.value!.id}:${id}:${eid}:${selected.value}`
function localInput(instant: string, tz: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instant))
  const v = (type: string) => parts.find((p) => p.type === type)!.value
  return `${v('year')}-${v('month')}-${v('day')}T${v('hour')}:${v('minute')}`
}
const label = (value: string) =>
  new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar-AE' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'shortOffset',
    timeZone: data.value?.event.timezone || 'UTC',
  }).format(new Date(value))
const attendanceName = (value: string) =>
  l(
    (
      {
        present: 'Present',
        absent: 'Absent',
        excused: 'Excused',
        unmarked: 'Not recorded',
      } as Record<string, string>
    )[value] || value,
    (
      { present: 'حاضر', absent: 'غائب', excused: 'بعذر', unmarked: 'لم يسجل' } as Record<
        string,
        string
      >
    )[value] || value,
  )
async function load() {
  loading.value = true
  error.value = ''
  try {
    data.value = await request<EventDetail>(endpoint + `?view=${view}&id=${eid}&summary=true`)
    attendance.value = Object.fromEntries(data.value.people.map((p) => [p.member_id, p.attendance]))
    correctionReason.value = {}
    zone.value = data.value.event.timezone
    local.value = localInput(data.value.event.starts_at, zone.value)
    minutes.value =
      (Date.parse(data.value.event.ends_at) - Date.parse(data.value.event.starts_at)) / 60000
    newStaff.value = data.value.people.filter((p) => p.duty === 'staff').map((p) => p.member_id)
    if (view === 'admin')
      organization.value = await request<Institution>(`/v1/institution?view=admin&summary=true`)
    newStaff.value = newStaff.value.filter((id) =>
      data.value!.people.some((p) => p.member_id === id && p.active && p.roles.includes('trainer')),
    )
  } catch (e) {
    error.value = errorMessage(e)
    data.value = undefined
  } finally {
    loading.value = false
  }
}
async function openResult(p: EventPerson, restore = true) {
  draftReady.value = false
  selected.value = p.member_id
  const current = data.value?.results.find((r) => r.member_id === p.member_id)
  values.value = { ...(current?.values || {}) }
  note.value = current?.note || ''
  revision.value = current?.revision || 0
  if (restore) {
    const saved = await getDraft<{ values: typeof values.value; note: string; revision: number }>(
      draftKey(),
    ).catch(() => undefined)
    if (saved) {
      values.value = saved.values
      note.value = saved.note
      revision.value = saved.revision
    }
  }
  draftReady.value = true
  await nextTick()
  document.querySelector<HTMLElement>('.result-editor h2')?.focus()
}
const command = useCommand<'change'>(
  scope,
  async (_, result, args) => {
    if (args.action === 'result') {
      await removeDraft(`assessment-result:${user.value!.id}:${id}:${eid}:${args.member}`)
      draftReady.value = false
      selected.value = ''
    }
    editingTime.value = false
    cancelOpen.value = false
    changingStaff.value = false
    await load()
  },
  (_, args) => request(endpoint, { method: 'POST', body: JSON.stringify(args) }),
  {
    successMessage: (_, args) => {
      if (args.action === 'attendance') return l('Attendance recorded.', 'تم تسجيل الحضور.')
      if (args.action === 'result') return l('Assessment result saved.', 'تم حفظ نتيجة التقييم.')
      if (args.action === 'reschedule') return l('Session rescheduled.', 'تمت إعادة جدولة الجلسة.')
      if (args.action === 'cancel') return l('Session cancelled.', 'تم إلغاء الجلسة.')
      if (args.action === 'staff') return l('Session coaches updated.', 'تم تحديث مدربي الجلسة.')
      return l('Session completed.', 'تم إكمال الجلسة.')
    },
  },
)
const locked = computed(() => command.state.busy || !!command.state.pending || !command.state.ready)
const run = (args: Record<string, unknown>) =>
  command.run('change', {
    id: eid,
    view,
    operation: crypto.randomUUID(),
    revision: data.value!.event.revision,
    ...args,
  })
async function previewTime() {
  previewError.value = ''
  try {
    previewTimes.value = await request(`/v1/institution/calendar-preview`, {
      method: 'POST',
      body: JSON.stringify({
        view,
        local: local.value,
        zone: zone.value,
        minutes: minutes.value,
        count: 1,
        every: 7,
      }),
    })
  } catch (e) {
    previewError.value = errorMessage(e)
  }
}
watch([local, zone, minutes], () => {
  previewTimes.value = []
})
const previewLabel = (value: string) =>
  new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar-AE' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'long',
    timeZone: zone.value,
  }).format(new Date(value))
function saveResult() {
  return run({
    action: 'result',
    member: selected.value,
    revision: revision.value,
    values: values.value,
    note: note.value,
  })
}
function closeResult() {
  draftReady.value = false
  selected.value = ''
}
watch(
  [values, note],
  async () => {
    if (!draftReady.value || !selected.value) return
    try {
      await storeDraft(draftKey(), {
        values: values.value,
        note: note.value,
        revision: revision.value,
      })
      draftError.value = ''
    } catch (e) {
      draftError.value = errorMessage(e)
    }
  },
  { deep: true },
)
onMounted(load)
</script>
<template>
  <div class="container page event-detail">
    <RouterLink
      class="back-link"
      :to="base + '/schedule' + (route.query.from ? '?from=' + route.query.from : '')"
      >{{ l('Back to calendar', 'العودة للتقويم') }}</RouterLink
    >
    <PageHeading class="work-heading">
      <div>
        <p class="overline">
          {{
            data?.event.kind === 'training'
              ? l('Training session', 'جلسة تدريب')
              : l('Institution assessment', 'تقييم المؤسسة')
          }}
        </p>
        <h1>{{ data?.event.title || l('Event', 'الموعد') }}</h1>
      </div>
    </PageHeading>
    <CommandStatus :command="command" />
    <PageState :loading="loading" :error="error" @retry="load"
      ><template v-if="data">
        <section class="event-overview">
          <p class="event-when">
            {{ label(data.event.starts_at) }} — {{ label(data.event.ends_at) }}
          </p>
          <p>{{ data.event.location || l('Location to be agreed', 'الموقع يحدد لاحقاً') }}</p>
          <p>
            {{ l('Coaches / assessors', 'المدربون / المقيمون') }}:
            {{
              data.people
                .filter((p) => p.duty === 'staff')
                .map((p) => p.name)
                .join(' · ')
            }}
          </p>
          <p
            v-if="
              data.people.some(
                (p) => p.duty === 'staff' && (!p.active || !p.roles.includes('trainer')),
              )
            "
            class="notice"
          >
            {{
              l(
                'A coach is no longer active in this role. An administrator can reassign this event below.',
                'لم يعد أحد المدربين نشطاً بهذا الدور. يمكن للمسؤول إعادة تعيين الموعد أدناه.',
              )
            }}
          </p>
          <span class="tag" :data-status="data.event.state">{{
            data.event.state === 'cancelled'
              ? l('Cancelled', 'ملغي')
              : data.event.state === 'completed'
                ? l('Completed', 'مكتمل')
                : l('Scheduled', 'مجدول')
          }}</span>
        </section>
        <RouterLink
          v-if="
            view === 'trainee' &&
            data.event.kind === 'training' &&
            data.event.state === 'completed' &&
            trainees.some((p) => p.attendance === 'present')
          "
          :to="base + '/feedback'"
          class="text-link"
          >{{ l('Rate your session (optional)', 'قيّم جلستك (اختياري)') }}</RouterLink
        >
        <RouterLink
          v-if="data.event.workout_snapshot?.assignment_id"
          class="button secondary"
          :to="
            view === 'trainee'
              ? '/training'
              : '/training/' + data.event.workout_snapshot.assignment_id
          "
          >{{ l('Open plan workouts', 'فتح تمارين الخطة') }}</RouterLink
        >
        <div
          v-if="
            view !== 'trainee' &&
            data.event.state === 'scheduled' &&
            !data.event.workout_snapshot?.assignment_id
          "
          class="event-tools"
        >
          <button
            v-if="!started"
            class="text-link"
            @click="editingTime = !editingTime"
            :disabled="locked"
          >
            {{ l('Reschedule this event', 'إعادة جدولة هذا الموعد') }}</button
          ><button
            v-if="view === 'admin'"
            class="text-link"
            @click="changingStaff = !changingStaff"
            :disabled="locked"
          >
            {{ l('Reassign staff', 'إعادة تعيين الموظفين') }}</button
          ><button
            v-if="!data.results.length"
            class="text-link danger-action"
            @click="cancelOpen = !cancelOpen"
            :disabled="locked"
          >
            {{ l('Cancel event', 'إلغاء الموعد') }}
          </button>
        </div>
        <form
          v-if="editingTime"
          class="panel event-change"
          @submit.prevent="
            previewTimes.length
              ? run({ action: 'reschedule', local, zone, minutes })
              : previewTime()
          "
        >
          <fieldset :disabled="locked" class="form-fields">
            <h2>{{ l('Change this occurrence', 'تغيير هذا الموعد') }}</h2>
            <label
              >{{ l('Local date and time', 'التاريخ والوقت المحلي')
              }}<input type="datetime-local" v-model="local" required /></label
            ><TimezonePicker
              v-model="zone"
              :label="l('Timezone', 'المنطقة الزمنية')"
              :disabled="locked"
            /><label
              >{{ l('Minutes', 'الدقائق')
              }}<select v-model.number="minutes">
                <option v-for="n in [15, 30, 45, 60, 90, 120]" :key="n" :value="n">{{ n }}</option>
              </select></label
            >
            <p class="small-print">
              {{
                l(
                  'Only this occurrence changes. Participant conflicts are checked before saving.',
                  'يتغير هذا الموعد فقط. تُفحص تعارضات المشاركين قبل الحفظ.',
                )
              }}
            </p>
            <p v-if="previewError" role="alert" class="notice error">{{ previewError }}</p>
            <p v-for="time in previewTimes" :key="time.starts_at">
              {{ previewLabel(time.starts_at) }} — {{ previewLabel(time.ends_at) }}
            </p>
            <button class="button">
              {{
                previewTimes.length
                  ? l('Confirm new time', 'تأكيد الوقت الجديد')
                  : l('Review new time', 'مراجعة الوقت الجديد')
              }}
            </button>
          </fieldset>
        </form>
        <form
          v-if="changingStaff && organization"
          class="panel event-change"
          @submit.prevent="run({ action: 'staff', staff: newStaff })"
        >
          <fieldset :disabled="locked" class="form-fields">
            <h2>{{ l('Assign active coaches', 'تعيين مدربين نشطين') }}</h2>
            <MemberPicker
              :institution="id"
              view="admin"
              role="trainer"
              :max="8"
              v-model="newStaff"
              :exclude-ids="trainees.map((p) => p.member_id)"
            />
            <p class="small-print">
              {{
                l(
                  'The selected staff can see this event and its participant results. Existing history is preserved.',
                  'يمكن للموظفين المحددين رؤية الموعد ونتائج المشاركين. يُحفظ السجل السابق.',
                )
              }}
            </p>
            <button class="button" :disabled="!newStaff.length">
              {{ l('Confirm staff assignment', 'تأكيد تعيين الموظفين') }}
            </button>
          </fieldset>
        </form>
        <section v-if="cancelOpen" class="panel event-change">
          <h2>{{ l('Cancel this event?', 'إلغاء هذا الموعد؟') }}</h2>
          <p>{{ data.event.title }} · {{ label(data.event.starts_at) }}</p>
          <label v-if="!started" class="check-label"
            ><input v-model="futureSeries" type="checkbox" />{{
              l(
                'Also cancel later scheduled events in this series',
                'إلغاء المواعيد التالية المجدولة من هذه السلسلة أيضاً',
              )
            }}</label
          >
          <p>
            {{
              l(
                'Cancelled events stay in the calendar history. An event with recorded results cannot be cancelled.',
                'تبقى المواعيد الملغاة في سجل التقويم. لا يمكن إلغاء موعد بنتائج مسجلة.',
              )
            }}
          </p>
          <button
            class="button danger-action"
            :disabled="locked"
            @click="run({ action: 'cancel', future_series: futureSeries })"
          >
            {{ l('Confirm cancellation', 'تأكيد الإلغاء') }}
          </button>
        </section>
        <section v-if="selected && person && writable" class="panel result-editor">
          <div class="heading-actions">
            <h2 tabindex="-1">{{ person.name }}</h2>
            <button class="text-link" @click="closeResult" :disabled="locked">
              {{ l('Back to participants', 'العودة للمشاركين') }}
            </button>
          </div>
          <form @submit.prevent="saveResult">
            <fieldset class="form-fields" :disabled="locked">
              <label v-for="drill in data.event.definition || []" :key="drill.key"
                >{{ drill.name }} <span v-if="drill.unit">({{ drill.unit }})</span
                ><input
                  v-if="drill.kind === 'number'"
                  v-model.number="values[drill.key]"
                  type="number"
                  step="any"
                  inputmode="decimal"
                  :min="drill.min"
                  :max="drill.max"
                  required
                /><textarea
                  v-else
                  v-model="values[drill.key]"
                  maxlength="1000"
                  required
                  rows="2"
                /></label
              ><label
                >{{ l('Assessor note (optional)', 'ملاحظة المقيم (اختياري)')
                }}<textarea v-model="note" maxlength="2000" rows="3" />
              </label>
              <p class="small-print">
                {{
                  l(
                    'This athlete sees their own result. Your institution retains the result and correction history.',
                    'يرى الرياضي نتيجته فقط. تحتفظ مؤسستك بالنتيجة وسجل التصحيحات.',
                  )
                }}
              </p>
              <p v-if="draftError" class="notice error" role="alert">{{ draftError }}</p>
              <button class="button">
                {{ result ? l('Save correction', 'حفظ التصحيح') : l('Save result', 'حفظ النتيجة') }}
              </button>
            </fieldset>
          </form>
        </section>
        <section v-if="!selected" class="event-participants">
          <h2>{{ l('Participants', 'المشاركون') }}</h2>
          <p v-if="!started && view !== 'trainee'" class="small-print">
            {{
              l(
                'Attendance and results open when this event starts.',
                'يفتح تسجيل الحضور والنتائج عند بدء الموعد.',
              )
            }}
          </p>
          <article v-for="p in trainees" :key="p.member_id" class="event-participant">
            <div>
              <h3>{{ p.name }}</h3>
              <p v-if="p.checked_in_at" class="small-print">
                {{ l('Checked in', 'تم تسجيل الحضور') }} · {{ label(p.checked_in_at) }}
              </p>
              <span v-if="!writable">{{ attendanceName(p.attendance) }}</span>
              <p v-if="data.results.some((r) => r.member_id === p.member_id)" class="small-print">
                {{ l('Result recorded', 'النتيجة مسجلة') }}
              </p>
            </div>
            <div v-if="writable" class="participant-actions">
              <label class="sr-only" :for="'attendance-' + p.member_id"
                >{{ l('Attendance for', 'حضور') }} {{ p.name }}</label
              ><select
                :id="'attendance-' + p.member_id"
                v-model="attendance[p.member_id]"
                :disabled="locked"
              >
                <option value="unmarked">{{ l('Not recorded', 'لم يسجل') }}</option>
                <option value="present">{{ l('Present', 'حاضر') }}</option>
                <option value="absent">{{ l('Absent', 'غائب') }}</option>
                <option value="excused">{{ l('Excused', 'بعذر') }}</option>
              </select>
              <button
                class="button secondary small"
                :disabled="locked || !attendanceDirty(p)"
                @click="
                  run({
                    action: 'attendance',
                    member: p.member_id,
                    revision: p.revision,
                    attendance: attendance[p.member_id],
                  })
                "
              >
                {{ l('Save attendance', 'حفظ الحضور') }}</button
              ><button
                v-if="data.event.kind === 'assessment' && p.attendance === 'present'"
                class="button small"
                :disabled="locked"
                @click="openResult(p)"
              >
                {{
                  data.results.some((r) => r.member_id === p.member_id)
                    ? l('Review / correct result', 'مراجعة / تصحيح النتيجة')
                    : l('Record result', 'تسجيل النتيجة')
                }}
              </button>
            </div>
            <SessionNote
              :key="p.member_id + ':' + p.revision"
              :institution="id"
              :view="view"
              :event="eid"
              :member="p.member_id"
              :name="p.name"
              :note="p.session_note"
              :revision="p.revision"
              :writable="writable"
              @saved="load"
            />
            <RouterLink
              v-if="
                view !== 'trainee' &&
                data.event.state === 'completed' &&
                ['absent', 'excused'].includes(p.attendance)
              "
              class="text-link"
              :to="base + '/schedule/new?makeup=' + eid + '&member=' + p.member_id"
              >{{ l('Book an independent makeup session', 'حجز جلسة تعويضية مستقلة') }}</RouterLink
            >
          </article>
          <button
            v-if="
              writable &&
              data.event.state === 'scheduled' &&
              !data.event.workout_snapshot?.assignment_id
            "
            class="button"
            :disabled="locked"
            @click="run({ action: 'finish' })"
          >
            {{
              data.event.kind === 'training'
                ? l('Complete session', 'إكمال الجلسة')
                : l('Finish event', 'إنهاء الموعد')
            }}
          </button>
        </section>
        <section v-if="data.results.length && !selected" class="event-results">
          <h2>{{ l('Recorded results', 'النتائج المسجلة') }}</h2>
          <article v-for="r in data.results" :key="r.member_id" class="panel">
            <h3>{{ trainees.find((p) => p.member_id === r.member_id)?.name }}</h3>
            <dl>
              <template v-for="d in data.event.definition || []" :key="d.key"
                ><dt>{{ d.name }}</dt>
                <dd>{{ r.values[d.key] }} {{ d.unit }}</dd></template
              >
            </dl>
            <p v-if="r.note">{{ r.note }}</p>
            <details
              @toggle="($event.target as HTMLDetailsElement).open && loadHistory(r.member_id)"
            >
              <summary>{{ l('Correction history', 'سجل التصحيحات') }}</summary>
              <p class="small-print">
                {{
                  l(
                    'Saved revisions for this athlete, newest first.',
                    'النسخ المحفوظة لهذا الرياضي، الأحدث أولاً.',
                  )
                }}
              </p>
              <article v-for="h in histories[r.member_id]?.items || []" :key="h.id">
                <p>{{ l('Revision', 'النسخة') }} {{ h.revision }} · {{ label(h.recorded_at) }}</p>
                <p v-for="d in data.event.definition || []" :key="d.key">
                  {{ d.name }}: {{ h.document.values[d.key] }} {{ d.unit }}
                </p>
                <p v-if="h.document.note">{{ h.document.note }}</p>
              </article>
              <p v-if="histories[r.member_id]?.error" role="alert">
                {{ histories[r.member_id]?.error }}
                <button type="button" class="text-link" @click="loadHistory(r.member_id)">
                  {{ l('Try again', 'حاول مجدداً') }}
                </button>
              </p>
              <button
                v-if="histories[r.member_id]?.next != null"
                type="button"
                class="text-link"
                :disabled="histories[r.member_id]?.loading"
                @click="loadHistory(r.member_id, true)"
              >
                {{ l('Earlier revisions', 'نسخ أقدم') }}
              </button>
            </details>
          </article>
        </section>
      </template></PageState
    >
  </div>
</template>
<style scoped>
.event-detail {
}
.event-overview {
  padding: 24px 28px;
  margin-block: 20px;
  border: 1px solid var(--line);
  border-inline-start: 4px solid var(--accent);
  border-radius: var(--radius-panel);
  background: var(--surface);
  box-shadow: 0 8px 24px #00000008;
  overflow-wrap: anywhere;
}
.event-when {
  font-weight: 650;
  font-size: 1.15rem;
}
.event-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 14px 28px;
  margin-block: 20px;
}
.event-change,
.result-editor {
  max-width: 740px;
  margin-block: 24px;
}
.event-change label,
.result-editor label {
  margin-block: 16px;
}
.event-change h2,
.result-editor h2,
.event-participants h2,
.event-results h2 {
  font-size: 1.25rem;
}
.event-participants {
  margin-block: 32px;
}
.event-participant {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 20px;
  align-items: center;
  padding-block: 20px;
  border-bottom: 1px solid var(--line);
}
.event-participant h3 {
  font-size: 1.05rem;
  margin: 0;
}
.event-participant > div {
  min-width: 0;
  overflow-wrap: anywhere;
}
.participant-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}
.participant-actions select {
  width: 160px;
}
.event-participants > button {
  margin-top: 24px;
}
.event-results > article {
  margin-block: 20px;
}
.event-results h3 {
  font-size: 1.05rem;
}
.event-results dl {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 10px;
}
.event-results dd {
  margin: 0;
  font-weight: 650;
  overflow-wrap: anywhere;
}
.event-results details article {
  border-bottom: 1px solid var(--line);
  padding-block: 12px;
}
.event-results p {
  overflow-wrap: anywhere;
}
@media (max-width: 750px) {
  .event-participant {
    display: block;
  }
  .participant-actions {
    margin-top: 14px;
  }
  .participant-actions select {
    width: 100%;
  }
  .event-change,
  .result-editor {
    padding: 20px;
  }
}
</style>
