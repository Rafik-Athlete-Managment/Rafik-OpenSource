import { ApiError, type Actor } from "./db.ts";
import {
  scoped,
  mutation,
  event,
  uuid,
  access,
  type Tx,
} from "./institution.ts";
import { role, recipient } from "./programming.ts";
import { calendarDate, pageOffset } from "./service-definitions.ts";
import type { Prisma } from "./generated/prisma/client.ts";
type Input = Record<string, unknown>;
type Self = Awaited<ReturnType<typeof access>>;
const day = (s: string) => new Date(s + "T00:00:00Z");
async function subject(
  tx: Tx,
  institution: string,
  self: Self,
  view: ReturnType<typeof role>,
  value: unknown,
  write = false,
) {
  const member = await recipient(
    tx,
    institution,
    self,
    view,
    view === "trainee" ? self.id : uuid(value),
  );
  if (
    (write && (!member.active || !member.roles.includes("trainee"))) ||
    (view === "trainee" && value && value !== self.id)
  )
    throw new ApiError(403, "trainee_unavailable");
  return member;
}
async function today(tx: Tx, member: string) {
  const [value] = await tx.$queryRaw<
    { day: string }[]
  >`SELECT public.institution_member_today(${member}::uuid)::text AS day`;
  return value.day;
}
async function validateFood(tx: Tx, foods: unknown) {
  if (!Array.isArray(foods)) throw new ApiError(400, "invalid_guidance");
  await tx.$queryRaw`SELECT public.validate_nutrition_meals(${JSON.stringify(foods)}::jsonb)::text`;
}
export async function nutrition(
  actor: Actor,
  institution: string,
  q: URLSearchParams,
) {
  const view = role(q.get("view"));
  return scoped(actor, institution, [view], async (tx, self) => {
    if (view !== "trainee" && !q.get("member")) return { member: null };
    const member = await subject(tx, institution, self, view, q.get("member"));
    const currentDay = await today(tx, member.id);
    const selectedDay = calendarDate(q.get("date") || currentDay);
    const where = { institution_id: institution, member_id: member.id };
    const sharing = await tx.institution_nutrition_sharing.findUnique({
      where: { member_id: member.id },
    });
    const canReadDiary = view === "trainee" || sharing?.enabled === true;
    let offset = pageOffset(q.get("offset"));
    if (q.get("plan")) {
      const selected = await tx.institution_nutrition_plans.findFirst({
        where: { ...where, id: uuid(q.get("plan")) },
      });
      if (!selected) throw new ApiError(404, "resource_unavailable");
      const newer = await tx.institution_nutrition_plans.count({
        where: { ...where, revision: { gt: selected.revision } },
      });
      offset = Math.floor(newer / 10) * 10;
    }
    const [plans, total, latest, current, meals] = await Promise.all([
      tx.institution_nutrition_plans.findMany({
        where,
        orderBy: { revision: "desc" },
        skip: offset,
        take: 10,
      }),
      tx.institution_nutrition_plans.count({ where }),
      tx.institution_nutrition_plans.findFirst({
        where,
        orderBy: { revision: "desc" },
        select: { revision: true },
      }),
      tx.institution_nutrition_plans.findFirst({
        where: { ...where, effective_on: { lte: day(selectedDay) } },
        orderBy: [{ effective_on: "desc" }, { revision: "desc" }],
      }),
      canReadDiary
        ? tx.institution_meals.findMany({
            where: { ...where, logged_on: day(selectedDay), removed: false },
            orderBy: [{ created_at: "asc" }, { id: "asc" }],
            take: 200,
          })
        : [],
    ]);
    const removedOffset = pageOffset(q.get("removedOffset"));
    const removed =
      canReadDiary && q.get("removed") === "true"
        ? await tx.institution_meals.findMany({
            where: { ...where, logged_on: day(selectedDay), removed: true },
            orderBy: [{ updated_at: "desc" }, { id: "asc" }],
            skip: removedOffset,
            take: 11,
          })
        : [];
    const authors = await tx.institution_members.findMany({
      where: {
        institution_id: institution,
        id: {
          in: [
            ...new Set(
              [...plans, ...(current ? [current] : [])].map((p) => p.author_id),
            ),
          ],
        },
      },
      select: { id: true, name: true },
    });
    let corrections: unknown[] = [];
    let correctionsNext: number | null = null;
    if (canReadDiary && q.get("meal")) {
      const meal = await tx.institution_meals.findUnique({
        where: { id: uuid(q.get("meal")) },
      });
      if (
        !meal ||
        meal.member_id !== member.id ||
        meal.institution_id !== institution
      )
        throw new ApiError(403, "forbidden");
      const historyOffset = pageOffset(q.get("historyOffset"));
      const records = await tx.institution_meal_history.findMany({
        where: { meal_id: meal.id },
        orderBy: { revision: "desc" },
        skip: historyOffset,
        take: 11,
      });
      corrections = records.slice(0, 10);
      correctionsNext = records.length > 10 ? historyOffset + 10 : null;
    }
    return {
      member: {
        id: member.id,
        name: member.name,
        active: member.active,
        roles: member.roles,
      },
      today: currentDay,
      date: selectedDay,
      sharing: {
        enabled: sharing?.enabled || false,
        revision: sharing?.revision || 0,
      },
      canReadDiary,
      current:
        current &&
        (!current.expires_on || current.expires_on >= day(selectedDay))
          ? current
          : null,
      removed: removed.slice(0, 10),
      removedNext: removed.length > 10 ? removedOffset + 10 : null,
      latestRevision: latest?.revision || 0,
      plans,
      total,
      next: offset + 10 < total ? offset + 10 : null,
      authors,
      meals,
      corrections,
      correctionsNext,
    };
  });
}
export async function nutritionCommand(
  actor: Actor,
  institution: string,
  input: Input,
) {
  const view = role(input.view),
    action = String(input.action);
  if (
    !["publish", "sharing", "meal", "remove"].includes(action) ||
    (action === "publish" ? view === "trainee" : view !== "trainee")
  )
    throw new ApiError(403, "forbidden");
  async function authorize(tx: Tx, self: Self) {
    const member = await subject(
      tx,
      institution,
      self,
      view,
      input.member,
      true,
    );
    if (action === "meal" || action === "remove") {
      const old = await tx.institution_meals.findUnique({
        where: { id: uuid(input.id) },
      });
      if (
        old &&
        (old.institution_id !== institution || old.member_id !== member.id)
      )
        throw new ApiError(403, "forbidden");
    }
  }
  return mutation(
    actor,
    institution,
    [view],
    input,
    async (tx, self) => {
      const member = await subject(
        tx,
        institution,
        self,
        view,
        input.member,
        true,
      );
      const where = { institution_id: institution, member_id: member.id };
      if (action === "sharing") {
        if (typeof input.enabled !== "boolean")
          throw new ApiError(400, "invalid_request");
        const old = await tx.institution_nutrition_sharing.findUnique({
          where: { member_id: member.id },
        });
        if ((old?.revision || 0) !== input.revision)
          throw new ApiError(409, "conflict");
        const result = await tx.institution_nutrition_sharing.upsert({
          where: { member_id: member.id },
          create: { ...where, enabled: input.enabled },
          update: {
            enabled: input.enabled,
            revision: { increment: 1 },
            updated_at: new Date(),
          },
        });
        await event(
          tx,
          actor,
          institution,
          "nutrition_sharing_changed",
          member.id,
        );
        return result;
      }
      const currentDay = await today(tx, member.id);
      if (action === "publish") {
        const effective = calendarDate(input.effective_on),
          expiry = input.expires_on ? calendarDate(input.expires_on) : null;
        if (
          effective < currentDay ||
          day(effective).getTime() >
            day(currentDay).getTime() + 366 * 86400000 ||
          (expiry &&
            (expiry < effective ||
              day(expiry).getTime() >
                day(effective).getTime() + 366 * 86400000))
        )
          throw new ApiError(400, "invalid_date");
        if (typeof input.guidance !== "string" || input.guidance.length > 4000)
          throw new ApiError(400, "invalid_guidance");
        const latest = await tx.institution_nutrition_plans.findFirst({
          where,
          orderBy: { revision: "desc" },
        });
        if ((latest?.revision || 0) !== input.revision)
          throw new ApiError(409, "conflict");
        if (
          !input.targets ||
          typeof input.targets !== "object" ||
          Array.isArray(input.targets)
        )
          throw new ApiError(400, "invalid_guidance");
        await tx.$queryRaw`SELECT public.validate_nutrients(${JSON.stringify(input.targets)}::jsonb)::text`;
        await validateFood(tx, input.meals);
        if (
          !Object.values(input.targets).some((v) => v !== null) &&
          !(input.meals as unknown[]).length &&
          !input.guidance.trim()
        )
          throw new ApiError(400, "invalid_guidance");
        const result = await tx.institution_nutrition_plans.create({
          data: {
            id: uuid(input.id),
            ...where,
            author_id: self.id,
            revision: (latest?.revision || 0) + 1,
            effective_on: day(effective),
            expires_on: expiry ? day(expiry) : null,
            targets: input.targets as Prisma.InputJsonValue,
            meals: input.meals as Prisma.InputJsonValue,
            guidance: input.guidance.trim(),
          },
        });
        await event(
          tx,
          actor,
          institution,
          "nutrition_plan_published",
          member.id,
          { revision: result.revision },
        );
        return result;
      }
      const old = await tx.institution_meals.findUnique({
        where: { id: uuid(input.id) },
      });
      if ((old?.revision || 0) !== input.revision || old?.removed)
        throw new ApiError(409, "conflict");
      if (action === "remove" && !old) throw new ApiError(404, "not_found");
      let result;
      if (action === "remove")
        result = await tx.institution_meals.update({
          where: { id: old!.id },
          data: {
            removed: true,
            revision: { increment: 1 },
            updated_at: new Date(),
          },
        });
      else {
        const date = calendarDate(input.logged_on);
        if (
          date > currentDay ||
          day(date).getTime() < day(currentDay).getTime() - 366 * 86400000
        )
          throw new ApiError(400, "invalid_date");
        await validateFood(tx, [input.food]);
        if (typeof input.note !== "string" || input.note.length > 2000)
          throw new ApiError(400, "invalid_request");
        const count = await tx.institution_meals.count({
          where: {
            ...where,
            logged_on: day(date),
            removed: false,
            ...(old ? { id: { not: old.id } } : {}),
          },
        });
        if (count >= 200) throw new ApiError(400, "daily_limit");
        const data = {
          logged_on: day(date),
          food: input.food as Prisma.InputJsonValue,
          note: input.note.trim(),
        };
        result = old
          ? await tx.institution_meals.update({
              where: { id: old.id },
              data: {
                ...data,
                revision: { increment: 1 },
                updated_at: new Date(),
              },
            })
          : await tx.institution_meals.create({
              data: { id: uuid(input.id), ...where, ...data },
            });
      }
      await tx.institution_meal_history.create({
        data: {
          institution_id: institution,
          meal_id: result.id,
          revision: result.revision,
          document: JSON.parse(JSON.stringify(result)),
        },
      });
      // No meal-level event is exposed through the staff activity feed while diary sharing is off.
      return result;
    },
    authorize,
  );
}
