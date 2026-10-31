import { useEffect, useRef, useState } from 'react'
import { Alert, Share, Text, View } from 'react-native'
import {
  ApiFailure,
  failureText,
  fieldRoster,
  ownerKey,
  stateText,
  type EventSnapshot,
  type FieldRoster,
  type Owner,
} from './model'
import type { NativeClient } from './native'
import type { FieldStore } from './store'
import { useLanguage } from './Language'
import { Button, displayDate, type Styles } from './ui'

export function RecoveryPanel({
  owner,
  snapshot,
  client,
  store,
  styles,
  disabled,
  onDenied,
}: {
  owner: Owner
  snapshot: EventSnapshot
  client: NativeClient
  store: FieldStore
  styles: Styles
  disabled: boolean
  onDenied: () => Promise<void>
}) {
  const { t, l, language } = useLanguage()
  const [current, setCurrent] = useState<FieldRoster | null>(null)
  const [readAt, setReadAt] = useState(''),
    [error, setError] = useState('')
  const [busy, setBusy] = useState(false),
    [sharing, setSharing] = useState(false)
  const [count, setCount] = useState(10)
  const alive = useRef(true),
    flight = useRef(false)
  const event = snapshot.roster.event.id
  const pending = snapshot.commands.filter((c) => c.state !== 'acknowledged')
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  async function compare() {
    if (flight.current || disabled) return
    flight.current = true
    setBusy(true)
    setError('')
    try {
      const fresh = fieldRoster(
        await client.request(`/institution/calendar?view=trainer&id=${event}&summary=true`),
        event,
      )
      if (alive.current) {
        setCurrent(fresh)
        setReadAt(new Date().toISOString())
      }
    } catch (e) {
      if (e instanceof ApiFailure && e.status === 403) {
        if (alive.current) setCurrent(null)
        await onDenied()
      }
      if (alive.current) setError(failureText(e))
    } finally {
      flight.current = false
      if (alive.current) setBusy(false)
    }
  }
  async function share(selection?: { operation?: string; member?: string }) {
    if (flight.current || disabled) return
    flight.current = true
    setSharing(true)
    setError('')
    try {
      // Re-read durable storage for this exact owner, never another screen's in-memory draft.
      const saved = await store.snapshot(owner, event)
      if (!saved) throw Error('The request could not be completed.')
      const commands = saved.commands.filter(
        (c) =>
          c.state !== 'acknowledged' && (!selection || c.payload.operation === selection.operation),
      )
      const drafts = selection?.operation
        ? []
        : saved.drafts.filter((d) => !selection || d.member === selection.member)
      if (commands.some((c) => c.owner !== ownerKey(owner) || c.state === 'sending'))
        throw Error('Wait for the current request to settle before removing saved work.')
      const members = new Set([
        ...commands.flatMap((c) => ('member' in c.payload ? [c.payload.member] : [])),
        ...drafts.map((d) => d.member),
      ])
      const recovery = {
        format: 'rafik-field-recovery',
        version: 1,
        exported_at: new Date().toISOString(),
        owner,
        event: saved.roster.event,
        warning:
          'Manual reconciliation only. Uncertain operations may already exist on the server. This export is not an import or retry command.',
        athletes: saved.roster.people
          .filter((p) => members.has(p.member_id))
          .map((p) => ({ id: p.member_id, name: p.name })),
        commands: commands.map((c) => ({
          sequence: c.seq,
          state: c.state,
          error: c.error,
          payload: c.payload,
        })),
        drafts,
      }
      const message = JSON.stringify(recovery, null, 2)
      // Android shares text through IPC. Avoid a too-large intent; leave original work untouched.
      if (message.length > 60_000) {
        if (alive.current)
          setError(
            l(
              'This copy is too large for text sharing. Use the individual recovery buttons below. Keep any remaining work on this device and ask your institution for assisted recovery.',
              'النسخة كبيرة للمشاركة النصية. استخدم أزرار استرداد التغييرات الفردية أدناه. احتفظ بأي عمل متبقٍ على الجهاز واطلب مساعدة مؤسستك.',
            ),
          )
        return
      }
      if (!alive.current) return
      await Share.share({ title: l('Rafik field recovery', 'استرداد رفيق الميداني'), message })
      // Sharing/dismissal is never evidence that another app saved or delivered the copy.
    } catch (e) {
      if (alive.current) setError(failureText(e))
    } finally {
      flight.current = false
      if (alive.current) setSharing(false)
    }
  }
  function confirmShare(selection?: { operation?: string; member?: string }) {
    Alert.alert(
      l('Share a recovery copy?', 'مشاركة نسخة استرداد؟'),
      l(
        'This shares plain-text athlete names, attendance, scores, notes and exact pending operations with the app you choose. Use only an institution-approved destination. It does not confirm, resend or discard work. This copy cannot be imported automatically.',
        'تشارك أسماء الرياضيين والحضور والنتائج والملاحظات والعمليات المعلقة كنص غير مشفّر مع التطبيق الذي تختاره. استخدم جهة تعتمدها مؤسستك فقط. لا يؤكد ذلك العمل أو يعيد إرساله أو يحذفه. لا يمكن استيراد النسخة تلقائياً.',
      ),
      [
        { text: l('Keep private', 'إبقاء النسخة خاصة'), style: 'cancel' },
        {
          text: l('Open share sheet', 'فتح خيارات المشاركة'),
          onPress: () => {
            void share(selection)
          },
        },
      ],
    )
  }
  const rows = [
    ...pending.map((c) => ({ key: c.payload.operation, command: c, draft: undefined })),
    ...snapshot.drafts.map((d) => ({ key: `draft:${d.member}`, command: undefined, draft: d })),
  ]
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{l('Review saved work', 'مراجعة العمل المحفوظ')}</Text>
      <Text style={styles.hint}>
        {l(
          'Compare with a fresh server read. This never replaces your device copy or changes a queued operation. For an uncertain result, retry the exact operation before entering it again. A rejected or blocked operation cannot be forced through.',
          'قارن بقراءة حديثة من الخادم دون استبدال نسخة الجهاز أو تغيير عملية معلقة. إذا كانت النتيجة غير مؤكدة، أعد محاولة العملية نفسها قبل إعادة إدخالها. لا يمكن فرض إرسال عملية مرفوضة أو محظورة.',
        )}
      </Text>
      <View style={styles.actions}>
        <Button
          title={l('Read current server records', 'قراءة سجلات الخادم الحالية')}
          disabled={disabled || busy || sharing}
          onPress={() => void compare()}
          styles={styles}
        />
        <Button
          title={l('Share recovery copy', 'مشاركة نسخة استرداد')}
          disabled={disabled || busy || sharing}
          onPress={() => confirmShare()}
          styles={styles}
        />
      </View>
      {busy || sharing ? (
        <Text accessibilityLiveRegion="polite" style={styles.hint}>
          {l('Preparing…', 'جارٍ التجهيز…')}
        </Text>
      ) : null}
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.message}>
          {t(error)}
        </Text>
      ) : null}
      {current ? (
        <Text style={styles.hint}>
          {l('Server snapshot', 'لقطة الخادم')}: {displayDate(readAt, language)} ·{' '}
          {t(current.event.state)} · {l('event revision', 'نسخة الموعد')} {current.event.revision}.{' '}
          {l(
            'Refresh again if another person has made changes.',
            'حدّث مجدداً إذا أجرى شخص آخر تغييرات.',
          )}
        </Text>
      ) : null}
      {rows.slice(0, count).map((row) => {
        const payload = row.command?.payload
        const member = row.draft?.member || (payload && 'member' in payload ? payload.member : null)
        const name =
          snapshot.roster.people.find((p) => p.member_id === member)?.name ||
          l('Event completion', 'إنهاء الموعد')
        const result = current?.results?.find((r) => r.member_id === member)
        const person = current?.people.find((p) => p.member_id === member)
        const values =
          row.draft?.values || (payload?.action === 'result' ? payload.values : undefined)
        const note = row.draft?.note ?? (payload?.action === 'result' ? payload.note : undefined)
        return (
          <View key={row.key} style={styles.historyRow}>
            <Text style={styles.label}>
              {name} ·{' '}
              {row.command
                ? t(stateText[row.command.state])
                : l('Unsubmitted draft', 'مسودة لم تُرسل')}
            </Text>
            {row.command?.error ? <Text style={styles.message}>{t(row.command.error)}</Text> : null}
            {payload ? (
              <Text style={styles.hint}>
                {l('Saved base revision', 'النسخة الأساسية المحفوظة')}: {payload.revision}
              </Text>
            ) : null}
            {payload?.action === 'attendance' ? (
              <>
                <Text style={styles.hint}>
                  {l('On device', 'على الجهاز')}: {t(payload.attendance)}
                </Text>
                {current ? (
                  <Text style={styles.hint}>
                    {l('On server', 'على الخادم')}:{' '}
                    {person
                      ? `${t(person.attendance)} · ${l('revision', 'النسخة')} ${person.revision}`
                      : l('Athlete unavailable', 'الرياضي غير متاح')}
                  </Text>
                ) : null}
              </>
            ) : null}
            {values ? (
              <>
                {[...new Set([...Object.keys(values), ...Object.keys(result?.values || {})])].map(
                  (key) => {
                    const drill = snapshot.roster.definition?.find((d) => d.key === key)
                    return (
                      <View key={key}>
                        <Text style={styles.hint}>
                          {drill?.name || key}
                          {drill?.unit ? ` (${drill.unit})` : ''}
                        </Text>
                        <Text style={styles.hint}>
                          {l('On device', 'على الجهاز')}:{' '}
                          {values[key] ?? l('Not entered', 'غير مدخل')}
                        </Text>
                        {current ? (
                          <Text style={styles.hint}>
                            {l('On server', 'على الخادم')}:{' '}
                            {result?.values[key] ?? l('No recorded value', 'لا توجد قيمة مسجلة')}
                          </Text>
                        ) : null}
                      </View>
                    )
                  },
                )}
                <Text style={styles.hint}>
                  {l('Device note', 'ملاحظة الجهاز')}: {note || l('None', 'لا توجد')}
                </Text>
                {current ? (
                  <Text style={styles.hint}>
                    {l('Server note', 'ملاحظة الخادم')}: {result?.note || l('None', 'لا توجد')} ·{' '}
                    {l('revision', 'النسخة')} {result?.revision ?? 0}
                  </Text>
                ) : null}
              </>
            ) : null}
            <Button
              title={l('Share this recovery item', 'مشاركة عنصر الاسترداد هذا')}
              styles={styles}
              disabled={disabled || busy || sharing}
              onPress={() =>
                confirmShare(
                  payload ? { operation: payload.operation } : { member: row.draft!.member },
                )
              }
            />
            {payload?.action === 'finish' ? (
              <Text style={styles.hint}>
                {l(
                  'Saved completion request; server status is shown above when authorized.',
                  'طلب إنهاء محفوظ؛ تظهر حالة الخادم أعلاه عند السماح بالوصول.',
                )}
              </Text>
            ) : null}
          </View>
        )
      })}
      {rows.length > count ? (
        <Button
          title={l('Show more saved work', 'عرض المزيد من العمل المحفوظ')}
          onPress={() => setCount((c) => c + 10)}
          styles={styles}
        />
      ) : null}
      <Text style={styles.hint}>
        {l(
          'To replace rejected work, keep or export what you need, explicitly discard the device copy, then reopen online and enter a reviewed correction against current records. Discard never reverses a server write. Exported copies are outside app encryption and retention.',
          'لاستبدال عمل مرفوض، احتفظ بما تحتاجه أو صدّره، ثم احذف نسخة الجهاز صراحة وافتح الموعد أثناء الاتصال لإدخال تصحيح مراجع وفق السجلات الحالية. الحذف لا يعكس كتابة على الخادم. النسخ المصدّرة خارج تشفير التطبيق وسياسة الاحتفاظ به.',
        )}
      </Text>
    </View>
  )
}
