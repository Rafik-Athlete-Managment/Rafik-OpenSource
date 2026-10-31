import { db, ApiError, type Actor } from "./db.ts";
import { scoped, uuid, type Tx } from "./institution.ts";

export type Branding = {
  name: string;
  accent: string;
  background_light: string;
  background_dark: string;
  logo_mime: string | null;
};

export async function readBranding(): Promise<Branding> {
  const rows = await db.$queryRaw<
    Branding[]
  >`SELECT name, accent, background_light, background_dark, logo_mime, updated_at FROM public.read_instance_branding()`;
  return (
    rows[0] || {
      name: "Rafik",
      accent: "#285943",
      background_light: "#f8f8f3",
      background_dark: "#171e1a",
      logo_mime: null,
      updated_at: "",
    }
  );
}

export async function readBrandingLogo() {
  const rows = await db.$queryRaw<
    { logo: Buffer | null; mime: string | null }[]
  >`SELECT logo, mime FROM public.read_instance_branding_logo()`;
  if (!rows[0]?.logo || !rows[0].mime)
    throw new ApiError(404, "resource_unavailable");
  return { bytes: rows[0].logo, mime: rows[0].mime };
}

export async function updateBranding(
  actor: Actor,
  institutionId: string,
  input: Record<string, unknown>,
) {
  uuid(institutionId);
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const accent = typeof input.accent === "string" ? input.accent : "";
  const backgroundLight =
    typeof input.background_light === "string" ? input.background_light : "";
  const backgroundDark =
    typeof input.background_dark === "string" ? input.background_dark : "";
  if (
    !name ||
    name.length > 60 ||
    !/^#[0-9a-fA-F]{6}$/.test(accent) ||
    !/^#[0-9a-fA-F]{6}$/.test(backgroundLight) ||
    !/^#[0-9a-fA-F]{6}$/.test(backgroundDark)
  )
    throw new ApiError(400, "invalid_request");
  let logo: Buffer | null | undefined;
  let mime: string | null | undefined;
  if (input.logo === null) {
    logo = null;
    mime = null;
  } else if (input.logo !== undefined) {
    if (typeof input.logo !== "string" || input.logo.length > 700_000)
      throw new ApiError(400, "invalid_request");
    logo = Buffer.from(input.logo, "base64");
    const actual = logo.subarray(0, 12).toString("hex");
    const detected = actual.startsWith("89504e470d0a1a0a")
      ? "image/png"
      : actual.startsWith("ffd8ff")
        ? "image/jpeg"
        : actual.startsWith("52494646") &&
            logo.subarray(8, 12).toString() === "WEBP"
          ? "image/webp"
          : null;
    if (!detected || logo.length > 512 * 1024)
      throw new ApiError(400, "invalid_request");
    mime = detected;
  }
  return scoped(actor, institutionId, ["admin"], async (tx: Tx) => {
    const result = await tx.$queryRaw<Branding[]>`
      SELECT * FROM public.update_instance_branding(
        ${actor.id}::uuid, ${name}, ${accent.toLowerCase()}, ${backgroundLight.toLowerCase()}, ${backgroundDark.toLowerCase()}, ${logo ?? null}, ${mime ?? null}, ${logo === undefined}
      )`;
    return result[0];
  });
}

export async function canManageBranding(actor: Actor, institutionId: string) {
  uuid(institutionId);
  return scoped(actor, institutionId, ["admin"], async (tx: Tx) => {
    const rows = await tx.$queryRaw<{ allowed: boolean }[]>`
      SELECT public.can_manage_instance_branding(${actor.id}::uuid) allowed`;
    return { allowed: rows[0]?.allowed === true };
  });
}
