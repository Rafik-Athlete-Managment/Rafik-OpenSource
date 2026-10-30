# Rafik

The unreleased beta.3 branch shares exercise cards across Programs and Workout templates, with same-type alternatives and on-demand credited media. Group events provide attendance-first tabs and recording/review without leaving the athlete roster. Use the [canonical instance walkthrough](docs/testing/instance-validation.md) to validate these workflows.

Dependency installation includes guarded Expo tooling security backports. If disabling install scripts, follow the [development instructions](docs/development/README.md) before using mobile tooling.

**Validate your installation:** follow the [full administrator, coach and athlete walkthroughs](docs/testing/instance-validation.md), including setup, expected results, permissions and recovery. This is the single maintained manual guide; use the copy from your installed release tag or source commit.

**Breaking beta.3 cleanup:** retired personal/team/business tables and API aliases are removed. Deploy matching backend/web/Android versions together after a complete backup; see [ADR 0030](docs/decisions/ADR-0030-retire-standalone-storage-and-apis.md). This branch remains unreleased.

**Upcoming release:** one institution per installation; Tasks is retired. Browser navigation uses `/dashboard`, `/people`, `/plans`, `/schedule` and `/workouts`. Account settings remain `/settings`; administration uses `/institution-settings`. See [upgrade precautions](docs/operations/README.md#next-release-cleanup-upgrade).

Repository: [`Rafik-Athlete-Managment/Rafik-OpenSource`](https://github.com/Rafik-Athlete-Managment/Rafik-OpenSource).

**Preparing Squire 1.0.0-beta.2; published evaluation beta: Squire 1.0.0-beta.1.** Sports and coaching changes are merged; see the [beta.2 upgrade notes](docs/operations/README.md#beta2-upgrade-and-release-preparation). Standalone Android packaging uses `npm run mobile:release`; follow the [signing, installation and update guide](docs/operations/android-release.md). Release/device acceptance limits are tracked in [verification](docs/verification/README.md).

Rafik helps university coaches manage athlete training, attendance and performance in a university-operated instance. It is open source and can be deployed on infrastructure the university controls, without a Rafik software subscription. The Android field app serves coaches; administrators and athletes use the web dashboard. Performance records and limited participation status do not provide medical diagnoses or injury predictions.

## Project status

**Beta evaluation, 19 October 2026:** the web/API foundation is suitable for technically supported, synthetic-data institution evaluation. The current web production build passes; prior role/workflow evidence and remaining limits are in [verification](docs/verification/README.md). See the [beta readiness table](docs/operations/release-checklist.md#project-beta-readiness-19-october-2026) for publishing actions, Android device checks and deployment responsibilities. First-user feedback and optional cloud validation remain accepted backlog items.

The approved migration is staged in [the requirements and acceptance plan](docs/requirements/README.md). The frontend, backend and early Android app are npm workspaces under `apps/`; shared transport contracts and generated database types live in `packages/shared/`. The application has a university-oriented organization foundation and a self-host Compose profile. The coach Android beta is published and accepted; broader coverage remains follow-up work; first-user and pre-production gates remain open, so this is not declared production-ready for real athlete data. Optional cloud-template checks remain deferred to user testing.

Each university is expected to operate a separate instance and control its users, data, files, secrets, backups, retention, and infrastructure. Hosting and maintenance costs are the university's responsibility.

Staff can browse current **Athlete plans**, **Session history** and **Nutrition plans** across their authorized roster without selecting an athlete first. **Events & assessments** lists scheduled training and assessments separately from workout logs. Plan lists include optional filters and pagination. See in-app Help and the [API guide](docs/reference/api.md) for scope and date rules.

## Technology and repository map

The Android prototype includes English/Arabic controls, online correction history and explicit recovery sharing; see the [Android guide](docs/development/android.md) for privacy and acceptance limits.

Focused native API/queue checks: `npm run mobile:acceptance` (Node 24 and local Docker); this uses a disposable database/API and cleans up automatically. See the [Android guide](docs/development/android.md#focused-checks).

Android build/install: `npm run mobile:android`; ordinary mobile JavaScript/UI development after installation: `npm run mobile:start`. The [Android guide](docs/development/android.md#windows-laptop-startup-and-rebuilds) describes the Windows path/concurrency helper and emulator requirements.

For coaches, install the official APK from the Android ZIP bundle on the [beta release](https://github.com/Rafik-Athlete-Managment/Rafik-OpenSource/releases/tag/v1.0.0-beta.1); enter your own institution API URL after installation. Source archives are not Android installers. To build a standalone APK yourself, follow the [fresh-checkout build procedure](docs/operations/android-release.md#fresh-checkout-standalone-build): `npm ci`, your distribution's signing key, then `npm run mobile:release`. No Metro or emulator is needed to use the resulting APK.

Explore the supported coach API in [local Swagger UI](http://127.0.0.1:55331/v1/docs) after starting/restarting the updated backend. See the [API guide](docs/reference/api.md) for authentication and self-hosted URLs.

- `apps/frontend/`: Vue 3/TypeScript web application, Vite build, feature modules, browser persistence, and web tests.
- `apps/backend/`: TypeScript API, Prisma schema and migrations, canonical content, and API tests.
- `apps/mobile/`: Expo/React Native coach app with a local field cache/queue; see the [Android development guide](docs/development/android.md) for current workflow and acceptance limits.
- `packages/shared/`: shared API contracts and generated database transport types used across app workspaces.
- `infrastructure/`: the single Compose definition, Unix operator scripts and optional cloud VM templates; see the [deployment guide](infrastructure/README.md) and [cloud templates](infrastructure/cloud/README.md).
- `docs/`: approved product requirements, target architecture, and decisions.
- `LICENSE`: Apache License 2.0 for project code and documentation. Bundled media and datasets can have separate terms; check their credits and source licenses before reuse.

## Local development

Prerequisites: Node.js 22.16 or Node.js 24, npm, and Docker Compose. The production images use the pinned Node.js 22.16 runtime. Open a terminal in the repository root and install all workspaces once.

```sh
npm ci
npm run backend:start
npm run web-env
```

Leave the database unseeded to try first-run super-admin setup. For an optional sample-account demonstration only, run `npm run seed:local` before creating any users, on a separate empty local database. Never seed a hosted instance or an existing database. Start the API and web app in separate terminals:

```sh
npm run start:api
```

```sh
npm run dev
```

Open `http://127.0.0.1:5173`. A new empty database opens the super-admin setup form; seeded local databases use the local preview accounts for demonstrations. For sample identities, recovery steps and verification limits, read the [development guide](./docs/development/README.md) and [operations guide](./docs/operations/README.md).

## University self-hosting

The repository documents a Docker Compose deployment for a Unix server controlled by the university. It uses PostgreSQL on an internal container network, the API, web app and Caddy HTTPS. First launch creates a super-admin account without email verification; invitations are shared as expiring, single-use links. Keep a new instance on a private network until setup is complete. Each university sets its own instance name, domain, secrets, backups and retention operations. Start with the [infrastructure deployment guide](infrastructure/README.md) and follow the [production runbook](./docs/operations/README.md).

```sh
cp infrastructure/.env.selfhost.example infrastructure/.env.selfhost
# Edit the file with the university's unique instance, domain and credentials.
docker compose --env-file infrastructure/.env.selfhost -f infrastructure/compose.yaml --profile selfhost up -d --build
```

The Compose profile is an implemented deployment foundation, not a production-readiness claim. Complete the Stage 3 upgrade/rollback and university operations gates, and obtain the Stage 4 privacy/security review before using real athlete data. Do not use local sample accounts or synthetic seed data on a hosted instance.

## Checks

For inventory-analyzer changes, run `npm run test:frontend-inventory` to compare CRLF/LF generation, then `npm run frontend:inventory:check` for the maintained reference.

From the repository root:

```sh
npm test
npm run format:check
npm run build
npm run test:e2e
```

Backend checks:

```sh
npm run backend:typecheck
npm run backend:test
npm run test:api
npm run content:check
npm run docs:check
npm run frontend:inventory:check
```

Android field queue checks:

```sh
npm run typecheck --workspace @rafik/mobile
npm run test:queue --workspace @rafik/mobile
```

The full local acceptance chain is documented in [the runbook](./docs/operations/README.md). Browser emulation and Node SQLite checks do not establish native-device behavior, and local checks do not establish hosted security or operational readiness.

GitHub runs focused onboarding and institution checks; see [CI and dependency maintenance](docs/development/maintainer-guide.md#github-checks-and-dependency-maintenance). Dependency audits require online registry access; current unresolved advisories are listed in known issues.

## Documentation and contribution

Web interface standardization is approved and underway. See the [design system](docs/DESIGN_SYSTEM.md) and [audit and implementation plan](docs/known-issues/ui-ux-audit.md).

- [Documentation index](docs/README.md)
- [Frontend views, components and navigation maps](docs/reference/frontend/README.md)
- [Coach field OpenAPI contract](apps/backend/openapi.json), served per instance at `/v1/openapi.json` for Swagger UI imports.
- [Requirements, stages, and gates](docs/requirements/README.md)
- [Target architecture](docs/architecture/README.md)
- [Development setup and workflows](docs/development/README.md)
- [Testing strategy](docs/testing/README.md)
- [Operations and release](docs/operations/README.md)
- [Known issues and release gaps](docs/known-issues/README.md)
- [Architecture decisions](docs/decisions/)
- [Contribution workflow](CONTRIBUTING.md)
- [Security vulnerability reporting](SECURITY.md)
- [Current implementation ledger](./docs/development/ledger.md)
- [Verification record and limitations](docs/verification/README.md)

Work one approved stage at a time. Do not claim a feature, deployment, privacy compliance, or offline reliability until the corresponding acceptance evidence exists. Keep university legal/privacy requirements for confirmation by each institution; this project does not claim jurisdiction-specific compliance.

### Workout migration check

With the local Docker database running, run `npm run test:workout-foundation` from the repository root. It verifies the beta.3 additive migration in a disposable populated database and generates matching client/transport types. It does not modify preview records. See [testing](docs/testing/README.md#additive-workout-migration) and [upgrade guidance](docs/operations/README.md#additive-workout-foundation-upgrade).

For the transactional scheduling and recording journey, run `npm run test:workout-sequence`; it uses the same disposable database/API isolation. The new web scheduling controls and Android workout capture remain pending.

## Backend reference

The [backend inventory](docs/reference/backend/README.md) documents every table, field and route. Run `npm run backend:inventory:check` for drift; migration changes require `npm run backend:inventory:database` with Docker.

Workout template and group-result development checks: `npm run test:group-workouts`. The [canonical instance walkthrough](docs/testing/instance-validation.md#workout-templates-and-group-workouts--unreleased-beta3) covers the unreleased web flow; native offline workout capture remains a later slice.
