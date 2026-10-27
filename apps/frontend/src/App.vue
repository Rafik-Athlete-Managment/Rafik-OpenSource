<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import DashboardNav from './features/navigation/DashboardNav.vue'
import {
  DialogRoot,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from 'reka-ui'
import { PhArrowUpRight, PhTranslate, PhBell, PhList, PhX } from '@phosphor-icons/vue'
import { user, profile, ready, contexts, platform } from './app/auth'
import { language, locale, t } from './lib/i18n'
import { localPreview } from './lib/backend'
import { syncPending } from './lib/training'
import { brandingLogoUrl, instanceBranding, loadBranding, syncAccentContrast } from './lib/branding'
const route = useRoute()
const currentContext = computed(() => contexts.value.find((c) => c.kind === 'institution'))
const messaging = computed(
  () =>
    /^\/messages(\/|$)/.test(route.path) ||
    /^\/organization\/[^/]+\/[^/]+\/messages(\/|$)/.test(route.path),
)
const focused = computed(() => route.path.startsWith('/workout/'))
const entryScreen = computed(() => ['/', '/setup', '/login'].includes(route.path))
const product = computed(
  () =>
    user.value &&
    !['/', '/login', '/privacy', '/help', '/local-preview'].includes(route.path) &&
    !route.path.startsWith('/invitation/'),
)
const dashboard = computed(
  () =>
    product.value &&
    !focused.value &&
    currentContext.value?.kind === 'institution' &&
    !['/access', '/platform'].includes(route.path),
)
const dashboardBase = computed(() => '')
const menuOpen = ref(false)
const themeReady = ref(false)
watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false
  },
)
const theme = ref(localStorage.getItem('rafik.theme') || 'dark')
function setTheme() {
  localStorage.setItem('rafik.theme', theme.value)
  document.documentElement.dataset.theme = theme.value
  syncAccentContrast()
}
watch(theme, setTheme, { immediate: true })
const online = () => {
  if (user.value) void syncPending(user.value.id)
}
onMounted(async () => {
  const sessionInitialization = ready()
  await loadBranding().catch(() => {})
  themeReady.value = true
  await sessionInitialization
  window.addEventListener('online', online)
  online()
})
onUnmounted(() => window.removeEventListener('online', online))
</script>
<template>
  <div v-if="!themeReady" class="theme-loader" role="status" aria-live="polite" aria-busy="true">
    <span class="theme-loader-spinner" aria-hidden="true"></span>
    <span>{{ language('Loading your theme…', 'جارٍ تحميل المظهر…') }}</span>
  </div>
  <div
    v-else
    class="app-frame"
    :class="{ 'dashboard-frame': dashboard, 'conversation-frame': messaging }"
  >
    <a class="skip-link" href="#main">{{ language('Skip to content', 'انتقل إلى المحتوى') }}</a>
    <header
      class="site-header"
      :class="{ compact: focused, 'institution-header': user && !focused }"
    >
      <div class="header-inner">
        <DialogRoot v-if="dashboard" v-model:open="menuOpen">
          <DialogTrigger
            class="icon-button dashboard-menu-trigger"
            :aria-label="language('Open navigation', 'فتح التنقل')"
            ><PhList :size="22"
          /></DialogTrigger>
          <DialogPortal
            ><DialogOverlay class="dashboard-overlay" /><DialogContent class="dashboard-drawer"
              ><div class="drawer-heading">
                <DialogTitle>{{ language('Institution navigation', 'تنقل المؤسسة') }}</DialogTitle
                ><DialogClose
                  class="icon-button"
                  :aria-label="language('Close navigation', 'إغلاق التنقل')"
                  ><PhX :size="20"
                /></DialogClose>
              </div>
              <DialogDescription class="sr-only">{{
                language('Choose an institution section.', 'اختر قسماً في المؤسسة.')
              }}</DialogDescription
              ><DashboardNav
                :base="dashboardBase"
                :role="currentContext?.role || 'admin'"
                @navigate="menuOpen = false"
              />
              <div class="dashboard-utilities">
                <RouterLink v-if="platform" to="/platform">{{
                  language('Platform operations', 'عمليات المنصة')
                }}</RouterLink>
                <RouterLink to="/support">{{ language('Support', 'الدعم') }}</RouterLink>
                <RouterLink v-if="currentContext?.role === 'trainer'" to="/feedback">{{
                  language('My feedback', 'تقييماتي')
                }}</RouterLink>
                <RouterLink to="/help">{{ t('help') }}</RouterLink
                ><RouterLink to="/settings">{{ t('settings') }}</RouterLink
                ><RouterLink v-if="localPreview" to="/local-preview">{{
                  t('localPreview')
                }}</RouterLink
                ><RouterLink to="/privacy">{{ t('privacy') }}</RouterLink
                ><label
                  ><span class="sr-only">{{ language('Appearance', 'المظهر') }}</span
                  ><select v-model="theme">
                    <option value="system">{{ language('System theme', 'مظهر النظام') }}</option>
                    <option value="light">{{ language('Light', 'فاتح') }}</option>
                    <option value="dark">{{ language('Dark', 'داكن') }}</option>
                  </select></label
                >
              </div></DialogContent
            ></DialogPortal
          >
        </DialogRoot>
        <RouterLink
          class="brand"
          :to="user ? currentContext?.path || '/dashboard' : '/'"
          :aria-label="`${instanceBranding.name} home`"
          ><img
            :src="instanceBranding.logo_mime ? brandingLogoUrl() : '/brand/rafik.png'"
            alt=""
            width="38"
            height="38"
          /><span
            >{{ instanceBranding.name }}<span class="brand-period">.</span
            ><small v-if="instanceBranding.name !== 'Rafik'">{{
              language('Powered by Rafik', 'بدعم من رفيق')
            }}</small></span
          ></RouterLink
        >
        <div class="header-actions">
          <button
            class="icon-button language-button"
            @click="locale = locale === 'en' ? 'ar' : 'en'"
            :aria-label="language('Switch to Arabic', 'التبديل إلى الإنجليزية')"
          >
            <PhTranslate :size="20" aria-hidden="true" /><span>{{
              locale === 'en' ? 'العربية' : 'EN'
            }}</span>
          </button>
          <RouterLink
            v-if="user && !focused"
            to="/notifications"
            class="icon-button notification-entry"
            :aria-label="language('Notifications', 'الإشعارات')"
            :title="language('Notifications', 'الإشعارات')"
            ><PhBell :size="20" aria-hidden="true"
          /></RouterLink>
          <RouterLink v-if="user && !focused" class="account-link" to="/settings"
            ><span class="avatar small">{{ (profile?.display_name || 'R').slice(0, 1) }}</span
            ><span class="account-name">{{
              profile?.display_name?.split(' ')[0] || t('settings')
            }}</span>
          </RouterLink>
          <RouterLink
            v-if="!user && !focused && !entryScreen"
            class="button small secondary"
            to="/login"
            >{{ t('signIn') }}<PhArrowUpRight :size="17" aria-hidden="true"
          /></RouterLink>
        </div>
      </div>
    </header>
    <aside
      v-if="dashboard"
      class="dashboard-sidebar"
      :aria-label="language('Institution sidebar', 'الشريط الجانبي لمساحة العمل')"
    >
      <DashboardNav :base="dashboardBase" :role="currentContext?.role || 'admin'" />
      <div class="dashboard-utilities">
        <RouterLink v-if="platform" to="/platform">{{
          language('Platform operations', 'عمليات المنصة')
        }}</RouterLink>
        <RouterLink to="/support">{{ language('Support', 'الدعم') }}</RouterLink>
        <RouterLink v-if="currentContext?.role === 'trainer'" to="/feedback">{{
          language('My feedback', 'تقييماتي')
        }}</RouterLink>
        <RouterLink to="/help">{{ t('help') }}</RouterLink
        ><RouterLink to="/settings">{{ t('settings') }}</RouterLink
        ><RouterLink v-if="localPreview" to="/local-preview">{{ t('localPreview') }}</RouterLink
        ><RouterLink to="/privacy">{{ t('privacy') }}</RouterLink
        ><label
          ><span class="sr-only">{{ language('Appearance', 'المظهر') }}</span
          ><select v-model="theme">
            <option value="system">{{ language('System theme', 'مظهر النظام') }}</option>
            <option value="light">{{ language('Light', 'فاتح') }}</option>
            <option value="dark">{{ language('Dark', 'داكن') }}</option>
          </select></label
        >
      </div>
    </aside>
    <main id="main" :class="{ 'messages-main': messaging }" tabindex="-1">
      <RouterView
        :key="
          (user?.id || '') +
          ':' +
          (currentContext?.id || '') +
          ':' +
          (messaging ? route.path.replace(/(\/messages)(\/[^/]+)?$/, '$1') : route.path) +
          (route.path.endsWith('/plans/new')
            ? JSON.stringify([route.query.source, route.query.member])
            : '')
        "
      />
    </main>
    <footer v-if="!focused && !dashboard && !entryScreen" class="footer container">
      <span class="footer-brand">{{
        language('A little clarity. Every session.', 'وضوح أكثر. في كل حصة.')
      }}</span>
      <nav :aria-label="language('Footer', 'أسفل الصفحة')">
        <RouterLink to="/help">{{ t('help') }}</RouterLink
        ><RouterLink to="/privacy">{{ t('privacy') }}</RouterLink
        ><RouterLink v-if="localPreview" to="/local-preview">{{ t('localPreview') }}</RouterLink>
      </nav>
      <label class="theme-select"
        ><span class="sr-only">{{ language('Appearance', 'المظهر') }}</span
        ><select v-model="theme">
          <option value="system">{{ language('System theme', 'مظهر النظام') }}</option>
          <option value="light">{{ language('Light', 'فاتح') }}</option>
          <option value="dark">{{ language('Dark', 'داكن') }}</option>
        </select></label
      >
    </footer>
  </div>
</template>
