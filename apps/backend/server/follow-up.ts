import { type Actor } from "./db.ts";
import { scoped } from "./institution.ts";
import { role } from "./programming.ts";
import { ApiError } from "./db.ts";
export async function followUp(actor: Actor, id: string, q: URLSearchParams) {
  const view = role(q.get("view"));
  if (view === "trainee") throw new ApiError(403, "forbidden");
  return scoped(actor, id, [view], async (tx, self) => {
    const review = await tx.$queryRaw<
      {
        id: string;
        name: string;
        completed_at: Date;
        title: string;
        total: bigint;
      }[]
    >`SELECT s.id,m.name,s.completed_at,s.document->>'title' title,count(*) OVER() total FROM public.institution_sessions s JOIN public.institution_members m ON m.id=s.member_id WHERE s.source_kind='assignment' AND s.institution_id=${id}::uuid AND m.active AND (${view === "admin"} OR m.trainer_id=${self.id}::uuid) AND s.completed_at IS NOT NULL AND nullif(s.document->>'reviewed_at','') IS NULL ORDER BY s.completed_at,s.id LIMIT 8`;
    const outcomes = await tx.$queryRaw<
      { id: string; title: string; ends_at: Date; total: bigint }[]
    >`SELECT e.id,e.title,e.ends_at,count(*) OVER() total FROM public.institution_events e WHERE e.institution_id=${id}::uuid AND e.state='scheduled' AND e.ends_at<now() AND (${view === "admin"} OR EXISTS(SELECT 1 FROM public.institution_event_people p WHERE p.event_id=e.id AND p.member_id=${self.id}::uuid AND p.duty='staff')) ORDER BY e.ends_at,e.id LIMIT 8`;
    const missed = await tx.$queryRaw<
      {
        id: string;
        member_id: string;
        name: string;
        title: string;
        starts_at: Date;
        total: bigint;
      }[]
    >`SELECT e.id,p.member_id,m.name,e.title,e.starts_at,count(*) OVER() total FROM public.institution_events e JOIN public.institution_event_people p ON p.event_id=e.id JOIN public.institution_members m ON m.id=p.member_id WHERE e.institution_id=${id}::uuid AND e.kind='training' AND e.state='completed' AND p.duty='trainee' AND p.attendance IN ('absent','excused') AND m.active AND (${view === "admin"} OR m.trainer_id=${self.id}::uuid) AND NOT EXISTS(SELECT 1 FROM public.institution_event_people replacement JOIN public.institution_events booked ON booked.id=replacement.event_id WHERE replacement.makeup_for=e.id AND replacement.member_id=p.member_id AND booked.state<>'cancelled') ORDER BY e.starts_at,e.id,p.member_id LIMIT 8`;
    const unplanned = await tx.$queryRaw<
      { id: string; name: string; total: bigint }[]
    >`SELECT m.id,m.name,count(*) OVER() total FROM public.institution_members m WHERE m.institution_id=${id}::uuid AND m.active AND 'trainee'=ANY(m.roles) AND (${view === "admin"} OR m.trainer_id=${self.id}::uuid) AND NOT EXISTS(SELECT 1 FROM public.institution_assignments a WHERE a.member_id=m.id AND a.state='active') ORDER BY m.name,m.id LIMIT 8`;
    const result = (items: { total: bigint }[]) => ({
      items: items.map(({ total, ...item }) => item),
      total: Number(items[0]?.total || 0),
    });
    return {
      missed: result(missed),
      reviews: result(review),
      outcomes: result(outcomes),
      unplanned: result(unplanned),
    };
  });
}
