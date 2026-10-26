<script setup lang="ts">
import PageHeading from '../../components/PageHeading.vue'
import { computed, onMounted, ref, watch } from 'vue'
import { getDraft, storeDraft } from '../../lib/storage'
import { user } from '../../app/auth'
import { request } from '../../lib/backend'
import { language as l, errorMessage, dateLabel } from '../../lib/i18n'
import type { Database } from '@rafik/shared/database.types'
import { useCommand } from '../../lib/commands'
import CommandStatus from '../../components/CommandStatus.vue'
import PageState from '../../components/PageState.vue'
type Case = Database['public']['Tables']['support_cases']['Row']
const cases = ref<Case[]>([])
const loading = ref(true),
  error = ref(''),
  subject = ref(''),
  detail = ref(''),
  selected = ref(''),
  show = ref('open'),
  uuid = () => crypto.randomUUID()
const current = computed(() => cases.value.find((c) => c.id === selected.value))
async function load() {
  loading.value = true
  error.value = ''
  try {
    const collected: Case[] = []
    for (let offset = 0; ; offset += 100) {
      const page = await request<Case[]>('/v1/support?offset=' + offset)
      collected.push(...page)
      if (page.length < 100) break
    }
    cases.value = collected
    cases.value.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
const command = useCommand(
  'support',
  async (kind, result) => {
    if (kind === 'create_support_case') {
      selected.value = (result as Case).id
      subject.value = ''
      detail.value = ''
    }
    await load()
  },
  (action, args) =>
    request('/v1/support', {
      method: 'POST',
      body: JSON.stringify({ action, args }),
      feedback: 'none',
    }),
)
const locked = computed(
  () => command.state.busy || !!command.state.pending || !command.state.ready || !draftReady.value,
)
function choose(c: Case) {
  selected.value = c.id
}
const draftKey = `support-draft:${user.value!.id}`
const draftReady = ref(false)
watch([subject, detail], () => {
  if (draftReady.value)
    void storeDraft(draftKey, {
      subject: subject.value,
      detail: detail.value,
    }).catch((e) => {
      command.state.error = errorMessage(e)
    })
})
onMounted(async () => {
  await load()
  try {
    const draft = await getDraft<{ subject: string; detail: string }>(draftKey)
    if (draft) {
      subject.value = draft.subject
      detail.value = draft.detail
    }
  } catch (e) {
    command.state.error = errorMessage(e)
  }
  draftReady.value = true
})
</script>
<template>
  <div class="container page">
    <RouterLink class="back-link" to="/dashboard"
      >← {{ l('More tools', 'أدوات إضافية') }}</RouterLink
    >
    <PageHeading class="page-heading"
      ><div>
        <h1>{{ l('Support', 'الدعم') }}</h1>
        <p>
          {{
            l(
              'Explain the issue once. Keep the response with it.',
              'اشرح المشكلة مرة واحدة واحتفظ بالرد معها.',
            )
          }}
        </p>
      </div></PageHeading
    >
    <CommandStatus :command="command" /><PageState :loading="loading" :error="error" @retry="load"
      ><p class="notice">
        {{
          l(
            'Requests stay in this installation. Nothing is emailed or sent to Rafik. Requests are visible to an authorized platform administrator. Do not include athlete health details or private files.',
            'تبقى الطلبات في هذا التثبيت. لا يتم إرسال بريد أو إرسال معلومات إلى رفيق. يمكن لمسؤول المنصة المخوّل رؤية الطلبات. لا تُدرج تفاصيل صحية للرياضيين أو ملفات خاصة.',
          )
        }}
      </p>
      <div class="ongoing-layout support-layout" :class="{ 'without-cases': !cases.length }">
        <section class="form-stack">
          <label
            >{{ l('Show cases', 'عرض الطلبات')
            }}<select v-model="show">
              <option value="open">{{ l('Open', 'مفتوحة') }}</option>
              <option value="all">{{ l('All cases', 'كل الطلبات') }}</option>
            </select></label
          >
          <nav class="support-list" :aria-label="l('Support cases', 'طلبات الدعم')">
            <button
              v-for="c in cases.filter((c) => show === 'all' || c.state === 'open')"
              :key="c.id"
              :class="{ selected: c.id === selected }"
              @click="choose(c)"
            >
              <strong>{{ c.subject }}</strong
              ><span
                >{{ c.state === 'open' ? l('Open', 'مفتوح') : l('Resolved', 'محلول') }} ·
                {{ dateLabel(c.updated_at) }}</span
              >
            </button>
          </nav>
          <p v-if="!cases.length" class="notice">
            {{ l('No support requests yet.', 'لا توجد طلبات دعم بعد.') }}
          </p>
          <article v-if="current" class="panel support-detail">
            <span class="tag" :data-status="current.state">{{
              current.state === 'open' ? l('Open', 'مفتوح') : l('Resolved', 'محلول')
            }}</span>
            <h2>{{ current.subject }}</h2>
            <p class="preserve-lines">{{ current.detail }}</p>
            <p v-if="current.reply" class="notice preserve-lines">{{ current.reply }}</p>
            <button
              v-if="current.reporter_id === user!.id"
              class="text-link"
              :disabled="locked"
              @click="
                command.run('update_support_case', {
                  p_id: current.id,
                  p_revision: current.revision,
                  p_state: current.state === 'open' ? 'resolved' : 'open',
                })
              "
            >
              {{
                current.state === 'open'
                  ? l('Mark resolved', 'تحديد كمحلول')
                  : l('Reopen request', 'إعادة فتح الطلب')
              }}
            </button>
          </article>
        </section>
        <form
          class="panel form-stack"
          @submit.prevent="
            command.run('create_support_case', {
              p_id: uuid(),
              p_subject: subject,
              p_detail: detail,
            })
          "
        >
          <h2>{{ l('New support request', 'طلب دعم جديد') }}</h2>
          <fieldset class="command-fields" :disabled="locked">
            <label
              >{{ l('Subject', 'الموضوع')
              }}<input v-model="subject" maxlength="120" required /></label
            ><label
              >{{ l('What happened?', 'ماذا حدث؟')
              }}<textarea v-model="detail" maxlength="4000" rows="6" required></textarea></label
            ><button class="button">{{ l('Save support request', 'حفظ طلب الدعم') }}</button>
          </fieldset>
        </form>
      </div></PageState
    >
  </div>
</template>

<style scoped>
.support-layout.without-cases {
  grid-template-columns: minmax(0, 1fr);
}
.support-layout.without-cases > section {
  gap: var(--space-3);
}
.support-layout.without-cases .support-list:empty {
  display: none;
}
</style>
