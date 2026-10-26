<script setup lang="ts">
import { PhTray } from '@phosphor-icons/vue'
import { useListPageSize } from '../../lib/list-page-size'
import PageHeading from '../../components/PageHeading.vue'
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { request } from '../../lib/backend'
import { language as l, dateLabel, errorMessage } from '../../lib/i18n'
import type { Session } from '../../lib/domain'
import { programContext } from '../coaching/program-context'
import AthleteSearch from '../../components/AthleteSearch.vue'
import ListPagination from '../../components/ListPagination.vue'
import PageState from '../../components/PageState.vue'
const route = useRoute(),
  router = useRouter(),
  context = programContext(route)
type History = {
  members: { id: string; name: string; active: boolean }[]
  sessions: (Session & { member_id: string })[]
  total: number
  next: string | null
}
const data = ref<History>(),
  offset = ref(0),
  loading = ref(false),
  error = ref(''),
  search = ref(String(route.query.search || ''))
let generation = 0,
  disposed = false
const { recordLimit, appliedLimit, pageSizes, acceptLimit, changeLimit } = useListPageSize(
  10,
  () => {
    void load()
  },
)
async function load() {
  const current = ++generation
  loading.value = true
  error.value = ''
  const query = new URLSearchParams({
    view: context.view,
    history: 'true',
    search: String(route.query.search || ''),
    limit: String(recordLimit.value),
    offset: String(Math.max(0, Number(route.query.offset) || 0)),
  })
  try {
    const result = await request<History>(`/v1/institution/delivery?${query}`)
    if (disposed || current !== generation) return
    data.value = result
    acceptLimit()
    offset.value = Math.max(0, Number(route.query.offset) || 0)
  } catch (e) {
    if (!disposed && current === generation) {
      error.value = errorMessage(e)
      if ((e as { statusCode?: number }).statusCode === 403) data.value = undefined
    }
  } finally {
    if (!disposed && current === generation) loading.value = false
  }
}
function navigate(page = 0) {
  return router.push({
    query: {
      limit: route.query.limit,
      ...(search.value.trim() ? { search: search.value.trim() } : {}),
      ...(page ? { offset: page } : {}),
    },
  })
}
watch(
  () => [route.query.search, route.query.offset],
  () => {
    search.value = String(route.query.search || '')
    void load()
  },
)
onMounted(() => load())
onUnmounted(() => {
  disposed = true
  generation++
})
const name = (id: string) =>
  data.value?.members.find((m) => m.id === id)?.name || l('Former member', 'عضو سابق')
</script>
<template>
  <div class="container page session-history-page">
    <PageHeading class="work-heading">
      <div>
        <p class="overline">{{ l('Recorded workouts', 'التمارين المسجّلة') }}</p>
        <h1>{{ l('Workout history', 'سجل التمارين') }}</h1>
        <p>
          {{
            l(
              'Latest workouts first. Open a session to review its recorded work.',
              'أحدث الحصص أولاً. افتح حصة لمراجعة التمارين المسجّلة.',
            )
          }}
        </p>
      </div>
      <div class="actions">
        <RouterLink
          v-if="context.view !== 'trainee'"
          class="button secondary"
          :to="context.base + '/events'"
          >{{ l('Schedule', 'الجدول') }}</RouterLink
        >
        <RouterLink class="button secondary" :to="context.base + '/training'">{{
          context.view === 'trainee'
            ? l('My training', 'تدريبي')
            : l('Athlete plans', 'خطط الرياضيين')
        }}</RouterLink>
      </div>
    </PageHeading>
    <div class="list-toolbar">
      <form
        v-if="context.view !== 'trainee'"
        class="history-search-form"
        @submit.prevent="navigate()"
      >
        <AthleteSearch v-model="search" />
        <button class="button secondary" :disabled="loading">{{ l('Search', 'بحث') }}</button>
      </form>
      <h2 v-else class="list-section-label">{{ l('Recorded sessions', 'الحصص المسجلة') }}</h2>
      <div class="list-toolbar-pagination">
        <ListPagination
          :label="l('Session pages', 'صفحات الحصص')"
          :offset="offset"
          :page-size="appliedLimit"
          :sizes="pageSizes"
          @page-size="changeLimit"
          :total="data?.total || 0"
          :disabled="loading"
          @page="navigate"
        />
      </div>
    </div>
    <p v-if="loading && data" role="status" class="small-print">
      {{ l('Updating sessions…', 'جارٍ تحديث الحصص…') }}
    </p>
    <p v-if="error && data" role="alert" class="notice error">
      {{ error }}
      <button class="text-link" @click="load()">{{ l('Retry', 'إعادة المحاولة') }}</button>
    </p>
    <PageState :loading="loading && !data" :error="!data ? error : ''" @retry="load()"
      ><template v-if="data">
        <section v-if="!data.sessions.length" class="empty-state panel">
          <PhTray :size="28" aria-hidden="true" />
          <h2>
            {{
              search
                ? l('No sessions match this search.', 'لا توجد حصص مطابقة لهذا البحث.')
                : l('No recorded sessions yet.', 'لا توجد حصص مسجّلة بعد.')
            }}
          </h2>
          <p>
            {{
              l(
                search
                  ? 'Try another athlete name or clear the search.'
                  : 'Workouts appear here once an athlete starts an assigned session. Scheduled events stay in Schedule.',
                search
                  ? 'جرّب اسم رياضي آخر أو امسح البحث.'
                  : 'تظهر التمارين هنا عندما يبدأ الرياضي حصة معيّنة. تبقى المواعيد المجدولة في الجدول.',
              )
            }}
          </p>
        </section>
        <ol v-else class="session-list">
          <li v-for="session in data.sessions" :key="session.id">
            <RouterLink
              class="session-row"
              :to="
                context.view === 'trainee'
                  ? '/workout/' + session.id + '?institution=' + context.institution
                  : context.base + '/review/' + session.id
              "
            >
              <div>
                <p class="overline" dir="auto">
                  {{
                    context.view === 'trainee'
                      ? l('Your workout', 'تمرينك')
                      : name(session.member_id)
                  }}
                </p>
                <h2 dir="auto">{{ session.prescription.name }}</h2>
                <p dir="auto">{{ session.title }} · {{ dateLabel(session.started_at) }}</p>
              </div>
              <span
                class="tag"
                :data-status="
                  session.reviewed_at
                    ? 'reviewed'
                    : session.status === 'completed'
                      ? 'awaiting_review'
                      : 'in_progress'
                "
                >{{
                  session.status === 'completed'
                    ? session.reviewed_at
                      ? l('Reviewed', 'تمت المراجعة')
                      : l('Awaiting review', 'بانتظار المراجعة')
                    : l('In progress', 'قيد التنفيذ')
                }}</span
              ><span aria-hidden="true">↗</span>
            </RouterLink>
          </li>
        </ol>
      </template></PageState
    >
  </div>
</template>
<style scoped>
.history-filter {
  margin-block: 20px;
}
.session-list {
  list-style: none;
  margin: 20px 0;
  padding: 0;
  display: grid;
  gap: 12px;
}
.session-row {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  align-items: center;
  padding: var(--space-6);
  color: var(--ink);
  text-decoration: none;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-panel);
}
.session-row:hover {
  border-color: var(--accent);
}
.session-row > div {
  min-width: 0;
  flex: 1 1 230px;
  overflow-wrap: anywhere;
}
.session-row h2 {
  margin: 6px 0;
  font-size: var(--text-panel);
}
.session-row p {
  margin: 0;
}
.session-row .overline {
  color: var(--muted);
}
@media (max-width: 500px) {
  .session-row {
    padding: 18px;
    gap: 12px;
  }
}
</style>
