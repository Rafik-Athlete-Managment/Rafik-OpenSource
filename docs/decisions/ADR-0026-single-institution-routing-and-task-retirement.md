# ADR 0026 — One institution, clear browser routes, no Tasks

Date: 22 October 2026  
Status: Accepted for the next release; not published in beta.2.

## Context

Each installation belongs to its native institution. Workspace selection, extra-institution creation and role segments in URLs expose a legacy multi-context product. The founder approved retiring Tasks, including permanent deletion of its data.

## Options

1. Retain hidden workspace and Tasks modules for hypothetical future work.
2. Remove obsolete product flows, retain necessary institution/security records and supported v1 API identifiers.
3. Rename all browser, database and native API identifiers together.

## Decision

Choose option 2. First-run setup is the only institution creation flow in every runtime mode. It already serializes creation and refuses a second institution, including when the existing one is archived. Remove `POST /v1/workspaces`, the chooser and the generic creation service. Keep institution memberships, invitations, auditing and scoped services. Legacy independent data remains stored but is not an available account context.

Frontend code lives under `features/institution/` and navigation under `features/navigation/`; components use plain feature names. Internal schema, private-object keys and supported API identifiers keep their compatibility names.

Canonical browser routes include `/dashboard`, `/people`, `/plans`, `/schedule`, `/workouts`, `/messages` and `/institution-settings`. `/settings` remains personal account settings. Resolve institution and role from authenticated membership, preserving account/institution/role/entity draft and command keys. Browser contexts reject ambiguous multiple-institution memberships rather than choosing silently.

Old institution bookmarks are checked against current membership before redirecting, preserving the record suffix, query and fragment. A role in an old URL cannot grant access. Tasks and workspace-chooser routes are removed outright, with no retirement page or dashboard redirect. Omitted standalone coach/check-in/team routes are also removed; unavailable URLs use the ordinary missing-page state. Tasks API routes are removed. Revoked, closed or unreachable institutions show a retry/sign-out screen.

On sign-in, best-effort browser cleanup deletes only the signed-in account’s retired `trainer-tasks` drafts and pending-command keys. Unrelated drafts remain. If browser storage is unavailable, sign-in continues; account-local data removal remains available in account settings.

Delete Tasks table, attributable command receipts and task events through a forward migration. Keep historical migrations immutable and historical verification clearly labeled. Preserve useful workout-review, missed-attendance and event-outcome follow-up in a separate module.

Keep supported `/v1/workspaces/:id/...` endpoints and native context path values for Android compatibility. These are internal compatibility identifiers, not a workspace product. Do not rename cached native scopes or saved command payloads.

## Upgrade and trade-offs

The migration stops transactionally before Tasks deletion when multiple institutions exist. Back up first, separate their data into independent deployments with reviewed migration tooling, then retry; there is no automatic merge or institution selection. Task deletion cannot be reversed by running older code: recovery requires restoring the complete pre-upgrade backup with its matching application version.

Privileged isolated security fixtures may still construct multiple institutions to verify scope boundaries and old-client compatibility; they are not an available runtime creation flow. Local demo seeding removes the historical second institution; the default quick start remains unseeded.

Future assessment/training areas need their own requirements; retain no speculative hidden screens or services. Workout scheduling is separate approved planning, not implemented by this cleanup.

The supported web entrypoint must reach every checked-in Vue component. `tests/view-consolidation.test.ts` guards that tree and the required Resources/Nutrition routes. Legacy account-data export/deletion remains for stored-data compatibility; it does not expose a legacy view.
