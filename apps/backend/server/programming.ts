import {
  scheduleIndividualWorkout,
  skipIndividualWorkout,
  rescheduleIndividualWorkout,
  workoutStartContext,
  assertLinkedWorkoutWritable,
  resolveCompletedWorkout,
  stopAssignmentWork,
} from "./workout-sequence.ts";
import { pageSize } from "./pagination.ts";
import type { WorkoutAgenda, WorkoutAgendaItem } from "@rafik/shared/contracts";
import { pageOffset } from "./service-definitions.ts";
import { usableExerciseAsset } from "./assets.ts";
import media from "../content/exercise-media.json" with { type: "json" };
import videos from "../content/exercise-videos.json" with { type: "json" };
import { isDeepStrictEqual } from "node:util";
import { randomUUID } from "node:crypto";
import { ApiError, db, asActor, type Actor } from "./db.ts";
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
import type { Prisma } from "./generated/prisma/client.ts";
type Member = Awaited<ReturnType<typeof access>>;
type Input = Record<string, unknown>;
const json = (v: unknown) => v as Prisma.InputJsonValue;
const bodyAreas = new Set([
  "waist",
  "upper legs",
  "back",
  "lower legs",
  "chest",
  "upper arms",
  "cardio",
  "shoulders",
  "lower arms",
  "neck",
]);
export const role = (v: unknown): Role => {
  if (!["admin", "trainer", "trainee"].includes(String(v)))
    throw new ApiError(400, "invalid_roles");
  return v as Role;
};
const date = (v: unknown) => {
  if (
    typeof v !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
    (Number.isNaN(Date.parse(v + "T00:00:00Z"))
      ? ""
      : new Date(v + "T00:00:00Z").toISOString()
    ).slice(0, 10) !== v
  )
    throw new ApiError(400, "invalid_date");
  return new Date(v + "T00:00:00Z");
};
export async function catalog(tx: Tx, id: string, self: Member) {
  const [shared, own] = await Promise.all([
    tx.reference_exercises.findMany({
      orderBy: { name: "asc" },
    }),
    tx.institution_exercises.findMany({
      where: { institution_id: id },
      orderBy: { id: "asc" },
    }),
  ]);
  return [
    ...shared,
    ...own
      .filter(
        (e) => (e.data as any).scope !== "private" || e.created_by === self.id,
      )
      .map((e) => ({
        ...(e.data as object),
        id: e.id,
        institution_id: id,
        created_by: e.created_by,
        revision: e.revision,
        active: e.active,
      })),
  ];
}
async function programAccess(
  tx: Tx,
  id: string,
  self: Member,
  view: Role,
  programId: string,
  write = false,
) {
  const p = await tx.institution_programs.findUnique({
    where: { id: uuid(programId) },
  });
  if (
    !p ||
    p.institution_id !== id ||
    (view !== "admin" &&
      (p.created_by !== self.id || view === "trainee") &&
      (write || !p.listed))
  )
    throw new ApiError(403, "program_unavailable");
  if (write && view === "trainee") throw new ApiError(403, "forbidden");
  if (
    view === "trainee" &&
    !(await tx.institution_assignments.findFirst({
      where: {
        institution_id: id,
        member_id: self.id,
        institution_versions: { program_id: p.id },
      },
    }))
  )
    throw new ApiError(403, "program_unavailable");
  return p;
}
/**
 * Coaching scope. "primary" is the one responsible coach (mirrored in trainer_id): plans,
 * nutrition, participation status, follow-up and analytics. "training" adds active supporting
 * coaches for read-only training records and their own scheduling/messaging/grouping.
 */
export type CoachScope = "primary" | "training";
/**
 * Prisma member filter for athletes a coach may see in training scope. Wrapped in AND so
 * spreading it never replaces a caller's own OR clause.
 */
export const coachedBy = (coach: string) => ({
  AND: [
    {
      OR: [
        { trainer_id: coach },
        {
          coaching_as_athlete: {
            some: { coach_member_id: coach, ended_at: null },
          },
        },
      ],
    },
  ],
});
export async function coaches(
  tx: Tx,
  athlete: { id: string; trainer_id: string | null },
  coach: string,
  scope: CoachScope,
) {
  if (athlete.trainer_id === coach) return true;
  if (scope === "primary") return false;
  return !!(await tx.institution_coaching_links.findFirst({
    where: {
      athlete_member_id: athlete.id,
      coach_member_id: coach,
      ended_at: null,
    },
    select: { id: true },
  }));
}
export async function recipient(
  tx: Tx,
  id: string,
  self: Member,
  view: Role,
  memberId: string,
  active = false,
  scope: CoachScope = "primary",
) {
  const m = await tx.institution_members.findUnique({
    where: { id: uuid(memberId) },
  });
  if (
    !m ||
    m.institution_id !== id ||
    (active && !m.roles.includes("trainee")) ||
    (active && !m.active) ||
    (view === "trainer" && !(await coaches(tx, m, self.id, scope))) ||
    (view === "trainee" && m.id !== self.id)
  )
    throw new ApiError(403, "trainee_unavailable");
  return m;
}
/** Active supporting links of a coach: each covers one athlete for one sport or specialty. */
export async function supportingLinks(
  tx: Tx,
  institution: string,
  coach: string,
) {
  return tx.institution_coaching_links.findMany({
    where: {
      institution_id: institution,
      coach_member_id: coach,
      kind: "supporting",
      ended_at: null,
    },
    select: { athlete_member_id: true, sport_id: true },
  });
}
type Links = Awaited<ReturnType<typeof supportingLinks>>;
/**
 * Plans a coach may see: every plan of their primary athletes, and only plans labelled with
 * the linked sport for athletes they support. Wrapped in AND to compose with caller filters.
 */
export const assignmentScope = (coach: string, links: Links) => ({
  AND: [
    {
      OR: [
        {
          institution_members_institution_assignments_institution_id_member_idToinstitution_members:
            { trainer_id: coach },
        },
        ...links.map((l) => ({
          member_id: l.athlete_member_id,
          sport_id: l.sport_id,
        })),
      ],
    },
  ],
});
/** Workout sessions follow the scope of the plan they were recorded against. */
export const sessionScope = (coach: string, links: Links) => ({
  AND: [
    {
      OR: [
        { institution_members: { trainer_id: coach } },
        ...links.map((l) => ({
          member_id: l.athlete_member_id,
          institution_assignments: { sport_id: l.sport_id },
        })),
      ],
    },
  ],
});
/**
 * Plan writes: admins and the primary coach for any plan; a supporting coach only for plans
 * labelled with a sport they are linked to for this athlete (including the plan replaced).
 */
async function planAuthority(
  tx: Tx,
  institution: string,
  self: Member,
  view: Role,
  member: string,
  sports: (string | null)[],
) {
  const m = await recipient(
    tx,
    institution,
    self,
    view,
    member,
    true,
    "training",
  );
  if (view !== "trainer" || m.trainer_id === self.id) return m;
  const covered = (await supportingLinks(tx, institution, self.id))
    .filter((l) => l.athlete_member_id === m.id)
    .map((l) => l.sport_id);
  if (sports.some((sport) => !sport || !covered.includes(sport)))
    throw new ApiError(403, "trainee_unavailable");
  return m;
}
async function snapshot(tx: Tx, id: string, self: Member, draft: unknown) {
  const items = JSON.stringify(await catalog(tx, id, self)),
    p = JSON.stringify(draft);
  await tx.$queryRaw`SELECT public.validate_program_presentation(${p}::jsonb,${id}::uuid)::text`;
  await tx.$queryRaw`SELECT public.validate_prescription_catalog(${p}::jsonb,${items}::jsonb)::text`;
  return (
    await tx.$queryRaw<
      { value: Prisma.InputJsonValue }[]
    >`SELECT public.snapshot_prescription_catalog(${p}::jsonb,${items}::jsonb) value`
  )[0].value;
}
export async function programs(
  actor: Actor,
  id: string,
  query: URLSearchParams,
) {
  const view = role(query.get("view"));
  return scoped(actor, id, [view], async (tx, self) => {
    const requestedVersion = query.get("version")
      ? await tx.institution_versions.findUnique({
          where: { id: uuid(query.get("version")) },
        })
      : null;
    if (
      query.get("version") &&
      (!requestedVersion || requestedVersion.institution_id !== id)
    )
      throw new ApiError(403, "program_unavailable");
    const programId = query.get("program") || requestedVersion?.program_id;
    if (programId) {
      const p = await programAccess(tx, id, self, view, programId),
        editable =
          view === "admin" || (view === "trainer" && p.created_by === self.id);
      const versions = await tx.institution_versions.findMany({
        where: {
          program_id: p.id,
          ...(view === "trainee"
            ? {
                ...(requestedVersion ? { id: requestedVersion.id } : {}),
                institution_assignments: {
                  some: { institution_id: id, member_id: self.id },
                },
              }
            : {}),
        },
        orderBy: { revision: "desc" },
        take: editable ? 50 : 1,
      });
      if (!editable && !versions.length)
        throw new ApiError(404, "program_unavailable");
      if (
        view === "trainee" &&
        requestedVersion &&
        !versions.some((v) => v.id === requestedVersion.id)
      )
        throw new ApiError(403, "program_unavailable");
      return {
        version: requestedVersion,
        program: editable
          ? p
          : { ...p, draft: versions[0].prescription, title: versions[0].title },
        editable,
        versions,
        catalog: view === "trainee" ? [] : await catalog(tx, id, self),
      };
    }
    const take = pageSize(query, 24),
      offset = Math.max(0, Math.min(100000, Number(query.get("offset")) || 0));
    const where = {
      institution_id: id,
      archived: false,
      title: {
        contains: (query.get("search") || "").slice(0, 100),
        mode: "insensitive" as const,
      },
      ...(view === "admin"
        ? {}
        : view === "trainer"
          ? { OR: [{ created_by: self.id }, { listed: true }] }
          : {
              listed: true,
              institution_versions: {
                some: {
                  institution_assignments: {
                    some: { institution_id: id, member_id: self.id },
                  },
                },
              },
            }),
    };
    const [list, total] = await Promise.all([
      tx.institution_programs.findMany({
        where,
        orderBy: [{ updated_at: "desc" }, { id: "asc" }],
        skip: offset,
        take,
        include: {
          institution_versions: {
            where:
              view === "trainee"
                ? {
                    institution_assignments: {
                      some: { institution_id: id, member_id: self.id },
                    },
                  }
                : {},
            orderBy: { revision: "desc" },
            take: 1,
          },
        },
      }),
      tx.institution_programs.count({ where }),
    ]);
    return {
      items: list.map((p) => {
        const v = p.institution_versions[0],
          editable =
            view === "admin" ||
            (view === "trainer" && p.created_by === self.id);
        return {
          id: p.id,
          title: editable ? p.title : v?.title,
          updated_at: p.updated_at,
          draft: editable ? p.draft : v?.prescription,
          draft_version: p.draft_version,
          listed: p.listed,
          editable,
          version: v || null,
        };
      }),
      total,
      next: offset + take < total ? offset + take : null,
    };
  });
}
export async function programCommand(actor: Actor, id: string, input: Input) {
  const view = role(input.view);
  if (view === "trainee") throw new ApiError(403, "forbidden");
  const action = String(input.action),
    programId = String(input.id || "");
  const authorize = async (tx: Tx, self: Member) => {
    if (["save", "publish", "archive"].includes(action)) {
      const existing = await tx.institution_programs.findUnique({
        where: { id: uuid(programId) },
      });
      if (existing) await programAccess(tx, id, self, view, programId, true);
      else if (action !== "save" && action !== "publish")
        throw new ApiError(404, "program_unavailable");
    } else if (["exercise", "exercise-active"].includes(action)) {
      const e = await tx.institution_exercises.findUnique({
        where: {
          institution_id_id: {
            institution_id: id,
            id: textValue(input.id, 100),
          },
        },
      });
      if (
        e &&
        e.created_by !== self.id &&
        (view !== "admin" || (e.data as any).scope === "private")
      )
        throw new ApiError(403, "forbidden");
    } else throw new ApiError(400, "invalid_request");
  };
  return mutation(
    actor,
    id,
    [view],
    input,
    async (tx, self) => {
      if (action === "exercise" || action === "exercise-active") {
        const eid = textValue(input.id, 100);
        if (!/^org-[a-f0-9-]{36}$/.test(eid))
          throw new ApiError(400, "invalid_exercise");
        const old = await tx.institution_exercises.findUnique({
          where: { institution_id_id: { institution_id: id, id: eid } },
        });
        if ((old?.revision || 0) !== input.revision)
          throw new ApiError(409, "conflict");
        let data: Input = {};
        if (action === "exercise") {
          if (!input.data || typeof input.data !== "object")
            throw new ApiError(400, "invalid_exercise");
          const x = input.data as Input;
          for (const [key, max] of Object.entries({
            name: 100,
            name_ar: 100,
            instructions: 2000,
            instructions_ar: 2000,
            equipment: 4000,
            equipment_ar: 4000,
            movement: 60,
            media_url: 500,
            media_ref: 100,
          })) {
            const v = String(x[key] || "").trim();
            if (v.length > max) throw new ApiError(400, "invalid_exercise");
            data[key] = v;
          }
          for (const key of ["category", "body_part", "target_muscle"]) {
            if (x[key] !== undefined && typeof x[key] !== "string")
              throw new ApiError(400, "invalid_exercise");
            data[key] = String(x[key] || "").trim();
          }
          if (
            String(data.target_muscle).length > 100 ||
            (data.category && !bodyAreas.has(String(data.category))) ||
            (data.body_part && !bodyAreas.has(String(data.body_part)))
          )
            throw new ApiError(400, "invalid_exercise");
          data.category ||= data.body_part;
          data.body_part ||= data.category;
          if (data.category !== data.body_part)
            throw new ApiError(400, "invalid_exercise");
          if (
            !data.name ||
            !data.instructions ||
            !["strength", "timed", "distance"].includes(String(x.kind))
          )
            throw new ApiError(400, "invalid_exercise");
          if (data.media_url && !/^https:\/\//.test(String(data.media_url)))
            throw new ApiError(400, "invalid_exercise");
          if (
            data.media_ref &&
            !media.items.some((item) => item.id === data.media_ref) &&
            !videos.items.some((item) => item.id === data.media_ref)
          )
            throw new ApiError(400, "invalid_exercise");
          const oldData = old?.data as Input | undefined;
          const scope =
            x.scope ??
            oldData?.scope ??
            (old
              ? "organization"
              : view === "admin"
                ? "organization"
                : "private");
          if (
            !["private", "organization"].includes(String(scope)) ||
            (view !== "admin" &&
              scope !== (oldData?.scope ?? (old ? "organization" : "private")))
          )
            throw new ApiError(403, "forbidden");
          data.scope = scope;
          const lists: Record<string, Set<string> | undefined> = {
            body_parts: bodyAreas,
            muscles: undefined,
            equipment_items: undefined,
          };
          for (const [key, allowed] of Object.entries(lists)) {
            const values =
              x[key] ??
              (key === "body_parts"
                ? data.body_part
                  ? [data.body_part]
                  : []
                : []);
            if (
              !Array.isArray(values) ||
              values.length > 64 ||
              values.some(
                (v) =>
                  typeof v !== "string" ||
                  !v.trim() ||
                  v.length > 60 ||
                  (allowed && !allowed.has(v)),
              )
            )
              throw new ApiError(400, "invalid_exercise");
            data[key] = [...new Set(values.map((v) => v.trim()))];
          }
          if (Array.isArray(x.body_parts))
            data.category = data.body_part =
              (data.body_parts as string[])[0] || "";
          if (Array.isArray(x.equipment_items))
            data.equipment = (data.equipment_items as string[]).join(", ");
          if (x.media_asset) {
            const asset = await usableExerciseAsset(
              tx,
              id,
              self,
              x.media_asset,
              oldData?.media_asset === x.media_asset,
            );
            data.media_asset = asset.id;
            data.media_type = asset.media_type;
            data.media_filename = asset.filename;
          }
          data.kind = x.kind;
          data.name_ar ||= data.name;
          data.instructions_ar ||= data.instructions;
        } else if (!old || typeof input.active !== "boolean")
          throw new ApiError(400, "invalid_request");
        const result = old
          ? await tx.institution_exercises.update({
              where: { institution_id_id: { institution_id: id, id: eid } },
              data: {
                ...(action === "exercise"
                  ? { data: json(data) }
                  : { active: input.active as boolean }),
                revision: { increment: 1 },
              },
            })
          : await tx.institution_exercises.create({
              data: {
                institution_id: id,
                id: eid,
                data: json(data),
                created_by: self.id,
              },
            });
        await event(tx, actor, id, "exercise_updated", null, { exercise: eid });
        return result;
      }
      let p = await tx.institution_programs.findUnique({
        where: { id: programId },
      });
      if ((p?.draft_version || null) !== input.revision)
        throw new ApiError(409, "conflict");
      if (action === "archive" && p?.revision !== input.record_revision)
        throw new ApiError(409, "conflict");
      if (action === "archive") {
        if (typeof input.value !== "boolean")
          throw new ApiError(400, "invalid_request");
        p = await tx.institution_programs.update({
          where: { id: programId },
          data: {
            archived: input.value,
            revision: { increment: 1 },
            updated_at: new Date(),
          },
        });
        await event(tx, actor, id, "program_" + action, programId);
        return { plan: p };
      }
      const title = textValue(input.title, 100);
      let prescription: Prisma.InputJsonValue | null = null;
      if (action === "publish")
        prescription = await snapshot(tx, id, self, input.draft);
      else {
        const draft = JSON.stringify(input.draft);
        if (!draft || draft.length > 262_144)
          throw new ApiError(400, "invalid_plan");
        await tx.$queryRaw`SELECT public.validate_program_presentation(${draft}::jsonb,${id}::uuid)::text`;
        await tx.$queryRaw`SELECT public.validate_program_draft(${draft}::jsonb)::text`;
      }
      const same =
        p && p.title === title && isDeepStrictEqual(p.draft, input.draft);
      if (!same)
        p = p
          ? await tx.institution_programs.update({
              where: { id: programId },
              data: {
                title,
                draft: json(input.draft),
                draft_version: { increment: 1 },
                updated_at: new Date(),
              },
            })
          : await tx.institution_programs.create({
              data: {
                id: programId,
                institution_id: id,
                created_by: self.id,
                title,
                draft: json(input.draft),
              },
            });
      if (!p) throw new ApiError(500, "service_unavailable");
      let version = null;
      if (action === "publish") {
        if (!p.listed || p.archived)
          p = await tx.institution_programs.update({
            where: { id: p.id },
            data: { listed: true, archived: false, revision: { increment: 1 } },
          });
        version =
          (await tx.institution_versions.findUnique({
            where: {
              program_id_revision: {
                program_id: p.id,
                revision: p.draft_version,
              },
            },
          })) ||
          (await tx.institution_versions.create({
            data: {
              institution_id: id,
              program_id: p.id,
              revision: p.draft_version,
              title,
              prescription: prescription!,
              created_by: self.id,
            },
          }));
      }
      await event(
        tx,
        actor,
        id,
        action === "publish" ? "program_published" : "program_saved",
        p.id,
      );
      return { plan: p, version };
    },
    authorize,
  );
}
export async function delivery(
  actor: Actor,
  id: string,
  query: URLSearchParams,
) {
  const view = role(query.get("view"));
  return scoped(actor, id, [view], async (tx, self) => {
    const selected = query.get("member");
    if (selected)
      await recipient(tx, id, self, view, selected, false, "training");
    const links =
        view === "trainer" ? await supportingLinks(tx, id, self.id) : null,
      plans = links ? assignmentScope(self.id, links) : {},
      workouts = links ? sessionScope(self.id, links) : {};
    if (query.get("history") === "true") {
      const search = (query.get("search") || "").trim().slice(0, 100);
      const scope = {
        institution_id: id,
        ...(search
          ? { name: { contains: search, mode: "insensitive" as const } }
          : {}),
        ...(selected
          ? { id: selected }
          : view === "trainer"
            ? coachedBy(self.id)
            : view === "trainee"
              ? { id: self.id }
              : {}),
      };
      const cursor = query.get("before");
      if (
        cursor &&
        !(await tx.institution_sessions.findFirst({
          where: {
            id: uuid(cursor),
            institution_id: id,
            institution_members: scope,
            ...workouts,
          },
        }))
      )
        throw new ApiError(400, "invalid_request");
      const take = pageSize(query, 10);
      const page = await tx.institution_sessions.findMany({
        where: { institution_id: id, institution_members: scope, ...workouts },
        include: {
          institution_members: {
            select: { id: true, name: true, active: true },
          },
        },
        orderBy: [{ started_at: "desc" }, { id: "asc" }],
        take: take + 1,
        ...(cursor
          ? { cursor: { id: cursor }, skip: 1 }
          : { skip: pageOffset(query.get("offset")) }),
      });
      const sessions = page.slice(0, take),
        member = selected || (view === "trainee" ? self.id : null);
      const assignments = member
        ? await tx.institution_assignments.findMany({
            where: {
              institution_id: id,
              member_id: member,
              state: "active",
              ...plans,
            },
            include: { institution_versions: true },
          })
        : [];
      const total = await tx.institution_sessions.count({
        where: { institution_id: id, institution_members: scope, ...workouts },
      });
      return {
        total,
        members: Array.from(
          new Map(
            sessions.map((s) => [s.member_id, s.institution_members]),
          ).values(),
        ),
        assignments: assignments.map((a) => ({
          ...a,
          version: a.institution_versions,
          institution_versions: undefined,
        })),
        sessions: sessions.map((s) => ({
          ...(s.document as object),
          version: s.version,
          member_id: s.member_id,
          completed_at: s.completed_at,
        })),
        self: self.id,
        next: page.length > take ? sessions.at(-1)!.id : null,
      };
    }
    const members = await tx.institution_members.findMany({
      where: {
        institution_id: id,
        ...(query.get("history") === "true"
          ? {
              OR: [
                { roles: { has: "trainee" } },
                { institution_sessions: { some: {} } },
              ],
            }
          : { roles: { has: "trainee" } }),
        ...(selected
          ? { id: selected }
          : view === "trainer"
            ? coachedBy(self.id)
            : view === "trainee"
              ? { id: self.id }
              : {}),
        ...(selected || query.get("history") === "true"
          ? {}
          : { active: true }),
      },
      select: { id: true, name: true, active: true, revision: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
    const assignments = await tx.institution_assignments.findMany({
      where: {
        institution_id: id,
        member_id: { in: members.map((m) => m.id) },
        ...(selected ? {} : { state: "active" }),
        ...plans,
      },
      include: { institution_versions: true },
      orderBy: { created_at: "desc" },
    });
    const cursor = query.get("history") === "true" ? query.get("before") : null;
    if (query.has("before") && !cursor)
      throw new ApiError(400, "invalid_request");
    if (cursor) {
      const previous = await tx.institution_sessions.findUnique({
        where: { id: uuid(cursor) },
      });
      if (
        !previous ||
        previous.institution_id !== id ||
        !members.some((m) => m.id === previous.member_id)
      )
        throw new ApiError(400, "invalid_request");
    }
    const page =
      query.get("history") === "true"
        ? await tx.institution_sessions.findMany({
            where: {
              institution_id: id,
              member_id: { in: members.map((m) => m.id) },
              ...workouts,
            },
            orderBy: [{ started_at: "desc" }, { id: "asc" }],
            take: 51,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          })
        : [];
    const sessions = page.slice(0, 50);
    return {
      members,
      assignments: assignments.map((a) => ({
        ...a,
        version: a.institution_versions,
        institution_versions: undefined,
      })),
      sessions: sessions.map((s) => ({
        ...(s.document as object),
        version: s.version,
        member_id: s.member_id,
        completed_at: s.completed_at,
      })),
      self: self.id,
      next: page.length > 50 ? sessions.at(-1)!.id : null,
    };
  });
}
export async function deliveryCommand(actor: Actor, id: string, input: Input) {
  const view = role(input.view),
    action = String(input.action);
  if (view === "trainee") throw new ApiError(403, "forbidden");
  if (action === "end") return endAssignment(actor, id, view, input);
  if (action !== "assign") throw new ApiError(400, "invalid_request");
  const selected = input.members;
  if (
    !Array.isArray(selected) ||
    !selected.length ||
    selected.length > 50 ||
    new Set(selected.map((x) => (x as Input).id)).size !== selected.length
  )
    throw new ApiError(400, "invalid_recipients");
  const goal =
      input.goal === undefined || input.goal === null || input.goal === ""
        ? null
        : textValue(input.goal, 80),
    sport = input.sport ? uuid(input.sport) : null;
  // `replaces` names the plan this assignment supersedes; null adds a concurrent plan.
  // The legacy assignment_id/assignment_revision pair has the same meaning.
  const replacing = (x: Input) => {
    const target = x.replaces !== undefined ? x.replaces : x.assignment_id;
    const revision =
      x.replaces !== undefined ? x.replaces_revision : x.assignment_revision;
    return target ? { id: uuid(target), revision } : null;
  };
  const replacedSports = async (tx: Tx, x: Input) => {
    const target = replacing(x);
    if (!target) return [];
    const old = await tx.institution_assignments.findUnique({
      where: { id: target.id },
    });
    return [old?.sport_id ?? null];
  };
  const authorize = async (tx: Tx, self: Member) => {
    for (const raw of selected) {
      const x = raw as Input;
      await planAuthority(tx, id, self, view, uuid(x.id), [
        sport,
        ...(await replacedSports(tx, x)),
      ]);
    }
  };
  return mutation(
    actor,
    id,
    [view],
    input,
    async (tx, self) => {
      const v = await tx.institution_versions.findUnique({
        where: { id: uuid(input.version_id) },
      });
      if (!v || v.institution_id !== id)
        throw new ApiError(403, "program_unavailable");
      const p = await programAccess(tx, id, self, view, v.program_id);
      if (p.archived) throw new ApiError(400, "program_unavailable");
      const start = date(input.start_date),
        end = input.end_date ? date(input.end_date) : null;
      if (
        (end && end < start) ||
        !["cycle", "flexible"].includes(String(input.schedule_mode))
      )
        throw new ApiError(400, "invalid_schedule");
      if (
        sport &&
        !(await tx.institution_sports.findFirst({
          where: { id: sport, institution_id: id, archived: false },
        }))
      )
        throw new ApiError(400, "invalid_sport");
      const results = [];
      for (const raw of selected) {
        const x = raw as Input,
          m = await planAuthority(tx, id, self, view, String(x.id), [
            sport,
            ...(await replacedSports(tx, x)),
          ]);
        if (m.revision !== x.revision) throw new ApiError(409, "conflict");
        const target = replacing(x);
        if (target) {
          const old = await tx.institution_assignments.findUnique({
            where: { id: target.id },
          });
          if (
            !old ||
            old.institution_id !== id ||
            old.member_id !== m.id ||
            old.state !== "active" ||
            old.revision !== target.revision
          )
            throw new ApiError(409, "conflict");
          await stopAssignmentWork(tx, actor, id, old.id);
          await tx.institution_assignments.update({
            where: { id: old.id },
            data: { state: "archived", revision: { increment: 1 } },
          });
        }
        if (
          await tx.institution_assignments.findFirst({
            where: {
              institution_id: id,
              member_id: m.id,
              version_id: v.id,
              state: "active",
            },
          })
        )
          throw new ApiError(409, "already_assigned");
        const created = await tx.institution_assignments.create({
          data: {
            institution_id: id,
            member_id: m.id,
            version_id: v.id,
            created_by: self.id,
            start_date: start,
            end_date: end,
            schedule_mode: String(input.schedule_mode),
            goal,
            sport_id: sport,
          },
        });
        // Concurrent plans are allowed; overlapping dates are reported, never blocked.
        // Intentional visibility exception: so coaches can coordinate load, the warning lists every
        // overlapping active plan for this athlete, including plans outside a supporting coach's
        // sport. It is limited to title, goal and dates; no plan ID, prescription or sessions.
        const overlaps = await tx.institution_assignments.findMany({
          where: {
            institution_id: id,
            member_id: m.id,
            state: "active",
            NOT: { id: created.id },
            ...(end ? { start_date: { lte: end } } : {}),
            OR: [{ end_date: null }, { end_date: { gte: start } }],
          },
          select: {
            id: true,
            goal: true,
            start_date: true,
            end_date: true,
            institution_versions: { select: { title: true } },
          },
          orderBy: { start_date: "asc" },
        });
        results.push({
          ...created,
          overlaps: overlaps.map((o) => ({
            title: o.institution_versions.title,
            goal: o.goal,
            start_date: o.start_date,
            end_date: o.end_date,
          })),
        });
      }
      await event(tx, actor, id, "program_assigned", v.program_id, {
        members: selected.map((x) => String((x as Input).id)),
        version: v.id,
        sport,
        replaced: selected
          .map((x) => replacing(x as Input)?.id)
          .filter(Boolean) as string[],
      });
      return results;
    },
    authorize,
  );
}
/** Ending archives one plan; sessions and the immutable version stay in history. */
async function endAssignment(
  actor: Actor,
  id: string,
  view: Role,
  input: Input,
) {
  const key = uuid(input.assignment);
  const check = async (tx: Tx, self: Member) => {
    const a = await tx.institution_assignments.findUnique({
      where: { id: key },
    });
    if (!a || a.institution_id !== id) throw new ApiError(404, "not_found");
    await planAuthority(tx, id, self, view, a.member_id, [a.sport_id]);
    return a;
  };
  return mutation(
    actor,
    id,
    [view],
    input,
    async (tx, self) => {
      const a = await check(tx, self);
      if (a.state !== "active" || a.revision !== input.revision)
        throw new ApiError(409, "conflict");
      await stopAssignmentWork(tx, actor, id, a.id);
      const result = await tx.institution_assignments.update({
        where: { id: a.id },
        data: { state: "archived", revision: { increment: 1 } },
      });
      await event(tx, actor, id, "assignment_ended", a.member_id, {
        assignment: a.id,
      });
      return result;
    },
    async (tx, self) => {
      await check(tx, self);
    },
  );
}
/** Session reads: the athlete, admins, the primary coach, or a supporting coach for the plan's sport. */
async function readableSession(
  tx: Tx,
  s: { institution_id: string; member_id: string; assignment_id: string },
  self: Member,
  view: Role,
) {
  const m = await recipient(
    tx,
    s.institution_id,
    self,
    view,
    s.member_id,
    false,
    "training",
  );
  if (view === "trainer" && m.trainer_id !== self.id) {
    const plan = await tx.institution_assignments.findUnique({
      where: { id: s.assignment_id },
      select: { sport_id: true },
    });
    const links = await supportingLinks(tx, s.institution_id, self.id);
    if (
      !links.some(
        (l) => l.athlete_member_id === m.id && l.sport_id === plan?.sport_id,
      )
    )
      throw new ApiError(403, "trainee_unavailable");
  }
  return m;
}
/** Attributed versions of one session, oldest first; readable by anyone who can read the session. */
export async function institutionSessionHistory(
  actor: Actor,
  sessionId: string,
  view: Role = "trainee",
) {
  const s = await db.institution_sessions.findUnique({
    where: { id: uuid(sessionId) },
  });
  if (!s) throw new ApiError(404, "session_missing");
  return scoped(actor, s.institution_id, [view], async (tx, self) => {
    await readableSession(tx, s, self, view);
    const rows = await tx.institution_session_history.findMany({
      where: { session_id: s.id },
      orderBy: { version: "asc" },
      take: 100,
      include: { actor: { select: { id: true, name: true, roles: true } } },
    });
    return {
      recorded_mode: s.recorded_mode,
      recorded_by: s.recorded_by,
      items: rows.map((r) => ({
        version: r.version,
        action: r.action,
        created_at: r.created_at,
        completed: r.completed,
        note: r.note,
        entries: r.entries,
        actor: r.actor.id,
        actor_name: r.actor.name,
        // The athlete edited their own record, or a coach recorded on their behalf.
        by: r.actor.id === s.member_id ? "athlete" : "coach",
      })),
    };
  });
}
export async function institutionSession(
  actor: Actor,
  sessionId: string,
  view: Role = "trainee",
) {
  const s = await db.institution_sessions.findUnique({
    where: { id: uuid(sessionId) },
  });
  if (!s) throw new ApiError(404, "session_missing");
  return scoped(actor, s.institution_id, [view], async (tx, self) => {
    const m = await readableSession(tx, s, self, view);
    return {
      ...(s.document as object),
      client_id: m.user_id,
      member_name: m.name,
      version: s.version,
      completed_at: s.completed_at,
    };
  });
}
export async function sessionCommand(actor: Actor, id: string, input: Input) {
  const view = role(input.view),
    action = String(input.action),
    sessionId = uuid(input.id);
  let today = "";
  if (action === "start") {
    const profile = await asActor(actor, (tx) =>
      tx.profiles.findUnique({
        where: { id: actor.id },
        select: { timezone: true },
      }),
    );
    today = new Intl.DateTimeFormat("en-CA", {
      timeZone: profile?.timezone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }
  // Delegated recording: a coach with plan authority (primary, or supporting for the plan's
  // sport) may start and save a session for an athlete under the coach's own identity.
  const delegate = async (tx: Tx, self: Member, assignmentId: string) => {
    const a = await tx.institution_assignments.findUnique({
      where: { id: assignmentId },
    });
    if (!a || a.institution_id !== id)
      throw new ApiError(403, "trainee_unavailable");
    return planAuthority(tx, id, self, view, a.member_id, [a.sport_id]);
  };
  const authorize = async (tx: Tx, self: Member) => {
    if (action === "start") {
      if (view === "trainer")
        await delegate(tx, self, uuid(input.assignment_id));
      else if (view !== "trainee") throw new ApiError(403, "forbidden");
      return;
    }
    const s = await tx.institution_sessions.findUnique({
      where: { id: sessionId },
    });
    if (!s || s.institution_id !== id)
      throw new ApiError(403, "session_missing");
    if (action === "save" && view === "trainer") {
      // Coaches edit only sessions recorded on the athlete's behalf, never self-logged ones.
      if (s.recorded_mode !== "delegated") throw new ApiError(403, "forbidden");
      await delegate(tx, self, s.assignment_id);
      return;
    }
    await recipient(tx, id, self, view, s.member_id);
    if (
      (action === "save" && view !== "trainee") ||
      (action === "review" && view === "trainee") ||
      !["save", "review"].includes(action)
    )
      throw new ApiError(403, "forbidden");
  };
  return mutation(
    actor,
    id,
    [view],
    input,
    async (tx, self) => {
      if (action === "start") {
        const assignment = await tx.institution_assignments.findUnique({
          where: { id: uuid(input.assignment_id) },
          include: { institution_versions: true },
        });
        if (
          !assignment ||
          assignment.institution_id !== id ||
          (view === "trainee" && assignment.member_id !== self.id)
        )
          throw new ApiError(403, "trainee_unavailable");
        const delegated = view === "trainer",
          athlete = delegated
            ? await tx.institution_members.findUniqueOrThrow({
                where: { id: assignment.member_id },
              })
            : self;
        const existing = await tx.institution_sessions.findUnique({
          where: { id: sessionId },
        });
        if (existing) {
          if (
            existing.assignment_id !== assignment.id ||
            existing.day_id !== input.day_id ||
            (input.occurrence_id &&
              existing.occurrence_id !== input.occurrence_id)
          )
            throw new ApiError(409, "operation_reused");
          return existing.document;
        }
        const linked = await workoutStartContext(
          tx,
          id,
          assignment.id,
          input.occurrence_id,
        );
        const nowDate = linked ? linked.occurrence.training_date : date(today);
        if (
          assignment.state !== "active" ||
          assignment.start_date > nowDate ||
          (assignment.end_date && assignment.end_date < nowDate)
        )
          throw new ApiError(400, "assignment_unavailable");
        const plan = assignment.institution_versions.prescription as any,
          day = plan.days.find((d: any) => d.id === input.day_id);
        if (
          !day ||
          day.restDay ||
          (linked && linked.position.day_id !== day.id)
        )
          throw new ApiError(400, "invalid_day");
        const delta = Math.floor(
          (nowDate.getTime() - assignment.start_date.getTime()) / 86400000,
        );
        if (
          !linked &&
          assignment.schedule_mode === "cycle" &&
          delta % (7 * (plan.cycleWeeks || 1)) !==
            ((day.week || 1) - 1) * 7 + day.weekday
        )
          throw new ApiError(400, "not_scheduled_today");
        const occurrence = await tx.institution_sessions.findUnique({
          where: {
            assignment_id_local_date_day_id: {
              assignment_id: assignment.id,
              local_date: nowDate,
              day_id: day.id,
            },
          },
        });
        if (occurrence) return occurrence.document;
        const document = {
          id: sessionId,
          institution_id: id,
          member_id: athlete.id,
          // The athlete stays the subject; a delegated recorder is attributed separately.
          client_id: delegated ? athlete.user_id : actor.id,
          coach_id: null,
          recorded_mode: delegated ? "delegated" : "self",
          recorded_by: delegated ? self.id : null,
          recorded_by_name: delegated ? self.name : null,
          assignment_id: assignment.id,
          version_id: assignment.version_id,
          day_id: day.id,
          occurrence_key: `${assignment.id}:${nowDate.toISOString().slice(0, 10)}:${day.id}`,
          ...(linked ? { occurrence_id: linked.occurrence.id } : {}),
          local_date: nowDate.toISOString().slice(0, 10),
          title: assignment.institution_versions.title,
          prescription: day,
          status: "in_progress",
          entries: day.exercises.flatMap((e: any) =>
            Array.from({ length: e.sets }, (_, i) => {
              const t = e.targets?.[i] || e;
              return {
                exercise_key: e.key,
                set_index: i,
                reps: t.reps,
                load: t.load,
                unit: e.unit,
                seconds: t.seconds ?? null,
                metres: t.metres ?? null,
                effort: t.effort ?? null,
                completed: false,
              };
            }),
          ),
          note: "",
          coach_note: "",
          reviewed_at: null,
          started_at: new Date().toISOString(),
          completed_at: null,
          version: 1,
        };
        await tx.institution_sessions.create({
          data: {
            id: sessionId,
            institution_id: id,
            member_id: athlete.id,
            assignment_id: assignment.id,
            day_id: day.id,
            local_date: nowDate,
            document: json(document),
            recorded_mode: delegated ? "delegated" : "self",
            recorded_by: delegated ? self.id : null,
            occurrence_id: linked?.occurrence.id,
          },
        });
        if (linked)
          await tx.institution_workout_positions.update({
            where: { id: linked.position.id },
            data: { session_id: sessionId },
          });
        await tx.institution_session_history.create({
          data: {
            id: randomUUID(),
            institution_id: id,
            session_id: sessionId,
            version: 1,
            actor_member_id: self.id,
            action: "start",
            entries: json(document.entries),
            note: "",
            completed: false,
          },
        });
        return document;
      }
      const s = await tx.institution_sessions.findUniqueOrThrow({
        where: { id: sessionId },
      });
      if (s.version !== input.revision) throw new ApiError(409, "conflict");
      const current = s.document as any;
      let document: any,
        completed = s.completed_at;
      if (action === "save") {
        await assertLinkedWorkoutWritable(tx, id, sessionId);
        if (
          typeof input.complete !== "boolean" ||
          typeof input.note !== "string"
        )
          throw new ApiError(400, "invalid_session");
        await tx.$queryRaw`SELECT public.validate_session_actuals(${JSON.stringify(current.prescription)}::jsonb,${JSON.stringify(input.entries)}::jsonb,${input.note},${input.complete})::text`;
        completed = completed || (input.complete ? new Date() : null);
        document = {
          ...current,
          entries: input.entries,
          note: input.note,
          status: completed ? "completed" : "in_progress",
          completed_at: completed?.toISOString() || null,
          reviewed_at: null,
          reviewed_by: null,
          coach_note: "",
          version: s.version + 1,
        };
      } else {
        if (!completed) throw new ApiError(400, "session_not_completed");
        const note = typeof input.note === "string" ? input.note.trim() : "";
        if (!note || note.length > 2000)
          throw new ApiError(400, "invalid_feedback");
        document = {
          ...current,
          coach_note: note,
          reviewed_at: new Date().toISOString(),
          reviewed_by: self.id,
          version: s.version + 1,
        };
      }
      await tx.institution_sessions.update({
        where: { id: sessionId },
        data: {
          document: json(document),
          completed_at: completed,
          version: { increment: 1 },
        },
      });
      if (action === "save")
        // Each athlete or coach save keeps an attributed version; corrections never erase history.
        await tx.institution_session_history.create({
          data: {
            id: randomUUID(),
            institution_id: id,
            session_id: sessionId,
            version: s.version + 1,
            actor_member_id: self.id,
            action: "save",
            entries: json(document.entries),
            note: document.note,
            completed: !!completed,
          },
        });
      if (action === "save")
        await resolveCompletedWorkout(tx, actor, id, self.id, sessionId);
      return document;
    },
    authorize,
  );
}
export async function previousInstitutionPerformance(
  actor: Actor,
  sessionId: string,
) {
  const s = await db.institution_sessions.findUnique({
    where: { id: uuid(sessionId) },
  });
  if (!s) throw new ApiError(404, "session_missing");
  return scoped(actor, s.institution_id, ["trainee"], async (tx, self) => {
    if (s.member_id !== self.id) throw new ApiError(403, "forbidden");
    const wanted = (s.document as any).prescription.exercises.flatMap(
      (e: any) => [
        e.exerciseId,
        ...(e.alternatives || []).map((a: any) => a.exerciseId),
      ],
    );
    return tx.$queryRaw<unknown[]>`WITH actual AS (
   SELECT h.id,h.completed_at,e.value AS original,coalesce(nullif((SELECT x->>'exercise_id' FROM jsonb_array_elements(h.document->'entries') x WHERE x->>'exercise_key'=e.value->>'key' LIMIT 1),''),e.value->>'exerciseId') AS exercise_id,
    (SELECT jsonb_agg(x ORDER BY (x->>'set_index')::int) FROM jsonb_array_elements(h.document->'entries') x WHERE x->>'exercise_key'=e.value->>'key' AND (x->>'completed')::boolean) AS entries
   FROM public.institution_sessions h CROSS JOIN LATERAL jsonb_array_elements(h.document->'prescription'->'exercises') e(value)
   WHERE h.institution_id=${s.institution_id}::uuid AND h.member_id=${self.id}::uuid AND h.completed_at<${s.started_at}
  ) SELECT DISTINCT ON(exercise_id) exercise_id,completed_at,coalesce((SELECT original||jsonb_build_object('exerciseId',alt->>'exerciseId','info',alt->'info') FROM jsonb_array_elements(coalesce(original->'alternatives','[]')) alt WHERE alt->>'exerciseId'=exercise_id),original) AS prescription,entries
    FROM actual WHERE entries IS NOT NULL AND exercise_id=ANY(${wanted}::text[]) ORDER BY exercise_id,completed_at DESC,id DESC LIMIT 48`;
  });
}

/** Bounded, read-only projection. All roster filtering happens before pagination. */
export async function workoutAgenda(
  actor: Actor,
  institution: string,
  query: URLSearchParams,
): Promise<WorkoutAgenda> {
  const view = role(query.get("view"));
  const profile = await asActor(actor, (tx) =>
    tx.profiles.findUnique({
      where: { id: actor.id },
      select: { timezone: true },
    }),
  );
  return scoped(actor, institution, [view], async (tx, self) => {
    const search = (query.get("search") || "").trim().slice(0, 100);
    const now = new Date();
    const today = new Date(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: profile?.timezone || "UTC",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(now) + "T00:00:00Z",
    );
    const assignment = query.get("assignment");
    const scope: Prisma.institution_assignmentsWhereInput = {
      institution_id: institution,
      ...(assignment ? { id: uuid(assignment) } : {}),
      OR: [
        { state: "active" },
        { institution_workout_positions: { some: { state: "paused" } } },
      ],
      ...(view === "trainee"
        ? { member_id: self.id }
        : view === "trainer"
          ? assignmentScope(
              self.id,
              await supportingLinks(tx, institution, self.id),
            )
          : {}),
      institution_members_institution_assignments_institution_id_member_idToinstitution_members:
        {
          active: true,
          ...(search
            ? { name: { contains: search, mode: "insensitive" } }
            : {}),
        },
      ...(query.get("due") === "true"
        ? {
            AND: [
              {
                OR: [
                  {
                    institution_workout_positions: {
                      some: {
                        state: { in: ["pending", "paused"] },
                        institution_events: { training_date: { lte: today } },
                      },
                    },
                  },
                  {
                    institution_sessions: {
                      some: { completed_at: null, occurrence_id: null },
                    },
                  },
                ],
              },
              ...(view === "trainer"
                ? [
                    assignmentScope(
                      self.id,
                      await supportingLinks(tx, institution, self.id),
                    ),
                  ]
                : []),
            ],
          }
        : {}),
    };
    const offset = pageOffset(query.get("offset")),
      limit = pageSize(query, 10);
    const rows = await tx.institution_assignments.findMany({
      where: scope,
      skip: offset,
      take: limit,
      orderBy: [{ created_at: "asc" }, { id: "asc" }],
      include: {
        institution_versions: { select: { title: true, prescription: true } },
        institution_members_institution_assignments_institution_id_member_idToinstitution_members:
          { select: { name: true } },
        institution_workout_positions: {
          where: { state: { in: ["pending", "paused"] } },
          take: 1,
          include: { institution_events: true, institution_sessions: true },
        },
        institution_sessions: {
          where: { completed_at: null, occurrence_id: null },
          orderBy: [{ started_at: "asc" }, { id: "asc" }],
          take: 1,
        },
      },
    });
    const restrictions = await tx.institution_injury_records.findMany({
      where: {
        institution_id: institution,
        athlete_member_id: { in: rows.map((a) => a.member_id) },
        state: "active",
        participation: "unavailable",
        effective_from: { lte: today },
      },
      select: { athlete_member_id: true },
    });
    return {
      total: await tx.institution_assignments.count({ where: scope }),
      offset,
      limit,
      items: rows.map((a): WorkoutAgendaItem => {
        const position = a.institution_workout_positions[0],
          occurrence = position?.institution_events;
        const session =
          position?.institution_sessions || a.institution_sessions[0];
        const days = (
          (a.institution_versions.prescription as any).days || []
        ).filter((d: any) => !d.restDay);
        const day =
          days.find(
            (d: any) => d.id === (position?.day_id || session?.day_id),
          ) || days[a.sequence_cursor % days.length];
        const blocked = restrictions.some(
          (r) => r.athlete_member_id === a.member_id,
        )
          ? "participation_unavailable"
          : a.state !== "active" ||
              a.start_date > today ||
              (a.end_date && a.end_date < today)
            ? "assignment_unavailable"
            : !day
              ? "no_workout_days"
              : null;
        const state =
          position?.state === "paused"
            ? "paused"
            : session
              ? "in_progress"
              : !occurrence
                ? "unscheduled"
                : occurrence.starts_at > now
                  ? "scheduled"
                  : occurrence.ends_at < now
                    ? "overdue"
                    : "ready";
        return {
          assignment_id: a.id,
          member_id: a.member_id,
          member_name:
            a
              .institution_members_institution_assignments_institution_id_member_idToinstitution_members
              .name,
          title: a.institution_versions.title,
          goal: a.goal,
          cursor: a.sequence_cursor,
          day: day ? { id: day.id, name: day.name, nameAr: day.nameAr } : null,
          state,
          blocked,
          occurrence: occurrence
            ? {
                id: occurrence.id,
                revision: occurrence.revision,
                starts_at: occurrence.starts_at.toISOString(),
                ends_at: occurrence.ends_at.toISOString(),
                timezone: occurrence.timezone,
                training_date: occurrence.training_date
                  .toISOString()
                  .slice(0, 10),
              }
            : null,
          session: session
            ? { id: session.id, recorded_mode: session.recorded_mode }
            : null,
          can_start:
            !blocked &&
            !!occurrence &&
            occurrence.state === "scheduled" &&
            occurrence.starts_at <= now &&
            position?.state === "pending" &&
            !session &&
            view !== "admin",
          can_schedule:
            view !== "trainee" &&
            a.state === "active" &&
            !!day &&
            !(a.end_date && a.end_date < today) &&
            blocked !== "participation_unavailable" &&
            !position &&
            !session,
        };
      }),
    };
  });
}

/** Staff scheduling uses existing plan-specific authority and exact command receipts. */
export async function workoutSchedulingCommand(
  actor: Actor,
  institution: string,
  input: Input,
) {
  const view = role(input.view);
  if (view === "trainee") throw new ApiError(403, "forbidden");
  if (
    !["schedule-workout", "skip-workout", "reschedule-workout"].includes(
      String(input.action),
    )
  )
    throw new ApiError(400, "invalid_action");
  const assignment = uuid(input.assignment_id);
  const authorize = async (tx: Tx, self: Member) => {
    const item = await tx.institution_assignments.findFirst({
      where: { id: assignment, institution_id: institution },
    });
    if (!item) throw new ApiError(403, "assignment_unavailable");
    await planAuthority(tx, institution, self, view, item.member_id, [
      item.sport_id,
    ]);
  };
  return mutation(
    actor,
    institution,
    [view],
    input,
    (tx, self) =>
      input.action === "schedule-workout"
        ? scheduleIndividualWorkout(tx, actor, institution, self.id, input)
        : input.action === "skip-workout"
          ? skipIndividualWorkout(tx, actor, institution, self.id, input)
          : rescheduleIndividualWorkout(tx, actor, institution, input),
    authorize,
  );
}
