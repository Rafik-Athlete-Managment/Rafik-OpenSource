import { test, after } from "node:test";
import assert from "node:assert/strict";
import {
  organizationFixture,
  call,
  operation,
} from "./organization-fixture.ts";
import { db } from "../server/db.ts";
after(() => db.$disconnect());
test("one installation derives access from membership and refuses revoked staff and additional creation", async () => {
  const f = await organizationFixture();
  try {
    const admin = await f.person(),
      coach = await f.person(),
      athlete = await f.person(),
      outsider = await f.person();
    const id = await f.create(admin);
    const c = await f.join(admin, id, coach, ["trainer"]);
    await f.join(admin, id, athlete, ["trainee"]);
    assert.equal((await call(admin, "/v1/institution?view=admin")).status, 200);
    assert.equal((await call(coach, "/v1/institution?view=admin")).status, 403);
    assert.equal(
      (await call(outsider, "/v1/institution?view=trainer")).status,
      403,
    );
    const context = await call(coach, "/v1/institution/context");
    assert.equal(context.data.contexts.length, 1);
    assert.equal(context.data.contexts[0].institution_id, id);
    assert.equal(context.data.contexts[0].role, "trainer");
    // Test HTTP directly: fixture creation is deliberately not a runtime route.
    const { apiOrigin } = await import("./test-target.ts");
    const created = await fetch(apiOrigin + "/v1/institutions", {
      method: "POST",
      headers: {
        Cookie: admin.cookie,
        "x-rafik-client": "web",
        "content-type": "application/json",
      },
      body: "{}",
    });
    assert.equal(created.status, 404);
    assert.equal(
      (
        await call(
          admin,
          "/v1/institution",
          operation("member", {
            id: c.id,
            revision: c.revision,
            roles: ["trainer"],
            active: false,
          }),
        )
      ).status,
      200,
    );
    assert.equal(
      (await call(coach, "/v1/institution?view=trainer")).status,
      403,
    );
    assert.equal(
      (await call(athlete, "/v1/institution?view=trainee")).status,
      200,
    );
  } finally {
    await f.cleanup();
  }
});
