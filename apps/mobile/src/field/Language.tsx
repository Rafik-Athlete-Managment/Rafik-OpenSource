import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import * as SecureStore from 'expo-secure-store'
import { translate, type Language } from './translations'

type Locale = {
  language: Language
  setLanguage: (value: Language) => void
  preferenceError: boolean
}
const Context = createContext<Locale | null>(null)
const preference = 'rafik.field.language.v1'
/** Shares the saved English or Arabic choice with all phone screens. */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, update] = useState<Language>(() =>
    Intl.DateTimeFormat().resolvedOptions().locale.startsWith('ar') ? 'ar' : 'en',
  )
  const [preferenceError, setPreferenceError] = useState(false)
  const mounted = useRef(true)
  const changed = useRef(false)
  const sequence = useRef(0)
  const flight = useRef(Promise.resolve())
  useEffect(() => {
    let alive = true
    mounted.current = true
    void SecureStore.getItemAsync(preference)
      .then((value) => {
        if (alive && !changed.current && (value === 'ar' || value === 'en')) update(value)
      })
      .catch(() => {
        if (alive && !changed.current) setPreferenceError(true)
      })
    return () => {
      alive = false
      mounted.current = false
    }
  }, [])
  function setLanguage(value: Language) {
    changed.current = true
    update(value)
    const version = ++sequence.current
    flight.current = flight.current
      .catch(() => undefined)
      .then(() => SecureStore.setItemAsync(preference, value))
    void flight.current
      .then(() => {
        if (mounted.current && version === sequence.current) setPreferenceError(false)
      })
      .catch(() => {
        if (mounted.current && version === sequence.current) setPreferenceError(true)
      })
  }
  return (
    <Context.Provider value={{ language, setLanguage, preferenceError }}>
      {children}
    </Context.Provider>
  )
}
/** Gives a screen the current language and helpers for translated labels. */
export function useLanguage() {
  const locale = useContext(Context)
  if (!locale) throw Error('LanguageProvider is required')
  return {
    ...locale,
    t: (text: string) => translate(locale.language, text),
    l: (en: string, ar: string) => (locale.language === 'ar' ? ar : en),
  }
}
