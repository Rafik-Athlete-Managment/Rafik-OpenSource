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
const food = {
  name: "Oats",
  meal: "breakfast",
  quantity: 50,
  basis: 100,
  unit: "g",
  nutrients: { kcal: 389, protein_g: 16.89, carb_g: 66.27, fat_g: 6.9 },
  source: "Synthetic test reference",
};
const date = new Date().toISOString().slice(0, 10);
const plus = (n: number) =>
  new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);
test("organization nutrition respects subject, sharing, reassignment, replay and export boundaries", async () => {
  const f = await organizationFixture();
  try {
    const admin = await f.person(),
      trainer = await f.person(),
      client = await f.person(),
      replacement = await f.person(),
      outsider = await f.person();
    const id = await f.create(admin),
      other = await f.create(outsider),
      endpoint = `/v1/institution/nutrition`;
    const staff = await f.join(admin, id, trainer, ["trainer"]),
      member = await f.join(admin, id, client, ["trainee"]),
      next = await f.join(admin, id, replacement, ["trainer"]);
    const foreign = await f.join(outsider, other, client, ["trainee"]);
    assert.equal(
      (
        await call(
          admin,
          `/v1/institution`,
          operation("assign-trainer", {
            id: member.id,
            revision: 1,
            trainer: staff.id,
          }),
        )
      ).status,
      200,
    );
    const publish = operation("publish", {
      view: "trainer",
      member: member.id,
      id: randomUUID(),
      revision: 0,
      effective_on: date,
      expires_on: plus(3),
      targets: { kcal: 2100, protein_g: 130 },
      guidance: "Regular meals and adjustable portions",
      meals: [food],
    });
    const published = await call(trainer, endpoint, publish);
    assert.equal(published.status, 200, JSON.stringify(published));
    assert.deepEqual(
      (await call(trainer, endpoint, publish)).data,
      published.data,
    );
    assert.equal(
      (await call(trainer, endpoint, { ...publish, guidance: "Changed retry" }))
        .status,
      409,
    );
    assert.equal(
      (
        await call(client, endpoint, {
          ...publish,
          view: "trainee",
          operation: randomUUID(),
        })
      ).status,
      403,
    );
    assert.equal(
      (await call(outsider, endpoint + "?view=admin&member=" + member.id))
        .status,
      403,
    );
    assert.equal(
      (await call(admin, endpoint + "?view=admin&member=" + foreign.id)).status,
      403,
    );
    assert.equal(
      (await call(trainer, endpoint + "?view=admin&member=" + member.id))
        .status,
      403,
    );
    assert.equal(
      (await call(trainer, endpoint + "?view=trainee&member=" + member.id))
        .status,
      403,
    );
    const own = (await call(client, endpoint + "?view=trainee&date=" + date))
      .data;
    assert.equal(own.current.targets.kcal, 2100);
    assert.equal(own.sharing.enabled, false);
    const entry = operation("meal", {
      view: "trainee",
      member: member.id,
      id: randomUUID(),
      revision: 0,
      logged_on: date,
      food,
      note: "Actual portion",
    });
    const saved = await call(client, endpoint, entry);
    assert.equal(saved.status, 200, JSON.stringify(saved));
    assert.deepEqual((await call(client, endpoint, entry)).data, saved.data);
    assert.equal(
      (
        await call(trainer, endpoint, {
          ...entry,
          operation: randomUUID(),
          view: "trainer",
        })
      ).status,
      403,
    );
    assert.equal(
      (await call(admin, endpoint + "?view=admin&member=" + member.id)).data
        .canReadDiary,
      false,
    );
    assert.equal(
      (await call(admin, endpoint + "?view=admin&member=" + member.id)).data
        .meals.length,
      0,
    );
    assert.equal(
      (
        await call(
          client,
          endpoint,
          operation("sharing", {
            view: "trainee",
            member: member.id,
            revision: 0,
            enabled: true,
          }),
        )
      ).status,
      200,
    );
    assert.equal(
      (await call(trainer, endpoint + "?view=trainer&member=" + member.id)).data
        .meals.length,
      1,
    );
    const correction = operation("meal", {
      ...entry,
      operation: randomUUID(),
      revision: 1,
      food: { ...food, quantity: 75 },
    });
    assert.equal((await call(client, endpoint, correction)).status, 200);
    assert.equal(
      (
        await call(client, endpoint, {
          ...correction,
          operation: randomUUID(),
          food: { ...food, quantity: 90 },
        })
      ).status,
      409,
    );
    let shared = (
      await call(
        admin,
        endpoint + `?view=admin&member=${member.id}&meal=${entry.id}`,
      )
    ).data;
    assert.equal(shared.meals[0].food.quantity, 75);
    assert.equal(shared.corrections.length, 2);
    assert.equal(shared.corrections[1].document.food.quantity, 50);
    assert.equal(
      (
        await call(
          admin,
          `/v1/institution`,
          operation("assign-trainer", {
            id: member.id,
            revision: 2,
            trainer: next.id,
          }),
        )
      ).status,
      200,
    );
    assert.equal(
      (await call(trainer, endpoint + "?view=trainer&member=" + member.id))
        .status,
      403,
    );
    assert.equal(
      (await call(trainer, endpoint, publish)).status,
      403,
      "responsibility checked before accepted receipt",
    );
    shared = (
      await call(replacement, endpoint + "?view=trainer&member=" + member.id)
    ).data;
    assert.equal(shared.current.id, published.data.id);
    assert.equal(shared.meals.length, 1);
    assert.equal(
      (
        await call(
          client,
          endpoint,
          operation("sharing", {
            view: "trainee",
            member: member.id,
            revision: 1,
            enabled: false,
          }),
        )
      ).status,
      200,
    );
    shared = (
      await call(
        admin,
        endpoint + `?view=admin&member=${member.id}&meal=${entry.id}`,
      )
    ).data;
    assert.equal(shared.meals.length, 0);
    assert.equal(shared.corrections.length, 0);
    assert.equal(
      (await call(outsider, `/v1/institution/nutrition?view=trainee`)).status,
      403,
    );
    assert.equal(
      (
        await call(
          client,
          endpoint,
          operation("remove", {
            view: "trainee",
            member: member.id,
            id: entry.id,
            revision: 2,
          }),
        )
      ).status,
      200,
    );
    assert.equal(
      (await call(client, endpoint + "?view=trainee")).data.meals.length,
      0,
    );
    const removed = (
      await call(client, endpoint + "?view=trainee&removed=true")
    ).data;
    assert.equal(removed.removed.length, 1);
    assert.equal(removed.removed[0].food.quantity, 75);
    assert.equal(
      (
        await call(
          admin,
          endpoint + "?view=admin&member=" + member.id + "&removed=true",
        )
      ).data.removed.length,
      0,
    );
    const exported = (await call(client, "/v1/account/institution")).data;
    assert.equal(exported.nutritionPlans.length, 1);
    assert.equal(exported.nutritionMeals[0].institution_meal_history.length, 3);
    assert.equal(exported.nutritionMeals[0].removed, true);
    assert.equal(
      (await call(outsider, "/v1/account/institution")).data.nutritionMeals
        .length,
      0,
    );
    assert.equal(
      (await call(client, "/v1/queries/institution_meals")).status,
      404,
    );
    assert.equal(
      (
        await call(
          admin,
          `/v1/institution`,
          operation("member", {
            id: member.id,
            revision: 3,
            active: false,
            roles: ["trainee"],
          }),
        )
      ).status,
      200,
    );
    assert.equal((await call(client, endpoint, entry)).status, 403);
    assert.equal(
      (await call(admin, endpoint + "?view=admin&member=" + member.id)).data
        .member.active,
      false,
    );
  } finally {
    await f.cleanup();
  }
});
test("nutrition plan revisions serialize; dates, expiry, content validation and history pages remain truthful", async () => {
  const f = await organizationFixture();
  try {
    const admin = await f.person(),
      client = await f.person(),
      id = await f.create(admin),
      member = await f.join(admin, id, client, ["trainee"]),
      endpoint = `/v1/institution/nutrition`;
    const publish = () =>
      operation("publish", {
        view: "admin",
        member: member.id,
        id: randomUUID(),
        revision: 0,
        effective_on: date,
        targets: { kcal: 2000 },
        guidance: "Daily plan",
        meals: [food],
      });
    const concurrent = await Promise.all([
      call(admin, endpoint, publish()),
      call(admin, endpoint, publish()),
    ]);
    assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 409]);
    for (const invalid of [
      { targets: { kcal: -1 } },
      { targets: { kcal: "2000" } },
      { effective_on: plus(-1) },
      { effective_on: "2026-02-30" },
      { expires_on: plus(-1) },
      { meals: [{ ...food, quantity: 0 }] },
      { meals: [{ ...food, source: "" }] },
      { meals: [{ ...food, nutrients: { wrong: 2 } }] },
    ]) {
      const response = await call(admin, endpoint, {
        ...publish(),
        revision: 1,
        ...invalid,
      });
      assert.equal(response.status, 400, JSON.stringify(response));
    }
    for (let revision = 1; revision < 12; revision++) {
      const r = await call(admin, endpoint, {
        ...publish(),
        revision,
        effective_on: plus(1),
        expires_on: plus(2),
        targets: { kcal: 2200 + revision },
      });
      assert.equal(r.status, 200, JSON.stringify(r));
    }
    const current = (
      await call(client, endpoint + "?view=trainee&date=" + date)
    ).data;
    assert.equal(current.current.targets.kcal, 2000);
    assert.equal(current.plans.length, 10);
    assert.equal(current.next, 10);
    const next = (await call(client, endpoint + "?view=trainee&offset=10"))
      .data;
    assert.equal(next.plans.length, 2);
    assert.equal(next.next, null);
    assert.equal(
      (await call(client, endpoint + "?view=trainee&date=" + plus(3))).data
        .current,
      null,
      "expired newest applicable plan does not resurrect prior plan",
    );
    const bad = operation("meal", {
      view: "trainee",
      member: member.id,
      id: randomUUID(),
      revision: 0,
      logged_on: plus(1),
      food,
      note: "",
    });
    assert.equal((await call(client, endpoint, bad)).status, 400);
    assert.equal(
      (
        await call(
          admin,
          endpoint + "?view=admin&member=" + member.id + "&offset=NaN",
        )
      ).status,
      400,
    );
  } finally {
    await f.cleanup();
  }
});
