import {
  institutionTestHelpers,
  type Person,
} from "./institution-test-helpers.ts";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { db } from "../server/db.ts";
const people: string[] = [],
  spaces: string[] = [];

const { person, call, operation, institution, join, member } =
  institutionTestHelpers(people, spaces, "delegated");
after(async () => {
  await db.institutions.deleteMany({ where: { id: { in: spaces } } });
  await db.users.deleteMany({ where: { id: { in: people } } });
  await db.$disconnect();
});
const sport = (id: string, name: string, kind = "sport") =>
  operation("sport", {
    view: "admin",
    id,
    name,
    kind,
    archived: false,
    revision: 0,
  });

test("delegated workout logging: coach attribution, athlete correction, history, retry and revocation", async () => {
  const admin = await person("Delegated Admin"),
    primary = await person("Delegated Primary"),
    support = await person("Delegated Support"),
    outsider = await person("Delegated Outsider"),
    athlete = await person("Delegated Athlete"),
    id = await institution(admin, "Delegated logging institution"),
    ws = `/v1/institution`;
  for (const [p, role] of [
    [primary, "trainer"],
    [support, "trainer"],
    [outsider, "trainer"],
    [athlete, "trainee"],
  ] as const)
    await join(admin, id, p, role);
  const football = randomUUID();
  assert.equal(
    (await call(admin, ws + "/sports", sport(football, "Football"))).status,
    200,
  );
  let a = await member(admin, id, athlete);
  const p = await member(admin, id, primary),
    s = await member(admin, id, support),
    o = await member(admin, id, outsider);
  for (const m of [a, s])
    assert.equal(
      (
        await call(
          admin,
          ws + "/sports",
          operation("member-sports", {
            view: "admin",
            member: m.id,
            sports: [football],
            previous: [],
          }),
        )
      ).status,
      200,
    );
  assert.equal(
    (
      await call(
        admin,
        ws,
        operation("assign-trainer", {
          id: a.id,
          revision: a.revision,
          trainer: p.id,
        }),
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await call(
        admin,
        ws,
        operation("link-coach", {
          id: randomUUID(),
          athlete: a.id,
          coach: s.id,
          sport: football,
        }),
      )
    ).status,
    200,
  );
  const plan = JSON.parse(
    readFileSync(new URL("../content/starter.json", import.meta.url), "utf8"),
  ).prescription;
  const today = new Date().toISOString().slice(0, 10);
  const assignPlan = async (title: string, sportId: string | null) => {
    const version = await call(
      primary,
      ws + "/programs",
      operation("publish", {
        view: "trainer",
        id: randomUUID(),
        title,
        draft: plan,
        revision: null,
      }),
    );
    a = await member(admin, id, athlete);
    const r = await call(
      primary,
      ws + "/delivery",
      operation("assign", {
        view: "trainer",
        version_id: version.data.version.id,
        start_date: today,
        schedule_mode: "flexible",
        sport: sportId,
        members: [{ id: a.id, revision: a.revision, replaces: null }],
      }),
    );
    assert.equal(r.status, 200, JSON.stringify(r));
    return r.data[0].id as string;
  };
  const general = await assignPlan("General block", null),
    footballPlan = await assignPlan("Football block", football);
  const start = (
    who: Person,
    view: string,
    assignment: string,
    day = plan.days[0].id,
  ) =>
    call(
      who,
      ws + "/sessions",
      operation("start", {
        view,
        id: randomUUID(),
        assignment_id: assignment,
        day_id: day,
      }),
    );
  assert.equal((await start(outsider, "trainer", general)).status, 403);
  assert.equal(
    (await start(support, "trainer", general)).status,
    403,
    "unlabelled plan",
  );
  assert.equal(
    (await start(admin, "admin", general)).status,
    403,
    "administrators do not record",
  );
  const delegated = await start(primary, "trainer", general);
  assert.equal(delegated.status, 200, JSON.stringify(delegated));
  assert.equal(delegated.data.member_id, a.id);
  assert.equal(
    delegated.data.client_id,
    athlete.id,
    "the athlete stays the subject",
  );
  assert.equal(delegated.data.recorded_mode, "delegated");
  assert.equal(delegated.data.recorded_by, p.id);
  const supported = await start(support, "trainer", footballPlan);
  assert.equal(supported.status, 200, JSON.stringify(supported));

  // The coach saves under their own identity; an exact retry does not duplicate history.
  const save = operation("save", {
    view: "trainer",
    id: delegated.data.id,
    revision: 1,
    entries: delegated.data.entries.map((e: any) => ({
      ...e,
      completed: true,
    })),
    note: "Recorded at the track",
    complete: true,
  });
  const saved = await call(primary, ws + "/sessions", save);
  assert.equal(saved.status, 200, JSON.stringify(saved));
  assert.deepEqual(
    (await call(primary, ws + "/sessions", save)).data,
    saved.data,
  );
  const receipt = await db.institution_operations.findUnique({
    where: { id: save.operation },
  });
  assert.equal(
    receipt?.actor_id,
    primary.id,
    "receipts carry the coach, not the athlete",
  );

  // A coach may finish an athlete-started workout, preserving origin and exact retry.
  const own = await start(athlete, "trainee", footballPlan, plan.days[1].id);
  assert.equal(own.status, 200, JSON.stringify(own));
  const finishOwn = operation("save", {
    view: "trainer",
    id: own.data.id,
    revision: 1,
    entries: own.data.entries.map((e: any) => ({
      ...e,
      load: 0,
      reps: 10,
      completed: true,
    })),
    note: "Coach finished athlete-started work",
    complete: true,
  });
  const finishedOwn = await call(primary, ws + "/sessions", finishOwn);
  assert.equal(finishedOwn.status, 200, JSON.stringify(finishedOwn));
  assert.equal(finishedOwn.data.recorded_mode, "self");
  assert.equal(finishedOwn.data.completed_by_role, "trainer");
  assert.equal(finishedOwn.data.completed_by, p.id);
  assert.deepEqual(
    (await call(primary, ws + "/sessions", finishOwn)).data,
    finishedOwn.data,
  );
  assert.equal(
    (
      await call(primary, ws + "/sessions", {
        ...finishOwn,
        operation: randomUUID(),
        revision: 2,
      })
    ).status,
    403,
    "new coach corrections to completed self-logged actuals remain protected",
  );
  const reviewZero = operation("review", {
    view: "trainer",
    id: own.data.id,
    revision: 2,
    note: "",
  });
  const reviewedZero = await call(support, ws + "/sessions", reviewZero);
  assert.equal(reviewedZero.status, 200, JSON.stringify(reviewedZero));
  assert.ok(reviewedZero.data.reviewed_at);
  assert.equal(reviewedZero.data.coach_note, "");
  assert.equal(
    reviewedZero.data.entries[0].load,
    0,
    "zero load is valid for bodyweight work",
  );
  assert.deepEqual(
    (await call(support, ws + "/sessions", reviewZero)).data,
    reviewedZero.data,
  );
  // History status filters apply before counting/paging and use the follow-up review rule.
  const filtered = async (status: string) => {
    const r = await call(
      primary,
      `${ws}/delivery?view=trainer&history=true&status=${status}&limit=50`,
    );
    assert.equal(r.status, 200, JSON.stringify(r));
    assert.equal(r.data.total, r.data.sessions.length);
    return r.data.sessions.map((x: any) => x.id as string);
  };
  const awaiting = await filtered("awaiting_review"),
    reviewed = await filtered("reviewed"),
    unfinished = await filtered("in_progress");
  assert.ok(
    awaiting.includes(delegated.data.id) && !awaiting.includes(own.data.id),
  );
  assert.ok(
    reviewed.includes(own.data.id) && !reviewed.includes(delegated.data.id),
  );
  assert.ok(
    unfinished.includes(supported.data.id) &&
      !unfinished.includes(own.data.id) &&
      !unfinished.includes(delegated.data.id),
  );
  assert.equal(
    (
      await call(
        primary,
        `${ws}/delivery?view=trainer&history=true&status=unknown`,
      )
    ).status,
    400,
  );
  const ownHistory = await call(
    athlete,
    "/v1/workouts/" + own.data.id + "/history?view=trainee",
  );
  assert.deepEqual(
    ownHistory.data.items.map((h: any) => h.by),
    ["athlete", "coach"],
  );

  // The athlete corrects the delegated record; every version stays attributed.
  const corrected = await call(
    athlete,
    ws + "/sessions",
    operation("save", {
      view: "trainee",
      id: delegated.data.id,
      revision: 2,
      entries: saved.data.entries.map((e: any, i: number) =>
        i === 0 ? { ...e, completed: false } : e,
      ),
      note: "First set was not completed",
      complete: true,
    }),
  );
  assert.equal(corrected.status, 200, JSON.stringify(corrected));
  const history = await call(
    athlete,
    `/v1/workouts/${delegated.data.id}/history?view=trainee`,
  );
  assert.equal(history.status, 200, JSON.stringify(history));
  assert.deepEqual(
    history.data.items.map((h: any) => [h.version, h.action, h.by]),
    [
      [1, "start", "coach"],
      [2, "save", "coach"],
      [3, "save", "athlete"],
    ],
  );
  assert.equal(history.data.items[1].actor_name, "Delegated Primary");
  // History follows session read scope.
  assert.equal(
    (
      await call(
        support,
        `/v1/workouts/${delegated.data.id}/history?view=trainer`,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        support,
        `/v1/workouts/${supported.data.id}/history?view=trainer`,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await call(
        outsider,
        `/v1/workouts/${delegated.data.id}/history?view=trainer`,
      )
    ).status,
    403,
  );

  // Analytics separates coach-recorded sessions from self-logged ones.
  const summary = await call(
    admin,
    `${ws}/analytics?view=admin&from=${today}&to=${today}`,
  );
  assert.equal(summary.status, 200, JSON.stringify(summary));
  assert.equal(summary.data.summary.coach_recorded, 1);

  // Authority is rechecked on every save: a former primary coach can no longer edit.
  a = await member(admin, id, athlete);
  assert.equal(
    (
      await call(
        admin,
        ws,
        operation("assign-trainer", {
          id: a.id,
          revision: a.revision,
          trainer: o.id,
        }),
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await call(
        primary,
        ws + "/sessions",
        operation("save", {
          view: "trainer",
          id: delegated.data.id,
          revision: 3,
          entries: corrected.data.entries,
          note: "Late change",
          complete: true,
        }),
      )
    ).status,
    403,
  );
});
