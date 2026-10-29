import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { backendRoot, dockerCompose } from "./docker.mjs";
const database = "rafik_browser_" + Date.now(),
  name = "202610290900_group_workouts";
const migrations = resolve(backendRoot, "prisma/migrations");
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
    { input, encoding: "utf8", stdio: "pipe" },
  ).trim();
const preserved = () =>
  sql(`SELECT jsonb_build_object(
 'sessions',(SELECT jsonb_agg(to_jsonb(s)-'source_kind' ORDER BY id) FROM institution_sessions s),
 'events',(SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM institution_events e),
 'people',(SELECT jsonb_agg(to_jsonb(p)-'workout_skip_reason' ORDER BY event_id,member_id) FROM institution_event_people p),
 'history',(SELECT jsonb_agg(to_jsonb(h) ORDER BY id) FROM institution_session_history h),
 'receipts',(SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM institution_operations o));`);
let created = false;
try {
  sql(`CREATE DATABASE ${database};`, "rafik");
  created = true;
  sql(
    readdirSync(migrations)
      .filter((x) => /^\d/.test(x) && x < name)
      .sort()
      .map((x) => readFileSync(resolve(migrations, x, "migration.sql"), "utf8"))
      .join("\n"),
  );
  sql(readFileSync(resolve(backendRoot, "prisma/seed.sql"), "utf8"));
  sql(`INSERT INTO institution_sessions(id,institution_id,member_id,assignment_id,day_id,local_date,document,completed_at)
  VALUES('19000000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000001','13000000-0000-4000-8000-000000000003','16000000-0000-4000-8000-000000000001','preserved-workout',current_date,'{"prescription":{"id":"preserved-workout","exercises":[]},"entries":[],"note":"Historical actuals"}',now());
  INSERT INTO institution_session_history(id,institution_id,session_id,version,actor_member_id,action,entries,note,completed)
  VALUES('19100000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000001','19000000-0000-4000-8000-000000000001',1,'13000000-0000-4000-8000-000000000002','start','[]','Preserved coach note',true);
  INSERT INTO institution_operations(id,institution_id,actor_id,payload,result)
  SELECT gen_random_uuid(),institution_id,user_id,'{"action":"save","entries":[]}','{"acknowledged":true,"version":2}' FROM institution_members WHERE id='13000000-0000-4000-8000-000000000002';`);
  const before = preserved();
  sql(readFileSync(resolve(migrations, name, "migration.sql"), "utf8"));
  assert.equal(preserved(), before);
  assert.equal(
    sql(
      "SELECT count(*) FROM institution_sessions WHERE source_kind='assignment' AND assignment_id IS NOT NULL;",
    ),
    "1",
  );
  assert.equal(sql("SELECT count(*) FROM institution_workout_templates;"), "0");
  assert.equal(
    sql(
      "SELECT has_table_privilege('rafik_guest','public.institution_workout_templates','select') OR has_table_privilege('rafik_user','public.institution_workout_templates','select');",
    ),
    "f",
  );
  assert.throws(() =>
    sql(
      "UPDATE institution_sessions SET assignment_id=NULL WHERE id='19000000-0000-4000-8000-000000000001';",
    ),
  );
  assert.equal(preserved(), before);
  console.log(
    "Populated group-workout forward migration preserves prior sessions, events, participant marks, history and exact receipts; assignment-source guard and private grants passed.",
  );
} finally {
  if (created) sql(`DROP DATABASE ${database} WITH (FORCE);`, "rafik");
}
