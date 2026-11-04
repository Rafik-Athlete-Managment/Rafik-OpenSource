<!-- Edits the sets, targets, rest and effort values for one prescribed exercise. -->
<script setup lang="ts">
import { watch } from 'vue'
import type { PrescriptionExercise, Target } from '../../lib/domain'
import { language, t } from '../../lib/i18n'
const ex = defineModel<PrescriptionExercise>({ required: true })
function target(): Target {
  return {
    reps: ex.value.reps,
    load: ex.value.load,
    seconds: ex.value.seconds || 30,
    metres: ex.value.metres || 100,
    effort: ex.value.effort || null,
  }
}
function individual(event: Event) {
  if ((event.target as HTMLInputElement).checked)
    ex.value.targets = Array.from({ length: ex.value.sets }, target)
  else delete ex.value.targets
}
watch(
  () => ex.value.sets,
  (count) => {
    if (ex.value.targets && count >= 1 && count <= 10) {
      while (ex.value.targets.length < count) ex.value.targets.push(target())
      ex.value.targets.splice(count)
    }
  },
)
watch(
  () => ex.value.kind,
  () => {
    ex.value.seconds ||= 30
    ex.value.metres ||= 100
  },
)
</script>
<template>
  <div class="exercise-fields">
    <label
      >{{ t('sets') }}<input v-model.number="ex.sets" type="number" required min="1" max="10"
    /></label>
    <label
      >{{ language('Type', 'النوع')
      }}<select v-model="ex.kind">
        <option value="strength">{{ language('Strength', 'قوة') }}</option>
        <option value="timed">{{ language('Time', 'زمن') }}</option>
        <option value="distance">{{ language('Distance', 'مسافة') }}</option>
      </select></label
    >
    <label v-if="!ex.kind || ex.kind === 'strength'"
      >{{ t('reps') }}<input v-model.number="ex.reps" type="number" required min="1" max="100"
    /></label>
    <label v-if="ex.kind === 'timed'"
      >{{ language('Seconds', 'ثوانٍ')
      }}<input v-model.number="ex.seconds" type="number" required min="1" max="86400"
    /></label>
    <label v-if="ex.kind === 'distance'"
      >{{ language('Metres', 'أمتار')
      }}<input v-model.number="ex.metres" type="number" required min="1" max="1000000" step="0.01"
    /></label>
    <label v-if="!ex.kind || ex.kind === 'strength'"
      >{{ t('load')
      }}<input v-model.number="ex.load" type="number" required min="0" max="1000" step="0.01"
    /></label>
    <label v-if="!ex.kind || ex.kind === 'strength'"
      >{{ t('units')
      }}<select v-model="ex.unit">
        <option value="kg">{{ t('kg') }}</option>
        <option value="lb">{{ t('lb') }}</option>
      </select></label
    >
    <label
      >{{ language('Rest (seconds)', 'الراحة (ثانية)')
      }}<input v-model.number="ex.rest" type="number" required min="0" max="600"
    /></label>
  </div>
  <section class="advanced-prescription">
    <p class="prescription-label">
      {{ language('Set targets, effort & grouping', 'أهداف المجموعات والجهد والتجميع') }}
    </p>
    <div>
      <div class="field-pair">
        <label
          >{{ language('Superset / circuit label', 'اسم المجموعة المركبة / الدائرة')
          }}<input
            v-model="ex.group"
            maxlength="40"
            :placeholder="language('e.g. Circuit A', 'مثال: الدائرة أ')" /></label
        ><label
          >{{ language('Target effort (RPE, optional)', 'الجهد المستهدف (RPE، اختياري)')
          }}<input
            :value="ex.effort"
            @input="
              ex.effort = ($event.target as HTMLInputElement).value
                ? Number(($event.target as HTMLInputElement).value)
                : null
            "
            type="number"
            min="1"
            max="10"
            step="0.5"
        /></label>
      </div>
      <p class="small-print">
        {{
          language(
            'Give consecutive exercises the same label to show they belong together. RPE is perceived effort from 1 to 10.',
            'امنح التمارين المتتالية الاسم نفسه لعرضها كمجموعة. RPE هو الجهد المحسوس من ١ إلى ١٠.',
          )
        }}
      </p>
      <label class="check-label"
        ><input type="checkbox" :checked="!!ex.targets" @change="individual" />{{
          language('Different targets for each set', 'أهداف مختلفة لكل مجموعة')
        }}</label
      >
      <fieldset
        :disabled="!ex.targets"
        v-for="(s, i) in ex.targets || Array.from({ length: ex.sets }, target)"
        :key="i"
        class="per-set-target"
      >
        <strong>{{ i + 1 }}</strong
        ><label v-if="!ex.kind || ex.kind === 'strength'"
          >{{ t('reps')
          }}<input v-model.number="s.reps" type="number" min="1" max="100" required /></label
        ><label v-else-if="ex.kind === 'timed'"
          >{{ language('Seconds', 'ثوانٍ')
          }}<input v-model.number="s.seconds" type="number" min="1" max="86400" required /></label
        ><label v-else
          >{{ language('Metres', 'أمتار')
          }}<input
            v-model.number="s.metres"
            type="number"
            min="1"
            max="1000000"
            required
            step="0.01" /></label
        ><label
          >{{ t('load')
          }}<input
            v-model.number="s.load"
            type="number"
            min="0"
            max="1000"
            required
            step="0.01" /></label
        ><label
          >RPE<input
            :value="s.effort"
            @input="
              s.effort = ($event.target as HTMLInputElement).value
                ? Number(($event.target as HTMLInputElement).value)
                : null
            "
            type="number"
            min="1"
            max="10"
            step="0.5"
        /></label>
      </fieldset>
    </div>
  </section>
</template>

<style scoped>
.prescription-label {
  font-weight: 700;
}
.per-set-target {
  border: 0;
  padding: 0;
  min-width: 0;
}
</style>
