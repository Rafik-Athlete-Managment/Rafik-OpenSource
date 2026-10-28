<script setup lang="ts">
import { preferredTimezone } from '../../lib/display-time'
import PageHeading from '../../components/PageHeading.vue'
import { computed, onMounted, ref } from 'vue'
import { PhChatCircle, PhCalendarBlank, PhBell, PhStar, PhChecks } from '@phosphor-icons/vue'
import { useRoute, useRouter } from 'vue-router'
import { request } from '../../lib/backend'
import { language as l, errorMessage, locale } from '../../lib/i18n'
import PageState from '../../components/PageState.vue'
import NotificationPreferences from './NotificationPreferences.vue'
const route = useRoute(),
  router = useRouter()
type Notice = {
  id: string
  category: string
  kind: string
  context: string
  href: string
  created_at: string
  read_at: string | null
  state: string
}
const items = ref<Notice[]>([]),
  next = ref<number | null>(null),
  loading = ref(true),
  error = ref(''),
  preferences = ref(route.query.preferences === 'true'),
  busy = ref('')
const title = (item: Notice) =>
  item.category === 'messages'
    ? l('New conversation updates', 'تحديثات جديدة في المحادثة')
    : item.kind.endsWith('reminder')
      ? l('An upcoming event', 'موعد قادم')
      : item.category === 'calendar'
        ? l('A calendar update', 'تحديث في التقويم')
        : l('Feedback or results are ready', 'الملاحظات أو النتائج جاهزة')
const stamp = (value: string) =>
  new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar-AE' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: preferredTimezone.value,
  }).format(new Date(value))
async function load(append = false) {
  loading.value = true
  error.value = ''
  try {
    const result = await request<{ items: Notice[]; next: number | null }>(
      `/v1/notifications?offset=${append ? next.value || 0 : 0}`,
    )
    items.value = append ? [...items.value, ...result.items] : result.items
    next.value = result.next
    if (!append && typeof route.query.event === 'string') {
      const linked = await request<{ items: Notice[] }>(
        '/v1/notifications?id=' + encodeURIComponent(route.query.event),
      )
      items.value = Array.from(
        new Map([...linked.items, ...items.value].map((n) => [n.id, n])).values(),
      )
    }
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
async function open(item: Notice, navigate = true) {
  busy.value = item.id
  error.value = ''
  try {
    await request('/v1/notifications', { method: 'POST', body: JSON.stringify({ id: item.id }) })
    item.read_at = new Date().toISOString()
    if (navigate) await router.push(item.href)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = ''
  }
}
const unread = computed(() => items.value.filter((item) => !item.read_at))
const icon = (item: Notice) =>
  item.category === 'messages'
    ? PhChatCircle
    : item.kind.endsWith('reminder')
      ? PhBell
      : item.category === 'calendar'
        ? PhCalendarBlank
        : PhStar
// No bulk endpoint: acknowledge the loaded unread updates one at a time, stopping on the first error.
async function markAll() {
  for (const item of unread.value) {
    await open(item, false)
    if (error.value) break
  }
}
onMounted(() => load())
</script>
<template>
  <div class="container page notifications-page">
    <PageHeading class="work-heading">
      <div>
        <p class="overline">{{ l('Your updates', 'تحديثاتك') }}</p>
        <h1>{{ l('Notifications', 'الإشعارات') }}</h1>
        <p>
          {{
            l(
              'Updates from your institution, with links to the work that needs your attention.',
              'تحديثات من مؤسستك مع روابط إلى العمل الذي يحتاج إلى انتباهك.',
            )
          }}
        </p>
      </div>
      <button class="button secondary" @click="preferences = !preferences">
        {{
          preferences
            ? l('Back to updates', 'العودة للتحديثات')
            : l('Notification preferences', 'تفضيلات الإشعارات')
        }}
      </button>
    </PageHeading>
    <NotificationPreferences v-if="preferences" /><template v-else
      ><div class="notification-toolbar">
        <p class="small-print">
          <strong v-if="unread.length"
            >{{ unread.length }} {{ l('unread', 'غير مقروءة') }} · </strong
          >{{
            l(
              'Latest update per conversation or event · kept for 30 days.',
              'أحدث تحديث لكل محادثة أو موعد · يُحفظ لمدة 30 يوماً.',
            )
          }}
        </p>
        <button
          v-if="unread.length > 1"
          class="button secondary small"
          :disabled="!!busy"
          @click="markAll"
        >
          <PhChecks :size="18" aria-hidden="true" />{{ l('Mark all read', 'تعليم الكل كمقروء') }}
        </button>
        <button class="text-link" @click="load()">{{ l('Refresh', 'تحديث') }}</button>
      </div>
      <PageState :loading="loading" :error="error" @retry="load()"
        ><section v-if="!items.length" class="empty-state panel">
          <PhBell :size="28" aria-hidden="true" />
          <h2>
            {{
              next === null
                ? l('You’re up to date', 'أنت على اطلاع')
                : l('No current updates on this page', 'لا توجد تحديثات حالية في هذه الصفحة')
            }}
          </h2>
          <p>
            {{
              l(
                'New messages, feedback and calendar updates will appear here. Optional reminders are prepared by the local dispatcher.',
                'ستظهر الرسائل الجديدة والملاحظات وتحديثات التقويم هنا. تُجهز التذكيرات الاختيارية عبر الموزع المحلي.',
              )
            }}
          </p>
          <RouterLink to="/dashboard" class="text-link">{{
            l('Open dashboard', 'فتح لوحة التحكم')
          }}</RouterLink>
        </section>
        <ol v-else class="notification-list">
          <li
            v-for="item in items"
            :key="item.id"
            class="notification-row"
            :class="{ unread: !item.read_at }"
          >
            <span class="notification-icon"
              ><component :is="icon(item)" :size="18" aria-hidden="true"
            /></span>
            <div class="notification-text">
              <button class="notification-open" :disabled="!!busy" @click="open(item)">
                <span v-if="!item.read_at" class="sr-only">{{ l('Unread: ', 'غير مقروء: ') }}</span
                >{{ title(item) }}
              </button>
              <small>
                <time :datetime="item.created_at">{{ stamp(item.created_at) }}</time
                ><template v-if="item.context === 'independent'">
                  · {{ l('Independent coaching', 'التدريب المستقل') }}</template
                >
              </small>
              <p class="small-print" v-if="item.state === 'intercepted'">
                {{
                  l(
                    'Email intercepted locally · not sent externally',
                    'البريد محتجز محلياً · لم يُرسل خارجياً',
                  )
                }}
              </p>
              <p class="small-print" v-if="item.state === 'failed'">
                {{
                  l(
                    'Reminder delivery failed. This update is still available here.',
                    'فشل تسليم التذكير. يبقى التحديث متاحاً هنا.',
                  )
                }}
              </p>
            </div>
            <button
              v-if="!item.read_at"
              class="text-link"
              :disabled="!!busy"
              @click="open(item, false)"
            >
              {{ l('Mark read', 'تعليم كمقروء') }}
            </button>
          </li>
        </ol>
        <button v-if="next !== null" class="button secondary" @click="load(true)">
          {{ l('Earlier updates', 'التحديثات الأقدم') }}
        </button></PageState
      ></template
    >
  </div>
</template>
<style scoped>
.notification-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3) var(--space-4);
  margin-block-end: var(--space-4);
}
.notification-toolbar p {
  margin: 0 auto 0 0;
  color: var(--muted);
}
.notification-toolbar p:dir(rtl) {
  margin: 0 0 0 auto;
}
.notification-toolbar strong {
  color: var(--ink);
}
.notification-list {
  margin: 0 0 var(--space-5);
  padding: 0;
  list-style: none;
  border: 1px solid var(--line);
  border-radius: var(--radius-panel);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}
.notification-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
}
.notification-row + .notification-row {
  border-top: 1px solid var(--line);
}
.notification-icon {
  position: relative;
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  background: var(--surface-soft);
  color: var(--muted);
}
.notification-row.unread .notification-icon {
  background: var(--tint);
  color: var(--accent);
}
/* Unread dot: colour is supplementary; the button text also says Unread to assistive tech. */
.notification-row.unread .notification-icon::after {
  content: '';
  position: absolute;
  inset-block-start: 0;
  inset-inline-end: 0;
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--accent);
  border: 2px solid var(--surface);
}
.notification-text {
  display: grid;
  gap: 2px;
  min-width: 0;
  overflow-wrap: anywhere;
}
.notification-open {
  justify-self: start;
  padding: 0;
  border: 0;
  background: none;
  color: var(--ink);
  font-weight: 500;
  text-align: start;
  min-height: 32px;
}
.notification-row.unread .notification-open {
  font-weight: 700;
}
.notification-open:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}
.notification-text small {
  color: var(--muted);
}
.notification-text p {
  margin: 0;
}
@media (max-width: 550px) {
  .notification-row {
    grid-template-columns: auto minmax(0, 1fr);
  }
  .notification-row > .text-link {
    grid-column: 2;
    justify-self: start;
  }
}
</style>
