import { createHash } from "node:crypto";
import { db, ApiError, type Actor } from "./db.ts";
import { uuid } from "./institution.ts";
import { readPrivate, writePrivate } from "./private-bytes.ts";
type Media = {
  id: string;
  institution_id: string;
  created_by: string | null;
  media_type: string;
  digest: string;
};
const path = (a: Media) => `program/${a.institution_id}/${a.id}`;
function imageType(bytes: Buffer, type: string) {
  return type === "image/png"
    ? bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : type === "image/jpeg"
      ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : type === "image/webp"
        ? bytes.subarray(0, 4).toString() === "RIFF" &&
          bytes.subarray(8, 12).toString() === "WEBP"
        : false;
}
export async function putProgramMedia(
  actor: Actor,
  institution: string,
  id: string,
  bytes: Buffer,
  type: string,
) {
  uuid(institution);
  uuid(id);
  if (!bytes.length || bytes.length > 2097152 || !imageType(bytes, type))
    throw new ApiError(400, "invalid_program_cover");
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${institution},73))::text`;
    const member = await tx.institution_members.findUnique({
      where: {
        institution_id_user_id: {
          institution_id: institution,
          user_id: actor.id,
        },
      },
      include: { institutions: true },
    });
    if (
      !member?.active ||
      member.institutions.archived ||
      !member.roles.some((r) => r === "admin" || r === "trainer")
    )
      throw new ApiError(403, "workspace_unavailable");
    const digest = createHash("sha256").update(bytes).digest("hex");
    const old = (
      await tx.$queryRaw<
        Media[]
      >`SELECT * FROM public.program_media WHERE id=${id}::uuid`
    )[0];
    if (
      old &&
      (old.institution_id !== institution ||
        old.created_by !== actor.id ||
        old.digest !== digest ||
        old.media_type !== type)
    )
      throw new ApiError(409, "file_mismatch");
    const record = {
      id,
      institution_id: institution,
      created_by: actor.id,
      media_type: type,
      digest,
    };
    await writePrivate(path(record), bytes);
    if (!old)
      await tx.$executeRaw`INSERT INTO public.program_media(id,institution_id,created_by,media_type,bytes,digest) VALUES(${id}::uuid,${institution}::uuid,${actor.id}::uuid,${type},${bytes.length},${digest})`;
    return { id };
  });
}
export async function getProgramMedia(actor: Actor, id: string) {
  uuid(id);
  const media = (
    await db.$queryRaw<
      Media[]
    >`SELECT * FROM public.program_media WHERE id=${id}::uuid`
  )[0];
  if (!media) throw new ApiError(404, "resource_unavailable");
  const institution = await db.institutions.findUniqueOrThrow({
    where: { id: media.institution_id },
  });
  if (institution.archived) throw new ApiError(403, "workspace_unavailable");
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${institution.id},73))::text`;
    const m = await tx.institution_members.findUnique({
      where: {
        institution_id_user_id: {
          institution_id: institution.id,
          user_id: actor.id,
        },
      },
    });
    if (!m?.active) throw new ApiError(403, "workspace_unavailable");
    if (
      m.roles.includes("admin") ||
      (media.created_by === actor.id && m.roles.includes("trainer"))
    )
      return;
    const allowed = await tx.$queryRaw<
      unknown[]
    >`SELECT v.id FROM public.institution_versions v JOIN public.institution_programs p ON p.id=v.program_id WHERE v.institution_id=${institution.id}::uuid AND v.prescription->'presentation'->>'cover'=${id} AND (p.listed AND NOT p.archived OR EXISTS(SELECT 1 FROM public.institution_assignments a JOIN public.institution_members trainee ON trainee.id=a.member_id WHERE a.version_id=v.id AND (trainee.id=${m.id}::uuid OR (trainee.trainer_id=${m.id}::uuid OR EXISTS(SELECT 1 FROM public.institution_coaching_links l WHERE l.athlete_member_id=trainee.id AND l.coach_member_id=${m.id}::uuid AND l.ended_at IS NULL AND l.sport_id=a.sport_id)) AND ${m.roles.includes("trainer")}))) UNION ALL SELECT a.id FROM public.institution_assignments a JOIN public.institution_members trainee ON trainee.id=a.member_id WHERE a.institution_id=${institution.id}::uuid AND a.adaptation->'prescription'->'presentation'->>'cover'=${id} AND (trainee.id=${m.id}::uuid OR (trainee.trainer_id=${m.id}::uuid OR EXISTS(SELECT 1 FROM public.institution_coaching_links l WHERE l.athlete_member_id=trainee.id AND l.coach_member_id=${m.id}::uuid AND l.ended_at IS NULL AND l.sport_id=a.sport_id)) AND ${m.roles.includes("trainer")}) LIMIT 1`;
    if (!allowed.length) throw new ApiError(403, "forbidden");
  });
  return { bytes: await readPrivate(path(media)), type: media.media_type };
}
