import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { db } from "../server/db.ts";
import { apiOrigin } from "./test-target.ts";
import { fixtureInstitution } from "./institution-fixture.ts";
export type Person = { id: string; email: string; cookie: string };

/** Registries and teardown belong to each caller; this helper creates no shared fixture state. */
export function institutionTestHelpers(
  people: string[],
  spaces: string[],
  prefix: string,
) {
  const base = apiOrigin;
  async function person(name: string): Promise<Person> {
    const id = randomUUID(),
      email = `${prefix}-${id}@rafik.test`,
      token = randomBytes(32).toString("hex");
    people.push(id);
    await db.users.create({
      data: { id, email, email_confirmed_at: new Date() },
    });
    await db.identity_sessions.create({
      data: {
        token_hash: createHash("sha256").update(token).digest("hex"),
        user_id: id,
        expires_at: new Date(Date.now() + 3600000),
      },
    });
    const p = { id, email, cookie: "rafik_session=" + token };
    await call(p, "/v1/account/profile", { p_name: name });
    return p;
  }

  async function call(p: Person, path: string, input?: unknown) {
    if (path === "/v1/institutions" && input)
      return fixtureInstitution(p, input as Record<string, unknown>);
    const r = await fetch(base + path, {
      method: input === undefined ? "GET" : "POST",
      headers: {
        Cookie: p.cookie,
        "x-rafik-client": "web",
        "Content-Type": "application/json",
      },
      body: input === undefined ? undefined : JSON.stringify(input),
    });
    return { status: r.status, data: await r.json() };
  }

  const operation = (action: string, args: object = {}) => ({
    operation: randomUUID(),
    action,
    ...args,
  });

  async function institution(admin: Person, name: string) {
    const id = randomUUID();
    spaces.push(id);
    assert.equal(
      (
        await call(admin, "/v1/institutions", {
          id,
          kind: "organization",
          name,
          sole: true,
        })
      ).status,
      200,
    );
    return id;
  }

  async function join(admin: Person, _id: string, p: Person, role: string) {
    const token = randomBytes(32).toString("hex");
    const r = await call(
      admin,
      "/v1/institution",
      operation("invite", {
        id: randomUUID(),
        email: p.email,
        roles: [role],
        token,
      }),
    );
    assert.equal(r.status, 200, JSON.stringify(r));
    assert.equal((await call(p, "/v1/invitations/" + token, {})).status, 200);
  }

  async function member(admin: Person, _id: string, p: Person) {
    const r = await call(admin, `/v1/institution?view=admin`);
    return r.data.members.find((m: { user_id: string }) => m.user_id === p.id);
  }
  return { person, call, operation, institution, join, member };
}
