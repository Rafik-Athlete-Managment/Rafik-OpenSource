import { useLanguage } from './Language'
import type { Language } from './translations'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'

export type Styles = ReturnType<typeof makeStyles>
/** Small filter glyph drawn with native views so no new icon or native dependency is needed. */
export function FilterIcon({ styles }: { styles: Styles }) {
  return (
    <View accessible={false} style={{ width: 22, gap: 4 }}>
      {[5, 14, 9].map((offset) => (
        <View key={offset} style={{ height: 4, justifyContent: 'center' }}>
          <View style={styles.filterLine} />
          <View style={[styles.filterKnob, { left: offset }]} />
        </View>
      ))}
    </View>
  )
}
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
  const text = light ? '#24312d' : '#edf3ef'
  const muted = light ? '#52635b' : '#b7c4bd'
  const accent = light ? '#176249' : '#a4cfba'
  return StyleSheet.create({
    safe: { direction, flex: 1, backgroundColor: light ? '#f3f5f3' : '#151b1b' },
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
    appBar: { borderBottomWidth: 1, borderBottomColor: light ? '#dce4df' : '#394641' },
    topbar: {
      direction,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: light ? '#dce4df' : '#394641',
    },
    accountButton: {
      borderWidth: 1,
      borderColor: light ? '#bdcbc2' : '#58665e',
      borderRadius: 12,
      minHeight: 44,
      paddingHorizontal: 14,
      justifyContent: 'center',
    },
    eventHeader: {
      direction,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: light ? '#dce4df' : '#394641',
    },
    headerIcon: {
      minWidth: 44,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterLine: { height: 2, width: 20, borderRadius: 1, backgroundColor: accent },
    filterKnob: {
      position: 'absolute',
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: light ? '#f3f5f3' : '#151b1b',
      borderWidth: 1.5,
      borderColor: accent,
    },
    noticeToast: {
      marginHorizontal: 18,
      marginTop: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: light ? '#b8a27c' : '#8b775a',
      backgroundColor: light ? '#f4eee3' : '#302d27',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    compactNotice: {
      direction,
      minHeight: 48,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: light ? '#b8a27c' : '#8b775a',
      backgroundColor: light ? '#f4eee3' : '#302d27',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    athleteSwitcher: {
      marginHorizontal: 18,
      marginTop: 8,
      borderWidth: 1,
      borderColor: light ? '#dce4df' : '#42514a',
      borderRadius: 12,
      backgroundColor: light ? '#fff' : '#232b29',
      paddingHorizontal: 12,
    },
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
      backgroundColor: light ? '#fff' : '#232b29',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: light ? '#dce4df' : '#42514a',
      padding: 16,
      gap: 10,
    },
    attendanceRow: {
      direction,
      backgroundColor: light ? '#fff' : '#232b29',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: light ? '#dce4df' : '#42514a',
      padding: 12,
      gap: 6,
    },
    dangerButton: { borderColor: light ? '#b42332' : '#ffadb4' },
    dangerText: { color: light ? '#b42332' : '#ffadb4' },
    completedCard: {
      borderWidth: 1,
      borderColor: accent,
      backgroundColor: light ? '#e8f0ea' : '#293d34',
    },
    assessmentCard: { borderLeftWidth: 3, borderLeftColor: light ? '#4774a8' : '#8fb7eb' },
    sheetBackdrop: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 20,
      justifyContent: 'flex-end',
      backgroundColor: '#0009',
    },
    filterSheet: {
      direction,
      backgroundColor: light ? '#fff' : '#232b29',
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
