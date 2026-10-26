import { effectivePlan, adaptationRevision } from "./plan-prescription.ts";
import { pageSize } from "./pagination.ts";
import { ApiError, asActor, type Actor } from "./db.ts";
import { scoped, uuid } from "./institution.ts";
import {
  role,
  recipient,
  coachedBy,
  supportingLinks,
  assignmentScope,
} from "./programming.ts";
import { pageOffset } from "./service-definitions.ts";

/** Staff assignment index. Dates classify assignments without rewriting their lifecycle. */
export async function athletePlans(
  actor: Actor,
  institution: string,
  query: URLSearchParams,
) {
  const view = role(query.get("view"));
  if (view === "trainee") throw new ApiError(403, "forbidden");
  const status = query.get("status") || "active";
  if (!["active", "upcoming", "expired", "ended", "all"].includes(status))
    throw new ApiError(400, "invalid_request");
  const take = pageSize(query, 24);
  const offset = pageOffset(query.get("offset"));
  const member = query.get("member");
  const assignment = query.get("assignment");
  if (member) uuid(member);
  if (assignment) uuid(assignment);
  const search = (query.get("search") || "").trim().slice(0, 100);
  const profile = await asActor(actor, (tx) =>
    tx.profiles.findUnique({
      where: { id: actor.id },
      select: { timezone: true },
    }),
  );
  return scoped(actor, institution, [view], async (tx, self) => {
    if (member)
      await recipient(tx, institution, self, view, member, false, "training");

    const zone = profile?.timezone || "UTC";
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const day = new Date(today + "T00:00:00Z");
    const peopleScope = {
      institution_id: institution,
      ...(view === "trainer" ? coachedBy(self.id) : {}),
      ...(member ? { id: member } : {}),
    };
    const stateWhere =
      status === "all"
        ? {}
        : status === "ended"
          ? { state: { not: "active" } }
          : {
              state: "active",
              ...(status === "expired"
                ? { end_date: { lt: day } }
                : {
                    institution_members_institution_assignments_institution_id_member_idToinstitution_members:
                      { ...peopleScope, active: true },
                    start_date:
                      status === "upcoming" ? { gt: day } : { lte: day },
                    OR: [{ end_date: null }, { end_date: { gte: day } }],
                  }),
            };
    const scope = {
      institution_id: institution,
      institution_members_institution_assignments_institution_id_member_idToinstitution_members:
        peopleScope,
      // Supporting coaches see only plans labelled with their linked sport.
      ...(view === "trainer"
        ? assignmentScope(
            self.id,
            await supportingLinks(tx, institution, self.id),
          )
        : {}),
    };
    const where = assignment
      ? { ...scope, id: assignment }
      : {
          ...scope,
          ...stateWhere,
          ...(search
            ? {
                AND: [
                  {
                    OR: [
                      {
                        adaptation: {
                          path: ["title"],
                          string_contains: search,
                          mode: "insensitive" as const,
                        },
                      },
                      {
                        institution_versions: {
                          title: {
                            contains: search,
                            mode: "insensitive" as const,
                          },
                        },
                      },
                      {
                        institution_members_institution_assignments_institution_id_member_idToinstitution_members:
                          {
                            name: {
                              contains: search,
                              mode: "insensitive" as const,
                            },
                          },
                      },
                    ],
                  },
                ],
              }
            : {}),
        };
    const [rows, total] = await Promise.all([
      tx.institution_assignments.findMany({
        where,
        skip: assignment ? 0 : offset,
        take: assignment ? 1 : take,
        orderBy: [{ created_at: "desc" }, { id: "asc" }],
        include: {
          institution_versions: {
            select: {
              id: true,
              title: true,
              revision: true,
              program_id: true,
              ...(assignment ? { prescription: true } : {}),
            },
          },
          institution_members_institution_assignments_institution_id_member_idToinstitution_members:
            { select: { id: true, name: true, active: true } },
          institution_sports: { select: { name: true } },
        },
      }),
      tx.institution_assignments.count({ where }),
    ]);
    if (assignment && !rows.length)
      throw new ApiError(404, "program_unavailable");
    return {
      today,
      zone,
      total,
      next: !assignment && offset + take < total ? offset + take : null,
      items: rows.map((row) => {
        const person =
          row.institution_members_institution_assignments_institution_id_member_idToinstitution_members;
        const derived =
          row.state !== "active"
            ? "ended"
            : row.end_date && row.end_date < day
              ? "expired"
              : row.start_date > day
                ? "upcoming"
                : "active";
        return {
          id: row.id,
          member_id: row.member_id,
          member_name: person.name,
          member_active: person.active,
          start_date: row.start_date.toISOString().slice(0, 10),
          end_date: row.end_date?.toISOString().slice(0, 10) || null,
          state: row.state,
          status: derived,
          schedule_mode: row.schedule_mode,
          goal: row.goal,
          sport: row.institution_sports?.name || null,
          revision: row.revision,
          version: effectivePlan(row),
          adaptation_revision: adaptationRevision(row),
        };
      }),
    };
  });
}
