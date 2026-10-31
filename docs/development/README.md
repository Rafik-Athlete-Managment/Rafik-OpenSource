# Development

Root installation applies guarded Expo tooling security patches automatically. If you use `npm ci --ignore-scripts`, run `npm run security:patch`, then `npm run security:check` before starting Expo. Unexpected dependency versions/content require review, not bypassing the guard. See [ADR 0035](../decisions/ADR-0035-expo-tooling-security-backports.md).

The Android workspace lives at `apps/mobile/`. Install dependencies once from the repository root, then use `npm run mobile:start` to start Metro or `npm run mobile:android` to build/run the native Android development client. The app uses SQLCipher and therefore needs a native build rather than Expo Go. Follow the [Android attendance guide](android.md) for setup, capture/retry and recovery limits. Its Swagger-compatible OpenAPI subset is linked from the [API reference](../reference/api.md).

This page is the local development entry point. It covers setup, common changes and troubleshooting. For deployment, secrets, backups and recovery, use [operations](../operations/README.md). For check commands and their limits, use [testing](../testing/README.md).

## Prerequisites

- Node.js 22.16 or Node.js 24 (`.nvmrc` selects Node 24 for local development) and npm. Production containers use pinned Node 22.16 images.
- Docker Engine with the Compose plugin, for local PostgreSQL.
- Git. Use `main` or a reviewed release tag for evaluation; contributors work on `codex/` topic branches.

## First setup

Run from the repository root. Install once from the root lockfile; do not install app workspaces separately.

```sh
nvm use
npm ci
npm run backend:start
npm run web-env
```

This leaves an empty instance ready for first-run super-admin setup. Optional sample accounts require `npm run seed:local` on a separate empty local database before setup; never seed an existing or hosted database.

Start the API and frontend in separate terminals:

```sh
npm run start:api
```

```sh
npm run dev
```

Open `http://127.0.0.1:5173`. `/` opens one-time super-admin setup when the database has no institution. Seeded local databases already contain an institution and use the documented sample accounts. Invitations are shared as single-use links and do not send email. Each institutional account has one role and opens its matching dashboard. Legacy `/coach` links redirect to the closest organization workflow, or to organization setup if no organization is available. Legacy independent data is preserved; this UI change does not migrate or delete it. Administrators manage invitations and role changes in **People & access**, review activity in **Analytics**, and publish programs in **Programs**. See the [root README](../../README.md) for the quick start and [operations guide](../operations/README.md) for database, sample-account and recovery details.

API errors and confirmed user writes use fixed SweetAlert2 toasts so feedback remains visible while a page is scrolled. Read-like POST requests do not show success toasts. Program draft saves return the editor to its heading; the toast confirms save completion.

In the app, staff can open **Messages** and select someone from the **People** list; administrators see active institution members and coaches see athletes in their authorized roster. The existing private conversation opens if one exists. Athletes can read and reply to conversations started by staff. **Open group conversation** on a training group opens its existing channel or creates the first one. To assign training, publish a program and use **Assign this program**; publication adds it to the institution library for other coaches, who can assign it to athletes under their responsibility. New account passwords use the displayed 8–128 character upper/lowercase, number and symbol rules; existing passwords remain valid for sign-in.

To test the first-run screen and invitation journey without touching local preview data, run `npm run test:e2e --workspace @rafik/frontend -- onboarding.e2e.ts --empty-database`. The wrapper creates a disposable, empty migrated database and removes its database, files, logs and Playwright output when it exits.

## Common workflows

After setup, follow the [full instance walkthrough](../testing/instance-validation.md) to validate administrator, coach and athlete accounts, workflows, permissions and recovery. This is the single maintained manual checklist; use its copy from your installed release tag or source commit.

| Change                             | Workflow                                                                                                                                                                                |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend or API behavior           | Keep the vertical workflow in its owning feature/module; derive visible actions from server capabilities and enforce authority in the API.                                              |
| Schema or persistence              | Add a forward Prisma migration, apply it locally, regenerate Prisma and shared database types. Do not reset or reseed a database that contains data.                                    |
| Shared API contract                | Update `packages/shared/` and both consuming workspaces as needed.                                                                                                                      |
| Canonical exercise or food content | Edit backend canonical sources, preserve provenance and media rights, then run the documented content generator/checks. See [content maintenance](../reference/content-maintenance.md). |
| Product or data boundary           | Update [requirements](../requirements/README.md), [architecture](../architecture/README.md), the relevant [ADR](../decisions/README.md), and current review notes as appropriate.       |

The [maintainer guide](maintainer-guide.md) has the repository map and change recipes. The [ledger](ledger.md) is a short current-status record; old phase history and superseded reviews are in the archive.

## Troubleshooting

### API port already in use

`EADDRINUSE` on `127.0.0.1:55331` means another process already owns the API port. Check `http://127.0.0.1:55331/health`: a healthy Rafik response includes `ok: true` and `runtime: prisma-postgresql`. That response proves the listener is alive, not that it loaded the current source. Reuse it only when it matches the running checkout; new routes returning 404 after a pull are a reason to restart the old process. To load backend code changes, stop its original terminal with Ctrl+C and run `npm run start:api` once. Do not reset the database or kill every Node process. On Windows, `netstat -ano | findstr :55331` identifies the listener PID; on Unix, use `lsof -nP -iTCP:55331 -sTCP:LISTEN`. If it belongs to another application, resolve that specific conflict or configure matching API/frontend URLs deliberately.

- If the API cannot reach PostgreSQL, confirm the local Compose database is healthy with `docker compose ps`; then use `npm run backend:start` to apply pending migrations and regenerate Prisma.
- If an API contract/type change fails frontend checks, regenerate the shared database types from the Prisma schema and update the shared API contract before retrying the relevant workspace checks.
- Do not use `seed:local` to repair an existing database. It is for an empty local database only.
- `CREATE DATABASE` can fail with "template database \"template1\" has a collation version, but no actual collation version could be determined". This means the local volume was created under Debian `postgres:17.6` (glibc), before Compose moved to `postgres:17.6-alpine` (musl). Text indexes sorted under glibc are not safe under musl. Do not reset the volume or refresh collation metadata to get around it. Either run that volume's `db` service on `postgres:17.6` with a local, untracked Compose override, or move the data with a dump and restore into a fresh Alpine volume.
- Windows `spawn EPERM` failures have prevented some local Node test runners from launching child processes. The affected checks were run in the Linux API container where appropriate; see [verification](../verification/README.md). This is a local environment limitation, not evidence that a check passed on Windows.
