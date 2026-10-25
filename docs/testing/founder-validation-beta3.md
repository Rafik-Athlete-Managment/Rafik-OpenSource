# Beta.3 founder validation corrections

Status: implemented on the working release branch; founder validation pending. These checks cover the current corrections, not whole-release acceptance. Use synthetic records and separate browser profiles for administrator, coach and athlete. Keep existing data; do not reset or seed the instance.

## Administrator

### Individual workout scheduling

Use an active synthetic athlete with a published assigned plan and primary coach. Open Athlete plans and select the assignment (or follow Manage workouts from the athlete profile). In Next workouts, choose Schedule workout, set the date/time, timezone and duration, then save. Expect one scheduled occurrence after reload. Reschedule it before recording and confirm the same workout remains selected. Skip with a reason: expect the next plan workout to become available for scheduling; the skipped occurrence remains historical. Administrators should not see Start workout or acquire delegated coach privileges.

1. In People, invite a coach or athlete. After success, the large form should close and the single-use invitation link should remain visible and selectable.
2. Open an athlete's Manage tab. Select or clear the primary coach; wait for acknowledgment, reload and confirm the selection. No second save is required.
3. In Supporting coaches, browse coaches without choosing a sport first. Optional filtering sits under Filter coaches. Select a coach with one eligible specialty: it saves immediately. For several eligible scopes, explicitly choose Access scope; that choice saves. A coach without eligible coverage explains why it cannot be added. Remove a link and reload. A sport scope still limits access and must not be silently broadened.
4. Create a group with athletes and coaches. On medium/large widths, the two selectors should sit side by side; on a phone they should stack. Sign in as the assigned coach to verify visibility.
5. In Messages, expand Start a conversation. Open an unstarted group, return to the directory and confirm it is no longer offered as a new group. Reopen the existing conversation and confirm there is only one channel.
6. Add exercises to a program. Available videos should have a video-camera indicator; still illustrations must not receive that indicator.

## Coach

### Due workouts and recording

1. Schedule one workout for today and another plan for tomorrow. Open your dashboard: today's workout appears under Today and overdue without selecting an athlete. Tomorrow's remains visible from its assignment details. Supporting coaches must see only their linked sports' plans.
2. Start today's workout. Expect the existing attributed coach recorder, with the scheduled plan day. Save a partial result, return to the dashboard and use Resume workout; it must reopen the same record.
3. Complete it, then reopen the plan: the next day is available for scheduling. A correction to completed actuals must not advance the plan again. Let a different occurrence become overdue: it remains actionable and does not silently skip.
4. Try an athlete with participation marked unavailable: expect a general restriction, no start action and no clinical details. Ending a started assignment must preserve its paused work for staff disposition.

5. Open Groups. A group assigned by the administrator should appear even when you did not create it. You can open its conversation; membership alone should not expose an Edit button.
6. Open Messages, choose a new authorized athlete and type. No saved-draft message should move the composer. Shift+Enter inserts a newline; Enter sends once. Repeat while a send is pending and confirm it does not create duplicates. Reload an unsent draft to verify persistence still works.
7. Open Injury status from navigation. Coaches see limited shared participation status; they do not acquire clinical details or athlete status-editing rights.

## Athlete

### Scheduled workout access

Open Your workouts with one future scheduled plan and one actionable plan. The future card explains that recording opens at the scheduled start time and has no Start button. Start the actionable workout, leave and resume the same record; unfinished work in another plan must not block it. An unscheduled plan explains that a coach must schedule it. Device records with pending edits remain linked under Work saved on this device even if the server read fails. Reload after acknowledged completion and confirm progression changed once. Weekly automatic scheduling, group exercise results and Android workout capture are outside this validation slice.

1. Open Programs. Only assigned programs should appear. Copy an unassigned program URL from staff and open it as the athlete: it must be rejected. Assigned program details should say Program details, not Edit program.
2. Open `/people`, `/analytics`, `/groups` and `/plans/new` directly. These staff-only screens should return you to the dashboard before rendering. Server authorization must still reject staff requests.
3. In Messages, expand Start a conversation and select your assigned coach. Send a message. Ask the coach to open your contact too; both should reach the same private conversation. Unrelated athletes must not be available as contacts.
4. Open an existing in-progress workout. Start a rest timer and switch exercises: the previous timer should clear. Try navigating away and cancel the warning; you should remain in the workout. Accept it, reopen the workout and confirm saved progress remains.
5. Record food. A dialog should open with the reference library available first for a blank entry; manual entry remains available. Save breakfast and lunch entries: each meal should have one section heading. Correct an entry, close/reopen its draft and confirm its values remain.
6. Open Injury status. Complete consent prerequisites where enabled, report participation status, correct it and close it. Staff roles retain their existing distinct permissions; this is not a clinical injury record.

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
