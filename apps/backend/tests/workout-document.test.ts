import { test } from "node:test";
import assert from "node:assert/strict";
import { prescribedEntries } from "../server/workout-document.ts";
import type { PrescriptionExercise } from "@rafik/shared/workouts";

const exercise: PrescriptionExercise = {
  key: "bodyweight",
  exerciseId: "push-up",
  kind: "strength",
  sets: 2,
  reps: 8,
  load: 0,
  unit: "kg",
  rest: 30,
  note: "",
};

test("prescribed defaults retain zero load and remain unfinished independent entries", () => {
  const before = JSON.stringify(exercise);
  const result = prescribedEntries([exercise]);
  assert.deepEqual(
    result,
    [0, 1].map((set_index) => ({
      exercise_key: "bodyweight",
      set_index,
      reps: 8,
      load: 0,
      unit: "kg",
      seconds: null,
      metres: null,
      effort: null,
      completed: false,
    })),
  );
  assert.notEqual(result[0], result[1]);
  result[0].reps = 12;
  assert.equal(result[1].reps, 8);
  assert.equal(JSON.stringify(exercise), before);
});

test("timed/distance per-set targets preserve nullable measures and fall back to the prescription", () => {
  const result = prescribedEntries([
    {
      ...exercise,
      key: "hold",
      kind: "timed",
      seconds: 30,
      targets: [{ reps: 0, load: 0, seconds: 45, effort: 6.5 }],
    },
    {
      ...exercise,
      key: "run",
      kind: "distance",
      sets: 1,
      metres: 400,
      effort: 7,
    },
  ]);
  assert.equal(result[0].seconds, 45);
  assert.equal(result[0].effort, 6.5);
  assert.equal(result[1].seconds, 30);
  assert.equal(result[1].effort, null);
  assert.equal(result[2].metres, 400);
  assert.equal(result[2].effort, 7);
  assert.ok(result.every((row) => !row.completed));
});
