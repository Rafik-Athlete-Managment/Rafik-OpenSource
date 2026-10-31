import { apiOrigin } from "./test-target.ts";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../server/db.ts";
import { passwordHash, validatePassword } from "../server/auth.ts";
const origin = apiOrigin;
const identities: string[] = [];
after(async () => {
  for (const id of identities) await db.users.deleteMany({ where: { id } });
  await db.$disconnect();
});
test("new passwords require length and character classes", () => {
  assert.equal(validatePassword("Rafik2026!"), "Rafik2026!");
  for (const value of [
    "Short1!",
    "alllowercase1!",
    "ALLUPPERCASE1!",
    "NoNumber!!",
    "NoSymbol123",
  ])
    assert.throws(() => validatePassword(value));
});
async function call(
  path: string,
  body?: unknown,
  cookie = "",
  headers: Record<string, string> = {},
) {
  const response = await fetch(origin + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "x-rafik-client": "web",
      "Content-Type": "application/json",
      Cookie: cookie,
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: response.status,
    data: await response.json(),
    cookie: response.headers.get("set-cookie") || "",
  };
}
test("password sign-in creates an HttpOnly session and logout revokes it", async () => {
  const email = `password-${randomUUID()}@rafik.test`,
    password = "University test password 2026!";
  const created = await db.users.create({
    data: { email, password_hash: await passwordHash(password) },
  });
  identities.push(created.id);
  assert.equal(
    (
      await call("/v1/auth/password-login", {
        email,
        password: "incorrect password",
      })
    ).status,
    401,
  );
  const result = await call("/v1/auth/password-login", { email, password });
  assert.equal(result.status, 200);
  assert.match(result.cookie, /HttpOnly/);
  const cookie = result.cookie.split(";")[0];
  assert.equal(
    (await call("/v1/auth/session", undefined, cookie)).data.user.email,
    email,
  );
  await call("/v1/auth/logout", {}, cookie);
  assert.equal(
    (await call("/v1/auth/session", undefined, cookie)).data.user,
    null,
  );
});
test("setup status closes registration after an institution exists and a foreign origin cannot mutate", async () => {
  assert.deepEqual((await call("/v1/auth/setup-status")).data, {
    initialized: true,
  });
  assert.equal(
    (
      await call("/v1/auth/setup", {
        email: `setup-${randomUUID()}@rafik.test`,
        name: "Setup Probe",
        institution: "Setup Probe Institution",
        password: "University test password 2026!",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call("/v1/auth/verify-code", {
        email: "nobody@example.test",
        token: "000000",
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await call("/v1/auth/logout", {}, "", {
        Origin: "https://unrelated.example",
      })
    ).status,
    403,
  );
});
