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
import {
  definition,
  assessmentValues,
  ids,
  calendarDate,
  pageOffset,
  type Drill,
} from "./service-definitions.ts";
import type { Prisma } from "./generated/prisma/client.ts";
type Input = Record<string, unknown>;
type Self = Awaited<ReturnType<typeof access>>;
const json = (v: unknown) => v as Prisma.InputJsonValue;
export async function eventAccess(
  tx: Tx,
  id: string,
  self: Self,
  view: Role,
  key: string,
) {
  const item = await tx.institution_events.findUnique({
    where: { id: uuid(key) },
    include: {
      institution_event_people: {
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
  if (
    !item ||
    item.institution_id !== id ||
    (view !== "admin" &&
      !item.institution_event_people.some(
        (p) =>
          p.member_id === self.id &&
          p.duty === (view === "trainer" ? "staff" : "trainee"),
      ))
  )
    throw new ApiError(403, "event_unavailable");
  return item;
}
/** Web staff index: scheduled group training and assessments, independent of workout logs. */
export async function scheduledEvents(
  actor: Actor,
  id: string,
  q: URLSearchParams,
) {
  const view = role(q.get("view"));
  if (view === "trainee") throw new ApiError(403, "forbidden");
  const kind = q.get("kind") || "all";
  const state = q.get("state") || "all";
  if (
    !["all", "training", "assessment"].includes(kind) ||
    !["all", "scheduled", "completed", "cancelled"].includes(state)
  )
    throw new ApiError(400, "invalid_request");
  const take = pageSize(q, 10);
  const offset = pageOffset(q.get("offset"));
  const search = (q.get("search") || "").trim().slice(0, 100);
  return scoped(actor, id, [view], async (tx, self) => {
    const where = {
      institution_id: id,
      ...(q.get("includeDayOnly") === "true" ? {} : { timing_mode: "timed" }),
      ...(kind !== "all" ? { kind } : {}),
      ...(state !== "all" ? { state } : {}),
      ...(search
        ? { title: { contains: search, mode: "insensitive" as const } }
        : {}),
      ...(view === "trainer"
        ? {
            institution_event_people: {
              some: { member_id: self.id, duty: "staff" },
            },
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      tx.institution_events.findMany({
        where,
        skip: offset,
        take,
        orderBy: [{ starts_at: "desc" }, { id: "asc" }],
        select: {
          id: true,
          title: true,
          kind: true,
          state: true,
          starts_at: true,
          ends_at: true,
          timing_mode: true,
          training_date: true,
          timezone: true,
          location: true,
          _count: {
            select: {
              institution_event_people: { where: { duty: "trainee" } },
            },
          },
        },
      }),
      tx.institution_events.count({ where }),
    ]);
    return {
      items: items.map(({ _count, ...item }) => ({
        ...item,
        training_date: item.training_date.toISOString().slice(0, 10),
        athlete_count: _count.institution_event_people,
      })),
      total,
      next: offset + take < total ? offset + take : null,
    };
  });
}

export async function calendar(actor: Actor, id: string, q: URLSearchParams) {
  const view = role(q.get("view"));
  return scoped(actor, id, [view], async (tx, self) => {
    if (q.get("id")) {
      const item = await eventAccess(tx, id, self, view, q.get("id")!);
      if (item.timing_mode === "day" && q.get("includeDayOnly") !== "true")
        throw new ApiError(409, "day_only_event_requires_update");
      const people = item.institution_event_people.filter(
        (p) =>
          view !== "trainee" || p.duty === "staff" || p.member_id === self.id,
      );
      const where = {
        event_id: item.id,
        ...(view === "trainee" ? { member_id: self.id } : {}),
      };
      const historyMember = q.get("historyMember"),
        historyOffset = pageOffset(q.get("historyOffset"));
      if (
        historyMember &&
        !people.some(
          (p) => p.member_id === historyMember && p.duty === "trainee",
        )
      )
        throw new ApiError(403, "forbidden");
      if (q.get("historyOnly") === "true") {
        if (!historyMember) throw new ApiError(400, "invalid_request");
        const kind = q.get("historyKind") || "results";
        if (!["attendance", "results"].includes(kind))
          throw new ApiError(400, "invalid_request");
        if (kind === "attendance") {
          const rows = await tx.institution_audit_events.findMany({
            where: {
              institution_id: id,
              subject_id: item.id,
              kind: "attendance_recorded",
              detail: { path: ["member"], equals: historyMember },
            },
            orderBy: [{ created_at: "desc" }, { id: "desc" }],
            skip: historyOffset,
            take: 26,
            select: {
              id: true,
              actor_id: true,
              created_at: true,
              detail: true,
            },
          });
          const actors = await tx.institution_members.findMany({
            where: {
              institution_id: id,
              user_id: {
                in: rows.flatMap((r) => (r.actor_id ? [r.actor_id] : [])),
              },
            },
            select: { user_id: true, id: true, name: true },
          });
          return {
            items: rows.slice(0, 25).map((r) => {
              const detail = r.detail as Record<string, unknown>;
              const actor = actors.find((a) => a.user_id === r.actor_id);
              return {
                id: r.id,
                kind,
                member_id: historyMember,
                recorded_at: r.created_at,
                recorded_by: actor?.id || null,
                recorded_name: actor?.name || null,
                previous_attendance: detail.previous_attendance,
                attendance: detail.attendance,
              };
            }),
            next: rows.length > 25 ? historyOffset + 25 : null,
          };
        }
        const rows = await tx.assessment_result_history.findMany({
          where: { ...where, member_id: historyMember },
          orderBy: [{ recorded_at: "desc" }, { id: "desc" }],
          skip: historyOffset,
          take: 26,
        });
        const actors = await tx.institution_members.findMany({
          where: {
            institution_id: id,
            id: { in: rows.map((r) => r.recorded_by) },
          },
          select: { id: true, name: true },
        });
        return {
          items: rows.slice(0, 25).map((r) => ({
            id: r.id,
            kind,
            member_id: r.member_id,
            revision: r.revision,
            recorded_at: r.recorded_at,
            recorded_by: r.recorded_by,
            recorded_name:
              actors.find((a) => a.id === r.recorded_by)?.name || null,
            values: (r.document as Record<string, unknown>).values,
            note: (r.document as Record<string, unknown>).note,
          })),
          next: rows.length > 25 ? historyOffset + 25 : null,
        };
      }
      const history =
        q.get("summary") === "true"
          ? []
          : await tx.assessment_result_history.findMany({
              where: {
                ...where,
                ...(historyMember ? { member_id: uuid(historyMember) } : {}),
              },
              orderBy: [{ recorded_at: "desc" }, { id: "desc" }],
              skip: historyOffset,
              take: historyMember ? 26 : 101,
            });
      return {
        event: {
          ...item,
          training_date: item.training_date.toISOString().slice(0, 10),
          institution_event_people: undefined,
        },
        people: people.map((p) => ({
          ...p,
          institution_members: undefined,
          name: p.institution_members.name,
          active: p.institution_members.active,
          roles: p.institution_members.roles,
        })),
        results: await tx.assessment_results.findMany({ where }),
        history: history.slice(0, historyMember ? 25 : 100),
        historyNext:
          history.length > (historyMember ? 25 : 100)
            ? historyOffset + (historyMember ? 25 : 100)
            : null,
      };
    }
    const from = calendarDate(q.get("from")),
      to = calendarDate(q.get("to"));
    if (to < from || Date.parse(to) - Date.parse(from) > 31 * 86400000)
      throw new ApiError(400, "invalid_date");
    const zone = String(q.get("zone") || "UTC");
    const bounds = await tx.$queryRaw<
      { start: Date; end: Date }[]
    >`SELECT ${from}::date::timestamp AT TIME ZONE ${zone} AS start,(${to}::date+1)::timestamp AT TIME ZONE ${zone} AS end`;
    const where = {
      institution_id: id,
      OR: [
        {
          timing_mode: "timed",
          starts_at: { lt: bounds[0].end },
          ends_at: { gt: bounds[0].start },
        },
        ...(q.get("includeDayOnly") === "true"
          ? [
              {
                timing_mode: "day",
                training_date: {
                  gte: new Date(from + "T00:00:00Z"),
                  lte: new Date(to + "T00:00:00Z"),
                },
              },
            ]
          : []),
      ],
      ...(view !== "admin"
        ? {
            institution_event_people: {
              some: {
                member_id: self.id,
                duty: view === "trainer" ? "staff" : "trainee",
              },
            },
          }
        : {}),
    };
    const offset = pageOffset(q.get("offset"));
    const [items, total] = await Promise.all([
      tx.institution_events.findMany({
        where,
        orderBy: [{ starts_at: "asc" }, { id: "asc" }],
        skip: offset,
        take: 50,
        include: {
          institution_event_people: {
            select: {
              member_id: true,
              duty: true,
              attendance: true,
              institution_members: {
                select: { name: true, active: true, roles: true },
              },
            },
          },
        },
      }),
      tx.institution_events.count({ where }),
    ]);
    return {
      items: items.map((e) => ({
        ...e,
        training_date: e.training_date.toISOString().slice(0, 10),
        definition: undefined,
        institution_event_people: undefined,
        people: e.institution_event_people
          .filter(
            (p) =>
              view !== "trainee" ||
              p.duty === "staff" ||
              p.member_id === self.id,
          )
          .map((p) => ({
            ...p,
            institution_members: undefined,
            name: p.institution_members.name,
            active: p.institution_members.active,
            roles: p.institution_members.roles,
          })),
      })),
      next: offset + 50 < total ? offset + 50 : null,
    };
  });
}
export async function calendarPreview(actor: Actor, id: string, input: Input) {
  const view = role(input.view);
  if (view === "trainee") throw new ApiError(403, "forbidden");
  return scoped(actor, id, [view], async (tx) => preview(tx, input));
}
async function preview(tx: Tx, input: Input) {
  if (
    typeof input.local !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input.local) ||
    typeof input.zone !== "string"
  )
    throw new ApiError(400, "invalid_availability");
  for (const field of ["minutes", "count", "every"])
    if (typeof input[field] !== "number" || !Number.isSafeInteger(input[field]))
      throw new ApiError(400, "invalid_availability");
  const result = await tx.$queryRaw<
    { value: { starts_at: string; ends_at: string; local_start: string }[] }[]
  >`SELECT public.availability_preview(${input.local}::timestamp,${input.zone}::text,${Number(input.minutes)}::int,${Number(input.count)}::int,${Number(input.every)}::int) value`;
  return result[0].value;
}
async function eventPeople(
  tx: Tx,
  id: string,
  self: Self,
  view: Role,
  input: Input,
) {
  const staff = ids(input.staff, 8),
    participants = ids(input.participants, 100);
  if (staff.some((x) => participants.includes(x)))
    throw new ApiError(400, "invalid_recipients");
  if (view === "trainer" && (staff.length !== 1 || staff[0] !== self.id))
    throw new ApiError(403, "forbidden");
  const members = [];
  for (const key of staff) {
    const m = await tx.institution_members.findUnique({ where: { id: key } });
    if (
      !m ||
      m.institution_id !== id ||
      !m.active ||
      !m.roles.includes("trainer")
    )
      throw new ApiError(403, "trainer_unavailable");
    members.push(m);
  }
  for (const key of participants)
    members.push(await recipient(tx, id, self, view, key, true, "training"));
  return { staff, participants, members };
}
export async function calendarCommand(actor: Actor, id: string, input: Input) {
  const view = role(input.view),
    key = uuid(input.id),
    action = String(input.action);
  if (view === "trainee") throw new ApiError(403, "forbidden");
  const authorize = async (tx: Tx, self: Self) => {
    if (action === "create") {
      const authorized = await eventPeople(tx, id, self, view, input);
      const makeups = Array.isArray(input.makeups) ? input.makeups : [];
      for (const choice of makeups)
        if (
          choice &&
          typeof choice === "object" &&
          "makeup_for" in choice &&
          choice.makeup_for
        ) {
          const makeup_for = uuid(String(choice.makeup_for));
          const member = uuid(String(choice.member));
          const original = (
            await tx.$queryRaw<
              { state: string; attendance: string }[]
            >`SELECT e.state,p.attendance FROM public.institution_events e JOIN public.institution_event_people p ON p.event_id=e.id WHERE e.institution_id=${id}::uuid AND e.id=${makeup_for}::uuid AND p.member_id=${member}::uuid AND p.duty='trainee'`
          )[0];
          if (
            !original ||
            original.state !== "completed" ||
            !["absent", "excused"].includes(original.attendance)
          )
            throw new ApiError(403, "makeup_unavailable");
        }
      const existing = await tx.institution_events.findUnique({
        where: { id: key },
      });
      if (existing && existing.institution_id !== id)
        throw new ApiError(403, "forbidden");
    } else await eventAccess(tx, id, self, view, key);
  };
  return mutation(
    actor,
    id,
    [view],
    input,
    async (tx, self) => {
      if (action === "create") {
        const { staff, participants, members } = await eventPeople(
            tx,
            id,
            self,
            view,
            input,
          ),
          times = await preview(tx, input);
        const title = textValue(input.title),
          location =
            typeof input.location === "string" ? input.location.trim() : "";
        if (
          location.length > 500 ||
          !["training", "assessment"].includes(String(input.kind))
        )
          throw new ApiError(400, "invalid_request");
        let template = null;
        if (input.kind === "assessment") {
          template = await tx.assessment_templates.findUnique({
            where: { id: uuid(input.template) },
          });
          if (
            !template ||
            template.institution_id !== id ||
            template.archived ||
            (view === "trainer" && template.created_by !== self.id)
          )
            throw new ApiError(403, "template_unavailable");
          if (template.revision !== input.template_revision)
            throw new ApiError(409, "conflict");
        }
        const makeups = new Map<string, string>();
        if (Array.isArray(input.makeups))
          for (const entry of input.makeups) {
            if (!entry || typeof entry !== "object") continue;
            const choice = entry as Record<string, unknown>;
            if (
              typeof choice.member === "string" &&
              typeof choice.makeup_for === "string"
            )
              makeups.set(uuid(choice.member), uuid(choice.makeup_for));
          }
        if (
          [...makeups.keys()].some((member) => !participants.includes(member))
        )
          throw new ApiError(400, "invalid_recipients");
        const list = [];
        for (let i = 0; i < times.length; i++) {
          const start = new Date(times[i].starts_at),
            end = new Date(times[i].ends_at);
          if (
            start <= new Date() ||
            start.getTime() > Date.now() + 366 * 86400000
          )
            throw new ApiError(400, "invalid_availability");
          await tx.$queryRaw`SELECT public.validate_calendar_collision(${members.map((m) => m.user_id).filter(Boolean)}::uuid[],${start},${end},NULL::uuid)::text`;
          const item = await tx.institution_events.create({
            data: {
              ...(i === 0 ? { id: key } : {}),
              institution_id: id,
              created_by: self.id,
              series_id: key,
              title,
              location,
              starts_at: start,
              ends_at: end,
              timezone: String(input.zone),
              kind: String(input.kind),
              ...(template
                ? {
                    template_id: template.id,
                    template_revision: template.revision,
                    definition: json(template.definition),
                  }
                : {}),
            },
          });
          await tx.institution_event_people.createMany({
            data: [
              ...staff.map((member_id) => ({
                institution_id: id,
                event_id: item.id,
                member_id,
                duty: "staff",
              })),
              ...participants.map((member_id) => ({
                institution_id: id,
                event_id: item.id,
                member_id,
                duty: "trainee",
                makeup_for: makeups.get(member_id) || null,
              })),
            ],
          });
          list.push(item);
        }
        await event(tx, actor, id, "calendar_scheduled", key, {
          count: list.length,
        });
        return list;
      }
      const item = await eventAccess(tx, id, self, view, key);
      // Bound individual work must retain sequence identity and explicit resolution.
      const boundWorkout = await tx.institution_workout_positions.findFirst({
        where: { institution_id: id, occurrence_id: key },
      });
      if (
        boundWorkout &&
        ["reschedule", "cancel", "staff", "finish"].includes(action)
      )
        throw new ApiError(409, "use_workout_scheduling");

      if (
        action !== "result" &&
        action !== "attendance" &&
        action !== "session-note" &&
        item.revision !== input.revision
      )
        throw new ApiError(409, "conflict");
      if (action === "reschedule") {
        if (
          !item.starts_at ||
          item.state !== "scheduled" ||
          item.starts_at <= new Date()
        )
          throw new ApiError(400, "event_unavailable");
        const times = await preview(tx, { ...input, count: 1, every: 7 }),
          start = new Date(times[0].starts_at),
          end = new Date(times[0].ends_at);
        if (
          start <= new Date() ||
          start.getTime() > Date.now() + 366 * 86400000
        )
          throw new ApiError(400, "invalid_availability");
        const inactive = item.institution_event_people.some(
          (p) =>
            !p.institution_members.active ||
            !p.institution_members.roles.includes(
              p.duty === "staff" ? "trainer" : "trainee",
            ),
        );
        if (inactive) throw new ApiError(400, "inactive_participant");
        await tx.$queryRaw`SELECT public.validate_calendar_collision(${item.institution_event_people.map((p) => p.institution_members.user_id).filter(Boolean)}::uuid[],${start},${end},${key}::uuid)::text`;
        const changed = await tx.institution_events.update({
          where: { id: key },
          data: {
            starts_at: start,
            ends_at: end,
            timezone: String(input.zone),
            revision: { increment: 1 },
          },
        });
        await event(tx, actor, id, "calendar_rescheduled", key);
        return changed;
      }
      if (action === "staff") {
        if (view !== "admin" || item.state !== "scheduled")
          throw new ApiError(403, "forbidden");
        const staff = ids(input.staff, 8),
          trainees = item.institution_event_people.filter(
            (p) => p.duty === "trainee",
          );
        const members = await tx.institution_members.findMany({
          where: {
            id: { in: staff },
            institution_id: id,
            active: true,
            roles: { has: "trainer" },
          },
        });
        if (
          members.length !== staff.length ||
          trainees.some((p) => staff.includes(p.member_id))
        )
          throw new ApiError(400, "invalid_recipients");
        await tx.$queryRaw`SELECT public.validate_calendar_collision(${members.map((m) => m.user_id).filter(Boolean)}::uuid[],${item.starts_at},${item.ends_at},${key}::uuid)::text`;
        await tx.institution_event_people.deleteMany({
          where: { event_id: key, duty: "staff" },
        });
        await tx.institution_event_people.createMany({
          data: staff.map((member_id) => ({
            institution_id: id,
            event_id: key,
            member_id,
            duty: "staff",
          })),
        });
        await event(tx, actor, id, "calendar_staff_reassigned", key);
        return tx.institution_events.update({
          where: { id: key },
          data: { revision: { increment: 1 } },
        });
      }
      if (action === "cancel") {
        if (!item.starts_at) throw new ApiError(409, "use_workout_scheduling");
        if (
          item.state === "completed" ||
          (await tx.assessment_results.count({ where: { event_id: key } }))
        )
          throw new ApiError(400, "event_has_results");
        const targets =
          input.future_series === true
            ? await tx.institution_events.findMany({
                where: {
                  institution_id: id,
                  series_id: item.series_id,
                  starts_at: { gte: item.starts_at },
                  state: "scheduled",
                },
              })
            : [item];
        if (
          input.future_series === true &&
          (item.starts_at <= new Date() || targets.length > 8)
        )
          throw new ApiError(400, "event_unavailable");
        for (const target of targets) {
          await eventAccess(tx, id, self, view, target.id);
          if (
            await tx.assessment_results.count({
              where: { event_id: target.id },
            })
          )
            throw new ApiError(400, "event_has_results");
        }
        await tx.institution_events.updateMany({
          where: { id: { in: targets.map((e) => e.id) } },
          data: { state: "cancelled", revision: { increment: 1 } },
        });
        await event(tx, actor, id, "calendar_cancelled", key, {
          count: targets.length,
        });
        return { cancelled: targets.length };
      }
      if (
        item.state === "cancelled" ||
        (item.starts_at
          ? item.starts_at > new Date()
          : item.training_date.toISOString().slice(0, 10) >
            new Intl.DateTimeFormat("en-CA", {
              timeZone: item.timezone,
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }).format(new Date()))
      )
        throw new ApiError(400, "event_not_started");
      if (action === "session-note") {
        const member = uuid(input.member),
          person = item.institution_event_people.find(
            (p) => p.member_id === member && p.duty === "trainee",
          );
        if (!person) throw new ApiError(403, "trainee_unavailable");
        if (person.revision !== input.revision)
          throw new ApiError(409, "conflict");
        const note = typeof input.note === "string" ? input.note.trim() : "";
        if (note.length > 2000) throw new ApiError(400, "invalid_request");
        const result = await tx.institution_event_people.update({
          where: { event_id_member_id: { event_id: key, member_id: member } },
          data: { session_note: note, revision: { increment: 1 } },
        });
        await event(tx, actor, id, "session_note_recorded", key, {
          member,
          revision: result.revision,
        });
        return result;
      }
      if (action === "attendance") {
        const member = uuid(input.member),
          person = item.institution_event_people.find(
            (p) => p.member_id === member && p.duty === "trainee",
          );
        if (
          !person ||
          !["unmarked", "present", "absent", "excused"].includes(
            String(input.attendance),
          )
        )
          throw new ApiError(400, "invalid_request");
        if (person.revision !== input.revision)
          throw new ApiError(409, "conflict");
        if (
          item.state === "completed" &&
          (input.attendance === "unmarked" ||
            (item.kind === "assessment" &&
              input.attendance === "present" &&
              !(await tx.assessment_results.findUnique({
                where: {
                  event_id_member_id: { event_id: key, member_id: member },
                },
              }))))
        )
          throw new ApiError(400, "results_required");
        const result = await tx.institution_event_people.update({
          where: { event_id_member_id: { event_id: key, member_id: member } },
          data: {
            attendance: String(input.attendance),
            checked_in_at:
              input.attendance === "present"
                ? person.checked_in_at || new Date()
                : person.checked_in_at,
            revision: { increment: 1 },
          },
        });
        await event(tx, actor, id, "attendance_recorded", key, {
          member,
          attendance: String(input.attendance),
          previous_attendance: person.attendance,
        });
        return result;
      }
      if (action === "result") {
        if (item.kind !== "assessment")
          throw new ApiError(400, "invalid_assessment");
        const member = uuid(input.member),
          person = item.institution_event_people.find(
            (p) => p.member_id === member && p.duty === "trainee",
          );
        if (!person || person.attendance !== "present")
          throw new ApiError(400, "attendance_required");
        const old = await tx.assessment_results.findUnique({
          where: { event_id_member_id: { event_id: key, member_id: member } },
        });
        if ((old?.revision || 0) !== input.revision)
          throw new ApiError(409, "conflict");
        const note = typeof input.note === "string" ? input.note.trim() : "";
        if (note.length > 2000) throw new ApiError(400, "invalid_results");
        const data = {
          values: assessmentValues(definition(item.definition), input.values),
          note,
          recorded_by: self.id,
          recorded_at: new Date(),
        };
        const result = old
          ? await tx.assessment_results.update({
              where: {
                event_id_member_id: { event_id: key, member_id: member },
              },
              data: { ...data, revision: { increment: 1 } },
            })
          : await tx.assessment_results.create({
              data: {
                ...data,
                institution_id: id,
                event_id: key,
                member_id: member,
              },
            });
        await tx.assessment_result_history.create({
          data: {
            institution_id: id,
            event_id: key,
            member_id: member,
            revision: result.revision,
            document: json(data),
            recorded_by: self.id,
          },
        });
        await event(tx, actor, id, "assessment_result_recorded", key, {
          member,
          revision: result.revision,
        });
        return result;
      }
      if (action === "finish") {
        const participants = item.institution_event_people.filter(
          (p) => p.duty === "trainee",
        );
        if (participants.some((p) => p.attendance === "unmarked"))
          throw new ApiError(400, "attendance_required");
        if (item.kind === "assessment")
          for (const p of participants.filter(
            (p) => p.attendance === "present",
          ))
            if (
              !(await tx.assessment_results.findUnique({
                where: {
                  event_id_member_id: { event_id: key, member_id: p.member_id },
                },
              }))
            )
              throw new ApiError(400, "results_required");
        await event(tx, actor, id, "calendar_completed", key);
        return tx.institution_events.update({
          where: { id: key },
          data: { state: "completed", revision: { increment: 1 } },
        });
      }
      throw new ApiError(400, "invalid_request");
    },
    authorize,
  );
}
