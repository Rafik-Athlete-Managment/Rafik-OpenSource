# Instance validation walkthrough

This is the single source of truth for manual administrator, coach and athlete validation walkthroughs, for founder acceptance and institution owners checking their own installation. Update the relevant steps here when implemented workflows change; other guides and landing link here rather than copying the procedures. Automated evidence belongs in [verification](../verification/README.md), not in a parallel walkthrough.

**Version scope:** current unreleased beta.3 release branch. These steps include changes not present in published beta.2. Use the document from the same release tag or source commit as your installation; passing this checklist does not establish whole-release acceptance or institutional live-data approval.

Use synthetic records and separate browser profiles for administrator, coach and athlete. Keep existing data; do not reset or seed the instance. On a hosted installation, open your instance URL and skip the local startup commands below. Record the deployed version/commit, browser/device, language/theme and each checked result as passed, failed or not checked. Only run sections implemented in that version.

## Start the local app

From the repository root, with Docker running, start the local database and apply pending migrations:

```sh
npm run backend:start
npm run web-env
```

Start the API and web app in separate terminals:

```sh
npm run start:api
```

```sh
npm run dev
```

Open `http://127.0.0.1:5173`. A fresh database opens the first-run super-admin setup form; complete it with synthetic details. A database seeded with sample accounts opens sign-in instead. The first-run journey can be exercised safely with `npm run test:e2e --workspace @rafik/frontend -- onboarding.e2e.ts --empty-database`; the isolated runner creates and removes its own database. Do not run `npm run seed:local` against a database that already contains data. The [development guide](../development/README.md) covers setup and troubleshooting.

## Prepare accounts and access

Use an empty synthetic institution or your existing local demo; do not reset another dataset. In **People & access**, invite a coach and at least two athletes using separate synthetic email identifiers. Redeem each single-use link and set passwords. Assign the coach responsibility for the athletes. Each membership has one role; use separate accounts to review different dashboards.

## Administrator

### Institution overview

1. Open Dashboard: expect Institution overview, a reporting-period control and activity before administrative detail. Switch 7/28/90 days; wait for the returned dates to match. No records should show honest chart empty states, not example data.
2. Compare completed workouts with recorded completions in the selected period. Participation counts distinct currently active athletes with a completion, over the active roster now; it is not attendance or compliance. Attendance counts athlete-event entries for started non-cancelled events, including unknown/unmarked entries.
3. Follow coverage links to People and coaches; check Invite people, persistent invitation link, athlete plans and institution settings remain reachable. Admins must not gain coach recording or injury-detail access.
4. Interrupt a report refresh: expect an error and retained results with their original dates. Retry and confirm recovery. Inspect phone/desktop, Arabic/English and both themes.

### Prepare an assigned program

Create an empty program, add real exercises and prescriptions, review and publish it. Choose Assign this program for a synthetic athlete with an assigned coach. Confirm the published version is fixed and assignment is explicit. The assigned coach should find it in Athlete plans; an unrelated coach must not acquire assignment or recording authority. Use this record for the scheduling and recording checks below.

### Assigned-plan presentation

Open Athlete plans, search/page the directory and select a plan. Expect a dedicated page with one plan title and labelled icon actions; the back link restores directory filters/page size/offset. Choose Adapt this program: the editor appears in that same page and says Adapt program. Save a distinctly named draft, reload and confirm recovery; View assigned plan still shows the unchanged assigned version. Publish/assign only when you intentionally want to test a new assignment or replacement. End plan is red. Check a Cancel and Delete/Remove action in light/dark mode; regular navigation and cancelled-event labels must retain ordinary styling.

### Individual workout scheduling

Use an active synthetic athlete with a published assigned plan and primary coach. Open Athlete plans and select the assignment (or follow Manage workouts from the athlete profile). In Next workouts, choose Schedule workout, set the date/time, timezone and duration, then save. Expect one scheduled occurrence after reload. Reschedule it before recording and confirm the same workout remains selected. Skip with a reason: expect the next plan workout to become available for scheduling; the skipped occurrence remains historical. Administrators should not see Start workout or acquire delegated coach privileges.

1. In People, invite a coach or athlete. After success, the large form should close and the single-use invitation link should remain visible and selectable.
2. Open an athlete's Manage tab. Select or clear the primary coach; wait for acknowledgment, reload and confirm the selection. No second save is required.
3. In Supporting coaches, browse coaches without choosing a sport first. Optional filtering sits under Filter coaches. Select a coach with one eligible specialty: it saves immediately. For several eligible scopes, explicitly choose Access scope; that choice saves. A coach without eligible coverage explains why it cannot be added. Remove a link and reload. A sport scope still limits access and must not be silently broadened.
4. Create a group with athletes and coaches. On medium/large widths, the two selectors should sit side by side; on a phone they should stack. Sign in as the assigned coach to verify visibility.
5. In Messages, expand Start a conversation. Open an unstarted group, return to the directory and confirm it is no longer offered as a new group. Reopen the existing conversation and confirm there is only one channel.
6. Add exercises to a program. Available videos should have a video-camera indicator; still illustrations must not receive that indicator.

## Coach

### Dashboard, scheduling and completion controls

Open the dashboard with an assigned plan awaiting scheduling and one due workout. Expect a greeting, assigned-athlete count and plan/analytics links in the header; Today’s work and Athlete status sit side by side on desktop and stack on phones. Workouts to record combines due and unfinished workouts, with Start/Resume actions; today’s group/assessment events remain separate. Needs scheduling appears below. Primary-roster follow-up uses compact expandable rows. Awaiting-schedule work must be discoverable without picking an athlete. Verify that a workout appears once, either in Workouts to record or Needs scheduling, including later pages. Schedule work for now: it must leave planning and appear in Workouts to record without reloading the page. Start it, return to the desk and confirm one Resume card. An outdated or unconfirmed backend response must show an update/restart message, not populate both lists. Existing pending commands remain retryable. Open a follow-up row and verify its action and count. A coach with supporting sport assignments but no primary roster must still see the authorized work without a misleading empty-roster prompt. Schedule it from its card; check date/time, timezone and duration alignment on desktop and stacked phone layout. Future scheduled work leaves the action list but remains in plan details. Workout cards use the workout/day name as the main heading and the program title beneath it, including when several workouts share one program. Status tags retain readable text and distinct light/dark colors. The Athlete status column exposes only the existing shared primary-roster participation status/effective date: modified, unavailable or unknown, never clinical detail or an invented readiness score. A failed status refresh must show an error rather than clearance; revoked access must remove retained status. Check Arabic/dark and narrow layouts.

Open the coach recorder. Enter actual values and use each set’s check button, including keyboard activation; prescribed placeholders alone must not complete sets. Invalid/missing timed or distance results must keep the check off with an explanation. Save partial progress and reload. Finish the workout: after server acknowledgment, expect the workout review page for that same record. A failed/uncertain save must remain recoverable; navigating away during a delayed acknowledgment must not pull you back. Reopen its recorder/history to inspect attribution. Save/review a program or workout: expect one action-specific toast and no duplicate success card. Invitation/reset links and pending/error recovery remain visible because they require action.

### Weekly and automatic individual preparation

1. Open an active Athlete plan. Under Plan scheduling, expect Manual scheduling until you explicitly choose Set up scheduling. Select Weekly appointments, bounded dates, weekdays, timezone, local time and duration; save. Expect a rule-saved toast, then a separately prepared next workout. Refresh workouts after preparation; only one unresolved workout may appear for this plan.
2. Leave that workout unresolved through another selected weekday. Expect the original work to remain, with a waiting diagnostic rather than a replacement or cursor advancement. Another athlete plan should still operate independently.
3. Choose Stop future scheduling. Expect the current workout to remain. Reschedule it individually or explicitly skip with a reason; stopping the policy must not mark it complete. Re-enable/edit a future rule and check history remains.
4. Choose Automatic daily preparation and set dates/timezone. Expect a workout on an eligible current non-rest cycle day with No fixed time, not a midnight appointment. On a recovery/missing cycle day expect the recovery diagnostic. Completed/skipped or existing work on the same plan/date must not create an extra automatic workout. Work that passed while no occurrence existed is not backfilled.
5. Check an effective cannot-train restriction, lost scheduling authority and a timed collision using synthetic accounts. Expect general diagnostics and no new work. Resolve the issue and confirm a later poll recovers; do not delete positions or edit cursors. A DST repeated/missing clock must ask for a different time rather than shift it.
6. Open the calendar and list, then the day-only event. Expect the correct date, No fixed time and Open plan workouts. Switch English/Arabic and light/dark; check weekday labels and date/timezone controls on phone/desktop. Existing timed attendance/assessment flows should still work. Native offline workouts are not included in this slice.

### Events, assessments and attachments

Create a scheduled assessment or group training event with synthetic participants. For an assessment, select a template and event staff, verify timezone/start time, then open it after its start. Record attendance and applicable results with units, correct a result and inspect its history; confirm unassigned coaches remain denied. Complete only after required entries are confirmed. In Messages, send several harmless image/document attachments: inspect pending previews, send, confirm they clear and downloads work; interrupted retries must not duplicate the conversation or attachment set. These are current per-person saves, not the deferred bulk attendance flow.

### Finish athlete-started work and review bodyweight results

Have a synthetic athlete start a scheduled workout and leave it unfinished. As its authorized coach, open the plan's Resume workout action, or open the history review and choose Continue workout for athlete. Record an actual completed strength set with zero external load and positive reps, then Finish session. Expect the same workout ID, the athlete retained as original starter, and the coach identified in completion/history. Open Review workout, leave optional feedback empty and save: review should succeed without changing the actuals. Reopen as the athlete and check the coach completion notice. A stale athlete/device write must conflict rather than overwrite the coach's save. Unlinked coaches must remain denied, and new coach edits to completed self-logged actuals remain blocked.

### Due workouts and recording

1. Schedule one workout for today and another plan for tomorrow. Open your dashboard: today's workout appears under Today and overdue without selecting an athlete. Tomorrow's remains visible from its assignment details. Supporting coaches must see only their linked sports' plans.
2. Start today's workout. Expect the existing attributed coach recorder, with the scheduled plan day. Save a partial result, return to the dashboard and use Resume workout; it must reopen the same record.
3. Complete it, then reopen the plan: the next day is available for scheduling. A correction to completed actuals must not advance the plan again. Let a different occurrence become overdue: it remains actionable and does not silently skip.
4. Try an athlete with participation marked unavailable: expect a general restriction, no start action and no clinical details. Ending a started assignment must preserve its paused work for staff disposition.

5. Open Groups. A group assigned by the administrator should appear even when you did not create it. You can open its conversation; membership alone should not expose an Edit button.
6. Open Messages, choose a new authorized athlete and type. No saved-draft message should move the composer. Shift+Enter inserts a newline; Enter sends once. Repeat while a send is pending and confirm it does not create duplicates. Reload an unsent draft to verify persistence still works.
7. Open Injury status from navigation. Coaches see limited shared participation status; they do not acquire clinical details or athlete status-editing rights.

## Athlete

### My day

1. Open Dashboard: expect My day with workout cards first, Start/Resume visible without hover, upcoming events and compact food/coach panels. Workouts remain independently scoped per plan.
2. Choose Log food: expect the Food diary tab directly. Record only actual intake; guidance/example meals are separate. Return to Dashboard.
3. Choose Message beside an assigned coach: expect the existing private conversation or a single newly initiated one. Supporting coaches appear when assigned and returned by the authorized communication-contact read. Without a coach, expect a clear contact-your-administrator message.
4. Open All my workouts and Workout history, then return. Check empty data and long coach/workout names, phone/desktop, Arabic/English and both themes; athletes must not acquire staff reporting or directory access.

### Scheduled workout access

The athlete training screen should have one Your workouts heading, adjacent filled Refresh workouts and outlined Workout history buttons, and distinct preview cards. Start/Resume stays visible without hover on phones and when using a keyboard. A copied staff `/training/:assignment` link must return the athlete to their dashboard before displaying staff detail.

Open Your workouts with one future scheduled plan and one actionable plan. The future card explains that recording opens at the scheduled start time and has no Start button. Start the actionable workout, leave and resume the same record; unfinished work in another plan must not block it. An unscheduled plan explains that a coach must schedule it. Device records with pending edits remain linked under Work saved on this device even if the server read fails. Reload after acknowledged completion and confirm progression changed once. Weekly automatic scheduling, group exercise results and Android workout capture are outside this validation slice.

1. Open Programs. Only assigned programs should appear. Copy an unassigned program URL from staff and open it as the athlete: it must be rejected. Assigned program details should say Program details, not Edit program.
2. Open `/people`, `/analytics`, `/groups` and `/plans/new` directly. These staff-only screens should return you to the dashboard before rendering. Server authorization must still reject staff requests.
3. In Messages, expand Start a conversation and select your assigned coach. Send a message. Ask the coach to open your contact too; both should reach the same private conversation. Unrelated athletes must not be available as contacts.
4. Open an existing in-progress workout. Start a rest timer and switch exercises: the previous timer should clear. Try navigating away and cancel the warning; you should remain in the workout. Accept it, reopen the workout and confirm saved progress remains.
5. Record food. A dialog should open with the reference library available first for a blank entry; manual entry remains available. Save breakfast and lunch entries: each meal should have one section heading. Correct an entry, close/reopen its draft and confirm its values remain.
6. Open Injury status. Complete consent prerequisites where enabled, report participation status, correct it and close it. Staff roles retain their existing distinct permissions; this is not a clinical injury record.

## Optional participation-status walkthrough

Use a synthetic institution and athlete records. The first-run form creates the initial institution and super admin; subsequent users are added by an administrator through one-time invitation links.

1. Sign in and confirm the institution and active role.
2. As an administrator, open **Injury status** and configure consent prerequisites for a synthetic athlete. For a minor, use only the guardian-authorization attestation; do not enter guardian documents or real personal data. Confirm the administrator cannot see injury status.
3. Sign out. Sign in as that athlete, review the consent and assent prompt, and record a synthetic participation status. Then try reviewing, correcting, closing, withdrawing consent, and exporting the record. Note confusing wording, lost input, or unclear confirmation.
4. Sign out and sign in as the athlete’s designated coach. Open **Injury status** and verify that only the current participation status and effective date are visible. Confirm that unassigned athletes, prior history, and health details are not exposed, and that the coach cannot create or change the record.
5. Return to the athlete account, correct or withdraw the record, then refresh the coach view. Confirm the change is reflected and withdrawn status is hidden.
6. Note any blocked step, confusing wording, unexpected access, lost data, or unclear confirmation. Include the active role, screen, and steps that led to it.

Do not try to simulate the 12-month deletion by changing clocks or editing the database. Retention scheduling and database recovery are operational checks documented in the [verification record](../verification/README.md), not part of this manual UI walkthrough.

## What this walkthrough does not establish

- Completing it does not establish university privacy/security approval or authorize real athlete data.
- Invitation links are not delivered by email and do not verify an email address; share them only with their intended users.
- It does not test production deployment, retention alerts, physical devices, or an unaided external user.
- Seeded or manually created synthetic records are not evidence of real-world use.

Record observations without names, contact details, or health information. Send the steps and issue you observed back for review; automated tests and this walkthrough do not substitute for university policy or security review.

## Deferred work and boundaries

| Founder observation                                                        | Disposition                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Automatic group scheduling                                                 | Subsequent beta.3 group/workout slice. Additional training remains the default; group plan progression stays deferred.                                                                                                                                  |
| Coach workout launch is hard to find                                       | The fixed-time individual agenda now exposes Start/Resume from the dashboard and plan details. Recurrence, automatic/group preparation and native capture remain pending.                                                                               |
| Athlete can start arbitrary days or parallel work                          | Fixed-time individual UI now starts only the bound next workout and resumes its record. Historical unlinked reconciliation and automatic preparation remain pending; independent plans do not acquire a global lock.                                    |
| Attendance in one pass, then results for attendees, revisitable attendance | Subsequent event workflow slice. Requires atomic revision/receipt behavior and correction rules across web and offline Android. Current per-person saves remain until that replacement is complete.                                                     |
| Exercise redundancy and food-library breadth                               | Content-curation follow-up. Preserve published exercise keys/snapshots. Food already uses a USDA-derived starter list; no live USDA API or broad coverage is claimed. Review provenance, aliases, nutrition units and media rights before expanding it. |
| Supporting-coach visual polish by Sami/Claude                              | Current picker/autosave corrections are implemented. Further visual refinement can use the approved design system; the required access scope cannot become merely a visual filter.                                                                      |

## Reporting

Include role, page URL, action, expected/actual result and the failed request's response text, without passwords or tokens. Stop if unrelated private data is exposed or acknowledged changes disappear after reload. Report existing-data failures separately from synthetic-record failures.
