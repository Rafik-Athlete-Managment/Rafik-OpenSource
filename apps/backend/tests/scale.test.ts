import { testDatabase } from "./test-target.ts";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { db } from "../server/db.ts";
import {
  organizationFixture,
  call,
  dockerCompose,
} from "./organization-fixture.ts";
after(() => db.$disconnect());
test("large organization reads page actual scope without truncating search or aggregate totals", async () => {
  const f = await organizationFixture();
  try {
    const admin = await f.person(),
      outsider = await f.person(),
      id = await f.create(admin),
      trainers = Array.from({ length: 120 }, (_, i) => ({
        id: randomUUID(),
        institution_id: id,
        name: `Trainer ${String(i).padStart(4, "0")}`,
        roles: ["trainer"],
      }));
    await db.institution_members.createMany({ data: trainers });
    const trainees = Array.from({ length: 1200 }, (_, i) => ({
      id: randomUUID(),
      institution_id: id,
      name: `Trainee ${String(i).padStart(4, "0")}`,
      roles: ["trainee"],
      trainer_id: trainers[i % trainers.length].id,
    }));
    await db.institution_members.createMany({ data: trainees });
    const measurements: any[] = [];
    async function measured(path: string) {
      const start = performance.now(),
        r = await call(admin, path);
      assert.equal(r.status, 200, JSON.stringify(r));
      measurements.push({
        path: path.replace(id, ":institution"),
        durationMs: Math.round((performance.now() - start) * 100) / 100,
        payloadBytes: Buffer.byteLength(JSON.stringify(r.data)),
      });
      return r.data;
    }
    const context = await measured(`/v1/institution?view=admin&summary=true`);
    assert.equal(context.members.length, 0);
    assert.equal(context.summary.trainees, 1200);
    assert.equal(context.summary.trainers, 120);
    const first = await measured(
      `/v1/institution/people?view=admin&role=trainee`,
    );
    assert.equal(first.items.length, 25);
    assert.equal(first.total, 1200);
    assert.equal(first.next, 25);
    const second = await measured(
      `/v1/institution/people?view=admin&role=trainee&offset=25`,
    );
    assert.equal(second.items.length, 25);
    assert.ok(
      !second.items.some((m: any) =>
        first.items.some((x: any) => x.id === m.id),
      ),
    );
    const last = await measured(
      `/v1/institution/people?view=admin&search=1199&selected=${trainees[0].id}`,
    );
    assert.equal(last.items[0].name, "Trainee 1199");
    assert.equal(last.selected[0].id, trainees[0].id);
    const recipients = await measured(
      `/v1/institution/recipients?view=admin&search=1199&selected=${trainees[0].id}`,
    );
    assert.equal(recipients.items.length, 1);
    assert.equal(recipients.selected.length, 1);
    const history = await measured(
      `/v1/institution/delivery?view=admin&history=true`,
    );
    assert.equal(history.members.length, 0);
    assert.equal(history.assignments.length, 0);
    let offset: number | null = 0;
    const all = new Set<string>();
    while (offset !== null) {
      const report = await measured(
        `/v1/institution/analytics?view=admin&from=2026-09-01&to=2026-09-30&workloadOffset=${offset}`,
      );
      assert.equal(report.summary.active, 1200);
      report.workload.forEach((m: any) => {
        assert.equal(m.value, 10);
        assert.ok(!all.has(m.id));
        all.add(m.id);
      });
      offset = report.workloadNext;
    }
    assert.equal(all.size, 120);
    assert.equal(
      (await call(outsider, `/v1/institution/people?view=admin`)).status,
      403,
    );
    await db.institution_invitations.createMany({
      data: Array.from({ length: 31 }, (_, i) => ({
        id: randomUUID(),
        institution_id: id,
        email: `scale-${i}@rafik.test`,
        roles: ["trainee"],
        token_hash: randomUUID().replaceAll("-", "").repeat(2),
      })),
    });
    await db.institution_audit_events.createMany({
      data: Array.from({ length: 35 }, () => ({
        institution_id: id,
        kind: "renamed",
      })),
    });
    const extra = await measured(`/v1/institution?view=admin&summary=true`);
    assert.equal(extra.invitations.length, 25);
    assert.equal(extra.invitationsNext, 25);
    assert.equal(extra.events.length, 30);
    assert.equal(extra.eventsNext, 30);
    const extraPage = await measured(
      `/v1/institution?view=admin&summary=true&invitationOffset=25&eventOffset=30`,
    );
    assert.equal(extraPage.invitations.length, 6);
    assert.equal(extraPage.invitationsNext, null);
    assert.ok(extraPage.events.length >= 5);
    assert.equal(extraPage.eventsNext, null);
    assert.ok(
      !extraPage.events.some((x: any) =>
        extra.events.some((y: any) => y.id === x.id),
      ),
    );
    const explain = dockerCompose(
      [
        "exec",
        "-T",
        "db",
        "psql",
        "-U",
        "rafik_migrate",
        "-d",
        testDatabase,
        "-Atc",
        `EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT id,name FROM public.institution_members WHERE institution_id='${id}' AND active ORDER BY name,id LIMIT 25`,
      ],
      { encoding: "utf8" },
    );
    mkdirSync("artifacts/scale", { recursive: true });
    writeFileSync(
      "artifacts/scale/r11.json",
      JSON.stringify(
        {
          fixture: { trainers: 120, trainees: 1200 },
          environment:
            "local PostgreSQL17, Node22, unthrottled loopback; not a production budget",
          measurements,
          queryPlan: JSON.parse(String(explain)),
        },
        null,
        2,
      ),
    );
    assert.ok(
      measurements.every((m) => m.payloadBytes < 50000),
      "bounded pages remain under 50 KB for this fixture",
    );
  } finally {
    await f.cleanup();
  }
});
