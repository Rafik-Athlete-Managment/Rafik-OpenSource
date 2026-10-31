import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { db } from "../server/db.ts";
import { apiOrigin } from "./test-target.ts";
const users: string[] = [];
after(async () => {
  await db.users.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});
async function person() {
  const id = randomUUID(),
    token = randomBytes(32).toString("hex");
  users.push(id);
  await db.users.create({ data: { id, email: `${id}@rafik.test` } });
  await db.identity_sessions.create({
    data: {
      user_id: id,
      token_hash: createHash("sha256").update(token).digest("hex"),
      expires_at: new Date(Date.now() + 3600000),
    },
  });
  return "rafik_session=" + token;
}
async function call(
  cookie: string,
  path: string,
  input?: unknown,
  method = input === undefined ? "GET" : "POST",
) {
  const response = await fetch(apiOrigin + path, {
    method,
    headers: {
      Cookie: cookie,
      "x-rafik-client": "web",
      "content-type": "application/json",
    },
    body: input === undefined ? undefined : JSON.stringify(input),
  });
  return { status: response.status, data: await response.json() };
}
test("retired gateways and aliases are absent; explicit own profile/support/export/deletion preserve isolation", async () => {
  const a = await person(),
    b = await person();
  assert.equal(
    (await call(a, "/v1/account/profile", { p_name: "Current member" })).status,
    200,
  );
  assert.equal(
    (await call(b, "/v1/account/profile", { p_name: "Other member" })).status,
    200,
  );
  const updated = await call(
    a,
    "/v1/account/profile",
    {
      p_name: "Updated",
      p_locale: "ar",
      p_units: "lb",
      p_timezone: "Asia/Dubai",
    },
    "PUT",
  );
  assert.equal(updated.status, 200, JSON.stringify(updated));
  assert.equal(updated.data.display_name, "Updated");
  for (const path of [
    "/v1/contexts",
    `/v1/workspaces/${randomUUID()}`,
    `/v1/institutions/${randomUUID()}`,
    `/v1/organization-assets/${randomUUID()}`,
    `/v1/organization-sessions/${randomUUID()}`,
    `/v1/organization-invitations/${randomUUID()}`,
    "/v1/account/organizations",
    "/v1/queries/profiles",
    "/v1/files/a",
  ]) {
    assert.equal((await call(a, path)).status, 404, path);
  }
  for (const name of [
    "ensure_profile",
    "save_session",
    "save_plan",
    "open_business_account",
    "delete_my_account",
  ])
    assert.equal((await call(a, "/v1/commands/" + name, {})).status, 404, name);
  const id = randomUUID(),
    create = {
      action: "create_support_case",
      args: { p_id: id, p_subject: "Current support", p_detail: "Exact retry" },
    };
  const first = await call(a, "/v1/support", create);
  assert.equal(first.status, 200, JSON.stringify(first));
  assert.deepEqual((await call(a, "/v1/support", create)).data, first.data);
  assert.equal((await call(b, "/v1/support", create)).status, 400);
  assert.equal(
    (
      await call(a, "/v1/support", {
        ...create,
        args: { ...create.args, p_detail: "Changed" },
      })
    ).status,
    400,
  );
  assert.equal((await call(b, "/v1/support")).data.length, 0);
  const exported = await call(a, "/v1/account/export");
  assert.equal(exported.status, 200, JSON.stringify(exported));
  assert.equal(exported.data.supportCases[0].id, id);
  assert.equal(exported.data.profile.display_name, "Updated");
  assert.ok(!("businessAccounts" in exported.data));
  assert.equal(
    (await call(a, "/v1/account/deletion", { confirmation: "NO" })).status,
    400,
  );
  assert.equal(
    (await call(a, "/v1/account/deletion", { confirmation: "DELETE" })).status,
    200,
  );
  assert.equal((await call(a, "/v1/account/export")).status, 401);
});
