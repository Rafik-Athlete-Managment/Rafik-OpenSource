// Rehearse a fresh installation in a new disposable database; never reset the preview.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { composeFile, dockerCompose, repositoryRoot } from "./docker.mjs";
const root = resolve(import.meta.dirname, "../.."),
  name = "rafik_check_" + Date.now();
// Rehearse historical SQL against the current disposable schema without editing
// deployed migration sources or checksums. Include embedded constraint names.
const institutionNames = JSON.parse(
  readFileSync(resolve(root, "scripts/institution-names.json"), "utf8"),
);
const currentIdentifiers = (source) => {
  for (const [before, after] of Object.entries(institutionNames))
    source = source.replaceAll(before, after);
  return source.replaceAll("workspace_id", "institution_id");
};
if (
  !readFileSync(composeFile, "utf8").startsWith(
    "name: ${RAFIK_INSTANCE_ID:-rafik-prisma-local}",
  )
)
  throw Error("Local guard failed");
const sql = (database, input) =>
  dockerCompose(
    [
      "exec",
      "-T",
      "db",
      "psql",
      "-U",
      "rafik_migrate",
      "-d",
      database,
      "-v",
      "ON_ERROR_STOP=1",
    ],
    {
      cwd: root,
      input,
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    },
  );
let created = false;
try {
  sql("rafik", `create database ${name};`);
  created = true;
  execFileSync(
    process.execPath,
    [
      resolve(repositoryRoot, "node_modules/prisma/build/index.js"),
      "migrate",
      "deploy",
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        MIGRATION_DATABASE_URL: `postgresql://rafik_migrate:rafik-local-migrations-only@127.0.0.1:55332/${name}`,
      },
      stdio: "inherit",
    },
  );
  sql(name, readFileSync(resolve(root, "prisma/seed.sql"), "utf8"));
  const roleMigration = currentIdentifiers(
    readFileSync(
      resolve(
        root,
        "prisma/migrations/202610171100_single_membership_roles/migration.sql",
      ),
      "utf8",
    ),
  );
  sql(
    name,
    `BEGIN;
ALTER TABLE public.institution_members DROP CONSTRAINT institution_members_single_role_check;
ALTER TABLE public.institution_invitations DROP CONSTRAINT institution_invitations_single_role_check;
ALTER TABLE public.institution_members ADD CONSTRAINT institution_members_legacy_roles_check CHECK (cardinality(roles) BETWEEN 1 AND 3 AND roles <@ ARRAY['admin','trainer','trainee']::text[]);
ALTER TABLE public.institution_invitations ADD CONSTRAINT institution_invitations_legacy_roles_check CHECK (cardinality(roles) BETWEEN 1 AND 3 AND roles <@ ARRAY['admin','trainer','trainee']::text[]);
UPDATE public.institution_members SET roles=ARRAY['trainer','trainee']::text[] WHERE id='13000000-0000-4000-8000-000000000003';
INSERT INTO public.institution_invitations(id,institution_id,email,roles,token_hash,created_by,expires_at)
VALUES ('15000000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000001','legacy-multi@rafik.test',ARRAY['trainer','trainee']::text[],repeat('a',64),'11000000-0000-4000-8000-000000000001',now()+interval '1 day');
${roleMigration}
DO $$ BEGIN
  IF (SELECT roles FROM public.institution_members WHERE id='13000000-0000-4000-8000-000000000003') IS DISTINCT FROM ARRAY['trainer']::text[] THEN RAISE EXCEPTION 'membership role normalization failed'; END IF;
  IF (SELECT trainer_id FROM public.institution_members WHERE id='13000000-0000-4000-8000-000000000003') IS NOT NULL THEN RAISE EXCEPTION 'trainer assignment was not cleared'; END IF;
  IF (SELECT roles FROM public.institution_invitations WHERE id='15000000-0000-4000-8000-000000000001') IS DISTINCT FROM ARRAY['trainer']::text[] THEN RAISE EXCEPTION 'invitation role normalization failed'; END IF;
END $$;
ROLLBACK;`,
  );
  console.log(
    "Legacy combined membership/invitation normalization and assigned-athlete cleanup pass (rolled back).",
  );
  // Coaching links: the trigger mirrors seeded trainer_id rows, and the migration backfill
  // recreates primary links from trainer_id alone.
  const coachingMigration = currentIdentifiers(
    readFileSync(
      resolve(
        root,
        "prisma/migrations/202610191300_coaching_links/migration.sql",
      ),
      "utf8",
    ),
  );
  const backfill = coachingMigration.match(
    /insert into public\.institution_coaching_links[\s\S]*?where m\.trainer_id is not null;/,
  )?.[0];
  if (!backfill) throw Error("Coaching backfill statement not found");
  sql(
    name,
    `BEGIN;
CREATE FUNCTION pg_temp.mirror_ok() RETURNS boolean LANGUAGE sql AS $$
  SELECT NOT EXISTS(SELECT 1 FROM public.institution_members m WHERE m.trainer_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.institution_coaching_links l WHERE l.athlete_member_id=m.id AND l.coach_member_id=m.trainer_id AND l.kind='primary' AND l.ended_at IS NULL))
  AND NOT EXISTS(SELECT 1 FROM public.institution_coaching_links l JOIN public.institution_members m ON m.id=l.athlete_member_id
    WHERE l.kind='primary' AND l.ended_at IS NULL AND m.trainer_id IS DISTINCT FROM l.coach_member_id) $$;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.institution_members WHERE trainer_id IS NOT NULL) THEN RAISE EXCEPTION 'seed has no assigned athletes to check'; END IF;
  IF NOT pg_temp.mirror_ok() THEN RAISE EXCEPTION 'seeded primary links do not mirror trainer_id'; END IF;
END $$;
ALTER TABLE public.institution_members DISABLE TRIGGER institution_members_sync_coaching_links;
DELETE FROM public.institution_coaching_links;
${backfill}
ALTER TABLE public.institution_members ENABLE TRIGGER institution_members_sync_coaching_links;
DO $$ BEGIN IF NOT pg_temp.mirror_ok() THEN RAISE EXCEPTION 'backfill did not recreate primary links'; END IF; END $$;
UPDATE public.institution_members SET active=false WHERE id IN (SELECT DISTINCT trainer_id FROM public.institution_members WHERE trainer_id IS NOT NULL);
UPDATE public.institution_members SET trainer_id=NULL WHERE trainer_id IS NOT NULL;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.institution_coaching_links WHERE ended_at IS NULL) THEN RAISE EXCEPTION 'deactivation or cleared trainer_id left active links'; END IF;
  IF NOT pg_temp.mirror_ok() THEN RAISE EXCEPTION 'mirror diverged after clearing'; END IF;
END $$;
ROLLBACK;`,
  );
  console.log(
    "Coaching links mirror seeded trainer_id, backfill recreates primaries and departures end links (rolled back).",
  );
  sql(name, readFileSync(resolve(root, "tests/sql/institution.sql"), "utf8"));
  console.log(
    "Fresh Prisma migrations, fixtures and institution SQL assertions pass. Preview database unchanged.",
  );
} finally {
  if (created) sql("rafik", `drop database ${name} with (force);`);
}
