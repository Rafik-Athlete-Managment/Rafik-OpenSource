import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { writeFileSync } from "node:fs";
import { db } from "../server/db.ts";
import { passwordHash } from "../server/auth.ts";
import {
  organizationFixture,
  call,
  operation,
} from "./organization-fixture.ts";
import { FieldStore, type Database } from "../../mobile/src/field/store.ts";
import { AttendanceSync } from "../../mobile/src/field/sync.ts";
import {
  ApiFailure,
  fieldRoster,
  scoreValues,
} from "../../mobile/src/field/model.ts";

const base = process.env.RAFIK_TEST_API || "";
if (
  base !== "http://127.0.0.1:55341" ||
  !/^rafik_browser_\d+$/.test(process.env.RAFIK_TEST_DATABASE || "") ||
  new URL(process.env.DATABASE_URL || "").pathname !==
    "/" + process.env.RAFIK_TEST_DATABASE
)
  throw Error(
    "Run field acceptance through apps/mobile/scripts/acceptance.mjs; preview writes are forbidden.",
  );
after(() => db.$disconnect());
const adapter = (db: DatabaseSync): Database => ({
  async execAsync(sql) {
    db.exec(sql);
  },
  async runAsync(sql, ...args) {
    return db.prepare(sql).run(...args);
  },
  async getFirstAsync<T>(sql: string, ...args: (string | number | null)[]) {
    return (db.prepare(sql).get(...args) as T) || null;
  },
  async getAllAsync<T>(sql: string, ...args: (string | number | null)[]) {
    return db.prepare(sql).all(...args) as T[];
  },
  async withTransactionAsync(task) {
    db.exec("BEGIN");
    try {
      await task();
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  },
});

test("native HTTP + SQLite queue: exact retries, score/completion receipts, histories, conflict and revocation", async () => {
  const f = await organizationFixture(),
    sqlite = new DatabaseSync(":memory:");
  let retained = false;
  try {
    const admin = await f.person(),
      coach = await f.person(),
      athlete = await f.person(),
      peer = await f.person(),
      outsider = await f.person();
    const institution = await f.create(admin);
    const staff = await f.join(admin, institution, coach, ["trainer"]);
    const member = await f.join(admin, institution, athlete, ["trainee"]);
    const second = await f.join(admin, institution, peer, ["trainee"]);
    const password = "Field-Beta-2026!";
    await db.users.update({
      where: { id: coach.id },
      data: { password_hash: await passwordHash(password) },
    });
    const native = async (
      path: string,
      token: string | null,
      input?: unknown,
    ) => {
      const response = await fetch(base + path, {
        method: input === undefined ? "GET" : "POST",
        headers: {
          "x-rafik-client": "android",
          "content-type": "application/json",
          ...(token ? { authorization: "Bearer " + token } : {}),
        },
        body: input === undefined ? undefined : JSON.stringify(input),
      });
      return { status: response.status, data: await response.json() };
    };
    const login = await native("/v1/mobile/auth/login", null, {
      email: coach.email,
      password,
      device_name: "Disposable field acceptance",
    });
    assert.equal(login.status, 200);
    let token = login.data.access_token;
    assert.equal(
      (await native("/v1/mobile/auth/session", token)).data.user.id,
      coach.id,
    );
    const refreshed = await native("/v1/mobile/auth/refresh", null, {
      refresh_token: login.data.refresh_token,
    });
    assert.equal(refreshed.status, 200);
    token = refreshed.data.access_token;
    assert.equal(
      (
        await native("/v1/mobile/auth/refresh", null, {
          refresh_token: login.data.refresh_token,
        })
      ).status,
      401,
    );
    assert.equal(
      (await native("/v1/mobile/auth/session", token)).status,
      401,
      "refresh reuse revokes the entire rotated session",
    );
    const freshLogin = await native("/v1/mobile/auth/login", null, {
      email: coach.email,
      password,
      device_name: "Disposable field acceptance",
    });
    assert.equal(freshLogin.status, 200);
    token = freshLogin.data.access_token;
    const drill = {
      key: randomUUID(),
      name: "Sprint time / زمن العدو",
      kind: "number",
      unit: "s",
      min: 0,
      max: 100,
    };
    const template = operation("template", {
      view: "admin",
      id: randomUUID(),
      title: "Beta assessment",
      definition: [drill],
      revision: 0,
      archived: false,
    });
    assert.equal(
      (await call(admin, `/v1/institution/services`, template)).status,
      200,
    );
    let eventNumber = 0;
    async function event(title: string) {
      const local = new Date(Date.now() + 86400000 + eventNumber++ * 7200000)
        .toISOString()
        .slice(0, 16);
      const r = await call(
        admin,
        `/v1/institution/calendar`,
        operation("create", {
          view: "admin",
          id: randomUUID(),
          title,
          kind: "assessment",
          template: template.id,
          template_revision: 1,
          staff: [staff.id],
          participants: [member.id],
          local,
          zone: "UTC",
          minutes: 60,
          count: 1,
          every: 7,
          location: "Synthetic acceptance pitch",
        }),
      );
      assert.equal(r.status, 200, JSON.stringify(r));
      const created = r.data[0];
      await db.institution_events.update({
        where: { id: created.id },
        data: {
          starts_at: new Date(Date.now() - 300000),
          ends_at: new Date(Date.now() + 3300000),
        },
      });
      return created;
    }
    const e = await event("API acceptance assessment");
    const path = `/v1/institution/calendar`;
    const read = await native(
      path + `?view=trainer&id=${e.id}&summary=true`,
      token,
    );
    assert.equal(read.status, 200);
    const roster = fieldRoster(read.data, e.id),
      person = roster.people.find((p) => p.member_id === member.id)!;
    const owner = { instance: base, user: coach.id, institution };
    const store = new FieldStore(adapter(sqlite));
    await store.initialize();
    await store.saveRoster(owner, roster);
    let lose = true;
    const sender = async (route: string, body: string) => {
      const result = await native("/v1" + route, token, JSON.parse(body));
      if (result.status !== 200)
        throw new ApiFailure(result.status, result.data.message);
      if (lose) {
        lose = false;
        throw Error("Simulated lost acknowledgement after real server commit");
      }
      return result.data;
    };
    const sync = new AttendanceSync(store, owner, sender);
    const attendance = operation("attendance", {
      view: "trainer" as const,
      id: e.id,
      member: member.id,
      revision: person.revision,
      attendance: "present" as const,
    });
    await store.enqueue(owner, attendance);
    await sync.run();
    assert.equal((await store.next(owner))?.state, "uncertain");
    assert.deepEqual((await store.next(owner))?.payload, attendance);
    await sync.run();
    assert.equal(await store.next(owner), null);
    assert.equal(
      await db.institution_operations.count({
        where: { id: attendance.operation },
      }),
      1,
    );
    assert.equal(
      (await native(path, token, { ...attendance, attendance: "absent" }))
        .status,
      409,
    );
    const raw = {
      member: member.id,
      values: { [drill.key]: "١٢٫٥" },
      note: "Synthetic Arabic decimal / بيانات تجريبية",
    };
    await store.saveDraft(owner, e.id, raw);
    const score = operation("result", {
      view: "trainer" as const,
      id: e.id,
      member: member.id,
      revision: 0,
      values: scoreValues(roster.definition!, raw),
      note: raw.note,
    });
    assert.equal(score.values[drill.key], 12.5);
    await store.enqueue(owner, score);
    lose = true;
    await sync.run();
    assert.equal((await store.next(owner))?.state, "uncertain");
    await sync.run();
    assert.equal(await store.next(owner), null);
    assert.equal(
      await db.assessment_result_history.count({ where: { event_id: e.id } }),
      1,
    );
    const finish = operation("finish", {
      view: "trainer" as const,
      id: e.id,
      revision: roster.event.revision,
    });
    await store.enqueue(owner, finish);
    lose = true;
    await sync.run();
    assert.equal((await store.next(owner))?.state, "uncertain");
    await sync.run();
    assert.equal(await store.snapshot(owner, e.id), null);
    assert.equal(
      (await db.institution_events.findUniqueOrThrow({ where: { id: e.id } }))
        .state,
      "completed",
    );
    for (let revision = 1; revision < 28; revision++)
      assert.equal(
        (
          await native(path, token, {
            ...score,
            operation: randomUUID(),
            revision,
            values: { [drill.key]: 12.5 + revision / 100 },
          })
        ).status,
        200,
      );
    const history =
      path +
      `?view=trainer&id=${e.id}&historyOnly=true&historyMember=${member.id}`;
    for (const kind of ["attendance", "results"]) {
      const first = await native(history + "&historyKind=" + kind, token);
      assert.equal(first.status, 200);
      assert.equal(first.data.items.length, kind === "results" ? 25 : 1);
      if (kind === "results") {
        assert.equal(first.data.next, 25);
        const earlier = await native(
          history + "&historyKind=results&historyOffset=25",
          token,
        );
        assert.equal(earlier.data.items.length, 3);
        assert.equal(earlier.data.next, null);
        assert.ok(
          !earlier.data.items.some((r: any) =>
            first.data.items.some((a: any) => a.id === r.id),
          ),
        );
      }
    }
    assert.equal((await call(outsider, history)).status, 403);
    assert.equal(
      (await call(peer, history.replace("view=trainer", "view=trainee")))
        .status,
      403,
    );
    assert.equal(
      (await native(history.replace(member.id, second.id), token)).status,
      403,
    );
    const conflictEvent = await event("Conflict comparison fixture");
    const conflictRoster = fieldRoster(
      (
        await native(
          path + `?view=trainer&id=${conflictEvent.id}&summary=true`,
          token,
        )
      ).data,
      conflictEvent.id,
    );
    await store.saveRoster(owner, conflictRoster);
    const conflict = {
      ...attendance,
      id: conflictEvent.id,
      revision: 1,
      operation: randomUUID(),
    };
    await store.enqueue(owner, conflict);
    assert.equal(
      (
        await native(path, token, {
          ...conflict,
          operation: randomUUID(),
          attendance: "excused",
        })
      ).status,
      200,
    );
    await sync.run();
    assert.equal((await store.next(owner))?.state, "needs_attention");
    const current = await native(
      path + `?view=trainer&id=${conflictEvent.id}&summary=true`,
      token,
    );
    assert.equal(
      current.data.people.find((p: any) => p.member_id === member.id)
        .attendance,
      "excused",
    );
    assert.deepEqual((await store.next(owner))?.payload, conflict);
    await assert.rejects(
      store.saveRoster(owner, fieldRoster(current.data, conflictEvent.id)),
    );
    await store.remove(owner, conflictEvent.id);
    const revoked = {
      ...attendance,
      id: conflictEvent.id,
      revision: 2,
      operation: randomUUID(),
    };
    await store.saveRoster(owner, fieldRoster(current.data, conflictEvent.id));
    await store.enqueue(owner, revoked);
    await db.institution_members.update({
      where: { id: staff.id },
      data: { active: false },
    });
    await sync.run();
    assert.equal((await store.next(owner))?.state, "blocked");
    assert.equal((await native(history, token)).status, 403);
    assert.equal(
      (await native(path, token, attendance)).status,
      403,
      "even an acknowledged operation must recheck authority",
    );
    assert.deepEqual((await store.next(owner))?.payload, revoked);
    await db.institution_members.update({
      where: { id: staff.id },
      data: { active: true },
    });
    const deviceEvent = await event("Device acceptance / اختبار الجهاز");
    if (process.env.RAFIK_FIELD_DEVICE_FIXTURE) {
      writeFileSync(
        process.env.RAFIK_FIELD_DEVICE_FIXTURE,
        JSON.stringify(
          {
            api: "http://10.0.2.2:55341",
            email: coach.email,
            password,
            institution,
            event: deviceEvent.id,
            member: member.id,
            drill: drill.key,
            coach: coach.id,
            staff: staff.id,
          },
          null,
          2,
        ),
        { mode: 0o600 },
      );
      retained = true;
    }
    assert.equal(
      (
        await native("/v1/mobile/auth/logout", token, {
          refresh_token: freshLogin.data.refresh_token,
        })
      ).status,
      200,
    );
    assert.equal((await native("/v1/mobile/auth/session", token)).status, 401);
  } finally {
    sqlite.close();
    if (!retained) await f.cleanup();
  }
});
