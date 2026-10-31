import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { db } from "../server/db.ts";
import {
  organizationFixture,
  call,
  operation,
} from "./organization-fixture.ts";
after(() => db.$disconnect());
const sample = JSON.parse(
  await readFile(new URL("../content/starter.json", import.meta.url), "utf8"),
);
const draft = () => structuredClone(sample.prescription);
test("program drafts may be empty while publication validates a complete prescription", async () => {
  const f = await organizationFixture();
  try {
    const admin = await f.person(),
      athlete = await f.person(),
      id = await f.create(admin),
      program = randomUUID(),
      incomplete = {
        schema: 2,
        cycleWeeks: 1,
        days: [
          {
            id: randomUUID(),
            name: "Session 1",
            minutes: 30,
            week: 1,
            weekday: 0,
            exercises: [],
          },
        ],
      };
    const saved = await call(
      admin,
      `/v1/institution/programs`,
      operation("save", {
        view: "admin",
        id: program,
        title: "Draft in progress",
        draft: incomplete,
        revision: null,
      }),
    );
    assert.equal(saved.status, 200, JSON.stringify(saved));
    assert.deepEqual(saved.data.plan.draft.days[0].exercises, []);
    await f.join(admin, id, athlete, ["trainee"]);
    const published = await call(
      admin,
      `/v1/institution/programs`,
      operation("publish", {
        view: "admin",
        id: program,
        title: "Draft in progress",
        draft: incomplete,
        revision: saved.data.plan.draft_version,
      }),
    );
    assert.equal(published.status, 400);
    assert.equal(
      (await call(athlete, `/v1/institution/programs?view=trainee`)).data.total,
      0,
    );
  } finally {
    await f.cleanup();
  }
});
test("organization publication, actuals, reassignment and exact replay preserve owned history", async () => {
  const f = await organizationFixture();
  try {
    const admin = await f.person(),
trainer = await f.person(),
client = await f.person(),
replacement = await f.person(),
foreign = await f.person(),
id = await f.create(admin);
await f.create(foreign);
    const staff = await f.join(admin, id, trainer, ["trainer"]),
      trainee = await f.join(admin, id, client, ["trainee"]),
      next = await f.join(admin, id, replacement, ["trainer"]);
    const assignStaff = operation("assign-trainer", {
      id: trainee.id,
      revision: 1,
      trainer: staff.id,
    });
    assert.equal(
      (await call(admin, `/v1/institution`, assignStaff)).status,
      200,
    );
    const pid = randomUUID(),
      publish = operation("publish", {
        view: "trainer",
        id: pid,
        title: "Three-day foundation",
        draft: draft(),
        revision: null,
      });
    let r = await call(trainer, `/v1/institution/programs`, publish);
    assert.equal(r.status, 200, JSON.stringify(r));
    const version = r.data.version;
    assert.deepEqual(
      (await call(trainer, `/v1/institution/programs`, publish)).data,
      r.data,
    );
    assert.equal(
      (
        await call(
          foreign,
          `/v1/institution/programs?view=admin&program=${pid}`,
        )
      ).status,
      403,
    );
    // Athlete program browsing is assignment-scoped, including direct URLs.
    const library = await call(
      client,
      `/v1/institution/programs?view=trainee&program=${pid}`,
    );
    assert.equal(library.status, 403, JSON.stringify(library));
    const unassignedList = await call(
      client,
      `/v1/institution/programs?view=trainee`,
    );
    assert.equal(unassignedList.status, 200);
    assert.equal(unassignedList.data.items.length, 0);
    assert.equal(
      (
        await call(
          client,
          `/v1/institution/programs`,
          operation("save", {
            view: "trainee",
            id: pid,
            title: "Not authorized",
            draft: draft(),
            revision: r.data.plan.draft_version,
          }),
        )
      ).status,
      403,
    );
    let roster = (await call(trainer, `/v1/institution/delivery?view=trainer`))
      .data;
    const assign = operation("assign", {
      view: "trainer",
      version_id: version.id,
      start_date: new Date().toISOString().slice(0, 10),
      schedule_mode: "flexible",
      members: roster.members.map((m: any) => ({
        id: m.id,
        revision: m.revision,
        assignment_id: null,
        assignment_revision: null,
      })),
    });
    r = await call(trainer, `/v1/institution/delivery`, assign);
    assert.equal(r.status, 200, JSON.stringify(r));
    const assignment = r.data[0];
    const assignedProgram = await call(
      client,
      `/v1/institution/programs?view=trainee&program=${pid}`,
    );
    assert.equal(assignedProgram.status, 200, JSON.stringify(assignedProgram));
    assert.equal(assignedProgram.data.editable, false);
    assert.deepEqual(assignedProgram.data.catalog, []);
    const sessionId = randomUUID(),
      start = operation("start", {
        view: "trainee",
        id: sessionId,
        assignment_id: assignment.id,
        day_id: version.prescription.days[0].id,
      });
    r = await call(client, `/v1/institution/sessions`, start);
    assert.equal(r.status, 200, JSON.stringify(r));
    const session = r.data;
    const entries = session.entries.map((e: any, i: number) => ({
      ...e,
      completed: i === 0,
      reps: 8,
    }));
    const save = operation("save", {
      view: "trainee",
      id: sessionId,
      revision: 1,
      entries,
      note: "First session",
      complete: true,
    });
    r = await call(client, `/v1/institution/sessions`, save);
    assert.equal(r.status, 200, JSON.stringify(r));
    const completed = r.data.completed_at;
    assert.deepEqual(
      (await call(client, `/v1/institution/sessions`, save)).data,
      r.data,
    );
    assert.equal(
      (
        await call(foreign, `/v1/institution/sessions`, {
          ...save,
          operation: randomUUID(),
        })
      ).status,
      403,
    );
    const previousEmpty = await call(
      client,
      `/v1/workouts/${sessionId}/previous`,
    );
    assert.equal(previousEmpty.status, 200, JSON.stringify(previousEmpty));
    assert.deepEqual(previousEmpty.data, []);
    // A previous completed occurrence must supply actuals, never targets or another member's work.
    const historicalId = randomUUID();
    await db.institution_sessions.create({
      data: {
        id: historicalId,
        institution_id: id,
        member_id: trainee.id,
        assignment_id: assignment.id,
        day_id: session.day_id,
        local_date: new Date("2026-01-01"),
        started_at: new Date("2026-01-01T08:00:00Z"),
        completed_at: new Date("2026-01-01T09:00:00Z"),
        document: {
          ...session,
          id: historicalId,
          entries,
          status: "completed",
        },
        version: 2,
      },
    });
    const previous = await call(client, `/v1/workouts/${sessionId}/previous`);
    assert.equal(previous.status, 200, JSON.stringify(previous));
    assert.equal(previous.data.length, 1);
    assert.equal(previous.data[0].entries[0].reps, 8);
    await db.institution_sessions.delete({ where: { id: historicalId } });
    const changed = draft();
    changed.days[0].exercises[0].reps = 15;
    r = await call(
      trainer,
      `/v1/institution/programs`,
      operation("publish", {
        ...publish,
        operation: randomUUID(),
        draft: changed,
        revision: 1,
      }),
    );
    assert.equal(r.status, 200, JSON.stringify(r));
    assert.equal(
      (await call(client, `/v1/workouts/${sessionId}`)).data.prescription
        .exercises[0].reps,
      session.prescription.exercises[0].reps,
    );
    const member = await db.institution_members.findUniqueOrThrow({
      where: { id: trainee.id },
    });
    assert.equal(
      (
        await call(
          admin,
          `/v1/institution`,
          operation("assign-trainer", {
            id: member.id,
            revision: member.revision,
            trainer: next.id,
          }),
        )
      ).status,
      200,
    );
    assert.equal(
      (await call(trainer, `/v1/institution/delivery`, assign)).status,
      403,
      "replay rechecks recipient responsibility",
    );
    assert.equal(
      (await call(trainer, `/v1/workouts/${sessionId}?view=trainer`)).status,
      403,
    );
    assert.equal(
      (await call(replacement, `/v1/workouts/${sessionId}?view=trainer`))
        .status,
      200,
    );
    r = await call(
      replacement,
      `/v1/institution/sessions`,
      operation("review", {
        view: "trainer",
        id: sessionId,
        revision: 2,
        note: "Keep the same load.",
      }),
    );
    assert.equal(r.status, 200, JSON.stringify(r));
    r = await call(
      client,
      `/v1/institution/sessions`,
      operation("save", {
        view: "trainee",
        id: sessionId,
        revision: 3,
        entries,
        note: "Corrected note",
        complete: true,
      }),
    );
    assert.equal(r.status, 200, JSON.stringify(r));
    assert.equal(r.data.completed_at, completed);
    assert.equal(r.data.reviewed_at, null);
    assert.equal(
      await db.institution_sessions.count({ where: { institution_id: id } }),
      1,
    );
  } finally {
    await f.cleanup();
  }
});
test("bulk delivery is atomic; internal catalog never grants edit or personal exercise access", async () => {
  const f = await organizationFixture();
  try {
    const admin = await f.person(),
      trainer = await f.person(),
      client = await f.person(),
      other = await f.person(),
      id = await f.create(admin),
      foreign = await f.create(other);
    await f.join(admin, id, trainer, ["trainer"]);
    const trainee = await f.join(admin, id, client, ["trainee"]),
      outsider = await f.join(other, foreign, client, ["trainee"]);
    const p = operation("publish", {
      view: "admin",
      id: randomUUID(),
      title: "Internal program",
      draft: draft(),
      revision: null,
    });
    const published = await call(admin, `/v1/institution/programs`, p);
    assert.equal(published.status, 200, JSON.stringify(published));
    assert.equal(published.data.plan.listed, true);
    const recipients = [trainee, outsider].map((m) => ({
      id: m.id,
      revision: m.revision,
    }));
    const bad = await call(
      admin,
      `/v1/institution/delivery`,
      operation("assign", {
        view: "admin",
        version_id: published.data.version.id,
        start_date: "2026-09-23",
        schedule_mode: "flexible",
        members: recipients,
      }),
    );
    assert.equal(bad.status, 403);
    assert.equal(
      await db.institution_assignments.count({ where: { institution_id: id } }),
      0,
    );
    assert.equal(
      (
        await call(
          client,
          `/v1/institution/programs?view=trainee&program=${p.id}`,
        )
      ).status,
      403,
    );
    assert.equal(
      (await call(client, `/v1/institution/catalog?view=trainee`)).status,
      403,
    );
    assert.equal(
      (
        await call(trainer, `/v1/institution/programs`, {
          ...p,
          operation: randomUUID(),
          view: "trainer",
          revision: 1,
        })
      ).status,
      403,
    );
    const catalog = await call(trainer, `/v1/institution/catalog?view=trainer`);
    assert.equal(catalog.status, 200);
    assert.ok(catalog.data.every((x: any) => !x.owner_id));
    assert.ok(
      catalog.data.length > 500,
      "organization catalog returns the full shared catalog in one authorized response",
    );
    assert.equal(
      catalog.data.filter((x: any) => String(x.id).startsWith("dataset-"))
        .length,
      1324,
    );
    assert.equal(
      catalog.data.filter((x: any) => String(x.id).startsWith("wger-")).length,
      46,
    );
    assert.ok(
      catalog.data
        .filter((x: any) => /^(dataset|wger)-/.test(x.id))
        .every((x: any) => x.category && x.body_part && x.target_muscle),
    );
    const customId = `org-${randomUUID()}`;
    const custom = await call(
      trainer,
      `/v1/institution/catalog`,
      operation("exercise", {
        view: "trainer",
        id: customId,
        revision: 0,
        data: {
          name: "Faceted organization exercise",
          name_ar: "",
          instructions: "Move with control.",
          instructions_ar: "",
          equipment: "",
          equipment_ar: "",
          movement: "push",
          kind: "strength",
          media_url: "",
          media_ref: "",
          category: "chest",
          body_part: "chest",
          target_muscle: "pectorals",
        },
      }),
    );
    assert.equal(custom.status, 200, JSON.stringify(custom));
    assert.deepEqual(
      custom.data.data.category && [
        custom.data.data.category,
        custom.data.data.body_part,
        custom.data.data.target_muscle,
      ],
      ["chest", "chest", "pectorals"],
    );
    const invalidFacet = await call(
      trainer,
      `/v1/institution/catalog`,
      operation("exercise", {
        view: "trainer",
        id: `org-${randomUUID()}`,
        revision: 0,
        data: {
          name: "Invalid",
          instructions: "Move with control.",
          kind: "strength",
          category: "unbounded",
        },
      }),
    );
    assert.equal(invalidFacet.status, 400);
    const licensedDraft = draft();
    licensedDraft.days[0].exercises[0].exerciseId = "dataset-0001";
    const licensedProgram = await call(
      admin,
      `/v1/institution/programs`,
      operation("publish", {
        view: "admin",
        id: randomUUID(),
        title: "Licensed source snapshot",
        draft: licensedDraft,
        revision: null,
      }),
    );
    assert.equal(licensedProgram.status, 200, JSON.stringify(licensedProgram));
    assert.equal(
      licensedProgram.data.version.prescription.days[0].exercises[0].info
        .source_ref,
      "dataset-0001",
    );
    const invalid = draft();
    invalid.days[0].exercises[0].sets = 50;
    assert.equal(
      (
        await call(admin, `/v1/institution/programs`, {
          ...p,
          id: randomUUID(),
          operation: randomUUID(),
          draft: invalid,
        })
      ).status,
      400,
    );
  } finally {
    await f.cleanup();
  }
});
