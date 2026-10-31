import { apiOrigin } from "./test-target.ts";
import { fixtureInstitution } from "./institution-fixture.ts";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { db } from "../server/db.ts";
const base = apiOrigin,
  people: string[] = [],
  spaces: string[] = [];
type Person = { id: string; email: string; cookie: string };
after(async () => {
  await db.institutions.deleteMany({ where: { id: { in: spaces } } });
  await db.users.deleteMany({ where: { id: { in: people } } });
  await db.$disconnect();
});
async function person(name: string): Promise<Person> {
  const id = randomUUID(),
    email = `sports-${id}@rafik.test`,
    token = randomBytes(32).toString("hex");
  people.push(id);
  await db.users.create({
    data: { id, email, email_confirmed_at: new Date() },
  });
  await db.identity_sessions.create({
    data: {
      token_hash: createHash("sha256").update(token).digest("hex"),
      user_id: id,
      expires_at: new Date(Date.now() + 3600000),
    },
  });
  const p = { id, email, cookie: "rafik_session=" + token };
  await call(p, "/v1/account/profile", { p_name: name });
  return p;
}
async function call(p: Person, path: string, input?: unknown) {
  if (path === "/v1/institutions" && input)
    return fixtureInstitution(p, input as Record<string, unknown>);
  const r = await fetch(base + path, {
    method: input === undefined ? "GET" : "POST",
    headers: {
      Cookie: p.cookie,
      "x-rafik-client": "web",
      "Content-Type": "application/json",
    },
    body: input === undefined ? undefined : JSON.stringify(input),
  });
  return { status: r.status, data: await r.json() };
}
const operation = (action: string, args: object = {}) => ({
  operation: randomUUID(),
  action,
  ...args,
});
async function institution(admin: Person, name: string) {
  const id = randomUUID();
  spaces.push(id);
  assert.equal(
    (
      await call(admin, "/v1/institutions", {
        id,
        kind: "organization",
        name,
        sole: true,
      })
    ).status,
    200,
  );
  return id;
}
async function join(admin: Person, _id: string, p: Person, role: string) {
  const token = randomBytes(32).toString("hex");
  const r = await call(
    admin,
    "/v1/institution",
    operation("invite", {
      id: randomUUID(),
      email: p.email,
      roles: [role],
      token,
    }),
  );
  assert.equal(r.status, 200, JSON.stringify(r));
  assert.equal((await call(p, "/v1/invitations/" + token, {})).status, 200);
}
async function member(admin: Person, _id: string, p: Person) {
  const r = await call(admin, `/v1/institution?view=admin`);
  return r.data.members.find((m: { user_id: string }) => m.user_id === p.id);
}
const sport = (id: string, name: string, kind = "sport", revision = 0) =>
  operation("sport", {
    view: "admin",
    id,
    name,
    kind,
    archived: false,
    revision,
  });

test("admins define sports and specialties separately from roles, with revision, duplicate and kind checks", async () => {
  const admin = await person("Sports Admin"),
    coach = await person("Sports Coach"),
    athlete = await person("Sports Athlete"),
    id = await institution(admin, "Sports institution"),
    endpoint = `/v1/institution/sports`;
  await join(admin, id, coach, "trainer");
  await join(admin, id, athlete, "trainee");
  const football = randomUUID(),
    conditioning = randomUUID(),
    create = sport(football, "Football");
  const created = await call(admin, endpoint, create);
  assert.equal(created.status, 200, JSON.stringify(created));
  // Exact replay returns the recorded result without another revision.
  const replay = await call(admin, endpoint, create);
  assert.equal(replay.status, 200);
  assert.equal(replay.data.revision, 1);
  assert.equal(
    (
      await call(
        admin,
        endpoint,
        sport(conditioning, "Strength & conditioning", "specialty"),
      )
    ).status,
    200,
  );
  assert.equal(
    (await call(admin, endpoint, sport(randomUUID(), "  football "))).status,
    409,
    "names are unique per institution regardless of case",
  );
  assert.equal(
    (await call(admin, endpoint, sport(football, "Football", "specialty", 1)))
      .status,
    400,
    "kind is fixed after creation",
  );
  assert.equal(
    (
      await call(
        admin,
        endpoint,
        sport(football, "Association football", "sport", 0),
      )
    ).status,
    409,
    "stale revision",
  );
  assert.equal(
    (
      await call(
        admin,
        endpoint,
        sport(football, "Association football", "sport", 1),
      )
    ).status,
    200,
  );
  // Only administrators change sports; athletes cannot read the institution list.
  assert.equal(
    (
      await call(coach, endpoint, {
        ...sport(randomUUID(), "Rugby"),
        view: "trainer",
      })
    ).status,
    403,
  );
  assert.equal((await call(athlete, endpoint + "?view=trainee")).status, 403);
  const listed = await call(coach, endpoint + "?view=trainer");
  assert.equal(listed.status, 200);
  assert.deepEqual(
    listed.data.items.map((s: { name: string; kind: string }) => [
      s.name,
      s.kind,
    ]),
    [
      ["Association football", "sport"],
      ["Strength & conditioning", "specialty"],
    ],
  );
  const events = await db.institution_audit_events.count({
    where: { institution_id: id, kind: "sport_updated" },
  });
  assert.equal(events, 3);
});

test("member sport links respect role kind, archive state, stated previous set, institution and coach scope", async () => {
  const admin = await person("Links Admin"),
    coach = await person("Links Coach"),
    otherCoach = await person("Links Other Coach"),
    athlete = await person("Links Athlete"),
    otherAthlete = await person("Links Other Athlete"),
    id = await institution(admin, "Links institution"),
    endpoint = `/v1/institution/sports`;
  for (const [p, role] of [
    [coach, "trainer"],
    [otherCoach, "trainer"],
    [athlete, "trainee"],
    [otherAthlete, "trainee"],
  ] as const)
    await join(admin, id, p, role);
  const swimming = randomUUID(),
    rowing = randomUUID(),
    speed = randomUUID(),
    foreign = randomUUID();
  for (const [key, name, kind] of [
    [swimming, "Swimming", "sport"],
    [rowing, "Rowing", "sport"],
    [speed, "Speed development", "specialty"],
  ])
    assert.equal(
      (await call(admin, endpoint, sport(key, name, kind))).status,
      200,
    );
  // One institution per installation: a sport ID it does not own stands in for another institution's.
  const athleteMember = await member(admin, id, athlete),
    coachMember = await member(admin, id, coach),
    otherAthleteMember = await member(admin, id, otherAthlete),
    adminMember = await member(admin, id, admin),
    coachRow = await member(admin, id, coach);
  const link = (memberId: string, sports: string[], previous: string[]) =>
    operation("member-sports", {
      view: "admin",
      member: memberId,
      sports,
      previous,
    });
  assert.equal(
    (await call(admin, endpoint, link(athleteMember.id, [speed], []))).status,
    400,
    "athletes take part in sports, not coaching specialties",
  );
  assert.equal(
    (await call(admin, endpoint, link(athleteMember.id, [foreign], []))).status,
    400,
    "another institution's sport is rejected",
  );
  assert.equal(
    (await call(admin, endpoint, link(adminMember.id, [swimming], []))).status,
    400,
    "administrators are not linked to sports",
  );
  assert.equal(
    (
      await call(
        admin,
        endpoint,
        link(athleteMember.id, [swimming, rowing], []),
      )
    ).status,
    200,
  );
  assert.equal(
    (await call(admin, endpoint, link(athleteMember.id, [swimming], [])))
      .status,
    409,
    "a stale previous set is a conflict, not a merge",
  );
  assert.equal(
    (await call(admin, endpoint, link(coachMember.id, [swimming, speed], [])))
      .status,
    200,
  );
  assert.equal(
    (await call(admin, endpoint, link(otherAthleteMember.id, [rowing], [])))
      .status,
    200,
  );
  // Archiving keeps existing links but prevents new ones.
  assert.equal(
    (
      await call(admin, endpoint, {
        ...sport(rowing, "Rowing", "sport", 1),
        archived: true,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call(
        admin,
        endpoint,
        link(coachMember.id, [swimming, speed, rowing], [speed, swimming]),
      )
    ).status,
    400,
  );
  // People: sport filter applies inside the existing role scope.
  const people = (p: Person, view: string, query: string) =>
    call(p, `/v1/institution/people?view=${view}&${query}`);
  const rowers = await people(admin, "admin", `sport=${rowing}`);
  assert.deepEqual(
    rowers.data.items.map((m: { name: string }) => m.name).sort(),
    ["Links Athlete", "Links Other Athlete"],
  );
  assert.deepEqual(
    rowers.data.items.find((m: { id: string }) => m.id === athleteMember.id)
      .sports,
    [rowing, swimming].sort(),
  );
  assert.equal(
    (
      await call(
        admin,
        "/v1/institution",
        operation("assign-trainer", {
          id: athleteMember.id,
          revision: athleteMember.revision,
          trainer: coachRow.id,
        }),
      )
    ).status,
    200,
  );
  const scoped = await people(coach, "trainer", `sport=${rowing}`);
  assert.deepEqual(
    scoped.data.items.map((m: { name: string }) => m.name),
    ["Links Athlete"],
    "a coach still sees only assigned athletes",
  );
  const unassigned = await people(otherCoach, "trainer", `sport=${rowing}`);
  assert.equal(unassigned.data.total, 0);
  assert.equal((await people(admin, "admin", "sport=not-a-uuid")).status, 400);
  // Writes by non-admins are refused before any change.
  assert.equal(
    (
      await call(coach, endpoint, {
        ...link(athleteMember.id, [], [rowing, swimming]),
        view: "trainer",
      })
    ).status,
    403,
  );
  assert.equal(
    await db.institution_member_sports.count({
      where: { member_id: athleteMember.id },
    }),
    2,
  );
});
