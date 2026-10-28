<script setup lang="ts">
import PageHeading from '../../components/PageHeading.vue'
import { ref, onMounted } from 'vue'
import { user } from '../../app/auth'
import { request } from '../../lib/backend'
import { language as l, errorMessage } from '../../lib/i18n'
import { dateLabel } from '../../lib/display-time'
import { useCommand } from '../../lib/commands'
import CommandStatus from '../../components/CommandStatus.vue'
import PageState from '../../components/PageState.vue'
const includeReads = ref(false)
const actionLabel = (kind: string) =>
  l(
    (
      {
        identity_state: 'Account access changed',
        organization_state: 'Institution access changed',
        support_reply: 'Support response saved',
        view_users: 'Account directory viewed',
        view_organizations: 'Institution directory viewed',
        view_support: 'Support queue viewed',
        view_audit: 'Audit history viewed',
      } as Record<string, string>
    )[kind] || 'Platform action',
    (
      {
        identity_state: 'تغيير وصول الحساب',
        organization_state: 'تغيير وصول المؤسسة',
        support_reply: 'حفظ رد الدعم',
        view_users: 'عرض دليل الحسابات',
        view_organizations: 'عرض دليل المؤسسات',
        view_support: 'عرض طلبات الدعم',
        view_audit: 'عرض سجل الإجراءات',
      } as Record<string, string>
    )[kind] || 'إجراء في المنصة',
  )
const section = ref('organizations'),
  search = ref(''),
  items = ref<any[]>([]),
  next = ref<number | null>(null),
  loading = ref(true),
  error = ref(''),
  selected = ref<any>(),
  reason = ref(''),
  reply = ref('')
const labels = () => ({
  organizations: l('Institutions', 'المؤسسات'),
  users: l('Accounts', 'الحسابات'),
  support: l('Platform support', 'دعم المنصة'),
  audit: l('Audit history', 'سجل الإجراءات'),
})
let generation = 0
async function load(append = false) {
  const current = ++generation
  loading.value = true
  error.value = ''
  try {
    const data = await request<{ items: any[]; next: number | null }>(
      `/v1/platform?section=${section.value}&search=${encodeURIComponent(search.value)}&includeReads=${includeReads.value}&offset=${append ? next.value || 0 : 0}`,
    )
    if (current !== generation) return
    items.value = append ? [...items.value, ...data.items] : data.items
    next.value = data.next
  } catch (e) {
    if (current !== generation) return
    error.value = errorMessage(e)
    items.value = []
  } finally {
    if (current === generation) loading.value = false
  }
}
function change() {
  selected.value = undefined
  search.value = ''
  void load()
}
const command = useCommand<'apply'>(
  `platform:${user.value!.id}`,
  async () => {
    selected.value = undefined
    reason.value = ''
    reply.value = ''
    await load()
  },
  (_, args) => request('/v1/platform', { method: 'POST', body: JSON.stringify(args) }),
  {
    // Name the audited change once the server acknowledges it.
    successMessage: (_, args) =>
      args.action === 'identity_state'
        ? args.value
          ? l('Access suspended.', 'تم إيقاف الوصول.')
          : l('Access restored.', 'تمت استعادة الوصول.')
        : args.action === 'organization_state'
          ? args.value
            ? l('Institution archived.', 'تمت أرشفة المؤسسة.')
            : l('Institution restored.', 'تمت استعادة المؤسسة.')
          : l('Support reply sent.', 'تم إرسال رد الدعم.'),
  },
)
function choose(item: any) {
  selected.value = item
  reason.value = ''
  reply.value = item.reply || ''
}
function apply() {
  const item = selected.value
  return command.run('apply', {
    operation: crypto.randomUUID(),
    id: item.id,
    revision: item.revision,
    reason: reason.value,
    action:
      section.value === 'organizations'
        ? 'organization_state'
        : section.value === 'users'
          ? 'identity_state'
          : 'support_reply',
    ...(section.value === 'support'
      ? { reply: reply.value }
      : { value: section.value === 'organizations' ? !item.archived : !item.suspended }),
  })
}
onMounted(() => load())
</script>
<template>
  <div class="container page platform-page">
    <PageHeading class="work-heading">
      <div>
        <p class="overline">{{ l('Platform operations', 'عمليات المنصة') }}</p>
        <h1>{{ l('Keep Rafik running well', 'إدارة عمليات رفيق') }}</h1>
        <p>
          {{
            l(
              'Operational access is audited. Institution roles do not grant platform authority.',
              'يُسجَّل الوصول التشغيلي. أدوار المؤسسات لا تمنح صلاحية إدارة المنصة.',
            )
          }}
        </p>
      </div>
    </PageHeading>
    <form class="platform-filters" @submit.prevent="load()">
      <label
        >{{ l('Area', 'القسم')
        }}<select v-model="section" @change="change">
          <option v-for="(label, key) in labels()" :key="key" :value="key">{{ label }}</option>
        </select></label
      ><label v-if="section !== 'audit'"
        >{{ l('Search', 'بحث')
        }}<input
          :placeholder="l('Search records…', 'ابحث في السجلات…')"
          v-model="search"
          type="search" /></label
      ><label v-if="section === 'audit'" class="check-label"
        ><input v-model="includeReads" type="checkbox" @change="load()" />{{
          l('Include directory access', 'تضمين الوصول إلى القوائم')
        }}</label
      ><button class="button secondary">{{ l('Refresh results', 'تحديث النتائج') }}</button>
    </form>
    <CommandStatus :command="command" />
    <section v-if="selected" class="card platform-action">
      <h2>{{ selected.name || selected.email || selected.subject }}</h2>
      <p v-if="section === 'support'" class="support-detail" dir="auto">{{ selected.detail }}</p>
      <p v-else>
        {{
          section === 'organizations'
            ? l(
                'Closing ends access for every institution member; reopening restores their existing memberships. History is preserved.',
                'يوقف الإغلاق وصول جميع أعضاء المؤسسة وتستعيد إعادة الفتح عضوياتهم الحالية. يُحفظ السجل.',
              )
            : l(
                'Suspension ends sign-in access and revokes current sessions. Restoring access requires a new sign-in. Records stay preserved.',
                'يوقف التعليق تسجيل الدخول ويلغي الجلسات الحالية. بعد استعادة الوصول يلزم تسجيل الدخول مجدداً. تبقى السجلات محفوظة.',
              )
        }}
      </p>
      <form @submit.prevent="apply">
        <fieldset :disabled="command.state.busy || !!command.state.pending">
          <label
            >{{ l('Reason for this action', 'سبب الإجراء')
            }}<textarea v-model="reason" minlength="10" maxlength="500" required /></label
          ><label v-if="section === 'support'"
            >{{ l('Reply in Rafik', 'الرد في رفيق')
            }}<textarea v-model="reply" maxlength="4000" required />
          </label>
          <div class="actions">
            <button class="button" :disabled="reason.trim().length < 10">
              {{ l('Confirm action', 'تأكيد الإجراء') }}</button
            ><button type="button" class="text-link danger-action" @click="selected = undefined">
              {{ l('Cancel', 'إلغاء') }}
            </button>
          </div>
        </fieldset>
      </form>
    </section>
    <PageState :loading="loading" :error="error" @retry="load()"
      ><p v-if="!items.length" class="notice">
        {{ l('No matching records.', 'لا توجد سجلات مطابقة.') }}
      </p>
      <div class="platform-records">
        <article v-for="item in items" :key="item.id" class="platform-row">
          <div class="grow">
            <h2 dir="auto">
              {{ item.name || item.email || item.subject || actionLabel(item.kind) }}
            </h2>
            <p v-if="section === 'institutions'">
              {{ item.archived ? l('Closed', 'مغلقة') : l('Open', 'مفتوحة') }} ·
              {{ item._count.workspace_members }} {{ l('members', 'عضو') }}
            </p>
            <p v-else-if="section === 'users'">
              {{
                item.operator
                  ? l('Platform operator', 'مشغل المنصة')
                  : item.suspended
                    ? l('Suspended', 'معلّق')
                    : l('Can sign in', 'يمكنه تسجيل الدخول')
              }}
            </p>
            <p v-else-if="section === 'support'">
              {{
                item.state === 'open'
                  ? l('Needs a response', 'بانتظار الرد')
                  : l('Resolved', 'تم الحل')
              }}
            </p>
            <template v-else
              ><p v-if="item.subject_label" dir="auto">{{ item.subject_label }}</p>
              <p>{{ item.reason }}</p>
              <small
                >{{ dateLabel(item.created_at) }} ·
                {{ item.actor_name || l('Deleted account', 'حساب محذوف') }}</small
              ></template
            >
          </div>
          <button
            v-if="section !== 'audit' && !item.operator"
            class="text-link"
            @click="choose(item)"
          >
            {{
              section === 'support'
                ? l('Read and respond', 'قراءة ورد')
                : section === 'organizations'
                  ? item.archived
                    ? l('Reopen', 'إعادة فتح')
                    : l('Close institution', 'إغلاق المؤسسة')
                  : item.suspended
                    ? l('Restore access', 'استعادة الوصول')
                    : l('Suspend access', 'تعليق الوصول')
            }}
          </button>
        </article>
      </div>
      <button v-if="next !== null" class="button secondary" @click="load(true)">
        {{ l('Load more', 'تحميل المزيد') }}
      </button></PageState
    >
  </div>
</template>
<style scoped>
.platform-page {
  max-width: 1100px;
}
.platform-filters {
  display: flex;
  align-items: end;
  gap: 16px;
  flex-wrap: wrap;
  margin: 24px 0;
}
.platform-filters label {
  flex: 1;
  min-width: 0;
}
.platform-row {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 20px 0;
  border-bottom: 1px solid var(--line);
}
.platform-row h2 {
  font-size: 1rem;
  overflow-wrap: anywhere;
  margin: 0;
}
.platform-row p {
  margin: 6px 0;
}
.platform-row small {
  overflow-wrap: anywhere;
}
.platform-action {
  margin: 24px 0;
}
.support-detail {
  white-space: pre-wrap;
}
.platform-row button {
  flex-shrink: 0;
}
@media (max-width: 600px) {
  .platform-filters {
    display: grid;
  }
  .platform-row {
    align-items: start;
    flex-direction: column;
    gap: 8px;
  }
}
</style>
