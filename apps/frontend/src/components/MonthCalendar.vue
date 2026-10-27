<script setup lang="ts">
import { computed } from 'vue'
import { addDays, localDate } from '../lib/dates'
import { language as l, locale } from '../lib/i18n'
type Props = {
  month: string
  selected: string
  zone: string
  events: {
    id: string
    starts_at: string | null
    training_date?: string
    title: string
    state: string
    kind?: string
    workout_snapshot?: { assignment_id?: string } | null
  }[]
}
const props = defineProps<Props>()
const emit = defineEmits<{ select: [date: string] }>()
const first = computed(() => props.month.slice(0, 7) + '-01')
const cells = computed(() => {
  const offset = (new Date(first.value + 'T12:00:00Z').getUTCDay() + 6) % 7
  const days = new Date(
    Number(first.value.slice(0, 4)),
    Number(first.value.slice(5, 7)),
    0,
  ).getDate()
  return Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, i) => {
    const date = addDays(first.value, i - offset)
    return {
      date,
      inside: date.slice(0, 7) === first.value.slice(0, 7),
      events: props.events.filter(
        (e) =>
          (e.starts_at ? localDate(props.zone, new Date(e.starts_at)) : e.training_date) === date,
      ),
    }
  })
})
const time = (value: string) =>
  new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar-AE' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: props.zone,
  }).format(new Date(value))
/** Colour supplements the event title; it never carries meaning on its own. */
const kindOf = (e: Props['events'][number]) =>
  e.workout_snapshot?.assignment_id
    ? 'workout'
    : e.kind === 'assessment'
      ? 'assessment'
      : 'training'
const label = (date: string) =>
  new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar-AE' : 'en-GB', {
    dateStyle: 'full',
    timeZone: 'UTC',
  }).format(new Date(date + 'T12:00:00Z'))
const weekdays = computed(() =>
  Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar-AE' : 'en-GB', {
      weekday: 'short',
      timeZone: 'UTC',
    }).format(new Date('2026-09-' + (21 + i) + 'T12:00:00Z')),
  ),
)
function keyboard(event: KeyboardEvent) {
  const dir = locale.value === 'ar' ? -1 : 1
  const offset = (
    { ArrowRight: dir, ArrowLeft: -dir, ArrowDown: 7, ArrowUp: -7 } as Record<string, number>
  )[event.key]
  if (offset === undefined) return
  const buttons = [
    ...(event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>(
      'button:not(:disabled)',
    ),
  ]
  const index = buttons.indexOf(event.target as HTMLButtonElement)
  if (index < 0) return
  event.preventDefault()
  buttons[Math.max(0, Math.min(buttons.length - 1, index + offset))]?.focus()
}
</script>
<template>
  <div
    class="month-calendar"
    :aria-label="l('Monthly bookings', 'حجوزات الشهر')"
    @keydown="keyboard"
  >
    <div v-for="day in weekdays" :key="day" class="month-weekday">{{ day }}</div>
    <button
      v-for="cell in cells"
      :key="cell.date"
      type="button"
      class="month-day"
      :disabled="!cell.inside"
      :class="{ selected: selected === cell.date, today: cell.date === localDate(zone) }"
      :aria-pressed="selected === cell.date"
      :aria-label="
        label(cell.date) + ' · ' + cell.events.length + ' ' + l('loaded events', 'موعد محمّل')
      "
      @click="emit('select', cell.date)"
    >
      <span class="day-number">{{ Number(cell.date.slice(-2)).toLocaleString(locale) }}</span>
      <span
        v-for="e in cell.events.slice(0, 2)"
        :key="e.id"
        class="month-event"
        :class="{ cancelled: e.state === 'cancelled' }"
        :data-kind="kindOf(e)"
        dir="auto"
        ><bdi v-if="e.starts_at" class="month-event-time">{{ time(e.starts_at) }}</bdi>
        {{ e.title }}</span
      >
      <small v-if="cell.events.length > 2" class="month-more">+{{ cell.events.length - 2 }}</small>
      <span v-if="cell.events.length" class="month-count"
        >{{ cell.events.length }}
        {{ cell.events.length === 1 ? l('event', 'موعد') : l('events', 'مواعيد') }}</span
      >
    </button>
  </div>
</template>
<style scoped>
.month-calendar {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 1px;
  background: var(--line);
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
}
.month-weekday {
  background: var(--surface-soft);
  text-align: center;
  padding: 10px 2px;
  font-size: 0.74rem;
  color: var(--muted);
}
.month-day {
  border: 0;
  border-radius: 0;
  min-width: 0;
  min-height: 108px;
  background: var(--surface);
  color: var(--ink);
  padding: 8px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 5px;
  text-align: start;
}
.month-day:hover,
.month-day.selected {
  background: var(--tint);
}
.month-day.selected {
  box-shadow: inset 0 0 0 2px var(--accent);
}
.month-day:disabled {
  /* The global disabled opacity would expose the grid-line background. */
  opacity: 1;
  background: var(--page);
}
.month-day:disabled > * {
  opacity: 0.5;
}
.day-number {
  font-variant-numeric: tabular-nums;
  font-size: 0.85rem;
}
.today .day-number {
  color: var(--accent);
  font-weight: 800;
}
.month-event {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 0.68rem;
  padding: 3px 4px;
  background: var(--surface-soft);
  border-inline-start: 2px solid var(--accent);
}
.month-event[data-kind='assessment'] {
  border-inline-start-color: light-dark(#155a91, #8cc4f2);
}
.month-event[data-kind='workout'] {
  border-inline-start-color: light-dark(#8a5a00, #f0cb7a);
}
.month-event-time {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.cancelled {
  text-decoration: line-through;
  opacity: 0.7;
}
.month-count {
  display: none;
  font-size: 0.62rem;
  color: var(--accent);
}
@media (max-width: 650px) {
  .month-day {
    min-height: 68px;
    padding: 6px 3px;
  }
  .month-event,
  .month-more {
    display: none;
  }
  .month-count {
    display: block;
  }
  .month-weekday {
    font-size: 0.62rem;
  }
}
</style>
