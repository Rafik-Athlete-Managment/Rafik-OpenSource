<!-- Food picker: searches the catalog and adds a selected food to a meal. -->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { request } from '../../lib/backend'
import { language as l, locale } from '../../lib/i18n'
import type { CatalogFood } from './model'
const emit = defineEmits<{ select: [food: CatalogFood] }>()
const foods = ref<CatalogFood[]>([]),
  search = ref(''),
  loading = ref(false),
  failed = ref(false)
const visible = computed(() =>
  foods.value
    .filter((f) =>
      `${f.name} ${f.name_ar}`.toLowerCase().includes(search.value.trim().toLowerCase()),
    )
    .slice(0, 8),
)
async function load() {
  loading.value = true
  failed.value = false
  try {
    foods.value = (await request<{ foods: CatalogFood[] }>('/v1/catalog/foods')).foods
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}
onMounted(load)
</script>
<template>
  <section class="food-picker form-stack" :aria-label="l('Food library', 'مكتبة الطعام')">
    <label
      >{{ l('Find a food', 'ابحث عن طعام')
      }}<input
        v-model="search"
        type="search"
        :placeholder="l('Try rice, chicken or oats', 'جرّب الأرز أو الدجاج أو الشوفان')"
        maxlength="120"
    /></label>
    <p class="subtle">
      {{
        l(
          'USDA reference foods · values per 100 g. Preparation and brands can change the numbers; use the package label when available.',
          'أطعمة مرجعية من USDA · القيم لكل ١٠٠ غ. تختلف القيم بحسب التحضير والعلامة التجارية؛ استخدم الملصق عند توفره.',
        )
      }}
    </p>
    <p v-if="loading" role="status">{{ l('Loading foods…', 'جارٍ تحميل الأطعمة…') }}</p>
    <p v-else-if="failed" role="alert">
      {{
        l(
          'Food library unavailable. You can still enter a food manually.',
          'مكتبة الطعام غير متاحة. يمكنك إدخال الطعام يدوياً.',
        )
      }}
      <button type="button" class="text-link" @click="load">
        {{ l('Try again', 'حاول مجدداً') }}
      </button>
    </p>
    <p v-else-if="!visible.length">
      {{
        l(
          'No matching reference food. Try another name or use manual entry.',
          'لا يوجد طعام مرجعي مطابق. جرّب اسماً آخر أو الإدخال اليدوي.',
        )
      }}
    </p>
    <ul v-else class="food-results">
      <li v-for="food in visible" :key="food.id">
        <button type="button" @click="emit('select', food)">
          <strong>{{ locale === 'ar' ? food.name_ar : food.name }}</strong
          ><span
            >{{ food.nutrients.kcal ?? '—' }} kcal · {{ l('Protein', 'بروتين') }}
            {{ food.nutrients.protein_g ?? '—' }} g</span
          >
        </button>
      </li>
    </ul>
    <p v-if="!loading && !failed && !search" class="subtle">
      {{
        l(
          'Search the starter library for more foods. Your saved foods and manual entries remain available.',
          'ابحث في المكتبة عن المزيد من الأطعمة. تبقى أطعمتك المحفوظة والإدخال اليدوي متاحة.',
        )
      }}
    </p>
  </section>
</template>
