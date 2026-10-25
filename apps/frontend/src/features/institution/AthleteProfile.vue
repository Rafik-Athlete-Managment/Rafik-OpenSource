<script setup lang="ts">
import { institutionContext } from '../../app/institution'

import { PhTray } from '@phosphor-icons/vue'
import PageHeading from '../../components/PageHeading.vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import type { AthletePlanPage } from '@rafik/shared/contracts'
import { request } from '../../lib/backend'
import { language as l, errorMessage, dateLabel } from '../../lib/i18n'
import { formatDate } from '../../lib/dates'
import { locale } from '../../lib/i18n'
import { TabsRoot, TabsList, TabsTrigger, TabsContent } from 'reka-ui'
import MemberManagement from './MemberManagement.vue'
import type { Member, Sport } from './types'

/**
 * Staff athlete profile. Every section calls an existing authorized endpoint; hidden sections
 * are a convenience, never the permission boundary (the API refuses anything out of scope).
 */
const route = useRoute(),
  institution = institutionContext().institution,
  view = institutionContext().view,
  memberId = String(route.params.member),
  base = '',
  ws = `/v1/institution`
// Sections report refusals inline, so these reads never raise global error toasts.
const backPath = computed(() => {
  const target = String(route.query.returnTo || '')
  return target === base + '/people' || target.startsWith(base + '/people?')
    ? target
    : base + '/people'
})
const get = <T,>(path: string) => request<T>(path, { feedback: 'none' })
type Section<T> = { loading: boolean; error: string; denied: boolean; data?: T }
const section = <T,>() => ref<Section<T>>({ loading: true, error: '', denied: false })
type CoachAnalytics = {
  from: string
  to: string
  primary_athletes: number
  supporting_links: number
  completed_events: number
  upcoming_events: number
  recorded_workouts: number
}
const analytics = ref<CoachAnalytics | null>(null)
const activeTab = ref(view === 'admin' && route.query.tab === 'manage' ? 'manage' : 'overview')
const athlete = computed(() => member.value?.roles.includes('trainee'))
const title = computed(() =>
  athlete.value
    ? l('Athlete profile', 'ملف الرياضي')
    : member.value?.roles.includes('trainer')
      ? l('Coach profile', 'ملف المدرب')
      : l('Administrator profile', 'ملف المسؤول'),
)
let alive = true,
  epoch = 0
onUnmounted(() => {
  alive = false
  epoch++
})
const self = ref(''),
  member = ref<Member>(),
  names = ref<{ id: string; name: string }[]>([]),
  sports = ref<Sport[]>([]),
  overview = section<Member>(),
  plans = section<AthletePlanPage>(),
  sessions = section<
    {
      id: string
      title: string
      started_at: string
      status: string
      reviewed_at?: string
      recorded_mode?: string
    }[]
  >(),
  assessments = section<{ event_id: string; title: string; starts_at: string }[]>(),
  nutrition = section<{
    current: { revision: number; effective_on: string; expires_on: string | null } | null
    sharing: { enabled: boolean }
    canReadDiary: boolean
  }>(),
  participation = section<
    | { kind: 'status'; participation: string; effective_from: string }
    | { kind: 'none' }
    | {
        kind: 'consent'
        ready: boolean
        age_group: string | null
        assented: boolean
        withdrawn: boolean
      }
  >()
// The role relation decides which sections to request; the server decides what is returned.
const relation = computed(() =>
  view === 'admin'
    ? 'admin'
    : member.value?.trainer_id === self.value
      ? 'primary'
      : member.value?.coaches?.some((c) => c.coach === self.value)
        ? 'supporting'
        : 'other',
)
const sportName = (id: string | null) => sports.value.find((s) => s.id === id)?.name || ''
const nameOf = (id: string | null) =>
  names.value.find((n) => n.id === id)?.name || l('Not assigned', 'غير معيّن')
const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10)
async function fill<T>(target: { value: Section<T> }, load: () => Promise<T>) {
  const current = epoch
  target.value = { loading: true, error: '', denied: false }
  try {
    const data = await load()
    if (!alive || current !== epoch) return
    target.value = { loading: false, error: '', denied: false, data }
  } catch (e) {
    if (!alive || current !== epoch) return
    const status = (e as { statusCode?: number }).statusCode
    target.value = {
      loading: false,
      denied: status === 403,
      error: status === 403 ? '' : errorMessage(e),
    }
  }
}
async function load() {
  if (!alive) return
  const current = ++epoch
  await fill(overview, async () => {
    const [institutionView, people, list] = await Promise.all([
      get<{ self: { id: string } }>(`${ws}?view=${view}&summary=false`),
      get<{
        member: Member
        names: { id: string; name: string }[]
        analytics: CoachAnalytics | null
      }>(`${ws}/people/${memberId}?view=${view}`),
      get<{ items: Sport[] }>(`${ws}/sports?view=${view}`).catch(() => ({ items: [] })),
    ])
    if (!alive || current !== epoch) throw new Error('Cancelled')
    analytics.value = people.analytics
    self.value = institutionView.self.id
    names.value = people.names
    sports.value = list.items
    const found = people.member
    if (!found) throw Object.assign(new Error('forbidden'), { statusCode: 403 })
    member.value = found
    return found
  })
  if (!alive || current !== epoch || !member.value || !athlete.value || view === 'trainee') return
  const jobs = [
    fill(plans, () =>
      get<AthletePlanPage>(`${ws}/athlete-plans?view=${view}&status=active&member=${memberId}`),
    ),
    fill(sessions, async () =>
      (
        await get<{ sessions: NonNullable<typeof sessions.value.data> }>(
          `${ws}/delivery?view=${view}&history=true&member=${memberId}`,
        )
      ).sessions.slice(0, 5),
    ),
    fill(assessments, async () =>
      (
        await get<{ items: NonNullable<typeof assessments.value.data> }>(
          `${ws}/assessment-history?view=${view}&member=${memberId}&from=${day(-90)}&to=${day(0)}`,
        )
      ).items.slice(0, 5),
    ),
  ]
  if (athlete.value && (relation.value === 'admin' || relation.value === 'primary'))
    jobs.push(
      fill(nutrition, () =>
        get<NonNullable<typeof nutrition.value.data>>(
          `${ws}/nutrition?view=${view}&member=${memberId}`,
        ),
      ),
    )
  if (relation.value === 'primary')
    jobs.push(
      fill(participation, async () => {
        const r = await get<{
          items: { athlete_member_id: string; participation: string; effective_from: string }[]
        }>(`${ws}/injuries?view=trainer`)
        const found = r.items.find((x) => x.athlete_member_id === memberId)
        return found ? { kind: 'status' as const, ...found } : { kind: 'none' as const }
      }),
    )
  else if (relation.value === 'admin')
    jobs.push(
      fill(participation, async () => {
        const r = await get<{
          members: {
            member_id: string
            ready: boolean
            age_group: string | null
            athlete_assented_at: string | null
            withdrawn_at: string | null
          }[]
        }>(`${ws}/injuries?view=admin`)
        const found = r.members.find((x) => x.member_id === memberId)
        return {
          kind: 'consent' as const,
          ready: !!found?.ready,
          age_group: found?.age_group || null,
          assented: !!found?.athlete_assented_at,
          withdrawn: !!found?.withdrawn_at,
        }
      }),
    )
  await Promise.all(jobs)
}
const showNutrition = computed(() => relation.value === 'admin' || relation.value === 'primary')
const showParticipation = computed(() => relation.value === 'admin' || relation.value === 'primary')
onMounted(load)
</script>
<template>
  <div class="container page athlete-profile">
    <RouterLink class="back-link" :to="backPath">{{
      l('Back to people', 'العودة إلى الأشخاص')
    }}</RouterLink>
    <p v-if="overview.loading && !member" role="status">
      {{ l('Loading profile…', 'جارٍ تحميل الملف…') }}
    </p>
    <section v-else-if="overview.denied" class="empty-state panel">
      <PhTray :size="28" aria-hidden="true" />
      <h1>{{ l('This profile is not available to you.', 'هذا الملف غير متاح لك.') }}</h1>
      <p>
        {{
          l(
            'Administrators can view institution profiles. Coaches can view only their athletes.',
            'تظهر ملفات المؤسسة للمسؤولين. يرى المدربون رياضييهم فقط.',
          )
        }}
      </p>
    </section>
    <p v-else-if="overview.error" role="alert" class="notice error">
      {{ overview.error }}
      <button type="button" class="text-link" @click="load">
        {{ l('Retry', 'إعادة المحاولة') }}
      </button>
    </p>
    <template v-else-if="member">
      <PageHeading class="work-heading">
        <div>
          <p class="overline">{{ title }}</p>
          <h1 dir="auto">{{ member.name }}</h1>
          <p v-if="relation === 'supporting'" class="small-print">
            {{
              l(
                'You support this athlete. You see their training plans and sessions for your sport, and assessments from events you staffed.',
                'أنت مدرب مساند لهذا الرياضي. تطّلع على خطط التدريب والحصص الخاصة برياضتك، والتقييمات من المواعيد التي أشرفت عليها.',
              )
            }}
          </p>
        </div>
        <RouterLink
          v-if="member.active && member.user_id && member.id !== self && view !== 'trainee'"
          class="button secondary"
          :to="
            base +
            '/messages?to=' +
            encodeURIComponent(member.id) +
            '&title=' +
            encodeURIComponent(member.name)
          "
          >{{ l('Message', 'مراسلة') }}</RouterLink
        >
      </PageHeading>
      <TabsRoot
        v-model="activeTab"
        :dir="locale === 'ar' ? 'rtl' : 'ltr'"
        class="member-profile-tabs"
      >
        <TabsList class="profile-tabs ui-tabs" :aria-label="l('Profile sections', 'أقسام الملف')">
          <TabsTrigger value="overview">{{ l('Overview', 'نظرة عامة') }}</TabsTrigger>
          <template v-if="athlete && view !== 'trainee'">
            <TabsTrigger value="plans">{{ l('Plans', 'الخطط') }}</TabsTrigger
            ><TabsTrigger value="sessions">{{ l('Sessions', 'الحصص') }}</TabsTrigger
            ><TabsTrigger value="assessments">{{ l('Assessments', 'التقييمات') }}</TabsTrigger>
            <TabsTrigger v-if="showNutrition" value="nutrition">{{
              l('Nutrition', 'التغذية')
            }}</TabsTrigger
            ><TabsTrigger v-if="showParticipation" value="participation">{{
              l('Participation', 'المشاركة')
            }}</TabsTrigger></template
          >
          <TabsTrigger v-if="analytics" value="analytics">{{
            l('Activity', 'النشاط')
          }}</TabsTrigger>
          <TabsTrigger v-if="view === 'admin'" value="manage">{{
            l('Manage details', 'إدارة البيانات')
          }}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" class="profile-tab-panel"
          ><section id="profile-overview" class="panel" aria-labelledby="overview-heading">
            <h2 id="overview-heading">{{ l('Overview', 'نظرة عامة') }}</h2>
            <dl class="profile-facts">
              <div v-if="member.email">
                <dt>{{ l('Account email', 'بريد الحساب') }}</dt>
                <dd dir="ltr">{{ member.email }}</dd>
              </div>
              <div v-if="member.joined_at">
                <dt>{{ l('Joined institution', 'تاريخ الانضمام للمؤسسة') }}</dt>
                <dd>{{ dateLabel(member.joined_at) }}</dd>
              </div>
              <div>
                <dt>{{ l('Institution role', 'الدور المؤسسي') }}</dt>
                <dd>
                  {{
                    member.roles.includes('admin')
                      ? l('Administrator', 'مسؤول')
                      : member.roles.includes('trainer')
                        ? l('Coach', 'مدرب')
                        : l('Athlete', 'رياضي')
                  }}
                </dd>
              </div>
              <div>
                <dt>{{ l('Membership', 'العضوية') }}</dt>
                <dd>{{ member.active ? l('Active', 'نشطة') : l('Inactive', 'غير نشطة') }}</dd>
              </div>
              <div v-if="athlete">
                <dt>{{ l('Primary coach', 'المدرب الأساسي') }}</dt>
                <dd dir="auto">{{ nameOf(member.trainer_id) }}</dd>
              </div>
              <div v-if="athlete">
                <dt>{{ l('Supporting coaches', 'المدربون المساندون') }}</dt>
                <dd dir="auto">
                  {{
                    (member.coaches || [])
                      .filter((c) => c.kind === 'supporting')
                      .map((c) => nameOf(c.coach) + ' · ' + sportName(c.sport))
                      .join('، ') || l('None', 'لا يوجد')
                  }}
                </dd>
              </div>
              <div v-if="!member.roles.includes('admin')">
                <dt>{{ l('Sports', 'الرياضات') }}</dt>
                <dd>
                  <span v-if="!member.sports?.length">{{ l('None', 'لا يوجد') }}</span>
                  <span v-for="id in member.sports" :key="id" class="tag" dir="auto">{{
                    sportName(id)
                  }}</span>
                </dd>
              </div>
            </dl>
          </section></TabsContent
        >

        <TabsContent value="plans" v-if="athlete && view !== 'trainee'" class="profile-tab-panel"
          ><section id="profile-plans" class="panel" aria-labelledby="plans-heading">
            <div class="heading-actions">
              <h2 id="plans-heading">{{ l('Active plans', 'الخطط النشطة') }}</h2>
              <RouterLink class="text-link" :to="base + '/training?member=' + member.id">{{
                l('All plans', 'جميع الخطط')
              }}</RouterLink>
            </div>
            <p v-if="plans.loading" role="status">{{ l('Loading…', 'جارٍ التحميل…') }}</p>
            <p v-else-if="plans.denied" class="small-print">
              {{ l('Not available for your role.', 'غير متاح لدورك.') }}
            </p>
            <p v-else-if="plans.error" role="alert" class="notice error">{{ plans.error }}</p>
            <p v-else-if="!plans.data?.items.length" class="profile-empty">
              {{ l('No active plans.', 'لا توجد خطط نشطة.') }}
            </p>
            <ul v-else class="profile-list">
              <li v-for="plan in plans.data.items" :key="plan.id">
                <strong dir="auto">{{ plan.version.title }}</strong>
                <span v-if="plan.goal || plan.sport" class="tag" dir="auto">{{
                  [plan.goal, plan.sport].filter(Boolean).join(' · ')
                }}</span>
                <RouterLink
                  v-if="relation === 'primary' || (relation === 'supporting' && plan.sport)"
                  class="text-link"
                  :to="base + '/training/' + plan.id"
                  :aria-label="l('Manage workouts for ', 'إدارة تمارين ') + plan.version.title"
                  >{{ l('Manage workouts', 'إدارة التمارين') }}</RouterLink
                >
                <small
                  >{{ formatDate(plan.start_date, locale) }} —
                  {{
                    plan.end_date
                      ? formatDate(plan.end_date, locale)
                      : l('No end date', 'دون تاريخ انتهاء')
                  }}</small
                >
              </li>
            </ul>
          </section></TabsContent
        >

        <TabsContent value="sessions" v-if="athlete && view !== 'trainee'" class="profile-tab-panel"
          ><section id="profile-sessions" class="panel" aria-labelledby="sessions-heading">
            <div class="heading-actions">
              <h2 id="sessions-heading">{{ l('Recent sessions', 'الحصص الأخيرة') }}</h2>
              <RouterLink class="text-link" :to="base + '/workouts?member=' + member.id">{{
                l('Workout history', 'سجل التمارين')
              }}</RouterLink>
            </div>
            <p v-if="sessions.loading" role="status">{{ l('Loading…', 'جارٍ التحميل…') }}</p>
            <p v-else-if="sessions.denied" class="small-print">
              {{ l('Not available for your role.', 'غير متاح لدورك.') }}
            </p>
            <p v-else-if="sessions.error" role="alert" class="notice error">{{ sessions.error }}</p>
            <p v-else-if="!sessions.data?.length" class="profile-empty">
              {{ l('No recorded sessions yet.', 'لا توجد حصص مسجلة بعد.') }}
            </p>
            <ul v-else class="profile-list">
              <li v-for="s in sessions.data" :key="s.id">
                <RouterLink
                  :to="base + (s.recorded_mode === 'delegated' ? '/record/' : '/review/') + s.id"
                  dir="auto"
                  >{{ s.title }}</RouterLink
                >
                <span v-if="s.recorded_mode === 'delegated'" class="tag">{{
                  l('Coach-recorded', 'سجّلها مدرب')
                }}</span>
                <small
                  >{{ dateLabel(s.started_at) }} ·
                  {{
                    s.status === 'completed'
                      ? s.reviewed_at
                        ? l('Reviewed', 'تمت المراجعة')
                        : l('Completed', 'مكتملة')
                      : l('In progress', 'قيد التنفيذ')
                  }}</small
                >
              </li>
            </ul>
          </section></TabsContent
        >

        <TabsContent
          value="assessments"
          v-if="athlete && view !== 'trainee'"
          class="profile-tab-panel"
          ><section id="profile-assessments" class="panel" aria-labelledby="assessments-heading">
            <div class="heading-actions">
              <h2 id="assessments-heading">
                {{ l('Assessments (90 days)', 'التقييمات (٩٠ يوماً)') }}
              </h2>
              <RouterLink class="text-link" :to="base + '/assessments/' + member.id">{{
                l('Assessment history', 'سجل التقييمات')
              }}</RouterLink>
            </div>
            <p v-if="assessments.loading" role="status">{{ l('Loading…', 'جارٍ التحميل…') }}</p>
            <p v-else-if="assessments.denied" class="small-print">
              {{ l('Not available for your role.', 'غير متاح لدورك.') }}
            </p>
            <p v-else-if="assessments.error" role="alert" class="notice error">
              {{ assessments.error }}
            </p>
            <p v-else-if="!assessments.data?.length" class="profile-empty">
              {{ l('No assessment results in this period.', 'لا توجد نتائج تقييم في هذه الفترة.') }}
            </p>
            <ul v-else class="profile-list">
              <li v-for="a in assessments.data" :key="a.event_id">
                <strong dir="auto">{{ a.title }}</strong
                ><small>{{ dateLabel(a.starts_at) }}</small>
              </li>
            </ul>
          </section></TabsContent
        >

        <TabsContent value="nutrition" v-if="showNutrition" class="profile-tab-panel"
          ><section
            v-if="showNutrition"
            id="profile-nutrition"
            class="panel"
            aria-labelledby="nutrition-heading"
          >
            <div class="heading-actions">
              <h2 id="nutrition-heading">{{ l('Nutrition', 'التغذية') }}</h2>
              <RouterLink class="text-link" :to="base + '/nutrition?member=' + member.id">{{
                l('Open nutrition', 'فتح التغذية')
              }}</RouterLink>
            </div>
            <p v-if="nutrition.loading" role="status">{{ l('Loading…', 'جارٍ التحميل…') }}</p>
            <p v-else-if="nutrition.denied" class="small-print">
              {{ l('Not available for your role.', 'غير متاح لدورك.') }}
            </p>
            <p v-else-if="nutrition.error" role="alert" class="notice error">
              {{ nutrition.error }}
            </p>
            <template v-else-if="nutrition.data">
              <p>
                {{
                  nutrition.data.current
                    ? l('Current plan: version ', 'الخطة الحالية: النسخة ') +
                      nutrition.data.current.revision
                    : l('No current nutrition plan.', 'لا توجد خطة تغذية حالية.')
                }}
              </p>
              <p class="small-print">
                {{
                  nutrition.data.canReadDiary
                    ? l(
                        'The athlete shares their meal diary with staff.',
                        'يشارك الرياضي سجل وجباته مع الطاقم.',
                      )
                    : l(
                        'The athlete has not shared their meal diary. Recorded meals stay private.',
                        'لم يشارك الرياضي سجل وجباته. تبقى الوجبات المسجلة خاصة.',
                      )
                }}
              </p>
            </template>
          </section></TabsContent
        >

        <TabsContent value="participation" v-if="showParticipation" class="profile-tab-panel"
          ><section
            v-if="showParticipation"
            id="profile-participation"
            class="panel"
            aria-labelledby="participation-heading"
          >
            <h2 id="participation-heading">{{ l('Participation status', 'حالة المشاركة') }}</h2>
            <p v-if="participation.loading" role="status">{{ l('Loading…', 'جارٍ التحميل…') }}</p>
            <p v-else-if="participation.denied" class="small-print">
              {{ l('Not available for your role.', 'غير متاح لدورك.') }}
            </p>
            <p v-else-if="participation.error" role="alert" class="notice error">
              {{ participation.error }}
            </p>
            <template v-else-if="participation.data?.kind === 'status'">
              <p>
                <strong>{{
                  participation.data.participation === 'unavailable'
                    ? l('Unavailable', 'غير متاح')
                    : l('Modified participation', 'مشاركة معدّلة')
                }}</strong>
                · {{ l('from', 'منذ') }} {{ formatDate(participation.data.effective_from, locale) }}
              </p>
              <p class="small-print">
                {{
                  l(
                    'Recorded by the athlete. This is not a medical assessment or clearance.',
                    'سجّلها الرياضي. هذه ليست تقييماً طبياً أو إذناً بالمشاركة.',
                  )
                }}
              </p>
            </template>
            <p v-else-if="participation.data?.kind === 'none'" class="small-print">
              {{
                l(
                  'No active participation restriction is shared with you.',
                  'لا توجد قيود مشاركة نشطة مشتركة معك.',
                )
              }}
            </p>
            <template v-else-if="participation.data?.kind === 'consent'">
              <p>
                {{
                  participation.data.ready
                    ? l('Consent setup is complete.', 'اكتمل إعداد الموافقة.')
                    : l('Consent setup is not complete.', 'لم يكتمل إعداد الموافقة.')
                }}
                {{
                  participation.data.withdrawn
                    ? l('The athlete has withdrawn.', 'انسحب الرياضي.')
                    : participation.data.assented
                      ? l('The athlete has assented.', 'وافق الرياضي.')
                      : l('Awaiting athlete assent.', 'بانتظار موافقة الرياضي.')
                }}
              </p>
              <p class="small-print">
                {{
                  l(
                    'Administrators manage consent setup only; participation records stay with the athlete and their primary coach.',
                    'يدير المسؤولون إعداد الموافقة فقط؛ تبقى سجلات المشاركة لدى الرياضي ومدربه الأساسي.',
                  )
                }}
              </p>
            </template>
          </section></TabsContent
        >
        <TabsContent v-if="analytics" value="analytics" class="profile-tab-panel"
          ><section class="panel">
            <h2>{{ l('Coach activity', 'نشاط المدرب') }}</h2>
            <p class="small-print">
              {{
                l(
                  'Completed activity in the last 30 days. Roster and upcoming-event counts reflect the current state.',
                  'النشاط المكتمل خلال آخر ٣٠ يوماً. أعداد الرياضيين والمواعيد القادمة تعكس الحالة الحالية.',
                )
              }}
            </p>
            <dl class="profile-facts">
              <div
                v-for="metric in [
                  {
                    label: l('Primary athletes', 'الرياضيون الأساسيون'),
                    value: analytics.primary_athletes,
                  },
                  {
                    label: l('Supporting coaching links', 'روابط التدريب المساندة'),
                    value: analytics.supporting_links,
                  },
                  {
                    label: l('Completed staffed events', 'المواعيد المكتملة ضمن طاقمها'),
                    value: analytics.completed_events,
                  },
                  {
                    label: l('Upcoming staffed events', 'المواعيد القادمة ضمن طاقمها'),
                    value: analytics.upcoming_events,
                  },
                  {
                    label: l(
                      'Coach-recorded completed workouts',
                      'التدريبات المكتملة المسجلة بواسطة المدرب',
                    ),
                    value: analytics.recorded_workouts,
                  },
                ]"
                :key="metric.label"
              >
                <dt>{{ metric.label }}</dt>
                <dd class="profile-metric">{{ metric.value }}</dd>
              </div>
            </dl>
            <p
              v-if="!analytics.completed_events && !analytics.recorded_workouts"
              class="profile-empty"
            >
              {{
                l(
                  'No completed activity recorded in this period. Activity counts are not a coach rating.',
                  'لا يوجد نشاط مكتمل مسجل في هذه الفترة. أعداد النشاط ليست تقييماً للمدرب.',
                )
              }}
            </p>
          </section></TabsContent
        >
        <TabsContent
          v-if="view === 'admin'"
          value="manage"
          force-mount
          :hidden="activeTab !== 'manage'"
          class="profile-tab-panel"
          ><section>
            <MemberManagement
              :institution-id="institution"
              :member="member"
              :sports="sports"
              :names="names"
              @saved="load"
            /></section
        ></TabsContent>
      </TabsRoot>
    </template>
  </div>
</template>
<style scoped>
.athlete-profile {
  max-width: none;
}
.athlete-profile .panel {
  margin-bottom: 20px;
}
.profile-facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 14px 24px;
  margin: 0;
}
.profile-facts dt {
  font-size: 0.8rem;
  color: var(--muted);
}
.profile-facts dd {
  margin: 4px 0 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  overflow-wrap: anywhere;
}
.profile-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 10px;
}
.profile-list li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  min-width: 0;
  overflow-wrap: anywhere;
}
.profile-list small {
  color: var(--muted);
}
.profile-tab-panel[hidden] {
  display: none;
}
.profile-tab-panel {
  outline-offset: 4px;
}
/* Compact in-panel empty state: start-aligned text, no nested card. */
.profile-empty {
  margin: 0;
  padding: 16px 0;
  max-width: 60ch;
  color: var(--muted);
  line-height: 1.65;
}
.profile-metric {
  font-size: 1.65rem;
  font-weight: 700;
}
.profile-facts {
  padding-block: 12px;
}
@media (max-width: 540px) {
  .profile-facts {
    grid-template-columns: 1fr;
  }
}
</style>
