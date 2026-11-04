# ADR 0029 — Institution identifiers and API boundary

Date: 2026-10-23

Status: Accepted by the founder for beta.3; keep the release branch unmerged.

**Superseded in part:** [ADR 0030](ADR-0030-retire-standalone-storage-and-apis.md) removes published-client aliases and retired personal storage. Naming, current data preservation and durable institutional identity rules still apply.

## Context

One institution per installation makes workspace/organization terminology misleading. The founder approved a coordinated physical schema, API, web and Android cleanup before customer adoption. This supersedes ADR 0026's naming-preservation choice, while retaining its data/privacy requirements.

## Decision

Rename 38 physical tables to `institutions`, `institution_members`, `institution_operations`, `institution_invitations`, `institution_audit_events` and `institution_*` feature tables. Scheduled activities remain `institution_events`, distinct from audit events. Rename scoped columns to `institution_id`, update ORM relations, SQL function bodies, indexes, constraints and triggers. Use forward DDL; preserve row IDs, JSON documents, operation payloads/results, grants, private-file byte paths and historical source/event keys.

Canonical browser/native APIs use `/v1/institution/...`, resolving the installation's institution server-side, then rechecking membership and resource authority. Context discovery is `/v1/institution/context`. Record routes use `/v1/workouts/:id`, `/v1/assets/:id`, `/v1/invitations/:token`; own export uses `/v1/account/institution`. There is no new institution creation endpoint or selector. Internal dispatcher scope injection is not a public ID-taking API.

The published APK's `/v1/workspaces/:id/...`, `/v1/contexts` and organization-prefixed record paths remain only in `institution-compatibility.ts`. Old supplied IDs still undergo authorization; aliases are not redirects and accept exact queued commands. Translate transport field names at that boundary without rewriting frozen documents or stored receipts. Canonical responses normalize historical receipt envelope names; old responses retain old names.

## Client integration and upgrade order

Web and Android source adopt canonical names/routes together. Browser workout hydration recognizes the previous scoped field. Android restores the previous SecureStore credential field; its SQLCipher filename, encryption key, owner tuple order and command payloads remain unchanged. Historical recovery scopes stay available. Update the complete backend/web deployment before installing the forthcoming APK. New clients require the updated API; no silent cross-version fallback is promised.

## Trade-offs and later removal

Retained personal history still needs separate storage and export/lifecycle support. Institution prefixes distinguish that boundary rather than create a second model. Historical discriminator values, notification source keys, opaque JSON and file paths may still contain old terminology; changing these could break receipts, subscriptions or byte lookup. The compatibility module is temporary: remove it only after an explicit minimum-client-version and pending-command recovery policy, with upgrade/device evidence. Physical APK upgrade and broader beta.3 workout acceptance remain separate release steps.
