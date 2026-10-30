<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ResourceAsset from './ResourceAsset.vue'
import ExerciseVideo from './ExerciseVideo.vue'
import { videoForExercise, illustrationsForExercise } from '../lib/exercise-media'
import credits from '../content/exercise-credits.json'
import { language as l, locale } from '../lib/i18n'
import type { Exercise } from '../lib/domain'
import media from '../content/exercise-media.json'
const props = defineProps<{
  exercise?: Omit<Exercise, 'kind'> & { kind?: string }
  thumbnail?: boolean
  expanded?: boolean
}>()
const sourceRef = computed(
  () =>
    props.exercise?.source_ref ||
    (!props.exercise?.owner_id && !props.exercise?.institution_id ? props.exercise?.id : undefined),
)
const credit = computed(() => credits[sourceRef.value as keyof typeof credits])
const motion = computed(() => videoForExercise(props.exercise))
const pack = computed(() => illustrationsForExercise(props.exercise))
const failedFrames = ref<string[]>([])
watch(
  () => props.exercise?.id,
  () => {
    failedFrames.value = []
  },
)
const name = computed(() =>
  locale.value === 'ar' ? props.exercise?.name_ar || props.exercise?.name : props.exercise?.name,
)
</script>
<template>
  <ResourceAsset
    v-if="exercise?.media_asset"
    :id="exercise.media_asset"
    :name="name"
    :compact="thumbnail"
  />
  <ExerciseVideo v-else-if="motion" :key="motion.id" :item="motion" :name="name" />
  <div
    v-else-if="pack"
    role="group"
    class="exercise-demo"
    :aria-label="`${name} · ${l('Technique illustrations', 'رسومات التقنية')}`"
  >
    <div class="demo-positions">
      <figure v-for="(frame, index) in pack.frames" :key="frame.path">
        <img
          v-if="!failedFrames.includes(frame.path)"
          @error="failedFrames.push(frame.path)"
          :src="frame.path.replace('/v1/catalog', '')"
          :alt="`${name} · ${l('Position', 'الوضعية')} ${index + 1}`"
          width="512"
          height="512"
          loading="lazy"
        />
        <p v-else class="demo-frame-error">{{ l('Image unavailable', 'الرسم غير متاح') }}</p>
        <figcaption>{{ l('Position', 'الوضعية') }} {{ index + 1 }}</figcaption>
      </figure>
    </div>
    <button v-if="failedFrames.length" type="button" class="text-link" @click="failedFrames = []">
      {{ l('Retry images', 'إعادة تحميل الرسومات') }}
    </button>
    <p class="demo-caption">
      {{ l('Reference positions', 'وضعيات توضيحية') }} ·
      <a href="https://github.com/bryllim/workout-guide" target="_blank" rel="noopener noreferrer"
        >Bryl Lim<span v-if="'source' in pack.attribution"> / Everkinetic</span></a
      >
      · <a :href="media.licenseUrl" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>
    </p>
  </div>
  <a
    v-else-if="exercise?.media_url"
    :href="exercise.media_url"
    target="_blank"
    rel="noopener noreferrer"
    class="text-link"
    >{{ l('Open demonstration', 'فتح الشرح') }} ↗</a
  >
  <p v-else-if="expanded" class="demo-unavailable">
    {{
      l(
        'Written guide · no video available for this exercise yet.',
        'دليل مكتوب · لا يتوفر فيديو لهذا التمرين بعد.',
      )
    }}
  </p>
  <p v-if="credit" class="instruction-credit">
    {{ l('Instruction source', 'مصدر التعليمات') }}:
    <a :href="credit.sourceUrl" target="_blank" rel="noopener noreferrer"
      >{{ credit.author }} / wger</a
    >
    · <a :href="credit.licenseUrl" target="_blank" rel="noopener noreferrer">{{ credit.license }}</a
    ><span v-if="credit.adapted"> · {{ l('Adapted by Rafik', 'بتصرف من رفيق') }}</span>
  </p>
  <p v-else-if="sourceRef?.startsWith('dataset-')" class="instruction-credit">
    {{ l('Instruction source', 'مصدر التعليمات') }}:
    <a
      href="https://github.com/hasaneyldrm/exercises-dataset/tree/7455efae41b330c265e7cd4b78dfa848e7ce5ebd"
      target="_blank"
      rel="noopener noreferrer"
      >Exercises Dataset · MIT</a
    >
  </p>
</template>
<style scoped>
.instruction-credit {
  font-size: 0.7rem;
  line-height: 1.7;
  color: var(--muted);
}
.exercise-demo {
  margin-block: 1.5rem;
  max-width: 100%;
}
.demo-positions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  max-width: 600px;
}
.demo-positions figure {
  margin: 0;
  min-width: 0;
}
.demo-positions img {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 1;
  object-fit: contain;
  border-radius: 10px;
  background: var(--exercise-media-backdrop, #1c2924);
  padding: 8px;
}
.demo-positions figcaption {
  text-align: center;
  font-size: 0.7rem;
  color: var(--muted);
  margin-top: 6px;
}
.demo-frame-error {
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  text-align: center;
  font-size: 0.75rem;
  color: var(--muted);
  border: 1px solid var(--line);
  border-radius: 10px;
}
.demo-caption {
  font-size: 0.7rem;
  line-height: 1.7;
  color: var(--muted);
  margin-top: 10px;
}
.demo-unavailable {
  font-size: 0.8rem;
  color: var(--muted);
  padding-block: 1rem;
  border-block: 1px solid var(--line);
  margin-block: 1.5rem;
}
</style>
