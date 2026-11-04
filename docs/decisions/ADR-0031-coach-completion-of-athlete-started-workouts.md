# ADR 0031 — Coach completion of athlete-started workouts

Date: 25 October 2026. Status: founder approved; implementation on the unmerged beta.3 branch.

## Context

The founder reported that coaches could not finish an in-progress workout started by an athlete. Delegated recording previously allowed coach saves only when the coach also started the record. Review feedback was labelled optional in the web form but required by the API; zero-load bodyweight results were not the cause of that validation mismatch.

## Options

1. Keep athlete-started actuals read-only to coaches, requiring the athlete to finish.
2. Allow coaches to rewrite all athlete actuals, including completed records.
3. Allow authorized coaches to finish unfinished athlete-started work, retaining origin, version checks and attribution.

## Decision

Choose option 3. Current primary coaches and sport-scoped supporting coaches may save/finish an unfinished athlete-started workout. Administrators do not gain recording privileges. Preserve `recorded_mode`, original starter and subject. Each actuals save retains its author in session history. First completion adds `completed_by`, `completed_by_name` and `completed_by_role` to the document; corrections do not rewrite this first-completion attribution or advance progression again.

New coach edits to already completed self-logged actuals remain forbidden. Exact retries of an acknowledged coach completion still return its original receipt after current authority is checked. The common mutation layer compares actor, institution and the complete original payload; a receipt ID cannot authorize a different command. Paused/skipped/cancelled linked work remains protected. Athletes retain their existing correction path; stale device writes conflict rather than overwrite a coach's changes.

Review uses the same plan-specific staff authority. Feedback may be empty, matching the optional form label; overlong/non-string notes are rejected. Review does not revalidate or alter actuals. Zero external load remains valid when the exercise's actual repetition/result requirements are met.

## Trade-offs

Staff can finish field work without impersonating an athlete or creating a duplicate workout. Concurrent editors still need explicit conflict recovery. Analytics based on the original recording mode retain that meaning; completion attribution is separate and must not be relabelled as a new delegated start. Native/offline coach capture remains a later slice.
