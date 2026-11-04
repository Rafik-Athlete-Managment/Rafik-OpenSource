import { useEffect, useState } from 'react'
import { Keyboard, Pressable, Text, View } from 'react-native'
import { useLanguage } from './Language'
import { Icon, type Styles } from './ui'

export type FieldTab = 'schedule' | 'workouts' | 'saved'

/** Keeps the three field destinations in one safe-area-aware, reusable control. */
export function FieldBottomNav({
  current,
  onChange,
  styles,
}: {
  current: FieldTab
  onChange: (tab: FieldTab) => void
  styles: Styles
}) {
  const { l } = useLanguage()
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  useEffect(() => {
    const open = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true))
    const close = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false))
    return () => {
      open.remove()
      close.remove()
    }
  }, [])
  if (keyboardOpen) return null
  const tabs = [
    { id: 'schedule', icon: 'event', title: l('Schedule', 'الجدول') },
    { id: 'workouts', icon: 'workout', title: l('Workouts', 'التمارين') },
    { id: 'saved', icon: 'saved', title: l('Saved', 'المحفوظات') },
  ] as const
  return (
    <View style={styles.bottomNav} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const active = current === tab.id
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityLabel={tab.title}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(tab.id)}
            style={[styles.bottomNavItem, active && styles.bottomNavActive]}
          >
            <Icon name={tab.icon} styles={styles} size={19} muted={!active} />
            <Text
              style={[styles.bottomNavText, active && styles.bottomNavTextActive]}
              numberOfLines={1}
            >
              {tab.title}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
