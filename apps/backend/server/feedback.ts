import { randomUUID } from "node:crypto";
import { ApiError, type Actor } from "./db.ts";
import {
  scoped,
  mutation,
  event,
  uuid,
  type Tx,
  access,
} from "./institution.ts";
import { role } from "./programming.ts";
import { pageOffset } from "./service-definitions.ts";
type Self = Awaited<ReturnType<typeof access>>;
const month = () => new Date().toISOString().slice(0, 7) + "-01";
async function eligible(
  tx: Tx,
  institution: string,
  self: Self,
  source: string,
  key: string,
) {
  if (source === "workout") {
    const s = await tx.institution_sessions.findUnique({ where: { id: key } });
    if (
      !s ||
      s.institution_id !== institution ||
      s.member_id !== self.id ||
      !s.completed_at ||
      s.source_kind !== "assignment"
    )
      throw new ApiError(403, "feedback_unavailable");
  } else if (source === "calendar") {
    const rows = await tx.$queryRaw<
      unknown[]
    >`SELECT e.id FROM public.institution_events e JOIN public.institution_event_people p ON p.event_id=e.id WHERE e.institution_id=${institution}::uuid AND e.id=${key}::uuid AND p.member_id=${self.id}::uuid AND p.duty='trainee' AND p.attendance='present' AND e.state='completed' AND e.kind='training'`;
    if (!rows.length) throw new ApiError(403, "feedback_unavailable");
  } else throw new ApiError(400, "invalid_request");
}
export async function feedback(
  actor: Actor,
  institution: string,
  q: URLSearchParams,
) {
  const view = role(q.get("view"));
  if (view === "admin") throw new ApiError(403, "forbidden");
  return scoped(actor, institution, [view], async (tx, self) => {
    if (view === "trainer") {
      const current = month(),
        items = await tx.$queryRaw<
          unknown[]
        >`SELECT month::text,score,revision FROM public.institution_workplace_feedback WHERE institution_id=${institution}::uuid AND member_id=${self.id}::uuid ORDER BY month DESC LIMIT 25 OFFSET ${pageOffset(q.get("offset"))}`;
      const own =
        (
          await tx.$queryRaw<
            unknown[]
          >`SELECT month::text,score,revision FROM public.institution_workplace_feedback WHERE institution_id=${institution}::uuid AND member_id=${self.id}::uuid AND month=${current}::date`
        )[0] || null;
      return {
        month: current,
        own,
        items: items.slice(0, 24),
        next: items.length > 24 ? pageOffset(q.get("offset")) + 24 : null,
      };
    }
    const rows = await tx.$queryRaw<
      {
        id: string;
        source: "workout" | "calendar";
        title: string | null;
        at: Date | null;
        score: number | null;
        revision: number;
      }[]
    >`WITH eligible AS (
   SELECT s.id,'workout' source,s.document->>'title' title,s.completed_at at FROM public.institution_sessions s WHERE s.source_kind='assignment' AND s.institution_id=${institution}::uuid AND s.member_id=${self.id}::uuid AND s.completed_at IS NOT NULL
   UNION ALL SELECT e.id,'calendar',e.title,e.ends_at FROM public.institution_events e JOIN public.institution_event_people p ON p.event_id=e.id WHERE e.institution_id=${institution}::uuid AND p.member_id=${self.id}::uuid AND p.duty='trainee' AND p.attendance='present' AND e.state='completed' AND e.kind='training'
  ) SELECT e.*,f.score,coalesce(f.revision,0) revision FROM eligible e LEFT JOIN public.institution_session_feedback f ON f.member_id=${self.id}::uuid AND (CASE WHEN e.source='workout' THEN f.workout_id ELSE f.event_id END)=e.id ORDER BY e.at DESC,e.source,e.id LIMIT 25 OFFSET ${pageOffset(q.get("offset"))}`;
    return {
      items: rows.slice(0, 24),
      next: rows.length > 24 ? pageOffset(q.get("offset")) + 24 : null,
    };
  });
}
export async function feedbackCommand(
  actor: Actor,
  institution: string,
  input: Record<string, unknown>,
) {
  const view = role(input.view),
    source = String(input.source),
    key = source === "workplace" ? null : uuid(input.id);
  if (
    (source === "workplace" && view !== "trainer") ||
    (source !== "workplace" && view !== "trainee")
  )
    throw new ApiError(403, "forbidden");
  const authorize = async (tx: Tx, self: Self) => {
    if (key) await eligible(tx, institution, self, source, key);
  };
  return mutation(
    actor,
    institution,
    [view],
    input,
    async (tx, self) => {
      if (
        !Number.isInteger(input.score) ||
        Number(input.score) < 1 ||
        Number(input.score) > 5
      )
        throw new ApiError(400, "invalid_request");
      if (source === "workplace") {
        const current = month();
        if (input.month !== current)
          throw new ApiError(409, "feedback_period_changed");
        const old = (
          await tx.$queryRaw<
            { revision: number }[]
          >`SELECT revision FROM public.institution_workplace_feedback WHERE institution_id=${institution}::uuid AND member_id=${self.id}::uuid AND month=${current}::date`
        )[0];
        if ((old?.revision || 0) !== input.revision)
          throw new ApiError(409, "conflict");
        await tx.$executeRaw`INSERT INTO public.institution_workplace_feedback(institution_id,member_id,month,score) VALUES(${institution}::uuid,${self.id}::uuid,${current}::date,${Number(input.score)}) ON CONFLICT(institution_id,member_id,month) DO UPDATE SET score=EXCLUDED.score,revision=institution_workplace_feedback.revision+1,updated_at=now()`;
      } else {
        const old = (
          await tx.$queryRaw<
            { revision: number }[]
          >`SELECT revision FROM public.institution_session_feedback WHERE institution_id=${institution}::uuid AND member_id=${self.id}::uuid AND (CASE WHEN ${source}='workout' THEN workout_id ELSE event_id END)=${key}::uuid`
        )[0];
        if ((old?.revision || 0) !== input.revision)
          throw new ApiError(409, "conflict");
        if (old)
          await tx.$executeRaw`UPDATE public.institution_session_feedback SET score=${Number(input.score)},revision=revision+1,updated_at=now() WHERE institution_id=${institution}::uuid AND member_id=${self.id}::uuid AND (CASE WHEN ${source}='workout' THEN workout_id ELSE event_id END)=${key}::uuid`;
        else
          await tx.$executeRaw`INSERT INTO public.institution_session_feedback(id,institution_id,member_id,workout_id,event_id,score) VALUES(${randomUUID()}::uuid,${institution}::uuid,${self.id}::uuid,${source === "workout" ? key : null}::uuid,${source === "calendar" ? key : null}::uuid,${Number(input.score)})`;
      }
      await event(tx, actor, institution, "feedback_recorded", key || self.id, {
        source,
        revision: Number(input.revision) + 1,
      });
      return {
        revision: Number(input.revision) + 1,
        score: Number(input.score),
      };
    },
    authorize,
  );
}
