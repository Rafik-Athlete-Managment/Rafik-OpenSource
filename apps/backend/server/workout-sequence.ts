import { randomUUID } from "node:crypto";
import { ApiError, type Actor } from "./db.ts";
import { event, textValue, uuid, type Tx } from "./institution.ts";
import type { Prisma } from "./generated/prisma/client.ts";

type Input = Record<string, unknown>;
const json = (value: unknown) => value as Prisma.InputJsonValue;

export async function lockedAssignment(
  tx: Tx,
  institution: string,
  assignment: string,
) {
  await tx.$queryRaw`SELECT id FROM public.institution_assignments WHERE institution_id=${institution}::uuid AND id=${assignment}::uuid FOR UPDATE`;
  const item = await tx.institution_assignments.findFirst({
    where: { id: assignment, institution_id: institution },
    include: { institution_versions: true },
  });
  if (!item) throw new ApiError(404, "assignment_unavailable");
  return item;
}

function timedSlot(input: Input) {
  if (
    typeof input.starts_at !== "string" ||
    typeof input.ends_at !== "string" ||
    !/T.*(Z|[+-]\d{2}:\d{2})$/.test(input.starts_at) ||
    !/T.*(Z|[+-]\d{2}:\d{2})$/.test(input.ends_at)
  )
    throw new ApiError(400, "invalid_time");
  const start = new Date(input.starts_at),
    end = new Date(input.ends_at);
  if (
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime()) ||
    end <= start ||
    end.getTime() - start.getTime() > 8 * 3600000
  )
    throw new ApiError(400, "invalid_time");
  const timezone = textValue(input.timezone, 100);
  let local: string;
  try {
    local = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(start);
  } catch {
    throw new ApiError(400, "invalid_timezone");
  }
  return { start, end, timezone, date: new Date(local + "T00:00:00Z") };
}

export async function assertTrainingAllowed(
  tx: Tx,
  institution: string,
  member: string,
  date: Date,
) {
  const restriction = await tx.institution_injury_records.findFirst({
    where: {
      institution_id: institution,
      athlete_member_id: member,
      state: "active",
      participation: "unavailable",
      effective_from: { lte: date },
    },
    select: { id: true },
  });
  if (restriction) throw new ApiError(409, "participation_unavailable");
}

export async function scheduleIndividualWorkout(
  tx: Tx,
  actor: Actor,
  institution: string,
  self: string,
  input: Input,
  dayOnly = false,
  preparedRuleId?: string,
) {
  const assignment = await lockedAssignment(
    tx,
    institution,
    uuid(input.assignment_id),
  );
  if (input.cursor !== assignment.sequence_cursor)
    throw new ApiError(409, "sequence_conflict");
  const slot = dayOnly
    ? {
        start: null,
        end: null,
        timezone: textValue(input.timezone, 100),
        date: new Date(String(input.training_date) + "T00:00:00Z"),
      }
    : timedSlot(input);
  if (
    assignment.state !== "active" ||
    slot.date < assignment.start_date ||
    (assignment.end_date && slot.date > assignment.end_date)
  )
    throw new ApiError(409, "assignment_unavailable");
  await assertTrainingAllowed(tx, institution, assignment.member_id, slot.date);
  if (
    await tx.institution_workout_positions.findFirst({
      where: {
        assignment_id: assignment.id,
        state: { in: ["pending", "paused"] },
      },
    })
  )
    throw new ApiError(409, "previous_workout_unresolved");
  if (
    await tx.institution_sessions.findFirst({
      where: {
        assignment_id: assignment.id,
        completed_at: null,
        occurrence_id: null,
      },
    })
  )
    throw new ApiError(409, "legacy_workout_unresolved");
  const plan = assignment.institution_versions.prescription as any;
  const days = (plan.days || []).filter((day: any) => !day.restDay);
  if (!days.length) throw new ApiError(409, "no_workout_days");
  const cursor = assignment.sequence_cursor;
  if (cursor >= 2147483646) throw new ApiError(409, "sequence_limit_reached");
  const day = days[cursor % days.length];
  // Preserve the shipped assignment/date/day replay identity until its explicit cutover.
  if (
    await tx.institution_sessions.findUnique({
      where: {
        assignment_id_local_date_day_id: {
          assignment_id: assignment.id,
          local_date: slot.date,
          day_id: day.id,
        },
      },
    })
  )
    throw new ApiError(409, "workout_already_recorded_for_date");
  const athlete = await tx.institution_members.findUniqueOrThrow({
    where: { id: assignment.member_id },
  });
  const staff = [
    ...new Set([self, athlete.trainer_id].filter(Boolean)),
  ] as string[];
  const people = await tx.institution_members.findMany({
    where: {
      id: { in: [...staff, athlete.id] },
      institution_id: institution,
      active: true,
      OR: [{ id: athlete.id }, { roles: { has: "trainer" } }],
    },
    select: { id: true, user_id: true },
  });
  if (!people.some((x) => x.id === athlete.id))
    throw new ApiError(403, "trainee_unavailable");
  if (slot.start && slot.end)
    await tx.$queryRaw`SELECT public.validate_calendar_collision(${people.map((x) => x.user_id)}::uuid[],${slot.start},${slot.end},NULL::uuid)::text`;
  const occurrence = await tx.institution_events.create({
    data: {
      institution_id: institution,
      created_by: self,
      series_id: randomUUID(),
      title: assignment.institution_versions.title.slice(0, 100),
      starts_at: slot.start,
      ends_at: slot.end,
      timing_mode: dayOnly ? "day" : "timed",
      training_date: slot.date,
      timezone: slot.timezone,
      kind: "training",
      location:
        typeof input.location === "string" ? input.location.slice(0, 200) : "",
      workout_snapshot: json({
        version_id: assignment.version_id,
        assignment_id: assignment.id,
        ...(preparedRuleId
          ? {
              preparation: {
                rule_id: preparedRuleId,
                mode: dayOnly ? "automatic" : "weekly",
              },
            }
          : {}),
        day,
        position: cursor,
        cycle: Math.floor(cursor / days.length),
      }),
    },
  });
  await tx.institution_event_people.createMany({
    data: people.map((person) => ({
      institution_id: institution,
      event_id: occurrence.id,
      member_id: person.id,
      duty: person.id === athlete.id ? "trainee" : "staff",
    })),
  });
  const position = await tx.institution_workout_positions.create({
    data: {
      institution_id: institution,
      assignment_id: assignment.id,
      position: cursor,
      cycle: Math.floor(cursor / days.length),
      day_id: day.id,
      occurrence_id: occurrence.id,
    },
  });
  await event(tx, actor, institution, "workout_scheduled", athlete.id, {
    assignment: assignment.id,
    occurrence: occurrence.id,
    position: cursor,
    ...(preparedRuleId
      ? {
          preparation_rule: preparedRuleId,
          preparation_mode: dayOnly ? "automatic" : "weekly",
        }
      : {}),
  });
  return { occurrence, position };
}

export async function skipIndividualWorkout(
  tx: Tx,
  actor: Actor,
  institution: string,
  self: string,
  input: Input,
) {
  const assignment = await lockedAssignment(
    tx,
    institution,
    uuid(input.assignment_id),
  );
  const position = await tx.institution_workout_positions.findFirst({
    where: {
      assignment_id: assignment.id,
      occurrence_id: uuid(input.occurrence_id),
    },
  });
  if (
    !position ||
    !["pending", "paused"].includes(position.state) ||
    position.position !== assignment.sequence_cursor
  )
    throw new ApiError(409, "sequence_conflict");
  const occurrence = await tx.institution_events.findUniqueOrThrow({
    where: { id: position.occurrence_id },
  });
  if (occurrence.revision !== input.revision)
    throw new ApiError(409, "conflict");
  const reason = textValue(input.reason, 2000);
  await tx.institution_workout_positions.update({
    where: { id: position.id },
    data: {
      state: "skipped",
      resolved_at: new Date(),
      resolved_by: self,
      reason,
    },
  });
  await tx.institution_assignments.update({
    where: { id: assignment.id },
    data: { sequence_cursor: { increment: 1 } },
  });
  await tx.institution_events.update({
    where: { id: occurrence.id },
    data: { state: "completed", revision: { increment: 1 } },
  });
  await event(tx, actor, institution, "workout_skipped", assignment.member_id, {
    assignment: assignment.id,
    occurrence: occurrence.id,
    reason,
  });
  return {
    occurrence_id: occurrence.id,
    state: "skipped",
    cursor: assignment.sequence_cursor + 1,
  };
}

export async function rescheduleIndividualWorkout(
  tx: Tx,
  actor: Actor,
  institution: string,
  input: Input,
) {
  const assignment = await lockedAssignment(
    tx,
    institution,
    uuid(input.assignment_id),
  );
  const position = await tx.institution_workout_positions.findFirst({
    where: {
      assignment_id: assignment.id,
      occurrence_id: uuid(input.occurrence_id),
      state: "pending",
    },
  });
  if (!position || position.session_id || assignment.state !== "active")
    throw new ApiError(409, "workout_not_actionable");
  const occurrence = await tx.institution_events.findUniqueOrThrow({
    where: { id: position.occurrence_id },
    include: {
      institution_event_people: { include: { institution_members: true } },
    },
  });
  if (occurrence.revision !== input.revision)
    throw new ApiError(409, "conflict");
  const slot = timedSlot(input);
  if (
    slot.date < assignment.start_date ||
    (assignment.end_date && slot.date > assignment.end_date)
  )
    throw new ApiError(409, "assignment_unavailable");
  await assertTrainingAllowed(tx, institution, assignment.member_id, slot.date);
  if (
    await tx.institution_sessions.findUnique({
      where: {
        assignment_id_local_date_day_id: {
          assignment_id: assignment.id,
          local_date: slot.date,
          day_id: position.day_id,
        },
      },
    })
  )
    throw new ApiError(409, "workout_already_recorded_for_date");
  const users = occurrence.institution_event_people
    .map((p) => p.institution_members.user_id)
    .filter(Boolean);
  await tx.$queryRaw`SELECT public.validate_calendar_collision(${users}::uuid[],${slot.start},${slot.end},${occurrence.id}::uuid)::text`;
  const result = await tx.institution_events.update({
    where: { id: occurrence.id },
    data: {
      starts_at: slot.start,
      ends_at: slot.end,
      timing_mode: "timed",
      timezone: slot.timezone,
      revision: { increment: 1 },
    },
  });
  await event(
    tx,
    actor,
    institution,
    "workout_rescheduled",
    assignment.member_id,
    {
      assignment: assignment.id,
      occurrence: occurrence.id,
      previous_start: occurrence.starts_at?.toISOString() || null,
      starts_at: slot.start.toISOString(),
    },
  );
  return { occurrence: result, position };
}

/** Exact old commands remain valid for unlinked history; new bound records cannot bypass their position. */
export async function workoutStartContext(
  tx: Tx,
  institution: string,
  assignmentId: string,
  occurrenceId: unknown,
) {
  const assignment = await lockedAssignment(tx, institution, assignmentId);
  if (!occurrenceId) {
    if (
      await tx.institution_workout_positions.findFirst({
        where: { assignment_id: assignmentId },
      })
    )
      throw new ApiError(409, "workout_occurrence_required");
    return null;
  }
  const position = await tx.institution_workout_positions.findFirst({
    where: { assignment_id: assignmentId, occurrence_id: uuid(occurrenceId) },
  });
  if (
    !position ||
    position.state !== "pending" ||
    position.position !== assignment.sequence_cursor
  )
    throw new ApiError(409, "workout_not_actionable");
  const occurrence = await tx.institution_events.findUniqueOrThrow({
    where: { id: position.occurrence_id },
  });
  if (occurrence.state !== "scheduled")
    throw new ApiError(409, "workout_not_actionable");
  if (
    occurrence.starts_at
      ? occurrence.starts_at > new Date()
      : occurrence.training_date.toISOString().slice(0, 10) >
        new Intl.DateTimeFormat("en-CA", {
          timeZone: occurrence.timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date())
  )
    throw new ApiError(409, "workout_not_started_yet");
  await assertTrainingAllowed(
    tx,
    institution,
    assignment.member_id,
    new Date(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: occurrence.timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()) + "T00:00:00Z",
    ),
  );
  return { position, occurrence };
}

export async function assertLinkedWorkoutWritable(
  tx: Tx,
  institution: string,
  session: string,
) {
  const position = await tx.institution_workout_positions.findFirst({
    where: { institution_id: institution, session_id: session },
  });
  if (position && !["pending", "completed"].includes(position.state))
    throw new ApiError(409, "workout_not_actionable");
}

export async function resolveCompletedWorkout(
  tx: Tx,
  actor: Actor,
  institution: string,
  self: string,
  session: string,
) {
  const result = await tx.institution_sessions.findUniqueOrThrow({
    where: { id: session },
  });
  if (!result.occurrence_id || !result.completed_at) return;
  const assignment = await lockedAssignment(
    tx,
    institution,
    result.assignment_id,
  );
  const position = await tx.institution_workout_positions.findFirst({
    where: { institution_id: institution, session_id: session },
  });
  if (!position || position.state === "completed") return; // Later corrections never rewind or advance twice.
  if (
    position.state !== "pending" ||
    position.position !== assignment.sequence_cursor
  )
    throw new ApiError(409, "sequence_conflict");
  await tx.institution_workout_positions.update({
    where: { id: position.id },
    data: { state: "completed", resolved_at: new Date(), resolved_by: self },
  });
  await tx.institution_assignments.update({
    where: { id: assignment.id },
    data: { sequence_cursor: { increment: 1 } },
  });
  await tx.institution_events.update({
    where: { id: position.occurrence_id },
    data: { state: "completed", revision: { increment: 1 } },
  });
  await event(tx, actor, institution, "workout_resolved", result.member_id, {
    assignment: assignment.id,
    occurrence: position.occurrence_id,
    session,
  });
}

export async function stopAssignmentWork(
  tx: Tx,
  actor: Actor,
  institution: string,
  assignmentId: string,
) {
  const assignment = await lockedAssignment(tx, institution, assignmentId);
  const positions = await tx.institution_workout_positions.findMany({
    where: {
      institution_id: institution,
      assignment_id: assignmentId,
      state: "pending",
    },
  });
  for (const position of positions) {
    const paused = !!position.session_id;
    await tx.institution_workout_positions.update({
      where: { id: position.id },
      data: { state: paused ? "paused" : "cancelled" },
    });
    if (!paused)
      await tx.institution_events.update({
        where: { id: position.occurrence_id },
        data: { state: "cancelled", revision: { increment: 1 } },
      });
    await event(
      tx,
      actor,
      institution,
      paused ? "workout_paused" : "workout_cancelled",
      assignment.member_id,
      { assignment: assignmentId, occurrence: position.occurrence_id },
    );
  }
  await tx.institution_workout_recurrences.updateMany({
    where: {
      institution_id: institution,
      assignment_id: assignmentId,
      state: "active",
    },
    data: { state: "cancelled", revision: { increment: 1 } },
  });
}
