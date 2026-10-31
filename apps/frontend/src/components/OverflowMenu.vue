<script setup lang="ts">
import type { Component } from 'vue'
import { useRouter, type RouteLocationRaw } from 'vue-router'
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
} from 'reka-ui'
import { PhDotsThree } from '@phosphor-icons/vue'
import { locale } from '../lib/i18n'

export type OverflowItem = {
  key: string
  label: string
  icon?: Component
  /** Destructive data/access actions only; never routine navigation. */
  danger?: boolean
  disabled?: boolean
  to?: RouteLocationRaw
}
const props = withDefaults(
  defineProps<{
    label: string
    items: OverflowItem[]
    text?: string
    compact?: boolean
    /** Replaces the three-dot icon, for example a plus icon on a "New" menu. */
    icon?: Component
    primary?: boolean
  }>(),
  { text: '', compact: false, icon: undefined, primary: false },
)
const emit = defineEmits<{ select: [key: string] }>()
const router = useRouter()
function choose(item: OverflowItem) {
  if (item.to) void router.push(item.to)
  else emit('select', item.key)
}
</script>
<template>
  <DropdownMenuRoot :modal="false">
    <DropdownMenuTrigger as-child>
      <button
        type="button"
        class="button overflow-trigger"
        :class="{ small: compact, 'icon-only': !text, secondary: !props.primary }"
        :aria-label="text ? undefined : label"
        :title="text ? undefined : label"
      >
        <component
          :is="props.icon || PhDotsThree"
          :size="20"
          :weight="props.icon ? 'regular' : 'bold'"
          aria-hidden="true"
        /><span v-if="text">{{ text }}</span>
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        class="overflow-menu"
        :dir="locale === 'ar' ? 'rtl' : 'ltr'"
        align="end"
        :side-offset="6"
        :collision-padding="12"
      >
        <DropdownMenuItem
          v-for="item in items"
          :key="item.key"
          class="overflow-item"
          :class="{ danger: item.danger }"
          :disabled="item.disabled"
          @select="choose(item)"
        >
          <component :is="item.icon" v-if="item.icon" :size="18" aria-hidden="true" />
          <span>{{ item.label }}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
