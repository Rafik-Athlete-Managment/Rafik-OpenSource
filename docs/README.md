# Documentation

This page is the index for maintained Rafik documentation. The root [README](../README.md) is the project entry point; [CONTRIBUTING](../CONTRIBUTING.md) describes contribution practice. Historical phase records and superseded material are under [archive](archive/README.md). Raw machine-generated check receipts are separate under [verification/receipts](verification/receipts/).

## Product and design

- [Design system](DESIGN_SYSTEM.md): approved brand, group recording workspace, campaign-to-product mapping, typography, spacing, component, responsive, accessibility and RTL standards; implementation status is tracked in the audit.
- [Web UI/UX audit and rollout plan](known-issues/ui-ux-audit.md): categorized findings, root causes, coverage/evidence limits and prioritized implementation slices. Includes the round7 campaign/native alignment findings; Android rendered acceptance remains follow-up scope.

- [Requirements and staged plan](requirements/README.md): goals, scope, constraints, acceptance criteria and current stage gates.
- [Beta.3 sessions and backend consolidation](requirements/beta3-sessions.md): accepted individual/group rules, implemented storage/fixed-time API status, pending offline Android scope and remaining migration/release acceptance.
- [Stage 4 workflow audit](requirements/stage4-workflow-audit.md): current university workflow coverage and remaining review.
- [Stage 7 mobile scope](requirements/stage7-mobile-scope.md): confirmed coach-first Android field tasks, offline boundary, API contract and acceptance evidence.
- [Post-beta.1 release plan](requirements/release-plan-post-beta1.md): founder-ordered releases, with the sports/coaching foundation merged for beta.2 preparation and the later field-dashboard and sport-specific releases still planned.
- [Rafik Field app workspace](../apps/mobile/README.md): current Android prototype status, local build steps and limits.
- [Architecture](architecture/README.md): system context, components, data flow, security boundaries and integrations.
- [Workout templates and separate group results](decisions/ADR-0034-workout-templates-and-group-results.md): reusable shared prescriptions, frozen copies, participant recording and progression boundaries.
- [Architecture decisions](decisions/README.md): active ADR index; superseded ADRs are archived.
- [API reference](reference/api.md): transport, errors, retries and pagination.
- [Coach field OpenAPI contract](../apps/backend/openapi.json): OpenAPI 3.1 subset exported at `/v1/openapi.json`; bundled Swagger UI at `/v1/docs`. The [API guide](reference/api.md) explains authentication and self-hosted URLs.
- [Content maintenance](reference/content-maintenance.md): canonical content generation, provenance and media rights.
- [Known issues and release gaps](known-issues/README.md): verified product/operational gaps, impact, evidence and next steps.

- [Additive workout storage decision](decisions/ADR-0027-additive-workout-storage.md): compatibility boundaries, historical backfill and the staged API cutover.

- [Expo tooling security backports](decisions/ADR-0035-expo-tooling-security-backports.md): exact-version installation guards, plugin limits, tests and upstream-removal policy.

## Frontend development reference

- [Frontend audit, scope and findings](reference/frontend/README.md): source coverage, architectural ownership, cleanup decisions, deliberate exceptions and refresh commands.
- [View inventory](reference/frontend/views.md): every routed/embedded screen, purpose, access and navigation.
- [Component catalog](reference/frontend/components.md): all local Vue components and direct/transitive consuming views.
- [Route registry and maps](reference/frontend/navigation.md): routes, redirects, navigation relationships, Mermaid maps and source evidence.
- [Reusable frontend audit prompt](development/frontend-audit-prompt.md): improved instructions for subsequent contributor audits.

- [Breaking legacy retirement](decisions/ADR-0030-retire-standalone-storage-and-apis.md): approved table/route removal, current replacements and coordinated client upgrade.

## Development and quality

- [Instance validation walkthrough](testing/instance-validation.md): single source of truth for manual administrator, coach and athlete checks, setup, expected results and version-specific boundaries.

- [Development setup and workflows](development/README.md): prerequisites, local setup, common change workflows and troubleshooting.
- [Android coach field development](development/android.md): native build setup, Windows startup helper and path/concurrency troubleshooting, attendance/scores, history, recovery sharing, English/Arabic and disposable API/queue acceptance.
- [Claude design-audit handoff](development/design-audit-handoff.md): copyable prompt, approved decisions, temporary PR scope and outstanding rendered review.
- [Maintainer guide](development/maintainer-guide.md): repository map, profile/invitation workflows and shared pagination conventions.
- [Current delivery ledger](development/ledger.md): current stage and recent implementation outcomes; not a phase-history archive.
- [Testing strategy](testing/README.md): test layers, focused commands, fixtures and evidence boundaries.
- [Verification summary](verification/README.md): actual checks, dates, coverage and known limits.

## Operations and release

- [Infrastructure setup](../infrastructure/README.md): local versus self-hosted Compose profiles and operator entry points.
- [Optional cloud starters](../infrastructure/cloud/README.md): scope, costs and unverified-provider limits.
- [AWS starter](../infrastructure/cloud/aws/README.md): EC2 prerequisites, operator access, deployment and teardown.
- [Google Cloud starter](../infrastructure/cloud/gcp/README.md): Compute Engine/IAP setup, deployment and teardown.
- [Azure starter](../infrastructure/cloud/azure/README.md): VM setup, operator access, deployment and teardown.
- [Operations and deployment](operations/README.md): Compose deployment, cloud starter templates, environment/secrets, backups, recovery, rollback and retention operations.
- [Release checklist](operations/release-checklist.md): project-wide beta readiness, publishing actions and per-institution deployment gates.
- [Android beta builds and updates](operations/android-release.md): official installation versus contributor/fork builds, fresh-checkout standalone commands, private signing-key backup, installation/update checks and beta.1 distribution close-out.

## Architecture decisions

- [ADR 0001 — University-owned deployments](decisions/ADR-0001-university-owned-deployments.md)
- [ADR 0002 — State and command boundaries](decisions/ADR-0002-state-and-commands.md)
- [ADR 0003 — Complete application-version updates](decisions/ADR-0003-application-updates.md)
- [ADR 0005 — Institution and legacy independent-data boundaries](decisions/ADR-0005-organization-and-independent-scopes.md)
- [ADR 0006 — Prisma API, identity and file boundary](decisions/ADR-0006-prisma-api-transition.md)
- [ADR 0007 — Transactional notification intents](decisions/ADR-0007-notification-intents.md)
- [ADR 0008 — Local operations and bounded reads](decisions/ADR-0008-local-operations-and-bounded-reads.md)
- [ADR 0009 — Dashboard components](decisions/ADR-0009-dashboard-components.md)
- [ADR 0010 — Reference content and nutrition](decisions/ADR-0010-reference-content-and-nutrition.md)
- [ADR 0011 — Exercise catalog and motion](decisions/ADR-0011-exercise-catalog-and-motion.md)
- [ADR 0012 — Institution nutrition and diary sharing](decisions/ADR-0012-organization-nutrition.md)
- [ADR 0013 — Institution exercise media](decisions/ADR-0013-organization-exercise-media.md)
- [ADR 0015 — Explicit feedback sources](decisions/ADR-0015-explicit-feedback-sources.md)
- [ADR 0017 — Minimal athlete injury status](decisions/ADR-0017-injury-status-minimum.md)
- [ADR 0018 — First-run and invitation onboarding](decisions/ADR-0018-first-run-invitation-onboarding.md)
- [ADR 0019 — One institutional role per dashboard](decisions/ADR-0019-single-role-dashboards.md)
- [ADR 0020 — Publish programs directly to the institution library](decisions/ADR-0020-publish-programs-to-library.md)
- [ADR 0021 — Institution workspaces are the supported web experience](decisions/ADR-0021-organization-only-web-experience.md)
- [ADR 0022 — Instance branding and local support](decisions/ADR-0022-instance-branding-and-local-support.md)
- [ADR 0024 — Direct signed Android beta APK](decisions/ADR-0024-android-beta-distribution.md)
- [ADR 0025 — Primary and scoped supporting coaches](decisions/ADR-0025-coaching-team.md)

Historical phase records and superseded documents are linked from the [archive index](archive/README.md); they are not active product or release guidance.

- [ADR 0026 — Single-institution routing and Tasks retirement](decisions/ADR-0026-single-institution-routing-and-task-retirement.md): upcoming-release route, migration and native compatibility decisions.

## Backend audit reference

- [Backend audit](reference/backend/README.md): findings and release follow-up.
- [Schema catalog](reference/backend/schema.md): every table, field, type, purpose and relationship.
- [Route catalog](reference/backend/routes.md): authority, callers and dependencies.
- [Reusable backend audit prompt](reference/backend/audit-prompt.md): scope and removal criteria.

- [ADR 0028 — Explicit backend compatibility](decisions/ADR-0028-explicit-backend-compatibility.md): allowlists, historical retention and simulator retirement.

- [ADR 0029 — Institution identifiers](decisions/ADR-0029-institution-identifiers.md): physical renames, canonical APIs and published-client upgrade compatibility.

- [Coach completion policy](decisions/ADR-0031-coach-completion-of-athlete-started-workouts.md): unfinished athlete-started work, original attribution, exact retries and optional review feedback.

- [Opt-in workout preparation](decisions/ADR-0032-opt-in-workout-preparation.md): recurring/day-only rules, DST policy, worker integrity and coordinated clients.

- [Athlete-plan adaptations](decisions/ADR-0033-assignment-local-adaptations.md): personalized snapshots, future-work boundaries and exact editor recovery.
