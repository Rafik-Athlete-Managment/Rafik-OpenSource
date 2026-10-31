import { useEffect, useRef, useState } from 'react'
import { Text, View } from 'react-native'
import type { NativeClient } from './native'
import { attendance, failureText, ApiFailure, type FieldDrill } from './model'
import { useLanguage } from './Language'
import { Button, displayDate, type Styles } from './ui'

type Entry = import('@rafik/shared/contracts').FieldHistoryEntry
type Page = import('@rafik/shared/contracts').FieldHistoryPage
function page(input: unknown, member: string, kind: string): Page {
  const p = input as Page
  if (
    !p ||
    !Array.isArray(p.items) ||
    p.items.length > 25 ||
    !(p.next === null || (Number.isSafeInteger(p.next) && p.next >= 0))
  )
    throw Error('Invalid server data.')
  for (const row of p.items) {
    if (
      !row ||
      typeof row !== 'object' ||
      typeof row.id !== 'string' ||
      row.kind !== kind ||
      (row as Entry & { member_id: string }).member_id !== member ||
      typeof row.recorded_at !== 'string' ||
      !Number.isFinite(Date.parse(row.recorded_at)) ||
      !(row.recorded_by === null || typeof row.recorded_by === 'string') ||
      !(row.recorded_name === null || typeof row.recorded_name === 'string')
    )
      throw Error('Invalid server data.')
    if (row.kind === 'attendance') {
      attendance(row.attendance)
      attendance(row.previous_attendance)
    } else if (
      !Number.isSafeInteger(row.revision) ||
      !row.values ||
      typeof row.values !== 'object' ||
      Array.isArray(row.values) ||
      typeof row.note !== 'string' ||
      Object.values(row.values).some(
        (v) => typeof v !== 'string' && (typeof v !== 'number' || !Number.isFinite(v)),
      )
    )
      throw Error('Invalid server data.')
  }
  return p
}
export function EventHistory({
  client,
  event,
  member,
  name,
  definition,
  assessment,
  styles,
  disabled,
  onDenied,
}: {
  client: NativeClient
  institution: string
  event: string
  member: string
  name: string
  definition?: FieldDrill[]
  assessment: boolean
  styles: Styles
  disabled: boolean
  onDenied: () => Promise<void>
}) {
  const { t, l, language } = useLanguage()
  const [data, setData] = useState<Page | null>(null)
  const [kind, setKind] = useState<'attendance' | 'results'>('attendance')
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const alive = useRef(true),
    generation = useRef(0),
    flight = useRef(false)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      generation.current++
    }
  }, [])
  async function load(nextKind = kind, more = false) {
    if (flight.current || disabled) return
    flight.current = true
    const stamp = ++generation.current
    setBusy(true)
    setError('')
    setOpen(true)
    if (nextKind !== kind) {
      setKind(nextKind)
      setData(null)
    }
    try {
      const query = new URLSearchParams({
        view: 'trainer',
        id: event,
        historyOnly: 'true',
        historyKind: nextKind,
        historyMember: member,
        historyOffset: String(more ? data?.next || 0 : 0),
      })
      const result = page(await client.request(`/institution/calendar?${query}`), member, nextKind)
      if (!alive.current || stamp !== generation.current) return
      setData((prior) =>
        more && prior
          ? {
              ...result,
              items: [...new Map([...prior.items, ...result.items].map((r) => [r.id, r])).values()],
            }
          : result,
      )
    } catch (e) {
      if (e instanceof ApiFailure && e.status === 403) {
        if (alive.current) setData(null)
        await onDenied()
      }
      if (alive.current && stamp === generation.current) setError(failureText(e))
    } finally {
      flight.current = false
      if (alive.current && stamp === generation.current) setBusy(false)
    }
  }
  if (!open)
    return (
      <Button
        title={l('Correction history', 'سجل التصحيحات')}
        disabled={disabled || busy}
        onPress={() => void load('attendance')}
        styles={styles}
      />
    )
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>
        {name} · {l('Correction history', 'سجل التصحيحات')}
      </Text>
      <Text style={styles.hint}>
        {l(
          'Online only. Includes the original entry and later corrections; newer entries appear first.',
          'أثناء الاتصال فقط. يشمل الإدخال الأصلي والتصحيحات اللاحقة، والأحدث أولاً.',
        )}
      </Text>
      <View style={styles.actions}>
        <Button
          title={l('Attendance history', 'سجل الحضور')}
          disabled={busy || disabled}
          onPress={() => void load('attendance')}
          styles={styles}
          primary={open && kind === 'attendance'}
        />
        {assessment ? (
          <Button
            title={l('Score history', 'سجل النتائج')}
            disabled={busy || disabled}
            onPress={() => void load('results')}
            styles={styles}
            primary={open && kind === 'results'}
          />
        ) : null}
        {open ? (
          <Button
            title={l('Hide history', 'إخفاء السجل')}
            disabled={busy}
            onPress={() => {
              setOpen(false)
              setData(null)
              setError('')
            }}
            styles={styles}
          />
        ) : null}
      </View>
      {open ? (
        <>
          {busy ? (
            <Text accessibilityLiveRegion="polite" style={styles.hint}>
              {l('Loading history…', 'جارٍ تحميل السجل…')}
            </Text>
          ) : null}
          {error ? (
            <Text accessibilityLiveRegion="polite" style={styles.message}>
              {t(error)}
            </Text>
          ) : null}
          {data ? (
            <>
              {!data.items.length ? (
                <Text style={styles.hint}>
                  {l('No recorded history for this athlete.', 'لا يوجد سجل لهذا الرياضي.')}
                </Text>
              ) : null}
              {data.items.map((entry) => (
                <View key={entry.id} style={styles.historyRow}>
                  <Text style={styles.label}>
                    {displayDate(entry.recorded_at, language)} ·{' '}
                    {entry.recorded_name || l('Institution staff', 'موظف المؤسسة')}
                  </Text>
                  {entry.kind === 'attendance' ? (
                    <Text style={styles.hint}>
                      {t(entry.previous_attendance!)} {l('→', '←')} {t(entry.attendance!)}
                    </Text>
                  ) : (
                    <>
                      <Text style={styles.hint}>
                        {l('Revision', 'النسخة')} {entry.revision}
                      </Text>
                      {Object.entries(entry.values || {}).map(([key, value]) => {
                        const drill = definition?.find((d) => d.key === key)
                        return (
                          <Text key={key} style={styles.hint}>
                            {drill?.name || key}: {value}
                            {drill?.unit ? ` ${drill.unit}` : ''}
                          </Text>
                        )
                      })}
                      {entry.note ? (
                        <Text style={styles.hint}>
                          {l('Assessor note', 'ملاحظة المقيم')}: {entry.note}
                        </Text>
                      ) : null}
                    </>
                  )}
                </View>
              ))}
              {data.next !== null ? (
                <Button
                  title={l('Earlier entries', 'إدخالات أقدم')}
                  disabled={busy || disabled}
                  onPress={() => void load(kind, true)}
                  styles={styles}
                />
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
    </View>
  )
}
