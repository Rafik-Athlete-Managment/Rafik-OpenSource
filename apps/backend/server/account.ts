import { asActor, ApiError, type Actor } from "./db.ts";
import { institutionAccountData } from "./account-data.ts";

export async function accountProfile(
  actor: Actor,
  input: Record<string, unknown>,
  update = false,
) {
  for (const key of ["p_name", "p_locale", "p_units", "p_timezone"]) {
    if (
      input[key] != null &&
      (typeof input[key] !== "string" || String(input[key]).length > 150)
    )
      throw new ApiError(400, "invalid_request");
  }
  if (
    update &&
    ["p_name", "p_locale", "p_units", "p_timezone"].some(
      (key) => typeof input[key] !== "string",
    )
  )
    throw new ApiError(400, "invalid_request");
  return asActor(actor, async (tx) => {
    const rows = update
      ? await tx.$queryRaw<
          { value: unknown }[]
        >`SELECT to_jsonb(public.update_profile(${input.p_name as string},${input.p_locale as string},${input.p_units as string},${input.p_timezone as string})) value`
      : await tx.$queryRaw<
          { value: unknown }[]
        >`SELECT to_jsonb(public.ensure_profile(${(input.p_name ?? null) as string | null},${(input.p_locale ?? "en") as string},${(input.p_timezone ?? "UTC") as string})) value`;
    return rows[0]?.value;
  });
}
export async function accountExport(actor: Actor) {
  const own = await asActor(actor, async (tx) => ({
    profile: await tx.profiles.findUnique({ where: { id: actor.id } }),
    supportCases: await tx.support_cases.findMany({
      where: { reporter_id: actor.id },
      orderBy: { id: "asc" },
    }),
  }));
  return {
    ...own,
    institution: await institutionAccountData(actor),
    exportedAt: new Date().toISOString(),
  };
}
export async function accountDeletion(
  actor: Actor,
  input: Record<string, unknown>,
  preflight = false,
) {
  if (!preflight && input.confirmation !== "DELETE")
    throw new ApiError(400, "invalid_confirmation");
  return asActor(actor, async (tx) => {
    if (preflight)
      await tx.$queryRaw`SELECT public.account_deletion_ready()::text`;
    else
      await tx.$queryRaw`SELECT public.delete_my_account(${input.confirmation as string})::text`;
    return { deleted: !preflight, ready: true };
  });
}
