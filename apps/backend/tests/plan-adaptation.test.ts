import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { db } from "../server/db.ts";
import { apiOrigin } from "./test-target.ts";
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
async function call(auth: string, path: string, body?: object) {
  const response = await fetch(apiOrigin + "/v1/institution/" + path, {
    headers: {
      Cookie: auth,
      "x-rafik-client": "web",
      "Content-Type": "application/json",
    },
    ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, data: await response.json() };
}
test("adaptation updates one existing plan without library copies; bound snapshots, progression and exact retries survive", async () => {
  const auth = await cookie("11000000-0000-4000-8000-000000000002"),
    athlete = await cookie("11000000-0000-4000-8000-000000000003");
  const source = await db.institution_assignments.findUniqueOrThrow({
    where: { id: "16000000-0000-4000-8000-000000000001" },
    include: { institution_versions: true },
  });
  const version = await db.institution_versions.create({
    data: {
      ...source.institution_versions,
      id: randomUUID(),
      revision: 99,
      prescription: source.institution_versions.prescription as any,
    },
  });
  const plan = await db.institution_assignments.create({
    data: {
      ...source,
      adaptation: undefined,
      institution_versions: undefined,
      id: randomUUID(),
      version_id: version.id,
      start_date: new Date("2020-01-01"),
      end_date: null,
    },
  });
  const payload = (action: string, fields: object) => ({
    operation: randomUUID(),
    view: "trainer",
    action,
    ...fields,
  });
  const schedule = async () => {
    const agenda = await call(
      auth,
      "workout-scheduling?view=trainer&assignment=" + plan.id,
    );
    const start = new Date(Date.now() - 60000);
    const result = await call(
      auth,
      "workout-scheduling",
      payload("schedule-workout", {
        assignment_id: plan.id,
        cursor: agenda.data.items[0].cursor,
        starts_at: start.toISOString(),
        ends_at: new Date(start.getTime() + 3600000).toISOString(),
        timezone: "UTC",
      }),
    );
    assert.equal(result.status, 200, JSON.stringify(result));
    return result.data;
  };
  const booked = await schedule();
  const frozen = await db.institution_events.findUniqueOrThrow({
    where: { id: booked.occurrence.id },
  });
  const draft = structuredClone(version.prescription) as any;
  for (const day of draft.days) {
    day.id = randomUUID();
    day.name = "Personalized " + day.name;
  }
  const count = await db.institution_programs.count(),
    versions = await db.institution_versions.count();
  const input = payload("adapt", {
    assignment: plan.id,
    revision: plan.revision,
    source_version_id: version.id,
    title: "Athlete-specific plan",
    draft,
  });
  assert.equal(
    (await call(athlete, "delivery", { ...input, view: "trainee" })).status,
    403,
  );
  const result = await call(auth, "delivery", input);
  assert.equal(result.status, 200, JSON.stringify(result));
  assert.deepEqual((await call(auth, "delivery", input)).data, result.data);
  assert.equal(
    (await call(auth, "delivery", { ...input, operation: randomUUID() }))
      .status,
    409,
  );
  assert.equal(await db.institution_programs.count(), count);
  assert.equal(await db.institution_versions.count(), versions);
  assert.equal(result.data.assignment.id, plan.id);
  assert.equal(result.data.assignment.sequence_cursor, plan.sequence_cursor);
  assert.equal(
    (
      await db.institution_assignments.findUniqueOrThrow({
        where: { id: source.id },
      })
    ).adaptation,
    null,
  );
  assert.deepEqual(
    (
      await db.institution_events.findUniqueOrThrow({
        where: { id: frozen.id },
      })
    ).workout_snapshot,
    frozen.workout_snapshot,
  );
  const detail = await call(
    auth,
    "athlete-plans?view=trainer&assignment=" + plan.id,
  );
  assert.equal(detail.data.items[0].adaptation_revision, 1);
  assert.equal(detail.data.items[0].version.title, "Athlete-specific plan");
  assert.equal(detail.data.items[0].version.id, version.id);
  const before = await call(
    auth,
    "workout-scheduling?view=trainer&assignment=" + plan.id,
  );
  assert.equal(
    before.data.items[0].day.id,
    (frozen.workout_snapshot as any).day.id,
  );
  const started = await call(
    auth,
    "sessions",
    payload("start", {
      id: randomUUID(),
      assignment_id: plan.id,
      day_id: (frozen.workout_snapshot as any).day.id,
      occurrence_id: frozen.id,
    }),
  );
  assert.equal(started.status, 200, JSON.stringify(started));
  assert.deepEqual(
    started.data.prescription,
    (frozen.workout_snapshot as any).day,
  );
  const complete = await call(
    auth,
    "sessions",
    payload("save", {
      id: started.data.id,
      revision: 1,
      entries: started.data.entries.map((entry: any) => ({
        ...entry,
        completed: true,
      })),
      note: "",
      complete: true,
    }),
  );
  assert.equal(complete.status, 200, JSON.stringify(complete));
  const next = await call(
    auth,
    "workout-scheduling?view=trainer&assignment=" + plan.id,
  );
  assert.equal(next.data.items[0].title, "Athlete-specific plan");
  assert.ok(next.data.items[0].day.name.startsWith("Personalized"));
  assert.equal(next.data.items[0].cursor, plan.sequence_cursor + 1);
  assert.equal(
    await db.institution_audit_events.count({
      where: { kind: "athlete_plan_adapted" },
    }),
    1,
  );
  // Ordinary library edits retain the same program identity and leave local adaptations untouched.
  const library = await db.institution_programs.findUniqueOrThrow({
    where: { id: version.program_id },
  });
  const admin = await cookie("11000000-0000-4000-8000-000000000001");
  const edited = await call(admin, "programs", {
    ...payload("save", {
      id: library.id,
      revision: library.draft_version,
      title: library.title,
      draft: library.draft,
    }),
    view: "admin",
  });
  assert.equal(edited.status, 200, JSON.stringify(edited));
  assert.equal(edited.data.plan.id, library.id);
  assert.equal(await db.institution_programs.count(), count);
  assert.equal(
    (
      await db.institution_assignments.findUniqueOrThrow({
        where: { id: plan.id },
      })
    ).revision,
    result.data.assignment.revision,
  );
  execFileSync(
    process.execPath,
    [
      resolve(import.meta.dirname, "../../../node_modules/tsx/dist/cli.mjs"),
      resolve(import.meta.dirname, "../scripts/prisma/types.ts"),
    ],
    { env: process.env, stdio: "pipe" },
  );
});
