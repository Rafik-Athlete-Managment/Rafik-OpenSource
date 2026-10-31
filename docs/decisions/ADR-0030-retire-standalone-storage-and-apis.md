# ADR 0030 — Retire standalone storage and APIs before beta.3

Date: 23 October 2026

Status: Founder approved; implementation on the unmerged beta.3 branch.

## Context

The installation serves one institution. The backend audit identified personal coaching, commercial business, team and standalone workout tables retained only for historical export and replay. The founder confirmed that there are no real users and explicitly approved removing these domains now, including business records and standalone assignments. This supersedes the historical-storage and published-client alias retention decisions in ADRs 0026 and 0029. It does not retire current institutional history or queued institutional commands.

## Options

1. Keep historical domains and API adapters indefinitely, carrying two ownership and lifecycle models.
2. Consolidate historical personal data into institution records, inventing ownership and mappings that the source cannot reliably establish.
3. Remove retired domains through a breaking forward migration and replace current account/support dependencies first.

## Decision

Choose option 3. Migration `202610232000_remove_retired_domains` drops 35 public tables and two file-store tables, plus their exclusive functions and dependencies. Removed public families are standalone appointments, assignments, coaching relationships/forms/requests, personal plans/versions/workouts/sets/receipts, invitations, messages/read cursors, personal nutrition/measurements, resources/shares, teams and their memberships/groups/assignments/activity, commercial accounts/events and personal plan deliveries. `file_store` is removed. There are no alias tables or views.

Keep `institution_assignments`, institution programs/versions, workout documents/history/sequence, events, assessments, communications, nutrition, injury records, operational receipts and identity. Keep shared exercise metadata as `reference_exercises`; remove personal exercise ownership/copies. Institutional custom exercises remain `institution_exercises`. Private institution/program byte paths remain unchanged. Unreferenced retired bytes follow the existing operator-controlled orphan cleanup and grace period; SQL migrations do not delete filesystem bytes.

Remove generic command/query/file routes, workspace/context aliases, organization-prefixed record paths and old browser redirects. `/v1/institution` resolves the installation server-side. Current account initialization/editing, export/deletion and Support use explicit endpoints with own-account authorization. Preserve last-admin guards, exact support retry behavior, operator support authority and current institutional export scope. Calendar conflicts and notification functions must reference only current domains.

## Upgrade and trade-offs

Deploy matching backend, web and Android source together. Published beta.2 clients are unsupported by this breaking branch; do not retain or recreate aliases merely to make them work. Reuse the Android signing key, encrypted store and stable institutional owner/operation IDs. Keep pending institutional commands unchanged. Old personal browser drafts remain local and exportable, with a clear unsupported-sync message; they are never adopted as institutional work.

Back up the complete database, private bytes and matching application before migration. Stop APIs/workers during cutover. Removal is irreversible without that backup. Historical migration files remain immutable so existing migration checksums and clean installation still work; their old names are provenance, not active tables/routes. The release remains unmerged and unpublished until founder approval and the remaining beta.3 workflow/device acceptance are complete.

## Verification

Use the populated retirement verifier to compare complete current table snapshots and exact receipts across the migration. Test absence of retired routes/functions, profile privacy, support replay, account export/deletion, last-admin protection, institutional program/calendar/nutrition/health/file flows and native API acceptance. Keep actual results and gaps in [verification](../verification/README.md).
