<script setup lang="ts">
import { computed, ref } from 'vue'
import { language as l, locale } from '../../lib/i18n'
import FoodPicker from './FoodPicker.vue'
import NutrientFields from './NutrientFields.vue'
import { nutrientTotals, nutrientKeys, type PlannedFood, type CatalogFood } from './model'
const model = defineModel<PlannedFood[]>({ required: true })
const meal = ref('breakfast'),
  food = ref<CatalogFood>(),
  amount = ref(100),
  manual = ref(false)
const custom = ref<PlannedFood>({
  name: '',
  meal: 'breakfast',
  quantity: 1,
  basis: 1,
  unit: 'serving',
  nutrients: {},
  source: '',
})
const validCustom = computed(
  () =>
    custom.value.name.trim() &&
    custom.value.source.trim() &&
    [custom.value.quantity, custom.value.basis].every(
      (n) => Number.isFinite(Number(n)) && Number(n) > 0 && Number(n) <= 10000,
    ) &&
    Object.values(custom.value.nutrients).every(
      (n) => n == null || (Number.isFinite(n) && n >= 0 && n <= 10000),
    ),
)
const totals = computed(() => nutrientTotals(model.value))
const mealLabel = (v: string) =>
  ({
    breakfast: l('Breakfast', 'الفطور'),
    lunch: l('Lunch', 'الغداء'),
    dinner: l('Dinner', 'العشاء'),
    snack: l('Snack', 'وجبة خفيفة'),
  })[v]
function resetManualUnit() {
  custom.value.nutrients = {}
  custom.value.basis = custom.value.unit === 'serving' ? 1 : 100
  custom.value.quantity = custom.value.basis
  custom.value.source = ''
}
function choose(value: CatalogFood) {
  food.value = value
  amount.value = 100
}
function add() {
  if (model.value.length >= 20) return
  if (manual.value) {
    if (!validCustom.value) return
    model.value = [
      ...model.value,
      { ...JSON.parse(JSON.stringify(custom.value)), meal: meal.value },
    ]
    custom.value = {
      name: '',
      meal: 'breakfast',
      quantity: 1,
      basis: 1,
      unit: 'serving',
      nutrients: {},
      source: '',
    }
  } else if (food.value && amount.value > 0 && amount.value <= 10000) {
    model.value = [
      ...model.value,
      {
        name: locale.value === 'ar' ? food.value.name_ar : food.value.name,
        meal: meal.value,
        quantity: Number(amount.value),
        basis: 100,
        unit: 'g',
        nutrients: { ...food.value.nutrients },
        source: food.value.source,
      },
    ]
    food.value = undefined
  }
}
</script>
<template>
  <section class="form-stack meal-plan-editor">
    <div>
      <h3>{{ l('Example day', 'مثال ليوم غذائي') }}</h3>
      <p class="subtle">
        {{
          l(
            'Turn targets into food choices. These suggestions are separate from meals your athlete actually records.',
            'حوّل الأهداف إلى اختيارات طعام. هذه المقترحات منفصلة عن الوجبات التي يسجلها رياضيك فعلياً.',
          )
        }}
      </p>
    </div>
    <article v-for="(item, i) in model" :key="i" class="planned-food-row">
      <div>
        <small>{{ mealLabel(item.meal) }}</small
        ><strong>{{ item.name }}</strong
        ><span
          >{{ item.quantity }} {{ item.unit }} ·
          {{ nutrientTotals([item]).kcal.value ?? '—' }} kcal</span
        >
      </div>
      <label class="planned-portion"
        >{{ l('Amount', 'الكمية') }} ({{ item.unit }})
        <input
          v-model.number="item.quantity"
          type="number"
          min="0.01"
          max="10000"
          step="0.01"
          required
          :aria-label="l('Amount for ', 'كمية ') + item.name"
        />
      </label>
      <button
        type="button"
        class="text-link danger-action"
        :aria-label="l('Remove ', 'حذف ') + item.name"
        @click="model = model.filter((_, index) => index !== i)"
      >
        {{ l('Remove', 'حذف') }}
      </button>
    </article>
    <p v-if="model.length" class="meal-numbers">
      <span v-for="k in nutrientKeys" :key="k"
        >{{
          {
            kcal: l('Energy', 'الطاقة'),
            protein_g: l('Protein', 'البروتين'),
            carb_g: l('Carbohydrate', 'الكربوهيدرات'),
            fat_g: l('Fat', 'الدهون'),
          }[k]
        }}: {{ totals[k].value ?? '—' }} {{ k === 'kcal' ? 'kcal' : 'g'
        }}<span v-if="totals[k].missing"> · {{ l('partial', 'جزئي') }}</span></span
      >
    </p>
    <details v-if="model.length < 20" class="nutrition-calculator">
      <summary>{{ l('Add food to example day', 'إضافة طعام لليوم المقترح') }}</summary>
      <div class="form-stack">
        <label
          >{{ l('Suggested meal', 'الوجبة المقترحة')
          }}<select v-model="meal">
            <option v-for="m in ['breakfast', 'lunch', 'dinner', 'snack']" :key="m" :value="m">
              {{ mealLabel(m) }}
            </option>
          </select></label
        >
        <label class="check-label"
          ><input type="checkbox" v-model="manual" />{{
            l('Use a food label or custom meal', 'استخدم ملصق طعام أو وجبة مخصصة')
          }}</label
        >
        <template v-if="manual">
          <label
            >{{ l('Suggested food name', 'اسم الطعام المقترح')
            }}<input v-model="custom.name" maxlength="120"
          /></label>
          <div class="field-pair">
            <label
              >{{ l('Suggested amount', 'الكمية المقترحة')
              }}<input v-model.number="custom.quantity" type="text" inputmode="decimal" /></label
            ><label
              >{{ l('Unit', 'الوحدة')
              }}<select v-model="custom.unit" @change="resetManualUnit">
                <option value="serving">{{ l('Serving', 'حصة') }}</option>
                <option value="g">g</option>
                <option value="ml">ml</option>
              </select></label
            >
          </div>
          <label
            >{{ l('Nutrients per amount', 'المغذيات لكل كمية')
            }}<input v-model.number="custom.basis" type="text" inputmode="decimal"
          /></label>
          <NutrientFields v-model="custom.nutrients" draft-only />
          <label
            >{{ l('Food label or value source', 'ملصق الطعام أو مصدر القيم')
            }}<input v-model="custom.source" maxlength="200"
          /></label>
        </template>
        <template v-else
          ><FoodPicker @select="choose" />
          <div v-if="food" class="form-stack">
            <strong>{{ locale === 'ar' ? food.name_ar : food.name }}</strong>
            <div class="actions">
              <button
                v-for="portion in food.portions"
                :key="portion.name"
                type="button"
                class="button small secondary"
                @click="amount = portion.grams"
              >
                {{ locale === 'ar' ? portion.name_ar || portion.name : portion.name }} ·
                {{ portion.grams }} g
              </button>
            </div>
            <label
              >{{ l('Suggested amount (g)', 'الكمية المقترحة (غ)')
              }}<input v-model.number="amount" type="text" inputmode="decimal"
            /></label></div
        ></template>
        <button
          type="button"
          class="button secondary small"
          :disabled="
            manual
              ? !validCustom
              : !food ||
                !Number.isFinite(Number(amount)) ||
                Number(amount) <= 0 ||
                Number(amount) > 10000
          "
          @click="add"
        >
          {{ l('Add to example day', 'إضافة لليوم المقترح') }}
        </button>
      </div>
    </details>
  </section>
</template>
