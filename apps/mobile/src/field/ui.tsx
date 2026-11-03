import { useLanguage } from './Language'
import type { Language } from './translations'
import { useState, type ReactNode } from 'react'
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  ClipboardCheck,
  Clock,
  Cloud,
  Dumbbell,
  Download,
  Ellipsis,
  History,
  Languages,
  LogOut,
  MapPin,
  RefreshCw,
  Search,
  Settings,
  SlidersHorizontal,
  UserRound,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react-native'

const icons = {
  alert: CircleAlert,
  back: ArrowLeft,
  check: Check,
  close: X,
  collapse: ChevronUp,
  completion: CircleCheck,
  down: ChevronDown,
  assessment: ClipboardCheck,
  account: UserRound,
  athletes: Users,
  connection: Cloud,
  event: CalendarDays,
  history: History,
  location: MapPin,
  saved: Download,
  search: Search,
  filter: SlidersHorizontal,
  forward: ChevronRight,
  previous: ChevronLeft,
  more: Ellipsis,
  language: Languages,
  logout: LogOut,
  online: Wifi,
  offline: WifiOff,
  refresh: RefreshCw,
  settings: Settings,
  time: Clock,
  workout: Dumbbell,
} as const
export type IconName = keyof typeof icons
export type Tone = 'neutral' | 'accent' | 'success' | 'info' | 'warning' | 'danger'

/**
 * Field palette, shared with the web dashboard's token model: a warm ivory or deep green page,
 * cards one step brighter with a quiet border and a small shadow, and fields with their own
 * fill plus a stronger border so they read as interactive inside cards. Status colors carry
 * meaning only alongside a visible text label.
 */
export function palette(light: boolean) {
  return light
    ? {
        page: '#f8f8f3',
        card: '#fdfdfb',
        raised: '#ffffff',
        soft: '#eef0ea',
        field: '#ffffff',
        ink: '#121b15',
        muted: '#5b635d',
        border: '#dadbd5',
        control: '#aeb2ac',
        accent: '#285943',
        accentInk: '#285943',
        onAccent: '#ffffff',
        tint: '#e3e9e1',
        ring: '#28594359',
        shadow: '#121b15',
        scrim: '#121b1566',
        tones: {
          neutral: { ink: '#4a524c', bg: '#eef0ea', border: '#dadbd5' },
          accent: { ink: '#285943', bg: '#e3e9e1', border: '#c4d3c6' },
          success: { ink: '#176340', bg: '#e4f5e9', border: '#bfe3cb' },
          info: { ink: '#245a7a', bg: '#edf5fa', border: '#c9dfec' },
          warning: { ink: '#795208', bg: '#fff6df', border: '#efd9a3' },
          danger: { ink: '#b42332', bg: '#fdeeee', border: '#f2c4c8' },
        },
      }
    : {
        page: '#171e1a',
        card: '#222925',
        raised: '#2a312c',
        soft: '#2d3430',
        field: '#1b221e',
        ink: '#e9eee7',
        muted: '#a6aca5',
        border: '#343b37',
        control: '#4d5450',
        accent: '#a4cfba',
        accentInk: '#a4cfba',
        onAccent: '#17211b',
        tint: '#2a3b32',
        ring: '#a4cfba59',
        shadow: '#000000',
        scrim: '#000000a6',
        tones: {
          neutral: { ink: '#c3c9c2', bg: '#2d3430', border: '#3c443f' },
          accent: { ink: '#a4cfba', bg: '#2a3b32', border: '#3d5546' },
          success: { ink: '#a4e6bd', bg: '#183e2a', border: '#285a3e' },
          info: { ink: '#a5d4ed', bg: '#21313a', border: '#334a58' },
          warning: { ink: '#f0cb7a', bg: '#342d1b', border: '#57492a' },
          danger: { ink: '#ffadb4', bg: '#3e2825', border: '#62393a' },
        },
      }
}
export type Palette = ReturnType<typeof palette>
export type Styles = ReturnType<typeof makeStyles>

/** One icon family and stroke scale across field screens; the parent labels icon-only actions. */
export function Icon({
  name,
  styles,
  size = 20,
  muted = false,
  inverse = false,
  rtl = false,
  color,
}: {
  name: IconName
  styles: Styles
  size?: number
  muted?: boolean
  inverse?: boolean
  rtl?: boolean
  color?: string
}) {
  const Component =
    rtl && name === 'back'
      ? ArrowRight
      : rtl && name === 'forward'
        ? ChevronLeft
        : rtl && name === 'previous'
          ? ChevronRight
          : icons[name]
  return (
    <Component
      size={size}
      strokeWidth={2}
      color={
        color ||
        (inverse ? styles.primaryText.color : muted ? styles.hint.color : styles.link.color)
      }
      accessible={false}
    />
  )
}

/**
 * Shared phone button. Primary fills with the accent; outline sits on the field fill; secondary
 * is a quiet soft fill; ghost has no chrome; danger keeps a red outline. Pressed states darken
 * the surface instead of fading, so a selected or pressed control never looks disabled.
 */
export function Button({
  title,
  onPress,
  disabled = false,
  styles,
  primary = false,
  danger = false,
  secondary = false,
  ghost = false,
  fill = false,
  small = false,
  icon,
  accessibilityLabel,
}: {
  title: string
  onPress: () => void
  disabled?: boolean
  styles: Styles
  primary?: boolean
  danger?: boolean
  secondary?: boolean
  ghost?: boolean
  fill?: boolean
  small?: boolean
  icon?: IconName
  accessibilityLabel?: string
}) {
  const { t, language } = useLanguage()
  const textStyle = [
    styles.buttonText,
    primary && styles.primaryText,
    danger && styles.dangerText,
    small && styles.buttonTextSmall,
  ]
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        fill && styles.buttonFill,
        secondary && styles.secondaryButton,
        ghost && styles.ghostButton,
        primary && styles.primary,
        danger && styles.dangerButton,
        pressed && !disabled && (primary ? styles.primaryPressed : styles.buttonPressed),
        disabled && styles.disabled,
      ]}
    >
      {icon ? (
        <Icon
          name={icon}
          styles={styles}
          size={small ? 16 : 18}
          rtl={language === 'ar'}
          color={
            primary
              ? styles.primaryText.color
              : danger
                ? styles.dangerText.color
                : styles.buttonText.color
          }
        />
      ) : null}
      <Text style={textStyle}>{t(title)}</Text>
    </Pressable>
  )
}

/** Square icon-only action with a 44px touch target; the label is announced, not shown. */
export function IconButton({
  name,
  label,
  onPress,
  styles,
  disabled = false,
  expanded,
  rtl = false,
  tone,
}: {
  name: IconName
  label: string
  onPress: () => void
  styles: Styles
  disabled?: boolean
  expanded?: boolean
  rtl?: boolean
  tone?: string
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, expanded }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.headerIcon,
        pressed && !disabled && styles.iconPressed,
        disabled && styles.disabled,
      ]}
    >
      <Icon name={name} styles={styles} rtl={rtl} color={tone} />
    </Pressable>
  )
}

/** Small rounded status label. Color supports the text; it never replaces it. */
export function StatusPill({
  label,
  tone = 'neutral',
  icon,
  styles,
  style,
}: {
  label: string
  tone?: Tone
  icon?: IconName
  styles: Styles
  style?: StyleProp<ViewStyle>
}) {
  const colors = styles.colors.tones[tone]
  return (
    <View
      style={[styles.pill, { backgroundColor: colors.bg, borderColor: colors.border }, style]}
      accessible
      accessibilityLabel={label}
    >
      {icon ? <Icon name={icon} styles={styles} size={13} color={colors.ink} /> : null}
      <Text style={[styles.pillText, { color: colors.ink }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  )
}

/**
 * Segmented single choice on a soft track with a raised selected segment, for mutually
 * exclusive values such as attendance marks, list filters and sort order. Each option can
 * carry its own selected tone so, for example, Absent reads differently from Present.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  styles,
  disabled = false,
  label,
  wrap = false,
  reselect = false,
}: {
  options: { value: T; label: string; tone?: Tone; disabled?: boolean }[]
  value: T | null
  onChange: (value: T) => void
  styles: Styles
  disabled?: boolean
  label?: string
  wrap?: boolean
  /** Lets the current value be pressed again, for example to retry saving a preference. */
  reselect?: boolean
}) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={[styles.segmented, wrap && styles.segmentedWrap]}
    >
      {options.map((option) => {
        const selected = option.value === value
        const tone = styles.colors.tones[option.tone || 'accent']
        const off = disabled || option.disabled
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected, checked: selected, disabled: off }}
            disabled={off || (selected && !reselect)}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segment,
              wrap && styles.segmentWrap,
              selected && styles.segmentSelected,
              selected && option.tone && { backgroundColor: tone.bg, borderColor: tone.border },
              pressed && !selected && styles.segmentPressed,
              off && !selected && styles.disabled,
            ]}
          >
            {selected && option.tone ? (
              <Icon name="check" styles={styles} size={14} color={tone.ink} />
            ) : null}
            <Text
              numberOfLines={1}
              style={[
                styles.segmentText,
                selected && styles.segmentTextSelected,
                selected && option.tone && { color: tone.ink },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

/** Inline status message with a tone, an icon and an optional trailing action. */
export function Notice({
  text,
  tone = 'warning',
  styles,
  onPress,
  actionIcon,
  actionLabel,
  lines,
  live = false,
}: {
  text: string
  tone?: Tone
  styles: Styles
  onPress?: () => void
  actionIcon?: IconName
  actionLabel?: string
  lines?: number
  live?: boolean
}) {
  const colors = styles.colors.tones[tone]
  const body = (
    <>
      <Icon
        name={tone === 'success' ? 'completion' : 'alert'}
        styles={styles}
        size={18}
        color={colors.ink}
      />
      <Text
        accessibilityLiveRegion={live ? 'polite' : undefined}
        numberOfLines={lines}
        style={[styles.noticeText, { color: tone === 'neutral' ? styles.hint.color : colors.ink }]}
      >
        {text}
      </Text>
      {actionIcon ? <Icon name={actionIcon} styles={styles} size={18} color={colors.ink} /> : null}
    </>
  )
  const frame = [styles.notice, { backgroundColor: colors.bg, borderColor: colors.border }]
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={actionLabel}
      onPress={onPress}
      style={frame}
    >
      {body}
    </Pressable>
  ) : (
    <View style={frame}>{body}</View>
  )
}

/** Text input with a visible focus ring and an optional leading icon. */
export function Field({
  styles,
  icon,
  style,
  invalid = false,
  ...props
}: TextInputProps & {
  styles: Styles
  icon?: IconName
  invalid?: boolean
}) {
  const [focused, setFocused] = useState(false)
  const input = (
    <TextInput
      placeholderTextColor={styles.hint.color}
      {...props}
      onFocus={(event) => {
        setFocused(true)
        props.onFocus?.(event)
      }}
      onBlur={(event) => {
        setFocused(false)
        props.onBlur?.(event)
      }}
      style={[
        styles.input,
        icon && styles.inputWithIcon,
        focused && styles.inputFocused,
        invalid && styles.inputInvalid,
        props.editable === false && styles.inputReadOnly,
        style,
      ]}
    />
  )
  if (!icon) return input
  return (
    <View style={styles.inputWrap}>
      <View style={styles.inputIcon} pointerEvents="none">
        <Icon name={icon} styles={styles} size={18} muted />
      </View>
      {input}
    </View>
  )
}

/** Muted section heading used above grouped content. */
export function SectionLabel({
  children,
  styles,
  trailing,
}: {
  children: ReactNode
  styles: Styles
  trailing?: ReactNode
}) {
  return (
    <View style={styles.sectionRow}>
      <Text accessibilityRole="header" style={[styles.sectionLabel, { flex: 1 }]}>
        {children}
      </Text>
      {trailing}
    </View>
  )
}

/** Thin progress bar; the parent states the counts in text. */
export function Progress({
  value,
  total,
  styles,
}: {
  value: number
  total: number
  styles: Styles
}) {
  const ratio = total > 0 ? Math.min(1, value / total) : 0
  return (
    <View style={styles.progressTrack} accessible={false}>
      <View style={[styles.progressBar, { width: `${Math.round(ratio * 100)}%` }]} />
    </View>
  )
}

/** Pinned action area above the safe area for the screen's one primary next step. */
export function ActionBar({
  children,
  styles,
  style,
}: {
  children: ReactNode
  styles: Styles
  style?: StyleProp<ViewStyle>
}) {
  return <View style={[styles.actionBar, style]}>{children}</View>
}

/** Formats a timestamp for display in the selected phone language, without seconds. */
export const displayDate = (date: string, language: Language = 'en') =>
  new Date(date).toLocaleString(language === 'ar' ? 'ar' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
/** Formats only the local clock time of a timestamp. */
export const displayTime = (date: string, language: Language = 'en') =>
  new Date(date).toLocaleTimeString(language === 'ar' ? 'ar' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })
/** Formats a device-local calendar day as YYYY-MM-DD. */
export const localDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
/** Moves a YYYY-MM-DD day by whole days without passing through UTC. */
export const shiftDay = (day: string, delta: number) => {
  const [y, m, d] = day.split('-').map(Number)
  return localDate(new Date(y, m - 1, d + delta))
}

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
  const c = palette(light)
  const text = { textAlign, writingDirection: direction, direction }
  // Cards: shadow-sm with a quiet border; sheets and the floating bar sit higher.
  const lift = {
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: light ? 0.06 : 0.25,
    shadowRadius: 3,
    elevation: 1,
  }
  const float = {
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: light ? 0.12 : 0.4,
    shadowRadius: 20,
    elevation: 10,
  }
  const styles = StyleSheet.create({
    safe: { direction, flex: 1, backgroundColor: c.page },
    bottomNav: {
      position: 'absolute',
      bottom: 12,
      left: 16,
      right: 16,
      zIndex: 10,
      flexDirection: 'row',
      borderRadius: 24,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.raised,
      padding: 5,
      gap: 4,
      ...float,
    },
    bottomNavItem: {
      flex: 1,
      minHeight: 52,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
    },
    bottomNavActive: { backgroundColor: c.tint },
    bottomNavText: { color: c.muted, fontSize: 12, fontWeight: '600' },
    bottomNavTextActive: { color: c.accentInk },
    filterChip: {
      minHeight: 40,
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 20,
      paddingHorizontal: 14,
      backgroundColor: c.card,
    },
    filterChipActive: { borderColor: c.accent, backgroundColor: c.tint },
    settingsGroup: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      ...lift,
    },
    settingsRow: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    connectionPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card,
      paddingHorizontal: 9,
      minHeight: 30,
    },
    toolbar: {
      direction,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    heading: { flexGrow: 1, flexShrink: 1 },
    appBar: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    topbar: {
      direction,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 8,
      minHeight: 60,
    },
    brand: {
      color: c.ink,
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: language === 'ar' ? 0 : -0.3,
    },
    brandDot: { color: c.accentInk },
    accountButton: {
      borderWidth: 1,
      borderColor: c.control,
      borderRadius: 12,
      minHeight: 44,
      paddingHorizontal: 14,
      justifyContent: 'center',
    },
    eventHeader: {
      direction,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 6,
      minHeight: 60,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      backgroundColor: c.page,
    },
    headerTitle: { ...text, color: c.ink, fontSize: 17, fontWeight: '700' },
    headerSubtitle: { ...text, color: c.muted, fontSize: 13, marginTop: 1 },
    headerIcon: {
      minWidth: 44,
      minHeight: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconPressed: { backgroundColor: c.soft },
    noticeToast: {
      marginHorizontal: 16,
      marginTop: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.tones.warning.border,
      backgroundColor: c.tones.warning.bg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    compactNotice: {
      direction,
      minHeight: 48,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.tones.warning.border,
      backgroundColor: c.tones.warning.bg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    notice: {
      direction,
      minHeight: 48,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    noticeText: { ...text, flex: 1, fontSize: 14, lineHeight: 20 },
    athleteSwitcher: {
      marginHorizontal: 16,
      marginTop: 10,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 14,
      backgroundColor: c.card,
      paddingHorizontal: 12,
      ...lift,
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
      ...text,
      color: c.accentInk,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: language === 'ar' ? 0 : 1.6,
    },
    title: {
      ...text,
      color: c.ink,
      fontSize: 26,
      fontWeight: '800',
      letterSpacing: language === 'ar' ? 0 : -0.4,
      flexShrink: 1,
    },
    cardTitle: { ...text, color: c.ink, fontSize: 17, fontWeight: '700' },
    rowTitle: { ...text, color: c.ink, fontSize: 16, fontWeight: '600' },
    sectionRow: { direction, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
    sectionLabel: { ...text, color: c.muted, fontSize: 13, fontWeight: '700' },
    card: {
      direction,
      backgroundColor: c.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      padding: 16,
      gap: 8,
      ...lift,
    },
    cardPressed: { backgroundColor: c.soft },
    cardRow: { direction, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    // Inset blocks inside a card: one step quieter than the card itself.
    inset: {
      direction,
      backgroundColor: c.soft,
      borderRadius: 12,
      padding: 12,
      gap: 6,
    },
    timeColumn: {
      width: language === 'ar' ? 72 : 58,
      alignItems: 'flex-start',
      gap: 2,
      paddingTop: 2,
    },
    timeText: { ...text, color: c.ink, fontSize: 16, fontWeight: '700' },
    timeSub: { ...text, color: c.muted, fontSize: 12 },
    kindBadge: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.tint,
    },
    metaRow: { direction, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
    metaItem: { direction, flexDirection: 'row', alignItems: 'center', gap: 4 },
    meta: { ...text, color: c.muted, fontSize: 13 },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      alignSelf: 'flex-start',
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 9,
      paddingVertical: 3,
    },
    pillText: { fontSize: 12, fontWeight: '600', writingDirection: direction },
    attendanceRow: {
      direction,
      backgroundColor: c.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      padding: 12,
      gap: 10,
      ...lift,
    },
    rowHeader: { direction, flexDirection: 'row', alignItems: 'center', gap: 10 },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.soft,
    },
    avatarText: { color: c.ink, fontSize: 14, fontWeight: '700' },
    dangerButton: { borderColor: c.tones.danger.border, backgroundColor: c.tones.danger.bg },
    dangerText: { color: c.tones.danger.ink },
    completedCard: {
      borderColor: c.tones.success.border,
      backgroundColor: c.tones.success.bg,
    },
    assessmentCard: {},
    sheetBackdrop: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 20,
      justifyContent: 'flex-end',
      backgroundColor: c.scrim,
    },
    filterSheet: {
      direction,
      backgroundColor: c.raised,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      padding: 18,
      paddingTop: 10,
      paddingBottom: 28,
      gap: 12,
    },
    sheetHandle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.control,
      marginBottom: 4,
    },
    historyRow: {
      gap: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      paddingTop: 12,
      marginTop: 6,
    },
    label: { ...text, color: c.ink, fontSize: 15, fontWeight: '600' },
    hint: { ...text, color: c.muted, fontSize: 14, lineHeight: 20 },
    message: { ...text, color: c.tones.danger.ink, fontSize: 14, lineHeight: 20 },
    link: { ...text, color: c.accentInk, fontSize: 15, fontWeight: '600' },
    input: {
      ...text,
      borderWidth: 1,
      borderColor: c.control,
      borderRadius: 12,
      minHeight: 48,
      paddingHorizontal: 14,
      backgroundColor: c.field,
      color: c.ink,
      fontSize: 16,
    },
    inputWrap: { position: 'relative', justifyContent: 'center' },
    inputIcon: {
      position: 'absolute',
      start: 14,
      zIndex: 1,
      height: '100%',
      justifyContent: 'center',
    },
    inputWithIcon: { paddingStart: 42 },
    inputFocused: { borderColor: c.accent, borderWidth: 2, paddingHorizontal: 13 },
    inputInvalid: { borderColor: c.tones.danger.ink },
    inputReadOnly: { backgroundColor: c.soft, color: c.muted },
    actions: { direction, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    button: {
      flexDirection: 'row',
      gap: 8,
      borderWidth: 1,
      borderColor: c.control,
      backgroundColor: c.field,
      borderRadius: 12,
      minHeight: 48,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 16,
      flexShrink: 1,
    },
    buttonSmall: { minHeight: 40, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10 },
    buttonPressed: { backgroundColor: c.soft },
    secondaryButton: { backgroundColor: c.soft, borderColor: c.soft },
    ghostButton: { backgroundColor: 'transparent', borderColor: 'transparent' },
    buttonFill: { width: '100%' },
    actionRow: { direction, flexDirection: 'row', gap: 8, alignItems: 'stretch' },
    actionCell: { flex: 1, minWidth: 0 },
    actionBar: {
      direction,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 14,
      gap: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      backgroundColor: c.page,
    },
    calendarSurface: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 16,
      backgroundColor: c.card,
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
      color: c.ink,
      fontSize: 15,
      fontWeight: '600',
    },
    buttonTextSmall: { fontSize: 14 },
    segmented: {
      direction,
      flexDirection: 'row',
      backgroundColor: c.soft,
      borderRadius: 12,
      padding: 3,
      gap: 3,
    },
    segmentedWrap: { flexWrap: 'wrap' },
    segment: {
      flex: 1,
      minHeight: 42,
      flexDirection: 'row',
      gap: 5,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 9,
      borderWidth: 1,
      borderColor: 'transparent',
      paddingHorizontal: 8,
    },
    segmentWrap: { flexGrow: 1, flexBasis: 'auto' },
    segmentSelected: {
      backgroundColor: c.raised,
      borderColor: c.border,
      ...lift,
    },
    segmentPressed: { backgroundColor: c.border },
    segmentText: { color: c.muted, fontSize: 14, fontWeight: '600', writingDirection: direction },
    segmentTextSelected: { color: c.ink },
    progressTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: c.soft,
      overflow: 'hidden',
    },
    progressBar: { height: 6, borderRadius: 3, backgroundColor: c.accent },
    setRow: {
      direction,
      gap: 10,
      paddingVertical: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    setCheck: {
      alignSelf: 'flex-start',
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.control,
      backgroundColor: c.field,
      paddingHorizontal: 14,
      justifyContent: 'center',
    },
    setCheckDone: {
      backgroundColor: c.tones.success.bg,
      borderColor: c.tones.success.border,
    },
    setCheckDoneText: { color: c.tones.success.ink },
    primary: { backgroundColor: c.accent, borderColor: c.accent },
    primaryPressed: { opacity: 0.88 },
    primaryText: { color: c.onAccent },
    disabled: { opacity: 0.45 },
  })
  return Object.assign(styles, { colors: c })
}
