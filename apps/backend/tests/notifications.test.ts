import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../server/db.ts";
import {
  dispatchNotifications,
  localSink,
  defaultCategories,
  notificationTarget,
} from "../server/notifications.ts";
import {
  organizationFixture,
  call,
  operation,
} from "./organization-fixture.ts";
after(() => db.$disconnect());
test("notification intent, scoped inbox, preferences, quiet hours, retry and local interception are distinct from message reads", async () => {
  const f = await organizationFixture();
  try {
    const admin = await f.person(),
      client = await f.person(),
      other = await f.person(),
      id = await f.create(admin),
      trainee = await f.join(admin, id, client, ["trainee"]),
      self = await db.institution_members.findUniqueOrThrow({
        where: {
          institution_id_user_id: { institution_id: id, user_id: admin.id },
        },
      }),
      channel = randomUUID();
    await call(
      admin,
      `/v1/institution/communication`,
      operation("create", {
        id: channel,
        view: "admin",
        title: "Private coaching",
        members: [self.id, trainee.id],
        managers: [self.id],
      }),
    );
    const send = operation("send", {
      id: channel,
      view: "admin",
      message: randomUUID(),
      body: "Private assessment detail must never enter an email preview.",
    });
    assert.equal(
      (await call(admin, `/v1/institution/communication`, send)).status,
      200,
    );
    await call(admin, `/v1/institution/communication`, send);
    let rows = await db.notification_events.findMany({
      where: { user_id: client.id, institution_id: id },
    });
    assert.equal(rows.length, 1, "domain retry captures one intent");
    const notification = rows[0];
    // Retired sources must not consume the first page and hide a valid institution update.
    await db.notification_events.createMany({
      data: Array.from({ length: 26 }, () => ({
        user_id: client.id,
        institution_id: null,
        category: "messages",
        source_kind: "message",
        source_id: randomUUID(),
        source_group: randomUUID(),
        event_key: randomUUID(),
      })),
    });
    const inbox = await call(client, "/v1/notifications");
    assert.equal(inbox.status, 200, JSON.stringify(inbox));
    assert.equal(inbox.data.items.length, 1);
    assert.equal(
      inbox.data.next,
      null,
      "retired rows never consume institution inbox pages",
    );
    assert.match(inbox.data.items[0].href, new RegExp(channel));
    assert.equal(
      (await call(other, "/v1/notifications?id=" + notification.id)).status,
      403,
    );
    assert.equal(
      (await call(other, "/v1/notifications", { id: notification.id })).status,
      403,
    );
    const categories = defaultCategories();
    categories.messages.email = true;
    const pref = { categories, quiet_start: 0, quiet_end: 0, revision: 0 };
    let p = await call(client, "/v1/notifications/preferences", pref);
    assert.equal(p.status, 200);
    assert.equal(
      (await call(client, "/v1/notifications/preferences", pref)).status,
      200,
      "lost preference acknowledgment replays without revision churn",
    );
    await dispatchNotifications({
      async accept(tx, n) {
        await localSink.accept(tx, n);
        if (n.id === notification.id)
          throw Error("simulated lost local sink acknowledgment");
      },
    });
    let n = await db.notification_events.findUniqueOrThrow({
      where: { id: notification.id },
    });
    assert.equal(n.state, "pending");
    assert.equal(n.attempts, 1);
    assert.equal(
      await db.notification_intercepts.count({ where: { event_id: n.id } }),
      0,
      "failed sink transaction rolls back its partial local receipt",
    );
    await db.notification_events.update({
      where: { id: n.id },
      data: { not_before: new Date(0) },
    });
    await Promise.all([dispatchNotifications(), dispatchNotifications()]);
    n = await db.notification_events.findUniqueOrThrow({ where: { id: n.id } });
    assert.equal(n.state, "intercepted");
    assert.equal(n.read_at, null, "acceptance is not a read receipt");
    const captures = await db.notification_intercepts.findMany({
      where: { event_id: n.id },
    });
    assert.equal(captures.length, 1);
    assert.ok(!captures[0].body.includes("Private assessment"));
    assert.match(captures[0].body, /\/notifications\?event=/);
    await call(client, "/v1/notifications", { id: n.id });
    assert.ok(
      (await db.notification_events.findUniqueOrThrow({ where: { id: n.id } }))
        .read_at,
    );
    const hour = new Date().getUTCHours();
    await call(client, "/v1/commands/update_profile", {
      p_name: "Notification trainee",
      p_locale: "en",
      p_units: "metric",
      p_timezone: "UTC",
    });
    p = await call(client, "/v1/notifications/preferences", {
      categories,
      quiet_start: hour,
      quiet_end: (hour + 1) % 24,
      revision: 1,
    });
    assert.equal(p.status, 200);
    const second = {
      ...send,
      operation: randomUUID(),
      message: randomUUID(),
      body: "A quiet-hours update",
    };
    await call(admin, `/v1/institution/communication`, second);
    await dispatchNotifications();
    const quiet = await db.notification_events.findFirstOrThrow({
      where: { source_id: second.message },
    });
    assert.equal(quiet.reason, "quiet_hours");
    assert.equal(quiet.state, "pending");
    assert.ok(quiet.not_before > new Date());
    categories.messages.email = false;
    categories.messages.in_app = false;
    assert.equal(
      (
        await call(client, "/v1/notifications/preferences", {
          categories,
          quiet_start: 0,
          quiet_end: 0,
          revision: 2,
        })
      ).status,
      200,
    );
    await db.notification_events.update({
      where: { id: quiet.id },
      data: { not_before: new Date(0) },
    });
    await dispatchNotifications();
    assert.equal(
      (
        await db.notification_events.findUniqueOrThrow({
          where: { id: quiet.id },
        })
      ).reason,
      "opted_out",
    );
    assert.equal(
      (await call(client, "/v1/notifications")).data.items.length,
      0,
    );
    categories.messages.email = true;
    categories.messages.in_app = true;
    await call(client, "/v1/notifications/preferences", {
      categories,
      quiet_start: 0,
      quiet_end: 0,
      revision: 3,
    });
    const third = {
      ...send,
      operation: randomUUID(),
      message: randomUUID(),
      body: "An update before removal",
    };
    await call(admin, `/v1/institution/communication`, third);
    await call(
      admin,
      `/v1/institution`,
      operation("member", {
        id: trainee.id,
        revision: 1,
        roles: ["trainee"],
        active: false,
      }),
    );
    await dispatchNotifications();
    assert.equal(
      (
        await db.notification_events.findFirstOrThrow({
          where: { source_id: third.message },
        })
      ).reason,
      "obsolete",
    );
    assert.equal(
      (await call(client, "/v1/notifications")).data.items.length,
      0,
    );
  } finally {
    await f.cleanup();
  }
});

test("retired independent notifications never publish unsupported browser targets", async () => {
  for (const source_kind of [
    "message",
    "workout",
    "checkin_due",
    "form_feedback",
    "appointment_change",
    "appointment_reminder",
  ]) {
    const target = await notificationTarget(
      {} as any,
      {
        source_kind,
        institution_id: null,
        expires_at: new Date(Date.now() + 60_000),
      } as any,
    );
    assert.equal(target, null, source_kind);
  }
});
