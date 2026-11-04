import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  backendRoot,
  repositoryRoot,
  dockerCompose,
} from "./prisma/docker.mjs";
export const migrationSource = () =>
  readdirSync(resolve(backendRoot, "prisma/migrations"))
    .filter((name) => /^\d/.test(name))
    .sort()
    .map((name) => [
      name,
      readFileSync(
        resolve(backendRoot, "prisma/migrations", name, "migration.sql"),
        "utf8",
      ).replaceAll("\r\n", "\n"),
    ]);
export const migrationDigest = () =>
  createHash("sha256").update(JSON.stringify(migrationSource())).digest("hex");
export async function refreshSchemaSnapshot() {
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
      { input, encoding: "utf8", stdio: "pipe", maxBuffer: 20 * 1024 * 1024 },
    ).trim();
  let created = false;
  try {
    sql(`CREATE DATABASE ${database};`, "rafik");
    created = true;
    const migrations = migrationSource();
    sql(migrations.map(([, source]) => source).join("\n"));
    const data = JSON.parse(
      sql(`SELECT jsonb_build_object('tables',(SELECT jsonb_agg(item ORDER BY item->>'schema',item->>'name') FROM (
 SELECT jsonb_build_object('schema',n.nspname,'name',c.relname,
 'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'nullable',NOT a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),'comment',col_description(c.oid,a.attnum)) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
 'constraints',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',k.conname,'kind',k.contype,'definition',pg_get_constraintdef(k.oid),'target',CASE WHEN k.confrelid=0 THEN NULL ELSE k.confrelid::regclass::text END) ORDER BY k.conname),'[]'::jsonb) FROM pg_constraint k WHERE k.conrelid=c.oid),
 'indexes',(SELECT coalesce(jsonb_agg(indexdef ORDER BY indexname),'[]'::jsonb) FROM pg_indexes WHERE schemaname=n.nspname AND tablename=c.relname),
 'policies',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',policyname,'command',cmd,'using',qual,'check',with_check) ORDER BY policyname),'[]'::jsonb) FROM pg_policies WHERE schemaname=n.nspname AND tablename=c.relname),
 'rls',c.relrowsecurity,
 'grants',jsonb_build_object('guest_select',has_table_privilege('rafik_guest',c.oid,'select'),'user_select',has_table_privilege('rafik_user',c.oid,'select'),'api_select',has_table_privilege('rafik_api',c.oid,'select')),
 'triggers',(SELECT coalesce(jsonb_agg(pg_get_triggerdef(t.oid) ORDER BY t.tgname),'[]'::jsonb) FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal)) item
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r' AND n.nspname IN('public','identity','file_store') AND c.relname<>'_prisma_migrations') x),
 'functions',(SELECT jsonb_agg(jsonb_build_object('name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),'result',pg_get_function_result(p.oid),'user_execute',has_function_privilege('rafik_user',p.oid,'execute'),'guest_execute',has_function_privilege('rafik_guest',p.oid,'execute')) ORDER BY p.proname,p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f'));`),
    );
    const path = resolve(
      repositoryRoot,
      "docs/verification/receipts/backend-schema-catalog.json",
    );
    mkdirSync(resolve(repositoryRoot, "docs/verification/receipts"), {
      recursive: true,
    });
    writeFileSync(
      path,
      JSON.stringify({ migrationDigest: migrationDigest(), ...data }, null, 2) +
        "\n",
    );
    const env = {
      ...process.env,
      DATABASE_URL: `postgresql://rafik_api:rafik-local-api-only@127.0.0.1:55332/${database}`,
    };
    execFileSync(
      process.execPath,
      [
        resolve(repositoryRoot, "node_modules/prisma/build/index.js"),
        "generate",
      ],
      { cwd: backendRoot, env, stdio: "pipe" },
    );
    execFileSync(
      process.execPath,
      [
        resolve(repositoryRoot, "node_modules/tsx/dist/cli.mjs"),
        "scripts/prisma/types.ts",
      ],
      { cwd: backendRoot, env, stdio: "pipe" },
    );
    console.log(
      `Captured ${data.tables.length} migrated tables and ${data.functions.length} SQL functions; generated client/transport types. No preview data read or changed.`,
    );
  } finally {
    if (created) sql(`DROP DATABASE ${database} WITH (FORCE);`, "rafik");
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(import.meta.filename) &&
  process.argv.includes("--refresh-database")
)
  await refreshSchemaSnapshot();
