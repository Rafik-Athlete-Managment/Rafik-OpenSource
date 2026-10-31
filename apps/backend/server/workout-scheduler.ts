import type { Prescription } from "@rafik/shared/workouts";
import { db, ApiError, type Actor } from "./db.ts";
import {
  access,
  mutation,
  scoped,
  event,
  uuid,
  type Tx,
} from "./institution.ts";
import { planAuthority, role } from "./programming.ts";
import { calendarDate } from "./service-definitions.ts";
import {
  lockedAssignment,
  scheduleIndividualWorkout,
} from "./workout-sequence.ts";

const dateText = (d: Date) => d.toISOString().slice(0, 10);
const plusDays = (s: string, n: number) =>
  dateText(new Date(Date.parse(s + "T12:00:00Z") + n * 86400000));
export function localDay(zone: string, now: Date) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    throw new ApiError(400, "invalid_timezone");
  }
}
/** Resolve a wall clock only when it identifies one instant. Never guess across DST. */
export function weeklyInstant(day: string, time: string, zone: string) {
  calendarDate(day);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    throw new ApiError(400, "invalid_time");
  localDay(zone, new Date());
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = (at: number) => {
    const p = Object.fromEntries(
      formatter.formatToParts(new Date(at)).map((p) => [p.type, p.value]),
    );
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
  };
  const wall = `${day}T${time}:00`,
    anchor = Date.parse(wall + "Z"),
    offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 6) {
    const instant = anchor + hours * 3600000;
    offsets.add(Date.parse(parts(instant) + "Z") - instant);
  }
  const matches = [...offsets]
    .map((offset) => anchor - offset)
    .filter((at) => parts(at) === wall);
  if (matches.length !== 1)
    throw new ApiError(
      409,
      matches.length ? "ambiguous_local_time" : "nonexistent_local_time",
    );
  return new Date(matches[0]);
}

async function authority(
  tx: Tx,
  actor: Actor,
  institution: string,
  view: "admin" | "trainer",
  assignment: string,
) {
  const self = await access(tx, actor, institution, [view]);
  const plan = await lockedAssignment(tx, institution, assignment);
  await planAuthority(tx, institution, self, view, plan.member_id, [
    plan.sport_id,
  ]);
  return { self, plan };
}
export async function workoutRules(
  actor: Actor,
  institution: string,
  query: URLSearchParams,
) {
  const view = role(query.get("view"));
  if (view === "trainee") throw new ApiError(403, "forbidden");
  const assignment = uuid(query.get("assignment"));
  return scoped(actor, institution, [view], async (tx) => {
    await authority(tx, actor, institution, view, assignment);
    return {
      scheduler_enabled: process.env.RAFIK_DISABLE_WORKOUT_SCHEDULER !== "true",
      items: await tx.institution_workout_recurrences.findMany({
        where: { institution_id: institution, assignment_id: assignment },
        orderBy: [{ state: "asc" }, { starts_on: "desc" }, { id: "asc" }],
        take: 25,
      }),
    };
  });
}
export async function workoutRuleCommand(
  actor: Actor,
  institution: string,
  input: Record<string, unknown>,
) {
  const view = role(input.view),
    assignment = uuid(input.assignment_id);
  if (view === "trainee") throw new ApiError(403, "forbidden");
  if (!["set-workout-rule", "stop-workout-rule"].includes(String(input.action)))
    throw new ApiError(400, "invalid_action");
  const result = await mutation(
    actor,
    institution,
    [view],
    input,
    async (tx, self) => {
      const plan = await lockedAssignment(tx, institution, assignment);
      const current = await tx.institution_workout_recurrences.findFirst({
        where: { assignment_id: assignment, state: "active" },
      });
      if (
        (current?.revision || null) !== (input.revision ?? null) ||
        (current?.id || null) !== (input.rule_id ?? null)
      )
        throw new ApiError(409, "conflict");
      if (input.action === "stop-workout-rule") {
        if (current)
          await tx.institution_workout_recurrences.update({
            where: { id: current.id },
            data: { state: "cancelled", revision: { increment: 1 } },
          });
        await event(
          tx,
          actor,
          institution,
          "workout_rule_stopped",
          plan.member_id,
          { assignment },
        );
        return { stopped: true };
      }
      if (plan.state !== "active")
        throw new ApiError(409, "assignment_unavailable");
      const starts = calendarDate(input.starts_on),
        ends = calendarDate(input.ends_on),
        zone = String(input.timezone || "");
      localDay(zone, new Date());
      if (
        ends < starts ||
        Date.parse(ends) - Date.parse(starts) > 366 * 86400000 ||
        starts < dateText(plan.start_date) ||
        (plan.end_date && ends > dateText(plan.end_date))
      )
        throw new ApiError(400, "invalid_date");
      const automatic = input.mode === "automatic";
      if (!automatic && input.mode !== "weekly")
        throw new ApiError(400, "invalid_request");
      const weekdays = automatic ? [1, 2, 3, 4, 5, 6, 7] : input.weekdays;
      if (
        !Array.isArray(weekdays) ||
        !weekdays.length ||
        weekdays.length > 7 ||
        weekdays.some((x) => !Number.isInteger(x) || x < 1 || x > 7) ||
        new Set(weekdays).size !== weekdays.length
      )
        throw new ApiError(400, "invalid_request");
      let time: Date | null = null,
        duration: number | null = null;
      if (!automatic) {
        const wall = String(input.local_time || "");
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(wall))
          throw new ApiError(400, "invalid_time");
        time = new Date("1970-01-01T" + wall + ":00Z");
        duration = Number(input.duration_minutes);
        if (!Number.isInteger(duration) || duration < 1 || duration > 480)
          throw new ApiError(400, "invalid_time");
      }
      if (current)
        await tx.institution_workout_recurrences.update({
          where: { id: current.id },
          data: { state: "cancelled", revision: { increment: 1 } },
        });
      const rule = await tx.institution_workout_recurrences.create({
        data: {
          institution_id: institution,
          assignment_id: assignment,
          created_by: self.id,
          starts_on: new Date(starts + "T00:00:00Z"),
          ends_on: new Date(ends + "T00:00:00Z"),
          timezone: zone,
          weekdays,
          local_time: time,
          duration_minutes: duration,
          // Editing future policy must not allocate a second workout on a day already materialized.
          last_generated_on: current?.last_generated_on || null,
        },
      });
      await event(
        tx,
        actor,
        institution,
        "workout_rule_saved",
        plan.member_id,
        { assignment, rule: rule.id, mode: automatic ? "automatic" : "weekly" },
      );
      return { rule };
    },
    async (tx) => {
      await authority(tx, actor, institution, view, assignment);
    },
  );
  if (
    process.env.RAFIK_DISABLE_WORKOUT_SCHEDULER !== "true" &&
    input.action === "set-workout-rule"
  ) {
    const id = (result as { rule?: { id: string } }).rule?.id;
    if (id)
      void prepareWorkoutRule(id).catch(() =>
        console.error(
          "Initial workout preparation failed; scheduled poll will retry",
        ),
      );
  }
  return result;
}

/** One bounded transaction per rule. Same institution -> assignment lock order as user writes. */
export async function prepareWorkoutRule(id: string, now = new Date()) {
  return db.$transaction(
    async (tx) => {
      const found = await tx.institution_workout_recurrences.findUnique({
        where: { id },
      });
      if (!found || found.state !== "active") return "inactive";
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${found.institution_id},73))::text`;
      const rule = await tx.institution_workout_recurrences.findUniqueOrThrow({
        where: { id },
      });
      if (rule.state !== "active") return "inactive";
      const plan = await lockedAssignment(
        tx,
        rule.institution_id,
        rule.assignment_id,
      );
      const stamp = async (issue: string | null, generated?: string) => {
        await tx.institution_workout_recurrences.update({
          where: { id },
          data: {
            last_checked_at: now,
            issue,
            ...(generated
              ? { last_generated_on: new Date(generated + "T00:00:00Z") }
              : {}),
          },
        });
        return issue || "prepared";
      };
      const creator = await tx.institution_members.findUnique({
        where: { id: rule.created_by },
      });
      if (!creator?.user_id || !creator.active)
        return stamp("scheduling_authority_unavailable");
      const view = creator.roles.includes("admin")
        ? "admin"
        : creator.roles.includes("trainer")
          ? "trainer"
          : null;
      if (!view) return stamp("scheduling_authority_unavailable");
      const actor: Actor = {
        id: creator.user_id,
        email: null,
        user_metadata: {},
      };
      try {
        await authority(tx, actor, rule.institution_id, view, plan.id);
      } catch (e) {
        if (e instanceof ApiError)
          return stamp("scheduling_authority_unavailable");
        throw e;
      }
      const today = localDay(rule.timezone, now);
      if (
        plan.state !== "active" ||
        (plan.end_date && dateText(plan.end_date) < today) ||
        dateText(rule.ends_on) < today
      )
        return stamp("scheduling_window_ended");
      if (
        (await tx.institution_workout_positions.findFirst({
          where: {
            assignment_id: plan.id,
            state: { in: ["pending", "paused"] },
          },
        })) ||
        (await tx.institution_sessions.findFirst({
          where: { assignment_id: plan.id, completed_at: null },
        }))
      )
        return stamp("previous_workout_unresolved");
      const automatic = !rule.local_time;
      let day = [
        today,
        dateText(rule.starts_on),
        dateText(plan.start_date),
        ...(rule.last_generated_on
          ? [plusDays(dateText(rule.last_generated_on), 1)]
          : []),
      ]
        .sort()
        .at(-1)!;
      if (automatic && day !== today) return stamp("waiting_for_day");
      while (
        day <= dateText(rule.ends_on) &&
        !rule.weekdays.includes(new Date(day + "T12:00:00Z").getUTCDay() || 7)
      )
        day = plusDays(day, 1);
      if (
        day > dateText(rule.ends_on) ||
        (plan.end_date && day > dateText(plan.end_date))
      )
        return stamp("scheduling_window_ended");
      if (
        automatic &&
        ((await tx.institution_workout_positions.findFirst({
          where: {
            assignment_id: plan.id,
            institution_events: { training_date: new Date(day + "T00:00:00Z") },
          },
        })) ||
          (await tx.institution_sessions.findFirst({
            where: {
              assignment_id: plan.id,
              local_date: new Date(day + "T00:00:00Z"),
            },
          })))
      )
        return stamp("waiting_for_day");
      if (automatic) {
        const prescription = plan.institution_versions
          .prescription as unknown as Prescription;
        const index =
          Math.floor((Date.parse(day) - plan.start_date.getTime()) / 86400000) %
          (7 * (prescription.cycleWeeks || 1));
        const calendarDay = (prescription.days || []).find(
          (d) => ((d.week || 1) - 1) * 7 + (d.weekday as number) === index,
        );
        if (!calendarDay || calendarDay.restDay) return stamp("rest_day");
      }
      // Expected validation failures roll back the attempted event/position, not the diagnostic.
      await tx.$executeRawUnsafe("SAVEPOINT workout_preparation");
      try {
        const starts = automatic
          ? null
          : weeklyInstant(
              day,
              rule.local_time!.toISOString().slice(11, 16),
              rule.timezone,
            );
        await scheduleIndividualWorkout(
          tx,
          actor,
          rule.institution_id,
          creator.id,
          {
            assignment_id: plan.id,
            cursor: plan.sequence_cursor,
            timezone: rule.timezone,
            training_date: day,
            ...(starts
              ? {
                  starts_at: starts.toISOString(),
                  ends_at: new Date(
                    starts.getTime() + rule.duration_minutes! * 60000,
                  ).toISOString(),
                }
              : {}),
          },
          automatic,
          rule.id,
        );
        await tx.$executeRawUnsafe("RELEASE SAVEPOINT workout_preparation");
        return stamp(null, day);
      } catch (e) {
        await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT workout_preparation");
        if (e instanceof ApiError) return stamp(e.message);
        const meta = (
          e as {
            meta?: {
              code?: string;
              message?: string;
              driverAdapterError?: {
                cause?: { originalCode?: string; originalMessage?: string };
              };
            };
          }
        ).meta;
        if (
          (meta?.code || meta?.driverAdapterError?.cause?.originalCode) ===
            "P0001" &&
          (
            meta?.message ||
            meta?.driverAdapterError?.cause?.originalMessage ||
            ""
          ).includes("time_unavailable")
        )
          return stamp("time_unavailable");
        throw e;
      }
    },
    { timeout: 15000 },
  );
}
export async function prepareWorkouts(now = new Date(), limit = 50) {
  const rules = await db.institution_workout_recurrences.findMany({
    where: { state: "active" },
    orderBy: [
      { last_checked_at: { sort: "asc", nulls: "first" } },
      { id: "asc" },
    ],
    take: Math.min(100, Math.max(1, limit)),
    select: { id: true },
  });
  for (const rule of rules) {
    try {
      await prepareWorkoutRule(rule.id, now);
    } catch {
      console.error("Workout rule preparation failed; other rules continue");
      await db.institution_workout_recurrences
        .update({
          where: { id: rule.id },
          data: { last_checked_at: now, issue: "preparation_failed" },
        })
        .catch(() => {});
    }
  }
  return { checked: rules.length };
}
export function startWorkoutScheduler() {
  let stopped = false,
    timer: ReturnType<typeof setTimeout> | undefined;
  const run = async () => {
    try {
      await prepareWorkouts();
    } catch {
      console.error("Workout preparation failed; retrying on the next poll");
    } finally {
      if (!stopped) {
        timer = setTimeout(() => void run(), 60000);
        timer.unref();
      }
    }
  };
  void run();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
