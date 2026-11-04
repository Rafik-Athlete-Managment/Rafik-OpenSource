# ADR 0028 — Explicit backend compatibility surface

Date: 2026-10-23

Status: Accepted for the unreleased beta.3 branch under the founder-approved backend cleanup.

## Context

Retired standalone UI left HTTP reads and automatically grant-discovered operations behind. Historical rows still support account export/deletion, private-byte recovery and exact replay. These are distinct concerns.

## Options

1. Drop every historical table and adapter: loses owned history and recovery.
2. Keep every granted operation published: silently retains retired authoring workflows.
3. Explicitly list supported compatibility operations and retain dependent history.

## Decision

Use option 3: eleven commands and thirty-three query projections, with existing SQL grants/RLS and current authority as additional boundaries. Remove four unused standalone read endpoints and exclusive handlers. A forward migration removes only the unused billing simulator functions/settings; historical business records remain. Rename internal modules by domain while preserving durable API/schema identifiers.

## Trade-offs

The compatibility gateway remains temporarily. Explicit profile/support/export services and bounded large-history export are follow-up work. New database grants require deliberate HTTP review; schema/route inventories provide drift detection but do not replace permission or runtime tests. See the [audit](../reference/backend/README.md) and [verification](../verification/README.md).
