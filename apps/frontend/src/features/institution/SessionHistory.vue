<script setup lang="ts">
import { PhTray, PhCaretRight } from '@phosphor-icons/vue'
import { useLiveSearch } from '../../lib/live-search'
import { useListPageSize } from '../../lib/list-page-size'
import PageHeading from '../../components/PageHeading.vue'
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { request } from '../../lib/backend'
import { language as l, errorMessage } from '../../lib/i18n'
import { dateLabel } from '../../lib/display-time'
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
  search = ref(String(route.query.search || '')),
  status = ref(String(route.query.status || ''))
const statuses = [
  ['', ['All', 'الكل']],
  ['awaiting_review', ['Awaiting review', 'بانتظار المراجعة']],
  ['in_progress', ['In progress', 'قيد التنفيذ']],
  ['reviewed', ['Reviewed', 'تمت المراجعة']],
] as const
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
    ...(route.query.status ? { status: String(route.query.status) } : {}),
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
function navigate(page = 0, replace = false) {
  return router[replace ? 'replace' : 'push']({
    query: {
      limit: route.query.limit,
      ...(search.value.trim() ? { search: search.value.trim() } : {}),
      ...(status.value ? { status: status.value } : {}),
      ...(page ? { offset: page } : {}),
    },
  })
}
const live = useLiveSearch(search, () => navigate(0, true))
watch(
  () => [route.query.search, route.query.status, route.query.offset],
  () => {
    live.restore(String(route.query.search || ''))
    status.value = String(route.query.status || '')
    void load()
  },
)
onMounted(() => load())
onUnmounted(() => {
  disposed = true
  generation++
})
const state = (session: Session) =>
  session.status !== 'completed'
    ? 'in_progress'
    : session.reviewed_at
      ? 'reviewed'
      : 'awaiting_review'
const stateLabel = (session: Session) =>
  ({
    in_progress: l('In progress', 'قيد التنفيذ'),
    awaiting_review: l('Awaiting review', 'بانتظار المراجعة'),
    reviewed: l('Reviewed', 'تمت المراجعة'),
  })[state(session)]
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
              'Latest plan workouts first. Group workout results are available inside their scheduled event.',
              'أحدث تمارين الخطط أولاً. تظهر نتائج التمرين الجماعي داخل موعده المجدول.',
            )
          }}
        </p>
      </div>
      <div v-if="context.view === 'trainee'" class="actions">
        <RouterLink class="button secondary" :to="context.base + '/training'">{{
          l('My training', 'تدريبي')
        }}</RouterLink>
      </div>
    </PageHeading>
    <div class="list-toolbar">
      <form
        v-if="context.view !== 'trainee'"
        class="history-search-form"
        @submit.prevent="live.submit()"
      >
        <AthleteSearch v-model="search" />
        <fieldset class="filter-chips">
          <legend>{{ l('Workout status', 'حالة التمرين') }}</legend>
          <label v-for="[value, text] in statuses" :key="value"
            ><input
              v-model="status"
              type="radio"
              name="session-status"
              :value="value"
              @change="navigate()"
            />{{ l(text[0], text[1]) }}</label
          >
        </fieldset>
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
              search || status
                ? l('No workouts match this view.', 'لا توجد تمارين مطابقة لهذا العرض.')
                : l('No recorded sessions yet.', 'لا توجد حصص مسجّلة بعد.')
            }}
          </h2>
          <p>
            {{
              l(
                search || status
                  ? 'Try another athlete name or status, or clear the filters.'
                  : 'Workouts appear here once an athlete starts an assigned session. Scheduled events stay in Schedule.',
                search || status
                  ? 'جرّب اسم رياضي أو حالة أخرى، أو امسح عوامل التصفية.'
                  : 'تظهر التمارين هنا عندما يبدأ الرياضي حصة معيّنة. تبقى المواعيد المجدولة في الجدول.',
              )
            }}
          </p>
        </section>
        <ol v-else class="record-list session-list">
          <li v-for="session in data.sessions" :key="session.id" class="record-row">
            <div class="record-title">
              <RouterLink
                :to="
                  context.view === 'trainee'
                    ? '/workout/' + session.id + '?institution=' + context.institution
                    : context.base + '/review/' + session.id
                "
                ><bdi dir="auto">{{
                  context.view === 'trainee' ? session.prescription.name : name(session.member_id)
                }}</bdi></RouterLink
              >
              <small
                ><template v-if="context.view !== 'trainee'"
                  ><bdi dir="auto">{{ session.prescription.name }}</bdi> · </template
                ><bdi dir="auto">{{ session.title }}</bdi></small
              >
            </div>
            <div class="record-meta">
              <span class="tag" :data-status="state(session)">{{ stateLabel(session) }}</span>
              <span
                ><small>{{ l('Started', 'بدأ') }}</small
                >{{ dateLabel(session.started_at) }}</span
              >
              <span v-if="session.completed_at"
                ><small>{{ l('Completed', 'اكتمل') }}</small
                >{{ dateLabel(session.completed_at) }}</span
              >
            </div>
            <div class="record-actions" aria-hidden="true">
              <PhCaretRight :size="18" class="row-caret" />
            </div>
          </li>
        </ol> </template
    ></PageState>
  </div>
</template>
<style scoped>
.history-search-form {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: var(--space-4);
}
.history-search-form .athlete-search {
  flex: 1 1 320px;
}
.session-list {
  margin-block: 0;
}
.row-caret {
  color: var(--muted);
}
.row-caret:dir(rtl) {
  transform: scaleX(-1);
}
</style>
