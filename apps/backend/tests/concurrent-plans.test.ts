import { apiOrigin } from "./test-target.ts";
import { fixtureInstitution } from "./institution-fixture.ts";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
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
    email = `plans-${id}@rafik.test`,
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
const sport = (id: string, name: string, kind = "sport") =>
  operation("sport", {
    view: "admin",
    id,
    name,
    kind,
    archived: false,
    revision: 0,
  });

test("concurrent goal-specific plans: add, replace, end, overlap warnings and sport-scoped supporting coaches", async () => {
  const admin = await person("Plans Admin"),
    primary = await person("Plans Primary"),
    support = await person("Plans Support"),
    athlete = await person("Plans Athlete"),
    id = await institution(admin, "Concurrent plans institution"),
    ws = `/v1/institution`;
  for (const [p, role] of [
    [primary, "trainer"],
    [support, "trainer"],
    [athlete, "trainee"],
  ] as const)
    await join(admin, id, p, role);
  const football = randomUUID(),
    swimming = randomUUID();
  for (const [key, name] of [
    [football, "Football"],
    [swimming, "Swimming"],
  ])
    assert.equal(
      (await call(admin, ws + "/sports", sport(key, name))).status,
      200,
    );
  let a = await member(admin, id, athlete);
  const p = await member(admin, id, primary),
    s = await member(admin, id, support);
  const links = (sports: string[], m: string) =>
    operation("member-sports", {
      view: "admin",
      member: m,
      sports,
      previous: [],
    });
  assert.equal(
    (await call(admin, ws + "/sports", links([football, swimming], a.id)))
      .status,
    200,
  );
  assert.equal(
    (await call(admin, ws + "/sports", links([football], s.id))).status,
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
  const publish = async (title: string) => {
    const r = await call(
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
    assert.equal(r.status, 200, JSON.stringify(r));
    return r.data.version.id as string;
  };
  const speed = await publish("Speed block"),
    strength = await publish("Strength block"),
    agility = await publish("Agility block"),
    swim = await publish("Swim block");
  const today = new Date().toISOString().slice(0, 10),
    later = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10);
  a = await member(admin, id, athlete);
  const assign = (
    who: Person,
    version: string,
    extra: object = {},
    replaces: unknown = null,
  ) =>
    call(
      who,
      ws + "/delivery",
      operation("assign", {
        view: "trainer",
        version_id: version,
        start_date: today,
        schedule_mode: "flexible",
        members: [
          {
            id: a.id,
            revision: a.revision,
            replaces,
            ...(replaces ? { replaces_revision: 1 } : {}),
          },
        ],
        ...extra,
      }),
    );
  const first = await assign(primary, speed, {
    goal: "Match speed",
    sport: football,
  });
  assert.equal(first.status, 200, JSON.stringify(first));
  assert.deepEqual(first.data[0].overlaps, []);
  const second = await assign(primary, strength, { goal: "General strength" });
  assert.equal(second.status, 200);
  assert.deepEqual(
    second.data[0].overlaps.map((o: { title: string }) => o.title),
    ["Speed block"],
    "overlapping dates are reported, not blocked",
  );
  assert.equal(
    (await assign(primary, speed)).status,
    409,
    "the same version cannot be active twice",
  );
  assert.equal(
    (await assign(primary, swim, { goal: "x".repeat(81) })).status,
    400,
    "goal is bounded",
  );
  // Supporting coach: only plans labelled with their linked sport.
  assert.equal((await assign(support, swim, { sport: swimming })).status, 403);
  assert.equal((await assign(support, swim)).status, 403);
  const supportPlan = await assign(support, agility, {
    goal: "Agility",
    sport: football,
  });
  assert.equal(supportPlan.status, 200, JSON.stringify(supportPlan));
  // Intentional exception: a supporting coach's overlap warning names plans outside their sport,
  // limited to title, goal and dates; those plans stay unreadable to them (asserted below).
  const strengthOverlap = supportPlan.data[0].overlaps.find(
    (o: { title: string }) => o.title === "Strength block",
  );
  assert.deepEqual(Object.keys(strengthOverlap).sort(), [
    "end_date",
    "goal",
    "start_date",
    "title",
  ]);
  assert.equal(strengthOverlap.goal, "General strength");
  assert.equal(
    (await assign(support, swim, { sport: football }, second.data[0].id))
      .status,
    403,
    "a supporting coach cannot replace an unlabelled plan",
  );
  const active = async () =>
    (
      await db.institution_assignments.findMany({
        where: { member_id: a.id, state: "active" },
        include: { institution_versions: true },
      })
    )
      .map((x) => x.institution_versions.title)
      .sort();
  assert.deepEqual(await active(), [
    "Agility block",
    "Speed block",
    "Strength block",
  ]);

  // Reads: the supporting coach sees only football-labelled plans.
  const titles = (r: { data: { assignments?: any[]; items?: any[] } }) =>
    (r.data.assignments || r.data.items || [])
      .map((x: any) => (x.version || x.institution_versions).title)
      .sort();
  assert.deepEqual(
    titles(await call(support, `${ws}/delivery?view=trainer&member=${a.id}`)),
    ["Agility block", "Speed block"],
  );
  assert.deepEqual(
    titles(await call(primary, `${ws}/delivery?view=trainer&member=${a.id}`)),
    ["Agility block", "Speed block", "Strength block"],
  );
  assert.deepEqual(
    titles(
      await call(
        support,
        `${ws}/athlete-plans?view=trainer&status=all&member=${a.id}`,
      ),
    ),
    ["Agility block", "Speed block"],
  );
  const recipients = await call(primary, `${ws}/recipients?view=trainer`);
  assert.equal(recipients.status, 200, JSON.stringify(recipients));
  assert.deepEqual(
    recipients.data.items[0].plans
      .map((x: { goal: string | null }) => x.goal)
      .sort(),
    ["Agility", "General strength", "Match speed"],
  );
  // Recipient search is bounded; only administrators may match (and see) account email.
  const emailPart = athlete.email.split("@")[0];
  const byEmail = await call(
    admin,
    `${ws}/recipients?view=admin&email=true&limit=5&search=${encodeURIComponent(emailPart)}`,
  );
  assert.equal(byEmail.status, 200, JSON.stringify(byEmail));
  assert.deepEqual(
    byEmail.data.items.map((x: { email?: string }) => x.email),
    [athlete.email],
  );
  const coachByEmail = await call(
    primary,
    `${ws}/recipients?view=trainer&email=true&limit=5&search=${encodeURIComponent(emailPart)}`,
  );
  assert.equal(coachByEmail.data.items.length, 0);
  assert.ok(
    recipients.data.items.every((x: object) => !("email" in x)),
    "coaches never receive member email",
  );

  // Sessions follow their plan's sport.
  const start = async (assignment: string) => {
    const r = await call(
      athlete,
      ws + "/sessions",
      operation("start", {
        view: "trainee",
        id: randomUUID(),
        assignment_id: assignment,
        day_id: plan.days[0].id,
      }),
    );
    assert.equal(r.status, 200, JSON.stringify(r));
    return r.data.id as string;
  };
  const footballSession = await start(first.data[0].id),
    strengthSession = await start(second.data[0].id);
  const history = await call(
    support,
    `${ws}/delivery?view=trainer&history=true&member=${a.id}`,
  );
  assert.deepEqual(
    history.data.sessions.map((x: any) => x.id),
    [footballSession],
  );
  assert.equal(
    (await call(support, `/v1/workouts/${footballSession}?view=trainer`))
      .status,
    200,
  );
  assert.equal(
    (await call(support, `/v1/workouts/${strengthSession}?view=trainer`))
      .status,
    403,
  );
  assert.equal(
    (await call(primary, `/v1/workouts/${strengthSession}?view=trainer`))
      .status,
    200,
  );

  // Replace and end are explicit and revision-checked; legacy fields still replace.
  a = await member(admin, id, athlete);
  assert.equal(
    (await assign(primary, swim, { sport: swimming }, randomUUID())).status,
    409,
    "an unknown plan cannot be replaced",
  );
  const legacy = await call(
    primary,
    ws + "/delivery",
    operation("assign", {
      view: "trainer",
      version_id: swim,
      start_date: today,
      end_date: later,
      schedule_mode: "flexible",
      sport: swimming,
      members: [
        {
          id: a.id,
          revision: a.revision,
          assignment_id: second.data[0].id,
          assignment_revision: second.data[0].revision,
        },
      ],
    }),
  );
  assert.equal(legacy.status, 200, JSON.stringify(legacy));
  assert.deepEqual(await active(), [
    "Agility block",
    "Speed block",
    "Swim block",
  ]);
  const end = (who: Person, plan: { id: string; revision: number }) =>
    call(
      who,
      ws + "/delivery",
      operation("end", {
        view: "trainer",
        assignment: plan.id,
        revision: plan.revision,
      }),
    );
  assert.equal(
    (await end(support, legacy.data[0])).status,
    403,
    "swimming plan is outside the link",
  );
  assert.equal(
    (await end(support, { ...first.data[0], revision: 9 })).status,
    409,
  );
  assert.equal((await end(support, first.data[0])).status, 200);
  assert.deepEqual(await active(), ["Agility block", "Swim block"]);
  const ended = await db.institution_audit_events.count({
    where: { institution_id: id, kind: "assignment_ended" },
  });
  assert.equal(ended, 1);

  // Assessment history: a supporting coach sees results only from events they staffed.
  const field = {
      key: randomUUID(),
      name: "Sprint",
      kind: "number",
      unit: "s",
      min: 0,
      max: 60,
    },
    templateId = randomUUID(),
    template = operation("template", {
      view: "admin",
      id: templateId,
      title: "Sprint test",
      definition: [field],
      revision: 0,
      archived: false,
    });
  assert.equal((await call(admin, ws + "/services", template)).status, 200);
  const tomorrow =
    new Date(Date.now() + 86400000).toISOString().slice(0, 10) + "T09:00";
  const staffed = async (coach: Person, staff: string) => {
    const r = await call(
      admin,
      ws + "/calendar",
      operation("create", {
        id: randomUUID(),
        view: "admin",
        title: "Sprint by " + staff.slice(0, 4),
        kind: "assessment",
        template: templateId,
        template_revision: 1,
        staff: [staff],
        participants: [a.id],
        local: tomorrow,
        zone: "UTC",
        minutes: 30,
        count: 1,
        every: 7,
      }),
    );
    assert.equal(r.status, 200, JSON.stringify(r));
    const event = r.data[0];
    await db.institution_events.update({
      where: { id: event.id },
      data: {
        starts_at: new Date(Date.now() - 7200000),
        ends_at: new Date(Date.now() - 3600000),
      },
    });
    for (const [action, extra] of [
      ["attendance", { revision: 1, attendance: "present" }],
      ["result", { revision: 0, values: { [field.key]: 7 }, note: "" }],
    ] as const) {
      const w = await call(
        coach,
        ws + "/calendar",
        operation(action, {
          id: event.id,
          view: "trainer",
          member: a.id,
          ...extra,
        }),
      );
      assert.equal(w.status, 200, JSON.stringify(w));
    }
    return event.id as string;
  };
  const byPrimary = await staffed(primary, p.id),
    bySupport = await staffed(support, s.id);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    window = `from=${yesterday}&to=${today}`;
  const results = async (who: Person) =>
    (
      await call(
        who,
        `${ws}/assessment-history?view=trainer&member=${a.id}&${window}`,
      )
    ).data.items
      .map((x: any) => x.event_id)
      .sort();
  assert.deepEqual(await results(support), [bySupport]);
  assert.deepEqual(await results(primary), [byPrimary, bySupport].sort());
});
