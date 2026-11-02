import { Pressable, Text, TextInput, View } from 'react-native'
import { useLanguage } from './Language'
import { Icon, type Styles } from './ui'
import type { FieldWorkoutEntry, FieldWorkoutPackage } from './workout-model'
import type { WorkoutMeasure } from './workout-input'

/** Shows exercise sets without owning drafts, persistence or server commands. */
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
  const targets = new Map(
    (workout.targets || workout.entries || []).map((entry) => [
      entry.exercise_key + ':' + entry.set_index,
      entry,
    ]),
  )
  const label = (field: WorkoutMeasure, unit: string) =>
    field === 'load'
      ? `${l('Load', 'الحمل')} (${unit})`
      : field === 'reps'
        ? l('Reps', 'تكرارات')
        : field === 'seconds'
          ? l('Seconds', 'ثوانٍ')
          : field === 'metres'
            ? l('Metres', 'أمتار')
            : l('Effort (optional)', 'الجهد (اختياري)')

  return workout.exercises.map((exercise) => {
    const exerciseName = language === 'ar' && exercise.name_ar ? exercise.name_ar : exercise.name
    const fields: WorkoutMeasure[] =
      exercise.kind === 'strength'
        ? ['load', 'reps']
        : exercise.kind === 'timed'
          ? ['seconds', 'effort']
          : ['metres', 'effort']
    return (
      <View key={exercise.key} style={styles.card}>
        <Text style={styles.cardTitle}>{exerciseName}</Text>
        {exercise.note ? <Text style={styles.hint}>{exercise.note}</Text> : null}
        <Text style={styles.hint}>
          {l('Rest', 'الراحة')}: {exercise.rest} {l('sec', 'ثانية')}
        </Text>
        {entries.map((entry, index) => {
          if (entry.exercise_key !== exercise.key) return null
          const target = targets.get(entry.exercise_key + ':' + entry.set_index) || entry
          const targetText =
            exercise.kind === 'strength'
              ? `${target.reps} × ${target.load} ${entry.unit}`
              : exercise.kind === 'timed'
                ? `${target.seconds ?? '—'} ${l('sec', 'ثانية')}`
                : `${target.metres ?? '—'} ${l('m', 'م')}`
          return (
            <View
              key={`${entry.exercise_key}:${entry.set_index}`}
              style={{
                gap: 8,
                paddingVertical: 10,
                borderTopWidth: 1,
                borderTopColor: styles.input.borderColor,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <Text style={styles.label}>
                  {l('Set', 'مجموعة')} {entry.set_index + 1}
                </Text>
                <Text style={[styles.hint, { flexShrink: 1 }]}>
                  {l('Target', 'الهدف')}: {targetText}
                </Text>
              </View>
              {entry.exercise_id ? (
                <Text style={styles.hint}>
                  {l('Previously chosen alternative retained', 'يُحتفظ بالبديل المختار سابقاً')}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {fields.map((field) => (
                  <View
                    key={field}
                    style={{ flexGrow: 1, flexBasis: field === 'effort' ? 120 : 100, gap: 5 }}
                  >
                    <Text style={styles.label}>{label(field, entry.unit)}</Text>
                    <TextInput
                      accessibilityLabel={`${exerciseName}, ${l('set', 'مجموعة')} ${entry.set_index + 1}, ${label(field, entry.unit)}`}
                      style={styles.input}
                      keyboardType="decimal-pad"
                      editable={editable && !busy}
                      value={
                        raw[index + ':' + field] ??
                        (entry[field] === null ? '' : String(entry[field]))
                      }
                      onChangeText={(value) => onMeasure(index, field, value)}
                    />
                  </View>
                ))}
              </View>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{
                  checked: entry.completed,
                  disabled: !editable || busy || invalidInput,
                }}
                disabled={!editable || busy || invalidInput}
                onPress={() => onToggle(index)}
                style={[
                  styles.setCheck,
                  entry.completed && styles.setCheckDone,
                  (!editable || busy || invalidInput) && styles.disabled,
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {entry.completed ? <Icon name="check" styles={styles} size={18} inverse /> : null}
                  <Text style={[styles.buttonText, entry.completed && styles.setCheckDoneText]}>
                    {entry.completed
                      ? l('Set done', 'اكتملت المجموعة')
                      : l('Mark set done', 'تأكيد إتمام المجموعة')}
                  </Text>
                </View>
              </Pressable>
            </View>
          )
        })}
      </View>
    )
  })
}
