import type { support_cases } from "./generated/prisma/client.ts";
import { db, ApiError, type Actor } from "./db.ts";
import { uuid, textValue, type Tx } from "./institution.ts";
import { pageOffset } from "./service-definitions.ts";
import { createHash } from "node:crypto";
async function operator(tx: Tx, actor: Actor) {
  const grants = await tx.$queryRaw<
    unknown[]
  >`SELECT user_id FROM public.platform_grants WHERE user_id=${actor.id}::uuid`;
  if (!grants.length) throw new ApiError(403, "forbidden");
}
export async function platformRead(actor: Actor, q: URLSearchParams) {
  return db.$transaction(async (tx) => {
    await operator(tx, actor);
    const section = q.get("section") || "organizations",
      offset = pageOffset(q.get("offset")),
      search = (q.get("search") || "").slice(0, 100);
    let rows: unknown[];
    if (section === "organizations")
      rows = await tx.institutions.findMany({
        where: {
          kind: "organization",
          name: { contains: search, mode: "insensitive" },
        },
        select: {
          id: true,
          name: true,
          archived: true,
          revision: true,
          created_at: true,
          _count: { select: { institution_members: true } },
        },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take: 26,
        skip: offset,
      });
    else if (section === "users")
      rows = await tx.$queryRaw<
        {
          id: string;
          email: string | null;
          created_at: Date;
          suspended: boolean;
          revision: number;
          operator: boolean;
        }[]
      >`SELECT u.id,u.email,u.created_at,coalesce(s.suspended,false) suspended,coalesce(s.revision,0) revision,EXISTS(SELECT 1 FROM public.platform_grants g WHERE g.user_id=u.id) operator FROM identity.users u LEFT JOIN public.platform_identity_state s ON s.user_id=u.id WHERE u.email ILIKE ${"%" + search + "%"} ORDER BY u.email,u.id LIMIT 26 OFFSET ${offset}`;
    else if (section === "support")
      rows = await tx.$queryRaw<
        support_cases[]
      >`SELECT * FROM public.platform_support_read(${actor.id}::uuid,${"%" + search + "%"},${offset}::int)`;
    else if (section === "audit")
      rows = (
        await tx.platform_operations.findMany({
          where:
            q.get("includeReads") === "true"
              ? {}
              : { NOT: { kind: { startsWith: "view_" } } },
          select: {
            id: true,
            actor_id: true,
            kind: true,
            subject_id: true,
            reason: true,
            created_at: true,
            payload: true,
            users: { select: { email: true, raw_user_meta_data: true } },
          },
          orderBy: [{ created_at: "desc" }, { id: "desc" }],
          take: 26,
          skip: offset,
        })
      ).map((r) => ({
        ...r,
        actor_name:
          (r.users?.raw_user_meta_data as { display_name?: string } | null)
            ?.display_name ||
          r.users?.email ||
          null,
        subject_label:
          (r.payload as { subjectLabel?: string } | null)?.subjectLabel || null,
        users: undefined,
        payload: undefined,
      }));
    else throw new ApiError(400, "invalid_request");
    // Audits record the operational scope, not copied message bodies or search text.
    await tx.platform_operations.create({
      data: {
        id: crypto.randomUUID(),
        actor_id: actor.id,
        kind: "view_" + section,
        reason: "Operational list access",
        payload: { offset },
        result: { count: Math.min(rows.length, 25) },
      },
    });
    return {
      items: rows.slice(0, 25),
      next: rows.length > 25 ? offset + 25 : null,
    };
  });
}
export async function platformCommand(
  actor: Actor,
  input: Record<string, unknown>,
) {
  const operation = uuid(input.operation),
    id = uuid(input.id),
    action = String(input.action),
    reason = textValue(input.reason, 500);
  if (
    typeof input.revision !== "number" ||
    !Number.isSafeInteger(input.revision) ||
    input.revision < 0
  )
    throw new ApiError(400, "invalid_request");
  if (reason.length < 10) throw new ApiError(400, "invalid_request");
  const payload = JSON.stringify({
    action,
    id,
    reason,
    revision: input.revision,
    value: input.value,
    reply: input.reply,
  });
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('platform-operations',75))::text`;
    await operator(tx, actor);
    const old = await tx.platform_operations.findUnique({
        where: { id: operation },
      }),
      digest = createHash("sha256").update(payload).digest("hex");
    if (old) {
      if (
        old.actor_id !== actor.id ||
        (old.payload as { digest?: string }).digest !== digest
      )
        throw new ApiError(409, "operation_reused");
      return old.result;
    }
    let result: unknown;
    if (action === "organization_state") {
      if (typeof input.value !== "boolean")
        throw new ApiError(400, "invalid_request");
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id},73))::text`;
      const w = await tx.institutions.findUnique({ where: { id } });
      if (!w || w.kind !== "organization")
        throw new ApiError(404, "workspace_unavailable");
      if (w.revision !== input.revision) throw new ApiError(409, "conflict");
      if (
        !input.value &&
        !(await tx.institution_members.count({
          where: { institution_id: id, active: true, roles: { has: "admin" } },
        }))
      )
        throw new ApiError(400, "last_admin");
      result = await tx.institutions.update({
        where: { id },
        data: { archived: input.value, revision: { increment: 1 } },
      });
    } else if (action === "identity_state") {
      if (typeof input.value !== "boolean")
        throw new ApiError(400, "invalid_request");
      if (
        id === actor.id ||
        (await tx.platform_grants.findUnique({ where: { user_id: id } }))
      )
        throw new ApiError(403, "forbidden");
      if (!(await tx.users.findUnique({ where: { id } })))
        throw new ApiError(404, "member_unavailable");
      const state = await tx.platform_identity_state.findUnique({
        where: { user_id: id },
      });
      if ((state?.revision || 0) !== input.revision)
        throw new ApiError(409, "conflict");
      result = await tx.platform_identity_state.upsert({
        where: { user_id: id },
        create: { user_id: id, suspended: input.value },
        update: { suspended: input.value, revision: { increment: 1 } },
      });
      if (input.value)
        await tx.identity_sessions.deleteMany({ where: { user_id: id } });
    } else if (action === "support_reply") {
      const reply = textValue(input.reply, 4000);
      const rows = await tx.$queryRaw<
        { result: unknown }[]
      >`SELECT public.platform_support_reply(${actor.id}::uuid,${id}::uuid,${Number(input.revision)}::int,${reply}) result`;
      result = rows[0].result;
    } else throw new ApiError(400, "invalid_request");
    const json = JSON.parse(JSON.stringify(result));
    const subjectLabel =
      action === "identity_state"
        ? (
            await tx.users.findUnique({
              where: { id },
              select: { email: true },
            })
          )?.email
        : json.name || json.subject;
    await tx.platform_operations.create({
      data: {
        id: operation,
        actor_id: actor.id,
        kind: action,
        subject_id: id,
        reason,
        payload: { digest, subjectLabel },
        result: json,
      },
    });
    return json;
  });
}
