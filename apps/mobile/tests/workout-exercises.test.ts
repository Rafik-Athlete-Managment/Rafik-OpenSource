import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { isValidElement, type ReactNode, type ReactElement } from 'react'
import type { FieldWorkoutEntry, FieldWorkoutPackage } from '../src/field/workout-model.ts'
import type { Styles } from '../src/field/ui'

// Test the real component's element/callback contract with host stubs, not a native renderer.
const dataUrl = (source: string) =>
  'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
const stubs: Record<string, string> = {
  'react/jsx-runtime': import.meta.resolve('react/jsx-runtime'),
  'react-native': dataUrl('export const Text="Text", TextInput="TextInput", View="View"'),
  './Language': dataUrl('export const useLanguage=()=>({language:"en",l:en=>en})'),
  './ui': dataUrl('export const Button="Button"'),
}
const compiled = ts
  .transpileModule(
    readFileSync(new URL('../src/field/WorkoutExercises.tsx', import.meta.url), 'utf8'),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  )
  .outputText.replace(/from ['"]([^'"]+)['"]/g, (_, name: string) => {
    assert.ok(stubs[name], 'Every runtime import must have an explicit host stub: ' + name)
    return 'from ' + JSON.stringify(stubs[name])
  })
const { WorkoutExercises } = (await import(dataUrl(compiled))) as {
  WorkoutExercises: (typeof import('../src/field/WorkoutExercises.tsx'))['WorkoutExercises']
}
function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!isValidElement<Record<string, unknown>>(node)) return []
  return [node, ...elements(node.props.children as ReactNode)]
}
const entry: FieldWorkoutEntry = {
  exercise_key: 'press',
  set_index: 0,
  reps: 8,
  load: 0,
  unit: 'kg',
  seconds: null,
  metres: null,
  effort: null,
  completed: false,
}
const workout: FieldWorkoutPackage = {
  id: 'occurrence',
  institution_id: 'institution',
  assignment_id: 'assignment',
  member_id: 'member',
  member_name: 'Athlete',
  occurrence_id: 'occurrence',
  title: 'Program',
  day_id: 'day',
  day_name: 'Strength',
  day_name_ar: '',
  starts_at: null,
  training_date: '2026-10-31',
  timezone: 'UTC',
  allow_provisional_start: false,
  can_record: true,
  session: null,
  exercises: [{ key: 'press', name: 'Press', name_ar: '', kind: 'strength', rest: 30, note: '' }],
  entries: [entry],
  targets: [entry],
}
const styles = { hint: { color: '#fff' } } as Styles

test('controlled workout fields preserve raw decimal text and report explicit edits/toggles to their owner', () => {
  const edits: unknown[] = [],
    toggles: number[] = []
  const nodes = elements(
    WorkoutExercises({
      workout,
      entries: [entry],
      raw: { '0:load': '12.' },
      editable: true,
      busy: false,
      invalidInput: false,
      styles,
      onMeasure: (...args) => edits.push(args),
      onToggle: (index) => toggles.push(index),
    }),
  )
  const load = nodes.find(
    (n) => n.type === 'TextInput' && n.props.accessibilityLabel === 'Press 1 Load (kg)',
  )!
  assert.equal(load.props.value, '12.')
  ;(load.props.onChangeText as (value: string) => void)('12.5')
  assert.deepEqual(edits, [[0, 'load', '12.5']])
  const done = nodes.find((n) => n.type === 'Button' && n.props.title === 'Mark set done')!
  ;(done.props.onPress as () => void)()
  assert.deepEqual(toggles, [0])
  assert.equal(entry.completed, false, 'presentation must not mutate actuals')
  assert.equal(entry.load, 0)
})

test('read-only and invalid-input states disable completion without changing prescribed targets', () => {
  for (const [editable, invalidInput] of [
    [false, false],
    [true, true],
  ]) {
    const nodes = elements(
      WorkoutExercises({
        workout,
        entries: [entry],
        raw: {},
        editable,
        busy: false,
        invalidInput,
        styles,
        onMeasure: () => assert.fail(),
        onToggle: () => assert.fail(),
      }),
    )
    const done = nodes.find((n) => n.type === 'Button' && n.props.title === 'Mark set done')!
    assert.equal(done.props.disabled, true)
    if (!editable)
      for (const input of nodes.filter((n) => n.type === 'TextInput'))
        assert.equal(input.props.editable, false)
  }
  assert.equal(workout.targets?.[0].completed, false)
})

test('timed and distance exercise sheets expose their own measure plus optional effort', () => {
  for (const [kind, label, value] of [
    ['timed', 'Seconds', ''],
    ['distance', 'Metres', '400'],
  ] as const) {
    const actual = { ...entry, metres: kind === 'distance' ? 400 : null }
    const variant = { ...workout, exercises: [{ ...workout.exercises[0], kind }] }
    const nodes = elements(
      WorkoutExercises({
        workout: variant,
        entries: [actual],
        raw: {},
        editable: true,
        busy: false,
        invalidInput: false,
        styles,
        onMeasure: () => {},
        onToggle: () => {},
      }),
    )
    const inputs = nodes.filter((n) => n.type === 'TextInput')
    assert.equal(inputs.length, 2)
    assert.equal(inputs[0].props.accessibilityLabel, 'Press 1 ' + label)
    assert.equal(inputs[0].props.value, value)
    assert.equal(inputs[1].props.accessibilityLabel, 'Press 1 Effort (RPE, optional)')
  }
})
