<script setup lang="ts">
import { computed, useId } from 'vue'
import {
  ComboboxRoot,
  ComboboxAnchor,
  ComboboxInput,
  ComboboxTrigger,
  ComboboxPortal,
  ComboboxContent,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxEmpty,
} from 'reka-ui'
import { PhCaretDown, PhCheck } from '@phosphor-icons/vue'
import { timezoneOptions, timezoneLabel, timezoneSearchText } from '../lib/timezones'
import { language as l, locale } from '../lib/i18n'
const props = defineProps<{ modelValue: string; label: string; disabled?: boolean; id?: string }>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()
const generated = useId(),
  inputId = computed(() => props.id || generated)
const options = computed(() =>
  timezoneOptions(props.modelValue).map((value) => ({ value, label: timezoneLabel(value) })),
)
</script>
<template>
  <div class="timezone-picker">
    <label :for="inputId">{{ label }}</label>
    <ComboboxRoot
      :model-value="modelValue"
      :disabled="disabled"
      :dir="locale === 'ar' ? 'rtl' : 'ltr'"
      open-on-click
      @update:model-value="(value) => value && emit('update:modelValue', String(value))"
    >
      <ComboboxAnchor class="timezone-anchor">
        <ComboboxInput
          :id="inputId"
          :aria-label="label"
          :display-value="(value) => (value ? timezoneLabel(String(value)) : '')"
          :placeholder="l('Search city or timezone', 'ابحث عن مدينة أو منطقة زمنية')"
          autocomplete="off"
        />
        <ComboboxTrigger type="button" :aria-label="l('Choose timezone', 'اختيار المنطقة الزمنية')"
          ><PhCaretDown :size="16"
        /></ComboboxTrigger>
      </ComboboxAnchor>
      <ComboboxPortal
        ><section role="region" :aria-label="label + ' · ' + l('Options', 'الخيارات')">
          <ComboboxContent
            :aria-label="label"
            :dir="locale === 'ar' ? 'rtl' : 'ltr'"
            class="timezone-options"
            position="popper"
            :side-offset="6"
            :collision-padding="12"
          >
            <p class="timezone-hint">
              {{
                l(
                  'Search a city or region. Offsets shown are current.',
                  'ابحث عن مدينة أو منطقة. الفروق المعروضة حالية.',
                )
              }}
            </p>
            <div class="timezone-viewport" role="group" :aria-label="label" tabindex="0">
              <ComboboxEmpty class="timezone-empty">{{
                l(
                  'No timezone found. Try a city such as London.',
                  'لم نجد منطقة زمنية. جرّب اسم مدينة مثل London.',
                )
              }}</ComboboxEmpty>
              <ComboboxItem
                v-for="option in options"
                :key="option.value"
                :value="option.value"
                :text-value="timezoneSearchText(option.value)"
                class="timezone-option"
              >
                <span dir="ltr">{{ option.label }}</span
                ><ComboboxItemIndicator><PhCheck :size="16" /></ComboboxItemIndicator>
              </ComboboxItem>
            </div>
          </ComboboxContent></section
      ></ComboboxPortal>
    </ComboboxRoot>
  </div>
</template>
<style>
.timezone-picker {
  min-width: 0;
}
.timezone-picker > label {
  display: block;
  margin-bottom: 6px;
}
.timezone-anchor {
  display: flex;
  align-items: center;
  border: 1px solid var(--control-border);
  background: var(--field);
  box-shadow: var(--shadow-xs);
  border-radius: 8px;
  min-width: 0;
}
.timezone-anchor:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--ring);
}
.timezone-anchor input {
  box-shadow: none;
  border: 0;
  background: transparent;
  margin: 0;
  min-width: 0;
  width: 100%;
  text-overflow: ellipsis;
}
.timezone-anchor input:focus,
.timezone-anchor input:focus-visible {
  box-shadow: none;
  outline: none;
}
.timezone-anchor button {
  border: 0;
  background: transparent;
  color: var(--muted);
  min-width: 40px;
  min-height: 44px;
  display: grid;
  place-items: center;
}
.timezone-options {
  /* Portaled options must sit above modal backdrops (100) and panels (101). */
  z-index: 120;
  width: var(--reka-combobox-trigger-width);
  min-width: min(320px, calc(100vw - 24px));
  max-width: calc(100vw - 24px);
  max-height: min(360px, var(--reka-combobox-content-available-height));
  overflow: hidden;
  background: var(--surface);
  color: var(--ink);
  border: 1px solid var(--line);
  border-radius: 10px;
  box-shadow: var(--shadow);
}
.timezone-hint {
  padding: 12px;
  margin: 0;
  font-size: 0.75rem;
  color: var(--muted);
  border-bottom: 1px solid var(--line);
}
.timezone-viewport {
  max-height: min(290px, calc(var(--reka-combobox-content-available-height) - 70px));
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 4px;
}
.timezone-option {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 10px;
  min-height: 40px;
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
}
.timezone-option span {
  overflow-wrap: anywhere;
}
.timezone-option[data-highlighted] {
  background: var(--tint);
  outline: 1px solid var(--accent);
  outline-offset: -1px;
}
.timezone-option[data-state='checked'] {
  font-weight: 700;
  color: var(--accent);
}
.timezone-empty {
  padding: 16px 10px;
  font-size: 0.85rem;
}
</style>
