<script setup lang="ts">
import { PhTray } from '@phosphor-icons/vue'
import { useListPageSize } from '../../lib/list-page-size'
import PageHeading from '../../components/PageHeading.vue'
import ProgramCover from './ProgramCover.vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { PhPlus, PhArrowRight, PhBarbell } from '@phosphor-icons/vue'
import { request } from '../../lib/backend'
import { useRoute } from 'vue-router'
import { programContext } from './program-context'
const route = useRoute()
const context = programContext(route)
// Athlete-first assignment (from People, a profile or follow-up): cards continue to delivery.
const athlete = computed(() =>
  context.view !== 'trainee' ? String(route.query.athlete || '') : '',
)
/** Latest published (immutable) version; drafts without one cannot be assigned. */
const assignable = (planId: string) =>
  versions.value.filter((v) => v.plan_id === planId).sort((a, b) => b.revision - a.revision)[0]
const cardTarget = (planId: string) => {
  const version = athlete.value ? assignable(planId) : undefined
  return version
    ? { path: context.base + '/deliver/' + version.id, query: { member: athlete.value } }
    : context.base + '/plans/' + planId
}
const offset = ref(0),
  total = ref(0)
let loadSequence = 0
import type { Plan, PlanVersion } from '../../lib/domain'
import { language, t, errorMessage, dateLabel } from '../../lib/i18n'
import ListPagination from '../../components/ListPagination.vue'
import PageState from '../../components/PageState.vue'
const search = ref('')
watch(search, () => {
  offset.value = 0
  void load(0, true)
})
const filtered = computed(() =>
  plans.value.filter(
    (p) => !p.archived && p.title.toLocaleLowerCase().includes(search.value.toLocaleLowerCase()),
  ),
)
const plans = ref<Plan[]>([])
const versions = ref<PlanVersion[]>([])
const loading = ref(true)
const error = ref('')
const { recordLimit, appliedLimit, pageSizes, acceptLimit, changeLimit } = useListPageSize(
  24,
  () => {
    void load(0)
  },
)
async function load(page = offset.value, background = false) {
  const sequence = ++loadSequence
  if (!background) loading.value = true
  error.value = ''
  try {
    const result = await request<{
      items: (Plan & { version?: PlanVersion })[]
      next: number | null
      total: number
    }>(
      `/v1/institution/programs?view=${context.view}&search=${encodeURIComponent(search.value)}&offset=${page}&limit=${recordLimit.value}`,
    )
    if (sequence !== loadSequence) return
    plans.value = result.items
    versions.value = result.items.flatMap((p) =>
      p.version ? [{ ...p.version, plan_id: p.id }] : [],
    )
    total.value = result.total
    offset.value = page
    acceptLimit()
    plans.value.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  } catch (e) {
    if (sequence === loadSequence) error.value = errorMessage(e)
  } finally {
    if (sequence === loadSequence) loading.value = false
  }
}
onMounted(() => load())
onUnmounted(() => {
  loadSequence++
})
</script>
<template>
  <div class="container page">
    <PageHeading class="page-heading heading-actions">
      <div>
        <p class="overline">{{ t('coaching') }}</p>
        <h1>{{ language('Programs', 'البرامج') }}</h1>
        <p>
          {{
            context.view === 'trainee'
              ? language(
                  'Programs your institution has published. Open one to see its sessions and exercises.',
                  'البرامج التي نشرتها مؤسستك. افتح برنامجاً لرؤية حصصه وتمارينه.',
                )
              : language(
                  'Build once. Adapt thoughtfully. Keep completed training intact.',
                  'ابنِ الخطة. عدّلها بعناية. واحتفظ بالتدريب المكتمل.',
                )
          }}
        </p>
      </div>
      <RouterLink v-if="context.view !== 'trainee'" class="button" :to="context.base + '/plans/new'"
        ><PhPlus :size="18" aria-hidden="true" />{{ t('newPlan') }}</RouterLink
      >
    </PageHeading>
    <section v-if="athlete" class="notice assign-mode" role="status">
      <p>
        {{
          language(
            'Choose a published program to assign. The athlete is already selected on the next step.',
            'اختر برنامجاً منشوراً لتعيينه. الرياضي محدد مسبقاً في الخطوة التالية.',
          )
        }}
      </p>
      <RouterLink class="text-link" :to="{ query: { ...route.query, athlete: undefined } }">{{
        language('Cancel assigning', 'إلغاء التعيين')
      }}</RouterLink>
    </section>
    <div class="list-controls">
      <label v-if="search || plans.some((p) => !p.archived)" class="plan-search"
        >{{ language('Search programs', 'البحث في البرامج')
        }}<input
          v-model="search"
          type="search"
          :placeholder="language('Search program titles…', 'ابحث في عناوين البرامج…')"
      /></label>
      <ListPagination
        :offset="offset"
        :page-size="appliedLimit"
        :sizes="pageSizes"
        @page-size="changeLimit"
        :total="total"
        :disabled="loading"
        @page="load"
      />
    </div>
    <PageState :loading="loading" :error="error" @retry="load()">
      <p v-if="search && !filtered.length" class="notice">
        {{
          language('No matching plans. Try another title.', 'لا توجد خطط مطابقة. جرّب عنواناً آخر.')
        }}
      </p>
      <div v-if="filtered.length" class="plans-grid">
        <RouterLink
          v-for="p in context.institution ? filtered : filtered.slice(offset, offset + recordLimit)"
          :key="p.id"
          :to="cardTarget(p.id)"
          class="plan-card panel"
          ><ProgramCover :id="p.draft.presentation?.cover" />
          <div class="plan-card-top">
            <PhBarbell :size="28" aria-hidden="true" /><span
              v-if="context.view !== 'trainee'"
              class="plan-card-tags"
              ><span v-if="p.listed" class="tag" data-status="published">{{
                language('In library', 'في المكتبة')
              }}</span
              ><span
                class="tag"
                :data-status="
                  versions.some((v) => v.plan_id === p.id && v.revision === p.draft_version)
                    ? 'published'
                    : 'draft'
                "
                >{{
                  versions.some((v) => v.plan_id === p.id && v.revision === p.draft_version)
                    ? t('published')
                    : t('draft')
                }}</span
              ></span
            >
          </div>
          <h2>{{ p.title }}</h2>
          <p v-if="athlete" class="assign-hint">
            {{
              assignable(p.id)
                ? language('Assign this program', 'تعيين هذا البرنامج')
                : language('Publish before assigning', 'انشر البرنامج قبل تعيينه')
            }}
          </p>
          <p v-if="p.draft.presentation?.goal">{{ p.draft.presentation.goal }}</p>
          <p v-if="p.draft.presentation?.level">
            {{
              p.draft.presentation.level === 'beginner'
                ? language('Getting started', 'للمبتدئين')
                : p.draft.presentation.level === 'experienced'
                  ? language('Experienced', 'ذوو خبرة')
                  : language('Adaptable', 'قابل للتكييف')
            }}
          </p>
          <p>
            {{ p.draft.days.filter((d) => !d.restDay).length }} {{ language('sessions', 'حصص') }} ·
            {{ p.draft.cycleWeeks || 1 }} {{ language('week cycle', 'أسبوع للدورة') }} ·
            {{ p.draft.days.reduce((n, d) => n + d.exercises.length, 0) }}
            {{ t('exercises') }}
          </p>
          <div class="plan-card-bottom">
            <small>{{ language('Updated', 'تم التحديث') }} {{ dateLabel(p.updated_at) }}</small
            ><PhArrowRight :size="22" class="directional" aria-hidden="true" /></div
        ></RouterLink>
      </div>
      <section v-else-if="!search && context.view === 'trainee'" class="empty-state panel">
        <PhTray :size="28" aria-hidden="true" />
        <h2>{{ language('Your institution’s program library.', 'مكتبة برامج مؤسستك.') }}</h2>
        <p>
          {{
            language(
              'Programs appear here when your institution makes them available. Assigned training is in your Training institution.',
              'تظهر البرامج عندما تتيحها مؤسستك. التدريب المعيّن موجود في مساحة التدريب.',
            )
          }}
        </p>
        <RouterLink class="button secondary" :to="context.base + '/training'">{{
          language('Open my training', 'فتح تدريبي')
        }}</RouterLink>
      </section>
      <section v-else-if="!search" class="empty-state panel">
        <PhTray :size="28" aria-hidden="true" />
        <h2>
          {{ language('No programs yet', 'لا توجد برامج بعد') }}
        </h2>
        <p>
          {{
            language(
              'Create a program using exercises from your institution library, then publish it when it is ready.',
              'أنشئ برنامجاً باستخدام تمارين مكتبة المؤسسة، ثم انشره عندما يصبح جاهزاً.',
            )
          }}
        </p>
        <RouterLink
          v-if="context.view !== 'trainee'"
          class="button"
          :to="context.base + '/plans/new'"
          >{{ t('newPlan') }}</RouterLink
        >
      </section>
    </PageState>
  </div>
</template>
<style scoped>
.assign-mode {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
.assign-mode p {
  margin: 0;
}
.assign-hint {
  color: var(--accent);
  font-weight: 600;
}
</style>
