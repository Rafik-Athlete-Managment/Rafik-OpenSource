# Backend application

This workspace contains the TypeScript API, Prisma/PostgreSQL schema and migrations, canonical content, and backend tests. It is part of the [Rafik monorepo](../../README.md). The API provides the self-hosted university web product, including first-run super-admin setup, password sign-in, one-time invitations and institution-scoped workflows.

## Local operation

Run all commands from the repository root:

```sh
npm ci
npm run backend:start
npm run web-env
npm run start:api
```

Start the web app separately with `npm run dev`. The single Compose definition is `infrastructure/compose.yaml`: its default/local services support development and its `selfhost` profile provides the deployment foundation. Leave a new instance empty for super-admin setup. Optional `npm run seed:local` creates demonstration accounts only in an empty local database and refuses existing profiles; never use it on a hosted instance.

## Ownership

- `prisma/schema.prisma` and `prisma/migrations/` own database structure and forward migrations.
- `server/` owns identity/session handling, authorization, domain operations and private-file access.
- `content/` owns canonical content and media sources. Follow the [content rights guide](../../docs/reference/content-maintenance.md) before importing material.
- `scripts/prisma/types.ts` generates shared database transport types in `packages/shared/`; do not edit them directly.
- Shared API request/response types are in `packages/shared/src/contracts.ts`.

Use the single [contributor guide](../../CONTRIBUTING.md), [current architecture](../../docs/architecture/README.md), [maintainer guide](../../docs/development/maintainer-guide.md), [runbook](../../docs/operations/README.md) and [verification record](../../docs/verification/README.md). Root scripts provide workspace commands such as `npm run backend:typecheck`, `npm run test:api`, and `npm run content:check`.

## Schema and route reference

See the [backend inventory](../../docs/reference/backend/README.md). Root commands: `npm run backend:inventory`, `npm run backend:inventory:check`, and `npm run backend:inventory:database` after migrations. The database command creates and removes only its own disposable database.
