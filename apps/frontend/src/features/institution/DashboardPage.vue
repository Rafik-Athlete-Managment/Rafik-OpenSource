<script setup lang="ts">
import { institutionContext } from '../../app/institution'

import { PhTray } from '@phosphor-icons/vue'
import { useListPageSize } from '../../lib/list-page-size'
import PageHeading from '../../components/PageHeading.vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { user, refreshContexts, contexts } from '../../app/auth'
import { request } from '../../lib/backend'
import { getDraft, storeDraft, removeDraft } from '../../lib/storage'
import { language as l, errorMessage, dateLabel, locale } from '../../lib/i18n'
import { useCommand } from '../../lib/commands'
import CommandStatus from '../../components/CommandStatus.vue'
import PageState from '../../components/PageState.vue'
import type { Institution, Member, Role, Sport } from './types'
import './institution.css'
import CoachDesk from './CoachDesk.vue'
import FollowUpPanel from './FollowUpPanel.vue'
import UpcomingSessions from './UpcomingSessions.vue'
import WorkoutAgenda from './WorkoutAgenda.vue'
import BrandingSettings from './BrandingSettings.vue'
import SportsSettings from './SportsSettings.vue'
import { TabsRoot, TabsList, TabsTrigger, TabsContent } from 'reka-ui'
import ListPagination from '../../components/ListPagination.vue'
import PersonActionIcon from './PersonActionIcon.vue'
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
const closeDialog = ref(false)
const route = useRoute(),
  router = useRouter(),
  id = institutionContext().institution,
  view = institutionContext().view as Role,
  base = '',
  section = computed(() => String(route.meta.section || 'overview'))
const peopleLoading = ref(false),
  extraLoading = ref(false)
const peopleOffset = ref(Math.max(0, Number(route.query.offset) || 0))
const peopleTotal = ref(0)
const data = ref<Institution>(),
  loading = ref(true),
  error = ref(''),
  search = ref(String(route.query.search || '')),
  filter = ref(
    view === 'trainer'
      ? 'trainee'
      : ['admin', 'trainer', 'trainee'].includes(String(route.query.filter))
        ? String(route.query.filter)
        : 'trainee',
  ),
  memberState = ref(
    route.query.filter === 'inactive' || route.query.state === 'inactive' ? 'inactive' : 'active',
  ),
  sportFilter = ref(String(route.query.sport || '')),
  sports = ref<Sport[]>([]),
  newName = ref(''),
  closeName = ref(''),
  inviting = ref(false),
  email = ref(''),
  roles = ref<Role[]>(['trainee']),
  inviteSports = ref<string[]>([]),
  inviteLink = ref(''),
  draftReady = ref(false),
  draftSaved = ref(false),
  draftError = ref('')
const invitationSports = computed(() =>
  sports.value.filter(
    (s) => !s.archived && (!roles.value.includes('trainee') || s.kind === 'sport'),
  ),
)
watch(roles, (current, previous) => {
  if (current.includes('admin')) inviteSports.value = []
  else if (previous.includes('trainer') && current.includes('trainee'))
    inviteSports.value = inviteSports.value.filter(
      (id) => !sports.value.some((sport) => sport.id === id && sport.kind === 'specialty'),
    )
})
// Keep the historical draft key so unfinished invitations survive the naming upgrade.
const draftKey = `organization-invite:${user.value!.id}:${id}:${view}`
const roleName = (role: string) =>
  l(
    { admin: 'Administrator', trainer: 'Coach', trainee: 'Athlete' }[role] || role,
    { admin: 'مسؤول', trainer: 'مدرب', trainee: 'رياضي' }[role] || role,
  )
const visible = computed(() => data.value?.members || [])
const sportNames = (member: Member) =>
  (member.sports || [])
    .map((sport) => sports.value.find((s) => s.id === sport))
    .filter((s): s is Sport => !!s)
async function loadSports() {
  if (view === 'trainee') return
  try {
    sports.value = (await request<{ items: Sport[] }>(`/v1/institution/sports?view=${view}`)).items
  } catch {
    // Sport labels are descriptive; the roster stays usable without them.
    sports.value = []
  }
}
const supportingCoaches = (member: Member) =>
  (member.coaches || [])
    .filter((c) => c.kind === 'supporting')
    .map(
      (c) =>
        (data.value?.names.find((m) => m.id === c.coach)?.name || l('Coach', 'مدرب')) +
        ' · ' +
        (sports.value.find((s) => s.id === c.sport)?.name || ''),
    )
const myLink = (member: Member) =>
  view === 'trainer' && member.trainer_id !== data.value?.self.id
    ? member.coaches?.find((c) => c.coach === data.value?.self.id && c.kind === 'supporting')
    : undefined
const trainerName = (member: Member) =>
  data.value?.names.find((m) => m.id === member.trainer_id)?.name || l('Not assigned', 'غير معيّن')
async function load() {
  loading.value = true
  error.value = ''
  try {
    const loaded = await request<Institution>(
      `/v1/institution?view=${view}&summary=${view !== 'trainee'}`,
    )
    data.value = loaded
    newName.value = loaded.institution.name
    if (section.value === 'people') await loadPeople()
  } catch (e) {
    data.value = undefined
    error.value = errorMessage(e)
    await refreshContexts().catch(() => {})
  } finally {
    loading.value = false
  }
}
async function loadExtra(kind: 'invitations' | 'events') {
  if (!data.value || extraLoading.value) return
  extraLoading.value = true
  try {
    const result = await request<Institution>(
      `/v1/institution?view=${view}&summary=true&${kind === 'events' ? 'eventOffset' : 'invitationOffset'}=${kind === 'events' ? data.value.eventsNext : data.value.invitationsNext}`,
    )
    if (kind === 'events') {
      data.value.events.push(...result.events)
      data.value.eventsNext = result.eventsNext
    } else {
      data.value.invitations.push(...result.invitations)
      data.value.invitationsNext = result.invitationsNext
    }
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    extraLoading.value = false
  }
}
let rosterGeneration = 0,
  rosterTimer: ReturnType<typeof setTimeout>
const { recordLimit, appliedLimit, pageSizes, acceptLimit, changeLimit } = useListPageSize(
  10,
  () => {
    void loadPeople(0)
  },
)
async function loadPeople(offset = peopleOffset.value) {
  const current = ++rosterGeneration
  peopleLoading.value = true
  try {
    const q = new URLSearchParams({
      view,
      limit: String(recordLimit.value),
      search: search.value,
      state: memberState.value,
      role: ['admin', 'trainer', 'trainee'].includes(filter.value) ? filter.value : '',
      ...(sportFilter.value ? { sport: sportFilter.value } : {}),
      offset: String(offset),
    })
    const page = await request<{
      items: Member[]
      names: { id: string; name: string }[]
      next: number | null
      total: number
    }>(`/v1/institution/people?${q}`)
    if (current !== rosterGeneration || !data.value) return
    peopleOffset.value = offset
    data.value.names = Array.from(
      new Map([...data.value.names, ...page.names].map((m) => [m.id, m])).values(),
    )
    peopleTotal.value = page.total
    acceptLimit()
    if (section.value === 'people')
      await router.replace({
        query: {
          ...route.query,
          filter: filter.value === 'trainee' ? undefined : filter.value,
          state: memberState.value === 'active' ? undefined : memberState.value,
          search: search.value || undefined,
          sport: sportFilter.value || undefined,
          offset: offset || undefined,
        },
      })
    if (current !== rosterGeneration || !data.value) return
    data.value.members = page.items
  } catch (e) {
    if (current === rosterGeneration) error.value = errorMessage(e)
  } finally {
    if (current === rosterGeneration) peopleLoading.value = false
  }
}
onUnmounted(() => {
  clearTimeout(rosterTimer)
  rosterGeneration++
})
watch(filter, () => {
  if (data.value) data.value.members = []
  peopleOffset.value = 0
  peopleTotal.value = 0
})
let syncingPeople = false
watch(
  [search, filter, memberState, sportFilter],
  () => {
    if (syncingPeople) return
    rosterGeneration++
    peopleOffset.value = 0
    peopleLoading.value = true
    clearTimeout(rosterTimer)
    rosterTimer = setTimeout(() => void loadPeople(0), 180)
  },
  { flush: 'sync' },
)
watch(
  () => route.query,
  (q) => {
    if (section.value !== 'people') return
    const offset = Math.max(0, Number(q.offset) || 0),
      role =
        view === 'trainer'
          ? 'trainee'
          : ['admin', 'trainer', 'trainee'].includes(String(q.filter))
            ? String(q.filter)
            : 'trainee',
      state = q.state === 'inactive' || q.filter === 'inactive' ? 'inactive' : 'active',
      term = String(q.search || ''),
      sport = String(q.sport || '')
    if (
      offset === peopleOffset.value &&
      role === filter.value &&
      state === memberState.value &&
      term === search.value &&
      sport === sportFilter.value
    )
      return
    syncingPeople = true
    filter.value = role
    memberState.value = state
    search.value = term
    sportFilter.value = sport
    peopleOffset.value = offset
    syncingPeople = false
    void loadPeople(offset)
  },
)

const command = useCommand<'organization'>(
  `organization:${id}:${view}`,
  async (_, result, args) => {
    if (args.action === 'invite') {
      inviteLink.value = location.origin + '/invitation/' + args.token
      inviting.value = false
      email.value = ''
      roles.value = ['trainee']
      inviteSports.value = []
      await removeDraft(draftKey)
    }
    await refreshContexts()
    if (!contexts.value.some((c) => c.institution_id === id && c.role === view)) {
      await router.push('/access')
      return
    }
    await load()
  },
  (_, args) => request(`/v1/institution`, { method: 'POST', body: JSON.stringify(args) }),
)
const locked = computed(() => command.state.busy || !!command.state.pending || !command.state.ready)
const run = (args: Record<string, unknown>) =>
  command.run('organization', { operation: crypto.randomUUID(), ...args })
function invite() {
  inviteLink.value = ''
  const token = [...crypto.getRandomValues(new Uint8Array(32))]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('')
  return run({
    action: 'invite',
    id: crypto.randomUUID(),
    email: email.value,
    roles: roles.value,
    sports: roles.value.includes('admin') ? [] : inviteSports.value,
    token,
  })
}
let draftSequence = 0
async function saveInviteDraft() {
  if (!draftReady.value) return
  const sequence = ++draftSequence
  draftSaved.value = false
  draftError.value = ''
  try {
    await storeDraft(draftKey, {
      email: email.value,
      roles: [...roles.value],
      sports: [...inviteSports.value],
    })
    if (sequence === draftSequence) draftSaved.value = true
  } catch (e) {
    if (sequence === draftSequence) draftError.value = errorMessage(e)
  }
}
watch([email, roles, inviteSports], () => void saveInviteDraft(), { deep: true })
onMounted(async () => {
  void loadSports()
  await load()
  const draft = await getDraft<{ email: string; roles: Role[]; sports?: string[] }>(draftKey).catch(
    () => undefined,
  )
  if (draft) {
    email.value = draft.email
    roles.value = draft.roles
    inviteSports.value = draft.roles.includes('admin') ? [] : draft.sports || []
    inviting.value = !!draft.email
  }
  draftReady.value = true
})
</script>
<template>
  <div class="container page institution-page">
    <PageHeading class="work-heading">
      <div>
        <p class="overline">{{ roleName(view) }}</p>
        <h1>
          {{
            section === 'people'
              ? l('People', 'الأشخاص')
              : section === 'settings'
                ? l('Institution settings', 'إعدادات المؤسسة')
                : section === 'activity'
                  ? l('Institution activity', 'نشاط المؤسسة')
                  : section === 'overview' && view === 'trainer'
                    ? l('Welcome back', 'أهلاً بعودتك')
                    : data?.institution.name || l('Institution', 'المؤسسة')
          }}
        </h1>
        <p v-if="section !== 'overview'">
          {{
            section === 'people'
              ? l(
                  'Manage members, roles and coaching assignments.',
                  'أدر الأعضاء والأدوار وتعيينات التدريب.',
                )
              : section === 'settings'
                ? l(
                    'Manage your institution’s identity, sports and appearance.',
                    'أدر هوية مؤسستك ورياضاتها ومظهرها.',
                  )
                : l(
                    'Recent membership and configuration changes.',
                    'أحدث تغييرات العضوية والإعدادات.',
                  )
          }}
        </p>
        <p v-else>
          {{
            view === 'admin'
              ? l(
                  'Your people, their training, one shared responsibility.',
                  'أشخاصك وتدريبهم ومسؤولية مشتركة.',
                )
              : view === 'trainer'
                ? l('Focus on the people you support.', 'ركّز على الأشخاص الذين تدعمهم.')
                : l('Your training within this institution.', 'تدريبك ضمن هذه المؤسسة.')
          }}
        </p>
      </div>
      <button
        v-if="data && view === 'admin' && ['overview', 'people'].includes(section)"
        class="button"
        @click="inviting = !inviting"
        :aria-expanded="inviting"
      >
        {{ l('Invite people', 'دعوة أشخاص') }}
      </button>
      <div
        v-if="section === 'overview' && view === 'trainer' && data"
        class="coach-header-actions actions"
      >
        <RouterLink class="button secondary" to="/people"
          >{{ data.summary.trainees }} ·
          {{ l('Primary-roster athletes', 'رياضيو القائمة الأساسية') }}</RouterLink
        >
        <RouterLink class="button" to="/training">{{
          l('Athlete plans', 'خطط الرياضيين')
        }}</RouterLink>
        <RouterLink class="button secondary" to="/analytics">{{
          l('View analytics', 'عرض التحليلات')
        }}</RouterLink>
      </div>
    </PageHeading>
    <CommandStatus :command="command" />
    <PageState :loading="loading" :error="error" @retry="load"
      ><template v-if="data">
        <section v-if="inviting && view === 'admin'" class="panel institution-invite">
          <form class="form-stack" @submit.prevent="invite">
            <h2>
              {{
                l(
                  'Invite someone to ' + data.institution.name,
                  'دعوة شخص إلى ' + data.institution.name,
                )
              }}
            </h2>
            <p v-if="draftError" class="notice error" role="alert">{{ draftError }}</p>
            <p v-else-if="email" class="muted" aria-live="polite">
              {{
                draftSaved
                  ? l(
                      'Invitation draft saved on this device.',
                      'حُفظت مسودة الدعوة على هذا الجهاز.',
                    )
                  : l('Saving draft…', 'جارٍ حفظ المسودة…')
              }}
            </p>
            <fieldset class="command-fields" :disabled="locked || !draftReady">
              <label
                >{{ l('Email address', 'البريد الإلكتروني')
                }}<input type="email" v-model="email" maxlength="254" required
              /></label>
              <fieldset class="role-choices">
                <legend>
                  {{ l('Access within this institution', 'الصلاحيات داخل هذه المؤسسة') }}
                </legend>
                <label v-for="role in ['admin', 'trainer', 'trainee'] as Role[]" :key="role"
                  ><input
                    type="radio"
                    name="invitation-role"
                    :checked="roles.includes(role)"
                    @change="roles = [role]"
                  />{{ roleName(role) }}</label
                >
              </fieldset>
              <fieldset v-if="!roles.includes('admin')" class="invite-sports">
                <legend>
                  {{
                    roles.includes('trainer')
                      ? l(
                          'Sports and coaching specialties (optional)',
                          'الرياضات والتخصصات التدريبية (اختياري)',
                        )
                      : l('Sports (optional)', 'الرياضات (اختياري)')
                  }}
                </legend>
                <p v-if="!invitationSports.length" class="small-print">
                  {{
                    l(
                      'Add sports in institution settings first, or assign them from the profile later.',
                      'أضف الرياضات في إعدادات المؤسسة أولاً، أو عيّنها لاحقاً من الملف.',
                    )
                  }}
                </p>
                <label v-for="sport in invitationSports" :key="sport.id" class="check-label"
                  ><input type="checkbox" v-model="inviteSports" :value="sport.id" /><span
                    dir="auto"
                    >{{ sport.name }}</span
                  ></label
                >
              </fieldset>
              <p class="muted">
                {{
                  l(
                    'Each account has one institution role. Create a separate account for another responsibility. The invited person sets a password from the one-time link; the email address is not verified.',
                    'لكل حساب دور واحد في المؤسسة. أنشئ حساباً منفصلاً للمسؤوليات الأخرى. يعيّن المدعو كلمة المرور من الرابط لمرة واحدة؛ لا يتم التحقق من البريد الإلكتروني.',
                  )
                }}
              </p>
              <button class="button" :disabled="!roles.length">
                {{ l('Create invitation', 'إنشاء الدعوة') }}
              </button>
            </fieldset>
          </form>
        </section>
        <div v-if="inviteLink" class="notice success">
          <p>
            {{
              l(
                'Invitation ready. Share this link with the intended person.',
                'الدعوة جاهزة. شارك الرابط مع الشخص المقصود.',
              )
            }}
          </p>
          <label
            >{{ l('Invitation link', 'رابط الدعوة')
            }}<input
              :value="inviteLink"
              readonly
              @focus="($event.target as HTMLInputElement).select()"
          /></label>
        </div>
        <template v-if="section === 'overview'">
          <div v-if="view === 'admin'" class="organization-summary">
            <RouterLink :to="base + '/people'"
              ><strong>{{ data.summary.trainees }}</strong
              ><span>{{
                view === 'admin'
                  ? l('Active athletes', 'الرياضيون النشطون')
                  : l('Assigned to you', 'المعيّنون لك')
              }}</span></RouterLink
            ><RouterLink v-if="view === 'admin'" :to="base + '/people?filter=trainer'"
              ><strong>{{ data.summary.trainers }}</strong
              ><span>{{ l('Coaches', 'المدربون') }}</span></RouterLink
            ><RouterLink v-if="view === 'admin'" :to="base + '/people'"
              ><strong>{{ data.summary.unassigned }}</strong
              ><span>{{ l('Need a coach', 'بحاجة إلى مدرب') }}</span></RouterLink
            >
          </div>
          <div v-if="view !== 'trainer'" class="actions">
            <RouterLink class="button" :to="base + '/training'">{{
              view === 'trainee'
                ? l('Open my training', 'فتح تدريبي')
                : l('Athlete plans', 'خطط الرياضيين')
            }}</RouterLink
            ><RouterLink
              v-if="view !== 'trainee'"
              class="button secondary"
              :to="base + '/analytics'"
              >{{ l('View analytics', 'عرض التحليلات') }}</RouterLink
            >
          </div>
          <CoachDesk v-if="view === 'trainer'" />
          <FollowUpPanel v-else-if="view === 'admin'" />
          <WorkoutAgenda v-if="view === 'trainee'" due :limit="4" />
          <UpcomingSessions v-if="view !== 'trainer'" />
          <section
            v-if="view === 'trainee' || (view === 'admin' && !data.summary.trainees)"
            class="panel"
          >
            <h2>
              {{
                view === 'admin'
                  ? l('Keep everyone supported', 'امنح الجميع الدعم')
                  : l('Your coach', 'مدربك')
              }}
            </h2>
            <template v-if="view === 'trainee'"
              ><p>{{ trainerName(data.members.find((m) => m.id === data?.self.id)!) }}</p>
              <p class="muted">
                {{
                  l(
                    'Your institution manages your coach assignment. Your personal training remains in My training.',
                    'تدير مؤسستك تعيين مدربك. يبقى تدريبك الشخصي في «تدريبي».',
                  )
                }}
              </p></template
            ><template v-else
              ><p>
                {{
                  view === 'admin'
                    ? l(
                        'Invite your staff and athletes, then give each athlete a responsible coach. You can reassign responsibility while keeping the institution’s records together.',
                        'ادعُ موظفيك ورياضييك وعيّن مدرباً مسؤولاً لكل رياضي. يمكنك تغيير المسؤولية مع الحفاظ على سجلات المؤسسة.',
                      )
                    : l(
                        'Open your roster to review your assigned athletes and their training.',
                        'افتح القائمة لمراجعة الرياضيين المعيّنين لك وتدريبهم.',
                      )
                }}
              </p>
              <RouterLink class="text-link" :to="base + '/people'"
                >{{ l('Open roster', 'فتح القائمة') }} →</RouterLink
              ></template
            >
          </section>
        </template>
        <template v-else-if="section === 'people'">
          <TabsRoot
            v-model="filter"
            :dir="locale === 'ar' ? 'rtl' : 'ltr'"
            class="people-role-tabs"
          >
            <div class="list-controls">
              <TabsList
                class="report-tabs ui-tabs"
                :aria-label="l('People by role', 'الأشخاص حسب الدور')"
              >
                <TabsTrigger value="trainee">{{ l('Athletes', 'الرياضيون') }}</TabsTrigger>
                <TabsTrigger v-if="view === 'admin'" value="trainer">{{
                  l('Coaches', 'المدربون')
                }}</TabsTrigger>
                <TabsTrigger v-if="view === 'admin'" value="admin">{{
                  l('Administrators', 'المسؤولون')
                }}</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent :value="filter" class="people-directory-panel">
              <div class="list-toolbar">
                <div class="people-search-filters">
                  <label
                    >{{ l('Find a person', 'البحث عن شخص')
                    }}<input
                      :placeholder="l('Search member names…', 'ابحث بأسماء الأعضاء…')"
                      type="search"
                      v-model="search"
                  /></label>
                  <label
                    >{{ l('Membership', 'العضوية')
                    }}<select v-model="memberState">
                      <option value="active">{{ l('Active', 'نشط') }}</option>
                      <option value="inactive">{{ l('Inactive', 'غير نشط') }}</option>
                    </select></label
                  >
                  <label v-if="sports.length"
                    >{{ l('Sport or specialty', 'الرياضة أو التخصص')
                    }}<select v-model="sportFilter">
                      <option value="">{{ l('All', 'الكل') }}</option>
                      <option v-for="sport in sports" :key="sport.id" :value="sport.id">
                        {{ sport.name }}{{ sport.archived ? ' · ' + l('Archived', 'مؤرشف') : '' }}
                      </option>
                    </select></label
                  >
                </div>
                <div class="list-toolbar-pagination">
                  <ListPagination
                    :offset="peopleOffset"
                    :page-size="appliedLimit"
                    :sizes="pageSizes"
                    @page-size="changeLimit"
                    :total="peopleTotal"
                    :label="l('People pages', 'صفحات الأشخاص')"
                    :disabled="peopleLoading"
                    @page="loadPeople"
                  />
                </div>
              </div>
              <div class="organization-people">
                <section tabindex="0" :aria-label="l('People', 'الأشخاص')">
                  <p class="list-summary">{{ l('People:', 'الأشخاص:') }} {{ peopleTotal }}</p>
                  <p v-if="peopleLoading" class="small-print" role="status">
                    {{ l('Finding people…', 'جارٍ البحث عن الأشخاص…') }}
                  </p>
                  <div v-if="!visible.length && !peopleLoading" class="empty-state panel">
                    <PersonActionIcon kind="profile" />
                    <h2>{{ l('No people in this view', 'لا يوجد أشخاص في هذا العرض') }}</h2>
                    <p>
                      {{
                        search || sportFilter
                          ? l(
                              'Try another name or clear the sport filter.',
                              'جرّب اسماً آخر أو أزل مرشح الرياضة.',
                            )
                          : l(
                              'People appear here after accepting their invitation.',
                              'يظهر الأشخاص هنا بعد قبول دعوتهم.',
                            )
                      }}
                    </p>
                  </div>
                  <article v-for="member in visible" :key="member.id" class="organization-person">
                    <div class="person-identity">
                      <span class="avatar">{{ member.name.slice(0, 1) }}</span>
                      <div>
                        <h2>{{ member.name }}</h2>
                        <p class="person-meta">
                          {{ member.roles.map(roleName).join(' · ')
                          }}<template v-if="member.roles.includes('trainee')">
                            · {{ l('Primary coach', 'المدرب الأساسي') }}:
                            <bdi>{{ trainerName(member) }}</bdi></template
                          >
                        </p>
                        <p v-if="supportingCoaches(member).length" class="muted" dir="auto">
                          {{ l('Supporting', 'مساند') }}: {{ supportingCoaches(member).join('، ') }}
                        </p>
                        <p v-if="myLink(member)" class="small-print">
                          {{
                            l(
                              'You support this athlete for training records only.',
                              'تدعم هذا الرياضي في سجلات التدريب فقط.',
                            )
                          }}
                        </p>
                        <ul
                          v-if="sportNames(member).length"
                          class="person-sports"
                          :aria-label="l('Sports and specialties', 'الرياضات والتخصصات')"
                        >
                          <li
                            v-for="sport in sportNames(member)"
                            :key="sport.id"
                            class="tag"
                            dir="auto"
                          >
                            {{ sport.name }}
                          </li>
                        </ul>
                      </div>
                    </div>
                    <div class="person-actions">
                      <RouterLink
                        class="person-action"
                        :to="
                          base +
                          '/members/' +
                          member.id +
                          '?returnTo=' +
                          encodeURIComponent(route.fullPath)
                        "
                        :aria-label="l('Profile for ', 'ملف ') + member.name"
                        :title="l('Open profile', 'فتح الملف')"
                        ><PersonActionIcon kind="profile"
                      /></RouterLink>
                      <RouterLink
                        v-if="member.active && member.user_id && member.id !== data.self.id"
                        class="person-action"
                        :to="
                          base +
                          '/messages?to=' +
                          encodeURIComponent(member.id) +
                          '&title=' +
                          encodeURIComponent(member.name)
                        "
                        :aria-label="l('Message ', 'مراسلة ') + member.name"
                        :title="l('Message', 'مراسلة')"
                        ><PersonActionIcon kind="message"
                      /></RouterLink>
                      <RouterLink
                        v-if="view === 'admin'"
                        class="person-action"
                        :to="
                          base +
                          '/members/' +
                          member.id +
                          '?tab=manage&returnTo=' +
                          encodeURIComponent(route.fullPath)
                        "
                        :aria-label="l('Manage ', 'إدارة ') + member.name"
                        :title="l('Manage details', 'إدارة البيانات')"
                        ><PersonActionIcon kind="manage"
                      /></RouterLink>
                    </div>
                  </article>
                </section>
              </div>
            </TabsContent>
          </TabsRoot>
          <section v-if="view === 'admin' && data.invitations.length" class="panel">
            <h2>{{ l('Waiting for acceptance', 'بانتظار القبول') }}</h2>
            <article
              v-for="invitation in data.invitations"
              :key="invitation.id"
              class="organization-person"
            >
              <div>
                <strong>{{ invitation.email }}</strong>
                <p>
                  {{ invitation.roles.map(roleName).join(' · ') }} · {{ l('Expires', 'تنتهي') }}
                  {{ dateLabel(invitation.expires_at) }}
                </p>
              </div>
              <button
                class="text-link"
                :disabled="locked"
                @click="run({ action: 'revoke-invite', id: invitation.id })"
              >
                {{ l('Revoke invitation', 'إلغاء الدعوة') }}
              </button>
            </article>
            <button
              v-if="data.invitationsNext !== null"
              type="button"
              class="text-link"
              :disabled="extraLoading"
              @click="loadExtra('invitations')"
            >
              {{ l('More pending invitations', 'المزيد من الدعوات المعلقة') }}
            </button>
          </section>
        </template>
        <section v-else-if="section === 'activity' && view === 'admin'" class="panel">
          <h2>{{ l('Recent institution changes', 'تغييرات المؤسسة الأخيرة') }}</h2>
          <p v-if="!data.events.length">
            {{ l('No changes recorded yet.', 'لا تغييرات مسجلة بعد.') }}
          </p>
          <ol class="organization-events">
            <li v-for="event in data.events" :key="event.id">
              <strong>{{
                l(
                  {
                    member_invited: 'Invitation created',
                    invitation_revoked: 'Invitation revoked',
                    member_joined: 'Member joined',
                    trainer_assigned: 'Coach responsibility updated',
                    member_roles_changed: 'Member roles updated',
                    member_removed: 'Membership deactivated',
                    organization_created: 'Institution created',
                    organization_renamed: 'Institution renamed',
                    nutrition_plan_published: 'Nutrition plan published',
                    nutrition_sharing_changed: 'Nutrition sharing changed',
                  }[event.kind] || 'Institution updated',
                  {
                    member_invited: 'إنشاء دعوة',
                    invitation_revoked: 'إلغاء دعوة',
                    member_joined: 'انضمام عضو',
                    trainer_assigned: 'تحديث مسؤولية المدرب',
                    member_roles_changed: 'تحديث الأدوار',
                    member_removed: 'إلغاء تنشيط عضوية',
                    organization_created: 'إنشاء المؤسسة',
                    organization_renamed: 'تغيير اسم المؤسسة',
                    nutrition_plan_published: 'نشر خطة التغذية',
                    nutrition_sharing_changed: 'تغيير مشاركة التغذية',
                  }[event.kind] || 'تحديث المؤسسة',
                )
              }}</strong
              ><span>{{
                data.members.find(
                  (m) => m.id === event.subject_id || m.user_id === event.subject_id,
                )?.name
              }}</span
              ><time>{{ dateLabel(event.created_at) }}</time>
            </li>
          </ol>
          <button
            v-if="data.eventsNext !== null"
            type="button"
            class="text-link"
            :disabled="extraLoading"
            @click="loadExtra('events')"
          >
            {{ l('Earlier activity', 'نشاط أقدم') }}
          </button>
        </section>
        <section
          v-else-if="section === 'settings' && view === 'admin'"
          class="institution-settings"
        >
          <div class="institution-settings-grid">
            <section class="panel">
              <h2>{{ l('General settings', 'الإعدادات العامة') }}</h2>
              <form
                class="settings-inline-form"
                @submit.prevent="
                  run({ action: 'rename', name: newName, revision: data.institution.revision })
                "
              >
                <label
                  >{{ l('Institution name', 'اسم المؤسسة')
                  }}<input v-model="newName" maxlength="100" required :disabled="locked" /></label
                ><button class="button" :disabled="locked">
                  {{ l('Save name', 'حفظ الاسم') }}
                </button>
              </form>
            </section>
            <div class="panel institution-branding-column">
              <BrandingSettings :institution-id="id" />
            </div>
            <section class="panel institution-settings-wide">
              <SportsSettings :institution-id="id" @changed="loadSports" />
            </section>
            <section class="panel institution-danger-zone institution-settings-wide">
              <h2>{{ l('Close this institution', 'إغلاق هذه المؤسسة') }}</h2>
              <p>
                {{
                  l(
                    'End institution access for every member. Existing records are preserved.',
                    'إنهاء وصول جميع الأعضاء إلى المؤسسة مع الاحتفاظ بالسجلات الحالية.',
                  )
                }}
              </p>
              <DialogRoot v-model:open="closeDialog" @update:open="closeName = ''">
                <DialogTrigger as-child
                  ><button
                    type="button"
                    class="button institution-danger-button"
                    :disabled="locked"
                  >
                    {{ l('Close institution', 'إغلاق المؤسسة') }}
                  </button></DialogTrigger
                >
                <DialogPortal>
                  <DialogOverlay class="institution-dialog-overlay" />
                  <DialogContent
                    class="institution-close-dialog"
                    :dir="locale === 'ar' ? 'rtl' : 'ltr'"
                    @interact-outside="locked && $event.preventDefault()"
                    @escape-key-down="locked && $event.preventDefault()"
                  >
                    <DialogTitle>{{
                      l('Close this institution?', 'إغلاق هذه المؤسسة؟')
                    }}</DialogTitle>
                    <DialogDescription>
                      {{
                        l(
                          'This ends access for all members. Records remain preserved. Type the institution name to confirm.',
                          'ينهي هذا الوصول لجميع الأعضاء مع الاحتفاظ بالسجلات. اكتب اسم المؤسسة للتأكيد.',
                        )
                      }}
                    </DialogDescription>
                    <p class="institution-confirm-name" dir="auto">{{ data.institution.name }}</p>
                    <CommandStatus
                      v-if="command.state.error || command.state.pending"
                      :command="command"
                    />
                    <form
                      class="form-stack"
                      @submit.prevent="
                        run({
                          action: 'close',
                          confirm: closeName,
                          revision: data.institution.revision,
                        })
                      "
                    >
                      <label
                        >{{ l('Confirm institution name', 'تأكيد اسم المؤسسة')
                        }}<input v-model="closeName" :disabled="locked" /></label
                      ><button
                        class="button institution-danger-button"
                        :disabled="locked || closeName !== data.institution.name"
                      >
                        {{ l('Close institution', 'إغلاق المؤسسة') }}
                      </button>
                      <DialogClose as-child
                        ><button
                          type="button"
                          class="button secondary danger-action"
                          :disabled="locked"
                        >
                          {{ l('Cancel', 'إلغاء') }}
                        </button></DialogClose
                      >
                    </form>
                  </DialogContent>
                </DialogPortal>
              </DialogRoot>
            </section>
          </div>
        </section>
        <p v-else class="notice">
          {{
            l(
              'Choose an available page from the institution navigation.',
              'اختر صفحة متاحة من قائمة المؤسسة.',
            )
          }}
        </p>
      </template></PageState
    >
    <RouterLink v-if="error" class="text-link" to="/access">{{
      l('Review institution access', 'مراجعة الوصول إلى المؤسسة')
    }}</RouterLink>
  </div>
</template>
