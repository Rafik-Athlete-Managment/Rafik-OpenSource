# Backend audit and cleanup prompt

## Objective

Audit the complete current backend against Rafik's one-institution deployment model. Produce a maintained schema and route reference, remove proven obsolete runtime paths, and identify the remaining work before beta.3. Preserve useful athlete workflows, current authority, account privacy, history and durable retries.

## Establish the source of truth

1. Read root AGENTS, requirements, architecture, operations, verification and this reference.
2. Inspect the Prisma schema and a fresh disposable database built from all forward migrations. Record physical tables, columns, native types, nullability, defaults, keys, foreign keys, indexes, checks, policies, grants and triggers. ORM relation fields are not physical columns.
3. Inspect every HTTP registration, auth/doc dispatcher and generic operation gateway. Record methods, URL, input/revision/operation identity, handler, purpose, role/subject checks, consumers in web/Android/scripts, and direct/transitive data dependencies.
4. Trace SQL functions, triggers, own-account export/deletion, private bytes and previously stored commands before declaring anything unused. Database grants do not define the public HTTP surface.

## Document and decide

- Explain each table and column in plain language; link relationships and show bounded domain/data-flow diagrams.
- Classify each object as supported, reference content, retained historical compatibility, removable, or deferred with a specific dependency. Similar columns do not establish interchangeable ownership models.
- Distinguish source findings, fresh-schema evidence, actual API checks and unverified production/native behavior.
- Keep the maintained result in this folder; raw catalog/check evidence belongs in verification receipts. Keep the docs index current.

## Implement safe cleanup

- Remove unused routes with exclusive handlers/tests/scripts. Consolidate shared domain/byte handling while preserving distinct authorization boundaries.
- Use plain internal feature/module names. Preserve wire identifiers, immutable snapshot keys and v1 native scope/operation IDs until a coordinated migration proves their replacement.
- Drop genuinely retired tables/fields/functions with a new forward migration and populated preservation checks. Do not edit earlier migrations or reset preview data.
- Remove new legacy acquisition/mutation entry points without deleting historical export, account lifecycle or exact replay. Use an explicit HTTP allowlist while replacing generic services.
- Replace export/recovery dependencies before dropping their storage. If that cannot be completed safely in this slice, record the exact remaining dependency and release impact; do not call retained data an active product feature.

## Verify and deliver

Run the smallest relevant isolated migration/API/type/inventory/documentation checks. Do not run a full browser matrix or native build for source/schema-only cleanup. Own and clean every fixture. Update changelog, ledger, architecture, operations, maintainer/testing guidance and verification. Pair material public API/workflow changes with English/Arabic landing guidance in its separate draft PR. Keep both release PRs unmerged and do not create a release/tag/APK without founder approval.

Deliver the schema/route inventory, removed/consolidated objects, reasons for retention, exact verification and a prioritized release backlog. Do not equate a generated inventory with full usability/security/device acceptance.
