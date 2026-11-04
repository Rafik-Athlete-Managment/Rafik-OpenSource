import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../server/db.ts";
import { purgeExpiredInjuryRecords } from "../server/injury-retention.ts";
import {
  organizationFixture,
  call,
  operation,
} from "./organization-fixture.ts";

after(() => db.$disconnect());

test("injury status is consent-gated, athlete-owned, limited for assigned coaches and expires after closure", async () => {
  const f = await organizationFixture();
  try {
    const admin = await f.person(),
      trainer = await f.person(),
      replacement = await f.person(),
      athlete = await f.person(),
      stranger = await f.person(),
      foreignAdmin = await f.person(),
      institution = await f.create(admin),
      foreignWorkspace = await f.create(foreignAdmin),
      coachMember = await f.join(admin, institution, trainer, ["trainer"]),
      replacementMember = await f.join(admin, institution, replacement, [
        "trainer",
      ]),
      athleteMember = await f.join(admin, institution, athlete, ["trainee"]);
    await f.join(admin, institution, stranger, ["trainer"]);
    await f.join(foreignAdmin, foreignWorkspace, athlete, ["trainee"]);
    assert.equal(
      (
        await call(
          admin,
          `/v1/institution`,
          operation("assign-trainer", {
            id: athleteMember.id,
            revision: 1,
            trainer: coachMember.id,
          }),
        )
      ).status,
      200,
    );
    const endpoint = `/v1/institution/injuries`;

    // Admin can verify consent prerequisites, but receives no injury values.
    let r = await call(admin, endpoint + "?view=admin");
    assert.equal(r.status, 200, JSON.stringify(r));
    assert.equal("items" in r.data, false);
    assert.equal(
      (
        await call(admin, endpoint, {
          action: "configure",
          view: "admin",
          member_id: athleteMember.id,
          age_group: "minor",
          guardian_authorized: false,
          revision: 0,
        })
      ).status,
      400,
    );
    r = await call(admin, endpoint, {
      action: "configure",
      view: "admin",
      member_id: athleteMember.id,
      age_group: "minor",
      guardian_authorized: true,
      revision: 0,
    });
    assert.equal(r.status, 200, JSON.stringify(r));

    const report = (id: string, status = "modified", revision = 0) =>
      operation("report", {
        view: "trainee",
        id,
        participation: status,
        effective_from: "2026-10-01",
        revision,
      });
    assert.equal(
      (
        await call(athlete, endpoint, {
          ...report(randomUUID()),
          operation: randomUUID(),
        })
      ).status,
      403,
      "guardian confirmation alone does not replace athlete assent",
    );
    assert.equal(
      (
        await call(athlete, endpoint, {
          action: "assent",
          view: "trainee",
        })
      ).status,
      200,
    );

    const id = randomUUID(),
      create = report(id);
    r = await call(athlete, endpoint, create);
    assert.equal(r.status, 200, JSON.stringify(r));
    assert.equal(r.data.revision, 1);
    assert.equal((await call(athlete, endpoint, create)).data.replayed, true);
    assert.equal(
      (
        await call(athlete, endpoint, {
          ...create,
          participation: "unavailable",
        })
      ).status,
      409,
      "operation IDs cannot be reused for changed health values",
    );

    r = await call(trainer, endpoint + "?view=trainer");
    assert.equal(r.status, 200, JSON.stringify(r));
    assert.equal(r.data.items.length, 1);
    assert.deepEqual(Object.keys(r.data.items[0]).sort(), [
      "athlete_member_id",
      "athlete_name",
      "effective_from",
      "id",
      "participation",
    ]);
    assert.equal(r.data.items[0].participation, "modified");
    assert.equal(
      (await call(stranger, endpoint + "?view=trainer")).data.items.length,
      0,
    );
    r = await call(admin, endpoint + "?view=admin");
    assert.equal("participation" in r.data.members[0], false);
    assert.equal("records" in r.data, false);
    assert.equal(
      (await call(foreignAdmin, `/v1/institution/injuries?view=trainee`))
        .status,
      403,
      "a nonmember cannot read injury records",
    );
    assert.equal(
      (
        await call(
          trainer,
          endpoint,
          operation("report", {
            view: "trainer",
            id: randomUUID(),
            participation: "unavailable",
            effective_from: "2026-10-02",
            revision: 0,
          }),
        )
      ).status,
      403,
      "coaches cannot create or change athlete health entries",
    );

    const correction = operation("correct", {
      view: "trainee",
      id,
      participation: "unavailable",
      effective_from: "2026-10-02",
      revision: 1,
    });
    r = await call(athlete, endpoint, correction);
    assert.equal(r.status, 200, JSON.stringify(r));
    assert.equal(r.data.revision, 2);
    const own = await call(athlete, endpoint + "?view=trainee");
    assert.equal(own.data.items[0].history.length, 2);
    const exported = await call(
      athlete,
      endpoint + "?view=trainee&export=true",
    );
    assert.equal(exported.status, 200);
    assert.equal(exported.data.items[0].history.length, 2);
    assert.equal(
      await db.institution_injury_access_log.count({
        where: {
          record_id: id,
          action: "athlete_export",
          actor_id: athlete.id,
        },
      }),
      1,
    );
    assert.equal(
      (await call(trainer, endpoint + "?view=trainee&export=true")).status,
      403,
    );
    assert.equal(
      (await call(stranger, endpoint + "?view=trainer")).data.items.length,
      0,
    );

    await call(
      admin,
      `/v1/institution`,
      operation("assign-trainer", {
        id: athleteMember.id,
        revision: 2,
        trainer: replacementMember.id,
      }),
    );
    assert.equal(
      (await call(trainer, endpoint + "?view=trainer")).data.items.length,
      0,
    );
    assert.equal(
      (await call(replacement, endpoint + "?view=trainer")).data.items.length,
      1,
    );

    // Withdrawal closes the current status and removes it from the coach view.
    r = await call(athlete, endpoint, {
      action: "withdraw",
      view: "trainee",
    });
    assert.equal(r.status, 200, JSON.stringify(r));
    assert.equal(
      (await call(replacement, endpoint + "?view=trainer")).data.items.length,
      0,
    );
    assert.equal(
      (await call(athlete, endpoint + "?view=trainee")).data.items[0].state,
      "closed",
    );

    const before = await db.institution_injury_history.count({
      where: { record_id: id },
    });
    await db.institution_injury_records.update({
      where: { id },
      data: { closed_at: new Date(Date.now() - 366 * 86400000) },
    });
    const result = await purgeExpiredInjuryRecords([institution]);
    assert.equal(result.expired, 1);
    assert.ok(before >= 3);
    assert.equal(
      await db.institution_injury_records.count({ where: { id } }),
      0,
    );
    assert.equal(
      await db.institution_injury_history.count({ where: { record_id: id } }),
      0,
    );
    assert.equal(
      await db.institution_injury_access_log.count({
        where: { record_id: id },
      }),
      0,
    );
    assert.equal(
      await db.institution_injury_operations.count({
        where: { record_id: id },
      }),
      0,
    );
    const checkpoint = await db.$queryRaw<
      { completed_at: Date; closed_count: number; purged_count: number }[]
    >`SELECT completed_at,closed_count,purged_count FROM public.institution_injury_retention_checkpoint WHERE singleton`;
    assert.equal(checkpoint.length, 1);
    assert.ok(checkpoint[0].completed_at instanceof Date);
    assert.equal(checkpoint[0].purged_count, 1);
    assert.deepEqual(Object.keys(checkpoint[0]).sort(), [
      "closed_count",
      "completed_at",
      "purged_count",
    ]);
  } finally {
    await f.cleanup();
  }
});
