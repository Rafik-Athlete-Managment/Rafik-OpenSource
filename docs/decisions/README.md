# Architecture decisions

These numbered records explain consequential design and dependency choices, including their trade-offs and status. The [architecture page](../architecture/README.md) describes current behavior; this index is the entry point for decision history, not a competing implementation guide.

| ADR                                                     | Decision                                                                       |
| ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [0001](ADR-0001-university-owned-deployments.md)        | University-owned isolated deployments                                          |
| [0002](ADR-0002-state-and-commands.md)                  | State and command boundaries                                                   |
| [0003](ADR-0003-application-updates.md)                 | Keep each open application on one complete version                             |
| [0005](ADR-0005-organization-and-independent-scopes.md) | Preserve organization and legacy independent-data boundaries                   |
| [0006](ADR-0006-prisma-api-transition.md)               | Own the API, identity and file boundary on Prisma/PostgreSQL                   |
| [0007](ADR-0007-notification-intents.md)                | Capture notification intents transactionally                                   |
| [0008](ADR-0008-local-operations-and-bounded-reads.md)  | Keep local operations explicit and reads bounded                               |
| [0009](ADR-0009-dashboard-components.md)                | Use owned dashboard components with Unovis and Reka UI                         |
| [0010](ADR-0010-reference-content-and-nutrition.md)     | Own reference content and make nutrition actionable                            |
| [0011](ADR-0011-exercise-catalog-and-motion.md)         | Provide a broad exercise catalog and genuine motion previews                   |
| [0012](ADR-0012-organization-nutrition.md)              | Keep organization nutrition and diary sharing explicit                         |
| [0013](ADR-0013-organization-exercise-media.md)         | Scope exercise ownership and private media to organizations                    |
| [0015](ADR-0015-explicit-feedback-sources.md)           | Keep feedback sources separate                                                 |
| [0017](ADR-0017-injury-status-minimum.md)               | Keep athlete injury participation status minimal                               |
| [0018](ADR-0018-first-run-invitation-onboarding.md)     | Use first-run super-admin setup, password login and expiring invite links      |
| [0019](ADR-0019-single-role-dashboards.md)              | Give each institutional account one role-specific dashboard                    |
| [0020](ADR-0020-publish-programs-to-library.md)         | Publish programs directly to the institution library                           |
| [0021](ADR-0021-organization-only-web-experience.md)    | Use organization workspaces as the supported web experience                    |
| [0022](ADR-0022-instance-branding-and-local-support.md) | Keep instance branding local and support data under university control         |
| [0023](ADR-0023-android-coach-field-app.md)             | Build an Android-first coach field app with encrypted offline capture          |
| [0024](ADR-0024-android-beta-distribution.md)           | Distribute a directly signed beta APK with a persistent local signing identity |
| [0025](ADR-0025-coaching-team.md)                       | Give athletes one primary coach and scoped supporting coaches                  |

ADR 0004 (gym-first timing), ADR 0014 (session packages) and ADR 0016 (former Supabase runtime) are superseded. Their records are retained under [archived decisions](../archive/decisions/README.md) for provenance and are not current guidance. Gaps in numbering are intentional; do not renumber accepted decisions. New decisions use `ADR-NNNN-short-title.md`, a date, context, options, decision and trade-offs. Link the current implementation or superseding decision where relevant.

- [0026 — Single-institution routing and Tasks retirement](ADR-0026-single-institution-routing-and-task-retirement.md)

- [0027 — Additive workout storage before API cutover](ADR-0027-additive-workout-storage.md)

- [0029 — Institution identifiers](ADR-0029-institution-identifiers.md)
- [0030 — Retire standalone storage and APIs](ADR-0030-retire-standalone-storage-and-apis.md)

- [ADR 0031](ADR-0031-coach-completion-of-athlete-started-workouts.md): authorized coach completion of athlete-started work, preserved attribution, protected completed actuals and optional review feedback.

- [ADR 0032 — Opt-in workout preparation](ADR-0032-opt-in-workout-preparation.md): weekly rules, day-only work, DST resolution and worker boundaries.

- [ADR 0033 — Assignment-local adaptations](ADR-0033-assignment-local-adaptations.md): update one athlete plan without library copies or rewriting current work.

- [ADR 0034 — Workout templates and separate group results](ADR-0034-workout-templates-and-group-results.md): reusable copied prescriptions, coach-only participant recording and independent plan progression.
