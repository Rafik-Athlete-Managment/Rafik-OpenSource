import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { db } from "../server/db.ts";
import { apiOrigin } from "./test-target.ts";
import { FieldStore, type Database } from "../../mobile/src/field/store.ts";
import { WorkoutSync } from "../../mobile/src/field/workout-sync.ts";
import { ApiFailure } from "../../mobile/src/field/model.ts";
import { workoutPackage } from "../../mobile/src/field/workout-model.ts";

test("native individual download, provisional offline start and exact replay complete the same sequence once", async () => {
  const institution = "12000000-0000-4000-8000-000000000001",
    assignment = "16000000-0000-4000-8000-000000000001";
  const user = "11000000-0000-4000-8000-000000000002",
    token = randomBytes(32).toString("hex"),
    until = new Date(Date.now() + 600000);
  const hash = (value: string) =>
    createHash("sha256").update(value).digest("hex");
  const session = await db.mobile_sessions.create({
    data: {
      user_id: user,
      access_token_hash: hash(token),
      refresh_token_hash: hash(randomUUID()),
      access_expires_at: until,
      expires_at: until,
      absolute_expires_at: until,
    },
  });
  const sqlite = new DatabaseSync(":memory:");
  const adapter: Database = {
    async execAsync(sql) {
      sqlite.exec(sql);
    },
    async runAsync(sql, ...p) {
      return sqlite.prepare(sql).run(...p);
    },
    async getFirstAsync<T>(sql: string, ...p: (string | number | null)[]) {
      return (sqlite.prepare(sql).get(...p) as T) || null;
    },
    async getAllAsync<T>(sql: string, ...p: (string | number | null)[]) {
      return sqlite.prepare(sql).all(...p) as T[];
    },
    async withTransactionAsync(task) {
      sqlite.exec("BEGIN");
      try {
        await task();
        sqlite.exec("COMMIT");
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    },
  };
  const request = async (path: string, payload?: unknown) => {
    const response = await fetch(apiOrigin + "/v1" + path, {
      method: payload ? "POST" : "GET",
      headers: {
        authorization: "Bearer " + token,
        "x-rafik-client": "android",
        "content-type": "application/json",
      },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const data = await response.json();
    if (!response.ok) throw new ApiFailure(response.status, data.message);
    return data;
  };
  try {
    await db.institution_assignments.update({
      where: { id: assignment },
      data: { start_date: new Date(Date.now() - 14 * 86400000) },
    });
    const cursor = (
      await db.institution_assignments.findUniqueOrThrow({
        where: { id: assignment },
      })
    ).sequence_cursor;
    const starts = new Date(Date.now() - 3600000),
      ends = new Date(starts.getTime() + 1800000);
    await request("/institution/workout-scheduling", {
      operation: randomUUID(),
      action: "schedule-workout",
      view: "trainer",
      assignment_id: assignment,
      cursor,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      timezone: "UTC",
    });
    const plain = await request(
      "/institution/workout-scheduling?view=trainer&assignment=" + assignment,
    );
    assert.equal(
      "field_workout" in plain.items[0],
      false,
      "ordinary dashboards do not download full prescriptions",
    );
    const page = await request(
      "/institution/workout-scheduling?view=trainer&fieldPackages=true&assignment=" +
        assignment,
    );
    const p = workoutPackage({
      ...page.items[0].field_workout,
      clinical_note: "must not be cached",
    });
    assert.equal("clinical_note" in p, false);
    assert.equal(p.assignment_id, assignment);
    assert.equal(p.session, null);
    const store = new FieldStore(adapter);
    await store.initialize();
    const owner = { instance: apiOrigin, user, institution },
      id = randomUUID();
    await store.workouts.put(owner, p);
    await store.workouts.start(owner, p.id, id, randomUUID());
    const entries = p.entries.map((e) => ({
      ...e,
      load: 0,
      reps: Math.max(1, e.reps),
      seconds: 30,
      metres: 123.45,
      completed: true,
    }));
    await store.workouts.edit(
      owner,
      p.id,
      entries,
      "native synthetic completion",
    );
    await store.workouts.save(owner, p.id, true, randomUUID());
    let lost = true;
    const bodies: string[] = [];
    const runner = new WorkoutSync(
      store.workouts,
      owner,
      async (path, body) => {
        bodies.push(body);
        const result = await request(path, JSON.parse(body));
        if (lost) {
          lost = false;
          throw Error("simulated lost acknowledgment");
        }
        return result;
      },
    );
    await runner.run();
    assert.equal(
      (await store.workouts.get(owner, p.id)).pending?.state,
      "uncertain",
    );
    await runner.run();
    assert.equal(bodies[0], bodies[1]);
    const local = await store.workouts.get(owner, p.id),
      server = await request("/workouts/" + id + "?view=trainer");
    assert.ok(local.session?.completed_at);
    assert.equal(local.pending, null);
    assert.equal(server.version, 2);
    assert.equal(server.note, "native synthetic completion");
    assert.equal(server.entries[0].load, 0);
    assert.equal(
      (
        await db.institution_assignments.findUniqueOrThrow({
          where: { id: assignment },
        })
      ).sequence_cursor,
      cursor + 1,
    );
    assert.equal(
      await db.institution_sessions.count({
        where: { occurrence_id: p.occurrence_id },
      }),
      1,
    );
    const athleteToken = randomBytes(32).toString("hex");
    await db.mobile_sessions.create({
      data: {
        user_id: "11000000-0000-4000-8000-000000000003",
        access_token_hash: hash(athleteToken),
        refresh_token_hash: hash(randomUUID()),
        access_expires_at: until,
        expires_at: until,
        absolute_expires_at: until,
      },
    });
    const denied = await fetch(
      apiOrigin +
        "/v1/institution/workout-scheduling?view=trainee&fieldPackages=true",
      {
        headers: {
          authorization: "Bearer " + athleteToken,
          "x-rafik-client": "android",
        },
      },
    );
    assert.equal(denied.status, 403);
  } finally {
    sqlite.close();
    await db.mobile_sessions.delete({ where: { id: session.id } });
    await db.$disconnect();
  }
});
