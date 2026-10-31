import { ApiError, type Actor } from "./db.ts";
import {
  scoped,
  mutation,
  event,
  uuid,
  textValue,
  type Tx,
} from "./institution.ts";
import { role } from "./programming.ts";
import { ids } from "./service-definitions.ts";
import { endLinksForRemovedSports } from "./coaching-links.ts";
type Input = Record<string, unknown>;
const SPORT_LIMIT = 200;
const KINDS = ["sport", "specialty"];

/** Sports and specialties are institution metadata; they grant no capability by themselves. */
export async function institutionSports(
  actor: Actor,
  id: string,
  q: URLSearchParams,
) {
  const view = role(q.get("view"));
  if (view === "trainee") throw new ApiError(403, "forbidden");
  return scoped(actor, id, [view], async (tx) => ({
    items: await tx.institution_sports.findMany({
      where: { institution_id: id },
      // "sport" sorts after "specialty"; list sports first.
      orderBy: [
        { archived: "asc" },
        { kind: "desc" },
        { name: "asc" },
        { id: "asc" },
      ],
      select: {
        id: true,
        name: true,
        kind: true,
        archived: true,
        revision: true,
      },
    }),
  }));
}

async function currentSports(tx: Tx, member: string) {
  return (
    await tx.institution_member_sports.findMany({
      where: { member_id: member },
      select: { sport_id: true },
    })
  )
    .map((x) => x.sport_id)
    .sort();
}

export async function institutionSportsCommand(
  actor: Actor,
  id: string,
  input: Input,
) {
  const view = role(input.view),
    action = String(input.action);
  if (view !== "admin" || !["sport", "member-sports"].includes(action))
    throw new ApiError(403, "forbidden");
  return mutation(actor, id, [view], input, async (tx, self) => {
    if (action === "sport") {
      const key = uuid(input.id),
        name = textValue(input.name, 80),
        kind = String(input.kind);
      if (!KINDS.includes(kind) || typeof input.archived !== "boolean")
        throw new ApiError(400, "invalid_request");
      const old = await tx.institution_sports.findUnique({
        where: { id: key },
      });
      if (old && old.institution_id !== id)
        throw new ApiError(403, "forbidden");
      if ((old?.revision || 0) !== input.revision)
        throw new ApiError(409, "conflict");
      // Kind is fixed once created so existing athlete/coach links keep their meaning.
      if (old && old.kind !== kind) throw new ApiError(400, "kind_fixed");
      const duplicate = await tx.institution_sports.findFirst({
        where: {
          institution_id: id,
          name: { equals: name, mode: "insensitive" },
          NOT: { id: key },
        },
      });
      if (duplicate) throw new ApiError(409, "duplicate_sport");
      if (
        !old &&
        (await tx.institution_sports.count({
          where: { institution_id: id },
        })) >= SPORT_LIMIT
      )
        throw new ApiError(400, "sport_limit");
      const result = old
        ? await tx.institution_sports.update({
            where: { id: key },
            data: {
              name,
              archived: input.archived,
              revision: { increment: 1 },
            },
          })
        : await tx.institution_sports.create({
            data: {
              id: key,
              institution_id: id,
              name,
              kind,
              archived: input.archived,
              created_by: self.id,
            },
          });
      await event(tx, actor, id, "sport_updated", key, {
        kind,
        archived: input.archived,
      });
      return result;
    }
    const member = await tx.institution_members.findFirst({
      where: { id: uuid(input.member), institution_id: id, active: true },
    });
    if (!member || member.roles.includes("admin"))
      throw new ApiError(400, "invalid_member");
    const next = [...new Set(ids(input.sports, 50, 0))].sort(),
      previous = [...new Set(ids(input.previous, 50, 0))].sort(),
      current = await currentSports(tx, member.id);
    // The caller states the set it edited; a concurrent change is a conflict, not a merge.
    if (current.join() !== previous.join()) throw new ApiError(409, "conflict");
    const added = next.filter((x) => !current.includes(x)),
      removed = current.filter((x) => !next.includes(x));
    const sports = await tx.institution_sports.findMany({
      where: { institution_id: id, id: { in: added } },
    });
    if (
      sports.length !== added.length ||
      sports.some(
        (s) =>
          s.archived ||
          (member.roles.includes("trainee") && s.kind !== "sport"),
      )
    )
      throw new ApiError(400, "invalid_sport");
    await tx.institution_member_sports.deleteMany({
      where: { member_id: member.id, sport_id: { in: removed } },
    });
    await endLinksForRemovedSports(tx, id, member.id, removed, self.id);
    await tx.institution_member_sports.createMany({
      data: added.map((sport_id) => ({
        institution_id: id,
        member_id: member.id,
        sport_id,
        created_by: self.id,
      })),
    });
    await event(tx, actor, id, "member_sports_changed", member.id, {
      added,
      removed,
    });
    return { member: member.id, sports: next };
  });
}
