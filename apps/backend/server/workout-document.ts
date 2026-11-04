import type { PlanDay, Session } from "@rafik/shared/workouts";
import type { FieldWorkoutEntry } from "@rafik/shared/contracts";

/** Shapes written by SQL-validated publication/recording; not validators for external input. */
export type FrozenWorkout = {
  source?: string;
  day: PlanDay;
  adaptation_revision?: number;
};
export type WorkoutDocument = Omit<Session, "client_id" | "occurrence_id"> & {
  client_id: string | null;
  occurrence_id?: string | null;
  reviewed_by?: string | null;
  adaptation_revision?: number;
};

/** Prescribed defaults are unfinished targets, never evidence of actual completion. */
export function prescribedEntries(
  exercises: PlanDay["exercises"],
): FieldWorkoutEntry[] {
  return exercises.flatMap((e) =>
    Array.from({ length: e.sets }, (_, index) => {
      const target = e.targets?.[index] || e;
      return {
        exercise_key: e.key,
        set_index: index,
        reps: target.reps,
        load: target.load,
        unit: e.unit,
        seconds: target.seconds ?? null,
        metres: target.metres ?? null,
        effort: target.effort ?? null,
        completed: false,
      };
    }),
  );
}
