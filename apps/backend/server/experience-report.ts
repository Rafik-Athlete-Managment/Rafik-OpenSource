import type { Tx, Role } from "./institution.ts";
// Current roster scopes match the existing organization report. Ratings describe
// sessions, never a fabricated overall trainer score or inferred missing response.
export async function experienceReport(
  tx: Tx,
  institution: string,
  trainer: string | null,
  selected: string | null,
  window: { start: Date; end: Date; from: string; to: string },
  view: Role,
) {
  const client = await tx.$queryRaw<
    { source: string; score: number | null; value: number }[]
  >`WITH eligible AS (
  SELECT s.id,s.member_id,'workout' source FROM public.institution_sessions s WHERE s.institution_id=${institution}::uuid AND s.completed_at>=${window.start} AND s.completed_at<${window.end}
  UNION ALL SELECT e.id,p.member_id,'calendar' FROM public.institution_events e JOIN public.institution_event_people p ON p.event_id=e.id WHERE e.institution_id=${institution}::uuid AND e.kind='training' AND e.state='completed' AND p.duty='trainee' AND p.attendance='present' AND e.ends_at>=${window.start} AND e.ends_at<${window.end}
 ) SELECT e.source,f.score,count(*)::int value FROM eligible e JOIN public.institution_members m ON m.id=e.member_id LEFT JOIN public.institution_session_feedback f ON f.member_id=e.member_id AND (CASE WHEN e.source='workout' THEN f.workout_id ELSE f.event_id END)=e.id WHERE (${trainer}::uuid IS NULL OR m.trainer_id=${trainer}::uuid) AND (${selected}::uuid IS NULL OR m.id=${selected}::uuid) GROUP BY e.source,f.score ORDER BY e.source,f.score`;
  const currentMonth = new Date().toISOString().slice(0, 7) + "-01";
  const workplace =
    view === "admin"
      ? await tx.$queryRaw<
          { score: number | null; value: number }[]
        >`SELECT f.score,count(*)::int value FROM public.institution_members m LEFT JOIN public.institution_workplace_feedback f ON f.member_id=m.id AND f.month=${currentMonth}::date WHERE m.institution_id=${institution}::uuid AND m.active AND 'trainer'=ANY(m.roles) GROUP BY f.score ORDER BY f.score`
      : null;
  return { client, workplace, workplaceMonth: currentMonth };
}
