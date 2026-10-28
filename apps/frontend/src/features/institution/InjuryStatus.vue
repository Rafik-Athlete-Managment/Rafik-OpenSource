<script setup lang="ts">
import PageHeading from '../../components/PageHeading.vue'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { programContext } from '../coaching/program-context'
import { profile } from '../../app/auth'
import { request } from '../../lib/backend'
import { errorMessage, language as l } from '../../lib/i18n'
import { dateLabel } from '../../lib/display-time'
import { localDate } from '../../lib/dates'

const context = programContext(useRoute()),
  endpoint = `/v1/institution/injuries`,
  busy = ref(false),
  error = ref(''),
  loaded = ref(false),
  data = ref<any>(),
  participation = ref('modified'),
  effective = ref(localDate(profile.value?.timezone || 'UTC')),
  // Consent setup is chosen per athlete, beside the athlete it applies to.
  ageGroups = ref<Record<string, string>>({}),
  guardians = ref<Record<string, boolean>>({}),
  setupFilter = ref<'pending' | 'all'>('pending')
const view = context.view
const items = computed(() => data.value?.items || [])
async function load() {
  error.value = ''
  try {
    data.value = await request(`${endpoint}?view=${view}`)
    loaded.value = true
  } catch (e) {
    error.value = errorMessage(e)
  }
}
async function command(action: string, values: Record<string, unknown> = {}) {
  busy.value = true
  error.value = ''
  try {
    await request(endpoint, {
      method: 'POST',
      body: JSON.stringify({ view, action, ...values }),
      feedback: 'success',
      successMessage:
        action === 'report'
          ? l('Participation status recorded.', 'تم تسجيل حالة المشاركة.')
          : action === 'close'
            ? l('Injury record closed.', 'تم إغلاق سجل الإصابة.')
            : action === 'configure'
              ? l('Consent setup saved.', 'تم حفظ إعداد الموافقة.')
              : l('Injury record updated.', 'تم تحديث سجل الإصابة.'),
    })
    await load()
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}
function report() {
  return command('report', {
    operation: crypto.randomUUID(),
    id: crypto.randomUUID(),
    participation: participation.value,
    effective_from: effective.value,
    revision: 0,
  })
}
function update(record: any, action: 'correct' | 'close') {
  return command(action, {
    operation: crypto.randomUUID(),
    id: record.id,
    participation: participation.value,
    effective_from: effective.value,
    revision: record.revision,
  })
}
const ageOf = (member: any) => ageGroups.value[member.member_id] || member.age_group || 'adult'
const needsSetup = (member: any) => !member.age_group
const setupMembers = computed(() =>
  (data.value?.members || []).filter(
    (member: any) => setupFilter.value === 'all' || needsSetup(member),
  ),
)
const pendingSetup = computed(
  () => (data.value?.members || []).filter((member: any) => needsSetup(member)).length,
)
async function configure(member: any) {
  const age = ageOf(member)
  await command('configure', {
    member_id: member.member_id,
    age_group: age,
    guardian_authorized: age === 'minor' ? !!guardians.value[member.member_id] : false,
    revision: member.revision || 0,
  })
}
async function exportRecords() {
  busy.value = true
  error.value = ''
  try {
    const response = await request<{
        consent?: { assent_policy_version?: string | null } | null
        items: {
          participation: string
          effective_from: string
          state: string
          created_at: string
          closed_at: string | null
          history: {
            action: string
            participation: string
            effective_from: string
            recorded_at: string
          }[]
        }[]
      }>(`${endpoint}?view=trainee&export=true`),
      content = {
        format: 'rafik-injury-participation-v1',
        exported_at: new Date().toISOString(),
        policy_version: response.consent?.assent_policy_version || null,
        records: response.items.map((record: any) => ({
          participation: record.participation,
          effective_from: record.effective_from,
          state: record.state,
          created_at: record.created_at,
          closed_at: record.closed_at,
          history: record.history.map((entry: any) => ({
            action: entry.action,
            participation: entry.participation,
            effective_from: entry.effective_from,
            recorded_at: entry.recorded_at,
          })),
        })),
      },
      url = URL.createObjectURL(
        new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' }),
      ),
      link = document.createElement('a')
    link.href = url
    link.download = `rafik-injury-participation-${localDate(profile.value?.timezone || 'UTC')}.json`
    link.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}
onMounted(load)
</script>

<template>
  <section class="container page injury-page" aria-labelledby="injury-title">
    <PageHeading class="page-heading"
      ><div>
        <p class="eyebrow">{{ l('Health and participation', 'الصحة والمشاركة') }}</p>
        <h1 id="injury-title">{{ l('Athlete health', 'صحة الرياضي') }}</h1>
      </div></PageHeading
    >
    <p class="notice" role="note">
      {{
        l(
          'Only record participation status. Do not enter a diagnosis, body area, treatment, or medical details. Closed records are deleted after 12 months.',
          'سجّل حالة المشاركة فقط. لا تُدخل تشخيصًا أو منطقة بالجسم أو علاجًا أو تفاصيل طبية. تُحذف السجلات المغلقة بعد 12 شهرًا.',
        )
      }}
    </p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="!loaded" aria-live="polite">{{ l('Loading…', 'جارٍ التحميل…') }}</p>

    <template v-else-if="view === 'trainee'">
      <section class="panel">
        <h2>{{ l('Sharing and consent', 'المشاركة والموافقة') }}</h2>
        <p v-if="!data.consent">
          {{
            l(
              'Your institution has not set up the required consent record yet. Contact its administrator.',
              'لم تُعدّ مؤسستك سجل الموافقة المطلوب بعد. تواصل مع المسؤول.',
            )
          }}
        </p>
        <template v-else>
          <p>
            {{
              data.consent.withdrawn_at
                ? l(
                    'Sharing is withdrawn. Coaches cannot see your status.',
                    'تم سحب المشاركة. لا يمكن للمدربين رؤية حالتك.',
                  )
                : data.consent.athlete_assented_at
                  ? l(
                      'You have agreed to share limited participation status with your assigned coach.',
                      'وافقت على مشاركة حالة المشاركة المحدودة مع مدربك المعيّن.',
                    )
                  : l(
                      'Review the sharing rule, then choose whether to enable it.',
                      'راجع قاعدة المشاركة ثم اختر ما إذا كنت تريد تفعيلها.',
                    )
            }}
          </p>
          <button
            class="button"
            v-if="!data.consent.athlete_assented_at || data.consent.withdrawn_at"
            :disabled="busy"
            @click="command('assent')"
          >
            {{ l('Agree and enable sharing', 'أوافق على تفعيل المشاركة') }}
          </button>
          <button v-else class="button secondary" :disabled="busy" @click="command('withdraw')">
            {{ l('Withdraw sharing', 'سحب المشاركة') }}
          </button>
        </template>
      </section>
      <section v-if="data.consent?.athlete_assented_at && !data.consent.withdrawn_at" class="panel">
        <h2>{{ l('Report participation status', 'الإبلاغ عن حالة المشاركة') }}</h2>
        <label
          >{{ l('Status', 'الحالة')
          }}<select v-model="participation">
            <option value="modified">{{ l('Modified participation', 'مشاركة معدلة') }}</option>
            <option value="unavailable">{{ l('Unavailable', 'غير متاح للمشاركة') }}</option>
          </select></label
        >
        <label>{{ l('Effective from', 'ساري من') }}<input v-model="effective" type="date" /></label>
        <button class="button" :disabled="busy" @click="report">
          {{ l('Save status', 'حفظ الحالة') }}
        </button>
      </section>
      <section class="panel">
        <h2>{{ l('Your records', 'سجلاتك') }}</h2>
        <p>
          {{
            l(
              'Download a JSON copy of your records and correction history.',
              'نزّل نسخة JSON من سجلاتك وسجل التصحيحات.',
            )
          }}
        </p>
        <p v-if="!items.length" class="small-print">
          {{ l('No records yet.', 'لا توجد سجلات بعد.') }}
        </p>
        <article v-for="record in items" :key="record.id" class="record">
          <strong>{{
            record.participation === 'modified'
              ? l('Modified participation', 'مشاركة معدلة')
              : l('Unavailable', 'غير متاح للمشاركة')
          }}</strong
          ><span>{{ record.effective_from }} · {{ record.state }}</span>
          <label v-if="record.state === 'active'"
            >{{ l('Correct status', 'تصحيح الحالة')
            }}<select v-model="participation">
              <option value="modified">{{ l('Modified participation', 'مشاركة معدلة') }}</option>
              <option value="unavailable">{{ l('Unavailable', 'غير متاح للمشاركة') }}</option>
            </select></label
          >
          <div v-if="record.state === 'active'" class="actions">
            <button class="button" :disabled="busy" @click="update(record, 'correct')">
              {{ l('Save correction', 'حفظ التصحيح') }}</button
            ><button class="button secondary" :disabled="busy" @click="update(record, 'close')">
              {{ l('Close record', 'إغلاق السجل') }}
            </button>
          </div>
          <details v-if="record.history?.length">
            <summary>{{ l('History', 'السجل') }}</summary>
            <ul>
              <li v-for="entry in record.history" :key="entry.revision">
                {{ entry.action }} · {{ entry.participation }} · {{ entry.effective_from }}
              </li>
            </ul>
          </details>
        </article>
        <button class="button secondary" :disabled="busy" @click="exportRecords">
          {{ l('Download my records', 'تنزيل سجلاتي') }}
        </button>
      </section>
    </template>

    <section v-else-if="view === 'trainer'" aria-labelledby="assigned-status-title">
      <h2 id="assigned-status-title">{{ l('Assigned athletes', 'الرياضيون المعيّنون') }}</h2>
      <p class="small-print">
        {{
          l(
            'Only active status and effective date for your assigned athletes are shown. No medical details or history are available. An athlete without a shared status is unknown, not cleared to train.',
            'تظهر الحالة الفعالة وتاريخ سريانها للرياضيين المعيّنين إليك فقط. لا تتوفر تفاصيل طبية أو سجل سابق. الرياضي دون حالة مشتركة حالته غير معروفة، وليس مصرحاً له بالتدريب.',
          )
        }}
      </p>
      <p v-if="!items.length" class="small-print">
        {{ l('No shared active statuses.', 'لا توجد حالات نشطة مشتركة.') }}
      </p>
      <ul v-else class="record-list">
        <li v-for="item in items" :key="item.id" class="record-row">
          <div class="record-title">
            <RouterLink :to="'/members/' + item.athlete_member_id"
              ><bdi dir="auto">{{ item.athlete_name }}</bdi></RouterLink
            >
          </div>
          <div class="record-meta">
            <span
              class="tag"
              :data-status="item.participation === 'modified' ? 'paused' : 'unavailable'"
              >{{
                item.participation === 'modified'
                  ? l('Modified participation', 'مشاركة معدلة')
                  : l('Unavailable', 'غير متاح للمشاركة')
              }}</span
            >
            <span
              ><small>{{ l('Effective', 'سارية منذ') }}</small
              >{{ dateLabel(item.effective_from.slice(0, 10)) }}</span
            >
          </div>
          <div class="record-actions" />
        </li>
      </ul>
    </section>

    <section v-else class="panel consent-setup" aria-labelledby="consent-setup-title">
      <h2 id="consent-setup-title">{{ l('Consent setup', 'إعداد الموافقة') }}</h2>
      <p>
        {{
          l(
            'This screen records consent prerequisites only; administrators cannot view athlete health records. For a minor, confirm that guardian authorization is documented under university policy before enabling athlete assent.',
            'تسجل هذه الصفحة متطلبات الموافقة فقط؛ لا يمكن للمسؤولين رؤية سجلات صحة الرياضي. للقاصر، أكّد توثيق موافقة ولي الأمر وفق سياسة الجامعة قبل إتاحة موافقة الرياضي.',
          )
        }}
      </p>
      <fieldset class="filter-chips">
        <legend>{{ l('Show athletes', 'عرض الرياضيين') }}</legend>
        <label
          ><input v-model="setupFilter" type="radio" value="pending" />{{
            l('Needs setup', 'بحاجة إلى إعداد')
          }}
          ({{ pendingSetup }})</label
        ><label
          ><input v-model="setupFilter" type="radio" value="all" />{{
            l('All athletes', 'كل الرياضيين')
          }}
          ({{ data.members.length }})</label
        >
      </fieldset>
      <p v-if="!setupMembers.length" class="small-print">
        {{
          setupFilter === 'pending'
            ? l('Every athlete has a consent setup.', 'لكل رياضي إعداد موافقة.')
            : l('No athletes yet.', 'لا يوجد رياضيون بعد.')
        }}
      </p>
      <ul v-else class="consent-list">
        <li v-for="member in setupMembers" :key="member.member_id" class="consent-row">
          <div class="consent-person">
            <strong
              ><bdi dir="auto">{{ member.name }}</bdi></strong
            >
            <span class="consent-tags">
              <span class="tag" :data-status="member.age_group ? 'active' : 'pending'">{{
                member.age_group === 'minor'
                  ? l('Minor', 'قاصر')
                  : member.age_group === 'adult'
                    ? l('Adult', 'بالغ')
                    : l('Not configured', 'غير مُعد')
              }}</span>
              <span class="tag" :data-status="member.athlete_assented_at ? 'active' : 'pending'">{{
                member.athlete_assented_at
                  ? l('Athlete agreed', 'وافق الرياضي')
                  : l('Athlete assent pending', 'موافقة الرياضي معلقة')
              }}</span>
            </span>
          </div>
          <form class="consent-form" @submit.prevent="configure(member)">
            <label
              >{{ l('Age group', 'الفئة العمرية')
              }}<select
                :value="ageOf(member)"
                :disabled="busy"
                :aria-label="l('Age group for ', 'الفئة العمرية لـ ') + member.name"
                @change="ageGroups[member.member_id] = ($event.target as HTMLSelectElement).value"
              >
                <option value="adult">{{ l('Adult', 'بالغ') }}</option>
                <option value="minor">{{ l('Minor', 'قاصر') }}</option>
              </select></label
            >
            <label v-if="ageOf(member) === 'minor'" class="consent-guardian"
              ><input v-model="guardians[member.member_id]" type="checkbox" :disabled="busy" />{{
                l('Guardian authorization verified', 'تم التحقق من موافقة ولي الأمر')
              }}</label
            >
            <button
              class="button secondary small"
              :disabled="busy || (ageOf(member) === 'minor' && !guardians[member.member_id])"
              :aria-label="l('Save consent setup for ', 'حفظ إعداد الموافقة لـ ') + member.name"
            >
              {{ member.age_group ? l('Update', 'تحديث') : l('Save setup', 'حفظ الإعداد') }}
            </button>
          </form>
        </li>
      </ul>
    </section>
  </section>
</template>

<style scoped>
.consent-setup > .filter-chips {
  margin-block: var(--space-4);
}
.consent-setup .consent-list {
  list-style: none;
  margin: 0;
  padding: 0;
  border-top: 1px solid var(--line);
}
.consent-row {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3) var(--space-5);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--line);
}
.consent-person {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
}
.consent-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.consent-form {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}
.consent-form > label:first-child {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  font-weight: 600;
}
.consent-form select {
  width: auto;
  min-width: 120px;
  margin: 0;
}
.consent-form > .button {
  margin: 0;
}
.consent-guardian {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
}
.eyebrow {
  color: var(--muted);
  margin: 0;
}
.notice,
.panel {
  border: 1px solid var(--line);
  background: var(--surface);
  border-radius: 14px;
  padding: 18px;
  margin-block: 16px;
}
.notice {
  background: var(--tint);
}
.panel h2 {
  margin-top: 0;
}
.panel > label,
.record label {
  display: grid;
  gap: 6px;
  margin-block: 12px;
}
.panel input,
.panel select {
  max-width: 320px;
  min-height: 42px;
}
.record {
  display: grid;
  gap: 8px;
  border-top: 1px solid var(--line);
  margin-top: 12px;
  padding: 14px 0;
}
.record span {
  color: var(--muted);
}
.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.secondary {
  background: transparent;
  color: var(--ink);
  border: 1px solid var(--line);
}
.error {
  color: var(--error);
}
button {
  min-height: 42px;
}
.panel ul {
  padding-inline-start: 1.25rem;
}
</style>
