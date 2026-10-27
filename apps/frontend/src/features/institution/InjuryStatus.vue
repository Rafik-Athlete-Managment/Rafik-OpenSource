<script setup lang="ts">
import PageHeading from '../../components/PageHeading.vue'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { programContext } from '../coaching/program-context'
import { profile } from '../../app/auth'
import { request } from '../../lib/backend'
import { dateLabel, errorMessage, language as l } from '../../lib/i18n'
import { localDate } from '../../lib/dates'

const context = programContext(useRoute()),
  endpoint = `/v1/institution/injuries`,
  busy = ref(false),
  error = ref(''),
  loaded = ref(false),
  data = ref<any>(),
  participation = ref('modified'),
  effective = ref(localDate(profile.value?.timezone || 'UTC')),
  ageGroup = ref('adult'),
  guardian = ref(false)
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
async function configure(member: any) {
  await command('configure', {
    member_id: member.member_id,
    age_group: ageGroup.value,
    guardian_authorized: ageGroup.value === 'minor' ? guardian.value : false,
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
        <h1 id="injury-title">{{ l('Injury status', 'حالة الإصابة') }}</h1>
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
        <button class="button secondary" :disabled="busy" @click="exportRecords">
          {{ l('Download my records', 'تنزيل سجلاتي') }}
        </button>
        <p v-if="!items.length">{{ l('No records yet.', 'لا توجد سجلات بعد.') }}</p>
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
              >{{ dateLabel(item.effective_from) }}</span
            >
          </div>
          <div class="record-actions" />
        </li>
      </ul>
    </section>

    <section v-else class="panel">
      <h2>{{ l('Consent setup', 'إعداد الموافقة') }}</h2>
      <p>
        {{
          l(
            'This screen records consent prerequisites only; administrators cannot view injury status. For a minor, confirm that guardian authorization is documented under university policy before enabling athlete assent.',
            'تسجل هذه الصفحة متطلبات الموافقة فقط؛ لا يمكن للمسؤولين رؤية حالة الإصابة. للقاصر، أكّد توثيق موافقة ولي الأمر وفق سياسة الجامعة قبل إتاحة موافقة الرياضي.',
          )
        }}
      </p>
      <label
        >{{ l('Age group for setup', 'الفئة العمرية للإعداد')
        }}<select v-model="ageGroup">
          <option value="adult">{{ l('Adult', 'بالغ') }}</option>
          <option value="minor">{{ l('Minor', 'قاصر') }}</option>
        </select></label
      ><label v-if="ageGroup === 'minor'"
        ><input v-model="guardian" type="checkbox" />
        {{ l('Guardian authorization verified', 'تم التحقق من موافقة ولي الأمر') }}</label
      >
      <article v-for="member in data.members" :key="member.member_id" class="record">
        <strong>{{ member.name }}</strong
        ><span
          >{{ member.age_group || l('Not configured', 'غير مُعد') }} ·
          {{
            member.athlete_assented_at
              ? l('Athlete agreed', 'وافق الرياضي')
              : l('Athlete assent pending', 'موافقة الرياضي معلقة')
          }}</span
        ><button
          class="button"
          :disabled="busy || (ageGroup === 'minor' && !guardian)"
          @click="configure(member)"
        >
          {{ l('Save consent setup', 'حفظ إعداد الموافقة') }}
        </button>
      </article>
    </section>
  </section>
</template>

<style scoped>
.injury-page {
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
