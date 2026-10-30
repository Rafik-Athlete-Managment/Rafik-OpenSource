# Rafik web change history

## Unreleased

- Share the exercise-authoring card between Workout templates and Programs, with searchable/removable same-type alternatives, grouping/ordering, per-set targets and coaching notes. Show available media in a credited dialog; compact desktop thumbnails align with exercise identity in editors and shared template/program previews. Phones retain the preview action.

- Align the new workout-template editor, preview, picker and group-results screens with existing type/spacing tokens. Use People’s tabs-then-search layout, keep Programs-style full-width Add exercise, place its first-use action inside the empty card, and separate save actions in the existing editor footer. Improve phone form layout and exercise-picker label spacing.

- Replace the workout template archive checkbox with the shared Active/Archived tabs, reset pagination on status changes and hide stale rows while the other collection loads.

- Backport fixes for Expo tooling prototype poisoning and bounded-collection allocation, with explicit plugin/output budgets. Install-time version/hash guards and focused regressions preserve the existing SDK; upstream version-based audit alerts remain visible.

- Update transitive node-forge to 1.4.2 and fast-uri to 3.1.9 for published security fixes. Keep the existing Expo SDK and platform lock metadata; document remaining upstream Zod/deepmerge tooling advisories separately from clean web/API production audits.

- Unreleased beta.3: Workout templates library with dedicated authoring/preview and independent imports into programs or athlete plans. Group events freeze a template/roster; designated coaches adapt and record separate participant results, with explicit skips, attributed history and athlete-own read-only review. Attendance and individual plan progression stay separate. Native offline workout capture and workout sections remain later scope.

- Coach analytics: the Experience tab keeps the summary cards and shows its ratings as chart cards like Training activity and Delivery & capacity, instead of replacing the page layout. Each card leads with its average and response count; the "not an overall coach score" note moves to How to read these numbers.

- Rename the consent-gated participation-status feature to "Athlete health" everywhere in the web app: navigation, page title, the coach overview panel and its link, the athlete profile tab, Help, activity-log entries and coach-scope descriptions. Routes, APIs and stored data are unchanged.

- Link the canonical full-role instance walkthrough directly from setup and deployment guidance so developers and institution owners can validate their installation.

- Web timestamps now follow the account timezone across workout/event summaries, history, activity, messages and notifications. Add a timezone-labelled digital clock linking to account settings in the desktop header and phone menu. Keep date-only values and explicit booking/recurrence zones unchanged. Tighten the vertical utility footer spacing.

- Fix timezone options opening behind scheduling side panels. The shared picker now uses the overlay-popup layer above modal backdrops and panels.

- Schedule an event now separates plan workouts, custom attendance events and assessments. Plan workouts reuse the authorized planning queue and exact scheduling command, without a second event name or duplicate workout. Existing custom drafts and makeup links remain recoverable.

- Restore single-open collapsible sidebar sections, automatically opening the active route's section. Keep desktop utility commands outside the navigation scroller in a vertical column; retain scrolling for short windows and reduced-motion support.

- CI fixes (also red on the base branch): the retired-domain migration check now compares only columns that existed before retirement, so later additive columns with defaults (for example `timing_mode`, `adaptation`) no longer fail it. Overview pages show the institution name above the heading, and the empty-database onboarding spec reopens Invite people for its second invitation, as the form closes after success.
- Coach overview: Today's work, Needs scheduling and Follow-up are cards with bordered row lists, refresh buttons at the heading's end, a clear empty-queue state and time-led event rows (shared with the athlete and admin dashboards). Exercises filters fit two rows (search and sort, then five filters with the count). Plan scheduling is a card with a status line, method cards, aligned date fields and weekday chips; Program preview sessions are collapsible cards with numbered exercises. Opening a chat or contact focuses the message box (not on touch devices). Training groups are compact single rows with member summary, a message icon and Edit.
- Administrator and athlete UX revamp. Admin Overview: period control and Open full analytics beside the heading, stat cards, and one Administration shortcut panel. People & access: name opens the profile, with Message and a labelled Manage button (duplicate profile icon removed). Activity: plain-language entries for every recorded change, grouped by day, with time, affected member and who acted (names resolved by the server). Institution settings: choose sport or specialty before naming it. Injury-status consent setup: per-athlete age group and guardian attestation on each row, status tags and a Needs setup filter. Unique sidebar icons, with Programs under Library for admins. Athletes: icon-only Refresh workouts, readable exercise names for older snapshots, athlete-appropriate Programs copy without staff tags, Rated/Not rated yet on feedback, and compact Notifications with unread dots and Mark all read.
- Theme revamp: cards, dialogs and menus now sit on brighter layers than the page with quiet borders and small tokenized shadows, in the style of shadcn-vue. Text fields get their own field fill, a clearer control border and an accent focus ring. Selected tiles and chips use the accent tint, and Overview counts that need action are raised while empty ones stay flat. Layers derive from institution branding, so custom palettes keep the hierarchy in light and dark.
- Messages follows the common chat-app pattern: a Chats tab for existing conversations and a Contacts tab for groups and people. Search filters the current tab as you type (no Enter needed) while the server search refines in the background. Opening a contact reopens its existing private chat and returns to Chats. The composer puts attach, privacy note and Send on one row, and the message history now fills tall windows instead of leaving empty space below the composer.
- Coach UX revamp, phase 5: Messages, Nutrition plans and the Analytics athlete finder search as you type; the empty conversation pane offers Start a conversation and `?tab=` opens a directory tab. Coach Injury status lists shared statuses as rows with profile links, status tags, formatted dates and the unknown-is-not-cleared rule. Nutrition plans open athlete choice from `?create=1`.

- Coach UX revamp, phase 4: read-only program pages use the program name as the title, put Make an editable copy and Assign in the action bar and show compact reference positions. Exercises fixes the clipped sort control and overflowing pagination. Resources moves upload into a dialog from the header (an empty library keeps the inline dropzone) and takes filters out of the boxed panel. Groups and assessment templates search as you type and explain their empty states, including that coaches see groups they created or belong to.

- Coach UX revamp, phase 3: the Schedule calendar keeps its original controls and layout; calendar chips show start time and an event-type colour; the event list searches as you type. Event creation starts with Training/Assessment choice cards and shows a live summary; template search is live. Event detail puts status and Reschedule/Complete in the header, moves Reassign and Cancel (with confirmation) into a menu, opens rescheduling and staffing in side panels, and records attendance with per-athlete choices, Mark everyone present and one Save that sends each changed athlete's exact command.

- Coach UX revamp, phase 2: Athlete plans are compact rows with each plan's next-workout state (a read-only `next_workout` summary computed by the same rule as the workout agenda) and a Schedule shortcut that opens the plan's scheduling panel. The assigned plan separates navigation links from actions, moves End plan into a menu behind a confirmation dialog, and adds a plan summary. People links names to profiles, hides the single-role tab for coaches and adds Assign/Schedule/Nutrition actions. Athlete profiles open on a summary of plans, recent workouts, assessments, nutrition and participation, with Assign a program starting an athlete-first flow through Programs into the existing assignment wizard.

- Coach UX revamp, phases 0–1: flat always-visible navigation sections (My feedback moves to the sidebar footer links); shared overflow menu, side panel, record-row, attention-strip and filter-chip patterns; search-as-you-type with Enter to submit. Coach Overview leads with separate clickable counts, compact workout rows with one primary action and a menu, scheduling/skip in a side panel, a New menu, and one tabbed follow-up panel that shows only non-empty queues. Workout history gains server-side status filters (awaiting review, in progress, reviewed). Recording gets a sticky progress/save bar and history panel; Review shows status, keeps feedback in view and offers Next to review. No permission, command or schema change.

- Record the coach dashboard UX audit and phased revamp plan, founder decisions on search and Schedule views, and deferred terminology as a known issue. Documentation only; no behavior changes.

- Keep supporting/primary coach selections in one checked list; add messaging directory tabs and per-row institution discovery; fix athlete-plan adaptation to update its existing assignment rather than publishing a library copy, preserving scheduled snapshots, cursor, policy, audit and exact recovery.

- Separate light-theme cards from the page using a seven-percent ink tint and derive supporting text from the institution ink/canvas pair. Dark-theme surface tokens are unchanged.

- Simplify assessment-event template selection to one visible server search and a selectable list with test counts, retain the selected template through no-match searches, and add bilingual event-name examples.

- Add versioned program defaults for automatic daily preparation, editable during creation and editing, with explicit per-assignment opt-out, bounded dates/timezone and atomic policy creation. Existing plan policies remain unchanged by program edits.

- Add opt-in per-plan weekly scheduling and automatic day-only workout preparation, exact policy save/stop, current-authority checks, DST diagnostics, bounded worker retries and no duplicate unresolved work. Extend web plan/calendar/list/detail reads for explicit day-only events while default attendance calendar reads remain timed-only. No group progression or Android workout capture is enabled.

- Refined role dashboards: athlete My day prioritizes workouts, events, food diary and coach messaging; administrator Institution overview leads with existing period-scoped workout/attendance reports before coverage and administrative actions. No new metric, permission or clinical projection.

- Consolidate due and unfinished workouts into one Workouts to record list, separate from Needs scheduling. Refresh sibling queues after acknowledged changes without remounting active recorders, preserve prior pending-command scopes, and reject unconfirmed queue responses from outdated backends.

- Lead every shared workout card with the workout/day name and show the program title beneath it, so different workouts from one program are distinguishable.

- Introduce the approved Coaching desk: unfinished recordings, due workouts and today’s events lead; a limited athlete-status column retains unknown/consent boundaries. Awaiting-schedule work and compact primary-roster follow-up are separate. Add scoped, disjoint server queues before pagination and preserve recovery of the prior dashboard’s pending commands.

- Redirect acknowledged coach workout completion to its review with delayed-navigation guards; separate review continuation controls from exercise content. Record a balanced coach-dashboard redesign proposal for founder review, without enabling speculative readiness metrics.

- Consolidate dashboard workout discovery and follow-up under coaching priorities, including work awaiting scheduling. Add greeting/header actions, shared semantic status colors, clear staff workout cards and aligned scheduling fields. Use athlete-style explicit set checks in coach recording and remove duplicate success cards while retaining recovery and generated invitation/reset links.

- Consolidate manual role walkthroughs into one version-scoped instance validation guide; contributor handoffs and landing refer to it rather than duplicating steps.

- Let authorized coaches finish unfinished athlete-started workouts with preserved origin, completion attribution and exact retry. Allow empty optional review feedback, including reviews of valid zero-load/bodyweight results. Add exercise, duration, prescribed-set and declared muscle-focus previews to athlete workout cards.

- Move assigned-plan review to dedicated pages with icon actions and an embedded adaptation editor based on the assigned version. Replace the athlete workout list with preview cards and a single heading/action toolbar. Standardize cancellation, removal and deletion controls in accessible red styling.

- Connect individual workout progression to the web dashboard and athlete plans: discover due/overdue work, schedule/reschedule or skip with a reason, and start or resume the occurrence-bound workout. Athletes see the scheduled-time explanation instead of an arbitrary day chooser. Weekly recurrence, worker scheduling and group/native workout capture remain pending.

- Restrict athlete program browsing to assigned immutable versions; block staff-only web routes before rendering.
- Restore assigned coach group visibility and athlete-to-coach conversation initiation; show unstarted group conversations alongside new contacts without duplicating existing group channels.
- Save primary/supporting coach selection without a second save button, collapse successful invitations, label exercise video availability, and expose participation-status navigation to staff.
- Stabilize message typing, support Enter to send and Shift+Enter for newlines, reset exercise rest timers on exercise changes, and warn before leaving unfinished workouts.
- Move food recording into an accessible dialog, start new entries with the food library, group diary entries by meal, and use two columns for group participant selection where space allows.

- Standardize founder-validation handoffs with scoped role-based walkthroughs, expected results and failure-report guidance.

### Breaking retirement

- Remove 37 retired personal/team/business/file-store tables and exclusive SQL functions through a forward migration; preserve current institution data, histories and receipts.
- Remove generic commands/queries/files, published-client aliases and old browser redirects. Replace current profile, support and account lifecycle dependencies with explicit endpoints.
- Require coordinated backend/web/Android upgrade for beta.3; published beta.2 clients are unsupported. Keep the signing key and encrypted institutional queue identities.

- Fix disposable backend SQL rehearsals to translate historical role/coaching migration identifiers into the current institution schema without changing deployed migrations.

### Institution naming migration

- Rename physical institution tables/columns and SQL/ORM metadata with a forward preservation migration.
- Add disposable preservation/API CI guards and keep generated fixture sources aligned.
- Adopt canonical instance-resolved institution APIs across web and Android; isolate published-client aliases. Preserve owner keys, pending commands, documents, receipts and private-file paths.

### Backend audit and cleanup

- Catalogue 94 tables, 761 columns and 65 routes with reviewed purposes and drift checks.
- Remove four unused standalone reads; explicitly allowlist 11 compatibility commands and 33 query projections.
- Retire billing simulation through a forward migration while preserving historical records. Add missing own workout-history/sequence exports, correct Prisma metadata and rename ten internal modules by domain.

### Individual workout progression API

- Add staff-authorized fixed-time individual scheduling, rescheduling and reasoned skips with exact command receipts. Scheduling binds a cycle position without advancing it; completion/skip advances once per assignment.
- Connect bound workout start/save to participant occurrences, prevent early starts and arbitrary-day bypass, and preserve corrections without rewinding progress.
- Ending/replacing assignments cancels unstarted bound work, pauses started work and cancels recurrence rules without deleting results. Generic calendar actions cannot bypass workout resolution.
- Document the unreleased commands in OpenAPI. Web controls, recurring/day-only scheduling, group workouts and Android queue upgrades remain pending.

### Beta.3 workout storage foundation

- Add assignment sequence cursors, bounded weekly recurrence storage and unique per-assignment positions with attributed resolution fields.
- Add scoped occurrence/participant links, timed event local dates and historical workout source snapshots without changing existing documents, IDs or receipts.
- Preserve required assignment/timestamp contracts. Day-only events, additional group workout writes, worker progression and new web/Android recording remain subsequent slices.

### Brand alignment

- Adopt campaign round7 identity into the existing product design system, keeping operational controls, accessibility and institution theming.
- Record source provenance, web alignment and native palette/type/logo follow-up for beta.3; no runtime redesign or APK change in this audit.

### Beta.3 planning

- Confirm correction/history and ended-assignment lifecycle policies; inventory the ten currently required generic command operations and historical export dependencies before API retirement.

- Confirm repeating the published workout cycle while its assignment remains active; no automatic prescription progression.

- Add a concrete technical review of event/participant storage, cycle/correction policies, explicit API allowlists and native queue migration; recommendations remain pending approval.

- Record accepted individual session progression, bounded weekly scheduling and group additional-training rules.
- Include offline individual/group workout recording in Android scope; propose cache/queue migration, coordinated API retirement and historical-data reconciliation before implementation.

### Frontend source audit

- Document all local Vue components, routed/embedded views, access boundaries and incoming/outgoing navigation with Mermaid maps and a repeatable inventory check.
- Remove duplicated hidden per-page navigation, broken history/clients links and guest recorder/adoption UI; require institutional sign-in and owner scope for recording.
- Highlight profile and delegated recording navigation consistently; suppress notifications into retired independent screens without deleting historical source data.
- Retire the obsolete guest/standalone browser spec; keep focused institutional recorder coverage and document remaining acceptance limits.

### Institution cleanup

- Consolidate supported screens under plain feature names; remove 20 obsolete/duplicate Vue implementations and restore Resources/Nutrition routing.
- Move shared commands out of retired feature folders; remove independent review/analytics/program API fallbacks.
- Add a frontend view-graph guard against orphaned Vue files and missing supported routes.

- Remove retired-feature routes outright; use the normal missing-page state, with no Tasks retirement page or workspace-chooser redirect.
- Rename frontend institution/navigation folders, all institution-specific UI components/types, and associated styles; preserve database, asset and Android API compatibility identifiers.
- Fix local recovery and orphan cleanup to use the API’s validated database/file target, including isolated tests.

- Retire Tasks, its API and data through a guarded forward migration.
- Remove workspace selection and additional-institution creation; retain institution permissions and native API compatibility.
- Introduce flat role-derived browser routes, authorized legacy redirects and separate account/institution settings.

### Previously recorded changes

- Updated application repository, release, issue/PR and cloud-template links to Rafik-Athlete-Managment/Rafik-OpenSource following the GitHub organization transfer. Landing remains under KenseiEmam.

- Rebuilt and verified the signed beta.2 Android bundle with the existing update key and new launcher artwork; publication-ready English/Arabic landing release and installation guidance accompanies it.

- Beta.2 release preparation: patch Vite to 8.3.5 and Vitest to 5.0.5; preserve founder-provided Android launcher PNGs as maintained assets and apply them to regular/round launcher resources during native preparation.

- Final web design audit (Claude, 21 October), reviewed in rendered English/Arabic, light/dark, desktop/tablet/phone states in Chromium and WebKit:
  - Schedule calendar toolbar fits one row: View, Month and Show cancelled share the 44px control row; adjacent previous/next chevrons around a visible month label sit at the calendar column's inline end and stay paired on phones.
  - Out-of-month calendar days no longer turn grey through the global disabled opacity; the light chip/selection fill is lighter and keeps readable muted text.
  - Shared pagination reads "Per page", takes less width so search fields fill the toolbar, keeps range and previous/next together when wrapping, and is hidden when a list has no records.
  - Consistent list summaries above results; athlete-plan cards show the athlete name without uppercase tracking and sport tags no longer stretch across the card.
  - People rows combine role and primary coach on one line and no longer use a nested scroll container; profiles align with the workspace edges and use compact in-panel empty text.
  - Institution settings use one full-width section per row: General settings is a single name/save row; the super admin's branding form puts name and colours beside the logo upload; sports and specialties list side by side; closure stays last. No section leaves an empty companion column, whatever the viewer's role.
  - Schedule list shows weekday, date and time range for same-day events; its phone filters pair in two columns.
  - Editor save rows group the primary action with draft status; member pickers have aligned search buttons and a framed scroll list.
  - Program cards replace repeated library boilerplate with an "In library" tag; templates pluralize drills; group and template searches use "Search".
  - Remaining "trainee/trainer" interface copy now says athlete/coach in English and Arabic.
  - Program assignment scales to large rosters: nothing is listed until you search, search returns the top 5 matches (administrators can also search by email, which is shown to tell same-named athletes apart), and selected athletes sit in their own section with current plans, the keep/replace choice, Remove with Undo and a confirmed Remove all. Athletes already on this program version are greyed out and cannot be added. The page was redesigned as three numbered cards: plan settings at the top, then search (compact name cards that add on click, with a plus icon) beside the separate selected list, and a sticky Review bar. An athlete on an earlier version of the same program, even after a rename, is recognized and moved to the new version by default instead of being stacked; replacing a plan is chosen in a dialog instead of a per-athlete dropdown.
  - Every shared people picker (groups, events, tasks, nutrition, coaching team, channels, primary coach) fetches only the 5 closest matches and shows them as compact name cards with a plus/check, instead of a paged list with Load more; administrators can also search by email. Selected people stay listed as chips across searches.
  - Nutrition: Create a plan opens a dialog to choose the athlete instead of pushing a card above the list; the plan panel grows with its form instead of scrolling inside a fixed-height box; Edit meal plan on the Example tab now opens just the example-meal editor there (it previously opened the full target editor on the Plan tab).
  - The program editor has one action bar at the top: Athlete preview and Duplicate (now a bordered button with a copy icon instead of a bare text link) on the start side; Assign this program, Save draft and Publish program on the end side. It stays pinned below the header while scrolling on tablet and desktop; phones keep it at the top unpinned. The dashboard header is 64px at every width.
  - Event scheduling: choosing a training group adds its coaches instead of clearing the coach already selected; the "Create a template" link no longer pollutes the template select's accessible name.
  - Platform operator actions confirm what changed ("Access suspended.", "Access restored.", institution archive/restore, support reply) instead of showing nothing.
  - Repaired the remaining stale browser specs: `organization-tasks` (reload raced the editor close; action toasts), `communication` (toast), `operations` operator (toasts) and conversation journey (conversations now start from People), and `teams` now checks that retired team/business links land in the institution workspace instead of driving the removed screens.
  - `npm run content:check` passes again: the sample-data fixture no longer gives one member a combined coach/athlete role (the generated seed already had the single role).
  - `npm run format:check` passes again: the frontend's Prettier ignore list moved from the repository root to `apps/frontend/.prettierignore`, where its `src/content/...` paths apply, so generated content is no longer reported; four hand-written files were formatted.
  - Repaired browser specs that still targeted pre-#138 screens (inline People management, "Trainer" invitation radio, CommandStatus success text, labelled timezone popup, phone exercise list→detail, retired `/coach/analytics`). The CI onboarding spec passes again.

- Standardized directory search/pagination alignment and changed assessment templates to a responsive card grid.

- Session history replaces its expandable athlete filter with the shared inline athlete-name search.

- Web UI refinement: shared athlete search, responsive search/pagination toolbars, consistent icon-led empty states and reduced-motion-aware pulsing loading skeletons.
- Schedule now combines calendar and event-list navigation, opens booking cards on today, and pages booking cards four at a time.

- Continued the approved web design rollout: shared page headings across workspaces, unified tabs and empty-state treatment, full-width standalone editors, contextual subtitles, bilingual search hints, reusable upload dropzones and selectable URL-persisted record counts.
- Assessment templates, groups, tasks and exercises now use dedicated create/edit routes with record-scoped draft recovery and guarded save-to-list navigation. Active commands remain in progress across remounts; routine success uses toasts without duplicate status cards. Optional bounded list limits and scoped task-by-ID reads support the new controls.

## Squire 1.0.0-beta.2 — release preparation

Sports and coaching foundation, merged in PR #135. Publication date, tag and Android artifacts are pending; beta.1 remains the published release. Workspace versions are `1.0.0-beta.2`; Android versionCode is `1000002`. See [upgrade and publication guidance](docs/operations/README.md#beta2-upgrade-and-release-preparation).

- Added the approved web design system and categorized UI audit. Introduced shared spacing/type/motion tokens, section headers, localized password visibility controls and responsive sports management. Refined picker accessibility, heading hierarchy, permission-denial feedback and institution privacy copy. Android and remaining page migrations are follow-up work.

- Refined member management into aligned identity, coaching, sports and recovery cards with accessible role buttons and sport-aware coach choices. Institution settings now use the available width, with branding alongside general settings; closure requires a name-confirmation dialog.

- Standardized main-directory pagination with shared, accessible previous/next controls, page/range feedback and mobile/RTL layouts. People, nutrition, sessions, events and groups/templates show 10 rows; program/plan/exercise grids retain their existing sizes. People page/filter state survives reload and returning from a profile.

- Reworked People into athlete-first role tabs with membership/sport filters and labelled SVG actions. Coaches retain only their scoped athlete directory; administrators can open profiles and message active members of every role.
- Replaced profile jump links with real tab panels. Added administrator-visible staff profiles, current roster counts and 30-day coach activity counts; moved membership, display-name, password-link, sport and coaching management from the directory into the profile.
- Invitations can carry optional athlete sports or coach sports/specialties; administrator invitations cannot carry sports. Forward migration `202610210100_invitation_sports` preserves existing invitations and applies new labels atomically on acceptance.

- Release 1 review fixes:
  - Overlap warnings show other plans' title, goal and dates only, as a documented supporting-coach exception.
  - Coach-recorded timed and distance sets require actual seconds or metres, using the athlete logger's shared measurement rules.
  - A delayed start no longer pulls a coach back after they have left the recording screen.

- Release 1e:
  - Coaches can record a workout on an athlete's behalf under their own name. The athlete sees who recorded it and can correct it, and every start, save and correction is kept with its author.
  - Analytics counts coach-recorded sessions.
  - Forward migration `202610191500_delegated_sessions`.

- Release 1d: staff athlete profile pages. These bring together the overview, coaching team, active plans, recent sessions, assessments and, by role, nutrition and participation status, using existing authorized reads only. Linked from People and athlete plans.

- Release 1c:
  - Athletes can follow several active goal-specific plans. Each plan can carry a goal and sport, and assigning either adds a plan or explicitly replaces a named one.
  - Plans can be ended individually. Overlapping dates are reported to coaches, and athletes see a same-day notice.
  - Supporting coaches work only with plans and sessions labelled with their linked sport, and with assessments from events they staffed.
  - Forward migration `202610191400_concurrent_plans`.
  - Restored the coach "Adapt this program" link and repaired the programming browser spec.

- Release 1b:
  - Coaching teams: each athlete has one primary coach and optional supporting coaches, each scoped to a sport or specialty ([ADR 0025](docs/decisions/ADR-0025-coaching-team.md)).
  - Supporting coaches read training records and can include the athlete in their own events, groups and messages. Nutrition, participation status, plan changes, workout review, follow-up and analytics stay with the primary coach.
  - Forward migration `202610191300_coaching_links` backfills primary links from `trainer_id` and adds a trigger that keeps them consistent.
  - Administrators manage supporting coaches in People.
  - Repaired the stale organizations browser spec, and fixed the "1 people" count.

- Release 1a:
  - Administrators define institution sports and coaching specialties in Institution settings, and link athletes to sports and coaches to sports or specialties from People.
  - People shows sport chips and filters by sport or specialty within each role's existing scope. These labels grant no access.
  - Adds forward migration `202610191200_sports_and_specialties`.
  - Fixes light-theme muted contrast and word-splitting in phone People cards.
  - Records the confirmed Release 1 founder decisions.

- Aligned release summaries with accepted, published beta.1 status across Android, requirements, operations and public English/Arabic guides. Removed stale candidate/physical-acceptance gates; retained broader coverage and institution live-data checks as separate follow-up work.

- Linked the published beta.1 Android ZIP bundle and documented extraction/installation on phones. Verified its embedded APK checksum against the bundled checksum, metadata and existing package receipt; no rebuild.

- Made Android installation/build paths explicit: official APK for coaches, native development for contributors, private signing for independent distributions, and a fresh-checkout standalone procedure. Added the beta.1 asset-publication close-out while preserving the published source tag and accepted phone result.

- Recorded founder-reported success of the Galaxy S20+ physical phone walkthrough on 20 October 2026; kept exact device/build metadata, broader native/accessibility coverage and release-asset alignment separate.
- Aligned the paired English/Arabic landing phone guidance through PR #13 and verified the existing published beta.1 source release separately from the locally packaged APK. Preserved the next-release work in application PR #135 and landing PR #11.

- R0 beta.1 close-out:
  - Fixed the post-workout **Rate your session** link, which went to a missing `/institution/…` route.
  - Raised dark-theme muted text to 4.5:1 or better on soft surfaces.
  - Sent message attachments now show their file names, and PDFs download with their original name.
  - The events list says "Athletes: n" instead of "1 athletes".
  - Added focused Chromium and WebKit phone journeys for later-page plan, nutrition and event browsing, and for multi-file message retry and revocation. Replaced the stale single-file attachment test.
  - Recorded stale browser specs, the dormant assignment behavior and a local PostgreSQL image collation mismatch.

- Added a proposed post-beta.1 release plan in the founder's order: sports and coaching foundation, coach field dashboard, then sport-specific field tools, after a beta.1 close-out. It audits single-coach and single-plan call paths, proposes permissions and migrations, and lists open decisions. Recorded three code-inspection findings in known issues. Documentation only; no runtime change.

- Corrected remaining CI fixtures for configured self-host production and exact media access through published library snapshots; private unpublished media and unrelated tenant access remain denied.

- Aligned program-library regression checks with ADR 0020: athletes read immutable published versions but cannot write drafts. Independent CI domain suites now report failures after API readiness instead of hiding later results behind the first failed suite.

- Repaired GitHub CI: restored cross-platform native lock metadata, aligned invitation/onboarding checks, removed retired package/marketing commands and retained isolated failure diagnostics. Corrected unit setup and stale theme-token references.
- Applied a scoped Xcode UUID 11.1.1 security override. Online audit reduced 27 findings to 19 high findings from two unpatched Expo-tooling dependencies; invalidated the earlier offline zero-advisory claim.

- Recorded founder-confirmed signing-key backup to PC and cloud with 7-Zip; paired English/Arabic landing guides now cover current beta setup, evidence, limits and GitHub-hosted downloads.
- Archived the historical role audit and R-phase feature map, and shortened the delivery/verification guides while preserving dated snapshots, raw receipts and required security/content decisions. Updated incoming links and documented why each item moved.

- Audited whole-product beta documentation: distinguish supported self-hosted evaluation from per-institution live-data acceptance, align completed stage/API status, correct Compose/monorepo paths, and default quick starts to unseeded super-admin setup. Expanded the coach walkthrough beyond participation status.
- Documented GitHub Releases as the canonical download source, with landing links, explicit source/archive labels and asset/checksum provenance.
- Expanded documentation checks to infrastructure guides and local heading anchors, with regression fixtures. Recorded a fresh web production build; retained device, rendering and operational evidence gaps explicitly.

- Rebuilt and verified the signed beta evaluation APK with the fixes below, preserving the earlier qualification artifact. Final compiled source: `5d1ce76`; physical S20+ acceptance remains open.
- Fixed stale Android offline access feedback: fresh authenticated access checks recover in the background while keeping the roster/editor mounted. Network, sign-in and throttling errors now have readable English/Arabic messages; malformed institution URLs use the intended validation.
- Removed a second offline-start wait: cached rosters open locally, while schedule refresh has its own busy state. Newer roster data is downloaded explicitly.
- Prevented a coach from becoming stuck in a removed empty workspace after access changes, while keeping cached work selectable for review.
- Added focused transport/authenticated-response regression checks, recorded an offline dependency audit (later invalidated; see current verification), and documented encrypted signing-key backup plus physical S20+ testing through USB without a domain.
- Clarified the public beta audience, coach-only native scope, observed-performance versus clinical claims, and limits of offline revocation and background sync.

## Squire 1.0.0-beta.1 — 2026-10-19

Beta source candidate; signed-package build and focused emulator installation/upgrade acceptance passed. Broader device acceptance remains open. The founder authorized promotion of the cleaned university branch to main and an annotated beta tag.

- Verified standalone offline startup and preservation of pending attendance plus an unsubmitted score draft through a controlled Android versionCode update, followed by acknowledged replay and completion. Recorded a stale offline-error banner as a known issue; historical/schema upgrades and physical hardware remain unverified.

- Fixed Android release lint by explicitly disabling subdomain matching on local HTTP exceptions. Retained the HTTPS default and exact localhost/emulator exceptions. Initial packaging fixes remain beta.1 by founder direction; no APK has been distributed.
- Accepted both legacy and current SDK certificate-report formats while requiring the configured signer. Added verification-only export with explicit compiled-source provenance, package/version checks and no native rebuild.

- Added direct signed Android APK packaging with private local key generation, no debug-signing fallback, bundled JavaScript, signature verification/checksums and ARM64/x86_64 output. Configured Android API 24 minimum; device coverage remains limited.
- Shortened Windows app CMake staging further for longer release variant/autolinked target paths, retaining library caches and bounded compilation.
- Set product/workspace versions to `1.0.0-beta.1` and Android versionCode to `1000001`; documented signing-key backup, fresh installation, offline startup and upgrade preservation.

- Recorded focused Android emulator acceptance for offline score persistence across app restart, acknowledged replay, attendance/score history, event completion, recovery share cancellation and Arabic dark recovery. Removed isolated test resources; physical-device and broader acceptance remain open.

- Fixed `mobile:start` to target the installed native development build instead of attempting to install Expo Go, which cannot run Rafik's SQLCipher configuration.

- Documented a smaller-display, snapshot-free Android emulator startup for investigating System UI freezes; existing app data is retained and performance remains unverified.

- Documented the Windows standalone emulator launch command and separate Metro startup, without requiring Android Studio to stay open.

- Documented non-destructive Metro cache recovery when a stale layout bundle reports a missing language provider; native confirmation remains pending.

- Added `mobile:acceptance`, a Node 24 disposable PostgreSQL/API runner for native authentication and real-server queue/retry/history/conflict/revocation checks. Device mode exposes synthetic credentials only in an ignored local fixture and supports explicit cleanup. No existing preview data is reset.

- Added Android participant attendance/score correction history with bounded online reads, in-app server/device comparison, and explicit plain-text recovery sharing for saved operations and drafts. Pending commands retain their original IDs/payloads; exports do not resend or discard work.
- Added persisted English/Arabic selection, localized feedback/validation, Arabic numeric entry and RTL layouts. Corrected Android paragraph-start alignment after founder screenshot review; URL/email entry remains LTR.

- Fixed the Athlete plans 403 by reading profile timezone through the authenticated profile role. Added a paginated Events & assessments list for staff, with type/status/search filters and links to attendance, results and corrections.
- Android completed events now show a distinct confirmed, read-only summary. Future events explain when field entry unlocks; controls refresh on foreground return and every 30 seconds while active.

- Fixed Vue template parsing for optional athlete filters in Athlete plans and Nutrition plans.

- Replaced staff athlete-first training selection with paginated Athlete plans and a separate Session history showing authorized workouts immediately. Nutrition plans now opens a paginated published-plan overview with exact-version links and active, upcoming, expired and replaced filters; food diary permissions remain separate.
- Event creation preloads the profile/device timezone, aligns date/time controls and opens assessment-template creation in another tab with a scoped return handoff. Event overviews and calendar cards have a stronger visual hierarchy.

- Corrected the Windows CMake object-path limit: the original 180-character setting left insufficient room for autolinked targets and prevented hashing. The helper now allows 256 characters; generated path inspection is separate from native build acceptance.

- Consolidated Android builds behind `npm run mobile:android`: Windows Ninja preflight, shorter per-checkout CMake staging, object-path hashing and limited Gradle/native concurrency. Added `--prepare-only` and direct Expo argument forwarding. Recorded the observed Reanimated path failure; native rebuild acceptance remains open.

- Added up to 10 ordered attachments per institution message, including multi-select upload, individual previews/removal, scoped draft recovery and atomic server writes. Added an additive migration that preserves existing single-file messages, checks every attachment's permissions, and includes every attachment in private reads and account exports. Existing single-file commands remain supported.

- Message attachments now appear in a preview section above the composer, with remove controls and separate photo/paperclip upload buttons. Acknowledged sends reset the uploader and clear the queued draft; failed or uncertain sends retain the attachment for recovery.

- Added instance-local Swagger UI at `/v1/docs` (self-host `/api/v1/docs`) using the canonical coach OpenAPI subset and bundled assets. Local requests use native bearer authentication without cookies; production browsing disables interactive requests. Added focused HTTP/initializer checks and disabled dependency installation analytics. [Landing PR #2](https://github.com/KenseiEmam/rafik-landing/pull/2) updates bilingual documentation; existing installations need the updated backend.

- Added Android assessment drafts, server-defined metrics/units/limits, precise numeric/text score capture, current-result corrections and event completion. Result commands replay after attendance; finishing waits for confirmed attendance/results and resolved drafts. A confirmed finish atomically removes the local event package while retaining server history. Native/API and rendered-device acceptance remain open.

- Added the Stage 7 Android attendance slice: explicitly opened event rosters, scoped SQLCipher storage, ordered immutable commands, exact retries, acknowledgment revisions, and visible conflict/revocation states. Added instance-bound native credentials, foreground retry and explicit device-copy discard. Assessment entry, event completion and native-device validation remain open. Added focused Node SQLite queue checks and the Android development/recovery guide.
- Recorded that each new release updates bilingual landing release information and upgrade guidance through a docs PR.
- Recorded the cross-repository docs policy: update the bilingual landing docs for material user-facing/API changes, using the backend OpenAPI contract as the source of truth; skip routine internal refactors.
- Started the Stage 7 Android workspace with institution URL sign-in, native bearer session rotation, coach context discovery and a bounded upcoming schedule. The initial shell configured SQLCipher and secure token storage; the attendance cache/queue followed in the later slice above. Assessment/results capture and device validation remain open.
- Added a versioned OpenAPI 3.1 subset for native coach workflows and exported it from each backend at `/v1/openapi.json`. Updated API, development, architecture and stage docs. Bilingual landing API and phone-app copy is updated in [rafik-landing PR #1](https://github.com/KenseiEmam/rafik-landing/pull/1); it documents file import into a team Swagger viewer without claiming the landing site hosts one. The endpoint becomes available after the backend change is published and deployed.
- Began Stage 7 discovery with a proposed Android field-app scope, offline boundary, API/auth gaps and acceptance evidence.
- Founder confirmed the coach-first field workflow and clarified that optional Stage 6 provider validation does not block Stage 7. ADR 0023 selects React Native/Expo, SQLCipher-backed event/command storage, secure native credentials and foreground-driven sync.
- Started Stage 6 with separate AWS EC2, Google Compute Engine and Azure Linux VM Terraform templates, shared Ubuntu bootstrap, provider access guides, and a dedicated home for deployment/backup/restore scripts. Templates use the current Compose stack and are not provider-validated or production-ready.
- Updated the staged requirements, architecture, operations guide, maintainer map and verification record for Stage 6. Terraform state, plans and local tfvars are now ignored.
- Recorded the founder's decision to defer optional provider deployment and recovery checks to user testing; the templates remain explicitly unverified.
- Recorded founder verification that instance branding remains after restarting the local backend and frontend.
- Added a centered, accessible loading screen while the instance theme is fetched, preventing the app shell from appearing before branding is applied.
- Darkened light-theme main and muted text slightly; dark-theme text colors are unchanged.
- Darkened the derived card and soft surfaces in dark mode at the founder's request; light mode and the saved page backgrounds are unchanged.
- Added a small Unix Docker deployment helper that builds and starts the self-hosted Compose stack.
- Stage 5 implementation: added database-backed instance branding with name, accent, custom light/dark backgrounds, derived surfaces, accessible contrast adjustment and an optional PNG/JPEG/WebP logo. Changes are restricted to the first super admin, Rafik attribution remains visible, and the logo endpoint serves bounded, validated image bytes. Branding is included in database backups.
- Corrected stale Stage 4 status and verification notes: the accepted prototype implementation is complete, while first-user and pre-production gates remain in the backlog.
- Stage 5 fresh migration, backend/frontend typechecks and frontend production build passed. Focused branding acceptance passes in Chromium desktop and WebKit phone after adjusting dark-theme contrast against derived surfaces. The name stays on one line on phone and desktop.
- Local development now supports Node 24 (selected by `.nvmrc`) as well as Node 22.16; production container images remain on Node 22.16. Began Stage 5 by recording per-instance branding and local-only support defaults in ADR 0022.
- Kept coach sport-task review, university privacy/security approval, retention alert delivery and production update/rollback review in a first-user or pre-production backlog after founder acceptance of prototype scope. This does not authorize real athlete data before institution approval.
- Updated messaging browser acceptance to cover contact removal after opening and reuse from Conversations, and changed its notification preference assertion to the current action-specific success copy.
- Rechecked the corrected conversation and injury workflows in Chromium desktop and WebKit phone. Both journeys passed; isolated databases and outputs were removed. Stale expected success copy was updated in the communication acceptance.
- Stage 5 support now states that requests remain in the installation, names who can read each destination, and warns against including athlete health details or private files. No outbound delivery was added.
- Messages now hides a person from the People list after a direct conversation exists, while keeping that conversation available in Conversations. People and conversations share one search (including direct-conversation participant names) and scroll area, with one combined empty state. Opening a person shows no persistent “Saved” message, and toasts dismiss on schedule even when hovered.
- Removed generic “Saved” success toasts. Where a toast is useful, it names the completed action; message sending relies on the conversation UI, and its success toast is suppressed. Inline command success copy clears after five seconds.
- Replaced the separate conversation-start form with a People list in Messages. Administrators see active institution members and coaches see their assigned athletes; selecting a person opens or reuses their private conversation. Training groups continue to open their shared conversation, and trainees can read/reply to conversations started by staff. Fixed message composer scrolling and kept roster/message rows as direct access points. Direct conversations are unique per institution and participant pair, and groups have one linked conversation; the migration archives older duplicate direct conversations while retaining messages.
- New passwords require 8–128 characters with upper/lowercase, number and punctuation/symbol; login remains compatible with existing passwords. Published programs now expose a clear assignment action to any coach with currently assigned athletes, and the UI explains institution-library sharing. Institution administrators can add active coaches to training groups; coach and athlete memberships prefill the corresponding staff and participant lists when scheduling an event.
- Replaced synthetic example exercises in new program drafts with a clean one-session empty state. Added a program identity card with a keyboard-accessible cover drop area, description and recognition fields. Publishing now automatically makes institution programs available in the program library; removed the separate catalog visibility hold and migrated existing published programs.
- Updated the coaching interface to say athletes instead of clients, including roster navigation and program editing. Internal legacy API and database names remain unchanged.
- Completed athlete wording in organization training filters and team enrollment errors; made draft JSON validation reject wrong-shaped days before array operations.
- Made both empty states on the Programs page span the content column and align their copy and actions to its leading edge, while keeping explanatory text at a readable line length.
- Standardized empty-state styling across the app: full-width leading-aligned panel states, compact inline empty notes, and an explicit centered variant for the not-found page.
- Reworked the empty session-history state into a compact icon/message/action row, stacking cleanly on phones so the page does not feel like a mostly blank panel.
- Reworked the Training page's no-assignment state to explain that coach-assigned programs appear there, removed its fake sample-workout CTA, and linked paused relationships to training history.
- Increased dashboard page-title scale relative to card headings on desktop and phones to make the content hierarchy clearer.
- Reworked the organization trainer Training view's empty states: trainers choose an athlete before seeing their program/history; no-assignment and no-session states now explain the next step; history is no longer loaded for an unfiltered trainer view.
- Retired the standalone `/coach` route tree and local-preview coach accounts. Old links route into the closest organization staff page, or workspace setup; workspace creation now creates organizations only. Legacy standalone records/APIs remain stored and isolated, with no migration or deletion.
- Reworked the organization calendar into an inline control toolbar, a wide calendar with a booked-sessions panel beside it, and a stacked phone layout. Week view now shows selectable days and the booked-session list filters to the selected day.
- Added fixed-position SweetAlert2 success and error toasts for API feedback, styled for Rafik themes and Arabic direction. Success toasts require an explicit write signal, so refresh-time POST previews do not appear as saves. Program saves now scroll to the editor heading after the command is acknowledged.
- Made sidebar navigation groups mutually exclusive: opening a group closes any other open group.
- Replaced the institutional context switcher with one role per membership and a direct role-specific dashboard for administrators, trainers and athletes. The API rejects combined-role invitations and membership updates; a forward migration normalizes legacy combined role arrays using the documented priority. Replaced the old horizontal institution tabs with the collapsible sidebar, fixed its CSS selector so it is actually hidden, and kept authorized platform operations discoverable.
- Verified the first-run redirect and role-specific sidebar in an isolated database on Chromium desktop and WebKit phone. The onboarding journey covers admin, trainer and athlete invitations; twelve viewport/full-page screenshots were visually inspected and saved under `docs/verification/receipts/`. The checks wait for dashboard data surfaces to finish loading.
- Normalized the local sample account and nutrition browser fixture to one institutional role, matching the migrated membership constraint.
- Added a rollback-isolated regression to the fresh-database workflow for normalizing legacy combined membership/invitation roles and clearing trainer assignments when an old combined membership resolves to trainer-only. `npm run test:fresh` passed with all eight SQL suites; the shared preview database was not touched.
- Removed the leftover public team/how-it-works header links from the signed-out app shell, centered the setup and sign-in panels, and removed the extra background box from the logo mark.
- Verified the authentication shell in the isolated production build and onboarding browser flow: centered form, no signed-out marketing navigation, transparent logo background, Chromium desktop and WebKit phone.
- Fixed first-run setup detection: existing standalone local accounts no longer mark institution setup complete; the one-time gate closes only after an institution exists. The disposable onboarding scenario now covers a legacy account with no institution.
- Replaced the application’s marketing/email-code entry with a one-time first-run super-admin and institution setup, password sign-in, seven-day one-use institution invites, and admin-issued 24-hour password setup links. Email addresses are identifiers and are not verified; operators must keep fresh instances private until setup and share links privately. Updated auth, deployment, API, walkthrough and maintainer documentation and added ADR 0018. Added disposable empty-database browser acceptance for first-run setup and invitation joining.
- Fixed frontend type errors in the invitation and institution workflow components. Frontend/backend typechecks, documentation links, and the onboarding browser flow pass.
- Corrected the coach walkthrough to follow the implemented admin consent, athlete-authored status and limited coach-read workflow.
- Replaced the stale gym-first pilot plan with a concise local coach walkthrough for the current Stage 4 university workflow. Removed the broken revival-document link and clarified synthetic-data and release-review limits.
- Reshaped documentation to the requested structure: requirements, architecture, development, testing, operations, known issues, decisions, reference, verification and archive. Added development/operations/known-issues entry points, moved audits by purpose, archived gym-first reviews and long phase chronology, normalized active ADR filenames/indexing, and refreshed current status summaries and links. The root and docs indexes now point to maintained guides.
- Clarified the documentation maintenance rule in `AGENTS.md`: preserve the founder-approved docs structure, keep raw receipts separate, and do not invent a folder taxonomy when reorganizing guidance.
- Reorganized engineering documentation around one canonical current architecture at `docs/architecture/README.md`. Archived superseded phase contracts and architecture/maintainer snapshots, moved machine-generated receipts to `docs/verification/receipts/`, and replaced the active maintainer guide with current workflows. Updated the documentation index and root guidance.
- Corrected the root README's stale deployment claims and added a direct Unix self-host Compose quick start linking the detailed infrastructure guide/runbook. Local development and production-profile instructions now match the current implementation and open release gates.
- Injury retention now retries 15 minutes after a failed database cleanup instead of waiting up to a day; successful cleanup keeps the daily schedule. The scheduler regression and isolated Docker database/API outage-restart rehearsal passed; deployment alert wiring remains open.
- Recorded the Stage 4 exercise catalog/media inventory, rights boundaries and sport-specific taxonomy gap. Reconciled 45 shipped motion derivatives against 46 research candidates: one duplicate with unverifiable machine assistance was deliberately excluded. Coach task review, coverage decisions and university/legal review remain open.
- Removed gym-oriented session packages and prepaid allowances from the university product: package page/navigation/API, calendar funding and no-show deduction controls, renewal analytics, export payloads and the package tables/view. Calendar, attendance and event-linked makeup scheduling remain. Forward migration `202610161400_remove_legacy_session_packages` deletes legacy package records. Updated root AGENTS and current architecture/runbook/API/maintainer documentation; R20 records remain historical.
- Implemented the first Stage 4 athlete participation-status workflow: consent and assent, athlete correction/closure/withdrawal, assigned-coach status-only access, JSON self-export with an export access log, and 12-month deletion with an aggregate last-success checkpoint. Focused API lifecycle acceptance passed; Chromium passed before the final export addition and final WebKit acceptance passed with export. Stage 4 remains in progress pending retention outage/restart operations, the full sport-task/catalog audit, and university privacy/security review.
- Kept PostgreSQL on its internal Compose network and added a localhost-only proxy for the local host-based development workflow.
- Corrected the injury access-log action constraint in a follow-up migration before running lifecycle acceptance.
- Added athlete export and a minimal retention checkpoint that survives deletion without retaining person, organization, or per-record identifiers.

## Stage 3 self-hosting — 2026-10-16

- Began the approved Compose deployment with web/API images, HTTPS proxy, SMTP sign-in delivery, one-time university bootstrap, production configuration validation and per-instance database role password setup. Removed the tracked Vercel frontend config. Patched Prisma to 7.10.1 and overrode vulnerable transitive packages; npm audits report zero vulnerabilities. Fixed two migration startup defects found in the isolated Linux Compose smoke test. The full 40-migration fresh database, API, and web health checks now pass. The revoked Google service-account key was removed from the rewritten public university branch history. The founder accepts the earlier backup/restore verification; Stage 3 still needs update/rollback rehearsal and production review.
- Started Stage 4 with a workflow and authorization audit. Existing organization training and assessor-led assessment flows were mapped; injury/health records and a dedicated health-staff role are not present. No health-record schema or UI was added while access, consent and retention policy decisions remain open.

## Stage tracking and security reporting — 2026-10-16

- Closed Stage 2 after confirming the renamed repository is public and its completion commit is pushed. Clarified that the unrelated Vercel deployment status is not a Docker acceptance gate; Stage 3 remains gated on user approval.
- Added the root security disclosure policy and linked it from contributor, project, and documentation entry points. Added it to local documentation-link checks.
- Fixed a backend test type error exposed by the clean Node 22 workspace check.
- Preserved pinned SVG/JSON source bytes and generated SQL across Windows checkouts so digest and migration verification remain reproducible.
- Completed the pinned-runtime install, local content/license review, frontend unit/build/type checks, backend type checks, and isolated fresh-migration SQL rehearsal. No relevant GitHub Actions run was available.
- No product behavior, deployment capability, or release status changed.

## University revamp planning — 2026-10-16

- Recorded the approved university-first product direction, university-owned isolated deployment model, reuse audit, security/privacy baseline, staged acceptance criteria, risks, and open decisions.
- Added target architecture and ADR 0001. No product behavior or deployment capability changed in this planning stage.
- Created branch `codex/university-revamp-plan` for the approved staged work.

## Monorepo foundation — 2026-10-16

- Set the canonical repository/package name to `Rafik-Athlete-Managment/Rafik-OpenSource` / `rafik-opensource`; the hosted GitHub rename still requires an authorized GitHub connection.
- Imported the companion API repository under `apps/backend/`, retaining its branch history as a second parent in the monorepo merge.
- Applied Apache-2.0 to project code/documentation and retained separate content/media license boundaries.
- Reshaped the repository as npm workspaces under `apps/frontend`, `apps/backend` and `packages/shared`, with one root `AGENTS.md`, one `docs/` tree, and one Compose file in `infrastructure/`.
- Added shared API error/user contracts and moved generated database transport types into `packages/shared`; research Markdown was temporarily centralized under `docs/revival/coordination/` and later removed as obsolete historical material. Resolved an imported ADR number collision and updated local scripts, tests, CI and documentation for the workspace layout. No hosted deployment or university injury workflow is claimed.

## R21 — Session experience and workplace feedback

Optional satisfaction feedback is now source-specific and reusable by the later mobile app: completed workouts and attended, completed training appointments have distinct response counts/distributions; unanswered feedback is unknown. Trainers submit a separate monthly workplace rating, with visibility explained before submission. Administrators see its current-active-trainer coverage separately from client/date filters. Analytics also shows actual trainer session delivery and explicitly recorded package renewals, without inferring quality, revenue or paid retention.

Use organization **Analytics → Experience & renewals** for client/workplace/renewal views and **Delivery & capacity** for trainer session delivery. Trainers use **My feedback**; the retained trainee examination web has optional links after completion. The API is ready for later native integration; no native UI or hosting is claimed. Historical feedback checks: `npm run test:organization-feedback --workspace @rafik/backend` and `npm run test:e2e --workspace @rafik/frontend -- organization-feedback.e2e.ts`.

Maintenance in this phase fixes stale revisions after recovered rating/session-note saves and automatic analytics-tab switching on focus. Nested report tabs now remain contained at 320px. The READMEs and engineering guides distinguish current contracts/setup from historical evidence.

## R20 — Organization session packages

Organization packages now track explicit trainee entitlements, derived available/reserved/used balances, validity dates, auditable allowance corrections and linked renewals. Calendar booking reserves only an explicitly selected package; completion consumes present/charged absent sessions, cancellation/excused/released no-shows release, and independent trial/makeup/prize/other sessions never affect allowances. Staff session details include check-in timestamps and durable notes; the overview surfaces missed sessions without a replacement. Reuses workspace transactions/receipts and existing calendar events; no parallel scheduler or payment processor.

Open **Packages** from the organization sidebar; admins assign allowances and trainers book for their current roster. Historical package checks: `npm run test:organization-packages --workspace @rafik/backend` and `npm run test:e2e --workspace @rafik/frontend -- organization-packages.e2e.ts`. Apply new local migrations with `npm run db:migrate`, then `npm run db:generate`; never reseed an existing preview.

## R19 — Trainer tasks and daily follow-up · 28 September 2026

- SQL acceptance uses a disposable fixture database. Repeated exercise illustrations use local accessibility groups; publication success waits for durable command completion.
- Organization admins assign/reassign dated, prioritized trainer tasks. Trainers complete/reopen their own queue; admins can cancel and restore tasks. Search, history, scoped drafts, revisions and exact retry are included.
- Organization overview now links actual tasks, training awaiting review, past bookings awaiting an outcome and trainees without an active assignment. Upcoming appointments keep using the calendar.
- Task permissions follow current organization membership; reassignment revokes former assignee access before receipt replay. One table/service reuses existing command infrastructure.
- Package accounting follows in the next phase using the founder-confirmed reservation/completion/cancellation policy and explicit no-show decisions. Client-to-trainer satisfaction and trainer workplace satisfaction will be reported separately from explicit feedback; no invented risk/quality metrics.

## R18 — Organization exercise ownership, uploads and private conversations · 28 September 2026

- Multi-select body areas, muscles and equipment, controlled movement choices, direct uploads and existing-file reuse in organization exercise creation. Clearing selections also clears compatibility fields.
- Trainer-created library entries stay creator-private; organization-shared entries remain tenant-local. Published snapshots retain their categories and immutable demonstrations.
- Authenticated organization assets, resource search/archive/restore, safe upload retries and exact message attachment binding. Two-person conversations exclude nonparticipant administrators; group behavior is explicitly separate.
- Backup/export/orphan maintenance, forward-only migrations, permission tests, rendered review and engineering documentation. No preview reset, hosted storage or native work.

## R17 — Gym-first entry and authoring usability · 28 September 2026

- Gym-first homepage with an original workflow diagram, staff-only context switching, dark default, unchanged logo colors and reachable support navigation.
- Prefixed Tailwind utilities with no Preflight; existing tokens and components remain authoritative.
- Visible program descriptions and per-set tables, clearer weekly repetition/rest days and grouped supersets; separate organization nutrition example-plan tab.
- Month calendar and selected-day agenda; persistent messaging inbox keeps search and position when switching threads.
- Local acceptance: 32 focused Chromium/WebKit journeys, 27 units, production/type/cache/format checks. Package policy and exercise/media ownership are subsequent phases, not included in this checkpoint.

## R16 — Organization nutrition and shared follow-up · 23 September 2026

- Organization-owned dated calorie/macro plans and example meals, immutable versions, expiry and current-trainer/admin authority.
- Explicit trainee diary sharing, actual portion/source snapshots, corrections/removal history and subject export; personal nutrition stays separate.
- Plan / Food diary / History workspace, searchable trainee selection, roster links, publish review and scoped durable drafts/retries. Closed editors resume unfinished drafts; latest-write acknowledgement governs save feedback.
- Updated architecture/API/maintenance/Help, forward migrations and cross-role/workflow acceptance. Local only; hosting and native remain deferred.

## R15 — Broad exercise library, categories and real motion · 23 September 2026

- Imported 1,324 metadata/instruction entries and 46 separately licensed wger entries; retained starter identities and immutable history. Categories, source references, correct timed/rep recording and copied-content attribution are explicit.
- Added 45 continuous-motion previews with visible autoplay, pause, reduced-motion handling and recovery; removed manual illustration stepping. Excluded an ambiguous duplicate and trimmed two camera introductions.
- Rebuilt exercise browsing as bounded results/detail panes with category/equipment/type/media filters and phone back navigation. Searchable program pickers mount at most 40 results and preserve selections/alternative chips.
- Corrected Arabic direction in portaled exercise/timezone pickers; compact phone exercise rows and optional filter disclosure keep results reachable.
- Updated content provenance, generation/maintenance instructions, quality rules and verification. The requested GIF rights remain separate; video coverage is 45 entries, not the complete catalog.

## R14 — Actionable nutrition and sharp exercise guidance · 23 September 2026

- Visible calorie/macro targets, optional budget arithmetic, source-backed food picker, structured example days, adjustable actual portions and truthful target progress.
- Context-specific nutrition drafts and durable exact retries for all nutrition writes; unit changes clear incompatible values and helper drafts do not block plan saving.
- Shared exercise viewer with three vector reference poses, deliberate play/pause, reduced-motion/hidden-page behavior, attribution and image retry. Offline shell includes the bounded public reference pack.
- Research, engineering content guide, API contract, Help and acceptance coverage updated. The library starts with 15 foods and ten exact exercise matches; organization nutrition and native integration remain outstanding.

- Acceptance: 28 full release gates passed, followed by 22 final focused browser regressions after the late-save navigation guard and Arabic portion refinements. Full evidence and limits are in the implementation verification record.

## R13 — Staff dashboard and control quality · 23 September 2026

- Persistent coach/organization sidebar, compact task headings, mobile navigation drawer and bounded desktop workspace/collection scrolling.
- Unovis analytics with axes, tooltips, integer count ticks, keyboard/table equivalents, category pages, clear activity/delivery tabs and retained reports during refresh failure.
- Shared searchable Reka timezone picker on all five editing/viewing surfaces, full IANA catalog, UTC, persisted aliases, current offsets and common city-name aliases.
- Stale calendar-response guard, selected-filter retention, repaired undefined semantic colors, coherent Help/navigation documentation and durable quality rules. ADR0009 documents the dependency/scrolling decisions.
- Final serial acceptance passed all 26 gates: 76 browser journeys, 1,120 rendered states, 14 web units and all backend/build/maintenance checks. The R13 audit records discovered/fixed integration defects and local evidence limits.

## R12 — Connected entry and product refinement · 23 September 2026

- Coach/organization public entry, preserved immediate workout, grouped sample roles and role-specific Help; workspace intent retained through sign-in.
- Natural-page conversation creation, optional scheduling setup, retained selected templates, resolved participant review, step focus and superseded-read protection.
- Current scope/architecture/runbook/source map and release-evidence handoff; prepared organization observation protocol without claiming human outcomes.
- Final serial acceptance passed 72 browser journeys, 928 rendered states and all backend/fresh/build/maintenance gates; see the backend verification record. Hosting/providers/devices/human use remain separate gates.

## R11 — Operations, scale and recovery · 23 September 2026

- Separate platform authority, audited actions/support and account/session suspension; local Amina sample.
- Bounded organization people/recipients/history/analytics, persistent multi-page selections and measured roster index.
- Disposable browser acceptance, private-file maintenance and database-plus-byte recovery rehearsal; current architecture/runbook/API/maintainer docs and ADR0008.
- Verified 70 browser journeys, 96 rendered states,domain/HTTP/fresh/schema checks. Local only; real providers/devices/human outcomes remain outstanding.

## R10 — Scoped communication and notifications (23 September 2026)

Organization channels with visible membership, compact responsive list/detail, durable message drafts/exact retries and accessible history. Global authorized notification links, category preferences and quiet hours; transactional intent capture, bounded retries/retention and local intercepted delivery. No external provider delivery.

## R9 — Organization services and informative analytics · 23 September 2026

Added organization groups, assessment templates, reviewed recurring scheduling, explicit assessors, cross-context booking conflict checks, per-trainee attendance/results and retained corrections. Added distinct independent coach, organization trainer and administrator analytics with date/trainee filters, source links, chart tables and explicit definitions. Focused result editing, device drafts and exact interrupted-command retry preserve work. Consolidated secondary organization navigation. Added fixture, HTTP, browser and responsive acceptance coverage plus maintained API/source/operations documentation. External reminders follow in R10.

## R8 — Scoped programming and reviewed delivery · 23 September 2026

Added organization-owned exercise/program catalogs, immutable publication, private optional covers, reviewed atomic assignments, trainee training/history and coach review. Shared independent/organization editing supports session/week reuse, scoped draft/retry recovery and individual adaptation without changing other recipients or started work. Preserved one workout persistence queue. Added source/lifecycle documentation and HTTP, unit and browser regression coverage. R9 organization services and analytics remain subsequent work.

## R7A2 — Organization membership and role views · 23 September 2026

Added separate organizations, combined admin/trainer/trainee memberships, verified invitations, internal trainer responsibility, role-derived navigation and explicit independent-practice activation. Membership revision checks, exact receipts, last-admin protection, departure/closure and account deletion preserve scope and ownership. Recoverable setup/invitation drafts and shared truthful sending/retry states support the UI. Added isolated HTTP/browser regression coverage and maintained contracts/source-map documentation. Organization programs/history/services follow in R8/R9; this checkpoint is not the whole organization product.

## R7A1 — Prisma/PostgreSQL API transition · 23 September 2026

Replaced the Supabase browser SDK with the owned HTTP API for identity, commands, reads and private files. Cookie sessions replace JavaScript-held access tokens. Preserved durable drafts/retries and fixed confirmed-rejection handling. Updated actual browser/fixture/layout tests and engineering docs; 54 browser journeys pass across both engines. Organization ownership follows in R7A2.

## Original-role audit and corrected architecture order · 23 September 2026

- Traced platform, independent and organizational roles through the original web/mobile, captured deployed schema/functions and worker; documented source evidence, combined-role behavior and legacy defects.
- Recorded that R4 teams, personal-coach handoff and response forms do not replace organizational membership, internal staff reassignment or assessor-led assessments.
- Added ADR 0005 and R7A ahead of R8: scoped organization ownership and the Prisma/PostgreSQL API transition, with role-specific navigation and acceptance. Coach/admin analytics now depend on this foundation. These are documented decisions, not implemented organizational features.
- Set aside unshipped personal-only R8 delivery drafts; no draft migration was applied. Added durable requirements-tracing rules and updated engineering entry points.

## R7 — Daily workspace

- Compact four-destination phone navigation and explicit workspace switching; full tools remain discoverable through More and desktop navigation.
- Unified named coach attention queue with filters, next-review return, Today-first client schedule and focused reads.
- Server-paginated roster search, URL-backed filters/client tabs, extracted workspace styles and removed obsolete navigation CSS.
- Added disposable-fixture browser checks for attention, mobile navigation, RTL and nested layout; backend contract and maintained documentation explain boundaries.

## R6 — Responsive maintenance and local release hardening · 23 September 2026

- Fixed mobile inbox 250px rows and hidden width overflow by removing obsolete horizontal-list CSS, constraining intrinsic widths and keeping list scrolling bounded. Restored wrapping workspace navigation; fixed WebKit long select/Arabic resource filter overflow.
- Removed foreground/background theme interpolation that briefly reduced button contrast.
- Bounded the client roster to twelve visible rows with load-more and whole-roster search; successful reload clears old read errors.
- Added multi-contact/long-label/resizing/short-height regression coverage and a broad two-engine audit that checks internal clipping. Recorded the missed-state root cause and durable quality rules; corrected stale runbook instructions.
- Added content-versioned offline shells and non-interrupting update checks in Help/Settings. Failed first installs can retry without a reload; failed updates preserve the current version; waiting updates activate after old tabs close, retaining device work.
- Fixed the SQL launcher to drain piped output before exiting, retaining all assertion/rollback evidence.
- Added a guarded, serial local release verification command with per-step reports/logs and explicit unverified release boundaries. No migration, reset, deployment, external provider, native change or push.

## R5 — 23 September 2026

- Reorganized engineering handoff around a docs index, CONTRIBUTING/definition of done, ADRs, API conventions and release gates; added local documentation-link checks and durable rules in both AGENTS files.
- Reworked Messages history/composer geometry, searchable inbox and phone back navigation, optional file controls, visible-history read cursors and send focus. Preserved durable exact retries and attachment/context permissions.
- Improved Today task priority, searched/bounded check-in/template/plan/review collections, direct post-assignment navigation, nutrition/resource empty states and team-invitation shell.
- Added frozen coach-approved exercise alternatives and actual client choices, using existing durable workout commands, plus correct review/previous-performance/progress and independently owned shared-plan/handoff copies. Additive migration 009; no data reset or new service.
- Added rollback and real-browser quality regressions; see the companion verification record for actual final results and limitations. Hosting, external providers and native work remain deferred.

Update this file whenever further implementation changes land. Keep the companion backend ledger, architecture and verification records consistent. This is implemented change history, not the remaining-product backlog.

## R4 — Team and business operations · 23 September 2026

- Added optional Teams, Business and Support destinations under More. Solo entry/Today do not require team or commercial setup. Client Today surfaces pending enrollment/handoff decisions.
- Added real team creation/rename/closure, staff invitation/acceptance/role change/ownership transfer/removal, scoped roster, client consent/handoff, group create/rename/archive and reviewed bulk assignment. Shared plan import opens an independently editable plan; staff file access uses existing private Storage/downloads.
- Added `teams/commands.ts` and `CommandStatus.vue`: one account/screen-scoped exact command persisted before dispatch, visible retry after a lost acknowledgement, confirmed rejection releases the form. Team invite links are recovered from acknowledged command payloads and retained only on the initiating device.
- Added account state/event history and explicitly local owner-only provider simulation. Support cases include team/private audience selection, typed draft recovery, team-admin response and resolve/reopen. Added file-owner visibility/revocation of team grants, deletion preflight and R4 export data.
- Preserved existing Vue modules/design/language/theme conventions; added responsive team rows and controls, contextual errors and local preview buttons for Nour/Dalia. Generated database types updated from the new local schema.
- Added isolated fresh-identity browser fixtures, R4 workflow/failure checks and a reproducible 176-layout matrix. Architecture and maintenance instructions updated with the corresponding backend phase. The full revamp still requires R5 integrated readiness and later release/native gates.

## R3 — Broader service delivery · 22 September 2026

- Added the optional More hub and coach/client nutrition, appointment and resource routes. Preserved the existing visual system and primary training/coaching navigation. Client workspaces link to nutrition/appointments/resources; Today shows real bookings in the next seven days.
- Added manual meal recording, saved foods, correction/removal, per-relationship visibility, portion-scaled known nutrient totals and versioned coach guidance. Optional detail is collapsed; empty nutrition metrics are hidden. Client scope survives refresh through the route query.
- Added availability preview/publication, bounded weekly/fortnightly slots, timezone display, booking, rescheduling, cancellation/history and coach attendance. Pending calendar commands survive reload with their exact request IDs.
- Added real private file upload/download, recoverable pending uploads, explicit relationship sharing/revocation and recoverable deletion. Conversations support shared file attachments and show unavailable files after access is revoked. Account export includes all R3 tables; account deletion cleans owned bytes before deleting Auth data.
- Added nutrition calculation tests, six browser scenarios across Chromium/WebKit and a 128-layout R3 visual matrix. Query-only navigation now preserves input focus. Phone workspace navigation wraps to keep More visible, Safari selects retain touch-sized styling, and quick links reach entry forms without scrolling through records. Updated generated SQL types, bilingual errors, README and cross-repository maintenance docs.

## R2 — Ongoing coaching · 22 September 2026

- Added `src/features/ongoing/`: template editor; check-in/assessment assignment and history; draft/submission/correction/review screen; conversations; progress; contextual Today activity; shared module types and pure helpers.
- Added private routes for coach/client check-ins and response details, template editing, conversations and progress. Added navigation and client-workspace links without changing the approved visual direction. Workout review and response pages link to contextual conversation.
- Progress displays real completed exercise results with unit-aware trends and exact values, current-cycle schedule counts, and optional private/shared body measurements with correction/removal.
- Reusable forms support text, numeric and yes/no answers, optional units/bounds, ordered questions and required fields. Assigned snapshots survive template edits. Compatible assessment history stays separated by definition revision.
- Messages use persisted local send commands, server deduplication, unread summaries, bounded history loading and visible-page refresh. Failed acknowledgements can be retried after reload without another message. No outbound notification or attachment provider.
- Added server/device draft recovery, stale-edit recovery, archived-state handling, bilingual copy, phone layouts and light/dark styling. Account export now includes the five new domains.
- Regenerated SQL types; added pure trend/state tests and browser journeys for check-in review/correction, assessment comparison/cancellation, measurement sharing and dropped-message acknowledgement.
- Expanded READMEs and added this change history. The [maintainer guide](./docs/development/maintainer-guide.md) explains the full file map and development workflow. `AGENTS.md` now requires documentation updates with further work.

## R1 — Daily coaching · 22 September 2026 · `8097f0d`

Expanded the client workspace/roster lifecycle, custom exercise catalog, richer multiweek programming, assignment schedules, timed/distance/effort recording, per-set targets, group guidance, prior performance and coach actual-result review. Added regression and rendered checks while retaining the new visual system.

## Foundation · 22 September 2026 · `a6afdc3`

Rebuilt the web application in Vue 3/TypeScript with English/Arabic and light/dark support; useful public workout sample, local Auth/invitations, immutable published plans, durable workout logging/sync/recovery, coach review, account/help tools, tests and production shell caching. Old web source remains at `a0c723e`.

[Current status](./docs/development/ledger.md) · [Architecture](docs/archive/system-architecture-2026-10-16.md) · [Runbook](./docs/operations/README.md) · [Verification](docs/verification/README.md)

# Unreleased

- Began Stage 4 with a consent-gated athlete participation-status lifecycle, assigned-coach limited status view, admin consent setup, correction history, access logs, and 12-month post-closure deletion. Stage 4 remains in progress; API and rendered-browser acceptance, athlete export, operational retention evidence, catalog audit, and university privacy/security review are open.
- Restored the documented local Compose project identity and updated its local database guards so the local Docker workflow stays aligned with the existing volume.
