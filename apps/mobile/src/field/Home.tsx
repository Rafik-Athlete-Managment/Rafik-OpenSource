import { LanguageControl } from './LanguageControl'
import { useLanguage } from './Language'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  AppState,
  BackHandler,
  Pressable,
  ScrollView,
  Text,
  useColorScheme,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { NativeClient, privateStore, type CoachContext } from './native'
import { ConnectionFailure, failureText } from './model'
import { selectedInstitution } from './access'
import type { FieldStore } from './store'
import {
  Button,
  Field,
  Icon,
  IconButton,
  Notice,
  Segmented,
  SectionLabel,
  StatusPill,
  makeStyles,
  type Styles,
} from './ui'
import { InstitutionScreen } from './InstitutionScreen'
import { checkCapabilities, type CapabilityCheck } from './capabilities'

type Runtime = { client: NativeClient; store: FieldStore }
/** Signs in the coach, selects the institution connection and opens the field tools. */
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
        <ActivityIndicator
          color={styles.link.color}
          accessibilityLabel={t('Opening encrypted field storage')}
        />
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
      <ScrollView
        contentContainerStyle={[styles.content, { maxWidth: 520, paddingTop: 8 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 6, marginBottom: 4 }}>
          <Text style={styles.kicker}>{t('RAFIK FIELD')}</Text>
          <Text style={styles.title} accessibilityRole="header">
            {t('Sign in to your institution')}
          </Text>
          <Text style={styles.hint}>
            {t('Use your institution account. Each server keeps its own data and sign-in.')}
          </Text>
        </View>
        <View style={[styles.card, { gap: 14 }]}>
          <View style={{ gap: 6 }}>
            <Text style={styles.label}>{t('Institution API URL')}</Text>
            <Field
              styles={styles}
              icon="connection"
              accessibilityLabel={t('Institution API URL')}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="https://rafik.university.edu/api"
              value={base}
              onChangeText={setBase}
              style={{ direction: 'ltr', writingDirection: 'ltr', textAlign: 'left' }}
              editable={!busy}
            />
          </View>
          <View style={{ gap: 6 }}>
            <Text style={styles.label}>{t('Account email')}</Text>
            <Field
              styles={styles}
              icon="account"
              accessibilityLabel={t('Account email')}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              style={{ direction: 'ltr', writingDirection: 'ltr', textAlign: 'left' }}
              editable={!busy}
            />
          </View>
          <View style={{ gap: 6 }}>
            <Text style={styles.label}>{t('Password')}</Text>
            <Field
              styles={styles}
              accessibilityLabel={t('Password')}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              style={{ direction: 'ltr', writingDirection: 'ltr', textAlign: 'left' }}
              editable={!busy}
              onSubmitEditing={() => void login()}
            />
          </View>
          {message ? <Notice text={t(message)} tone="danger" styles={styles} live /> : null}
          <Button
            title={busy ? 'Signing in…' : 'Sign in'}
            onPress={() => void login()}
            disabled={busy || !base.trim() || !email.trim() || !password}
            styles={styles}
            primary
            fill
          />
        </View>
        <Text style={[styles.meta, { textAlign: 'center' }]}>
          {t('Saved attendance reappears only for the same account and institution server.')}
        </Text>
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
  const { t, l, language, setLanguage, preferenceError } = useLanguage()
  const [contexts, setContexts] = useState<CoachContext[]>(client.contexts)
  const [savedInstitutions, setSavedInstitutions] = useState<string[]>([])
  const [institution, setInstitution] = useState(client.contexts[0]?.institution_id || '')
  const [message, setMessage] = useState('')
  const [closing, setClosing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [fieldBusy, setFieldBusy] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [settingsPage, setSettingsPage] = useState<'main' | 'connection'>('main')
  const [syncSignal, setSyncSignal] = useState(0)
  const [savedRefreshSignal, setSavedRefreshSignal] = useState(0)
  const [clearingCompleted, setClearingCompleted] = useState(false)
  const [clearResult, setClearResult] = useState('')
  const [connectionInfo, setConnectionInfo] = useState<CapabilityCheck | null>(null)
  const [connectionError, setConnectionError] = useState('')
  const [savedEventCount, setSavedEventCount] = useState(0)
  const [savedWorkoutCount, setSavedWorkoutCount] = useState(0)
  const [uploadsWaiting, setUploadsWaiting] = useState(false)
  const [syncRequested, setSyncRequested] = useState(false)
  const [connectionState, setConnectionState] = useState<'unknown' | 'online' | 'offline'>(
    'unknown',
  )
  const [noticeDismissed, setNoticeDismissed] = useState(false)
  const alive = useRef(true)
  const loadingRef = useRef(false)
  const accessOffline = useRef(false)
  const closingRef = useRef(closing)
  closingRef.current = closing
  useEffect(() => {
    if (!accountOpen) setSettingsPage('main')
  }, [accountOpen])
  useEffect(() => {
    if (!accountOpen) return
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (settingsPage === 'connection') setSettingsPage('main')
      else setAccountOpen(false)
      return true
    })
    return () => listener.remove()
  }, [accountOpen, settingsPage])

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
      setConnectionState('online')
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
      if (alive.current) {
        if (error instanceof ConnectionFailure) {
          setConnectionState('offline')
          setMessage((current) =>
            current.includes('Previously opened events remain available') ? '' : current,
          )
        } else setMessage(failureText(error))
      }
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
    const unsubscribe = client.onAuthorizedResponse(() => {
      if (alive.current) setConnectionState('online')
      retryAccess()
    })
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
  useEffect(() => setNoticeDismissed(false), [message])
  async function refreshConnection() {
    if (!institution) return
    const owner = { instance: client.instance, user: client.user.id, institution }
    try {
      const [capabilities, events, workouts, eventPending, workoutPending] = await Promise.all([
        checkCapabilities((path) => client.request(path)),
        store.list(owner),
        store.workouts.countAll(owner),
        store.next(owner),
        store.workouts.next(owner),
      ])
      if (!alive.current) return
      setConnectionInfo(capabilities)
      setSavedEventCount(events.length)
      setSavedWorkoutCount(workouts)
      setUploadsWaiting(!!eventPending || !!workoutPending)
      setConnectionError('')
    } catch (error) {
      if (alive.current) setConnectionError(failureText(error))
    }
  }
  function confirmClearCompleted() {
    if (!institution || clearingCompleted) return
    Alert.alert(
      l('Clear completed downloads?', 'مسح السجلات المكتملة المحمّلة؟'),
      l(
        'Only server-confirmed completed workout sheets with no unsent changes will be removed from this phone. Active group events stay available.',
        'ستُمسح من هذا الهاتف سجلات التمارين المكتملة والمؤكدة من الخادم فقط، إذا لم تتضمن تغييرات غير مرسلة. ستبقى المواعيد الجماعية النشطة متاحة.',
      ),
      [
        { text: l('Cancel', 'إلغاء'), style: 'cancel' },
        {
          text: l('Clear', 'مسح'),
          style: 'destructive',
          onPress: () => {
            setClearingCompleted(true)
            setClearResult('')
            const owner = { instance: client.instance, user: client.user.id, institution }
            void store.workouts
              .clearCompleted(owner)
              .then(async (count) => {
                setClearResult(
                  l(
                    `${count} completed sheets cleared.`,
                    `تم مسح ${count} من سجلات التمارين المكتملة.`,
                  ),
                )
                setSavedRefreshSignal((value) => value + 1)
                await refreshConnection()
              })
              .catch((error) => setClearResult(failureText(error)))
              .finally(() => setClearingCompleted(false))
          },
        },
      ],
    )
  }
  useEffect(() => {
    if (accountOpen && settingsPage === 'connection') void refreshConnection()
  }, [accountOpen, settingsPage, institution])
  const settings = (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.rowHeader, { marginBottom: 4 }]}>
        {settingsPage === 'connection' ? (
          <IconButton
            name="back"
            rtl={language === 'ar'}
            label={l('Back to settings', 'العودة إلى الإعدادات')}
            onPress={() => setSettingsPage('main')}
            styles={styles}
          />
        ) : null}
        <Text style={[styles.title, { flex: 1 }]} accessibilityRole="header">
          {settingsPage === 'connection'
            ? l('Connection & Sync', 'الاتصال والمزامنة')
            : l('Settings', 'الإعدادات')}
        </Text>
        <IconButton
          name="close"
          label={l('Close settings', 'إغلاق الإعدادات')}
          onPress={() => setAccountOpen(false)}
          styles={styles}
        />
      </View>
      {settingsPage === 'connection' ? (
        <>
          <Text style={styles.hint}>
            {l(
              'Check the institution connection and work still saved on this phone.',
              'تحقق من اتصال المؤسسة والعمل الذي ما زال محفوظاً على هذا الهاتف.',
            )}
          </Text>
          <View style={styles.settingsGroup}>
            <View style={styles.settingsRow}>
              <Icon name="connection" styles={styles} muted />
              <Text style={[styles.label, { flex: 1 }]}>{l('Server', 'الخادم')}</Text>
              <StatusPill
                styles={styles}
                style={{ alignSelf: 'center' }}
                tone={
                  connectionError
                    ? 'danger'
                    : connectionInfo?.state === 'available'
                      ? 'success'
                      : connectionInfo?.state === 'legacy'
                        ? 'warning'
                        : 'neutral'
                }
                label={
                  connectionError
                    ? l('Could not confirm', 'تعذر التأكد')
                    : connectionInfo?.state === 'available'
                      ? l('Reached on last check', 'تم الوصول في آخر تحقق')
                      : connectionInfo?.state === 'legacy'
                        ? l('Compatibility unknown', 'التوافق غير معروف')
                        : l('Checking…', 'جارٍ التحقق…')
                }
              />
            </View>
            <View style={styles.settingsRow}>
              <Icon name="saved" styles={styles} muted />
              <Text style={[styles.label, { flex: 1 }]}>
                {l('Saved on device', 'المحفوظ على الجهاز')}
              </Text>
              <Text style={styles.hint}>
                {savedEventCount} {l('events', 'مواعيد')} · {savedWorkoutCount}{' '}
                {l('sheets', 'سجلات')}
              </Text>
            </View>
            <View style={[styles.settingsRow, { borderBottomWidth: 0 }]}>
              <Icon name="refresh" styles={styles} muted />
              <Text style={[styles.label, { flex: 1 }]}>{l('Uploads', 'عمليات الإرسال')}</Text>
              <StatusPill
                styles={styles}
                style={{ alignSelf: 'center' }}
                tone={uploadsWaiting ? 'warning' : 'success'}
                label={
                  uploadsWaiting
                    ? l('Saved work waiting', 'عمل محفوظ بانتظار الإرسال')
                    : l('No queued upload', 'لا توجد عملية معلقة')
                }
              />
            </View>
          </View>
          {connectionError ? <Notice text={connectionError} tone="danger" styles={styles} /> : null}
          <Button
            title={
              syncRequested
                ? l('Syncing…', 'جارٍ المزامنة…')
                : l('Refresh and sync', 'تحديث ومزامنة')
            }
            disabled={!institution || syncRequested || closing || loading || fieldBusy}
            onPress={() => {
              setSyncRequested(true)
              setSyncSignal((value) => value + 1)
              void refreshAccess(true)
            }}
            styles={styles}
            icon="refresh"
            primary
            fill
          />
          <Text style={styles.meta}>
            {l(
              'A failed upload stays on this device for review. Refresh never discards recorded work.',
              'تبقى عملية الإرسال الفاشلة على هذا الجهاز للمراجعة. لا يحذف التحديث العمل المسجل.',
            )}
          </Text>
          <Button
            title={
              clearingCompleted
                ? l('Clearing…', 'جارٍ المسح…')
                : l('Clear completed downloads', 'مسح السجلات المكتملة')
            }
            disabled={clearingCompleted || fieldBusy || closing || loading}
            onPress={confirmClearCompleted}
            styles={styles}
            danger
            fill
          />
          {clearResult ? <Text style={styles.hint}>{clearResult}</Text> : null}
        </>
      ) : (
        <>
          <SectionLabel styles={styles}>{l('Account', 'الحساب')}</SectionLabel>
          <View style={styles.settingsGroup}>
            <View style={[styles.settingsRow, { borderBottomWidth: 0 }]}>
              <Icon name="account" styles={styles} muted />
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{l('Signed in as', 'الحساب الحالي')}</Text>
                <Text selectable style={[styles.hint, { writingDirection: 'ltr' }]}>
                  {client.user.email}
                </Text>
              </View>
            </View>
          </View>
          <SectionLabel styles={styles}>{l('Preferences', 'التفضيلات')}</SectionLabel>
          <View style={styles.settingsGroup}>
            <View
              style={[
                styles.settingsRow,
                { borderBottomWidth: 0, flexWrap: 'wrap', paddingVertical: 8 },
              ]}
            >
              <Icon name="language" styles={styles} muted />
              <Text style={[styles.label, { flex: 1 }]}>{l('Language', 'اللغة')}</Text>
              <View style={{ width: 190 }}>
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
            </View>
          </View>
          {preferenceError ? (
            <Text style={styles.hint}>
              {l(
                'Language preference was not saved. Tap again to retry.',
                'لم يُحفظ تفضيل اللغة. اضغط مجدداً للمحاولة.',
              )}
            </Text>
          ) : null}
          <SectionLabel styles={styles}>{l('Application', 'التطبيق')}</SectionLabel>
          <View style={styles.settingsGroup}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setSettingsPage('connection')}
              style={[styles.settingsRow, { borderBottomWidth: 0 }]}
            >
              <Icon name="connection" styles={styles} muted />
              <Text style={[styles.label, { flex: 1 }]}>
                {l('Connection & Sync', 'الاتصال والمزامنة')}
              </Text>
              <Icon name="forward" styles={styles} rtl={language === 'ar'} muted size={18} />
            </Pressable>
          </View>
          {options.length > 1 ? (
            <SectionLabel styles={styles}>{l('Institution', 'المؤسسة')}</SectionLabel>
          ) : null}
          {options.length > 1 ? (
            <View style={styles.settingsGroup}>
              {options.map((id) => (
                <Pressable
                  key={id}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: institution === id,
                    disabled: closing || loading || fieldBusy,
                  }}
                  disabled={closing || loading || fieldBusy}
                  onPress={() => {
                    setInstitution(id)
                    setAccountOpen(false)
                  }}
                  style={styles.settingsRow}
                >
                  <Icon name="account" styles={styles} muted />
                  <Text style={[styles.label, { flex: 1 }]}>
                    {contexts.find((c) => c.institution_id === id)?.name || t('Saved institution')}
                  </Text>
                  {institution === id ? <Icon name="check" styles={styles} size={18} /> : null}
                </Pressable>
              ))}
            </View>
          ) : null}
          <View style={[styles.settingsGroup, { marginTop: 8 }]}>
            <Pressable
              accessibilityRole="button"
              disabled={closing || loading || fieldBusy}
              onPress={() => void logout()}
              style={[
                styles.settingsRow,
                { borderBottomWidth: 0 },
                (closing || loading || fieldBusy) && styles.disabled,
              ]}
            >
              <Icon name="logout" styles={styles} color={styles.dangerText.color} />
              <Text style={[styles.label, styles.dangerText]}>
                {closing ? l('Signing out…', 'جارٍ تسجيل الخروج…') : l('Sign out', 'تسجيل الخروج')}
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </ScrollView>
  )
  return (
    <SafeAreaView style={styles.safe}>
      {(!institution || loading) && !accountOpen ? (
        <View style={styles.topbar}>
          <Text style={styles.brand}>
            {l('Rafik', 'رفيق')}
            <Text style={styles.brandDot}>.</Text>
          </Text>
          <IconButton
            name="settings"
            label={l('Open settings', 'فتح الإعدادات')}
            expanded={accountOpen}
            onPress={() => setAccountOpen((open) => !open)}
            styles={styles}
          />
        </View>
      ) : null}
      {message && !noticeDismissed && !accountOpen ? (
        <View style={{ marginHorizontal: 16, marginTop: 8 }}>
          <Notice
            text={t(message)}
            tone="warning"
            styles={styles}
            lines={3}
            live
            onPress={() => setNoticeDismissed(true)}
            actionIcon="close"
            actionLabel={l('Dismiss notice', 'إخفاء التنبيه')}
          />
        </View>
      ) : null}
      {institution && !loading ? (
        <View style={{ flex: 1, display: accountOpen ? 'none' : 'flex' }}>
          <InstitutionScreen
            key={institution}
            client={client}
            store={store}
            institution={institution}
            styles={styles}
            closing={closing}
            onPersisting={setFieldBusy}
            accountOpen={accountOpen}
            onAccountPress={() => setAccountOpen((open) => !open)}
            onEventOpen={() => setAccountOpen(false)}
            externalNotice={!!message && !noticeDismissed}
            connectionState={connectionState}
            onConnectivity={setConnectionState}
            settingsSyncSignal={syncSignal}
            savedRefreshSignal={savedRefreshSignal}
            onSettingsSyncComplete={() => {
              setSyncRequested(false)
              if (accountOpen && settingsPage === 'connection') void refreshConnection()
            }}
          />
        </View>
      ) : (
        <ScrollView
          style={{ display: accountOpen ? 'none' : 'flex' }}
          contentContainerStyle={styles.content}
        >
          {loading ? (
            <ActivityIndicator
              color={styles.link.color}
              accessibilityLabel={t('Checking coach access')}
            />
          ) : (
            <View style={[styles.card, { alignItems: 'center', paddingVertical: 32, gap: 12 }]}>
              <Text style={[styles.cardTitle, { textAlign: 'center' }]}>
                {t('No coach institution')}
              </Text>
              <Button
                title="Refresh access"
                icon="refresh"
                secondary
                onPress={() => void refreshAccess()}
                styles={styles}
              />
            </View>
          )}
        </ScrollView>
      )}
      {accountOpen ? settings : null}
    </SafeAreaView>
  )
}
