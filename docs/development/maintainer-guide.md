# Maintainer guide

## Dependency security backports

Root `scripts/tooling-security.mjs` applies/checks exact-version patches from its adjacent manifest. Root postinstall, Metro/build entry checks and CI keep the currently used Expo call paths patched. Run `npm run test:tooling-security` after a patch/dependency change; preserve original/patched hashes and review both module formats. Dockerfiles copy the installer before scoped installation. Revisit/remove patches when compatible upstream fixes are available; do not suppress version-based audit alerts. See [ADR 0035](../decisions/ADR-0035-expo-tooling-security-backports.md) for limits and provenance.

## Workout screen layout

WorkoutExerciseCard is the single exercise authoring surface for Programs, WorkoutFields/template editing and group-participant adaptation. Keep existing owner actions and durable drafts/receipts; do not reintroduce a second exercise form in PlanEditor. ExerciseMediaPreview supplies the shared credited modal and compact name-row thumbnail. Full media stays behind the explicit action; private uploads continue through ResourceAsset. Keep thumbnail placement aligned with the exercise name in WorkoutPreview as well as the editable card. Alternatives remain at most three distinct, active, same-type choices; the backend snapshot validator remains authoritative.

People is the directory spacing reference: role/status tabs form a separate row above the search/filter/pagination toolbar. Programs is the authoring reference: keep full-width Add exercise, place its first-use action inside the shared empty card and use editor-footer for save/cancel. New workout components own their grid/label spacing; inherited form margins must not double the token gaps. Reuse WorkoutFields and WorkoutPreview in participant adaptation rather than introducing another prescription form.

## Workout templates and group results

Use `WorkoutFields`, `WorkoutPreview` and `WorkoutTemplatePicker` for single-workout authoring/reuse. `server/workout-templates.ts` reuses program snapshot validation; `server/group-workouts.ts` reuses calendar authority and the existing session recorder/history. Preserve baseline and participant prescription immutability, authority-before-receipt checks and assignment-independent progression. Focused checks from the root: `npm run test:group-workouts`; populated upgrade: `node apps/backend/scripts/prisma/verify-group-workouts.mjs`; browser: `npm run test:e2e --workspace @rafik/frontend -- group-workouts.e2e.ts`. These Docker-backed commands create/remove disposable data; never reseed preview. The single [instance walkthrough](../testing/instance-validation.md) owns manual steps. Native offline workout capture remains the next slice.

Use `lib/display-time.ts` for viewer-facing timestamp labels and the reactive account timezone. Keep `lib/dates.ts` pure for date/instant conversion tests. A date-only value is a calendar date, not an instant: do not convert it to the viewer's zone. Keep booking inputs and recurrence previews in their explicitly selected zone, and retain source event zones for eligibility. Clock and display-preference changes must not alter command payloads or scheduling authority.

Calendar creation choices live in EventComposer. Plan workouts reuse WorkoutAgenda's planning queue and scheduling commands; keep eligibility, cursor/revision checks and allocation on the existing backend. Custom events and assessments retain their own durable calendar command/draft scope. Avoid adding a second workout form or creating a named attendance event when scheduling an assigned workout. The canonical instance walkthrough covers founder validation; group prescriptions/results and native recording remain separate slices.

## Assigned-plan details and adaptation

`AssignedPlanPage.vue` owns `/training/:assignment`; AthletePlans owns only the directory. Keep directory query state on its detail/back links. PlanEditor accepts an assigned snapshot for embedded adaptation, with a separate assignment/version draft key. Do not fork a second prescription editor or load the current mutable program draft as the assigned baseline. Publishing and assigning/replacing remain separate operations. Use `danger-action` for red cancellation/removal controls and `danger-button` for destructive primary buttons; do not infer danger styling from visible text at runtime.

## Individual workout web integration

Use `WorkoutAgenda.vue` for dashboard discovery and assignment scheduling. Derive sequence state from the scheduling GET projection; do not reintroduce client-side plan-day eligibility algorithms. The same occurrence identity must reach session start. Preserve existing device drafts and uncertain commands, and guard delayed navigation after acknowledgment. Focused API coverage runs with `npm run test:workout-sequence`; the delegated-workout browser spec exercises the web integration through the isolated-browser wrapper. Neither check establishes Android or automatic recurrence acceptance.

From the repository root, the focused rendered command is `node apps/frontend/scripts/isolated-browser.mjs delegated-sessions.e2e.ts --project=chromium --project=webkit-phone --max-failures=1`. It requires the local Docker database and uses a separate migrated database/API/production preview, leaving user preview data intact. Tests that bind occurrences must remove their own sequence/recurrence rows before their own institution; do not weaken production foreign keys for fixture cleanup.

## Founder validation corrections

CoachDesk owns the trainer overview composition. WorkoutAgenda uses server-filtered actionable and planning queues before pagination; recording/today remain narrower API reads. Keep their durable command keys distinct and retain recovery for the former due-dashboard key. UpcomingSessions can show today-only non-workout events to avoid duplicate individual-workout actions. Participation preview uses the existing audited limited-status API; primary-roster coverage and unknown status must stay explicit. Do not broaden health/follow-up authorization to fill a UI region.

Shared status colors belong in `styles/design-system.css` and are selected by explicit `data-status` values. Do not inspect localized text to choose colors. Keep routine success in toasts; CommandStatus owns pending/error recovery only. Generated invitation/reset links are actionable results, not disposable success notices. Dashboard workout discovery and follow-up are composed in FollowUpPanel using WorkoutAgenda, with no second staff agenda. Coach check buttons reuse athlete recording visuals while retaining server validation and exact receipts.

Update the [canonical instance validation walkthrough](../testing/instance-validation.md) whenever implemented workflows change. It is the single source of truth for manual role checks; link to the affected section from founder handoffs and landing instead of creating another walkthrough. Published guidance must use the matching release tag; unreleased guidance must be labelled. Contact discovery belongs to communication, not the people directory. Supporting-coach sport/specialty is a permission boundary, even though the coach picker no longer requires a sport filter first. Keep current immutable reference exercise IDs and source/media attribution when curating the library. Extend shared workout progression and event command services for later scheduling/attendance work.

## Progression service workflow

Run `npm run test:workout-sequence` from the root with local Docker available. It starts its own migrated/seeded database and API, exercises sequence concurrency and the full bind/start/save/skip/end journey, then removes only its own database/files. `workout-sequence.ts` is the transactional domain service; `programming.ts` supplies existing authority/receipts. Extend these shared paths rather than adding another worker or native write implementation. Keep exact receipt responses and native attendance commands unchanged.

## Workout migration development

Run `npm run test:workout-foundation` from the repository root with the local Docker database available. The script creates a disposable database, applies prior migrations, adds synthetic historical records, runs the new migration and checks preservation/constraints. It generates the Prisma client from the maintained schema and shared transport types from the disposable database. Review generated diffs. It never resets preview data. The assignment cursor starts at zero: do not infer historical progression or enable the worker before the coordinated domain-service cutover.

## Next-release route conventions

Use flat browser URLs and `app/institution.ts` for current institution/role. Keep `/settings` personal and `/institution-settings` administrative. Keep durable draft keys institution/role-scoped even though URLs are flat. Never infer authority from an old URL role. Tasks is removed; useful overview follow-up lives in `organization-follow-up.ts`. API `/v1/institution` names and native scope identifiers remain compatible. See [ADR 0026](../decisions/ADR-0026-single-institution-routing-and-task-retirement.md).

The canonical application repository is [Rafik-Athlete-Managment/Rafik-OpenSource](https://github.com/Rafik-Athlete-Managment/Rafik-OpenSource). Clone/fetch and open application issues, PRs and releases there. The landing repository and existing GitHub Project remain under KenseiEmam until the founder directs otherwise.

Member management lives in `MemberManagement.vue`: keep identity first, coaching next, and sports/account recovery at the bottom. Institution settings use two responsive columns for general settings and branding. The closure dialog is a confirmation step; server revision and exact-name checks remain authoritative. Development file watching excludes generated test artifacts so browser traces cannot trigger reloads or locked-file crashes.

This guide is for current work in the Rafik monorepo. It stays focused on the maintained codebase; old phase-by-phase notes are in the [archive](../archive/README.md).

Beta.1 is accepted and published, including Android. Keep current release status at the top of the checklist and verification record; preserve dated evidence as history. Do not turn disclosed device-coverage limits or per-institution live-data checks into new beta.1 publishing gates. Apply public status corrections to English and Arabic landing docs together, and inspect open next-release PRs before editing shared guidance.

Android release packaging uses `apps/mobile/scripts/release.mjs`, `android-release.gradle` and maintained release manifest/network configuration. Signing files under `apps/mobile/.signing/` are private, ignored and required for future updates. Generated `android/` files are disposable. Follow [Android release operations](../operations/android-release.md); never distribute a debug-signed APK or uninstall a user's development app to bypass a signature mismatch.

Keep the [build-path guidance](../operations/android-release.md#choose-the-right-path) discoverable from root/mobile READMEs and landing EN/AR: official installation for coaches, Metro-backed native builds for contributors, standalone signing for release maintainers or independent distributions. The [beta.1 distribution close-out](../operations/android-release.md#close-beta1-distribution) preserves the published tag and identifies the later accepted APK by its actual build revision. Check open PRs before updating shared release pages.

Android Metro startup must explicitly target the installed native build: the mobile workspace uses `expo start --dev-client`. Do not switch the shared start script to Expo Go; SQLCipher requires the native build. See the [Android guide](android.md).

`InstitutionScreen.tsx` opens saved event packages locally and refreshes the startup schedule with a separate busy state; **Refresh roster** explicitly downloads newer data. Keep schedule responses from replacing open event feedback. `access.ts` preserves a saved workspace selection but falls back from a removed empty workspace. Refresh retained workspace IDs after the access read so downloads completed during that read are included in revocation blocking. Mobile transport is in `apps/mobile/src/field/request.ts`. `NativeClient` notifies its current runtime after successful authenticated responses; `SignedIn` rechecks previously failed access in the background, without unmounting roster/draft UI. Do not clear access warnings merely because a queue is empty or a timer fired. Test transport and callback behavior with `npm run test:request --workspace @rafik/mobile`; native rendering remains a separate check. The [release guide](../operations/android-release.md) includes encrypted signing backup and USB-only physical-phone acceptance.

Documentation checks are maintained in `apps/backend/scripts/check-docs.mjs` with `documentation-links.mjs` and two fixture-based regression cases. Root `npm run docs:check` includes infrastructure guides and relative heading links. Keep the [release checklist](../operations/release-checklist.md) as the beta decision/operator checklist, requirements as scope and verification as dated evidence. Do not treat unchecked per-installation items as missing implementations, or a founder-accepted backlog item as a passed technical test.

People uses `DashboardPage.vue` for role tabs and the shared profile route for detail tabs. `MemberManagement.vue` owns administrator edits, with per-member durable command keys. `people.ts` owns scoped profile reads and labelled staff activity; never expose staff analytics by trusting a frontend tab. Invitation sports require migration `202610210100_invitation_sports` and Prisma/type regeneration. Keep sport choices in invitation drafts; switching to administrator clears them.

Beta.2 preparation follows merged PR #135. Keep application/shared versions and the root lockfile aligned, use Android versionCode `1000002` with the existing signing key, and build only from the clean final approved release commit. Follow the [beta.2 upgrade and publication checklist](../operations/README.md#beta2-upgrade-and-release-preparation). Track the application and landing PRs in the [Rafik project](https://github.com/users/KenseiEmam/projects/3); do not mark publication complete from a green feature PR alone.

## Read these first

- [Requirements and stage gates](../requirements/README.md) define approved product direction and what is not accepted yet.
- [Architecture](../architecture/README.md) describes the current system and data boundaries.
- [Implementation ledger](./ledger.md) records the active stage and recent decisions.
- [Development guide](README.md) covers local setup and common workflows.
- [Operations guide](../operations/README.md) covers self-hosting, secrets, backups and recovery.
- [Verification summary](../verification/README.md) records checks actually run and their limits.

## Repository map

### GitHub checks and dependency maintenance

`.github/workflows/check.yml` runs on pull requests and main pushes, cancelling superseded runs. Web checks use the isolated, empty-database onboarding journey rather than the retired marketing sample. Backend setup fails fast; after API health succeeds, independent domain suites continue to report their own failures without hiding later results. The job still fails if any suite fails. Backend checks retain authorization and current institution workflows; package-entitlement tests are retired. Local browser runs clean their output; failed CI runs retain diagnostics for artifact upload while still removing disposable database/files and stopping their services.

`apps/frontend/tests/native-lockfile.test.ts` checks native optional-package versions using Node's ancestor resolution, including nested/hoisted bindings. Keep the root lockfile portable when installing on Windows; do not discard Linux/macOS metadata. The Xcode-only UUID override preserves its CommonJS `v4` usage without changing Expo/React Native versions.

Run `npm audit --offline=false` with actual network access and inspect its exit status. Offline npm can return an empty vulnerability report; it does not establish a clean dependency tree. Keep online reports and unresolved upstream findings in verification/known issues. Do not use `npm audit fix --force` to downgrade the mobile framework.

`npm run mobile:acceptance` runs `apps/mobile/scripts/acceptance.mjs` on Node 24. It creates only a uniquely named disposable database/API on 55341, deploys migrations and runs `apps/backend/tests/field-acceptance.test.ts`. The shared fixture honors `RAFIK_TEST_API`; the field test refuses non-disposable database/API targets. Default mode cleans up automatically. `--device` retains synthetic fixtures until `done` on stdin or Ctrl+C in an interactive terminal; never interrupt a normal preview for these checks.

Android `EventHistory.tsx` uses calendar `historyOnly` reads and the shared `FieldHistoryPage` contract. `RecoveryPanel.tsx` compares a fresh roster in memory and shares durable unresolved work through React Native Share; it never replaces the local roster. Keep owner scoping, no-credential projection, explicit plain-text confirmation, in-flight guards and share-size rejection/individual fallback intact.

`Language.tsx` owns persisted device locale; `translations.ts` includes English-key mappings for old persisted errors. `LanguageControl.tsx` changes language without remounting field editors. `ui.tsx` sets locale direction and Android paragraph-start alignment. Keep English/Arabic labels and dynamic validation paired; preserve LTR URL/email controls and Arabic numeral normalization. Do not apply browser CSS alignment assumptions to React Native Android.

`ScheduledEvents.vue` serves staff `/events`, linked from navigation, Calendar and Session history. `scheduledEvents` in `calendar.ts` returns 24 rows with full totals and optional title/kind/state filters; preserve designated-staff authorization. The existing calendar endpoint and mobile OpenAPI contract are unchanged. Android completion/start-time presentation lives in `InstitutionScreen.tsx` and semantic completed-card styles in `ui.tsx`; preserve timer cleanup, read-only completed state and server acknowledgement boundaries.

Staff `/training` dispatches through `TrainingRoute.vue` to `AthletePlans.vue`; athlete training retains `AthleteTraining.vue`. `/session-history` uses `SessionHistory.vue` and the existing delivery history API. `NutritionRoute.vue` shows `NutritionPlans.vue` until a subject is selected, then keys the existing editor by subject/version. Keep list pagination, optional subject filters, stale-response guards and server authorization together. New server reads live in `athlete-plans.ts` and `nutrition-plan-index.ts`; no schema migration is needed. Restart the API when adding these routes.

Assessment-template links in `EventComposer.vue` open `ServiceCatalog.vue` in a new tab. Preserve saved drafts, the account/institution/event-scoped return message, authorized re-fetch and manual refresh fallback. Do not overwrite an event draft when refreshing templates.

Android native startup is consolidated in `apps/mobile/scripts/android.mjs`, called by both root `mobile:android` and the mobile workspace's `android` script. Its Windows Gradle configuration is maintained in `apps/mobile/scripts/android-build.gradle` and applied to generated Android output on startup. Keep Ninja preflight, per-checkout temporary CMake staging, object-path hashing and compilation/Gradle worker limits documented in the [Android guide](android.md#windows-laptop-startup-and-rebuilds). Do not edit generated native files as the lasting fix.

Institution message composition lives in `apps/frontend/src/features/institution/ChannelThread.vue`. Its pending-attachment section uses `ResourceAsset.vue`; `ResourceUpload.vue` has an optional composer mode with photo/file icon pickers. Other upload consumers retain their existing labeled controls. Keep acknowledged-send cleanup ordered after draft writes, and preserve attachments on failed/uncertain sends.

Multiple message attachments use ordered `institution_message_assets` links, migrated from legacy `asset_id` by `202610181200_message_attachments`. Keep communication command/read handling, byte-read authorization and account export aligned. The web composer restores both the current `attachments` draft array and old single-file drafts. Batch upload failures retain earlier successful selections and the uncertain upload ID for safe retry; message send remains one atomic operation.

`apps/backend/server/api-docs.ts` serves the canonical OpenAPI file and local Swagger assets, including proxy-prefix handling and production reference-only behavior. Use `npm run test:api-docs --workspace @rafik/backend` for isolated HTTP/initializer checks without a database. Keep the [API guide](../reference/api.md) and bilingual landing explanations aligned when changing this workflow.

| Path                          | Use                                                                                                                                      |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/frontend/src/features/` | Vue feature screens and task-specific components. Keep features small and follow the existing domain boundaries.                         |
| `apps/frontend/src/app/`      | Routing and application-level composition.                                                                                               |
| `apps/backend/server/`        | HTTP routes and server-owned domain authorization, reads and commands.                                                                   |
| `apps/backend/openapi.json`   | Versioned OpenAPI subset for coach field endpoints; served at `/v1/openapi.json` for Swagger-compatible tooling.                         |
| `apps/mobile/`                | Expo/React Native Android workspace for the coach field app.                                                                             |
| `apps/backend/prisma/`        | Prisma schema and append-only SQL migrations. SQL remains authoritative for database constraints and functions Prisma cannot represent.  |
| `apps/backend/content/`       | Canonical imported data and media manifests. Preserve pinned source, license, attribution and hashes.                                    |
| `packages/shared/`            | Shared API contracts and generated database transport types.                                                                             |
| `infrastructure/compose.yaml` | The sole local/self-host Compose definition.                                                                                             |
| `infrastructure/scripts/`     | Unix deployment, backup and restore helpers used by Compose operators.                                                                   |
| `infrastructure/cloud/`       | Per-provider Terraform starters that prepare the existing Compose stack on one VM; not cloud-verified.                                   |
| `docs/`                       | Current product, engineering and operational documentation. Raw verification receipts are separated under `docs/verification/receipts/`. |

Sports and coaching specialties are served by `apps/backend/server/sports.ts` from migration `202610191200_sports_and_specialties`. The case-insensitive unique name index exists only in SQL. Admins manage them in `SportsSettings.vue` (Institution settings) and link people in `MemberSports.vue` (People manage panel). `people.ts` returns member `sports` and the `sport` filter. Run `npm run test:organization-sports` against a disposable migrated database.

**Coaching team ([ADR 0025](../decisions/ADR-0025-coaching-team.md)):**

- **Where it lives:** `apps/backend/server/coaching-links.ts`, `coachedBy()` and the `recipient(…, scope)` argument in `programming.ts`, and migration `202610191300_coaching_links`, which holds the table, backfill and sync trigger.
- **Choosing a scope:** when a new path checks a coach's access, choose the scope deliberately. The default is primary. Only plans, sessions, assessments, program media, and scheduling, groups and messaging use `training`.
- **SQL filters:** raw SQL that filters `trainer_id = self` means the primary coach. Add the active-link `EXISTS` only for training-scope reads.
- **Web:** `CoachingTeam.vue` manages supporting coaches in the People manage panel.
- **Concurrent plans (1c):** `deliveryCommand` in `programming.ts` handles assign (add or explicit `replaces`) and `end`.
  - `planAuthority()` enforces sport-labelled writes for supporting coaches.
  - `assignmentScope()` and `sessionScope()` narrow their reads. Apply them to any new plan or session read.
  - Migration `202610191400_concurrent_plans` replaced the one-active-plan index with one active plan per version.
  - In the web app, `DeliverPlan.vue` offers add or replace per athlete; `WorkoutAgenda.vue` presents active workout progression; `AthletePlans.vue` opens `AssignedPlanPage.vue` for ending or directly adapting one athlete plan.
  - Run `npm run test:concurrent-plans`.
- **Delegated logging (1e):** delegated start and save checks are in `sessionCommand` (`delegate()`); history reads are in `organizationSessionHistory()`; migration `202610191500_delegated_sessions`.
  - Coaches record on `DelegatedWorkout.vue` (`/record/new?assignment=…`, then `/record/:session`). Athletes see a banner on `WorkoutPage.vue`.
  - Both screens take set measurements (fields, limits, positive-result rule) from `apps/frontend/src/lib/set-measures.ts`. Change them there, not per screen. On the coach form, timed and distance sets require a typed actual value; the prescription is only a placeholder.
  - The start command navigates only if the screen is still mounted and its route is unchanged. The write is kept either way.
  - After a command succeeds, navigate only once `run()` has settled. The page remounts on route changes, and navigating inside the completion callback let the new instance adopt the old saved command and lock the form.
  - Run `npm run test:delegated-sessions`.
- **Athlete profile (1d):** `AthleteProfile.vue` composes existing reads with `feedback: 'none'`, and each section shows its own refused or error state. Its section visibility is a convenience only, so never add a profile-only endpoint that widens access. Entry points: the **Profile** link on People cards and **Athlete profile** in the athlete-plan detail.
- **Tests:** `npm run test:coaching-team` covers the access matrix and lifecycle. `npm run test:fresh` checks the trigger, the backfill and the mirror in a rolled-back transaction.

Instance branding is managed by `apps/frontend/src/features/institution/BrandingSettings.vue`, applied in `apps/frontend/src/App.vue`, and served by `apps/backend/server/instance-branding.ts`. The initial setup claims the single-instance branding owner; the forward migration is `apps/backend/prisma/migrations/202610171500_instance_branding/`. Keep the raster signature/size checks, super-admin scope, public image response headers and database backup behavior aligned when changing it. The supported palette is accent plus light/dark page backgrounds; surfaces derive from those colors and text/accent contrast is adjusted in `apps/frontend/src/lib/branding.ts`.

Generated frontend sample/catalog files are outputs of backend content sources. Edit the canonical source, run its generator, and verify the generated output; do not hand-edit generated files.

The Android attendance slice lives in `apps/mobile/src/field/`: `native.ts` binds transport/credentials and SQLCipher initialization, `store.ts` serializes local transactions, `sync.ts` replays exact commands, and the React Native screens present schedule/roster/recovery. `ScoreEditor.tsx` persists raw score drafts, displays server-defined units/limits and queues results; completion is a separate operation after acknowledgment. Preserve the attendance-only cache format when adding assessment fields. Minimal transport shapes are shared through `packages/shared/src/contracts.ts`. Use the [Android guide](android.md) for commands and lifecycle details. Do not merge typed input, device acknowledgment and server acknowledgment, and never replace a roster while its commands are unresolved. Queue tests use Node SQLite rather than Android encryption; keep that evidence boundary explicit.

## Implement a user workflow

Before coding, write down the actor, organization or independent context, resource, and lifecycle action. Trace both allowed and denied API access. Then follow the existing feature module and API contract rather than creating another store, business-rule copy, or generic framework.

Complete the user task through success, interruption, retry, correction and review/history. Keep local drafts, dispatched requests and acknowledged server state distinct. Recheck authority at command time and before replay; stale tabs and revoked membership must not preserve access. Derive navigation from server capabilities, but enforce security in the API/database.

Messaging changes must keep direct conversations unique for an institution and participant pair, and group shortcuts must reopen their linked channel. Password creation rules belong in the shared package and server validation; keep login compatible with existing credentials. Published programs are institution-library items; assignment authority still limits coaches to their currently assigned athletes.

For visual changes, preserve the accepted design identity and inspect the rendered task states the change affects. Cover relevant empty, populated and error states, keyboard access, English/Arabic, themes and phone/desktop layouts. Reuse recent evidence for unaffected browsers; run full browser suites serially only when the changed behavior warrants them.

The signed-in shell and role-specific route handling are composed in `apps/frontend/src/App.vue` and `apps/frontend/src/app/router.ts`; collapsible role navigation is in `apps/frontend/src/features/navigation/DashboardNav.vue`. Each institutional membership has one role and one matching dashboard. Institution member administration lives in the organization People view and remains server-authorized. The forward migration that normalizes legacy role arrays is in `apps/backend/prisma/migrations/202610171100_single_membership_roles/`.

## Change data or API behavior

1. Update the Prisma schema and add a forward SQL migration. Do not reset or reseed a database to apply a migration.
2. Preserve tenant and subject ownership constraints, transaction boundaries, revision checks, idempotent replay and authorization-before-replay behavior.
3. Regenerate Prisma and shared database types using root workspace scripts. Keep API contracts in `packages/shared/` when both app institutions consume them.
4. Add focused regression coverage for consequential failure or authorization paths. Never rely on sample-account pollution or fixtures from an earlier test.
5. Update the architecture page for data/API/lifecycle changes and the runbook for operational changes.

## Change canonical content or media

Keep source URL/revision, content digest, per-field license and attribution with the manifest. Review media-byte rights separately from software and dataset-text licenses. Preserve immutable published references; never imply a static frame sequence is continuous motion. Use the [content guide](../reference/content-maintenance.md) for generation and provenance.

## Local development

Use one root `npm ci`. Start the local PostgreSQL Compose profile and apply migrations with `npm run backend:start`; seed only a new, empty local database. Use `npm run web-env`, then start `npm run start:api` and `npm run dev` in separate terminals. The [development guide](README.md) has the complete local setup and sample-account access; [operations](../operations/README.md) covers recovery and self-hosting. Never use local preview identities or synthetic credentials in a hosted deployment.

## Focused verification and cleanup

For visual standardization, read the approved [design system](../DESIGN_SYSTEM.md) and [audit plan](../known-issues/ui-ux-audit.md) first. The founder approved the current slice plan on 21 October; preserve the agreed boundaries. The opt-in `ui-audit.e2e.ts` collector records observations and screenshots using disposable data; it deliberately does not assert that an existing design is defect-free. Use [the testing procedure](../testing/README.md#opt-in-web-design-audit), inspect actual images, and label source-only and unverified states honestly.

- Run the smallest relevant check for the changed behavior; do not rerun unrelated suites or a full browser matrix by default.
- Run typecheck/build for the workspace whose compilation or generated output changed. Run documentation-link checks after moving or adding docs.
- Run browser acceptance when rendered behavior changes; use the local isolation wrapper and do not reset or reseed the preserved preview.
- Record the exact commands, result and limits in [verification](../verification/README.md). Persist sanitized receipts under `docs/verification/receipts/`; never store credentials, user messages or unreviewed screenshots there.
- Remove only test reports/artifacts created by the current run. Preserve unrelated local data and ignored user artifacts.
- Update root `CHANGELOG.md` and the [ledger](./ledger.md) for every change. Update the affected README and this guide when setup or file workflows change.

## Scope boundaries

The approved product is university-first. Session packages, prepaid allowances, package renewals and no-show session deductions are retired gym features; do not add them back to active UI, API, analytics or schema. Calendar, attendance, assessor-led performance records and independent makeup scheduling remain separate from commercial entitlements.

Do not claim production readiness, privacy compliance, human usability or physical-device behavior from local checks. Stage acceptance and remaining external review are recorded in the requirements and verification summary.

## Directory pagination convention

Use `ListPagination.vue` for page-based directories. Place it in `.list-controls` beside role tabs or the section heading, with flex-end alignment; stack on phones. Show the record range and current/total pages, disable unavailable actions, and preserve applied offsets until new data arrives. Numeric ranges remain LTR inside Arabic controls. People, nutrition, session history, events and groups/templates use 10 rows. Institution program and assigned-plan grids and the exercise grid use 24; the retired independent program list retains 12. Main directories replace rows when changing pages rather than appending. Member pickers retain incremental loading (25 by default), and conversation/assessment timelines keep their intentional earlier-history controls. Do not paginate message threads as record directories.

`people?limit=10` opts the directory into ten rows; existing picker requests retain 25. Services use `limit=10` similarly so event pickers retain their existing response size. Session history adds a scoped total and offset paging, while retaining cursor compatibility for existing clients.

## Shared web presentation

Use the approved [design system](../DESIGN_SYSTEM.md). `src/styles/design-system.css` defines shared presentation tokens after the existing theme/shell styles. Use `SectionHeader.vue` for a title and short description, `PasswordField.vue` for password inputs, and `ListPagination.vue` for record directories. Keep native input attributes and submission behavior intact. The audit report distinguishes implemented patterns from remaining migrations.

### Workspace presentation and editor routes

Use `PageHeading.vue` for operational page titles, `SectionHeader.vue` for grouped section copy, `EmptyState.vue` for list emptiness and `FileDropzone.vue` for standalone uploads. Reka tab lists use the shared `ui-tabs` skin. Keep existing field and upload validation in their owners. Main directory page-size state uses `useListPageSize`; call `acceptLimit` only after installing the matching response, and retain `limit` in filter navigation.

Entity editors use `/:editor` (`new` or an existing ID) beneath templates, groups and exercises. The main router remounts on path changes. Keep draft keys record-scoped through `loadEditorDraft`; do not restore one entity’s work into another. Save navigation waits for command settlement and checks the original mounted route. The command helper tracks active dispatches by account and scope so a remount cannot offer replay before the original finishes.

### Android launcher assets

Density-specific launcher PNGs are maintained under `apps/mobile/assets/android-icons/` and installed by `apps/mobile/scripts/android.mjs` during preparation. Keep app.json’s icon reference and those assets together. Generated native resources alone are not durable source.

The single-institution migration regression lives in `apps/backend/scripts/prisma/verify-institution-cleanup.mjs`. Backend integration scripts use `scripts/prisma/isolated-api.mjs`; legacy scope fixtures use privileged test setup rather than the removed institution creation API. Demo seeding removes the historical second institution; isolated security fixtures retain their own multi-scope data.

Local recovery/orphan cleanup resolve the same database and file directory through `scripts/prisma/local-storage-target.mjs`. Test database/file stamps must match; malformed or mixed preview/test targets fail before reading or deleting files. Operator defaults remain the local `rafik` database and `.local/files`.

Frontend naming is consistent across feature folders: supported components use plain names: ResourcesPage, NutritionPage, ResourceAsset and ResourceUpload; obsolete standalone variants are removed. Navigation styles use `styles/navigation.css`; nutrition styles use `institution-nutrition.css`. Lowercase wire/schema/storage identifiers retain their compatible names.

The supported web entrypoint must reach every checked-in Vue component. `tests/view-consolidation.test.ts` guards that tree and the required Resources/Nutrition routes. Legacy account-data export/deletion remains for stored-data compatibility; it does not expose a legacy view.

## Frontend inventory and route audit

The [frontend reference](../reference/frontend/README.md) inventories every local Vue file and route. Run `npm run frontend:inventory` after a route/component change, review the diff, and run `npm run frontend:inventory:check`. Update the script-side purpose/access metadata and reviewed dynamic navigation in the same PR. `DashboardNav.vue` is the single institutional navigation component for both sidebar and phone drawer; `section-path.ts` associates detail/edit routes with their parent sections. Do not restore per-page hidden navigation or guest acquisition/recording screens. Token, recovery, compatibility and DEV-only entries have explicit classifications in the reference.

## Backend inventory maintenance

Run `npm run backend:inventory` and `npm run backend:inventory:check` after route/schema changes. After migrations, use `npm run backend:inventory:database` with Docker to capture an owned disposable schema and generate matching types. Update reviewed metadata. Never restore a retired endpoint for an obsolete fixture. See [backend reference](../reference/backend/README.md).

## Institution naming boundary

Use `institution_id` and canonical `/v1/institution` routes in maintained code. `server/institution.ts` owns authority; `server/institution-compatibility.ts` alone translates retired API names. Preserve historical file paths, event/source keys, frozen JSON, receipt payloads/results and browser/native owner identities. See [ADR 0029](../decisions/ADR-0029-institution-identifiers.md).

## Breaking retirement in beta.3

Use explicit `/v1/account/profile`, `/v1/account/export`, `/v1/account/deletion` and `/v1/support` services. Generic command/query/file gateways and published workspace/organization aliases are removed. Reference exercise metadata is `reference_exercises`; custom exercises and athlete assignments remain institutional. Current fixtures seed institution examples directly, with no personal plans/teams/business simulation. Run `npm run test:retired-domains` for populated deletion/preservation and `npm run test:institution-api` for canonical lifecycle/removed-route checks. Historical migration files stay immutable; see ADR 0030 and the coordinated upgrade warning in operations.

Run delegated-session and seeded workout-sequence API suites through separate isolated-api invocations. The delegated single-institution fixture removes the seed institution and cannot share its database with the sequence seed fixture. This is fixture isolation, not a reason to reset preview data.

### Dashboard queue synchronization

CoachDesk uses `actionable` (due plus unfinished) and `planning`, with server identity echoed in `WorkoutAgenda.queue`. Narrower recording/today reads remain supported but are not additional desk lists. WorkoutAgenda emits changed only after acknowledgment and its refresh; the parent changes the sibling refresh token rather than remounting active editors. The combined recorder retains the former recording command scope, planning is unchanged, and today/due scopes have recovery controls. Do not reintroduce a queue filter over only one paginated client page or accept a missing queue marker as an empty/successful scoped read.

### Role dashboard ownership

DashboardPage owns institution context and recoverable invitations; CoachDesk, AthleteDay and AdminOverview own their overview compositions. Shared responsive layout lives in role-dashboard.css. Reuse authorized service projections rather than deriving institution totals from loaded directory pages. AdminOverview retains the former due-agenda command key for pending scheduling recovery. Admin trends use returned report dates and current-roster denominators; unknown attendance/logging is not absence or inactivity. The food diary shortcut accepts only section=diary, leaving historical plan selection precedence intact.

### Scheduling service ownership

workout-scheduler.ts owns policy validation, diagnostic checkpoints and bounded preparation; workout-sequence.ts owns the shared binding/reschedule/skip/start/resolve invariants. Never make the timer or frontend determine progression. Preserve institution → assignment lock order and exact user-command receipts. Date-only calendar values must stay YYYY-MM-DD through transport; comparing serialized midnight timestamps to a selected date hides events. Nullable event bounds must never be used as an unbounded timed collision range. Old/default attendance reads stay timed-only unless explicitly opted in; do not send date-only shapes into the current native cache by accident.

Use test:workout-scheduler for DST/authority/rest/restriction/duplicate checks, test:workout-sequence for progression and test:workout-foundation for populated migration/client/type evidence, each on its own disposable database. The dedicated plan scheduling browser case validates the actual form, worker kick, preserved current appointment and day-only calendar/detail. Isolated API tests disable the background poll and explicitly drive the worker; normal API/web tests keep actual preparation enabled.

Athlete-plan personalization resolves through `server/plan-prescription.ts` and delivery `action=adapt`. Library editing/explicit copies remain separate. Freeze the assignment revision/source ID inside the saved command, keep earlier library-copy recovery under its original scope, and use occurrence snapshots when starting previously scheduled work. Supporting/primary coach selection uses MemberPicker inlineSelection; do not render a second selected list or disable selected supporting coaches. Communication filtering happens before pagination and suppresses previews per unjoined row.
