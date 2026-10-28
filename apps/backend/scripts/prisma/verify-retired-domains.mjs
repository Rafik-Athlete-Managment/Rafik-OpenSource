// Populate the previous schema, retire legacy domains and reconcile every current
// institutional row/receipt. The preview database and byte directory are untouched.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { backendRoot, dockerCompose } from "./docker.mjs";
import { migrationSource } from "../backend-schema-snapshot.mjs";
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
    { input, encoding: "utf8", stdio: "pipe", maxBuffer: 30 * 1024 * 1024 },
  ).trim();
let created = false;
try {
  sql(`CREATE DATABASE ${database};`, "rafik");
  created = true;
  const migrations = migrationSource(),
    boundary = migrations.findIndex(
      ([name]) => name === "202610232000_remove_retired_domains",
    );
  assert.ok(boundary > 0);
  sql(
    migrations
      .slice(0, boundary)
      .map(([, s]) => s)
      .join("\n"),
  );
  sql(
    readFileSync(resolve(backendRoot, "prisma/seed.sql"), "utf8").replaceAll(
      "reference_exercises",
      "exercises",
    ),
  );
  sql(`INSERT INTO public.plans(id,coach_id,title,draft) VALUES('99000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Retired personal plan','{}');
  INSERT INTO public.business_accounts(id,owner_id) VALUES('99000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001');
  INSERT INTO public.business_events(id,account_id,sequence,payload,applied) VALUES('99000000-0000-4000-8000-000000000003','99000000-0000-4000-8000-000000000002',1,'{}',false);
  INSERT INTO public.institution_operations(id,institution_id,actor_id,payload,result) VALUES('99000000-0000-4000-8000-000000000004','12000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000001','{"operation":"keep","document":{"workspace_id":"opaque"}}','{"saved":true}');`);
  const names = JSON.parse(
    sql(
      `SELECT json_agg(c.relname ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND (left(c.relname,12)='institution_' OR c.relname IN('institutions','assessment_results','assessment_result_history','assessment_templates','program_media','profiles','instance_branding'));`,
    ),
  );
  // Compare the columns that existed before retirement. Later additive migrations may
  // add columns with defaults; those must not count as changes to existing records.
  const columns = JSON.parse(
    sql(
      `SELECT json_object_agg(table_name,cols) FROM (SELECT table_name,json_agg(column_name ORDER BY ordinal_position) cols FROM information_schema.columns WHERE table_schema='public' AND table_name IN (${names.map((n) => `'${n}'`).join(",")}) GROUP BY table_name) c;`,
    ),
  );
  const snapshot = () =>
    JSON.parse(
      sql(
        `SELECT jsonb_object_agg(name,rows) FROM (${names.map((name) => `SELECT '${name}' name,(SELECT coalesce(jsonb_agg(row ORDER BY row::text),'[]') FROM (SELECT to_jsonb(t) row FROM (SELECT ${columns[name].map((c) => `"${c}"`).join(",")} FROM public."${name}") t) data) rows`).join(" UNION ALL ")}) snapshot;`,
      ),
    );
  const before = snapshot();
  sql(
    migrations
      .slice(boundary)
      .map(([, s]) => s)
      .join("\n"),
  );
  assert.deepEqual(
    snapshot(),
    before,
    "Institution records, histories, metadata or exact receipts changed",
  );
  sql(readFileSync(resolve(backendRoot, "tests/sql/institution.sql"), "utf8"));
  assert.equal(
    sql(
      "SELECT count(*) FROM information_schema.tables WHERE table_schema='file_store';",
    ),
    "0",
  );
  assert.equal(
    sql(
      "SELECT count(*) FROM public.reference_exercises WHERE id LIKE 'dataset-%';",
    ),
    "1324",
  );
  console.log(
    `Populated retirement passed: ${names.length} current table snapshots unchanged; retired tables/functions absent; reference corpus and last-admin guard preserved.`,
  );
} finally {
  if (created) sql(`DROP DATABASE ${database} WITH (FORCE);`, "rafik");
}
