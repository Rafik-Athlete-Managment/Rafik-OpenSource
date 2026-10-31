<script setup lang="ts">
import { ref } from 'vue'
import { language as l, locale } from '../../lib/i18n'
import type { PlannedFood, CatalogFood } from './model'
import FoodPicker from './FoodPicker.vue'
import NutrientFields from './NutrientFields.vue'
const model = defineModel<PlannedFood>({ required: true })
const library = ref(!model.value.name)
function select(food: CatalogFood) {
  model.value = {
    ...model.value,
    name: locale.value === 'ar' ? food.name_ar : food.name,
    quantity: 100,
    basis: 100,
    unit: 'g',
    nutrients: { ...food.nutrients },
    source: food.source,
  }
  library.value = false
}
function unitChanged() {
  model.value.basis = model.value.unit === 'serving' ? 1 : 100
  model.value.quantity = model.value.basis
  model.value.nutrients = {}
  model.value.source = l('Manual entry', 'إدخال يدوي')
}
</script>
<template>
  <div class="form-stack">
    <button type="button" class="text-link" :aria-expanded="library" @click="library = !library">
      {{
        library
          ? l('Use manual entry', 'إدخال يدوي')
          : l('Choose from food library', 'اختيار من مكتبة الطعام')
      }}
    </button>
    <FoodPicker v-if="library" @select="select" />
    <label
      >{{ l('Food name', 'اسم الطعام') }}<input v-model="model.name" maxlength="120" required
    /></label>
    <div class="org-nutrition-fields">
      <label
        >{{ l('Meal', 'الوجبة')
        }}<select v-model="model.meal">
          <option value="breakfast">{{ l('Breakfast', 'الفطور') }}</option>
          <option value="lunch">{{ l('Lunch', 'الغداء') }}</option>
          <option value="dinner">{{ l('Dinner', 'العشاء') }}</option>
          <option value="snack">{{ l('Snack', 'وجبة خفيفة') }}</option>
        </select></label
      >
      <label
        >{{ l('Amount eaten', 'الكمية المتناولة')
        }}<input
          v-model.number="model.quantity"
          type="number"
          min="0.01"
          max="10000"
          step="any"
          required
      /></label>
      <label
        >{{ l('Unit', 'الوحدة')
        }}<select v-model="model.unit" @change="unitChanged">
          <option value="g">{{ l('Grams', 'غرام') }}</option>
          <option value="ml">{{ l('Millilitres', 'مليلتر') }}</option>
          <option value="serving">{{ l('Servings', 'حصص') }}</option>
        </select></label
      >
    </div>
    <details>
      <summary>{{ l('Nutrition values and source', 'القيم الغذائية والمصدر') }}</summary>
      <div class="form-stack">
        <p class="subtle">
          {{
            l(
              'Values below describe the basis amount, not the amount eaten. Leave unknown values blank.',
              'القيم أدناه لكمية الأساس وليست للكمية المتناولة. اترك القيم غير المعروفة فارغة.',
            )
          }}
        </p>
        <label
          >{{ l('Basis amount', 'كمية الأساس')
          }}<input
            v-model.number="model.basis"
            type="number"
            min="0.01"
            max="10000"
            step="any"
            required
        /></label>
        <NutrientFields v-model="model.nutrients" />
        <label
          >{{ l('Source', 'المصدر') }}<input v-model="model.source" maxlength="200" required
        /></label>
      </div>
    </details>
  </div>
</template>
