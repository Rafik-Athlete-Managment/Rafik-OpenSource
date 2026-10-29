import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { apiOrigin } from "./test-target.ts";
import { fixtureInstitution } from "./institution-fixture.ts";
import { db } from "../server/db.ts";

type Person = { id: string; member: string; cookie: string };
const users: string[] = [],
  institution = randomUUID(),
  endpoint = "/v1/institution";
after(async () => {
  await db.institutions.deleteMany({ where: { id: institution } });
  await db.users.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});
async function person(name: string): Promise<Person> {
  const id = randomUUID(),
    token = randomBytes(32).toString("hex");
  users.push(id);
  await db.users.create({ data: { id, email: `group-${id}@rafik.test` } });
  await db.identity_sessions.create({
    data: {
      token_hash: createHash("sha256").update(token).digest("hex"),
      user_id: id,
      expires_at: new Date(Date.now() + 3600000),
    },
  });
  const result = { id, member: randomUUID(), cookie: "rafik_session=" + token };
  ok(await call(result, "/v1/account/profile", { p_name: name }));
  return result;
}
async function call(p: Person, path: string, input?: unknown) {
  const response = await fetch(apiOrigin + path, {
    method: input === undefined ? "GET" : "POST",
    headers: {
      Cookie: p.cookie,
      "x-rafik-client": "web",
      "Content-Type": "application/json",
    },
    body: input === undefined ? undefined : JSON.stringify(input),
  });
  return { status: response.status, data: await response.json() };
}
const op = (action: string, args: object = {}) => ({
  operation: randomUUID(),
  action,
  ...args,
});
function ok(r: { status: number; data: any }) {
  assert.equal(r.status, 200, JSON.stringify(r));
  return r.data;
}

test("group templates and results: frozen baseline, separate actuals, permissions, receipts and no plan advancement", async () => {
  const admin = await person("Group admin"),
    coach = await person("Group coach"),
    other = await person("Other coach"),
    a = await person("Group athlete A"),
    b = await person("Group athlete B");
  await fixtureInstitution(admin, {
    id: institution,
    kind: "organization",
    name: "Group workout checks",
    sole: true,
  });
  admin.member = (
    await db.institution_members.findFirstOrThrow({
      where: { institution_id: institution, user_id: admin.id },
    })
  ).id;
  for (const [p, role] of [
    [coach, "trainer"],
    [other, "trainer"],
    [a, "trainee"],
    [b, "trainee"],
  ] as const)
    await db.institution_members.create({
      data: {
        id: p.member,
        institution_id: institution,
        user_id: p.id,
        name: role + " " + p.member,
        roles: [role],
        trainer_id: role === "trainee" ? coach.member : null,
      },
    });
  const prescription = JSON.parse(
    readFileSync(new URL("../content/starter.json", import.meta.url), "utf8"),
  ).prescription;
  const day = structuredClone(prescription.days[0]);
  day.exercises = day.exercises.slice(0, 1);
  for (const scope of ["organization", "private"]) {
    const exerciseId = "group-fixture-" + scope;
    await db.institution_exercises.create({
      data: {
        institution_id: institution,
        id: exerciseId,
        created_by: coach.member,
        data: {
          name: "Fixture movement",
          name_ar: "حركة تجريبية",
          kind: "strength",
          scope,
        },
      },
    });
    const r = await call(
      coach,
      endpoint + "/workout-templates",
      op("save", {
        view: "trainer",
        id: randomUUID(),
        revision: 0,
        title: "Scope " + scope,
        workout: { ...day, exercises: [{ ...day.exercises[0], exerciseId }] },
      }),
    );
    assert.equal(r.status, scope === "private" ? 400 : 200, JSON.stringify(r));
  }
  const templateId = randomUUID(),
    save = op("save", {
      view: "trainer",
      id: templateId,
      revision: 0,
      title: "Field strength",
      workout: day,
    });
  const template = ok(await call(coach, endpoint + "/workout-templates", save));
  assert.equal(template.revision, 1);
  assert.deepEqual(
    ok(await call(coach, endpoint + "/workout-templates", save)),
    template,
  );
  assert.equal(
    (
      await call(
        other,
        endpoint + "/workout-templates",
        op("save", { ...save, operation: randomUUID(), revision: 1 }),
      )
    ).status,
    403,
  );
  assert.equal(
    (await call(a, endpoint + "/workout-templates?view=trainee")).status,
    403,
  );
  const list = ok(
    await call(
      other,
      endpoint + "/workout-templates?view=trainer&search=Field&limit=5",
    ),
  );
  assert.equal(list.total, 1);
  assert.equal(list.items[0].can_edit, false);
  assert.equal(
    (
      await call(
        coach,
        endpoint + "/workout-templates",
        op("save", {
          view: "trainer",
          id: randomUUID(),
          revision: 0,
          title: "Invalid",
          workout: {
            ...day,
            exercises: [{ ...day.exercises[0], exerciseId: "not-shared" }],
          },
        }),
      )
    ).status,
    400,
  );
  // A real individual assignment exists alongside the additional group work.
  const version = ok(
    await call(
      coach,
      endpoint + "/programs",
      op("publish", {
        view: "trainer",
        id: randomUUID(),
        title: "Independent plan",
        draft: prescription,
        revision: null,
      }),
    ),
  ).version;
  const member = await db.institution_members.findUniqueOrThrow({
    where: { id: a.member },
  });
  const assigned = ok(
    await call(
      coach,
      endpoint + "/delivery",
      op("assign", {
        view: "trainer",
        version_id: version.id,
        start_date: new Date().toISOString().slice(0, 10),
        schedule_mode: "flexible",
        members: [{ id: a.member, revision: member.revision, replaces: null }],
      }),
    ),
  )[0];
  const before = await db.institution_assignments.findUniqueOrThrow({
    where: { id: assigned.id },
  });
  const eid = randomUUID(),
    local = new Date(Date.now() + 86400000).toISOString().slice(0, 16);
  const create = op("create", {
    view: "admin",
    id: eid,
    title: "Group field session",
    kind: "training",
    local,
    zone: "UTC",
    minutes: 60,
    count: 1,
    every: 7,
    staff: [coach.member],
    participants: [a.member, b.member],
    workout_template_id: templateId,
    workout_template_revision: 1,
  });
  ok(await call(admin, endpoint + "/calendar", create));
  assert.equal(
    (await call(coach, endpoint + `/group-workouts?view=trainer&event=${eid}`))
      .status,
    200,
  );
  assert.equal(
    (await call(other, endpoint + `/group-workouts?view=trainer&event=${eid}`))
      .status,
    403,
  );
  assert.equal(
    ok(await call(a, endpoint + `/group-workouts?view=trainee&event=${eid}`))
      .participants.length,
    1,
  );
  const frozen = (
    await db.institution_events.findUniqueOrThrow({ where: { id: eid } })
  ).workout_snapshot;
  ok(
    await call(
      coach,
      endpoint + "/workout-templates",
      op("save", {
        view: "trainer",
        id: templateId,
        revision: 1,
        title: "Updated template",
        workout: { ...day, minutes: 45 },
      }),
    ),
  );
  ok(
    await call(
      coach,
      endpoint + "/workout-templates",
      op("archive", {
        view: "trainer",
        id: templateId,
        revision: 2,
        archived: true,
      }),
    ),
  );
  assert.deepEqual(
    (await db.institution_events.findUniqueOrThrow({ where: { id: eid } }))
      .workout_snapshot,
    frozen,
  );
  const start = (
    who: Person,
    view: string,
    subject = a.member,
    workout = day,
  ) =>
    call(
      who,
      endpoint + "/group-workouts",
      op("start", {
        view,
        event: eid,
        member_id: subject,
        revision: 1,
        id: randomUUID(),
        workout,
      }),
    );
  assert.equal(
    (await start(coach, "trainer")).status,
    409,
    "recording waits for start",
  );
  await db.institution_events.update({
    where: { id: eid },
    data: {
      starts_at: new Date(Date.now() - 1800000),
      ends_at: new Date(Date.now() + 1800000),
    },
  });
  for (const p of [a, b])
    ok(
      await call(
        coach,
        endpoint + "/calendar",
        op("attendance", {
          view: "trainer",
          id: eid,
          member: p.member,
          revision: 1,
          attendance: "present",
        }),
      ),
    );
  assert.equal((await start(a, "trainee")).status, 403);
  assert.equal((await start(admin, "admin")).status, 403);
  assert.equal((await start(other, "trainer")).status, 403);
  const restriction = randomUUID();
  await db.institution_injury_records.create({
    data: {
      id: restriction,
      institution_id: institution,
      athlete_member_id: a.member,
      participation: "unavailable",
      effective_from: new Date("2026-01-01T00:00:00Z"),
    },
  });
  assert.equal(
    (
      await call(
        coach,
        endpoint + "/group-workouts",
        op("start", {
          view: "trainer",
          event: eid,
          member_id: a.member,
          revision: 2,
          id: randomUUID(),
        }),
      )
    ).status,
    409,
  );
  assert.equal(
    ok(
      await call(coach, endpoint + `/group-workouts?view=trainer&event=${eid}`),
    ).participants.find((p: any) => p.member_id === a.member).can_start,
    false,
  );
  await db.institution_injury_records.update({
    where: { id: restriction },
    data: { state: "closed", closed_at: new Date() },
  });
  const modified = structuredClone(day);
  modified.exercises[0].sets = 1;
  modified.exercises[0].load = 0;
  modified.exercises.push(
    { ...modified.exercises[0], key: randomUUID(), kind: "timed", seconds: 30 },
    {
      ...modified.exercises[0],
      key: randomUUID(),
      kind: "distance",
      metres: 400,
    },
  );
  const begin = op("start", {
    view: "trainer",
    event: eid,
    member_id: a.member,
    revision: 2,
    id: randomUUID(),
    workout: modified,
  });
  const record = ok(await call(coach, endpoint + "/group-workouts", begin));
  assert.equal(record.assignment_id, null);
  assert.equal(record.source_kind, "additional");
  assert.equal(record.prescription.exercises[0].sets, 1);
  assert.deepEqual(
    ok(await call(coach, endpoint + "/group-workouts", begin)),
    record,
  );
  assert.equal(
    (
      await call(coach, endpoint + "/group-workouts", {
        ...begin,
        operation: randomUUID(),
        id: randomUUID(),
      })
    ).status,
    409,
    "competing start cannot silently discard its prescription",
  );
  assert.equal(
    (await call(b, `/v1/workouts/${record.id}?view=trainee`)).status,
    403,
  );
  assert.equal(
    ok(await call(a, `/v1/workouts/${record.id}?view=trainee`)).can_record,
    false,
  );
  const finish = op("save", {
    view: "trainer",
    id: record.id,
    revision: 1,
    entries: record.entries.map((entry: any) => ({
      ...entry,
      load: 0,
      reps: 10,
      ...(entry.seconds !== null ? { seconds: 45 } : {}),
      ...(entry.metres !== null ? { metres: 380 } : {}),
      effort: 7,
      completed: true,
    })),
    note: "Bodyweight actuals",
    complete: true,
  });
  assert.equal(
    (
      await call(a, endpoint + "/sessions", {
        ...finish,
        operation: randomUUID(),
        view: "trainee",
      })
    ).status,
    403,
  );
  const finished = ok(await call(coach, endpoint + "/sessions", finish));
  assert.equal(finished.entries[0].load, 0);
  assert.ok(finished.completed_at);
  assert.deepEqual(
    ok(await call(coach, endpoint + "/sessions", finish)),
    finished,
  );
  let event = await db.institution_events.findUniqueOrThrow({
    where: { id: eid },
  });
  assert.equal(
    (
      await call(
        coach,
        endpoint + "/calendar",
        op("finish", { view: "trainer", id: eid, revision: event.revision }),
      )
    ).status,
    400,
    "unrecorded present athlete prevents completion",
  );
  const skipped = op("skip", {
    view: "trainer",
    event: eid,
    member_id: b.member,
    revision: 2,
    reason: "Left the field early",
  });
  ok(await call(coach, endpoint + "/group-workouts", skipped));
  assert.deepEqual(
    ok(await call(coach, endpoint + "/group-workouts", skipped)),
    { skipped: true },
  );
  event = await db.institution_events.findUniqueOrThrow({ where: { id: eid } });
  ok(
    await call(
      coach,
      endpoint + "/calendar",
      op("finish", { view: "trainer", id: eid, revision: event.revision }),
    ),
  );
  const after = await db.institution_assignments.findUniqueOrThrow({
    where: { id: assigned.id },
  });
  assert.equal(after.sequence_cursor, before.sequence_cursor);
  assert.equal(
    await db.institution_workout_positions.count({
      where: { session_id: record.id },
    }),
    0,
  );
  assert.equal(
    ok(
      await call(coach, endpoint + "/delivery?view=trainer&history=true"),
    ).sessions.some((s: any) => s.id === record.id),
    false,
  );
  assert.equal(
    ok(await call(a, `/v1/workouts/${record.id}/history?view=trainee`)).items
      .length,
    2,
  );
  await assert.rejects(
    db.institution_sessions.update({
      where: { id: record.id },
      data: { source_snapshot: { changed: true } },
    }),
    /immutable_workout_source/,
  );
  await assert.rejects(
    db.institution_events.update({
      where: { id: eid },
      data: { workout_snapshot: { changed: true } },
    }),
    /immutable_workout_source/,
  );
  // Current event authority is checked before returning any previously acknowledged receipt.
  await db.institution_event_people.deleteMany({
    where: { event_id: eid, member_id: coach.member, duty: "staff" },
  });
  assert.equal((await call(coach, endpoint + "/sessions", finish)).status, 403);
  assert.equal(
    (await call(coach, endpoint + "/group-workouts", begin)).status,
    403,
  );
  assert.equal(
    ok(await call(admin, `/v1/workouts/${record.id}?view=admin`)).can_record,
    false,
  );
});
