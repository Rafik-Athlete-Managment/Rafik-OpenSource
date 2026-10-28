<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { useRoute } from 'vue-router'
import { sectionPath } from './section-path'
import {
  PhHouse,
  PhStar,
  PhPulse,
  PhUsers,
  PhBarbell,
  PhCalendarBlank,
  PhChartLine,
  PhChatCircle,
  PhClipboardText,
  PhListChecks,
  PhFolder,
  PhGear,
  PhBowlFood,
  PhClockCounterClockwise,
  PhPersonSimpleRun,
  PhUsersThree,
  PhHeartbeat,
  PhCaretDown,
} from '@phosphor-icons/vue'
import { language as l } from '../../lib/i18n'
const props = defineProps<{ base: string; role: string }>()
const emit = defineEmits<{ navigate: [] }>()
const route = useRoute()
const navigationId = useId()
const expanded = ref(0)
const groups = computed(() =>
  props.role === 'trainee'
    ? [
        {
          name: l('My training', 'تدريبي'),
          items: [
            ['/dashboard', l('Overview', 'نظرة عامة'), PhHouse],
            ['/plans', l('Programs', 'البرامج'), PhClipboardText],
            ['/training', l('Training', 'التدريب'), PhBarbell],
            ['/schedule', l('Schedule', 'الجدول'), PhCalendarBlank],
          ],
        },
        {
          name: l('My support', 'الدعم الخاص بي'),
          items: [
            ['/nutrition', l('Nutrition', 'التغذية'), PhBowlFood],
            ['/injuries', l('Injury status', 'حالة الإصابة'), PhHeartbeat],
            ['/feedback', l('My feedback', 'تقييماتي'), PhStar],
            ['/messages', l('Messages', 'الرسائل'), PhChatCircle],
          ],
        },
      ]
    : props.role === 'admin'
      ? [
          {
            name: l('Administration', 'الإدارة'),
            items: [
              ['/dashboard', l('Overview', 'نظرة عامة'), PhHouse],
              ['/people', l('People & access', 'الأشخاص والصلاحيات'), PhUsers],
              ['/analytics', l('Analytics', 'التحليلات'), PhChartLine],
              ['/activity', l('Activity', 'النشاط'), PhPulse],
              ['/institution-settings', l('Institution settings', 'إعدادات المؤسسة'), PhGear],
            ],
          },
          {
            name: l('Institution', 'المؤسسة'),
            items: [
              ['/training', l('Athlete plans', 'خطط الرياضيين'), PhBarbell],
              ['/workouts', l('Workout history', 'سجل التمارين'), PhClockCounterClockwise],
              ['/nutrition', l('Nutrition plans', 'خطط التغذية'), PhBowlFood],
              ['/injuries', l('Injury status', 'حالة الإصابة'), PhHeartbeat],
              ['/schedule', l('Schedule', 'الجدول'), PhCalendarBlank],
              ['/messages', l('Messages', 'الرسائل'), PhChatCircle],
            ],
          },
          {
            name: l('Library', 'المكتبة'),
            items: [
              ['/plans', l('Programs', 'البرامج'), PhClipboardText],
              ['/exercises', l('Exercises', 'التمارين'), PhPersonSimpleRun],
              ['/resources', l('Resources', 'الموارد'), PhFolder],
              ['/groups', l('Groups', 'المجموعات'), PhUsersThree],
              ['/assessment-templates', l('Assessment templates', 'قوالب التقييم'), PhListChecks],
            ],
          },
        ]
      : [
          {
            name: l('Coaching', 'التدريب'),
            items: [
              ['/dashboard', l('Overview', 'نظرة عامة'), PhHouse],
              ['/people', l('People', 'الأشخاص'), PhUsers],
              ['/schedule', l('Schedule', 'الجدول'), PhCalendarBlank],
              ['/messages', l('Messages', 'الرسائل'), PhChatCircle],
            ],
          },
          {
            name: l('Training', 'خطط التدريب'),
            items: [
              ['/training', l('Athlete plans', 'خطط الرياضيين'), PhBarbell],
              ['/workouts', l('Workout history', 'سجل التمارين'), PhClockCounterClockwise],
              ['/plans', l('Programs', 'البرامج'), PhClipboardText],
              ['/exercises', l('Exercises', 'التمارين'), PhPersonSimpleRun],
            ],
          },
          {
            name: l('Athlete care', 'رعاية الرياضيين'),
            items: [
              ['/nutrition', l('Nutrition plans', 'خطط التغذية'), PhBowlFood],
              ...(props.role === 'trainer'
                ? [['/injuries', l('Injury status', 'حالة الإصابة'), PhHeartbeat]]
                : []),
            ],
          },
          {
            name: l('Setup', 'الإعداد'),
            items: [
              ['/groups', l('Groups', 'المجموعات'), PhUsersThree],
              ['/assessment-templates', l('Assessment templates', 'قوالب التقييم'), PhListChecks],
              ['/resources', l('Resources', 'الموارد'), PhFolder],
            ],
          },
          {
            name: l('Insights', 'المؤشرات'),
            items: [['/analytics', l('Analytics', 'التحليلات'), PhChartLine]],
          },
        ],
)
function selected(path: string) {
  const current = sectionPath(route.path)
  return path
    ? current === props.base + path || current.startsWith(props.base + path + '/')
    : current === props.base
}
watch(
  () => [route.path, props.role, props.base],
  () => {
    const active = groups.value.findIndex((group) =>
      group.items.some((item) => selected(String(item[0]))),
    )
    if (active >= 0) expanded.value = active
  },
  { immediate: true },
)
</script>
<template>
  <nav class="dashboard-navigation" :aria-label="l('Institution navigation', 'تنقل المؤسسة')">
    <section v-for="(group, index) in groups" :key="group.name" class="navigation-group">
      <h2>
        <button
          :id="navigationId + '-heading-' + index"
          type="button"
          :aria-expanded="expanded === index"
          :aria-controls="navigationId + '-links-' + index"
          @click="expanded = expanded === index ? -1 : index"
        >
          <span>{{ group.name }}</span>
          <PhCaretDown :size="16" aria-hidden="true" :class="{ expanded: expanded === index }" />
        </button>
      </h2>
      <Transition name="navigation-disclosure">
        <ul
          v-show="expanded === index"
          :id="navigationId + '-links-' + index"
          class="dashboard-navigation-links"
          :aria-labelledby="navigationId + '-heading-' + index"
        >
          <li v-for="item in group.items" :key="String(item[0])">
            <RouterLink
              :to="base + String(item[0])"
              :class="{ selected: selected(String(item[0])) }"
              :aria-current="selected(String(item[0])) ? 'page' : undefined"
              @click="emit('navigate')"
              ><component :is="item[2]" :size="18" aria-hidden="true" /><span>{{
                item[1]
              }}</span></RouterLink
            >
          </li>
        </ul>
      </Transition>
    </section>
  </nav>
</template>
<style scoped>
.dashboard-navigation {
  display: grid;
  align-content: start;
  gap: 4px;
  padding: 12px;
}
.navigation-group {
  min-width: 0;
}
.navigation-group h2 {
  margin: 0;
}
.navigation-group h2 button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-height: 44px;
  padding: 8px 12px;
  border: 0;
  background: transparent;
  box-shadow: none;
  text-align: start;
  color: var(--muted);
  font-size: 0.76rem;
  font-weight: 700;
  line-height: 1.4;
}
.navigation-group h2 button:hover {
  background: var(--surface-soft);
  color: var(--ink);
}
.navigation-group h2 svg {
  flex-shrink: 0;
  transition: transform 140ms ease;
}
.navigation-group h2 svg.expanded {
  transform: rotate(180deg);
}
.navigation-disclosure-enter-active,
.navigation-disclosure-leave-active {
  transition: opacity 120ms ease;
}
.navigation-disclosure-enter-from,
.navigation-disclosure-leave-to {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .navigation-group h2 svg,
  .navigation-disclosure-enter-active,
  .navigation-disclosure-leave-active {
    transition: none;
  }
}
.dashboard-navigation-links {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}
a {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 9px 12px;
  min-height: 44px;
  font-size: 0.8rem;
  border-radius: 7px;
  color: var(--muted);
}
a svg {
  flex-shrink: 0;
}
a:hover {
  background: var(--surface-soft);
  color: var(--ink);
}
a.selected {
  background: var(--tint);
  color: var(--accent);
  font-weight: 750;
}
a span {
  overflow-wrap: anywhere;
}
</style>
