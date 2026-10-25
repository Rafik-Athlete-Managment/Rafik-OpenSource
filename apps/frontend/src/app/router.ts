import { nextTick } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { ready, user, contexts, refreshContexts } from './auth'
const institutionScroll = new Map<string, number>()
let cancelScrollRestore = () => {}
// Returning routes load asynchronously: don't clamp a saved position to the loading skeleton.
function restoreInstitutionScroll(main: HTMLElement, top: number) {
  cancelScrollRestore()
  if (!top) {
    main.scrollTop = 0
    return
  }
  const controller = new AbortController()
  const observer = new MutationObserver(restore)
  const timeout = window.setTimeout(() => {
    main.scrollTop = top
    cancel()
  }, 10000)
  function cancel() {
    observer.disconnect()
    window.clearTimeout(timeout)
    controller.abort()
  }
  function restore() {
    if (main.scrollHeight - main.clientHeight >= top) {
      main.scrollTop = top
      cancel()
    }
  }
  cancelScrollRestore = cancel
  for (const event of ['wheel', 'pointerdown', 'keydown'])
    window.addEventListener(event, cancel, { once: true, passive: true, signal: controller.signal })
  observer.observe(main, { childList: true, subtree: true, characterData: true })
  restore()
}
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/platform',
      component: () => import('../features/platform/PlatformPage.vue'),
      meta: { private: true },
    },
    {
      path: '/deliver/:id',
      component: () => import('../features/coaching/DeliverPlan.vue'),
      meta: { private: true, institution: true },
    },
    {
      path: '/training',
      component: () => import('../features/institution/TrainingRoute.vue'),
      meta: { private: true, institution: true },
    },
    {
      path: '/events',
      component: () => import('../features/institution/ScheduledEvents.vue'),
      meta: { private: true, institution: true },
    },
    {
      path: '/workouts',
      component: () => import('../features/institution/SessionHistory.vue'),
      meta: { private: true, institution: true },
    },
    {
      path: '/review/:id',
      component: () => import('../features/coaching/ReviewPage.vue'),
      meta: { private: true, institution: true },
    },
    {
      path: '/plans',
      component: () => import('../features/coaching/PlansPage.vue'),
      meta: { private: true, institution: true },
    },
    {
      path: '/plans/:id',
      component: () => import('../features/coaching/PlanEditor.vue'),
      meta: { private: true, institution: true },
    },
    {
      path: '/feedback',
      component: () => import('../features/institution/FeedbackPage.vue'),
      meta: { private: true, institution: true },
    },

    {
      path: '/exercises',
      component: () => import('../features/coaching/ExercisesPage.vue'),
      meta: { private: true, institution: true },
    },

    {
      path: '/exercises/:editor',
      component: () => import('../features/coaching/ExercisesPage.vue'),
      meta: { private: true, institution: true },
    },
    {
      path: '/resources',
      component: () => import('../features/resources/ResourcesPage.vue'),
      meta: { private: true, institution: true },
    },
    {
      path: '/nutrition',
      component: () => import('../features/nutrition/NutritionRoute.vue'),
      meta: { private: true, institution: true },
    },
    {
      path: '/injuries',
      component: () => import('../features/institution/InjuryStatus.vue'),
      meta: { private: true, institution: true },
    },
    {
      path: '/analytics',
      component: () => import('../features/analytics/AnalyticsPage.vue'),
      meta: { private: true, institution: true },
    },
    {
      path: '/messages/:channel?',
      component: () => import('../features/institution/ChannelsPage.vue'),
      meta: { private: true, institution: true },
    },
    {
      path: '/schedule',
      component: () => import('../features/institution/ScheduleCalendar.vue'),
      meta: { private: true, institution: true },
    },
    {
      path: '/schedule/new',
      component: () => import('../features/institution/EventComposer.vue'),
      meta: { private: true, institution: true },
    },
    {
      path: '/schedule/:id',
      component: () => import('../features/institution/EventDetail.vue'),
      meta: { private: true, institution: true },
    },
    {
      path: '/groups',
      component: () => import('../features/institution/ServiceCatalog.vue'),
      meta: { private: true, institution: true },
    },

    {
      path: '/groups/:editor',
      component: () => import('../features/institution/ServiceCatalog.vue'),
      meta: { private: true, institution: true },
    },
    {
      path: '/assessment-templates',
      component: () => import('../features/institution/ServiceCatalog.vue'),
      meta: { private: true, institution: true },
    },

    {
      path: '/assessment-templates/:editor',
      component: () => import('../features/institution/ServiceCatalog.vue'),
      meta: { private: true, institution: true },
    },
    {
      path: '/record/:session',
      component: () => import('../features/institution/DelegatedWorkout.vue'),
      meta: { private: true, institution: true },
    },
    {
      path: '/members/:member',
      alias: '/athletes/:member',
      component: () => import('../features/institution/AthleteProfile.vue'),
      meta: { private: true, institution: true },
    },
    {
      path: '/assessments/:member',
      component: () => import('../features/institution/AssessmentHistory.vue'),
      meta: { private: true, institution: true },
    },
    {
      path: '/dashboard',
      component: () => import('../features/institution/DashboardPage.vue'),
      meta: { private: true, institution: true },
    },
    ...(['people', 'activity', 'institution-settings'] as const).map((section) => ({
      path: '/' + section,
      component: () => import('../features/institution/DashboardPage.vue'),
      meta: {
        private: true,
        institution: true,
        section: section === 'institution-settings' ? 'settings' : section,
        adminOnly: section !== 'people',
      },
    })),
    {
      path: '/access',
      component: () => import('../features/account/AccessPage.vue'),
      meta: { private: true },
    },
    {
      path: '/invitation/:token',
      component: () => import('../features/institution/InvitationPage.vue'),
    },

    { path: '/', component: () => import('../features/account/EntryPage.vue') },
    { path: '/setup', component: () => import('../features/account/SetupPage.vue') },
    {
      path: '/password-setup/:token',
      component: () => import('../features/account/PasswordSetupPage.vue'),
    },
    {
      path: '/notifications',
      component: () => import('../features/notifications/NotificationsPage.vue'),
      meta: { private: true },
    },
    {
      path: '/workout/:id',
      component: () => import('../features/training/WorkoutPage.vue'),
      meta: { private: true, institution: true },
    },
    { path: '/login', component: () => import('../features/account/LoginPage.vue') },
    {
      path: '/settings',
      component: () => import('../features/account/SettingsPage.vue'),
      meta: { private: true },
    },
    {
      path: '/support',
      component: () => import('../features/support/SupportPage.vue'),
      meta: { private: true },
    },
    ...(import.meta.env.DEV
      ? [
          {
            path: '/local-preview',
            component: () => import('../features/account/LocalPreview.vue'),
          },
        ]
      : []),
    { path: '/help', component: () => import('../features/account/HelpPage.vue') },
    { path: '/privacy', component: () => import('../features/public/PrivacyPage.vue') },
    { path: '/:pathMatch(.*)*', component: () => import('../features/public/NotFound.vue') },
  ],
  async scrollBehavior(to, from, saved) {
    await nextTick()
    const main = document.querySelector<HTMLElement>('.dashboard-frame > main')
    if (main && window.matchMedia('(min-width: 1024px)').matches) {
      if (to.hash) document.getElementById(to.hash.slice(1))?.scrollIntoView({ block: 'start' })
      else if (to.path !== from.path)
        restoreInstitutionScroll(main, saved ? institutionScroll.get(to.fullPath) || 0 : 0)
      return false
    }
    if (saved) return saved
    if (to.hash) return { el: to.hash, top: 100 }
    if (to.path === from.path) return
    return { top: 0 }
  },
})
router.beforeEach(async (to, from) => {
  cancelScrollRestore()
  const main = document.querySelector<HTMLElement>('.dashboard-frame > main')
  if (main) {
    institutionScroll.set(from.fullPath, main.scrollTop)
    if (institutionScroll.size > 100)
      institutionScroll.delete(institutionScroll.keys().next().value!)
  }
  await ready()
  if (to.meta.private && !user.value) return { path: '/login', query: { next: to.fullPath } }
  if (!user.value) return
  const institutionRoute = to.meta.institution
  if (institutionRoute) {
    // Do not reuse stale membership after a failed authorization read.
    try {
      await refreshContexts()
    } catch {
      return { path: '/access', query: { reason: 'connection' } }
    }
    const institution = contexts.value.find((c) => c.kind === 'institution')
    if (!institution) return '/access'
    if (to.meta.adminOnly && institution.role !== 'admin') return '/dashboard'
    if (
      institution.role === 'trainee' &&
      (['/people', '/analytics', '/groups', '/assessment-templates', '/exercises'].some(
        (path) => to.path === path || to.path.startsWith(path + '/'),
      ) ||
        to.path.startsWith('/deliver/') ||
        to.path.startsWith('/record/') ||
        to.path === '/plans/new' ||
        to.path === '/schedule/new')
    )
      return '/dashboard'
  }
})
export const safeNext = (value: unknown, fallback = '/dashboard') =>
  typeof value === 'string' &&
  value.startsWith('/') &&
  !value.startsWith('//') &&
  !value.includes('\\')
    ? value
    : fallback
router.afterEach((to, from) => {
  if (from.matched.length && to.path !== from.path)
    void nextTick(() => document.querySelector<HTMLElement>('main')?.focus({ preventScroll: true }))
})
export default router
