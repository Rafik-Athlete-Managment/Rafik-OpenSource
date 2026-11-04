<!-- Exercise video: plays a reviewed demonstration and displays its source attribution. -->
<script setup lang="ts">
import { nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { PhPlay, PhPause, PhArrowClockwise } from '@phosphor-icons/vue'
import { language as l } from '../lib/i18n'
import { exerciseAssetUrl, type ExerciseVideo } from '../lib/exercise-media'
const props = defineProps<{ item: ExerciseVideo; name?: string }>()
const video = ref<HTMLVideoElement>(),
  host = ref<HTMLElement>()
const visible = ref(false),
  activated = ref(false),
  playing = ref(false),
  failed = ref(false),
  pausedByUser = ref(false),
  userRequested = ref(false)
const reduced = matchMedia('(prefers-reduced-motion: reduce)')
let observer: IntersectionObserver | undefined
let disposed = false
async function sync() {
  await nextTick()
  const player = video.value
  if (!player) return
  if (
    !visible.value ||
    document.hidden ||
    (reduced.matches && !userRequested.value) ||
    pausedByUser.value ||
    failed.value
  ) {
    player.pause()
    return
  }
  try {
    await player.play()
    if (
      disposed ||
      document.hidden ||
      !visible.value ||
      pausedByUser.value ||
      (reduced.matches && !userRequested.value)
    )
      player.pause()
  } catch {
    playing.value = false
  }
}
async function toggle() {
  if (!video.value) return
  if (playing.value) {
    pausedByUser.value = true
    video.value.pause()
  } else {
    pausedByUser.value = false
    userRequested.value = true
    try {
      await video.value.play()
      if (disposed || document.hidden || !visible.value || pausedByUser.value) video.value.pause()
    } catch {
      playing.value = false
    }
  }
}
function motionChanged() {
  userRequested.value = false
  void sync()
}
function retry() {
  failed.value = false
  video.value?.load()
  void sync()
}
function mediaFailed() {
  failed.value = true
  playing.value = false
}
watch(
  () => props.item.id,
  () => {
    failed.value = false
    pausedByUser.value = false
    userRequested.value = false
  },
)
onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      visible.value = entries[0]?.isIntersecting || false
      if (visible.value) activated.value = true
      void sync()
    },
    { threshold: 0.2 },
  )
  if (host.value) observer.observe(host.value)
  document.addEventListener('visibilitychange', sync)
  reduced.addEventListener('change', motionChanged)
})
onBeforeUnmount(() => {
  disposed = true
  video.value?.pause()
  observer?.disconnect()
  document.removeEventListener('visibilitychange', sync)
  reduced.removeEventListener('change', motionChanged)
})
</script>
<template>
  <div ref="host" class="exercise-video">
    <div class="video-stage">
      <video
        ref="video"
        :key="item.id"
        :src="activated ? exerciseAssetUrl(item.video.path) : undefined"
        :poster="exerciseAssetUrl(item.poster.path)"
        :aria-label="name || item.name"
        muted
        loop
        playsinline
        preload="none"
        @canplay="sync"
        @play="playing = true"
        @pause="playing = false"
        @error="mediaFailed"
      />
      <div v-if="failed" class="video-error" role="status">
        <p>
          {{
            l(
              'The video could not load. Your written instructions are still available.',
              'تعذر تحميل الفيديو. تبقى التعليمات المكتوبة متاحة.',
            )
          }}
        </p>
        <button type="button" class="button secondary small" @click="retry">
          <PhArrowClockwise :size="16" />{{ l('Retry video', 'إعادة تحميل الفيديو') }}
        </button>
      </div>
      <button
        v-else
        type="button"
        class="video-play"
        :aria-label="
          playing
            ? l('Pause demonstration', 'إيقاف الشرح مؤقتاً')
            : l('Play demonstration', 'تشغيل الشرح')
        "
        @click="toggle"
      >
        <PhPause v-if="playing" :size="18" weight="fill" /><PhPlay
          v-else
          :size="18"
          weight="fill"
        />
      </button>
    </div>
    <div class="video-meta">
      <span>{{ l('Movement demonstration', 'شرح الحركة') }}</span
      ><span>{{ l('Loops automatically', 'يتكرر تلقائياً') }}</span>
    </div>
    <details class="video-credit">
      <summary>{{ l('Video credits', 'حقوق الفيديو') }}</summary>
      <p>
        <a :href="item.source.apiRecordUrl" target="_blank" rel="noopener noreferrer"
          >{{ item.creator }} / wger</a
        >
        · <a :href="item.licenseUrl" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>.
        {{
          l(
            'Resized, trimmed where needed, and converted to a silent MP4.',
            'صُغّر وقُصّ عند الحاجة وحُوّل إلى MP4 صامت.',
          )
        }}
      </p>
      <a :href="exerciseAssetUrl(item.video.path)" target="_blank" rel="noopener noreferrer">{{
        l('Open video file', 'فتح ملف الفيديو')
      }}</a>
    </details>
  </div>
</template>
<style scoped>
.exercise-video {
  margin-block: 1.25rem;
  max-width: 640px;
}
.video-stage {
  position: relative;
  border-radius: 10px;
  overflow: hidden;
  background: #111713;
  aspect-ratio: 16/10;
}
video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.video-play {
  position: absolute;
  inset-inline-end: 12px;
  bottom: 12px;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: #fff;
  color: #17251e;
  border: 1px solid #d9e0da;
  box-shadow: 0 2px 8px #0003;
  cursor: pointer;
}
.video-meta {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 0.75rem;
  margin-top: 8px;
  color: var(--muted);
}
.video-credit {
  font-size: 0.7rem;
  color: var(--muted);
  margin-top: 10px;
  line-height: 1.7;
}
.video-credit p {
  font-size: inherit;
}
.video-error {
  position: absolute;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  padding: 16px;
  color: var(--ink);
  background: var(--surface);
  text-align: center;
}
.video-error p {
  font-size: 0.85rem;
}
</style>
