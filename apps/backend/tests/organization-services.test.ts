import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../server/db.ts";
import {
  organizationFixture,
  call,
  operation,
} from "./organization-fixture.ts";
after(() => db.$disconnect());
const tomorrow = () =>
  new Date(Date.now() + 86400000).toISOString().slice(0, 10) + "T10:00";
const field = () => ({
  key: randomUUID(),
  name: "Controlled repetitions",
  kind: "number",
  unit: "reps",
  min: 0,
  max: 100,
});
test("organization agenda and assessor-led results preserve each participant, corrections and scoped analytics", async () => {
  const f = await organizationFixture();
  try {
    const admin = await f.person(),
      trainer = await f.person(),
      one = await f.person(),
      two = await f.person(),
      outsider = await f.person();
    const id = await f.create(admin);
    await f.create(outsider);
    const staff = await f.join(admin, id, trainer, ["trainer"]),
      a = await f.join(admin, id, one, ["trainee"]),
      b = await f.join(admin, id, two, ["trainee"]);
    await call(
      admin,
      `/v1/institution`,
      operation("assign-trainer", { id: a.id, revision: 1, trainer: staff.id }),
    );
    const drill = field(),
      template = operation("template", {
        view: "admin",
        id: randomUUID(),
        title: "Movement baseline",
        definition: [drill],
        revision: 0,
        archived: false,
      });
    let r = await call(admin, `/v1/institution/services`, template);
    assert.equal(r.status, 200, JSON.stringify(r));
    const group = operation("group", {
      view: "admin",
      id: randomUUID(),
      name: "Morning group",
      members: [a.id, b.id, staff.id],
      revision: 0,
      archived: false,
    });
    assert.equal(
      (await call(admin, `/v1/institution/services`, group)).status,
      200,
    );
    const assignedGroups = await call(
      trainer,
      `/v1/institution/services?view=trainer&kind=groups`,
    );
    assert.equal(assignedGroups.status, 200, JSON.stringify(assignedGroups));
    assert.equal(
      assignedGroups.data.items.find(
        (item: { id: string }) => item.id === group.id,
      )?.canEdit,
      false,
    );
    const pendingGroups = await call(
      trainer,
      `/v1/institution/communication?view=trainer`,
    );
    assert.ok(
      pendingGroups.data.groups.some(
        (item: { id: string }) => item.id === group.id,
      ),
    );
    const groupChat = await call(
      trainer,
      `/v1/institution/communication`,
      operation("open-group", { id: group.id, view: "trainer" }),
    );
    assert.equal(groupChat.status, 200, JSON.stringify(groupChat));
    const openedGroups = await call(
      trainer,
      `/v1/institution/communication?view=trainer`,
    );
    assert.ok(
      !openedGroups.data.groups.some(
        (item: { id: string }) => item.id === group.id,
      ),
    );
    const create = operation("create", {
      id: randomUUID(),
      view: "admin",
      title: "Baseline assessment",
      kind: "assessment",
      template: template.id,
      template_revision: 1,
      staff: [staff.id],
      participants: [a.id, b.id],
      local: tomorrow(),
      zone: "UTC",
      minutes: 60,
      count: 2,
      every: 7,
      location: "Training studio",
    });
    r = await call(admin, `/v1/institution/calendar`, create);
    assert.equal(r.status, 200, JSON.stringify(r));
    assert.equal(r.data.length, 2);
    assert.deepEqual(
      (await call(admin, `/v1/institution/calendar`, create)).data,
      r.data,
    );
    const event = r.data[0],
      future = r.data[1];
    const edited = await call(admin, `/v1/institution/services`, {
      ...template,
      operation: randomUUID(),
      revision: 1,
      definition: [{ ...drill, unit: "changed", max: 999 }],
    });
    assert.equal(edited.status, 200);
    assert.equal(
      (
        await call(
          trainer,
          `/v1/institution/calendar?view=trainer&id=${event.id}`,
        )
      ).data.event.definition[0].unit,
      "reps",
    );
    assert.equal(
      (
        await call(
          outsider,
          `/v1/institution/calendar?view=admin&id=${event.id}`,
        )
      ).status,
      403,
    );
    const personal = await call(
      one,
      `/v1/institution/calendar?view=trainee&id=${event.id}`,
    );
    assert.equal(
      personal.data.people.filter((x: any) => x.duty === "trainee").length,
      1,
    );
    const early = operation("attendance", {
      id: event.id,
      view: "trainer",
      member: a.id,
      revision: 1,
      attendance: "present",
    });
    assert.equal(
      (await call(trainer, `/v1/institution/calendar`, early)).status,
      400,
    );
    // Move only this test-owned event into the past to exercise attendance/results without waiting a day.
    await db.institution_events.update({
      where: { id: event.id },
      data: {
        starts_at: new Date(Date.now() - 7200000),
        ends_at: new Date(Date.now() - 3600000),
      },
    });
    for (const member of [a, b])
      assert.equal(
        (
          await call(
            trainer,
            `/v1/institution/calendar`,
            operation("attendance", {
              id: event.id,
              view: "trainer",
              member: member.id,
              revision: 1,
              attendance: "present",
            }),
          )
        ).status,
        200,
      );
    const result = operation("result", {
      id: event.id,
      view: "trainer",
      member: a.id,
      revision: 0,
      values: { [drill.key]: 12 },
      note: "Steady pace",
    });
    r = await call(trainer, `/v1/institution/calendar`, result);
    assert.equal(r.status, 200, JSON.stringify(r));
    assert.deepEqual(
      (await call(trainer, `/v1/institution/calendar`, result)).data,
      r.data,
    );
    assert.equal(
      (
        await call(
          trainer,
          `/v1/institution/calendar`,
          operation("finish", { id: event.id, view: "trainer", revision: 1 }),
        )
      ).status,
      400,
      "all present trainees require results",
    );
    assert.equal(
      (
        await call(
          trainer,
          `/v1/institution/calendar`,
          operation("result", {
            id: event.id,
            view: "trainer",
            member: b.id,
            revision: 0,
            values: { [drill.key]: 19 },
            note: "",
          }),
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await call(
          trainer,
          `/v1/institution/calendar`,
          operation("finish", { id: event.id, view: "trainer", revision: 1 }),
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await call(trainer, `/v1/institution/calendar`, {
          ...result,
          operation: randomUUID(),
          revision: 1,
          values: { [drill.key]: 14 },
        })
      ).status,
      200,
    );
    const detail = await call(
      admin,
      `/v1/institution/calendar?view=admin&id=${event.id}`,
    );
    assert.equal(detail.data.history.length, 3);
    assert.equal(
      detail.data.results.find((x: any) => x.member_id === b.id).values[
        drill.key
      ],
      19,
    );
    // A long correction trail is paged per authorized participant, not downloaded with the event.
    for (let revision = 2; revision < 29; revision++) {
      const correction = await call(trainer, `/v1/institution/calendar`, {
        ...result,
        operation: randomUUID(),
        revision,
        values: { [drill.key]: 14 },
        note: `Correction ${revision}`,
      });
      assert.equal(correction.status, 200, JSON.stringify(correction));
    }
    const summary = await call(
      admin,
      `/v1/institution/calendar?view=admin&id=${event.id}&summary=true`,
    );
    assert.equal(summary.data.history.length, 0);
    const historyPath = `/v1/institution/calendar?view=trainee&id=${event.id}&historyMember=${a.id}`;
    const firstHistory = await call(one, historyPath);
    assert.equal(firstHistory.data.history.length, 25);
    assert.equal(firstHistory.data.historyNext, 25);
    const olderHistory = await call(one, historyPath + "&historyOffset=25");
    assert.equal(olderHistory.data.history.length, 4);
    assert.equal(olderHistory.data.historyNext, null);
    assert.ok(
      !olderHistory.data.history.some((row: any) =>
        firstHistory.data.history.some((old: any) => row.id === old.id),
      ),
    );
    assert.equal((await call(two, historyPath)).status, 403);
    // The event above started two hours ago; between 00:00 and 02:00 UTC that
    // is yesterday, so the range starts on the event's own date.
    const today = new Date().toISOString().slice(0, 10),
      eventDay = new Date(Date.now() - 7200000).toISOString().slice(0, 10),
      params = `from=${eventDay}&to=${today}`;
    const adminReport = await call(
        admin,
        `/v1/institution/analytics?view=admin&${params}`,
      ),
      trainerReport = await call(
        trainer,
        `/v1/institution/analytics?view=trainer&${params}`,
      );
    assert.equal(adminReport.status, 200, JSON.stringify(adminReport));
    assert.equal(trainerReport.status, 200, JSON.stringify(trainerReport));
    assert.equal(adminReport.data.summary.active, 2);
    assert.equal(trainerReport.data.summary.active, 1);
    assert.equal(adminReport.data.attendance[0].value, 2);
    assert.equal(trainerReport.data.attendance[0].value, 1);
    assert.equal(trainerReport.data.workload.length, 0);
    const history = await call(
      one,
      `/v1/institution/assessment-history?view=trainee&${params}`,
    );
    assert.equal(history.status, 200, JSON.stringify(history));
    assert.equal(history.data.items[0].values[drill.key], 14);
    assert.equal(
      (
        await call(
          one,
          `/v1/institution/assessment-history?view=trainee&member=${b.id}&${params}`,
        )
      ).status,
      403,
    );
    const exported = await call(one, "/v1/account/institution");
    assert.equal(exported.status, 200);
    assert.equal(exported.data.results.length, 1);
    assert.equal(exported.data.results[0].member_id, a.id);
    assert.equal(exported.data.corrections.length, 29);
    assert.equal(
      (
        await call(
          admin,
          `/v1/institution/calendar?view=admin&from=${today}&to=${today}&offset=1.5`,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await call(
          admin,
          `/v1/institution/analytics?view=admin&from=2026-02-30&to=2026-03-01`,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await call(
          admin,
          `/v1/institution/analytics?view=admin&member=invalid&${params}`,
        )
      ).status,
      400,
    );
    const replacement = await f.person(),
      replacementMember = await f.join(admin, id, replacement, ["trainer"]);
    const current = await db.institution_members.findUniqueOrThrow({
      where: { id: a.id },
    });
    assert.equal(
      (
        await call(
          admin,
          `/v1/institution`,
          operation("assign-trainer", {
            id: a.id,
            revision: current.revision,
            trainer: replacementMember.id,
          }),
        )
      ).status,
      200,
    );
    assert.equal(
      (await call(trainer, `/v1/institution/analytics?view=trainer&${params}`))
        .data.summary.active,
      0,
    );
    assert.equal(
      (
        await call(
          replacement,
          `/v1/institution/assessment-history?view=trainer&member=${a.id}&${params}`,
        )
      ).data.items[0].values[drill.key],
      14,
    );
    assert.equal(
      (
        await call(
          trainer,
          `/v1/institution/assessment-history?view=trainer&member=${a.id}&${params}`,
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await call(
          trainer,
          `/v1/institution/calendar?view=trainer&id=${event.id}`,
        )
      ).status,
      200,
      "explicit assessor retains only designated event access",
    );
    assert.equal(
      (
        await call(
          admin,
          `/v1/institution/calendar`,
          operation("cancel", { id: event.id, view: "admin", revision: 2 }),
        )
      ).status,
      400,
    );
    const reschedule = operation("reschedule", {
      id: future.id,
      view: "admin",
      revision: 1,
      local:
        new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10) +
        "T14:00",
      zone: "UTC",
      minutes: 45,
    });
    const moved = await call(admin, `/v1/institution/calendar`, reschedule);
    assert.equal(moved.status, 200);
    assert.equal(moved.data.revision, 2);
    assert.deepEqual(
      (await call(admin, `/v1/institution/calendar`, reschedule)).data,
      moved.data,
    );
    const cancel = operation("cancel", {
      id: future.id,
      view: "admin",
      revision: 2,
      future_series: true,
    });
    assert.equal(
      (await call(admin, `/v1/institution/calendar`, cancel)).status,
      200,
    );
    assert.equal(
      (await call(admin, `/v1/institution/calendar`, cancel)).status,
      200,
    );
    await call(
      admin,
      `/v1/institution`,
      operation("member", {
        id: staff.id,
        revision: staff.revision,
        roles: ["trainer"],
        active: false,
      }),
    );
    assert.equal(
      (await call(trainer, `/v1/institution/calendar`, result)).status,
      403,
      "revoked assessor cannot replay results",
    );
  } finally {
    await f.cleanup();
  }
});
test("calendar collisions are atomic within the institution; calendar preview resolves actual timezone occurrences", async () => {
  const f = await organizationFixture();
  try {
    const admin = await f.person(),
      other = await f.person(),
      trainer = await f.person(),
      client = await f.person(),
      id = await f.create(admin),
      id2 = id;
    await f.join(admin, id, other, ["admin"]);
    const s = await f.join(admin, id, trainer, ["trainer"]),
      m = await f.join(admin, id, client, ["trainee"]),
      s2 = s,
      m2 = m;
    const base = {
      view: "admin",
      title: "Group training",
      kind: "training",
      local: tomorrow(),
      zone: "UTC",
      minutes: 60,
      count: 1,
      every: 7,
      location: "",
    };
    const results = await Promise.all([
      call(
        admin,
        `/v1/institution/calendar`,
        operation("create", {
          ...base,
          id: randomUUID(),
          staff: [s.id],
          participants: [m.id],
        }),
      ),
      call(
        other,
        `/v1/institution/calendar`,
        operation("create", {
          ...base,
          id: randomUUID(),
          staff: [s2.id],
          participants: [m2.id],
        }),
      ),
    ]);
    assert.deepEqual(
      results.map((r) => r.status).sort(),
      [200, 400],
      JSON.stringify(results),
    );
    assert.equal(
      await db.institution_events.count({
        where: { institution_id: { in: [id, id2] } },
      }),
      1,
    );
    const foreign = await call(
      admin,
      `/v1/institution/calendar`,
      operation("create", {
        ...base,
        id: randomUUID(),
        staff: [s.id],
        participants: [randomUUID()],
      }),
    );
    assert.equal(foreign.status, 403);
    assert.equal(
      (
        await call(admin, `/v1/institution/calendar-preview`, {
          ...base,
          minutes: true,
        })
      ).status,
      400,
    );
    const dst = await call(admin, `/v1/institution/calendar-preview`, {
      ...base,
      local: "2027-03-14T02:30",
      zone: "America/New_York",
    });
    assert.equal(dst.status, 400);
  } finally {
    await f.cleanup();
  }
});
