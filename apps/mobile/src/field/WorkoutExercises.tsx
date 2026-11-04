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
    const sets = entries.filter((entry) => entry.exercise_key === exercise.key)
    const done = sets.filter((entry) => entry.completed).length
    return (
      <View key={exercise.key} style={styles.card}>
        <View style={styles.rowHeader}>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text style={styles.cardTitle}>{exerciseName}</Text>
            <Text style={styles.meta}>
              {sets.length} {l('sets', 'مجموعات')} · {l('Rest', 'الراحة')} {exercise.rest}{' '}
              {l('sec', 'ثانية')}
            </Text>
          </View>
          <Text
            style={[
              styles.label,
              { flexShrink: 0, writingDirection: 'ltr' },
              done === sets.length && sets.length ? styles.setCheckDoneText : null,
            ]}
          >
            {done}/{sets.length}
          </Text>
        </View>
        {exercise.note ? <Text style={styles.hint}>{exercise.note}</Text> : null}
        {entries.map((entry, index) => {
          if (entry.exercise_key !== exercise.key) return null
          const target = targets.get(entry.exercise_key + ':' + entry.set_index) || entry
          const targetText =
            exercise.kind === 'strength'
              ? `${target.reps} × ${target.load} ${entry.unit}`
              : exercise.kind === 'timed'
                ? `${target.seconds ?? '—'} ${l('sec', 'ثانية')}`
                : `${target.metres ?? '—'} ${l('m', 'م')}`
          const locked = !editable || busy || invalidInput
          return (
            <View key={`${entry.exercise_key}:${entry.set_index}`} style={styles.setRow}>
              <View style={styles.rowHeader}>
                <Text style={styles.label}>
                  {l('Set', 'مجموعة')} {entry.set_index + 1}
                </Text>
                <Text style={[styles.meta, { flex: 1 }]} numberOfLines={1}>
                  {l('Target', 'الهدف')}: {targetText}
                </Text>
              </View>
              {entry.exercise_id ? (
                <Text style={styles.meta}>
                  {l('Previously chosen alternative retained', 'يُحتفظ بالبديل المختار سابقاً')}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
                {fields.map((field) => (
                  <View key={field} style={{ flex: 1, minWidth: 0, gap: 4 }}>
                    <Text style={styles.meta} numberOfLines={1}>
                      {label(field, entry.unit)}
                    </Text>
                    <TextInput
                      accessibilityLabel={`${exerciseName}, ${l('set', 'مجموعة')} ${entry.set_index + 1}, ${label(field, entry.unit)}`}
                      style={[styles.input, !editable && styles.inputReadOnly]}
                      keyboardType="decimal-pad"
                      placeholderTextColor={styles.hint.color}
                      editable={editable && !busy}
                      value={
                        raw[index + ':' + field] ??
                        (entry[field] === null ? '' : String(entry[field]))
                      }
                      onChangeText={(value) => onMeasure(index, field, value)}
                    />
                  </View>
                ))}
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel={`${exerciseName}, ${l('set', 'مجموعة')} ${entry.set_index + 1}, ${
                    entry.completed
                      ? l('Set done', 'اكتملت المجموعة')
                      : l('Mark set done', 'تأكيد إتمام المجموعة')
                  }`}
                  accessibilityState={{ checked: entry.completed, disabled: locked }}
                  disabled={locked}
                  onPress={() => onToggle(index)}
                  style={[
                    styles.setCheck,
                    { alignSelf: 'flex-end', minHeight: 48 },
                    entry.completed && styles.setCheckDone,
                    locked && styles.disabled,
                  ]}
                >
                  <Icon
                    name="check"
                    styles={styles}
                    size={18}
                    color={entry.completed ? styles.setCheckDoneText?.color : styles.hint.color}
                  />
                  <Text style={[styles.buttonText, entry.completed && styles.setCheckDoneText]}>
                    {entry.completed ? l('Done', 'تمت') : l('Mark done', 'تأكيد')}
                  </Text>
                </Pressable>
              </View>
            </View>
          )
        })}
      </View>
    )
  })
}
