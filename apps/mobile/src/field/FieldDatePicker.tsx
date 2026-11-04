import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Calendar, LocaleConfig } from 'react-native-calendars'
import { useLanguage } from './Language'
import { Icon, type Styles } from './ui'

for (const [key, locale] of [
  ['en', 'en-GB'],
  ['ar', 'ar-AE'],
] as const) {
  const month = (index: number, length: 'long' | 'short') =>
    new Intl.DateTimeFormat(locale, { month: length, calendar: 'gregory', timeZone: 'UTC' }).format(
      new Date(Date.UTC(2024, index, 1)),
    )
  const day = (index: number, length: 'long' | 'short' | 'narrow') =>
    new Intl.DateTimeFormat(locale, {
      weekday: length,
      calendar: 'gregory',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(2024, 0, 7 + index)))
  LocaleConfig.locales[key] = {
    monthNames: Array.from({ length: 12 }, (_, index) => month(index, 'long')),
    monthNamesShort: Array.from({ length: 12 }, (_, index) => month(index, 'short')),
    dayNames: Array.from({ length: 7 }, (_, index) => day(index, 'long')),
    // Arabic short weekday names are full words; the narrow form fits a 7-column grid.
    dayNamesShort: Array.from({ length: 7 }, (_, index) =>
      day(index, key === 'ar' ? 'narrow' : 'short'),
    ),
    today: key === 'ar' ? 'اليوم' : 'Today',
  }
}

/** Selects a local calendar day without converting it through UTC or changing the active schedule. */
export function FieldDatePicker({
  selected,
  onChange,
  styles,
}: {
  selected: string
  onChange: (day: string) => void
  styles: Styles
}) {
  const { language, l } = useLanguage()
  const [month, setMonth] = useState(selected.slice(0, 7) + '-01')
  useEffect(() => setMonth(selected.slice(0, 7) + '-01'), [selected])
  LocaleConfig.defaultLocale = language
  const year = (delta: number) => {
    const [y, m] = month.split('-').map(Number)
    setMonth(`${y + delta}-${String(m).padStart(2, '0')}-01`)
  }
  return (
    <View style={[styles.calendarSurface, { direction: language === 'ar' ? 'rtl' : 'ltr' }]}>
      <View style={[styles.actionRow, { justifyContent: 'space-between' }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={l('Previous year', 'السنة السابقة')}
          onPress={() => year(-1)}
          style={styles.calendarYearAction}
        >
          <Icon name="previous" styles={styles} rtl={language === 'ar'} size={16} />
          <Text style={[styles.link, { fontSize: 14 }]}>{Number(month.slice(0, 4)) - 1}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={l('Next year', 'السنة التالية')}
          onPress={() => year(1)}
          style={styles.calendarYearAction}
        >
          <Text style={[styles.link, { fontSize: 14 }]}>{Number(month.slice(0, 4)) + 1}</Text>
          <Icon name="forward" styles={styles} rtl={language === 'ar'} size={16} />
        </Pressable>
      </View>
      <Calendar
        key={`${language}:${month}`}
        style={{ direction: language === 'ar' ? 'rtl' : 'ltr' }}
        current={month}
        firstDay={1}
        enableSwipeMonths
        onMonthChange={(value) => setMonth(value.dateString.slice(0, 7) + '-01')}
        onDayPress={(value) => onChange(value.dateString)}
        markedDates={{ [selected]: { selected: true, selectedColor: styles.colors.accent } }}
        theme={{
          calendarBackground: styles.card.backgroundColor,
          backgroundColor: styles.card.backgroundColor,
          dayTextColor: styles.cardTitle.color,
          monthTextColor: styles.cardTitle.color,
          textSectionTitleColor: styles.hint.color,
          textDisabledColor: styles.hint.color,
          todayTextColor: styles.link.color,
          arrowColor: styles.link.color,
          selectedDayTextColor: styles.colors.onAccent,
          textDayFontWeight: '500',
          textMonthFontWeight: '700',
        }}
      />
    </View>
  )
}
