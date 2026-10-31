import { createHash } from "node:crypto";
import { ApiError, db, type Actor } from "./db.ts";
import {
  scoped,
  mutation,
  uuid,
  textValue,
  type Tx,
  type Role,
  access,
} from "./institution.ts";
const role = (v: unknown): Role => {
  if (!["admin", "trainer", "trainee"].includes(String(v)))
    throw new ApiError(400, "invalid_roles");
  return v as Role;
};
import { pageOffset } from "./service-definitions.ts";
import { readPrivate, writePrivate } from "./private-bytes.ts";
type Self = Awaited<ReturnType<typeof access>>;
export type Asset = {
  id: string;
  institution_id: string;
  owner_id: string;
  purpose: string;
  channel_id: string | null;
  filename: string;
  media_type: string;
  bytes: number;
  digest: string;
  retired: boolean;
  revision?: number;
  created_at: Date;
};
export const assetPath = (asset: Asset) =>
  `organization/${asset.institution_id}/${asset.id}`;
function validBytes(bytes: Buffer, type: string) {
  if (type === "image/png")
    return bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (type === "image/jpeg")
    return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (type === "image/webp")
    return (
      bytes.subarray(0, 4).toString() === "RIFF" &&
      bytes.subarray(8, 12).toString() === "WEBP"
    );
  if (type === "image/gif")
    return ["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString());
  if (type === "video/mp4") return bytes.subarray(4, 8).toString() === "ftyp";
  if (type === "application/pdf")
    return bytes.subarray(0, 5).toString() === "%PDF-";
  return false;
}
async function channelMember(
  tx: Tx,
  institution: string,
  self: Self,
  channel: string,
) {
  const found = await tx.institution_channels.findFirst({
    where: {
      id: channel,
      institution_id: institution,
      institution_channel_members: { some: { member_id: self.id } },
    },
  });
  if (!found) throw new ApiError(403, "conversation_unavailable");
  return found;
}
export async function putInstitutionAsset(
  actor: Actor,
  institution: string,
  id: string,
  q: URLSearchParams,
  bytes: Buffer,
  type: string,
) {
  uuid(id);
  const view = role(q.get("view")),
    purpose = String(q.get("purpose")),
    channel = q.get("channel") ? uuid(q.get("channel")) : null;
  if (
    !["exercise", "message"].includes(purpose) ||
    (purpose === "message") !== !!channel ||
    !bytes.length ||
    bytes.length > 26214400 ||
    !validBytes(bytes, type) ||
    (purpose === "exercise" && type === "application/pdf")
  )
    throw new ApiError(400, "invalid_file");
  const filename = textValue(q.get("filename"), 180).replace(
      /[\r\n\/\\]/g,
      "_",
    ),
    digest = createHash("sha256").update(bytes).digest("hex");
  return scoped(actor, institution, [view], async (tx, self) => {
    if (purpose === "exercise" && view === "trainee")
      throw new ApiError(403, "forbidden");
    if (
      channel &&
      (await channelMember(tx, institution, self, channel)).archived
    )
      throw new ApiError(409, "conversation_unavailable");
    const old = (
      await tx.$queryRaw<
        Asset[]
      >`SELECT * FROM public.institution_assets WHERE id=${id}::uuid`
    )[0];
    if (
      old &&
      (old.institution_id !== institution ||
        old.owner_id !== self.id ||
        old.digest !== digest ||
        old.purpose !== purpose ||
        old.channel_id !== channel ||
        old.media_type !== type ||
        old.filename !== filename ||
        old.retired)
    )
      throw new ApiError(409, "file_mismatch");
    const record = {
      id,
      institution_id: institution,
      owner_id: self.id,
      purpose,
      channel_id: channel,
      filename,
      media_type: type,
      bytes: bytes.length,
      digest,
      retired: false,
      created_at: new Date(),
    };
    await writePrivate(assetPath(record), bytes);
    if (!old)
      await tx.$executeRaw`INSERT INTO public.institution_assets(id,institution_id,owner_id,purpose,channel_id,filename,media_type,bytes,digest) VALUES(${id}::uuid,${institution}::uuid,${self.id}::uuid,${purpose},${channel}::uuid,${filename},${type},${bytes.length},${digest})`;
    return { id, filename, media_type: type, bytes: bytes.length };
  });
}
export async function usableExerciseAsset(
  tx: Tx,
  institution: string,
  self: Self,
  value: unknown,
  retained = false,
) {
  const id = uuid(value);
  const a = (
    await tx.$queryRaw<
      Asset[]
    >`SELECT * FROM public.institution_assets WHERE id=${id}::uuid AND institution_id=${institution}::uuid AND purpose='exercise' AND (NOT retired OR ${retained})`
  )[0];
  if (!a) throw new ApiError(403, "resource_unavailable");
  if (a.owner_id !== self.id) {
    const shared = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM public.institution_exercises WHERE institution_id=${institution}::uuid AND active AND coalesce(data->>'scope','organization')='organization' AND data->>'media_asset'=${id} LIMIT 1`;
    if (!shared.length) throw new ApiError(403, "forbidden");
  }
  return a;
}
export async function getInstitutionAsset(actor: Actor, id: string) {
  uuid(id);
  const a = (
    await db.$queryRaw<
      Asset[]
    >`SELECT * FROM public.institution_assets WHERE id=${id}::uuid`
  )[0];
  if (!a) throw new ApiError(404, "resource_unavailable");
  return scoped(actor, a.institution_id, [], async (tx, self) => {
    if (a.purpose === "message") {
      await channelMember(tx, a.institution_id, self, a.channel_id!);
      const sent = await tx.institution_messages.findFirst({
        where: {
          channel_id: a.channel_id!,
          institution_id: a.institution_id,
          OR: [
            { asset_id: a.id },
            { institution_message_assets: { some: { asset_id: a.id } } },
          ],
        },
      });
      if (a.owner_id !== self.id && !sent) throw new ApiError(403, "forbidden");
    } else if (
      a.owner_id !== self.id ||
      !self.roles.some((r) => ["admin", "trainer"].includes(r))
    ) {
      const shared = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM public.institution_exercises WHERE institution_id=${a.institution_id}::uuid AND active AND coalesce(data->>'scope','organization')='organization' AND data->>'media_asset'=${a.id} LIMIT 1`;
      const staff = self.roles.some((r) => ["admin", "trainer"].includes(r));
      if (!(staff && shared.length)) {
        // Exact JSON scalar lookup, never substring matching. Only authorized versions/session snapshots qualify.
        const reference = JSON.stringify({ asset: a.id });
        const allowed = await tx.$queryRaw<
          { id: string }[]
        >`SELECT v.id FROM public.institution_versions v JOIN public.institution_programs p ON p.id=v.program_id WHERE v.institution_id=${a.institution_id}::uuid AND jsonb_path_exists(v.prescription,'$.**.media_asset ? (@ == $asset)',${reference}::jsonb) AND (${self.roles.includes("admin")} OR p.created_by=${self.id}::uuid AND ${staff} OR p.listed AND NOT p.archived AND ${staff} OR EXISTS(SELECT 1 FROM public.institution_assignments s JOIN public.institution_members m ON m.id=s.member_id WHERE s.version_id=v.id AND (m.id=${self.id}::uuid OR (m.trainer_id=${self.id}::uuid OR EXISTS(SELECT 1 FROM public.institution_coaching_links l WHERE l.athlete_member_id=m.id AND l.coach_member_id=${self.id}::uuid AND l.ended_at IS NULL AND l.sport_id=s.sport_id)) AND ${staff}))) UNION ALL SELECT a.id FROM public.institution_assignments a JOIN public.institution_members m ON m.id=a.member_id WHERE a.institution_id=${a.institution_id}::uuid AND jsonb_path_exists(a.adaptation,'$.**.media_asset ? (@ == $asset)',${reference}::jsonb) AND (${self.roles.includes("admin")} OR m.id=${self.id}::uuid OR (m.trainer_id=${self.id}::uuid OR EXISTS(SELECT 1 FROM public.institution_coaching_links l WHERE l.athlete_member_id=m.id AND l.coach_member_id=${self.id}::uuid AND l.ended_at IS NULL AND l.sport_id=a.sport_id)) AND ${staff}) UNION ALL SELECT s.id FROM public.institution_sessions s JOIN public.institution_members m ON m.id=s.member_id WHERE s.institution_id=${a.institution_id}::uuid AND jsonb_path_exists(s.document,'$.**.media_asset ? (@ == $asset)',${reference}::jsonb) AND (${self.roles.includes("admin")} OR m.id=${self.id}::uuid OR (m.trainer_id=${self.id}::uuid OR EXISTS(SELECT 1 FROM public.institution_coaching_links l JOIN public.institution_assignments la ON la.id=s.assignment_id WHERE l.athlete_member_id=m.id AND l.coach_member_id=${self.id}::uuid AND l.ended_at IS NULL AND l.sport_id=la.sport_id)) AND ${staff}) LIMIT 1`;
        if (!allowed.length) throw new ApiError(403, "forbidden");
      }
    }
    return {
      bytes: await readPrivate(assetPath(a)),
      type: a.media_type,
      filename: a.filename,
    };
  });
}
export async function institutionAssets(
  actor: Actor,
  institution: string,
  q: URLSearchParams,
) {
  const view = role(q.get("view")),
    offset = pageOffset(q.get("offset"));
  if (view === "trainee") throw new ApiError(403, "forbidden");
  return scoped(actor, institution, [view], async (tx, self) => {
    const search = "%" + (q.get("search") || "").slice(0, 100) + "%";
    const items = await tx.$queryRaw<
      Asset[]
    >`SELECT a.* FROM public.institution_assets a WHERE a.institution_id=${institution}::uuid AND a.purpose='exercise' AND a.filename ILIKE ${search} AND a.retired=${q.get("archived") === "true"} AND (a.owner_id=${self.id}::uuid OR EXISTS(SELECT 1 FROM public.institution_exercises e WHERE e.institution_id=a.institution_id AND e.active AND coalesce(e.data->>'scope','organization')='organization' AND e.data->>'media_asset'=a.id::text)) ORDER BY a.created_at DESC,a.id LIMIT 25 OFFSET ${offset}`;
    return {
      items: items
        .slice(0, 24)
        .map((a) => ({ ...a, editable: a.owner_id === self.id })),
      next: items.length > 24 ? offset + 24 : null,
    };
  });
}

export async function assetCommand(
  actor: Actor,
  institution: string,
  input: Record<string, unknown>,
) {
  const view = role(input.view),
    id = uuid(input.id);
  if (
    view === "trainee" ||
    input.action !== "archive" ||
    typeof input.retired !== "boolean"
  )
    throw new ApiError(400, "invalid_request");
  const authorize = async (tx: Tx, self: Self) => {
    const a = (
      await tx.$queryRaw<
        Asset[]
      >`SELECT * FROM public.institution_assets WHERE id=${id}::uuid AND institution_id=${institution}::uuid AND purpose='exercise'`
    )[0];
    if (!a || a.owner_id !== self.id) throw new ApiError(403, "forbidden");
    return a;
  };
  return mutation(
    actor,
    institution,
    [view],
    input,
    async (tx, self) => {
      const a = await authorize(tx, self);
      if (a.revision !== input.revision) throw new ApiError(409, "conflict");
      await tx.$executeRaw`UPDATE public.institution_assets SET retired=${input.retired as boolean},revision=revision+1 WHERE id=${id}::uuid`;
      return { id, retired: input.retired, revision: a.revision! + 1 };
    },
    async (tx, self) => {
      await authorize(tx, self);
    },
  );
}
