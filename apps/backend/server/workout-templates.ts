import { ApiError, type Actor } from "./db.ts";
import {
  scoped,
  mutation,
  event,
  uuid,
  textValue,
  type Tx,
  type access,
} from "./institution.ts";
import { role, catalog, snapshot } from "./programming.ts";
import { pageSize } from "./pagination.ts";
import { pageOffset } from "./service-definitions.ts";
import type { Prisma } from "./generated/prisma/client.ts";
type Input = Record<string, unknown>;
type Self = Awaited<ReturnType<typeof access>>;

/** Normalize a single workout using the same catalog/prescription checks as program publication. */
export async function workoutSnapshot(
  tx: Tx,
  institution: string,
  self: Self,
  value: unknown,
) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ApiError(400, "invalid_plan");
  const day = value as Record<string, unknown>;
  if (!Array.isArray(day.exercises) || !day.exercises.length || day.restDay)
    throw new ApiError(400, "invalid_plan");
  // Resolve selected movements once rather than serializing the whole library twice.
  const keys = new Set<string>();
  for (const ex of day.exercises as any[]) {
    if (!ex || typeof ex !== "object" || !Array.isArray(ex.alternatives || []))
      throw new ApiError(400, "invalid_plan");
    if (typeof ex.exerciseId === "string") keys.add(ex.exerciseId);
    for (const alt of ex.alternatives || [])
      if (typeof alt?.exerciseId === "string") keys.add(alt.exerciseId);
  }
  const library = await catalog(tx, institution, self, [...keys]);
  const shared = new Set(
    library.filter((e: any) => e.scope !== "private").map((e: any) => e.id),
  );
  for (const ex of day.exercises as any[]) {
    if (!ex || typeof ex !== "object" || !Array.isArray(ex.alternatives || []))
      throw new ApiError(400, "invalid_plan");
    if (
      (ex.alternatives || []).some(
        (a: unknown) => !a || typeof a !== "object" || Array.isArray(a),
      )
    )
      throw new ApiError(400, "invalid_plan");
    if (
      !shared.has(ex.exerciseId) ||
      (ex.alternatives || []).some((a: any) => !shared.has(a.exerciseId))
    )
      throw new ApiError(400, "template_requires_shared_exercises");
  }
  const prescription = (await snapshot(
    tx,
    institution,
    self,
    {
      schema: 2,
      cycleWeeks: 1,
      days: [{ ...day, week: 1, weekday: 0, restDay: false }],
    },
    library,
  )) as any;
  return prescription.days[0] as Prisma.InputJsonObject;
}
export async function selectedWorkoutTemplate(
  tx: Tx,
  institution: string,
  key: unknown,
  revision: unknown,
) {
  const row = await tx.institution_workout_templates.findFirst({
    where: { id: uuid(key), institution_id: institution, archived: false },
  });
  if (!row) throw new ApiError(404, "workout_template_unavailable");
  if (row.revision !== revision) throw new ApiError(409, "conflict");
  return row;
}
export async function workoutTemplates(
  actor: Actor,
  institution: string,
  query: URLSearchParams,
) {
  const view = role(query.get("view"));
  if (view === "trainee") throw new ApiError(403, "forbidden");
  return scoped(actor, institution, [view], async (tx, self) => {
    const offset = pageOffset(query.get("offset")),
      limit = pageSize(query, 24);
    const where = {
      institution_id: institution,
      ...(query.get("id")
        ? { id: uuid(query.get("id")) }
        : { archived: query.get("archived") === "true" }),
      title: {
        contains: (query.get("search") || "").trim().slice(0, 100),
        mode: "insensitive" as const,
      },
    };
    const [rows, total] = await Promise.all([
      tx.institution_workout_templates.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: [{ updated_at: "desc" }, { id: "asc" }],
      }),
      tx.institution_workout_templates.count({ where }),
    ]);
    return {
      items: rows.map((row) => ({
        ...row,
        can_edit: view === "admin" || row.created_by === self.id,
      })),
      total,
      next: offset + limit < total ? offset + limit : null,
    };
  });
}
export async function workoutTemplateCommand(
  actor: Actor,
  institution: string,
  input: Input,
) {
  const view = role(input.view),
    key = uuid(input.id),
    action = String(input.action);
  if (view === "trainee" || !["save", "archive"].includes(action))
    throw new ApiError(403, "forbidden");
  const authorize = async (tx: Tx, self: Self) => {
    const row = await tx.institution_workout_templates.findUnique({
      where: { id: key },
    });
    if (
      row &&
      (row.institution_id !== institution ||
        (view !== "admin" && row.created_by !== self.id))
    )
      throw new ApiError(403, "forbidden");
    if (!row && action === "archive")
      throw new ApiError(404, "workout_template_unavailable");
  };
  return mutation(
    actor,
    institution,
    [view],
    input,
    async (tx, self) => {
      const row = await tx.institution_workout_templates.findUnique({
        where: { id: key },
      });
      if ((row?.revision || 0) !== input.revision)
        throw new ApiError(409, "conflict");
      let result;
      if (action === "archive") {
        if (typeof input.archived !== "boolean")
          throw new ApiError(400, "invalid_request");
        result = await tx.institution_workout_templates.update({
          where: { id: key },
          data: {
            archived: input.archived,
            revision: { increment: 1 },
            updated_at: new Date(),
          },
        });
      } else {
        const title = textValue(input.title, 80),
          workout = await workoutSnapshot(tx, institution, self, input.workout);
        result = row
          ? await tx.institution_workout_templates.update({
              where: { id: key },
              data: {
                title,
                workout,
                revision: { increment: 1 },
                updated_at: new Date(),
              },
            })
          : await tx.institution_workout_templates.create({
              data: {
                id: key,
                institution_id: institution,
                created_by: self.id,
                title,
                workout,
              },
            });
      }
      await event(tx, actor, institution, "workout_template_updated", key, {
        revision: result.revision,
        archived: result.archived,
      });
      return { ...result, can_edit: true };
    },
    authorize,
  );
}
