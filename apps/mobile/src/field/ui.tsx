import { useLanguage } from './Language'
import type { Language } from './translations'
import { Platform, Pressable, StyleSheet, Text } from 'react-native'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleCheck,
  ClipboardCheck,
  Cloud,
  Dumbbell,
  Download,
  Ellipsis,
  Languages,
  LogOut,
  RefreshCw,
  Settings,
  SlidersHorizontal,
  UserRound,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react-native'

export type Styles = ReturnType<typeof makeStyles>
const icons = {
  back: ArrowLeft,
  check: Check,
  close: X,
  collapse: ChevronUp,
  completion: CircleCheck,
  down: ChevronDown,
  assessment: ClipboardCheck,
  account: UserRound,
  connection: Cloud,
  event: CalendarDays,
  saved: Download,
  filter: SlidersHorizontal,
  forward: ChevronRight,
  more: Ellipsis,
  language: Languages,
  logout: LogOut,
  online: Wifi,
  offline: WifiOff,
  refresh: RefreshCw,
  settings: Settings,
  workout: Dumbbell,
} as const

/** One icon family and stroke scale across field screens; the parent labels icon-only actions. */
export function Icon({
  name,
  styles,
  size = 20,
  muted = false,
  inverse = false,
  rtl = false,
}: {
  name: keyof typeof icons
  styles: Styles
  size?: number
  muted?: boolean
  inverse?: boolean
  rtl?: boolean
}) {
  const Component =
    rtl && name === 'back' ? ArrowRight : rtl && name === 'forward' ? ChevronLeft : icons[name]
  return (
    <Component
      size={size}
      strokeWidth={2}
      color={inverse ? '#fff' : muted ? styles.hint.color : styles.link.color}
      accessible={false}
    />
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
  fill = false,
}: {
  title: string
  onPress: () => void
  disabled?: boolean
  styles: Styles
  primary?: boolean
  danger?: boolean
  fill?: boolean
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
        fill && styles.buttonFill,
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
  const text = light ? '#24312d' : '#f5f5f5'
  const muted = light ? '#52635b' : '#b5b5bd'
  const accent = light ? '#176249' : '#a4cfba'
  const dark = {
    background: '#080809',
    surface: '#171719',
    raised: '#212124',
    input: '#29292d',
    border: '#303034',
  }
  return StyleSheet.create({
    safe: { direction, flex: 1, backgroundColor: light ? '#f3f5f3' : dark.background },
    bottomNav: {
      position: 'absolute',
      bottom: 12,
      left: 18,
      right: 18,
      zIndex: 10,
      flexDirection: 'row',
      borderRadius: 28,
      borderWidth: 1,
      borderColor: light ? '#dce4df' : dark.border,
      backgroundColor: light ? '#fff' : dark.raised,
      padding: 5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: light ? 0.12 : 0.3,
      shadowRadius: 14,
      elevation: 8,
    },
    bottomNavItem: {
      flex: 1,
      minHeight: 52,
      borderRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    bottomNavActive: { backgroundColor: light ? '#e4eee8' : '#27372f' },
    bottomNavText: { color: muted, fontSize: 11, fontWeight: '600' },
    bottomNavTextActive: { color: accent },
    filterChip: {
      minHeight: 44,
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: light ? '#dce4df' : dark.border,
      borderRadius: 22,
      paddingHorizontal: 14,
      backgroundColor: light ? '#fff' : dark.surface,
    },
    filterChipActive: { borderColor: accent, backgroundColor: light ? '#e4eee8' : '#27372f' },
    settingsGroup: {
      backgroundColor: light ? '#fff' : dark.surface,
      borderWidth: 1,
      borderColor: light ? '#dce4df' : dark.border,
      borderRadius: 16,
      paddingHorizontal: 14,
    },
    settingsRow: {
      minHeight: 54,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: light ? '#dce4df' : dark.border,
    },
    connectionPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: 12,
      backgroundColor: light ? '#e4eee8' : dark.surface,
      paddingHorizontal: 8,
      minHeight: 28,
    },
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
    appBar: { borderBottomWidth: 1, borderBottomColor: light ? '#dce4df' : dark.border },
    topbar: {
      direction,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: light ? '#dce4df' : dark.border,
    },
    accountButton: {
      borderWidth: 1,
      borderColor: light ? '#bdcbc2' : dark.border,
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
      borderBottomColor: light ? '#dce4df' : dark.border,
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
      borderColor: light ? '#b8a27c' : '#8b775a',
      backgroundColor: light ? '#f4eee3' : dark.raised,
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
      backgroundColor: light ? '#f4eee3' : dark.raised,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    athleteSwitcher: {
      marginHorizontal: 18,
      marginTop: 8,
      borderWidth: 1,
      borderColor: light ? '#dce4df' : dark.border,
      borderRadius: 12,
      backgroundColor: light ? '#fff' : dark.surface,
      paddingHorizontal: 12,
    },
    content: {
      direction,
      flexGrow: 1,
      width: '100%',
      maxWidth: 800,
      alignSelf: 'center',
      padding: 16,
      gap: 12,
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
      backgroundColor: light ? '#fff' : dark.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: light ? '#dce4df' : dark.border,
      padding: 14,
      gap: 8,
    },
    attendanceRow: {
      direction,
      backgroundColor: light ? '#fff' : dark.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: light ? '#dce4df' : dark.border,
      padding: 12,
      gap: 6,
    },
    dangerButton: { borderColor: light ? '#b42332' : '#ffadb4' },
    dangerText: { color: light ? '#b42332' : '#ffadb4' },
    completedCard: {
      borderWidth: 1,
      borderColor: accent,
      backgroundColor: light ? '#e8f0ea' : '#1b2821',
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
      backgroundColor: light ? '#fff' : dark.raised,
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
      borderColor: light ? '#859b93' : '#55555b',
      borderRadius: 12,
      minHeight: 48,
      paddingHorizontal: 12,
      backgroundColor: light ? '#fff' : dark.input,
      color: text,
      fontSize: 16,
    },
    actions: { direction, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    button: {
      borderWidth: 1,
      borderColor: light ? '#6a8c80' : '#55555b',
      borderRadius: 12,
      minHeight: 48,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 14,
      flexShrink: 1,
    },
    buttonFill: { width: '100%' },
    actionRow: { direction, flexDirection: 'row', gap: 8, alignItems: 'stretch' },
    actionCell: { flex: 1, minWidth: 0 },
    calendarSurface: {
      borderWidth: 1,
      borderColor: light ? '#dce4df' : dark.border,
      borderRadius: 16,
      backgroundColor: light ? '#fff' : dark.surface,
      padding: 8,
    },
    calendarYearAction: {
      flex: 1,
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
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
      borderColor: light ? '#6a8c80' : '#55555b',
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
