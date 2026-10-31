import { LanguageControl } from './LanguageControl'
import { useLanguage } from './Language'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  AppState,
  ScrollView,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { NativeClient, privateStore, type CoachContext } from './native'
import { ConnectionFailure, failureText } from './model'
import { selectedInstitution } from './access'
import type { FieldStore } from './store'
import { Button, makeStyles, type Styles } from './ui'
import { InstitutionScreen } from './InstitutionScreen'

type Runtime = { client: NativeClient; store: FieldStore }
export default function Home() {
  const { t, language } = useLanguage()
  const styles = makeStyles(useColorScheme() === 'light', language)
  const [runtime, setRuntime] = useState<Runtime | null>(null)
  const [restoring, setRestoring] = useState(true)
  const [busy, setBusy] = useState(false)
  const [base, setBase] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const alive = useRef(true)
  const signingIn = useRef(false)
  useEffect(() => {
    alive.current = true
    let cancelled = false
    void (async () => {
      try {
        const client = await NativeClient.restore()
        if (client && !cancelled) {
          const store = await privateStore()
          if (!cancelled) {
            setBase(client.instance)
            setRuntime({ client, store })
          }
        }
      } catch (error) {
        if (!cancelled) setMessage(failureText(error))
      } finally {
        if (!cancelled) setRestoring(false)
      }
    })()
    return () => {
      cancelled = true
      alive.current = false
    }
  }, [])

  async function login() {
    if (signingIn.current) return
    signingIn.current = true
    setBusy(true)
    setMessage('')
    try {
      const store = await privateStore()
      const client = await NativeClient.login(base, email.trim(), password)
      if (alive.current) {
        setRuntime({ client, store })
        setPassword('')
        setBase(client.instance)
      }
    } catch (error) {
      if (alive.current) setMessage(failureText(error))
    } finally {
      signingIn.current = false
      if (alive.current) setBusy(false)
    }
  }
  if (restoring)
    return (
      <SafeAreaView style={styles.safe}>
        <LanguageControl styles={styles} />
        <ActivityIndicator accessibilityLabel={t('Opening encrypted field storage')} />
      </SafeAreaView>
    )
  if (runtime)
    return (
      <SignedIn
        key={`${runtime.client.instance}:${runtime.client.user.id}`}
        runtime={runtime}
        styles={styles}
        signedOut={(revoked) => {
          setRuntime(null)
          setMessage(
            revoked
              ? 'Signed out. Saved field work is retained for this account.'
              : 'Signed out on this device. Server revocation was not confirmed. Saved work is retained; contact your institution if this device is lost.',
          )
        }}
      />
    )
  return (
    <SafeAreaView style={styles.safe}>
      <LanguageControl styles={styles} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.kicker}>{t('RAFIK FIELD')}</Text>
        <Text style={styles.title}>{t('Sign in to your institution')}</Text>
        <View style={styles.card}>
          <Text style={styles.label}>{t('Institution API URL')}</Text>
          <TextInput
            accessibilityLabel={t('Institution API URL')}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="https://rafik.university.edu/api"
            placeholderTextColor={styles.hint.color}
            value={base}
            onChangeText={setBase}
            style={[styles.input, { direction: 'ltr', writingDirection: 'ltr', textAlign: 'left' }]}
            editable={!busy}
          />
          <Text style={styles.label}>{t('Account email')}</Text>
          <TextInput
            accessibilityLabel={t('Account email')}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            style={[styles.input, { direction: 'ltr', writingDirection: 'ltr', textAlign: 'left' }]}
            editable={!busy}
          />
          <Text style={styles.label}>{t('Password')}</Text>
          <TextInput
            accessibilityLabel={t('Password')}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={[styles.input, { direction: 'ltr', writingDirection: 'ltr', textAlign: 'left' }]}
            editable={!busy}
            onSubmitEditing={() => void login()}
          />
          <Button
            title={busy ? 'Signing in…' : 'Sign in'}
            onPress={() => void login()}
            disabled={busy || !base.trim() || !email.trim() || !password}
            styles={styles}
            primary
          />
          <Text style={styles.hint}>
            {' '}
            {t('Use your institution account. Each server keeps its own data and sign-in.')}{' '}
          </Text>
          <Text style={styles.hint}>
            {' '}
            {t('Saved attendance reappears only for the same account and institution server.')}{' '}
          </Text>
        </View>
        {message ? (
          <Text accessibilityLiveRegion="polite" style={styles.message}>
            {t(message)}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

function SignedIn({
  runtime: { client, store },
  styles,
  signedOut,
}: {
  runtime: Runtime
  styles: Styles
  signedOut: (revoked: boolean) => void
}) {
  const { t, l } = useLanguage()
  const [contexts, setContexts] = useState<CoachContext[]>(client.contexts)
  const [savedInstitutions, setSavedInstitutions] = useState<string[]>([])
  const [institution, setInstitution] = useState(client.contexts[0]?.institution_id || '')
  const [message, setMessage] = useState('')
  const [closing, setClosing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [fieldBusy, setFieldBusy] = useState(false)
  const alive = useRef(true)
  const loadingRef = useRef(false)
  const accessOffline = useRef(false)
  const closingRef = useRef(closing)
  closingRef.current = closing

  async function refreshAccess(background = false) {
    if (loadingRef.current || closingRef.current || !alive.current) return
    loadingRef.current = true
    if (!background) setLoading(true)
    try {
      const saved = await store.institutions(client.instance, client.user.id)
      if (!alive.current) return
      setSavedInstitutions(saved)
      setInstitution((current) => selectedInstitution(current, client.contexts, saved))
      // Previously opened work must not wait for a network timeout on cold offline startup.
      if (saved.length || client.contexts.length) setLoading(false)
      const available = await client.refreshContexts()
      // Downloads may finish during the access request; include those device packages too.
      const retained = await store.institutions(client.instance, client.user.id)
      for (const id of retained.filter((id) => !available.some((c) => c.institution_id === id))) {
        const scope = { instance: client.instance, user: client.user.id, institution: id }
        for (const roster of await store.list(scope)) await store.block(scope, roster.event.id)
        await store.workouts.block(scope)
      }
      if (!alive.current) return
      setContexts(available)
      setSavedInstitutions(retained)
      accessOffline.current = false
      setInstitution((current) => selectedInstitution(current, available, retained))
      setMessage(
        available.length
          ? ''
          : 'This account currently has no institution coach access. Any saved work remains blocked for review.',
      )
    } catch (error) {
      accessOffline.current = error instanceof ConnectionFailure
      if (alive.current)
        setMessage(
          `${failureText(error)} Previously opened events remain available for this account.`,
        )
    } finally {
      loadingRef.current = false
      if (alive.current) setLoading(false)
    }
  }
  useEffect(() => {
    alive.current = true
    const retryAccess = () => {
      if (AppState.currentState === 'active' && accessOffline.current) void refreshAccess(true)
    }
    const unsubscribe = client.onAuthorizedResponse(retryAccess)
    const foreground = AppState.addEventListener('change', retryAccess)
    const timer = setInterval(retryAccess, 30_000)
    void refreshAccess()
    return () => {
      alive.current = false
      unsubscribe()
      foreground.remove()
      clearInterval(timer)
    }
  }, [])

  async function logout() {
    if (closing) return
    setClosing(true)
    try {
      const revoked = await client.logout()
      if (alive.current) signedOut(revoked)
    } catch (error) {
      if (alive.current) {
        setClosing(false)
        setMessage(failureText(error))
      }
    }
  }
  const options = [...new Set([...contexts.map((c) => c.institution_id), ...savedInstitutions])]
  return (
    <SafeAreaView style={styles.safe}>
      <LanguageControl styles={styles} />
      <View style={styles.toolbar}>
        <View style={styles.heading}>
          <Text style={styles.kicker}>{t('RAFIK FIELD')}</Text>
          <Text style={styles.hint}>{client.user.email}</Text>
        </View>
        <Button
          title={closing ? 'Signing out…' : 'Sign out'}
          disabled={closing || loading || fieldBusy}
          onPress={() => void logout()}
          styles={styles}
        />
      </View>
      {message ? (
        <View style={{ paddingHorizontal: 18 }}>
          <Text accessibilityLiveRegion="polite" style={styles.message}>
            {t(message)}
          </Text>
          <Button
            title="Refresh access"
            disabled={closing || loading || fieldBusy}
            onPress={() => void refreshAccess(true)}
            styles={styles}
          />
        </View>
      ) : null}
      {options.length > 1 ? (
        <View style={styles.toolbar}>
          {options.map((id) => (
            <Button
              key={id}
              title={`${contexts.find((c) => c.institution_id === id)?.name || t('Saved institution')}${institution === id ? l(' · selected', ' · محددة') : ''}`}
              disabled={closing || loading || fieldBusy}
              onPress={() => setInstitution(id)}
              styles={styles}
              primary={institution === id}
            />
          ))}
        </View>
      ) : null}
      {institution && !loading ? (
        <InstitutionScreen
          key={institution}
          client={client}
          store={store}
          institution={institution}
          styles={styles}
          closing={closing}
          onPersisting={setFieldBusy}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {loading ? (
            <ActivityIndicator accessibilityLabel={t('Checking coach access')} />
          ) : (
            <>
              <Text style={styles.title}>{t('No coach institution')}</Text>
              <Button title="Refresh access" onPress={() => void refreshAccess()} styles={styles} />
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
