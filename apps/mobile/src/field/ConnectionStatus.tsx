import { Text, View } from 'react-native'
import { useLanguage } from './Language'
import { Icon, type Styles } from './ui'

/** Shows the last observed connection state without claiming a live network probe. */
export function ConnectionStatus({
  state,
  styles,
  compact = false,
}: {
  state: 'unknown' | 'online' | 'offline'
  styles: Styles
  compact?: boolean
}) {
  const { l } = useLanguage()
  const label =
    state === 'offline'
      ? l('Offline', 'دون اتصال')
      : state === 'online'
        ? l('Online', 'متصل')
        : l('Checking', 'جارٍ التحقق')
  const tone =
    styles.colors.tones[
      state === 'offline' ? 'warning' : state === 'online' ? 'success' : 'neutral'
    ]
  return (
    <View
      style={[styles.connectionPill, { backgroundColor: tone.bg, borderColor: tone.border }]}
      accessible
      accessibilityLabel={label}
    >
      <Icon
        name={state === 'unknown' ? 'connection' : state}
        styles={styles}
        size={15}
        color={tone.ink}
      />
      {!compact ? <Text style={[styles.pillText, { color: tone.ink }]}>{label}</Text> : null}
    </View>
  )
}
