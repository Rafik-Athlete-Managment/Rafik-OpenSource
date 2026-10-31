import { Text, TextInput, View } from 'react-native'
import { useLanguage } from './Language'
import { Button, type Styles } from './ui'
import type { FieldWorkoutEntry, FieldWorkoutPackage } from './workout-model'
import type { WorkoutMeasure } from './workout-input'

/** Controlled presentation only: drafts, persistence and replay remain in WorkoutsScreen. */
export function WorkoutExercises({
  workout,
  entries,
  raw,
  editable,
  busy,
  invalidInput,
  styles,
  onMeasure,
  onToggle,
}: {
  workout: FieldWorkoutPackage
  entries: FieldWorkoutEntry[]
  raw: Record<string, string>
  editable: boolean
  busy: boolean
  invalidInput: boolean
  styles: Styles
  onMeasure: (index: number, field: WorkoutMeasure, value: string) => void
  onToggle: (index: number) => void
}) {
  const { l, language } = useLanguage()
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
  const targetMap = new Map(
    (workout.targets || workout.entries || []).map((e) => [e.exercise_key + ':' + e.set_index, e]),
  )
  const targetFor = (e: FieldWorkoutEntry) => targetMap.get(e.exercise_key + ':' + e.set_index) || e

  return (
    <>
      {workout.exercises.map((ex) => (
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
                  {workout.targets || !workout.session
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
                      onChangeText={(value) => onMeasure(index, field, value)}
                    />
                  </View>
                ))}
                <Button
                  title={
                    e.completed ? l('Done ✓', 'تم ✓') : l('Mark set done', 'تأكيد إتمام المجموعة')
                  }
                  disabled={!editable || busy || invalidInput}
                  primary={e.completed}
                  onPress={() => onToggle(index)}
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
    </>
  )
}
