<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { request } from '../../lib/backend'
import { language as l, errorMessage } from '../../lib/i18n'
import { useCommand } from '../../lib/commands'
import CommandStatus from '../../components/CommandStatus.vue'
import PageState from '../../components/PageState.vue'
const categories = ['messages', 'feedback', 'calendar'] as const
type Pref = {
  categories: Record<(typeof categories)[number] | 'checkins', { in_app: boolean; email: boolean }>
  quiet_start: number
  quiet_end: number
  revision: number
  timezone: string
}
const data = ref<Pref>(),
  loading = ref(true),
  error = ref('')
const name = (key: string) =>
  ({
    messages: l('Messages', 'الرسائل'),
    feedback: l('Feedback and results', 'الملاحظات والنتائج'),
    calendar: l('Calendar changes and reminders', 'تغييرات التقويم والتذكيرات'),
  })[key] || key
async function load() {
  loading.value = true
  error.value = ''
  try {
    data.value = await request('/v1/notifications/preferences')
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
const command = useCommand<'save'>(
  'notification-preferences',
  async (_, result) => {
    data.value = result as Pref
  },
  (_, args) =>
    request('/v1/notifications/preferences', { method: 'POST', body: JSON.stringify(args) }),
  { successMessage: l('Notification preferences updated.', 'تم تحديث تفضيلات الإشعارات.') },
)
const locked = computed(() => command.state.busy || !!command.state.pending || !command.state.ready)
onMounted(load)
</script>
<template>
  <section class="notification-preferences">
    <h2>{{ l('Choose what reaches you', 'اختر ما يصلك') }}</h2>
    <p>
      {{
        l(
          'Account access uses your password. These controls only affect optional coaching updates.',
          'يستخدم الدخول كلمة المرور. هذه الإعدادات تخص تحديثات التدريب الاختيارية فقط.',
        )
      }}
    </p>
    <CommandStatus :command="command" /><PageState :loading="loading" :error="error" @retry="load"
      ><form v-if="data" @submit.prevent="command.run('save', data)">
        <fieldset class="form-fields" :disabled="locked">
          <div v-for="category in categories" :key="category" class="preference-row">
            <h3>{{ name(category) }}</h3>
            <label class="check-label"
              ><input type="checkbox" v-model="data.categories[category].in_app" />{{
                l('In-app inbox', 'صندوق التطبيق')
              }}</label
            ><label class="check-label"
              ><input type="checkbox" v-model="data.categories[category].email" />{{
                l('Email · intercepted locally', 'البريد · يُحتجز محلياً')
              }}</label
            >
          </div>
          <p class="notice">
            {{
              l(
                'No emails leave this local preview. Enabled email updates are captured by the local dispatcher for verification.',
                'لا تُرسل رسائل بريد خارج هذه المعاينة المحلية. تُحتجز التحديثات المفعلة محلياً للتحقق.',
              )
            }}
          </p>
          <h3>{{ l('Quiet hours for email', 'ساعات الهدوء للبريد') }}</h3>
          <p class="small-print">
            {{ data.timezone }} ·
            {{
              l(
                'Uses the timezone in Settings. Equal start and end disables quiet hours. The in-app inbox stays available.',
                'تستخدم المنطقة الزمنية في الإعدادات. تساوي البداية والنهاية يلغي ساعات الهدوء. يبقى صندوق التطبيق متاحاً.',
              )
            }}
          </p>
          <div class="quiet-hours">
            <label
              >{{ l('Quiet from', 'هدوء من')
              }}<select v-model.number="data.quiet_start">
                <option v-for="h in 24" :key="h" :value="h - 1">
                  {{ String(h - 1).padStart(2, '0') }}:00
                </option>
              </select></label
            ><label
              >{{ l('Until', 'حتى')
              }}<select v-model.number="data.quiet_end">
                <option v-for="h in 24" :key="h" :value="h - 1">
                  {{ String(h - 1).padStart(2, '0') }}:00
                </option>
              </select></label
            >
          </div>
          <button class="button">{{ l('Save preferences', 'حفظ التفضيلات') }}</button>
        </fieldset>
      </form></PageState
    >
  </section>
</template>
<style scoped>
.notification-preferences {
  max-width: 760px;
}
.notification-preferences h2 {
  font-size: 1.3rem;
}
.preference-row {
  padding: 18px 0;
  border-bottom: 1px solid var(--line);
  display: flex;
  gap: 20px;
  align-items: center;
  flex-wrap: wrap;
}
.preference-row h3 {
  font-size: 1rem;
  flex: 1;
  min-width: 180px;
  margin: 0;
}
.quiet-hours {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
  margin-block: 20px;
}
.notification-preferences .notice {
  margin-block: 24px;
}
.notification-preferences fieldset {
  min-width: 0;
}
@media (max-width: 400px) {
  .quiet-hours {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
