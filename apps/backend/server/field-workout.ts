import type { PlanDay } from "@rafik/shared/workouts";
import { prescribedEntries } from "./workout-document.ts";
import { createHash } from "node:crypto";
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
      occurrence.title ||
      document?.title ||
      assignment.institution_versions.title,
    day_id: day.id,
    day_name: day.name,
    day_name_ar: day.nameAr || "",
    starts_at: occurrence.starts_at?.toISOString() || null,
    training_date: occurrence.training_date.toISOString().slice(0, 10),
    timezone: occurrence.timezone || "UTC",
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

/** Projects a frozen group prescription into the same native sheet as individual work. */
export function groupFieldWorkoutPackage(
  institution: string,
  occurrence: Occurrence,
  person: { member_id: string; name: string; revision: number },
  day: PlanDay,
  session: Session | null,
  canStart: boolean,
  canRecord: boolean,
): FieldWorkoutPackage {
  // The event/member pair needs a stable local key before any server session exists.
  const hash = createHash("sha256")
    .update(`${occurrence.id}:${person.member_id}`)
    .digest("hex");
  const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
  const document = session?.document as
    | { entries?: FieldWorkoutEntry[]; note?: string; prescription?: PlanDay }
    | undefined;
  const actualDay = document?.prescription || day;
  const targets = prescribedEntries(actualDay.exercises);
  return {
    id,
    institution_id: institution,
    assignment_id: null,
    group: { event_id: occurrence.id, roster_revision: person.revision },
    member_id: person.member_id,
    member_name: person.name,
    occurrence_id: occurrence.id,
    title: occurrence.title,
    day_id: actualDay.id,
    day_name: actualDay.name,
    day_name_ar: actualDay.nameAr || "",
    starts_at: occurrence.starts_at?.toISOString() || null,
    training_date: occurrence.training_date.toISOString().slice(0, 10),
    timezone: occurrence.timezone || "UTC",
    allow_provisional_start: canStart,
    can_record: canRecord,
    exercises: actualDay.exercises.map((e) => ({
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
