import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { db } from "../server/db.ts";
import { apiOrigin } from "./test-target.ts";

test("field capability negotiation is authenticated, read-only and honest about native workout support", async () => {
  const user = randomUUID(),
    token = randomBytes(32).toString("hex");
  const hash = (value: string) =>
    createHash("sha256").update(value).digest("hex");
  const until = new Date(Date.now() + 600_000);
  await db.users.create({ data: { id: user, email: `${user}@rafik.test` } });
  try {
    const session = await db.mobile_sessions.create({
      data: {
        user_id: user,
        access_token_hash: hash(token),
        refresh_token_hash: hash(randomBytes(32).toString("hex")),
        access_expires_at: until,
        expires_at: until,
        absolute_expires_at: until,
      },
    });
    const call = (method = "GET", authorization = `Bearer ${token}`) =>
      fetch(apiOrigin + "/v1/mobile/capabilities", {
        method,
        headers: { authorization, "x-rafik-client": "android" },
      });
    assert.equal((await call("GET", "")).status, 401);
    const response = await call();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), {
      protocol: 1,
      features: {
        attendance: true,
        assessments: true,
        event_completion: true,
        individual_workout_recording: false,
        group_workout_recording: false,
        day_only_calendar: false,
      },
    });
    assert.equal((await call("POST")).status, 405);
    await db.mobile_sessions.update({
      where: { id: session.id },
      data: { revoked_at: new Date() },
    });
    assert.equal((await call()).status, 401);
  } finally {
    await db.users.delete({ where: { id: user } });
    await db.$disconnect();
  }
});
