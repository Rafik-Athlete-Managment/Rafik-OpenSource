import { experienceReport } from "./experience-report.ts";
import { ApiError, asActor, type Actor } from "./db.ts";
import { scoped, uuid } from "./institution.ts";
import { role, recipient } from "./programming.ts";
import { calendarDate, pageOffset } from "./service-definitions.ts";
export async function analyticWindow(actor: Actor, q: URLSearchParams) {
  const from = calendarDate(q.get("from")),
    to = calendarDate(q.get("to"));
  if (to < from || Date.parse(to) - Date.parse(from) > 366 * 86400000)
    throw new ApiError(400, "invalid_date");
  return asActor(actor, async (tx) => {
    const p = await tx.profiles.findUnique({
        where: { id: actor.id },
        select: { timezone: true },
      }),
      zone = p?.timezone || "UTC";
    const [bounds] = await tx.$queryRaw<
      { start: Date; end: Date }[]
    >`SELECT ${from}::date::timestamp AT TIME ZONE ${zone} AS start,(${to}::date+1)::timestamp AT TIME ZONE ${zone} AS end`;
    return { from, to, zone, ...bounds };
  });
}
export async function institutionAnalytics(
  actor: Actor,
  id: string,
  q: URLSearchParams,
) {
  const view = role(q.get("view"));
  if (view === "trainee") throw new ApiError(403, "forbidden");
  const window = await analyticWindow(actor, q);
  return scoped(actor, id, [view], async (tx, self) => {
    const selected = q.get("member") ? uuid(q.get("member")) : null;
    if (selected) await recipient(tx, id, self, view, selected);
    const trainer = view === "trainer" ? self.id : null;
    const [summary] = await tx.$queryRaw<any[]>`WITH roster AS (
   SELECT m.* FROM public.institution_members m WHERE m.institution_id=${id}::uuid AND (${trainer}::uuid IS NULL OR m.trainer_id=${trainer}::uuid) AND (${selected}::uuid IS NULL OR m.id=${selected}::uuid)
  ), active AS (SELECT * FROM roster WHERE active AND 'trainee'=ANY(roles)),completed AS (
   SELECT s.* FROM public.institution_sessions s JOIN roster m ON m.id=s.member_id WHERE s.completed_at>=${window.start} AND s.completed_at<${window.end}
  ) SELECT (SELECT count(*)::int FROM active) AS active,(SELECT count(*)::int FROM active WHERE trainer_id IS NULL) AS unassigned,
   (SELECT count(*)::int FROM active m WHERE NOT EXISTS(SELECT 1 FROM public.institution_assignments a WHERE a.member_id=m.id AND a.state='active' AND a.start_date<=(now() AT TIME ZONE ${window.zone})::date AND (a.end_date IS NULL OR a.end_date>=(now() AT TIME ZONE ${window.zone})::date))) AS without_program,
   (SELECT count(*)::int FROM active WHERE joined_at>=${window.start} AND joined_at<${window.end}) AS joined,
   (SELECT count(*)::int FROM completed) AS completed,
   (SELECT count(DISTINCT c.member_id)::int FROM completed c JOIN active a ON a.id=c.member_id) AS participating,
   (SELECT count(*)::int FROM completed WHERE document->>'reviewed_at' IS NULL) AS pending_review,
   (SELECT count(*)::int FROM completed WHERE recorded_mode='delegated') AS coach_recorded`;
    const daily = await tx.$queryRaw<
      any[]
    >`SELECT (s.completed_at AT TIME ZONE ${window.zone})::date::text AS date,count(*)::int AS value FROM public.institution_sessions s JOIN public.institution_members m ON m.id=s.member_id WHERE s.institution_id=${id}::uuid AND (${trainer}::uuid IS NULL OR m.trainer_id=${trainer}::uuid) AND (${selected}::uuid IS NULL OR m.id=${selected}::uuid) AND s.completed_at>=${window.start} AND s.completed_at<${window.end} GROUP BY 1 ORDER BY 1`;
    const attendance = await tx.$queryRaw<
      any[]
    >`SELECT p.attendance AS label,count(*)::int AS value FROM public.institution_event_people p JOIN public.institution_events e ON e.id=p.event_id JOIN public.institution_members m ON m.id=p.member_id WHERE e.institution_id=${id}::uuid AND p.duty='trainee' AND e.state<>'cancelled' AND COALESCE(e.starts_at,e.training_date::timestamp AT TIME ZONE e.timezone)>=${window.start} AND COALESCE(e.starts_at,e.training_date::timestamp AT TIME ZONE e.timezone)<${window.end} AND COALESCE(e.starts_at,e.training_date::timestamp AT TIME ZONE e.timezone)<=now() AND (${trainer}::uuid IS NULL OR m.trainer_id=${trainer}::uuid) AND (${selected}::uuid IS NULL OR m.id=${selected}::uuid) GROUP BY 1`;
    const workload =
      view === "admin"
        ? await tx.$queryRaw<
            any[]
          >`SELECT t.id,t.name AS label,count(m.id)::int AS value FROM public.institution_members t LEFT JOIN public.institution_members m ON m.trainer_id=t.id AND m.active AND 'trainee'=ANY(m.roles) WHERE t.institution_id=${id}::uuid AND t.active AND 'trainer'=ANY(t.roles) GROUP BY t.id ORDER BY t.name,t.id LIMIT 26 OFFSET ${pageOffset(q.get("workloadOffset"))}`
        : [];
    const programs = await tx.$queryRaw<
      any[]
    >`SELECT v.program_id AS id,v.title AS label,count(*)::int AS value FROM public.institution_assignments a JOIN public.institution_members m ON m.id=a.member_id JOIN public.institution_versions v ON v.id=a.version_id WHERE a.institution_id=${id}::uuid AND a.state='active' AND a.start_date<=(now() AT TIME ZONE ${window.zone})::date AND (a.end_date IS NULL OR a.end_date>=(now() AT TIME ZONE ${window.zone})::date) AND m.active AND 'trainee'=ANY(m.roles) AND (${trainer}::uuid IS NULL OR m.trainer_id=${trainer}::uuid) AND (${selected}::uuid IS NULL OR m.id=${selected}::uuid) GROUP BY v.program_id,v.title ORDER BY value DESC,v.title,v.program_id LIMIT 26 OFFSET ${pageOffset(q.get("programOffset"))}`;
    const performance =
      view === "admin" && workload.length
        ? await tx.$queryRaw<
            {
              id: string;
              name: string;
              completed_sessions: number;
              present: number;
              absent: number;
            }[]
          >`SELECT t.id,t.name,
      (SELECT count(*)::int FROM public.institution_events e JOIN public.institution_event_people staff ON staff.event_id=e.id WHERE e.institution_id=${id}::uuid AND staff.member_id=t.id AND staff.duty='staff' AND e.state='completed' AND e.kind='training' AND NOT EXISTS(SELECT 1 FROM public.institution_workout_positions position WHERE position.occurrence_id=e.id AND position.state='skipped') AND COALESCE(e.ends_at,e.training_date::timestamp AT TIME ZONE e.timezone)>=${window.start} AND COALESCE(e.ends_at,e.training_date::timestamp AT TIME ZONE e.timezone)<${window.end}) completed_sessions,
      (SELECT count(*)::int FROM public.institution_events e JOIN public.institution_event_people staff ON staff.event_id=e.id AND staff.member_id=t.id AND staff.duty='staff' JOIN public.institution_event_people p ON p.event_id=e.id AND p.duty='trainee' WHERE e.state='completed' AND e.kind='training' AND COALESCE(e.ends_at,e.training_date::timestamp AT TIME ZONE e.timezone)>=${window.start} AND COALESCE(e.ends_at,e.training_date::timestamp AT TIME ZONE e.timezone)<${window.end} AND p.attendance='present') present,
      (SELECT count(*)::int FROM public.institution_events e JOIN public.institution_event_people staff ON staff.event_id=e.id AND staff.member_id=t.id AND staff.duty='staff' JOIN public.institution_event_people p ON p.event_id=e.id AND p.duty='trainee' WHERE e.state='completed' AND e.kind='training' AND COALESCE(e.ends_at,e.training_date::timestamp AT TIME ZONE e.timezone)>=${window.start} AND COALESCE(e.ends_at,e.training_date::timestamp AT TIME ZONE e.timezone)<${window.end} AND p.attendance IN ('absent','excused')) absent
      FROM public.institution_members t WHERE t.id=ANY(${workload.slice(0, 25).map((x) => x.id)}::uuid[]) ORDER BY t.name,t.id`
        : [];

    const people = await tx.institution_members.findMany({
      where: {
        institution_id: id,
        roles: { has: "trainee" },
        ...(trainer ? { trainer_id: trainer } : {}),
        name: {
          contains: (q.get("search") || "").slice(0, 100),
          mode: "insensitive",
        },
      },
      select: { id: true, name: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: 25,
    });
    return {
      performance,
      experience: await experienceReport(
        tx,
        id,
        trainer,
        selected,
        window,
        view,
      ),
      window,
      summary,
      daily,
      attendance,
      workload: workload.slice(0, 25),
      programs: programs.slice(0, 25),
      workloadNext:
        workload.length > 25 ? pageOffset(q.get("workloadOffset")) + 25 : null,
      programNext:
        programs.length > 25 ? pageOffset(q.get("programOffset")) + 25 : null,
      people,
    };
  });
}
export async function assessmentHistory(
  actor: Actor,
  id: string,
  q: URLSearchParams,
) {
  const view = role(q.get("view")),
    window = await analyticWindow(actor, q);
  return scoped(actor, id, [view], async (tx, self) => {
    const member = q.get("member") || self.id;
    const person = await recipient(
      tx,
      id,
      self,
      view,
      member,
      false,
      "training",
    );
    const offset = pageOffset(q.get("offset")),
      // Events carry no sport yet: a supporting coach sees results from events they staffed.
      everything = view !== "trainer" || person.trainer_id === self.id;
    const results = await tx.$queryRaw<
      any[]
    >`SELECT r.event_id,r.member_id,r.values,r.note,r.revision,r.recorded_at,e.title,e.starts_at,e.template_id,e.template_revision,e.definition,p.attendance FROM public.assessment_results r JOIN public.institution_events e ON e.id=r.event_id JOIN public.institution_event_people p ON p.event_id=r.event_id AND p.member_id=r.member_id WHERE r.institution_id=${id}::uuid AND r.member_id=${member}::uuid AND e.state<>'cancelled' AND COALESCE(e.starts_at,e.training_date::timestamp AT TIME ZONE e.timezone)>=${window.start} AND COALESCE(e.starts_at,e.training_date::timestamp AT TIME ZONE e.timezone)<${window.end} AND (${everything} OR EXISTS(SELECT 1 FROM public.institution_event_people staff WHERE staff.event_id=e.id AND staff.member_id=${self.id}::uuid AND staff.duty='staff')) ORDER BY e.starts_at DESC,e.id LIMIT 51 OFFSET ${offset}`;
    return {
      window,
      person: { id: person.id, name: person.name },
      items: results.slice(0, 50),
      next: results.length > 50 ? offset + 50 : null,
    };
  });
}
