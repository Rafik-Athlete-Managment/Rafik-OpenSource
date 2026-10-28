# Frontend views and access

Generated from maintained source and reviewed descriptions by `npm run frontend:inventory`. Do not edit this generated file; update the two inventory JSON files beside the script. Source audit, not rendered or security acceptance. See [scope and findings](README.md).

## AccessPage

- **Source:** [features/account/AccessPage.vue](../../../apps/frontend/src/features/account/AccessPage.vue)
- **Folder:** `features/account`
- **URL(s):** `/access`
- **Purpose:** Membership/connection recovery with explicit refresh and sign-out.
- **Access:** Signed-in accounts; no institution membership is required to show recovery.
- **Opens:** `/dashboard`, `/login`
- **Opened from views:** `/`, `/activity`, `/dashboard`, `/institution-settings`, `/login`, `/members/:member`, `/password-setup/:token`, `/people`, `/setup`
- **Embedded by:** Router.
- **Shell entry:** No direct shell item; use the workflow or entry described above.
- **Other entry:** Router membership/network failure guard; retry or sign out.

## EntryPage

- **Source:** [features/account/EntryPage.vue](../../../apps/frontend/src/features/account/EntryPage.vue)
- **Folder:** `features/account`
- **URL(s):** `/`
- **Purpose:** Dispatch root to first-run setup, sign-in or the current institution dashboard.
- **Access:** Public entry; setup status is read without creating an account.
- **Opens:** `/access`, `/dashboard`, `/login`, `/setup`
- **Opened from views:** `/:pathMatch(.*)*`, `/settings`
- **Embedded by:** Router.
- **Shell entry:** [App.vue](../../../apps/frontend/src/App.vue)
- **Other entry:** Root URL, brand link and missing-page recovery.

## HelpPage

- **Source:** [features/account/HelpPage.vue](../../../apps/frontend/src/features/account/HelpPage.vue)
- **Folder:** `features/account`
- **URL(s):** `/help`
- **Purpose:** Institution workflow help, scope/privacy explanation and reference-media credits.
- **Access:** Public help; shell utilities vary with session state.
- **Opens:** `/dashboard`
- **Opened from views:** `/privacy`
- **Embedded by:** Router.
- **Shell entry:** [App.vue](../../../apps/frontend/src/App.vue)

## LocalPreview

- **Source:** [features/account/LocalPreview.vue](../../../apps/frontend/src/features/account/LocalPreview.vue)
- **Folder:** `features/account`
- **URL(s):** `/local-preview`
- **Purpose:** Synthetic administrator/coach/athlete/operator entry for explicitly enabled local development.
- **Access:** Development build only, plus local-preview API configuration; never production acquisition.
- **Opens:** `/dashboard`, `/platform`
- **Opened from views:** None; see entry/dynamic rules.
- **Embedded by:** Router.
- **Shell entry:** [App.vue](../../../apps/frontend/src/App.vue)
- **Other entry:** DEV-only shell utility; requires explicit local-preview backend flag.

## LoginPage

- **Source:** [features/account/LoginPage.vue](../../../apps/frontend/src/features/account/LoginPage.vue)
- **Folder:** `features/account`
- **URL(s):** `/login`
- **Purpose:** Password sign-in with safe next-path handling and current-context redirect.
- **Access:** Public; successful identity still needs current institution or operator authority.
- **Opens:** `/access`, `/dashboard`
- **Opened from views:** `/`, `/access`, `/setup`
- **Embedded by:** Router.
- **Shell entry:** [App.vue](../../../apps/frontend/src/App.vue)

## PasswordSetupPage

- **Source:** [features/account/PasswordSetupPage.vue](../../../apps/frontend/src/features/account/PasswordSetupPage.vue)
- **Folder:** `features/account`
- **URL(s):** `/password-setup/:token`
- **Purpose:** Choose a password through an administrator-issued expiring single-use reset/setup token.
- **Access:** Public token entry; backend validates the token, expiry and password rules.
- **Opens:** `/access`, `/dashboard`
- **Opened from views:** `/members/:member`
- **Embedded by:** Router.
- **Shell entry:** No direct shell item; use the workflow or entry described above.
- **Other entry:** Administrator-issued password setup/reset URL shared out of band; not a sidebar item.

## SettingsPage

- **Source:** [features/account/SettingsPage.vue](../../../apps/frontend/src/features/account/SettingsPage.vue)
- **Folder:** `features/account`
- **URL(s):** `/settings`
- **Purpose:** Own profile/preferences, session diagnostics, updates, export, sign-out and account-deletion recovery.
- **Access:** Signed-in account; own data only. Institution-wide settings use a separate route.
- **Opens:** `/`, `/training`
- **Opened from views:** None; see entry/dynamic rules.
- **Embedded by:** Router.
- **Shell entry:** [App.vue](../../../apps/frontend/src/App.vue)

## SetupPage

- **Source:** [features/account/SetupPage.vue](../../../apps/frontend/src/features/account/SetupPage.vue)
- **Folder:** `features/account`
- **URL(s):** `/setup`
- **Purpose:** First-run institution and initial super-admin creation.
- **Access:** Public only while the instance is uninitialized; backend atomically closes setup after success.
- **Opens:** `/access`, `/dashboard`, `/login`
- **Opened from views:** `/`
- **Embedded by:** Router.
- **Shell entry:** No direct shell item; use the workflow or entry described above.
- **Other entry:** Root setup-status dispatch only before initialization.

## AnalyticsPage

- **Source:** [features/analytics/AnalyticsPage.vue](../../../apps/frontend/src/features/analytics/AnalyticsPage.vue)
- **Folder:** `features/analytics`
- **URL(s):** `/analytics`
- **Purpose:** Institution/coaching analytics with activity, delivery and experience tabs and scoped filters.
- **Access:** Administrator institution totals; coaches current authorized responsibility. Athlete reads are refused by the API.
- **Opens:** `/people`, `/schedule`, `/training`
- **Opened from views:** `/dashboard`
- **Embedded by:** Router.
- **Shell entry:** [App.vue](../../../apps/frontend/src/App.vue), [features/navigation/DashboardNav.vue](../../../apps/frontend/src/features/navigation/DashboardNav.vue)

## DeliverPlan

- **Source:** [features/coaching/DeliverPlan.vue](../../../apps/frontend/src/features/coaching/DeliverPlan.vue)
- **Folder:** `features/coaching`
- **URL(s):** `/deliver/:id`
- **Purpose:** Published-program assignment, athlete selection, concurrent-plan conflict review and replacement choices.
- **Access:** Administrators and authorized coaches; recipients and program/version access are checked server-side.
- **Opens:** `/plans`, `/training`
- **Opened from views:** `/plans/:id`, `/training/:assignment`
- **Embedded by:** Router.
- **Shell entry:** No direct shell item; use the workflow or entry described above.

## ExercisesPage

- **Source:** [features/coaching/ExercisesPage.vue](../../../apps/frontend/src/features/coaching/ExercisesPage.vue)
- **Folder:** `features/coaching`
- **URL(s):** `/exercises`, `/exercises/:editor`
- **Purpose:** Exercise library discovery plus dedicated new/edit route modes, taxonomy and private-media authoring.
- **Access:** Administrator/coach catalog authority; editability depends on institution/private ownership. Athletes cannot author the catalog.
- **Opens:** `/exercises`, `/exercises/:editor`
- **Opened from views:** `/plans/:id`, `/training/:assignment`
- **Embedded by:** Router.
- **Shell entry:** [App.vue](../../../apps/frontend/src/App.vue), [features/navigation/DashboardNav.vue](../../../apps/frontend/src/features/navigation/DashboardNav.vue)

## PlanEditor

- **Source:** [features/coaching/PlanEditor.vue](../../../apps/frontend/src/features/coaching/PlanEditor.vue)
- **Folder:** `features/coaching`
- **URL(s):** `/plans/:id`, `/training/:assignment`
- **Purpose:** Program draft editor and immutable-version preview, prescription structure, cover, publication and assignment links.
- **Access:** Administrators/coaches edit within program ownership rules; athletes read only their own assigned immutable versions, not staff drafts or unassigned versions.
- **Opens:** `/deliver/:id`, `/exercises`, `/plans`, `/plans/:id`
- **Opened from views:** `/members/:member`, `/plans`, `/schedule/:id`, `/training`, `/training/:assignment`
- **Embedded by:** `features/institution/AssignedPlanPage.vue`
- **Shell entry:** No direct shell item; use the workflow or entry described above.

## PlansPage

- **Source:** [features/coaching/PlansPage.vue](../../../apps/frontend/src/features/coaching/PlansPage.vue)
- **Folder:** `features/coaching`
- **URL(s):** `/plans`
- **Purpose:** Paginated/searchable program library and entry to create, preview or edit.
- **Access:** Current institutional members; athletes receive only their own assigned immutable versions, staff authoring remains gated.
- **Opens:** `/plans/:id`, `/training`
- **Opened from views:** `/deliver/:id`, `/members/:member`, `/plans/:id`, `/training`, `/training/:assignment`
- **Embedded by:** Router.
- **Shell entry:** [App.vue](../../../apps/frontend/src/App.vue), [features/navigation/DashboardNav.vue](../../../apps/frontend/src/features/navigation/DashboardNav.vue)

## ReviewPage

- **Source:** [features/coaching/ReviewPage.vue](../../../apps/frontend/src/features/coaching/ReviewPage.vue)
- **Folder:** `features/coaching`
- **URL(s):** `/review/:id`
- **Purpose:** Recorded-workout review, actual results, correction/version information and coach feedback.
- **Access:** Administrators and authorized coaches for the referenced institutional workout; API decides subject scope.
- **Opens:** `/record/:session`, `/review/:id`, `/training`
- **Opened from views:** `/dashboard`, `/members/:member`, `/record/:session`, `/training`, `/training/:assignment`, `/workouts`
- **Embedded by:** Router.
- **Shell entry:** No direct shell item; use the workflow or entry described above.

## AssessmentHistory

- **Source:** [features/institution/AssessmentHistory.vue](../../../apps/frontend/src/features/institution/AssessmentHistory.vue)
- **Folder:** `features/institution`
- **URL(s):** `/assessments/:member`
- **Purpose:** Athlete assessment result history with comparable drill charts and versioned results.
- **Access:** Athlete own results; staff only within current subject/event authority.
- **Opens:** `/training`
- **Opened from views:** `/members/:member`, `/training/:assignment`
- **Embedded by:** Router.
- **Shell entry:** No direct shell item; use the workflow or entry described above.

## AssignedPlanPage

- **Source:** [features/institution/AssignedPlanPage.vue](../../../apps/frontend/src/features/institution/AssignedPlanPage.vue)
- **Folder:** `features/institution`
- **URL(s):** `/training/:assignment`
- **Purpose:** Dedicated assigned-plan review, scoped workout scheduling and adaptation from the assigned immutable snapshot using the shared editor.
- **Access:** Administrators and authorized primary/sport-supporting coaches; athletes redirected before rendering.
- **Opens:** `/assessments/:member`, `/deliver/:id`, `/exercises`, `/members/:member`, `/plans`, `/plans/:id`, `/record/:session`, `/review/:id`, `/training`, `/training/:assignment`, `/workout/:id`, `/workouts`
- **Opened from views:** `/members/:member`, `/schedule/:id`, `/training`
- **Embedded by:** Router.
- **Shell entry:** No direct shell item; use the workflow or entry described above.

## AthletePlans

- **Source:** [features/institution/AthletePlans.vue](../../../apps/frontend/src/features/institution/AthletePlans.vue)
- **Folder:** `features/institution`
- **URL(s):** `/training` Embedded screen; no independent route.
- **Purpose:** Paginated staff assignment directory with dedicated detail routes; no embedded editor/detail below filters.
- **Access:** Administrators and training-authorized coaches; supporting links follow the training-scope contract.
- **Opens:** `/plans`, `/training/:assignment`, `/workouts`
- **Opened from views:** `/analytics`, `/assessments/:member`, `/dashboard`, `/deliver/:id`, `/members/:member`, `/plans`, `/review/:id`, `/schedule/:id`, `/settings`, `/training`, `/training/:assignment`, `/workout/:id`, `/workouts`
- **Embedded by:** `features/institution/TrainingRoute.vue`
- **Shell entry:** [App.vue](../../../apps/frontend/src/App.vue), [features/navigation/DashboardNav.vue](../../../apps/frontend/src/features/navigation/DashboardNav.vue)

## AthleteProfile

- **Source:** [features/institution/AthleteProfile.vue](../../../apps/frontend/src/features/institution/AthleteProfile.vue)
- **Folder:** `features/institution`
- **URL(s):** `/members/:member`
- **Purpose:** Person profile with real overview/plans/workouts/assessments/nutrition/participation/manage tabs according to subject role.
- **Access:** Administrators can inspect/manage institutional people. Coaches can inspect their authorized athletes, not a staff directory; sensitive sections retain separate API restrictions.
- **Opens:** `/access`, `/assessments/:member`, `/messages/:channel?`, `/nutrition`, `/password-setup/:token`, `/people`, `/plans`, `/record/:session`, `/review/:id`, `/training`, `/training/:assignment`, `/workouts`
- **Opened from views:** `/injuries`, `/people`, `/training/:assignment`
- **Embedded by:** Router.
- **Shell entry:** No direct shell item; use the workflow or entry described above.

## AthleteTraining

- **Source:** [features/institution/AthleteTraining.vue](../../../apps/frontend/src/features/institution/AthleteTraining.vue)
- **Folder:** `features/institution`
- **URL(s):** `/training` Embedded screen; no independent route.
- **Purpose:** Athlete next-workout agenda and access to unsynced device records; no arbitrary plan-day chooser.
- **Access:** Athlete self through TrainingRoute; authorization for any subject remains server-owned.
- **Opens:** `/record/:session`, `/review/:id`, `/training`, `/training/:assignment`, `/workout/:id`, `/workouts`
- **Opened from views:** `/analytics`, `/assessments/:member`, `/dashboard`, `/deliver/:id`, `/members/:member`, `/plans`, `/review/:id`, `/schedule/:id`, `/settings`, `/training`, `/training/:assignment`, `/workout/:id`, `/workouts`
- **Embedded by:** `features/institution/TrainingRoute.vue`
- **Shell entry:** [App.vue](../../../apps/frontend/src/App.vue), [features/navigation/DashboardNav.vue](../../../apps/frontend/src/features/navigation/DashboardNav.vue)

## BrandingSettings

- **Source:** [features/institution/BrandingSettings.vue](../../../apps/frontend/src/features/institution/BrandingSettings.vue)
- **Folder:** `features/institution`
- **URL(s):** `/activity`, `/dashboard`, `/institution-settings`, `/people` Embedded screen; no independent route.
- **Purpose:** Instance name, accent, theme backgrounds and logo editing with authorized capability check.
- **Access:** Initial super admin only, inside administrator institution settings.
- **Opens:** None; see entry/dynamic rules.
- **Opened from views:** `/`, `/access`, `/analytics`, `/dashboard`, `/help`, `/invitation/:token`, `/local-preview`, `/login`, `/members/:member`, `/notifications`, `/password-setup/:token`, `/setup`, `/support`
- **Embedded by:** `features/institution/DashboardPage.vue`
- **Shell entry:** [App.vue](../../../apps/frontend/src/App.vue), [features/navigation/DashboardNav.vue](../../../apps/frontend/src/features/navigation/DashboardNav.vue)

## ChannelEditor

- **Source:** [features/institution/ChannelEditor.vue](../../../apps/frontend/src/features/institution/ChannelEditor.vue)
- **Folder:** `features/institution`
- **URL(s):** `/messages/:channel?` Embedded screen; no independent route.
- **Purpose:** Conversation participant/group editing with authorized roster selection.
- **Access:** Current channel authority; private-pair and group membership rules are enforced by communication API.
- **Opens:** None; see entry/dynamic rules.
- **Opened from views:** `/members/:member`, `/messages/:channel?`, `/notifications`, `/people`
- **Embedded by:** `features/institution/ChannelThread.vue`
- **Shell entry:** [App.vue](../../../apps/frontend/src/App.vue), [features/navigation/DashboardNav.vue](../../../apps/frontend/src/features/navigation/DashboardNav.vue)

## ChannelThread

- **Source:** [features/institution/ChannelThread.vue](../../../apps/frontend/src/features/institution/ChannelThread.vue)
- **Folder:** `features/institution`
- **URL(s):** `/messages/:channel?` Embedded screen; no independent route.
- **Purpose:** Message timeline, pagination, per-thread draft, attachment staging, send and participant controls.
- **Access:** Authorized participants only; byte and mutation permissions are rechecked server-side.
- **Opens:** `/messages/:channel?`
- **Opened from views:** `/members/:member`, `/messages/:channel?`, `/notifications`, `/people`
- **Embedded by:** `features/institution/ChannelsPage.vue`
- **Shell entry:** [App.vue](../../../apps/frontend/src/App.vue), [features/navigation/DashboardNav.vue](../../../apps/frontend/src/features/navigation/DashboardNav.vue)

## ChannelsPage

- **Source:** [features/institution/ChannelsPage.vue](../../../apps/frontend/src/features/institution/ChannelsPage.vue)
- **Folder:** `features/institution`
- **URL(s):** `/messages/:channel?`
- **Purpose:** Conversation directory, unified people/thread search and selection without a separate start page.
- **Access:** Institution members see their own channels; staff can initiate authorized conversations and athletes can initiate pairs with active assigned coaches. Administrators do not gain unrelated private-pair access.
- **Opens:** `/messages/:channel?`
- **Opened from views:** `/members/:member`, `/notifications`, `/people`
- **Embedded by:** Router.
- **Shell entry:** [App.vue](../../../apps/frontend/src/App.vue), [features/navigation/DashboardNav.vue](../../../apps/frontend/src/features/navigation/DashboardNav.vue)

## DashboardPage

- **Source:** [features/institution/DashboardPage.vue](../../../apps/frontend/src/features/institution/DashboardPage.vue)
- **Folder:** `features/institution`
- **URL(s):** `/activity`, `/dashboard`, `/institution-settings`, `/people`
- **Purpose:** Role dashboard and route-selected People, Activity and Institution settings sections, invitations and close-institution confirmation.
- **Access:** Dashboard: all members. People: administrators and coaches with scoped roster. Activity/settings: administrator router gate; branding has a stricter initial-admin check.
- **Opens:** `/access`, `/activity`, `/analytics`, `/injuries`, `/institution-settings`, `/members/:member`, `/messages/:channel?`, `/nutrition`, `/people`, `/plans`, `/record/:session`, `/review/:id`, `/schedule`, `/schedule/:id`, `/schedule/new`, `/training`, `/training/:assignment`, `/workout/:id`, `/workouts`
- **Opened from views:** `/`, `/access`, `/analytics`, `/help`, `/invitation/:token`, `/local-preview`, `/login`, `/members/:member`, `/notifications`, `/password-setup/:token`, `/setup`, `/support`
- **Embedded by:** Router.
- **Shell entry:** [App.vue](../../../apps/frontend/src/App.vue), [features/navigation/DashboardNav.vue](../../../apps/frontend/src/features/navigation/DashboardNav.vue)

## DelegatedWorkout

- **Source:** [features/institution/DelegatedWorkout.vue](../../../apps/frontend/src/features/institution/DelegatedWorkout.vue)
- **Folder:** `features/institution`
- **URL(s):** `/record/:session`
- **Purpose:** Coach recording of an assigned athlete workout with actual measurement-aware results.
- **Access:** Administrators or training-authorized coaches; selected assignment/session permission is checked by API.
- **Opens:** `/record/:session`, `/review/:id`
- **Opened from views:** `/members/:member`, `/review/:id`, `/training`, `/training/:assignment`
- **Embedded by:** Router.
- **Shell entry:** No direct shell item; use the workflow or entry described above.

## EventComposer

- **Source:** [features/institution/EventComposer.vue](../../../apps/frontend/src/features/institution/EventComposer.vue)
- **Folder:** `features/institution`
- **URL(s):** `/schedule/new`
- **Purpose:** Multi-step training/assessment scheduling with group/athlete/staff selection, timezone and template handoff.
- **Access:** Staff with schedule authority; server validates people, template and event scope.
- **Opens:** `/assessment-templates/:editor`, `/schedule`, `/schedule/:id`
- **Opened from views:** `/dashboard`, `/events`, `/schedule`, `/schedule/:id`
- **Embedded by:** Router.
- **Shell entry:** No direct shell item; use the workflow or entry described above.

## EventDetail

- **Source:** [features/institution/EventDetail.vue](../../../apps/frontend/src/features/institution/EventDetail.vue)
- **Folder:** `features/institution`
- **URL(s):** `/schedule/:id`
- **Purpose:** Scheduled event detail, roster attendance, assessment scores, completion, correction history and makeup links.
- **Access:** Administrators, designated coach staff and participating athletes receive different authorized projections/actions.
- **Opens:** `/feedback`, `/schedule`, `/schedule/new`, `/training`, `/training/:assignment`
- **Opened from views:** `/dashboard`, `/events`, `/notifications`, `/schedule`, `/schedule/new`
- **Embedded by:** Router.
- **Shell entry:** No direct shell item; use the workflow or entry described above.

## FeedbackPage

- **Source:** [features/institution/FeedbackPage.vue](../../../apps/frontend/src/features/institution/FeedbackPage.vue)
- **Folder:** `features/institution`
- **URL(s):** `/feedback`
- **Purpose:** Athlete session ratings or coach workplace feedback with prior submissions.
- **Access:** Athlete self or coach self; administrators use analytics instead of submitting personal feedback here.
- **Opens:** None; see entry/dynamic rules.
- **Opened from views:** `/schedule/:id`, `/workout/:id`
- **Embedded by:** Router.
- **Shell entry:** [App.vue](../../../apps/frontend/src/App.vue), [features/navigation/DashboardNav.vue](../../../apps/frontend/src/features/navigation/DashboardNav.vue)

## InjuryStatus

- **Source:** [features/institution/InjuryStatus.vue](../../../apps/frontend/src/features/institution/InjuryStatus.vue)
- **Folder:** `features/institution`
- **URL(s):** `/injuries`
- **Purpose:** Consent-gated participation status, reporting/correction/closure, policy configuration and athlete export.
- **Access:** Athletes manage their own sensitive record; designated primary coaches receive limited status; administrators configure policy, not unrestricted injury details.
- **Opens:** `/members/:member`
- **Opened from views:** None; see entry/dynamic rules.
- **Embedded by:** Router.
- **Shell entry:** [App.vue](../../../apps/frontend/src/App.vue), [features/navigation/DashboardNav.vue](../../../apps/frontend/src/features/navigation/DashboardNav.vue)

## InvitationPage

- **Source:** [features/institution/InvitationPage.vue](../../../apps/frontend/src/features/institution/InvitationPage.vue)
- **Folder:** `features/institution`
- **URL(s):** `/invitation/:token`
- **Purpose:** Accept a seven-day institution invitation and create/sign into the invited account.
- **Access:** Public single-use token entry; backend checks expiry, recipient identity and role before membership creation.
- **Opens:** `/dashboard`
- **Opened from views:** None; see entry/dynamic rules.
- **Embedded by:** Router.
- **Shell entry:** No direct shell item; use the workflow or entry described above.
- **Other entry:** Administrator-generated invitation URL shared out of band; not a sidebar item.

## MemberManagement

- **Source:** [features/institution/MemberManagement.vue](../../../apps/frontend/src/features/institution/MemberManagement.vue)
- **Folder:** `features/institution`
- **URL(s):** `/members/:member` Embedded screen; no independent route.
- **Purpose:** Profile management of identity/access, active state, coach links, sports and password reset issuance.
- **Access:** Administrators only through the profile Manage tab; each write is authorized and revision checked.
- **Opens:** `/access`, `/password-setup/:token`
- **Opened from views:** `/injuries`, `/people`, `/training/:assignment`
- **Embedded by:** `features/institution/AthleteProfile.vue`
- **Shell entry:** No direct shell item; use the workflow or entry described above.

## ScheduleCalendar

- **Source:** [features/institution/ScheduleCalendar.vue](../../../apps/frontend/src/features/institution/ScheduleCalendar.vue)
- **Folder:** `features/institution`
- **URL(s):** `/schedule`
- **Purpose:** Timezone-aware calendar plus selected-day booked cards, pagination, month/week/day controls and list switch.
- **Access:** Members receive authorized events; staff create and view assigned/institution events, athletes only their participation.
- **Opens:** `/events`, `/schedule`, `/schedule/:id`, `/schedule/new`
- **Opened from views:** `/analytics`, `/dashboard`, `/events`, `/schedule/:id`, `/schedule/new`
- **Embedded by:** Router.
- **Shell entry:** [App.vue](../../../apps/frontend/src/App.vue), [features/navigation/DashboardNav.vue](../../../apps/frontend/src/features/navigation/DashboardNav.vue)

## ScheduledEvents

- **Source:** [features/institution/ScheduledEvents.vue](../../../apps/frontend/src/features/institution/ScheduledEvents.vue)
- **Folder:** `features/institution`
- **URL(s):** `/events`
- **Purpose:** Paginated/searchable Schedule list for training events and assessments, paired with calendar mode.
- **Access:** Administrators institution-wide; coaches designated events; no unrestricted athlete event index.
- **Opens:** `/events`, `/schedule`, `/schedule/:id`, `/schedule/new`, `/workouts`
- **Opened from views:** `/schedule`
- **Embedded by:** Router.
- **Shell entry:** No direct shell item; use the workflow or entry described above.

## ServiceCatalog

- **Source:** [features/institution/ServiceCatalog.vue](../../../apps/frontend/src/features/institution/ServiceCatalog.vue)
- **Folder:** `features/institution`
- **URL(s):** `/assessment-templates`, `/assessment-templates/:editor`, `/groups`, `/groups/:editor`
- **Purpose:** Shared group and assessment-template library with distinct list/create/edit route modes.
- **Access:** Staff; server differentiates group and template commands and validates staff/participant scope.
- **Opens:** `/assessment-templates`, `/assessment-templates/:editor`, `/groups`, `/groups/:editor`, `/messages/:channel?`, `/schedule/new`
- **Opened from views:** `/schedule/new`
- **Embedded by:** Router.
- **Shell entry:** [App.vue](../../../apps/frontend/src/App.vue), [features/navigation/DashboardNav.vue](../../../apps/frontend/src/features/navigation/DashboardNav.vue)

## SessionHistory

- **Source:** [features/institution/SessionHistory.vue](../../../apps/frontend/src/features/institution/SessionHistory.vue)
- **Folder:** `features/institution`
- **URL(s):** `/workouts`
- **Purpose:** Searchable paginated recorded solo-workout history; separate from scheduled group events.
- **Access:** Administrators institution-wide, coaches training-authorized subjects, athletes own results where delivery permits.
- **Opens:** `/review/:id`, `/training`, `/workout/:id`
- **Opened from views:** `/dashboard`, `/events`, `/members/:member`, `/training`, `/training/:assignment`
- **Embedded by:** Router.
- **Shell entry:** [App.vue](../../../apps/frontend/src/App.vue), [features/navigation/DashboardNav.vue](../../../apps/frontend/src/features/navigation/DashboardNav.vue)

## SportsSettings

- **Source:** [features/institution/SportsSettings.vue](../../../apps/frontend/src/features/institution/SportsSettings.vue)
- **Folder:** `features/institution`
- **URL(s):** `/activity`, `/dashboard`, `/institution-settings`, `/people` Embedded screen; no independent route.
- **Purpose:** Institution sport and coaching-specialty taxonomy creation, editing and archival.
- **Access:** Administrator settings only; linked historical metadata is retained by server lifecycle rules.
- **Opens:** None; see entry/dynamic rules.
- **Opened from views:** `/`, `/access`, `/analytics`, `/dashboard`, `/help`, `/invitation/:token`, `/local-preview`, `/login`, `/members/:member`, `/notifications`, `/password-setup/:token`, `/setup`, `/support`
- **Embedded by:** `features/institution/DashboardPage.vue`
- **Shell entry:** [App.vue](../../../apps/frontend/src/App.vue), [features/navigation/DashboardNav.vue](../../../apps/frontend/src/features/navigation/DashboardNav.vue)

## TrainingRoute

- **Source:** [features/institution/TrainingRoute.vue](../../../apps/frontend/src/features/institution/TrainingRoute.vue)
- **Folder:** `features/institution`
- **URL(s):** `/training`
- **Purpose:** Role dispatcher to athlete training or staff athlete-plan index.
- **Access:** Institution members; athlete self screen versus authorized staff browse screen.
- **Opens:** `/plans`, `/record/:session`, `/review/:id`, `/training`, `/training/:assignment`, `/workout/:id`, `/workouts`
- **Opened from views:** `/analytics`, `/assessments/:member`, `/dashboard`, `/deliver/:id`, `/members/:member`, `/plans`, `/review/:id`, `/schedule/:id`, `/settings`, `/training/:assignment`, `/workout/:id`, `/workouts`
- **Embedded by:** Router.
- **Shell entry:** [App.vue](../../../apps/frontend/src/App.vue), [features/navigation/DashboardNav.vue](../../../apps/frontend/src/features/navigation/DashboardNav.vue)

## NotificationsPage

- **Source:** [features/notifications/NotificationsPage.vue](../../../apps/frontend/src/features/notifications/NotificationsPage.vue)
- **Folder:** `features/notifications`
- **URL(s):** `/notifications`
- **Purpose:** Authorized notification inbox, mark/read navigation and embedded preference editing.
- **Access:** Signed-in recipient only; API resolves and reauthorizes every destination.
- **Opens:** `/dashboard`, `/messages/:channel?`, `/schedule/:id`, `/workout/:id`
- **Opened from views:** None; see entry/dynamic rules.
- **Embedded by:** Router.
- **Shell entry:** [App.vue](../../../apps/frontend/src/App.vue)

## NutritionPage

- **Source:** [features/nutrition/NutritionPage.vue](../../../apps/frontend/src/features/nutrition/NutritionPage.vue)
- **Folder:** `features/nutrition`
- **URL(s):** `/nutrition` Embedded screen; no independent route.
- **Purpose:** Athlete nutrition detail, staff guidance authoring/publication, example meals, diary sharing, actual intake and version/history recovery.
- **Access:** Athlete own diary; administrator/primary coach guidance within scoped API rules. Supporting coaches do not acquire nutrition access merely through training links.
- **Opens:** `/nutrition`
- **Opened from views:** `/members/:member`, `/nutrition`
- **Embedded by:** `features/nutrition/NutritionRoute.vue`
- **Shell entry:** [App.vue](../../../apps/frontend/src/App.vue), [features/navigation/DashboardNav.vue](../../../apps/frontend/src/features/navigation/DashboardNav.vue)

## NutritionPlans

- **Source:** [features/nutrition/NutritionPlans.vue](../../../apps/frontend/src/features/nutrition/NutritionPlans.vue)
- **Folder:** `features/nutrition`
- **URL(s):** `/nutrition` Embedded screen; no independent route.
- **Purpose:** Browse-first paginated nutrition-guidance index and selected-athlete create/open actions.
- **Access:** Administrators and authorized primary coaches; summaries do not grant diary visibility.
- **Opens:** `/nutrition`
- **Opened from views:** `/members/:member`, `/nutrition`
- **Embedded by:** `features/nutrition/NutritionRoute.vue`
- **Shell entry:** [App.vue](../../../apps/frontend/src/App.vue), [features/navigation/DashboardNav.vue](../../../apps/frontend/src/features/navigation/DashboardNav.vue)

## NutritionRoute

- **Source:** [features/nutrition/NutritionRoute.vue](../../../apps/frontend/src/features/nutrition/NutritionRoute.vue)
- **Folder:** `features/nutrition`
- **URL(s):** `/nutrition`
- **Purpose:** Dispatch staff nutrition index versus own/selected-athlete detail using member/plan query state.
- **Access:** Current institution member; underlying detail and list endpoints separately enforce subject/diary permissions.
- **Opens:** `/nutrition`
- **Opened from views:** `/members/:member`
- **Embedded by:** Router.
- **Shell entry:** [App.vue](../../../apps/frontend/src/App.vue), [features/navigation/DashboardNav.vue](../../../apps/frontend/src/features/navigation/DashboardNav.vue)

## PlatformPage

- **Source:** [features/platform/PlatformPage.vue](../../../apps/frontend/src/features/platform/PlatformPage.vue)
- **Folder:** `features/platform`
- **URL(s):** `/platform`
- **Purpose:** Local operator support queue, retention/operation retry, diagnostics and authorized audit reads.
- **Access:** Separate platform-administrator grant; institutional administrator role alone is insufficient.
- **Opens:** None; see entry/dynamic rules.
- **Opened from views:** `/local-preview`
- **Embedded by:** Router.
- **Shell entry:** [App.vue](../../../apps/frontend/src/App.vue)

## NotFound

- **Source:** [features/public/NotFound.vue](../../../apps/frontend/src/features/public/NotFound.vue)
- **Folder:** `features/public`
- **URL(s):** `/:pathMatch(.*)*`
- **Purpose:** Ordinary missing-route state with root recovery action.
- **Access:** Public fallback; not a retired-feature landing page.
- **Opens:** `/`
- **Opened from views:** None; see entry/dynamic rules.
- **Embedded by:** Router.
- **Shell entry:** No direct shell item; use the workflow or entry described above.
- **Other entry:** Router fallback for unsupported and deleted URLs.

## PrivacyPage

- **Source:** [features/public/PrivacyPage.vue](../../../apps/frontend/src/features/public/PrivacyPage.vue)
- **Folder:** `features/public`
- **URL(s):** `/privacy`
- **Purpose:** Instance-local privacy statement and link to Help.
- **Access:** Public; deployment-specific legal acceptance remains the institution's responsibility.
- **Opens:** `/help`
- **Opened from views:** None; see entry/dynamic rules.
- **Embedded by:** Router.
- **Shell entry:** [App.vue](../../../apps/frontend/src/App.vue)

## ResourcesPage

- **Source:** [features/resources/ResourcesPage.vue](../../../apps/frontend/src/features/resources/ResourcesPage.vue)
- **Folder:** `features/resources`
- **URL(s):** `/resources`
- **Purpose:** One searchable institution upload/resource library with preview, archive and restore.
- **Access:** Authorized staff; ownership/scope controls mutation and every private-byte read is checked.
- **Opens:** None; see entry/dynamic rules.
- **Opened from views:** None; see entry/dynamic rules.
- **Embedded by:** Router.
- **Shell entry:** [App.vue](../../../apps/frontend/src/App.vue), [features/navigation/DashboardNav.vue](../../../apps/frontend/src/features/navigation/DashboardNav.vue)

## SupportPage

- **Source:** [features/support/SupportPage.vue](../../../apps/frontend/src/features/support/SupportPage.vue)
- **Folder:** `features/support`
- **URL(s):** `/support`
- **Purpose:** Local support request creation, own case history and resolve/reopen; no automatic external email.
- **Access:** Signed-in reporter sees own requests; separate authorized platform operators handle responses.
- **Opens:** `/dashboard`
- **Opened from views:** None; see entry/dynamic rules.
- **Embedded by:** Router.
- **Shell entry:** [App.vue](../../../apps/frontend/src/App.vue)

## WorkoutPage

- **Source:** [features/training/WorkoutPage.vue](../../../apps/frontend/src/features/training/WorkoutPage.vue)
- **Folder:** `features/training`
- **URL(s):** `/workout/:id`
- **Purpose:** Athlete's institutional workout recorder with measured actuals, local persistence, exact sync, conflict recovery and completion summary.
- **Access:** Signed-in institutional athlete owning the workout; server and local owner/workspace checks remain authoritative.
- **Opens:** `/feedback`, `/training`
- **Opened from views:** `/notifications`, `/training`, `/training/:assignment`, `/workouts`
- **Embedded by:** Router.
- **Shell entry:** No direct shell item; use the workflow or entry described above.
