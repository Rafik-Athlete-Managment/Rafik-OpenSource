<script setup lang="ts">
import { institutionContext } from '../../app/institution'

import { PhTray } from '@phosphor-icons/vue'
import AthleteSearch from '../../components/AthleteSearch.vue'
import { useListPageSize } from '../../lib/list-page-size'
import PageHeading from '../../components/PageHeading.vue'
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { request } from '../../lib/backend'
import { language as l, errorMessage, locale } from '../../lib/i18n'
import { formatDate } from '../../lib/dates'
import MemberPicker from '../institution/MemberPicker.vue'
import ListPagination from '../../components/ListPagination.vue'
import PageState from '../../components/PageState.vue'
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
  router = useRouter(),
  institution = institutionContext().institution,
  view = institutionContext().view,
  base = ''
type Plan = {
  id: string
  member_id: string
  member_name: string
  member_active: boolean
  effective_on: string
  expires_on: string | null
  revision: number
  status: 'active' | 'upcoming' | 'expired' | 'superseded'
}
type Page = { items: Plan[]; total: number; next: number | null }
const data = ref<Page>(),
  loading = ref(false),
  error = ref(''),
  search = ref(String(route.query.search || '')),
  status = ref(String(route.query.status || 'active')),
  offset = ref(0),
  creating = ref(false)
let generation = 0,
  disposed = false
const labels = {
  active: ['Active', 'نشطة'],
  upcoming: ['Upcoming', 'قادمة'],
  expired: ['Expired', 'منتهية المدة'],
  superseded: ['Replaced', 'مستبدلة'],
} as const
const label = (value: Plan['status']) => l(labels[value][0], labels[value][1])
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
  const page = Math.max(0, Number(route.query.offset) || 0)
  const query = new URLSearchParams({
    view,
    status: String(route.query.status || 'active'),
    search: String(route.query.search || ''),
    limit: String(recordLimit.value),
    offset: String(page),
  })
  try {
    const result = await request<Page>(`/v1/institution/nutrition-plans?${query}`)
    if (disposed || current !== generation) return
    data.value = result
    acceptLimit()
    offset.value = page
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
      ...(search.value ? { search: search.value } : {}),
      ...(status.value !== 'active' ? { status: status.value } : {}),
      ...(page ? { offset: page } : {}),
    },
  })
}
watch(
  () => route.fullPath,
  () => {
    search.value = String(route.query.search || '')
    status.value = String(route.query.status || 'active')
    void load()
  },
)
onMounted(() => {
  void load()
  // Contextual "New nutrition plan" links open the athlete choice directly.
  if (route.query.create === '1') {
    creating.value = true
    void router.replace({ query: { ...route.query, create: undefined } })
  }
})
onUnmounted(() => {
  disposed = true
  generation++
})
function create(ids: string[]) {
  if (ids[0]) return router.push({ path: base + '/nutrition', query: { member: ids[0] } })
}
</script>
<template>
  <div class="container page nutrition-plans-page">
    <PageHeading class="work-heading">
      <div>
        <p class="overline">
          {{ l('Published nutrition guidance', 'الإرشادات الغذائية المنشورة') }}
        </p>
        <h1>{{ l('Nutrition plans', 'خطط التغذية') }}</h1>
        <p>
          {{
            l(
              'Current plans across your athletes. Meal diaries remain subject to each athlete’s sharing choice.',
              'الخطط الحالية لرياضييك. تبقى سجلات الطعام خاضعة لاختيار كل رياضي للمشاركة.',
            )
          }}
        </p>
      </div>
      <button class="button" aria-haspopup="dialog" @click="creating = true">
        {{ l('Create a plan', 'إنشاء خطة') }}
      </button>
    </PageHeading>
    <!-- Choosing the athlete is a short, focused step: a dialog, not a card pushed onto the list. -->
    <DialogRoot v-model:open="creating">
      <DialogPortal>
        <DialogOverlay class="ui-dialog-overlay" />
        <DialogContent class="ui-dialog" :dir="locale === 'ar' ? 'rtl' : 'ltr'">
          <DialogTitle>{{ l('Create a nutrition plan', 'إنشاء خطة تغذية') }}</DialogTitle>
          <DialogDescription>
            {{
              l(
                'Choose the athlete. You will set targets and example meals on the next page.',
                'اختر الرياضي. ستحدد الأهداف وأمثلة الوجبات في الصفحة التالية.',
              )
            }}
          </DialogDescription>
          <MemberPicker
            :institution="institution"
            :view="view"
            role="trainee"
            single
            :model-value="[]"
            :label="l('Who is this new plan for?', 'لمن هذه الخطة الجديدة؟')"
            @update:model-value="create"
          />
          <div class="ui-dialog-actions">
            <DialogClose as-child
              ><button type="button" class="button secondary danger-action">
                {{ l('Cancel', 'إلغاء') }}
              </button></DialogClose
            >
          </div>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
    <div class="list-toolbar">
      <form class="nutrition-plan-filters" @submit.prevent="navigate()">
        <AthleteSearch v-model="search" /><label
          >{{ l('Plan status', 'حالة الخطة')
          }}<select v-model="status" @change="navigate()">
            <option
              v-for="key in ['active', 'upcoming', 'expired', 'superseded'] as const"
              :key="key"
              :value="key"
            >
              {{ label(key) }}
            </option>
            <option value="all">{{ l('All plans', 'جميع الخطط') }}</option>
          </select></label
        ><button class="button secondary" :disabled="loading">{{ l('Search', 'بحث') }}</button>
      </form>
      <div class="list-toolbar-pagination">
        <ListPagination
          :label="l('Nutrition plan pages', 'صفحات خطط التغذية')"
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
      {{ l('Updating plans…', 'جارٍ تحديث الخطط…') }}
    </p>
    <p v-if="error && data" role="alert" class="notice error">
      {{ error }}
      <button class="text-link" @click="load">{{ l('Retry', 'إعادة المحاولة') }}</button>
    </p>
    <PageState :loading="loading && !data" :error="!data ? error : ''" @retry="load"
      ><template v-if="data">
        <p class="list-summary">{{ data.total }} {{ l('matching plans', 'خطط مطابقة') }}</p>
        <section v-if="!data.items.length" class="empty-state panel">
          <PhTray :size="28" aria-hidden="true" />
          <h2>{{ l('No plans match this view.', 'لا توجد خطط مطابقة لهذا العرض.') }}</h2>
          <p>
            {{
              l(
                'Try another status or search, or create a plan for an athlete.',
                'جرّب حالة أو بحثاً آخر، أو أنشئ خطة لرياضي.',
              )
            }}
          </p>
          <button class="button secondary" @click="creating = true">
            {{ l('Create a plan', 'إنشاء خطة') }}
          </button>
        </section>
        <div v-else class="nutrition-plan-grid">
          <article v-for="plan in data.items" :key="plan.id" class="nutrition-plan-card">
            <div class="heading-actions">
              <h2 dir="auto">{{ plan.member_name }}</h2>
              <span class="tag" :data-status="plan.status">{{ label(plan.status) }}</span>
            </div>
            <p class="small-print">
              {{ l('Nutrition plan · version', 'خطة تغذية · النسخة') }} {{ plan.revision }}
            </p>
            <dl>
              <div>
                <dt>{{ l('Effective', 'تسري من') }}</dt>
                <dd>{{ formatDate(plan.effective_on, locale) }}</dd>
              </div>
              <div>
                <dt>{{ l('Expires', 'تنتهي في') }}</dt>
                <dd>
                  {{
                    plan.expires_on
                      ? formatDate(plan.expires_on, locale)
                      : l('No end date', 'دون تاريخ انتهاء')
                  }}
                </dd>
              </div>
            </dl>
            <p v-if="!plan.member_active" class="small-print">
              {{ l('Inactive institution membership', 'عضوية المؤسسة غير نشطة') }}
            </p>
            <RouterLink
              class="button secondary"
              :to="base + '/nutrition?member=' + plan.member_id + '&plan=' + plan.id"
              >{{ l('View nutrition plan', 'عرض خطة التغذية') }}</RouterLink
            >
          </article>
        </div>
      </template></PageState
    >
  </div>
</template>
<style scoped>
.nutrition-plan-filters {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) auto;
  gap: 16px;
  align-items: end;
}
.nutrition-plan-filters label {
  min-width: 0;
  margin: 0;
}
.nutrition-athlete-filter {
  margin-block: 18px;
}
.nutrition-plan-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 310px), 1fr));
  gap: 18px;
}
.nutrition-plan-card {
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: var(--space-6);
  border: 1px solid var(--line);
  border-radius: var(--radius-panel);
  background: var(--surface);
}
.nutrition-plan-card h2 {
  font-size: var(--text-panel);
  margin: 0;
  overflow-wrap: anywhere;
}
.nutrition-plan-card dl {
  display: flex;
  flex-wrap: wrap;
  gap: 16px 32px;
  margin-block: 20px;
}
.nutrition-plan-card dt {
  font-size: 0.8rem;
  color: var(--muted);
}
.nutrition-plan-card dd {
  margin: 4px 0 0;
}
.nutrition-plan-card .button {
  margin-top: auto;
  align-self: start;
}

@media (max-width: 650px) {
  .nutrition-plan-filters {
    grid-template-columns: minmax(0, 1fr);
  }
  .nutrition-plan-card {
    padding: 20px;
  }
}
</style>
