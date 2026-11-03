# Instance validation walkthrough

## Tonight's validation route

Use this guide with the same source branch/backend as the app you are testing. The published beta APK does not include unreleased beta.3 changes. No step requires resetting or reseeding the database.

1. Run the applicable [administrator](#administrator), [coach](#coach) and [athlete](#athlete) web walkthroughs. For group workouts, use the detailed [template and group-workout flow](#workout-templates-and-group-workouts--unreleased-beta3).
2. For unreleased phone recording, follow [phone navigation and saved library](#phone-navigation-and-saved-library--unreleased-beta3), [native individual workouts](#native-individual-workouts--unreleased-beta3) and [native group workouts](#native-group-workouts--unreleased-beta3), then run the [physical-phone, encrypted-storage and offline-recovery checks](#physical-phone-encrypted-storage-and-offline-recovery--unreleased-beta3).
3. Use the [signed APK upgrade check](#signed-android-upgrade--requires-a-new-release-candidate) only when there is a newer signed candidate APK. It cannot be tested using the same installed APK or the published beta.2 artifact.

Group workout recording is implemented in the unreleased phone source as well as the web workflow. Device rendering, offline recovery and a signed upgrade remain to be validated before beta.3 release.

### Phone navigation and saved library — unreleased beta.3

Use a matching beta.3 source app/backend and a synthetic coach with a downloaded solo workout, group workout, assessment and another event. Keep an administrator and athlete account for the existing role checks. The published beta.2 APK does not include this navigation.

1. Open **Schedule**. Expect its selected day to show scheduled solo/group workouts, events and assessments in one list, five at a time, with no action buttons inside cards. Use the filter sheet to change day/type/order, then return. With an empty day, expect one icon-led empty state and a date/filter action, without a second alert. While disconnected with no downloaded activities for that day, expect a quiet empty state rather than a repeated sign-in or refresh prompt.
2. Use the floating **Schedule / Workouts / Saved** bar. **Workouts** shows one searchable, paginated solo workout list; a downloaded workout appears once with its download/sync state. **Saved** shows local events, assessments, solo workouts and group workouts under All/Workouts/Events/Assessments. A group event appears once even when several athlete sheets were downloaded. Check an empty Saved filter: **Show all saved** changes the filter, while a wholly empty library offers **Browse workouts**. No duplicate alert should demand the same action.
3. Open a saved event and a workout in turn. The floating bar should disappear in focused preview, attendance, results and recording steps. Close and return to the same selected tab with saved device work intact. Start an event or workout draft, open full-screen **Settings**, then close it: selection, date, inputs and scroll state should remain. Check Android Back from a root tab returns to Schedule; Back/Close within work should not discard saved drafts.
4. In **Settings → Connection & Sync**, inspect local event/sheet counts, queued upload status and last checked server reachability. Disconnect Wi-Fi/mobile data **and USB forwarding**, reopen the app, and confirm Saved opens without network and the app bar gives one quiet Offline indication. Routine offline use must not repeat sign-in instructions or access toasts. Reconnect and use the app bar Refresh once; it is the only refresh action beside a dismissible text notice. Resolve a deliberately blocked upload through the existing review controls; dismissing a notice must never discard it. The settings sync action must use the same existing queues and must not claim server completion until acknowledgment.
5. Inspect these states on a physical phone in English/Arabic and light/dark: populated and empty lists, a long athlete name, filter sheet, full-screen Settings, open attendance/results and workout sheets, short screen height and keyboard. Check RTL order, contrast, touch targets and that the floating bar never covers the last card. Repeat offline restart and online recovery with the same account; a different account must not see the first coach's saved records. Administrator and athlete accounts must not gain coach recording access.

Report app/backend revisions, phone/Android version, role, language/theme, selected tab/day, network and USB state, expected/actual result and exact error text. Do not send private records or credentials. These are requested device checks, not claims of completed phone acceptance. There is no general notification inbox in this source: immediate actionable errors stay with the active step and persistent saved/upload state belongs in Saved or Connection & Sync.

### Phone daily workspace and event steps — unreleased beta.3

Use a synthetic coach with at least six timed events across today and another date, including a group workout and an assessment. Use a matching source app and backend; the published beta.2 APK does not have this layout.

1. Install a development client rebuilt with the current SVG dependency, then open the app. Expect one compact app bar and a single day schedule with event, assessment and plan-workout cards, without buttons inside the cards. Today shows five cards before **Load more**. Tap the Lucide filter icon: a bottom sheet changes date, type and order. Try a day-only plan workout and check that it says **No fixed time**. Open Settings using the gear, change language, close with X, and confirm the same schedule date and any open draft survive. Inspect the sign-in, schedule, settings, attendance, assessment, workout recorder and completion screens in English/Arabic and light/dark at a narrow phone width and a short phone height; check near-black contrast, icon consistency, RTL order, touch targets and keyboard clearance. Refresh warnings should be short and dismissible; blocked saved work should show a compact Review saved work link without automatically opening recovery controls. Trigger a sync failure and an attendance validation warning: only one notice should occupy the screen at a time, and important work must remain recoverable after dismissal. Reload and confirm saved offline events and workouts remain reachable.
2. Open an event. Expect its preview, time/status, available roster count and group exercise names before logging. The home settings action should disappear. Choose **Start attendance** after the event start; **Close** should leave saved work available for later. The refresh icon must not erase an unsent draft, and any warning should be dismissible.
3. Mark each active participant. Attendance rows should stay compact; history/corrections open only on request. Try **Next** with an unmarked athlete: expect the outstanding count and no navigation. Disconnect Wi-Fi/mobile data and USB forwarding, mark all athletes and choose Next: expect the saved marks to remain but the step to wait for server confirmation. Reconnect and confirm that Next opens only after replay; the event must not become server-completed from device-only marks. Do not attempt a second correction while the same athlete's earlier command is unresolved; resolve that command first.
4. For the assessment, Next opens a distinct results step. A present athlete's result action should be visible directly, without opening history. Enter a numeric and a text metric where defined, close/reopen the editor and confirm the device draft remains. A missing required value, unsent draft or pending command must still block **Finish event**. Return to attendance and verify marks persist; after reconnect, confirm results and event completion on the web. For a group workout, Next opens one workout preview, then the first present athlete's sheet. The fixed athlete selector stays reachable while the sheet scrolls. Switch athletes, force-stop and reopen, then verify each draft stayed with its own athlete.
5. Finish a workout while offline. Expect **Finished on this device** and a return action; no claim of server confirmation. Reconnect and let exact requests replay. Once acknowledged, expect the confirmed read-only summary with completed set count and time. Finish the group event only after each present athlete is resolved on the server. Verify the web event and athlete histories contain one result each and no duplicate plan progression.

Report the app/backend revision, phone/Android version, language/theme, event ID, network and USB forwarding state, step, expected/actual outcome and exact error text. Do not send private results or credentials. This source walkthrough is a founder acceptance request, not a claim that the phone has been rendered or tested for this change.

For a missed, untouched custom or group event, open its detail as the designated coach or an administrator and choose **Reschedule**. Pick a future time and confirm; the same event should move on the calendar with a higher revision. Repeat with an event that already has attendance, an assessment result or a started workout: Reschedule must be unavailable, and the server must reject a direct attempt. An individually bound plan workout continues to use its own plan scheduling action.

## Native group workouts — unreleased beta.3

Prerequisites: matching branch backend and native source app, a designated coach, two synthetic athletes marked present in a group training event, and an administrator for review. Keep the event's frozen workout template and time visible on the web. The published beta.2 APK cannot run this source flow.

1. As coach, open the group training event in **Schedule** while online. Opening or refreshing it should save attendance and all participant workouts together. The app navigation tabs should disappear while the event is open; the event preview leads to step 1, Attendance. Mark each athlete present, absent or excused. **Next: record workouts** requires a mark for every active athlete and at least one present athlete; device-saved offline marks stay pending; Next waits for server confirmation to preserve workout-start order. If nobody is present, finish from Attendance instead. After Next, the header shows step 2, Workouts; **Back to attendance** permits review. A shared workout preview precedes the first athlete sheet. The fixed collapsible searchable athlete selector remains above the scrolling sheet. Prescribed strength/time/distance targets are references, not completed actuals. A custom training event saves attendance without pretending it has workout sheets. If a sheet cannot be updated, expect an explicit partial-download message and the older device draft intact. Refresh the event before going offline so downloaded start permission reflects confirmed attendance.
2. Before the event time, Start is disabled. After the start, disconnect Wi-Fi/mobile data and USB forwarding. Open one athlete's downloaded sheet, start provisionally, enter measured actuals and mark each set done. Switch to the second athlete through Change athlete, then return: the first athlete's values and note must remain. Invalid numeric input or a failed device save must block switching. Finish one sheet offline; it should say finished on device and awaiting confirmation, without requiring a separate progress-save or sync action.
3. Force-stop and reopen the app offline. Find the downloaded group event/sheets and confirm the same participant drafts and queued operation IDs survive. Reconnect; automatic foreground retry or the header Refresh action should send the group start to `/v1/institution/group-workouts` first, then result saves to `/v1/institution/sessions`. Expect a read-only completion summary at the top and Back to attendance. Confirm one session per athlete, correct coach attribution and no change to individual plan cursors. Check another account cannot see or send the first coach's device sheets.
4. On a separate synthetic sheet, start it on the web before the offline phone start replays. Expect the phone to retain its recording for explicit review, without adopting the competing server session. Deny event access or mark the athlete unable to train before another replay; expect a paused, retained draft. Confirm another independent sheet can still sync. Administrators and athletes must not receive the coach's native recorder; athletes may view only their own results on web.
5. After all present athletes' workouts are server-confirmed, use **Finish event** at the bottom of the phone workout step. The server must refuse it while a present athlete still has an unresolved workout; a device-only draft must never count as completion. Confirm the event summary appears after acknowledgment. Use **Close** before finishing and reopen the same event to verify saved work remains. If a participant needs an explicit **Skip with reason**, use the web flow, then refresh on the phone; the phone still does not edit participant workouts or skip them.

Report app/backend revisions, phone model/Android version, event and participant IDs, connection/USB state, expected/actual result and exact error text. Do not include private workout results or credentials.

## Native individual workouts — unreleased beta.3

Prerequisites: matching release-branch backend and an installed native development client using this source (`npm run mobile:start`); separate synthetic administrator, coach and athlete accounts; no database reset or reseed. The published beta.2 APK does not contain this source update. Use clearly named test records and existing signing/encryption identities. Rendered/native acceptance is still pending; Node/API evidence is separate.

### Administrator preparation

1. Create or reuse a clearly named program containing a strength exercise, a timed exercise and a distance exercise. Assign it to a synthetic athlete with the correct primary/supporting coach scope. Schedule its next workout for today using the normal web flow; include a future start time for the timing check. Prepare a second independent plan or athlete for the scope/regression check.
2. Keep the existing Schedule/People/plan detail available for review. Administrators may schedule/review, but must not gain native coach recording access. An athlete account must not receive trainer field packages. Group recording and assessment flows remain unchanged by this individual slice.

### Coach download and capture

1. Sign into the matching native source app as the assigned coach. Open today's workout directly from its Schedule card. For another date, choose it in the filter sheet; **Workouts** in the bottom bar reaches the searchable download list and overdue or saved work. Download a workout, return to Schedule and reopen Workouts; expect its list to load again. The workout name leads, with program/athlete below, and the saved record should not appear as a second download card. With sufficient fixtures, page saved and online results past ten and return/search again; select the later-page record without losing it.
2. Before its scheduled instant/date, expect Start disabled and the booking-time explanation. Download the first workout online, then disconnect Wi-Fi/mobile data **and USB forwarding** before testing actual offline behavior. Open the saved copy without waiting for a network response. Date-only plan work uses its source timezone/date; it must not invent a midnight appointment.
3. Once eligible, choose Start on this device. Expect a provisional, unconfirmed start. Enter zero load with positive reps for bodyweight work, an actual positive duration and fractional distance. Prescribed targets stay separate from actuals; timed/distance fields require actual entry on a new start. Mark each set Done. Invalid values must not be marked complete or submitted; an unfinished set must prevent Finish. Decimal input must retain the decimal point while typing.
4. Leave and reopen the saved workout after editing. Expect entries/note retained without a persistent saved banner; the optional note sits after the exercise list. Choose Finish workout while disconnected, then restart the app. Expect the same owner/workout/request and a device-only completion summary with a return action, not a server-confirmed summary. Optionally test Send progress now under Sync unfinished progress before Finish; both requests should replay in order. Open a previously downloaded attendance/assessment event and switch views: its editor/drafts must remain intact.

### Coach reconnect and recovery

1. Reconnect and wait for foreground retry; the header Refresh action retries saved work if needed. Expect the original start to be acknowledged before result dispatch. Confirmed completion becomes a read-only summary at the top with a return to Schedule or the workout browser. Reload/sign in to the same account: the saved summary stays available; another account or institution URL must not adopt it. Do not require a replacement workout or clearing device data.
2. In a controlled test, disconnect after dispatch before acknowledgment, then retry. Expect the same operation/payload and one server workout/completion. A later edit during a progress save must remain a separate unsynced draft rather than being marked acknowledged with the earlier request.
3. For a separate synthetic record, change permissions/training restriction or modify results on web before sync. Expect denial/conflict with all local actuals retained and a small Review saved work link. Open the workout ellipsis options sheet for detailed recovery. Retry exact saved request performs a fresh access check and never invents a replacement start. Share recovery only with authorized staff; cancel sharing once. For a definitively rejected save, review the current server version, cancel replacement once, then explicitly replace only when willing to discard that draft. Unknown starts cannot use this shortcut.
4. Restore authorized access on an unchanged record and use Recheck workout access; expect the draft retained. If the server revision changed, require review rather than overwriting it. Remove only a clean downloaded copy and verify server history remains. Unsupported/downgraded server capability must pause workout replay without clearing attendance, assessment or workout queues. Simulate downgrade only in an owned test environment.
5. Start-conflict check (separate synthetic record): download an eligible workout, disconnect, start and record it on the device, then start the same workout for that athlete on web before reconnecting. After sync, expect the device record to show “already started on the web or another device” and need review, with its actuals retained and no adoption of the web session. A second downloaded workout saved later on the same device must still sync. Reconcile the recovery copy on web; do not expect automatic merge.

### Athlete and administrator review

1. As the athlete on web, open the completed workout. Expect the actual zero load/duration/distance, note and coach attribution. The plan advances once; other independent plans do not advance. Native coach recording must not become athlete self-recording.
2. As administrator, review the same history/plan/calendar. Expect one occurrence/workout, retained prior history and no duplicate progression. Existing athlete-started unfinished work may still be finished by an authorized coach under ADR 0031; completed self-logged actuals retain their protection.

Report app/backend revisions, role, workout/occurrence ID, expected/actual behavior, connection/USB state and exact message. Do not include passwords, tokens or signing material. Group capture has its own section above; media download, native alternative selection, full historical reconciliation and physical upgrade packaging remain outside this slice.

## Physical phone, encrypted storage and offline recovery — unreleased beta.3

This check exercises the current native source on physical hardware. It does not require an emulator. Use a synthetic coach and athlete, a matching local backend, and a Galaxy S20+ or another Android phone. Record the phone model and Android version. A development build and a release APK are different artifacts; the published beta.2 app cannot validate beta.3 source changes.

### Start the source app on a USB-connected phone

1. From the repository root, start the local database/API and web dashboard using [Start the local app](#start-the-local-app). Complete migrations through the normal startup flow and prepare a synthetic coach, athlete, event and eligible individual workout. Assign the coach to the relevant athlete/event. Keep the API listening on `127.0.0.1:55331`.
2. Connect and unlock the phone with USB debugging enabled. In PowerShell at the repository root, confirm the phone is authorized and forward only the local API port:

   ```powershell
   $rafikAdb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
   & $rafikAdb devices -l
   & $rafikAdb -d reverse tcp:55331 tcp:55331
   ```

   The device should show `device`, not `unauthorized`. On Linux/macOS, use `adb devices -l` and `adb -d reverse tcp:55331 tcp:55331`.

3. From the repository root, build and install the current native development client on that phone:

   ```sh
   npm run mobile:android -- --device
   ```

   Keep the Metro terminal running. If the build is already installed and only JavaScript changed, start Metro with `npm run mobile:start`; do not rebuild for every JS-only edit. The first native build requires the Android SDK/JDK configured for this checkout. Expo Go is not supported because this app requires SQLCipher.

4. Sign in to Rafik Field using `http://127.0.0.1:55331` and the synthetic coach. The USB reverse rule lets the phone reach the laptop's local API. Open the schedule and download the event and eligible workout while online.

### Check SQLCipher startup and stored work

1. On first launch, wait for **Opening encrypted field storage** to finish. The coach schedule should open. If the app reports **Encrypted storage is unavailable**, stop: this build did not pass the SQLCipher runtime check and must not store field records.
2. Record attendance on the downloaded event and enter a recognizable synthetic assessment value. On the individual workout, start it and enter a recognizable note/value. Wait for the device-save acknowledgment before going offline.
3. Turn off Wi-Fi and mobile data. Remove USB forwarding while leaving the cable connected:

   ```powershell
   & $rafikAdb -d reverse --remove tcp:55331
   & $rafikAdb -d reverse --list
   ```

   Confirm the `55331` rule is absent. Airplane mode by itself is not enough while ADB forwarding remains enabled.

4. Force-stop Rafik from Android **Settings → Apps → Rafik Field → Force stop**, reopen it, and sign in only if the app requests the same account's credentials. Reopen the downloaded event and workout. Expect the device-saved values and pending state to remain, clearly distinct from institution-confirmed data.
5. Sign out only after confirming pending work is retained. Sign in as a different synthetic coach on the same instance; the first coach's event/workout drafts must not appear or be replayable. Sign back in as the original coach and confirm the drafts are still available. Do not clear app data, uninstall the app, or change account ownership to recover a pending item.

### Reconnect and verify recovery

1. Restore the local API connection and USB forwarding:

   ```powershell
   & $rafikAdb -d reverse tcp:55331 tcp:55331
   ```

   Reconnect the laptop/API and phone to the network. Use the app's normal access refresh and sync/retry actions.

2. Confirm the original saved requests reach the server once. Open the web event/workout history and verify the expected values, coach attribution and completion state. Retry a confirmed request only through the app's normal retry path; there must be no duplicate event result or workout completion.
3. For one synthetic item, interrupt connectivity during sync. The item must remain pending/uncertain until the app resolves it with the same command identity. Do not clear it or create a replacement command merely because the response was delayed.
4. If a definitive authorization/revision conflict occurs, use the app's review flow. Verify the device copy remains until an explicit decision; an access denial or a successful unrelated request must not clear the warning.
5. After all test commands are acknowledged, remove only the synthetic records you created through normal application controls. Remove the USB reverse rule with `& $rafikAdb -d reverse --remove tcp:55331`.

This walk-through checks fail-closed SQLCipher startup, persistence through a forced app stop, account separation and server recovery. It does not prove resistance to a rooted device, forensic extraction, key loss or Android backup restoration. The app has no remote wipe; uninstalling/clearing app data or losing its SecureStore key can make unsent records unrecoverable. Never use real athlete data for this check.

## Signed Android upgrade — requires a new release candidate

This is a release-candidate gate, not a beta.3 task that can be completed with the published beta.2 APK. Wait until there is a newer standalone APK signed with the same existing Rafik release key, with a strictly higher `android.versionCode`, and with matching non-secret `build.json` and `SHA256SUMS`. Follow [Android beta builds and updates](../operations/android-release.md#upgrade-without-losing-saved-work) to identify the artifacts. Do not generate a new key, uninstall the old app, clear app data or install a lower version code.

1. On a dedicated test phone, install and open the previous accepted signed APK. Record its version, version code and checksum. Sign in as a synthetic coach and download a test event/workout.
2. While online, create a device-saved but unsynced synthetic attendance/result or workout draft. Confirm the UI says it is saved on the device and still pending.
3. Install the newer candidate over the existing app using Android's update prompt, or from the repository root with the candidate APK path:

   ```powershell
   & $rafikAdb -d install -r "<path-to-new-signed-candidate.apk>"
   ```

   Android must update the same `org.rafik.field` app. If it reports a signature mismatch, stop; do not uninstall to bypass it.

4. Launch the updated app without clearing data. Confirm the account, downloaded record and unsent draft remain. Repeat the offline cold-start check: disable network and remove ADB forwarding, force-stop the app, reopen, and verify the pending values.
5. Reconnect, sync through the normal UI and verify the server receives the result once. Confirm history, revision, event/workout completion, and that later edits remain pending until separately acknowledged.
6. Compare the installed candidate version/versionCode and APK checksum with its `build.json` and `SHA256SUMS`. Record old/new source revisions, APK checksums, phone/Android version, offline state and pass/fail for each step.

Installing the same APK again with `-r` is only a reinstall check. It does not test an upgrade. A development build, emulator-only check or earlier beta.1 upgrade does not substitute for this check on a new signed release candidate.

## Android compatibility foundation — unreleased beta.3

Prerequisite: a matching source development app already installed, the updated backend and a synthetic coach account. This slice does not require a new native dependency or prove a release APK upgrade. Administrators can inspect the authenticated API contract, while the field UI remains coach-only; athletes gain no new recording access.

1. As the coach, open **Settings → Connection & Sync**. Expect attendance, assessment results, event completion and individual/group workout recording supported. Day-only appointments in the timed attendance calendar remain unavailable; the day-filtered individual plan-workout projection can show date-only workout packages. Close Settings: normal card selection remains unchanged.
2. Open a previously downloaded synthetic event, save an attendance change while offline and return to the schedule. Open Connection & Sync and choose **Refresh and sync**: expect a connection message, not a version or permission claim. The saved event/change must remain present. Returning to its editor must retain the pending work.
3. Reconnect and check again. Expect current capabilities without clearing separate permission/session warnings. Open the saved event and use the existing sync/review flow; capability discovery itself must not send or discard its command.
4. For a developer-controlled older or mocked server returning `404 not_found`, expect the version-check explanation, with saved work retained. A denied/revoked session must show its own authentication/access explanation rather than reporting a legacy server. Do not change a real institution's server merely to simulate this condition.

Record app/backend revision, account role, connection state and exact failure text if these checks fail. Rendered Android acceptance remains pending; Node parser/API tests are separate evidence. Use the individual and group workout sections above for recording validation.

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

### Preferred timezone and navigation clock — unreleased web change

1. For each synthetic administrator, coach and athlete account, save a timezone different from the device's zone in personal Settings. Expect the desktop clock and zone label to change after acknowledgment; on a phone open the navigation menu to find the clock. The clock links back to Settings. Reload and sign out/in: the preference must persist for that account without carrying another account's preference across sign-in.
2. Open the same clearly named timed event/workout before and after changing zones. Its displayed time/date should change consistently in its summary, calendar and history, while the stored booking and prescription stay the same. Use an event near midnight to check which calendar day contains it. Messages, notifications and activity dates/times should follow the same preference.
3. Date-only workouts and plan/nutrition dates must retain their original date. In a booking/recurrence editor, verify the explicit authoring zone and local time remain unchanged until deliberately edited.
4. Check English/Arabic, light/dark, desktop/phone, keyboard access to the clock and compact footer links. This does not validate Android or change training eligibility.

## Sign-in and calendar feedback — unreleased beta.3

Use the synthetic accounts prepared above; no reset is needed.

1. Sign out and sign in again. While the request/account loading is pending, expect a spinner, Signing in text and a disabled submit button. A slow response must not look like idle input. With reduced motion the busy label remains useful without continuous rotation. If sign-in fails, expect the error and an enabled retry button, with no duplicate submission from pressing Enter repeatedly.
2. As administrator or designated coach, finish a synthetic individual workout, resolve/finish a group event and finish an assessment through their existing flows. Open Schedule in month and list views: completed items should have a distinct completion border/check marker and a Completed tag on booked cards. An unfinished event remains Scheduled even if its appointment is in the past. A group is completed only after explicit event finish, not just because one participant finished.
3. On a phone, expect completion counts in month cells and readable status badges on booked cards. Check English/Arabic, both themes and keyboard access; the status must be understandable without color.

Automatic three-day sealing is **not implemented in beta.3**. Its [next-release specification](../requirements/record-sealing.md) is planned work; do not expect lock/unseal controls during current validation.

## Administrator

### Workout templates and group workouts — unreleased beta.3

Prerequisites: one administrator, one coach assigned to two synthetic athletes, and a second coach who is not staffed on the test event. Use names such as **Validation — Field strength**. Apply the matching forward migrations using the startup procedure above; do not reset existing records.

1. As administrator, open **Workout templates** and create a template. Before adding exercises, expect one empty card containing Add exercise. Add one strength and one timed/distance exercise, set their prescribed targets, then save. Expect consistent label/control gaps, full-width Add exercise below the list, Save/Cancel in a separated footer and a clear saved preview. On a phone, name fields stack and actions remain reachable. Reload: the saved template remains. Edit/archive/restore it; use the directory’s **Active / Archived** tabs above search/pagination to find it, confirm each tab lists only its status and switching tabs resets pagination. Existing program copies must be unchanged. Staff can browse shared templates, but another coach cannot edit the creator’s template.
2. Choose **Use in a new program**, or import from the program/athlete-plan editor. Expect an independent workout copy with its own identity. Change the copy and save/publish through the existing flow; reopen the template and verify it is unchanged. Import into a later cycle slot as well as an empty program. Existing plan policies and already scheduled prescriptions must remain unchanged.
3. Open **Schedule an event → Group workout**, select the template, choose the two athletes (or an authorized group's members) and designate a coach. Review the dates/roster and create. Expect the event in the calendar/list. Later group membership changes must not change its roster. Edit/archive the original template: the event retains the original baseline.
4. Open the event before its start. Expect a time explanation, no recording action and no ability to finish without attendance/results. Administrators can review and manage the event but cannot record athlete actuals.

As the designated coach, once the scheduled start time arrives:

1. Open the group event: expect **Attendance** at the top with marked/total counts. Mark all present, adjust one athlete if needed and save once. Open **Workout recording**. On desktop select the first athlete from the searchable roster; on a phone use the searchable athlete selector. Expect one shared workout preview, collapsed by default, containing its description and media. Open or close it, switch athletes and reload: your choice must remain; selecting an athlete must never reopen it. On desktop scroll a long recording sheet: the athlete roster must remain reachable, with search and pagination fixed around its scrollable names. Check keyboard scrolling on a short window. Adapt the selected athlete before **Start recording**; the shared baseline and second athlete must remain unchanged.
2. Record actual reps/load/seconds/metres and use explicit set-completion checks; zero load is valid. Enter a note without submitting, select another athlete and return, then reload: the draft and selected athlete must remain. Save progress and confirm acknowledged values persist. Finish: expect review within the group event, with roster/selector still available. Save optional feedback, choose **Record next athlete** and record the other participant without returning through history. Revisit Attendance and return without losing the selected sheet. Inspect coach attribution/history. An individual plan cursor must not advance. If a local draft is older than the server revision, expect a warning rather than its silent application; test only with synthetic records. Pending/uncertain writes must prevent athlete switching until resolved.
3. Try finishing the event while the other present athlete has no result. Expect a clear completion requirement. Complete their workout or **Skip with reason**; do not put health details in the reason. If a workout was already started, skipping must retain its partial history. Finish the event once all required outcomes are resolved.
4. Check an applicable cannot-train status prevents starting, an absent athlete cannot start, and an inactive athlete's existing history remains available. A newly staffed coach can continue authorized work; removing the original coach must block their reads/writes and old-command replay. Keep current role/staff boundaries when reviewing completed work.
5. In a disposable test account, interrupt a start/save response after server acknowledgment. Reload and retry the saved exact command. Expect one participant record/history version, the acknowledged revision and a working subsequent save; do not discard pending work. A separate competing start should require refreshing the existing record rather than silently replacing its prescription.

As each athlete:

1. Open the event and **View workout**. Expect the shared prescription and only your own result/skip status. No participant editor, coach feedback form or recording action should appear. Opening another athlete's result URL must be refused.
2. Verify own individual workout start/history still works independently, and the group record cannot be edited through the athlete workout route. An unrelated coach must not gain access merely by knowing the event/result URL.

Inspect English/Arabic, both themes, desktop/phone, no-match searches and later participant/library pages. Record pass/fail/not checked using the guide's failure-report format. Group plans and workout sections are deferred. For native participant sheet capture, use [native group workouts](#native-group-workouts--unreleased-beta3); explicit skip and participant adaptation remain in the web workflow.

### Shared exercise cards — administrators and coaches

Prerequisites: use the saved synthetic template and program from the checks above.

For the shared exercise editor, also validate:

1. As the template creator or administrator, choose a primary exercise, add three same-type alternatives through search and confirm the visible list. A fourth choice, duplicates, the primary movement and incompatible recording types must not be offered. Remove one alternative and add it again; changing the main exercise clears its old alternatives. Keep zero load valid and verify timed/distance units.
2. Save/reload the template and import it into a program. Expect the same exercise cards, alternatives and notes; save/reload that program and verify its independent copy. Check reordering, pairing/group labels and per-set targets remain available.
3. For a movement with media, expect a compact thumbnail beside its identity on large screens and a labelled preview action on a phone. Open the media dialog, inspect source credits, close with Escape and verify focus returns. Repeat from template/program previews and participant adaptation; closing media must leave the participant editor open. Missing media must not produce an invented thumbnail.

### Institution overview

1. Open Dashboard: expect Institution overview with the reporting-period control and Open full analytics beside the Participation and activity heading, then period metrics before administrative detail. Switch 7/28/90 days; wait for the returned dates to match. No records should show honest chart empty states, not example data.
2. Compare completed workouts with recorded completions in the selected period. Participation counts distinct currently active athletes with a completion, over the active roster now; it is not attendance or compliance. Attendance counts athlete-event entries for started non-cancelled events, including unknown/unmarked entries.
3. Follow coverage links to People and coaches. The Administration panel lists People & access, Athlete plans, Institution settings and Activity; check each opens. Invite people and the persistent invitation link remain reachable. Admins must not gain coach recording or injury-detail access.
4. Interrupt a report refresh: expect an error and retained results with their original dates. Retry and confirm recovery. Inspect phone/desktop, Arabic/English and both themes.
5. In People & access, each person's name opens their profile; each row has a Message icon and a labelled Manage button that opens the Manage tab.
6. Open Activity: changes are grouped by day with a time, a plain description (for example Attendance recorded or Workout scheduled), the affected member where there is one and "by" the member who acted. Show earlier activity loads older entries.
7. In Institution settings, add a sport: choose Sport or Coaching specialty first, then type the name; the button reads Add sport or Add specialty.

### Prepare an assigned program

Create an empty program, add real exercises and prescriptions, review and publish it. Choose Assign this program for a synthetic athlete with an assigned coach. Confirm the published version is fixed and assignment is explicit. The assigned coach should find it in Athlete plans; an unrelated coach must not acquire assignment or recording authority. Use this record for the scheduling and recording checks below.

### Assigned-plan presentation

Open Athlete plans, search/page the directory and select a plan. Expect a dedicated page with labelled icon actions. Choose Adapt athlete plan: its editor has Plan name and one Apply changes to athlete plan action, without library Publish/Assign controls. Edit the prescription, reload and confirm draft recovery, then apply. Expect the same assignment ID, a Personalized plan revision label and the updated future prescription; no new library program/version. Already scheduled/started workouts keep their original prescription. Leave an acknowledgment uncertain, reload and retry the exact saved request; expect one adaptation. In Programs, regular Save draft/Edit retains its program ID; only an explicit copy action creates another program. End plan and cancellation/removal actions remain red.

### Individual workout scheduling

For the unreleased scheduling-entry slice, use a clearly named active synthetic assignment with no scheduled or unfinished workout. As an administrator, open Schedule → Schedule an event: expect Workout from a plan selected, athlete-name search and at most 10 planning rows per page. Search a nonexistent name, then the athlete's name; clear it and check paging when enough assignments exist. Choose Schedule workout, set date/time, timezone and duration, then save. Expect the calendar and exactly one occurrence attached to that same assignment/day after reload, with no second event-name prompt. Return to creation: the newly scheduled assignment must leave the planning queue. Find it in Athlete plans to reschedule or skip. Administrators must still have no coach recording privilege.

Repeat as the assigned coach; an unrelated or out-of-sport supporting coach must not gain access. Interrupt a scheduling acknowledgment after submission, reload and retry its saved command: expect one occurrence, no duplicate or lost recovery. Navigate away while acknowledgment is delayed: the write may complete, but it must not pull you back. Switch to Custom event and expect the existing named attendance flow; choose Assessor-led assessment and expect the template/people/review flow. Reload an existing custom draft or follow a makeup link: expect it restored. Athletes keep their existing authorized schedule view and must not gain the staff creation page. Check the choice cards, search, side panel and actions in English/Arabic, both themes and phone/desktop layouts. Group workout results and Android workout capture are outside this slice.

Use an active synthetic athlete with a published assigned plan and primary coach. Open Athlete plans and select the assignment (or follow Manage workouts from the athlete profile). In Next workouts, choose Schedule workout, set the date/time, timezone and duration, then save. Expect one scheduled occurrence after reload. Reschedule it before recording and confirm the same workout remains selected. Skip with a reason: expect the next plan workout to become available for scheduling; the skipped occurrence remains historical. Administrators should not see Start workout or acquire delegated coach privileges.

1. In People, invite a coach or athlete. After success, the large form should close and the single-use invitation link should remain visible and selectable.
2. Open an athlete's Manage tab. Select or clear the primary coach; wait for acknowledgment, reload and confirm the selection. No second save is required.
3. In Supporting coaches, browse coaches without choosing a sport first. Optional filtering sits under Filter coaches. Select a coach with one eligible specialty: it saves immediately. For several eligible scopes, explicitly choose Access scope; that choice saves. A coach without eligible coverage explains why it cannot be added. The chosen coach stays checked and enabled in the same list; no second selected-coach list appears. Uncheck the coach to remove its linked scopes and reload. Primary and supporting selectors share this in-list convention. A sport scope still limits access and must not be silently broadened.
4. Create a group with athletes and coaches. On medium/large widths, the two selectors should sit side by side; on a phone they should stack. Sign in as the assigned coach to verify visibility.
5. In Messages, Chats lists existing conversations and Contacts lists groups and people. Type in the search box without pressing Enter and confirm the current tab narrows as you type. From Contacts, open a person: the chat opens and Chats is selected. Open the same person again from Contacts (now marked Open chat) and confirm it reopens the same conversation rather than creating another. On a computer, opening a chat or contact puts the cursor in the message box so you can type immediately. In the open chat, confirm the attach buttons, privacy note and Send sit on one row and there is no empty space below the composer on a tall window. For an administrator, switch Include institution conversations on: discoverable unjoined channels appear alongside joined conversations, with Join and no preview/unread count until joining. Joined conversation previews remain available. Check tab keyboard navigation in English and Arabic and preserve the inbox when selecting a thread.
6. Add exercises to a program. Available videos should have a video-camera indicator; still illustrations must not receive that indicator.

## Coach

### Dashboard, scheduling and completion controls

Open the dashboard with an assigned plan awaiting scheduling and one due workout. Expect a greeting, assigned-athlete count and plan/analytics links in the header; Today’s work and Athlete health sit side by side on desktop and stack on phones. Workouts to record combines due and unfinished workouts, with Start/Resume actions; today’s group/assessment events remain separate. Needs scheduling appears below. Primary-roster follow-up uses compact expandable rows. Awaiting-schedule work must be discoverable without picking an athlete. Verify that a workout appears once, either in Workouts to record or Needs scheduling, including later pages. Schedule work for now: it must leave planning and appear in Workouts to record without reloading the page. Start it, return to the desk and confirm one Resume card. An outdated or unconfirmed backend response must show an update/restart message, not populate both lists. Existing pending commands remain retryable. Open a follow-up row and verify its action and count. A coach with supporting sport assignments but no primary roster must still see the authorized work without a misleading empty-roster prompt. Schedule it from its card; check date/time, timezone and duration alignment on desktop and stacked phone layout. Future scheduled work leaves the action list but remains in plan details. Workout cards use the workout/day name as the main heading and the program title beneath it, including when several workouts share one program. Status tags retain readable text and distinct light/dark colors. The Athlete status column exposes only the existing shared primary-roster participation status/effective date: modified, unavailable or unknown, never clinical detail or an invented readiness score. A failed status refresh must show an error rather than clearance; revoked access must remove retained status. Check Arabic/dark and narrow layouts.

Open the coach recorder. Enter actual values and use each set’s check button, including keyboard activation; prescribed placeholders alone must not complete sets. Invalid/missing timed or distance results must keep the check off with an explanation. Save partial progress and reload. Finish the workout: after server acknowledgment, expect the workout review page for that same record. A failed/uncertain save must remain recoverable; navigating away during a delayed acknowledgment must not pull you back. Reopen its recorder/history to inspect attribution. Save/review a program or workout: expect one action-specific toast and no duplicate success card. Invitation/reset links and pending/error recovery remain visible because they require action.

### Weekly and automatic individual preparation

1. In a program create/edit page, enable Default to automatic daily preparation and publish. Assign that version: expect Automatic daily preparation preselected, a required end date within 366 days and an explicit timezone. Turn it off to assign manually. Confirm assignment, then edit/publish the program default: the existing plan policy must remain unchanged. Open an active manually scheduled Athlete plan. Under Plan scheduling, expect Manual scheduling until you explicitly choose Set up scheduling. Select Weekly appointments, bounded dates, weekdays, timezone, local time and duration; save. Expect a rule-saved toast, then a separately prepared next workout. Refresh workouts after preparation; only one unresolved workout may appear for this plan.
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
7. Open Athlete health from navigation. Coaches see limited shared participation status; they do not acquire clinical details or athlete status-editing rights.

## Athlete

### My day

1. Open Dashboard: expect My day with workout cards first, Start/Resume visible without hover, upcoming events and compact food/coach panels. Workouts remain independently scoped per plan.
2. Choose Log food: expect the Food diary tab directly. Record only actual intake; guidance/example meals are separate. Return to Dashboard.
3. Choose Message beside an assigned coach: expect the existing private conversation or a single newly initiated one. Supporting coaches appear when assigned and returned by the authorized communication-contact read. Without a coach, expect a clear contact-your-administrator message.
4. Open All my workouts and Workout history, then return. Check empty data and long coach/workout names, phone/desktop, Arabic/English and both themes; athletes must not acquire staff reporting or directory access.

### Scheduled workout access

The athlete training screen should have one Your workouts heading, an outlined Workout history button with an icon-only Refresh workouts button beside it, and distinct preview cards with readable exercise names. Start/Resume stays visible without hover on phones and when using a keyboard. A copied staff `/training/:assignment` link must return the athlete to their dashboard before displaying staff detail.

Open Your workouts with one future scheduled plan and one actionable plan. The future card explains that recording opens at the scheduled start time and has no Start button. Start the actionable workout, leave and resume the same record; unfinished work in another plan must not block it. An unscheduled plan explains that a coach must schedule it. Device records with pending edits remain linked under Work saved on this device even if the server read fails. Reload after acknowledged completion and confirm progression changed once. Weekly automatic scheduling, group exercise results and Android workout capture are outside this validation slice.

1. Open Programs. Only assigned programs should appear, without staff library/draft tags. Copy an unassigned program URL from staff and open it as the athlete: it must be rejected. Assigned program details should say Program details, not Edit program.
2. Open `/people`, `/analytics`, `/groups` and `/plans/new` directly. These staff-only screens should return you to the dashboard before rendering. Server authorization must still reject staff requests.
3. In Messages, select the Contacts tab and choose your assigned coach. Send a message. Ask the coach to open your contact too; both should reach the same private conversation. Unrelated athletes must not be available as contacts.
4. Open an existing in-progress workout. Start a rest timer and switch exercises: the previous timer should clear. Try navigating away and cancel the warning; you should remain in the workout. Accept it, reopen the workout and confirm saved progress remains.
5. Record food. A dialog should open with the reference library available first for a blank entry; manual entry remains available. Save breakfast and lunch entries: each meal should have one section heading. Correct an entry, close/reopen its draft and confirm its values remain.
6. Open Athlete health. Complete consent prerequisites where enabled, report participation status, correct it and close it. Download my records sits after the record list.
7. Open My feedback: each session shows Rated or Not rated yet. Open Notifications: unread updates show a dot and bold title, the count appears above the list, Mark all read clears them, and selecting an update opens its linked page. Staff roles retain their existing distinct permissions; this is not a clinical injury record.

## Optional participation-status walkthrough

Use a synthetic institution and athlete records. The first-run form creates the initial institution and super admin; subsequent users are added by an administrator through one-time invitation links.

1. Sign in and confirm the institution and active role.
2. As an administrator, open **Athlete health**. Needs setup lists athletes without a consent setup; All athletes shows everyone with Adult/Minor and assent tags. Choose the age group on the athlete's own row (Minor shows the guardian checkbox on that row only and keeps Save disabled until checked), then save: the athlete leaves Needs setup. For a minor, use only the guardian-authorization attestation; do not enter guardian documents or real personal data. Confirm the administrator cannot see injury status.
3. Sign out. Sign in as that athlete, review the consent and assent prompt, and record a synthetic participation status. Then try reviewing, correcting, closing, withdrawing consent, and exporting the record. Note confusing wording, lost input, or unclear confirmation.
4. Sign out and sign in as the athlete’s designated coach. Open **Athlete health** and verify that only the current participation status and effective date are visible. Confirm that unassigned athletes, prior history, and health details are not exposed, and that the coach cannot create or change the record.
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
