import { apiOrigin } from "./test-target.ts";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../server/db.ts";
import {
  organizationFixture,
  call,
  operation,
  type Person,
} from "./organization-fixture.ts";
after(() => db.$disconnect());
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=",
  "base64",
);
const asset = (
  p: Person,
  id: string,
  institution?: string,
  view = "admin",
  channel?: string,
  bytes = png,
) =>
  fetch(
    `${apiOrigin}/v1/assets/${id}` +
      (institution
        ? "?" +
          new URLSearchParams({
            institution,
            view,
            purpose: channel ? "message" : "exercise",
            filename: "demo.png",
            ...(channel ? { channel } : {}),
          })
        : ""),
    {
      method: institution ? "PUT" : "GET",
      headers: {
        Cookie: p.cookie,
        "x-rafik-client": "web",
        "Content-Type": "image/png",
      },
      body: institution ? bytes : undefined,
    },
  );
test("organization exercises preserve private ownership, multi-category snapshots and authorized uploaded media", async () => {
  const f = await organizationFixture();
  try {
    const admin = await f.person(),
      trainer = await f.person(),
      peer = await f.person(),
      foreign = await f.person(),
      trainee = await f.person(),
      institution = await f.create(admin);
    const owner = await f.join(admin, institution, trainer, ["trainer"]);
    await f.join(admin, institution, peer, ["trainer"]);
    const member = await f.join(admin, institution, trainee, ["trainee"]);
    await f.create(foreign);
    await call(
      admin,
      `/v1/institution`,
      operation("assign-trainer", {
        id: member.id,
        revision: 1,
        trainer: owner.id,
      }),
    );
    const media = randomUUID();
    assert.equal(
      (await asset(trainer, media, institution, "trainer")).status,
      200,
    );
    assert.equal(
      (await asset(trainer, media, institution, "trainer")).status,
      200,
    );
    assert.equal(
      (
        await asset(
          trainer,
          media,
          institution,
          "trainer",
          undefined,
          Buffer.concat([png, Buffer.from("x")]),
        )
      ).status,
      409,
    );
    const id = "org-" + randomUUID(),
      data = {
        name: "Row and brace",
        instructions: "Row with control.",
        kind: "strength",
        scope: "private",
        body_parts: ["back", "waist"],
        muscles: ["lats", "abdominals"],
        equipment_items: ["dumbbell", "bench"],
        movement: "compound",
        media_asset: media,
      };
    const save = operation("exercise", {
      id,
      view: "trainer",
      revision: 0,
      data,
    });
    let r = await call(trainer, `/v1/institution/catalog`, save);
    assert.equal(r.status, 200, JSON.stringify(r));
    assert.deepEqual(r.data.data.body_parts, ["back", "waist"]);
    for (const p of [admin, peer, trainee, foreign])
      assert.equal((await asset(p, media)).status, 403);
    for (const [p, view] of [
      [admin, "admin"],
      [peer, "trainer"],
    ] as const) {
      const list = await call(p, `/v1/institution/catalog?view=${view}`);
      assert.ok(!list.data.some((e: any) => e.id === id));
      assert.equal(
        (
          await call(p, `/v1/institution/catalog`, {
            ...save,
            operation: randomUUID(),
            view,
            revision: 1,
          })
        ).status,
        403,
      );
    }
    assert.equal(
      (
        await call(trainer, `/v1/institution/catalog`, {
          ...save,
          operation: randomUUID(),
          revision: 1,
          data: { ...data, scope: "organization" },
        })
      ).status,
      403,
    );
    const program = randomUUID();
    const draft = {
      schema: 2,
      cycleWeeks: 1,
      days: [
        {
          id: "day-1",
          name: "Training",
          week: 1,
          weekday: 0,
          exercises: [
            {
              key: "row",
              exerciseId: id,
              sets: 1,
              reps: 8,
              load: 5,
              unit: "kg",
              rest: 60,
              note: "",
            },
          ],
        },
      ],
    };
    r = await call(
      trainer,
      `/v1/institution/programs`,
      operation("publish", {
        view: "trainer",
        id: program,
        title: "Private movement plan",
        revision: null,
        draft,
      }),
    );
    assert.equal(r.status, 200, JSON.stringify(r));
    assert.equal(
      (await asset(admin, media)).status,
      200,
      "admin can read media in published plans they can review",
    );
    const version = r.data.version;
    assert.equal(
      version.prescription.days[0].exercises[0].info.media_asset,
      media,
    );
    r = await call(
      trainer,
      `/v1/institution/delivery`,
      operation("assign", {
        view: "trainer",
        version_id: version.id,
        members: [{ id: member.id, revision: 2 }],
        start_date: "2026-09-01",
        schedule_mode: "flexible",
      }),
    );
    assert.equal(r.status, 200, JSON.stringify(r));
    assert.equal((await asset(trainee, media)).status, 200);
    const libraryMedia = await asset(peer, media);
    assert.equal(
      libraryMedia.status,
      200,
      "published library snapshots authorize their exact media",
    );
    assert.deepEqual(Buffer.from(await libraryMedia.arrayBuffer()), png);
    // Organization-created media and exercises are visible to staff in that tenant only.
    const sharedMedia = randomUUID();
    assert.equal((await asset(admin, sharedMedia, institution)).status, 200);
    r = await call(
      admin,
      `/v1/institution/catalog`,
      operation("exercise", {
        id: "org-" + randomUUID(),
        view: "admin",
        revision: 0,
        data: { ...data, scope: "organization", media_asset: sharedMedia },
      }),
    );
    assert.equal(r.status, 200, JSON.stringify(r));
    assert.equal((await asset(peer, sharedMedia)).status, 200);
    assert.equal((await asset(foreign, sharedMedia)).status, 403);
    assert.equal((await asset(trainee, sharedMedia)).status, 403);
    r = await call(trainer, `/v1/institution/catalog`, {
      ...save,
      operation: randomUUID(),
      revision: 1,
      data: {
        ...data,
        body_parts: [],
        equipment_items: [],
        body_part: "back",
        equipment: "dumbbell",
      },
    });
    assert.equal(r.status, 200, JSON.stringify(r));
    assert.equal(r.data.data.body_part, "");
    assert.equal(r.data.data.equipment, "");
    assert.equal(
      version.prescription.days[0].exercises[0].info.body_parts.length,
      2,
      "published categories do not change",
    );
    const list = await call(peer, `/v1/institution/assets?view=trainer`);
    assert.equal(list.data.items.length, 1);
    assert.equal(list.data.items[0].id, sharedMedia);
    // Revocation applies even to a repeated upload that was previously accepted.
    await db.institution_members.update({
      where: { id: owner.id },
      data: { active: false },
    });
    assert.equal(
      (await asset(trainer, media, institution, "trainer")).status,
      403,
    );
  } finally {
    await f.cleanup();
  }
});
test("private pair history and attachments exclude admins, other channels and unsent recipients", async () => {
  const f = await organizationFixture();
  try {
    const admin = await f.person(),
      trainer = await f.person(),
      trainee = await f.person(),
      institution = await f.create(admin),
      staff = await f.join(admin, institution, trainer, ["trainer"]),
      member = await f.join(admin, institution, trainee, ["trainee"]);
    await call(
      admin,
      `/v1/institution`,
      operation("assign-trainer", {
        id: member.id,
        revision: 1,
        trainer: staff.id,
      }),
    );
    const channel = randomUUID(),
      endpoint = `/v1/institution/communication`;
    const make = (id: string) =>
      call(
        trainer,
        endpoint,
        operation("create", {
          id,
          view: "trainer",
          title: "Technique review",
          members: [staff.id, member.id],
          managers: [staff.id],
        }),
      );
    assert.equal((await make(channel)).status, 200);
    assert.equal(
      (await call(admin, endpoint + "?view=admin&manage=true")).data.items
        .length,
      0,
    );
    assert.equal(
      (
        await call(
          admin,
          endpoint,
          operation("join", { id: channel, view: "admin" }),
        )
      ).status,
      403,
    );
    const media = randomUUID();
    assert.equal(
      (await asset(trainer, media, institution, "trainer", channel)).status,
      200,
    );
    assert.equal((await asset(trainee, media)).status, 403);
    const send = operation("send", {
      id: channel,
      view: "trainer",
      message: randomUUID(),
      body: "Review this movement",
      asset_id: media,
    });
    assert.equal((await call(trainer, endpoint, send)).status, 200);
    assert.equal((await call(trainer, endpoint, send)).status, 200);
    assert.equal((await asset(trainee, media)).status, 200);
    assert.equal((await asset(admin, media)).status, 403);
    const other = randomUUID();
    await make(other);
    assert.equal(
      (
        await call(trainer, endpoint, {
          ...send,
          id: other,
          operation: randomUUID(),
          message: randomUUID(),
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await call(
          trainer,
          endpoint,
          operation("members", {
            id: channel,
            view: "trainer",
            revision: 1,
            members: [staff.id, member.id],
            managers: [staff.id],
          }),
        )
      ).status,
      403,
    );
    await db.institution_members.update({
      where: { id: member.id },
      data: { active: false },
    });
    assert.equal((await asset(trainee, media)).status, 403);
  } finally {
    await f.cleanup();
  }
});
