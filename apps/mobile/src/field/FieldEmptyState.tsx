import { Text, View } from 'react-native'
import { Button, Icon, type Styles } from './ui'

/** Gives empty field lists a consistent explanation and one useful next step. */
export function FieldEmptyState({
  icon,
  title,
  description,
  action,
  onAction,
  styles,
}: {
  icon: 'event' | 'workout' | 'saved'
  title: string
  description: string
  action?: string
  onAction?: () => void
  styles: Styles
}) {
  return (
    <View style={[styles.card, { alignItems: 'center', paddingVertical: 28, gap: 9 }]}>
      <Icon name={icon} styles={styles} size={28} muted />
      <Text style={[styles.cardTitle, { textAlign: 'center' }]}>{title}</Text>
      <Text style={[styles.hint, { textAlign: 'center' }]}>{description}</Text>
      {action && onAction ? <Button title={action} onPress={onAction} styles={styles} /> : null}
    </View>
  )
}
