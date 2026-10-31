import type { FieldWorkoutPackage } from "@rafik/shared/contracts";

const entry = (e: any) => ({
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
  assignment: any,
  day: any,
  occurrence: any,
  session: any,
  canStart: boolean,
  canRecord: boolean,
): FieldWorkoutPackage | null {
  if (!day || !occurrence) return null;
  const document = session?.document;
  const targets = day.exercises.flatMap((e: any) =>
    Array.from({ length: e.sets }, (_, index) => {
      const t = e.targets?.[index] || e;
      return {
        exercise_key: e.key,
        set_index: index,
        reps: t.reps,
        load: t.load,
        unit: e.unit,
        seconds: t.seconds ?? null,
        metres: t.metres ?? null,
        effort: t.effort ?? null,
        completed: false,
      };
    }),
  );
  return {
    id: occurrence?.id || session.id,
    institution_id: institution,
    assignment_id: assignment.id,
    member_id: assignment.member_id,
    member_name:
      assignment
        .institution_members_institution_assignments_institution_id_member_idToinstitution_members
        .name,
    occurrence_id: occurrence?.id || null,
    title:
      occurrence?.title ||
      document?.title ||
      assignment.institution_versions.title,
    day_id: day.id,
    day_name: day.name,
    day_name_ar: day.nameAr || "",
    starts_at: occurrence?.starts_at?.toISOString() || null,
    training_date: (occurrence?.training_date || session.local_date)
      .toISOString()
      .slice(0, 10),
    timezone: occurrence?.timezone || "UTC",
    allow_provisional_start: canStart,
    can_record: canRecord,
    exercises: day.exercises.map((e: any) => ({
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
