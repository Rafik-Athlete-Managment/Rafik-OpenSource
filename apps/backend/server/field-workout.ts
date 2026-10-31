import type { PlanDay } from "@rafik/shared/workouts";
import { prescribedEntries } from "./workout-document.ts";
import type {
  FieldWorkoutEntry,
  FieldWorkoutPackage,
} from "@rafik/shared/contracts";

import type {
  institution_assignments,
  institution_events,
  institution_sessions,
} from "./generated/prisma/client.ts";

type Assignment = Pick<institution_assignments, "id" | "member_id"> & {
  institution_versions: { title: string };
  institution_members_institution_assignments_institution_id_member_idToinstitution_members: {
    name: string;
  };
};
type Occurrence = Pick<
  institution_events,
  "id" | "title" | "starts_at" | "training_date" | "timezone"
>;
type Session = Pick<
  institution_sessions,
  "id" | "version" | "document" | "local_date" | "completed_at"
>;
type EntrySource = Omit<
  FieldWorkoutEntry,
  "exercise_id" | "seconds" | "metres" | "effort"
> &
  Partial<
    Pick<FieldWorkoutEntry, "exercise_id" | "seconds" | "metres" | "effort">
  >;

const entry = (e: EntrySource): FieldWorkoutEntry => ({
  exercise_id: e.exercise_id ?? null,
  exercise_key: e.exercise_key,
  set_index: e.set_index,
  reps: e.reps,
  load: e.load,
  unit: e.unit,
  seconds: e.seconds ?? null,
  metres: e.metres ?? null,
  effort: e.effort ?? null,
  completed: e.completed,
});

/** Called only inside workoutAgenda's authorized transaction; never an allocator. */
export function fieldWorkoutPackage(
  institution: string,
  assignment: Assignment,
  day: PlanDay | null | undefined,
  occurrence: Occurrence | null | undefined,
  session: Session | null | undefined,
  canStart: boolean,
  canRecord: boolean,
): FieldWorkoutPackage | null {
  if (!day || !occurrence) return null;
  // Session JSON is written by the validated recorder; this mapper only projects it.
  const document = session?.document as
    | {
        title?: string;
        entries?: FieldWorkoutEntry[];
        note?: string;
      }
    | undefined;
  const targets = prescribedEntries(day.exercises);
  return {
    id: occurrence.id,
    institution_id: institution,
    assignment_id: assignment.id,
    member_id: assignment.member_id,
    member_name:
      assignment
        .institution_members_institution_assignments_institution_id_member_idToinstitution_members
        .name,
    occurrence_id: occurrence.id,
    title:
      occurrence?.title ||
      document?.title ||
      assignment.institution_versions.title,
    day_id: day.id,
    day_name: day.name,
    day_name_ar: day.nameAr || "",
    starts_at: occurrence?.starts_at?.toISOString() || null,
    training_date: occurrence.training_date.toISOString().slice(0, 10),
    timezone: occurrence?.timezone || "UTC",
    allow_provisional_start: canStart,
    can_record: canRecord,
    exercises: day.exercises.map((e) => ({
      key: e.key,
      name: e.info?.name || e.exerciseId,
      name_ar: e.info?.name_ar || "",
      kind: e.kind || e.info?.kind || "strength",
      rest: e.rest || 0,
      note: e.note || "",
    })),
    targets: targets.map(entry),
    entries: (document?.entries || targets).map(entry),
    session: session
      ? {
          id: session.id,
          version: session.version,
          note: document?.note || "",
          completed_at: session.completed_at?.toISOString() || null,
        }
      : null,
  };
}
