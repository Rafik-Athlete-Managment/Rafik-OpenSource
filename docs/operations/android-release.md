# Android beta builds and updates

**Beta.3 candidate, 4 November 2026:** source commit `eef8904` produced a verified signed local APK and upload ZIP for version `1.0.0-beta.3`, Android versionCode `1000003` and the existing `org.rafik.field` package/signing identity. It is not published. The founder accepted the coach development-app walkthrough and reports the signed beta.3 clean-install phone smoke passed; an in-place beta.2-to-beta.3 upgrade remains untested. The [release checklist](release-checklist.md#squire-beta3-release-candidate--4-november-2026) and [verification](../verification/README.md#founder-signed-beta3-phone-smoke--4-november-2026) track the evidence and limits. Older beta.2 clients cannot be used with the breaking beta.3 server migration; back up the instance and resolve device pending work before the coordinated upgrade.

**Squire 1.0.0-beta.1:** the GitHub prerelease includes the official [Android download bundle](https://github.com/Rafik-Athlete-Managment/Rafik-OpenSource/releases/download/v1.0.0-beta.1/1.0.0-beta.1.zip). On 20 October 2026, its embedded APK checksum matched both `SHA256SUMS` and `build.json`, and the recorded packaging receipt. The founder accepted the standalone Galaxy S20+ field/offline walkthrough. The Android app is release-ready for beta.1; broader device/accessibility coverage does not block this beta. Google Play and iOS are outside this workflow.

## Install the published beta

1. On the Android device, download the **Android download bundle** linked above. This uploaded ZIP contains the installer; GitHub's separately generated **Source code (zip/tar.gz)** archives do not.
2. Extract the ZIP using the phone's file manager (on Samsung, **My Files → Downloads**, select the ZIP and choose **Extract**). Open its `1.0.0-beta.1` folder.
3. Tap `Rafik-Squire-1.0.0-beta.1-android.apk`. If prompted, allow **Install unknown apps** for the file manager, then install and open **Rafik Field**. Device management policies may require the institution's administrator to permit installation.
4. Enter the institution's HTTPS API URL (ending in `/api` for Compose) and coach credentials. No Metro, computer, USB cable or Android Studio is required with a reachable institution server.

The bundle also contains `SHA256SUMS` and non-secret `build.json`. Its APK SHA-256 is `1654e44fd6f324d2403984a6a880b3dffabf81f3615c9ac8a71c5992a417fb5e`, source revision `5d1ce761505b07272c6d5b43414cd1d754b41517`. The release's source tag remains `4ac70c8`; it is distinct from this binary's recorded source. This download check verifies published bytes, not a new device test.

## Choose the right path

| Who                                               | Recommended approach                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Institution operator or coach                     | Install an official signed APK from the [GitHub release](https://github.com/Rafik-Athlete-Managment/Rafik-OpenSource/releases/tag/v1.0.0-beta.1) by downloading and extracting its Android ZIP bundle. Enter the institution API URL and sign in as a coach. No Android build tools are needed. Source ZIP/tar.gz downloads are not installers. |
| Contributor changing JavaScript/UI                | Install a native development build once with `npm run mobile:android`, then use `npm run mobile:start`. See [development setup](../development/android.md).                                                                                                                                                                                     |
| Rafik release maintainer                          | Build a standalone APK from a clean, approved source revision using the existing private Rafik signing key and the procedure below.                                                                                                                                                                                                             |
| Institution maintaining its own distribution/fork | Build from its chosen source revision with its own private signing key. It owns binary updates and key backups. Never request Rafik's private signing key.                                                                                                                                                                                      |

The same upstream APK connects to separate institution servers; server URL and account are entered at runtime. Server instance branding does not require an institution-specific APK build. A separately signed fork cannot update an official installation in place. Use a separate test device, or deliberately give a maintained fork a distinct Android application ID and record that change; never uninstall an app containing pending work to bypass signing checks.

## Fresh-checkout standalone build

Run these steps on Windows PowerShell, Linux or macOS, from the repository root. The native SDK/JDK prerequisites below apply; Docker builds the server stack, not this APK.

1. Clone `https://github.com/Rafik-Athlete-Managment/Rafik-OpenSource.git` and enter its folder. Select the reviewed source before installing dependencies. For the published source release:

   ```sh
   git checkout --detach v1.0.0-beta.1
   git rev-parse HEAD
   git status --short
   npm ci
   ```

   Expected: a full source commit ID and an empty tracked worktree. Record the ID. A tag builds that tag's code; it does not include later fixes on `main` or open PRs. For a newer approved candidate, substitute its full reviewed commit ID for the tag. Do not build an unreviewed next-release PR as beta.1.

2. Configure the SDK/JDK described below. Official maintainers restore their existing private signing backup. For a genuinely independent distribution with no existing update key, run `npm run mobile:release -- --init-signing` once, then make the encrypted backup described below.
3. Run `npm run mobile:release -- --prepare-only`, then `npm run mobile:release`. Expected: a verified signed APK, `SHA256SUMS` and `build.json` under `artifacts/mobile/<app-version>/`. No emulator or Metro is started. First native compilation can be slow; preparation alone is not a successful build.
4. Read the non-secret `build.json`: confirm the intended revision, `dirty: false`, version, versionCode, APK checksum and signing-certificate fingerprint. Preserve the three output files together. Install and validate a newly built candidate using the steps below before distributing it. Building the same source on another machine is not promised to produce identical APK bytes.

The builder refuses to overwrite an existing APK for that version. Preserve the previous output outside its destination before an intentional replacement candidate; do not delete signing material or pending device data. Distributed updates need a higher versionCode and the same signing identity.

## Requirements

Run commands from the repository root after one `npm ci`. Use Node 22.16 or 24, JDK 17, Android SDK/build-tools, and the native toolchain described in the [Android development guide](../development/android.md). Set `JAVA_HOME` and `ANDROID_HOME`. Windows also requires Ninja 1.12 or newer for the configured CMake toolchain. Linux/macOS builds use the same scripts with their installed SDK/JDK. Only Windows build preparation has been exercised so far.

The build targets Android API 24 or newer (Android 7.0), with ARM64 phones and x86_64 emulators. This is a configured minimum, not evidence of usability on every Android version or device size. The founder reports the first S20+ walkthrough passed; broader device/accessibility coverage remains separate.

## Create and protect the signing key

The founder authorized creating a local release key. Existing local signing material must be reused, never regenerated for an update. On another maintainer machine, restore its private backup into `apps/mobile/.signing/` before building. For a genuinely new distribution identity only:

```sh
npm run mobile:release -- --init-signing
```

This creates `rafik-release.p12` and `signing.json` inside that ignored directory. The JSON contains randomly generated passwords in plain text; protect both files with owner-only access and an encrypted offline backup. Unix file modes are restricted by the script; Windows operators must review inherited folder permissions. Never attach this folder to an issue, release or support request. Losing the key can prevent installed users from receiving an in-place update. The script refuses to overwrite existing signing files.

Only the APK, checksums and non-secret build metadata are distributable. Signing secrets reach keytool/Gradle through child-process environment variables, not command-line password arguments or generated Gradle files.

### Back up the existing key on Windows

Use [7-Zip from its official site](https://www.7-zip.org/download.html); its 7z format supports [AES-256 encryption](https://www.7-zip.org/7z.html). No paid backup service is required.

1. Install the Windows x64 edition of 7-Zip. In File Explorer, open `C:\Users\moham\Desktop\RAFIK-FRONTEND\apps\mobile\.signing` on the founder machine (other maintainers use their checkout's equivalent).
2. Select **both** `rafik-release.p12` and `signing.json`. Right-click → **Show more options** if needed → **7-Zip → Add to archive**.
3. Choose archive format **7z**, encryption **AES-256**, and **Encrypt file names**. Name it `Rafik-Android-signing-backup.7z` and save it outside the repository. Do not select “Delete files after compression.”
4. Set a unique long passphrase. Store it separately in a password manager or on paper in a secure place. Do not paste it into chat, shell commands or GitHub. The archive passphrase protects the backup; it does not replace the existing passwords inside `signing.json`.
5. Open the archive with 7-Zip, enter the passphrase and confirm both filenames. Use **Test** to verify the archive decrypts and reports no errors; no extraction is needed for this check.
6. Copy the encrypted `.7z` to two independent destinations, such as a private cloud drive and a USB drive. A copy elsewhere on the same laptop is insufficient. Test at least one copied archive too.
7. Keep the original `.signing` folder for builds. Record the backup date and locations privately. Only mark the release-checklist backup item complete after the copied archive passes its test.

For recovery on another maintainer machine, extract privately into its ignored `apps/mobile/.signing/` folder and run release preparation. Reuse the existing key; never run `--init-signing` over a restored identity. Archive integrity alone does not prove a future signing build, so retain the public certificate fingerprint from the build metadata for comparison.

## Build a candidate

```sh
npm run mobile:release -- --prepare-only
npm run mobile:release
```

Preparation validates local signing inputs and installs maintained Gradle/manifest configuration into the ignored Android project; it does not compile or install. A missing native project is generated by Expo without installing dependencies again. The full command runs `app:assembleRelease` with two workers, project parallelism disabled, and ARM64/x86_64 architectures. Windows retains short CMake staging and object-path hashing. It verifies the APK signature and writes:

```text
artifacts/mobile/1.0.0-beta.1/
  Rafik-Squire-1.0.0-beta.1-android.apk
  SHA256SUMS
  build.json
```

The directory is ignored. Verification checks the signer against the configured release certificate, the embedded JavaScript bundle and both native architectures. Build metadata records the source revision and dirty-worktree flag; it does not imply byte-for-byte reproducibility. Users do not run Metro, Node or Android Studio. No account, institution URL, signing secret or preview seed is embedded as deployment configuration. Remote institutions require HTTPS. Local HTTP exceptions are limited to `localhost`, `127.0.0.1` and the Android emulator host `10.0.2.2`, matching the native client's URL rules. Release manifests remove development overlay and legacy external-storage permissions.

Generated `android/` sources are not the source of truth: maintain `app.json` and `scripts/android-*.gradle`, `AndroidManifest.release.xml` and `network-security.xml`. Native dependency/plugin changes still require a native rebuild.

If Gradle succeeds but a post-build verifier needs correction, avoid recompiling. After confirming the existing APK's actual source revision, PowerShell supports:

```powershell
$env:RAFIK_APK_SOURCE_REVISION = "<full 40-character commit used for that build>"
npm run mobile:release -- --verify-only
```

Verification-only requires that explicit provenance, still checks the signer/package/version/bundle/architectures, and records that it did not compile the APK. It refuses to overwrite an existing artifact. Do not supply the current HEAD unless it actually produced that APK.

## Install and test

On a clean ARM64 Android device, transfer the verified APK through a trusted channel, allow installation from that source and open **Rafik Field**. Enter the institution's HTTPS API base URL and coach account. With Compose, the base URL ends in `/api`.

For a separate emulator with no existing Rafik development installation, PowerShell supports:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install "artifacts/mobile/1.0.0-beta.1/Rafik-Squire-1.0.0-beta.1-android.apk"
```

The installed development app uses a different signing certificate. Do not uninstall it or clear its data to test a release: pending work can be lost. Use another device/AVD. Different Android profiles do not isolate package signing certificates.

1. Open the release with Metro unavailable; confirm sign-in and language controls render.
2. Sign in with synthetic records and download an event online.
3. Disconnect, record attendance/results, wait for device-save acknowledgment, then force-stop and reopen while still offline. Verify saved work remains visible.
4. Reconnect and verify exact replay, server acknowledgment, history and completion.
5. Inspect English/Arabic, both themes, portrait/landscape and reachable controls; report physical hardware separately from emulator evidence.

## Physical phone check: Galaxy S20+ and local backend

A phone is a valid first physical target; tablet acceptance remains separate. Record **Settings → About phone → Software information → Android version**, plus display/text-size settings. Use synthetic coach/athlete records and an event that has already started. The Android app is for coaches; administrators and athletes use the web dashboard.

Use the newly built candidate for testing source fixes. An older APK does not acquire changes from Git or Metro. No emulator, Metro or running Android Studio is needed for a standalone release.

### Connect without a domain

If a reachable HTTPS institution already exists, install the APK through a trusted file-transfer method and enter its API URL. For the founder's local API, use a USB data cable and existing Android SDK tools instead:

1. Start the backend normally on the laptop at `http://127.0.0.1:55331`. Keep it running. Prepare a synthetic coach, athlete and scheduled assessment in the web dashboard; redeem invitations to set their passwords and assign the coach as event staff.
2. On the S20+, enable Developer options by tapping **Build number** seven times under Software information, then enable **USB debugging**. Connect the cable, unlock the phone and approve debugging from your own laptop.
3. From the repository root in PowerShell, run:

   ```powershell
   $rafikAdb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
   & $rafikAdb devices -l
   & $rafikAdb -d install -r "artifacts/mobile/1.0.0-beta.1/Rafik-Squire-1.0.0-beta.1-android.apk"
   & $rafikAdb -d reverse tcp:55331 tcp:55331
   ```

   Expected: the physical device says `device`, installation says `Success`, and forwarding completes. `-d` targets the single USB device. If multiple phones are attached, select the intended serial with `-s` instead. An `unauthorized` device needs the on-phone approval.

4. Open **Rafik Field** on the phone. Enter `http://127.0.0.1:55331` and the coach account. This loopback URL reaches the laptop through USB forwarding. Do not substitute a LAN HTTP address: remote HTTP remains intentionally disallowed.

References: [Android hardware-device setup](https://developer.android.com/studio/run/device) and [ADB](https://developer.android.com/tools/adb).

### Run the actual field task

1. Open/download the started assessment online. Verify names, units and start time. Check English/light and Arabic/dark; type a decimal score and verify the keyboard does not hide Save/Back actions.
2. Unplug USB and turn off Wi-Fi and mobile data. **Airplane mode alone is insufficient when USB forwarding remains active.** Mark attendance, enter a fractional score and wait for device-save acknowledgment. Device saved and institution confirmed must remain distinct.
3. Close and force-stop Rafik through Android app settings, then reopen with USB still unplugged and networking off. The cached event and unsent work must remain. Do not clear storage or uninstall.
4. Reconnect USB, repeat the forwarding command and retry/refresh. Confirm the offline warning clears after a successful access check, without closing an open score editor. Verify each attendance/result in the web event; retries must not duplicate it.
5. Complete the event after all required records are confirmed. Check the read-only summary and correction history. Try rotation, larger text and Android TalkBack for the primary task; record any blocked action or unreadable label.
6. Record phone model/Android version, APK checksum, tested language/theme and pass/fail for each step. Report screenshots without real athlete data. This one phone does not establish all Android/tablet support.
7. After every pending command is acknowledged, remove only your synthetic test records through normal application controls if appropriate. Remove the USB rule with `& $rafikAdb -d reverse --remove tcp:55331` and turn USB debugging off when finished. Keep the installed candidate for future in-place upgrade testing.

## Upgrade without losing saved work

Keep `org.rafik.field`, the same release signing key, the device database name and SecureStore identifiers. Every distributed update must increase `android.versionCode` in `apps/mobile/app.json`; the beta.2 preparation uses `1000002` (published beta.1 uses `1000001`). Update the app/package versions, root lockfile, changelog and English/Arabic landing guidance together. The backend OpenAPI document's `info.version` identifies the API contract independently of the product release.

Install the newer signed APK over the old one using Android's update prompt, or `adb install -r <new.apk>` on the separate test device. Never uninstall, clear app data or regenerate the signing key as an upgrade workaround. Test an unsent synthetic command/draft through the actual update, then reconnect and verify acknowledgment. Reinstalling identical bytes with `-r` is only a reinstall check; it does not prove migration to a newer version. Downgrades are not a supported recovery method. Server backups do not include device queues. Use the [canonical signed-upgrade walkthrough](../testing/instance-validation.md#signed-android-upgrade--requires-a-new-release-candidate) for the manual acceptance record.

### Current beta qualification evidence

On 19 October 2026, an isolated Android 14 x86_64 emulator passed offline cold startup without Metro and a code 1 → 1000001 in-place update preserving pending attendance and an unsubmitted score draft. The lower-code baseline used the same production bundle and release key, changing only manifest versionCode and re-signing. This checks current-format state preservation, not migration from a historical published release or an older schema. The untouched final APK then replayed attendance/results and completed the event online. See [verification](../verification/README.md) for checksums, screenshots, environment limits and the stale offline-banner issue.

## Publish

For a new release, complete the relevant [release checklist](release-checklist.md), commit the candidate, create its annotated tag and publish the accepted APK, `SHA256SUMS` and non-secret `build.json`. Mark evaluation releases as prereleases and describe known limits. Update landing English/Arabic release, installation and upgrade guidance through a reviewable PR. A beta announcement does not close institution-specific privacy approval or the first-user feedback backlog.

### Close beta.1 distribution

**20 October update:** the founder uploaded the APK/checksum/build metadata together as `1.0.0-beta.1.zip`. The published APK's computed checksum matches all recorded values. Download/installation guidance now links that bundle; direct uncompressed APK upload is optional convenience, not a blocker. Beta.1 Android distribution is complete. The steps below are a historical close-out procedure for this release, not remaining acceptance gates.

The existing beta.1 tag resolves to `4ac70c8`; the later locally packaged APK records `5d1ce76`. Keep the published tag intact. GitHub can host that APK on the existing prerelease, provided the release notes identify its exact source revision separately from the source archives. Never describe it as compiled from the older tag.

1. Merge the phone/build documentation review and its paired English/Arabic landing update. Keep next-release application PR #135 and landing PR #11 separate from beta.1.
2. Select the preserved accepted APK and its matching checksum/build metadata. Confirm the recorded revision and certificate against the packaging receipt. This is artifact identification, not a request to repeat the founder's passed phone walkthrough. Do not rebuild just to make the APK match today's documentation commit.
3. Upload only the APK, `SHA256SUMS` and non-secret `build.json` to the existing [beta.1 prerelease](https://github.com/Rafik-Athlete-Managment/Rafik-OpenSource/releases/tag/v1.0.0-beta.1). In its release notes list the APK source commit, checksum, application version/versionCode, owner-reported S20+ result and known limits. Label the automatically generated archives as source from the release tag. Do not move the published tag or generate another signing key.
4. Verify the uploaded file's checksum against `SHA256SUMS`, then enable the exact versioned APK link in both landing languages. State the supported HTTPS API URL setup and coach-only scope. If no APK is uploaded, show source-build instructions rather than an enabled APK download.

This closes the current Android distribution task. Broader devices, accessibility, historical upgrades, first-user feedback and institution-specific live-data approval stay in their existing backlog; they do not require another beta.1 packaging cycle. Any later runtime change requires a separately identified candidate and relevant verification.

References: [Android signing](https://developer.android.com/studio/publish/app-signing) and [React Native release builds](https://reactnative.dev/docs/signed-apk-android.html).

## Maintained launcher artwork

Founder-provided density-specific PNGs live in `apps/mobile/assets/android-icons/`. The highest-density PNG is also the Expo icon source. `android.mjs` copies the maintained PNG at each density to both regular and round launcher resource names after native preparation, removing only conflicting generated WebP files with those exact names. Edit the maintained artwork rather than only `android/app/src/main/res`: generated resources are not committed and may be recreated. Launcher changes require a signed native rebuild; ordinary JavaScript refresh cannot update an installed launcher icon.

## Beta.2 upload bundle — 22 October 2026

The rebuilt bundle is `artifacts/mobile/1.0.0-beta.2.zip`. It contains the `1.0.0-beta.2/` folder with signed APK, SHA256SUMS and build.json. Compiled source: `4b6cb380369882b76caa5306c9949fdf5a96a8d9` (clean); Android code 1000002; signer matches beta.1. APK SHA-256: `566d9387caf73d671ee9a03479271f3965acc7c3b9a58c14eeb121cadbf0f589`. ZIP SHA-256: `8cd3a5556bb6414faa72f0bac7d2a68fc15acef152f90d0957d990d3bc56c9f3`. This replaces the earlier unpublished beta.2 package; do not upload an older local copy.

Merge the final release-preparation PR before tagging the approved beta.2 source, then upload this ZIP to the GitHub prerelease. Later documentation-only commits do not change the APK compiled-source revision in build.json. Landing copy is publication-ready on the founder’s explicit instruction to assume their forthcoming upload; this is not independent evidence that the upload occurred. No device upgrade or published-byte check is claimed.
