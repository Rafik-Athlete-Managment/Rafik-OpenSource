import { ApiError, type Actor } from "./db.ts";
import {
  scoped,
  mutation,
  event,
  uuid,
  textValue,
  type Tx,
  type Role,
  access,
} from "./institution.ts";
import { role, recipient, coaches } from "./programming.ts";
import { ids, pageOffset } from "./service-definitions.ts";
type Self = Awaited<ReturnType<typeof access>>;
function messageAssets(input: Record<string, unknown>): string[] {
  if (
    input.asset_ids !== undefined &&
    (!Array.isArray(input.asset_ids) || input.asset_ids.length > 10)
  )
    throw new ApiError(400, "invalid_request");
  const assets =
    input.asset_ids !== undefined
      ? (input.asset_ids as unknown[]).map(uuid)
      : input.asset_id
        ? [uuid(input.asset_id)]
        : [];
  if (
    new Set(assets).size !== assets.length ||
    (input.asset_id && assets[0] !== uuid(input.asset_id))
  )
    throw new ApiError(400, "invalid_request");
  return assets;
}
export async function channelAccess(
  tx: Tx,
  id: string,
  self: Self,
  key: string,
  view: Role,
  manage = false,
) {
  const channel = await tx.institution_channels.findUnique({
    where: { id: uuid(key) },
    include: {
      institution_channel_members: {
        include: {
          institution_members: {
            select: {
              id: true,
              name: true,
              active: true,
              roles: true,
              user_id: true,
            },
          },
        },
      },
    },
  });
  if (!channel || channel.institution_id !== id)
    throw new ApiError(403, "conversation_unavailable");
  const own = channel.institution_channel_members.find(
    (m) => m.member_id === self.id,
  );
  if (channel.private_pair && !own)
    throw new ApiError(403, "conversation_unavailable");
  if (manage ? view !== "admin" && (view !== "trainer" || !own?.manager) : !own)
    throw new ApiError(403, "conversation_unavailable");
  return channel;
}
export async function communication(
  actor: Actor,
  id: string,
  q: URLSearchParams,
) {
  const view = role(q.get("view"));
  return scoped(actor, id, [view], async (tx, self) => {
    if (q.get("contacts") === "true") {
      const links =
        view === "trainee"
          ? await tx.institution_coaching_links.findMany({
              where: {
                institution_id: id,
                athlete_member_id: self.id,
                ended_at: null,
              },
              select: { coach_member_id: true },
            })
          : [];
      const candidates = await tx.institution_members.findMany({
        where: {
          institution_id: id,
          active: true,
          id: { not: self.id },
          ...(view === "trainee"
            ? {
                roles: { has: "trainer" },
                OR: [
                  { id: self.trainer_id || self.id },
                  { id: { in: links.map((link) => link.coach_member_id) } },
                ],
              }
            : view === "trainer"
              ? {
                  OR: [
                    { trainer_id: self.id },
                    {
                      coaching_as_athlete: {
                        some: { coach_member_id: self.id, ended_at: null },
                      },
                    },
                  ],
                }
              : {}),
        },
        select: { id: true, name: true, roles: true, active: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      });
      return { self: { id: self.id, roles: self.roles }, members: candidates };
    }
    if (q.get("id")) {
      const c = await channelAccess(tx, id, self, q.get("id")!, view),
        before = q.get("before");
      if (before !== null && !/^\d{1,15}$/.test(before))
        throw new ApiError(400, "invalid_request");
      const messages = await tx.institution_messages.findMany({
        where: {
          channel_id: c.id,
          ...(before ? { sequence: { lt: BigInt(before) } } : {}),
        },
        include: {
          institution_members: { select: { name: true } },
          institution_message_assets: {
            orderBy: { position: "asc" },
            include: {
              institution_assets: {
                select: { filename: true, media_type: true },
              },
            },
          },
        },
        orderBy: { sequence: "desc" },
        take: 51,
      });
      return {
        channel: {
          id: c.id,
          title: c.title,
          revision: c.revision,
          archived: c.archived,
          private_pair: c.private_pair,
        },
        self: self.id,
        canManage:
          view === "admin" ||
          (view === "trainer" &&
            c.institution_channel_members.some(
              (m) => m.member_id === self.id && m.manager,
            )),
        people: c.institution_channel_members.map((m) => ({
          id: m.member_id,
          manager: m.manager,
          name: m.institution_members.name,
          active: m.institution_members.active,
        })),
        messages: messages
          .slice(0, 50)
          .reverse()
          .map((m) => ({
            ...m,
            sequence: Number(m.sequence),
            institution_members: undefined,
            institution_message_assets: undefined,
            asset_ids: m.institution_message_assets.map((a) => a.asset_id),
            // Same channel audience as the bytes; lets recipients identify non-image files.
            attachments: m.institution_message_assets.map((a) => ({
              id: a.asset_id,
              filename: a.institution_assets.filename,
              media_type: a.institution_assets.media_type,
            })),
            name: m.institution_members.name,
          })),
        more: messages.length > 50,
      };
    }
    const offset = pageOffset(q.get("offset")),
      search = "%" + (q.get("search") || "").slice(0, 100) + "%",
      manage = q.get("manage") === "true" && view === "admin";
    const list = await tx.$queryRaw<
      {
        id: string;
        title: string;
        revision: number;
        archived: boolean;
        last_body: string | null;
        last_sequence: bigint | null;
        unread: bigint;
      }[]
    >`SELECT c.id,c.title,c.revision,c.archived,last.body last_body,last.sequence last_sequence,(SELECT count(*) FROM public.institution_messages m WHERE m.channel_id=c.id AND m.sender_id<>${self.id}::uuid AND m.sequence>coalesce(r.sequence,0)) unread FROM public.institution_channels c LEFT JOIN public.institution_channel_reads r ON r.channel_id=c.id AND r.member_id=${self.id}::uuid LEFT JOIN LATERAL(SELECT body,sequence FROM public.institution_messages WHERE channel_id=c.id ORDER BY sequence DESC LIMIT 1) last ON true WHERE c.institution_id=${id}::uuid AND (c.title ILIKE ${search} OR EXISTS(SELECT 1 FROM public.institution_channel_members search_member JOIN public.institution_members search_person ON search_person.id=search_member.member_id WHERE search_member.channel_id=c.id AND search_member.member_id<>${self.id}::uuid AND c.private_pair AND search_person.name ILIKE ${search})) AND ((${manage} AND NOT c.private_pair) OR EXISTS(SELECT 1 FROM public.institution_channel_members p WHERE p.channel_id=c.id AND p.member_id=${self.id}::uuid)) ORDER BY last.sequence DESC NULLS LAST,c.id LIMIT 26 OFFSET ${offset}`;
    const directPeople = await tx.$queryRaw<{ member_id: string }[]>`
      SELECT DISTINCT other.member_id
      FROM public.institution_channels c
      JOIN public.institution_channel_members own
        ON own.channel_id = c.id AND own.member_id = ${self.id}::uuid
      JOIN public.institution_channel_members other
        ON other.channel_id = c.id AND other.member_id <> ${self.id}::uuid
      WHERE c.institution_id = ${id}::uuid AND c.private_pair = true`;
    // Management discovery exposes channel metadata only; it cannot disclose message previews/counts before joining.
    const groups =
      view === "trainee"
        ? []
        : await tx.$queryRaw<{ id: string; name: string }[]>`
      SELECT g.id,g.name FROM public.institution_groups g
      WHERE g.institution_id=${id}::uuid AND NOT g.archived AND g.name ILIKE ${search}
      AND (${view === "admin"} OR g.created_by=${self.id}::uuid OR EXISTS (SELECT 1 FROM public.institution_group_members gm WHERE gm.group_id=g.id AND gm.member_id=${self.id}::uuid))
      AND NOT EXISTS (SELECT 1 FROM public.institution_channels c WHERE c.institution_id=g.institution_id AND c.conversation_group_id=g.id)
      ORDER BY g.name,g.id`;
    return {
      self: self.id,
      groups,
      directPeople: directPeople.map((person) => person.member_id),
      items: list.slice(0, 25).map((c) => ({
        ...c,
        last_body: manage ? null : c.last_body,
        last_sequence: manage ? null : Number(c.last_sequence || 0),
        unread: manage ? 0 : Number(c.unread),
      })),
      next: list.length > 25 ? offset + 25 : null,
    };
  });
}
async function selectedPeople(
  tx: Tx,
  id: string,
  self: Self,
  view: Role,
  input: Record<string, unknown>,
  group = false,
) {
  const members = ids(input.members, 100),
    managers = ids(input.managers, 8);
  if (managers.some((m) => !members.includes(m)))
    throw new ApiError(400, "invalid_recipients");
  const people = await tx.institution_members.findMany({
    where: { institution_id: id, id: { in: members }, active: true },
  });
  if (
    people.length !== members.length ||
    managers.some(
      (m) =>
        !people.some(
          (p) =>
            p.id === m &&
            (p.roles.includes("admin") || p.roles.includes("trainer")),
        ),
    )
  )
    throw new ApiError(400, "invalid_recipients");
  if (
    view === "trainer" &&
    (!members.includes(self.id) || !managers.includes(self.id))
  )
    throw new ApiError(400, "invalid_recipients");
  if (view === "trainee") {
    const other = people.find((person) => person.id !== self.id);
    if (
      members.length !== 2 ||
      !members.includes(self.id) ||
      !other?.roles.includes("trainer") ||
      !(await coaches(tx, self, other.id, "training")) ||
      managers.length !== 1 ||
      managers[0] !== other.id
    )
      throw new ApiError(403, "invalid_recipients");
  }
  if (view === "trainer" && !group)
    for (const m of people)
      if (m.id !== self.id)
        await recipient(tx, id, self, view, m.id, true, "training");
  return { members, managers };
}
export async function communicationCommand(
  actor: Actor,
  id: string,
  input: Record<string, unknown>,
) {
  const view = role(input.view),
    key = uuid(input.id),
    action = String(input.action);
  if (action === "read")
    return scoped(actor, id, [view], async (tx, self) => {
      await channelAccess(tx, id, self, key, view);

      if (
        typeof input.sequence !== "number" ||
        !Number.isSafeInteger(input.sequence) ||
        input.sequence < 1
      )
        throw new ApiError(400, "invalid_request");
      if (
        !(await tx.institution_messages.findFirst({
          where: { channel_id: key, sequence: BigInt(input.sequence) },
        }))
      )
        throw new ApiError(400, "invalid_request");
      await tx.$executeRaw`INSERT INTO public.institution_channel_reads(channel_id,institution_id,member_id,sequence) VALUES(${key}::uuid,${id}::uuid,${self.id}::uuid,${BigInt(input.sequence)}) ON CONFLICT(channel_id,member_id) DO UPDATE SET sequence=greatest(institution_channel_reads.sequence,excluded.sequence)`;
      return { read: true };
    });
  const authorize = async (tx: Tx, self: Self) => {
    if (action === "send") {
      for (const asset of messageAssets(input)) {
        const found = await tx.institution_assets.findFirst({
          where: {
            id: asset,
            institution_id: id,
            channel_id: key,
            owner_id: self.id,
            purpose: "message",
            retired: false,
          },
        });
        if (!found) throw new ApiError(403, "resource_unavailable");
      }
    }
    if (action === "open-group") {
      if (view === "trainee") throw new ApiError(403, "forbidden");
      const group = await tx.institution_groups.findFirst({
        where: {
          id: key,
          institution_id: id,
          archived: false,
          ...(view === "admin"
            ? {}
            : {
                OR: [
                  { created_by: self.id },
                  {
                    institution_group_members: { some: { member_id: self.id } },
                  },
                ],
              }),
        },
        include: {
          institution_group_members: {
            include: { institution_members: { select: { active: true } } },
          },
        },
      });
      if (!group) throw new ApiError(404, "group_unavailable");
      const members = [
        ...new Set([
          self.id,
          ...group.institution_group_members
            .filter((member) => member.institution_members.active)
            .map((member) => member.member_id),
        ]),
      ];
      if (new Set(members).size < 2)
        throw new ApiError(400, "invalid_recipients");
      await selectedPeople(
        tx,
        id,
        self,
        view,
        {
          members,
          managers: [self.id],
        },
        true,
      );
      return;
    }
    if (action === "create") {
      await selectedPeople(tx, id, self, view, input);
    } else
      await channelAccess(
        tx,
        id,
        self,
        key,
        view,
        ["members", "archive", "rename", "join"].includes(action),
      );
  };
  return mutation(
    actor,
    id,
    [view],
    input,
    async (tx, self) => {
      if (action === "open-group") {
        const group = await tx.institution_groups.findFirst({
          where: {
            id: key,
            institution_id: id,
            archived: false,
            ...(view === "admin"
              ? {}
              : {
                  OR: [
                    { created_by: self.id },
                    {
                      institution_group_members: {
                        some: { member_id: self.id },
                      },
                    },
                  ],
                }),
          },
          include: {
            institution_group_members: {
              include: {
                institution_members: { select: { active: true } },
              },
            },
          },
        });
        if (!group) throw new ApiError(404, "group_unavailable");
        const members = [
            ...new Set([
              self.id,
              ...group.institution_group_members
                .filter((member) => member.institution_members.active)
                .map((member) => member.member_id),
            ]),
          ],
          { managers } = await selectedPeople(
            tx,
            id,
            self,
            view,
            {
              members,
              managers: [self.id],
            },
            true,
          );
        let channel = await tx.institution_channels.findFirst({
          where: { institution_id: id, conversation_group_id: group.id },
        });
        if (channel) {
          if (channel.private_pair)
            await channelAccess(tx, id, self, channel.id, view);
          else if (
            !(await tx.institution_channel_members.findUnique({
              where: {
                channel_id_member_id: {
                  channel_id: channel.id,
                  member_id: self.id,
                },
              },
            }))
          ) {
            if (
              (await tx.institution_channel_members.count({
                where: { channel_id: channel.id },
              })) >= 100
            )
              throw new ApiError(400, "invalid_recipients");
            await tx.institution_channel_members.create({
              data: {
                institution_id: id,
                channel_id: channel.id,
                member_id: self.id,
                manager: false,
              },
            });
            await event(tx, actor, id, "conversation_joined", channel.id, {
              member: self.id,
            });
          }
          if (channel.archived)
            channel = await tx.institution_channels.update({
              where: { id: channel.id },
              data: {
                archived: false,
                ...(channel.conversation_group_id
                  ? {}
                  : { conversation_group_id: group.id }),
                revision: { increment: 1 },
              },
            });
          return channel;
        }
        const channelId = uuid(input.id),
          inserted = await tx.$queryRaw<{ id: string }[]>`
            INSERT INTO public.institution_channels
              (id, institution_id, title, created_by, private_pair, private_pair_key, conversation_group_id)
            VALUES
              (${channelId}::uuid, ${id}::uuid, ${group.name}, ${self.id}::uuid,
               false, NULL, ${group.id}::uuid)
            ON CONFLICT DO NOTHING
            RETURNING id`;
        if (inserted.length) {
          await tx.institution_channel_members.createMany({
            data: members.map((member_id) => ({
              channel_id: channelId,
              institution_id: id,
              member_id,
              manager: managers.includes(member_id),
            })),
          });
          await event(tx, actor, id, "conversation_created", channelId, {
            group: group.id,
            members,
            managers,
          });
          return tx.institution_channels.findUniqueOrThrow({
            where: { id: channelId },
          });
        }
        channel = await tx.institution_channels.findFirst({
          where: {
            institution_id: id,
            conversation_group_id: group.id,
          },
        });
        if (!channel) throw new ApiError(409, "conversation_conflict");
        if (channel.archived)
          channel = await tx.institution_channels.update({
            where: { id: channel.id },
            data: { archived: false, revision: { increment: 1 } },
          });
        return channel;
      }
      if (action === "create") {
        const { members, managers } = await selectedPeople(
          tx,
          id,
          self,
          view,
          input,
        );
        if (
          !members.includes(self.id) ||
          (view !== "trainee" && !managers.includes(self.id))
        )
          throw new ApiError(400, "invalid_recipients");
        const privatePair = members.length === 2,
          pairKey = privatePair ? [...members].sort().join(":") : null;
        if (pairKey) {
          const title = textValue(input.title),
            inserted = await tx.$queryRaw<{ id: string }[]>`
              INSERT INTO public.institution_channels
                (id, institution_id, title, created_by, private_pair, private_pair_key)
              VALUES
                (${key}::uuid, ${id}::uuid, ${title}, ${self.id}::uuid, true, ${pairKey})
              ON CONFLICT (institution_id, private_pair_key) DO NOTHING
              RETURNING id`;
          let channel = await tx.institution_channels.findFirst({
            where: { institution_id: id, private_pair_key: pairKey },
          });
          if (inserted.length) {
            await tx.institution_channel_members.createMany({
              data: members.map((member_id) => ({
                channel_id: key,
                institution_id: id,
                member_id,
                manager: managers.includes(member_id),
              })),
            });
            await event(tx, actor, id, "conversation_created", key, {
              members,
              managers,
            });
            channel = await tx.institution_channels.findUnique({
              where: { id: key },
            });
          } else if (channel?.archived) {
            channel = await tx.institution_channels.update({
              where: { id: channel.id },
              data: { archived: false, revision: { increment: 1 } },
            });
          }
          if (!channel) throw new ApiError(500, "conversation_unavailable");
          return channel;
        }
        const channel = await tx.institution_channels.create({
          data: {
            id: key,
            institution_id: id,
            title: textValue(input.title),
            private_pair: false,
            created_by: self.id,
          },
        });
        await tx.institution_channel_members.createMany({
          data: members.map((member_id) => ({
            channel_id: key,
            institution_id: id,
            member_id,
            manager: managers.includes(member_id),
          })),
        });
        await event(tx, actor, id, "conversation_created", key, {
          members,
          managers,
        });
        return channel;
      }
      const c = await channelAccess(
        tx,
        id,
        self,
        key,
        view,
        ["members", "archive", "rename", "join"].includes(action),
      );
      if (action === "join") {
        if (view !== "admin") throw new ApiError(403, "forbidden");
        if (
          !c.institution_channel_members.some((m) => m.member_id === self.id) &&
          c.institution_channel_members.length >= 100
        )
          throw new ApiError(400, "invalid_recipients");
        await tx.institution_channel_members.upsert({
          where: {
            channel_id_member_id: { channel_id: key, member_id: self.id },
          },
          create: {
            institution_id: id,
            channel_id: key,
            member_id: self.id,
            manager: false,
          },
          update: {},
        });
        await event(tx, actor, id, "conversation_admin_joined", key);
        return { joined: true };
      }
      if (action === "send") {
        const assets = messageAssets(input);
        if (c.archived) throw new ApiError(400, "conversation_unavailable");
        const message = await tx.institution_messages.create({
          data: {
            id: uuid(input.message),
            institution_id: id,
            channel_id: key,
            sender_id: self.id,
            body: textValue(input.body, 4000),
            asset_id: assets[0] || null,
          },
        });
        if (assets.length)
          await tx.institution_message_assets.createMany({
            data: assets.map((asset_id, position) => ({
              message_id: message.id,
              institution_id: id,
              asset_id,
              position,
            })),
          });
        return {
          ...message,
          asset_ids: assets,
          sequence: Number(message.sequence),
        };
      }
      if (c.revision !== input.revision) throw new ApiError(409, "conflict");
      if (action === "members") {
        if (c.private_pair)
          throw new ApiError(403, "private_conversation_members");
        const { members, managers } = await selectedPeople(
          tx,
          id,
          self,
          view,
          input,
        );
        await tx.institution_channel_members.deleteMany({
          where: { channel_id: key },
        });
        await tx.institution_channel_members.createMany({
          data: members.map((member_id) => ({
            channel_id: key,
            institution_id: id,
            member_id,
            manager: managers.includes(member_id),
          })),
        });
        await event(tx, actor, id, "conversation_participants_changed", key, {
          members,
          managers,
        });
        return tx.institution_channels.update({
          where: { id: key },
          data: { revision: { increment: 1 } },
        });
      }
      if (action === "rename" || action === "archive") {
        if (action === "archive" && typeof input.archived !== "boolean")
          throw new ApiError(400, "invalid_request");
        const channel = await tx.institution_channels.update({
          where: { id: key },
          data: {
            ...(action === "rename"
              ? { title: textValue(input.title) }
              : { archived: input.archived as boolean }),
            revision: { increment: 1 },
          },
        });
        await event(tx, actor, id, "conversation_" + action, key);
        return channel;
      }
      throw new ApiError(400, "invalid_request");
    },
    authorize,
  );
}
