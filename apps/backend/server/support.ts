import { asActor, ApiError, type Actor } from "./db.ts";
import { pageOffset } from "./service-definitions.ts";
export async function supportCases(actor: Actor, params: URLSearchParams) {
  return asActor(actor, (tx) =>
    tx.support_cases.findMany({
      where: { reporter_id: actor.id },
      orderBy: [{ updated_at: "desc" }, { id: "asc" }],
      take: 100,
      skip: pageOffset(params.get("offset") || "0"),
    }),
  );
}
export async function supportCommand(
  actor: Actor,
  input: Record<string, unknown>,
) {
  const args = input.args as Record<string, unknown>;
  if (!args || typeof args !== "object" || Array.isArray(args))
    throw new ApiError(400, "invalid_request");
  if (args.p_team != null || args.p_reply != null)
    throw new ApiError(400, "invalid_request");
  return asActor(actor, async (tx) => {
    const rows =
      input.action === "create_support_case"
        ? await tx.$queryRaw<
            { value: unknown }[]
          >`SELECT to_jsonb(public.create_support_case(${args.p_id as string}::uuid,${args.p_subject as string},${args.p_detail as string})) value`
        : input.action === "update_support_case"
          ? await tx.$queryRaw<
              { value: unknown }[]
            >`SELECT to_jsonb(public.update_support_case(${args.p_id as string}::uuid,${args.p_revision as number}::int,${args.p_state as string})) value`
          : null;
    if (!rows) throw new ApiError(400, "invalid_request");
    return rows[0]?.value;
  });
}
