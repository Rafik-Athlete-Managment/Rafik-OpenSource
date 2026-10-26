# ADR 0032 — Opt-in individual workout preparation

Date: 26 October 2026. Status: implemented on the unreleased beta.3 branch. Founder approved recurring individual scheduling and automatic preparation; the recommended opt-in and DST-resolution defaults were stated during implementation. This is not beta.3 or Android release acceptance.

## Context and options

Fixed-time individual progression already owns assignment locking, immutable prescriptions, participant scope and once-only completion/skip. Reusing it avoids a second workout subsystem. Automatic preparation needs a real date-only shape rather than a fabricated midnight appointment. Alternatives were inventing a clock time, adding a separate daily-workout table, or extending the current event model. We chose the extension, preserving every existing occurrence/workout ID and receipt.

## Decision

- A plan is manual until authorized staff explicitly save a bounded weekly or automatic rule. At most one active rule exists per assignment. The active creator must retain current administrator or primary/sport-specific supporting-coach authority before preparation. No clinical details appear in diagnostics. Generated event snapshots/audit include the preparing rule identity and automatic/weekly mode; manual request fields cannot forge that internal provenance.
- Weekly rules select ISO weekdays and one local start time, with elapsed duration. Bind only the next eligible slot, never several actionable successors. Unresolved work blocks its assignment alone. Completion or explicit skip advances through the existing sequence service; generation never advances it.
- Automatic rules prepare only the current eligible local day with no start/end timestamps. Recovery follows the immutable prescription’s calendar cycle anchored to assignment start. Missing cycle days are recovery. No global unfinished-work lock or training-load inference is introduced. Existing work for that assignment/day prevents an extra automatic workout.
- Repeating rules never backfill dates that passed without materialization. Already created overdue work stays unresolved. Do not silently skip it or allocate replacements. Date windows span at most 366 days and remain inside assignment dates.
- Wall-clock DST gaps and repeated hours require explicit coach resolution; never guess an offset or shift the appointment. Current restrictions, active roster, calendar collisions and assignment state are rechecked on each attempt.
- Changing/stopping a rule affects subsequent work. Its current materialized workout is preserved, with reschedule/skip controls in the plan. The rule’s worker checkpoint and existing date identity prevent duplicate preparation on reactivation/retry.
- Poll in the API process once per minute, at most 50 policies per pass, ordered by oldest check. Multiple processes share the institution → assignment lock order and unique unresolved-position/sequence constraints. An initial post-receipt kick reduces delay but is separate from policy acknowledgment. One unexpected policy failure does not block other rules.
- New event timing constraints distinguish timed appointments from day-only training. Day-only rows cannot acquire fabricated timestamps or assessment kind. Timed collision ranges explicitly exclude them because PostgreSQL null bounds otherwise mean an unbounded range.
- Calendar clients explicitly opt in with includeDayOnly=true. Default list reads remain timed-only; day-only detail without opt-in returns an upgrade explanation. Web calendar/list/details and agenda handle the new dates. Existing attendance/assessment command payloads and exact receipts are unchanged. This does not reverse ADR 0030’s coordinated beta.3 client-upgrade requirement.

## Trade-offs and limits

Only one next actionable occurrence is materialized; a weekly policy is not a pre-created multi-week calendar of workouts. Poll latency grows with rule count and transaction load; this is not production throughput evidence. Operator pause preserves saved policies. Diagnostics and policy history remain in current institutional storage/audit. Automatic rules are not medical clearance. Group prescriptions/results and Android offline workout capture/cache migration remain separate beta.3 slices.

See the [canonical walkthrough](../testing/instance-validation.md), [operations](../operations/README.md) and [verification](../verification/README.md).
