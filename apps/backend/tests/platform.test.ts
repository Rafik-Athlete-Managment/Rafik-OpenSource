import { testDatabase } from "./test-target.ts";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../server/db.ts";
import {
  organizationFixture,
  call,
  operation,
  dockerCompose,
} from "./organization-fixture.ts";
after(() => db.$disconnect());
test("platform grant, audited operational lifecycle, exact replay and identity revocation are separate from organization authority", async () => {
  const f = await organizationFixture();
  const ids: string[] = [];
  const sql = (s: string) =>
    dockerCompose(
      [
        "exec",
        "-T",
        "db",
        "psql",
        "-U",
        "rafik_migrate",
        "-d",
        testDatabase,
        "-v",
        "ON_ERROR_STOP=1",
      ],
      { input: s, stdio: "pipe" },
    );
  try {
    const operator = await f.person(),
      admin = await f.person(),
      person = await f.person(),
      id = await f.create(admin);
    assert.equal((await call(admin, "/v1/platform")).status, 403);
    ids.push(operator.id);
    sql(
      `insert into public.platform_grants(user_id) values('${operator.id}');`,
    );
    let r = await call(operator, "/v1/platform?section=organizations");
    assert.equal(r.status, 200, JSON.stringify(r));
    assert.ok(r.data.items.some((w: any) => w.id === id));
    const close = operation("organization_state", {
      id,
      revision: 1,
      value: true,
      reason: "Local operational lifecycle test",
    });
    r = await call(operator, "/v1/platform", close);
    assert.equal(r.status, 200, JSON.stringify(r));
    assert.equal(r.data.archived, true);
    assert.deepEqual(
      (await call(operator, "/v1/platform", close)).data,
      r.data,
    );
    assert.equal((await call(admin, `/v1/institution?view=admin`)).status, 403);
    assert.equal(
      (await call(operator, "/v1/platform", { ...close, value: false })).status,
      409,
    );
    r = await call(
      operator,
      "/v1/platform",
      operation("organization_state", {
        id,
        revision: 2,
        value: false,
        reason: "Reopen after local test check",
      }),
    );
    assert.equal(r.status, 200, JSON.stringify(r));
    assert.equal((await call(admin, `/v1/institution?view=admin`)).status, 200);
    const suspend = operation("identity_state", {
      id: person.id,
      revision: 0,
      value: true,
      reason: "Local suspension test only",
    });
    assert.equal((await call(operator, "/v1/platform", suspend)).status, 200);
    assert.equal((await call(person, "/v1/institution/context")).status, 401);
    assert.equal(
      (
        await call(
          operator,
          "/v1/platform",
          operation("identity_state", {
            id: operator.id,
            revision: 0,
            value: true,
            reason: "Attempt to lock out operator",
          }),
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await call(
          operator,
          "/v1/platform",
          operation("identity_state", {
            id: person.id,
            revision: 1,
            value: false,
            reason: "Restore after local test",
          }),
        )
      ).status,
      200,
    );
    assert.equal(
      (await call(person, "/v1/institution/context")).status,
      401,
      "old cookie stays revoked",
    );
    const support = await call(admin, "/v1/support", {
      action: "create_support_case",
      args: {
        p_id: randomUUID(),
        p_subject: "Local operator case",
        p_detail: "Please inspect this local test case.",
      },
    });
    assert.equal(support.status, 200, JSON.stringify(support));
    r = await call(operator, "/v1/platform?section=support");
    assert.equal(r.status, 200, JSON.stringify(r));
    assert.ok(r.data.items.some((c: any) => c.id === support.data.id));
    r = await call(
      operator,
      "/v1/platform",
      operation("support_reply", {
        id: support.data.id,
        revision: 1,
        reply: "Resolved in this local test.",
        reason: "Respond to requested local support",
      }),
    );
    assert.equal(r.status, 200, JSON.stringify(r));
    const audit = await call(operator, "/v1/platform?section=audit");
    assert.ok(audit.data.items.some((a: any) => a.kind === "identity_state"));
    sql(`delete from public.platform_grants where user_id='${operator.id}';`);
    assert.equal(
      (await call(operator, "/v1/platform", close)).status,
      403,
      "grant rechecked before receipt",
    );
  } finally {
    for (const id of ids)
      sql(`delete from public.platform_operations where actor_id='${id}';`);
    await f.cleanup();
  }
});
