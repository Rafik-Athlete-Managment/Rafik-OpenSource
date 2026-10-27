<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { sectionPath } from './section-path'
import {
  PhHouse,
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
} from '@phosphor-icons/vue'
import { language as l } from '../../lib/i18n'
const props = defineProps<{ base: string; role: string }>()
const emit = defineEmits<{ navigate: [] }>()
const route = useRoute()
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
            ['/injuries', l('Injury status', 'حالة الإصابة'), PhListChecks],
            ['/feedback', l('My feedback', 'تقييماتي'), PhClipboardText],
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
              ['/plans', l('Programs', 'البرامج'), PhClipboardText],
              ['/activity', l('Activity', 'النشاط'), PhClockCounterClockwise],
              ['/institution-settings', l('Institution settings', 'إعدادات المؤسسة'), PhGear],
            ],
          },
          {
            name: l('Institution', 'المؤسسة'),
            items: [
              ['/training', l('Athlete plans', 'خطط الرياضيين'), PhBarbell],
              ['/workouts', l('Workout history', 'سجل التمارين'), PhClockCounterClockwise],
              ['/nutrition', l('Nutrition plans', 'خطط التغذية'), PhBowlFood],
              ['/injuries', l('Injury status', 'حالة الإصابة'), PhListChecks],
              ['/schedule', l('Schedule', 'الجدول'), PhCalendarBlank],
              ['/messages', l('Messages', 'الرسائل'), PhChatCircle],
            ],
          },
          {
            name: l('Library', 'المكتبة'),
            items: [
              ['/exercises', l('Exercises', 'التمارين'), PhBarbell],
              ['/resources', l('Resources', 'الموارد'), PhFolder],
              ['/groups', l('Groups', 'المجموعات'), PhUsers],
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
</script>
<template>
  <nav class="dashboard-navigation" :aria-label="l('Institution navigation', 'تنقل المؤسسة')">
    <section v-for="(group, index) in groups" :key="group.name" class="navigation-group">
      <h2 :id="'navigation-group-' + index">{{ group.name }}</h2>
      <ul class="dashboard-navigation-links" :aria-labelledby="'navigation-group-' + index">
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
    </section>
  </nav>
</template>
<style scoped>
.dashboard-navigation {
  display: grid;
  gap: 12px;
  padding: 16px 12px;
}
.navigation-group {
  min-width: 0;
}
.navigation-group h2 {
  margin: 0;
  padding: 8px 12px 4px;
  color: var(--muted);
  font-size: 0.76rem;
  font-weight: 700;
  line-height: 1.4;
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
  min-height: 36px;
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
