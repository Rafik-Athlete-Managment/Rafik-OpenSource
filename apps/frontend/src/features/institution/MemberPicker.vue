<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, computed, useId } from 'vue'
import { request } from '../../lib/backend'
import { language as l, errorMessage } from '../../lib/i18n'
import { PhCheck, PhMagnifyingGlass, PhPlus } from '@phosphor-icons/vue'
import type { Member, Role } from './types'
const props = withDefaults(
  defineProps<{
    institution: string
    view: string
    modelValue: string[]
    role?: string
    sport?: string
    includeSelf?: boolean
    label?: string
    single?: boolean
    max?: number
    disabled?: boolean
    requiredIds?: string[]
    excludeIds?: string[]
    inlineSelection?: boolean
  }>(),
  {
    role: '',
    sport: '',
    includeSelf: false,
    single: false,
    disabled: false,
    max: 100,
    requiredIds: () => [],
    excludeIds: () => [],
  },
)
/** Large institutions: show only the closest matches; selected people always resolve. */
const MATCHES = 5
const uid = useId()
const emit = defineEmits<{ 'update:modelValue': [string[]]; options: [Member[]] }>()
const search = ref(''),
  items = ref<Member[]>([]),
  chosen = ref<Member[]>([]),
  loading = ref(false),
  error = ref('')
let generation = 0,
  searchTimer: ReturnType<typeof setTimeout> | undefined
const emailSearch = computed(() => props.view === 'admin')
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
async function load() {
  const current = ++generation
  loading.value = true
  error.value = ''
  try {
    const q = new URLSearchParams({
      view: props.view,
      role: props.role,
      sport: props.sport,
      search: search.value,
      self: String(props.includeSelf),
      limit: String(MATCHES),
      selected: props.modelValue.join(','),
      ...(emailSearch.value ? { email: 'true' } : {}),
    })
    const data = await request<{
      items: Member[]
      selected: Member[]
      next: number | null
      total: number
    }>(`/v1/institution/people?${q}`)
    if (current !== generation) return
    items.value = data.items.slice(0, MATCHES)
    chosen.value = data.selected
    emit(
      'options',
      Array.from(new Map([...chosen.value, ...items.value].map((m) => [m.id, m])).values()),
    )
  } catch (e) {
    if (current === generation) error.value = errorMessage(e)
  } finally {
    if (current === generation) loading.value = false
  }
}
const missing = computed(() =>
  props.modelValue.filter(
    (id) =>
      !chosen.value.some(
        (m) => m.id === id && m.active && (!props.role || m.roles.includes(props.role as Role)),
      ),
  ),
)
const visibleMembers = computed(() =>
  props.inlineSelection
    ? [
        ...items.value,
        ...chosen.value.filter((person) => !items.value.some((item) => item.id === person.id)),
      ]
    : items.value,
)
function toggle(id: string) {
  if (props.requiredIds.includes(id)) return
  emit(
    'update:modelValue',
    props.modelValue.includes(id)
      ? props.modelValue.filter((x) => x !== id)
      : props.single
        ? [id]
        : [...props.modelValue, id],
  )
}
watch(
  () => props.modelValue.join(','),
  () => {
    const known = new Map([...chosen.value, ...items.value].map((m) => [m.id, m]))
    if (!loading.value && props.modelValue.every((id) => known.has(id))) {
      // A choice from a loaded page must not reset the list or move the person's place.
      chosen.value = props.modelValue.map((id) => known.get(id)!)
      emit('options', Array.from(known.values()))
    } else void load()
  },
)
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => void load(), 180)
})
watch(
  () => [props.role, props.sport],
  () => load(),
)
onMounted(() => load())
onUnmounted(() => {
  generation++
  clearTimeout(searchTimer)
})
</script>
<template>
  <section class="member-picker">
    <label class="member-search"
      ><span>{{ label || l('Find people', 'البحث عن أشخاص') }}</span
      ><span class="member-search-field"
        ><PhMagnifyingGlass :size="18" aria-hidden="true" /><input
          :placeholder="
            emailSearch
              ? l('Search by name or email…', 'ابحث بالاسم أو البريد الإلكتروني…')
              : l('Search by name…', 'ابحث بالاسم…')
          "
          v-model="search"
          type="search"
          :disabled="disabled"
          @keydown.enter.prevent="load()" /></span
    ></label>
    <p class="small-print">
      {{
        l(
          `Shows the ${MATCHES} closest matches · ${modelValue.length} selected`,
          `تظهر أقرب ${MATCHES} نتائج · ${modelValue.length} محدد`,
        )
      }}
    </p>
    <p v-if="error" class="notice error" role="alert">
      {{ error }}
      <button type="button" class="text-link" @click="load()">
        {{ l('Try again', 'حاول مجدداً') }}
      </button>
    </p>
    <div v-if="modelValue.length && !inlineSelection" class="chosen-members">
      <span v-for="id in modelValue" :key="id"
        ><bdi>{{
          chosen.find((m) => m.id === id)?.name || l('Unavailable person', 'شخص غير متاح')
        }}</bdi
        ><button
          type="button"
          :disabled="disabled || requiredIds.includes(id)"
          class="text-link danger-action"
          @click="toggle(id)"
          :aria-label="l('Remove', 'إزالة') + ' ' + (chosen.find((m) => m.id === id)?.name || id)"
        >
          ×
        </button></span
      >
    </div>
    <p v-if="missing.length && !loading" class="small-print">
      {{
        l('Remove unavailable people before continuing.', 'أزل الأشخاص غير المتاحين قبل المتابعة.')
      }}
    </p>
    <!-- Compact name cards: the whole card toggles a real checkbox; plus/check shows the state. -->
    <ul class="member-options" :aria-busy="loading">
      <li v-for="m in visibleMembers" :key="m.id">
        <label class="member-match" :class="{ 'is-chosen': modelValue.includes(m.id) }"
          ><input
            type="checkbox"
            class="member-match-input"
            :aria-labelledby="`${uid}-${m.id}`"
            :aria-describedby="m.email ? `${uid}-${m.id}-email` : undefined"
            :checked="modelValue.includes(m.id)"
            :disabled="
              disabled ||
              loading ||
              requiredIds.includes(m.id) ||
              excludeIds.includes(m.id) ||
              (!single && !modelValue.includes(m.id) && modelValue.length >= max)
            "
            @change="toggle(m.id)" /><span class="avatar small" aria-hidden="true">{{
            initials(m.name)
          }}</span
          ><span class="member-option-details"
            ><span :id="`${uid}-${m.id}`" class="member-option-name"
              ><bdi>{{ m.name }}</bdi
              ><slot :member="m" /></span
            ><small v-if="m.email" :id="`${uid}-${m.id}-email`"
              ><bdi dir="ltr">{{ m.email }}</bdi></small
            ></span
          ><span class="member-match-icon" aria-hidden="true"
            ><PhCheck v-if="modelValue.includes(m.id)" :size="16" weight="bold" /><PhPlus
              v-else
              :size="16"
              weight="bold" /></span
        ></label>
      </li>
    </ul>
    <p v-if="!visibleMembers.length && !loading" class="small-print">
      {{ l('No matching people.', 'لا يوجد أشخاص مطابقون.') }}
    </p>
  </section>
</template>
<style scoped>
.member-picker {
  min-width: 0;
  margin: 16px 0;
}
.member-search {
  display: grid;
  gap: 8px;
  margin: 0;
  min-width: 0;
}
.member-search-field {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding-inline: 14px;
  border: 1px solid var(--control-border);
  border-radius: var(--radius-control, 8px);
  background: var(--field);
  box-shadow: var(--shadow-xs);
  color: var(--muted);
}
.member-search-field:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--ring);
}
.member-search-field input,
.member-search-field input:focus-visible {
  box-shadow: none;
}
.member-search-field input {
  flex: 1;
  min-width: 0;
  min-height: 42px;
  border: 0;
  padding: 0;
  background: transparent;
  outline: none;
}
.member-options {
  display: grid;
  gap: 6px;
  margin: 8px 0;
  padding: 0;
  list-style: none;
}
.member-options:empty {
  display: none;
}
.member-match {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  margin: 0;
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-control, 8px);
  background: var(--field);
  cursor: pointer;
  overflow-wrap: anywhere;
}
.member-match:hover:not(:has(input:disabled)) {
  border-color: var(--accent);
}
.member-match:has(input:focus-visible) {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.member-match.is-chosen {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 16%, var(--page));
}
.member-match:has(input:disabled):not(.is-chosen) {
  cursor: default;
  opacity: 0.55;
}
/* Visually hidden but still the accessible, keyboard-operable control. */
.member-match-input {
  position: absolute;
  width: 1px;
  height: 1px;
  min-height: 0;
  margin: 0;
  opacity: 0;
}
.member-option-details {
  display: grid;
  flex: 1;
  gap: 2px;
  min-width: 0;
  font-weight: 600;
}
.member-option-name {
  display: block;
}
.member-option-details small {
  color: var(--muted);
  font-size: 0.8rem;
  font-weight: 400;
}
.member-match-icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--on-accent);
}
.member-match:has(input:disabled):not(.is-chosen) .member-match-icon {
  background: var(--surface-soft);
  color: var(--muted);
}
.chosen-members {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-block: 8px;
}
.chosen-members > span {
  font-size: var(--text-small);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  background: var(--surface-soft);
  border: 1px solid var(--line);
  border-radius: 8px;
  max-width: 100%;
  overflow-wrap: anywhere;
}
</style>
