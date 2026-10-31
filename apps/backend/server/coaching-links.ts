import { randomUUID } from "node:crypto";
import { ApiError, type Actor } from "./db.ts";
import { event, uuid, type Tx } from "./institution.ts";

/**
 * Coaching team lifecycle. trainer_id mirrors the active primary link; the database trigger
 * institution_members_end_coaching_links ends links when membership, roles or trainer_id are cleared.
 */
export async function setPrimary(
  tx: Tx,
  institution: string,
  athlete: string,
  coach: string | null,
  actor: string,
) {
  const now = new Date();
  await tx.institution_coaching_links.updateMany({
    where: {
      institution_id: institution,
      athlete_member_id: athlete,
      kind: "primary",
      ended_at: null,
      ...(coach ? { NOT: { coach_member_id: coach } } : {}),
    },
    data: { ended_at: now, ended_by: actor, revision: { increment: 1 } },
  });
  if (!coach) return;
  if (
    await tx.institution_coaching_links.findFirst({
      where: {
        institution_id: institution,
        athlete_member_id: athlete,
        coach_member_id: coach,
        kind: "primary",
        ended_at: null,
      },
    })
  )
    return;
  // A supporting coach who becomes primary keeps one active link with the athlete.
  await tx.institution_coaching_links.updateMany({
    where: {
      institution_id: institution,
      athlete_member_id: athlete,
      coach_member_id: coach,
      ended_at: null,
    },
    data: { ended_at: now, ended_by: actor, revision: { increment: 1 } },
  });
  await tx.institution_coaching_links.create({
    data: {
      id: randomUUID(),
      institution_id: institution,
      athlete_member_id: athlete,
      coach_member_id: coach,
      kind: "primary",
      created_by: actor,
    },
  });
}

export async function linkSupportingCoach(
  tx: Tx,
  actor: Actor,
  institution: string,
  self: string,
  input: Record<string, unknown>,
) {
  const id = uuid(input.id),
    [athlete, coach, sport] = await Promise.all([
      tx.institution_members.findFirst({
        where: {
          id: uuid(input.athlete),
          institution_id: institution,
          active: true,
        },
      }),
      tx.institution_members.findFirst({
        where: {
          id: uuid(input.coach),
          institution_id: institution,
          active: true,
        },
      }),
      tx.institution_sports.findFirst({
        where: {
          id: uuid(input.sport),
          institution_id: institution,
          archived: false,
        },
      }),
    ]);
  if (!athlete?.roles.includes("trainee"))
    throw new ApiError(400, "invalid_trainee");
  if (!coach?.roles.includes("trainer"))
    throw new ApiError(400, "invalid_trainer");
  if (!sport) throw new ApiError(400, "invalid_sport");
  if (athlete.trainer_id === coach.id)
    throw new ApiError(409, "already_primary");
  const covered = await tx.institution_member_sports.findMany({
    where: {
      sport_id: sport.id,
      member_id: { in: [athlete.id, coach.id] },
    },
    select: { member_id: true },
  });
  // The coach must cover the sport or specialty; an athlete must take part in a sport.
  if (
    !covered.some((x) => x.member_id === coach.id) ||
    (sport.kind === "sport" && !covered.some((x) => x.member_id === athlete.id))
  )
    throw new ApiError(400, "sport_not_covered");
  if (
    await tx.institution_coaching_links.findFirst({
      where: {
        institution_id: institution,
        athlete_member_id: athlete.id,
        coach_member_id: coach.id,
        ended_at: null,
      },
    })
  )
    throw new ApiError(409, "already_linked");
  const result = await tx.institution_coaching_links.create({
    data: {
      id,
      institution_id: institution,
      athlete_member_id: athlete.id,
      coach_member_id: coach.id,
      kind: "supporting",
      sport_id: sport.id,
      created_by: self,
    },
  });
  await event(tx, actor, institution, "coach_linked", athlete.id, {
    coach: coach.id,
    kind: "supporting",
    sport: sport.id,
  });
  return result;
}

export async function endSupportingCoach(
  tx: Tx,
  actor: Actor,
  institution: string,
  self: string,
  input: Record<string, unknown>,
) {
  const link = await tx.institution_coaching_links.findUnique({
    where: { id: uuid(input.id) },
  });
  if (!link || link.institution_id !== institution)
    throw new ApiError(404, "not_found");
  // Primary responsibility changes through assign-trainer so trainer_id stays mirrored.
  if (link.kind !== "supporting") throw new ApiError(400, "invalid_request");
  if (link.ended_at || link.revision !== input.revision)
    throw new ApiError(409, "conflict");
  const result = await tx.institution_coaching_links.update({
    where: { id: link.id },
    data: { ended_at: new Date(), ended_by: self, revision: { increment: 1 } },
  });
  await event(
    tx,
    actor,
    institution,
    "coach_link_ended",
    link.athlete_member_id,
    {
      coach: link.coach_member_id,
      sport: link.sport_id,
    },
  );
  return result;
}

/** Removing a sport from either side ends supporting links that depended on it. */
export async function endLinksForRemovedSports(
  tx: Tx,
  institution: string,
  member: string,
  removed: string[],
  self: string,
) {
  if (!removed.length) return;
  await tx.institution_coaching_links.updateMany({
    where: {
      institution_id: institution,
      kind: "supporting",
      ended_at: null,
      sport_id: { in: removed },
      OR: [{ athlete_member_id: member }, { coach_member_id: member }],
    },
    data: { ended_at: new Date(), ended_by: self, revision: { increment: 1 } },
  });
}
