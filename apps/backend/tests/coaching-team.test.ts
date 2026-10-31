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
  institutionTestHelpers(people, spaces, "coaching");
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

test("primary and supporting coaches: scoped reads, primary-only sensitive data, lifecycle and mirror", async () => {
  const admin = await person("Team Admin"),
    primary = await person("Team Primary"),
    support = await person("Team Support"),
    outsider = await person("Team Outsider"),
    athlete = await person("Team Athlete"),
    id = await institution(admin, "Coaching team institution"),
    ws = `/v1/institution`;
  for (const [p, role] of [
    [primary, "trainer"],
    [support, "trainer"],
    [outsider, "trainer"],
    [athlete, "trainee"],
  ] as const)
    await join(admin, id, p, role);
  const football = randomUUID(),
    conditioning = randomUUID(),
    foreign = randomUUID();
  assert.equal(
    (await call(admin, ws + "/sports", sport(football, "Football"))).status,
    200,
  );
  assert.equal(
    (
      await call(
        admin,
        ws + "/sports",
        sport(conditioning, "Strength", "specialty"),
      )
    ).status,
    200,
  );
  // One institution per installation: a sport ID it does not own stands in for another institution's.
  let a = await member(admin, id, athlete);
  const p = await member(admin, id, primary),
    s = await member(admin, id, support),
    o = await member(admin, id, outsider);
  const links = (sports: string[], previous: string[], m: string) =>
    operation("member-sports", { view: "admin", member: m, sports, previous });
  assert.equal(
    (await call(admin, ws + "/sports", links([football], [], a.id))).status,
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
  const link = (coach: string, sportId: string) =>
    operation("link-coach", {
      id: randomUUID(),
      athlete: a.id,
      coach,
      sport: sportId,
    });
  assert.equal(
    (await call(admin, ws, link(s.id, football))).status,
    400,
    "the coach must cover the sport",
  );
  assert.equal(
    (
      await call(
        admin,
        ws + "/sports",
        links([football, conditioning], [], s.id),
      )
    ).status,
    200,
  );
  assert.equal(
    (await call(admin, ws, link(s.id, foreign))).status,
    400,
    "foreign sport",
  );
  assert.equal(
    (await call(admin, ws, link(p.id, football))).status,
    409,
    "already primary",
  );
  assert.equal(
    (await call(primary, ws, { ...link(s.id, football), view: "trainer" }))
      .status,
    403,
    "only administrators manage the coaching team",
  );
  const linked = await call(admin, ws, link(s.id, football));
  assert.equal(linked.status, 200, JSON.stringify(linked));
  assert.equal(
    (await call(admin, ws, link(s.id, conditioning))).status,
    409,
    "one active link per pair",
  );

  const read = (who: Person, path: string) => call(who, ws + path);
  const today = new Date().toISOString().slice(0, 10),
    window = `from=${today}&to=${today}`;
  // Training scope: plans, sessions, assessments, people, scheduling.
  for (const path of [
    `/delivery?view=trainer&member=${a.id}`,
    `/athlete-plans?view=trainer&member=${a.id}`,
    `/assessment-history?view=trainer&member=${a.id}&${window}`,
  ]) {
    assert.equal((await read(support, path)).status, 200, path);
    assert.equal((await read(outsider, path)).status, 403, path);
  }
  const roster = await read(support, "/people?view=trainer");
  assert.deepEqual(
    roster.data.items.map((m: { id: string }) => m.id),
    [a.id],
  );
  assert.deepEqual(
    roster.data.items[0].coaches.map((c: { coach: string; kind: string }) => [
      c.coach,
      c.kind,
    ]),
    [
      [p.id, "primary"],
      [s.id, "supporting"],
    ],
  );
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const event = (who: Person) =>
    call(who, ws + "/calendar", {
      operation: randomUUID(),
      action: "create",
      id: randomUUID(),
      view: "trainer",
      title: "Football conditioning",
      kind: "training",
      staff: [who === support ? s.id : o.id],
      participants: [a.id],
      local: tomorrow + "T09:00",
      zone: "UTC",
      minutes: 45,
      count: 1,
      every: 7,
    });
  assert.equal((await event(support)).status, 200);
  assert.equal((await event(outsider)).status, 403);
  // Primary only: nutrition, participation status, plan assignment, follow-up, analytics.
  assert.equal(
    (await read(support, `/nutrition?view=trainer&member=${a.id}`)).status,
    403,
  );
  assert.equal(
    (await read(primary, `/nutrition?view=trainer&member=${a.id}`)).status,
    200,
  );
  assert.equal(
    (await read(support, `/analytics?view=trainer&member=${a.id}&${window}`))
      .status,
    403,
  );
  const injuries = await read(support, "/injuries?view=trainer");
  assert.equal(injuries.status, 200);
  assert.equal(JSON.stringify(injuries.data).includes(a.id), false);
  const plan = JSON.parse(
    readFileSync(new URL("../content/starter.json", import.meta.url), "utf8"),
  ).prescription;
  const published = await call(
    primary,
    ws + "/programs",
    operation("publish", {
      view: "trainer",
      id: randomUUID(),
      title: "Team plan",
      draft: plan,
      revision: null,
    }),
  );
  assert.equal(published.status, 200, JSON.stringify(published));
  a = await member(admin, id, athlete);
  const assign = (who: Person) =>
    call(
      who,
      ws + "/delivery",
      operation("assign", {
        view: "trainer",
        version_id: published.data.version.id,
        start_date: tomorrow,
        schedule_mode: "flexible",
        members: [{ id: a.id, revision: a.revision }],
      }),
    );
  assert.equal((await assign(support)).status, 403);
  assert.equal((await assign(primary)).status, 200);

  // Removing the sport from the athlete ends the dependent supporting link.
  assert.equal(
    (await call(admin, ws + "/sports", links([], [football], a.id))).status,
    200,
  );
  assert.equal(
    (await read(support, `/delivery?view=trainer&member=${a.id}`)).status,
    403,
  );
  assert.equal(
    (await call(admin, ws + "/sports", links([football], [], a.id))).status,
    200,
  );
  const relinked = await call(admin, ws, link(s.id, football));
  assert.equal(relinked.status, 200);
  assert.equal(
    (
      await call(
        admin,
        ws,
        operation("end-coach-link", { id: relinked.data.id, revision: 2 }),
      )
    ).status,
    409,
    "stale link revision",
  );
  assert.equal(
    (
      await call(
        admin,
        ws,
        operation("end-coach-link", { id: relinked.data.id, revision: 1 }),
      )
    ).status,
    200,
  );
  assert.equal(
    (await read(support, `/athlete-plans?view=trainer&member=${a.id}`)).status,
    403,
  );

  // Promoting a supporting coach to primary replaces, never duplicates, responsibility.
  assert.equal((await call(admin, ws, link(s.id, football))).status, 200);
  a = await member(admin, id, athlete);
  assert.equal(
    (
      await call(
        admin,
        ws,
        operation("assign-trainer", {
          id: a.id,
          revision: a.revision,
          trainer: s.id,
        }),
      )
    ).status,
    200,
  );
  const active = await db.institution_coaching_links.findMany({
    where: { athlete_member_id: a.id, ended_at: null },
  });
  assert.deepEqual(
    active.map((l) => [l.coach_member_id, l.kind]),
    [[s.id, "primary"]],
  );
  assert.equal(
    (await read(support, `/nutrition?view=trainer&member=${a.id}`)).status,
    200,
  );
  assert.equal(
    (await read(primary, `/nutrition?view=trainer&member=${a.id}`)).status,
    403,
  );

  // Deactivating the coach ends their links through the database trigger.
  const coach = await member(admin, id, support);
  assert.equal(
    (
      await call(
        admin,
        ws,
        operation("member", {
          id: coach.id,
          revision: coach.revision,
          roles: ["trainer"],
          active: false,
        }),
      )
    ).status,
    200,
  );
  assert.equal(
    await db.institution_coaching_links.count({
      where: { institution_id: id, coach_member_id: s.id, ended_at: null },
    }),
    0,
  );
  // trainer_id mirrors the active primary link for every athlete in the institution.
  const athletes = await db.institution_members.findMany({
    where: { institution_id: id, roles: { has: "trainee" } },
    include: {
      coaching_as_athlete: { where: { kind: "primary", ended_at: null } },
    },
  });
  for (const m of athletes)
    assert.equal(
      m.trainer_id,
      m.coaching_as_athlete[0]?.coach_member_id || null,
    );
  const events = await db.institution_audit_events.findMany({
    where: {
      institution_id: id,
      kind: { in: ["coach_linked", "coach_link_ended"] },
    },
  });
  assert.equal(events.filter((e) => e.kind === "coach_linked").length, 3);
  assert.equal(events.filter((e) => e.kind === "coach_link_ended").length, 1);
});
