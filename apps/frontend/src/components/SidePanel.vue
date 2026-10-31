<script setup lang="ts">
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from 'reka-ui'
import { PhX } from '@phosphor-icons/vue'
import { language as l, locale } from '../lib/i18n'
/** Contextual task or detail beside the current page; the page stays mounted behind it. */
const props = withDefaults(
  defineProps<{
    title: string
    description?: string
    locked?: boolean
    /** Where focus returns on close when the opening control (for example a menu item) is gone. */
    returnFocus?: () => HTMLElement | null | undefined
  }>(),
  { description: '', locked: false, returnFocus: undefined },
)
function closeFocus(event: Event) {
  const target = props.returnFocus?.()
  if (!target) return
  event.preventDefault()
  target.focus()
}
const open = defineModel<boolean>('open', { required: true })
</script>
<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="ui-dialog-overlay" />
      <DialogContent
        class="side-panel"
        :dir="locale === 'ar' ? 'rtl' : 'ltr'"
        @interact-outside="locked && $event.preventDefault()"
        @escape-key-down="locked && $event.preventDefault()"
        @close-auto-focus="closeFocus"
      >
        <header class="side-panel-header">
          <div>
            <DialogTitle>{{ title }}</DialogTitle>
            <DialogDescription v-if="description">{{ description }}</DialogDescription>
          </div>
          <DialogClose as-child>
            <button
              type="button"
              class="button secondary small icon-only"
              :disabled="locked"
              :aria-label="l('Close', 'إغلاق')"
              :title="l('Close', 'إغلاق')"
            >
              <PhX :size="18" aria-hidden="true" />
            </button>
          </DialogClose>
        </header>
        <div class="side-panel-body"><slot /></div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
