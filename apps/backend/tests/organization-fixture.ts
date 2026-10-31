import { institutionTransport } from "../server/institution-routing.ts";
import { apiOrigin } from "./test-target.ts";
import { fixtureInstitution } from "./institution-fixture.ts";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { removePrivate } from "../server/private-bytes.ts";
import { db } from "../server/db.ts";
export type Person = { id: string; email: string; cookie: string };
const composeFile = resolve(
  import.meta.dirname,
  "../../../infrastructure/compose.yaml",
);
export const dockerCompose = (args: string[], options = {}) =>
  execFileSync("docker", ["compose", "-f", composeFile, ...args], options);
export const operation = <T extends object, A extends string>(
  action: A,
  args: T,
) => ({
  operation: randomUUID(),
  action,
  ...args,
});
export async function call(p: Person, path: string, input?: unknown) {
  if (path === "/v1/institutions" && input)
    return fixtureInstitution(p, input as Record<string, unknown>);
  const r = await fetch(apiOrigin + path, {
    method: input === undefined ? "GET" : "POST",
    headers: {
      Cookie: p.cookie,
      "x-rafik-client": "web",
      "Content-Type": "application/json",
    },
    body: input === undefined ? undefined : JSON.stringify(input),
  });
  return {
    status: r.status,
    data: institutionTransport(await r.json()) as any,
  };
}
export async function organizationFixture() {
  const people: string[] = [],
    spaces: string[] = [];
  const person = async () => {
    const id = randomUUID(),
      email = `program-${id}@rafik.test`,
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
    assert.equal(
      (
        await call(p, "/v1/account/profile", {
          p_name: "Program " + id.slice(0, 6),
        })
      ).status,
      200,
    );
    return p;
  };
  const create = async (p: Person) => {
    // Each fixture owns one installation. Additional requested scopes are invalid
    // IDs for outsider/foreign-record assertions, never a second runtime institution.
    if (spaces.length) return randomUUID();
    if (
      !process.env.RAFIK_TEST_API ||
      !/\/rafik_browser_\d+$/.test(process.env.DATABASE_URL || "")
    )
      throw Error("Disposable database required");
    await db.institutions.deleteMany();
    const id = randomUUID();
    spaces.push(id);
    await fixtureInstitution(p, {
      id,
      name: "Test institution",
      kind: "organization",
    });
    return id;
  };
  const join = async (
    admin: Person,
    id: string,
    p: Person,
    roles: string[],
  ) => {
    if (!spaces.includes(id))
      return {
        id: randomUUID(),
        institution_id: id,
        user_id: p.id,
        roles,
        revision: 1,
        active: true,
      };
    const token = randomBytes(32).toString("hex");
    assert.equal(
      (
        await call(
          admin,
          "/v1/institution",
          operation("invite", {
            id: randomUUID(),
            email: p.email,
            roles,
            token,
          }),
        )
      ).status,
      200,
    );
    assert.equal((await call(p, "/v1/invitations/" + token, {})).status, 200);
    return await db.institution_members.findUniqueOrThrow({
      where: { institution_id_user_id: { institution_id: id, user_id: p.id } },
    });
  };
  const cleanup = async () => {
    const media = await db.$queryRaw<
      { id: string; institution_id: string }[]
    >`SELECT id,institution_id FROM public.program_media WHERE institution_id=ANY(${spaces}::uuid[])`;
    for (const m of media)
      await removePrivate(`program/${m.institution_id}/${m.id}`);
    const assets = await db.$queryRaw<
      { id: string; institution_id: string }[]
    >`SELECT id,institution_id FROM public.institution_assets WHERE institution_id=ANY(${spaces}::uuid[])`;
    for (const a of assets)
      await removePrivate(`organization/${a.institution_id}/${a.id}`);
    await db.institutions.deleteMany({ where: { id: { in: spaces } } });
    await db.users.deleteMany({ where: { id: { in: people } } });
  };
  return { person, create, join, cleanup };
}
