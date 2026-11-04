# Stage 7 mobile scope

**Status:** coach-first beta.1 accepted and published, 20 October 2026. API and focused emulator evidence is available; the founder reports the S20+ phone walkthrough passed. Broader native acceptance and exact device/build metadata remain separate.

## Goal

Help university staff and athletes complete useful training and field-work tasks on Android phones or tablets. The app must connect only to the user's university instance. It must preserve the server's current role, assignment, privacy, revision and audit rules.

## Implementation status — 19 October 2026

Coach sign-in/refresh/logout, bounded schedules, explicit event caching, attendance, assessment drafts/results, completion, online correction history, recovery comparison/sharing and English/Arabic are implemented. The supported OpenAPI contract and instance Swagger viewer are available. Isolated real-API and Node SQLite checks passed; focused Android 14 emulator checks covered encrypted-store initialization, process restart, replay, history, completion and a controlled current-format upgrade. The final feedback/cached-startup rebuild passed packaging, with the founder subsequently reporting the S20+ walkthrough passed on 20 October; exact installed-build metadata and broader coverage remain separate. See [verification](../verification/README.md) for exact revisions and limits.

The founder accepted the Galaxy S20+ physical walkthrough. Broader native conflict/revocation/account-switch rendering, accessibility and full screen/theme coverage remain follow-up coverage, not beta.1 release blockers. URL scanning is not implemented; entering the institution API URL manually is supported. These limitations do not imply API/auth implementation is absent.

## First release tasks

| User            | Supported tasks                                                                                                                                                                                       | Excluded from the first mobile release                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Coach / trainer | See assigned field events; open an authorized event roster and assessment definition; record attendance and assessor-led performance results; finish the event; review prior results and sync status. | Administration, user invitations, program authoring, messages, analytics configuration and unrestricted athlete records. |
| Athlete         | No native role in the first release. Existing mobile web remains available for athlete training workflows.                                                                                            | Athlete native dashboard/workout logging, other athletes' data, and clinical or diagnostic health functionality.         |

The founder confirmed coach-first. The coach beta workflow is accepted; athlete-native work remains outside this release.

## Offline boundary

- Allow offline capture only for a field event the coach opened and whose authorized roster/assessment definition were fetched while online. No general offline roster search or offline discovery.
- Queue each attendance or assessment change locally before showing it as safely stored on the device. Show device-saved, sending, acknowledged, needs-attention and blocked/revoked states distinctly.
- Use an immutable operation ID and payload for retries. A lost response retries the same operation; editing creates a new operation against the latest acknowledged revision.
- Recheck current server authorization on every replay. Never upload a pending record under another account or institution. A revoked or reassigned user's unsent work remains visibly blocked and requires an explicit recovery/export or discard decision; it must not silently change owner.
- Do not cache conversations, private files, injury-status records or broad rosters for offline use in the first release. Evict acknowledged event/roster data after the event is completed and all operations are acknowledged; keep unresolved queue items encrypted and visible until explicit recovery or discard.
- Encrypt app-private local records and credentials using Android platform storage protections. Define logout, account switch, device loss and app removal behavior before implementation; do not claim secure deletion beyond what the platform can demonstrate.

## API support and remaining evidence

Native bearer sessions and actor-scoped calendar/history/receipt APIs are implemented. The [canonical OpenAPI contract](../../apps/backend/openapi.json) defines the supported subset; the [API reference](../reference/api.md) explains browser/native boundaries and Swagger availability. Real-API tests cover lost acknowledgments, duplicate delivery, conflicts, history permissions and membership revocation. Native rendering of all those recovery cases remains a separate acceptance task. Workout logging continues in the web app and is not part of this native release.

## Selected architecture constraints

- Keep the native client in a separate `apps/mobile/` workspace.
- Use React Native with Expo and TypeScript. It matches the existing TypeScript API/contracts and keeps the first app Android-focused without introducing another language/toolchain. Keep UI and durable storage platform-specific where needed.
- Use Expo SQLite with SQLCipher for encrypted event cache and a durable, ordered command queue; keep its database key and native access/refresh credentials in Expo SecureStore. SQLCipher requires a development/production native build, not Expo Go. Do not claim background sync: the first release syncs on app foreground/resume, explicit retry and connectivity return while the app is active.
- The user enters their university API URL. The app must support HTTPS self-hosted instances and local development URLs without binding to a Rafik-hosted service.
- Manual entry of the university instance URL is supported in beta.1; scanning is deferred follow-up scope. Do not bind the app to Rafik-hosted services or provider credentials.
- Store no service-account key, universal API secret, or hidden operator credential in the app.
- Keep server validation and authorization authoritative. The mobile client may validate for usability but must not duplicate business rules as its security boundary.
- iOS is out of scope unless the founder explicitly expands it after Android acceptance.

## Acceptance coverage and follow-up

1. API integration tests cover duplicate delivery, lost acknowledgements, exact retry, edited retry rejection, changed revisions, revoked access, changed assignment and multi-device conflict.
2. Device storage tests cover process death/restart, account switch, logout, app upgrade and recovery of each pending state.
3. Emulator checks cover coach field journeys, online/offline transitions, interruption, layouts and accessibility. Athlete web journeys are checked separately. Report physical-device checks separately.
4. Human field review confirms the selected task flows are workable in real coaching conditions. Emulator success alone does not prove field usability.
5. Documentation explains instance enrollment, account setup, supported offline behavior, sync/recovery states, privacy boundaries and known limits.

## Distribution and device acceptance

- The founder selected direct signed APK beta preparation on 19 October 2026. See [ADR 0024](../decisions/ADR-0024-android-beta-distribution.md) and [release operations](../operations/android-release.md); Google Play remains deferred.
- The configured minimum is Android API 24 with ARM64/x86_64 builds. Supported OS versions and screen sizes still require device verification; a configured minimum is not a compatibility claim.

## Coach field API contract

The mobile app uses the existing organization APIs; the server remains the sole authority for roles, participants, event state, attendance, assessment validation and revisions.

1. Authenticate to the selected instance using the dedicated native session endpoints. Do not put browser cookies or a shared API key in the app.
2. Load current workspaces and role grants through `GET /v1/contexts`; only trainer contexts expose coach field workflows.
3. Load a bounded local-date window with `GET /v1/workspaces/{workspace}/calendar?view=trainer&from={date}&to={date}&zone={iana-zone}&offset={offset}`. Follow `next` for additional pages; do not download the full season.
4. Before going offline, fetch one event detail with `GET /v1/workspaces/{workspace}/calendar?view=trainer&id={event-id}`. Cache only that event, its event participants, current attendance/result revisions and assessment definition.
5. Each attendance write is `POST /v1/workspaces/{workspace}/calendar` with `action: "attendance"`, `view: "trainer"`, event `id`, participant `member`, attendance enum, participant `revision`, and a stable `operation` UUID.
6. Each assessment write is a separate `action: "result"` command with participant `member`, existing result revision (zero when absent), validated values, note and stable `operation` UUID. Queue it after that participant's present command so server attendance preconditions are met.
7. Finish the event with `action: "finish"`, event `revision` and its own stable operation UUID only after all required attendance and assessment commands are acknowledged.
8. Replay each exact command in order. A lost acknowledgement retries the identical UUID and payload. A changed payload gets a new operation only after the prior result is known. On 403/409, stop dependent commands, refresh authorized event data when allowed, and show the exact correction/revocation state; never force-merge assessment values.

The API has actor-scoped transactional operation receipts and current role/assignment checks. The Android bearer-session flow and supported OpenAPI subset are implemented locally; browser cookie/origin behavior is retained. Native/auth/API integration checks passed; physical and broader native rendering evidence remain required before extending device claims. The field package now includes assessment definitions and current results. Correction-history UI is implemented; broader native/API acceptance remains open.

## Future tablet direction — founder decision, 26 October 2026

Field launch is the intended focus for the later tablet experience: fast Resume/Start/Attendance actions with compact athlete-status context for field work. The web uses the balanced Coaching desk. This is a design direction for a subsequent tablet slice, not an implemented navigation change, a new APK or proof of offline workout capture.
