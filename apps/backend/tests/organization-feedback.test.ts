import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { db } from "../server/db.ts";
import {
  organizationFixture,
  call,
  operation,
} from "./organization-fixture.ts";
import { institutionAccountData } from "../server/account-data.ts";
after(() => db.$disconnect());
const ok = (r: any) => {
  assert.equal(r.status, 200, JSON.stringify(r));
  return r.data;
};
test("explicit session and workplace feedback stay separate, scoped and retry-safe", async () => {
  const f = await organizationFixture();
  try {
    const admin = await f.person(),
      trainer = await f.person(),
      client = await f.person(),
      peer = await f.person(),
      institution = await f.create(admin),
      staff = await f.join(admin, institution, trainer, ["trainer"]),
      member = await f.join(admin, institution, client, ["trainee"]);
    await f.join(admin, institution, peer, ["trainer"]);
    ok(
      await call(
        admin,
        `/v1/institution`,
        operation("assign-trainer", {
          id: member.id,
          revision: 1,
          trainer: staff.id,
        }),
      ),
    );
    const endpoint = `/v1/institution/feedback`,
      calendar = `/v1/institution/calendar`,
      day = new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      today = new Date().toISOString().slice(0, 10),
      month = today.slice(0, 7) + "-01";
    assert.equal(
      (await call(admin, `/v1/institution/packages`, {})).status,
      404,
      "retired session package API is not exposed",
    );
    const e = ok(
      await call(
        trainer,
        calendar,
        operation("create", {
          view: "trainer",
          id: randomUUID(),
          kind: "training",
          title: "Strength session",
          staff: [staff.id],
          participants: [member.id],
          local: day + "T10:00",
          zone: "UTC",
          minutes: 60,
          count: 1,
          every: 7,
        }),
      ),
    )[0];
    const input = operation("save", {
      view: "trainee",
      source: "calendar",
      id: e.id,
      score: 5,
      revision: 0,
    });
    assert.equal((await call(client, endpoint, input)).status, 403);
    await db.institution_events.update({
      where: { id: e.id },
      data: {
        starts_at: new Date(Date.now() - 7200000),
        ends_at: new Date(Date.now() - 3600000),
      },
    });
    ok(
      await call(
        trainer,
        calendar,
        operation("attendance", {
          view: "trainer",
          id: e.id,
          member: member.id,
          revision: 1,
          attendance: "present",
        }),
      ),
    );
    ok(
      await call(
        trainer,
        calendar,
        operation("finish", { view: "trainer", id: e.id, revision: 1 }),
      ),
    );
    const list = ok(await call(client, endpoint + "?view=trainee"));
    assert.equal(
      list.items[0].score,
      null,
      "missing feedback is not a neutral response",
    );
    assert.equal(list.items[0].revision, 0);
    ok(await call(client, endpoint, input));
    ok(await call(client, endpoint, input));
    assert.equal(
      (
        await call(client, endpoint, {
          ...input,
          operation: randomUUID(),
          score: 2,
        })
      ).status,
      409,
    );
    assert.equal((await call(admin, endpoint, input)).status, 403);
    assert.equal(
      (await call(trainer, endpoint, { ...input, view: "trainer" })).status,
      403,
    );
    ok(
      await call(client, endpoint, {
        ...input,
        operation: randomUUID(),
        revision: 1,
        score: 4,
      }),
    );
    const workplace = operation("save", {
      view: "trainer",
      source: "workplace",
      month,
      score: 2,
      revision: 0,
    });
    ok(await call(trainer, endpoint, workplace));
    ok(await call(trainer, endpoint, workplace));
    assert.equal(
      (await call(client, endpoint, { ...workplace, view: "trainee" })).status,
      403,
    );
    assert.equal(
      (
        await call(trainer, endpoint, {
          ...workplace,
          operation: randomUUID(),
          month: "2000-01-01",
        })
      ).status,
      409,
    );
    assert.equal(ok(await call(peer, endpoint + "?view=trainer")).own, null);
    const analytics = (person: any, view: string) =>
      call(
        person,
        `/v1/institution/analytics?view=${view}&from=${month}&to=${today}`,
      );
    const report = ok(await analytics(admin, "admin")).experience;
    const performance = ok(await analytics(admin, "admin")).performance;
    assert.equal(
      performance.find((x: any) => x.id === staff.id).completed_sessions,
      1,
    );
    assert.equal(performance.find((x: any) => x.id === staff.id).present, 1);
    assert.equal(ok(await analytics(trainer, "trainer")).performance.length, 0);

    assert.deepEqual(report.client, [
      { source: "calendar", score: 4, value: 1 },
    ]);
    assert.equal(report.workplace.find((x: any) => x.score === 2).value, 1);
    assert.equal(report.workplace.find((x: any) => x.score === null).value, 1);
    assert.equal(
      ok(await analytics(trainer, "trainer")).experience.workplace,
      null,
    );
    assert.deepEqual(
      ok(await analytics(peer, "trainer")).experience.client,
      [],
    );
    const plan = JSON.parse(
      readFileSync(new URL("../content/starter.json", import.meta.url), "utf8"),
    ).prescription;
    const published = ok(
      await call(
        trainer,
        `/v1/institution/programs`,
        operation("publish", {
          view: "trainer",
          id: randomUUID(),
          title: "Feedback source",
          draft: plan,
          revision: null,
        }),
      ),
    );
    const delivery = ok(
      await call(
        trainer,
        `/v1/institution/delivery`,
        operation("assign", {
          view: "trainer",
          version_id: published.version.id,
          start_date: today,
          schedule_mode: "flexible",
          members: [{ id: member.id, revision: 2 }],
        }),
      ),
    );
    const session = randomUUID(),
      started = ok(
        await call(
          client,
          `/v1/institution/sessions`,
          operation("start", {
            view: "trainee",
            id: session,
            assignment_id: delivery[0].id,
            day_id: plan.days[0].id,
          }),
        ),
      );
    const workoutInput = operation("save", {
      view: "trainee",
      source: "workout",
      id: session,
      score: 3,
      revision: 0,
    });
    assert.equal((await call(client, endpoint, workoutInput)).status, 403);
    ok(
      await call(
        client,
        `/v1/institution/sessions`,
        operation("save", {
          view: "trainee",
          id: session,
          revision: 1,
          entries: started.entries.map((e: any) => ({ ...e, completed: true })),
          note: "",
          complete: true,
        }),
      ),
    );
    ok(await call(client, endpoint, workoutInput));
    assert.equal(
      ok(await analytics(admin, "admin")).experience.client.find(
        (x: any) => x.source === "workout",
      ).score,
      3,
    );
    const exported = await institutionAccountData({ id: client.id } as any);
    assert.equal((exported.sessionFeedback as any[]).length, 2);
    assert.equal((exported.workplaceFeedback as any[]).length, 0);
    // Attendance corrections exclude an ineligible source; no phantom neutral replacement.
    ok(
      await call(
        trainer,
        calendar,
        operation("attendance", {
          view: "trainer",
          id: e.id,
          member: member.id,
          revision: 2,
          attendance: "excused",
        }),
      ),
    );
    assert.deepEqual(ok(await analytics(admin, "admin")).experience.client, [
      { source: "workout", score: 3, value: 1 },
    ]);
    assert.equal(
      (await call(client, endpoint, input)).status,
      403,
      "eligibility checked before exact retry",
    );
    ok(
      await call(
        admin,
        `/v1/institution`,
        operation("member", {
          id: staff.id,
          revision: staff.revision,
          active: false,
          roles: ["trainer"],
        }),
      ),
    );
    assert.equal(
      (await call(trainer, endpoint, workplace)).status,
      403,
      "revoked membership precedes receipt",
    );
  } finally {
    await f.cleanup();
  }
});
