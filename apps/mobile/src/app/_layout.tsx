import { LanguageProvider } from '../field/Language'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'

/** Wraps every phone screen in the shared language provider and app navigation stack. */
export default function RootLayout() {
  return (
    <LanguageProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </LanguageProvider>
  )
}
