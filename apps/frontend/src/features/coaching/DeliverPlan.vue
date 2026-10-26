<script setup lang="ts">
import PageHeading from '../../components/PageHeading.vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { user, profile } from '../../app/auth'
import { request } from '../../lib/backend'
import type { PlanVersion } from '../../lib/domain'
import { language as l, errorMessage, locale } from '../../lib/i18n'
import { programContext } from './program-context'
import { useCommand } from '../../lib/commands'
import CommandStatus from '../../components/CommandStatus.vue'
import PageState from '../../components/PageState.vue'
import { getDraft, storeDraft, removeDraft } from '../../lib/storage'
import { PhCheck, PhMagnifyingGlass, PhPlus, PhSwap, PhX } from '@phosphor-icons/vue'
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from 'reka-ui'
const route = useRoute(),
  context = programContext(route),
  versionId = String(route.params.id)
type ActivePlan = {
  id: string
  revision: number
  title: string
  version_id?: string
  program_id?: string
  version_revision?: number
  goal: string | null
  sport: string | null
}
type Recipient = {
  id: string
  name: string
  revision?: number
  assignment_id: string | null
  assignment_revision: number | null
  current?: string
  /** Administrators only: account email to tell same-named athletes apart. */
  email?: string | null
  /** Recipients list every active plan. */
  plans?: ActivePlan[]
}
type Overlap = { title: string; goal: string | null; start_date: string; end_date: string | null }
type Sport = { id: string; name: string; kind: string; archived: boolean }
const version = ref<PlanVersion>(),
  people = ref<Recipient[]>([]),
  selected = ref<string[]>([]),
  search = ref(''),
  pagePeople = ref<Recipient[]>([]),
  searching = ref(false),
  // Last removal, kept briefly so a mistaken Remove can be undone.
  removed = ref<{ id: string; name: string; replace: string } | null>(null),
  confirmClear = ref(false),
  review = ref(false),
  loading = ref(true),
  error = ref(''),
  done = ref(false),
  // Per athlete: '' adds a concurrent plan; a plan ID replaces that plan.
  replace = ref<Record<string, string>>({}),
  goal = ref(''),
  sport = ref(''),
  sports = ref<Sport[]>([]),
  overlaps = ref<{ name: string; plans: Overlap[] }[]>([])
const start = ref(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: profile.value?.timezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date()),
  ),
  end = ref(''),
  mode = ref('flexible')
const key = `delivery:${user.value!.id}:${context.key}:${versionId}`
/** Large institutions: search returns only the top matches; the selection lives below. */
const MATCHES = 5,
  MAX_RECIPIENTS = 50
const visible = computed(() => pagePeople.value.slice(0, MATCHES))
const emailSearch = computed(() => context.view === 'admin')
const currentPlans = (person: Recipient) =>
  person.plans
    ? person.plans.map(planLabel).join('، ') || l('No active plan', 'لا توجد خطة نشطة')
    : person.current || l('No active plan', 'لا توجد خطة نشطة')
/** Already on this exact version: the server would refuse it (409), so it cannot be added. */
const onThisVersion = (person?: Recipient) =>
  !!person?.plans?.some((plan) => plan.version_id === versionId)
/** Same program, older version (even if renamed since): adding moves them to this version. */
const earlierVersion = (person?: Recipient) => {
  const program = (version.value as { program_id?: string } | undefined)?.program_id
  return program && !onThisVersion(person)
    ? person?.plans?.find((plan) => plan.program_id === program)
    : undefined
}
const personOf = (id: string) => people.value.find((p) => p.id === id)
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
/** What assigning does to this athlete's current plans, in one short phrase. */
function outcome(person: Recipient) {
  const replaced = replacedPlan(person)
  if (replaced && replaced.program_id && replaced.id === earlierVersion(person)?.id)
    return l(
      `Moves from version ${replaced.version_revision} to this version`,
      `ينتقل من النسخة ${replaced.version_revision} إلى هذه النسخة`,
    )
  if (replaced) return l('Replaces ', 'تستبدل ') + planLabel(replaced)
  return person.plans?.length
    ? l('Added alongside current plans', 'تُضاف إلى الخطط الحالية')
    : l('First plan', 'الخطة الأولى')
}
/** Plan-choice dialog: one athlete at a time, applied only on confirm. */
const choosing = ref(''),
  choice = ref('')
function openChoice(id: string) {
  choosing.value = id
  choice.value = replace.value[id] || ''
}
function applyChoice() {
  replace.value = { ...replace.value, [choosing.value]: choice.value }
  choosing.value = ''
}
const blocked = computed(() =>
  selected.value.filter((id) => onThisVersion(people.value.find((p) => p.id === id))),
)
const nameOf = (id: string) =>
  people.value.find((p) => p.id === id)?.name || l('Unavailable person', 'شخص غير متاح')
function add(id: string) {
  if (selected.value.includes(id) || selected.value.length >= MAX_RECIPIENTS) return
  selected.value = [...selected.value, id]
  removed.value = null
  preferUpdate(id)
}
/** Default an athlete on an older version of this program to replacing it, not stacking a copy. */
function preferUpdate(id: string) {
  const old = earlierVersion(personOf(id))
  if (old && replace.value[id] === undefined) replace.value = { ...replace.value, [id]: old.id }
}
function remove(id: string) {
  removed.value = { id, name: nameOf(id), replace: replace.value[id] || '' }
  selected.value = selected.value.filter((x) => x !== id)
  const { [id]: _, ...rest } = replace.value
  replace.value = rest
}
function undoRemove() {
  const last = removed.value
  if (!last || selected.value.length >= MAX_RECIPIENTS) return
  selected.value = [...selected.value, last.id]
  if (last.replace) replace.value = { ...replace.value, [last.id]: last.replace }
  removed.value = null
}
function clearAll() {
  selected.value = []
  replace.value = {}
  removed.value = null
  confirmClear.value = false
}
const recipients = computed(() => people.value.filter((p) => selected.value.includes(p.id)))
let initialized = false
watch(
  [selected, start, end, mode],
  () => {
    if (initialized)
      void storeDraft(key, {
        selected: [...selected.value],
        start: start.value,
        end: end.value,
        mode: mode.value,
        replace: { ...replace.value },
        goal: goal.value,
        sport: sport.value,
      }).catch((e) => (error.value = errorMessage(e)))
  },
  { deep: true },
)
watch(
  [replace, goal, sport],
  () => {
    if (initialized)
      void storeDraft(key, {
        selected: [...selected.value],
        start: start.value,
        end: end.value,
        mode: mode.value,
        replace: { ...replace.value },
        goal: goal.value,
        sport: sport.value,
      }).catch((e) => (error.value = errorMessage(e)))
  },
  { deep: true },
)
const planLabel = (plan: ActivePlan) =>
  [plan.title, plan.goal, sports.value.find((s) => s.id === plan.sport)?.name]
    .filter(Boolean)
    .join(' · ')
const replacedPlan = (person: Recipient) =>
  person.plans?.find((plan) => plan.id === replace.value[person.id])
let rosterGeneration = 0,
  searchTimer: ReturnType<typeof setTimeout>
async function loadRoster() {
  const current = ++rosterGeneration
  const query = search.value.trim()
  const q = new URLSearchParams({
    view: context.view,
    search: query,
    selected: selected.value.join(','),
    limit: String(MATCHES),
    ...(emailSearch.value ? { email: 'true' } : {}),
  })
  searching.value = !!query
  try {
    const result = await request<{
      items: Recipient[]
      selected: Recipient[]
      next: number | null
    }>(`/v1/institution/recipients` + '?' + q)
    if (current !== rosterGeneration) return
    // Nothing is listed until someone types; selected athletes always resolve.
    pagePeople.value = query ? result.items.slice(0, MATCHES) : []
    people.value = Array.from(
      new Map(
        [
          ...people.value.filter((p) => selected.value.includes(p.id)),
          ...result.selected,
          ...pagePeople.value,
        ].map((m) => [m.id, m]),
      ).values(),
    )
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    if (current === rosterGeneration) searching.value = false
  }
}
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => void loadRoster(), 180)
})
async function load() {
  loading.value = true
  error.value = ''
  try {
    version.value = (
      await request<{ version: PlanVersion }>(
        `/v1/institution/programs?view=${context.view}&version=${versionId}`,
      )
    ).version
    if (!version.value) throw Error('program_unavailable')
    const local = await getDraft<{
      selected: string[]
      start: string
      end: string
      mode: string
      replace?: Record<string, string>
      goal?: string
      sport?: string
    }>(key)
    if (local) {
      selected.value = local.selected
      start.value = local.start
      end.value = local.end
      mode.value = local.mode
      replace.value = local.replace || {}
      goal.value = local.goal || ''
      sport.value = local.sport || ''
    } else if (route.query.member) selected.value = [String(route.query.member)]
    const preselected = !local && !!route.query.member
    sports.value = (
      await request<{ items: Sport[] }>(`/v1/institution/sports?view=${context.view}`).catch(
        () => ({ items: [] as Sport[] }),
      )
    ).items.filter((s) => !s.archived)
    await loadRoster()
    if (preselected) selected.value.forEach(preferUpdate)
    initialized = true
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
const command = useCommand<'deliver'>(
  key,
  async (_, result) => {
    // Concurrent plans are allowed; report overlapping dates so the coach can review them.
    overlaps.value = Array.isArray(result)
      ? (result as { member_id: string; overlaps?: Overlap[] }[])
          .filter((r) => r.overlaps?.length)
          .map((r) => ({
            name: people.value.find((p) => p.id === r.member_id)?.name || '',
            plans: r.overlaps!,
          }))
      : []
    done.value = true
    await removeDraft(key)
  },
  (_, args) =>
    request(`/v1/institution/delivery`, {
      method: 'POST',
      body: JSON.stringify(args),
    }),
  {
    successMessage: l(
      'Program assigned to the selected athletes.',
      'تم تعيين البرنامج للرياضيين المحددين.',
    ),
  },
)
const locked = computed(() => command.state.busy || !!command.state.pending || !command.state.ready)
function deliver() {
  return command.run('deliver', {
    operation: crypto.randomUUID(),
    action: 'assign',
    view: context.view,
    version_id: versionId,
    members: recipients.value.map((p) => ({
      id: p.id,
      revision: p.revision,
      replaces: replacedPlan(p)?.id || null,
      replaces_revision: replacedPlan(p)?.revision ?? null,
    })),
    start_date: start.value,
    end_date: end.value || null,
    schedule_mode: mode.value,
    goal: goal.value.trim() || null,
    sport: sport.value || null,
  })
}
onMounted(load)
</script>
<template>
  <div class="container page delivery-page">
    <RouterLink class="back-link" :to="context.base + '/plans'">{{
      l('Back to programs', 'العودة للبرامج')
    }}</RouterLink>
    <PageHeading class="work-heading">
      <div>
        <p class="overline">{{ l('Assign program', 'تعيين البرنامج') }}</p>
        <h1>{{ version?.title || l('Assign a program', 'تعيين برنامج') }}</h1>
        <p>
          {{
            l(
              'Add athletes, set how the program runs, then review before assigning.',
              'أضف الرياضيين وحدّد طريقة تنفيذ البرنامج ثم راجع قبل التعيين.',
            )
          }}
        </p>
      </div>
      <span v-if="version?.revision" class="tag delivery-version" data-status="published">{{
        l(`Version ${version.revision}`, `النسخة ${version.revision}`)
      }}</span>
    </PageHeading>
    <CommandStatus :command="command" /><PageState :loading="loading" :error="error" @retry="load"
      ><section v-if="done" class="panel">
        <h2>{{ l('Ready for their next session.', 'جاهز للحصة القادمة.') }}</h2>
        <p>
          {{
            l(
              'The selected people now have this program. Started workouts and everyone else’s assignments are unchanged.',
              'أصبح البرنامج متاحاً للأشخاص المحددين. لم تتغير الحصص التي بدأت أو تعيينات الآخرين.',
            )
          }}
        </p>
        <section v-if="overlaps.length" class="notice" role="status">
          <h3>{{ l('Overlapping plans', 'خطط متداخلة') }}</h3>
          <p>
            {{
              l(
                'These athletes have other active plans in the same period. Same-day sessions are allowed; review the combined load.',
                'لدى هؤلاء الرياضيين خطط نشطة أخرى في الفترة نفسها. يُسمح بحصص في اليوم نفسه؛ راجع الحمل الإجمالي.',
              )
            }}
          </p>
          <ul>
            <li v-for="item in overlaps" :key="item.name" dir="auto">
              <strong>{{ item.name }}</strong
              >:
              {{ item.plans.map((p) => [p.title, p.goal].filter(Boolean).join(' · ')).join('، ') }}
            </li>
          </ul>
        </section>
        <RouterLink class="button" :to="context.base + '/training'">{{
          l('Open training institution', 'فتح مساحة التدريب')
        }}</RouterLink>
      </section>
      <form v-else @submit.prevent="review ? deliver() : (review = true)">
        <fieldset class="form-fields" :disabled="locked">
          <template v-if="!review">
            <!-- Plan settings come first; adding and the selected list sit side by side below. -->
            <section class="delivery-card delivery-run" aria-labelledby="delivery-run-title">
              <header class="delivery-card-head">
                <span class="delivery-step" aria-hidden="true">1</span>
                <div>
                  <h2 id="delivery-run-title">{{ l('How should it run?', 'كيف يُنفّذ؟') }}</h2>
                  <p>
                    {{
                      l(
                        'Dates follow each athlete’s timezone. Cycle day 1 is the start date; unfilled days are recovery days.',
                        'التواريخ بحسب المنطقة الزمنية للرياضي. اليوم الأول هو تاريخ البداية والأيام الفارغة للتعافي.',
                      )
                    }}
                  </p>
                </div>
              </header>
              <div class="run-fields">
                <label
                  >{{ l('Schedule', 'الجدول')
                  }}<select v-model="mode">
                    <option value="flexible">
                      {{ l('Flexible — choose a session', 'مرن — اختيار الحصة') }}
                    </option>
                    <option value="cycle">
                      {{ l('Follow the program cycle', 'اتباع دورة البرنامج') }}
                    </option>
                  </select></label
                ><label
                  >{{ l('Start date', 'تاريخ البداية')
                  }}<input v-model="start" type="date" required /></label
                ><label
                  >{{ l('End date (optional)', 'تاريخ النهاية (اختياري)')
                  }}<input v-model="end" type="date" :min="start" /></label
                ><template
                  ><label
                    >{{ l('Goal (optional)', 'الهدف (اختياري)')
                    }}<input
                      v-model="goal"
                      maxlength="80"
                      :placeholder="l('For example: match speed', 'مثال: سرعة المباراة')" /></label
                  ><label
                    >{{ l('Sport (optional)', 'الرياضة (اختياري)')
                    }}<select v-model="sport">
                      <option value="">{{ l('Not sport-specific', 'غير مرتبطة برياضة') }}</option>
                      <option v-for="s in sports" :key="s.id" :value="s.id">{{ s.name }}</option>
                    </select></label
                  ></template
                >
              </div>
              <p v-if="context.view === 'trainer'" class="small-print">
                {{
                  l(
                    'If you support an athlete for one sport, label the plan with that sport. Primary coaches can assign any plan.',
                    'إذا كنت تدعم رياضياً في رياضة واحدة، فاربط الخطة بتلك الرياضة. يمكن للمدرب الأساسي تعيين أي خطة.',
                  )
                }}
              </p>
            </section>
            <div class="delivery-setup">
              <section class="delivery-card" aria-labelledby="delivery-add-title">
                <header class="delivery-card-head">
                  <span class="delivery-step" aria-hidden="true">2</span>
                  <div>
                    <h2 id="delivery-add-title">{{ l('Add athletes', 'إضافة رياضيين') }}</h2>
                    <p id="recipient-search-hint">
                      {{
                        l(
                          `Shows the top ${MATCHES} matches. Coaches can assign only to the athletes they are responsible for.`,
                          `تظهر أفضل ${MATCHES} نتائج. يمكن للمدرب التعيين فقط للرياضيين الذين يتولى مسؤوليتهم.`,
                        )
                      }}
                    </p>
                  </div>
                </header>
                <label class="recipient-search"
                  ><span class="sr-only">{{ l('Find athletes', 'البحث عن رياضيين') }}</span
                  ><span class="search-field"
                    ><PhMagnifyingGlass :size="18" aria-hidden="true" /><input
                      :placeholder="
                        emailSearch
                          ? l('Search by name or email…', 'ابحث بالاسم أو البريد الإلكتروني…')
                          : l('Search by name…', 'ابحث بالاسم…')
                      "
                      v-model="search"
                      type="search"
                      aria-describedby="recipient-search-hint" /></span
                ></label>
                <ul
                  v-if="search.trim()"
                  class="match-list"
                  :aria-label="l('Matching athletes', 'الرياضيون المطابقون')"
                  :aria-busy="searching"
                >
                  <li v-for="person in visible" :key="person.id">
                    <button
                      type="button"
                      class="match-card"
                      :class="{
                        'is-assigned': onThisVersion(person),
                        'is-added': selected.includes(person.id),
                      }"
                      :disabled="
                        onThisVersion(person) ||
                        selected.includes(person.id) ||
                        selected.length >= MAX_RECIPIENTS
                      "
                      :aria-label="
                        onThisVersion(person)
                          ? person.name +
                            ': ' +
                            l('already on this program', 'على هذا البرنامج بالفعل')
                          : selected.includes(person.id)
                            ? person.name + ': ' + l('added', 'أُضيف')
                            : l('Add ', 'إضافة ') + person.name
                      "
                      @click="add(person.id)"
                    >
                      <span class="avatar small" aria-hidden="true">{{
                        initials(person.name)
                      }}</span
                      ><span class="match-text"
                        ><strong
                          ><bdi>{{ person.name }}</bdi></strong
                        ><small v-if="person.email"
                          ><bdi dir="ltr">{{ person.email }}</bdi></small
                        ><small v-if="onThisVersion(person)" class="match-status">{{
                          l('Already on this program', 'على هذا البرنامج بالفعل')
                        }}</small
                        ><small v-else-if="earlierVersion(person)" class="match-status">{{
                          l(
                            `On version ${earlierVersion(person)!.version_revision} · will move to this version`,
                            `على النسخة ${earlierVersion(person)!.version_revision} · سينتقل إلى هذه النسخة`,
                          )
                        }}</small
                        ><small v-else-if="selected.includes(person.id)" class="match-status">{{
                          l('Added to the selection', 'أُضيف إلى القائمة')
                        }}</small
                        ><small v-else>{{ currentPlans(person) }}</small></span
                      ><span class="match-icon" aria-hidden="true"
                        ><PhCheck
                          v-if="onThisVersion(person) || selected.includes(person.id)"
                          :size="16"
                          weight="bold" /><PhPlus v-else :size="16" weight="bold"
                      /></span>
                    </button>
                  </li>
                  <li v-if="!visible.length && !searching" class="match-empty">
                    {{
                      l(
                        'No matching athletes. Check the spelling or invite the athlete first.',
                        'لا يوجد رياضيون مطابقون. تحقق من الكتابة أو ادعُ الرياضي أولاً.',
                      )
                    }}
                  </li>
                </ul>
                <p v-if="selected.length >= MAX_RECIPIENTS" class="notice" role="status">
                  {{
                    l(
                      `One assignment can include up to ${MAX_RECIPIENTS} athletes.`,
                      `يمكن أن يشمل التعيين الواحد حتى ${MAX_RECIPIENTS} رياضياً.`,
                    )
                  }}
                </p>
              </section>
              <section
                class="delivery-card selected-recipients"
                :aria-label="l('Selected athletes', 'الرياضيون المحددون')"
              >
                <header class="delivery-card-head">
                  <span class="delivery-step" aria-hidden="true">3</span>
                  <div>
                    <h2>
                      {{ l('Selected athletes', 'الرياضيون المحددون')
                      }}<span class="selected-count">{{ selected.length }}</span>
                    </h2>
                    <p>
                      {{
                        l(
                          'Check each athlete’s current plans. Use Change to replace one instead of adding alongside it.',
                          'راجع الخطط الحالية لكل رياضي. استخدم «تغيير» لاستبدال خطة بدلاً من الإضافة إليها.',
                        )
                      }}
                    </p>
                  </div>
                  <button
                    v-if="selected.length > 1 && !confirmClear"
                    type="button"
                    class="text-link selected-clear danger-action"
                    @click="confirmClear = true"
                  >
                    {{ l('Remove all', 'إزالة الكل') }}
                  </button>
                </header>
                <p v-if="confirmClear" class="notice" role="alert">
                  {{
                    l(
                      `Remove all ${selected.length} selected athletes and their plan choices?`,
                      `إزالة جميع الرياضيين المحددين (${selected.length}) واختيارات خططهم؟`,
                    )
                  }}
                  <button type="button" class="text-link danger-action" @click="clearAll">
                    {{ l('Remove all', 'إزالة الكل') }}</button
                  ><button type="button" class="text-link" @click="confirmClear = false">
                    {{ l('Keep them', 'الإبقاء عليهم') }}
                  </button>
                </p>
                <p v-if="removed" class="small-print" role="status">
                  {{ l('Removed', 'أُزيل') }} <bdi>{{ removed.name }}</bdi
                  >.
                  <button type="button" class="text-link" @click="undoRemove">
                    {{ l('Undo', 'تراجع') }}
                  </button>
                </p>
                <p v-if="blocked.length" class="notice error" role="alert">
                  {{
                    l(
                      'Already on this program: remove them to continue.',
                      'على هذا البرنامج بالفعل: أزلهم للمتابعة.',
                    )
                  }}
                  <bdi>{{ blocked.map(nameOf).join('، ') }}</bdi>
                </p>
                <p v-if="!selected.length" class="selected-empty">
                  {{
                    l(
                      'No athletes yet. Search above and select a name to add it here.',
                      'لا يوجد رياضيون بعد. ابحث أعلاه واختر اسماً لإضافته هنا.',
                    )
                  }}
                </p>
                <ul v-else class="selected-list">
                  <li
                    v-for="id in selected"
                    :key="id"
                    class="selected-card"
                    :class="{ 'is-blocked': onThisVersion(personOf(id)) }"
                  >
                    <span class="avatar small" aria-hidden="true">{{ initials(nameOf(id)) }}</span>
                    <div class="selected-identity">
                      <strong
                        ><bdi>{{ nameOf(id) }}</bdi></strong
                      >
                      <small v-if="personOf(id)?.email"
                        ><bdi dir="ltr">{{ personOf(id)?.email }}</bdi></small
                      >
                      <small v-if="personOf(id)">{{ currentPlans(personOf(id)!) }}</small>
                    </div>
                    <div v-if="personOf(id)" class="selected-outcome">
                      <span
                        class="tag"
                        :data-status="!onThisVersion(personOf(id)) ? 'active' : 'published'"
                        >{{
                          onThisVersion(personOf(id))
                            ? l('Already on this program', 'على هذا البرنامج بالفعل')
                            : outcome(personOf(id)!)
                        }}</span
                      ><button
                        v-if="personOf(id)?.plans?.length && !onThisVersion(personOf(id))"
                        type="button"
                        class="button secondary small"
                        :aria-label="
                          l('Change plan choice for ', 'تغيير اختيار الخطة لـ ') + nameOf(id)
                        "
                        @click="openChoice(id)"
                      >
                        <PhSwap :size="16" aria-hidden="true" />{{ l('Change', 'تغيير') }}
                      </button>
                    </div>
                    <button
                      type="button"
                      class="icon-button selected-remove danger-action"
                      :aria-label="l('Remove ', 'إزالة ') + nameOf(id)"
                      @click="remove(id)"
                    >
                      <PhX :size="18" aria-hidden="true" />
                    </button>
                  </li>
                </ul>
              </section>
            </div>
            <div class="delivery-bar">
              <p>
                <strong>{{
                  l(
                    `${recipients.length} ${recipients.length === 1 ? 'athlete' : 'athletes'}`,
                    `${recipients.length} رياضي`,
                  )
                }}</strong>
                · {{ l('Starts', 'يبدأ') }} {{ start }}
              </p>
              <button
                class="button"
                :disabled="
                  !recipients.length || recipients.length !== selected.length || !!blocked.length
                "
              >
                {{ l('Review assignment', 'مراجعة التعيين') }} · {{ recipients.length }}
              </button>
            </div>
          </template>
          <section v-else class="delivery-card">
            <header class="delivery-card-head">
              <span class="delivery-step" aria-hidden="true"
                ><PhCheck :size="16" weight="bold"
              /></span>
              <div>
                <h2>{{ l('Review before assigning', 'راجع قبل التعيين') }}</h2>
                <p>
                  <strong>{{ version?.title }}</strong
                  ><template v-if="goal.trim()"> · {{ goal.trim() }}</template
                  ><template v-if="sport">
                    · {{ sports.find((s) => s.id === sport)?.name }}</template
                  >
                  · {{ start }}{{ end ? ' → ' + end : '' }} ·
                  {{
                    mode === 'cycle' ? l('Program cycle', 'دورة البرنامج') : l('Flexible', 'مرن')
                  }}
                </p>
              </div>
            </header>
            <ul class="review-list">
              <li v-for="person in recipients" :key="person.id" dir="auto">
                {{ person.name }} —
                {{ outcome(person) }}
              </li>
            </ul>
            <p class="small-print">
              {{
                l(
                  'Existing started sessions retain their original prescription. This does not edit the program for other athletes.',
                  'تحتفظ الحصص التي بدأت بتعليماتها الأصلية. لا يتغير برنامج الرياضيين الآخرين.',
                )
              }}
            </p>
            <div class="actions">
              <button type="button" class="button secondary" @click="review = false">
                {{ l('Back to selection', 'العودة للاختيار') }}</button
              ><button
                class="button"
                :disabled="
                  !recipients.length || recipients.length !== selected.length || !!blocked.length
                "
              >
                {{ l('Confirm assignment', 'تأكيد التعيين') }}
              </button>
            </div>
          </section>
        </fieldset>
      </form></PageState
    >
    <DialogRoot :open="!!choosing" @update:open="(open) => !open && (choosing = '')">
      <DialogPortal>
        <DialogOverlay class="ui-dialog-overlay" />
        <DialogContent class="ui-dialog" :dir="locale === 'ar' ? 'rtl' : 'ltr'">
          <DialogTitle
            >{{ l('Current plans', 'الخطط الحالية') }} ·
            <bdi>{{ nameOf(choosing) }}</bdi></DialogTitle
          >
          <DialogDescription>
            {{
              l(
                'Keep every current plan and add this one, or replace one of them. Started sessions keep their original prescription.',
                'أبقِ كل الخطط الحالية وأضف هذه الخطة، أو استبدل إحداها. تحتفظ الحصص التي بدأت بتعليماتها الأصلية.',
              )
            }}
          </DialogDescription>
          <fieldset class="plan-choices">
            <legend class="sr-only">{{ l('Plan choice', 'اختيار الخطة') }}</legend>
            <label class="plan-choice"
              ><input v-model="choice" type="radio" name="plan-choice" value="" /><span
                ><strong>{{ l('Keep current plans', 'إبقاء الخطط الحالية') }}</strong
                ><small>{{
                  l('Add this program alongside them', 'إضافة هذا البرنامج إليها')
                }}</small></span
              ></label
            >
            <label v-for="plan in personOf(choosing)?.plans" :key="plan.id" class="plan-choice"
              ><input v-model="choice" type="radio" name="plan-choice" :value="plan.id" /><span
                ><strong dir="auto">{{ l('Replace ', 'استبدال ') + planLabel(plan) }}</strong
                ><small v-if="plan.id === earlierVersion(personOf(choosing))?.id">{{
                  l(
                    `Version ${plan.version_revision} of this program`,
                    `النسخة ${plan.version_revision} من هذا البرنامج`,
                  )
                }}</small></span
              ></label
            >
          </fieldset>
          <div class="ui-dialog-actions">
            <DialogClose as-child
              ><button type="button" class="button secondary danger-action">
                {{ l('Cancel', 'إلغاء') }}
              </button></DialogClose
            ><button type="button" class="button" @click="applyChoice">
              {{ l('Apply', 'تطبيق') }}
            </button>
          </div>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  </div>
</template>
<style scoped>
.delivery-version {
  align-self: flex-start;
  font-size: var(--text-small);
}
/* Raised cards with a numbered header give the three steps a clear order and weight. */
.delivery-card {
  min-width: 0;
  padding: var(--space-6);
  border: 1px solid var(--line);
  border-radius: var(--radius-panel, 12px);
  background: var(--surface);
  box-shadow: var(--shadow);
}
.delivery-card-head {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  margin-bottom: var(--space-5);
}
.delivery-card-head > div {
  flex: 1;
  min-width: 0;
}
.delivery-card-head h2 {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  font-size: var(--text-panel);
}
.delivery-card-head p {
  margin: var(--space-1) 0 0;
  color: var(--muted);
  font-size: var(--text-small);
  line-height: 1.6;
}
.delivery-step {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--on-accent);
  font-weight: 700;
  font-size: var(--text-small);
}
.delivery-run {
  margin-bottom: var(--space-6);
}
.delivery-setup {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
  gap: var(--space-6);
  margin-bottom: var(--space-6);
}
.recipient-search {
  display: block;
  margin: 0;
}
.search-field {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 48px;
  padding-inline: var(--space-4);
  border: 1px solid var(--line);
  border-radius: var(--radius-control, 8px);
  background: var(--page);
  color: var(--muted);
}
.search-field:focus-within {
  border-color: var(--accent);
  outline: 2px solid color-mix(in srgb, var(--accent) 35%, transparent);
}
.search-field input {
  flex: 1;
  min-width: 0;
  min-height: 46px;
  border: 0;
  padding: 0;
  background: transparent;
  outline: none;
}
/* Compact name cards: the whole card adds the athlete; the plus shows it can be added. */
.match-list {
  display: grid;
  gap: var(--space-2);
  margin: var(--space-3) 0 0;
  padding: 0;
  list-style: none;
}
.match-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  min-height: 56px;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--line);
  border-radius: var(--radius-control, 8px);
  background: var(--page);
  color: var(--ink);
  text-align: start;
  font: inherit;
  cursor: pointer;
}
.match-card:hover:not(:disabled) {
  border-color: var(--accent);
  background: var(--tint);
}
.match-card:disabled {
  cursor: default;
  opacity: 1;
}
.match-card.is-added {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 16%, var(--page));
}
.match-card.is-added .match-icon {
  background: var(--accent);
  color: var(--on-accent);
}
.match-card.is-assigned {
  border-style: dashed;
  background: transparent;
}
.match-card.is-assigned .avatar,
.match-card.is-assigned .match-text {
  opacity: 0.55;
}
.match-text {
  display: grid;
  flex: 1;
  gap: 2px;
  min-width: 0;
  overflow-wrap: anywhere;
}
.match-text small {
  color: var(--muted);
  font-size: 0.8rem;
}
.match-text .match-status {
  color: var(--ink);
  font-weight: 600;
}
.match-icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--on-accent);
}
.match-card.is-assigned .match-icon {
  background: var(--surface-soft);
  color: var(--muted);
}
.match-empty {
  padding: var(--space-3) 0;
  color: var(--muted);
  font-size: var(--text-small);
}
.run-fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: var(--space-4);
}
.run-fields label {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  min-width: 0;
}
.selected-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  height: 22px;
  padding-inline: 7px;
  border-radius: 999px;
  background: var(--tint);
  color: var(--accent);
  font-size: 0.75rem;
  font-weight: 700;
}
.selected-clear {
  flex-shrink: 0;
  min-height: 32px;
}
.selected-empty {
  margin: 0;
  padding: var(--space-6);
  border: 1px dashed var(--line);
  border-radius: var(--radius-control, 8px);
  color: var(--muted);
  font-size: var(--text-small);
}
.selected-list {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.selected-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3) var(--space-4);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--line);
  border-radius: var(--radius-control, 8px);
  background: var(--page);
}
.selected-card.is-blocked {
  border-color: color-mix(in srgb, var(--error), transparent 40%);
}
.selected-identity {
  display: grid;
  gap: 2px;
  min-width: 0;
  overflow-wrap: anywhere;
}
.selected-identity small {
  color: var(--muted);
  font-size: 0.8rem;
}
.selected-outcome {
  grid-column: 2 / -1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  gap: var(--space-2);
}
.selected-outcome .button {
  margin: 0;
}
.selected-remove {
  grid-row: 1;
  grid-column: 3;
  color: var(--muted);
}
/* The next step stays in reach at the end of a long selection. */
.delivery-bar {
  position: sticky;
  bottom: 0;
  z-index: 3;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-top: var(--space-6);
  padding: var(--space-4) 0;
  border-top: 1px solid var(--line);
  background: var(--page);
}
.delivery-bar p {
  margin: 0;
  color: var(--muted);
  font-size: var(--text-small);
}
.delivery-bar strong {
  color: var(--ink);
}
.delivery-bar .button {
  margin: 0;
}
.review-list {
  display: grid;
  gap: var(--space-2);
  padding-inline-start: var(--space-5);
}
.plan-choices {
  display: grid;
  gap: var(--space-2);
  margin: 0 0 var(--space-5);
  padding: 0;
  border: 0;
}
.plan-choice {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  margin: 0;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--line);
  border-radius: var(--radius-control, 8px);
  cursor: pointer;
}
.plan-choice:has(input:checked) {
  border-color: var(--accent);
  background: var(--tint);
}
.plan-choice input {
  width: 18px;
  min-height: 18px;
  margin: 3px 0 0;
}
.plan-choice span {
  display: grid;
  gap: 2px;
  min-width: 0;
  overflow-wrap: anywhere;
}
.plan-choice small {
  color: var(--muted);
}
@media (max-width: 980px) {
  .delivery-setup {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 600px) {
  .delivery-card {
    padding: var(--space-4);
  }
  .run-fields {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
