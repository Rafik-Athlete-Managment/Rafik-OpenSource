import { Text, View } from 'react-native'
import { useLanguage } from './Language'
import { Button, type Styles } from './ui'

/** Shows the phone language switch and reports when the preference cannot be saved. */
export function LanguageControl({ styles }: { styles: Styles }) {
  const { language, setLanguage, preferenceError, l } = useLanguage()
  return (
    <View style={styles.toolbar}>
      <Button
        title="English"
        primary={language === 'en'}
        onPress={() => setLanguage('en')}
        styles={styles}
      />
      <Button
        title="العربية"
        primary={language === 'ar'}
        onPress={() => setLanguage('ar')}
        styles={styles}
      />
      {preferenceError ? (
        <Text accessibilityLiveRegion="polite" style={styles.hint}>
          {l(
            'Language works for this session, but the device preference could not be saved or restored. Tap your language to retry.',
            'تعمل اللغة لهذه الجلسة، لكن تعذر حفظ تفضيل الجهاز أو استعادته. اضغط لغتك لإعادة المحاولة.',
          )}
        </Text>
      ) : null}
    </View>
  )
}
