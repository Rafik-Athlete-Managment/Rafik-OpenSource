# Beta.3 — sessions, workouts and backend consolidation

## Native compatibility foundation — implemented 31 October 2026

Authenticated protocol-1 capability discovery, shared typing and strict Android parsing now distinguish native feature support from account permissions and distinguish missing endpoints from connectivity/authorization failures. A collapsed schedule disclosure exposes the result without changing saved events or queues. Existing timed attendance, assessments and event completion are advertised; native individual/group recording and day-only calendar stay false. Workout download, durable capture/replay and physical upgrade acceptance remain the next implementation slice. See the [API reference](../reference/api.md#native-capabilities--unreleased-beta3) and [canonical walkthrough](../testing/instance-validation.md#android-compatibility-foundation--unreleased-beta3).

## Group workout web slice — implemented 29 October 2026, acceptance in progress

Workout templates now have a staff library and dedicated create/preview/edit pages, independent program/athlete-plan imports and explicit archive. Group calendar creation freezes a template revision and roster. Designated coaches record separate participant actuals through the shared logger, may adapt before starting, and explicitly skip with a reason. Athletes view only their own results; administrators schedule/review. Event completion requires attendance plus resolved present/started workouts. This additional training does not advance individual plans. Sections, group plans and native offline workout capture remain deferred. See [ADR 0034](../decisions/ADR-0034-workout-templates-and-group-results.md), [canonical walkthrough](../testing/instance-validation.md) and [verification](../verification/README.md) for current evidence and limits.

Date: 22 October 2026. **Status: additive storage, individual progression, opt-in weekly/automatic preparation and web scheduling/calendar integration implemented on the release branch; group/native beta.3 work and release acceptance pending.** Target release: Squire `1.0.0-beta.3`. Detailed verification records establish only the checks actually run, not whole-release or Android acceptance. Beta.2 remains the published version.

The earlier [institution cleanup](../decisions/ADR-0026-single-institution-routing-and-task-retirement.md) and [frontend audit](../reference/frontend/README.md) form the first part of this release. The founder has now included session/workout consolidation, its Android impact and a review of legacy backend routes. Keep release work and its paired landing PR unmerged until the release is complete.

**23 October breaking retirement:** the founder approved removing historical personal/team/business tables and API aliases before customer adoption. ADR 0030 supersedes earlier retention/adapter proposals below. Explicit account/support services replace the generic gateways; current institution data and pending institutional commands remain. Beta.2 clients require a coordinated upgrade.

## Accepted product rules

| Area                   | Rule                                                                                                                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Individual progression | Take workouts in plan sequence. Unresolved prior work blocks the next workout in that assignment only. Explicit completion or skip resolves it; a missed clock time does not silently advance it.        |
| Multiple plans         | Plans progress independently. An unresolved strength workout does not block football training. Same-day work from different plans remains possible.                                                      |
| Explicit scheduling    | Coaches can schedule individual sessions, including weekly recurrence within a selected date range. A scheduled date receives the next eligible workout in that plan sequence.                           |
| Automatic scheduling   | A worker creates eligible work without duplicating unresolved work. It respects rest days and the explicit participation status that prevents training.                                                  |
| Rest days              | Rest days govern worker scheduling; an explicit coach schedule may use a rest day. This does not override a cannot-train restriction.                                                                    |
| Missed sessions        | Keep unresolved work visibly overdue. Coaches can complete, explicitly skip or reschedule it. Subsequent work for that plan stays blocked; do not silently skip or duplicate the workout.                |
| Group training         | Existing training events acquire a shared workout/template with individual attendance, results and completion. Group membership changes do not rewrite historical rosters/results.                       |
| Group progression      | Additional training by default. It does not advance individual assignments. Group plans and automatic group progression are deferred. Using a program workout does not enroll the group in that program. |
| Individual adjustment  | A coach may adapt a participant's prescription without changing everyone else's. Preserve the shared baseline and participant-specific snapshot/history.                                                 |
| Assessments            | Remain a distinct event type with their own definitions, scores and correction history.                                                                                                                  |
| Dashboard              | Show today's actionable individual/group work across the coach's authorized athletes without requiring an athlete selection first.                                                                       |

## Proposed domain model

Keep one training journey, not one table that conflates scheduling, participation and exercise results:

```mermaid
flowchart LR
  Assignment["Individual assignment + sequence"] --> Occurrence["Training session occurrence"]
  Rule["Coach recurrence / automatic worker"] --> Occurrence
  Group["Group training + workout snapshot"] --> Occurrence
  Occurrence --> Participant["Participant snapshot"]
  Participant --> Attendance["Attendance"]
  Participant --> Workout["Workout prescription + actuals"]
  Workout --> Review["Correction history + coach review"]
  Assessment["Assessment event"] --> Scores["Participant scores + history"]
```

- **Session:** a training occurrence, either individual or group, with source, responsible staff, institution-local date, optional fixed time, timezone and lifecycle. Automatically prepared work need not invent a clock time.
- **Workout:** the exercise prescription and its actual recorded results. Freeze the published source version and any participant adaptation; editing a template cannot rewrite prior records.
- **Participant:** attendance and workout state belong to each athlete, even when the group shares the occurrence. Absence is not a completed workout. Finishing one participant does not finish every participant.
- **Sequence:** advance an individual assignment only through its explicitly linked occurrence. Unlinked group training must never advance it. A coach's supporting scope remains tied to the relevant sport/plan.
- **Future slots:** recurrence can describe future calendar slots, but an unresolved predecessor prevents binding another actionable workout from the same assignment. Show the block and its reason; do not pre-consume the sequence merely by generating dates.

Exact table names and whether existing event/session tables are extended are proposals to settle after migration design. Existing `institution_events` hold scheduled attendance/assessments; `institution_sessions` hold per-assignment exercise documents and history. Their current schemas are separate, and the latter currently requires an assignment. Group additional training therefore needs an explicit source model rather than a fabricated individual assignment.

## Technical review proposal

Reviewed 22 October 2026 against the current event/workout schema, session command handler, native queue/store and SQL gateway. The founder authorized the additive schema/migration slice on 23 October. The storage foundation is implemented on the release branch; API, worker, occurrence backfill and native cutover remain subsequent work.

### Storage and source identity

Prefer extending existing institutional event and workout records over replacing their IDs/history:

1. A training event becomes the common session occurrence for one or many athlete participants; assessments retain their distinct kind and score model.
2. Add an explicit institution-local training date and timed/day-only mode. Day-only worker sessions have no invented midnight appointment. The existing event table currently requires start/end timestamps, so constraints, calendar queries, analytics and client contracts must all be migrated together before day-only events are written.
3. Reuse participant workout records, preserving existing workout IDs, actuals, feedback and correction history. Add an occurrence/participant link and allow an assignment to be absent only for explicit additional training with an immutable workout source snapshot. Enforce that source distinction in database constraints, not an unchecked nullable assignment.
4. Enforce one current workout record per occurrence/athlete, with audited revisions. Freeze the roster, shared prescription and participant adaptations; current group membership is not the historical roster.
5. Store an assignment progression cursor and an explicit sequence position on its actionable occurrence. Lock the assignment when binding or resolving a position. A calendar slot is not itself a consumed sequence position.
6. Preserve existing IDs while backfilling individual historical occurrences with evidence from their assignment/day/date. Do not attach historical group attendance to an exercise record merely because dates or names match. A dry-run reconciliation must identify ambiguous records before migration.

If the additive event changes cannot preserve current query/receipt behavior cleanly, revisit storage before implementation; do not create a competing second session subsystem simply to avoid that review.

### Approved progression and lifecycle policies

- Completing or staff-skipping an occurrence advances its linked assignment position once in the same transaction. Add a resolution ledger/unique position constraint so retries and two devices cannot advance it twice.
- At the end of the published cycle, repeat from the beginning while the assignment remains active and within its configured dates. Preserve cycle/position identity so another cycle is not mistaken for a duplicate of the first. The founder approved this repeat policy on 22 October 2026. Repetition does not automatically increase load, difficulty or change the published prescription.
- A later correction edits actual results and appends history without silently rolling back progression or deleting a successor. Reopening progression should require a separately designed explicit action; do not expose it as an incidental result edit. The founder approved this correction policy on 22 October 2026.
- Ending/replacing an assignment cancels unstarted future occurrences, preserves completed history and pauses an in-progress occurrence for explicit staff disposition. Do not automatically declare it completed or erase offline results. The founder approved this end/replacement policy on 22 October 2026.
- An explicit skip requires a staff actor and a reason; absence alone is not a skip. Recurrence cannot manufacture several replacements for the unresolved position. A blocked future slot links back to the original overdue work.

### Canonical API and old-client handling

Implemented fixed-time slice: scoped staff commands use `/v1/institution/workout-scheduling`; bound recording retains `/v1/institution/sessions`. The canonical OpenAPI documents these commands. Day-only/group contracts, native capability discovery remain proposals. Explicit gateway allowlists and four standalone read removals are implemented; see the backend reference.

Propose explicit session/participant/workout operations, with institution and role derived from authenticated membership. Route spelling and DTOs must be reviewed with the OpenAPI change before implementation; a prefix rename alone is not consolidation.

Keep the currently shipped attendance/assessment command shapes and receipt lookup working through a narrow adapter during beta.3. It calls the same domain services as the new session API and does not create a second write implementation. Preserve saved operation IDs, request meaning, actor/resource scope and replay authorization. Document that older APKs retain existing fixed-time attendance/assessment functionality; new day-only sessions and workout capture require the new APK. Agree a later adapter-removal policy after upgrade/pending-work evidence exists; do not use an arbitrary expiry that strands a queued record.

Add server capability discovery for new mobile capture and distinguish an older server from a connection failure. Unsupported server/app combinations must leave saved work reviewable and explain the required upgrade. Capability checks never substitute for command authorization.

Historical finding, superseded by explicit HTTP allowlists (11 commands and 33 projections): the SQL gateway discovered callable functions and readable tables from database privileges in `loadContracts()`. RLS still applies; this finding is not proof of a permission bypass. Nevertheless, changing a database grant should not silently publish another legacy workflow as supported HTTP API. Inventory live web calls and pending historical commands, then use an explicit HTTP operation/table allowlist during gateway retirement. Replace profile/account operations with named services where appropriate; retain only the exact legacy replay adapters supported by policy. Do not remove account export, file cleanup or historical receipts by association.

### Native queue evolution

Add an explicit payload/command kind version and cache schema migration. Existing rows keep their original serialized payload, operation ID, owner key, ordering and event ID. New workout commands carry the exact occurrence/participant/workout identity, expected revision, prescription version and actual measurement fields (reps/load/time/distance/effort). Do not regenerate an old operation while upgrading it.

Attendance, workout results and event finish must have explicit dependencies. A locally marked finish cannot bypass unsent participant results. Show device-persisted work separately from acknowledged results, and preserve conflicts/revocations for recovery. Migration acceptance must open a beta.2-format database with queued, sending/uncertain and acknowledged records, upgrade, restart and replay against the upgraded API; tests must inspect the actual native encrypted store as well as the disposable API.

## Proposed lifecycle and transaction rules

| Record               | States / transition rule                                                                                                                                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Occurrence           | Planned → in progress → completed; planned work can be cancelled. Overdue and blocked should be derived where possible, not mutually contradictory permanent states.                                                                          |
| Participant workout  | Ready → in progress → completed, or explicitly skipped. Cancellation of the occurrence is not proof of completion.                                                                                                                            |
| Individual sequence  | Pending predecessor prevents another actionable successor. Completion/skip advances atomically once; correction history remains visible. Corrections do not rewind progression; a separate progression-reopen action is outside this release. |
| Recurrence           | Bounded weekly rule in the institution timezone, with exceptions for one occurrence versus the remaining series. Define DST behavior before implementation.                                                                                   |
| Worker               | Safe to rerun and safe under concurrent workers. Enforce uniqueness and assignment locking in the database; cron timing is not the integrity boundary.                                                                                        |
| Concurrent recording | Athlete/coach/device edits retain revision checks, exact operation IDs and attributed correction history.                                                                                                                                     |
| End/replacement      | Approved: cancel unstarted future work immediately, preserve completed history and pause in-progress work for explicit staff disposition.                                                                                                     |

Recheck current authority and participation restrictions when generating, starting and replaying work. Keep sensitive injury reasons out of shared calendars, group rosters, notifications and supporting-coach responses. A general blocked explanation must not grant access to the underlying health record. Do not reinterpret historic attendance or recorded workout completion as each other.

## Android is part of beta.3

The phone app cannot be treated as an unaffected client of this change. Its current schedule/roster commands use `/v1/institution/calendar`; its encrypted cache and exact queue retain institution/event/owner identity. See [WorkspaceScreen](../../apps/mobile/src/field/InstitutionScreen.tsx), [sync](../../apps/mobile/src/field/sync.ts), [store](../../apps/mobile/src/field/store.ts) and [model](../../apps/mobile/src/field/model.ts).

Proposed beta.3 scope:

Follow the [campaign-aligned product design system](../DESIGN_SYSTEM.md#campaign-identity-alignment--adopted-23-october-2026) for new field screens. Native palette/font/logo gaps and rendered acceptance are tracked in the [UI audit](../known-issues/ui-ux-audit.md#campaign-and-native-brand-alignment--23-october-2026); do not copy social artboard dimensions into app controls.

1. Show eligible individual and group training in the coach's field schedule; distinguish assessments and explain blocked/overdue work.
2. Open the shared workout and participant prescription/results from the session, without confusing attendance with exercise completion.
3. Keep existing attendance, assessment, history, recovery and completion behavior working.
4. Add a versioned cache/queue migration for offline workout capture. Never change the meaning or payload of an already queued attendance/score operation.
5. Keep account/server/institution scoping, encryption, durable-save feedback, exact retry, revocation/conflict handling and recovery export.
6. Produce a new signed APK using the existing key. Test a real upgrade with pending beta.2-format work; a clean reinstall is not upgrade evidence.

**Founder confirmed:** beta.3 includes offline individual and group workout result capture alongside existing offline attendance and assessments. Pending work must survive process death and the application upgrade, with permission/revision checks before replay. Do not add the wider planned mobile dashboard, formations or messaging merely because the app changes here.

## Backend route disposition: initial source findings

This is a family-level starting inventory from [server/index.ts](../../apps/backend/server/index.ts), not permission to delete every similarly named function. Resolve actual consumers and command names before removal.

| Route family                                                                                      | Proposed treatment                                                                                                      | Boundary to trace                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/v1/coach/recipients`, `/v1/coach/analytics`, `/v1/conversations/*`, `/v1/appointments/upcoming` | Retire independent-workflow entry points after consumer/account-lifecycle checks.                                       | Removed on 23 October after runtime caller and lifecycle review; historical data/export remain.                                                                                                            |
| `/v1/queries/:name`, `/v1/commands/:name`                                                         | Inventory by allowed operation, then replace or remove obsolete operations. Do not delete these gateways wholesale.     | Current auth/profile/account lifecycle and legacy pending-workout sync still use some operations; trace [explicit account service](../../apps/backend/server/account.ts), web transport and SQL contracts. |
| `/v1/institution/calendar` and related assessment/history reads                                   | Supported institutional/native contract; adapt or version deliberately.                                                 | Current APK attendance, score and finish payloads/receipts and cached event IDs. The word workspace is not proof of obsolete behavior.                                                                     |
| `/v1/institution/delivery`, `/sessions`, `/athlete-plans`, `/scheduled-events`                    | Consolidate around the new domain internally; decide canonical API shapes and adapters before switching clients.        | Web recording, delegated recording, calendar, summaries, review, pagination and metrics.                                                                                                                   |
| `/v1/workouts/:id`, `/previous`, `/history`                                                       | Keep read/history continuity while migrating record relationships; route naming may change through an explicit adapter. | Existing bookmarks, immutable prescriptions, corrections, previous actuals, feedback and exports.                                                                                                          |
| `/v1/institution/context`, `/v1/account/institution`, account export/deletion and files           | Retain required identity/lifecycle behavior or introduce an equivalent before removal.                                  | Single-institution scope still needs membership, owned records and byte cleanup.                                                                                                                           |
| Mobile auth, branding, institutional messaging/nutrition/injuries, catalog/media                  | Preserve supported behavior; do not broaden this cleanup into unrelated rewrites.                                       | OpenAPI, authorization, privacy, native access checks and asset rights.                                                                                                                                    |

For each operation, record web/mobile/worker/contract callers, pending durable payloads, permission checks, data/export dependencies, proposed replacement and removal evidence. Remove exclusive services/tests/docs with genuinely retired endpoints. Keep forward migrations immutable. Delete old storage only through an explicit reviewed migration, not by dropping whatever a retired handler references.

Changing the app permits a coordinated API transition; it does not make old offline commands disappear. **Proposed rollout:** additive database migration and a receipt-compatible adapter for supported queued v1 commands, then upgraded web/APK, then removal of redundant adapters after the supported-client policy is agreed. If a breaking API version is preferable, define capability negotiation, upgrade instructions and how old pending work is recovered. Do not silently redirect/rewrite a write into a different operation or clear a queue to complete an upgrade.

## Implemented retirement boundary — 23 October

The original audit found current profile, Support and account lifecycle callers in the generic gateways. Those callers now use explicit `/v1/account/profile`, `/v1/account/export`, `/v1/account/deletion` and `/v1/support` services. The retirement migration deletes the old personal/team/business tables, standalone assignments, legacy file-store metadata and exclusive SQL functions. Current institutional assignments, history, assessments, messages, nutrition, injuries, byte paths and exact receipts remain. See ADR 0030 and the maintained backend reference.

Generic gateways and old workspace/context/organization aliases are removed. Existing Android source uses canonical routes. Deploy the matching APK with the same signing identity and encrypted institutional owner/queue keys; beta.2 clients are unsupported. Exportable local personal browser drafts are not replayed as institutional workouts. The following broader session/group migration checkpoints still apply; historical adapter proposals earlier in this document are superseded by ADR 0030.

### Concrete migration checkpoints

1. **Read-only preflight:** count assignments, workout documents/history, event participants/results, receipts and source kinds; report existing duplicate/ambiguous relationships. No repair or deletion of preview data.
2. **Additive constraints:** introduce occurrence/participant/source and sequence-resolution identities while old code still reads existing fields. Keep an existing assignment-backed workout's ID and assignment relation unchanged. New additional group workouts need their own valid source, not a fake assignment.
3. **Explicit backfill:** derive historical individual occurrences from stable workout assignment/day/local-date identity. Preserve the old `assignment_id/local_date/day_id` uniqueness until replacement generation/replay invariants are proven. Never merge a separate group event by coincidental date/title.
4. **Typed transition:** change fixed-time assumptions in calendar reads, analytics, notifications, native cache DTOs and OpenAPI together before enabling day-only records. Old native calendar adapters return only the fixed-time forms they understand.
5. **Write cutover:** bind/start/save/resolve through one transactional domain service; keep original operation receipts compatible. Database uniqueness and assignment locking prevent two workers/devices from allocating the same position.
6. **Reconciliation:** verify IDs, history versions, feedback links, result values, participant totals and exact receipt responses; test rollback via the complete matching application/database/files backup rather than an unsafe down migration.
7. **Retirement:** remove unused independent handlers and exclusive services/tests. Remove generic endpoints only after the explicit profile/support/export/lifecycle replacements and historical replay policy are implemented and tested.

## Migration and release acceptance proposal

1. Inventory existing assignments, workout records, scheduled events, attendance, assessment results, receipts and local/native queue formats. Define a dry-run report before data changes.
2. Preserve record IDs, attribution, immutable versions, history and feedback wherever possible. Backfill only relationships supported by evidence; unrelated same-day records must not be guessed to be one session.
3. Trial the forward migration in a disposable populated database with individual and group records, ended assignments and historical corrections. Reconcile counts and distinguish event attendance from exercise completion in analytics.
4. Test worker retries/concurrency, independent plan blocking, explicit skips, rest-day override, cannot-train status, recurring timezone/DST boundaries, rescheduling, cancellation and interrupted writes.
5. Test group roster snapshots, individual adaptations, partial attendance/results, no individual-plan advancement, reassignment and revoked staff access.
6. Test the web and native API flows, old supported queue replay and new offline workout capture/replay. Inspect English/Arabic phone/tablet/desktop task states and distinguish emulator from physical evidence.
7. Update canonical OpenAPI, bundled Swagger behavior, frontend reference, operator upgrade/backup/rollback guidance and paired landing English/Arabic docs. Publish beta.3 metadata only when the release exists.
8. Package the new APK with the existing update key, record source/checksums and complete agreed upgrade/device checks. Keep main and public releases unchanged until release approval.

## Proposed implementation order

1. Review the proposed lifecycle/schema details and API compatibility policy; offline mobile workout recording is already accepted.
2. Audit backend operations and design the additive schema, history and migration reconciliation.
3. Implement individual sequence/scheduling and transactional worker with scoped API/command handling.
4. Connect group training events to shared prescriptions and per-participant records, without group plans.
5. Update web calendar/list/dashboard/record/review workflows and Android capture/queue migration.
6. Remove verified obsolete backend operations, complete focused acceptance and paired documentation, then prepare beta.3.

The founder authorized additive schema/migration implementation on 23 October. This authorization does not establish completion of API, worker, web or Android cutover. Preserve the accepted product rules and compatibility boundaries throughout subsequent slices.

## Implemented additive slice — 23 October 2026

Sequence cursors, bounded weekly recurrence storage, unique assignment positions, participant occurrence links, timed local dates and historical source snapshots are implemented. Existing assignment IDs and required timestamps remain. Historical workouts retain their document-derived sources without invented appointments; occurrence creation/backfill is deferred until day-only contracts are supported. Cursors start at zero without consuming historical work. This foundation did not yet implement assignment-free group records, transactional progression/resolution, worker scheduling, capability discovery or native queue evolution. The subsequent fixed-time slice below records current progression support.

## Implemented fixed-time progression slice — 23 October 2026

Staff can bind/reschedule a timed individual occurrence or explicitly skip one through the scoped API. Existing session commands start the linked workout and resolve completion transactionally once. Corrections preserve progression. Concurrent assignments are independent; the published non-rest cycle repeats. Current staff/plan authority is checked before receipt replay. Booking/start respects effective cannot-train status; ending/replacing plans cancels unstarted work and pauses started work.

At the fixed-time checkpoint, web controls and recurring/day-only preparation were pending. The later implementation below supersedes that limitation; additional group workouts, native offline workout capture/cache migration, capability discovery and historical occurrence backfill remain pending. No release/tag/APK was produced by that checkpoint.

## Implemented recurring and automatic individual slice — 26 October 2026

Authorized staff can opt a plan into one bounded weekly clock-based rule or automatic current-day preparation. Manual is the default. Rule save/stop uses exact receipts and current plan authority. Edits/stopping preserve already materialized work; reschedule/skip that workout separately. One next actionable occurrence is bound at a time; generation does not advance progression, backfill missed dates or create group work. Weekly rules can use recovery days; automatic rules follow the published calendar cycle anchored to assignment start, including missing/rest days, cannot-train restrictions and one automatic workout per assignment/date. DST gaps/folds require coach resolution.

The API poll and optional one-shot operator pass use the existing institution/assignment locks and unique positions. New events distinguish real timed bounds from explicit day-only date/timezone with null bounds. Web agenda/calendar/list/detail and reporting handle this shape; calendar clients explicitly opt in to day-only reads. Default attendance reads retain timed-only form, and current native workout capture is not enabled by this server/web implementation. See [ADR 0032](../decisions/ADR-0032-opt-in-workout-preparation.md), operations and verification. Historical occurrence reconciliation, group prescriptions/results and native offline recording remain separate slices.

## Scheduling entry-point slice — implemented 28 October 2026, acceptance pending

Schedule an event now offers Workout from a plan, Custom event and Assessor-led assessment. The workout option searches the existing authorized planning queue by athlete name, pages 10 assignments at a time and schedules that assignment's next sequence position using the existing service without asking for a second event name. Scheduled/unfinished work stays accessible through the athlete plan rather than appearing as another schedulable workout. Custom events retain the free-name/attendance flow and do not advance a plan. Existing drafts and makeup links reopen that flow. Group prescriptions/results remain the subsequent group slice. Frontend source/type checks do not establish browser or release acceptance; see verification.
