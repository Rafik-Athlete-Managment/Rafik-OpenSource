# Testing

## Founder validation

Use the [beta.3 correction walkthrough](founder-validation-beta3.md) for the current administrator, coach and athlete handoff. It separates implemented fixes from scheduling/attendance/content follow-up. Automated focused coverage and remaining rendered/device limits are recorded in [verification](../verification/README.md).

Messaging/nutrition request-fault browser specs use the frozen preview and block service workers so Playwright can intercept the actual requests in both engines. Their result does not establish service-worker/offline-shell behavior, which requires its separate acceptance.

## Individual sequence API

`npm run test:workout-sequence` uses the isolated API harness. Coverage includes concurrent binding, independent assignments, unchanged exact retries, athlete denial of staff scheduling, bound-start requirements, completion/correction, explicit skip reasons, cycle repetition, rescheduling without consumption, cancellation/pause on assignment end, a generic participation restriction and revoked receipt access. The existing delegated-session regression covers unaffected unlinked coach logging/corrections. These are server checks; no browser/native acceptance or recurring-worker/DST claim follows.

## Additive workout migration

`npm run test:workout-foundation` exercises a populated forward upgrade and source backfill, old-client inserts, private database grants and recurrence/position constraints in an owned disposable database. It generates client/transport types. This does not establish worker concurrency, API progression, Android queue upgrade or rendered UX acceptance; those require the later implementation slices.

## Next-release cleanup checks

Use the isolated browser wrapper for `tests/institution-routing.e2e.ts`. It covers flat routes, rejection of retired bookmarks, server-derived roles and Tasks retirement. Privileged fixture setup replaces the removed runtime creation endpoint and must use a disposable test database. Current fixtures create one installation; outsider and invalid record IDs test authorization without restoring an institution chooser.

## Opt-in web design audit

From the repository root, with Node 24 (or 22.16+) and the local Docker database running:

```sh
RAFIK_UI_AUDIT=1 npm run test:e2e --workspace @rafik/frontend -- ui-audit.e2e.ts --project chromium
```

In PowerShell, set `$env:RAFIK_UI_AUDIT='1'` before the npm command. Run WebKit separately with `--project webkit-phone`; keep browser runs serial. The collector is skipped in ordinary browser runs. It uses the isolation wrapper, creates a synthetic institution and removes its records/services after the run; it never resets the preview database. It writes screenshots and observations to ignored `artifacts/ui-audit/2026-10-21/`. Observed Axe/layout defects are collected rather than asserted away, so a passing collector is **not** a clean UI verdict. Inspect images, record the reviewed states and move only concise durable receipts into verification. A missing first-run/valid-token/platform-grant fixture remains a coverage gap, not a passing page.

Use the smallest check that covers the changed behavior. Run commands from the repository root unless a step says otherwise. These checks establish local behavior only; they do not prove production readiness, legal compliance, physical-device behavior or human usability.

## Documentation checks

Run `npm run docs:check` from the repository root. It runs two isolated checker regression cases, then validates inline relative links and Markdown heading fragments in maintained root/app/docs/infrastructure guides. Fenced/inline code examples are excluded; external URLs are not fetched. Archives and raw receipts are excluded from the maintained-guide scan but linked local targets still must exist. Fixtures use and remove only their own temporary directory.

A passing link check does not establish that commands work or that status claims are accurate. Compare setup commands with workspace scripts/Compose profiles, read current requirements against dated evidence, and preserve unperformed gates. The [release checklist](../operations/release-checklist.md) records the project-wide beta decision.

## Test layers and commands

Native request/feedback changes use `npm run test:request --workspace @rafik/mobile`. These Node tests mock fetch and Expo secure storage to cover connection recovery, authorized-response observers, denial, malformed responses, URL boundaries and bilingual sign-in feedback. They do not render React Native or establish physical-device behavior. Keep the [physical-phone procedure](../operations/android-release.md#physical-phone-check-galaxy-s20-and-local-backend) separate from these checks.

Field API/queue changes use `npm run mobile:acceptance` on Node 24 with the local Docker database running. It migrates a disposable database, starts its own API, checks native auth/receipts/history/conflicts/revocation and removes its resources. It does not prove native SQLCipher, app process death, sharing or rendered usability. Use `-- --device` only for an intentional device pass and finish it with `done`/Enter. See [Android acceptance](../development/android.md#focused-checks) and [actual evidence](../verification/README.md).

Swagger-only changes use `npm run test:api-docs --workspace @rafik/backend`: two isolated checks cover HTTP routes/assets/headers and viewer configuration, both URL prefixes, native request headers, cookie omission, same-origin enforcement and production reference-only behavior. This does not verify authentication against a database or native-device workflows.

| Layer                     | Command                                                                                             | Coverage                                                                                                                                                                                                |
| ------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend unit tests       | `npm test`                                                                                          | Vue/TypeScript unit and component behavior.                                                                                                                                                             |
| Frontend typecheck/build  | `npm run typecheck` and `npm run build`                                                             | Type correctness and production web bundle.                                                                                                                                                             |
| Frontend browser journeys | `npm run test:e2e`                                                                                  | Serial Playwright journeys through the isolation wrapper; disposable fixtures/services are cleaned up by the runner.                                                                                    |
| Backend typecheck         | `npm run backend:typecheck`                                                                         | TypeScript API and domain modules.                                                                                                                                                                      |
| Android typecheck         | `npm run typecheck --workspace @rafik/mobile`                                                       | Native source and queue-test TypeScript; not a native build.                                                                                                                                            |
| Android field queue       | `npm run test:queue --workspace @rafik/mobile`                                                      | Real Node SQLite transactions, score drafts/dependencies/corrections, completion/eviction, disk restart, exact retries, owner isolation and failure recovery; not Android SQLCipher or API integration. |
| Backend API               | `npm run test:api`                                                                                  | HTTP, identity, authorization, API and data lifecycle contracts against local services.                                                                                                                 |
| Focused backend workflow  | `npm run test:organization-injuries`, `npm run test:organizations`, or the relevant `test:*` script | The selected domain workflow and failure/security cases. Use only the script relevant to the change.                                                                                                    |
| Fresh database            | `npm run test:fresh`                                                                                | Installs migrations, runs a rollback-isolated legacy multi-role normalization scenario, then runs the SQL suites against a disposable database; does not reset the preserved local preview.             |
| Content                   | `npm run content:check`, `npm run test:catalog`                                                     | Canonical content and catalog/media contracts.                                                                                                                                                          |
| Documentation links       | `npm run docs:check`                                                                                | Local Markdown links across maintained monorepo docs.                                                                                                                                                   |
| Release guard             | `npm run test:release`                                                                              | Release configuration guard tests; not a deployment rehearsal.                                                                                                                                          |

Use `npm run format:check` only when formatting/source files changed or when the task requires the repository-wide formatting gate. Do not run unrelated checks to pad evidence.

## Browser and service prerequisites

GitHub's web job runs `npm run test:e2e --workspace @rafik/frontend -- --empty-database --project=chromium onboarding.e2e.ts` after local database startup. This is the administrator/invitation smoke journey, not full browser acceptance. Native binding metadata is covered by the frontend unit suite. CI wiring and online audit practice are described in the [maintainer guide](../development/maintainer-guide.md#github-checks-and-dependency-maintenance).

The isolated browser wrapper owns disposable services, fixtures and cleanup. Do not reset or reseed the shared local preview for browser tests. Keep full browser suites serial. Inspect final screenshots when a layout or visual claim is part of acceptance; generated screenshots alone are not visual review.

Backend API and workflow tests use disposable local identities/records; the fresh-database harness creates its own database, applies migrations and drops only that database. Browser runs use an isolated database, files directory, API and web ports. They must not rely on sample-account pollution or remove unrelated preview data.

For direct `test:e2e:running` diagnostics, first start the local API and web dev server on 5173 plus a production preview on 5174. Use backend/API-focused scripts when the change is server-only. Never allow a test fixture to depend on prior sample-account pollution.

## Coverage boundaries

- Browser emulation does not prove physical phone behavior, native app behavior or assistive technology behavior on hardware.
- Automated checks do not establish that a coach or athlete can complete a task without help. Use the [local coach walkthrough](coach-walkthrough.md) for a personal first pass; it is not a substitute for university review or external user observation.
- Local Compose results do not establish remote CI, production alert delivery, or safe hosted upgrades/rollback.
- Current workflow acceptance and its exact source/device limits are in [verification](../verification/README.md); machine-readable outputs stay under [`../verification/receipts/`](../verification/receipts/). The former R-phase feature map is preserved in the [archive](../archive/README.md).
- Still needed outside automated local tests: physical phone and assistive-technology checks, university coach/athlete task observation, alert delivery, and a disposable production-profile upgrade/rollback rehearsal. See [known issues](../known-issues/README.md).

## People, profiles and list pagination

The focused `athlete-profile.e2e.ts` journeys cover administrator versus primary/supporting/unlinked-coach profiles, real tabs, member rename, invitation sport compatibility, role directories, ten-row next/previous/reload/detail-return navigation, keyboard controls, Arabic/dark 320 px and scoped accessibility/layout assertions. `beta-web-refinements.e2e.ts` has a separate later-page browsing journey for athlete plans, nutrition and events; use `--grep "coach browses"` to select it without running attachment cases. Run through the isolated wrapper, not a seeded preview. These browser checks do not establish physical Android or human usability acceptance.

## Focused design audit modes

From the repository root, set `RAFIK_UI_AUDIT=1` and run `npm run test:e2e --workspace @rafik/frontend -- ui-audit.e2e.ts --grep inventory`. This opt-in baseline collector records observations; it is not a clean-UI gate. Add `RAFIK_UI_AUDIT_CONTROLS=1` for the five-state popup/password regression, or `RAFIK_UI_AUDIT_LAYOUTS=1` for member management/settings in English light desktop and Arabic dark 320px. These focused modes assert no recorded layout or Axe violations. Run them serially and inspect generated images under ignored `artifacts/ui-audit/2026-10-21/`. Unset these variables afterward. The separate bootstrap collector requires `--empty-database --project chromium --grep bootstrap` and `RAFIK_UI_AUDIT_BOOTSTRAP=1`; it has not yet been accepted as rendered evidence.

### Remaining web standardization checks

`ui-standardization.e2e.ts` checks dedicated template/group/task/exercise routes, record drafts, acknowledgement/uncertain retry, upload and page-size persistence. The opt-in audit collector’s `RAFIK_UI_AUDIT_ROLLOUT=1` mode adds populated task, attendance and private-conversation fixtures to representative planning/nutrition/reporting layouts. With that variable, the Chromium functional journey is skipped to reuse its recorded passing evidence; WebKit adds the missing engine coverage. Run the wrapper serially and inspect screenshots. `command-navigation.test.ts` covers active-command remount/replay and legacy draft isolation. None of these checks resets preview data or establishes Android/device acceptance.

Backend `test:*` integration commands now use `apps/backend/scripts/prisma/isolated-api.mjs`: a fresh migrated database and API on port 55343, with cleanup on completion. Do not point fixture setup at preview. `npm run test:institution-cleanup` checks migration stop/deletion/preservation and regenerates shared database types from its disposable database.

## Frontend inventory coverage

Run `npm run frontend:inventory:check` for the maintained [view/component/route reference](../reference/frontend/README.md). The analyzer detects missing descriptions, orphan Vue files, missing rendered consumers, unknown navigation targets and generated-document drift. Review dynamic destinations and role/state-specific branches, not just the command result. It does not execute route guards or prove server authorization.

The obsolete `core.e2e.ts` guest/standalone journeys were retired with those screens. Current institutional recording coverage lives in `programming.e2e.ts`; `consolidated-views.e2e.ts` covers the guest-route rejection and supported Resources/Nutrition entry. This audit does not claim fresh offline/concurrent-device acceptance from the removed historical spec.

## Backend audit coverage

The audit used a populated disposable migration and eleven API checks for auth/actor boundaries, private file recovery, retired endpoints, own export, institutional scheduling and progression. Older standalone browser fixtures need migration before whole-release acceptance. See [audit limits](../reference/backend/README.md).

## Institution naming regressions

From the repository root with local Docker running:

```bash
npm run test:institution-names
npm run test:institution-api
npm run mobile:acceptance
```

These use owned disposable databases/APIs. They cover populated identifier preservation, old/canonical transport and authorization, own export, scalar serialization, and the native bearer/SQLite command queue. They do not migrate/reset preview or establish physical APK upgrade acceptance. The focused browser command is `node apps/frontend/scripts/isolated-browser.mjs --empty-database institution-names.e2e.ts --project=chromium`; keep application/generated sources frozen during that run.

## Retired-domain boundary

`npm run test:retired-domains` migrates a populated disposable database and compares complete current institution snapshots/receipts. `npm run test:institution-api` covers removed gateways/aliases and explicit account/support privacy and replay. `npm run backend:test` uses current institution SQL assertions, not retired personal/team suites. Recovery checks upload current institution assets. Neither command resets preview data. Published beta.2 clients require the matching beta.3 upgrade; historical multi-institution browser journeys are not current acceptance.
