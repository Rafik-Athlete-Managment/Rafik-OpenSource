# Contributing to Rafik

Please report security issues privately according to the [security policy](SECURITY.md), rather than opening a public issue with exploit details.

This is a staged university-first revamp. Read [the requirements](docs/requirements/README.md), [target architecture](docs/architecture/README.md), and relevant [architecture decisions](docs/decisions/) before changing behavior. The frontend and backend applications are npm workspaces in `apps/frontend/` and `apps/backend/`; shared contracts live in `packages/shared/`.

## Development conventions

- Preserve Vue 3/TypeScript in the web app and TypeScript/Prisma/PostgreSQL in the API unless an approved architecture decision changes them.
- Keep permissions and transactions in explicit server/API operations. Client state and IndexedDB are not server authority or backups.
- Treat athlete health and injury information as sensitive. Define actor, context, resource, lifecycle, audit, retention, and export requirements before implementation.
- Make API/database changes with forward migrations, update generated web types from the backend, and regenerate canonical content from its sources. Do not edit generated outputs directly.
- Keep local preview identities, test mail, local credentials, and synthetic fixtures out of production configuration.
- Update root `CHANGELOG.md` and `docs/development/ledger.md` for each stage. Update README, architecture, maintainer guide, runbook, and verification records when the corresponding setup, lifecycle, or evidence changes.
- Complete one approved stage at a time; report results and limitations, then wait for approval before starting another.

For TypeScript, package-boundary and safe-refactoring rules, follow the [maintainer standards](docs/development/maintainer-guide.md#typescript-and-refactoring-standards). Current source findings and deliberately deferred work live in the [code quality audit](docs/known-issues/code-quality-audit.md).

## Local setup

Use Node 22.16 or Node 24, npm, and Docker Compose. Run one `npm ci` from the repository root to install all workspaces. Follow the root [README](README.md) to start the local database, API, and web app. Seed only an empty local database. `infrastructure/compose.yaml` is the single Compose definition: default/local services support development; the `selfhost` profile provides the deployment foundation described in operations. Production containers use pinned Node 22.16 images.

## Verification

Run the narrowest applicable tests first, then type/build/format or integration checks. Root scripts route commands into the relevant npm workspace. Full browser checks use the isolated browser wrapper and disposable database; do not reset or reseed an existing preview for tests. Distinguish local API/database tests, browser emulation, physical-device checks, and university operational/legal review. Do not claim tests passed unless the commands completed successfully.

## Public distribution

Project code and documentation use [Apache-2.0](LICENSE). That license does not establish rights for third-party data or media. Preserve per-asset credits, licenses, and provenance, and complete the rights audit before release packaging. Keep `.env` and local variants private; `.env.example` may contain safe placeholders only.
