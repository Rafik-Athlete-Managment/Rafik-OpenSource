# ADR 0036 — provisional native individual workouts

Date: 31 October 2026. Status: implemented on the beta.3 release branch; rendered Android/device acceptance remains pending. Group workout capture is the next slice, not enabled by this decision.

## Context and options

Coaches need to record downloaded plan workouts without connectivity. Requiring an online start would prevent field use after arrival. Trusting a device's clock or cached permission as final authority would let stale clients bypass training restrictions or create duplicate sequence positions.

The founder delegated the offline-start recommendation. We chose provisional device starts with authoritative server revalidation, rather than requiring online starts or treating offline capture as already accepted.

## Decision

- Reuse the scoped workout agenda with explicit trainer-only `fieldPackages=true`. Export bounded text-only snapshots of occurrence-bound individual work; ordinary dashboard responses remain unchanged. Do not allocate another event or plan position. Historical unlinked recordings stay in existing web recovery pending reconciliation.
- Keep the existing encrypted SQLite database and instance/account/institution owner tuple. Add a separate workout table on its existing serialized connection lane; do not replace attendance/assessment tables, credentials, encryption keys or operation identities.
- Persist a start's original session ID, operation and payload before dispatch. Device actuals are separate from a frozen save intent. Only after the start's acknowledgment may that intent bind its first server revision and become an exact request. Later edits never rewrite an in-flight request or become falsely acknowledged with it.
- Use existing session start/save services and receipts. The server rechecks role, athlete/plan authority, current training restrictions, occurrence identity and sequence before accepting the start. Cached hints and device clocks are not authorization. Server start/completion times describe accepted commands, not a verified physical exercise time.
- Check current native capability support before replay. Unsupported versions pause for review; network uncertainty retains the exact request. Rejected/blocked requests retain their draft and recovery copy. An unknown start is never silently discarded or attached to another workout.
- Read device packages without waiting for connectivity. Preserve dirty/newer packages during refresh, isolate other accounts and retain the existing attendance editor while switching field views. Saved and online lists use bounded pages; downloaded records are not repeated as download cards.
- Confirm measured actuals explicitly. Strength accepts zero load; timed/distance work has its own inputs. Prescribed targets are not automatic completion. Completion remains provisional until acknowledgment, then the field screen becomes a read-only summary.
- Recovery sharing is explicit and warns about athlete names/results/notes. Clean packages may be removed locally without deleting server history. A definitively rejected save or unsent draft can be replaced only after an explicit current-server review/confirmation; uncertain writes remain protected.

## Trade-offs and remaining work

An offline recording may be rejected after a permission, restriction or sequence change. Retention and exact replay prevent silent loss but cannot promise acceptance. Some start conflicts require authorized staff to reconcile the recovery copy in the web dashboard. Physical exercise timing, media download, native alternative selection, full historical reconciliation and group recording are not added here. Existing selected alternative IDs are retained.

The first slice uses the established native visual styles, not a new mobile redesign. Node SQLite/API evidence does not prove SQLCipher behavior, Android rendering, process death or physical offline acceptance. Follow the [canonical walkthrough](../testing/instance-validation.md) before release packaging. Sealing remains a separate next-release policy.
