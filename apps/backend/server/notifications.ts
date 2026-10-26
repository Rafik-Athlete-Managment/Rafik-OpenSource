import { db, ApiError, type Actor } from "./db.ts";
import { uuid, type Tx } from "./institution.ts";
import { pageOffset } from "./service-definitions.ts";
import type { notification_events as Notification } from "./generated/prisma/client.ts";
export const categories = [
  "messages",
  "feedback",
  "checkins",
  "calendar",
] as const;
export type Preferences = Record<
  (typeof categories)[number],
  { in_app: boolean; email: boolean }
>;
export const defaultCategories = () =>
  Object.fromEntries(
    categories.map((k) => [k, { in_app: true, email: false }]),
  ) as Preferences;
// Independent domains retain RLS. Restore the API role before accessing internal notification tables.
async function asRecipient<T>(
  tx: Tx,
  id: string,
  run: () => Promise<T>,
): Promise<T> {
  await tx.$executeRawUnsafe("SET LOCAL ROLE rafik_user");
  await tx.$queryRaw`SELECT set_config('rafik.actor',${id},true),set_config('rafik.claims',${JSON.stringify({ sub: id })},true)`;
  try {
    return await run();
  } finally {
    await tx.$executeRawUnsafe("SET LOCAL ROLE rafik_api");
  }
}
export async function notificationPreferences(
  actor: Actor,
  input?: Record<string, unknown>,
) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${actor.id},74))::text`;
    let current = await tx.notification_preferences.findUnique({
      where: { user_id: actor.id },
    });
    const profile = await asRecipient(tx, actor.id, () =>
      tx.profiles.findUniqueOrThrow({
        where: { id: actor.id },
        select: { timezone: true },
      }),
    );
    if (!input)
      return {
        ...(current || {
          categories: defaultCategories(),
          quiet_start: 22,
          quiet_end: 8,
          revision: 0,
        }),
        timezone: profile.timezone,
      };
    const c = input.categories as Preferences;
    if (
      !c ||
      typeof c !== "object" ||
      Array.isArray(c) ||
      Object.keys(c).length !== 4 ||
      categories.some(
        (k) =>
          !c[k] ||
          typeof c[k].in_app !== "boolean" ||
          typeof c[k].email !== "boolean" ||
          Object.keys(c[k]).length !== 2,
      )
    )
      throw new ApiError(400, "invalid_request");
    for (const key of ["quiet_start", "quiet_end"])
      if (
        typeof input[key] !== "number" ||
        !Number.isInteger(input[key]) ||
        Number(input[key]) < 0 ||
        Number(input[key]) > 23
      )
        throw new ApiError(400, "invalid_request");
    const values = {
      categories: c,
      quiet_start: Number(input.quiet_start),
      quiet_end: Number(input.quiet_end),
    };
    if ((current?.revision || 0) !== input.revision) {
      if (
        current &&
        categories.every(
          (k) =>
            (current!.categories as Preferences)[k].in_app === c[k].in_app &&
            (current!.categories as Preferences)[k].email === c[k].email,
        ) &&
        current.quiet_start === values.quiet_start &&
        current.quiet_end === values.quiet_end
      )
        return { ...current, timezone: profile.timezone };
      throw new ApiError(409, "conflict");
    }
    current = await tx.notification_preferences.upsert({
      where: { user_id: actor.id },
      create: { user_id: actor.id, ...values },
      update: { ...values, revision: { increment: 1 } },
    });
    return { ...current, timezone: profile.timezone };
  });
}
export async function notificationTarget(
  tx: Tx,
  n: Notification,
): Promise<{ href: string; context: string } | null> {
  if (n.expires_at <= new Date()) return null;
  if (n.institution_id) {
    const m = await tx.institution_members.findUnique({
      where: {
        institution_id_user_id: {
          institution_id: n.institution_id,
          user_id: n.user_id,
        },
      },
      include: { institutions: { select: { name: true, archived: true } } },
    });
    if (!m?.active || m.institutions.archived) return null;
    const view = m.roles.includes("trainer")
        ? "trainer"
        : m.roles.includes("trainee")
          ? "trainee"
          : "admin",
      base = "",
      context = m.institutions.name;
    if (n.source_kind === "organization_message") {
      const message = await tx.institution_messages.findUnique({
        where: { id: n.source_id },
        include: {
          institution_channels: {
            include: {
              institution_channel_members: { where: { member_id: m.id } },
            },
          },
        },
      });
      if (
        !message ||
        !message.institution_channels.institution_channel_members.length
      )
        return null;
      return { href: base + "/messages/" + message.channel_id, context };
    }
    if (
      n.source_kind === "organization_event" ||
      n.source_kind === "organization_reminder" ||
      n.source_kind === "organization_result"
    ) {
      const event = await tx.institution_events.findUnique({
          where: { id: n.source_id },
          include: {
            institution_event_people: { where: { member_id: m.id } },
          },
        }),
        p = event?.institution_event_people[0];
      if (
        !event ||
        !p ||
        !m.roles.includes(p.duty === "staff" ? "trainer" : "trainee")
      )
        return null;
      if (
        n.source_kind === "organization_reminder" &&
        (event.state !== "scheduled" ||
          !event.starts_at ||
          event.starts_at <= new Date() ||
          event.revision !== n.source_revision)
      )
        return null;
      if (
        n.source_kind === "organization_event" &&
        event.revision !== n.source_revision
      )
        return null;
      if (
        n.source_kind === "organization_result" &&
        (!m.roles.includes("trainee") ||
          !(await tx.assessment_results.findUnique({
            where: {
              event_id_member_id: { event_id: event.id, member_id: m.id },
            },
          })))
      )
        return null;
      return {
        href: `/schedule/${event.id}`,
        context,
      };
    }
    if (n.source_kind === "organization_workout") {
      const s = await tx.institution_sessions.findUnique({
        where: { id: n.source_id },
      });
      if (!s || s.member_id !== m.id || !m.roles.includes("trainee"))
        return null;
      return {
        href: `/workout/${s.id}?institution=${n.institution_id}`,
        context,
      };
    }
    return null;
  }
  // Independent sources have no supported browser destination in an institutional installation.
  // Keep historical records for account lifecycle/export; never issue links into retired screens.
  return null;
}

export async function notificationInbox(actor: Actor, q: URLSearchParams) {
  const offset = pageOffset(q.get("offset"));
  return db.$transaction(async (tx) => {
    if (q.get("id")) {
      const n = await tx.notification_events.findUnique({
        where: { id: uuid(q.get("id")) },
      });
      if (!n || n.user_id !== actor.id)
        throw new ApiError(403, "notification_unavailable");
      const target = await notificationTarget(tx, n);
      if (!target) throw new ApiError(403, "notification_unavailable");
      return {
        items: [
          {
            id: n.id,
            category: n.category,
            kind: n.source_kind,
            created_at: n.created_at,
            read_at: n.read_at,
            state: n.state,
            ...target,
          },
        ],
        next: null,
      };
    }
    const pref = await tx.notification_preferences.findUnique({
        where: { user_id: actor.id },
      }),
      c = (pref?.categories || defaultCategories()) as Preferences;
    const enabled = categories.filter((k) => c[k].in_app);
    // One visible prompt per source thread/event. A new message updates the group, not the domain message history.
    const candidates = await tx.$queryRaw<
      Notification[]
    >`SELECT * FROM (SELECT DISTINCT ON (category,source_group) * FROM public.notification_events WHERE user_id=${actor.id}::uuid AND institution_id IS NOT NULL AND category=ANY(${enabled}::text[]) AND expires_at>now() ORDER BY category,source_group,sequence DESC) n ORDER BY sequence DESC LIMIT 26 OFFSET ${offset}`;
    const items = [];
    for (const n of candidates.slice(0, 25)) {
      const target = await notificationTarget(tx, n);
      if (target)
        items.push({
          id: n.id,
          category: n.category,
          kind: n.source_kind,
          created_at: n.created_at,
          read_at: n.read_at,
          state: n.state,
          ...target,
        });
    }
    return { items, next: candidates.length > 25 ? offset + 25 : null };
  });
}
export async function readNotification(
  actor: Actor,
  input: Record<string, unknown>,
) {
  return db.$transaction(async (tx) => {
    const n = await tx.notification_events.findUnique({
      where: { id: uuid(input.id) },
    });
    if (!n || n.user_id !== actor.id || !(await notificationTarget(tx, n)))
      throw new ApiError(403, "notification_unavailable");
    await tx.notification_events.updateMany({
      where: {
        user_id: actor.id,
        source_group: n.source_group,
        category: n.category,
        sequence: { lte: n.sequence },
        read_at: null,
      },
      data: { read_at: new Date() },
    });
    return { read: true };
  });
}
export async function prepareReminders(tx: Tx) {
  await tx.$queryRaw`SELECT public.prepare_notification_reminders()::text`;
}
export interface NotificationSink {
  accept(tx: Tx, event: Notification): Promise<void>;
}
export const localSink: NotificationSink = {
  async accept(tx, n) {
    await tx.notification_intercepts.upsert({
      where: { event_id: n.id },
      create: {
        event_id: n.id,
        user_id: n.user_id,
        subject: "An update is waiting in Rafik",
        body:
          "Sign in to Rafik to review your update: /notifications?event=" +
          n.id,
      },
      update: {},
    });
  },
};
export async function dispatchNotifications(
  sink: NotificationSink = localSink,
) {
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`DELETE FROM public.notification_intercepts WHERE event_id IN(SELECT event_id FROM public.notification_intercepts WHERE created_at<now()-interval '7 days' ORDER BY created_at LIMIT 500)`;
    await tx.$executeRaw`DELETE FROM public.notification_events WHERE id IN(SELECT id FROM public.notification_events WHERE expires_at<=now() ORDER BY expires_at LIMIT 500)`;
    await prepareReminders(tx);
  });
  const pending = await db.notification_events.findMany({
    where: { state: "pending", not_before: { lte: new Date() } },
    orderBy: [{ not_before: "asc" }, { id: "asc" }],
    take: 100,
  });
  const counts = { intercepted: 0, suppressed: 0, deferred: 0, failed: 0 };
  for (const candidate of pending)
    await db.$transaction(
      async (tx) => {
        let n = candidate;
        if (n.institution_id)
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${n.institution_id},73))::text`;
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${n.user_id},74))::text`;
        const claimed = await tx.$queryRaw<
          { id: string }[]
        >`SELECT id FROM public.notification_events WHERE id=${n.id}::uuid AND state='pending' AND not_before<=now() FOR UPDATE SKIP LOCKED`;
        if (!claimed.length) return;
        n = await tx.notification_events.findUniqueOrThrow({
          where: { id: n.id },
        });
        const pref = await tx.notification_preferences.findUnique({
            where: { user_id: n.user_id },
          }),
          c = (pref?.categories || defaultCategories()) as Preferences;
        const target = await notificationTarget(tx, n);
        let reason = !target
          ? "obsolete"
          : n.read_at
            ? "read"
            : !c[n.category as keyof Preferences].email
              ? "opted_out"
              : "";
        if (!reason && n.category === "messages") {
          const newer = await tx.notification_events.findFirst({
            where: {
              user_id: n.user_id,
              category: n.category,
              source_group: n.source_group,
              sequence: { gt: n.sequence },
            },
            select: { id: true },
          });
          if (newer) reason = "coalesced";
        }
        if (reason) {
          await tx.notification_events.update({
            where: { id: n.id },
            data: { state: "suppressed", reason },
          });
          counts.suppressed++;
          return;
        }
        const p = await asRecipient(tx, n.user_id, () =>
            tx.profiles.findUniqueOrThrow({
              where: { id: n.user_id },
              select: { timezone: true },
            }),
          ),
          start = pref?.quiet_start ?? 22,
          end = pref?.quiet_end ?? 8;
        const [quiet] = await tx.$queryRaw<
          { hour: number; until: Date }[]
        >`SELECT extract(hour from now() AT TIME ZONE ${p.timezone})::int AS "hour",(((now() AT TIME ZONE ${p.timezone})::date + CASE WHEN extract(hour from now() AT TIME ZONE ${p.timezone})>=${end} THEN 1 ELSE 0 END)::timestamp+make_interval(hours=>${end}::int)) AT TIME ZONE ${p.timezone} AS "until"`;
        const quietNow =
          start !== end &&
          (start < end
            ? quiet.hour >= start && quiet.hour < end
            : quiet.hour >= start || quiet.hour < end);
        if (quietNow) {
          await tx.notification_events.update({
            where: { id: n.id },
            data: { not_before: quiet.until, reason: "quiet_hours" },
          });
          counts.deferred++;
          return;
        }
        if (n.category === "messages") {
          const previous = await tx.notification_intercepts.findFirst({
            where: {
              event_id: { not: n.id },
              user_id: n.user_id,
              created_at: { gt: new Date(Date.now() - 300000) },
              notification_events: {
                source_group: n.source_group,
                category: "messages",
              },
            },
            orderBy: { created_at: "desc" },
          });
          if (previous) {
            await tx.notification_events.update({
              where: { id: n.id },
              data: {
                not_before: new Date(previous.created_at.getTime() + 300000),
                reason: "coalesced_wait",
              },
            });
            counts.deferred++;
            return;
          }
        }
        await tx.$executeRawUnsafe("SAVEPOINT notification_sink");
        try {
          await sink.accept(tx, n);
          await tx.$executeRawUnsafe("RELEASE SAVEPOINT notification_sink");
          await tx.notification_events.update({
            where: { id: n.id },
            data: {
              state: "intercepted",
              attempts: { increment: 1 },
              reason: "",
            },
          });
          counts.intercepted++;
        } catch {
          await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT notification_sink");
          const attempts = n.attempts + 1;
          await tx.notification_events.update({
            where: { id: n.id },
            data: {
              attempts,
              state: attempts >= 5 ? "failed" : "pending",
              reason: "sink_failed",
              not_before: new Date(
                Date.now() + Math.min(3600000, 60000 * 2 ** (attempts - 1)),
              ),
            },
          });
          counts.failed++;
        }
      },
      { timeout: 15000 },
    );
  return counts;
}
