# Beta.3 release review

Reviewed 31 October–1 November 2026 on the unreleased beta.3 branch. Baseline: tag `v1.0.0-beta.2` (the last published release, an ancestor of the branch). Reviewed tip: `6f93128` on `codex/single-institution-cleanup`; fixes are on `codex/beta3-release-review`. The cumulative diff is 68 commits and about 500 files. This is a risk-prioritized correctness/security and readability review, not a line-by-line audit of every changed file. The preceding [code quality audit](code-quality-audit.md) remains the record of typing, unused-code and formatter work.

## Review matrix

| Area | Inspected | Findings | Disposition / verification | Remaining limits |
| --- | --- | --- | --- | --- |
| Individual sequence | `workout-sequence.ts` allocation, skip, reschedule, start context, completion resolution, assignment end; sequence-foundation and worker migrations, triggers and the one-unresolved partial index | F2 (started-then-skipped work kept blocking). Lock order, cursor checks, immutable resolutions and the resolution trigger are consistent | F2 fixed with a scheduler/agenda regression | Concurrency is proved by existing suites and constraints, not by new load tests |
| Worker scheduling | `workout-scheduler.ts`: advisory lock, savepoint, DST resolution, rest days, creator authority, window checks | F2; H1 (weekly slot already past today) | F2 fixed; H1 recorded as a product question | DST coverage is the existing unit check plus scheduler suite |
| Session commands | `programming.ts` `sessionCommand` authorization, start/save/review, delegated completion, receipts | None new. Authorization runs before receipt lookup; completed self-logged actuals stay protected | Comment added at `mutation()` | — |
| Group workouts | `group-workouts.ts`, calendar attendance/finish rules, additional-session isolation from sequence | H2 (server permits re-skip / skip of absent participant that the UI hides) | Recorded as low-severity proposal; audit events keep attribution | Group native capture is not implemented |
| Templates | `workout-templates.ts` read/save/archive scope | None | — | — |
| Agenda / plan reads | `workout-agenda.ts`, `athlete-plans.ts`, `field-workout.ts` | F2 (queue filters) | Fixed | Pagination/count behavior relied on existing suites |
| Privacy modules | Diffs of injuries, retention, assets, account data, platform | Renames/formatting since beta.2; communication tightens previews for non-joined admins | Prior beta.2 evidence reused | No fresh registry audit |
| Communication | Contact discovery, private-pair and group-channel authority | None | — | — |
| Native offline queue | `workout-store.ts`, `workout-sync.ts`, `store.ts` restart recovery, `WorkoutsScreen.tsx` stale-read guards | F1 (start acknowledged with another session) | Fixed with real-SQLite regression; Metro export | Not SQLCipher, rendered Android, process death or physical offline |
| Web | Router/role metadata; web start adoption of returned session; agenda skip menu | Web start intentionally adopts the occurrence's existing session | — | No new rendered browser check (no UI change) |
| CI / validation | `.github/workflows/check.yml` versus every isolated suite | F3 (beta.3 suites never ran in CI) | Fixed: seven suites added | See verification |
| Documentation | Requirements, walkthrough, ADR 0030–0036 | F4 (duplicated requirements section) | Fixed; walkthrough step added | Landing docs unchanged |

Not reviewed in depth: frontend feature components beyond the agenda/workout start paths, nutrition, exercise media/catalog import, analytics SQL beyond the skip/completion counts, migration `202610232000_remove_retired_domains` beyond ADR 0030 intent, and infrastructure/Terraform (unchanged since beta.2 except references).

## Findings

| ID | Severity | Trigger and impact | Source | Disposition |
| --- | --- | --- | --- | --- |
| F1 | High (native field) | A coach starts a bound workout on the web or another device; the Android app later replays its own provisional offline start. The server returns the occurrence's existing session (intended for web adoption). The device rejected that acknowledgment with a plain error, so the exact request became `uncertain`, replayed on every sync and, because the queue drains in id order and pauses on failure, blocked later workout records for that coach | `apps/mobile/src/field/workout-store.ts` `acknowledge` | **Fixed.** The answer is classified as `409 workout_started_elsewhere` → needs review. The device recording and exact request are kept, the other session is never adopted and later records sync. English/Arabic message added |
| F2 | Medium | A coach skips an in-progress individual workout (offered by the agenda menu). The session remains incomplete history but cannot be saved again. The worker counted any incomplete session, so weekly/automatic preparation stopped permanently (`previous_workout_unresolved`); planning/today queues excluded the plan; recording kept a ghost row | `workout-scheduler.ts` unresolved check; `workout-agenda.ts` queue filters | **Fixed.** One shared `unresolvedSession` filter excludes sessions whose position was explicitly skipped. History lists keep showing the record as started and incomplete |
| F3 | Medium (process) | CI passed without running sequence, scheduler, plan-adaptation, group-workout, workout-foundation migration, injury-retention scheduler or API-document suites, so earlier “CI passed” evidence did not cover the release's core rules | `.github/workflows/check.yml` | **Fixed.** Suites added to the backend job |
| F4 | Low (docs) | Requirements repeated the native capture section verbatim | `docs/requirements/beta3-sessions.md` | **Fixed** |

### Hypotheses and product questions (not changed)

- **H1 — weekly preparation may create an already-past slot.** A weekly rule saved at 10:00 for a 08:00 slot starting today creates today's occurrence, which is immediately overdue and blocks the next one until resolved. This may be intended (explicit, visible overdue work) or the first slot should begin at the next future instant. Founder decision needed.
- **H2 — group skip is broader on the server than in the UI.** The server lets a designated coach replace an existing skip reason or skip an absent participant; the UI offers neither. Audit events retain each reason. Proposal: reject re-skip and absent-only skips server-side if the founder confirms the UI rule is the policy.
- **Intentional:** web start adopts the occurrence's existing session (two tabs/devices); additional group sessions never advance individual plans; corrections after completion append history without rewinding progression.

## Readability changes and retentions

- One `local-date.ts` module replaces seven inline `en-CA` formatters and two exported helpers both named `localDay` with different return types. Callers keep their zones and error codes; the start check now evaluates readiness and restrictions at one instant.
- Comments now explain the institution → assignment lock order, why receipts are read only after authorization, why started work pauses rather than cancels when a plan ends, and the start-conflict classification on the device. An orphaned doc comment left by the agenda extraction and redundant optional chaining in the field-package mapper were removed.
- **Retained:** `programming.ts` and `InstitutionScreen.tsx`/`WorkoutsScreen.tsx` remain large mounted owners. Their size alone is not a defect; splitting command services or durable controllers without a behavioral reason would add recovery risk. `skipIndividualWorkout`/`resolveCompletedWorkout` keep separate, explicit write sequences rather than a generic “resolve” helper so each audit event and state remains obvious.

## Verification and evidence limits

See [verification](../verification/README.md#beta3-release-review--1-november-2026). Backend integration suites run in CI's isolated database; they were not run locally in this review because the container could not pull the database image. Native evidence is real Node SQLite plus Metro export, not SQLCipher, rendered Android, process death or physical offline behavior. The [canonical walkthrough](../testing/instance-validation.md#native-individual-workouts--unreleased-beta3) includes the start-conflict step for device validation.
