<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { institutionContext } from '../../app/institution'
import { request } from '../../lib/backend'
import { language as l, errorMessage } from '../../lib/i18n'
import { useListPageSize } from '../../lib/list-page-size'
import { useLiveSearch } from '../../lib/live-search'
import type { WorkoutTemplate } from '../../lib/workout-templates'
import PageHeading from '../../components/PageHeading.vue'
import PageState from '../../components/PageState.vue'
import EmptyState from '../../components/EmptyState.vue'
import ListPagination from '../../components/ListPagination.vue'
import { PhPlus, PhBarbell } from '@phosphor-icons/vue'
const context = institutionContext(),
  items = ref<WorkoutTemplate[]>([]),
  search = ref(''),
  offset = ref(0),
  total = ref(0),
  archived = ref(false),
  loading = ref(true),
  error = ref('')
const { recordLimit, appliedLimit, pageSizes, acceptLimit, changeLimit } = useListPageSize(
  24,
  () => {
    offset.value = 0
    void load()
  },
)
let generation = 0,
  disposed = false
onUnmounted(() => {
  disposed = true
  generation++
})
async function load() {
  const current = ++generation
  loading.value = true
  error.value = ''
  try {
    const data = await request<{ items: WorkoutTemplate[]; total: number }>(
      '/v1/institution/workout-templates?' +
        new URLSearchParams({
          view: context.view,
          search: search.value,
          offset: String(offset.value),
          limit: String(recordLimit.value),
          archived: String(archived.value),
        }),
      { feedback: 'none' },
    )
    if (disposed || current !== generation) return
    items.value = data.items
    total.value = data.total
    acceptLimit()
  } catch (e) {
    if (!disposed && current === generation) error.value = errorMessage(e)
  } finally {
    if (!disposed && current === generation) loading.value = false
  }
}
const live = useLiveSearch(search, () => {
  offset.value = 0
  void load()
})
function page(value: number) {
  offset.value = value
  void load()
}
function filter() {
  offset.value = 0
  void load()
}
onMounted(load)
</script>
<template>
  <div class="container page">
    <PageHeading class="heading-actions"
      ><div>
        <h1>{{ l('Workout templates', 'قوالب التمارين') }}</h1>
        <p>
          {{
            l(
              'Reusable workouts for programs and group sessions. Copies keep their own prescription.',
              'تمارين قابلة لإعادة الاستخدام في البرامج والحصص الجماعية. تحتفظ النسخ بوصفتها المستقلة.',
            )
          }}
        </p>
      </div>
      <RouterLink class="button" to="/workout-templates/new"
        ><PhPlus :size="18" />{{ l('Create workout template', 'إنشاء قالب تمرين') }}</RouterLink
      ></PageHeading
    >
    <div class="list-toolbar">
      <form @submit.prevent="live.submit()">
        <label
          >{{ l('Search workouts', 'البحث عن التمارين')
          }}<input
            v-model="search"
            type="search"
            :placeholder="l('Search workout names…', 'ابحث بأسماء التمارين…')"
        /></label>
      </form>
      <label
        ><input v-model="archived" type="checkbox" @change="filter" />{{
          l('Show archived', 'عرض المؤرشفة')
        }}</label
      ><ListPagination
        :offset="offset"
        :page-size="appliedLimit"
        :total="total"
        :sizes="pageSizes"
        :disabled="loading"
        @page="page"
        @page-size="changeLimit"
      />
    </div>
    <PageState :loading="loading && !items.length" :error="error" @retry="load"
      ><EmptyState
        v-if="!items.length"
        :title="l('No matching workout templates', 'لا توجد قوالب تمارين مطابقة')"
        :description="
          l(
            'Create one workout, then copy it into a program or choose it for a group session.',
            'أنشئ تمريناً ثم انسخه إلى برنامج أو اختره لحصة جماعية.',
          )
        "
      />
      <div v-else class="workout-template-grid">
        <article v-for="item in items" :key="item.id" class="panel">
          <PhBarbell :size="24" aria-hidden="true" />
          <h2>
            <RouterLink :to="'/workout-templates/' + item.id"
              ><bdi>{{ item.title }}</bdi></RouterLink
            >
          </h2>
          <p class="small-print">
            {{ item.workout.minutes }} {{ l('minutes', 'دقيقة') }} ·
            {{ item.workout.exercises.length }} {{ l('exercises', 'تمارين') }} ·
            {{ l('Revision', 'النسخة') }} {{ item.revision }}
          </p>
          <div class="actions">
            <RouterLink class="button secondary" :to="'/workout-templates/' + item.id">{{
              item.can_edit
                ? l('View and edit', 'عرض وتعديل')
                : l('Preview workout', 'معاينة التمرين')
            }}</RouterLink
            ><RouterLink
              v-if="!item.archived"
              class="text-link"
              :to="{ path: '/plans/new', query: { workoutTemplate: item.id } }"
              >{{ l('Use in a new program', 'استخدامه في برنامج جديد') }}</RouterLink
            >
          </div>
        </article>
      </div></PageState
    >
  </div>
</template>
<style scoped>
.workout-template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
  gap: var(--space-5);
}
.workout-template-grid article {
  display: grid;
  align-content: start;
  gap: var(--space-3);
}
.workout-template-grid h2,
.workout-template-grid p {
  margin: 0;
}
.workout-template-grid .actions {
  margin-top: auto;
}
</style>
