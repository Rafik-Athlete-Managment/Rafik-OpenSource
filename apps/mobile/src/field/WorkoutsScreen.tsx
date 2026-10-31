import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  AppState,
  BackHandler,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native'
import type { WorkoutAgenda } from '@rafik/shared/contracts'
import { useLanguage } from './Language'
import { NativeClient, operationId } from './native'
import type { FieldStore } from './store'
import { ApiFailure, failureText, type Owner } from './model'
import {
  startTimeReached,
  validateEntries,
  type FieldWorkoutEntry,
  type FieldWorkoutPackage,
  type WorkoutRecord,
} from './workout-model'
import { WorkoutSync, requireWorkoutSupport } from './workout-sync'
import { workoutNumber, type WorkoutMeasure } from './workout-input'
import { Button, displayDate, type Styles } from './ui'

export function WorkoutsScreen({
  client,
  store,
  owner,
  styles,
  closing,
  onPersisting,
  active,
}: {
  client: NativeClient
  store: FieldStore
  owner: Owner
  styles: Styles
  closing: boolean
  onPersisting: (busy: boolean) => void
  active: boolean
}) {
  const { l, t, language } = useLanguage()
  const [saved, setSaved] = useState<WorkoutRecord[]>([]),
    [available, setAvailable] = useState<FieldWorkoutPackage[]>([])
  const [selected, setSelected] = useState(''),
    [record, setRecord] = useState<WorkoutRecord | null>(null)
  const [entries, setEntries] = useState<FieldWorkoutEntry[]>([]),
    [note, setNote] = useState('')
  const [search, setSearch] = useState(''),
    [offset, setOffset] = useState(0),
    [total, setTotal] = useState(0)
  const [savedTotal, setSavedTotal] = useState(0),
    [savedOffset, setSavedOffset] = useState(0),
    [savedIds, setSavedIds] = useState<string[]>([])
  const cacheOffset = useRef(0),
    appliedSearch = useRef(''),
    localRead = useRef(0)
  const [busy, setBusy] = useState(false),
    [persisting, setPersisting] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('')
  const [onlineLoading, setOnlineLoading] = useState(false)
  const [raw, setRaw] = useState<Record<string, string>>({}),
    [storageFailed, setStorageFailed] = useState(false)
  const [invalidInputs, setInvalidInputs] = useState<Record<string, boolean>>({})
  const invalidInput = Object.values(invalidInputs).some(Boolean)
  const dayName = (p: FieldWorkoutPackage) =>
    language === 'ar' && p.day_name_ar ? p.day_name_ar : p.day_name
  const fieldLabel = (field: WorkoutMeasure, unit: string) =>
    field === 'load'
      ? l('Load', 'الحمل') + ' (' + unit + ')'
      : field === 'reps'
        ? l('Reps', 'تكرارات')
        : field === 'seconds'
          ? l('Seconds', 'ثوانٍ')
          : field === 'metres'
            ? l('Metres', 'أمتار')
            : l('Effort (RPE, optional)', 'الجهد (اختياري)')
  const alive = useRef(true),
    selection = useRef(''),
    flight = useRef(false),
    reads = useRef(0),
    runner = useRef<WorkoutSync | null>(null)
  const drafts = useRef({ entries: [] as FieldWorkoutEntry[], note: '' }),
    writes = useRef(Promise.resolve()),
    editSerial = useRef(0)
  const closingRef = useRef(closing)
  closingRef.current = closing
  const activeRef = useRef(active),
    backAction = useRef(() => {})
  activeRef.current = active
  useEffect(() => {
    if (!active || !selected) return
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      backAction.current()
      return true
    })
    return () => listener.remove()
  }, [active, selected])
  async function refreshLocal() {
    const token = ++localRead.current
    const needle = appliedSearch.current,
      requested = cacheOffset.current
    const count = await store.workouts.count(owner, needle)
    if (!alive.current || token !== localRead.current || needle !== appliedSearch.current) return
    const page = Math.min(requested, Math.max(0, Math.floor((count - 1) / 10) * 10))
    cacheOffset.current = page
    const items = await store.workouts.list(owner, page, needle)
    const ids = await store.workouts.ids(owner)
    const active = selection.current ? await store.workouts.get(owner, selection.current) : null
    if (!alive.current || token !== localRead.current) return
    setSaved(items)
    setSavedTotal(count)
    setSavedOffset(page)
    setSavedIds(ids)
    setRecord(active)
  }
  async function sync() {
    try {
      await runner.current?.run(() => {
        void refreshLocal().catch((e) => {
          if (alive.current) setError(failureText(e))
        })
      })
      await refreshLocal()
    } catch (e) {
      if (alive.current) setError(failureText(e))
    }
  }
  async function load(page = 0) {
    if (flight.current || closingRef.current) return
    flight.current = true
    setOnlineLoading(true)
    setError('')
    const token = ++reads.current
    const needle = search.trim().slice(0, 100)
    if (needle !== appliedSearch.current) {
      page = 0
      cacheOffset.current = 0
      appliedSearch.current = needle
    }
    try {
      await refreshLocal()
      await requireWorkoutSupport((path) => client.request(path))
      const result = await client.request<WorkoutAgenda>(
        `/institution/workout-scheduling?view=trainer&queue=actionable&fieldPackages=true&search=${encodeURIComponent(needle)}&offset=${page}&limit=10`,
      )
      if (alive.current && token === reads.current) {
        setAvailable(result.items.flatMap((i) => (i.field_workout ? [i.field_workout] : [])))
        setOffset(result.offset)
        setTotal(result.total)
      }
    } catch (e) {
      if (e instanceof ApiFailure && [401, 403].includes(e.status)) {
        await store.workouts.block(owner)
        if (alive.current) setAvailable([])
        await refreshLocal()
      }
      if (alive.current) setError(failureText(e))
    } finally {
      flight.current = false
      if (alive.current) setOnlineLoading(false)
    }
  }
  useEffect(() => {
    alive.current = true
    const active = new WorkoutSync(store.workouts, owner, async (path, body) => {
      await requireWorkoutSupport((path) => client.request(path))
      return client.request(path, { method: 'POST', body })
    })
    runner.current = active
    void refreshLocal()
      .then(() => {
        void sync()
        void load()
      })
      .catch((e) => {
        if (alive.current) setError(failureText(e))
      })
    const foreground = () => {
      if (AppState.currentState === 'active') void sync()
    }
    const sub = AppState.addEventListener('change', foreground),
      timer = setInterval(foreground, 30_000)
    return () => {
      alive.current = false
      reads.current++
      active.stop()
      sub.remove()
      clearInterval(timer)
    }
  }, [client, store, owner])
  useEffect(() => {
    if (closing) runner.current?.stop()
  }, [closing])
  useEffect(() => {
    onPersisting(persisting || storageFailed || invalidInput)
    return () => onPersisting(false)
  }, [persisting, storageFailed, invalidInput, onPersisting])
  async function open(id: string) {
    await writes.current
    const r = await store.workouts.get(owner, id)
    if (!alive.current) return
    selection.current = id
    setSelected(id)
    setRecord(r)
    drafts.current = { entries: r.entries.map((e) => ({ ...e })), note: r.note }
    setEntries(drafts.current.entries)
    setNote(r.note)
    setRaw({})
    setInvalidInputs({})
    setNotice('')
    setError('')
  }
  async function download(p: FieldWorkoutPackage) {
    if (flight.current) return
    flight.current = true
    setBusy(true)
    setError('')
    try {
      const r = await store.workouts.put(owner, p)
      await refreshLocal()
      if (alive.current) {
        setNotice(
          l(
            'Workout saved on this device. Server confirmation is separate.',
            'حُفظ التمرين على هذا الجهاز. تأكيد الخادم منفصل.',
          ),
        )
        await open(r.package.id)
      }
    } catch (e) {
      if (alive.current) setError(failureText(e))
    } finally {
      flight.current = false
      if (alive.current) setBusy(false)
    }
  }
  function edit(nextEntries: FieldWorkoutEntry[], nextNote: string) {
    const id = selection.current
    try {
      if (record) validateEntries(record.package, nextEntries, false)
    } catch (e) {
      setError(failureText(e))
      return
    }
    const serial = ++editSerial.current
    drafts.current = { entries: nextEntries, note: nextNote }
    setEntries(nextEntries)
    setNote(nextNote)
    setPersisting(true)
    setNotice('')
    writes.current = writes.current
      .catch(() => undefined)
      .then(async () => {
        const saved = await store.workouts.edit(owner, id, nextEntries, nextNote)
        if (alive.current && serial === editSerial.current) {
          setStorageFailed(false)
          setNotice(l('Saved on this device.', 'حُفظ على هذا الجهاز.'))
          if (selection.current === id) setRecord(saved)
        }
      })
      .catch((e) => {
        if (alive.current) {
          setStorageFailed(true)
          setError(failureText(e))
        }
        throw e
      })
      .finally(() => {
        if (alive.current && serial === editSerial.current) setPersisting(false)
      })
    void writes.current.catch(() => undefined)
  }
  async function act(action: 'start' | 'save' | 'finish' | 'retry' | 'access') {
    if (busy || persisting || closing) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await writes.current
      const id = selection.current
      if (action === 'start') await store.workouts.start(owner, id, operationId(), operationId())
      else if (action === 'retry') {
        const contexts = await client.refreshContexts()
        if (!contexts.some((c) => c.institution_id === owner.institution))
          throw new ApiFailure(403, 'forbidden')
        await store.workouts.retry(owner, id)
      } else if (action === 'access') {
        const current = await store.workouts.get(owner, id)
        if (!current.session) throw Error('Download this workout online first.')
        const doc = await client.request(`/workouts/${current.session.id}?view=trainer`)
        await store.workouts.restoreAccess(owner, id, doc)
      } else await store.workouts.save(owner, id, action === 'finish', operationId())
      await refreshLocal()
      if (action !== 'access')
        setNotice(
          l(
            'Saved on this device; awaiting server confirmation.',
            'حُفظ على هذا الجهاز؛ بانتظار تأكيد الخادم.',
          ),
        )
      void sync()
    } catch (e) {
      if (alive.current) setError(failureText(e))
    } finally {
      if (alive.current) setBusy(false)
    }
  }
  async function back() {
    if (invalidInput) {
      setError(
        l(
          'Correct invalid values before leaving this workout.',
          'صحّح القيم غير الصالحة قبل مغادرة التمرين.',
        ),
      )
      return
    }
    try {
      await writes.current
      selection.current = ''
      setSelected('')
      setRecord(null)
      setError('')
      await refreshLocal()
    } catch (e) {
      setError(failureText(e))
    }
  }
  async function share() {
    Alert.alert(
      l('Share recovery copy?', 'مشاركة نسخة للاستعادة؟'),
      l(
        'This contains athlete names, workout results and notes. Share only with authorized institution staff. No sign-in tokens are included.',
        'تحتوي على أسماء الرياضيين ونتائج التمارين والملاحظات. شاركها فقط مع موظفي المؤسسة المخولين. لا تتضمن رموز الدخول.',
      ),
      [
        { text: l('Cancel', 'إلغاء'), style: 'cancel' },
        {
          text: l('Share', 'مشاركة'),
          onPress: () => {
            void (async () => {
              await writes.current
              const r = await store.workouts.get(owner, selection.current)
              await Share.share({
                message: JSON.stringify(
                  { format: 'rafik-workout-recovery-v1', owner, record: r },
                  null,
                  2,
                ),
              })
            })().catch((e) => {
              if (alive.current) setError(failureText(e))
            })
          },
        },
      ],
    )
  }
  function remove(id: string) {
    Alert.alert(
      l('Remove downloaded workout?', 'إزالة التمرين المنزّل؟'),
      l(
        'Only this device copy is removed. Server history is retained. Unsynced work cannot be removed.',
        'تُحذف نسخة الجهاز فقط، ويبقى سجل الخادم. لا يمكن إزالة عمل غير متزامن.',
      ),
      [
        { text: l('Cancel', 'إلغاء'), style: 'cancel' },
        {
          text: l('Remove', 'إزالة'),
          style: 'destructive',
          onPress: () => {
            void store.workouts
              .remove(owner, id)
              .then(() => refreshLocal())
              .catch((e) => {
                if (alive.current) setError(failureText(e))
              })
          },
        },
      ],
    )
  }
  async function reviewRejected() {
    if (!record?.session) return
    setBusy(true)
    setError('')
    try {
      const id = record.package.id,
        doc = await client.request<{ id: string; version: number; note: string }>(
          `/workouts/${record.session.id}?view=trainer`,
        )
      if (!alive.current || !activeRef.current || selection.current !== id) return
      Alert.alert(
        l('Load server version?', 'تحميل نسخة الخادم؟'),
        l(
          `Current server version: ${doc.version}. This replaces the device draft with the current server version. Share a recovery copy first if you need to retain those values.`,
          `إصدار الخادم الحالي: ${doc.version}. يستبدل هذا مسودة الجهاز بنسخة الخادم الحالية. شارك نسخة استعادة أولاً إذا أردت الاحتفاظ بتلك القيم.`,
        ),
        [
          { text: l('Keep saved work', 'الاحتفاظ بالعمل المحفوظ'), style: 'cancel' },
          {
            text: l('Replace device draft', 'استبدال مسودة الجهاز'),
            style: 'destructive',
            onPress: () => {
              void store.workouts
                .replaceRejected(owner, id, doc)
                .then(() => open(id))
                .catch((e) => {
                  if (alive.current) setError(failureText(e))
                })
            },
          },
        ],
      )
    } catch (e) {
      if (alive.current) setError(failureText(e))
    } finally {
      if (alive.current) setBusy(false)
    }
  }
  async function refreshSaved() {
    if (!record) return
    const original = record,
      id = record.package.id
    setBusy(true)
    setError('')
    try {
      let next: FieldWorkoutPackage
      if (original.session) {
        const doc = await client.request<{
          id: string
          member_id: string
          version: number
          note: string
          completed_at: string | null
          entries: FieldWorkoutEntry[]
          can_record: boolean
        }>(`/workouts/${original.session.id}?view=trainer`)
        if (doc.id !== original.session.id || doc.member_id !== original.package.member_id)
          throw Error('Invalid workout package. Refresh it online before recording.')
        next = {
          ...original.package,
          allow_provisional_start: false,
          can_record: doc.can_record,
          entries: doc.entries,
          session: {
            id: doc.id,
            version: doc.version,
            note: doc.note,
            completed_at: doc.completed_at,
          },
        }
      } else {
        const page = await client.request<WorkoutAgenda>(
          `/institution/workout-scheduling?view=trainer&fieldPackages=true&assignment=${original.package.assignment_id}`,
        )
        const found = page.items.find((item) => item.field_workout?.id === id)?.field_workout
        if (!found)
          throw Error(
            'The downloaded workout is no longer current. Review it online before starting.',
          )
        next = found
      }
      await store.workouts.put(owner, next)
      if (alive.current && activeRef.current && selection.current === id) await open(id)
    } catch (e) {
      if (e instanceof ApiFailure && [401, 403, 404].includes(e.status)) {
        await store.workouts.block(owner, id)
        await refreshLocal()
      }
      if (alive.current) setError(failureText(e))
    } finally {
      if (alive.current) setBusy(false)
    }
  }
  backAction.current = () => {
    void back()
  }
  const targetMap = new Map(
    (record?.package.targets || record?.package.entries || []).map((e) => [
      e.exercise_key + ':' + e.set_index,
      e,
    ]),
  )
  const targetFor = (e: FieldWorkoutEntry) => targetMap.get(e.exercise_key + ':' + e.set_index) || e
  const editable =
    !!record?.session &&
    !record.blocked &&
    !record.session.completed_at &&
    !record.intent?.complete &&
    !record.pending?.payload.complete &&
    (record.package.can_record || record.session.version === 0)
  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>
        {selected
          ? record
            ? dayName(record.package)
            : ''
          : l('Individual workouts', 'التمارين الفردية')}
      </Text>
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.message}>
          {t(error)}
        </Text>
      ) : null}
      {storageFailed ? (
        <Button
          title={l('Retry saving on device', 'إعادة الحفظ على الجهاز')}
          disabled={persisting}
          onPress={() => edit(drafts.current.entries, drafts.current.note)}
          styles={styles}
        />
      ) : null}
      <Text style={[styles.hint, { minHeight: 20 }]}>{notice || ' '}</Text>
      {busy || (onlineLoading && !selected) ? (
        <ActivityIndicator
          accessibilityLabel={l('Loading workout data', 'جارٍ تحميل بيانات التمرين')}
        />
      ) : null}
      {!selected ? (
        <>
          <Text style={styles.hint}>
            {l(
              'Download before going offline. Starts and results remain provisional until the server accepts them. Group recording remains in the web dashboard.',
              'نزّل التمرين قبل قطع الاتصال. يبقى البدء والنتائج مؤقتين حتى يقبلهما الخادم. يبقى التسجيل الجماعي في لوحة الويب.',
            )}
          </Text>
          <Text style={styles.label}>{l('Find an athlete', 'ابحث عن رياضي')}</Text>
          <TextInput
            accessibilityLabel={l('Find an athlete', 'ابحث عن رياضي')}
            placeholder={l('Search athlete names…', 'ابحث بأسماء الرياضيين…')}
            placeholderTextColor={styles.hint.color}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => void load()}
            style={styles.input}
          />
          <Button
            title={l('Search and refresh', 'بحث وتحديث')}
            disabled={busy || onlineLoading || closing}
            onPress={() => void load()}
            styles={styles}
          />
          <Button
            title={l('Sync saved workouts', 'مزامنة التمارين المحفوظة')}
            disabled={busy || closing}
            onPress={() => void sync()}
            styles={styles}
          />
          <Text style={styles.label}>{l('Saved on this device', 'المحفوظ على هذا الجهاز')}</Text>
          {saved.length ? (
            saved.map((r) => (
              <View key={r.package.id} style={styles.card}>
                <Text style={styles.cardTitle}>{dayName(r.package)}</Text>
                <Text style={styles.hint}>
                  {r.package.member_name} · {r.package.title}
                </Text>
                <Text style={styles.hint}>
                  {r.session?.completed_at
                    ? l('Completed · server confirmed', 'مكتمل · أكده الخادم')
                    : r.pending || r.intent
                      ? l('Awaiting confirmation', 'بانتظار التأكيد')
                      : r.localRevision !== r.syncedRevision
                        ? l('Device draft · not sent', 'مسودة الجهاز · لم ترسل')
                        : l('Downloaded', 'تم التنزيل')}
                </Text>
                <Button
                  title={l('Open saved workout', 'فتح التمرين المحفوظ')}
                  onPress={() => void open(r.package.id).catch((e) => setError(failureText(e)))}
                  styles={styles}
                />
                <Button
                  title={l('Remove downloaded copy', 'إزالة النسخة المنزّلة')}
                  danger
                  disabled={!!r.pending || !!r.intent || r.localRevision !== r.syncedRevision}
                  onPress={() => remove(r.package.id)}
                  styles={styles}
                />
              </View>
            ))
          ) : (
            <Text style={styles.hint}>
              {l('No workouts downloaded yet.', 'لم تُنزّل تمارين بعد.')}
            </Text>
          )}
          <View style={styles.toolbar}>
            <Button
              title={l('Previous saved', 'المحفوظة السابقة')}
              disabled={savedOffset === 0}
              onPress={() => {
                cacheOffset.current = Math.max(0, savedOffset - 10)
                void refreshLocal()
              }}
              styles={styles}
            />
            <Text style={styles.hint}>
              {savedTotal ? savedOffset + 1 : 0}–{Math.min(savedOffset + 10, savedTotal)} /{' '}
              {savedTotal}
            </Text>
            <Button
              title={l('Next saved', 'المحفوظة التالية')}
              disabled={savedOffset + 10 >= savedTotal}
              onPress={() => {
                cacheOffset.current = savedOffset + 10
                void refreshLocal()
              }}
              styles={styles}
            />
          </View>
          <Text style={styles.label}>{l('Available to download', 'متاح للتنزيل')}</Text>
          {available.some((p) => savedIds.includes(p.id)) ? (
            <Text style={styles.hint}>
              {l(
                'Already downloaded matches appear in the saved list above. Online pagination includes those matches.',
                'تظهر النتائج المنزّلة في قائمة المحفوظات أعلاه. تشمل صفحات نتائج الخادم تلك النتائج.',
              )}
            </Text>
          ) : null}
          {available
            .filter((p) => !savedIds.includes(p.id))
            .map((p) => (
              <View key={p.id} style={styles.card}>
                <Text style={styles.cardTitle}>{dayName(p)}</Text>
                <Text style={styles.hint}>
                  {p.member_name} · {p.title}
                </Text>
                <Text style={styles.hint}>
                  {p.starts_at
                    ? displayDate(p.starts_at, language)
                    : p.training_date + ' · ' + p.timezone}
                </Text>
                <Button
                  title={l('Download workout', 'تنزيل التمرين')}
                  disabled={busy || onlineLoading || closing}
                  onPress={() => void download(p)}
                  styles={styles}
                />
              </View>
            ))}
          {!available.length && !busy ? (
            <Text style={styles.hint}>
              {l(
                'No actionable individual workouts match. Coaches schedule plan workouts in the web dashboard.',
                'لا توجد تمارين فردية قابلة للتنفيذ تطابق البحث. يجدول المدربون تمارين الخطط في لوحة الويب.',
              )}
            </Text>
          ) : null}
          <View style={styles.toolbar}>
            <Button
              title={l('Previous', 'السابق')}
              disabled={busy || onlineLoading || offset === 0}
              onPress={() => void load(Math.max(0, offset - 10))}
              styles={styles}
            />
            <Text style={styles.hint}>
              {total ? offset + 1 : 0}–{Math.min(offset + 10, total)} / {total}
            </Text>
            <Button
              title={l('Next', 'التالي')}
              disabled={busy || onlineLoading || offset + 10 >= total}
              onPress={() => void load(offset + 10)}
              styles={styles}
            />
          </View>
        </>
      ) : record ? (
        <>
          <Button
            title={l('Back to workouts', 'العودة للتمارين')}
            disabled={busy || persisting}
            onPress={() => void back()}
            styles={styles}
          />
          <Text style={styles.hint}>
            {record.package.member_name} · {record.package.title}
          </Text>
          {record.error ? <Text style={styles.message}>{t(record.error)}</Text> : null}
          {record.blocked ? (
            <Text style={styles.message}>
              {l(
                'Sending is paused. Saved work is retained.',
                'الإرسال متوقف. يبقى العمل المحفوظ محفوظاً.',
              )}
            </Text>
          ) : null}
          {!record.session ? (
            <>
              <Text style={styles.hint}>
                {record.package.starts_at
                  ? displayDate(record.package.starts_at, language)
                  : record.package.training_date + ' · ' + record.package.timezone}
              </Text>
              <Text style={styles.hint}>
                {l(
                  'Start opens at this workout’s scheduled time/date. An offline start will be rechecked during sync.',
                  'يتاح البدء في وقت أو تاريخ التمرين المحدد. يُتحقق من البدء دون اتصال عند المزامنة.',
                )}
              </Text>
              <Button
                title={l('Start on this device', 'البدء على هذا الجهاز')}
                disabled={
                  busy ||
                  closing ||
                  record.blocked ||
                  !record.package.allow_provisional_start ||
                  !startTimeReached(record.package)
                }
                onPress={() => void act('start')}
                styles={styles}
                primary
              />
            </>
          ) : (
            <Text style={styles.label}>
              {record.session.completed_at
                ? l('Completed · server confirmed', 'مكتمل · أكده الخادم')
                : record.intent?.complete || record.pending?.payload.complete
                  ? l(
                      'Finished on device · awaiting server confirmation',
                      'انتهى على الجهاز · بانتظار تأكيد الخادم',
                    )
                  : record.session.version === 0
                    ? l('Started on this device · not confirmed', 'بدأ على هذا الجهاز · غير مؤكد')
                    : l('Server-confirmed start', 'بدء مؤكد من الخادم')}
            </Text>
          )}
          {record.pending ? (
            <Text accessibilityLiveRegion="polite" style={styles.hint}>
              {record.pending.state === 'sending'
                ? l('Sending the exact saved request…', 'جارٍ إرسال الطلب المحفوظ نفسه…')
                : record.pending.state === 'uncertain'
                  ? l(
                      'Confirmation unknown. Retry preserves the exact saved request.',
                      'التأكيد غير معروف. تحتفظ إعادة المحاولة بالطلب المحفوظ نفسه.',
                    )
                  : record.pending.state === 'needs_attention' || record.pending.state === 'blocked'
                    ? l(
                        'Saved work needs review before sending again.',
                        'يلزم مراجعة العمل المحفوظ قبل إعادة الإرسال.',
                      )
                    : l(
                        'Queued on this device; not yet confirmed.',
                        'في قائمة إرسال الجهاز؛ لم يُؤكد بعد.',
                      )}
            </Text>
          ) : null}
          {record.package.exercises.map((ex) => (
            <View key={ex.key} style={styles.card}>
              <Text style={styles.cardTitle}>
                {language === 'ar' && ex.name_ar ? ex.name_ar : ex.name}
              </Text>
              {ex.note ? <Text style={styles.hint}>{ex.note}</Text> : null}
              {entries.map((e, index) =>
                e.exercise_key !== ex.key ? null : (
                  <View key={index} style={{ gap: 8, paddingVertical: 10 }}>
                    <Text style={styles.label}>
                      {l('Set', 'مجموعة')} {e.set_index + 1}
                    </Text>
                    <Text style={styles.hint}>
                      {record.package.targets || !record.package.session
                        ? l('Prescribed target', 'الهدف الموصوف')
                        : l('Downloaded reference', 'القيم المنزّلة')}
                      :{' '}
                      {ex.kind === 'strength'
                        ? `${targetFor(e).reps} × ${targetFor(e).load} ${e.unit}`
                        : ex.kind === 'timed'
                          ? `${targetFor(e).seconds ?? '—'} ${l('seconds', 'ثانية')}`
                          : `${targetFor(e).metres ?? '—'} ${l('metres', 'متر')}`}
                    </Text>
                    {e.exercise_id ? (
                      <Text style={styles.hint}>
                        {l(
                          'Previously selected exercise alternative is retained.',
                          'يُحفظ بديل التمرين المحدد مسبقاً.',
                        )}
                      </Text>
                    ) : null}
                    {(ex.kind === 'strength'
                      ? (['load', 'reps'] as const)
                      : ex.kind === 'timed'
                        ? (['seconds', 'effort'] as const)
                        : (['metres', 'effort'] as const)
                    ).map((field) => (
                      <View key={field} style={{ gap: 6 }}>
                        <Text style={styles.label}>
                          {field === 'load'
                            ? l('Load', 'الحمل') + ' (' + e.unit + ')'
                            : field === 'reps'
                              ? l('Reps', 'تكرارات')
                              : field === 'seconds'
                                ? l('Seconds', 'ثوانٍ')
                                : field === 'metres'
                                  ? l('Metres', 'أمتار')
                                  : l('Effort (RPE, optional)', 'الجهد (اختياري)')}
                        </Text>
                        <TextInput
                          accessibilityLabel={
                            (language === 'ar' && ex.name_ar ? ex.name_ar : ex.name) +
                            ' ' +
                            (e.set_index + 1) +
                            ' ' +
                            fieldLabel(field, e.unit)
                          }
                          style={styles.input}
                          keyboardType="decimal-pad"
                          editable={editable && !busy}
                          value={
                            raw[index + ':' + field] ?? (e[field] === null ? '' : String(e[field]))
                          }
                          onChangeText={(value) => {
                            const key = index + ':' + field,
                              parsed = workoutNumber(field, value)
                            setRaw((previous) => ({ ...previous, [key]: value }))
                            setInvalidInputs((previous) => ({ ...previous, [key]: !parsed.valid }))
                            if (!parsed.valid) {
                              setError(
                                l(
                                  'Check the numeric value and its limits.',
                                  'تحقق من القيمة الرقمية وحدودها.',
                                ),
                              )
                              return
                            }
                            setError('')
                            edit(
                              drafts.current.entries.map((r, i) =>
                                i === index ? { ...r, [field]: parsed.value, completed: false } : r,
                              ),
                              drafts.current.note,
                            )
                          }}
                        />
                      </View>
                    ))}
                    <Button
                      title={
                        e.completed
                          ? l('Done ✓', 'تم ✓')
                          : l('Mark set done', 'تأكيد إتمام المجموعة')
                      }
                      disabled={!editable || busy || invalidInput}
                      primary={e.completed}
                      onPress={() =>
                        edit(
                          drafts.current.entries.map((r, i) =>
                            i === index ? { ...r, completed: !r.completed } : r,
                          ),
                          drafts.current.note,
                        )
                      }
                      styles={styles}
                    />
                  </View>
                ),
              )}
              <Text style={styles.hint}>
                {l('Rest (seconds)', 'الراحة (ثوانٍ)')}: {ex.rest}
              </Text>
            </View>
          ))}
          <Text style={styles.label}>{l('Workout note', 'ملاحظة التمرين')}</Text>
          <TextInput
            accessibilityLabel={l('Workout note', 'ملاحظة التمرين')}
            multiline
            maxLength={2000}
            value={note}
            editable={editable && !busy}
            onChangeText={(value) => edit(drafts.current.entries, value)}
            style={styles.input}
          />
          {record.session && !record.session.completed_at ? (
            <View style={styles.toolbar}>
              <Button
                title={l('Save progress for sync', 'حفظ التقدم للمزامنة')}
                disabled={
                  busy ||
                  persisting ||
                  invalidInput ||
                  closing ||
                  !editable ||
                  !!record.intent ||
                  record.pending?.payload.action === 'save'
                }
                onPress={() => void act('save')}
                styles={styles}
              />
              <Button
                title={l('Finish workout for sync', 'إنهاء التمرين للمزامنة')}
                disabled={
                  busy ||
                  persisting ||
                  closing ||
                  !editable ||
                  !!record.intent ||
                  record.pending?.payload.action === 'save'
                }
                onPress={() => void act('finish')}
                styles={styles}
                primary
              />
            </View>
          ) : null}
          {record.pending && record.pending.state !== 'sending' ? (
            <Button
              title={l('Retry exact saved request', 'إعادة إرسال الطلب المحفوظ نفسه')}
              disabled={busy || closing}
              onPress={() => void act('retry')}
              styles={styles}
            />
          ) : null}
          {(record.pending?.state === 'needs_attention' &&
            record.pending.payload.action === 'save') ||
          (!record.pending && record.session && record.localRevision !== record.syncedRevision) ? (
            <Button
              title={l('Review current server version', 'مراجعة نسخة الخادم الحالية')}
              disabled={busy || persisting || closing}
              onPress={() => void reviewRejected()}
              styles={styles}
            />
          ) : null}
          {record.blocked && !record.pending && record.session ? (
            <Button
              title={l('Recheck workout access', 'إعادة التحقق من صلاحية التمرين')}
              disabled={busy || persisting || closing}
              onPress={() => void act('access')}
              styles={styles}
            />
          ) : null}
          <Button
            title={l('Share recovery copy', 'مشاركة نسخة للاستعادة')}
            disabled={persisting || busy}
            onPress={() => void share()}
            styles={styles}
          />
          <Button
            title={l('Refresh saved workout', 'تحديث التمرين المحفوظ')}
            disabled={
              busy ||
              persisting ||
              closing ||
              !!record.pending ||
              !!record.intent ||
              record.localRevision !== record.syncedRevision
            }
            onPress={() => void refreshSaved()}
            styles={styles}
          />
          <Text style={styles.hint}>
            {l(
              'If a conflict or restriction prevents sync, keep this copy and review the workout with authorized staff in the web dashboard. Do not start a replacement workout.',
              'إذا منع تعارض أو قيد المزامنة، احتفظ بهذه النسخة وراجع التمرين مع الموظفين المخولين في لوحة الويب. لا تبدأ تمريناً بديلاً.',
            )}
          </Text>
        </>
      ) : null}
    </ScrollView>
  )
}
