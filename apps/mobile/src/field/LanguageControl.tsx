import { Text, View } from 'react-native'
import { useLanguage } from './Language'
import { Segmented, type Styles } from './ui'

/** Shows the phone language switch and reports when the preference cannot be saved. */
export function LanguageControl({ styles }: { styles: Styles }) {
  const { language, setLanguage, preferenceError, l } = useLanguage()
  return (
    <View style={[styles.topbar, { flexWrap: 'wrap' }]}>
      <Text style={styles.brand}>
        {l('Rafik', 'رفيق')}
        <Text style={styles.brandDot}>.</Text>
      </Text>
      <View style={{ width: 180 }}>
        <Segmented
          label={l('Language', 'اللغة')}
          reselect
          value={language}
          onChange={setLanguage}
          options={[
            { value: 'en', label: 'English' },
            { value: 'ar', label: 'العربية' },
          ]}
          styles={styles}
        />
      </View>
      {preferenceError ? (
        <Text accessibilityLiveRegion="polite" style={[styles.hint, { width: '100%' }]}>
          {l(
            'Language works for this session, but the device preference could not be saved or restored. Tap your language to retry.',
            'تعمل اللغة لهذه الجلسة، لكن تعذر حفظ تفضيل الجهاز أو استعادته. اضغط لغتك لإعادة المحاولة.',
          )}
        </Text>
      ) : null}
    </View>
  )
}
