import { pageSize } from "./pagination.ts";
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
import { role, recipient } from "./programming.ts";
import { definition, ids, pageOffset } from "./service-definitions.ts";
import type { Prisma } from "./generated/prisma/client.ts";
type Input = Record<string, unknown>;
type Self = Awaited<ReturnType<typeof access>>;
export async function serviceCatalog(
  actor: Actor,
  id: string,
  q: URLSearchParams,
) {
  const view = role(q.get("view"));
  if (view === "trainee") throw new ApiError(403, "forbidden");
  return scoped(actor, id, [view], async (tx, self) => {
    const take = pageSize(q, 25);
    const page = Math.max(0, Math.min(10000, Number(q.get("offset")) || 0)),
      search = (q.get("search") || "").slice(0, 100),
      kind = q.get("kind");
    const where = {
      institution_id: id,
      ...(q.get("id") ? { id: uuid(q.get("id")) } : {}),
      ...(view === "trainer" ? { created_by: self.id } : {}),
      archived: q.get("archived") === "true",
    };
    if (kind === "templates") {
      const filter = {
        ...where,
        title: { contains: search, mode: "insensitive" as const },
      };
      const [items, total] = await Promise.all([
        tx.assessment_templates.findMany({
          where: filter,
          take,
          skip: page,
          orderBy: [{ title: "asc" }, { id: "asc" }],
        }),
        tx.assessment_templates.count({ where: filter }),
      ]);
      return { items, total, next: page + take < total ? page + take : null };
    }
    const filter = {
      ...where,
      ...(view === "trainer"
        ? {
            created_by: undefined,
            OR: [
              { created_by: self.id },
              { institution_group_members: { some: { member_id: self.id } } },
            ],
          }
        : {}),
      name: { contains: search, mode: "insensitive" as const },
    };
    const [items, total] = await Promise.all([
      tx.institution_groups.findMany({
        where: filter,
        take,
        skip: page,
        orderBy: [{ name: "asc" }, { id: "asc" }],
        include: {
          institution_group_members: {
            include: {
              institution_members: {
                select: {
                  id: true,
                  name: true,
                  active: true,
                  roles: true,
                  trainer_id: true,
                },
              },
            },
          },
        },
      }),
      tx.institution_groups.count({ where: filter }),
    ]);
    return {
      items: items.map((g) => ({
        ...g,
        canEdit: view === "admin" || g.created_by === self.id,
        institution_group_members: undefined,
        members: g.institution_group_members.map((x) => x.institution_members),
      })),
      total,
      next: page + take < total ? page + take : null,
    };
  });
}
export async function serviceCatalogCommand(
  actor: Actor,
  id: string,
  input: Input,
) {
  const view = role(input.view),
    key = uuid(input.id),
    isTemplate = input.action === "template";
  if (
    view === "trainee" ||
    !["template", "group"].includes(String(input.action))
  )
    throw new ApiError(403, "forbidden");
  async function owned(tx: Tx, self: Self) {
    const item = isTemplate
      ? await tx.assessment_templates.findUnique({ where: { id: key } })
      : await tx.institution_groups.findUnique({ where: { id: key } });
    if (
      item &&
      (item.institution_id !== id ||
        (view !== "admin" && item.created_by !== self.id))
    )
      throw new ApiError(403, "forbidden");
    return item;
  }
  return mutation(
    actor,
    id,
    [view],
    input,
    async (tx, self) => {
      const old = await owned(tx, self);
      if ((old?.revision || 0) !== input.revision)
        throw new ApiError(409, "conflict");
      if (typeof input.archived !== "boolean")
        throw new ApiError(400, "invalid_request");
      if (isTemplate) {
        const data = {
          title: textValue(input.title),
          definition: definition(
            input.definition,
          ) as unknown as Prisma.InputJsonValue,
          archived: input.archived,
        };
        const result = old
          ? await tx.assessment_templates.update({
              where: { id: key },
              data: { ...data, revision: { increment: 1 } },
            })
          : await tx.assessment_templates.create({
              data: {
                ...data,
                id: key,
                institution_id: id,
                created_by: self.id,
              },
            });
        await event(tx, actor, id, "assessment_template_updated", key);
        return result;
      }
      const members = ids(input.members, 100, 0);
      for (const memberId of members) {
        const member = await tx.institution_members.findUnique({
          where: { id: memberId },
        });
        if (
          member?.institution_id === id &&
          member.active &&
          member.roles.includes("trainer")
        ) {
          if (view !== "admin") throw new ApiError(403, "trainer_unavailable");
          continue;
        }
        await recipient(tx, id, self, view, memberId, true, "training");
      }
      const data = { name: textValue(input.name), archived: input.archived };
      const result = old
        ? await tx.institution_groups.update({
            where: { id: key },
            data: { ...data, revision: { increment: 1 } },
          })
        : await tx.institution_groups.create({
            data: { ...data, id: key, institution_id: id, created_by: self.id },
          });
      await tx.institution_group_members.deleteMany({
        where: { group_id: key },
      });
      await tx.institution_group_members.createMany({
        data: members.map((member_id) => ({
          institution_id: id,
          group_id: key,
          member_id,
        })),
      });
      await event(tx, actor, id, "group_updated", key);
      return result;
    },
    async (tx, self) => {
      await owned(tx, self);
    },
  );
}
