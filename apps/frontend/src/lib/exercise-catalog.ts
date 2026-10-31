import type { Exercise } from './domain'
import { locale } from './i18n'
export const areas: Record<string, string> = {
  back: 'الظهر',
  cardio: 'لياقة قلبية',
  chest: 'الصدر',
  'lower arms': 'الساعدان',
  'lower legs': 'أسفل الساقين',
  neck: 'الرقبة',
  shoulders: 'الكتفان',
  'upper arms': 'الذراعان',
  'upper legs': 'الفخذان',
  waist: 'الجذع',
}
export const equipmentArabic: Record<string, string> = {
  assisted: 'مساعدة',
  'assisted pull up machine': 'جهاز العقلة المساعد',
  band: 'شريط مقاومة',
  barbell: 'بار حديد',
  'body weight': 'وزن الجسم',
  'bosu ball': 'كرة بوسو',
  cable: 'جهاز كابل',
  dumbbell: 'دمبل',
  'elliptical machine': 'جهاز إليبتيكال',
  'ez barbell': 'بار إي زد',
  hammer: 'مطرقة',
  'hack squat machine': 'جهاز هاك سكوات',
  'hip adduction machine': 'جهاز ضم الفخذين',
  kettlebell: 'كيتل بيل',
  'leg press machine': 'جهاز ضغط الساقين',
  'leverage machine': 'جهاز مقاومة',
  'lying leg curl machine': 'جهاز ثني الساقين بوضع الاستلقاء',
  'medicine ball': 'كرة طبية',
  'olympic barbell': 'بار أولمبي',
  'pull-up bar': 'بار عقلة',
  roller: 'أسطوانة',
  rope: 'حبل',
  'seated calf raise machine': 'جهاز رفع السمانة جالسًا',
  'seated leg curl machine': 'جهاز ثني الساقين بوضع الجلوس',
  'shoulder press machine': 'جهاز ضغط الكتفين',
  'skierg machine': 'جهاز تزلج',
  'sled machine': 'زلاجة مقاومة',
  'smith machine': 'جهاز سميث',
  'stability ball': 'كرة توازن',
  'stationary bike': 'دراجة ثابتة',
  'standing leg curl machine': 'جهاز ثني الساق واقفًا',
  'stepmill machine': 'جهاز درج',
  tire: 'إطار',
  'trap bar': 'بار سداسي',
  'upper body ergometer': 'جهاز تدوير الذراعين',
  weighted: 'وزن إضافي',
  'wheel roller': 'عجلة البطن',
  bench: 'مقعد',
  mat: 'حصيرة',
  step: 'درجة',
  treadmill: 'مشاية',
}
const equipmentEnglish: Record<string, string> = {
  'body weight': 'Body weight',
  'bosu ball': 'BOSU ball',
  'ez barbell': 'EZ bar',
  'pull-up bar': 'Pull-up bar',
  'skierg machine': 'SkiErg machine',
  'upper body ergometer': 'Upper-body ergometer',
}

// The catalog combines several sources whose spelling and granularity differ.
// These aliases deliberately converge equivalent equipment while keeping
// distinct implements (for example, an EZ bar and a standard barbell) separate.
const equipmentAliases: Record<string, string | null> = {
  bodyweight: 'body weight',
  'none (bodyweight exercise)': 'body weight',
  dumbbells: 'dumbbell',
  'cable machine': 'cable',
  'ez bar': 'ez barbell',
  'sz bar': 'ez barbell',
  'incline bench': 'bench',
  'preacher bench': 'bench',
  'stable bench': 'bench',
  'stable step': 'step',
  'resistance band': 'band',
  'resistance bands': 'band',
  'pull up bar': 'pull-up bar',
  none: null,
  'walking route': null,
}
const starterAreas: Record<string, string> = {
  'goblet-squat': 'upper legs',
  'dumbbell-row': 'back',
  'floor-press': 'chest',
  'romanian-deadlift': 'upper legs',
  'split-squat': 'upper legs',
  'glute-bridge': 'upper legs',
  'overhead-press': 'shoulders',
  'dead-bug': 'waist',
  'forearm-plank': 'waist',
  'incline-pushup': 'chest',
  'band-row': 'back',
  'brisk-walk': 'cardio',
  'stationary-cycle': 'cardio',
  'low-step-up': 'upper legs',
}
export const exerciseArea = (e: Exercise) =>
  e.body_part || e.category || (!e.owner_id && !e.institution_id ? starterAreas[e.id] : '') || ''
export const exerciseAreas = (e: Exercise) =>
  e.body_parts?.length ? e.body_parts : [exerciseArea(e)].filter(Boolean)
export function categoryLabel(value: string) {
  return locale.value === 'ar'
    ? areas[value] || value
    : value
      ? value[0]!.toUpperCase() + value.slice(1)
      : ''
}
export function equipmentLabel(value: string) {
  return locale.value === 'ar'
    ? equipmentArabic[value] || value
    : equipmentEnglish[value] || (value ? value[0]!.toUpperCase() + value.slice(1) : '')
}

function normalizeEquipmentPart(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[‐‑‒–—_-]/g, ' ')
    .replace(/\s+/g, ' ')
  return Object.prototype.hasOwnProperty.call(equipmentAliases, normalized)
    ? equipmentAliases[normalized]
    : normalized || null
}

export function equipmentCategories(e: Exercise) {
  const result = new Set<string>()
  for (const part of (e.equipment_items?.join(', ') || e.equipment).split(
    /\s*(?:,|\/|&|\b(?:and|or)\b)\s*/i,
  )) {
    const category = normalizeEquipmentPart(part)
    if (category) result.add(category)
  }
  return [...result]
}

export const muscles: Record<string, string> = {
  abdominals: 'البطن',
  obliques: 'العضلات المائلة',
  quadriceps: 'العضلات الرباعية',
  hamstrings: 'أوتار الركبة',
  glutes: 'الأرداف',
  calves: 'السمانة',
  chest: 'الصدر',
  lats: 'الظهر العريض',
  trapezius: 'العضلة شبه المنحرفة',
  'lower back': 'أسفل الظهر',
  shoulders: 'الكتفان',
  biceps: 'العضلة ذات الرأسين',
  triceps: 'العضلة ثلاثية الرؤوس',
  forearms: 'الساعدان',
  adductors: 'المقربات',
  abductors: 'المبعدات',
  'hip flexors': 'مثنيات الورك',
  neck: 'الرقبة',
}
export const movements: Record<string, string> = {
  compound: 'مركّب',
  isolation: 'عزل',
  cardio: 'لياقة قلبية',
  bodyweight: 'وزن الجسم',
  stretch: 'تمدد',
  mobility: 'حركية',
  balance: 'توازن',
  plyometric: 'بليومتري',
}
export const optionLabel = (key: string, options: Record<string, string>) =>
  locale.value === 'ar' ? options[key] || key : key.charAt(0).toUpperCase() + key.slice(1)
