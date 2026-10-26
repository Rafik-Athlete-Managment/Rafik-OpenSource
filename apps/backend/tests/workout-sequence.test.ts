import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { db } from "../server/db.ts";
import type { Prisma } from "../server/generated/prisma/client.ts";
import { apiOrigin } from "./test-target.ts";
const institution = "12000000-0000-4000-8000-000000000001";
const coach = "13000000-0000-4000-8000-000000000002",
  athlete = "13000000-0000-4000-8000-000000000003";
const assignment = "16000000-0000-4000-8000-000000000001";
const base = apiOrigin + "/v1/institution";
const operation = (action: string, fields: object = {}) => ({
  operation: randomUUID(),
  action,
  view: "trainer",
  ...fields,
});
async function cookie(user: string) {
  const token = randomBytes(32).toString("hex");
  await db.identity_sessions.create({
    data: {
      user_id: user,
      token_hash: createHash("sha256").update(token).digest("hex"),
      expires_at: new Date(Date.now() + 3600000),
    },
  });
  return "rafik_session=" + token;
}
async function call(auth: string, path: string, input: object) {
  const response = await fetch(base + path, {
    method: "POST",
    headers: {
      Cookie: auth,
      "x-rafik-client": "web",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return { status: response.status, data: await response.json() };
}
const slot = (days: number) => {
  const start = new Date(Date.now() + days * 86400000);
  return {
    starts_at: start.toISOString(),
    ends_at: new Date(start.getTime() + 1800000).toISOString(),
    timezone: "UTC",
  };
};
async function agenda(auth: string, view = "trainer", query = "") {
  const response = await fetch(
    base + `/workout-scheduling?view=${view}${query}`,
    { headers: { Cookie: auth, "x-rafik-client": "web" } },
  );
  const data = await response.json();
  assert.equal(response.status, 200, JSON.stringify(data));
  return data;
}
after(async () => {
  await db.$disconnect();
});

test("individual sequence: concurrent binding, independent plans, exact resolution, correction, repeat, restrictions and end policy", async () => {
  const auth = await cookie("11000000-0000-4000-8000-000000000002");
  const athleteAuth = await cookie("11000000-0000-4000-8000-000000000003");
  const startDate = new Date(Date.now() - 14 * 86400000);
  await db.institution_assignments.update({
    where: { id: assignment },
    data: { start_date: startDate },
  });
  const version = await db.institution_versions.findUniqueOrThrow({
    where: { id: "15000000-0000-4000-8000-000000000001" },
  });
  const otherVersion = await db.institution_versions.create({
    data: {
      ...version,
      prescription: version.prescription as Prisma.InputJsonValue,
      id: randomUUID(),
      revision: 2,
    },
  });
  const other = await db.institution_assignments.create({
    data: {
      id: randomUUID(),
      institution_id: institution,
      member_id: athlete,
      version_id: otherVersion.id,
      created_by: coach,
      start_date: startDate,
      schedule_mode: "flexible",
    },
  });
  const dashboardUnscheduled = await agenda(auth, "trainer", "&due=true");
  assert.ok(
    dashboardUnscheduled.items.some(
      (x: any) => x.assignment_id === assignment && x.state === "unscheduled",
    ),
    "dashboard includes work awaiting scheduling",
  );
  const firstInput = operation("schedule-workout", {
    assignment_id: assignment,
    cursor: 0,
    ...slot(-3),
  });
  const [first, competing] = await Promise.all([
    call(auth, "/workout-scheduling", firstInput),
    call(auth, "/workout-scheduling", {
      ...firstInput,
      operation: randomUUID(),
    }),
  ]);
  assert.deepEqual(
    [first.status, competing.status].sort(),
    [200, 409],
    JSON.stringify({ first, competing }),
  );
  const firstResult = first.status === 200 ? first : competing;
  const winningInput =
    first.status === 200
      ? firstInput
      : await db.institution_operations
          .findFirstOrThrow({
            where: {
              result: {
                path: ["occurrence", "id"],
                equals: firstResult.data.occurrence.id,
              },
            },
          })
          .then((x) => x.payload);
  assert.deepEqual(
    (await call(auth, "/workout-scheduling", winningInput as object)).data,
    firstResult.data,
  );
  const a = firstResult.data;
  const due = await agenda(auth, "trainer", "&due=true&limit=1");
  assert.equal(due.total, 2);
  assert.equal(due.items[0].assignment_id, assignment);
  assert.equal(due.items[0].state, "overdue");
  assert.equal(due.items[0].can_start, true);
  const own = await agenda(athleteAuth, "trainee", `&assignment=${assignment}`);
  assert.equal(own.items[0].occurrence.id, a.occurrence.id);
  assert.equal(own.items[0].can_schedule, false);
  assert.ok(own.items[0].preview.exercise_count > 0);
  assert.ok(own.items[0].preview.prescribed_sets > 0);
  assert.ok(own.items[0].preview.exercises.length <= 5);
  assert.ok(own.items[0].preview.muscle_focus.length <= 4);
  assert.equal(
    (await agenda(auth, "trainer", "&search=does-not-exist")).total,
    0,
  );
  assert.equal(a.position.position, 0);
  assert.equal(
    (
      await db.institution_assignments.findUniqueOrThrow({
        where: { id: assignment },
      })
    ).sequence_cursor,
    0,
    "scheduling does not consume progress",
  );
  const independent = await call(
    auth,
    "/workout-scheduling",
    operation("schedule-workout", {
      assignment_id: other.id,
      cursor: 0,
      ...slot(1),
    }),
  );
  assert.equal(independent.status, 200, JSON.stringify(independent));
  const secondPage = await agenda(auth, "trainer", "&limit=1&offset=1");
  assert.equal(secondPage.total, 2);
  assert.equal(secondPage.items[0].assignment_id, other.id);
  const future = await agenda(
    athleteAuth,
    "trainee",
    `&assignment=${other.id}`,
  );
  assert.equal(future.items[0].state, "scheduled");
  assert.equal(future.items[0].can_start, false);
  const early = await call(
    auth,
    "/sessions",
    operation("start", {
      id: randomUUID(),
      assignment_id: other.id,
      day_id: independent.data.position.day_id,
      occurrence_id: independent.data.occurrence.id,
    }),
  );
  assert.equal(early.status, 409);
  assert.equal(early.data.message, "workout_not_started_yet");
  const calendarBypass = await call(
    auth,
    "/calendar",
    operation("finish", { id: a.occurrence.id, revision: 1 }),
  );
  assert.equal(calendarBypass.status, 409);
  assert.equal(calendarBypass.data.message, "use_workout_scheduling");

  assert.equal(
    (
      await call(
        athleteAuth,
        "/workout-scheduling",
        operation("skip-workout", {
          view: "trainee",
          assignment_id: assignment,
          occurrence_id: a.occurrence.id,
          revision: 1,
          reason: "No",
        }),
      )
    ).status,
    403,
  );
  const initial = await call(
    auth,
    "/sessions",
    operation("start", {
      id: randomUUID(),
      assignment_id: assignment,
      day_id: a.position.day_id,
    }),
  );
  assert.equal(
    initial.status,
    409,
    "old arbitrary-day start cannot bypass bound work",
  );
  const begin = operation("start", {
    id: randomUUID(),
    assignment_id: assignment,
    day_id: a.position.day_id,
    occurrence_id: a.occurrence.id,
  });
  const started = await call(auth, "/sessions", begin);
  assert.equal(started.status, 200, JSON.stringify(started));
  const save = operation("save", {
    id: started.data.id,
    revision: 1,
    entries: started.data.entries.map((entry: any) => ({
      ...entry,
      completed: true,
    })),
    note: "Actual training",
    complete: true,
  });
  const saved = await call(auth, "/sessions", save);
  assert.equal(saved.status, 200, JSON.stringify(saved));
  assert.deepEqual((await call(auth, "/sessions", save)).data, saved.data);
  assert.equal(
    (
      await db.institution_assignments.findUniqueOrThrow({
        where: { id: assignment },
      })
    ).sequence_cursor,
    1,
  );
  const correction = await call(auth, "/sessions", {
    ...save,
    operation: randomUUID(),
    revision: 2,
    note: "Corrected actuals",
  });
  assert.equal(correction.status, 200, JSON.stringify(correction));
  assert.equal(
    (
      await db.institution_assignments.findUniqueOrThrow({
        where: { id: assignment },
      })
    ).sequence_cursor,
    1,
    "corrections never advance twice",
  );
  const next = await call(
    auth,
    "/workout-scheduling",
    operation("schedule-workout", {
      assignment_id: assignment,
      cursor: 1,
      ...slot(-2),
    }),
  );
  assert.equal(next.status, 200, JSON.stringify(next));
  assert.equal(
    (await agenda(auth, "trainer", `&assignment=${assignment}`)).items[0]
      .cursor,
    1,
  );
  assert.notEqual(next.data.position.day_id, a.position.day_id);
  assert.equal(
    (
      await call(
        auth,
        "/workout-scheduling",
        operation("skip-workout", {
          assignment_id: assignment,
          occurrence_id: next.data.occurrence.id,
          revision: 1,
          reason: " ",
        }),
      )
    ).status,
    400,
  );
  const skip = operation("skip-workout", {
    assignment_id: assignment,
    occurrence_id: next.data.occurrence.id,
    revision: 1,
    reason: "Coach agreed recovery day",
  });
  const skipped = await call(auth, "/workout-scheduling", skip);
  assert.equal(skipped.status, 200, JSON.stringify(skipped));
  assert.deepEqual(
    (await call(auth, "/workout-scheduling", skip)).data,
    skipped.data,
  );
  assert.equal(skipped.data.cursor, 2);
  const repeated = await call(
    auth,
    "/workout-scheduling",
    operation("schedule-workout", {
      assignment_id: assignment,
      cursor: 2,
      ...slot(-1),
    }),
  );
  assert.equal(repeated.status, 200, JSON.stringify(repeated));
  assert.equal(repeated.data.position.day_id, a.position.day_id);
  assert.equal(repeated.data.position.cycle, 1);
  const reschedule = await call(
    auth,
    "/workout-scheduling",
    operation("reschedule-workout", {
      assignment_id: assignment,
      occurrence_id: repeated.data.occurrence.id,
      revision: 1,
      ...slot(-1.1),
    }),
  );
  assert.equal(reschedule.status, 200, JSON.stringify(reschedule));
  assert.equal(reschedule.data.position.id, repeated.data.position.id);
  assert.equal(
    (
      await db.institution_assignments.findUniqueOrThrow({
        where: { id: assignment },
      })
    ).sequence_cursor,
    2,
  );
  const pausedStart = await call(
    auth,
    "/sessions",
    operation("start", {
      id: randomUUID(),
      assignment_id: assignment,
      day_id: repeated.data.position.day_id,
      occurrence_id: repeated.data.occurrence.id,
    }),
  );
  assert.equal(pausedStart.status, 200, JSON.stringify(pausedStart));
  const ended = await call(
    auth,
    "/delivery",
    operation("end", { assignment, revision: 1 }),
  );
  assert.equal(ended.status, 200, JSON.stringify(ended));
  assert.equal(
    (
      await db.institution_workout_positions.findUniqueOrThrow({
        where: { id: repeated.data.position.id },
      })
    ).state,
    "paused",
  );
  assert.ok(
    await db.institution_sessions.findUnique({
      where: { id: pausedStart.data.id },
    }),
    "in-progress data survives ending",
  );
  const endOther = await call(
    auth,
    "/delivery",
    operation("end", { assignment: other.id, revision: 1 }),
  );
  assert.equal(endOther.status, 200, JSON.stringify(endOther));
  assert.equal(
    (
      await db.institution_events.findUniqueOrThrow({
        where: { id: independent.data.occurrence.id },
      })
    ).state,
    "cancelled",
  );
  // A current cannot-train flag blocks scheduling with a general explanation only.
  const restrictedAssignment = await db.institution_assignments.create({
    data: {
      id: randomUUID(),
      institution_id: institution,
      member_id: athlete,
      version_id: otherVersion.id,
      created_by: coach,
      start_date: startDate,
      schedule_mode: "flexible",
    },
  });
  const oldDue = await call(
    await cookie("11000000-0000-4000-8000-000000000001"),
    "/workout-scheduling",
    operation("schedule-workout", {
      view: "admin",
      assignment_id: restrictedAssignment.id,
      cursor: 0,
      ...slot(-0.2),
    }),
  );
  assert.equal(oldDue.status, 200, JSON.stringify(oldDue));
  const staff = await db.institution_event_people.findMany({
    where: { event_id: oldDue.data.occurrence.id, duty: "staff" },
  });
  assert.deepEqual(
    staff.map((p) => p.member_id),
    [coach],
    "administrator scheduling must not enroll the administrator as a coach",
  );
  const restriction = await db.institution_injury_records.create({
    data: {
      id: randomUUID(),
      institution_id: institution,
      athlete_member_id: athlete,
      participation: "unavailable",
      effective_from: new Date(
        new Date().toISOString().slice(0, 10) + "T00:00:00Z",
      ),
    },
  });
  const blocked = await call(
    auth,
    "/workout-scheduling",
    operation("schedule-workout", {
      assignment_id: restrictedAssignment.id,
      cursor: 0,
      ...slot(1),
    }),
  );
  assert.equal(blocked.status, 409);
  assert.equal(blocked.data.message, "participation_unavailable");
  assert.ok(!JSON.stringify(blocked).includes(restriction.id));
  const restricted = await agenda(
    athleteAuth,
    "trainee",
    `&assignment=${restrictedAssignment.id}`,
  );
  assert.equal(restricted.items[0].blocked, "participation_unavailable");
  assert.equal(restricted.items[0].can_start, false);
  assert.ok(!JSON.stringify(restricted).includes(restriction.id));
  const restrictedStart = await call(
    auth,
    "/sessions",
    operation("start", {
      id: randomUUID(),
      assignment_id: restrictedAssignment.id,
      day_id: oldDue.data.position.day_id,
      occurrence_id: oldDue.data.occurrence.id,
    }),
  );
  assert.equal(restrictedStart.status, 409);
  assert.equal(
    restrictedStart.data.message,
    "participation_unavailable",
    "an overdue date must not bypass today's restriction",
  );
  await db.institution_members.update({
    where: { id: coach },
    data: { active: false },
  });
  assert.equal(
    (await call(auth, "/workout-scheduling", winningInput as object)).status,
    403,
    "revocation is checked before receipt replay",
  );
});
