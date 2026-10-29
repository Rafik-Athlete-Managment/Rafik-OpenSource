# Operations

## Group-workout upgrade — unreleased beta.3

Back up the matching application, PostgreSQL database and private files before applying `202610290900_group_workouts`. Local development: run `npm run backend:start` from the root, then restart the API and web app. The forward migration adds the template library and participant skip reasons, defaults prior sessions to assignment sources and permits assignment-free records only with a valid additional group source. It does not manufacture historical sessions, change individual cursors or delete results/receipts. Deploy the matching API/web together; rollback restores the complete matching backup/application rather than dropping columns. Current Android queues retain their identities and attendance/assessment payloads. Until the native workout slice, finish unresolved group results on the web; an Android finish rejection must retain recovery state. Use the [canonical walkthrough](../testing/instance-validation.md#workout-templates-and-group-workouts--unreleased-beta3) for acceptance.

After deploying, use the [full instance walkthrough](../testing/instance-validation.md) to validate setup and the administrator, coach and athlete journeys on your instance. It is the single maintained role checklist; use the copy from the same release tag or source commit as your deployment. Hosted operators skip its local startup commands.

## Recurring workout preparation rollout

Unreleased beta.3: apply the forward migration with the matching services stopped and a complete database/private-files backup, then deploy the matching backend and web. Close/update old web tabs before enabling policies so cached clients cannot misinterpret day-only bounds. The new event timing shape does not rewrite existing timestamps, workouts or receipts. The unique active-rule constraint refuses inconsistent duplicate active policies rather than deleting them. Existing native workout capture is still a later slice; follow the coordinated beta.3 upgrade policy.

The API starts a one-minute bounded scheduling poll; no separate cron host or cloud service is needed. Plans remain manual until staff opt in. To pause automatic materialization, set RAFIK_DISABLE_WORKOUT_SCHEDULER=true and restart the API; Compose forwards this setting. Saved policies/history and existing workouts remain. Restore false/restart to resume; verify the scheduler_enabled response and plan diagnostics.

For a deliberate one-shot pass, from the repository root with the normal backend database environment configured, run `npm run workouts:prepare`. Expected output is a JSON checked-policy count, not a created-workout count. This explicit operator command runs even while the API poll is paused. It checks at most 50 policies and is safe to repeat. Do not copy credentials into scripts. Each rule failure retains a general diagnostic; unexpected failures are logged and do not stop the rest of the batch. Monitor policy age/issue and validate deployment throughput separately; a one-minute timer is not a guarantee for every institution size.

Recovery: correct authority, restriction or timing issues, then wait for/re-run preparation. Do not delete positions or rewrite cursors to unblock a workout. Use its explicit reschedule/skip workflow. Roll back through a matching database/files/application backup, not an unsafe down migration.

## Historical fixed-time API rollout checkpoint

Unreleased beta.3: deploy the additive migration before the backend containing the sequence service. No new environment variable or cron job is required in this slice. No recurring scheduler was started at this checkpoint; the preparation rollout above supersedes that limitation. Fixed-time bookings use explicit offset-bearing timestamps and an IANA timezone. Existing unlinked recording and attendance/assessment receipts remain supported. Update web/native interfaces only through the coordinated later cutover; do not advertise offline workout capture from these server endpoints alone.

## Additive workout foundation upgrade

Unreleased beta.3: apply normal forward migrations after a matching database/files/application backup. This migration freezes historical workout sources and derives existing event dates from their timezones. It does not infer sequence progress from old completion counts or attach same-day workouts to group attendance. Existing IDs, documents and receipts remain. Current institutional record IDs and exact queued receipts remain; beta.2 clients are unsupported at the breaking beta.3 boundary and require the matching upgraded client. The fixed-time individual API is described above; subsequent recurring/day-only and group web slices are described above; native workout capture remains pending. Restore the matching backup/application for rollback; do not drop the new columns as a recovery procedure.

From the repository root, with the local Docker database running, `npm run test:workout-foundation` verifies a populated upgrade in its own temporary database and deletes that database afterward. It does not migrate or seed your preview database.

## Next-release cleanup upgrade

Unreleased: before upgrading, back up the database and files with the matching application version. The forward migration permanently deletes Tasks data, attributable receipts and task events. It stops before deletion if multiple institutions exist, including archived institutions. Separate such deployments before retrying; do not delete an institution just to pass the guard. First-run setup is the only creation flow. Rollback after migration requires restoring the pre-upgrade database and application together. See [ADR 0026](../decisions/ADR-0026-single-institution-routing-and-task-retirement.md).

This is the operator entry point for builds, self-hosted deployment, configuration, secrets, backups, recovery and operational checks. Rafik is deployed as a separate instance on infrastructure controlled by each university.

For Android maintainers, [release operations](android-release.md) includes signing-key backup with an encrypted archive and a local S20+ acceptance path using USB forwarding; no public domain or running emulator is required for that device check. Keep private signing backups outside this repository.

Coaches normally install the upstream signed APK and configure their institution URL; institutions do not need to compile a custom APK for each server. Independent distributions own their signing key and updates. See [build-path selection](android-release.md#choose-the-right-path), [fresh-checkout builds](android-release.md#fresh-checkout-standalone-build) and [closing beta.1 distribution](android-release.md#close-beta1-distribution).

## Deployment

The People/profile update requires forward migration `202610210100_invitation_sports` before the updated API starts. Existing pending invitations have no sports by default and remain usable. Use the existing paired-backup and Compose deployment process; do not reset/reseed. No native app, signing-key, mail or hosting configuration change is required.

The Android history/recovery update requires the matching updated backend/OpenAPI export; no schema migration is needed for history reads. Recovery copies are user-initiated plain-text shares and are outside encrypted app storage and server retention. Institutions must choose approved recipients/storage and handle deletion of exported copies themselves; do not send athlete recovery records through the public landing contact form.

The multiple-message-attachment update requires migration `202610181200_message_attachments` before running the updated backend. It adds ordered links and backfills existing single-file messages without removing the compatibility column. Restart the backend after migration/client generation; existing file storage and backup procedures are unchanged.

Updated backends include Swagger reference at `/api/v1/docs` on the self-hosted web origin, with JSON at `/api/v1/openapi.json`. Production (`NODE_ENV=production`) disables interactive viewer requests. The viewer uses bundled assets and no external validator; no additional service or Compose definition is needed. Direct backend access uses `/v1/docs`. See the [API guide](../reference/api.md) for local exploration.

The supported deployment foundation is the self-host Docker Compose profile on a Unix server. The [infrastructure guide](../../infrastructure/README.md) is the canonical source for prerequisites, environment setup, TLS, startup, and service health checks. Use the committed example only as a template; set a unique project name and replace every secret before startup.

Optional AWS, Google Cloud and Azure single-VM Terraform starters are documented in the [cloud deployment guide](../../infrastructure/cloud/README.md). They retain the Compose stack and do not provision managed databases, backups or monitoring. They have not been applied to cloud accounts or validated; review provider prerequisites and cost estimates before use.

After configuring `infrastructure/.env.selfhost`, run `bash infrastructure/scripts/deploy.sh` to build and start the stack.

```sh
cp infrastructure/.env.selfhost.example infrastructure/.env.selfhost
# Edit the file with the university's domain, instance name and unique secrets.
docker compose --env-file infrastructure/.env.selfhost -f infrastructure/compose.yaml --profile selfhost up -d --build
```

Inspect service status:

```sh
docker compose --env-file infrastructure/.env.selfhost -f infrastructure/compose.yaml --profile selfhost ps
docker compose --env-file infrastructure/.env.selfhost -f infrastructure/compose.yaml --profile selfhost logs --tail=100 api web caddy
```

Do not expose PostgreSQL publicly. No Google service-account key or hosted-provider credential is part of this runtime.

## Release and configuration

The published, accepted evaluation beta is **Squire 1.0.0-beta.1** across the web/API and optional coach Android app. The [project readiness table](release-checklist.md#project-beta-readiness-19-october-2026) distinguishes evaluation readiness from publication and each installation’s live-data checks. Follow [Android beta builds and updates](android-release.md) for signing, APK packaging and installation/upgrade acceptance. Private signing material is separate from institution server secrets; never include it in Compose images or public release assets.

Build and validate the approved revision before deployment. Apply forward migrations as part of the Compose release flow; never reset or reseed a hosted database. Review the [release checklist](release-checklist.md) and [known release gaps](../known-issues/README.md) before enabling external use.

Store the production env file outside source control with access limited to the university operators. Use unique instance secrets. Rotate secrets through a planned deployment; never paste credentials into issue trackers, logs, commits or check receipts. The self-hosted profile does not need SMTP, Google service-account keys, or hosted-provider credentials. Keep the service on a private network until the first super admin completes setup. Invitees choose their password from a single-use link that expires after seven days; no email is delivered or verified. Operators must share that link privately.

Instance branding (name, accent, light/dark page backgrounds and optional PNG/JPEG/WebP logo) is stored in PostgreSQL and therefore travels with database backups and restores. UI surfaces derive from those colors; text/accent colors adjust for contrast. The first super admin controls these settings; the image is limited to 512 KB. Keep the backup protected as sensitive operational data. Branding is not supplied by environment variables and remains after application image updates. In Institution settings, branding sits alongside general settings on wide screens and stacks below them on phones. Closing an institution requires opening the red action and entering its exact current name in the confirmation dialog; closure ends member access while preserving records.

## Release assets and landing downloads

Use GitHub Releases as the canonical download host. The landing site should display release/version information and link to the matching GitHub source/archive and uploaded assets; do not copy release binaries into the landing repository or Vercel deployment. Use explicit versioned links for beta assets and enable download buttons only when those assets actually exist. See [GitHub release links](https://docs.github.com/en/repositories/releasing-projects-on-github/linking-to-releases).

Label GitHub ZIP/tar.gz downloads **source code**: operators still configure secrets and build/run Compose. They are not prebuilt Docker-image bundles, database backups or an installed application. GitHub-generated archives can change compressed bytes when regenerated; pin the source commit/tag for content provenance and attach a reviewed custom source asset if fixed archive-byte checksums are needed. See [archive stability](https://docs.github.com/en/repositories/working-with-files/using-files/downloading-source-code-archives#stability-of-source-code-archives).

For an accepted Android package, upload the signed APK, its `SHA256SUMS` and non-secret build metadata to the matching GitHub prerelease. Checksum entries must describe the actual uploaded files. Keep the APK's compiled source revision visible; do not describe the published APK as built from the older source tag. Never package the working directory wholesale: signing material, local env files, backups and fixture data are not release assets.

Before publication, merge the reviewed source/docs changes, select the exact release source/tag and ensure the English/Arabic landing guidance names that same version and supported behavior. This documentation update does not publish assets or change tags automatically.

## Backup, recovery and rollback

Android field queues are device-local and are not part of server backups. The app disables automatic Android app-data backup, retains encrypted field commands and score drafts after sign-out, and requires the same account/server to recover it. Loss of app data or its key can lose unsent work. Explicit plain-text recovery sharing is implemented; no automatic import or remote wipe exists. A sign-out can remove local credentials while server revocation is unconfirmed. For device loss, follow institution incident procedures and suspend the account if required. See the [Android recovery guide](../development/android.md).

Use `bash infrastructure/scripts/backup.sh` to create checksummed PostgreSQL and private-file archives under the ignored `infrastructure/backups/` directory. Treat both archives as sensitive identity and health data. Store an encrypted copy on separate university-controlled storage and define a retention schedule.

Restore into a clean, matching Compose instance: start PostgreSQL, apply migrations once, then run `bash infrastructure/scripts/restore.sh infrastructure/.env.selfhost /path/to/backup-directory`. Restore replaces the database and private-file volume. Confirm the target and checksums before proceeding, then validate login and authorized private-file access.

Rollback is not a reverse migration. Take a paired database/file backup before updating. To return to an earlier application revision, restore the matching pre-update database and private-file archive together, then start the earlier revision. The founder accepts the earlier backup/restore verification; the integrated upgrade/rollback rehearsal and production review remain open.

## Beta.2 upgrade and release preparation

**Status, 20 October 2026:** sports and coaching foundation PR #135 is merged and founder-accepted. Squire `1.0.0-beta.2` is being prepared; beta.1 remains the published release until the new tag and artifacts exist. No new mail service or hosting resource is required. The coach field OpenAPI subset retains its independent API version; the new web workflows do not expand the Android field API.

### What changes

- Institution sports and coaching specialties, primary/supporting coaching teams, concurrent goal-specific plans, staff athlete profiles and attributed coach-recorded workouts.
- Supporting coaches stay scoped to linked sport plans/sessions. Overlap warnings intentionally disclose other plans' titles, goals and dates for coordination; they do not grant plan-detail/edit access. Nutrition and participation status remain primary-coach-only, subject to the existing athlete-sharing and consent rules; administrators retain their existing shared-nutrition access.
- Coach-recorded timed/distance sets require actual measurements. Delegated logging is online-only, for the current date, and belongs to the web app, not the native field queue.

### Upgrade an existing Compose instance

Run from the repository root on the Unix host with Docker access and the existing `infrastructure/.env.selfhost`. Arrange a maintenance window and retain the current source revision and environment securely.

1. Before changing source, take a paired backup:

   ```sh
   git rev-parse HEAD
   bash infrastructure/scripts/backup.sh
   ```

   Expected: a backup directory containing PostgreSQL, private files and `SHA256SUMS`. Protect an encrypted copy separately. Server backups do not include unsent Android work.

2. **After beta.2 is published**, select its tag and deploy:

   ```sh
   git fetch origin --tags
   git checkout --detach v1.0.0-beta.2
   bash infrastructure/scripts/deploy.sh
   ```

   Do not run this selection while the tag is still pending. For a review environment, use the explicitly approved full candidate commit instead. Compose runs forward migrations before starting the API. The four new migrations are `202610191200_sports_and_specialties`, `202610191300_coaching_links`, `202610191400_concurrent_plans` and `202610191500_delegated_sessions`. Existing assigned coaches become primary links; existing plans and history are retained. Never reset or reseed an existing instance.

3. Inspect service/migration logs and check sign-in, People/coaching links, an existing plan/history and authorized private-file access. Use synthetic records to inspect concurrent assignment and measured coach logging. Fresh installations remain unseeded and use first-run setup.
4. If recovery is needed, stop writes and restore the pre-update database **and** files with the earlier application revision, using the existing recovery procedure above. Reverting code alone does not reverse these migrations. Institution-specific upgrade/rollback rehearsal remains the operator's responsibility.

### Finish publication

- [ ] Merge the reviewable release-metadata PR and confirm required CI on the exact final `main` commit. Do not move the beta.1 tag.
- [ ] Build the signed beta.2 APK from that clean commit with `npm run mobile:release`, using the existing key, package ID and versionCode `1000002`. Keep `build.json`, APK and `SHA256SUMS` together. Do not relabel the beta.1 APK as beta.2.
- [ ] Check the actual in-place beta.1 → beta.2 update with synthetic pending work before claiming upgrade preservation. Keep beta.1's accepted phone evidence; no repeat beta.1 qualification is required.
- [ ] Create an annotated `v1.0.0-beta.2` tag on the approved release commit and publish a GitHub **prerelease** with release notes, signed Android bundle/checksums/build metadata and the source archives. Record compiled revision and verify uploaded bytes. Never publish signing files.
- [ ] Merge the paired English/Arabic landing release/status/upgrade PR, using GitHub Release links. State any artifact still pending honestly; do not send users to a nonexistent beta.2 download.
- [ ] Update the [Rafik GitHub Project](https://github.com/users/KenseiEmam/projects/3) with linked application/landing PRs and publication evidence; close release preparation only after publication is confirmed. Later email work and field-dashboard scope stay separate.

## Retention operations

The API performs a retention pass at startup and daily after success; a failure retries after 15 minutes. The deployment-wide checkpoint contains only completion time and aggregate closed/purged counts. Alert if it is missing after startup or older than 48 hours:

```sql
SELECT completed_at, now() - completed_at AS age, closed_count, purged_count
FROM public.institution_injury_retention_checkpoint
WHERE singleton;
```

An isolated Docker database/API outage-and-restart rehearsal passed on 17 October 2026. Actual monitoring alert delivery remains unverified. Do not use real athlete data until university privacy/security review and consent/retention approval are complete.

## Local development and verification

Use [development setup](../development/README.md) for local PostgreSQL, API, web and sample-account access. Use [testing](../testing/README.md) for focused commands and prerequisites, and [verification](../verification/README.md) for checks actually performed and their limits.

### Beta.2 candidate member-management migration

The web refinements in PR #138 additionally require `202610210100_invitation_sports`. Run the normal forward-migration deployment after the database/private-file backup. Existing invitations gain an empty sport list; new role-compatible choices are applied on acceptance. Keep the signed APK compiled-source checksum separate from later web-only source commits; no mobile behavior changed in these refinements.

### Beta.2 final package

The final launcher/tooling fixes are in release-preparation PR #140, based on the merged design audit. The rebuilt signed bundle, exact source and checksums are in the [Android release guide](android-release.md#beta2-upload-bundle--22-october-2026). Use that new ZIP rather than the earlier unpublished beta.2 build. Founder handles upload and prerelease creation; actual publication/upgrade evidence remains separate.

### GitHub organization repository

Application source, release tags/assets and cloud-template clone defaults use `https://github.com/Rafik-Athlete-Managment/Rafik-OpenSource`. Existing checkouts can update their remote with `git remote set-url origin https://github.com/Rafik-Athlete-Managment/Rafik-OpenSource.git` from the repository root. Published versions and uploaded bytes are unchanged by this repository transfer. Landing is maintained separately under KenseiEmam.

Local recovery and orphan cleanup share the API’s validated local database/private-file target. Ordinary commands keep the local preview defaults; isolated tests use matched disposable targets and retain recovery backups only within their own temporary directory.

## Unreleased backend cleanup migration

Normal forward migration removes unused runtime simulation settings and two billing simulator functions, preserving historical business accounts/events. Back up before upgrading. The audit migrated only owned disposable databases; it did not reset preview. See the [backend audit](../reference/backend/README.md).

## Institution identifier upgrade

Stop the existing backend and operator workers for the upgrade. Deploy the complete matching backend/web version, applying migration `202610231800_institution_identifiers`, before installing the forthcoming Android APK. Back up the database and private bytes first. The DDL renames existing records; it does not reset the installation. Migration `202610232000_remove_retired_domains` then deletes the retired personal/team/business storage and removes published-client aliases. Deploy the matching new Android client; beta.2 clients are unsupported. Retired records are recoverable only from the pre-upgrade backup. Institutional IDs, history, queued payloads and byte keys are preserved. Keep the same signing key, SQLCipher database, private files and installation URL. Do not run old application binaries against the renamed database. Roll back using the complete matching pre-upgrade database/application backup, not just an old container. See [ADR 0029](../decisions/ADR-0029-institution-identifiers.md).

Athlete-plan adaptation adds a nullable assignment snapshot through migration `202610261900_athlete_plan_adaptation`. Apply the forward migration before starting the matching backend/web. Current source versions and assignment IDs are retained; existing plan policies and materialized work are not rewritten. Use matching backups for rollback rather than dropping the column after personalized plans exist. Local development applies pending migrations with `npm run backend:start`; this development change does not reset preview data.
