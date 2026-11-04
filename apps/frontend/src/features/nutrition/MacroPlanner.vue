<!-- Splits daily nutrition targets across meals and displays the resulting macro totals. -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { language as l } from '../../lib/i18n'
import { allocateMacros, macroEnergy, type Nutrients } from './model'
import NutrientFields from './NutrientFields.vue'
const model = defineModel<Nutrients>({ required: true })
const energy = ref<number | null>(null),
  protein = ref<number | null>(null),
  fat = ref<number | null>(null)
const calculated = computed(() =>
  energy.value === null ||
  protein.value === null ||
  fat.value === null ||
  String(energy.value) === '' ||
  String(protein.value) === '' ||
  String(fat.value) === ''
    ? null
    : allocateMacros(Number(energy.value), Number(protein.value), Number(fat.value)),
)
const equivalent = computed(() => macroEnergy(model.value))
const notice = ref('')
function apply() {
  if (!calculated.value) return
  model.value = { ...calculated.value }
  notice.value = l(
    'Applied to this draft. Save the plan to share these targets.',
    'أُضيفت للمسودة. احفظ الخطة لمشاركة هذه الأهداف.',
  )
}
</script>
<template>
  <section class="form-stack" aria-labelledby="daily-targets-heading">
    <div>
      <h3 id="daily-targets-heading">{{ l('Daily targets', 'الأهداف اليومية') }}</h3>
      <p class="subtle">
        {{
          l(
            'Set the targets you agreed with your athlete. Leave any untracked nutrient blank.',
            'حدد الأهداف المتفق عليها مع رياضيك. اترك أي عنصر لا تتابعه فارغاً.',
          )
        }}
      </p>
    </div>
    <NutrientFields v-model="model" />
    <p v-if="equivalent !== null" class="subtle">
      {{ l('Energy from these macros', 'الطاقة من هذه المغذيات') }}: {{ equivalent }} kcal ·
      {{
        l(
          'Approximate, using 4 / 4 / 9 kcal per gram.',
          'تقريبية باستخدام ٤ / ٤ / ٩ سعرات لكل غرام.',
        )
      }}
    </p>
    <details class="nutrition-calculator">
      <summary>
        {{ l('Calculate grams from a calorie budget', 'احسب الغرامات من السعرات المحددة') }}
      </summary>
      <div class="form-stack">
        <p class="subtle">
          {{
            l(
              'A calculation tool, not an estimate of calorie needs. Enter your chosen energy budget and split.',
              'أداة حساب وليست تقديراً للاحتياج من السعرات. أدخل السعرات والنسب التي اخترتها.',
            )
          }}
        </p>
        <label
          >{{ l('Calorie budget (kcal)', 'السعرات المحددة')
          }}<input v-model.number="energy" type="text" inputmode="decimal"
        /></label>
        <div class="field-pair">
          <label
            >{{ l('Protein (%)', 'البروتين (%)')
            }}<input v-model.number="protein" type="text" inputmode="decimal"
          /></label>
          <label
            >{{ l('Fat (%)', 'الدهون (%)')
            }}<input v-model.number="fat" type="text" inputmode="decimal"
          /></label>
        </div>
        <p v-if="calculated">
          {{ l('Carbohydrate', 'الكربوهيدرات') }}: {{ 100 - Number(protein) - Number(fat) }}% ·
          {{ calculated.carb_g }} g
        </p>
        <p v-else class="subtle">
          {{
            l(
              'Enter a calorie budget and percentages that total 100% or less.',
              'أدخل السعرات ونسباً لا يتجاوز مجموعها ١٠٠٪.',
            )
          }}
        </p>
        <button type="button" class="button secondary small" :disabled="!calculated" @click="apply">
          {{ l('Apply to targets', 'تطبيق على الأهداف') }}
        </button>
        <p v-if="notice" role="status" class="subtle">{{ notice }}</p>
      </div>
    </details>
  </section>
</template>
