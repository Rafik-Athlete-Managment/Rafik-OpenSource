import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { backendRoot, dockerCompose } from "./docker.mjs";
import { migrationSource } from "../backend-schema-snapshot.mjs";

const names = JSON.parse(
  readFileSync(resolve(backendRoot, "scripts/institution-names.json"), "utf8"),
);
const database = "rafik_browser_" + Date.now();
const sql = (input, target = database) =>
  dockerCompose(
    [
      "exec",
      "-T",
      "db",
      "psql",
      "-U",
      "rafik_migrate",
      "-d",
      target,
      "-v",
      "ON_ERROR_STOP=1",
      "-Atq",
    ],
    { input, stdio: "pipe", encoding: "utf8", maxBuffer: 30 * 1024 * 1024 },
  ).trim();
const quote = (name) => '"' + name.replaceAll('"', '""') + '"';
let created = false;
try {
  console.log("Checking owned migration database " + database);
  sql(`CREATE DATABASE ${database};`, "rafik");
  created = true;
  const migrations = migrationSource(),
    boundary = migrations.findIndex(
      ([name]) => name === "202610231800_institution_identifiers",
    );
  assert.ok(boundary > 0);
  sql(
    migrations
      .slice(0, boundary)
      .map(([, source]) => source)
      .join("\n"),
  );
  let seed = readFileSync(
    resolve(backendRoot, "prisma/seed.sql"),
    "utf8",
  ).replaceAll("reference_exercises", "exercises");
  for (const [previous, current] of Object.entries(names).sort(
    (a, b) => b[1].length - a[1].length,
  ))
    seed = seed.replaceAll(current, previous);
  sql(seed.replaceAll("institution_id", "workspace_id"));
  sql(`INSERT INTO public.workspace_operations(id,workspace_id,actor_id,payload,result)
    VALUES ('99000000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000002',
    '{"operation":"99000000-0000-4000-8000-000000000001","action":"attendance","view":"trainer","marker":"workspace_id"}',
    '{"workspace_id":"12000000-0000-4000-8000-000000000001","document":{"workspace_id":"frozen-value"}}');`);
  const extra = JSON.parse(
    sql(
      "SELECT jsonb_agg(jsonb_build_array(table_schema,table_name)) FROM information_schema.columns WHERE column_name='workspace_id' AND table_schema IN ('public','identity');",
    ),
  );
  const tables = new Map(
    Object.entries(names).map(([old, current]) => [
      "public." + old,
      { schema: "public", old, current },
    ]),
  );
  for (const [schema, old] of extra)
    tables.set(schema + "." + old, { schema, old, current: names[old] || old });
  const snapshot = (before) =>
    JSON.parse(
      sql(
        `SELECT jsonb_object_agg(name,value) FROM (${[...tables.values()]
          .map(({ schema, old, current }) => {
            const table = schema + "." + quote(before ? old : current);
            const row = before
              ? "CASE WHEN to_jsonb(t) ? 'workspace_id' THEN (to_jsonb(t)-'workspace_id') || jsonb_build_object('institution_id',to_jsonb(t)->'workspace_id') ELSE to_jsonb(t) END"
              : "to_jsonb(t)";
            return `SELECT '${schema}.${current}' name,jsonb_build_object('rows',(SELECT coalesce(jsonb_agg(row ORDER BY row::text),'[]'::jsonb) FROM (SELECT ${row} row FROM ${table} t) q),'authority',(SELECT relrowsecurity::text || has_table_privilege('rafik_user',oid,'select')::text || has_table_privilege('rafik_api',oid,'select')::text FROM pg_class WHERE oid='${table}'::regclass)) value`;
          })
          .join(" UNION ALL ")}) snapshot;`,
      ),
    );
  const originals = snapshot(true);
  const receipt = sql(
    "SELECT payload::text || result::text FROM public.workspace_operations WHERE id='99000000-0000-4000-8000-000000000001';",
  );
  sql(
    migrations
      .slice(boundary, boundary + 1)
      .map(([, source]) => source)
      .join("\n"),
  );
  assert.deepEqual(
    snapshot(false),
    originals,
    "Rows, IDs, nested documents or table authority changed",
  );
  assert.equal(
    sql(
      "SELECT payload::text || result::text FROM public.institution_operations WHERE id='99000000-0000-4000-8000-000000000001';",
    ),
    receipt,
  );
  assert.equal(
    sql(
      "SELECT count(*) FROM information_schema.columns WHERE table_schema IN ('public','identity') AND column_name='workspace_id';",
    ),
    "0",
  );
  assert.equal(
    sql(
      "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','v') AND (c.relname LIKE 'organization\\_%' ESCAPE '\\' OR c.relname LIKE 'workspace%');",
    ),
    "0",
  );
  console.log(
    `Institution rename preserved complete rows, IDs, nested documents, receipts and RLS/grants across ${tables.size} tables; no legacy table/view/column aliases remain.`,
  );
} finally {
  if (created) sql(`DROP DATABASE ${database} WITH (FORCE);`, "rafik");
}
