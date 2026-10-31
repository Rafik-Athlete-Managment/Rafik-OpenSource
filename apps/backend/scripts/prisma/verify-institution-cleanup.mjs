import { migrationSource } from "../backend-schema-snapshot.mjs";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { backendRoot, repositoryRoot, dockerCompose } from "./docker.mjs";

const database = "rafik_browser_" + Date.now();
const sql = (name, input) =>
  dockerCompose(
    [
      "exec",
      "-T",
      "db",
      "psql",
      "-U",
      "rafik_migrate",
      "-d",
      name,
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
    ],
    { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  );
const cleanup = readFileSync(
  resolve(
    backendRoot,
    "prisma/migrations/202610221200_single_institution_remove_tasks/migration.sql",
  ),
  "utf8",
);
let created = false;
try {
  sql("rafik", `CREATE DATABASE ${database};`);
  created = true;
  sql(
    database,
    migrationSource()
      .filter(([name]) => name < "202610231800_institution_identifiers")
      .map(([, source]) => source)
      .join("\n"),
  );
  // Reconstruct only the retired table to test a real populated upgrade and rollback guard.
  sql(
    database,
    readFileSync(
      resolve(
        backendRoot,
        "prisma/migrations/202609280200_organization_tasks/migration.sql",
      ),
      "utf8",
    ),
  );
  sql(
    database,
    `
    INSERT INTO identity.users(id,email) VALUES ('11000000-0000-4000-8000-000000000001','cleanup@rafik.test');
    INSERT INTO public.workspaces(id,kind,name,created_by) VALUES
      ('12000000-0000-4000-8000-000000000001','organization','First','11000000-0000-4000-8000-000000000001'),
      ('12000000-0000-4000-8000-000000000002','organization','Second','11000000-0000-4000-8000-000000000001');
    INSERT INTO public.workspace_members(id,workspace_id,user_id,roles) VALUES
      ('13000000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000001',ARRAY['admin']);
    INSERT INTO public.organization_tasks(id,workspace_id,assigned_to,created_by,title) VALUES
      ('14000000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000001','13000000-0000-4000-8000-000000000001','13000000-0000-4000-8000-000000000001','Private task');
    INSERT INTO public.workspace_operations(id,workspace_id,actor_id,payload,result) VALUES
      ('15000000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000001','{"action":"save"}','{"assigned_to":"member","created_by":"member","priority":"normal","due_date":null}'),
      ('15000000-0000-4000-8000-000000000002','12000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000001','{"action":"save"}','{"title":"Keep program receipt"}');
    INSERT INTO public.workspace_events(workspace_id,kind) VALUES
      ('12000000-0000-4000-8000-000000000001','trainer_task_save'),
      ('12000000-0000-4000-8000-000000000001','organization_created');
  `,
  );
  assert.throws(
    () => sql(database, cleanup),
    /one institution per installation/,
  );
  assert.equal(
    sql(database, "SELECT count(*) FROM public.organization_tasks;").trim(),
    "1",
  );
  assert.equal(
    sql(database, "SELECT count(*) FROM public.workspace_operations;").trim(),
    "2",
  );
  sql(
    database,
    "DELETE FROM public.workspaces WHERE id='12000000-0000-4000-8000-000000000002';",
  );
  sql(database, cleanup);
  assert.equal(
    sql(
      database,
      "SELECT to_regclass('public.organization_tasks') IS NULL;",
    ).trim(),
    "t",
  );
  assert.equal(
    sql(database, "SELECT count(*) FROM public.workspace_operations;").trim(),
    "1",
  );
  assert.equal(
    sql(
      database,
      "SELECT count(*) FROM public.workspace_events WHERE kind='trainer_task_save';",
    ).trim(),
    "0",
  );
  assert.equal(
    sql(
      database,
      "SELECT count(*) FROM public.workspace_events WHERE kind='organization_created';",
    ).trim(),
    "1",
  );
  for (const [, source] of migrationSource().filter(
    ([name]) => name >= "202610231800_institution_identifiers",
  ))
    sql(database, source);
  execFileSync(
    process.execPath,
    [
      resolve(repositoryRoot, "node_modules/tsx/dist/cli.mjs"),
      "scripts/prisma/types.ts",
    ],
    {
      cwd: backendRoot,
      stdio: "pipe",
      env: {
        ...process.env,
        DATABASE_URL: `postgresql://rafik_api:rafik-local-api-only@127.0.0.1:55332/${database}`,
      },
    },
  );
  console.log(
    "Fresh migrations, multi-institution atomic stop, permanent task/receipt cleanup, unrelated record preservation and generated transport types passed.",
  );
} finally {
  if (created) sql("rafik", `DROP DATABASE ${database} WITH (FORCE);`);
}
