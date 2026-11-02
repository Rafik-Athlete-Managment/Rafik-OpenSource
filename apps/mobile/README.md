# Rafik Field app

The Android workspace is the Stage 7 coach-first field app. Instance sign-in, bounded schedules, event downloads, attendance, assessment drafts/results and event completion are implemented locally. Online correction history, device/server comparison, explicit plain-text recovery sharing and English/Arabic UI are implemented. Beta.1 is published and accepted for beta evaluation; broader native coverage remains follow-up work. Use synthetic data only.

## Local development

From the repository root, use Node 22.16 or Node 24 and install the monorepo once:

```sh
npm ci
npm run mobile:start
```

Build/run the Android development client on a machine with Android Studio, Android SDK and a running emulator or USB-connected device:

```sh
npm run mobile:android
```

This command uses the maintained launcher in `scripts/android.mjs`. Windows builds get shorter CMake staging paths, object-path hashing and limited native/Gradle concurrency. Use `npm run mobile:android -- --device` to choose a device, or `npm run mobile:android -- --prepare-only` to configure without building. See the [Windows setup and troubleshooting guide](../../docs/development/android.md#windows-laptop-startup-and-rebuilds). The launcher does not update Ninja or change emulator settings. Once installed, normal JavaScript/UI work uses `npm run mobile:start`.

The unreleased phone refinement adds `react-native-svg` for one Lucide icon family. Existing development installs need one native rebuild with `npm run mobile:android` before Metro can load this source; later JavaScript edits use `npm run mobile:start`. A standalone beta.3 release APK must likewise be built with this dependency included. The published beta.2 APK is unchanged.

This app enables SQLCipher and requires a native development build; Expo Go does not include that native configuration. On an Android emulator, use the host's emulator address (commonly `http://10.0.2.2:55331`) for the local API. For a physical phone and local HTTP backend, use [USB forwarding](../../docs/operations/android-release.md#connect-without-a-domain) and `http://127.0.0.1:55331`; LAN HTTP is not allowed. Remote institutions must use HTTPS.

The canonical [Android development guide](../../docs/development/android.md) explains instance URLs, coach setup, attendance/scores, completion, sync states, account isolation and recovery. The app requests current workspace roles and a bounded 14-day schedule; non-trainer roles see no coach workflow.

## API contract

The coach app's supported OpenAPI subset is at [`../backend/openapi.json`](../backend/openapi.json), exported at `/v1/openapi.json` and shown in bundled Swagger UI at `/v1/docs` (`/api/v1/docs` through Compose). See [the API guide](../../docs/reference/api.md) for local native login and Authorize. Production viewers are reference-only; local requests use synthetic accounts.

## Current limitations

- Attendance works only for an event roster explicitly downloaded online. Focused API/emulator evidence is in the [verification record](../../docs/verification/README.md); it does not establish complete device acceptance.
- Correction history, recovery comparison/sharing and Arabic UI are implemented. URL scanning remains unfinished. Completed-event corrections currently use the web app.
- The founder reports the standalone Galaxy S20+ field/offline walkthrough passed on 20 October 2026. Broader device/accessibility and historical-upgrade coverage remain separate. iOS is out of scope.

## Standalone beta package

Squire `1.0.0-beta.1` is the published, accepted Android evaluation beta. Use root `npm run mobile:release` after restoring/creating the private local signing material. See [Android beta builds and updates](../../docs/operations/android-release.md) for output paths, key backup, clean-device installation and upgrade checks. A successful build alone is not package acceptance.

Coaches can install the official APK from the published Android ZIP bundle. One APK connects to institution servers configured at sign-in. See [choose the right path](../../docs/operations/android-release.md#choose-the-right-path) and the [fresh-checkout standalone build](../../docs/operations/android-release.md#fresh-checkout-standalone-build). Independent distributions use their own signing key and maintain their own updates; Rafik's release key is private. The published beta includes an [Android ZIP bundle](https://github.com/Rafik-Athlete-Managment/Rafik-OpenSource/releases/download/v1.0.0-beta.1/1.0.0-beta.1.zip): extract it and open the APK. See the [phone installation steps](../../docs/operations/android-release.md#install-the-published-beta).

For connection/access feedback regression checks, run `npm run test:request --workspace @rafik/mobile`. See the [release guide](../../docs/operations/android-release.md) for private-key backup and physical-phone checks without an emulator or domain.

Launcher artwork is maintained in `assets/android-icons/`, referenced by app.json and applied to generated regular/round icons by the Android helper. See [the release guide](../../docs/operations/android-release.md#maintained-launcher-artwork).
