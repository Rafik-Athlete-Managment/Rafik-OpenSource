import { RecoveryPanel } from './RecoveryPanel'
import { EventHistory } from './EventHistory'
import { useLanguage } from './Language'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ActivityIndicator,
  Alert,
  AppState,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { NativeClient, operationId } from './native'
import {
  ApiFailure,
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
import { Button, Tab, displayDate, localDate, type Styles } from './ui'
import { ScoreEditor } from './ScoreEditor'
import { checkCapabilities, type CapabilityCheck } from './capabilities'
import { WorkoutsScreen } from './WorkoutsScreen'
import { downloadGroupEvent } from './group-download'
import type { FieldWorkoutPackage } from './workout-model'

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
  accountMenu,
  onEventOpen,
}: {
  client: NativeClient
  store: FieldStore
  institution: string
  styles: Styles
  closing: boolean
  onPersisting: (busy: boolean) => void
  accountOpen: boolean
  onAccountPress: () => void
  accountMenu: ReactNode
  onEventOpen: () => void
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
  const [workoutView, setWorkoutView] = useState(false)
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
  const [recordFilter, setRecordFilter] = useState<'all' | 'training' | 'assessment'>('all')
  const [draftRecordFilter, setDraftRecordFilter] = useState<'all' | 'training' | 'assessment'>(
    'all',
  )
  const [latestFirst, setLatestFirst] = useState(false)
  const [draftLatestFirst, setDraftLatestFirst] = useState(false)
  const [visibleCount, setVisibleCount] = useState(5)
  const [showOtherSaved, setShowOtherSaved] = useState(false)
  const [showDeviceOptions, setShowDeviceOptions] = useState(false)
  const [workoutsOpened, setWorkoutsOpened] = useState(false)
  const [workoutPersisting, setWorkoutPersisting] = useState(false)
  const [groupPersisting, setGroupPersisting] = useState(false)
  const [compatibility, setCompatibility] = useState<CapabilityCheck | null>(null)
  const [compatibilityError, setCompatibilityError] = useState('')
  const [showCompatibility, setShowCompatibility] = useState(false)
  const [compatibilityAttempt, setCompatibilityAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setCompatibility(null)
    setCompatibilityError('')
    void checkCapabilities((path) => client.request(path)).then(
      (result) => {
        if (active) setCompatibility(result)
      },
      (error) => {
        if (active) setCompatibilityError(failureText(error))
      },
    )
    return () => {
      active = false
    }
  }, [client, compatibilityAttempt])
  const [search, setSearch] = useState('')
  const [reviewing, setReviewing] = useState(false)
  const [now, setNow] = useState(Date.now)
  const alive = useRef(true)
  const selectedRef = useRef<string | null>(null)
  const busyRef = useRef(false)
  const refreshingRef = useRef(false)
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
      if (alive.current) setMessage(failureText(error))
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
      if (alive.current && !selectedRef.current)
        setMessage(`${failureText(error)} Previously opened events remain below.`)
    } finally {
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
        setRefreshNotice(
          payload.action === 'finish'
            ? l(
                'Event saved on this phone. Waiting to send.',
                'حُفظ الموعد على هذا الهاتف. بانتظار الإرسال.',
              )
            : l(
                'Results saved on this phone. Waiting to send.',
                'حُفظت النتائج على هذا الهاتف. بانتظار الإرسال.',
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
  const list = availableEvents
    .filter(
      (event) => onSelectedDay(event) && (recordFilter === 'all' || event.kind === recordFilter),
    )
    .sort((a, b) =>
      latestFirst
        ? Date.parse(b.starts_at) - Date.parse(a.starts_at)
        : Date.parse(a.starts_at) - Date.parse(b.starts_at),
    )
  const otherSaved = cached.filter((item) => !onSelectedDay(item.event))
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
  function leaveEvent() {
    if (saving || draftSaving || workoutPersisting || groupPersisting || busy || closing) return
    if (editor) {
      Alert.alert(
        l('Leave this event?', 'مغادرة هذا الموعد؟'),
        l(
          'Save or submit the open assessment entry first. Work already saved on this phone will stay available.',
          'احفظ أو أرسل نتيجة التقييم المفتوحة أولاً. سيبقى العمل المحفوظ على الهاتف متاحاً.',
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
      if (workoutView) {
        setHeaderRefreshing(true)
        setRefreshSignal((value) => value + 1)
      } else void refresh()
      return
    }
    if (pending.length || snapshot?.drafts.length) {
      setRefreshNotice(
        l(
          'Send or review saved changes before refreshing.',
          'أرسل التغييرات المحفوظة أو راجعها قبل التحديث.',
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
  function applyScheduleFilters(day: string) {
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
    setRecordFilter(draftRecordFilter)
    setLatestFirst(draftLatestFirst)
    setVisibleCount(5)
    setFiltersOpen(false)
    void refresh(0, false, day)
  }
  return (
    <View style={{ flex: 1 }}>
      {!selected ? (
        <View style={styles.appBar}>
          <View style={styles.topbar}>
            <Text style={styles.kicker}>{l('RAFIK FIELD', 'رفيق الميداني')}</Text>
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={l('Refresh', 'تحديث')}
                disabled={busy || refreshingSchedule || headerRefreshing || closing}
                onPress={refreshCurrent}
                style={styles.headerIcon}
              >
                {refreshingSchedule || headerRefreshing ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <Text style={styles.link}>↻</Text>
                )}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={l('Account menu', 'قائمة الحساب')}
                accessibilityState={{ expanded: accountOpen }}
                onPress={onAccountPress}
                style={styles.headerIcon}
              >
                <Text style={styles.link}>⋯</Text>
              </Pressable>
            </View>
          </View>
          <View accessibilityRole="tablist" style={styles.tabBar}>
            <Tab
              title={l('Schedule', 'الجدول')}
              selected={!workoutView}
              disabled={saving || draftSaving || workoutPersisting || groupPersisting || closing}
              onPress={() => {
                setWorkoutView(false)
                setGroupEvent(null)
              }}
              styles={styles}
            />
            <Tab
              title={l('Solo workouts', 'التمارين الفردية')}
              selected={workoutView}
              disabled={saving || draftSaving || workoutPersisting || groupPersisting || closing}
              onPress={() => {
                setGroupEvent(null)
                setWorkoutsOpened(true)
                setWorkoutView(true)
              }}
              styles={styles}
            />
          </View>
        </View>
      ) : (
        <View style={styles.eventHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {roster?.event.title || l('Event', 'الموعد')}
            </Text>
            <Text style={styles.hint}>
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
                    : l('Step 1 of 2 · Attendance', 'الخطوة ١ من ٢ · الحضور')}
            </Text>
          </View>
          {groupEvent || eventStage !== 'preview' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
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
              style={styles.headerIcon}
            >
              <Text style={styles.link}>‹</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={l('Refresh event', 'تحديث الموعد')}
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
            style={styles.headerIcon}
          >
            {busy || headerRefreshing ? (
              <ActivityIndicator size="small" />
            ) : (
              <Text style={styles.link}>↻</Text>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={l(
              'Leave event and continue later',
              'مغادرة الموعد والمتابعة لاحقاً',
            )}
            disabled={
              saving || draftSaving || workoutPersisting || groupPersisting || busy || closing
            }
            onPress={leaveEvent}
            style={styles.accountButton}
          >
            <Text style={styles.link}>{l('Close ×', 'إغلاق ×')}</Text>
          </Pressable>
        </View>
      )}
      {!selected ? accountMenu : null}
      {refreshNotice ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={l('Dismiss refresh warning', 'إخفاء تنبيه التحديث')}
          onPress={() => setRefreshNotice('')}
          style={styles.noticeToast}
        >
          <Text style={styles.hint}>{refreshNotice}</Text>
          <Text style={styles.link}>×</Text>
        </Pressable>
      ) : null}
      {selected && message ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.message, { marginHorizontal: 18, marginTop: 8 }]}
        >
          {t(message)}
        </Text>
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
            refreshSignal={refreshSignal}
            onRefreshComplete={() => setHeaderRefreshing(false)}
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
          />
        </View>
      ) : null}
      {selected && eventStage === 'preview' && !groupEvent ? (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {roster ? (
            <>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{roster.event.title}</Text>
                <Text style={styles.hint}>
                  {displayDate(roster.event.starts_at, language)} ·{' '}
                  {l(
                    roster.event.kind === 'assessment' ? 'Assessment' : 'Training',
                    roster.event.kind === 'assessment' ? 'تقييم' : 'تدريب',
                  )}
                </Text>
                <Text style={styles.hint}>
                  {roster.people.filter((person) => person.duty === 'trainee').length}{' '}
                  {l('athletes', 'رياضيين')} ·{' '}
                  {l(roster.event.state, roster.event.state === 'completed' ? 'مكتمل' : 'مجدول')}
                </Text>
              </View>
              {groupPreview ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>{l('Workout preview', 'معاينة التمرين')}</Text>
                  <Text style={styles.hint}>
                    {language === 'ar' && groupPreview.day_name_ar
                      ? groupPreview.day_name_ar
                      : groupPreview.day_name}
                  </Text>
                  {groupPreview.exercises.slice(0, 5).map((exercise) => (
                    <Text key={exercise.key} style={styles.hint}>
                      • {language === 'ar' && exercise.name_ar ? exercise.name_ar : exercise.name}
                    </Text>
                  ))}
                  {groupPreview.exercises.length > 5 ? (
                    <Text style={styles.hint}>
                      +{groupPreview.exercises.length - 5} {l('more', 'أخرى')}
                    </Text>
                  ) : null}
                </View>
              ) : null}
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
              />
              {beforeStart && !completed ? (
                <Text style={styles.hint}>
                  {l(
                    'Need a different time? Reschedule it on the web.',
                    'هل تحتاج وقتاً آخر؟ أعد جدولته عبر الويب.',
                  )}
                </Text>
              ) : null}
            </>
          ) : (
            <ActivityIndicator accessibilityLabel={l('Opening event', 'جارٍ فتح الموعد')} />
          )}
        </ScrollView>
      ) : null}
      <ScrollView
        style={{
          display:
            workoutView || groupEvent || (selected && eventStage === 'preview') ? 'none' : 'flex',
        }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {!selected ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>
                {selectedDay === localDate(new Date())
                  ? l('Today’s schedule', 'جدول اليوم')
                  : new Intl.DateTimeFormat(language === 'ar' ? 'ar-AE' : 'en-GB', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    }).format(new Date(`${selectedDay}T12:00:00`))}
              </Text>
              <Text style={styles.hint}>
                {l('Your training and assessments for this day.', 'تدريباتك وتقييماتك لهذا اليوم.')}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={l('Filter schedule', 'تصفية الجدول')}
              onPress={() => {
                setDraftDay(selectedDay)
                setDraftRecordFilter(recordFilter)
                setDraftLatestFirst(latestFirst)
                setFiltersOpen(true)
              }}
              style={styles.headerIcon}
            >
              <Text style={styles.link}>☷</Text>
            </Pressable>
          </View>
        ) : null}
        {!selected && message ? (
          <Text accessibilityLiveRegion="polite" style={styles.message}>
            {t(message)}
          </Text>
        ) : null}
        {institutionPaused && queueHead.event_id !== selected ? (
          <View style={styles.card}>
            <Text style={styles.label}>{t('Saved attendance needs review')}</Text>
            <Text style={styles.hint}>
              {' '}
              {t('Sending is paused at')}{' '}
              {cached.find((c) => c.event.id === queueHead.event_id)?.event.title ||
                t('an earlier event')}{' '}
              {t('. Resolve it before sending more changes.')}{' '}
            </Text>
            <Button
              title="Review saved change"
              disabled={busy || saving || closing}
              onPress={() => void openEvent(queueHead.event_id)}
              styles={styles}
            />
          </View>
        ) : null}
        {!selected ? (
          <>
            {list.slice(0, visibleCount).map((event) => (
              <Pressable
                key={event.id}
                accessibilityRole="button"
                disabled={busy || closing}
                accessibilityLabel={`${l('Open', 'فتح')} ${event.title}`}
                onPress={() => void openEvent(event.id)}
                style={[
                  styles.card,
                  event.kind === 'assessment' && styles.assessmentCard,
                  event.state === 'completed' && styles.completedCard,
                ]}
              >
                <Text style={styles.cardTitle}>{event.title}</Text>
                <Text style={styles.hint}>
                  {displayDate(event.starts_at, language)} ·{' '}
                  {event.kind === 'assessment' ? l('Assessment', 'تقييم') : l('Training', 'تدريب')}{' '}
                  ·{' '}
                  {l(
                    event.state,
                    event.state === 'completed'
                      ? 'مكتمل'
                      : event.state === 'cancelled'
                        ? 'ملغى'
                        : 'مجدول',
                  )}
                </Text>
                {event.location ? <Text style={styles.hint}>{event.location}</Text> : null}
                {cached.some((c) => c.event.id === event.id) ? (
                  <Text style={styles.link}>{l('Available offline', 'متاح دون اتصال')}</Text>
                ) : null}
              </Pressable>
            ))}
            {visibleCount < list.length || next !== null ? (
              <Button
                title={l('Load more', 'عرض المزيد')}
                disabled={busy || refreshingSchedule || closing}
                onPress={() =>
                  visibleCount < list.length
                    ? setVisibleCount((count) => count + 5)
                    : next !== null
                      ? void refresh(next)
                      : undefined
                }
                styles={styles}
              />
            ) : null}
            {!list.length && !busy ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  {l('Nothing scheduled for this day', 'لا توجد مواعيد لهذا اليوم')}
                </Text>
                <Text style={styles.hint}>
                  {l(
                    'Choose another date or refresh when connected.',
                    'اختر يوماً آخر أو حدّث عند الاتصال.',
                  )}
                </Text>
              </View>
            ) : null}
            {otherSaved.length ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showOtherSaved }}
                  onPress={() => setShowOtherSaved((open) => !open)}
                  style={{ minHeight: 44, justifyContent: 'center' }}
                >
                  <Text style={styles.link}>
                    {l('Other events saved on this phone', 'مواعيد أخرى محفوظة على الهاتف')} (
                    {otherSaved.length}) {showOtherSaved ? '⌃' : '⌄'}
                  </Text>
                </Pressable>
                {showOtherSaved
                  ? otherSaved.map((item) => (
                      <Pressable
                        key={item.event.id}
                        accessibilityRole="button"
                        onPress={() => void openEvent(item.event.id)}
                        style={styles.card}
                      >
                        <Text style={styles.cardTitle}>{item.event.title}</Text>
                        <Text style={styles.hint}>
                          {displayDate(item.event.starts_at, language)}
                        </Text>
                      </Pressable>
                    ))
                  : null}
              </>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: showCompatibility }}
              onPress={() => setShowCompatibility((value) => !value)}
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
              <Text style={styles.hint}>
                {l('App connection details', 'تفاصيل اتصال التطبيق')}{' '}
                {showCompatibility ? '⌃' : '⌄'}
              </Text>
            </Pressable>
            {showCompatibility ? (
              <View style={styles.card}>
                <Text style={styles.label}>{l('Field app features', 'ميزات تطبيق الميدان')}</Text>
                {compatibilityError ? (
                  <Text style={styles.message}>{t(compatibilityError)}</Text>
                ) : compatibility?.state === 'legacy' ? (
                  <Text style={styles.hint}>
                    {l(
                      'This server does not report field capabilities. Ask your institution to check the app and server versions. Saved work is retained.',
                      'لا يعرض هذا الخادم إمكانات تطبيق الميدان. اطلب من مؤسستك التحقق من إصداري التطبيق والخادم. يبقى العمل المحفوظ محفوظاً.',
                    )}
                  </Text>
                ) : compatibility?.state === 'available' ? (
                  <>
                    {(
                      [
                        ['attendance', l('Attendance', 'الحضور')],
                        ['assessments', l('Assessment results', 'نتائج التقييم')],
                        ['event_completion', l('Event completion', 'إنهاء الموعد')],
                        [
                          'individual_workout_recording',
                          l('Individual workout recording', 'تسجيل التمرين الفردي'),
                        ],
                        [
                          'group_workout_recording',
                          l('Group workout recording', 'تسجيل التمرين الجماعي'),
                        ],
                        [
                          'day_only_calendar',
                          l('Day-only appointments in Schedule', 'مواعيد بتاريخ فقط في الجدول'),
                        ],
                      ] as const
                    ).map(([key, label]) => (
                      <Text key={key} style={styles.hint}>
                        {label}
                        {': '}
                        {compatibility.value.features[key]
                          ? l('Supported', 'مدعوم')
                          : l('Not available in the field app', 'غير متاح في تطبيق الميدان')}
                      </Text>
                    ))}
                    <Text style={styles.hint}>
                      {l(
                        'Server support does not change your account permissions. Open a group training event to download participant sheets.',
                        'دعم الخادم لا يغيّر صلاحيات حسابك. افتح موعد تدريب جماعي لتنزيل سجلات المشاركين.',
                      )}
                    </Text>
                  </>
                ) : (
                  <ActivityIndicator
                    accessibilityLabel={l(
                      'Checking server compatibility',
                      'جارٍ التحقق من توافق الخادم',
                    )}
                  />
                )}
                <Button
                  title={l('Check again', 'تحقق مجدداً')}
                  disabled={!compatibility && !compatibilityError}
                  onPress={() => setCompatibilityAttempt((value) => value + 1)}
                  styles={styles}
                />
              </View>
            ) : null}
          </>
        ) : (
          <>
            {roster ? (
              <>
                {groupAvailable && !allAttendanceConfirmed ? (
                  <Text style={styles.hint}>
                    {l(
                      'Mark everyone present, absent or excused. When attendance is confirmed, continue to workouts.',
                      'حدّد حضور الجميع أو غيابهم أو إعفاءهم. بعد تأكيد الحضور، انتقل إلى التمارين.',
                    )}
                  </Text>
                ) : groupAvailable && allAttendanceConfirmed && !presentCount ? (
                  <Text style={styles.hint}>
                    {l(
                      'No athletes are present. You can finish the event here.',
                      'لا يوجد رياضيون حاضرون. يمكنك إنهاء الموعد هنا.',
                    )}
                  </Text>
                ) : null}
                <Text style={styles.hint}>
                  {displayDate(roster.event.starts_at, language)} {t('·')} {t(roster.event.kind)}{' '}
                  {t('·')} {t(roster.event.state)}
                </Text>
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
                  <Text style={styles.hint}>
                    {' '}
                    {t('Roster downloaded')} {displayDate(snapshot.roster.saved_at, language)}
                    {t('. Permission is checked again when sending.')}{' '}
                  </Text>
                ) : null}
                {snapshot?.roster.blocked ? (
                  <Text style={styles.message}>
                    {' '}
                    {t(
                      'Access blocked. Saved work is retained for explicit review or discard; attendance entry is locked.',
                    )}{' '}
                  </Text>
                ) : null}
                {paused ? (
                  <Text style={styles.message}>
                    {' '}
                    {t(
                      'Sending is paused. Review the saved changes against current server records below. Keep or export what you need before explicitly discarding this device copy and reopening online.',
                    )}{' '}
                  </Text>
                ) : null}
                {snapshot && (paused || snapshot.roster.blocked || reviewing) ? (
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
                ) : snapshot && (pending.length || snapshot.drafts.length) ? (
                  <Button
                    title={l('Review saved work', 'مراجعة العمل المحفوظ')}
                    onPress={() => setReviewing(true)}
                    styles={styles}
                    disabled={busy || saving || draftSaving || closing}
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
                  <Text style={styles.message}>
                    {' '}
                    {t(
                      'This older attendance package has no assessment definition. Resolve saved attendance, then refresh online to enter scores.',
                    )}{' '}
                  </Text>
                ) : null}
                {!beforeStart || completed || !!pending.length ? (
                  <>
                    <TextInput
                      accessibilityLabel={t('Find athlete in this event')}
                      editable={!draftSaving && !saving}
                      placeholder={t('Find athlete in this event')}
                      placeholderTextColor={styles.hint.color}
                      value={search}
                      onChangeText={setSearch}
                      style={styles.input}
                    />
                    <Text style={styles.hint}>
                      {roster.people.filter((p) => p.duty === 'trainee').length}{' '}
                      {t('athletes in event ·')} {filtered.length} {t('shown')}{' '}
                    </Text>
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
                          <View style={styles.toolbar}>
                            <Text style={[styles.cardTitle, { flex: 1 }]} numberOfLines={2}>
                              {person.name}
                            </Text>
                            <Text accessibilityLiveRegion="polite" style={styles.hint}>
                              {t(value)}
                              {unsettled ? ` · ${t(stateText[latest.state])}` : ''}
                            </Text>
                          </View>
                          {latest?.error ? (
                            <Text style={styles.message}>{t(latest.error)}</Text>
                          ) : null}
                          {!person.active ? (
                            <Text style={styles.hint}>
                              {t('Inactive athlete — entry unavailable')}
                            </Text>
                          ) : null}
                          {eventStage === 'attendance' && !completed ? (
                            <View style={styles.actions}>
                              {(['present', 'absent', 'excused'] as const).map((mark) => (
                                <Button
                                  key={mark}
                                  title={
                                    mark === 'present'
                                      ? l('Present', 'حاضر')
                                      : mark === 'absent'
                                        ? l('Absent', 'غائب')
                                        : l('Excused', 'معذور')
                                  }
                                  styles={styles}
                                  primary={value === mark}
                                  disabled={locked || value === mark}
                                  onPress={() => void record(person.member_id, mark)}
                                />
                              ))}
                            </View>
                          ) : null}
                          {expandedPerson === person.member_id ? (
                            <>
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
                              {roster.event.kind === 'assessment' && eventStage === 'results' ? (
                                <>
                                  {result ? (
                                    <View style={{ gap: 6 }}>
                                      <Text style={styles.label}>
                                        {' '}
                                        {t('Confirmed assessment · revision')} {result.revision}
                                      </Text>
                                      {roster.definition?.map((drill) => (
                                        <Text key={drill.key} style={styles.hint}>
                                          {drill.name}
                                          {t(':')} {result.values[drill.key] ?? t('Not recorded')}
                                          {drill.unit ? ` ${drill.unit}` : ''}
                                        </Text>
                                      ))}
                                      {result.note ? (
                                        <Text style={styles.hint}>
                                          {t('Assessor note:')} {result.note}
                                        </Text>
                                      ) : null}
                                    </View>
                                  ) : null}
                                  {resultCommand ? (
                                    <Text style={styles.hint}>
                                      {' '}
                                      {t('Scores:')} {t(stateText[resultCommand.state])}
                                      {resultCommand.error ? ` · ${t(resultCommand.error)}` : ''}
                                    </Text>
                                  ) : null}
                                  {snapshot?.drafts.some((d) => d.member === person.member_id) ? (
                                    <Text style={styles.hint}>
                                      {t('Score draft saved on device')}
                                    </Text>
                                  ) : null}
                                  {!completed &&
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
                                      onDraftSaved={async (discarded) => {
                                        await reloadLocal()
                                        if (discarded && alive.current)
                                          setRefreshNotice(
                                            l(
                                              'Device draft discarded.',
                                              'حُذفت المسودة من الجهاز.',
                                            ),
                                          )
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
                            </>
                          ) : null}
                          {eventStage === 'attendance' || eventStage === 'results' ? (
                            <Pressable
                              accessibilityRole="button"
                              accessibilityState={{ expanded: expandedPerson === person.member_id }}
                              onPress={() =>
                                setExpandedPerson(
                                  expandedPerson === person.member_id ? null : person.member_id,
                                )
                              }
                              style={{ minHeight: 44, justifyContent: 'center' }}
                            >
                              <Text style={styles.link}>
                                {expandedPerson === person.member_id
                                  ? l('Hide details', 'إخفاء التفاصيل')
                                  : eventStage === 'results' && value === 'present'
                                    ? l('Record or review results', 'تسجيل النتائج أو مراجعتها')
                                    : l('History and corrections', 'السجل والتصحيحات')}
                              </Text>
                            </Pressable>
                          ) : null}
                        </View>
                      )
                    })}
                    {!filtered.length ? (
                      <Text style={styles.hint}>
                        {t(search ? 'No athletes match this name.' : 'This event has no athletes.')}
                      </Text>
                    ) : null}
                    {roster.event.kind === 'assessment' &&
                    eventStage === 'attendance' &&
                    roster.event.state === 'scheduled' ? (
                      <Button
                        title={l('Next: record results', 'التالي: تسجيل النتائج')}
                        onPress={() => {
                          if (!allAttendanceConfirmed) {
                            const unmarked = roster.people.filter(
                              (person) =>
                                person.duty === 'trainee' &&
                                person.active &&
                                person.attendance === 'unmarked',
                            ).length
                            setRefreshNotice(
                              unmarked
                                ? l(
                                    `${unmarked} athlete(s) still need an attendance mark.`,
                                    `لم يُحدَّد حضور ${unmarked} من الرياضيين بعد.`,
                                  )
                                : l(
                                    'Wait for attendance confirmation, then continue.',
                                    'انتظر تأكيد الحضور ثم تابع.',
                                  ),
                            )
                            return
                          }
                          setExpandedPerson(null)
                          setEventStage('results')
                        }}
                        styles={styles}
                        primary
                        disabled={busy || saving || draftSaving || closing}
                      />
                    ) : null}
                    {groupAvailable &&
                    eventStage === 'attendance' &&
                    roster.event.state === 'scheduled' &&
                    (!allAttendanceConfirmed || presentCount > 0) ? (
                      <Button
                        title={l('Next: record workouts', 'التالي: تسجيل التمارين')}
                        onPress={() => void openGroupSheets()}
                        styles={styles}
                        primary
                        disabled={busy || saving || draftSaving || groupPersisting || closing}
                      />
                    ) : null}
                    {snapshot &&
                    (roster.event.kind !== 'assessment' || eventStage === 'results') &&
                    roster.event.state === 'scheduled' &&
                    (!groupAvailable || !presentCount) ? (
                      <View style={styles.card}>
                        <Text style={styles.cardTitle}>{l('Finish event', 'إنهاء الموعد')}</Text>
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
                        <Button
                          title={
                            finishing
                              ? l('Waiting for confirmation…', 'بانتظار التأكيد…')
                              : l('Finish event', 'إنهاء الموعد')
                          }
                          onPress={finish}
                          styles={styles}
                          primary
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
      <Modal
        transparent
        visible={filtersOpen}
        animationType="slide"
        onRequestClose={() => setFiltersOpen(false)}
      >
        <View style={styles.sheetBackdrop}>
          <ScrollView
            style={{ maxHeight: '85%' }}
            contentContainerStyle={styles.filterSheet}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.cardTitle}>{l('Schedule filters', 'تصفية الجدول')}</Text>
            <Text style={styles.label}>{l('Date', 'التاريخ')}</Text>
            <TextInput
              accessibilityLabel={l('Date YYYY-MM-DD', 'التاريخ بصيغة YYYY-MM-DD')}
              value={draftDay}
              onChangeText={setDraftDay}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={styles.hint.color}
              style={styles.input}
            />
            <Button
              title={l('Today', 'اليوم')}
              onPress={() => setDraftDay(localDate(new Date()))}
              styles={styles}
            />
            <Text style={styles.label}>{l('Show', 'عرض')}</Text>
            <View style={styles.actions}>
              {(
                [
                  ['all', l('All', 'الكل')],
                  ['training', l('Training', 'التدريب')],
                  ['assessment', l('Assessments', 'التقييمات')],
                ] as const
              ).map(([kind, label]) => (
                <Button
                  key={kind}
                  title={label}
                  primary={draftRecordFilter === kind}
                  onPress={() => setDraftRecordFilter(kind)}
                  styles={styles}
                />
              ))}
            </View>
            <Text style={styles.label}>{l('Order', 'الترتيب')}</Text>
            <View style={styles.actions}>
              <Button
                title={l('Earliest first', 'الأبكر أولاً')}
                primary={!draftLatestFirst}
                onPress={() => setDraftLatestFirst(false)}
                styles={styles}
              />
              <Button
                title={l('Latest first', 'الأحدث أولاً')}
                primary={draftLatestFirst}
                onPress={() => setDraftLatestFirst(true)}
                styles={styles}
              />
            </View>
            <View style={styles.actions}>
              <Button
                title={l('Apply', 'تطبيق')}
                primary
                disabled={refreshingSchedule}
                onPress={() => applyScheduleFilters(draftDay)}
                styles={styles}
              />
              <Button
                title={l('Clear', 'مسح')}
                onPress={() => {
                  setDraftRecordFilter('all')
                  setDraftLatestFirst(false)
                  setDraftDay(localDate(new Date()))
                }}
                styles={styles}
              />
              <Button
                title={l('Close', 'إغلاق')}
                onPress={() => setFiltersOpen(false)}
                styles={styles}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  )
}
