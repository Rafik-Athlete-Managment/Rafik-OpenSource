# ADR 0034 — Workout templates and separate group results

Date: 29 October 2026  
Status: accepted for the unreleased beta.3 implementation; release acceptance remains separate.

## Context

Group sessions need a reusable exercise prescription without pretending that every participant has the same individual plan. Attendance alone is not evidence of completing the exercises. The founder chose coach-recorded group results, with athletes viewing only their own results.

## Decision

Use **Workout templates**, distinct from assessment templates. Active institution staff can browse shared templates; their creator or an administrator can edit/archive them. Templates use reference or institution-shared exercises, never implicitly publish private exercises. Creation and editing have dedicated pages. Program import copies the workout with new day/exercise identities into an editable program or athlete-plan draft. Subsequent template edits do not rewrite copies.

Group creation reuses the calendar, collision checks and frozen roster. Each occurrence copies the chosen template revision as its immutable baseline. A designated coach can adapt one participant's workout before starting it. That prescription is frozen on the participant's record; actual measurements and attributed corrections reuse the existing workout recorder, validators and history. An unchanged baseline remains usable after its source template/catalog is changed or archived.

Additional records have `source_kind=additional`, no assignment, and a required group occurrence/participant/source. Existing records default to `assignment` and retain their IDs, source snapshots and assignment relationship. The database enforces one occurrence/athlete result and source immutability. Group recording never creates or advances an individual sequence position.

Only current designated event coaches record group actuals. Administrators schedule and review; athletes read their own record and history. Start requires arrived event time, present attendance, active membership and no applicable cannot-train restriction. Current authority is checked before exact receipt replay. A different start cannot silently adopt a competing prescription.

Attendance and results remain separate. Finishing a group event requires every present athlete, plus every athlete with a started record, to have completed results or an explicit coach skip reason. A skip preserves partial actuals/history; cancellation preserves readable history and disables further recording. Completed-event attendance correction cannot add an unresolved present athlete. Shared roster reads are bounded at 100, matching calendar creation; the web shows 10 participants per page and evaluates completion over the whole roster.

## Alternatives and trade-offs

- Linking the group event to each person's individual plan would introduce ambiguous progression and group-plan rules. It is deferred; group training is additional.
- A separate group actuals subsystem would duplicate measured-result validation and correction history. Reuse the existing recorder instead.
- Live-linked templates would make old schedules change without coach review. Frozen copies use more storage but make the prescribed and recorded work explainable.
- Warm-up/main/cooldown/custom sections require coordinated authoring, recording, history and native support. They are deferred rather than partially represented.

## Rollout and limits

Apply the forward migration with the matching API/web build after a complete backup; there is no destructive down migration. Current Android attendance/assessment command identities and queues remain unchanged. Native offline individual/group workout capture and its cache/queue upgrade are the next slice, not enabled by this web implementation. The public beta.2 release remains unchanged until founder release approval.

Manual acceptance lives only in the [instance validation walkthrough](../testing/instance-validation.md). Actual automated/rendered evidence and remaining gaps belong in [verification](../verification/README.md).
