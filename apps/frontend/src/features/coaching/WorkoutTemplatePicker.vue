<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { institutionContext } from '../../app/institution'
import { request } from '../../lib/backend'
import { language as l, errorMessage } from '../../lib/i18n'
import { useLiveSearch } from '../../lib/live-search'
import type { WorkoutTemplate } from '../../lib/workout-templates'
import ListPagination from '../../components/ListPagination.vue'
import PageState from '../../components/PageState.vue'
import EmptyState from '../../components/EmptyState.vue'
import { PhArrowSquareOut } from '@phosphor-icons/vue'
const props = defineProps<{ selected?: string; revision?: number; disabled?: boolean }>()
const emit = defineEmits<{ choose: [WorkoutTemplate] }>()
const context = institutionContext(),
  search = ref(''),
  offset = ref(0),
  total = ref(0),
  items = ref<WorkoutTemplate[]>([]),
  chosen = ref<WorkoutTemplate>(),
  loading = ref(true),
  error = ref('')
let generation = 0,
  disposed = false
onUnmounted(() => {
  disposed = true
  generation++
  window.removeEventListener('focus', refresh)
})
async function load() {
  const current = ++generation
  loading.value = true
  error.value = ''
  try {
    const q = new URLSearchParams({
      view: context.view,
      search: search.value,
      offset: String(offset.value),
      limit: '5',
    })
    const data = await request<{ items: WorkoutTemplate[]; total: number }>(
      '/v1/institution/workout-templates?' + q,
      { feedback: 'none' },
    )
    if (disposed || current !== generation) return
    items.value = data.items
    total.value = data.total
    if (props.selected) {
      const found = items.value.find((i) => i.id === props.selected)
      if (found) chosen.value = found
      else {
        const selected = await request<{ items: WorkoutTemplate[] }>(
          '/v1/institution/workout-templates?' +
            new URLSearchParams({ view: context.view, id: props.selected }),
          { feedback: 'none' },
        )
        if (disposed || current !== generation) return
        chosen.value = selected.items[0]
      }
    } else chosen.value = undefined
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
watch(
  () => props.selected,
  () => {
    void load()
  },
)
function refresh() {
  if (!props.disabled) void load()
}
onMounted(() => {
  void load()
  window.addEventListener('focus', refresh)
})
function page(value: number) {
  offset.value = value
  void load()
}
</script>
<template>
  <section class="workout-template-picker" :aria-label="l('Workout templates', 'قوالب التمارين')">
    <header class="workout-picker-heading">
      <h2>{{ l('Workout template', 'قالب التمرين') }}</h2>
      <RouterLink class="text-link" to="/workout-templates/new" target="_blank" rel="noopener">
        {{ l('Create a template', 'إنشاء قالب') }}<PhArrowSquareOut :size="16" aria-hidden="true" />
      </RouterLink>
    </header>
    <div class="list-controls">
      <label class="plan-search"
        >{{ l('Find a workout template', 'البحث عن قالب تمرين')
        }}<input
          v-model="search"
          type="search"
          :disabled="disabled"
          :placeholder="l('Search workout names…', 'ابحث بأسماء التمارين…')"
          @keydown.enter.prevent="live.submit()"
      /></label>
      <ListPagination
        class="list-toolbar-pagination"
        v-if="total > 5"
        :offset="offset"
        :page-size="5"
        :total="total"
        :disabled="loading || disabled"
        @page="page"
      />
    </div>
    <p v-if="chosen" class="small-print">
      {{ l('Selected:', 'المحدد:') }} <strong dir="auto">{{ chosen.title }}</strong>
    </p>
    <p
      v-if="chosen && (chosen.archived || (revision !== undefined && chosen.revision !== revision))"
      role="alert"
      class="notice"
    >
      {{
        l(
          'This template changed or was archived. Choose an available version again before continuing.',
          'تغير القالب أو أُرشف. اختر نسخة متاحة من جديد قبل المتابعة.',
        )
      }}
    </p>
    <PageState :loading="loading && !items.length" :error="error" @retry="load"
      ><EmptyState
        v-if="!items.length"
        compact
        :title="l('No matching workout templates', 'لا توجد قوالب تمارين مطابقة')"
        :description="
          l(
            'Try another name or create a reusable workout.',
            'جرّب اسماً آخر أو أنشئ تمريناً قابلاً لإعادة الاستخدام.',
          )
        "
      />
      <div v-else class="template-choices">
        <button
          v-for="item in items"
          :key="item.id"
          type="button"
          class="template-choice"
          :class="{ selected: item.id === selected }"
          :aria-pressed="item.id === selected"
          :disabled="disabled"
          @click="emit('choose', item)"
        >
          <strong dir="auto">{{ item.title }}</strong
          ><small
            >{{ item.workout.minutes }} {{ l('minutes', 'دقيقة') }} ·
            {{ item.workout.exercises.length }} {{ l('exercises', 'تمارين') }}</small
          >
        </button>
      </div>
    </PageState>
  </section>
</template>
<style scoped>
.workout-template-picker {
  display: grid;
  gap: var(--space-4);
}
.workout-picker-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
.workout-picker-heading h2 {
  margin: 0;
  font-size: var(--text-panel);
  line-height: 1.4;
}
.workout-template-picker > .list-controls,
.workout-template-picker > p {
  margin: 0;
}
.workout-template-picker .plan-search input {
  margin: 0;
}
.template-choices {
  display: grid;
  gap: var(--space-2);
}
.template-choice {
  display: grid;
  gap: var(--space-2);
  text-align: start;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  min-width: 0;
}
.template-choice strong {
  font-size: var(--text-body);
  font-weight: 600;
  overflow-wrap: anywhere;
}
.template-choice.selected {
  border-color: var(--accent);
  background: var(--tint);
}
.template-choice small {
  color: var(--muted);
  font-size: var(--text-caption);
  line-height: 1.5;
}
</style>
