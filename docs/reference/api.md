# API conventions

## Individual workout agenda — unreleased beta.3

`GET /v1/institution/workout-scheduling?view=trainer` returns `{items,total,offset,limit}`. Optional `assignment`, athlete-name `search`, `offset`, bounded `limit` (1–100; default 10), and `due=true` narrow the projection. Due includes unresolved occurrences on/before the signed-in account's local day and unfinished older unlinked records. Stable assignment creation/ID order is used within the requested scope, not urgency ranking. Reads never create occurrences.

Each item contains assignment/athlete identity, title/goal, sequence cursor, next immutable day, state (`unscheduled`, `scheduled`, `ready`, `overdue`, `in_progress`, `paused`), general `blocked` reason, current occurrence/session and `can_start`/`can_schedule`. These flags describe the read snapshot; writes always reauthorize and recheck current state. Trainers receive primary-athlete plans and only the relevant sport plans for supporting links; athletes receive their own assignments. Administrators can schedule/review, but do not receive coach recording actions. Canonical shapes are in the [shared contracts](../../packages/shared/src/contracts.ts) and [OpenAPI](../../apps/backend/openapi.json).

The web uses existing POST scheduling commands and passes `occurrence_id` when starting a session. New UI work is fixed-time only; weekly recurrence/worker preparation, additional group workout capture and Android recording remain pending.

## Unreleased beta.3 founder-validation corrections

`GET /v1/institution/communication?view=...&contacts=true` returns `self: { id, roles }` and minimal `members: [{ id, name, roles, active }]`. Athlete contacts are active assigned primary/supporting coaches; coach contacts retain training scope; administrators can contact active institution members. This does not grant access to the staff people directory. Athlete `create` commands require a two-person pair including self and an authorized coach, with that coach as sole manager. Normal conversation list responses also include `groups: [{ id, name }]` for staff-authorized groups without an existing linked channel. Existing pair/group uniqueness and replay checks remain. New group channels remain distinct from private pairs even with two participants. Opening an existing nonprivate group channel can visibly join its currently authorized staff member without granting management or changing other historical participants; existing private-pair audiences cannot be expanded this way.

Athlete program list/detail/version reads require their own institutional assignment. They return assigned immutable versions, not unrelated listed programs or newer unassigned versions. Assigned group membership grants coach read/open-conversation access, not edit authority; group results include `canEdit`.

## Unreleased beta.3 individual workout scheduling

`POST /v1/institution/workout-scheduling` requires current administrator/trainer membership and authority for the assignment's athlete and sport. Every request includes `operation`, `view`, `action` and `assignment_id`. Native bearer requests use `X-Rafik-Client: android`; existing browser sessions use `web` and existing origin rules.

| Action               | Additional fields                                                 | Behavior                                                                            |
| -------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `schedule-workout`   | `cursor`, `starts_at`, `ends_at`, `timezone`; optional `location` | Bind the next non-rest cycle day; return occurrence and position without advancing. |
| `reschedule-workout` | `occurrence_id`, `revision`, `starts_at`, `ends_at`, `timezone`   | Move unstarted pending work; keep the same sequence identity.                       |
| `skip-workout`       | `occurrence_id`, `revision`, nonblank `reason`                    | Resolve pending/paused work and advance its assignment once.                        |

Use offset-bearing timestamps, a valid IANA timezone and a duration no longer than eight hours. `cursor` is the assignment's current `sequence_cursor`; it starts at zero. A pending predecessor, unlinked unfinished historical workout, stale cursor/revision, collision or cannot-train status prevents binding. An explicit booking can use a rest day but does not override a participation restriction. Same assignment/date/day results retain their historical uniqueness. Exact retries return the original response only after current authority is checked. Errors use the existing `{message}` envelope.

For `/v1/institution/sessions`, a bound `start` supplies `occurrence_id` along with the existing `id`, `assignment_id`, `day_id`, `view` and `operation`. The booked time must have arrived. Save actual measurements with the existing `save` payload (`revision`, `entries`, `note`, `complete`); completion resolves its linked position atomically. Corrections preserve completed progression. Generic calendar finish/reschedule/cancel/staff commands return `use_workout_scheduling` for these occurrences. Attendance is separate from exercise completion.

This is a fixed-time server slice. No new web scheduling controls, recurring worker, day-only/group workout writes or Android offline workout UI/queue upgrade is available yet. Existing unlinked workout history and v1 attendance/assessment receipts remain. See the canonical OpenAPI schemas for request fields.

## Breaking beta.3 API boundary

Unreleased: additional-institution creation and Tasks endpoints are removed. Create the installation’s institution through first-run setup only. Only canonical `/v1/institution/...` services remain; published workspace/context and organization-prefixed aliases are removed. Generic `/v1/commands`, `/v1/queries` and `/v1/files` gateways are removed. Native institutional operation payloads/receipts remain unchanged, but beta.2 clients require the matching Android upgrade. Browser URLs are independent of API scope names. See [ADR 0026](../decisions/ADR-0026-single-institution-routing-and-task-retirement.md).

The browser calls the Node API at `/v1`; `apps/frontend/src/lib/backend.ts` is the sole transport adapter. `packages/shared/src/database.types.ts` is generated from the backend schema by root `npm run backend:types`; domain JSON interfaces remain in feature modules. The API uses Prisma with the restricted PostgreSQL application role. Database constraints and explicit transaction functions remain authoritative.

## OpenAPI / Swagger export

The supported coach calendar detail also accepts `historyOnly=true`, required `historyMember=<event athlete UUID>`, `historyKind=attendance|results` (default results) and `historyOffset` (0–100000), alongside `id` and `view=trainer`. Returns `{items,next}` with up to 25 entries, ordered newest timestamp/ID first. Attendance entries project the previous/new marks from event audit; result entries include revision, values and note. Both include recorded time and institution member attribution where available. The original entry is included, not only later corrections. Event staffing and participant visibility are rechecked on every page; athletes cannot read another participant. These reads require the updated backend and do not change write/retry semantics.

`apps/backend/openapi.json` is the versioned OpenAPI 3.1 contract for the supported coach field API: native authentication, role contexts, bounded calendar reads, and attendance/result/event-finish commands. An updated backend exports it at `GET /v1/openapi.json` and serves Swagger UI at `/v1/docs`, without requiring authentication. This is a maintained supported subset, not an inventory of every web-only API; this document remains the broader route reference.

### Open Swagger locally

1. Start or restart the backend with `npm run start:api` from the repository root.
2. Open [Swagger UI](http://127.0.0.1:55331/v1/docs) (adjust the port if configured differently).
3. Expand the native password-login endpoint, choose **Try it out**, and use a synthetic coach account. Copy the returned `access_token` into **Authorize**, then execute the protected coach endpoints.

The viewer sends `X-Rafik-Client: android`, omits browser cookies and targets only the current instance. Authorization is cleared on refresh. It loads bundled assets locally, disables the external validator and does not persist tokens. Dependency analytics are disabled during installation.

For Compose self-hosting, use `/api/v1/docs` and `/api/v1/openapi.json` on the installation's web origin. With `NODE_ENV=production`, the viewer is reference-only: **Try it out** is disabled. API authentication/authorization remains enforced independently. Use synthetic data in examples. These routes require a backend revision containing this implementation; the landing site does not host this viewer.

## Routes and authentication

### Staff plan indexes (web)

- `GET /v1/institution/scheduled-events?view=admin|trainer`: 24 scheduled activities per page, across dates. Optional `kind=all|training|assessment`, `state=all|scheduled|completed|cancelled`, title `search` and `offset`. Returns event summaries with `athlete_count`, full matching `total` and `next`, ordered by scheduled start descending and ID ascending. Coaches see only events where they are designated staff. Participant identities/results remain in separately authorized calendar detail reads. This web-only endpoint does not change the supported coach OpenAPI subset.

- `GET /v1/institution/athlete-plans?view=admin|trainer`: 24 assignments per page; `offset`, `search` (athlete/program), optional `member`, and `status=active|upcoming|expired|ended|all` (default active). Returns `items`, full matching `total`, `next`, `today` and viewer `zone`. Active/upcoming lists exclude inactive memberships. Dates use the viewer profile timezone; expiry is inclusive. `assignment=<uuid>` resolves one authorized immutable assigned version, including its prescription, independent of list status/search.
- `GET /v1/institution/nutrition-plans?view=admin|trainer`: 24 summaries per page; `offset`, `search` (athlete), optional `member`, and `status=active|upcoming|expired|superseded|all` (default active). Returns `items`, full matching `total` and `next`. Status uses each athlete's existing local-date rule. A later effective plan replaces earlier guidance once effective; higher revisions replace plans with the same effective date. Summaries contain identity, dates and revision, without meal diaries or targets.
- Existing nutrition detail reads accept `plan=<uuid>` alongside `member` to locate that exact authorized version in ten-row revision history. Diary-sharing checks still apply independently. Existing delivery reads with `history=true` return recorded workouts across the authorized roster, with optional `member` and the existing older-page cursor.

Both new indexes require administrator or trainer membership; a trainer sees only assigned athletes. These routes require an updated backend and are web API additions, outside the supported field OpenAPI subset. No database migration is required for these reads.

- `GET /v1/auth/setup-status`, `session`; `POST /v1/auth/setup` creates the first super admin and institution atomically on an empty instance; `POST /v1/auth/password-login`; `POST /v1/auth/logout`. Sessions are opaque HttpOnly, SameSite cookies backed by hashed tokens. Browser requests include credentials.
- `POST /v1/auth/accept-invitation` accepts a pending seven-day, single-use institution invite, creates the account with a password and starts a session. No email is sent or verified. `POST /v1/auth/complete-password-setup` consumes an admin-issued one-time password setup token (24-hour expiry) and revokes existing sessions.
- New passwords must be 8–128 characters and include an uppercase letter, lowercase letter, number, and punctuation or symbol. Password login accepts existing credentials so older passwords remain usable.
- Local-only `/v1/auth/local-preview`; `/health` checks database connectivity. These adapters cannot start in production configuration.

Mutation requests require `X-Rafik-Client: web` and an allowed origin. SQL actor settings are local to each transaction, never caller-supplied credentials. Direct table writes and operator actions are not browser APIs. The local operator script has a separate guarded database path.

## Response, retry and errors

Commands return JSON scalar/row or an array for a set-returning function. Errors are `{message: <stable code>}` with HTTP status: invalid values 400, unauthenticated 401, forbidden 403, unavailable 404, conflicting write 409, rate limit 429, unexpected service failure 500. Never expose SQL or credentials in responses.

Compare-and-swap writes use the acknowledged revision. Stable-ID commands persist exact ID/payload before sending. Network errors and 5xx outcomes are ambiguous and preserve that command for replay. Confirmed 400/403/409/422 rejection unlocks correction. A different payload with the same receipt ID is rejected. The friendly bilingual mapping is `apps/frontend/src/lib/i18n.ts`; do not replace contextual errors with generic success.

Publications and started sessions are immutable server-selected snapshots. Preserve prior device records and history when adding optional JSON fields. Review validator, receipt, queue, editor, review/progress, export and copying together.

## Dates and privacy

Training schedules use client-local calendar dates. Appointments use UTC instants plus original IANA timezone. Analytics compare actual values of the same kind with explicit units/denominators. Messages are participant-scoped; foreground polling is not external notification delivery. API responses/private bytes are `no-store`; the service worker caches only static assets.

## Institution membership API (R7A2)

- `GET /v1/institution/context`: current institution memberships and separate operator grant. IDs remain stable; the browser destination is `/dashboard`. Wire roles remain `admin`, `trainer` and `trainee`.
- `GET /v1/institution?view=admin|trainer|trainee`: current-role projection; no personal profile disclosure.
- `POST /v1/institution`: `invite`, `revoke-invite`, `member`, `assign-trainer`, `rename`, `close`; operation UUID, revision where applicable, current admin authority checked before receipt replay.
- `GET /v1/invitations/:token`: invitation preview including the intended account email, granted role and expiry. The email is an account identifier; it is not verified. Unauthenticated account creation uses `POST /v1/auth/accept-invitation`; a signed-in matching account uses `POST` on the invitation route.

### Sports and coaching specialties (Release 1a)

- `GET /v1/institution/sports?view=admin|trainer`: the institution's sports and coaching specialties (`id`, `name`, `kind` = `sport` | `specialty`, `archived`, `revision`), sports first. Athletes are refused.
- `POST /v1/institution/sports`, administrator only, with an operation UUID:
  - `sport` creates or updates `{ id, name, kind, archived, revision }`. Revision is `0` for a new entry. Names are 1–80 characters and unique per institution regardless of case. `kind` cannot change after creation. An institution can have at most 200 entries.
  - `member-sports` sets `{ member, sports, previous }` for an active athlete or coach. `previous` must equal the current set, or the request returns `409`. Athletes accept sports only. Archived entries cannot be newly added, but existing links stay.
- `GET /v1/institution/people` returns each member's `sports` IDs and accepts an optional `sport` filter, applied inside the caller's existing People scope.

These labels describe people. On their own they grant no access; Release 1b uses them to scope supporting coaches.

### Coaching team (Release 1b)

- **Supporting coaches:** `POST /v1/institution` (administrator) accepts `link-coach` `{ id, athlete, coach, sport }` and `end-coach-link` `{ id, revision }`, each with an operation UUID.
  - The athlete must be an active athlete and the coach an active coach.
  - The coach must cover the sport or specialty; for a sport, the athlete must take part in it.
  - Errors: `already_primary`, `already_linked` and `sport_not_covered`.
- **Primary coach:** `assign-trainer` still sets it. That ends the previous primary link and any supporting link held by the new primary.
- **People:** `/people` returns each athlete's active `coaches` (`id`, `coach`, `kind`, `sport`, `revision`). A coach's roster includes athletes they support.
- **Supporting-coach access ([ADR 0025](../decisions/ADR-0025-coaching-team.md)):**
  - Allowed: delivery and history reads, athlete plans, single-session reads, assessment history and program/session media, plus choosing the athlete for their own events, groups and messages.
  - Primary coach only (`403` otherwise): nutrition and nutrition plans, participation status, workout review, follow-up and trainer analytics. Plan writes follow the rules in Release 1c below.

### Concurrent goal-specific plans (Release 1c)

- **Assign:** `POST /v1/institution/delivery` `assign` accepts an optional `goal` (1–80 characters) and `sport`.
  - Each recipient may set `replaces` with `replaces_revision` to supersede one active plan; `null` adds a concurrent plan.
  - The legacy `assignment_id`/`assignment_revision` pair still means replace.
  - The same version cannot be active twice for an athlete (`409 already_assigned`).
  - Each created assignment returns `overlaps`: every other active plan for that athlete whose dates overlap, as `{ title, goal, start_date, end_date }`. Overlap is reported, never blocked.
  - **Intentional exception:** these entries include plans outside a supporting coach's sport, so coaches can coordinate, but they never carry a plan ID, prescription or sessions ([ADR 0025](../decisions/ADR-0025-coaching-team.md)).
- **End:** `end` `{ assignment, revision }` archives one plan; sessions and the published version are kept.
- **Supporting coaches:** may add, replace or end only plans labelled with a sport they are linked to for that athlete. Their delivery, history, athlete-plan, session and media reads include only those plans and the sessions recorded against them. Assessment history shows them only results from events they staffed, because events carry no sport.
- **Reads:** recipients return every active plan in `plans`, and `athlete-plans` items include `goal`, `sport` and `revision`.

### Delegated workout logging (Release 1e)

- **Start for an athlete:** `POST /v1/institution/sessions` `start` with `view: "trainer"` starts a session for the athlete who owns `assignment_id`. The coach needs plan authority: primary, or supporting for the plan's sport.
  - The session records `recorded_mode: "delegated"` and `recorded_by`/`recorded_by_name` (the coach member).
  - The athlete stays the subject (`member_id`, `client_id`). Operation receipts carry the coach.
- **Coach saves:** `save` with `view: "trainer"` is allowed on delegated records and unfinished athlete-started records, with plan-specific authority rechecked on every save/retry. Preserve the original recording mode and starter. First completion adds completion member/name/role to the document. New coach edits to completed self-logged actuals remain forbidden; the exact acknowledged completion can still replay its receipt. Entries use the same measurements as athlete sets: strength records `load`/`reps`; timed and distance record `seconds`/`metres`; `effort` is optional. A completed set needs a positive actual result.
- **Athlete corrections:** the athlete can save (correct) any of their sessions.
- **History:** every start and save writes an `institution_session_history` version. `GET /v1/workouts/:id/history?view=` returns versions oldest first, each with `actor_name` and `by` (`athlete` or `coach`), under the same read authorization as the session.
- **Analytics:** `summary.coach_recorded` counts completed delegated sessions in the window.

See [ADR 0005](../decisions/ADR-0005-organization-and-independent-scopes.md). These Prisma-internal tables have no generic browser row grants. Closure preserves records while removing access; an exact closure retry confirms the old result.

## Scoped programming

`GET /v1/institution/programs?view=admin|trainer|trainee` supports `search`, `offset`, `program` or `version`; list pages contain 24 programs. `POST` supports explicit save/publish/archive commands with an operation UUID and draft revision. Publishing creates an immutable version and makes the program available in the institution library; assignment remains a separate action. `GET /catalog` is staff-only; exercise writes use the programs command boundary.

`GET /delivery` returns authorized recipients/assignments. Sessions are included only when `history=true`; `before` is then a verified session UUID cursor, and history mode includes former trainees with retained history. `POST /delivery` atomically assigns a fixed version to 1–50 reviewed recipients with member and current-assignment revisions. New standalone authoring/delivery HTTP commands are blocked; historical data, owned export and exact supported replay remain; see [ADR 0021](../decisions/ADR-0021-organization-only-web-experience.md).

`POST /sessions` starts/saves/reviews organization workouts; `/v1/workouts/:id` and `/previous` supply authorized record/actual references. Publication/started snapshots and first completion time are retained. Current responsibility is checked before receipt replay. `PUT /v1/program-media/:id?workspace=:id` accepts at most 2 MiB PNG/JPEG/WebP; the authenticated GET rechecks publication/assignment/member access. `/v1/account/institution` exports only the authenticated subject's organization records.

## Institution services and analytics

- `GET /v1/institution/services?view=&kind=templates|groups&search=&offset=&archived=`: 25-row catalog. POST explicit `template`/`group` commands, stable operation UUID and revision. Groups contain at most 100 active athlete memberships; administrators may also add active coaches. Trainers may add only assigned athletes to groups they own. Templates have 1–12 typed drills.
- `POST /calendar-preview`: local timestamp, IANA zone, integer minutes/count/every; returns actual UTC intervals. `POST /calendar` supports create, one-occurrence reschedule, admin staff replacement, cancellation, attendance, result and finish. Creation is atomic for at most eight occurrences; selected recipients are fixed.
- `GET /calendar?view=&from=&to=&zone=&offset=`: at most 31-day window, 50 rows. `id=` returns one authorized detail with latest 100 correction entries, explicitly labelled by the UI. Trainee projections hide other trainees.
- `GET /analytics?view=&from=&to=&member=&search=`: separate authorized reports, date window at most 366 days, 25 matching filter subjects. Workload remains organization-wide.
- `GET /assessment-history?view=&member=&from=&to=&offset=`: 50 authorized results and subject name. Same-definition comparisons use immutable definition/template revision; absent/excused rows remain historical records but do not enter the performance line.

All mutations validate current role/resource before exact receipt replay; revisions conflict explicitly. Date parameters are calendar dates in the viewer's profile timezone. No external scheduling/reminder provider is connected.

## R10 communication and notification endpoints

Message `send` accepts an ordered `asset_ids` array of at most 10 distinct uploaded asset UUIDs. The legacy `asset_id` is still accepted; if both fields are supplied, it must match the first array entry. Each file must belong to the sender, institution and conversation, have message purpose and be active. The message and links commit atomically with the operation receipt. Detail reads return `asset_ids`, the first `asset_id` for older clients, and ordered `attachments` (`id`, `filename`, `media_type`). Attachment names go only to the channel audience that can already read the bytes. File downloads still require current channel membership; unsent uploads remain owner-only. The web composer supports multiple selections, individual removal and ordered draft recovery; upload limits stay 25 MB per file with the existing image/GIF/MP4/PDF types.

- `GET /v1/institution/communication?view=…&search=…&offset=…`: 25 channel summaries; admin `manage=true` exposes metadata only. Search matches channel titles and, for direct conversations, the other participant’s name. The response includes `directPeople`, the member IDs with whom the current member already has a private pair, so the UI can omit them from new-contact choices. `id` reads an authorized channel, `before` its prior sequence page (50).
- `POST` on that path: explicit `create`, `open-group`, `join`, `members`, `archive`, `rename`, `send` commands with stable operation UUID; `read` is monotonic and needs no receipt. `open-group` reuses the single conversation linked to the training group. Two-person conversations are unique per institution and participant pair; archived direct conversations reopen on request. Current role/resource permission precedes replay.
- `GET /v1/notifications`: latest authorized prompt per group, 25 per bounded page; `id` validates a direct link. `POST {id}` observes that group through the selected sequence.
- `GET/POST /v1/notifications/preferences`: own four-category in-app/local-email booleans and quiet hours, revision checked.

Local dispatch is CLI-only. No public generic event emission, provider send or operator endpoint is registered.

## R11 operations and continuation reads

- `GET /v1/platform?section=organizations|users|support|audit&search=&offset=`: separate current platform grant; 25 operational rows and `next`. Every access is recorded. Audit defaults to writes; `includeReads=true` includes access events. No generic private-record access.
- `POST /v1/platform`: `operation`, `action` (`organization_state`, `identity_state`, `support_reply`), `id`, `revision`, `reason` (10–500 characters), and `value` or `reply`. Payload identity/revision and grant checks govern replay. Confirmed refusal is editable; uncertain acknowledgment keeps the exact pending operation.
- `GET /v1/institution/people?view=&role=&state=&search=&offset=&selected=&self=`: 25 scoped memberships, full filtered `total`, `next`, separately resolved selected people and responsible trainer names. Name search is case-insensitive. `selected` contains at most 100 UUIDs. Trainer scope is current responsibility; `self=true` also resolves the trainer's own channel participation.
- `GET /v1/institution/recipients`: bounded selected/available recipients with current assignment IDs/revisions/title. Commands still validate each recipient at commit time. The institution route accepts `limit` (1–100; the web assignment page asks for the top 5 matches). With `view=admin&email=true`, `search` also matches account email and items include `email`. Coaches search names only and never receive member email. Each item's `plans` include `version_id`, `program_id` and `version_revision` so clients can mark athletes already on a program.
- Workspace `summary=true` avoids downloading the roster; `invitationOffset` and `eventOffset` page 25 invitations/30 events. Modern web uses summary + people APIs.
- Institution delivery `history=true` returns 10 sessions and a verified continuation cursor; member names and current assignment are limited to the viewed history/person. Analytics `workloadOffset`/`programOffset` page 25 breakdown rows without changing full-scope totals.
- Calendar detail `summary=true` avoids the initial correction log; `historyMember` plus `historyOffset` returns 25 revisions and `historyNext` for an authorized event participant. A trainee cannot select another trainee's history.

Old open-client read shapes remain supported. Offset pages can shift during concurrent edits; exact writes use current revision checks and never trust displayed selection alone.

## Native Android authentication (Stage 7)

These routes require `X-Rafik-Client: android`. Passwords are sent only over HTTPS in deployed environments. Login responses and protected API responses are `no-store`. The opaque access and refresh tokens are random 256-bit hex values; the database stores only SHA-256 hashes.

| Route                     | Method | Request                                             | Result                                                                         |
| ------------------------- | ------ | --------------------------------------------------- | ------------------------------------------------------------------------------ |
| `/v1/mobile/auth/login`   | POST   | `{ email, password, device_name? }`                 | `{ user, access_token, access_expires_at, refresh_token, refresh_expires_at }` |
| `/v1/mobile/auth/session` | GET    | `Authorization: Bearer <access_token>`              | `{ user }`                                                                     |
| `/v1/mobile/auth/refresh` | POST   | `{ refresh_token }`                                 | Rotated token pair and `{ user }`                                              |
| `/v1/mobile/auth/logout`  | POST   | `{ refresh_token? }`, current access token optional | `{ user: null }`; revokes the presented current device session                 |

Access tokens last 15 minutes. Refresh tokens rotate at use, expire after 30 days of inactivity, and have a 90-day absolute session lifetime. Reuse of the immediately previous refresh token revokes that device session. Refresh must be single-flight on the client. Password login is rate limited by IP and normalized account email. Password reset revokes all mobile sessions for that account. Account suspension invalidates bearer access on subsequent requests. There is no endpoint yet to list/revoke another device; logging out revokes the current device.

The native client sends the Android marker on reads as well as writes, because bearer-token identification is bound to this client boundary. It does not use browser cookies. Existing browser origin checks, cookie sessions and the `web` marker are unchanged. Native HTTP requests should not send a browser `Origin` header; if one is supplied, the normal server origin allowlist still applies.

## Native Android coach contract (Stage 7)

The coach field API reuses the institution calendar routes described above for bounded schedule reads, event detail, attendance, assessor-led results and event completion. See the [Stage 7 scope](../requirements/stage7-mobile-scope.md) for request identity, sequencing, offline queue and conflict behavior.

The native API does not weaken browser origin checks, accept a shared app secret, or skip current organization authorization. The supported OpenAPI subset is maintained and exported as described above. The Android attendance client persists only the minimal event/person projection and exact commands from `packages/shared/src/contracts.ts`; API availability does not imply every calendar action has a native screen. See the [Android guide](../development/android.md).

## Public reference catalogs (R14)

These endpoints are unauthenticated and contain no user or workspace data:

- `GET /v1/catalog/foods`: versioned object with `foods`; each includes stable ID, English/Arabic display names, original FDC metadata, source string, `basis: 100`, `unit: "g"`, `nutrients` (`kcal`, `protein_g`, `carb_g`, `fat_g`) and sourced portions (`name`, optional `name_ar`, `grams`). Values scale by actual quantity / basis. A missing nutrient is unknown, not zero.
- `GET /v1/catalog/exercise-media`: schema/version, source metadata and `items`; each immutable key has compatible starter mapping, frame paths, SHA256/dimensions and source/license attribution. Do not infer exercise matches from similar names.
- `GET /v1/catalog/exercise-media/:key/:frame.svg`: only manifest-listed keys and frames 1–3. Returns digest-verified SVG, immutable cache headers, ETag, no-sniff and restrictive CSP. Invalid keys/frames return the normal unavailable error.

`save_nutrition_guidance` accepts optional `p_meals` (default `[]`), up to 20 suggestions / 32 KiB. Each contains name, meal, positive quantity/basis (max 10000), unit, nutrient object and source. Existing participant/revision checks and immutable receipts apply to all fields; a changed payload with the same receipt is rejected. A suggestion is not consumption; trainee `save_meal` explicitly snapshots actual values.

Institution exercise authoring accepts `media_ref` from the reviewed catalog or null. Existing `media_url` remains optional HTTPS. Publication and copied prescriptions preserve the chosen key. Public catalog access does not grant access to private exercises, client records or organizational data.

### Expanded reference catalog and video assets (R15)

- `GET /v1/catalog/exercises`: pinned MIT metadata/text export and provenance; no restricted source GIF/image URLs.
- `GET /v1/catalog/wger-exercises`: dated wger metadata, instruction license/author and translated/editorial provenance.
- `GET /v1/catalog/exercise-videos`: 45 immutable motion references, source IDs, MIME types, byte sizes, hashes and credits. Exact IDs join the shared `wger-*` records; they do not claim equivalence to similarly named exercises.
- `GET|HEAD /v1/catalog/exercise-videos/:key.mp4` or `:key.webp`: allowlisted public asset. Supports a single `Range: bytes=...` request (206 with Content-Range); malformed/unsatisfiable ranges return 416. Unknown asset/type is 404; integrity mismatch is 503. Cache is public/immutable; video variants are H.264 MP4 with no audio. Full downloads remain available under the asset license.

Shared exercise records additionally contain nullable `category`, `body_part`, `target_muscle` and immutable `source_ref`. Custom authoring may set the facets; clients cannot forge the source reference. Existing prescription snapshots and media keys remain valid.

## Institution nutrition (R16)

`GET /v1/institution/nutrition?view=admin|trainer|trainee&member=:membership&date=YYYY-MM-DD` returns authorized subject metadata, current plan for the date, latest revision, ten plan versions/next offset and authors. Trainee view resolves its own membership and rejects a different supplied member; staff use an explicit authorized membership. Omitting staff member returns `{member:null}`. Date defaults to the subject's local date.

The response includes `{sharing:{enabled,revision},canReadDiary,meals,removed,removedNext,corrections,correctionsNext}`. Actuals are returned to their subject or currently authorized staff while sharing is enabled. `removed=true&removedOffset=N` reads ten removed rows for the date; `meal=:id&historyOffset=N` reads ten revisions of an owned diary entry. `offset=N` pages plan versions. Unknown nutrients stay null/absent, not zero. Live daily meals are capped at200.

`POST` accepts an exact command with `operation` UUID, `view`, `member` and one action:

- `publish`: staff only, `id` UUID, `revision` matching latest plan, `effective_on` from subject today through366 days ahead, optional `expires_on` from start through366 days after start, `targets`, `guidance` (max4000), `meals` (max20/32KiB). Reuses nutrient and suggestion validation. Empty plans are rejected. Earlier versions cannot be edited.
- `sharing`: trainee only, expected `revision` (initial0), boolean `enabled`. Defaults off. Disabling hides all actuals/history from subsequent staff reads.
- `meal`: trainee only, `id`, expected `revision` (initial0), `logged_on` within the past366 days through subject today, `food` snapshot (`name,meal,quantity,basis,unit,nutrients,source`) and `note` (max2000). Positive bounded quantities/bases and known nutrient keys; units `g|ml|serving`.
- `remove`: trainee only, `id`, expected `revision`; creates a tombstone and history version, excludes it from current totals. Retrying the same operation returns its receipt; changing its payload is rejected.

Current membership/role/responsibility checks precede receipt lookup, so revoked staff cannot replay. `GET /v1/account/institution` additionally includes the subject's `nutritionPlans`, `nutritionSharing` and `nutritionMeals` with `institution_meal_history`. Generic browser table queries do not expose these tables. These contracts are available to a later native client; no native/offline diary implementation is claimed.

## Institution assets

`PUT /v1/assets/:id?institution=:uuid&view=admin|trainer|trainee&purpose=exercise|message&filename=:name[&channel=:uuid]` uploads raw bytes with an allowed Content-Type, maximum 25 MB. Message purpose requires current channel participation; exercise purpose requires a staff role. The ID, owner, digest, MIME, purpose, name and channel are immutable. An identical retry succeeds; conflicting reuse returns 409.

`GET /v1/assets/:id` rechecks membership and exact purpose/reference permissions. MP4 accepts a single byte range. `GET /v1/institution/assets?view=admin|trainer&search=&offset=0&archived=false` returns 24 authorized exercise assets plus `next`; message files are excluded. `POST` to the same collection accepts the standard operation ID, `action: archive`, asset `id`, `revision`, `view` and boolean `retired`. Archive affects new selections, not existing published reads.

Institution message commands accept optional `asset_id`; the file must belong to the sender and that channel. `private_pair` on the channel makes participant changes and nonparticipant admin access unavailable.

## Coaching follow-up

`GET /v1/institution/follow-up?view=admin|trainer` returns scoped review/outcome counts and unassigned-program athletes. It is read-only; Tasks is removed.

## Retired organization session packages

Session-package and allowance endpoints are retired. `GET` and `POST /v1/institution/packages` are not registered. Calendar scheduling has no funding, reservation, allowance, or no-show deduction fields; attendance and optional event-linked makeup scheduling remain. `session-note` accepts member/revision/note (2000 characters). Historical check-in timestamp records the first present mark, not a biometric arrival or revised attendance proof.

## Institution feedback

`GET /v1/institution/feedback?view=trainee` returns eligible completed own workouts/training appointments with optional score/revision, 24/page using `offset`. Trainer view returns the server’s current UTC `month`, `own` current-month response, and 24/page prior own monthly ratings. Admins use aggregate Analytics; no arbitrary member parameter grants response access.

POST body: `{operation,view,source,score,revision,id? ,month?}`. Session sources are `workout` (own completed log) and `calendar` (own present participant, completed training event); use source `id`. `workplace` requires trainer view and the server’s current UTC month. Scores are explicit integers 1–5; missing responses are null, never 3. Revision is 0 for a new logical response, otherwise the acknowledged version. Current authorization/source eligibility precedes receipt replay; correction cannot create another response. Feedback appears in own account export.

Analytics returns `experience`: source-specific rating buckets including null coverage and a separately scoped current UTC-month workplace distribution (admin only). `performance` lists current trainers’ completed training events/present/missed participant counts, paged with workload; co-led sessions credit each event staff member. These are corrected operational records, not frozen historical snapshots or quality/payment/retention estimates.

## Member profiles and invitation sports

`GET /v1/institution/people/:member?view=admin|trainer|trainee` resolves the member through existing roster authorization. Administrators can read institution member identities and account email; coaches can read their linked athletes and self, athletes only self. Staff analytics are returned only to administrators viewing coaches. They distinguish current counts from completed activity in the returned `from`/`to` 30-day window; no rating is inferred. Wrong-institution and unlinked requests are refused.

Administrator `invite` commands optionally accept `sports: string[]` (up to 100 distinct institution sport IDs). Athletes accept sport-kind IDs; coaches accept sports or specialties; administrators accept none. Acceptance applies descriptive member links atomically, on both existing-account and signup paths. Already accepted invitations do not reapply labels. Administrator `member` commands optionally accept a nonblank institution display `name` (maximum 120 characters), with the existing revision/last-admin/access checks. Account identity/email is unchanged. These web endpoints are outside the coach-field OpenAPI subset.

### Directory page sizes

People and service-catalog requests accept `limit=10` for main directories; existing picker requests retain 25. Nutrition and scheduled-event lists return 10 rows. Session `delivery?history=true` returns 10 records plus a scoped `total`; `offset` supports previous/next directory navigation, while `before` remains the compatibility cursor. Program/athlete-plan grids retain 24. API authorization and total-count filters use the same institution/coach scope as the records.

## Optional list sizing

The web directory reads for People, services, programs, athlete plans, nutrition plans, session history and scheduled events accept `limit` as an integer from 1 to 100. Invalid or absent values retain their endpoint’s existing default; filtering and institution/role scope are unchanged. This is web API scope, not a new addition to the coach field OpenAPI subset.

Session-history delivery reads accept optional case-insensitive athlete-name search via search, applied inside the existing authorized membership scope and to the matching total. Member-ID compatibility reads remain supported by the API; the main history UI uses name search.

## Complete backend inventory

See the [backend audit](backend/README.md), [schema catalog](backend/schema.md) and [route catalog](backend/routes.md) for every maintained table, field and registered route. Historical data retention is distinct from supported authoring. Generic commands do not expose new personal plans, teams, appointments or resource registration; owned historical resource finalization and cleanup remain available.

## Published-client aliases

Canonical scope is `/v1/institution`, with `/v1/institution/context` for discovery. Old `/v1/workspaces/:id/...` and `/v1/contexts` accept published-client requests through an explicit adapter, preserve supplied-ID checks, and return old envelope names. Old organization-prefixed record paths alias assets, workouts and invitations; `/v1/account/organizations` aliases own institution export. No SQL table/view aliases remain. Opaque documents and command payloads are not recursively renamed. New web/Android source requires the canonical API; update the backend before the APK. See [ADR 0029](../decisions/ADR-0029-institution-identifiers.md).

## Explicit account and Support endpoints

All require the signed-in account and normal origin/client-header rules. There is no generic SQL/table transport.

| Endpoint                    | Behavior                                                                                                                                                                                                               |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /v1/account/profile`  | Initialize own profile with optional `p_name`, `p_locale`, `p_timezone`; existing profile values are preserved.                                                                                                        |
| `PUT /v1/account/profile`   | Update own `p_name`, `p_locale`, `p_units`, `p_timezone` with existing validation.                                                                                                                                     |
| `GET /v1/account/export`    | Own profile, support reports and subject-scoped institution export; no removed personal/team/business arrays. Browser download also includes that owner's local drafts.                                                |
| `GET /v1/account/deletion`  | Last-admin preflight.                                                                                                                                                                                                  |
| `POST /v1/account/deletion` | `{confirmation:"DELETE"}`; rechecks under institution locks and preserves institution-owned history.                                                                                                                   |
| `GET /v1/support?offset=0`  | Own support reports, 100 per page, ordered by update time and ID.                                                                                                                                                      |
| `POST /v1/support`          | `{action:"create_support_case",args:{p_id,p_subject,p_detail}}` or `{action:"update_support_case",args:{p_id,p_revision,p_state}}`. Keep the same ID/payload on uncertain retry. Reporter cannot set operator replies. |

The old `/v1/account/institution` remains a current subject-only institutional projection, not a legacy alias. See ADR 0030 for the destructive migration and complete client upgrade policy.

## Workout preview and coach completion — unreleased beta.3

Agenda items include optional `preview`: planned minutes (unknown remains null), total exercises/prescribed sets, up to five exercise names/sets/types, up to four declared muscle groups and an optional authorized cover ID. Groups are ranked by exercise-metadata frequency, not physiological load. The same immutable assigned snapshot supplies the preview. Current workout reads and agenda session summaries expose `can_record` for authorized coach continuation. This is a snapshot flag; writes recheck current authority and lifecycle.

Completed self-logged actuals remain protected from new coach edits. Completion origin is preserved in `recorded_mode`; `completed_by`, `completed_by_name` and `completed_by_role` separately identify the first finisher. Optional review feedback may be empty and is bounded to 2,000 characters; review never rejects a valid result merely for zero external load. See [ADR 0031](../decisions/ADR-0031-coach-completion-of-athlete-started-workouts.md).

### Dashboard workout priorities

For the unreleased beta.3 scheduling projection, `due=true` includes assignments awaiting scheduling as well as today/overdue pending occurrences and unfinished records. Future scheduled occurrences remain in assignment detail rather than the dashboard action list. Existing role/sport authority, bounded pagination and general participation restrictions still apply.
