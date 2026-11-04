import { RecoveryPanel } from './RecoveryPanel'
import { EventHistory } from './EventHistory'
import { useLanguage } from './Language'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  BackHandler,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { NativeClient, operationId } from './native'
import {
  ApiFailure,
  ConnectionFailure,
  failureText,
  fieldEvent,
  fieldRoster,
  finishProblems,
  stateText,
  type CachedRoster,
  type Command,
  type EventSnapshot,
  type FieldAttendance,
  type FieldEvent,
  type FieldCommand,
  type Owner,
} from './model'
import type { FieldStore } from './store'
import { AttendanceSync } from './sync'
import {
  ActionBar,
  Button,
  Field,
  Icon,
  IconButton,
  Notice,
  Progress,
  ProgressHeading,
  Segmented,
  SectionLabel,
  StatusPill,
  displayDate,
  displayTime,
  localDate,
  shiftDay,
  type Styles,
  type Tone,
} from './ui'
import { ScoreEditor } from './ScoreEditor'
import { WorkoutsScreen } from './WorkoutsScreen'
import { FieldBottomNav, type FieldTab } from './FieldBottomNav'
import { FieldEmptyState } from './FieldEmptyState'
import { FieldDatePicker } from './FieldDatePicker'
import { ConnectionStatus } from './ConnectionStatus'
import { downloadGroupEvent } from './group-download'
import type { FieldWorkoutPackage, WorkoutRecord } from './workout-model'
import type { WorkoutAgenda } from '@rafik/shared/contracts'

/** Main field screen: loads event rosters, records attendance and syncs changes. */
export function InstitutionScreen({
  client,
  store,
  institution,
  styles,
  closing,
  onPersisting,
  accountOpen,
  onAccountPress,
  onEventOpen,
  externalNotice,
  settingsSyncSignal,
  savedRefreshSignal,
  onSettingsSyncComplete,
  connectionState,
  onConnectivity,
}: {
  client: NativeClient
  store: FieldStore
  institution: string
  styles: Styles
  closing: boolean
  onPersisting: (busy: boolean) => void
  accountOpen: boolean
  onAccountPress: () => void
  onEventOpen: () => void
  externalNotice?: boolean
  settingsSyncSignal?: number
  savedRefreshSignal?: number
  onSettingsSyncComplete?: () => void
  connectionState: 'unknown' | 'online' | 'offline'
  onConnectivity: (state: 'online' | 'offline') => void
}) {
  const { t, l, language } = useLanguage()
  const [owner] = useState<Owner>(() => ({
    instance: client.instance,
    user: client.user.id,
    institution,
  }))
  const runner = useRef<AttendanceSync | null>(null)
  const [events, setEvents] = useState<FieldEvent[]>([])
  const [cached, setCached] = useState<CachedRoster[]>([])
  const [queueHead, setQueueHead] = useState<Command | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<EventSnapshot | null>(null)
  const [onlineRoster, setOnlineRoster] = useState<ReturnType<typeof fieldRoster> | null>(null)
  const [next, setNext] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [refreshingSchedule, setRefreshingSchedule] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draftSaving, setDraftSaving] = useState(false)
  const [editor, setEditor] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [showMessageDetails, setShowMessageDetails] = useState(false)
  useEffect(() => setShowMessageDetails(false), [message])
  const [workoutView, setWorkoutView] = useState(false)
  const [workoutDetail, setWorkoutDetail] = useState(false)
  const [homeTab, setHomeTab] = useState<FieldTab>('schedule')
  const [soloPackage, setSoloPackage] = useState<FieldWorkoutPackage | null>(null)
  const [soloCloseSignal, setSoloCloseSignal] = useState(0)
  const [dayWorkouts, setDayWorkouts] = useState<FieldWorkoutPackage[]>([])
  const [savedDayWorkouts, setSavedDayWorkouts] = useState<WorkoutRecord[]>([])
  const [savedRecords, setSavedRecords] = useState<WorkoutRecord[]>([])
  const [savedRecordTotal, setSavedRecordTotal] = useState(0)
  const [savedGroupIds, setSavedGroupIds] = useState<string[]>([])
  const [savedReady, setSavedReady] = useState(false)
  const [savedError, setSavedError] = useState('')
  const [savedLimit, setSavedLimit] = useState(20)
  const [savedFilter, setSavedFilter] = useState<'all' | 'workouts' | 'events' | 'assessments'>(
    'all',
  )
  const [workoutTotal, setWorkoutTotal] = useState(0)
  const [workoutFetched, setWorkoutFetched] = useState(0)
  const [workoutLoading, setWorkoutLoading] = useState(false)
  const [workoutError, setWorkoutError] = useState('')
  const [groupEvent, setGroupEvent] = useState<string | null>(null)
  const [groupOpened, setGroupOpened] = useState<string | null>(null)
  const [groupAvailable, setGroupAvailable] = useState(false)
  const [groupPreview, setGroupPreview] = useState<FieldWorkoutPackage | null>(null)
  const [eventStage, setEventStage] = useState<'preview' | 'attendance' | 'results'>('preview')
  const [expandedPerson, setExpandedPerson] = useState<string | null>(null)
  const [refreshSignal, setRefreshSignal] = useState(0)
  const [headerRefreshing, setHeaderRefreshing] = useState(false)
  const [refreshNotice, setRefreshNotice] = useState('')
  const [selectedDay, setSelectedDay] = useState(() => localDate(new Date()))
  const [draftDay, setDraftDay] = useState(selectedDay)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const sheetY = useRef(new Animated.Value(420)).current
  useEffect(() => {
    if (!filtersOpen) return
    sheetY.setValue(420)
    const motion = Animated.timing(sheetY, { toValue: 0, duration: 220, useNativeDriver: true })
    motion.start()
    return () => motion.stop()
  }, [filtersOpen, sheetY])
  const [recordFilter, setRecordFilter] = useState<'all' | 'training' | 'assessment' | 'workout'>(
    'all',
  )
  const [draftRecordFilter, setDraftRecordFilter] = useState<
    'all' | 'training' | 'assessment' | 'workout'
  >('all')
  const [latestFirst, setLatestFirst] = useState(false)
  const [draftLatestFirst, setDraftLatestFirst] = useState(false)
  const [visibleCount, setVisibleCount] = useState(5)
  const [workoutsOpened, setWorkoutsOpened] = useState(false)
  const [showDeviceOptions, setShowDeviceOptions] = useState(false)
  const [workoutPersisting, setWorkoutPersisting] = useState(false)
  const [groupPersisting, setGroupPersisting] = useState(false)
  const [groupExitRisk, setGroupExitRisk] = useState(false)
  const [search, setSearch] = useState('')
  const [reviewing, setReviewing] = useState(false)
  const [now, setNow] = useState(Date.now)
  const alive = useRef(true)
  const selectedRef = useRef<string | null>(null)
  const busyRef = useRef(false)
  const refreshingRef = useRef(false)
  const workoutFlight = useRef(false)
  const dayRef = useRef(selectedDay)
  const savingRef = useRef(false)
  const closingRef = useRef(closing)
  closingRef.current = closing
  const [zone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')

  async function reloadLocal() {
    const list = await store.list(owner)
    const id = selectedRef.current
    const detail = id ? await store.snapshot(owner, id) : null
    const head = await store.next(owner)
    if (alive.current) {
      setCached(list)
      setQueueHead(head)
      if (selectedRef.current === id) setSnapshot(detail)
    }
    return list
  }
  async function sync() {
    if (!alive.current || closingRef.current) return
    try {
      const startedWithWork = await store.next(owner)
      await runner.current?.run((completed) => {
        if (completed && alive.current) {
          setEvents((prior) =>
            prior.map((event) => (event.id === completed.event.id ? completed.event : event)),
          )
          if (selectedRef.current === completed.event.id) {
            setOnlineRoster(completed)
            setEditor(null)
            setGroupEvent(null)
          }
        }
        if (alive.current)
          void reloadLocal().catch((e) => {
            if (alive.current) setMessage(failureText(e))
          })
      })
      await reloadLocal()
      if (startedWithWork) {
        const remaining = await store.next(owner)
        if (alive.current)
          setMessage(remaining ? `${stateText[remaining.state]}. ${remaining.error || ''}` : '')
      }
    } catch (error) {
      if (error instanceof ConnectionFailure) onConnectivity('offline')
      else if (alive.current) setMessage(failureText(error))
    }
  }
  async function refreshSavedDay(day = dayRef.current) {
    const saved = await store.workouts.dayList(owner, day)
    if (alive.current && dayRef.current === day) setSavedDayWorkouts(saved)
  }
  async function refreshSavedLibrary(limit = savedLimit) {
    const [records, total, groupIds] = await Promise.all([
      store.workouts.listAll(owner, 0, limit),
      store.workouts.countAll(owner),
      store.workouts.groupEventIds(owner),
    ])
    if (alive.current) {
      setSavedRecords(records)
      setSavedRecordTotal(total)
      setSavedGroupIds(groupIds)
    }
  }
  useEffect(() => {
    if (homeTab === 'saved' && !workoutView && !selected) {
      setSavedError('')
      void reloadLocal()
        .then(() => refreshSavedLibrary())
        .then(() => setSavedReady(true))
        .catch((error) => setSavedError(failureText(error)))
    }
  }, [homeTab, workoutView, selected, savedLimit])
  useEffect(() => {
    if (!savedRefreshSignal) return
    void Promise.all([refreshSavedDay(), refreshSavedLibrary()]).catch((error) =>
      setSavedError(failureText(error)),
    )
  }, [savedRefreshSignal])
  async function refreshWorkouts(day: string, offset = 0) {
    if (workoutFlight.current || closingRef.current) return
    workoutFlight.current = true
    setWorkoutLoading(true)
    try {
      await refreshSavedDay(day)
      const agenda = await client.request<WorkoutAgenda>(
        `/institution/workout-scheduling?view=trainer&fieldPackages=true&day=${day}&offset=${offset}&limit=100`,
      )
      if (!alive.current || dayRef.current !== day) return
      const packages = agenda.items.flatMap((item) =>
        item.field_workout ? [item.field_workout] : [],
      )
      setDayWorkouts((prior) =>
        offset
          ? [...prior, ...packages.filter((item) => !prior.some((known) => known.id === item.id))]
          : packages,
      )
      setWorkoutTotal(agenda.total)
      setWorkoutFetched(offset + agenda.items.length)
      setWorkoutError('')
    } catch (error) {
      if (error instanceof ApiFailure && error.status === 403) {
        await store.workouts.block(owner)
        if (alive.current && dayRef.current === day) {
          setDayWorkouts([])
          await refreshSavedDay(day)
        }
      }
      if (error instanceof ConnectionFailure) onConnectivity('offline')
      else if (alive.current && dayRef.current === day) setWorkoutError(failureText(error))
    } finally {
      workoutFlight.current = false
      if (alive.current) setWorkoutLoading(false)
    }
  }
  async function refresh(offset = 0, background = false, day = selectedDay) {
    if (!alive.current || busyRef.current || refreshingRef.current || closingRef.current) return
    refreshingRef.current = true
    setRefreshingSchedule(true)
    if (!background) {
      busyRef.current = true
      setBusy(true)
    }
    try {
      const query = new URLSearchParams({
        from: day,
        to: day,
        zone,
        view: 'trainer',
        offset: String(offset),
        excludePlanWorkouts: 'true',
      })
      const result = await client.request<{ items: unknown[]; next: number | null }>(
        `/institution/calendar?${query}`,
      )
      const items = result.items.map(fieldEvent)
      if (!alive.current) return
      setEvents((prior) =>
        offset ? [...prior, ...items.filter((i) => !prior.some((e) => e.id === i.id))] : items,
      )
      setNext(result.next)
      if (!offset) setVisibleCount(5)
      await sync()
    } catch (error) {
      if (error instanceof ApiFailure && error.status === 403) {
        for (const item of await store.list(owner)) await store.block(owner, item.event.id)
        if (alive.current) {
          setEvents([])
          setNext(null)
        }
        await reloadLocal()
      }
      if (error instanceof ConnectionFailure) onConnectivity('offline')
      else if (alive.current && !selectedRef.current)
        setMessage(`${failureText(error)} Previously opened events remain below.`)
    } finally {
      if (!offset) await refreshWorkouts(day)
      refreshingRef.current = false
      if (alive.current) setRefreshingSchedule(false)
      if (!background) {
        busyRef.current = false
        if (alive.current) setBusy(false)
      }
    }
  }
  useEffect(() => {
    alive.current = true
    const active = new AttendanceSync(store, owner, (path, body) =>
      client.request(path, { method: 'POST', body }),
    )
    runner.current = active
    void reloadLocal()
      .then((saved) => refresh(0, saved.length > 0))
      .catch((e) => {
        if (alive.current) setMessage(failureText(e))
      })
    const foreground = () => {
      if (AppState.currentState === 'active') {
        setNow(Date.now())
        void sync()
        void refreshSavedDay().catch((error) => {
          if (alive.current) setWorkoutError(failureText(error))
        })
      }
    }
    const subscription = AppState.addEventListener('change', foreground)
    // Retry connectivity return only while active. No background-sync guarantee.
    const timer = setInterval(foreground, 30_000)
    return () => {
      alive.current = false
      active.stop()
      subscription.remove()
      clearInterval(timer)
    }
  }, [])
  useEffect(() => {
    if (closing) runner.current?.stop()
  }, [closing])
  useEffect(() => {
    onPersisting(saving || draftSaving || workoutPersisting || groupPersisting)
  }, [saving, draftSaving, workoutPersisting, groupPersisting, onPersisting])
  useEffect(() => () => onPersisting(false), [onPersisting])

  async function openEvent(id: string, refreshRoster = false) {
    if (!alive.current || busyRef.current || closingRef.current) return
    busyRef.current = true
    setBusy(true)
    setMessage('')
    selectedRef.current = id
    setSelected(id)
    onEventOpen()
    setWorkoutView(false)
    setGroupEvent(null)
    setSnapshot(null)
    setOnlineRoster(null)
    setGroupAvailable(false)
    setGroupPreview(null)
    setEventStage('preview')
    setShowDeviceOptions(false)
    setSearch('')
    setReviewing(false)
    setEditor(null)
    try {
      const saved = await store.snapshot(owner, id)
      if (!alive.current || selectedRef.current !== id) return
      setSnapshot(saved)
      const savedGroup = await store.workouts.groupList(owner, id)
      setGroupAvailable(savedGroup.length > 0)
      setGroupPreview(savedGroup[0]?.package || null)
      if (saved && !refreshRoster) {
        void sync()
        return
      }
      if (saved?.commands.some((c) => c.state !== 'acknowledged')) {
        setMessage(
          'Saved changes are shown below. Confirm or resolve them before downloading a newer roster.',
        )
        await sync()
        return
      }
      const data = await client.request<unknown>(
        `/institution/calendar?view=trainer&id=${id}&summary=true`,
      )
      if (!alive.current || selectedRef.current !== id) return
      const roster = fieldRoster(data, id)
      await store.saveRoster(owner, roster)
      let groupMessage = ''
      if (roster.event.kind === 'training' && roster.event.state === 'scheduled') {
        try {
          const group = await downloadGroupEvent(client, store, owner, id)
          if (group.group) {
            setGroupAvailable(true)
            setGroupPreview(group.packages[0] || null)
            groupMessage = group.errors.length
              ? l(
                  `Attendance roster saved, but ${group.errors.length} workout sheet(s) could not be updated: ${group.errors[0]}`,
                  `حُفظت قائمة الحضور، لكن تعذّر تحديث ${group.errors.length} من سجلات التمرين: ${group.errors[0]}`,
                )
              : ''
          }
        } catch (error) {
          groupMessage = l(
            `Attendance roster saved, but group sheets could not be downloaded: ${failureText(error)}`,
            `حُفظت قائمة الحضور، لكن تعذّر تنزيل سجلات المجموعة: ${failureText(error)}`,
          )
        }
      }
      if (!alive.current || selectedRef.current !== id) return
      setOnlineRoster(roster)
      await reloadLocal()
      setMessage(groupMessage)
    } catch (error) {
      if (error instanceof ApiFailure && error.status === 403) await store.block(owner, id)
      if (alive.current && selectedRef.current === id) {
        await reloadLocal()
        setMessage(failureText(error))
      }
    } finally {
      busyRef.current = false
      if (alive.current) setBusy(false)
    }
  }
  async function accessDenied(id: string) {
    await store.block(owner, id)
    if (alive.current && selectedRef.current === id) await reloadLocal()
  }
  async function record(member: string, value: FieldAttendance) {
    if (!snapshot || savingRef.current || closingRef.current) return
    const person = snapshot.roster.people.find((p) => p.member_id === member)
    if (!person) return
    savingRef.current = true
    setSaving(true)
    try {
      await store.enqueue(owner, {
        action: 'attendance',
        view: 'trainer',
        id: snapshot.roster.event.id,
        member,
        attendance: value,
        revision: person.revision,
        operation: operationId(),
      })
      if (alive.current) {
        await reloadLocal()
      }
      await sync()
    } catch (error) {
      if (alive.current) setMessage(failureText(error))
    } finally {
      savingRef.current = false
      if (alive.current) setSaving(false)
    }
  }
  async function submitCommand(payload: FieldCommand): Promise<boolean> {
    if (savingRef.current || closingRef.current) return false
    savingRef.current = true
    setSaving(true)
    try {
      await store.enqueue(owner, payload)
      if (alive.current) {
        await reloadLocal()
        if (payload.action === 'finish')
          setRefreshNotice(
            l(
              'Event saved on this phone. Waiting to send.',
              'حُفظ الموعد على هذا الهاتف. بانتظار الإرسال.',
            ),
          )
      }
      await sync()
      return true
    } catch (error) {
      if (alive.current) setMessage(failureText(error))
      return false
    } finally {
      savingRef.current = false
      if (alive.current) setSaving(false)
    }
  }
  function finish() {
    if (!snapshot || savingRef.current || busyRef.current || closingRef.current) return
    const event = snapshot.roster.event
    Alert.alert(
      l('Finish this event?', 'إنهاء هذا الموعد؟'),
      groupAvailable
        ? l(
            'Finish only after every present athlete has a confirmed workout, or a coach has recorded a skip on the web. Your offline copy will be removed after confirmation.',
            'أنهِ الموعد بعد تأكيد تمرين كل رياضي حاضر، أو تسجيل تخطيه عبر الويب. ستُزال النسخة المحفوظة بعد التأكيد.',
          )
        : l(
            'Make sure attendance and results are confirmed. Your offline copy will be removed after confirmation.',
            'تأكد من تأكيد الحضور والنتائج. ستُزال النسخة المحفوظة بعد التأكيد.',
          ),
      [
        { text: l('Keep working', 'متابعة العمل'), style: 'cancel' },
        {
          text: l('Finish event', 'إنهاء الموعد'),
          onPress: () => {
            if (!alive.current || selectedRef.current !== event.id) return
            void submitCommand({
              action: 'finish',
              view: 'trainer',
              id: event.id,
              revision: event.revision,
              operation: operationId(),
            })
          },
        },
      ],
    )
  }
  function removeCopy() {
    const id = selectedRef.current
    if (!id || busyRef.current || savingRef.current || closingRef.current) return
    Alert.alert(
      t('Remove saved event from this device?'),
      t(
        'This permanently discards its pending changes and offline roster on this device. An unconfirmed change may already exist on the server. Server records are not undone.',
      ),
      [
        { text: t('Keep saved work'), style: 'cancel' },
        {
          text: t('Discard device copy'),
          style: 'destructive',
          onPress: () => {
            if (!alive.current || closingRef.current) return
            void store
              .remove(owner, id)
              .then(async () => {
                if (alive.current && selectedRef.current === id) {
                  selectedRef.current = null
                  setSelected(null)
                  setEditor(null)
                  setDraftSaving(false)
                  setSnapshot(null)
                  setOnlineRoster(null)
                  await reloadLocal()
                  setMessage(
                    'Device copy removed. Open the event online to review current server records.',
                  )
                }
              })
              .catch((e) => {
                if (alive.current) setMessage(failureText(e))
              })
          },
        },
      ],
    )
  }

  const roster = snapshot?.roster || onlineRoster
  const pending = snapshot?.commands.filter((c) => c.state !== 'acknowledged') || []
  const paused = pending.some((c) => ['needs_attention', 'blocked'].includes(c.state))
  const institutionPaused = !!queueHead && ['needs_attention', 'blocked'].includes(queueHead.state)
  const finishing = pending.some((c) => c.payload.action === 'finish')
  const completionProblems = roster ? finishProblems(roster) : []
  const completed = roster?.event.state === 'completed'
  const beforeStart = !!roster && Date.parse(roster.event.starts_at) > now
  const availableEvents = [
    ...events,
    ...cached.filter((c) => !events.some((e) => e.id === c.event.id)).map((c) => c.event),
  ]
  const onSelectedDay = (event: FieldEvent) => localDate(new Date(event.starts_at)) === selectedDay
  const savedWorkoutIds = new Set(savedDayWorkouts.map((item) => item.package.id))
  const workoutList =
    recordFilter === 'all' || recordFilter === 'workout'
      ? [
          ...savedDayWorkouts
            .map((item) => item.package)
            .filter((item) => item.training_date === selectedDay),
          ...dayWorkouts.filter(
            (item) => item.training_date === selectedDay && !savedWorkoutIds.has(item.id),
          ),
        ]
      : []
  // A plan workout also has a calendar occurrence for collision checks. Show its workout sheet once.
  const workoutOccurrenceIds = new Set([
    ...savedDayWorkouts.map((item) => item.package.occurrence_id),
    ...dayWorkouts.map((item) => item.occurrence_id),
  ])
  const eventList = availableEvents.filter(
    (event) =>
      !workoutOccurrenceIds.has(event.id) &&
      onSelectedDay(event) &&
      (recordFilter === 'all' ||
        (recordFilter === 'training' && event.kind === 'training') ||
        (recordFilter === 'assessment' && event.kind === 'assessment')),
  )
  const hasDayActivities =
    availableEvents.some((event) => !workoutOccurrenceIds.has(event.id) && onSelectedDay(event)) ||
    savedDayWorkouts.some((item) => item.package.training_date === selectedDay) ||
    dayWorkouts.some((item) => item.training_date === selectedDay)
  const list = [
    ...eventList.map((event) => ({
      kind: 'event' as const,
      id: event.id,
      at: Date.parse(event.starts_at),
      event,
    })),
    ...workoutList.map((workout) => ({
      kind: 'workout' as const,
      id: workout.id,
      at: workout.starts_at ? Date.parse(workout.starts_at) : Number.MAX_SAFE_INTEGER,
      workout,
    })),
  ].sort((a, b) => (latestFirst ? b.at - a.at : a.at - b.at))
  // A group event is one Saved card even though its participant sheets have separate device records.
  const groupSheets = savedRecords.filter((record) => !!record.package.group)
  const groupIds = new Set(savedGroupIds)
  const savedCards = [
    ...cached.map((item) => ({
      kind: 'event' as const,
      id: item.event.id,
      at: Date.parse(item.event.starts_at),
      category: (item.event.kind === 'assessment'
        ? 'assessments'
        : groupIds.has(item.event.id)
          ? 'workouts'
          : 'events') as 'assessments' | 'workouts' | 'events',
      event: item,
    })),
    ...savedRecords
      .filter((record) => !record.package.group)
      .map((record) => ({
        kind: 'workout' as const,
        id: record.package.id,
        at: record.package.starts_at
          ? Date.parse(record.package.starts_at)
          : Date.parse(`${record.package.training_date}T12:00:00`),
        category: 'workouts' as const,
        record,
      })),
    ...groupSheets
      .filter(
        (record, index) =>
          !cached.some((item) => item.event.id === record.package.group!.event_id) &&
          groupSheets.findIndex(
            (item) => item.package.group!.event_id === record.package.group!.event_id,
          ) === index,
      )
      .map((record) => ({
        kind: 'group' as const,
        id: record.package.group!.event_id,
        at: record.package.starts_at
          ? Date.parse(record.package.starts_at)
          : Date.parse(`${record.package.training_date}T12:00:00`),
        category: 'workouts' as const,
        record,
      })),
  ]
    .filter((item) => savedFilter === 'all' || item.category === savedFilter)
    .sort((a, b) => b.at - a.at)
  const filtered =
    roster?.people.filter(
      (p) =>
        p.duty === 'trainee' && p.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
    ) || []
  const presentCount =
    roster?.people.filter(
      (person) => person.duty === 'trainee' && person.active && person.attendance === 'present',
    ).length || 0
  const allAttendanceConfirmed =
    !!roster &&
    roster.people.every(
      (person) => person.duty !== 'trainee' || !person.active || person.attendance !== 'unmarked',
    ) &&
    !pending.some((command) => command.payload.action === 'attendance')
  const attendanceReady = allAttendanceConfirmed && presentCount > 0
  const trainees = roster?.people.filter((person) => person.duty === 'trainee') || []
  const markedCount = trainees.filter((person) => person.attendance !== 'unmarked').length
  // Athletes that still need a mark and have no unsent attendance change of their own.
  const unmarkedPeople = trainees.filter(
    (person) =>
      person.active &&
      person.attendance === 'unmarked' &&
      !pending.some(
        (command) =>
          command.payload.action === 'attendance' && command.payload.member === person.member_id,
      ),
  )
  const attendanceLocked =
    saving ||
    busy ||
    closing ||
    !snapshot ||
    !!snapshot.roster.blocked ||
    institutionPaused ||
    paused ||
    finishing ||
    draftSaving ||
    roster?.event.state !== 'scheduled' ||
    beforeStart
  const [bulkMarking, setBulkMarking] = useState(false)
  /** Queues the same per-athlete attendance command for each remaining athlete, in order. */
  async function markRemainingPresent() {
    if (bulkMarking || attendanceLocked) return
    setBulkMarking(true)
    try {
      for (const person of unmarkedPeople) {
        if (!alive.current || closingRef.current) break
        await record(person.member_id, 'present')
      }
    } finally {
      if (alive.current) setBulkMarking(false)
    }
  }
  const attendanceTone = (value: FieldAttendance): Tone =>
    value === 'present'
      ? 'success'
      : value === 'absent'
        ? 'danger'
        : value === 'excused'
          ? 'warning'
          : 'neutral'
  const attendanceLabel = (value: FieldAttendance) =>
    value === 'present'
      ? l('Present', 'حاضر')
      : value === 'absent'
        ? l('Absent', 'غائب')
        : value === 'excused'
          ? l('Excused', 'معذور')
          : l('Not marked', 'غير محدد')
  const eventStateTone = (event: FieldEvent): Tone =>
    event.state === 'completed' ? 'success' : event.state === 'cancelled' ? 'danger' : 'info'
  const eventStateLabel = (event: FieldEvent) =>
    event.state === 'completed'
      ? l('Completed', 'مكتمل')
      : event.state === 'cancelled'
        ? l('Cancelled', 'ملغى')
        : Date.parse(event.starts_at) <= now && Date.parse(event.ends_at) > now
          ? l('In progress', 'جارٍ الآن')
          : l('Scheduled', 'مجدول')
  const scheduleBusy = busy || refreshingSchedule || workoutLoading || closing
  const isToday = selectedDay === localDate(new Date())
  const filterActive = recordFilter !== 'all' || latestFirst
  const filterLabel = [
    recordFilter === 'training'
      ? l('Events', 'المواعيد')
      : recordFilter === 'assessment'
        ? l('Assessments', 'التقييمات')
        : recordFilter === 'workout'
          ? l('Workouts', 'التمارين')
          : l('All activities', 'كل الأنشطة'),
    latestFirst ? l('Latest first', 'الأحدث أولاً') : '',
  ]
    .filter(Boolean)
    .join(' · ')
  const initials = (name: string) =>
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] || '')
      .join('')
      .toLocaleUpperCase()
  async function openGroupSheets() {
    if (!roster || !selected || !attendanceReady) {
      const unmarked =
        roster?.people.filter(
          (person) =>
            person.duty === 'trainee' && person.active && person.attendance === 'unmarked',
        ).length || 0
      setRefreshNotice(
        unmarked
          ? l(
              `${unmarked} athlete(s) still need an attendance mark.`,
              `لم يُحدَّد حضور ${unmarked} من الرياضيين بعد.`,
            )
          : pending.some((command) => command.payload.action === 'attendance')
            ? l('Wait for attendance confirmation, then continue.', 'انتظر تأكيد الحضور ثم تابع.')
            : l(
                'At least one athlete must be present to record workouts.',
                'يجب حضور رياضي واحد على الأقل لتسجيل التمارين.',
              ),
      )
      return
    }
    try {
      const savedSheets = await store.workouts.groupList(owner, roster.event.id)
      if (!savedSheets.length) {
        const group = await downloadGroupEvent(client, store, owner, roster.event.id)
        if (!group.group) {
          setMessage(l('This event has no group workout.', 'لا يتضمن هذا الموعد تمريناً جماعياً.'))
          return
        }
        if (group.errors.length) setMessage(group.errors[0])
      }
      setWorkoutView(false)
      setRefreshNotice('')
      setGroupOpened(roster.event.id)
      setGroupEvent(roster.event.id)
    } catch (error) {
      setMessage(failureText(error))
    }
  }
  function goToResults() {
    if (!roster) return
    if (!allAttendanceConfirmed) {
      const unmarked = roster.people.filter(
        (person) => person.duty === 'trainee' && person.active && person.attendance === 'unmarked',
      ).length
      setRefreshNotice(
        unmarked
          ? l(
              `${unmarked} athlete(s) still need an attendance mark.`,
              `لم يُحدَّد حضور ${unmarked} من الرياضيين بعد.`,
            )
          : l('Wait for attendance confirmation, then continue.', 'انتظر تأكيد الحضور ثم تابع.'),
      )
      return
    }
    setExpandedPerson(null)
    setEventStage('results')
  }
  function leaveEvent() {
    if (saving || draftSaving || workoutPersisting || groupPersisting || busy || closing) return
    if (editor || (groupEvent && groupExitRisk)) {
      Alert.alert(
        l('Leave this event?', 'مغادرة هذا الموعد؟'),
        editor
          ? l(
              'Save or submit the open assessment entry first. Work already saved on this phone will stay available.',
              'احفظ أو أرسل نتيجة التقييم المفتوحة أولاً. سيبقى العمل المحفوظ على الهاتف متاحاً.',
            )
          : l(
              'Some workout values need correction or could not be saved. Your saved work stays on this phone, but unsaved values may be lost if the app closes.',
              'تحتاج بعض قيم التمرين إلى تصحيح أو تعذر حفظها. سيبقى العمل المحفوظ على هاتفك، لكن قد تضيع القيم غير المحفوظة إذا أُغلق التطبيق.',
            ),
        [
          { text: l('Keep working', 'متابعة العمل'), style: 'cancel' },
          { text: l('Leave anyway', 'المغادرة رغم ذلك'), onPress: closeEvent },
        ],
      )
      return
    }
    closeEvent()
  }
  function closeEvent() {
    selectedRef.current = null
    setSelected(null)
    setGroupEvent(null)
    setGroupAvailable(false)
    setGroupPreview(null)
    setEventStage('preview')
    setEditor(null)
    setSnapshot(null)
    setOnlineRoster(null)
    setSearch('')
    setMessage('')
    setRefreshNotice('')
  }
  useEffect(() => {
    if (!selected || groupEvent || workoutView || accountOpen) return
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (eventStage === 'results') setEventStage('attendance')
      else if (eventStage === 'attendance') setEventStage('preview')
      else leaveEvent()
      return true
    })
    return () => listener.remove()
  }, [
    selected,
    groupEvent,
    workoutView,
    accountOpen,
    eventStage,
    editor,
    saving,
    draftSaving,
    busy,
    closing,
  ])
  function refreshCurrent() {
    if (
      busy ||
      headerRefreshing ||
      saving ||
      draftSaving ||
      workoutPersisting ||
      groupPersisting ||
      closing
    )
      return
    if (!selected) {
      if (homeTab === 'saved' && !workoutView) {
        void sync()
        setRefreshSignal((value) => value + 1)
        void reloadLocal()
          .then(() => refreshSavedLibrary())
          .catch((error) => setMessage(failureText(error)))
      } else if (workoutView) {
        setHeaderRefreshing(true)
        setRefreshSignal((value) => value + 1)
      } else void refresh()
      return
    }
    if (pending.length) {
      setRefreshNotice('')
      void sync()
      return
    }
    if (snapshot?.drafts.length) {
      setRefreshNotice(
        l(
          'Review saved changes before replacing this event copy.',
          'راجع التغييرات المحفوظة قبل استبدال نسخة هذا الموعد.',
        ),
      )
      return
    }
    setRefreshNotice('')
    if (groupEvent) {
      setHeaderRefreshing(true)
      setRefreshSignal((value) => value + 1)
    } else void openEvent(selected, true)
  }
  function applyScheduleFilters(
    day: string,
    nextFilter = draftRecordFilter,
    nextLatestFirst = draftLatestFirst,
  ) {
    const parsed = new Date(`${day}T12:00:00Z`)
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== day
    ) {
      setRefreshNotice(
        l('Enter a valid date as YYYY-MM-DD.', 'أدخل تاريخاً صحيحاً بصيغة YYYY-MM-DD.'),
      )
      return
    }
    setSelectedDay(day)
    setDraftDay(day)
    dayRef.current = day
    setRecordFilter(nextFilter)
    setLatestFirst(nextLatestFirst)
    setVisibleCount(5)
    setFiltersOpen(false)
    void refresh(0, false, day)
  }
  function switchTab(tab: FieldTab) {
    if (tab === homeTab || workoutPersisting || groupPersisting) return
    setHomeTab(tab)
    setWorkoutView(tab === 'workouts')
    if (tab === 'workouts') setWorkoutsOpened(true)
  }
  useEffect(() => {
    if (selected || workoutDetail || homeTab === 'schedule') return
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      switchTab('schedule')
      return true
    })
    return () => listener.remove()
  }, [selected, workoutDetail, homeTab, workoutPersisting, groupPersisting])
  useEffect(() => {
    if (!settingsSyncSignal) return
    void sync().finally(() => {
      setWorkoutsOpened(true)
      setRefreshSignal((value) => value + 1)
      void refreshSavedLibrary().catch((error) => setMessage(failureText(error)))
    })
  }, [settingsSyncSignal])
  return (
    <View style={{ flex: 1 }}>
      {!selected && (!workoutView || (!workoutDetail && !soloPackage)) ? (
        <View style={styles.appBar}>
          <View style={styles.topbar}>
            <Text style={styles.brand} accessibilityRole="header">
              {l('Rafik', 'رفيق')}
              <Text style={styles.brandDot}>.</Text>
            </Text>
            <View style={[styles.actions, { alignItems: 'center', gap: 2 }]}>
              <ConnectionStatus state={connectionState} styles={styles} />
              {refreshingSchedule || headerRefreshing ? (
                <View style={styles.headerIcon}>
                  <ActivityIndicator
                    size="small"
                    color={styles.link.color}
                    accessibilityLabel={l('Refreshing', 'جارٍ التحديث')}
                  />
                </View>
              ) : (
                <IconButton
                  name="refresh"
                  label={l('Refresh', 'تحديث')}
                  disabled={busy || refreshingSchedule || headerRefreshing || closing}
                  onPress={refreshCurrent}
                  styles={styles}
                />
              )}
              <IconButton
                name="settings"
                label={l('Open settings', 'فتح الإعدادات')}
                expanded={accountOpen}
                onPress={onAccountPress}
                styles={styles}
              />
            </View>
          </View>
        </View>
      ) : workoutView ? (
        <View style={styles.eventHeader}>
          <IconButton
            name={soloPackage || workoutDetail ? 'back' : 'close'}
            rtl={language === 'ar'}
            label={
              soloPackage || workoutDetail
                ? l('Back', 'رجوع')
                : l('Close workouts', 'إغلاق التمارين')
            }
            disabled={workoutPersisting || closing}
            onPress={() => {
              setWorkoutView(homeTab === 'workouts')
              setSoloPackage(null)
              setSoloCloseSignal((n) => n + 1)
              void refreshSavedDay()
              if (homeTab === 'saved') void refreshSavedLibrary()
            }}
            styles={styles}
          />
          <View style={{ flex: 1, paddingHorizontal: 4 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {soloPackage ? soloPackage.member_name : l('Workouts', 'التمارين')}
            </Text>
            {soloPackage ? (
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {language === 'ar' && soloPackage.day_name_ar
                  ? soloPackage.day_name_ar
                  : soloPackage.day_name}
                {' · '}
                {l('Workout', 'تمرين')}
              </Text>
            ) : null}
          </View>
          <ConnectionStatus state={connectionState} styles={styles} compact />
          <IconButton
            name="refresh"
            label={l('Refresh workouts', 'تحديث التمارين')}
            disabled={headerRefreshing || workoutPersisting || closing}
            onPress={refreshCurrent}
            styles={styles}
          />
        </View>
      ) : (
        <View style={styles.eventHeader}>
          {groupEvent || eventStage !== 'preview' ? (
            <IconButton
              name="back"
              rtl={language === 'ar'}
              label={
                groupEvent || eventStage === 'results'
                  ? l('Back to attendance', 'العودة إلى الحضور')
                  : l('Back to event preview', 'العودة إلى معاينة الموعد')
              }
              disabled={groupPersisting || closing}
              onPress={() =>
                groupEvent
                  ? setGroupEvent(null)
                  : setEventStage(eventStage === 'results' ? 'attendance' : 'preview')
              }
              styles={styles}
            />
          ) : (
            <View style={{ width: 8 }} />
          )}
          <View style={{ flex: 1, paddingHorizontal: 4 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {roster?.event.title || l('Event', 'الموعد')}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {groupAvailable
                ? groupEvent
                  ? l('Step 2 of 2 · Workouts', 'الخطوة ٢ من ٢ · التمارين')
                  : eventStage === 'preview'
                    ? l('Event preview', 'معاينة الموعد')
                    : l('Step 1 of 2 · Attendance', 'الخطوة ١ من ٢ · الحضور')
                : eventStage === 'preview'
                  ? l('Event preview', 'معاينة الموعد')
                  : eventStage === 'results'
                    ? l('Step 2 of 2 · Results', 'الخطوة ٢ من ٢ · النتائج')
                    : roster?.event.kind === 'assessment'
                      ? l('Step 1 of 2 · Attendance', 'الخطوة ١ من ٢ · الحضور')
                      : l('Attendance', 'الحضور')}
            </Text>
          </View>
          <ConnectionStatus state={connectionState} styles={styles} compact />
          {busy || headerRefreshing ? (
            <View style={styles.headerIcon}>
              <ActivityIndicator
                size="small"
                color={styles.link.color}
                accessibilityLabel={l('Refreshing event', 'جارٍ تحديث الموعد')}
              />
            </View>
          ) : (
            <IconButton
              name="refresh"
              label={l('Refresh event', 'تحديث الموعد')}
              disabled={
                busy ||
                headerRefreshing ||
                saving ||
                draftSaving ||
                workoutPersisting ||
                groupPersisting ||
                closing
              }
              onPress={refreshCurrent}
              styles={styles}
            />
          )}
          <IconButton
            name="close"
            label={l('Leave event and continue later', 'مغادرة الموعد والمتابعة لاحقاً')}
            disabled={
              saving || draftSaving || workoutPersisting || groupPersisting || busy || closing
            }
            onPress={leaveEvent}
            styles={styles}
          />
        </View>
      )}
      {refreshNotice && !message && !externalNotice ? (
        <View style={{ marginHorizontal: 16, marginTop: 8 }}>
          <Notice
            text={refreshNotice}
            tone="warning"
            styles={styles}
            lines={3}
            live
            onPress={() => setRefreshNotice('')}
            actionIcon="close"
            actionLabel={l('Dismiss notice', 'إخفاء التنبيه')}
          />
        </View>
      ) : null}
      {selected && message && !externalNotice ? (
        <View style={{ marginHorizontal: 16, marginTop: 8 }}>
          <Notice
            text={t(message)}
            tone="warning"
            styles={styles}
            live
            lines={showMessageDetails ? undefined : 2}
            onPress={() => setShowMessageDetails((open) => !open)}
            actionIcon={showMessageDetails ? 'collapse' : 'down'}
            actionLabel={
              showMessageDetails
                ? l('Show less of this notice', 'عرض جزء أقل من التنبيه')
                : l('Show the full notice', 'عرض التنبيه كاملاً')
            }
          />
        </View>
      ) : null}
      {/* Keep this editor mounted while hidden so switching views preserves selection and device drafts. */}
      {workoutsOpened ? (
        <View style={{ flex: 1, display: workoutView ? 'flex' : 'none' }}>
          <WorkoutsScreen
            client={client}
            store={store}
            owner={owner}
            styles={styles}
            closing={closing}
            onPersisting={setWorkoutPersisting}
            active={workoutView}
            initialPackage={soloPackage}
            closeSignal={soloCloseSignal}
            onBackToSchedule={() => {
              setWorkoutView(homeTab === 'workouts')
              setSoloPackage(null)
              void refreshSavedDay()
              if (homeTab === 'saved') void refreshSavedLibrary()
            }}
            onDetailChange={setWorkoutDetail}
            onConnectivity={onConnectivity}
            connectionState={connectionState}
            refreshSignal={refreshSignal}
            onRefreshComplete={() => {
              setHeaderRefreshing(false)
              onSettingsSyncComplete?.()
            }}
          />
        </View>
      ) : null}
      {groupOpened ? (
        <View style={{ flex: 1, display: groupEvent === groupOpened ? 'flex' : 'none' }}>
          <WorkoutsScreen
            key={groupOpened}
            client={client}
            store={store}
            owner={owner}
            styles={styles}
            closing={closing}
            onPersisting={setGroupPersisting}
            onExitRiskChange={setGroupExitRisk}
            active={groupEvent === groupOpened}
            groupEvent={groupOpened}
            presentAthletes={
              roster?.people
                .filter(
                  (person) =>
                    person.duty === 'trainee' && person.active && person.attendance === 'present',
                )
                .map((person) => person.member_id) || []
            }
            refreshSignal={refreshSignal}
            onRefreshComplete={() => setHeaderRefreshing(false)}
            groupTitle={roster?.event.title}
            onBackToEvent={() => setGroupEvent(null)}
            onFinishEvent={finish}
            eventCanFinish={
              !!snapshot &&
              roster?.event.state === 'scheduled' &&
              !busy &&
              !saving &&
              !draftSaving &&
              !closing &&
              !institutionPaused &&
              !snapshot.roster.blocked &&
              !pending.length &&
              !snapshot.drafts.length &&
              !completionProblems.length &&
              !beforeStart
            }
            eventFinishing={finishing}
            eventCompleted={completed}
            onConnectivity={onConnectivity}
            connectionState={connectionState}
          />
        </View>
      ) : null}
      {selected && eventStage === 'preview' && !groupEvent ? (
        <View style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {roster ? (
              <>
                <View style={styles.card}>
                  <View style={[styles.metaRow, { justifyContent: 'space-between' }]}>
                    <StatusPill
                      label={
                        roster.event.kind === 'assessment'
                          ? l('Assessment', 'تقييم')
                          : groupPreview
                            ? l('Group workout', 'تمرين جماعي')
                            : l('Training', 'تدريب')
                      }
                      icon={roster.event.kind === 'assessment' ? 'assessment' : 'event'}
                      tone="accent"
                      styles={styles}
                    />
                    <StatusPill
                      label={eventStateLabel(roster.event)}
                      tone={eventStateTone(roster.event)}
                      styles={styles}
                    />
                  </View>
                  <Text style={styles.title}>{roster.event.title}</Text>
                  <View style={{ gap: 6 }}>
                    <View style={styles.metaItem}>
                      <Icon name="time" styles={styles} size={16} muted />
                      <Text style={styles.hint}>
                        {displayDate(roster.event.starts_at, language)} –{' '}
                        {displayTime(roster.event.ends_at, language)}
                      </Text>
                    </View>
                    {roster.event.location ? (
                      <View style={styles.metaItem}>
                        <Icon name="location" styles={styles} size={16} muted />
                        <Text style={styles.hint}>{roster.event.location}</Text>
                      </View>
                    ) : null}
                    <View style={styles.metaItem}>
                      <Icon name="athletes" styles={styles} size={16} muted />
                      <Text style={styles.hint}>
                        {trainees.length} {l('athletes', 'رياضيين')}
                      </Text>
                    </View>
                  </View>
                </View>
                {groupPreview ? (
                  <View style={styles.card}>
                    <SectionLabel styles={styles}>{l('Workout', 'التمرين')}</SectionLabel>
                    <Text style={styles.cardTitle}>
                      {language === 'ar' && groupPreview.day_name_ar
                        ? groupPreview.day_name_ar
                        : groupPreview.day_name}
                    </Text>
                    <View style={styles.inset}>
                      {groupPreview.exercises.slice(0, 5).map((exercise) => (
                        <View
                          key={exercise.key}
                          style={[styles.metaRow, { justifyContent: 'space-between' }]}
                        >
                          <Text style={[styles.label, { flex: 1 }]} numberOfLines={1}>
                            {language === 'ar' && exercise.name_ar
                              ? exercise.name_ar
                              : exercise.name}
                          </Text>
                          <Text style={styles.meta}>
                            {
                              groupPreview.entries.filter(
                                (entry) => entry.exercise_key === exercise.key,
                              ).length
                            }{' '}
                            {l('sets', 'مجموعات')}
                          </Text>
                        </View>
                      ))}
                      {groupPreview.exercises.length > 5 ? (
                        <Text style={styles.meta}>
                          +{groupPreview.exercises.length - 5} {l('more', 'أخرى')}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ) : null}
                {beforeStart && !completed ? (
                  <Notice
                    text={l(
                      'Recording opens at the start time. Need a different time? Reschedule it on the web.',
                      'يبدأ التسجيل عند موعد البدء. هل تحتاج وقتاً آخر؟ أعد جدولته عبر الويب.',
                    )}
                    tone="info"
                    styles={styles}
                  />
                ) : null}
              </>
            ) : (
              <ActivityIndicator
                color={styles.link.color}
                accessibilityLabel={l('Opening event', 'جارٍ فتح الموعد')}
              />
            )}
          </ScrollView>
          {roster ? (
            <ActionBar styles={styles}>
              <Button
                title={
                  completed
                    ? l('Review event', 'مراجعة الموعد')
                    : beforeStart
                      ? l('Recording opens at start time', 'يبدأ التسجيل عند موعد البدء')
                      : l('Start attendance', 'بدء تسجيل الحضور')
                }
                disabled={busy || closing || (!completed && beforeStart)}
                onPress={() => setEventStage('attendance')}
                styles={styles}
                primary
                fill
              />
            </ActionBar>
          ) : null}
        </View>
      ) : null}
      <ScrollView
        style={{
          display:
            (homeTab !== 'schedule' && !selected) ||
            workoutView ||
            groupEvent ||
            (selected && eventStage === 'preview')
              ? 'none'
              : 'flex',
        }}
        contentContainerStyle={[styles.content, !selected && { paddingBottom: 96 }]}
        keyboardShouldPersistTaps="handled"
      >
        {!selected ? (
          <View style={{ gap: 10 }}>
            <View style={[styles.rowHeader, { alignItems: 'flex-start' }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title} accessibilityRole="header">
                  {isToday
                    ? l('Today', 'اليوم')
                    : new Intl.DateTimeFormat(language === 'ar' ? 'ar-AE' : 'en-GB', {
                        weekday: 'long',
                      }).format(new Date(`${selectedDay}T12:00:00`))}
                </Text>
                <Text style={styles.hint}>
                  {new Intl.DateTimeFormat(language === 'ar' ? 'ar-AE' : 'en-GB', {
                    weekday: isToday ? 'long' : undefined,
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  }).format(new Date(`${selectedDay}T12:00:00`))}
                </Text>
              </View>
              <View>
                <IconButton
                  name="filter"
                  label={l('Filter schedule', 'تصفية الجدول')}
                  onPress={() => {
                    setDraftDay(selectedDay)
                    setDraftRecordFilter(recordFilter)
                    setDraftLatestFirst(latestFirst)
                    setFiltersOpen(true)
                  }}
                  styles={styles}
                />
                {filterActive ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: 8,
                      end: 8,
                      width: 9,
                      height: 9,
                      borderRadius: 5,
                      backgroundColor: styles.colors.accent,
                    }}
                  />
                ) : null}
              </View>
            </View>
            <View style={[styles.segmented, { alignItems: 'center' }]}>
              <IconButton
                name="previous"
                rtl={language === 'ar'}
                label={l('Previous day', 'اليوم السابق')}
                disabled={scheduleBusy}
                onPress={() =>
                  applyScheduleFilters(shiftDay(selectedDay, -1), recordFilter, latestFirst)
                }
                styles={styles}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={l('Go to today', 'الانتقال إلى اليوم')}
                accessibilityState={{ disabled: isToday || scheduleBusy }}
                disabled={isToday || scheduleBusy}
                onPress={() =>
                  applyScheduleFilters(localDate(new Date()), recordFilter, latestFirst)
                }
                style={[styles.segment, isToday && styles.segmentSelected]}
              >
                <Text style={[styles.segmentText, isToday && styles.segmentTextSelected]}>
                  {l('Today', 'اليوم')}
                </Text>
              </Pressable>
              <IconButton
                name="forward"
                rtl={language === 'ar'}
                label={l('Next day', 'اليوم التالي')}
                disabled={scheduleBusy}
                onPress={() =>
                  applyScheduleFilters(shiftDay(selectedDay, 1), recordFilter, latestFirst)
                }
                styles={styles}
              />
            </View>
            {filterActive ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${filterLabel}. ${l('Clear filter', 'مسح التصفية')}`}
                disabled={scheduleBusy}
                onPress={() => applyScheduleFilters(selectedDay, 'all', false)}
                style={[styles.filterChip, styles.filterChipActive, { alignSelf: 'flex-start' }]}
              >
                <View style={styles.metaItem}>
                  <Icon name="filter" styles={styles} size={15} />
                  <Text style={[styles.link, { fontSize: 14 }]}>{filterLabel}</Text>
                  <Icon name="close" styles={styles} size={15} />
                </View>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {!selected && message && !externalNotice ? (
          <Notice
            text={t(message)}
            tone="warning"
            styles={styles}
            live
            lines={showMessageDetails ? undefined : 2}
            onPress={() => setShowMessageDetails((open) => !open)}
            actionIcon={showMessageDetails ? 'collapse' : 'down'}
            actionLabel={
              showMessageDetails
                ? l('Show less of this notice', 'عرض جزء أقل من التنبيه')
                : l('Show the full notice', 'عرض التنبيه كاملاً')
            }
          />
        ) : null}
        {institutionPaused && queueHead.event_id !== selected ? (
          <Notice
            text={`${l('Saved attendance needs review', 'يلزم مراجعة الحضور المحفوظ')} · ${
              cached.find((c) => c.event.id === queueHead.event_id)?.event.title ||
              l('Earlier event', 'موعد سابق')
            }`}
            tone="warning"
            styles={styles}
            lines={2}
            onPress={
              busy || saving || closing ? undefined : () => void openEvent(queueHead.event_id)
            }
            actionIcon="forward"
            actionLabel={l('Review saved attendance', 'مراجعة الحضور المحفوظ')}
          />
        ) : null}
        {!selected ? (
          <>
            {list.slice(0, visibleCount).map((entry) => {
              const event = entry.kind === 'event' ? entry.event : null
              const workout = entry.kind === 'workout' ? entry.workout : null
              const starts = event ? event.starts_at : workout!.starts_at
              const offline = event
                ? cached.some((c) => c.event.id === entry.id)
                : savedWorkoutIds.has(entry.id)
              const savedWorkout = workout
                ? savedDayWorkouts.find((item) => item.package.id === workout.id)
                : null
              const workoutComplete = !!(
                savedWorkout?.session?.completed_at || workout?.session?.completed_at
              )
              const workoutAwaitingConfirmation =
                !workoutComplete &&
                !!(
                  savedWorkout?.intent?.complete ||
                  savedWorkout?.completionIntent?.complete ||
                  savedWorkout?.pending?.payload.complete
                )
              return (
                <Pressable
                  key={`${entry.kind}:${entry.id}`}
                  accessibilityRole="button"
                  disabled={busy || closing || (!!workout && workoutPersisting)}
                  accessibilityLabel={
                    event
                      ? `${l('Open', 'فتح')} ${event.title}`
                      : `${l('Open workout', 'فتح التمرين')} ${workout!.day_name}`
                  }
                  onPress={() => {
                    if (event) void openEvent(entry.id)
                    else {
                      setSoloPackage(workout)
                      setWorkoutsOpened(true)
                      setWorkoutView(true)
                    }
                  }}
                  style={({ pressed }) => [
                    styles.card,
                    (event?.state === 'completed' || workoutComplete) && styles.completedCard,
                    pressed && styles.cardPressed,
                  ]}
                >
                  <View style={styles.cardRow}>
                    <View style={styles.timeColumn}>
                      <Text style={styles.timeText} numberOfLines={1}>
                        {starts ? displayTime(starts, language) : '—'}
                      </Text>
                      <Text style={styles.timeSub} numberOfLines={1}>
                        {event
                          ? displayTime(event.ends_at, language)
                          : starts
                            ? ''
                            : l('Any time', 'أي وقت')}
                      </Text>
                    </View>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={styles.rowTitle} numberOfLines={2}>
                        {event ? event.title : workout!.member_name}
                      </Text>
                      <View style={styles.metaRow}>
                        <View style={styles.metaItem}>
                          <Icon
                            name={
                              workout
                                ? 'workout'
                                : event!.kind === 'assessment'
                                  ? 'assessment'
                                  : 'event'
                            }
                            styles={styles}
                            size={15}
                            muted
                          />
                          <Text style={styles.meta} numberOfLines={1}>
                            {workout
                              ? `${language === 'ar' && workout.day_name_ar ? workout.day_name_ar : workout.day_name} · ${workout.title}`
                              : event!.kind === 'assessment'
                                ? l('Assessment', 'تقييم')
                                : l('Event', 'موعد')}
                          </Text>
                        </View>
                        {event?.location ? (
                          <View style={styles.metaItem}>
                            <Icon name="location" styles={styles} size={15} muted />
                            <Text style={styles.meta} numberOfLines={1}>
                              {event.location}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <View style={styles.metaRow}>
                        {event ? (
                          <StatusPill
                            label={eventStateLabel(event)}
                            tone={eventStateTone(event)}
                            styles={styles}
                          />
                        ) : null}
                        {workoutComplete || workoutAwaitingConfirmation ? (
                          <StatusPill
                            label={
                              workoutComplete
                                ? l('Complete', 'مكتمل')
                                : l('Finished on this device', 'انتهى على هذا الجهاز')
                            }
                            tone={workoutComplete ? 'success' : 'warning'}
                            styles={styles}
                          />
                        ) : null}
                        {offline ? (
                          <StatusPill
                            label={l('Saved on device', 'محفوظ على الجهاز')}
                            icon="saved"
                            styles={styles}
                          />
                        ) : null}
                      </View>
                    </View>
                    <Icon name="forward" styles={styles} size={18} muted rtl={language === 'ar'} />
                  </View>
                </Pressable>
              )
            })}
            {visibleCount < list.length || next !== null || workoutFetched < workoutTotal ? (
              <Button
                title={l('Load more', 'عرض المزيد')}
                secondary
                disabled={busy || refreshingSchedule || workoutLoading || closing}
                onPress={() =>
                  visibleCount < list.length
                    ? setVisibleCount((count) => count + 5)
                    : next !== null
                      ? void refresh(next)
                      : workoutFetched < workoutTotal
                        ? void refreshWorkouts(selectedDay, workoutFetched)
                        : undefined
                }
                styles={styles}
              />
            ) : null}
            {!list.length && !busy && !workoutLoading && !workoutError && !message ? (
              <FieldEmptyState
                icon="event"
                title={
                  connectionState === 'offline' && !hasDayActivities
                    ? l('No saved activities for this day', 'لا توجد أنشطة محفوظة لهذا اليوم')
                    : hasDayActivities && recordFilter !== 'all'
                      ? l('No activities match this filter', 'لا توجد أنشطة تطابق هذه التصفية')
                      : l('Nothing scheduled for this day', 'لا توجد مواعيد لهذا اليوم')
                }
                description={
                  connectionState === 'offline' && !hasDayActivities
                    ? l(
                        'Your full schedule will return when connected.',
                        'سيظهر جدولك الكامل عند الاتصال.',
                      )
                    : hasDayActivities && recordFilter !== 'all'
                      ? l(
                          'Show another activity type or all activities.',
                          'اعرض نوعاً آخر أو كل الأنشطة.',
                        )
                      : l(
                          'Choose another date to see your field activities.',
                          'اختر يوماً آخر لعرض أنشطتك الميدانية.',
                        )
                }
                action={
                  connectionState === 'offline' && !hasDayActivities
                    ? undefined
                    : hasDayActivities && recordFilter !== 'all'
                      ? l('Change filter', 'تغيير التصفية')
                      : l('Choose a date', 'اختر تاريخاً')
                }
                onAction={
                  connectionState === 'offline' && !hasDayActivities
                    ? undefined
                    : () => {
                        setDraftDay(selectedDay)
                        setDraftRecordFilter(recordFilter)
                        setDraftLatestFirst(latestFirst)
                        setFiltersOpen(true)
                      }
                }
                styles={styles}
              />
            ) : null}
            {workoutError ? (
              <Notice
                text={l(
                  'Workouts could not refresh. Saved copies remain available.',
                  'تعذّر تحديث التمارين. النسخ المحفوظة ما زالت متاحة.',
                )}
                tone="warning"
                styles={styles}
                lines={2}
                onPress={() => setWorkoutError('')}
                actionIcon="close"
                actionLabel={l('Dismiss notice', 'إخفاء التنبيه')}
              />
            ) : null}
          </>
        ) : (
          <>
            {roster ? (
              <>
                {eventStage === 'attendance' && !completed && !beforeStart ? (
                  <View style={styles.card}>
                    <View style={{ gap: 8 }}>
                      <ProgressHeading
                        label={l('Attendance marked', 'تم تحديد الحضور')}
                        count={`${markedCount}/${trainees.length}`}
                        styles={styles}
                        prominent
                      />
                      <StatusPill
                        label={`${presentCount} ${l('present', 'حاضر')}`}
                        tone={presentCount ? 'success' : 'neutral'}
                        styles={styles}
                      />
                    </View>
                    <Progress value={markedCount} total={trainees.length} styles={styles} />
                    <Text style={styles.hint}>
                      {groupAvailable && allAttendanceConfirmed && !presentCount
                        ? l(
                            'No athletes are present. You can finish the event here.',
                            'لا يوجد رياضيون حاضرون. يمكنك إنهاء الموعد هنا.',
                          )
                        : groupAvailable
                          ? l(
                              'Mark everyone present, absent or excused. When attendance is confirmed, continue to workouts.',
                              'حدّد حضور الجميع أو غيابهم أو إعفاءهم. بعد تأكيد الحضور، انتقل إلى التمارين.',
                            )
                          : l(
                              'Mark everyone present, absent or excused. Each mark is saved on this phone first.',
                              'حدّد حضور الجميع أو غيابهم أو إعفاءهم. يُحفظ كل تحديد على هذا الهاتف أولاً.',
                            )}
                    </Text>
                    {unmarkedPeople.length && !attendanceLocked ? (
                      <Button
                        title={
                          bulkMarking
                            ? l('Marking…', 'جارٍ التحديد…')
                            : l(
                                `Mark ${unmarkedPeople.length} remaining as present`,
                                `تحديد ${unmarkedPeople.length} متبقين كحاضرين`,
                              )
                        }
                        icon="check"
                        secondary
                        small
                        disabled={bulkMarking}
                        onPress={() => void markRemainingPresent()}
                        styles={styles}
                      />
                    ) : null}
                  </View>
                ) : null}
                {completed ? (
                  <View
                    accessibilityLiveRegion="polite"
                    style={[styles.card, styles.completedCard]}
                  >
                    <Text style={styles.cardTitle}>{t('Event completed')}</Text>
                    <Text style={styles.hint}>
                      {' '}
                      {t(
                        'Confirmed by your institution. Attendance and results below are read-only. The offline event package has been removed. Open correction history below while online.',
                      )}{' '}
                    </Text>
                  </View>
                ) : beforeStart && roster.event.state === 'scheduled' ? (
                  <View accessibilityLiveRegion="polite" style={styles.card}>
                    <Text style={styles.cardTitle}>
                      {l('Recording opens when the event starts', 'يبدأ التسجيل عند بدء الموعد')}
                    </Text>
                    <Text style={styles.hint}>
                      {displayDate(roster.event.starts_at, language)} ·{' '}
                      {Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'}
                    </Text>
                    <Text style={styles.hint}>
                      {l(
                        'Need a different time? Reschedule it on the web.',
                        'هل تحتاج وقتاً آخر؟ أعد جدولته عبر الويب.',
                      )}
                    </Text>
                  </View>
                ) : null}
                {snapshot && pending.length ? (
                  <Notice
                    text={`${t('Roster downloaded')} ${displayDate(snapshot.roster.saved_at, language)}${t('. Permission is checked again when sending.')}`}
                    tone="info"
                    styles={styles}
                  />
                ) : null}
                {snapshot?.roster.blocked ? (
                  <Notice
                    text={t(
                      'Access blocked. Saved work is retained for explicit review or discard; attendance entry is locked.',
                    )}
                    tone="danger"
                    styles={styles}
                  />
                ) : null}
                {paused ? (
                  <Notice
                    text={t(
                      'Sending is paused. Review the saved changes against current server records below. Keep or export what you need before explicitly discarding this device copy and reopening online.',
                    )}
                    tone="warning"
                    styles={styles}
                  />
                ) : null}
                {snapshot &&
                (paused || snapshot.roster.blocked || pending.length || snapshot.drafts.length) ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{
                      expanded: reviewing,
                      disabled: busy || saving || draftSaving || closing,
                    }}
                    onPress={() => setReviewing((value) => !value)}
                    disabled={busy || saving || draftSaving || closing}
                    style={{ minHeight: 44, justifyContent: 'center' }}
                  >
                    <Text style={styles.link}>
                      {reviewing
                        ? l('Hide saved-work details', 'إخفاء تفاصيل العمل المحفوظ')
                        : l('Review saved work', 'مراجعة العمل المحفوظ')}
                    </Text>
                  </Pressable>
                ) : null}
                {snapshot && reviewing ? (
                  <RecoveryPanel
                    key={roster.event.id}
                    owner={owner}
                    snapshot={snapshot}
                    client={client}
                    store={store}
                    styles={styles}
                    disabled={
                      busy ||
                      saving ||
                      draftSaving ||
                      closing ||
                      pending.some((c) => c.state === 'sending')
                    }
                    onDenied={() => accessDenied(roster.event.id)}
                  />
                ) : null}
                {!completed && roster.event.state === 'scheduled' ? (
                  <View style={styles.actions}>
                    {pending.length ? (
                      <Button
                        title={l('Send saved changes', 'إرسال التغييرات المحفوظة')}
                        disabled={
                          busy ||
                          saving ||
                          closing ||
                          paused ||
                          pending.some((c) => c.state === 'sending')
                        }
                        onPress={() => void sync()}
                        styles={styles}
                      />
                    ) : null}
                  </View>
                ) : null}
                {roster.event.kind === 'assessment' && !roster.definition?.length ? (
                  <Notice
                    text={t(
                      'This older attendance package has no assessment definition. Resolve saved attendance, then refresh online to enter scores.',
                    )}
                    tone="warning"
                    styles={styles}
                  />
                ) : null}
                {!beforeStart || completed || !!pending.length ? (
                  <>
                    {trainees.length > 6 || search ? (
                      <>
                        <Field
                          styles={styles}
                          icon="search"
                          accessibilityLabel={t('Find athlete in this event')}
                          editable={!draftSaving && !saving}
                          placeholder={t('Find athlete in this event')}
                          value={search}
                          onChangeText={setSearch}
                        />
                        <Text style={styles.meta}>
                          {trainees.length} {t('athletes in event ·')} {filtered.length}{' '}
                          {t('shown')}
                        </Text>
                      </>
                    ) : null}
                    {filtered.map((person) => {
                      const latest = snapshot?.commands
                        .filter(
                          (c) =>
                            c.payload.action === 'attendance' &&
                            c.payload.member === person.member_id,
                        )
                        .at(-1)
                      const unsettled = latest && latest.state !== 'acknowledged'
                      const value =
                        unsettled && latest.payload.action === 'attendance'
                          ? latest.payload.attendance
                          : person.attendance
                      const result = roster.results?.find((r) => r.member_id === person.member_id)
                      const resultCommand = snapshot?.commands
                        .filter(
                          (c) =>
                            c.payload.action === 'result' && c.payload.member === person.member_id,
                        )
                        .at(-1)
                      const queuedResult =
                        resultCommand?.payload.action === 'result' &&
                        resultCommand.state !== 'acknowledged'
                          ? resultCommand.payload
                          : undefined
                      const locked =
                        saving ||
                        busy ||
                        closing ||
                        !snapshot ||
                        snapshot.roster.blocked ||
                        institutionPaused ||
                        paused ||
                        finishing ||
                        !!queuedResult ||
                        draftSaving ||
                        !!unsettled ||
                        roster.event.state !== 'scheduled' ||
                        beforeStart ||
                        !person.active
                      return (
                        <View key={person.member_id} style={styles.attendanceRow}>
                          <View style={styles.rowHeader}>
                            <View style={styles.avatar}>
                              <Text style={styles.avatarText}>{initials(person.name)}</Text>
                            </View>
                            <View style={{ flex: 1, gap: 2 }}>
                              <Text style={styles.rowTitle} numberOfLines={2}>
                                {person.name}
                              </Text>
                              {unsettled ? (
                                <Text accessibilityLiveRegion="polite" style={styles.meta}>
                                  {t(stateText[latest.state])}
                                </Text>
                              ) : null}
                            </View>
                            {eventStage !== 'attendance' || completed ? (
                              <StatusPill
                                label={attendanceLabel(value)}
                                tone={attendanceTone(value)}
                                styles={styles}
                              />
                            ) : null}
                            {eventStage === 'attendance' || eventStage === 'results' ? (
                              <IconButton
                                name={expandedPerson === person.member_id ? 'collapse' : 'history'}
                                label={
                                  expandedPerson === person.member_id
                                    ? l('Hide details', 'إخفاء التفاصيل')
                                    : `${l('History and corrections', 'السجل والتصحيحات')} · ${person.name}`
                                }
                                expanded={expandedPerson === person.member_id}
                                onPress={() =>
                                  setExpandedPerson(
                                    expandedPerson === person.member_id ? null : person.member_id,
                                  )
                                }
                                styles={styles}
                              />
                            ) : null}
                          </View>
                          {latest?.error ? (
                            <Notice text={t(latest.error)} tone="danger" styles={styles} />
                          ) : null}
                          {!person.active ? (
                            <Text style={styles.hint}>
                              {t('Inactive athlete — entry unavailable')}
                            </Text>
                          ) : null}
                          {eventStage === 'attendance' && !completed ? (
                            <Segmented
                              label={`${l('Attendance', 'الحضور')} · ${person.name}`}
                              value={value === 'unmarked' ? null : value}
                              disabled={locked || bulkMarking}
                              onChange={(mark) => void record(person.member_id, mark)}
                              options={(['present', 'absent', 'excused'] as const).map((mark) => ({
                                value: mark,
                                label: attendanceLabel(mark),
                                tone: attendanceTone(mark),
                              }))}
                              styles={styles}
                            />
                          ) : null}
                          {expandedPerson === person.member_id ? (
                            <EventHistory
                              key={`${roster.event.id}:${person.member_id}`}
                              client={client}
                              institution={institution}
                              event={roster.event.id}
                              member={person.member_id}
                              name={person.name}
                              definition={roster.definition}
                              assessment={roster.event.kind === 'assessment'}
                              styles={styles}
                              disabled={busy || saving || draftSaving || closing}
                              onDenied={() => accessDenied(roster.event.id)}
                            />
                          ) : null}
                          {roster.event.kind === 'assessment' && eventStage === 'results' ? (
                            <>
                              {result ? (
                                <View style={styles.inset}>
                                  <Text style={styles.sectionLabel}>
                                    {t('Confirmed assessment · revision')} {result.revision}
                                  </Text>
                                  {roster.definition?.map((drill) => (
                                    <View
                                      key={drill.key}
                                      style={[styles.metaRow, { justifyContent: 'space-between' }]}
                                    >
                                      <Text style={[styles.hint, { flex: 1 }]}>{drill.name}</Text>
                                      <Text style={styles.label}>
                                        {result.values[drill.key] ?? t('Not recorded')}
                                        {drill.unit ? ` ${drill.unit}` : ''}
                                      </Text>
                                    </View>
                                  ))}
                                  {result.note ? (
                                    <Text style={styles.hint}>
                                      {t('Assessor note:')} {result.note}
                                    </Text>
                                  ) : null}
                                </View>
                              ) : null}
                              {resultCommand ? (
                                <Text style={styles.meta}>
                                  {t('Scores:')} {t(stateText[resultCommand.state])}
                                  {resultCommand.error ? ` · ${t(resultCommand.error)}` : ''}
                                </Text>
                              ) : null}
                              {snapshot?.drafts.some((d) => d.member === person.member_id) ? (
                                <StatusPill
                                  label={t('Score draft saved on device')}
                                  icon="saved"
                                  tone="info"
                                  styles={styles}
                                />
                              ) : null}
                              {!completed &&
                              editor !== person.member_id &&
                              roster.definition?.length &&
                              (value === 'present' ||
                                result ||
                                queuedResult ||
                                snapshot?.drafts.some((d) => d.member === person.member_id)) ? (
                                <Button
                                  title={
                                    editor === person.member_id
                                      ? 'Scores editor open'
                                      : queuedResult
                                        ? 'Review saved scores'
                                        : result
                                          ? 'Review / correct scores'
                                          : 'Record assessment scores'
                                  }
                                  disabled={
                                    completed ||
                                    beforeStart ||
                                    editor === person.member_id ||
                                    saving ||
                                    draftSaving ||
                                    busy ||
                                    closing
                                  }
                                  onPress={() => setEditor(person.member_id)}
                                  styles={styles}
                                  icon="assessment"
                                  fill
                                />
                              ) : null}
                              {editor === person.member_id &&
                              snapshot &&
                              roster.definition?.length ? (
                                <ScoreEditor
                                  key={`${roster.event.id}:${person.member_id}:${result?.revision || 0}`}
                                  owner={owner}
                                  event={roster.event.id}
                                  member={person.member_id}
                                  name={person.name}
                                  definition={roster.definition}
                                  result={result}
                                  queuedResult={queuedResult}
                                  savedDraft={snapshot.drafts.find(
                                    (d) => d.member === person.member_id,
                                  )}
                                  store={store}
                                  styles={styles}
                                  locked={
                                    saving ||
                                    busy ||
                                    closing ||
                                    snapshot.roster.blocked ||
                                    institutionPaused ||
                                    paused ||
                                    finishing ||
                                    !!queuedResult ||
                                    !person.active ||
                                    value !== 'present' ||
                                    roster.event.state !== 'scheduled' ||
                                    beforeStart
                                  }
                                  onPersisting={setDraftSaving}
                                  onDraftSaved={async () => {
                                    await reloadLocal()
                                  }}
                                  onError={(message) => {
                                    if (alive.current) setMessage(message)
                                  }}
                                  onSubmit={submitCommand}
                                  onClose={() => setEditor(null)}
                                />
                              ) : null}
                            </>
                          ) : null}
                        </View>
                      )
                    })}
                    {!filtered.length ? (
                      <Text style={styles.hint}>
                        {t(search ? 'No athletes match this name.' : 'This event has no athletes.')}
                      </Text>
                    ) : null}
                    {snapshot &&
                    (roster.event.kind !== 'assessment' || eventStage === 'results') &&
                    roster.event.state === 'scheduled' &&
                    (!groupAvailable || !presentCount) ? (
                      <View style={styles.card}>
                        <SectionLabel styles={styles}>
                          {l('Finish event', 'إنهاء الموعد')}
                        </SectionLabel>
                        {!completionProblems.length &&
                        !pending.length &&
                        !snapshot.drafts.length ? (
                          <Text style={styles.hint}>
                            {l(
                              'Everything is recorded. Finish the event when you are done.',
                              'تم تسجيل كل شيء. أنهِ الموعد عند الانتهاء.',
                            )}
                          </Text>
                        ) : null}
                        {completionProblems.map((problem) => (
                          <Text key={t(problem)} style={styles.hint}>
                            {t(problem)}
                          </Text>
                        ))}
                        {pending.length ? (
                          <Text style={styles.hint}>
                            {pending.length} {t('saved change(s) awaiting confirmation.')}{' '}
                          </Text>
                        ) : null}
                        {snapshot.drafts.length ? (
                          <Text style={styles.hint}>
                            {' '}
                            {t('Submit or discard')} {snapshot.drafts.length}{' '}
                            {t('score draft(s) before completing.')}{' '}
                          </Text>
                        ) : null}
                      </View>
                    ) : null}
                    {snapshot ? (
                      <View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ expanded: showDeviceOptions }}
                          onPress={() => setShowDeviceOptions((open) => !open)}
                          style={{ minHeight: 44, justifyContent: 'center' }}
                        >
                          <Text style={styles.link}>
                            {showDeviceOptions
                              ? l('Hide device options', 'إخفاء خيارات الجهاز')
                              : l('Device copy options', 'خيارات النسخة المحفوظة')}
                          </Text>
                        </Pressable>
                        {showDeviceOptions ? (
                          <Button
                            title={l(
                              'Remove device copy / discard pending work',
                              'حذف نسخة الجهاز / تجاهل العمل المعلّق',
                            )}
                            disabled={
                              busy ||
                              saving ||
                              draftSaving ||
                              closing ||
                              pending.some((c) => c.state === 'sending')
                            }
                            onPress={removeCopy}
                            styles={styles}
                            danger
                          />
                        ) : null}
                      </View>
                    ) : null}
                  </>
                ) : null}
              </>
            ) : busy ? (
              <ActivityIndicator accessibilityLabel={t('Opening event roster')} />
            ) : (
              <Text style={styles.hint}>
                {' '}
                {t(
                  'No offline roster exists. Connect to your institution and reopen this event.',
                )}{' '}
              </Text>
            )}
          </>
        )}
      </ScrollView>
      {selected && roster && !groupEvent && !workoutView && eventStage !== 'preview'
        ? (() => {
            const nextResults =
              roster.event.kind === 'assessment' &&
              eventStage === 'attendance' &&
              roster.event.state === 'scheduled'
            const nextWorkouts =
              groupAvailable &&
              eventStage === 'attendance' &&
              roster.event.state === 'scheduled' &&
              (!allAttendanceConfirmed || presentCount > 0)
            const canFinishHere =
              !!snapshot &&
              (roster.event.kind !== 'assessment' || eventStage === 'results') &&
              roster.event.state === 'scheduled' &&
              (!groupAvailable || (!presentCount && allAttendanceConfirmed))
            if (!nextResults && !nextWorkouts && !canFinishHere) return null
            return (
              <ActionBar styles={styles}>
                {nextResults ? (
                  <Button
                    title={l('Next: record results', 'التالي: تسجيل النتائج')}
                    onPress={goToResults}
                    styles={styles}
                    primary
                    fill
                    disabled={busy || saving || draftSaving || closing || bulkMarking}
                  />
                ) : null}
                {nextWorkouts ? (
                  <Button
                    title={l('Next: record workouts', 'التالي: تسجيل التمارين')}
                    onPress={() => void openGroupSheets()}
                    styles={styles}
                    primary
                    fill
                    disabled={
                      busy || saving || draftSaving || groupPersisting || closing || bulkMarking
                    }
                  />
                ) : null}
                {canFinishHere && snapshot ? (
                  <Button
                    title={
                      finishing
                        ? l('Waiting for confirmation…', 'بانتظار التأكيد…')
                        : l('Finish event', 'إنهاء الموعد')
                    }
                    onPress={finish}
                    styles={styles}
                    primary={!nextWorkouts}
                    fill
                    disabled={
                      busy ||
                      saving ||
                      draftSaving ||
                      closing ||
                      institutionPaused ||
                      snapshot.roster.blocked ||
                      !!pending.length ||
                      !!snapshot.drafts.length ||
                      !!completionProblems.length ||
                      beforeStart
                    }
                  />
                ) : null}
              </ActionBar>
            )
          })()
        : null}
      <ScrollView
        style={{ display: homeTab === 'saved' && !selected && !workoutView ? 'flex' : 'none' }}
        contentContainerStyle={[styles.content, { paddingBottom: 96 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{l('Saved', 'المحفوظات')}</Text>
        <Text style={styles.hint}>
          {l(
            'Downloaded activities stay available on this device. Recorded changes may still need to sync.',
            'تبقى الأنشطة المنزّلة متاحة على هذا الجهاز. قد تحتاج التغييرات المسجلة إلى مزامنة.',
          )}
        </Text>
        <Segmented
          label={l('Saved activity type', 'نوع المحفوظات')}
          wrap
          value={savedFilter}
          onChange={setSavedFilter}
          options={[
            { value: 'all', label: l('All', 'الكل') },
            { value: 'workouts', label: l('Workouts', 'التمارين') },
            { value: 'events', label: l('Events', 'المواعيد') },
            { value: 'assessments', label: l('Assessments', 'التقييمات') },
          ]}
          styles={styles}
        />
        {savedCards.map((item) => {
          const event = item.kind === 'event' ? item.event.event : null
          const record = item.kind === 'event' ? null : item.record
          const title = event
            ? event.title
            : item.kind === 'group'
              ? record!.package.title
              : language === 'ar' && record!.package.day_name_ar
                ? record!.package.day_name_ar
                : record!.package.day_name
          const awaiting =
            item.kind === 'event'
              ? item.event.blocked || queueHead?.event_id === item.id
              : !!record?.pending ||
                !!record?.intent ||
                !!record?.completionIntent ||
                (!!record && record.localRevision !== record.syncedRevision)
          return (
            <Pressable
              key={`${item.kind}:${item.id}`}
              accessibilityRole="button"
              accessibilityLabel={`${l('Open saved', 'فتح المحفوظ')} ${title}`}
              onPress={() => {
                if (item.kind === 'workout') {
                  setSoloPackage(item.record.package)
                  setWorkoutsOpened(true)
                  setWorkoutView(true)
                } else void openEvent(item.id)
              }}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            >
              <View style={styles.cardRow}>
                <View style={styles.kindBadge}>
                  <Icon
                    name={
                      item.category === 'workouts'
                        ? 'workout'
                        : item.category === 'assessments'
                          ? 'assessment'
                          : 'event'
                    }
                    styles={styles}
                    size={18}
                  />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.rowTitle} numberOfLines={2}>
                    {item.kind === 'workout' ? record!.package.member_name : title}
                  </Text>
                  <Text style={styles.meta} numberOfLines={2}>
                    {item.kind === 'workout'
                      ? `${title} · `
                      : item.category === 'workouts'
                        ? `${l('Group workout', 'تمرين جماعي')} · `
                        : item.category === 'assessments'
                          ? `${l('Assessment', 'تقييم')} · `
                          : `${l('Event', 'موعد')} · `}
                    {event
                      ? displayDate(event.starts_at, language)
                      : record!.package.starts_at
                        ? displayDate(record!.package.starts_at, language)
                        : record!.package.training_date}
                  </Text>
                  <View style={styles.metaRow}>
                    {awaiting ? (
                      <StatusPill
                        label={l('Needs review or sync', 'يحتاج مراجعة أو مزامنة')}
                        tone="warning"
                        icon="alert"
                        styles={styles}
                      />
                    ) : (
                      <StatusPill
                        label={l('Available offline', 'متاح دون اتصال')}
                        icon="saved"
                        styles={styles}
                      />
                    )}
                  </View>
                </View>
                <Icon name="forward" styles={styles} size={18} muted rtl={language === 'ar'} />
              </View>
            </Pressable>
          )
        })}
        {!savedReady && !savedError ? (
          <ActivityIndicator accessibilityLabel={l('Loading saved work', 'جارٍ تحميل المحفوظات')} />
        ) : null}
        {savedError ? <Text style={styles.message}>{savedError}</Text> : null}
        {!savedCards.length && savedReady && !savedError ? (
          <FieldEmptyState
            icon="saved"
            title={l('Nothing saved here yet', 'لا توجد محفوظات هنا بعد')}
            description={l(
              'Open an event or download a workout while connected.',
              'افتح موعداً أو نزّل تمريناً أثناء الاتصال.',
            )}
            action={
              savedFilter === 'all'
                ? l('Browse workouts', 'تصفح التمارين')
                : l('Show all saved', 'عرض كل المحفوظات')
            }
            onAction={() => (savedFilter === 'all' ? switchTab('workouts') : setSavedFilter('all'))}
            styles={styles}
          />
        ) : null}
        {savedLimit < savedRecordTotal ? (
          <Button
            title={l('Load more saved workouts', 'عرض مزيد من التمارين المحفوظة')}
            secondary
            onPress={() => setSavedLimit((limit) => limit + 20)}
            styles={styles}
          />
        ) : null}
      </ScrollView>
      {!selected && (!workoutView || (!workoutDetail && !soloPackage)) ? (
        <FieldBottomNav current={homeTab} onChange={switchTab} styles={styles} />
      ) : null}
      {filtersOpen ? (
        <View style={styles.sheetBackdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={l('Close filters', 'إغلاق التصفية')}
            onPress={() => setFiltersOpen(false)}
            style={{ flex: 1 }}
          />
          <Animated.View style={{ maxHeight: '85%', transform: [{ translateY: sheetY }] }}>
            <ScrollView
              contentContainerStyle={styles.filterSheet}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.sheetHandle} />
              <View style={[styles.rowHeader, { justifyContent: 'space-between' }]}>
                <Text style={styles.cardTitle} accessibilityRole="header">
                  {l('Schedule filters', 'تصفية الجدول')}
                </Text>
                <IconButton
                  name="close"
                  label={l('Close filters', 'إغلاق التصفية')}
                  onPress={() => setFiltersOpen(false)}
                  styles={styles}
                />
              </View>
              <SectionLabel
                styles={styles}
                trailing={
                  <Button
                    title={l('Today', 'اليوم')}
                    small
                    ghost
                    disabled={draftDay === localDate(new Date())}
                    onPress={() => setDraftDay(localDate(new Date()))}
                    styles={styles}
                  />
                }
              >
                {l('Date', 'التاريخ')}
              </SectionLabel>
              <FieldDatePicker selected={draftDay} onChange={setDraftDay} styles={styles} />
              <SectionLabel styles={styles}>{l('Show', 'عرض')}</SectionLabel>
              <Segmented
                label={l('Show', 'عرض')}
                wrap
                value={draftRecordFilter}
                onChange={setDraftRecordFilter}
                options={[
                  { value: 'all', label: l('All', 'الكل') },
                  { value: 'training', label: l('Events', 'المواعيد') },
                  { value: 'assessment', label: l('Assessments', 'التقييمات') },
                  { value: 'workout', label: l('Workouts', 'التمارين') },
                ]}
                styles={styles}
              />
              <SectionLabel styles={styles}>{l('Order', 'الترتيب')}</SectionLabel>
              <Segmented
                label={l('Order', 'الترتيب')}
                value={draftLatestFirst ? 'latest' : 'earliest'}
                onChange={(value) => setDraftLatestFirst(value === 'latest')}
                options={[
                  { value: 'earliest', label: l('Earliest first', 'الأبكر أولاً') },
                  { value: 'latest', label: l('Latest first', 'الأحدث أولاً') },
                ]}
                styles={styles}
              />
              <View style={[styles.actionRow, { marginTop: 6 }]}>
                <View style={styles.actionCell}>
                  <Button
                    title={l('Clear', 'مسح')}
                    fill
                    onPress={() => {
                      setDraftRecordFilter('all')
                      setDraftLatestFirst(false)
                      setDraftDay(localDate(new Date()))
                    }}
                    styles={styles}
                  />
                </View>
                <View style={styles.actionCell}>
                  <Button
                    title={l('Apply', 'تطبيق')}
                    primary
                    fill
                    disabled={refreshingSchedule || workoutLoading}
                    onPress={() => applyScheduleFilters(draftDay)}
                    styles={styles}
                  />
                </View>
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      ) : null}
    </View>
  )
}
