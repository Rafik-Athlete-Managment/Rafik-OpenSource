import type { ServerResponse } from "node:http";
import { db, ApiError } from "./db.ts";

// These are transport names, never database aliases or a second institution model.
const fields: Record<string, string> = {
  workspace_id: "institution_id",
  workspace: "institution",
  workspaces: "institutions",
  workspace_members: "institution_members",
  workspace_operations: "institution_operations",
  workspace_events: "institution_audit_events",
  workspace_invitations: "institution_invitations",
};
const opaque = new Set([
  "payload",
  "document",
  "definition",
  "prescription",
  "detail",
  "snapshot",
]);
export function institutionTransport(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((v) => institutionTransport(v));
  if (typeof value === "string") {
    const from = "/organization-invite/";
    if (value.startsWith(from)) return value.replace(from, "/invitation/");
  }
  if (
    !value ||
    typeof value !== "object" ||
    value instanceof Date ||
    typeof (value as { toJSON?: unknown }).toJSON === "function"
  )
    return value;
  const names = fields;
  return Object.fromEntries(
    Object.entries(value).map(([key, v]) => [
      names[key] ||
        (key.startsWith("organization_")
          ? key.replace(/^organization_/, "institution_")
          : key),
      opaque.has(key)
        ? v
        : key === "kind" && v === "organization"
          ? "institution"
          : institutionTransport(v),
    ]),
  );
}
export function responseTransport(_res: ServerResponse, value: unknown) {
  // Old acknowledged receipt objects may still carry the old transport names.
  return institutionTransport(institutionTransport(value));
}
export async function institutionRoute(
  url: URL,
  _res: ServerResponse,
): Promise<string> {
  let path = url.pathname.replace(/^\/api(?=\/)/, "");
  if (/^\/v1\/institutions(?:\/|$)/.test(path))
    throw new ApiError(404, "unavailable");
  if (path === "/v1/institution/context") return "/v1/institution/context";
  if (path === "/v1/institution" || path.startsWith("/v1/institution/")) {
    const rows = await db.institutions.findMany({
      where: { kind: "organization" },
      select: { id: true },
      take: 2,
    });
    if (rows.length !== 1) throw new ApiError(404, "institution_unavailable");
    return `/v1/institutions/${rows[0].id}${path.slice("/v1/institution".length)}`;
  }
  return path;
}
