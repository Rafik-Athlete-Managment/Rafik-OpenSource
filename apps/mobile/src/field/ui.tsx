import { useLanguage } from './Language'
import type { Language } from './translations'
import { Platform, Pressable, StyleSheet, Text } from 'react-native'

export type Styles = ReturnType<typeof makeStyles>
/** Renders the shared phone action button with primary, danger and disabled states. */
export function Button({
  title,
  onPress,
  disabled = false,
  styles,
  primary = false,
  danger = false,
}: {
  title: string
  onPress: () => void
  disabled?: boolean
  styles: Styles
  primary?: boolean
  danger?: boolean
}) {
  const { t } = useLanguage()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        primary && styles.primary,
        danger && styles.dangerButton,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.buttonText, primary && styles.primaryText, danger && styles.dangerText]}>
        {t(title)}
      </Text>
    </Pressable>
  )
}

/** Compact navigation tab; selection is announced separately from the button label. */
export function Tab({
  title,
  selected,
  disabled = false,
  onPress,
  styles,
}: {
  title: string
  selected: boolean
  disabled?: boolean
  onPress: () => void
  styles: Styles
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.tab, selected && styles.tabSelected, disabled && styles.disabled]}
    >
      <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{title}</Text>
    </Pressable>
  )
}

/** Formats a date for display in the selected phone language. */
export const displayDate = (date: string, language: Language = 'en') =>
  new Date(date).toLocaleString(language === 'ar' ? 'ar' : 'en')
/** Formats a device-local calendar day as YYYY-MM-DD. */
export const localDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

/** Creates the shared phone styles for the selected theme and text direction. */
export function makeStyles(light: boolean, language: Language = 'en') {
  // Android 0.88 maps 'left' to paragraph start; 'right' becomes the RTL end.
  const textAlign =
    Platform.OS === 'android'
      ? ('left' as const)
      : language === 'ar'
        ? ('right' as const)
        : ('left' as const)
  const direction = language === 'ar' ? ('rtl' as const) : ('ltr' as const)
  const text = light ? '#182c2a' : '#f2f7f4'
  const muted = light ? '#455e58' : '#b1c6be'
  const accent = light ? '#08674f' : '#a0dfc8'
  return StyleSheet.create({
    safe: { direction, flex: 1, backgroundColor: light ? '#edf3f0' : '#0d1718' },
    toolbar: {
      direction,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 18,
      paddingVertical: 10,
    },
    heading: { flexGrow: 1, flexShrink: 1 },
    appBar: { borderBottomWidth: 1, borderBottomColor: light ? '#d6e1db' : '#2c423d' },
    topbar: {
      direction,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: light ? '#d6e1db' : '#2c423d',
    },
    accountButton: {
      borderWidth: 1,
      borderColor: light ? '#bdcfc5' : '#486159',
      borderRadius: 12,
      minHeight: 44,
      paddingHorizontal: 14,
      justifyContent: 'center',
    },
    accountMenu: {
      marginHorizontal: 18,
      marginTop: 8,
      marginBottom: 4,
      backgroundColor: light ? '#fff' : '#1b2b2c',
      borderColor: light ? '#d6e1db' : '#3b514b',
      borderWidth: 1,
      borderRadius: 16,
      padding: 14,
      gap: 10,
    },
    eventHeader: {
      direction,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: light ? '#d6e1db' : '#2c423d',
    },
    headerIcon: {
      minWidth: 44,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    noticeToast: {
      marginHorizontal: 18,
      marginTop: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: light ? '#9c7542' : '#d7ad68',
      backgroundColor: light ? '#fff3dd' : '#3c3020',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    athleteSwitcher: {
      marginHorizontal: 18,
      marginTop: 8,
      borderWidth: 1,
      borderColor: light ? '#d8e4dd' : '#36504a',
      borderRadius: 12,
      backgroundColor: light ? '#fff' : '#1a2b2d',
      paddingHorizontal: 12,
    },
    tabBar: {
      direction,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 18,
      paddingTop: 8,
      paddingBottom: 4,
      borderBottomWidth: 1,
      borderBottomColor: light ? '#d6e1db' : '#2c423d',
    },
    tab: {
      minHeight: 44,
      paddingHorizontal: 14,
      justifyContent: 'center',
      borderBottomWidth: 3,
      borderBottomColor: 'transparent',
    },
    tabSelected: { borderBottomColor: accent },
    tabText: { color: muted, fontSize: 14, fontWeight: '600', textAlign: 'center' },
    tabTextSelected: { color: text },
    content: {
      direction,
      flexGrow: 1,
      width: '100%',
      maxWidth: 800,
      alignSelf: 'center',
      padding: 18,
      gap: 14,
      paddingBottom: 40,
    },
    kicker: {
      textAlign,
      writingDirection: direction,
      direction,
      color: accent,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: language === 'ar' ? 0 : 2,
    },
    title: {
      textAlign,
      writingDirection: direction,
      direction,
      color: text,
      fontSize: 28,
      fontWeight: '700',
      flexShrink: 1,
    },
    cardTitle: {
      textAlign,
      writingDirection: direction,
      direction,
      color: text,
      fontSize: 18,
      fontWeight: '600',
    },
    card: {
      direction,
      backgroundColor: light ? '#fff' : '#1a2b2d',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: light ? '#d8e4dd' : '#36504a',
      padding: 16,
      gap: 10,
    },
    attendanceRow: {
      direction,
      backgroundColor: light ? '#fff' : '#1a2b2d',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: light ? '#d8e4dd' : '#36504a',
      padding: 12,
      gap: 6,
    },
    dangerButton: { borderColor: light ? '#b42332' : '#ffadb4' },
    dangerText: { color: light ? '#b42332' : '#ffadb4' },
    completedCard: {
      borderWidth: 1,
      borderColor: accent,
      backgroundColor: light ? '#ddf2e9' : '#174236',
    },
    assessmentCard: { borderLeftWidth: 3, borderLeftColor: light ? '#4774a8' : '#8fb7eb' },
    sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0008' },
    filterSheet: {
      direction,
      backgroundColor: light ? '#fff' : '#1a2b2d',
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      padding: 18,
      paddingBottom: 28,
      gap: 10,
    },
    historyRow: { gap: 8, borderTopWidth: 1, borderTopColor: muted, paddingTop: 14, marginTop: 8 },
    label: {
      textAlign,
      writingDirection: direction,
      direction,
      color: text,
      fontSize: 15,
      fontWeight: '600',
    },
    hint: {
      textAlign,
      writingDirection: direction,
      direction,
      color: muted,
      fontSize: 14,
      lineHeight: 21,
    },
    message: {
      textAlign,
      writingDirection: direction,
      direction,
      color: accent,
      fontSize: 15,
      lineHeight: 22,
    },
    link: {
      textAlign,
      writingDirection: direction,
      direction,
      color: accent,
      fontSize: 15,
      fontWeight: '600',
    },
    input: {
      textAlign,
      writingDirection: direction,
      direction,
      borderWidth: 1,
      borderColor: light ? '#859b93' : '#54736b',
      borderRadius: 12,
      minHeight: 50,
      paddingHorizontal: 12,
      color: text,
      fontSize: 16,
    },
    actions: { direction, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    button: {
      borderWidth: 1,
      borderColor: light ? '#6a8c80' : '#54736b',
      borderRadius: 12,
      minHeight: 48,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 14,
      flexShrink: 1,
    },
    buttonText: {
      textAlign: 'center',
      writingDirection: direction,
      direction,
      color: accent,
      fontSize: 15,
      fontWeight: '600',
    },
    setCheck: {
      alignSelf: 'flex-start',
      minHeight: 44,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: light ? '#6a8c80' : '#54736b',
      paddingHorizontal: 14,
      justifyContent: 'center',
    },
    setCheckDone: { backgroundColor: '#116c54', borderColor: '#116c54' },
    setCheckDoneText: { color: '#fff' },
    primary: { backgroundColor: '#116c54', borderColor: '#116c54' },
    primaryText: { color: '#fff' },
    disabled: { opacity: 0.5 },
  })
}
