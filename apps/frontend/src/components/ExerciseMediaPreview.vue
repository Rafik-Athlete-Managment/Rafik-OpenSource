<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  DialogRoot,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from 'reka-ui'
import { PhPlayCircle, PhImage, PhX } from '@phosphor-icons/vue'
import ExerciseDemo from './ExerciseDemo.vue'
import type { Exercise } from '../lib/domain'
import { exerciseThumbnail, hasExerciseMedia, videoForExercise } from '../lib/exercise-media'
import { language as l, locale } from '../lib/i18n'

const props = defineProps<{ exercise?: Exercise }>()
const open = ref(false),
  failed = ref(false)
const name = computed(() =>
  locale.value === 'ar' ? props.exercise?.name_ar || props.exercise?.name : props.exercise?.name,
)
const thumbnail = computed(() => exerciseThumbnail(props.exercise))
watch(
  () => props.exercise?.id,
  () => {
    open.value = false
    failed.value = false
  },
)
</script>
<template>
  <div
    v-if="hasExerciseMedia(exercise)"
    class="exercise-media-preview"
    :class="{ 'has-thumbnail': thumbnail && !failed }"
  >
    <DialogRoot v-model:open="open">
      <DialogTrigger as-child>
        <button
          type="button"
          class="button secondary exercise-media-trigger"
          :aria-label="l('View media for', 'عرض وسائط') + ' ' + name"
          :title="l('View media for', 'عرض وسائط') + ' ' + name"
        >
          <picture v-if="thumbnail && !failed" class="exercise-media-thumbnail">
            <source media="(min-width: 1024px)" :srcset="thumbnail" />
            <img
              src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="
              alt=""
              loading="lazy"
              width="72"
              height="72"
              @error="failed = true"
            />
          </picture>
          <span class="exercise-media-action"
            ><component
              :is="
                videoForExercise(exercise) || exercise?.media_type?.startsWith('video/')
                  ? PhPlayCircle
                  : PhImage
              "
              :size="18"
              aria-hidden="true"
            /><span class="exercise-media-label">{{ l('View media', 'عرض الوسائط') }}</span></span
          >
        </button>
      </DialogTrigger>
      <DialogPortal>
        <DialogOverlay class="ui-dialog-overlay" />
        <DialogContent
          class="ui-dialog exercise-media-dialog"
          :dir="locale === 'ar' ? 'rtl' : 'ltr'"
        >
          <header class="exercise-media-heading">
            <DialogTitle
              ><bdi>{{ name }}</bdi></DialogTitle
            >
            <DialogClose as-child
              ><button
                type="button"
                class="button secondary icon-only"
                :aria-label="l('Close media', 'إغلاق الوسائط')"
              >
                <PhX :size="18" aria-hidden="true" /></button
            ></DialogClose>
          </header>
          <DialogDescription>{{
            l('Exercise demonstration and source credits.', 'شرح التمرين وحقوق المصادر.')
          }}</DialogDescription>
          <ExerciseDemo v-if="open" :exercise="exercise" expanded />
          <p
            v-if="locale === 'ar' ? exercise?.instructions_ar : exercise?.instructions"
            class="preserve-lines"
            dir="auto"
          >
            {{ locale === 'ar' ? exercise?.instructions_ar : exercise?.instructions }}
          </p>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  </div>
</template>
<style scoped>
.exercise-media-preview {
  min-width: 0;
}
.exercise-media-trigger {
  position: relative;
  display: inline-flex;
  gap: var(--space-2);
  margin: 0;
}
.exercise-media-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
}
.exercise-media-thumbnail {
  display: none;
}
.exercise-media-dialog {
  width: min(880px, calc(100vw - 32px));
}
.exercise-media-heading {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: var(--space-4);
}
.exercise-media-heading h2 {
  margin: 0;
  font-size: var(--text-section);
  line-height: 1.4;
  min-width: 0;
}
.exercise-media-dialog :deep(.demo-caption),
.exercise-media-dialog :deep(.instruction-credit),
.exercise-media-dialog :deep(.demo-positions figcaption) {
  font-size: var(--text-caption);
}
@media (min-width: 1024px) {
  .has-thumbnail .exercise-media-trigger {
    padding: 0;
    width: 72px;
    height: 72px;
    min-height: 72px;
    overflow: hidden;
  }
  .has-thumbnail .exercise-media-action {
    position: absolute;
    inset-inline-end: 4px;
    inset-block-end: 4px;
    padding: 2px;
    border-radius: 4px;
    color: var(--ink);
    background: var(--surface);
  }
  .has-thumbnail .exercise-media-label {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    padding: 0;
    margin: -1px;
    clip-path: inset(50%);
    overflow: hidden;
    white-space: nowrap;
  }
  .exercise-media-thumbnail {
    display: block;
  }
  .exercise-media-thumbnail img {
    display: block;
    width: 72px;
    height: 72px;
    object-fit: contain;
    border-radius: var(--radius-control);
    background: var(--exercise-media-backdrop);
  }
}
</style>
