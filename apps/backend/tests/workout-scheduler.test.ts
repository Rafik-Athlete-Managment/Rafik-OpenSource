import { accountProfile } from "../server/account.ts";
import { workoutAgenda } from "../server/workout-agenda.ts";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { db } from "../server/db.ts";
import {
  prepareWorkoutRule,
  weeklyInstant,
} from "../server/workout-scheduler.ts";
import { apiOrigin } from "./test-target.ts";
const institution = "12000000-0000-4000-8000-000000000001",
  assignment = "16000000-0000-4000-8000-000000000001";
const coach = "13000000-0000-4000-8000-000000000002";
after(() => db.$disconnect());
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
async function command(auth: string, input: object) {
  const response = await fetch(apiOrigin + "/v1/institution/workout-rules", {
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
test("DST wall-clock resolution never guesses gaps or repeated hours", () => {
  assert.equal(
    weeklyInstant("2030-01-07", "09:00", "Asia/Dubai").toISOString(),
    "2030-01-07T05:00:00.000Z",
  );
  assert.throws(
    () => weeklyInstant("2026-03-08", "02:30", "America/New_York"),
    /nonexistent_local_time/,
  );
  assert.throws(
    () => weeklyInstant("2026-11-01", "01:30", "America/New_York"),
    /ambiguous_local_time/,
  );
});
test("program automatic default is versioned and assignment can opt out", async () => {
  const auth = await cookie("11000000-0000-4000-8000-000000000002");
  const call = async (path: string, body: object) => {
    const response = await fetch(apiOrigin + "/v1/institution/" + path, {
      method: "POST",
      headers: {
        Cookie: auth,
        "x-rafik-client": "web",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return { status: response.status, data: await response.json() };
  };
  const source = await db.institution_assignments.findUniqueOrThrow({
    where: { id: assignment },
    include: { institution_versions: true },
  });
  const member = await db.institution_members.findUniqueOrThrow({
    where: { id: source.member_id },
  });
  const program = randomUUID(),
    draft = {
      ...(source.institution_versions.prescription as object),
      automaticPreparation: true,
    };
  const publish = (draft: object, revision: number | null) =>
    call("programs", {
      operation: randomUUID(),
      action: "publish",
      view: "trainer",
      id: program,
      title: "Preparation default",
      draft,
      revision,
    });
  const published = await publish(draft, null);
  assert.equal(published.status, 200, JSON.stringify(published));
  assert.equal(published.data.version.prescription.automaticPreparation, true);
  const input = {
    operation: randomUUID(),
    action: "assign",
    view: "trainer",
    version_id: published.data.version.id,
    start_date: "2030-01-01",
    end_date: "2030-02-01",
    timezone: "Asia/Dubai",
    schedule_mode: "cycle",
    members: [{ id: member.id, revision: member.revision, replaces: null }],
  };
  assert.equal(
    (
      await call("delivery", {
        ...input,
        operation: randomUUID(),
        end_date: null,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("delivery", {
        ...input,
        operation: randomUUID(),
        timezone: "bad/zone",
      })
    ).status,
    400,
  );
  const delivered = await call("delivery", input);
  assert.equal(delivered.status, 200, JSON.stringify(delivered));
  assert.deepEqual((await call("delivery", input)).data, delivered.data);
  const plan = delivered.data[0];
  assert.equal(
    await db.institution_workout_recurrences.count({
      where: { assignment_id: plan.id },
    }),
    1,
  );
  const edited = await publish(
    { ...draft, automaticPreparation: false },
    published.data.plan.draft_version,
  );
  assert.equal(edited.status, 200, JSON.stringify(edited));
  assert.equal(
    (
      (
        await db.institution_versions.findUniqueOrThrow({
          where: { id: published.data.version.id },
        })
      ).prescription as any
    ).automaticPreparation,
    true,
  );
  assert.equal(
    await db.institution_workout_recurrences.count({
      where: { assignment_id: plan.id, state: "active" },
    }),
    1,
  );
  const opted = await publish(draft, edited.data.plan.draft_version);
  assert.equal(opted.status, 200, JSON.stringify(opted));
  const manual = await call("delivery", {
    ...input,
    operation: randomUUID(),
    version_id: opted.data.version.id,
    automatic_preparation: false,
    end_date: null,
    timezone: "",
  });
  assert.equal(manual.status, 200, JSON.stringify(manual));
  assert.equal(
    await db.institution_workout_recurrences.count({
      where: { assignment_id: manual.data[0].id },
    }),
    0,
  );
});
test("weekly and opt-in automatic preparation preserve one unresolved position, local dates, authority and receipts", async () => {
  const auth = await cookie("11000000-0000-4000-8000-000000000002"),
    athleteAuth = await cookie("11000000-0000-4000-8000-000000000003");
  const before = await db.institution_sessions.findMany();
  const base = await db.institution_assignments.update({
    where: { id: assignment },
    data: {
      start_date: new Date("2030-01-01T00:00:00Z"),
      end_date: null,
      state: "active",
    },
  });
  const payload = {
    operation: randomUUID(),
    action: "set-workout-rule",
    view: "trainer",
    assignment_id: assignment,
    rule_id: null,
    revision: null,
    mode: "weekly",
    starts_on: "2030-01-01",
    ends_on: "2030-02-01",
    weekdays: [1, 3, 5],
    local_time: "09:00",
    duration_minutes: 45,
    timezone: "Asia/Dubai",
  };
  assert.equal(
    (await command(athleteAuth, { ...payload, view: "trainee" })).status,
    403,
  );
  const made = await command(auth, payload);
  assert.equal(made.status, 200, JSON.stringify(made));
  assert.deepEqual((await command(auth, payload)).data, made.data);
  const rule = made.data.rule;
  const outcomes = await Promise.all([
    prepareWorkoutRule(rule.id, new Date("2030-01-07T00:00:00Z")),
    prepareWorkoutRule(rule.id, new Date("2030-01-07T00:00:00Z")),
  ]);
  assert.ok(outcomes.includes("prepared"), JSON.stringify(outcomes));
  const positions = await db.institution_workout_positions.findMany({
    where: { assignment_id: assignment },
    include: { institution_events: true },
  });
  assert.equal(positions.length, 1);
  assert.equal(
    positions[0].institution_events.starts_at!.toISOString(),
    "2030-01-07T05:00:00.000Z",
  );
  assert.equal(
    (
      await db.institution_assignments.findUniqueOrThrow({
        where: { id: assignment },
      })
    ).sequence_cursor,
    0,
  );
  // Editing/stopping the future rule preserves the already materialized appointment.
  const stopped = await command(auth, {
    operation: randomUUID(),
    action: "stop-workout-rule",
    view: "trainer",
    assignment_id: assignment,
    rule_id: rule.id,
    revision: rule.revision,
  });
  assert.equal(stopped.status, 200);
  assert.equal(
    await prepareWorkoutRule(rule.id, new Date("2030-01-08T00:00:00Z")),
    "inactive",
  );
  assert.equal(
    (
      await db.institution_events.findUniqueOrThrow({
        where: { id: positions[0].occurrence_id },
      })
    ).state,
    "scheduled",
  );
  // A separate plan remains independent; automatic policy is explicitly enabled.
  const sourceVersion = await db.institution_versions.findUniqueOrThrow({
    where: { id: base.version_id },
  });
  const otherVersion = await db.institution_versions.create({
    data: {
      ...sourceVersion,
      id: randomUUID(),
      revision: 2,
      prescription: sourceVersion.prescription as any,
    },
  });
  const other = await db.institution_assignments.create({
    data: {
      ...base,
      adaptation: base.adaptation ?? undefined,
      id: randomUUID(),
      version_id: otherVersion.id,
      sequence_cursor: 0,
    },
  });
  const version = await db.institution_versions.findUniqueOrThrow({
    where: { id: base.version_id },
  });
  const prescription = version.prescription as any;
  const trainDay = (prescription.days || []).find((d: any) => !d.restDay);
  assert.ok(trainDay);
  const offset = ((trainDay.week || 1) - 1) * 7 + trainDay.weekday;
  const autoDay = new Date(
    Date.parse("2030-01-01T00:00:00Z") + offset * 86400000,
  )
    .toISOString()
    .slice(0, 10);
  const auto = await command(auth, {
    ...payload,
    operation: randomUUID(),
    assignment_id: other.id,
    mode: "automatic",
    starts_on: "2030-01-01",
  });
  assert.equal(auto.status, 200, JSON.stringify(auto));
  const autoRule = auto.data.rule;
  assert.equal(
    await prepareWorkoutRule(autoRule.id, new Date(autoDay + "T08:00:00Z")),
    "prepared",
  );
  const automatic = await db.institution_workout_positions.findFirstOrThrow({
    where: { assignment_id: other.id },
    include: { institution_events: true },
  });
  assert.equal(automatic.institution_events.timing_mode, "day");
  assert.equal(
    (automatic.institution_events.workout_snapshot as any).preparation.rule_id,
    autoRule.id,
  );
  assert.equal(automatic.institution_events.starts_at, null);
  assert.equal(automatic.institution_events.ends_at, null);
  assert.equal(
    automatic.institution_events.training_date.toISOString().slice(0, 10),
    autoDay,
  );
  assert.equal(
    await prepareWorkoutRule(autoRule.id, new Date(autoDay + "T09:00:00Z")),
    "previous_workout_unresolved",
  );
  const athleteUser = "11000000-0000-4000-8000-000000000003";
  const actor = { id: athleteUser, email: null, user_metadata: {} };
  await accountProfile(
    actor,
    {
      p_name: "Boundary athlete",
      p_locale: "en",
      p_units: "kg",
      p_timezone: "Pacific/Honolulu",
    },
    true,
  );
  const clock = new Date(autoDay + "T01:00:00Z");
  const args = new URLSearchParams("view=trainee&assignment=" + other.id);
  assert.equal(
    (await workoutAgenda(actor, institution, args, clock)).items[0].can_start,
    true,
    "day-only start follows occurrence timezone, not the viewer previous date",
  );
  const boundaryRestriction = await db.institution_injury_records.create({
    data: {
      id: randomUUID(),
      institution_id: institution,
      athlete_member_id: base.member_id,
      participation: "unavailable",
      effective_from: new Date(autoDay + "T00:00:00Z"),
    },
  });
  const blockedAtBoundary = (
    await workoutAgenda(actor, institution, args, clock)
  ).items[0];
  assert.equal(blockedAtBoundary.blocked, "participation_unavailable");
  assert.equal(blockedAtBoundary.can_start, false);
  await db.institution_injury_records.delete({
    where: { id: boundaryRestriction.id },
  });
  await accountProfile(
    actor,
    {
      p_name: "Boundary athlete",
      p_locale: "en",
      p_units: "kg",
      p_timezone: "UTC",
    },
    true,
  );
  const skip = await fetch(apiOrigin + "/v1/institution/workout-scheduling", {
    method: "POST",
    headers: {
      Cookie: auth,
      "x-rafik-client": "web",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      operation: randomUUID(),
      action: "skip-workout",
      view: "trainer",
      assignment_id: other.id,
      occurrence_id: automatic.occurrence_id,
      revision: automatic.institution_events.revision,
      reason: "Explicit worker sequence test",
    }),
  });
  assert.equal(skip.status, 200, await skip.text());
  assert.equal(
    await prepareWorkoutRule(autoRule.id, new Date(autoDay + "T10:00:00Z")),
    "waiting_for_day",
  );
  assert.equal(
    await db.institution_workout_positions.count({
      where: { assignment_id: other.id },
    }),
    1,
  );
  const legacy = await fetch(
    apiOrigin +
      `/v1/institution/calendar?view=trainer&from=${autoDay}&to=${autoDay}`,
    { headers: { Cookie: auth, "x-rafik-client": "web" } },
  );
  assert.equal(legacy.status, 200);
  assert.ok(
    !(await legacy.json()).items.some(
      (e: any) => e.id === automatic.occurrence_id,
    ),
  );
  const web = await fetch(
    apiOrigin +
      `/v1/institution/calendar?includeDayOnly=true&view=trainer&from=${autoDay}&to=${autoDay}`,
    { headers: { Cookie: auth } },
  );
  assert.equal(web.status, 200);
  assert.ok(
    (await web.json()).items.some((e: any) => e.id === automatic.occurrence_id),
  );
  const restPrescription = structuredClone(sourceVersion.prescription) as any;
  const resting = restPrescription.days.find((d: any) => !d.restDay);
  resting.restDay = true;
  resting.exercises = [];
  const thirdVersion = await db.institution_versions.create({
    data: {
      ...sourceVersion,
      id: randomUUID(),
      revision: 3,
      prescription: restPrescription,
    },
  });
  const third = await db.institution_assignments.create({
    data: {
      ...base,
      adaptation: base.adaptation ?? undefined,
      id: randomUUID(),
      version_id: thirdVersion.id,
    },
  });
  const thirdRule = await command(auth, {
    ...payload,
    operation: randomUUID(),
    assignment_id: third.id,
    mode: "automatic",
  });
  assert.equal(thirdRule.status, 200, JSON.stringify(thirdRule));
  assert.equal(
    await prepareWorkoutRule(
      thirdRule.data.rule.id,
      new Date(autoDay + "T08:00:00Z"),
    ),
    "rest_day",
  );
  const nextTraining = restPrescription.days.find((d: any) => !d.restDay);
  assert.ok(nextTraining);
  const nextDay = new Date(
    Date.parse("2030-01-01T00:00:00Z") +
      (((nextTraining.week || 1) - 1) * 7 + nextTraining.weekday) * 86400000,
  )
    .toISOString()
    .slice(0, 10);
  const collisionVersion = await db.institution_versions.create({
    data: {
      ...sourceVersion,
      id: randomUUID(),
      revision: 4,
      prescription: sourceVersion.prescription as any,
    },
  });
  const collisionPlan = await db.institution_assignments.create({
    data: {
      ...base,
      adaptation: base.adaptation ?? undefined,
      id: randomUUID(),
      version_id: collisionVersion.id,
    },
  });
  const collisionRule = await command(auth, {
    ...payload,
    operation: randomUUID(),
    assignment_id: collisionPlan.id,
    starts_on: "2030-01-07",
  });
  assert.equal(collisionRule.status, 200, JSON.stringify(collisionRule));
  assert.equal(
    await prepareWorkoutRule(
      collisionRule.data.rule.id,
      new Date("2030-01-07T00:00:00Z"),
    ),
    "time_unavailable",
  );
  assert.equal(
    await db.institution_workout_positions.count({
      where: { assignment_id: collisionPlan.id },
    }),
    0,
  );
  const recovered = await command(auth, {
    ...payload,
    operation: randomUUID(),
    assignment_id: collisionPlan.id,
    rule_id: collisionRule.data.rule.id,
    revision: collisionRule.data.rule.revision,
    starts_on: "2030-01-07",
    local_time: "11:00",
  });
  assert.equal(recovered.status, 200, JSON.stringify(recovered));
  assert.equal(
    await prepareWorkoutRule(
      recovered.data.rule.id,
      new Date("2030-01-07T00:00:00Z"),
    ),
    "prepared",
  );
  await db.institution_injury_records.create({
    data: {
      id: randomUUID(),
      institution_id: institution,
      athlete_member_id: base.member_id,
      participation: "unavailable",
      effective_from: new Date("2030-01-01T00:00:00Z"),
    },
  });
  assert.equal(
    await prepareWorkoutRule(
      thirdRule.data.rule.id,
      new Date(nextDay + "T08:00:00Z"),
    ),
    "participation_unavailable",
  );
  assert.equal(
    await db.institution_workout_positions.count({
      where: { assignment_id: third.id },
    }),
    0,
  );
  await db.$queryRaw`SELECT public.validate_calendar_collision(ARRAY['11000000-0000-4000-8000-000000000003']::uuid[],'2030-01-15T09:00:00Z'::timestamptz,'2030-01-15T10:00:00Z'::timestamptz,NULL::uuid)::text`;
  const report = await fetch(
    apiOrigin +
      "/v1/institution/analytics?view=admin&from=2030-01-01&to=2030-02-01",
    {
      headers: { Cookie: await cookie("11000000-0000-4000-8000-000000000001") },
    },
  );
  assert.equal(report.status, 200);
  const metrics = await report.json();
  assert.equal(
    metrics.summary.completed,
    0,
    "skipping a prepared workout is not recorded exercise completion",
  );
  assert.equal(
    metrics.performance.find((p: any) => p.id === coach)?.completed_sessions,
    0,
    "skip is not delivered training",
  );
  // Revocation prevents future work even when a stored rule remains active.
  await db.institution_members.update({
    where: { id: coach },
    data: { active: false },
  });
  assert.equal(
    await prepareWorkoutRule(autoRule.id, new Date(autoDay + "T10:00:00Z")),
    "scheduling_authority_unavailable",
  );
  assert.deepEqual(await db.institution_sessions.findMany(), before);
  const beforePass = await db.institution_events.count();
  const onePass = execFileSync(
    process.execPath,
    [
      resolve(import.meta.dirname, "../../../node_modules/tsx/dist/cli.mjs"),
      resolve(import.meta.dirname, "../scripts/prepare-workouts.ts"),
    ],
    { encoding: "utf8", env: process.env },
  );
  assert.ok(JSON.parse(onePass).checked > 0);
  assert.equal(
    await db.institution_events.count(),
    beforePass,
    "operator pass retains authority checks while API polling is paused",
  );
  execFileSync(
    process.execPath,
    [
      resolve(import.meta.dirname, "../../../node_modules/tsx/dist/cli.mjs"),
      resolve(import.meta.dirname, "../scripts/prisma/types.ts"),
    ],
    { stdio: "pipe", env: process.env },
  );
});
