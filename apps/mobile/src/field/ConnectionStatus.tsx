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
  return (
    <View style={styles.connectionPill} accessible accessibilityLabel={label}>
      <Icon
        name={state === 'unknown' ? 'connection' : state}
        styles={styles}
        size={15}
        muted={state === 'unknown'}
      />
      {!compact ? <Text style={[styles.hint, { fontSize: 11 }]}>{label}</Text> : null}
    </View>
  )
}
