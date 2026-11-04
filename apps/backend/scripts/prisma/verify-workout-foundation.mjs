import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { backendRoot, repositoryRoot, dockerCompose } from "./docker.mjs";
const database = "rafik_browser_" + Date.now();
const migrations = resolve(backendRoot, "prisma/migrations");
const name = "202610231200_workout_sequence_foundation";
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
      "-At",
    ],
    { input, encoding: "utf8", stdio: "pipe" },
  ).trim();
function historicalSeed() {
  let source = readFileSync(
    resolve(backendRoot, "prisma/seed.sql"),
    "utf8",
  ).replaceAll("reference_exercises", "exercises");
  const names = JSON.parse(
    readFileSync(
      resolve(backendRoot, "scripts/institution-names.json"),
      "utf8",
    ),
  );
  for (const [old, current] of Object.entries(names).sort(
    (a, b) => b[1].length - a[1].length,
  ))
    source = source.replaceAll(current, old);
  return source.replaceAll("institution_id", "workspace_id");
}
const preserved = () =>
  sql(`SELECT jsonb_build_object(
 'sessions',(SELECT jsonb_agg(to_jsonb(s)-'occurrence_id'-'source_snapshot' ORDER BY id) FROM organization_sessions s),
 'events',(SELECT jsonb_agg(to_jsonb(e)-'training_date'-'workout_snapshot' ORDER BY id) FROM organization_events e),
 'history',(SELECT jsonb_agg(to_jsonb(h) ORDER BY id) FROM organization_session_history h),
 'feedback',(SELECT jsonb_agg(to_jsonb(f) ORDER BY id) FROM organization_session_feedback f),
 'receipts',(SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM workspace_operations o),
 'scores',(SELECT jsonb_agg(to_jsonb(r) ORDER BY event_id,member_id) FROM assessment_results r));`);
let created = false;
try {
  sql(`CREATE DATABASE ${database};`, "rafik");
  created = true;
  sql(
    readdirSync(migrations)
      .filter((x) => x < name && /^\d/.test(x))
      .sort()
      .map((entry) =>
        readFileSync(resolve(migrations, entry, "migration.sql"), "utf8"),
      )
      .join("\n"),
  );
  sql(historicalSeed());
  sql(`INSERT INTO organization_sessions(id,workspace_id,member_id,assignment_id,day_id,local_date,document,completed_at)
 VALUES ('19000000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000001','13000000-0000-4000-8000-000000000003','16000000-0000-4000-8000-000000000001','historical-day',current_date,'{"prescription":{"id":"historical-day","exercises":[]},"entries":[],"note":"Preserve actuals"}',now());
 INSERT INTO organization_session_history(id,workspace_id,session_id,version,actor_member_id,action,entries,note,completed)
 VALUES ('19100000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000001','19000000-0000-4000-8000-000000000001',1,'13000000-0000-4000-8000-000000000002','start','[]','historical correction',true);`);
  sql(`INSERT INTO organization_session_feedback(id,workspace_id,member_id,workout_id,score)
 VALUES(gen_random_uuid(),'12000000-0000-4000-8000-000000000001','13000000-0000-4000-8000-000000000003','19000000-0000-4000-8000-000000000001',4);
 INSERT INTO workspace_operations(id,workspace_id,actor_id,payload,result)
 SELECT gen_random_uuid(),'12000000-0000-4000-8000-000000000001',user_id,'{"action":"save","entries":[]}','{"acknowledged":true,"version":2}' FROM workspace_members WHERE id='13000000-0000-4000-8000-000000000002';`);
  const before = preserved();
  sql(readFileSync(resolve(migrations, name, "migration.sql"), "utf8"));
  assert.equal(preserved(), before);
  assert.equal(
    sql(
      "SELECT count(*) FROM organization_sessions WHERE source_snapshot->'prescription'=document->'prescription' AND occurrence_id IS NULL;",
    ),
    "1",
  );
  assert.equal(
    sql(
      "SELECT count(*) FROM organization_events WHERE training_date IS DISTINCT FROM (starts_at AT TIME ZONE timezone)::date;",
    ),
    "0",
  );
  assert.equal(
    sql("SELECT bool_and(sequence_cursor=0) FROM organization_assignments;"),
    "t",
  );
  assert.equal(
    sql(
      "SELECT has_table_privilege('rafik_user','organization_workout_positions','SELECT') OR has_table_privilege('rafik_guest','organization_workout_recurrences','SELECT');",
    ),
    "f",
  );
  const recurrence = `INSERT INTO organization_workout_recurrences(workspace_id,assignment_id,created_by,starts_on,ends_on,weekdays,timezone,local_time,duration_minutes) VALUES ('12000000-0000-4000-8000-000000000001','16000000-0000-4000-8000-000000000001','13000000-0000-4000-8000-000000000002',current_date,current_date+14,ARRAY[1,3]::smallint[],'Asia/Dubai','09:00',60)`;
  sql(recurrence);
  assert.throws(
    () => sql(recurrence.replace("+14", "+400")),
    /check constraint/,
  );
  assert.throws(
    () => sql(recurrence.replace("'09:00',60", "'09:00',NULL")),
    /check constraint/,
  );
  assert.throws(
    () => sql("UPDATE organization_sessions SET source_snapshot='{}';"),
    /immutable_workout_source/,
  );
  const position = `INSERT INTO organization_workout_positions(workspace_id,assignment_id,position,cycle,day_id,occurrence_id) VALUES ('12000000-0000-4000-8000-000000000001','16000000-0000-4000-8000-000000000001',0,0,'day-a','17000000-0000-4000-8000-000000000003')`;
  sql(position);
  assert.throws(() => sql(position), /unique constraint/);
  assert.throws(
    () =>
      sql(
        "UPDATE organization_workout_positions SET state='skipped',resolved_at=now(),resolved_by='13000000-0000-4000-8000-000000000002';",
      ),
    /check constraint/,
  );
  assert.throws(
    () =>
      sql(
        "UPDATE organization_workout_positions SET occurrence_id='17000000-0000-4000-8000-000000000001';",
      ),
    /immutable_workout_position/,
  );
  // Existing beta.2 insert shape still works and automatically freezes its source.
  sql(`INSERT INTO organization_sessions(id,workspace_id,member_id,assignment_id,day_id,local_date,document)
 SELECT gen_random_uuid(),workspace_id,member_id,assignment_id,'old-client',local_date,'{"prescription":{"id":"old-client"}}' FROM organization_sessions LIMIT 1;`);
  assert.equal(
    sql(
      "SELECT count(*) FROM organization_sessions WHERE source_snapshot IS NULL;",
    ),
    "0",
  );
  // Historical migration checks must finish on the latest schema before regenerating transport types.
  const later = readdirSync(migrations)
    .filter((entry) => entry > name && /^\d/.test(entry))
    .sort();
  if (later.length)
    sql(
      later
        .map((entry) =>
          readFileSync(resolve(migrations, entry, "migration.sql"), "utf8"),
        )
        .join("\n"),
    );
  const env = {
    ...process.env,
    MIGRATION_DATABASE_URL: `postgresql://rafik_migrate:rafik-local-migrations-only@127.0.0.1:55332/${database}`,
    DATABASE_URL: `postgresql://rafik_api:rafik-local-api-only@127.0.0.1:55332/${database}`,
  };
  execFileSync(
    process.execPath,
    [resolve(repositoryRoot, "node_modules/prisma/build/index.js"), "generate"],
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
    "Populated forward migration, preserved records/receipts, source backfill, legacy insert compatibility, recurrence/position constraints and private grants passed; client/transport types generated.",
  );
} finally {
  if (created) sql(`DROP DATABASE ${database} WITH (FORCE);`, "rafik");
}
