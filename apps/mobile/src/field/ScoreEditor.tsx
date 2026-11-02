import { useLanguage } from './Language'
import { useRef, useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import type { FieldResult, FieldResultCommand } from '@rafik/shared/contracts'
import { failureText, scoreValues, type FieldDrill, type Owner, type ScoreDraft } from './model'
import type { FieldStore } from './store'
import { operationId } from './native'
import { Button, type Styles } from './ui'

/** Lets a coach enter, save and retry one athlete's assessment results on the device. */
export function ScoreEditor({
  owner,
  event,
  member,
  name,
  definition,
  result,
  savedDraft,
  queuedResult,
  store,
  styles,
  locked,
  onPersisting,
  onDraftSaved,
  onError,
  onSubmit,
  onClose,
}: {
  owner: Owner
  event: string
  member: string
  name: string
  definition: FieldDrill[]
  result?: FieldResult
  savedDraft?: ScoreDraft
  queuedResult?: FieldResultCommand
  store: FieldStore
  styles: Styles
  locked: boolean
  onPersisting: (busy: boolean) => void
  onDraftSaved: (discarded?: boolean) => Promise<void>
  onError: (message: string) => void
  onSubmit: (payload: FieldResultCommand) => Promise<boolean>
  onClose: () => void
}) {
  const { t } = useLanguage()
  const [draft, setDraft] = useState<ScoreDraft>(
    () =>
      savedDraft || {
        member,
        values: Object.fromEntries(
          Object.entries(queuedResult?.values || result?.values || {}).map(([key, value]) => [
            key,
            String(value),
          ]),
        ),
        note: queuedResult ? queuedResult.note : result?.note || '',
      },
  )
  const draftRef = useRef(draft)
  const sequence = useRef(0)
  const commandBusy = useRef(false)
  const flight = useRef<Promise<void>>(Promise.resolve())
  const [status, setStatus] = useState(
    savedDraft ? 'Unsynced draft restored from this device.' : '',
  )
  const [persisting, setPersisting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Keep typed values as strings and finish their device write before creating a server command.
  function edit(next: ScoreDraft) {
    if (locked || commandBusy.current) return
    draftRef.current = next
    setDraft(next)
    setError('')
    setPersisting(true)
    onPersisting(true)
    setStatus('Saving score draft on this device…')
    const version = ++sequence.current
    const write = store.saveDraft(owner, event, next)
    flight.current = write
    void write
      .then(() => {
        if (version !== sequence.current) return
        setPersisting(false)
        onPersisting(false)
        setStatus('')
        void onDraftSaved().catch((error) => onError(failureText(error)))
      })
      .catch((e) => {
        if (version !== sequence.current) return
        setPersisting(false)
        onPersisting(true)
        setError(failureText(e))
        setStatus('Draft was not saved. Retry device save or explicitly discard it before leaving.')
        onError(failureText(e))
      })
  }
  async function submit() {
    if (locked || commandBusy.current || persisting) return
    commandBusy.current = true
    setSubmitting(true)
    setError('')
    try {
      await flight.current
      const values = scoreValues(definition, draftRef.current)
      const stored = await onSubmit({
        action: 'result',
        view: 'trainer',
        id: event,
        member,
        values,
        note: draftRef.current.note.trim(),
        revision: result?.revision || 0,
        operation: operationId(),
      })
      if (!stored)
        setError(
          'Scores were not queued. Keep the draft and retry after resolving the error above.',
        )
    } catch (e) {
      setError(failureText(e))
    } finally {
      commandBusy.current = false
      setSubmitting(false)
    }
  }
  async function discard() {
    if (persisting || commandBusy.current) return
    commandBusy.current = true
    setSubmitting(true)
    try {
      await flight.current.catch(() => undefined)
      await store.discardDraft(owner, event, member)
      onPersisting(false)
      await onDraftSaved(true)
      onClose()
    } catch (e) {
      setError(failureText(e))
    } finally {
      commandBusy.current = false
      setSubmitting(false)
    }
  }
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>
        {name} {t('· Assessment scores')}
      </Text>
      <Text style={styles.hint}>
        {' '}
        {t('Assessor-led performance measurements. These are not clinical findings.')}{' '}
      </Text>
      {definition.map((drill) => (
        <View key={drill.key} style={{ gap: 6 }}>
          <Text style={styles.label}>
            {drill.name}
            {drill.unit ? ` (${drill.unit})` : ''}
          </Text>
          <TextInput
            accessibilityLabel={`${drill.name}${drill.unit ? ` (${drill.unit})` : ''}`}
            value={draft.values[drill.key] || ''}
            editable={!locked && !submitting}
            keyboardType={drill.kind === 'number' ? 'decimal-pad' : 'default'}
            maxLength={drill.kind === 'number' ? 40 : 1000}
            style={styles.input}
            onChangeText={(value) =>
              edit({
                ...draftRef.current,
                values: { ...draftRef.current.values, [drill.key]: value },
              })
            }
          />
          {drill.min !== undefined || drill.max !== undefined ? (
            <Text style={styles.hint}>
              {' '}
              {t('Allowed:')} {drill.min ?? t('no minimum')} {t('to')}{' '}
              {drill.max ?? t('no maximum')}
              {drill.unit ? ` ${drill.unit}` : ''}
            </Text>
          ) : null}
        </View>
      ))}
      <Text style={styles.label}>{t('Assessor note (optional)')}</Text>
      <TextInput
        accessibilityLabel={t('Assessor note')}
        value={draft.note}
        editable={!locked && !submitting}
        multiline
        maxLength={2000}
        style={[styles.input, { minHeight: 90, paddingVertical: 12 }]}
        onChangeText={(note) => edit({ ...draftRef.current, note })}
      />
      {status ? (
        <Text accessibilityLiveRegion="polite" style={styles.hint}>
          {t(status)}
        </Text>
      ) : null}
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.message}>
          {t(error)}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Button
          title={submitting ? 'Saving scores…' : result ? 'Save score correction' : 'Save scores'}
          disabled={locked || persisting || submitting}
          onPress={() => void submit()}
          styles={styles}
          primary
        />
        <Button
          title="Close editor"
          disabled={persisting || submitting}
          onPress={() => {
            void flight.current.then(onClose).catch((e) => setError(failureText(e)))
          }}
          styles={styles}
        />
        {savedDraft || sequence.current > 0 ? (
          <Button
            title="Discard draft"
            disabled={persisting || submitting}
            onPress={() => void discard()}
            styles={styles}
          />
        ) : null}
        {error && !locked ? (
          <Button
            title="Retry device save"
            disabled={persisting || submitting}
            onPress={() => edit(draftRef.current)}
            styles={styles}
          />
        ) : null}
      </View>
    </View>
  )
}
