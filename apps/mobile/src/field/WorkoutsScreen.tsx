import { WorkoutExercises } from './WorkoutExercises'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  AppState,
  BackHandler,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native'
import type { WorkoutAgenda } from '@rafik/shared/contracts'
import { useLanguage } from './Language'
import { NativeClient, operationId } from './native'
import type { FieldStore } from './store'
import { ApiFailure, ConnectionFailure, failureText, type Owner } from './model'
import {
  startTimeReached,
  validateEntries,
  type FieldWorkoutEntry,
  type FieldWorkoutPackage,
  type WorkoutRecord,
} from './workout-model'
import { downloadGroupEvent } from './group-download'
import { WorkoutSync, requireWorkoutSupport } from './workout-sync'
import { workoutNumber, type WorkoutMeasure } from './workout-input'
import { Button, Icon, displayDate, type Styles } from './ui'
import { FieldEmptyState } from './FieldEmptyState'

/** Downloads and records individual workouts, keeping drafts safe while offline or syncing. */
export function WorkoutsScreen({
  client,
  store,
  owner,
  styles,
  closing,
  onPersisting,
  active,
  groupEvent,
  groupTitle,
  presentAthletes,
  initialPackage,
  closeSignal,
  onBackToSchedule,
  refreshSignal,
  onRefreshComplete,
  onBackToEvent,
  onFinishEvent,
  eventCanFinish,
  eventFinishing,
  eventCompleted,
  onDetailChange,
  onConnectivity,
  connectionState,
}: {
  client: NativeClient
  store: FieldStore
  owner: Owner
  styles: Styles
  closing: boolean
  onPersisting: (busy: boolean) => void
  active: boolean
  groupEvent?: string
  groupTitle?: string
  presentAthletes?: string[]
  initialPackage?: FieldWorkoutPackage | null
  closeSignal?: number
  onBackToSchedule?: () => void
  refreshSignal?: number
  onRefreshComplete?: () => void
  onBackToEvent?: () => void
  onFinishEvent?: () => void
  eventCanFinish?: boolean
  eventFinishing?: boolean
  eventCompleted?: boolean
  onDetailChange?: (open: boolean) => void
  onConnectivity?: (state: 'online' | 'offline') => void
  connectionState?: 'unknown' | 'online' | 'offline'
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
  const [showConnection, setShowConnection] = useState(false)
  const [showRecovery, setShowRecovery] = useState(false)
  const [groupPackages, setGroupPackages] = useState<FieldWorkoutPackage[]>([])
  const [groupOpen, setGroupOpen] = useState(false)
  const [groupStage, setGroupStage] = useState<'preview' | 'record'>('preview')
  const [raw, setRaw] = useState<Record<string, string>>({}),
    [storageFailed, setStorageFailed] = useState(false)
  const [invalidInputs, setInvalidInputs] = useState<Record<string, boolean>>({})
  const invalidInput = Object.values(invalidInputs).some(Boolean)
  const dayName = (p: FieldWorkoutPackage) =>
    language === 'ar' && p.day_name_ar ? p.day_name_ar : p.day_name
  const alive = useRef(true),
    selection = useRef(''),
    flight = useRef(false),
    reads = useRef(0),
    runner = useRef<WorkoutSync | null>(null)
  const drafts = useRef({ entries: [] as FieldWorkoutEntry[], note: '' }),
    // Keep device edits ordered; commands and view changes wait for this chain before reading the record.
    writes = useRef(Promise.resolve()),
    editSerial = useRef(0)
  const closingRef = useRef(closing)
  closingRef.current = closing
  const activeRef = useRef(active),
    backAction = useRef(() => {})
  const page = useRef<ScrollViewInstance>(null)
  activeRef.current = active
  useEffect(() => {
    if (record?.session?.completed_at) {
      setNotice('')
      page.current?.scrollTo({ y: 0, animated: true })
    }
  }, [record?.session?.completed_at])
  useEffect(() => {
    if (!active || !selected) return
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      backAction.current()
      return true
    })
    return () => listener.remove()
  }, [active, selected])
  useEffect(() => onDetailChange?.(!!selected), [selected, onDetailChange])
  async function refreshLocal() {
    // Ignore slower count/page reads when a newer search or local refresh has already started.
    const token = ++localRead.current
    const needle = appliedSearch.current,
      requested = cacheOffset.current
    if (groupEvent) {
      const items = await store.workouts.groupList(owner, groupEvent)
      const activeId = selection.current
      const active = activeId ? await store.workouts.get(owner, activeId) : null
      if (!alive.current || token !== localRead.current) return
      setSaved(items)
      setSavedIds(items.map((item) => item.package.id))
      if (selection.current === activeId) setRecord(active)
      return
    }
    const count = await store.workouts.count(owner, needle)
    if (!alive.current || token !== localRead.current || needle !== appliedSearch.current) return
    const page = Math.min(requested, Math.max(0, Math.floor((count - 1) / 10) * 10))
    cacheOffset.current = page
    const items = await store.workouts.list(owner, page, needle)
    const ids = await store.workouts.ids(owner)
    const activeId = selection.current
    const active = activeId ? await store.workouts.get(owner, activeId) : null
    if (!alive.current || token !== localRead.current) return
    setSaved((prior) =>
      page
        ? [
            ...prior,
            ...items.filter((item) => !prior.some((known) => known.package.id === item.package.id)),
          ]
        : items,
    )
    setSavedTotal(count)
    setSavedOffset(page)
    setSavedIds(ids)
    if (selection.current === activeId) setRecord(active)
  }
  async function sync(manual = false) {
    try {
      const queued = manual ? await store.workouts.next(owner) : null
      await runner.current?.run(() => {
        void refreshLocal().catch((e) => {
          if (alive.current) setError(failureText(e))
        })
      })
      await refreshLocal()
      if (manual && alive.current) {
        const latest = queued ? await store.workouts.get(owner, queued.package.id) : null
        setNotice(
          latest?.pending
            ? l(
                'Still saved on this device. Check the connection or review the message below.',
                'ما زال محفوظاً على هذا الجهاز. تحقق من الاتصال أو راجع الرسالة أدناه.',
              )
            : '',
        )
      }
    } catch (e) {
      if (alive.current) setError(failureText(e))
    }
  }
  async function load(page = 0, query = search) {
    if (flight.current || closingRef.current) return
    flight.current = true
    setOnlineLoading(true)
    setError('')
    const token = ++reads.current
    const needle = query.trim().slice(0, 100)
    if (needle !== appliedSearch.current) {
      page = 0
      cacheOffset.current = 0
      appliedSearch.current = needle
    }
    try {
      await refreshLocal()
      if (!groupEvent) await requireWorkoutSupport((path) => client.request(path))
      const group = groupEvent ? await downloadGroupEvent(client, store, owner, groupEvent) : null
      const result = groupEvent
        ? null
        : await client.request<WorkoutAgenda>(
            `/institution/workout-scheduling?view=trainer&queue=actionable&fieldPackages=true&search=${encodeURIComponent(needle)}&offset=${page}&limit=10`,
          )
      if (alive.current && token === reads.current) {
        if (group) {
          setGroupPackages(group.packages)
          if (group.errors.length) setError(group.errors[0])
          await refreshLocal()
        }
        if (result) {
          const pageItems = result.items.flatMap((i) => (i.field_workout ? [i.field_workout] : []))
          setAvailable((prior) =>
            page
              ? [
                  ...prior,
                  ...pageItems.filter((item) => !prior.some((known) => known.id === item.id)),
                ]
              : pageItems,
          )
          setOffset(result.offset)
          setTotal(result.total)
        }
      }
    } catch (e) {
      if (e instanceof ApiFailure && [401, 403].includes(e.status)) {
        await store.workouts.block(owner)
        if (alive.current) setAvailable([])
        await refreshLocal()
      }
      if (e instanceof ConnectionFailure) onConnectivity?.('offline')
      else if (alive.current) setError(failureText(e))
    } finally {
      flight.current = false
      if (alive.current) setOnlineLoading(false)
    }
  }
  useEffect(() => {
    if (!refreshSignal) return
    if (!active) {
      if (groupEvent) return
      void sync(true).finally(onRefreshComplete)
      return
    }
    const refreshVisible = async () => {
      if (groupEvent || !selection.current) {
        await sync(true)
        return load()
      }
      const id = selection.current
      await sync(true)
      if (!activeRef.current || selection.current !== id) return
      const current = await store.workouts.get(owner, id)
      if (!current.pending && !current.intent && current.localRevision === current.syncedRevision)
        await refreshSaved(current)
    }
    void refreshVisible()
      .catch((e) => {
        if (alive.current) setError(failureText(e))
      })
      .finally(onRefreshComplete)
  }, [refreshSignal])
  // The recorder stays mounted under Schedule so its draft survives navigation.
  // Fetch the browse list when the coach opens it without a selected day workout.
  useEffect(() => {
    if (active && !initialPackage && !groupEvent && !selected && !available.length) void load()
  }, [active, initialPackage?.id, groupEvent])
  useEffect(() => {
    alive.current = true
    const active = new WorkoutSync(store.workouts, owner, async (path, body, group) => {
      await requireWorkoutSupport((path) => client.request(path), group)
      return client.request(path, { method: 'POST', body })
    })
    runner.current = active
    void refreshLocal()
      .then(() => {
        void sync()
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
  }, [client, store, owner, groupEvent])
  useEffect(() => {
    if (closing) runner.current?.stop()
  }, [closing])
  useEffect(() => {
    onPersisting(persisting || storageFailed || invalidInput)
    return () => onPersisting(false)
  }, [persisting, storageFailed, invalidInput, onPersisting])
  async function open(id: string) {
    if (invalidInput || storageFailed)
      throw Error('Correct or save the current sheet before switching athletes.')
    await writes.current
    const r = await store.workouts.get(owner, id)
    if (!alive.current) return
    selection.current = id
    setSelected(id)
    onDetailChange?.(true)
    setShowRecovery(false)
    if (groupEvent) setGroupOpen(false)
    setRecord(r)
    drafts.current = { entries: r.entries.map((e) => ({ ...e })), note: r.note }
    setEntries(drafts.current.entries)
    setNote(r.note)
    setRaw({})
    setInvalidInputs({})
    setNotice('')
    setError('')
  }
  useEffect(() => {
    if (!active || !initialPackage || groupEvent || onlineLoading) return
    void store.workouts
      .ids(owner)
      .then((ids) =>
        ids.includes(initialPackage.id) ? open(initialPackage.id) : download(initialPackage),
      )
      .catch((error) => {
        if (alive.current) setError(failureText(error))
      })
  }, [active, initialPackage?.id, groupEvent, onlineLoading])
  useEffect(() => {
    if (closeSignal) void back()
  }, [closeSignal])
  async function download(p: FieldWorkoutPackage) {
    if (flight.current) return
    flight.current = true
    setBusy(true)
    setError('')
    try {
      const r = await store.workouts.put(owner, p)
      await refreshLocal()
      if (alive.current) {
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
      } else if (action === 'finish') await store.workouts.queueFinish(owner, id, operationId())
      else await store.workouts.save(owner, id, false, operationId())
      await refreshLocal()
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
      onDetailChange?.(false)
      setShowRecovery(false)
      if (groupEvent) setGroupStage('preview')
      setRecord(null)
      setError('')
      await refreshLocal()
      if (initialPackage && !groupEvent) onBackToSchedule?.()
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
  async function refreshSaved(source = record) {
    if (!source) return
    const original = source,
      id = source.package.id
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
        const found = original.package.group
          ? (
              await client.request<{
                participants: { field_workout?: FieldWorkoutPackage }[]
              }>(
                `/institution/group-workouts?view=trainer&event=${original.package.group.event_id}&fieldPackages=true`,
              )
            ).participants.find((person) => person.field_workout?.id === id)?.field_workout
          : (
              await client.request<WorkoutAgenda>(
                `/institution/workout-scheduling?view=trainer&fieldPackages=true&assignment=${original.package.assignment_id}`,
              )
            ).items.find((item) => item.field_workout?.id === id)?.field_workout
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
  function changeMeasure(index: number, field: WorkoutMeasure, value: string) {
    const key = index + ':' + field,
      parsed = workoutNumber(field, value)
    setRaw((previous) => ({ ...previous, [key]: value }))
    setInvalidInputs((previous) => ({ ...previous, [key]: !parsed.valid }))
    if (!parsed.valid) {
      setError(l('Check the numeric value and its limits.', 'تحقق من القيمة الرقمية وحدودها.'))
      return
    }
    setError('')
    edit(
      drafts.current.entries.map((r, i) =>
        i === index ? { ...r, [field]: parsed.value, completed: false } : r,
      ),
      drafts.current.note,
    )
  }
  function toggleSet(index: number) {
    edit(
      drafts.current.entries.map((r, i) => (i === index ? { ...r, completed: !r.completed } : r)),
      drafts.current.note,
    )
  }
  const editable =
    !!record?.session &&
    !record.blocked &&
    !record.session.completed_at &&
    !record.intent?.complete &&
    !record.completionIntent &&
    !record.pending?.payload.complete &&
    (record.package.can_record || record.session.version === 0)
  const groupItems = [
    ...groupPackages,
    ...saved
      .filter((item) => !groupPackages.some((p) => p.id === item.package.id))
      .map((item) => item.package),
  ].filter((item) => !groupEvent || presentAthletes?.includes(item.member_id))
  const preview = groupItems[0]
  async function beginGroupRecording() {
    if (!preview) return
    try {
      if (!saved.some((item) => item.package.id === preview.id)) {
        await store.workouts.put(owner, preview)
        await refreshLocal()
      }
      await open(preview.id)
      setGroupOpen(false)
      setGroupStage('record')
    } catch (e) {
      setError(failureText(e))
    }
  }
  if (groupEvent && groupStage === 'preview')
    return (
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{l('Today’s workout', 'تمرين اليوم')}</Text>
        <Text style={styles.hint}>{groupTitle}</Text>
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
        {preview ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {language === 'ar' && preview.day_name_ar ? preview.day_name_ar : preview.day_name}
            </Text>
            <Text style={styles.hint}>
              {preview.exercises.length} {l('exercises', 'تمارين')} · {groupItems.length}{' '}
              {l('athletes', 'رياضيين')}
            </Text>
            {preview.exercises.map((exercise) => (
              <Text key={exercise.key} style={styles.hint}>
                • {language === 'ar' && exercise.name_ar ? exercise.name_ar : exercise.name}
                {' · '}
                {preview.entries.filter((entry) => entry.exercise_key === exercise.key).length}{' '}
                {l('sets', 'مجموعات')}
              </Text>
            ))}
          </View>
        ) : (
          <Text style={styles.hint}>{l('Loading the workout…', 'جارٍ تحميل التمرين…')}</Text>
        )}
        <Button
          title={l('Open first athlete’s workout', 'افتح تمرين أول رياضي')}
          disabled={!preview || busy || onlineLoading || persisting || storageFailed || closing}
          onPress={() => void beginGroupRecording()}
          styles={styles}
          primary
        />
      </ScrollView>
    )
  return (
    <View style={{ flex: 1 }}>
      {groupEvent ? (
        <View style={styles.athleteSwitcher}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={l('Change athlete', 'تغيير الرياضي')}
            accessibilityState={{ expanded: groupOpen }}
            onPress={() => setGroupOpen((value) => !value)}
            style={{
              minHeight: 48,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text style={styles.label}>
              {record?.package.member_name || l('Choose an athlete', 'اختر رياضياً')}
            </Text>
            <Icon name={groupOpen ? 'collapse' : 'down'} styles={styles} size={18} />
          </Pressable>
          {groupOpen ? (
            <View style={{ maxHeight: 240 }}>
              <TextInput
                accessibilityLabel={l('Find an athlete', 'ابحث عن رياضي')}
                placeholder={l('Search athletes…', 'ابحث عن الرياضيين…')}
                placeholderTextColor={styles.hint.color}
                value={search}
                onChangeText={setSearch}
                style={styles.input}
              />
              <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                {groupItems
                  .filter((p) =>
                    p.member_name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
                  )
                  .map((p) => (
                    <Pressable
                      key={p.id}
                      accessibilityRole="button"
                      accessibilityState={{
                        selected: selected === p.id,
                        disabled: busy || persisting || invalidInput || storageFailed,
                      }}
                      disabled={
                        busy || persisting || invalidInput || storageFailed || selected === p.id
                      }
                      onPress={() =>
                        void (saved.some((item) => item.package.id === p.id)
                          ? open(p.id)
                          : download(p))
                      }
                      style={{
                        minHeight: 48,
                        justifyContent: 'center',
                        borderTopWidth: 1,
                        borderColor: styles.input.borderColor,
                      }}
                    >
                      <Text style={styles.label}>{p.member_name}</Text>
                      <Text style={styles.hint}>
                        {saved.find((item) => item.package.id === p.id)?.session?.completed_at
                          ? l('Complete', 'مكتمل')
                          : selected === p.id
                            ? l('Current athlete', 'الرياضي الحالي')
                            : l('Open workout', 'فتح التمرين')}
                      </Text>
                    </Pressable>
                  ))}
              </ScrollView>
            </View>
          ) : null}
        </View>
      ) : null}
      <ScrollView
        ref={page}
        contentContainerStyle={[styles.content, !selected && !groupEvent && { paddingBottom: 96 }]}
        keyboardShouldPersistTaps="handled"
      >
        {!groupEvent ? (
          <Text style={styles.title}>
            {selected ? (record ? dayName(record.package) : '') : l('Workouts', 'التمارين')}
          </Text>
        ) : null}
        {record ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={l('Workout options', 'خيارات التمرين')}
              accessibilityState={{ expanded: showRecovery }}
              onPress={() => setShowRecovery(true)}
              style={styles.headerIcon}
            >
              <Icon name="more" styles={styles} />
            </Pressable>
          </View>
        ) : null}
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
        {notice && !error ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={l('Dismiss sync notice', 'إخفاء تنبيه المزامنة')}
            onPress={() => setNotice('')}
            style={styles.compactNotice}
          >
            <Text accessibilityLiveRegion="polite" style={[styles.hint, { flex: 1 }]}>
              {notice}
            </Text>
            <Icon name="close" styles={styles} size={18} />
          </Pressable>
        ) : null}
        {busy || (onlineLoading && !selected) ? (
          <ActivityIndicator
            accessibilityLabel={l('Loading workout data', 'جارٍ تحميل بيانات التمرين')}
          />
        ) : null}
        {!selected && !groupEvent ? (
          <>
            <Text style={styles.hint}>
              {l(
                'Browse individual plan workouts. Download one while connected to use it offline.',
                'تصفح تمارين الخطط الفردية. نزّل التمرين أثناء الاتصال لاستخدامه دون اتصال.',
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
            {[
              ...saved.map((record) => ({ record, workout: record.package, downloaded: true })),
              ...available
                .filter((workout) => !saved.some((item) => item.package.id === workout.id))
                .map((workout) => ({
                  record: null,
                  workout,
                  downloaded: savedIds.includes(workout.id),
                })),
            ]
              .sort(
                (a, b) =>
                  b.workout.training_date.localeCompare(a.workout.training_date) ||
                  a.workout.member_name.localeCompare(b.workout.member_name),
              )
              .map(({ record: local, workout, downloaded }) => (
                <Pressable
                  key={workout.id}
                  style={styles.card}
                  accessibilityRole="button"
                  accessibilityLabel={`${downloaded ? l('Open workout', 'فتح التمرين') : l('Download workout', 'تنزيل التمرين')} ${dayName(workout)}`}
                  disabled={busy || closing}
                  onPress={() =>
                    void (downloaded ? open(workout.id) : download(workout)).catch((e) =>
                      setError(failureText(e)),
                    )
                  }
                >
                  <Text style={styles.cardTitle}>{dayName(workout)}</Text>
                  <Text style={styles.hint}>
                    {workout.member_name} · {workout.title}
                  </Text>
                  <Text style={styles.hint}>
                    {workout.starts_at
                      ? displayDate(workout.starts_at, language)
                      : `${workout.training_date} · ${workout.timezone}`}
                  </Text>
                  <Text style={styles.link}>
                    {local
                      ? local.session?.completed_at
                        ? l('Downloaded · complete', 'منزّل · مكتمل')
                        : local.pending || local.intent || local.completionIntent
                          ? l('Downloaded · awaiting sync', 'منزّل · بانتظار المزامنة')
                          : l('Downloaded', 'تم التنزيل')
                      : downloaded
                        ? l('Downloaded', 'تم التنزيل')
                        : l('Not downloaded', 'غير منزّل')}
                  </Text>
                </Pressable>
              ))}
            {!saved.length && !available.length && !busy && !onlineLoading && !error ? (
              <FieldEmptyState
                icon="workout"
                title={
                  connectionState === 'offline' && !search
                    ? l('No workouts saved on this device', 'لا توجد تمارين محفوظة على هذا الجهاز')
                    : l('No workouts to show', 'لا توجد تمارين للعرض')
                }
                description={
                  connectionState === 'offline' && !search
                    ? l('Connect to browse and download workouts.', 'اتصل لتصفح التمارين وتنزيلها.')
                    : l(
                        'Try another athlete name. Group sessions remain in Schedule.',
                        'جرّب اسم رياضي آخر. تبقى المواعيد الجماعية في الجدول.',
                      )
                }
                action={search ? l('Clear search', 'مسح البحث') : undefined}
                onAction={
                  search
                    ? () => {
                        setSearch('')
                        void load(0, '')
                      }
                    : undefined
                }
                styles={styles}
              />
            ) : null}
            {offset + 10 < total || savedOffset + 10 < savedTotal ? (
              <Button
                title={l('Load more workouts', 'عرض المزيد من التمارين')}
                disabled={busy || onlineLoading || closing}
                onPress={() => {
                  if (offset + 10 < total) void load(offset + 10)
                  else {
                    cacheOffset.current = savedOffset + 10
                    void refreshLocal()
                  }
                }}
                styles={styles}
              />
            ) : null}
          </>
        ) : record ? (
          <>
            {!groupEvent ? (
              <Button
                title={
                  initialPackage
                    ? l('Back to schedule', 'العودة إلى الجدول')
                    : l('Back to workouts', 'العودة للتمارين')
                }
                disabled={busy || persisting}
                onPress={() => void back()}
                styles={styles}
              />
            ) : null}
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
                  : record.intent?.complete ||
                      record.completionIntent ||
                      record.pending?.payload.complete
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
                    : record.pending.state === 'needs_attention' ||
                        record.pending.state === 'blocked'
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
            {record.session?.completed_at ? (
              <>
                <View style={[styles.card, styles.completedCard]}>
                  <View style={[styles.actions, { alignItems: 'center' }]}>
                    <Icon name="completion" styles={styles} size={20} />
                    <Text style={styles.cardTitle}>{l('Workout complete', 'اكتمل التمرين')}</Text>
                  </View>
                  <Text style={styles.hint}>
                    {displayDate(record.session.completed_at, language)} ·{' '}
                    {record.package.member_name}
                    {' · '}
                    {entries.filter((entry) => entry.completed).length}/{entries.length}{' '}
                    {l('sets recorded', 'مجموعات مسجلة')}
                  </Text>
                  <Text style={styles.hint}>
                    {l('Confirmed by your institution.', 'أكدته مؤسستك.')}
                  </Text>
                </View>
                <Button
                  title={
                    groupEvent
                      ? l('Back to attendance', 'العودة إلى الحضور')
                      : initialPackage
                        ? l('Back to schedule', 'العودة إلى الجدول')
                        : l('Back to workouts', 'العودة إلى التمارين')
                  }
                  onPress={() => (groupEvent ? onBackToEvent?.() : void back())}
                  styles={styles}
                  primary
                />
              </>
            ) : null}
            {!record.session?.completed_at &&
            (record.intent?.complete ||
              record.completionIntent ||
              record.pending?.payload.complete) ? (
              <>
                <View style={[styles.card, styles.completedCard]}>
                  <View style={[styles.actions, { alignItems: 'center' }]}>
                    <Icon name="completion" styles={styles} size={20} />
                    <Text style={styles.cardTitle}>
                      {l('Finished on this device', 'انتهى على هذا الجهاز')}
                    </Text>
                  </View>
                  <Text style={styles.hint}>
                    {entries.filter((entry) => entry.completed).length}/{entries.length}{' '}
                    {l('sets recorded', 'مجموعات مسجلة')}
                    {' · '}
                    {l('Awaiting server confirmation', 'بانتظار تأكيد الخادم')}
                  </Text>
                </View>
                <Button
                  title={
                    groupEvent
                      ? l('Return to event', 'العودة إلى الموعد')
                      : l('Return to workouts', 'العودة إلى التمارين')
                  }
                  onPress={() => (groupEvent ? onBackToEvent?.() : void back())}
                  styles={styles}
                  primary
                />
              </>
            ) : null}
            <WorkoutExercises
              workout={record.package}
              entries={entries}
              raw={raw}
              editable={editable}
              busy={busy}
              invalidInput={invalidInput}
              styles={styles}
              onMeasure={changeMeasure}
              onToggle={toggleSet}
            />
            <Text style={styles.label}>
              {l('Workout note (optional)', 'ملاحظة التمرين (اختيارية)')}
            </Text>
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
              <View style={{ gap: 8 }}>
                <Text style={styles.cardTitle}>{l('Ready to finish?', 'جاهز للإنهاء؟')}</Text>
                <Text style={styles.hint}>
                  {l(
                    'Every change is saved on this phone. Finish works offline and sends your results when connected.',
                    'يُحفظ كل تغيير على هذا الهاتف. يمكنك الإنهاء دون اتصال وستُرسل النتائج عند الاتصال.',
                  )}
                </Text>
                <View style={styles.actions}>
                  <Button
                    title={l('Finish workout', 'إنهاء التمرين')}
                    disabled={
                      busy ||
                      persisting ||
                      closing ||
                      !editable ||
                      !!record.intent?.complete ||
                      !!record.completionIntent ||
                      !!record.pending?.payload.complete
                    }
                    onPress={() => void act('finish')}
                    styles={styles}
                    primary
                  />
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showConnection }}
                  onPress={() => setShowConnection((open) => !open)}
                  style={{ minHeight: 44, justifyContent: 'center' }}
                >
                  <View style={[styles.actions, { alignItems: 'center' }]}>
                    <Text style={styles.link}>
                      {l('Sync unfinished progress', 'مزامنة التقدم غير المكتمل')}
                    </Text>
                    <Icon name={showConnection ? 'collapse' : 'down'} styles={styles} size={18} />
                  </View>
                </Pressable>
                {showConnection ? (
                  <Button
                    title={l('Send progress now', 'إرسال التقدم الآن')}
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
                ) : null}
              </View>
            ) : null}
            {record.blocked || record.pending?.state === 'needs_attention' ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowRecovery(true)}
                style={{ minHeight: 44, justifyContent: 'center' }}
              >
                <Text style={styles.link}>{l('Review saved work', 'مراجعة العمل المحفوظ')}</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
        {groupEvent && !eventCompleted ? (
          <View style={{ gap: 8 }}>
            <Text style={styles.cardTitle}>
              {l('Ready to close this event?', 'جاهز لإنهاء هذا الموعد؟')}
            </Text>
            <Text style={styles.hint}>
              {l(
                'Finish each present athlete’s workout and wait for confirmation before closing the event. You can leave and continue later at any time.',
                'أكمل تمرين كل رياضي حاضر وانتظر التأكيد قبل إنهاء الموعد. يمكنك المغادرة والمتابعة لاحقاً في أي وقت.',
              )}
            </Text>
            <Button
              title={
                eventFinishing
                  ? l('Closing event…', 'جارٍ إنهاء الموعد…')
                  : l('Finish event', 'إنهاء الموعد')
              }
              disabled={!eventCanFinish || busy || persisting || closing}
              onPress={() => onFinishEvent?.()}
              styles={styles}
              primary
            />
          </View>
        ) : null}
      </ScrollView>
      {showRecovery && record ? (
        <View style={styles.sheetBackdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={l('Close workout options', 'إغلاق خيارات التمرين')}
            onPress={() => setShowRecovery(false)}
            style={{ flex: 1 }}
          />
          <View style={{ maxHeight: '82%' }}>
            <ScrollView
              contentContainerStyle={styles.filterSheet}
              keyboardShouldPersistTaps="handled"
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text style={styles.cardTitle}>{l('Workout options', 'خيارات التمرين')}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={l('Close workout options', 'إغلاق خيارات التمرين')}
                  onPress={() => setShowRecovery(false)}
                  style={styles.headerIcon}
                >
                  <Icon name="close" styles={styles} />
                </Pressable>
              </View>
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
              (!record.pending &&
                record.session &&
                record.localRevision !== record.syncedRevision) ? (
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
              {!groupEvent ? (
                <Button
                  title={l('Remove downloaded copy', 'إزالة النسخة المنزّلة')}
                  danger
                  disabled={
                    busy ||
                    persisting ||
                    closing ||
                    !!record.pending ||
                    !!record.intent ||
                    record.localRevision !== record.syncedRevision
                  }
                  onPress={() => remove(record.package.id)}
                  styles={styles}
                />
              ) : null}
              <Text style={styles.hint}>
                {l(
                  'If sync is blocked, keep this copy and review it with authorized staff. Do not start a replacement.',
                  'إذا توقفت المزامنة، احتفظ بهذه النسخة وراجعها مع الموظفين المخولين. لا تبدأ تمريناً بديلاً.',
                )}
              </Text>
            </ScrollView>
          </View>
        </View>
      ) : null}
    </View>
  )
}
