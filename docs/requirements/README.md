# Requirements and staged migration plan

## Next release — beta.3 institutional training

Approved 22 October 2026; not part of published beta.2. Remove Tasks and its data, hide no speculative workspace modules, serve one institution per installation, and simplify browser URLs without retired feature routes or redirects. Preserve current institutional histories/receipts and security boundaries; ADR 0030 requires a coordinated beta.3 client upgrade. Beta.3 also includes the accepted individual/group session model and offline Android workout recording; individual progression and opt-in recurring/day-only preparation are implemented; group templates/results are implemented on the release branch; native offline capture and release acceptance remain in the [beta.3 specification](beta3-sessions.md). See [ADR 0026](../decisions/ADR-0026-single-institution-routing-and-task-retirement.md).

**Status:** approved staged plan. Stage 6 optional cloud VM templates are implemented as unverified starter templates; provider checks remain deferred to user testing and do not block Stage 7. Stage 7 coach-first Android beta.1 is published and accepted for beta evaluation on 20 October 2026; packaging, focused API/emulator checks, founder S20+ walkthrough and public APK checksum verification are complete. Broader native coverage and optional URL scanning remain follow-up work, not beta.1 release blockers. The [release checklist](../operations/release-checklist.md) separates project beta readiness from each institution’s setup and live-data gates.

## Product goal

Rafik should help universities and university coaches support young athletes by tracking training, attendance, performance, and relevant health information. The software should be publicly available for self-hosting without a Rafik software subscription. Each university owns and operates its own isolated deployment, data, identity, and infrastructure costs.

## Confirmed direction

- University and university-sport workflows replace the previous gym-first acquisition direction.
- Canonical public repository: [`Rafik-Athlete-Managment/Rafik-OpenSource`](https://github.com/Rafik-Athlete-Managment/Rafik-OpenSource); it is public and Stage 2 has been pushed.
- Each university runs an isolated instance on infrastructure it controls. Docker Compose self-hosting is the first deployment target. AWS, Azure, and Google Cloud templates are not part of the initial release.
- The Android field app is optional and comes after the web/backend and deployment foundations. React Native with Expo is the accepted Stage 7 framework in ADR 0023.
- Default Rafik branding is retained, with implemented per-instance university branding and a visible Rafik attribution.
- The app has no marketing landing page. A fresh private instance starts with one-time super-admin and institution setup without email verification. That admin provisions institution users with expiring invitation links; invitees set passwords themselves.

## Explicit scope exclusions

- A Rafik-hosted multi-university service; each university operates its own isolated installation.
- Managed cloud services or validated provider support. Optional single-VM templates exist as unverified starters and are not required for the beta.
- Athlete-native and iOS applications. The optional coach-only Android app is published in the accepted beta.1 release.
- Gym sales features such as session packages, prepaid allowances, package renewals and no-show deductions; they were retired from the university product.
- Diagnosis or clinical health records. The v1 injury workflow coordinates structured participation status only.

## Current state and reuse map

| Area                        | Existing implementation                                                                                                                                             | Plan                                                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Web/API                     | Vue 3 and TypeScript frontend; separate TypeScript API; Prisma and PostgreSQL                                                                                       | Retain as the initial technical foundation. Consolidate repositories while preserving history.                                                  |
| University organizations    | Institution memberships, role-scoped workspaces, programs, assigned training, groups, and communications                                                            | Adapt and verify against university teams, coaches, and athlete lifecycle requirements.                                                         |
| Assessments and attendance  | Scheduled organization assessments with assessors, per-athlete results, attendance, correction history, and analytics                                               | Reuse for sports performance workflows after reviewing metrics, permissions, and language. Do not present these as clinical diagnoses.          |
| Athlete health and injuries | A limited consent-gated participation-status lifecycle is implemented locally; it is not a clinical record                                                          | Complete university privacy/security approval, monitoring and task-based acceptance before real athlete data.                                   |
| Offline                     | Browser workout recording has durable local storage and server recovery behavior                                                                                    | Native event capture now uses a separate encrypted cache and exact-command queue; see Stage 7 evidence and remaining device limits.             |
| Deployment                  | Local Compose services and an implemented selfhost profile with web/API/PostgreSQL, migrations, HTTPS and private files                                             | Earlier paired recovery has founder acceptance; Unix update/rollback, branding-specific restore and live alerts remain pre-production evidence. |
| Identity and private files  | Rafik-owned identity/session tables, password sign-in, one-time first-run super-admin setup, expiring invitation links, API-mediated private files on Docker volume | Rehearse authorization, secret handling, retention, backup and file lifecycle under the self-hosted model.                                      |
| Open source                 | Public monorepo, Apache-2.0 code/docs, original beta source tag and published, accepted Android beta                                                                | Preserve per-source media notices and publish matching source/artifact evidence; human sport-task review remains backlog.                       |

## Stages and acceptance criteria

### Stage 1 — Product and architecture decisions (completed 16 October 2026)

- Record university-first requirements, current implementation/reuse map, security baseline, stage dependencies, and risks.
- Confirm a single-university isolated deployment model and Docker Compose as the first supported deployment.
- Acceptance: this document, architecture overview, and ADR are linked from the documentation index; unresolved identity, licensing, privacy, and product decisions remain explicit.

### Stage 2 — Public monorepo and release foundation

**Status: complete (16 October 2026).** The root-lockfile install, focused workspace checks, release build, dependency/license inventory, third-party content rights review, and disposable fresh-database migration rehearsal passed under Node 22.16.0. The repository was renamed to `Rafik-Athlete-Managment/Rafik-OpenSource`, made public, and the Stage 2 commit was pushed. The formatter still reports existing style differences in 167 frontend files; they were not bulk-reformatted. No relevant GitHub Actions run was available. The tracked Vercel config is removed in Stage 3; its separate hosted Git integration is not a Docker acceptance gate. See [the verification record](../verification/README.md). Stage 3 implementation was subsequently completed; its pre-production backlog is recorded below.

- Combine frontend and backend under the confirmed GitHub repository, preserving useful history and documenting the new tree.
- Apply the selected Apache-2.0 software license, contributor workflow, version/release conventions, and a clean-checkout development path.
- Audit dependency licenses and separately verify rights for exercise datasets, images, video, fonts, and other bundled media.
- Acceptance: a clean checkout can install dependencies, run documented local services, execute existing checks, and build release artifacts; no local secrets or synthetic production configuration are included.

### Stage 3 — Secure Docker Compose self-hosting

**Status: prototype implementation complete; pre-production checks are backlog items, 17 October 2026.** The implementation provides the production Compose profile, web/API images, HTTPS proxy, first-run super-admin setup, password sign-in, expiring invitation links, private-file volume and forward migration/password rotation. The founder accepts the earlier backup/restore verification and defers other non-code acceptance gates until first-user evaluation. A disposable Unix update/rollback rehearsal and production security review remain pre-production release gates. The exposed historical Google service-account key was revoked and removed from the rewritten public university branch history.

- Package the web application, API, PostgreSQL, and required routing for one isolated university deployment.
- Provide environment templates, persistent storage, health checks, forward migrations, secure secret setup, update/rollback guidance, and a first-administrator bootstrap that can only be completed once.
- Disable local-preview identities, synthetic seeds, and development-only defaults in production mode.
- Document backup, restore, retention, and incident responsibilities; test restoring database and private files together in a disposable environment.
- Acceptance: an operator can configure and launch an empty instance, create the initial administrator, add university users, upgrade it, and restore a verified backup using the documented procedure.

### Stage 4 — University athlete workflows and security

**Status: prototype implementation complete; first-user and pre-production acceptance remains in the backlog, 17 October 2026.** Institution membership, assignment, training and assessor-led performance records predate this stage. The injury-status vertical slice includes athlete assent, organization consent setup, limited assigned-coach status visibility, correction/history, logged JSON self-export and 12-month post-closure deletion with a non-identifying success checkpoint. The isolated database/API restart rehearsal passed. Focused conversation and injury journeys passed in Chromium and WebKit phone. Coach-led sport-task coverage, monitoring alert delivery, and university privacy/security review are explicitly deferred to first-user evaluation; this is not legal or production approval. See the [Stage 4 workflow audit](./stage4-workflow-audit.md), [ADR 0017](../decisions/ADR-0017-injury-status-minimum.md), and [first-user backlog](../known-issues/README.md).

- Trace each retained workflow to a university task. Adapt training toward drills/agility while retaining useful strength-and-conditioning work.
- Keep the approved v1 capability map: athlete owns structured status; assigned coach sees only current participation status/effective date; admin manages consent prerequisites only; no health-staff role or platform operator access. Never equate performance assessments with clinical findings.
- The local injury lifecycle now includes API and rendered-browser authorization/revocation coverage, athlete JSON export, and a non-identifying aggregate retention checkpoint. The isolated database/API restart rehearsal passed; configure and verify alert delivery, complete the coach-led sport-task and media review, and obtain university privacy/security review before relying on sensitive live athlete data. These reviews remain the founder-accepted first-user backlog and do not reopen completed implementation stages.
- Verify organization boundary enforcement, least privilege, revoked access, one-role membership, audit evidence, and real user-task recovery.
- Acceptance: authorization and lifecycle tests cover allowed and denied access, including cross-organization isolation, revocation, edits/corrections, export, and audit records. A university privacy/security reviewer signs off on its deployment policy before real athlete data is used.

### Stage 5 — Branding and support

**Status: implementation complete; first-user and production backup/restore review remain backlog, 17 October 2026.** Support requests stay local and the UI discloses storage, recipients and sensitive-content boundaries. Instance branding has a database-backed name, accent, custom light/dark page backgrounds and validated logo, controlled by the first super admin. Surface colors derive from the page backgrounds, and text/accent colors adjust for contrast; Rafik attribution remains visible. Focused rendered acceptance passes in Chromium desktop and WebKit phone. The founder confirmed branding persisted after local frontend/backend restart; database backup/restore remains unverified. Outbound support remains disabled. See [ADR 0022](../decisions/ADR-0022-instance-branding-and-local-support.md).

- Provide first-super-admin controls for the instance name, accent, light/dark page backgrounds and PNG/JPEG/WebP logo. Derive surfaces and maintain text/accent contrast. Keep Rafik attribution visible and arbitrary CSS/scripts out of scope.
- Define whether support is self-hosted/local by default or opt-in outbound. Minimize information sent to Rafik and prevent athlete health records or attachments from being included without explicit, informed action.
- Acceptance: branding survives upgrades; support behavior is documented, auditable, and cannot silently export university or athlete data.

### Stage 6 — Optional cloud templates

- **Status: optional starter templates implemented; provider verification deferred to user testing, 17 October 2026.** The initial approach is one small VM per provider running the existing Compose stack, with provider-native operator access and no managed database. See [cloud deployment templates](../../infrastructure/cloud/README.md).
- Each provider needs independent prerequisites, cost review, identity/access, networking, storage, backup/restore, upgrade and teardown guidance. These templates are not cloud-tested and do not imply production readiness.
- User-testing backlog: apply a selected template in a clean provider account, review cost and IAM/network setup, then demonstrate update, paired backup/restore and teardown. Until those checks happen, describe the files as starter templates and do not claim provider support or production readiness.

### Stage 7 — Android field app

- **Status: beta.1 coach-first scope accepted and published, 20 October 2026.** Broader device/accessibility coverage and URL scanning remain follow-up scope. The founder confirmed coach-first field workflows. Native bearer authentication, bounded schedules, attendance, assessment drafts/results and event completion with a scoped command queue are implemented locally. Node SQLite checks cover exact replay/recovery. Isolated real-API integration and focused emulator storage/replay checks passed. Correction history and recovery/localization UI are implemented; the founder reports the S20+ walkthrough passed on 20 October; exact installed-build/device metadata, broader native recovery and accessibility evidence remain open. The supported native API subset is versioned in [OpenAPI](../../apps/backend/openapi.json) and exported from each instance at `/v1/openapi.json`. The task/API contract and architecture are in [the Stage 7 mobile scope](stage7-mobile-scope.md) and [ADR 0023](../decisions/ADR-0023-android-coach-field-app.md). Stage 6 provider validation remains an optional user-testing backlog item.
- Build the Android app as an `apps/mobile/` React Native + Expo TypeScript workspace. Use encrypted SQLite and Android secure credential storage. iOS is not part of the first release.
- Add a separate native bearer-session API. Keep web cookie authentication, origin rules and authorization behavior unchanged.
- Specify device storage protection, queued command identity, retries, deduplication, conflict/reconciliation behavior, server authorization on replay, revocation handling, and clear per-record sync state.
- Acceptance: API integration tests cover duplicate delivery, lost acknowledgements, retries, changed server revisions, revoked access, and multi-device conflicts. Emulator checks and physical Android checks are reported separately; offline reliability is not claimed from compilation or mocks alone.

### Stage 8 — Post-beta releases (proposed)

- **Status: proposed, 19 October 2026; not started.** The founder ordered the next releases as sports and coaching foundation, then a coach field dashboard, then sport-specific field tools. A beta.1 close-out (R0) comes first. Scope, permissions, migrations, acceptance checks and open decisions are in the [post-beta.1 release plan](release-plan-post-beta1.md). Provisional defaults marked there need founder confirmation before the dependent slice starts; each slice is approved and delivered separately.

## Security and privacy baseline

- **Ownership:** university controls its deployment, data, users, keys, storage, backup, retention, and deletion decisions. Rafik has no default access to a self-hosted instance.
- **Isolation:** one university per deployment is the default boundary. Within it, organization/team and individual record scopes still require explicit authorization. Support or platform staff do not receive a hidden universal administrator role.
- **Permissions:** least privilege by actor, context, resource, and lifecycle; deny access by default; recheck permissions for reads, file bytes, retries, exports, and queued writes.
- **Audit:** record sensitive health/injury reads and changes, authority changes, exports, and administrative actions with actor, subject/resource, action, time, and reason where appropriate. Protect audit records from ordinary edits.
- **Transport and secrets:** require HTTPS for remote use, secure cookies, protected secrets, safe rotation, and no production credentials or sample identities in code, client bundles, logs, or fixtures.
- **Storage and recovery:** define encryption for databases, private files, backups, and mobile local records; restrict backup access; test restore of a consistent database plus its associated private bytes.
- **Data governance:** document purpose, access, consent/notice, retention, correction, export, deletion, incident handling, and university responsibility. Applicable legal/privacy obligations need confirmation by each university; this plan does not assume a jurisdiction or certify compliance.
- **Support:** no telemetry or outbound data transfer by default. Support requests should be opt-in and avoid health data by default.

## Key risks and mitigations

| Risk                                                                | Mitigation and gate                                                                                                                      |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Existing gym-first workflows are mistaken for university acceptance | Map workflows and conduct task-based review with university coaches and administrators before claiming readiness.                        |
| Injury data is exposed to staff without a valid need                | Define roles and scopes before schema/UI changes; test denied reads, revocation, sensitive-read auditing, and export boundaries.         |
| Local development identity or credentials ship in a public release  | Add production startup guards, clean-release checks, secret scanning, and no-seed verification in Stage 3.                               |
| Database backup and private files drift apart                       | Version and restore them as one recoverable set; verify checksums and application-level access after restore.                            |
| Monorepo merge loses history or breaks build/test workflows         | Preserve histories, inspect both repositories before moving files, and verify clean-checkout commands in Stage 2.                        |
| Open-source code license is confused with data/media rights         | Choose software license separately; audit every bundled dataset/font/image/video and preserve required attribution before publication.   |
| Offline mobile writes duplicate or overwrite sensitive records      | Keep mobile last; design idempotent commands, server-side authorization on replay, conflict recovery, and sync UX before implementation. |
| Support tickets transfer sensitive data outside university control  | Keep outbound transfer opt-in, minimize content, clearly disclose destination, and log the user's explicit action.                       |

## Settled and open decisions

The v1 injury-status boundary is settled: coaches see limited current status, no health-staff role is introduced, and the product enforces 12-month deletion after closure. For minors, the current workflow records an administrator's guardian-authorization attestation and athlete assent. These are product rules, not a substitute for local university privacy/legal approval. See [ADR 0017](../decisions/ADR-0017-injury-status-minimum.md).

Still open for later stages: optional OIDC/SAML identity adapters; the Stage 5 support channel and branding policy; and institution-specific jurisdiction, notice, incident response and records-governance review. These decisions do not block local implementation, but applicable privacy/security review blocks real athlete data.

## Verification plan

The current repositories already provide frontend unit/build/format checks, frontend Playwright browser workflows, backend API/domain tests, fresh-database SQL tests, type checking, content checks, and a local release runner. Use those against the final source for applicable changes. Add focused security/lifecycle tests for each new sensitive workflow. Run deployment acceptance against disposable Docker resources, never by resetting an existing local preview. For later mobile work, distinguish API integration, emulator, physical-device, and human workflow evidence. Use focused documentation/link/format checks for documentation-only updates; product acceptance evidence remains tied to the relevant source revision.

## Public beta audience and product boundaries

The beta is for technically supported institution evaluation. One institution operates each instance; this is not a centrally hosted account network. Administrators provision roles and events through the web app, coaches use the Android field app for assigned attendance/assessments, and athletes retain their web workflows. Do not advertise the native app as the complete administrative or athlete client.

Performance observations inform a coach's judgment. They do not establish injury prediction, clinical diagnosis or automated eligibility decisions. The offline package deliberately excludes injury records, conversations and files. Only explicitly downloaded events are available offline; sync runs while active, not as a guaranteed background service. Device-save feedback must not imply server acknowledgment.

An unlocked device can retain previously downloaded records while offline even after server access is revoked. Server authorization stops subsequent reads/replay; it cannot remotely erase an offline device. Institutions need screen-lock/device-loss procedures and approved handling for plain-text recovery exports. This limitation is part of evaluating deployment suitability, not a promise to implement remote management in this beta.

Public source, a package that runs and production readiness are separate. The first public package should have a known checksum, tested install path, readable error recovery and honest scope/known issues. Institution-specific approval, real field feedback, provider validation and operational recovery remain explicit backlog items rather than invented completed checks.
