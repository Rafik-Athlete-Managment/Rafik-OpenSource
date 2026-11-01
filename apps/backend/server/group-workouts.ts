import { prescribedEntries, type FrozenWorkout } from "./workout-document.ts";
import type { PlanDay } from "@rafik/shared/workouts";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { ApiError, type Actor } from "./db.ts";
import {
  scoped,
  mutation,
  event,
  uuid,
  textValue,
  type Tx,
  type Role,
  type access,
} from "./institution.ts";
import { eventAccess } from "./calendar.ts";
import { role } from "./programming.ts";
import { localDay } from "./local-date.ts";
import { assertTrainingAllowed } from "./workout-sequence.ts";
import { workoutSnapshot } from "./workout-templates.ts";
import { groupFieldWorkoutPackage } from "./field-workout.ts";
import type { Prisma } from "./generated/prisma/client.ts";
type Self = Awaited<ReturnType<typeof access>>;
type Input = Record<string, unknown>;
const json = (value: unknown) => value as Prisma.InputJsonValue;

/** Checks whether the caller may view this participant's result for a group workout. */
export async function groupSessionAuthority(
  tx: Tx,
  institution: string,
  self: Self,
  view: Role,
  session: { occurrence_id: string | null; member_id: string },
) {
  if (!session.occurrence_id) throw new ApiError(403, "session_missing");
  const occurrence = await eventAccess(
    tx,
    institution,
    self,
    view,
    session.occurrence_id,
  );
  if (
    (occurrence.workout_snapshot as unknown as FrozenWorkout)?.source !==
      "group" ||
    (view === "trainee" && self.id !== session.member_id)
  )
    throw new ApiError(403, "forbidden");
  const person = occurrence.institution_event_people.find(
    (p) => p.member_id === session.member_id && p.duty === "trainee",
  );
  if (!person) throw new ApiError(403, "trainee_unavailable");
  return { occurrence, person };
}
/** Stops group-workout changes when the caller, event or participant is not writable. */
export async function assertGroupWritable(
  tx: Tx,
  institution: string,
  self: Self,
  view: Role,
  session: { occurrence_id: string | null; member_id: string },
) {
  if (view !== "trainer") throw new ApiError(403, "forbidden");
  const context = await groupSessionAuthority(
    tx,
    institution,
    self,
    view,
    session,
  );
  if (
    context.occurrence.state === "cancelled" ||
    context.person.attendance !== "present" ||
    context.person.workout_skip_reason ||
    !context.person.institution_members.active ||
    !context.person.institution_members.roles.includes("trainee")
  )
    throw new ApiError(409, "group_workout_not_actionable");
  return context;
}
/** Loads the group workout and participant records visible for one event. */
export async function groupWorkouts(
  actor: Actor,
  institution: string,
  query: URLSearchParams,
) {
  const view = role(query.get("view")),
    eid = uuid(query.get("event"));
  const fieldPackages = query.get("fieldPackages") === "true";
  if (fieldPackages && view !== "trainer") throw new ApiError(403, "forbidden");
  return scoped(actor, institution, [view], async (tx, self) => {
    const occurrence = await eventAccess(tx, institution, self, view, eid),
      source = occurrence.workout_snapshot as unknown as FrozenWorkout;
    if (source?.source !== "group") return { workout: null, participants: [] };
    const people = occurrence.institution_event_people.filter(
      (p) =>
        p.duty === "trainee" && (view !== "trainee" || p.member_id === self.id),
    );
    const sessions = await tx.institution_sessions.findMany({
      where: {
        institution_id: institution,
        occurrence_id: eid,
        member_id: { in: people.map((p) => p.member_id) },
        source_kind: "additional",
      },
      select: {
        id: true,
        member_id: true,
        completed_at: true,
        version: true,
        document: true,
        local_date: true,
      },
    });
    const now = new Date(),
      today = localDay(occurrence.timezone, now);
    const started = !!occurrence.starts_at && occurrence.starts_at <= now;
    const restrictions = await tx.institution_injury_records.findMany({
      where: {
        institution_id: institution,
        athlete_member_id: { in: people.map((p) => p.member_id) },
        state: "active",
        participation: "unavailable",
        effective_from: {
          lte:
            occurrence.training_date > today ? occurrence.training_date : today,
        },
      },
      select: { athlete_member_id: true },
    });
    return {
      workout: source,
      participants: people.map((person) => {
        const session = sessions.find((s) => s.member_id === person.member_id);
        const blocked = restrictions.some(
          (r) => r.athlete_member_id === person.member_id,
        );
        const unavailable =
          !person.institution_members.active ||
          !person.institution_members.roles.includes("trainee");
        const blockedReason =
          occurrence.state === "cancelled"
            ? "cancelled"
            : !started
              ? "not_started"
              : unavailable
                ? "inactive"
                : blocked
                  ? "participation_unavailable"
                  : person.attendance !== "present"
                    ? "attendance_required"
                    : null;
        const canStart =
          view === "trainer" &&
          !blockedReason &&
          !person.workout_skip_reason &&
          !session;
        const canDownloadStart =
          view === "trainer" &&
          occurrence.state === "scheduled" &&
          !unavailable &&
          !blocked &&
          person.attendance === "present" &&
          !person.workout_skip_reason &&
          !session;
        return {
          member_id: person.member_id,
          name: person.institution_members.name,
          revision: person.revision,
          attendance: person.attendance,
          skip_reason: person.workout_skip_reason,
          session: session
            ? {
                id: session.id,
                member_id: session.member_id,
                completed_at: session.completed_at,
                version: session.version,
              }
            : null,
          can_start: canStart,
          can_skip:
            view === "trainer" &&
            occurrence.state !== "cancelled" &&
            started &&
            !person.workout_skip_reason &&
            !session?.completed_at &&
            (person.attendance === "present" || !!session),
          blocked: blockedReason,
          ...(fieldPackages
            ? {
                field_workout: groupFieldWorkoutPackage(
                  institution,
                  occurrence,
                  {
                    member_id: person.member_id,
                    name: person.institution_members.name,
                    revision: person.revision,
                  },
                  source.day,
                  session || null,
                  !!canDownloadStart,
                  !!session &&
                    !session.completed_at &&
                    !blockedReason &&
                    !person.workout_skip_reason,
                ),
              }
            : {}),
        };
      }),
    };
  });
}
/** Starts, records, finishes or reviews a coach-led group workout. */
export async function groupWorkoutCommand(
  actor: Actor,
  institution: string,
  input: Input,
) {
  const view = role(input.view),
    eid = uuid(input.event),
    member = uuid(input.member_id),
    action = String(input.action);
  if (view !== "trainer" || !["start", "skip"].includes(action))
    throw new ApiError(403, "forbidden");
  const authorize = async (tx: Tx, self: Self) => {
    await groupSessionAuthority(tx, institution, self, view, {
      occurrence_id: eid,
      member_id: member,
    });
  };
  return mutation(
    actor,
    institution,
    [view],
    input,
    async (tx, self) => {
      const { occurrence, person } = await groupSessionAuthority(
        tx,
        institution,
        self,
        view,
        { occurrence_id: eid, member_id: member },
      );
      if (
        occurrence.state === "cancelled" ||
        !occurrence.starts_at ||
        occurrence.starts_at > new Date()
      )
        throw new ApiError(409, "group_workout_not_actionable");
      if (person.revision !== input.revision)
        throw new ApiError(409, "conflict");
      const existing = await tx.institution_sessions.findFirst({
        where: {
          institution_id: institution,
          occurrence_id: eid,
          member_id: member,
        },
      });
      if (action === "skip") {
        if (existing?.completed_at)
          throw new ApiError(409, "session_already_completed");
        const reason = textValue(input.reason, 2000);
        await tx.institution_event_people.update({
          where: { event_id_member_id: { event_id: eid, member_id: member } },
          data: { workout_skip_reason: reason, revision: { increment: 1 } },
        });
        await event(tx, actor, institution, "group_workout_skipped", eid, {
          member,
          reason,
          session: existing?.id || null,
        });
        return { skipped: true };
      }
      await assertGroupWritable(tx, institution, self, view, {
        occurrence_id: eid,
        member_id: member,
      });
      await assertTrainingAllowed(
        tx,
        institution,
        member,
        occurrence.training_date,
      );
      await assertTrainingAllowed(
        tx,
        institution,
        member,
        localDay(occurrence.timezone, new Date()),
      );
      if (existing) throw new ApiError(409, "group_workout_already_started");
      const source = occurrence.workout_snapshot as unknown as FrozenWorkout;
      // An unchanged frozen baseline remains usable after a catalog edit/archive.
      // Actual participant adaptations are validated against today's shared catalog.
      const day =
        input.workout && !isDeepStrictEqual(input.workout, source.day)
          ? ((await workoutSnapshot(
              tx,
              institution,
              self,
              input.workout,
            )) as unknown as PlanDay)
          : source.day;
      const sessionId = uuid(input.id);
      if (
        await tx.institution_sessions.findUnique({ where: { id: sessionId } })
      )
        throw new ApiError(409, "operation_reused");
      const document = {
        id: sessionId,
        institution_id: institution,
        member_id: member,
        client_id: person.institution_members.user_id,
        coach_id: null,
        assignment_id: null,
        version_id: null,
        source_kind: "additional",
        occurrence_id: eid,
        day_id: day.id,
        local_date: occurrence.training_date.toISOString().slice(0, 10),
        title: occurrence.title,
        prescription: day,
        recorded_mode: "delegated",
        recorded_by: self.id,
        recorded_by_name: self.name,
        status: "in_progress",
        entries: prescribedEntries(day.exercises),
        note: "",
        coach_note: "",
        reviewed_at: null,
        started_at: new Date().toISOString(),
        completed_at: null,
        version: 1,
      };
      await tx.institution_sessions.create({
        data: {
          id: sessionId,
          institution_id: institution,
          member_id: member,
          assignment_id: null,
          day_id: day.id,
          local_date: occurrence.training_date,
          document: json(document),
          recorded_mode: "delegated",
          recorded_by: self.id,
          occurrence_id: eid,
          source_kind: "additional",
          source_snapshot: json({
            provenance: "group",
            baseline: source,
            prescription: day,
          }),
        },
      });
      await tx.institution_session_history.create({
        data: {
          id: randomUUID(),
          institution_id: institution,
          session_id: sessionId,
          version: 1,
          actor_member_id: self.id,
          action: "start",
          entries: json(document.entries),
          note: "",
          completed: false,
        },
      });
      await event(tx, actor, institution, "group_workout_started", eid, {
        member,
        session: sessionId,
      });
      return document;
    },
    authorize,
  );
}
