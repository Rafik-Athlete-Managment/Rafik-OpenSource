<!-- Password field: reveals or hides the entered password and exposes its validation hint. -->
<script setup lang="ts">
import { computed, ref, useAttrs } from 'vue'
import { PhEye, PhEyeSlash } from '@phosphor-icons/vue'
import { language as l } from '../lib/i18n'
defineOptions({ inheritAttrs: false })
const props = defineProps<{ id: string }>()
const model = defineModel<string>({ default: '' })
const visible = ref(false),
  attrs = useAttrs()
const disabled = computed(() => attrs.disabled !== undefined && attrs.disabled !== false)
const action = computed(
  () =>
    (visible.value
      ? l('Hide password', 'إخفاء كلمة المرور')
      : l('Show password', 'إظهار كلمة المرور')) +
    (props.id.includes('confirm') ? l(' confirmation', ' المؤكدة') : ''),
)
</script>
<template>
  <div class="password-field">
    <input v-bind="$attrs" :id="id" v-model="model" :type="visible ? 'text' : 'password'" />
    <button
      type="button"
      class="password-reveal"
      :aria-label="action"
      :aria-controls="id"
      :aria-pressed="visible"
      :disabled="disabled"
      @click="visible = !visible"
    >
      <component :is="visible ? PhEyeSlash : PhEye" :size="20" aria-hidden="true" />
    </button>
  </div>
</template>
<style scoped>
.password-field {
  position: relative;
  min-width: 0;
}
.password-field input {
  width: 100%;
  padding-inline-end: 52px;
}
.password-reveal {
  position: absolute;
  inset-inline-end: 4px;
  inset-block-start: 2px;
  width: 44px;
  height: 44px;
  border: 0;
  background: transparent;
  border-radius: 8px;
  display: grid;
  place-items: center;
  color: var(--muted);
}
.password-reveal:hover {
  color: var(--ink);
  background: var(--surface-soft);
}
.password-reveal:focus-visible {
  outline-offset: -3px;
}
</style>
