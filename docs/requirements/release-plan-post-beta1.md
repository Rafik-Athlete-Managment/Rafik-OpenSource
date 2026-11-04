# Post-beta.1 release plan

**Status, 22 October 2026:** Squire `1.0.0-beta.2` is published. Release 1 and the Claude web audit are accepted. The next release starts with single-institution routing and Tasks retirement ([ADR 0026](../decisions/ADR-0026-single-institution-routing-and-task-retirement.md)), then [beta.3 session/workout consolidation](beta3-sessions.md), including group training, offline Android workout recording and a coordinated legacy backend review. Keep the release branch and paired landing documentation PR unmerged until the release is complete. The audit below is historical beta.1 source analysis; its Tasks references and old route names are not current product guidance.

The broader coach field dashboard and sport-specific field tools remain later work; beta.3 is not that entire mobile expansion. Tasks is removed from future mobile scope. Scheduling must distinguish planned occurrences, attendance and actual workout records; it is not implemented by the cleanup. The historical Release 2/3 labels below do not reserve beta.3/beta.4 version numbers; the beta.3 specification supersedes that provisional version mapping.

## Confirmed Release 1 decisions

The founder confirmed these on 19 October 2026:

- **Coach model:** one primary coach, plus supporting coaches scoped to a sport or specialty.
- **Participation status:** visible to the primary coach only; supporting coaches do not see it. No ADR 0017 change.
- **Concurrent plans:** several active plans are allowed. Same-day sessions from different plans show a warning and are not blocked.
- **Shared nutrition actuals:** current behavior is kept. Admins and the primary coach can read actuals the athlete has chosen to share.

The audit below was taken from `main` at `8ae1fbf` (Squire `1.0.0-beta.1` plus CI repairs). File references point to that revision.

## Release order

The founder set this order on 19 October 2026:

1. **Sports and coaching foundation:** sports, coach responsibilities, multiple coaches, concurrent goal-specific plans and athlete profiles.
2. **Coach field dashboard:** navigation/settings, calendar, communications and useful summaries.
3. **Sport-specific field tools:** game events, formations, player notes and recorded participation warnings.

Release 1 comes first because it gives the field features a clear permissions and data model. **R0** closes the open beta.1 work and adds no new scope. Version numbers are proposals: R0 keeps `1.0.0-beta.1` assets, and Releases 1–3 are planned as `1.0.0-beta.2` to `1.0.0-beta.4`.

| Release                                | Slices (one commit each; one pull request per release)                                                                                                                                                     |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R0 — beta.1 close-out                  | Physical acceptance, verified defect fixes, rendered web evidence                                                                                                                                          |
| Release 1 — sports and coaching        | 1a sports and specialties → 1b coaching team and authority → 1c concurrent goal-specific plans → 1d staff athlete profile → 1e delegated workout logging (scheduling recommended; not in the founder list) |
| Release 2 — coach field dashboard      | 2a navigation, settings and branding → 2b calendar and summaries → 2c communications                                                                                                                       |
| Release 3 — sport-specific field tools | 3a game events and line-ups → 3b formations → 3c player notes → 3d recorded participation warnings                                                                                                         |

Coach ratings are not in the founder list. Defer them until after Release 1, because a rating needs a named coaching link. See [deferred and unscheduled](#deferred-and-unscheduled).

## Audit of the current implementation

### Coach responsibility

- Each athlete membership has one optional responsible coach: `workspace_members.trainer_id`. It was created in `202609230130_workspaces` with a composite key to the same institution, a check that only athletes may have one, and the partial index `workspace_members_trainer`.
- Institution tables have no row-level security. All coach authority is enforced in server TypeScript.
- The central check is `recipient()` in `apps/backend/server/programming.ts`. It rejects a trainer whose ID is not the athlete's `trainer_id`. Programs, assignments, workout review, nutrition, athlete plans, analytics, assessment history, message recipients, groups and event participant selection all call it.
- Direct `trainer_id = self` SQL filters also exist. They are in `workspaces.ts` (People view, `assign-trainer`, unassigned counts), `people.ts`, `athlete-plans.ts`, `nutrition-plan-index.ts`, `program-media.ts`, `organization-assets.ts`, `organization-injuries.ts`, `organization-tasks.ts`, `organization-catalog.ts`, `analytics.ts` and `experience-report.ts`.
- The frontend assumes a single coach in `DashboardPage.vue` (the "Responsible trainer" picker and the unassigned summary), `features/institution/types.ts` and `AnalyticsPage.vue` (workload copy).
- **Event staff is a separate authority.** `organization_event_people.duty = 'staff'` governs attendance, results, completion and history after an event is created. The whole Android field API depends on event staff, not `trainer_id`. Event staff can record results for athletes they don't coach; this is intended.

### Program assignment

- The partial unique index `organization_one_active_assignment` (`202609230160_organization_programming`) allows one active assignment per institution and athlete. Because of it, Prisma generates the back-relation on `workspace_members` as a single record.
- `deliveryCommand` `assign` in `programming.ts` archives the current active assignment and creates a new one under an assignment revision check. There is no separate unassign or end command.
- Workout sessions snapshot the immutable program version and are already unique per `(assignment_id, local_date, day_id)`. That suits several concurrent plans.
- The frontend assumes one current assignment in `AthleteTraining.vue` (`current`), `DeliverPlan.vue` (one assignment and revision per recipient, with "Replace future training") and `AthletePlans.vue`.

### Workout logging, feedback and sensitive data

- **Workout logging:** only athletes can start and save workouts. Staff can review, which sets `reviewed_by`. Sessions have no `recorded_by` and no revision history; a save overwrites entries under an optimistic version. Command payloads are kept in `workspace_operations` as retry receipts, not as a user-facing audit trail.
- **Feedback ([ADR 0015](../decisions/ADR-0015-explicit-feedback-sources.md)):** athletes give an optional session score for a workout or attended event. Trainers give a monthly workplace score. Admins see aggregates only. There is no per-coach rating.
- **Participation status ([ADR 0017](../decisions/ADR-0017-injury-status-minimum.md)):** the assigned coach sees the current `modified`/`unavailable` status and effective date. Admins see consent setup only. Reads and changes are written to `organization_injury_access_log`. The status is not shown in the calendar, rosters, the Android field package, shared field contracts or OpenAPI.
- **Nutrition actuals:** staff can read them only after the athlete enables diary sharing. When sharing is on, admins can read them through `recipient()` as well as the assigned coach.
- **Messages:** admins cannot read direct conversations. They can join group channels, and each join is recorded.
- **Sports and teams:** there is no sport, team, specialty or position concept in the organization model. The only related things are plain-name training groups and the legacy independent-coach `teams` tables.
- **Staff view of one athlete:** there is no single athlete page for staff. Per-athlete data is spread across `?member=` pages: athlete plans, session history, assessment history, nutrition and analytics.
- **Android app:** it has a single coach route (`WorkspaceScreen.tsx`) and follows the system light/dark setting with a hard-coded palette. It does not use instance branding and has no tablet layout. English/Arabic RTL is implemented.

### Code-inspection findings

These findings come from reading the code. None has been reproduced in a running app. They are also listed in [known issues](../known-issues/README.md).

- **D1, likely defect:** the post-workout "Rate your session" link goes to `/institution/{workspace}/trainee/feedback` (`apps/frontend/src/features/training/WorkoutPage.vue`). The router has no `/institution` path.
- **H1:** deactivating an athlete or changing their coach does not archive the athlete's active assignment.
- **H2:** `organization_injury_access_log` is written but no screen or export reads it.
- **Policy note:** admins can read nutrition actuals the athlete has shared. A staff profile must not widen this, and the founder should confirm whether admins keep this access.

## R0 — beta.1 close-out

**Status, 19 October 2026:** web work done.

- D1 is fixed.
- H1 is confirmed as dormant behavior and deferred to slice 1c.
- The P2 journeys passed in Chromium desktop and WebKit phone, after fixes for dark contrast, unnamed attachments and count wording.
- The S20+ check and asset alignment remain owner actions.

See [verification](../verification/README.md#r0-beta1-close-out--19-october-2026).

- **Outcomes:**
  - The owner completes the updated Galaxy S20+ install, offline and recovery walkthrough.
  - The published tag and assets match the compiled source.
  - D1 is confirmed in the browser and fixed with a router regression check.
  - H1 is confirmed and either documented or scheduled.
  - The stale offline banner fix is checked on a device.
  - The recent browse-list and multiple-attachment web journeys are rendered and recorded.
- **Data and API:** none.
- **Checks:**
  - Focused unit or router test for D1.
  - Chromium desktop and WebKit phone, in English and Arabic, for the P2 journeys.
  - Physical-device results are reported separately from emulator results.
- **Landing:** a paired English/Arabic release and download update, only when assets are published.

## Release 1 — sports and coaching foundation

### 1a Sports and coaching specialties

**Implemented, 19 October 2026.** Two choices simplified the data model below:

- **One table for both:** sports and general coaching specialties share `organization_sports`, with a `kind` of `sport` or `specialty`.
- **One link table:** `organization_member_sports` links athletes to sports, and coaches to sports or specialties. It keeps no start or end dates; changes are recorded as `member_sports_changed` institution events.

Only administrators manage sports and links, and the links grant no access.

- **Outcomes:**
  - Admins define the institution's sports and assign athletes to them.
  - Admins record each coach's specialties: a sport, or a general specialty such as strength and conditioning.
  - People can be filtered by sport.
  - Sports and specialties stay separate from the single system role. They grant no capability in this slice.
- **Data:** an additive forward migration with:
  - `organization_sports` (name, archived, revision).
  - `organization_member_sports` (athlete ↔ sport, start and end dates).
  - `organization_staff_specialties` (coach ↔ sport, or a named general specialty).
  - Tenant-composite keys like the existing organization tables.
- **API:** admin commands with revision checks and operation receipts, plus scoped reads that follow the People rules. Nothing is added to the field OpenAPI subset.
- **Web:** sports in Institution settings, sport chips and a filter in People, and specialties on the staff record.
- **Mobile:** none.
- **Acceptance:**
  - Archived sports remain on historical records.
  - Duplicate names are rejected per institution.
  - Another institution's sports are denied.
  - Rendered in English/Arabic, light/dark, at 320 px and on desktop, with long names and an empty list.

### 1b Coaching team and authority ⚑

**Implemented, 19 October 2026,** under the confirmed decisions and [ADR 0025](../decisions/ADR-0025-coaching-team.md). Two details differ from the outline below:

- **No start date:** links carry created and ended times and actors, but no `starts_on`.
- **A database trigger** keeps the `trainer_id` mirror and ends links on every write path.

Supporting coaches can read all of an athlete's training plans until slice 1c adds a sport to plans. Only administrators link coaches.

- **⚑ Default model: one primary coach plus scoped supporting coaches.**
  - The primary coach keeps today's assigned-coach access: plans, sessions, nutrition when shared, follow-up tasks and current participation status.
  - A supporting coach is linked for one sport or specialty and sees training plans, sessions, attendance and assessments within that scope only.
  - **Alternative:** an equal coaching team. Every linked coach gets today's assigned-coach access, so sensitive data reaches more people.
- **Data:**
  - `organization_coaching_links(workspace_id, athlete_member_id, coach_member_id, kind primary|supporting, sport_id, starts_on, ended_at, created_by, revision)`.
  - Partial unique indexes: at most one active primary per athlete, and one active link per athlete and coach.
  - The forward migration backfills each non-null `trainer_id` as an active primary link.
  - `trainer_id` stays as a compatibility mirror of the primary, written in the same transaction, for one release. It is removed later by its own migration.
- **Authority:**
  - Replace the boolean check in `recipient()` with a `coachScope(self, member)` result (primary, supporting, sports).
  - Each domain declares the scope it requires.
  - Every `trainer_id` path in the [audit](#coach-responsibility) is migrated and tested.
  - Event staff authority does not change.
- **Lifecycle:**
  - Linking, ending and reassigning a coach are audited admin commands.
  - Ending a link takes effect on the next read, command and retry, including a stale browser tab.
  - Institution-owned training history stays with the athlete and is not transferred with the coach.
- **Analytics:** workload counts primary athletes. Supporting links are counted separately. Reports follow the athlete, not a former coach.
- **Mobile and OpenAPI:** no contract change. The field API keeps its event-staff authority. Check that trainer contexts are unchanged.
- **Acceptance:**
  - An allowed/denied API matrix per domain for: primary coach, supporting coach inside and outside their sport, unlinked coach, admin and athlete.
  - Two institutions.
  - A stale tab after a link ends.
  - Migration of legacy fixture rows in a disposable database.
- **Open decisions:**
  - Can supporting coaches see participation status? Default: no.
  - Who may link coaches? Default: admins only.

### 1c Concurrent goal-specific plans ⚑

**Implemented, 19 October 2026,** with same-day overlap allowed and warned. Differences from the outline below:

- **No owner column:** plans carry a goal and sport but no `owner_member_id`; who may write a plan follows the sport label and the coaching link.
- **Overlap means overlapping dates:** flexible plans have no fixed days, so the check compares date windows.
- **Assessments:** a supporting coach's assessment history is limited to events they staffed until events carry a sport.

- **⚑ Default:** an athlete can have several active plans, each with a goal or sport label and an owning coach. Same-day sessions from different plans are allowed, with a visible conflict warning. **Alternative:** the server rejects overlapping training days.
- **Data:**
  - Replace `organization_one_active_assignment`.
  - Add `goal` (bounded text), `sport_id` and `owner_member_id` to assignments.
  - Change the Prisma relation to a list.
  - Existing assignments keep their state. Immutable published versions are not changed ([ADR 0020](../decisions/ADR-0020-publish-programs-to-library.md)).
- **API:**
  - `assign` takes an explicit `replaces` (assignment ID and revision), or `null` to add a plan. Replacement is never implied.
  - An explicit end command closes an assignment.
  - Overlap is computed by the server and returned as warnings, or as `409` if the blocking alternative is chosen.
- **Authority:** the primary coach can assign for any goal. A supporting coach can assign only within their sport. Assignment remains limited to athletes in the coach's scope.
- **Web:**
  - The athlete's Today and Training pages group sessions by plan label.
  - The plan delivery screen offers "add plan" and "replace plan".
  - Check that browser drafts stay keyed by assignment.
- **Acceptance:**
  - Two plans on one day.
  - A stale replacement revision is rejected.
  - A supporting coach outside their sport is denied.
  - Browser reload and offline recovery of a session from the second plan.

### 1d Staff athlete profile

**Implemented, 19 October 2026.** The profile uses sections with jump links rather than tabs. An unlinked coach gets a refusal instead of name and sport, because the People scope already excludes athletes they don't coach. Supporting coaches see assessment results only from events they staffed.

- **Outcomes:** a staff route `/organization/{workspace}/{view}/athletes/{member}` collects existing per-athlete views into tabs. Each tab calls an existing authorized endpoint. No tab adds access the API does not already grant.

| Tab                                          | Admin                                                       | Primary coach           | Supporting coach         | Other coach         |
| -------------------------------------------- | ----------------------------------------------------------- | ----------------------- | ------------------------ | ------------------- |
| Overview (name, sports, coaches, membership) | Yes                                                         | Yes                     | Yes                      | Name and sport only |
| Plans and session history                    | Yes                                                         | Yes                     | Plans within their sport | No                  |
| Attendance and assessments                   | Yes                                                         | Yes                     | Within their sport       | Events they staffed |
| Nutrition plan                               | Yes                                                         | Yes                     | No                       | No                  |
| Nutrition actuals                            | Only if shared (confirmed: current behavior)                | Only if shared          | No                       | No                  |
| Participation status                         | Consent setup only                                          | Current status and date | No (confirmed)           | No                  |
| Messages                                     | Link to the viewer's own conversation; never other people's | Same                    | Same                     | Same                |

- **Acceptance:**
  - API denial for every tab and actor.
  - Hidden tabs are not treated as authorization.
  - Rendered empty, populated and error states, with long names, in English/Arabic and both themes, on phone and desktop.

### 1e Delegated workout logging (recommended scheduling)

**Implemented, 19 October 2026.** Other differences from the outline below:

- **Who may record:** a supporting coach may record only on plans labelled with their sport.
- **No flag yet:** the athlete corrects the record directly; there is no separate flag action.
- **Online only:** the coach recording page keeps no device queue, but still retries the exact saved command.
- **Today only:** recording follows the plan's scheduling rules for the coach's current date.

- **Outcomes:** a primary or plan-owning coach can record a session on an athlete's behalf without acting as the athlete.
- **Data:**
  - `recorded_by` and `recorded_mode` (`self` | `delegated`) on sessions.
  - A new `organization_session_history` (revision, actor, entries, reason) for every save and correction by anyone.
- **Behavior:**
  - The athlete sees "Recorded by {coach}" and can correct the record or flag it. A correction keeps the history.
  - Analytics separate self-logged from coach-recorded sessions.
  - Authority is checked again on every retry.
- **Acceptance:** delegated save → athlete correction → history shows both actors; retry after a lost acknowledgment; denial after the coach is unlinked.

## Release 2 — coach field dashboard

The Android app stays coach-only. These preserve [ADR 0023](../decisions/ADR-0023-android-coach-field-app.md):

- Encrypted per-owner storage.
- Exact command retries.
- Server acknowledgment.
- Conflict and revocation pauses.

There is no background sync and no remote erasure.

- **2a Navigation, settings and branding:**
  - Native tab or drawer navigation.
  - Settings: language, theme override, instance information, sync status and sign-out.
  - Instance branding (name, accent, logo) fetched from the instance and cached as non-sensitive display data, with contrast adjusted.
  - Phone and tablet layouts, including a two-pane tablet view.
  - Gradients and transitions used sparingly, keeping field controls readable and devices responsive.
- **2b Calendar and summaries:**
  - A bounded, paged calendar beyond today's window, online only. Opening an event still downloads it explicitly for offline use.
  - Home summaries: today's events, unsent or needs-attention work, and assigned athletes in the coach's Release 1 scope (online only).
- **2c Tasks:** the coach follow-up queue from `organization-tasks.ts`, read online, with links into events. Task writes come only after review of their receipt semantics.
- **2d Communications ⚑:**
  - **Default:** online-only native messaging, with the same participant authorization as the web. Messages and attachments are not cached.
  - Offline messaging would need an ADR 0023 amendment.
- **API:** add only the endpoints each slice uses to the versioned OpenAPI subset, and keep the bilingual landing API guide aligned.
- **Acceptance:**
  - `npm run mobile:acceptance` for new endpoints.
  - Emulator phone and tablet, English/Arabic, light/dark, plus a TalkBack spot check.
  - Physical-device results reported separately.
  - Revocation while a dashboard is open.

## Release 3 — sport-specific field tools

- **3a Game events and line-ups:**
  - Add a `game` event kind to the existing calendar, keeping staff duty, attendance, revisions and receipts.
  - New `organization_event_lineups` (event, member, position, revision).
  - Line-up and game observations join the existing exact-command queue, with new actions and receipts, for opened events only.
- **3b Formations:** versioned, per-sport `organization_formations` (sport, name, positions). A formation becomes immutable once an event uses it, like assessment templates.
- **3c Player notes ⚑:**
  - A new sensitive record, coach-authored and scoped to a sport, with bounded text, revisions and history.
  - **Open decision:** who can read notes (linked coaches and admins only, or the athlete too?) and their retention and export rules.
  - Notes must not hold diagnosis or medical content. **Default:** online-only until a caching decision is made.
- **3d Recorded participation warnings ⚑:**
  - Show the athlete's recorded ADR 0017 status and effective date on event rosters, for coaches with participation-status access only.
  - **Default:** online-only and not cached. Offline caching needs ADR 0017 and ADR 0023 amendments and founder approval.
  - The wording reflects only the recorded status. No risk score, prediction or clearance language.
- **Acceptance:**
  - API receipt, lost-acknowledgment and conflict tests for each new action.
  - Revocation in the middle of a game.
  - Emulator phone and tablet in English/Arabic.
  - A wording review for clinical or eligibility claims.

## Deferred and unscheduled

- **Coach ratings ⚑, after Release 1:**
  - Athletes optionally rate a coach they are linked to.
  - Admins see per-coach counts and distributions only at or above a minimum response count (proposed: 5). Coaches see their own aggregate. No individual response can be identified.
  - Missing responses stay unknown; a rating is never inferred from attendance or performance.
  - The stated purpose is staff development, not eligibility or pay.
  - This requires an amendment to ADR 0015.
- **Explicitly deferred:**
  - An athlete-native app and iOS.
  - Background sync and remote erasure.
  - A health-staff role, admin access to injury history, clinical records and risk scores.
  - Google Play distribution, OIDC/SAML and instance URL scanning.

## Cross-release rules

- Every slice updates `CHANGELOG.md`, the [ledger](../development/ledger.md), [verification](../verification/README.md) and [known issues](../known-issues/README.md), plus the architecture page, API guide and ADRs whose behavior changes.
- A paired English/Arabic landing pull request is needed when user workflows, API, authorization, privacy or release guidance change.
- Schema changes use forward migrations, preserve existing records and immutable published versions, and are rehearsed in a disposable database. Never reset or reseed an existing instance.
- Run `npm audit --offline=false` with network access before any binary release. The 19 known high entries from Expo tooling stay tracked; do not force framework downgrades.
