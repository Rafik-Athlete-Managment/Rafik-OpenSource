// Report by default. --apply removes only old, unreferenced hashed private files.
import { execFileSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  readdirSync,
  lstatSync,
  unlinkSync,
} from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { composeFile, dockerCompose } from "./docker.mjs";
import { localStorageTarget } from "./local-storage-target.mjs";
const target = localStorageTarget();
const root = resolve(import.meta.dirname, "../.."),
  dir = target.files,
  apply = process.argv.includes("--apply");
if (
  !readFileSync(composeFile, "utf8").startsWith(
    "name: ${RAFIK_INSTANCE_ID:-rafik-prisma-local}",
  )
)
  throw Error("Local project required");
const referenced = () =>
  new Set(
    dockerCompose(
      [
        "exec",
        "-T",
        "db",
        "psql",
        "-U",
        "rafik_migrate",
        "-d",
        target.database,
        "-Atc",
        "select 'program/'||institution_id||'/'||id from public.program_media union select 'organization/'||institution_id||'/'||id from public.institution_assets",
      ],
      { encoding: "utf8" },
    )
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((p) => createHash("sha256").update(p).digest("hex")),
  );
const only = process.argv.find((x) => x.startsWith("--only="))?.slice(7);
if (only && !/^[a-f0-9]{64}$/.test(only)) throw Error("Invalid file selector");
const known = referenced(),
  candidates = [];
for (const name of existsSync(dir) ? readdirSync(dir) : []) {
  if (
    (only && name !== only) ||
    !/^[a-f0-9]{64}$/.test(name) ||
    known.has(name)
  )
    continue;
  const file = resolve(dir, name),
    stat = lstatSync(file);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    Date.now() - stat.mtimeMs < 86400000
  )
    continue;
  candidates.push({ name, bytes: stat.size });
  if (apply && !referenced().has(name)) unlinkSync(file);
}
console.log(
  JSON.stringify(
    { mode: apply ? "apply" : "report", graceHours: 24, candidates },
    null,
    2,
  ),
);
