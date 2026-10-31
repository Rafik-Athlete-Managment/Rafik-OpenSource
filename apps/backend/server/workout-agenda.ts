import type { Exercise, Prescription } from "@rafik/shared/workouts";
import type { WorkoutAgenda, WorkoutAgendaItem } from "@rafik/shared/contracts";
import { ApiError, asActor, type Actor } from "./db.ts";
import { scoped, uuid } from "./institution.ts";
import {
  role,
  supportingLinks,
  assignmentScope,
  localDay,
  workoutState,
} from "./programming.ts";
import { effectivePlan } from "./plan-prescription.ts";
import { pageSize } from "./pagination.ts";
import { pageOffset } from "./service-definitions.ts";
import { fieldWorkoutPackage } from "./field-workout.ts";
import type { FrozenWorkout, WorkoutDocument } from "./workout-document.ts";
import type { Prisma } from "./generated/prisma/client.ts";

// Read-only planning projection. All role, queue, count and pagination scopes stay server-owned.
export async function workoutAgenda(
  actor: Actor,
  institution: string,
  query: URLSearchParams,
  now = new Date(),
): Promise<WorkoutAgenda> {
  const view = role(query.get("view"));
  const fieldPackages = query.get("fieldPackages") === "true";
  if (fieldPackages && view !== "trainer") throw new ApiError(403, "forbidden");
  const profile = await asActor(actor, (tx) =>
    tx.profiles.findUnique({
      where: { id: actor.id },
      select: { timezone: true },
    }),
  );
  return scoped(actor, institution, [view], async (tx, self) => {
    const search = (query.get("search") || "").trim().slice(0, 100);
    const today = new Date(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: profile?.timezone || "UTC",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(now) + "T00:00:00Z",
    );
    const dueDays = await tx.$queryRaw<
      { id: string }[]
    >`SELECT e.id FROM public.institution_events e JOIN public.institution_workout_positions p ON p.occurrence_id=e.id WHERE e.institution_id=${institution}::uuid AND e.timing_mode='day' AND p.state IN('pending','paused') AND e.training_date<=(${now}::timestamptz AT TIME ZONE e.timezone)::date`;
    const dueEvent: Prisma.institution_eventsWhereInput = {
      OR: [
        { timing_mode: "timed", training_date: { lte: today } },
        { timing_mode: "day", id: { in: dueDays.map((e) => e.id) } },
      ],
    };
    const queue = query.get("queue");
    if (
      queue &&
      !["recording", "today", "planning", "actionable"].includes(queue)
    )
      throw new ApiError(400, "invalid_request");
    const unfinished: Prisma.institution_assignmentsWhereInput = {
      institution_sessions: { some: { completed_at: null } },
    };
    const queueScope: Prisma.institution_assignmentsWhereInput =
      queue === "actionable"
        ? {
            OR: [
              unfinished,
              {
                institution_workout_positions: {
                  some: {
                    state: { in: ["pending", "paused"] },
                    institution_events: dueEvent,
                  },
                },
              },
            ],
          }
        : queue === "recording"
          ? unfinished
          : queue === "planning"
            ? {
                institution_workout_positions: {
                  none: { state: { in: ["pending", "paused"] } },
                },
                NOT: unfinished,
              }
            : queue === "today"
              ? {
                  institution_workout_positions: {
                    some: {
                      state: { in: ["pending", "paused"] },
                      institution_events: dueEvent,
                    },
                  },
                  NOT: unfinished,
                }
              : {};
    const assignment = query.get("assignment");
    const scope: Prisma.institution_assignmentsWhereInput = {
      institution_id: institution,
      ...(assignment ? { id: uuid(assignment) } : {}),
      OR: [
        { state: "active" },
        { institution_workout_positions: { some: { state: "paused" } } },
      ],
      ...(view === "trainee"
        ? { member_id: self.id }
        : view === "trainer"
          ? assignmentScope(
              self.id,
              await supportingLinks(tx, institution, self.id),
            )
          : {}),
      institution_members_institution_assignments_institution_id_member_idToinstitution_members:
        {
          active: true,
          ...(search
            ? { name: { contains: search, mode: "insensitive" } }
            : {}),
        },
      ...(query.get("due") === "true" || queue
        ? {
            AND: [
              queueScope,
              {
                OR: [
                  { institution_sessions: { some: { completed_at: null } } },
                  {
                    institution_workout_positions: {
                      none: { state: { in: ["pending", "paused"] } },
                    },
                  },
                  {
                    institution_workout_positions: {
                      some: {
                        state: { in: ["pending", "paused"] },
                        institution_events: dueEvent,
                      },
                    },
                  },
                ],
              },
              ...(view === "trainer"
                ? [
                    assignmentScope(
                      self.id,
                      await supportingLinks(tx, institution, self.id),
                    ),
                  ]
                : []),
            ],
          }
        : {}),
    };
    const offset = pageOffset(query.get("offset")),
      limit = pageSize(query, 10);
    const rows = await tx.institution_assignments.findMany({
      where: scope,
      skip: offset,
      take: limit,
      orderBy: [{ created_at: "asc" }, { id: "asc" }],
      include: {
        institution_versions: { select: { title: true, prescription: true } },
        institution_members_institution_assignments_institution_id_member_idToinstitution_members:
          { select: { name: true } },
        institution_workout_positions: {
          where: { state: { in: ["pending", "paused"] } },
          take: 1,
          include: { institution_events: true, institution_sessions: true },
        },
        institution_sessions: {
          where: { completed_at: null, occurrence_id: null },
          orderBy: [{ started_at: "asc" }, { id: "asc" }],
          take: 1,
        },
      },
    });
    const restrictions = await tx.institution_injury_records.findMany({
      where: {
        institution_id: institution,
        athlete_member_id: { in: rows.map((a) => a.member_id) },
        state: "active",
        participation: "unavailable",
      },
      select: { athlete_member_id: true, effective_from: true },
    });
    return {
      queue: (queue as WorkoutAgenda["queue"]) || null,
      total: await tx.institution_assignments.count({ where: scope }),
      offset,
      limit,
      items: rows.map((a): WorkoutAgendaItem => {
        const position = a.institution_workout_positions[0],
          occurrence = position?.institution_events;
        const session =
          position?.institution_sessions || a.institution_sessions[0];
        const effective = effectivePlan(a);
        const days = (
          (effective.prescription as unknown as Prescription).days || []
        ).filter((d) => !d.restDay);
        const day =
          (occurrence?.workout_snapshot as unknown as FrozenWorkout | undefined)
            ?.day ||
          (session?.document as unknown as WorkoutDocument | undefined)
            ?.prescription ||
          days.find((d) => d.id === (position?.day_id || session?.day_id)) ||
          days[a.sequence_cursor % days.length];
        const occurrenceToday = occurrence
          ? localDay(occurrence.timezone, now)
          : today;
        const blocked = restrictions.some(
          (r) =>
            r.athlete_member_id === a.member_id &&
            r.effective_from <= occurrenceToday,
        )
          ? "participation_unavailable"
          : a.state !== "active" ||
              a.start_date > occurrenceToday ||
              (a.end_date && a.end_date < occurrenceToday)
            ? "assignment_unavailable"
            : !day
              ? "no_workout_days"
              : null;
        const state = workoutState(
          position?.state,
          occurrence,
          !!session,
          now,
          occurrenceToday,
        );
        const canRecord =
          view === "trainer" &&
          state !== "paused" &&
          !!session &&
          (session.recorded_mode === "delegated" || !session.completed_at);
        const canPrepareStart =
          !blocked &&
          !!occurrence &&
          occurrence.state === "scheduled" &&
          position?.state === "pending" &&
          !session &&
          view !== "admin";
        const exercises = day?.exercises || [];
        const muscleCounts = new Map<string, number>();
        for (const exercise of exercises) {
          const info: Partial<Exercise> = exercise.info || {};
          const muscles =
            Array.isArray(info.muscles) && info.muscles.length
              ? info.muscles
              : info.target_muscle
                ? [info.target_muscle]
                : [];
          for (const muscle of new Set<string>(
            muscles
              .filter((m: unknown) => typeof m === "string" && m.trim())
              .map((m: string) => m.trim().toLowerCase()),
          ))
            muscleCounts.set(muscle, (muscleCounts.get(muscle) || 0) + 1);
        }
        return {
          ...(fieldPackages
            ? {
                field_workout: fieldWorkoutPackage(
                  institution,
                  a,
                  day,
                  occurrence,
                  session,
                  canPrepareStart,
                  canRecord,
                ),
              }
            : {}),
          assignment_id: a.id,
          member_id: a.member_id,
          member_name:
            a
              .institution_members_institution_assignments_institution_id_member_idToinstitution_members
              .name,
          title:
            occurrence?.title ||
            (session?.document as unknown as WorkoutDocument | undefined)
              ?.title ||
            effective.title,
          goal: a.goal,
          cursor: a.sequence_cursor,
          preview: {
            minutes:
              typeof day?.minutes === "number" && day.minutes > 0
                ? day.minutes
                : null,
            exercise_count: exercises.length,
            prescribed_sets: exercises.reduce(
              (n, e) =>
                n + (Number.isInteger(e.sets) && e.sets > 0 ? e.sets : 0),
              0,
            ),
            exercises: exercises.slice(0, 5).map((e) => ({
              name: e.info?.name || e.exerciseId,
              name_ar: e.info?.name_ar || undefined,
              sets: e.sets,
              kind: e.kind || e.info?.kind || "strength",
            })),
            muscle_focus: [...muscleCounts]
              .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
              .slice(0, 4)
              .map(([name]) => name),
            cover:
              (effective.prescription as unknown as Prescription).presentation
                ?.cover || undefined,
          },
          day: day ? { id: day.id, name: day.name, nameAr: day.nameAr } : null,
          state,
          blocked,
          occurrence: occurrence
            ? {
                id: occurrence.id,
                revision: occurrence.revision,
                starts_at: occurrence.starts_at?.toISOString() || null,
                ends_at: occurrence.ends_at?.toISOString() || null,
                timezone: occurrence.timezone,
                training_date: occurrence.training_date
                  .toISOString()
                  .slice(0, 10),
              }
            : null,
          session: session
            ? {
                id: session.id,
                recorded_mode: session.recorded_mode,
                can_record: canRecord,
              }
            : null,
          can_start:
            canPrepareStart &&
            (occurrence.starts_at
              ? occurrence.starts_at <= now
              : occurrence.training_date <= occurrenceToday),
          can_schedule:
            view !== "trainee" &&
            a.state === "active" &&
            !!day &&
            !(a.end_date && a.end_date < occurrenceToday) &&
            blocked !== "participation_unavailable" &&
            !position &&
            !session,
        };
      }),
    };
  });
}
