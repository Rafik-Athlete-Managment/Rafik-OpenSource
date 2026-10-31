# Android coach field development

## Unreleased beta.3 compatibility check

The source app's schedule has a collapsed **Server compatibility** disclosure after the event list. It reports native support for attendance, assessments and event completion, with a separate **Check again** action. Workout recording and workouts without a fixed time remain unavailable in this slice. A missing discovery endpoint requests a version check; offline/denied/invalid responses retain their own error. Saved events and pending work remain reviewable. This does not require a native dependency change or establish APK/device acceptance. Use the [canonical instance walkthrough](../testing/instance-validation.md) for manual checks.

**Status, 20 October 2026:** the coach Android beta.1 is published and accepted for beta evaluation. Attendance, assessment drafts/results, event completion, online correction history, recovery comparison/sharing and English/Arabic UI are implemented. Focused API and Android emulator checks passed, including queued score replay after app restart and recovery share cancellation. A signed emulator build also passed cold offline startup and controlled current-format versionCode upgrade preservation. The founder reports the S20+ standalone field/offline walkthrough passed on 20 October; broader device/accessibility and security/recovery coverage remain open; see [verification](../verification/README.md). Instance URL scanning remains open.

## Start a development instance and native build

For a standalone APK that bundles JavaScript, follow the [fresh-checkout build procedure](../operations/android-release.md#fresh-checkout-standalone-build) and `npm run mobile:release`. Coaches normally install the official APK rather than build from source; independent distributions maintain their own signing identity. Ordinary `mobile:android` remains a development install requiring Metro.

The founder reports successful offline attendance followed by backend restart and online sync on 18 October. This is a reported runtime walkthrough, with target/device type unconfirmed; it does not establish score capture, completion, app process-death recovery or encryption acceptance.

Completed events use a distinct confirmed read-only summary and no longer ask to download another roster. Future events show the scheduled unlock time and device timezone before entry. The active app rechecks its clock every 30 seconds and on foreground return. A pending completion remains device-saved until the institution acknowledges it. Review results and correction history from the web **Events & assessments** list.

Use synthetic accounts and events. From the repository root, install once with `npm ci`, then start the local backend using the [development guide](README.md). A trainer must be assigned as staff on an institution event; attendance entry opens after its scheduled start time. Administrators and athletes do not receive the coach workflow.

Install Android Studio, its Android SDK, a compatible JDK, and configure an emulator or USB-connected Android device. From the repository root:

```sh
npm run mobile:android
```

This builds and runs the native Android client. SQLCipher and Expo Crypto require a native build; Expo Go is unsupported. To restart Metro for an already installed build, use `npm run mobile:start`. Follow Expo's native-build output to connect the client.

`mobile:start` explicitly selects the native development build (`expo start --dev-client`). If an older running Metro terminal offers to install Expo Go, stop it with Ctrl+C and restart `npm run mobile:start`, then press `a`. No native rebuild is needed for this command correction.

### Windows laptop startup and rebuilds

Use `npm run mobile:android` from the normal repository folder. The maintained launcher prepares a missing Android project with Expo, then builds/installs/runs it. Pass Expo options directly, for example `npm run mobile:android -- --device` to choose an emulator or phone. Android Studio can be closed after the emulator starts; keep the emulator, Metro and the backend running during API workflows.

On Windows, the launcher limits Gradle to two workers and disables project parallelism for that invocation. Its maintained Gradle helper places app CMake staging under `<user-home>/.rf-cxx/<checkout-hash>/app` and library staging under `%TEMP%/rf-cxx/<checkout-hash>/<module>`, sets `CMAKE_OBJECT_PATH_MAX=256` to hash long object paths, and gives each Ninja build two compilation slots and one linking slot. The shorter app base leaves room for release variant names and long autolinked targets. The limit must leave space for the generated target directory, CMake's hash and the source filename; a lower limit can prevent hashing and leave the original long path in place. It checks the standard SDK CMake 3.22.1 Ninja executable when present and stops before building if it is older than 1.12. Custom toolchains still need operator review. These controls reduce build pressure; they do not impose a total RAM limit or configure emulator RAM/graphics.

The launcher applies `apps/mobile/scripts/android-build.gradle` to the generated Android project. Keep this maintained helper as the source of truth; generated Android files remain ignored. A drive alias such as `R:` alone did not shorten Reanimated's canonical source/build paths in the founder's failed build. No repository move or drive mapping is required by this launcher. It leaves SDK tools, user Gradle settings, existing caches and device data untouched. Windows staging is temporary and isolated by checkout; deleting it later causes native recompilation.

To inspect preparation without starting Gradle, the emulator or Metro:

```sh
npm run mobile:android -- --prepare-only
```

The first native build or a native dependency/configuration change needs `mobile:android`. For ordinary JavaScript/UI changes with the app already installed, use `npm run mobile:start`. An emulator reset or app uninstall requires installation again. On a 16 GB laptop, start with a small emulator using 2 GB RAM, two cores and hardware/automatic graphics; these are suggested settings, not verified performance guarantees.

**Observed Windows failure:** the founder's Reanimated `buildCMakeDebug[x86_64][reanimated]` task failed at `ninja: error: mkdir(...CSS/interpolation/operations): No such file or directory`. The initial Ninja was 1.10.2; a later run from `R:` still used the long physical path. This is consistent with path handling; the Gradle deprecation summary was not the failing task. Update Ninja through the [official release](https://github.com/ninja-build/ninja/releases/tag/v1.12.1) if needed; the launcher does not replace installed executables. See [Reanimated's Windows guide](https://docs.swmansion.com/react-native-reanimated/docs/guides/building-on-windows/), [CMake path hashing](https://cmake.org/cmake/help/latest/variable/CMAKE_OBJECT_PATH_MAX.html) and [Android CMake staging](https://developer.android.com/reference/tools/gradle-api/8.3/com/android/build/api/dsl/Cmake). Later successful signed packaging provides recovery evidence; this earlier failed attempt is historical.

Expo generates native Android/iOS projects and local Metro/type metadata. These paths are ignored; keep build configuration in `apps/mobile/app.json` and dependencies in the root lockfile. Do not commit generated build folders.

For a standard Android emulator, enter `http://10.0.2.2:55331` as the local API URL. A self-hosted instance normally uses `https://your-instance.example/api` because the web server proxies the API under `/api`. Use the exact API base supplied by the institution. HTTPS is required for remote instances; HTTP is accepted only for localhost, `127.0.0.1` or the emulator host. A physical device can use a reachable HTTPS endpoint or USB loopback forwarding; arbitrary LAN HTTP remains unsupported. Follow the [S20+ physical-device procedure](../operations/android-release.md#physical-phone-check-galaxy-s20-and-local-backend).

## Coach attendance walkthrough

For API exploration on your computer, open the backend's `/v1/docs` (default `http://127.0.0.1:55331/v1/docs`), or `/api/v1/docs` through Compose. The [API guide](../reference/api.md) explains native login and Authorize. Production viewers are reference-only; local requests use synthetic accounts.

1. Sign in using the institution API URL and a trainer account. Select the institution workspace if more than one is available.
2. Refresh the schedule. It requests a 14-day local-date window in the device's timezone. **Load more events** follows the server's pagination; the list is not a season-wide download.
3. Open an event online. The app saves event identity/timing/state, event participant names/duties/active flags, attendance and revisions. Assessment packages also include the event's metric definitions/units/limits and current results, revisions and assessor notes. It excludes correction history, session notes, files, conversations and injury records from the device cache.
4. After the event starts, choose **Present**, **Absent** or **Excused** for each athlete. The display acknowledges device saving only after the local transaction completes. One athlete's next edit waits for acknowledgment of their previous change; other athletes can be captured while a request is in progress.
5. Keep the app active to send saved attendance. Retry runs on foreground/resume, an explicit sync action and a 30-second timer while active. A network request times out after 20 seconds. There is no background-sync promise.
6. Reopen a saved event after an app restart or while disconnected. Saved events remain listed even when their dates are outside the current schedule window. A new event requires an online download.
7. Once all changes are confirmed, **Refresh roster** downloads current server data. A completed or cancelled event is displayed read-only and its offline roster/receipts are evicted. Otherwise the saved copy remains until removed explicitly.

## Assessment scores and event completion

1. Download the assessment event online before going offline. An older attendance-only package needs **Refresh roster** before score entry is available; confirm pending attendance and resolve drafts first.
2. Mark the athlete **Present**, then choose **Record assessment scores**. The editor uses that event's server-defined metric names, units, text/numeric kinds and limits. Enter every required metric; zero is a recorded value and a blank field is missing. Fractional numeric values are retained without integer rounding.
3. Each edit saves a raw score draft locally. Wait for **Score draft saved on this device** before closing. An unsuccessful write offers **Retry device save** or **Discard draft**; navigation remains blocked while the latest edit is unpersisted. Closing a persisted draft keeps it available after reopening or app restart. A draft is not a submitted result.
4. Choose **Save scores**. The app commits a separate immutable result command and removes its draft in the same transaction. A queued present command for that athlete must replay successfully before the result is sent. A failed attendance/revision/authorization check pauses dependent results; the pending values remain available for review.
5. Read the confirmed values/revision on the athlete card. **Review / correct scores** creates a new command against the acknowledged result revision. The server retains its normal correction history. The native app currently shows the current result rather than the paginated history; completed-event corrections use the institution web app.
6. Choose **Complete event** only after every athlete's attendance is marked, each present assessment athlete has confirmed results, every command is acknowledged, and every draft is submitted or explicitly discarded. The app asks for confirmation, then persists a separate finish command against the event revision. A future/cancelled/completed event is unavailable for capture.
7. Wait for completion acknowledgment. An uncertain finish is retained and retried with the exact original operation; it does not imply completion. A valid acknowledgment atomically removes only this account/workspace event's local package, scores, drafts and receipts. The open screen shows the completed result in memory; server records and correction history are preserved. Reopen completed events online for review.

No assessment is auto-merged over a conflicting server revision. Native/API and device acceptance remain required before calling Stage 7 complete.

## Saving, retry and recovery

| Display                           | Meaning and action                                                                                                                            |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Saving attendance on this device  | Local persistence is running. Do not assume it survived a crash yet.                                                                          |
| Saved on device — waiting to send | The command is committed locally with its original operation ID and revision.                                                                 |
| Sending to institution            | Dispatch is in progress. Discard is unavailable until it settles.                                                                             |
| Server confirmation unknown       | A response, connection or acknowledgment write failed. Retry sends the original operation and payload. Do not re-enter it as another command. |
| Confirmed by institution          | The server returned the expected attendance/result/revision and the acknowledgment plus updated event committed locally together.             |
| Needs your review                 | The server rejected the command, for example because its revision changed. The queue pauses at this command.                                  |
| Access blocked                    | Current authorization failed. Saved work remains encrypted and entry is locked.                                                               |

Commands replay in order within the selected account/institution workspace. A blocked or rejected head pauses later commands, including other events in that workspace; the schedule offers a link to the event needing review. A newer download cannot overwrite unresolved commands or score drafts. The server checks current authority for every replay, including exact operation retries.

For conflicts or revoked access, review current records in the institution web app where authorized. The native app retains the saved values and error for review. **Remove device copy / discard pending work** requires an explicit confirmation and removes only that event's local data for this account and workspace. It does not undo a server write; an uncertain change may already have reached the server. Reopen online to download a fresh authorized roster before entering a correction. Use the native recovery comparison and explicit share workflow below; no automatic import or conflict merge is provided.

If the session expired, sign out and sign in to the same institution URL/account, then retry. A lost refresh response can require a fresh sign-in because the server rotates refresh tokens. Do not edit or replace the pending attendance payload to repair sign-in.

## Review history and recover a conflict

1. Open an event and choose an athlete’s **Correction history**. Attendance and score tabs load the original entry and later corrections online, 25 at a time, newest first. History is not cached for offline viewing.
2. For rejected/blocked work, open **Review saved work**. **Read current server records** fetches a separate comparison; it never replaces your device copy or changes queued commands. A denied read hides the fetched comparison and locks entry.
3. For an uncertain outcome, sync the exact saved operation after connectivity/authentication recovers. Rejected/blocked operations remain paused; comparison cannot force them through.
4. Optionally choose **Share recovery copy**. Confirm the plain-text warning and select an institution-approved Android destination. It contains durable pending operations/drafts, their involved athlete names and event metadata, without credentials or unrelated roster members. Individual-item sharing supports smaller copies; text beyond 60,000 UTF-16 code units is refused intact. No save/delivery success is inferred from the chooser.
5. Keep any needed copy, then explicitly discard the device copy and reopen online before entering a reviewed correction. Discard does not undo a server write; uncertain work may already be recorded. Recovery JSON is for manual reconciliation and cannot be imported or replayed automatically.

Use the English/العربية controls on sign-in or schedule screens. The initial choice follows the device locale, then restores the saved device preference. Switching language preserves open field drafts. Arabic supports RTL and Arabic/Persian digits with the Arabic decimal separator; instance/athlete/exercise names remain as authored. URLs and email fields stay LTR. Language-save failure has explicit feedback and retry.

## Storage and account boundaries

The client checks `PRAGMA cipher_version` before opening its field tables and refuses to store field data if the native build lacks SQLCipher. Its random database key and the instance-bound credentials are stored in Expo SecureStore. Android automatic app-data backup is disabled. These are implementation controls; they still require native-build verification.

Every event, score draft and command is partitioned by the exact normalized institution API URL, user ID and workspace ID. Signing out removes credentials and attempts current-device server revocation; the UI states when server revocation could not be confirmed. It retains encrypted field work for the original account. Another signed-in account cannot list, replay or discard that account's records. Pending work is not transferred to another coach. Reauthenticate as the original account to review or discard it.

App removal, Android clearing app data or loss of the SecureStore key can make unsent records unrecoverable. Server backups do not include the device queue. No remote wipe, biometric gate or secure-erasure guarantee is implemented. Recovery sharing is an explicit plain-text export, not an encrypted backup. Report a lost device to the institution; administrators should suspend the account if necessary. There is not yet a device-management screen for revoking one other device.

## Standalone emulator window on Windows

Android Studio is needed to install/manage the SDK and virtual devices, but it does not need to stay open while using a standalone emulator. Close any existing instance of the same virtual device first. From a PowerShell terminal:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -list-avds
& "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -avd Small_Tablet
```

`Small_Tablet` is the founder's current AVD name; replace it with a name returned by `-list-avds` on another machine. Keep that window open and run Metro from the repository root in a separate terminal:

```powershell
npm run mobile:start
```

If Android repeatedly reports **System UI isn't responding**, close the emulator first and try this smaller display with a cold boot:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -avd Small_Tablet -skin 1280x800 -no-snapshot -no-boot-anim -memory 2048 -cores 2
```

This launch skips loading/saving Quick Boot snapshots and keeps existing app data. It reduces framebuffer size from this AVD's configured 1920×1200; it does not change the saved AVD configuration. Performance improvement is unverified. Keep the existing Metro terminal running; do not start another Metro instance or clear app storage for this retry.

After Android finishes booting, press `a` in Metro to open the installed app. A stale layout bundle can use the clean-cache command below. Do not start two copies of the same AVD, clear app storage or rebuild native code just to open the development client. These instructions affect local Android development, not Unix Compose hosting.

## Stale development bundle after provider changes

If `LanguageProvider is required` points to an older `_layout.tsx` containing a fragment, first compare the saved source: the root layout must wrap the Stack in `LanguageProvider`. Stop Metro in its terminal, then run from the repository root:

```sh
npm run start --workspace @rafik/mobile -- --clear
```

Reload/reopen the development app. This clears Metro cache, not app credentials or field records; do not clear Android app storage to repair a stale bundle. A continuing error after a clean start needs investigation of the served project/module identity rather than another blind rebuild.

## Connection and access feedback

Transport errors use readable English/Arabic feedback, without raw Java/network addresses. After an offline access failure, an authenticated response, foreground/resume or the active 30-second retry triggers a fresh coach-access check. Only a successful access check clears that warning; a schedule acknowledgment does not grant institution authority. Cached work opens as soon as local storage loads; background checks keep the current roster/editor mounted. **Refresh access** provides a manual retry. Session failures still require signing in again to the same account; revocation/conflict remain distinct from connectivity.

Saved event packages open directly from device storage. With cached events present, startup schedule refresh runs separately and does not lock roster controls. **Refresh roster** explicitly downloads newer event data and remains unavailable while unsent commands/drafts need resolution. Background schedule feedback cannot replace an open event’s capture message.

## Focused checks

For repeatable native API/queue acceptance without Chrome, use Node 24 and a running local Docker database. From the repository root:

```sh
npm run mobile:acceptance
```

Expected result: the native HTTP/SQLite scenario passes and the runner reports `cleaned: true`. It migrates a separate `rafik_browser_<timestamp>` database, starts an isolated API on 55341 and removes only its own resources. It never resets or seeds the preview. This covers real-server receipt/auth/conflict behavior, not Android SQLCipher or UI.

For a native session, run `npm run mobile:acceptance -- --device` in an interactive terminal (automation tools need a PTY). It keeps that isolated API and writes synthetic sign-in details to its reported ignored `.expo/acceptance/<timestamp>/fixture.json`. Enter `done` then Enter in the runner to clean up, or use Ctrl+C in an interactive terminal. A detached process with closed stdin cannot receive `done`; do not use that mode for a retained fixture. Keep the existing app account/data separate using a dedicated emulator/profile; remove only the temporary profile you created. A disconnected emulator leaves profile cleanup pending.

If Windows blocks the queue test runner from spawning a child, the equivalent single-file Node 24 command from `apps/mobile/` is:

```sh
node --experimental-strip-types --test --test-isolation=none tests/attendance.test.ts
```

Run from the repository root with Node 22.16 or Node 24:

```sh
npm run typecheck --workspace @rafik/mobile
npm run test:queue --workspace @rafik/mobile
```

The queue tests use real Node SQLite, including temporary on-disk restarts and transaction failures; their temporary directories are removed. They do not use the preview database, seed accounts or a device, and do not verify SQLCipher or Android process death. They cover exact retry, score precision/draft persistence, attendance → result sequencing, result corrections, completion gates and atomic eviction, stale-base protection, account/server/workspace isolation, blocked/conflicting commands, acknowledgment rollback and runtime switching.

Follow-up coverage beyond the accepted beta should exercise the native build against the real API, including server receipt/revision rules, attendance → score → completion, real-form fractional values, refresh/revocation, airplane mode, forced app stop/reopen, account switching, phone/tablet layouts, assistive technology and both themes. URL scanning remains Stage 7 implementation work; localized recovery/history UI still requires broader native acceptance. Report emulator results separately from physical-device and human field review.

Native storage API references: [Expo SQLite/SQLCipher](https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/) and [Expo Crypto](https://docs.expo.dev/versions/latest/sdk/crypto/).
