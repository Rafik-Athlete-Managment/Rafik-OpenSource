import { useLanguage } from './Language'
import type { Language } from './translations'
import { Platform, Pressable, StyleSheet, Text } from 'react-native'

export type Styles = ReturnType<typeof makeStyles>
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

export const displayDate = (date: string, language: Language = 'en') =>
  new Date(date).toLocaleString(language === 'ar' ? 'ar' : 'en')
export const localDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

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
    safe: { direction, flex: 1, backgroundColor: light ? '#f2f7f4' : '#101b1d' },
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
    content: {
      direction,
      flexGrow: 1,
      width: '100%',
      maxWidth: 800,
      alignSelf: 'center',
      padding: 18,
      gap: 16,
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
      backgroundColor: light ? '#fff' : '#1a292b',
      borderRadius: 16,
      padding: 18,
      gap: 10,
    },
    dangerButton: { borderColor: light ? '#b42332' : '#ffadb4' },
    dangerText: { color: light ? '#b42332' : '#ffadb4' },
    completedCard: {
      borderWidth: 2,
      borderColor: accent,
      backgroundColor: light ? '#e4f4ed' : '#193c34',
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
    primary: { backgroundColor: '#116c54', borderColor: '#116c54' },
    primaryText: { color: '#fff' },
    disabled: { opacity: 0.5 },
  })
}
