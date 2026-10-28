import {
  setPrimary,
  linkSupportingCoach,
  endSupportingCoach,
} from "./coaching-links.ts";
import { pageOffset } from "./service-definitions.ts";
import { createHash, randomUUID } from "node:crypto";
import {
  db,
  asActor,
  ApiError,
  ensureProfileInTransaction,
  type Actor,
} from "./db.ts";
import type { Prisma } from "./generated/prisma/client.ts";
export type Tx = Prisma.TransactionClient;
export type Role = "admin" | "trainer" | "trainee";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export function uuid(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
      value,
    )
  )
    throw new ApiError(400, "invalid_request");
  return value;
}
export function textValue(value: unknown, max = 100) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw new ApiError(400, "invalid_request");
  return value.trim();
}
function roleList(value: unknown): Role[] {
  if (
    !Array.isArray(value) ||
    value.length !== 1 ||
    value.some((r) => !["admin", "trainer", "trainee"].includes(r))
  )
    throw new ApiError(400, "invalid_roles");
  return value as Role[];
}
function primaryRole(roles: readonly string[]): Role | undefined {
  return (["admin", "trainer", "trainee"] as const).find((role) =>
    roles.includes(role),
  );
}
export async function access(
  tx: Tx,
  actor: Actor,
  id: string,
  roles: Role[] = [],
  allowArchived = false,
) {
  const member = await tx.institution_members.findUnique({
    where: {
      institution_id_user_id: { institution_id: id, user_id: actor.id },
    },
    include: { institutions: true },
  });
  if (
    !member?.active ||
    (member.institutions.archived && !allowArchived) ||
    member.institutions.kind !== "organization" ||
    (roles.length && !roles.includes(primaryRole(member.roles)!))
  )
    throw new ApiError(403, "workspace_unavailable");
  return member;
}
export async function event(
  tx: Tx,
  actor: Actor,
  id: string,
  kind: string,
  subject: string | null,
  detail: Prisma.InputJsonValue = {},
) {
  await tx.institution_audit_events.create({
    data: {
      institution_id: id,
      actor_id: actor.id,
      kind,
      subject_id: subject,
      detail,
    },
  });
}
export async function scoped<T>(
  actor: Actor,
  id: string,
  roles: Role[],
  run: (tx: Tx, member: Awaited<ReturnType<typeof access>>) => Promise<T>,
  allowArchived = false,
) {
  uuid(id);
  return db.$transaction(
    async (tx) => {
      // Membership and command updates share one per-organization lock; revocation wins before replay.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id},73))::text`;
      return run(tx, await access(tx, actor, id, roles, allowArchived));
    },
    { timeout: 15000 },
  );
}
export async function mutation(
  actor: Actor,
  id: string,
  roles: Role[],
  input: Record<string, unknown>,
  run: (tx: Tx, member: Awaited<ReturnType<typeof access>>) => Promise<unknown>,
  authorize?: (
    tx: Tx,
    member: Awaited<ReturnType<typeof access>>,
  ) => Promise<void>,
) {
  const operation = uuid(input.operation);
  return scoped(
    actor,
    id,
    roles,
    async (tx, member) => {
      await authorize?.(tx, member);
      const existing = await tx.institution_operations.findUnique({
        where: { id: operation },
      });
      // Canonical object ordering makes retries stable across serialization implementations.
      const canonical = (v: unknown): unknown =>
        Array.isArray(v)
          ? v.map(canonical)
          : v && typeof v === "object"
            ? Object.fromEntries(
                Object.entries(v)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([k, x]) => [k, canonical(x)]),
              )
            : v;
      const payload = canonical(input) as Prisma.InputJsonValue;
      if (existing) {
        if (
          existing.institution_id !== id ||
          existing.actor_id !== actor.id ||
          JSON.stringify(canonical(existing.payload)) !==
            JSON.stringify(payload)
        )
          throw new ApiError(409, "operation_reused");
        return existing.result;
      }
      if (member.institutions.archived)
        throw new ApiError(403, "workspace_unavailable");
      const result = JSON.parse(
        JSON.stringify(await run(tx, member)),
      ) as Prisma.InputJsonValue;
      await tx.institution_operations.create({
        data: {
          id: operation,
          institution_id: id,
          actor_id: actor.id,
          payload,
          result,
        },
      });
      return result;
    },
    input.action === "close",
  );
}
export async function contexts(actor: Actor) {
  const memberships = await db.institution_members.findMany({
    where: {
      user_id: actor.id,
      active: true,
      institutions: { archived: false, kind: "organization" },
    },
    include: { institutions: true },
    orderBy: { joined_at: "asc" },
  });
  return {
    contexts: memberships.length
      ? memberships.flatMap((m) => {
          const role = primaryRole(m.roles);
          return role
            ? [
                {
                  id: m.institution_id + ":" + role,
                  institution_id: m.institution_id,
                  member_id: m.id,
                  kind: m.institutions.kind,
                  name: m.institutions.name,
                  role,
                  path: "/dashboard",
                },
              ]
            : [];
        })
      : [],
    platform: !!(await db.platform_grants.findUnique({
      where: { user_id: actor.id },
    })),
  };
}
async function ownName(actor: Actor) {
  return asActor(
    actor,
    async (tx) =>
      (
        await tx.profiles.findUnique({
          where: { id: actor.id },
          select: { display_name: true },
        })
      )?.display_name ||
      actor.email?.split("@")[0] ||
      "Member",
  );
}
export async function institutionView(
  actor: Actor,
  id: string,
  view: string,
  query = new URLSearchParams(),
) {
  if (!["admin", "trainer", "trainee"].includes(view))
    throw new ApiError(400, "invalid_request");
  return scoped(actor, id, [view as Role], async (tx, self) => {
    const filter =
      view === "admin"
        ? {}
        : view === "trainer"
          ? { trainer_id: self.id }
          : { id: self.id };
    const members =
      query.get("summary") === "true"
        ? []
        : await tx.institution_members.findMany({
            where: { institution_id: id, ...filter },
            include: {
              users: {
                select: { email: true },
              },
            },
            orderBy: [{ active: "desc" }, { joined_at: "asc" }],
          });
    const ids = new Set(members.map((m) => m.id));
    ids.add(self.id);
    if (self.trainer_id) ids.add(self.trainer_id);
    const names = await tx.institution_members.findMany({
      where: { institution_id: id, id: { in: [...ids] } },
      select: {
        id: true,
        name: true,
      },
    });
    const invitations =
      view === "admin"
        ? await tx.institution_invitations.findMany({
            where: {
              institution_id: id,
              state: "pending",
              expires_at: { gt: new Date() },
            },
            select: { id: true, email: true, roles: true, expires_at: true },
            orderBy: { created_at: "desc" },
            take: 26,
            skip: pageOffset(query.get("invitationOffset")),
          })
        : [];
    const events =
      view === "admin"
        ? await tx.institution_audit_events.findMany({
            where: { institution_id: id },
            orderBy: [{ created_at: "desc" }, { id: "desc" }],
            take: 31,
            skip: pageOffset(query.get("eventOffset")),
          })
        : [];
    return {
      summary: {
        trainees: await tx.institution_members.count({
          where: {
            institution_id: id,
            ...filter,
            active: true,
            roles: { has: "trainee" },
          },
        }),
        trainers:
          view === "admin"
            ? await tx.institution_members.count({
                where: {
                  institution_id: id,
                  active: true,
                  roles: { has: "trainer" },
                },
              })
            : 0,
        unassigned:
          view === "admin"
            ? await tx.institution_members.count({
                where: {
                  institution_id: id,
                  active: true,
                  roles: { has: "trainee" },
                  trainer_id: null,
                },
              })
            : 0,
      },
      institution: {
        id,
        name: self.institutions.name,
        revision: self.institutions.revision,
      },
      self: { id: self.id, roles: self.roles },
      members: members.map(({ users, ...m }) => ({
        ...m,
        name: m.name,
        email: view === "admin" ? users?.email : undefined,
      })),
      names: names.map((m) => ({
        id: m.id,
        name: m.name,
      })),
      invitations: invitations.slice(0, 25),
      invitationsNext:
        invitations.length > 25
          ? pageOffset(query.get("invitationOffset")) + 25
          : null,
      events: await namedEvents(tx, id, events.slice(0, 30)),
      eventsNext:
        events.length > 30 ? pageOffset(query.get("eventOffset")) + 30 : null,
    };
  });
}
/** Activity rows name the acting member and the member they concern, when one is identifiable. */
async function namedEvents<
  T extends {
    actor_id: string | null;
    subject_id: string | null;
    detail: unknown;
  },
>(tx: Tx, institution: string, events: T[]) {
  const memberOf = (event: T) => {
    const member = (event.detail as { member?: unknown } | null)?.member;
    return typeof member === "string" ? member : null;
  };
  const ids = [
    ...new Set(
      events.flatMap((event) =>
        [event.actor_id, event.subject_id, memberOf(event)].filter(
          (value): value is string => !!value,
        ),
      ),
    ),
  ];
  const people = ids.length
    ? await tx.institution_members.findMany({
        where: {
          institution_id: institution,
          OR: [{ id: { in: ids } }, { user_id: { in: ids } }],
        },
        select: { id: true, user_id: true, name: true },
      })
    : [];
  const nameOf = (value: string | null) =>
    value
      ? people.find((m) => m.id === value || m.user_id === value)?.name || null
      : null;
  return events.map((event) => ({
    ...event,
    actor_name: nameOf(event.actor_id),
    subject_name: nameOf(event.subject_id) || nameOf(memberOf(event)),
  }));
}
async function invitationSports(
  tx: Tx,
  institution: string,
  roles: string[],
  value: unknown,
) {
  if (value === undefined) return [] as string[];
  if (!Array.isArray(value) || value.length > 100)
    throw new ApiError(400, "invalid_request");
  const ids = value.map(uuid);
  if (
    new Set(ids).size !== ids.length ||
    (roles.includes("admin") && ids.length)
  )
    throw new ApiError(400, "invalid_request");
  const found = await tx.institution_sports.findMany({
    where: {
      institution_id: institution,
      id: { in: ids },
      archived: false,
      ...(roles.includes("trainee") ? { kind: "sport" } : {}),
    },
    select: { id: true },
  });
  if (found.length !== ids.length) throw new ApiError(400, "sport_unavailable");
  return ids;
}
async function applyInvitationSports(
  tx: Tx,
  invite: {
    institution_id: string;
    roles: string[];
    sport_ids: string[];
    created_by?: string | null;
  },
  member: string,
) {
  const sports = await tx.institution_sports.findMany({
    where: {
      institution_id: invite.institution_id,
      id: { in: invite.sport_ids },
      ...(invite.roles.includes("trainee") ? { kind: "sport" } : {}),
    },
    select: { id: true },
  });
  if (sports.length !== invite.sport_ids.length)
    throw new ApiError(400, "sport_unavailable");
  await tx.institution_member_sports.deleteMany({
    where: { institution_id: invite.institution_id, member_id: member },
  });
  const inviter = invite.created_by
    ? await tx.institution_members.findFirst({
        where: {
          institution_id: invite.institution_id,
          user_id: invite.created_by,
        },
        select: { id: true },
      })
    : null;
  if (sports.length)
    await tx.institution_member_sports.createMany({
      data: sports.map((s) => ({
        institution_id: invite.institution_id,
        member_id: member,
        sport_id: s.id,
        created_by: inviter?.id || member,
      })),
    });
}
export async function institutionCommand(
  actor: Actor,
  id: string,
  input: Record<string, unknown>,
) {
  const persistedInput =
    input.action === "invite" || input.action === "password-link"
      ? { ...input, token: hash(String(input.token)) }
      : input;
  return mutation(actor, id, ["admin"], persistedInput, async (tx, self) => {
    const action = input.action;
    if (action === "invite") {
      const email = textValue(input.email, 254).toLowerCase(),
        roles = roleList(input.roles),
        token = textValue(input.token, 128),
        invite = uuid(input.id);
      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        !/^[a-f0-9]{64}$/.test(token)
      )
        throw new ApiError(400, "invalid_request");
      if (
        await tx.institution_members.findFirst({
          where: { institution_id: id, active: true, users: { email } },
        })
      )
        throw new ApiError(409, "already_member");
      if (
        await tx.institution_invitations.findFirst({
          where: {
            institution_id: id,
            email,
            state: "pending",
            expires_at: { gt: new Date() },
          },
        })
      )
        throw new ApiError(409, "invitation_pending");
      const sportIds = await invitationSports(tx, id, roles, input.sports);
      const result = await tx.institution_invitations.create({
        data: {
          id: invite,
          institution_id: id,
          email,
          roles,
          sport_ids: sportIds,
          token_hash: hash(token),
          created_by: actor.id,
        },
      });
      await event(tx, actor, id, "member_invited", invite, {
        roles,
        sports: sportIds,
      });
      return { id: result.id };
    }
    if (action === "password-link") {
      const member = await tx.institution_members.findFirst({
        where: { id: uuid(input.id), institution_id: id, active: true },
      });
      const token = textValue(input.token, 64);
      if (!member?.user_id || !/^[a-f0-9]{64}$/.test(token))
        throw new ApiError(404, "member_unavailable");
      await tx.password_setup_tokens.deleteMany({
        where: { user_id: member.user_id },
      });
      await tx.password_setup_tokens.create({
        data: {
          token_hash: hash(token),
          user_id: member.user_id,
          institution_id: id,
          created_by: actor.id,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      await event(tx, actor, id, "member_password_setup_issued", member.id);
      return { saved: true };
    }
    if (action === "revoke-invite") {
      const invite = await tx.institution_invitations.findFirst({
        where: { id: uuid(input.id), institution_id: id, state: "pending" },
      });
      if (!invite) throw new ApiError(404, "invitation_unavailable");
      await tx.institution_invitations.update({
        where: { id: invite.id },
        data: { state: "revoked" },
      });
      await event(tx, actor, id, "invitation_revoked", invite.id);
      return { saved: true };
    }
    if (action === "link-coach")
      return linkSupportingCoach(tx, actor, id, self.id, input);
    if (action === "end-coach-link")
      return endSupportingCoach(tx, actor, id, self.id, input);
    if (action === "member" || action === "assign-trainer") {
      const member = await tx.institution_members.findFirst({
        where: { id: uuid(input.id), institution_id: id },
      });
      if (!member) throw new ApiError(404, "member_unavailable");
      if (member.revision !== input.revision)
        throw new ApiError(409, "conflict");
      if (action === "assign-trainer") {
        if (!member.active || !member.roles.includes("trainee"))
          throw new ApiError(400, "invalid_trainee");
        const trainer =
          input.trainer === null
            ? null
            : await tx.institution_members.findFirst({
                where: {
                  id: uuid(input.trainer),
                  institution_id: id,
                  active: true,
                  roles: { has: "trainer" },
                },
              });
        if ((input.trainer !== null && !trainer) || trainer?.id === member.id)
          throw new ApiError(400, "invalid_trainer");
        await setPrimary(tx, id, member.id, trainer?.id || null, self.id);
        const result = await tx.institution_members.update({
          where: { id: member.id },
          data: { trainer_id: trainer?.id || null, revision: { increment: 1 } },
        });
        await event(tx, actor, id, "trainer_assigned", member.id, {
          previous: member.trainer_id,
          trainer: trainer?.id || null,
        });
        return result;
      }
      if (typeof input.active !== "boolean")
        throw new ApiError(400, "invalid_request");
      const roles = roleList(input.roles),
        active = input.active;
      if (
        member.roles.includes("admin") &&
        (!active || !roles.includes("admin")) &&
        (await tx.institution_members.count({
          where: { institution_id: id, active: true, roles: { has: "admin" } },
        })) <= 1
      )
        throw new ApiError(409, "last_admin");
      // Departure leaves visible unassigned duties, without transferring or deleting any trainee record.
      if (!active || !roles.includes("trainer"))
        await tx.institution_members.updateMany({
          where: { institution_id: id, trainer_id: member.id },
          data: { trainer_id: null, revision: { increment: 1 } },
        });
      const result = await tx.institution_members.update({
        where: { id: member.id },
        data: {
          roles,
          active,
          ...(input.name === undefined
            ? {}
            : { name: textValue(input.name, 120) }),
          trainer_id:
            active && roles.includes("trainee") ? member.trainer_id : null,
          revision: { increment: 1 },
        },
      });
      await event(
        tx,
        actor,
        id,
        active ? "member_roles_changed" : "member_removed",
        member.id,
        { roles, ...(input.name === undefined ? {} : { name: result.name }) },
      );
      return result;
    }
    if (action === "rename" || action === "close") {
      if (self.institutions.revision !== input.revision)
        throw new ApiError(409, "conflict");
      if (action === "close" && input.confirm !== self.institutions.name)
        throw new ApiError(400, "name_confirmation_required");
      const result = await tx.institutions.update({
        where: { id },
        data:
          action === "close"
            ? { archived: true, revision: { increment: 1 } }
            : { name: textValue(input.name), revision: { increment: 1 } },
      });
      await event(
        tx,
        actor,
        id,
        action === "close" ? "organization_closed" : "organization_renamed",
        null,
      );
      return result;
    }
    throw new ApiError(400, "invalid_command");
  });
}
export async function invitation(
  token: string,
  actor: Actor | null,
  accept = false,
) {
  if (!/^[a-f0-9]{64}$/.test(token))
    throw new ApiError(404, "invitation_unavailable");
  const invite = await db.institution_invitations.findUnique({
    where: { token_hash: hash(token) },
    include: { institutions: true },
  });
  if (
    !invite ||
    invite.institutions.archived ||
    invite.state === "revoked" ||
    (invite.state === "pending" && invite.expires_at < new Date())
  )
    throw new ApiError(404, "invitation_unavailable");
  if (!accept)
    return {
      organization: invite.institutions.name,
      email: invite.email,
      roles: invite.roles,
      state: invite.state,
      expires_at: invite.expires_at,
    };
  if (!actor) throw new ApiError(401, "unauthenticated");
  const memberName = await ownName(actor);
  if (actor.email !== invite.email) throw new ApiError(403, "wrong_email");
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${invite.institution_id},73))::text`;
    const current = await tx.institution_invitations.findUniqueOrThrow({
      where: { id: invite.id },
      include: { institutions: true },
    });
    if (
      current.institutions.archived ||
      current.state === "revoked" ||
      (current.state === "pending" && current.expires_at < new Date())
    )
      throw new ApiError(404, "invitation_unavailable");
    const prior = await tx.institution_members.findUnique({
      where: {
        institution_id_user_id: {
          institution_id: invite.institution_id,
          user_id: actor.id,
        },
      },
    });
    if (current.state === "accepted") {
      if (!prior?.active) throw new ApiError(403, "workspace_unavailable");
      return {
        institution_id: invite.institution_id,
        role: ["admin", "trainer", "trainee"].find((r) =>
          prior.roles.includes(r),
        ),
      };
    }
    // An invitation is enrollment, never a silent edit to an already active member's roles.
    if (prior?.active) throw new ApiError(409, "already_member");
    const joinedMember = await tx.institution_members.upsert({
      where: {
        institution_id_user_id: {
          institution_id: invite.institution_id,
          user_id: actor.id,
        },
      },
      create: {
        id: randomUUID(),
        institution_id: invite.institution_id,
        user_id: actor.id,
        roles: invite.roles,
        name: memberName,
      },
      update: {
        active: true,
        roles: invite.roles,
        trainer_id: null,
        revision: { increment: 1 },
      },
    });
    await applyInvitationSports(tx, current, joinedMember.id);
    await tx.institution_invitations.update({
      where: { id: invite.id },
      data: { state: "accepted", accepted_by: actor.id },
    });
    await event(tx, actor, invite.institution_id, "member_joined", actor.id, {
      roles: invite.roles,
    });
    return {
      institution_id: invite.institution_id,
      role: ["admin", "trainer", "trainee"].find((r) =>
        invite.roles.includes(r),
      ),
    };
  });
}

export async function acceptInvitationSignup(
  token: string,
  email: string,
  name: string,
  passwordHash: string,
) {
  if (!/^[a-f0-9]{64}$/.test(token))
    throw new ApiError(404, "invitation_unavailable");
  const tokenHash = hash(token),
    normalizedEmail = email.toLowerCase();
  try {
    return await db.$transaction(async (tx) => {
      const preview = await tx.institution_invitations.findUnique({
        where: { token_hash: tokenHash },
        include: { institutions: true },
      });
      if (
        !preview ||
        preview.state !== "pending" ||
        preview.expires_at <= new Date() ||
        preview.institutions.archived
      )
        throw new ApiError(404, "invitation_unavailable");
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${preview.institution_id},73))::text`;
      const current = await tx.institution_invitations.findUnique({
        where: { id: preview.id },
        include: { institutions: true },
      });
      if (
        !current ||
        current.state !== "pending" ||
        current.expires_at <= new Date() ||
        current.institutions.archived
      )
        throw new ApiError(404, "invitation_unavailable");
      if (current.email !== normalizedEmail)
        throw new ApiError(403, "invitation_email_mismatch");
      if (await tx.users.findUnique({ where: { email: normalizedEmail } }))
        throw new ApiError(409, "account_exists");
      const user = await tx.users.create({
        data: {
          email: normalizedEmail,
          password_hash: passwordHash,
          raw_user_meta_data: { display_name: name },
        },
      });
      await ensureProfileInTransaction(
        tx,
        {
          id: user.id,
          email: user.email,
          user_metadata: { display_name: name },
        },
        name,
      );
      const joinedMember = await tx.institution_members.create({
        data: {
          id: randomUUID(),
          institution_id: current.institution_id,
          user_id: user.id,
          roles: current.roles,
          name,
        },
      });
      await applyInvitationSports(tx, current, joinedMember.id);
      await tx.institution_invitations.update({
        where: { id: current.id },
        data: { state: "accepted", accepted_by: user.id },
      });
      const account: Actor = {
        id: user.id,
        email: user.email,
        user_metadata: { display_name: name },
      };
      await event(
        tx,
        account,
        current.institution_id,
        "member_joined",
        user.id,
        {
          roles: current.roles,
        },
      );
      return {
        user,
        institution_id: current.institution_id,
        roles: current.roles,
      };
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    )
      throw new ApiError(409, "account_exists");
    throw error;
  }
}
