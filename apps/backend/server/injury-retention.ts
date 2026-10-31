import { db } from "./db.ts";

const DAY = 24 * 60 * 60 * 1000;
const RETRY_AFTER_FAILURE = 15 * 60 * 1000;

export async function purgeExpiredInjuryRecords(institutionIds: string[] = []) {
  return db.$transaction(async (tx) => {
    const closed = await tx.$queryRaw<
      {
        id: string;
        institution_id: string;
        athlete_member_id: string;
        participation: string;
        effective_from: Date;
        revision: number;
      }[]
    >`
      UPDATE public.institution_injury_records r
      SET state='closed',closed_at=now(),revision=revision+1,updated_at=now()
      WHERE r.state='active' AND (cardinality(${institutionIds}::uuid[])=0 OR r.institution_id=ANY(${institutionIds}::uuid[])) AND NOT EXISTS (
        SELECT 1 FROM public.institution_members m
        WHERE m.institution_id=r.institution_id AND m.id=r.athlete_member_id AND m.active AND 'trainee'=ANY(m.roles)
      )
      RETURNING r.id,r.institution_id,r.athlete_member_id,r.participation,r.effective_from,r.revision
    `;
    for (const record of closed)
      await tx.$executeRaw`
        INSERT INTO public.institution_injury_history(id,institution_id,record_id,revision,action,participation,effective_from,recorded_by)
        VALUES(gen_random_uuid(),${record.institution_id}::uuid,${record.id}::uuid,${record.revision},'closed',${record.participation},${record.effective_from}::date,NULL)
      `;
    const expired = await tx.$queryRaw<{ id: string }[]>`
      DELETE FROM public.institution_injury_records
      WHERE state='closed' AND closed_at <= now() - interval '12 months'
        AND (cardinality(${institutionIds}::uuid[])=0 OR institution_id=ANY(${institutionIds}::uuid[]))
      RETURNING id
    `;
    await tx.$executeRaw`
      INSERT INTO public.institution_injury_retention_checkpoint(singleton,completed_at,closed_count,purged_count)
      VALUES(true,now(),${closed.length},${expired.length})
      ON CONFLICT (singleton) DO UPDATE SET
        completed_at=EXCLUDED.completed_at,
        closed_count=EXCLUDED.closed_count,
        purged_count=EXCLUDED.purged_count
    `;
    return { closed: closed.length, expired: expired.length };
  });
}

export function startInjuryRetention(
  cleanup = purgeExpiredInjuryRecords,
  schedule: (
    callback: () => void,
    delay: number,
  ) => ReturnType<typeof setTimeout> = setTimeout,
  onFailure: () => void = () =>
    console.error("Injury retention cleanup failed"),
) {
  const run = async () => {
    let nextDelay = DAY;
    try {
      await cleanup();
    } catch {
      nextDelay = RETRY_AFTER_FAILURE;
      onFailure();
    }
    const timer = schedule(() => void run(), nextDelay);
    timer.unref();
  };
  void run();
}
