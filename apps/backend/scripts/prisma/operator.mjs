// Local support operator access; HTTP platform authority is checked separately.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { composeFile, dockerCompose } from "./docker.mjs";
const root = resolve(import.meta.dirname, "../..");
if (
  !readFileSync(composeFile, "utf8").startsWith(
    "name: ${RAFIK_INSTANCE_ID:-rafik-prisma-local}",
  )
)
  throw Error("Local fixture guard failed");
export const quote = (value) => "'" + String(value).replaceAll("'", "''") + "'";
export const sql = (text) =>
  dockerCompose(
    [
      "exec",
      "-T",
      "db",
      "psql",
      "-U",
      "rafik_migrate",
      "-d",
      "rafik",
      "-v",
      "ON_ERROR_STOP=1",
      "-Atq",
    ],
    {
      cwd: root,
      input: text,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
export function operator(name, args) {
  const signatures = {
    operator_support_reply: {
      p_id: "uuid",
      p_revision: "integer",
      p_reply: "text",
    },
  };
  const spec = signatures[name];
  if (!spec || Object.keys(args).some((k) => !spec[k]))
    throw Error("Invalid operator command");
  const params = Object.entries(args)
    .map(
      ([k, v]) =>
        k +
        "=>" +
        quote(spec[k] === "jsonb" ? JSON.stringify(v) : v) +
        "::" +
        spec[k],
    )
    .join(",");
  return JSON.parse(
    sql(
      `begin;set local role rafik_service;select to_jsonb(public.${name}(${params}));commit;`,
    ),
  );
}
