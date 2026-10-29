# Frontend component catalog

Generated from maintained source and reviewed descriptions by `npm run frontend:inventory`. Do not edit this generated file; update the two inventory JSON files beside the script. Source audit, not rendered or security acceptance. See [scope and findings](README.md).

Every local Vue file is listed, including routed screens. Direct rendered consumers come from template tags and dynamic component bindings. Views using a component include transitive consumers. Shell components are inherited by every route; role/state conditions still apply. Third-party primitives are summarized in the audit scope rather than copied into this catalog.

## App

- **Source:** [App.vue](../../../apps/frontend/src/App.vue)
- **Kind:** Application shell.
- **Purpose:** Shell, theme initialization, global account utilities, responsive sidebar/drawer and RouterView.
- **Direct rendered consumers:** `main.ts` mounts the shell.
- **Views using it:** Application shell; available on every route, conditional on shell state.

## AppUpdates

- **Source:** [components/AppUpdates.vue](../../../apps/frontend/src/components/AppUpdates.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Service-worker update status and explicit check; postpones activation until existing tabs close.
- **Direct rendered consumers:** [features/account/HelpPage.vue](../../../apps/frontend/src/features/account/HelpPage.vue), [features/account/SettingsPage.vue](../../../apps/frontend/src/features/account/SettingsPage.vue)
- **Views using it:** `/help`, `/settings`

## AthleteSearch

- **Source:** [components/AthleteSearch.vue](../../../apps/frontend/src/components/AthleteSearch.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Shared bilingual athlete-name search input with a model binding.
- **Direct rendered consumers:** [features/institution/AthletePlans.vue](../../../apps/frontend/src/features/institution/AthletePlans.vue), [features/institution/SessionHistory.vue](../../../apps/frontend/src/features/institution/SessionHistory.vue), [features/nutrition/NutritionPlans.vue](../../../apps/frontend/src/features/nutrition/NutritionPlans.vue)
- **Views using it:** `/nutrition`, `/training`, `/workouts`

## CommandStatus

- **Source:** [components/CommandStatus.vue](../../../apps/frontend/src/components/CommandStatus.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Exact-command persistence, uncertain outcome, retry and rejection feedback.
- **Direct rendered consumers:** [features/coaching/DeliverPlan.vue](../../../apps/frontend/src/features/coaching/DeliverPlan.vue), [features/coaching/ExercisesPage.vue](../../../apps/frontend/src/features/coaching/ExercisesPage.vue), [features/coaching/PlanEditor.vue](../../../apps/frontend/src/features/coaching/PlanEditor.vue), [features/coaching/ReviewPage.vue](../../../apps/frontend/src/features/coaching/ReviewPage.vue), [features/coaching/WorkoutTemplateEditor.vue](../../../apps/frontend/src/features/coaching/WorkoutTemplateEditor.vue), [features/institution/AdminOverview.vue](../../../apps/frontend/src/features/institution/AdminOverview.vue), [features/institution/AssignedPlanPage.vue](../../../apps/frontend/src/features/institution/AssignedPlanPage.vue), [features/institution/ChannelEditor.vue](../../../apps/frontend/src/features/institution/ChannelEditor.vue), [features/institution/ChannelThread.vue](../../../apps/frontend/src/features/institution/ChannelThread.vue), [features/institution/ChannelsPage.vue](../../../apps/frontend/src/features/institution/ChannelsPage.vue), [features/institution/CoachDesk.vue](../../../apps/frontend/src/features/institution/CoachDesk.vue), [features/institution/CoachingTeam.vue](../../../apps/frontend/src/features/institution/CoachingTeam.vue), [features/institution/DashboardPage.vue](../../../apps/frontend/src/features/institution/DashboardPage.vue), [features/institution/DelegatedWorkout.vue](../../../apps/frontend/src/features/institution/DelegatedWorkout.vue), [features/institution/EventComposer.vue](../../../apps/frontend/src/features/institution/EventComposer.vue), [features/institution/EventDetail.vue](../../../apps/frontend/src/features/institution/EventDetail.vue), [features/institution/GroupWorkoutPanel.vue](../../../apps/frontend/src/features/institution/GroupWorkoutPanel.vue), [features/institution/MemberManagement.vue](../../../apps/frontend/src/features/institution/MemberManagement.vue), [features/institution/MemberSports.vue](../../../apps/frontend/src/features/institution/MemberSports.vue), [features/institution/RatingForm.vue](../../../apps/frontend/src/features/institution/RatingForm.vue), [features/institution/ServiceCatalog.vue](../../../apps/frontend/src/features/institution/ServiceCatalog.vue), [features/institution/SessionNote.vue](../../../apps/frontend/src/features/institution/SessionNote.vue), [features/institution/SportsSettings.vue](../../../apps/frontend/src/features/institution/SportsSettings.vue), [features/institution/WorkoutAgenda.vue](../../../apps/frontend/src/features/institution/WorkoutAgenda.vue), [features/institution/WorkoutRuleSettings.vue](../../../apps/frontend/src/features/institution/WorkoutRuleSettings.vue), [features/notifications/NotificationPreferences.vue](../../../apps/frontend/src/features/notifications/NotificationPreferences.vue), [features/nutrition/NutritionPage.vue](../../../apps/frontend/src/features/nutrition/NutritionPage.vue), [features/platform/PlatformPage.vue](../../../apps/frontend/src/features/platform/PlatformPage.vue), [features/resources/ResourcesPage.vue](../../../apps/frontend/src/features/resources/ResourcesPage.vue), [features/support/SupportPage.vue](../../../apps/frontend/src/features/support/SupportPage.vue)
- **Views using it:** `/activity`, `/assessment-templates`, `/assessment-templates/:editor`, `/dashboard`, `/deliver/:id`, `/exercises`, `/exercises/:editor`, `/feedback`, `/groups`, `/groups/:editor`, `/institution-settings`, `/members/:member`, `/messages/:channel?`, `/notifications`, `/nutrition`, `/people`, `/plans/:id`, `/platform`, `/record/:session`, `/resources`, `/review/:id`, `/schedule/:id`, `/schedule/new`, `/support`, `/training`, `/training/:assignment`, `/workout-templates/:id`

## EmptyState

- **Source:** [components/EmptyState.vue](../../../apps/frontend/src/components/EmptyState.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Shared icon-led empty/no-match state with optional action slot.
- **Direct rendered consumers:** [features/coaching/WorkoutFields.vue](../../../apps/frontend/src/features/coaching/WorkoutFields.vue), [features/coaching/WorkoutTemplatePicker.vue](../../../apps/frontend/src/features/coaching/WorkoutTemplatePicker.vue), [features/coaching/WorkoutTemplatesPage.vue](../../../apps/frontend/src/features/coaching/WorkoutTemplatesPage.vue), [features/institution/ServiceCatalog.vue](../../../apps/frontend/src/features/institution/ServiceCatalog.vue), [features/institution/WorkoutAgenda.vue](../../../apps/frontend/src/features/institution/WorkoutAgenda.vue), [features/resources/ResourcesPage.vue](../../../apps/frontend/src/features/resources/ResourcesPage.vue)
- **Views using it:** `/activity`, `/assessment-templates`, `/assessment-templates/:editor`, `/dashboard`, `/groups`, `/groups/:editor`, `/institution-settings`, `/people`, `/plans/:id`, `/resources`, `/schedule/:id`, `/schedule/new`, `/training`, `/training/:assignment`, `/workout-templates`, `/workout-templates/:id`

## ExerciseDemo

- **Source:** [components/ExerciseDemo.vue](../../../apps/frontend/src/components/ExerciseDemo.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Movement demonstration using authorized media or the maintained reference illustration/video.
- **Direct rendered consumers:** [features/coaching/ExercisesPage.vue](../../../apps/frontend/src/features/coaching/ExercisesPage.vue), [features/coaching/PlanEditor.vue](../../../apps/frontend/src/features/coaching/PlanEditor.vue), [features/training/WorkoutPage.vue](../../../apps/frontend/src/features/training/WorkoutPage.vue)
- **Views using it:** `/exercises`, `/exercises/:editor`, `/plans/:id`, `/training/:assignment`, `/workout/:id`

## ExercisePicker

- **Source:** [components/ExercisePicker.vue](../../../apps/frontend/src/components/ExercisePicker.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Searchable exercise library popup with equipment/body-area filters and stable selection.
- **Direct rendered consumers:** [features/coaching/PlanEditor.vue](../../../apps/frontend/src/features/coaching/PlanEditor.vue), [features/coaching/WorkoutFields.vue](../../../apps/frontend/src/features/coaching/WorkoutFields.vue)
- **Views using it:** `/plans/:id`, `/schedule/:id`, `/training/:assignment`, `/workout-templates/:id`

## ExerciseVideo

- **Source:** [components/ExerciseVideo.vue](../../../apps/frontend/src/components/ExerciseVideo.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Accessible motion playback with pause, loading/error recovery and reduced-motion handling.
- **Direct rendered consumers:** [components/ExerciseDemo.vue](../../../apps/frontend/src/components/ExerciseDemo.vue)
- **Views using it:** `/exercises`, `/exercises/:editor`, `/plans/:id`, `/training/:assignment`, `/workout/:id`

## FileDropzone

- **Source:** [components/FileDropzone.vue](../../../apps/frontend/src/components/FileDropzone.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Shared file-selection/drop surface; emits chosen files while the caller owns validation and upload.
- **Direct rendered consumers:** [components/ResourceUpload.vue](../../../apps/frontend/src/components/ResourceUpload.vue), [features/institution/BrandingSettings.vue](../../../apps/frontend/src/features/institution/BrandingSettings.vue)
- **Views using it:** `/activity`, `/dashboard`, `/exercises`, `/exercises/:editor`, `/institution-settings`, `/messages/:channel?`, `/people`, `/resources`

## ListPagination

- **Source:** [components/ListPagination.vue](../../../apps/frontend/src/components/ListPagination.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Record totals, page actions and bounded records-per-page selection.
- **Direct rendered consumers:** [features/coaching/ExercisesPage.vue](../../../apps/frontend/src/features/coaching/ExercisesPage.vue), [features/coaching/PlansPage.vue](../../../apps/frontend/src/features/coaching/PlansPage.vue), [features/coaching/WorkoutTemplatePicker.vue](../../../apps/frontend/src/features/coaching/WorkoutTemplatePicker.vue), [features/coaching/WorkoutTemplatesPage.vue](../../../apps/frontend/src/features/coaching/WorkoutTemplatesPage.vue), [features/institution/AthletePlans.vue](../../../apps/frontend/src/features/institution/AthletePlans.vue), [features/institution/DashboardPage.vue](../../../apps/frontend/src/features/institution/DashboardPage.vue), [features/institution/GroupWorkoutPanel.vue](../../../apps/frontend/src/features/institution/GroupWorkoutPanel.vue), [features/institution/ScheduleCalendar.vue](../../../apps/frontend/src/features/institution/ScheduleCalendar.vue), [features/institution/ScheduledEvents.vue](../../../apps/frontend/src/features/institution/ScheduledEvents.vue), [features/institution/ServiceCatalog.vue](../../../apps/frontend/src/features/institution/ServiceCatalog.vue), [features/institution/SessionHistory.vue](../../../apps/frontend/src/features/institution/SessionHistory.vue), [features/institution/WorkoutAgenda.vue](../../../apps/frontend/src/features/institution/WorkoutAgenda.vue), [features/nutrition/NutritionPlans.vue](../../../apps/frontend/src/features/nutrition/NutritionPlans.vue)
- **Views using it:** `/activity`, `/assessment-templates`, `/assessment-templates/:editor`, `/dashboard`, `/events`, `/exercises`, `/exercises/:editor`, `/groups`, `/groups/:editor`, `/institution-settings`, `/nutrition`, `/people`, `/plans`, `/plans/:id`, `/schedule`, `/schedule/:id`, `/schedule/new`, `/training`, `/training/:assignment`, `/workout-templates`, `/workouts`

## MonthCalendar

- **Source:** [components/MonthCalendar.vue](../../../apps/frontend/src/components/MonthCalendar.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Keyboard-operable month grid and selected-date emission.
- **Direct rendered consumers:** [features/institution/ScheduleCalendar.vue](../../../apps/frontend/src/features/institution/ScheduleCalendar.vue)
- **Views using it:** `/schedule`

## MultiChoice

- **Source:** [components/MultiChoice.vue](../../../apps/frontend/src/components/MultiChoice.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Reusable searchable multi-select with selected items and clearing.
- **Direct rendered consumers:** [features/coaching/ExercisesPage.vue](../../../apps/frontend/src/features/coaching/ExercisesPage.vue)
- **Views using it:** `/exercises`, `/exercises/:editor`

## OverflowMenu

- **Source:** [components/OverflowMenu.vue](../../../apps/frontend/src/components/OverflowMenu.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Labelled menu for secondary or destructive record actions and the coach New menu; items navigate or emit a key while the caller owns the action.
- **Direct rendered consumers:** [features/institution/AssignedPlanPage.vue](../../../apps/frontend/src/features/institution/AssignedPlanPage.vue), [features/institution/AthletePlans.vue](../../../apps/frontend/src/features/institution/AthletePlans.vue), [features/institution/AthleteProfile.vue](../../../apps/frontend/src/features/institution/AthleteProfile.vue), [features/institution/DashboardPage.vue](../../../apps/frontend/src/features/institution/DashboardPage.vue), [features/institution/EventDetail.vue](../../../apps/frontend/src/features/institution/EventDetail.vue), [features/institution/WorkoutAgenda.vue](../../../apps/frontend/src/features/institution/WorkoutAgenda.vue)
- **Views using it:** `/activity`, `/dashboard`, `/institution-settings`, `/members/:member`, `/people`, `/schedule/:id`, `/schedule/new`, `/training`, `/training/:assignment`

## PageHeading

- **Source:** [components/PageHeading.vue](../../../apps/frontend/src/components/PageHeading.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Semantic page-heading layout and action slots.
- **Direct rendered consumers:** [features/account/LocalPreview.vue](../../../apps/frontend/src/features/account/LocalPreview.vue), [features/account/SettingsPage.vue](../../../apps/frontend/src/features/account/SettingsPage.vue), [features/analytics/AnalyticsPage.vue](../../../apps/frontend/src/features/analytics/AnalyticsPage.vue), [features/coaching/DeliverPlan.vue](../../../apps/frontend/src/features/coaching/DeliverPlan.vue), [features/coaching/ExercisesPage.vue](../../../apps/frontend/src/features/coaching/ExercisesPage.vue), [features/coaching/PlanEditor.vue](../../../apps/frontend/src/features/coaching/PlanEditor.vue), [features/coaching/PlansPage.vue](../../../apps/frontend/src/features/coaching/PlansPage.vue), [features/coaching/ReviewPage.vue](../../../apps/frontend/src/features/coaching/ReviewPage.vue), [features/coaching/WorkoutTemplateEditor.vue](../../../apps/frontend/src/features/coaching/WorkoutTemplateEditor.vue), [features/coaching/WorkoutTemplatesPage.vue](../../../apps/frontend/src/features/coaching/WorkoutTemplatesPage.vue), [features/institution/AssessmentHistory.vue](../../../apps/frontend/src/features/institution/AssessmentHistory.vue), [features/institution/AssignedPlanPage.vue](../../../apps/frontend/src/features/institution/AssignedPlanPage.vue), [features/institution/AthletePlans.vue](../../../apps/frontend/src/features/institution/AthletePlans.vue), [features/institution/AthleteProfile.vue](../../../apps/frontend/src/features/institution/AthleteProfile.vue), [features/institution/DashboardPage.vue](../../../apps/frontend/src/features/institution/DashboardPage.vue), [features/institution/DelegatedWorkout.vue](../../../apps/frontend/src/features/institution/DelegatedWorkout.vue), [features/institution/EventComposer.vue](../../../apps/frontend/src/features/institution/EventComposer.vue), [features/institution/EventDetail.vue](../../../apps/frontend/src/features/institution/EventDetail.vue), [features/institution/FeedbackPage.vue](../../../apps/frontend/src/features/institution/FeedbackPage.vue), [features/institution/InjuryStatus.vue](../../../apps/frontend/src/features/institution/InjuryStatus.vue), [features/institution/ScheduleCalendar.vue](../../../apps/frontend/src/features/institution/ScheduleCalendar.vue), [features/institution/ScheduledEvents.vue](../../../apps/frontend/src/features/institution/ScheduledEvents.vue), [features/institution/ServiceCatalog.vue](../../../apps/frontend/src/features/institution/ServiceCatalog.vue), [features/institution/SessionHistory.vue](../../../apps/frontend/src/features/institution/SessionHistory.vue), [features/notifications/NotificationsPage.vue](../../../apps/frontend/src/features/notifications/NotificationsPage.vue), [features/nutrition/NutritionPage.vue](../../../apps/frontend/src/features/nutrition/NutritionPage.vue), [features/nutrition/NutritionPlans.vue](../../../apps/frontend/src/features/nutrition/NutritionPlans.vue), [features/platform/PlatformPage.vue](../../../apps/frontend/src/features/platform/PlatformPage.vue), [features/resources/ResourcesPage.vue](../../../apps/frontend/src/features/resources/ResourcesPage.vue), [features/support/SupportPage.vue](../../../apps/frontend/src/features/support/SupportPage.vue)
- **Views using it:** `/activity`, `/analytics`, `/assessment-templates`, `/assessment-templates/:editor`, `/assessments/:member`, `/dashboard`, `/deliver/:id`, `/events`, `/exercises`, `/exercises/:editor`, `/feedback`, `/groups`, `/groups/:editor`, `/injuries`, `/institution-settings`, `/local-preview`, `/members/:member`, `/notifications`, `/nutrition`, `/people`, `/plans`, `/plans/:id`, `/platform`, `/record/:session`, `/resources`, `/review/:id`, `/schedule`, `/schedule/:id`, `/schedule/new`, `/settings`, `/support`, `/training`, `/training/:assignment`, `/workout-templates`, `/workout-templates/:id`, `/workouts`

## PageState

- **Source:** [components/PageState.vue](../../../apps/frontend/src/components/PageState.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Loading/error/retry wrapper that retains responsibility for data in its parent.
- **Direct rendered consumers:** [features/analytics/AnalyticsPage.vue](../../../apps/frontend/src/features/analytics/AnalyticsPage.vue), [features/coaching/DeliverPlan.vue](../../../apps/frontend/src/features/coaching/DeliverPlan.vue), [features/coaching/ExercisesPage.vue](../../../apps/frontend/src/features/coaching/ExercisesPage.vue), [features/coaching/PlanEditor.vue](../../../apps/frontend/src/features/coaching/PlanEditor.vue), [features/coaching/PlansPage.vue](../../../apps/frontend/src/features/coaching/PlansPage.vue), [features/coaching/ReviewPage.vue](../../../apps/frontend/src/features/coaching/ReviewPage.vue), [features/coaching/WorkoutTemplateEditor.vue](../../../apps/frontend/src/features/coaching/WorkoutTemplateEditor.vue), [features/coaching/WorkoutTemplatePicker.vue](../../../apps/frontend/src/features/coaching/WorkoutTemplatePicker.vue), [features/coaching/WorkoutTemplatesPage.vue](../../../apps/frontend/src/features/coaching/WorkoutTemplatesPage.vue), [features/institution/AdminOverview.vue](../../../apps/frontend/src/features/institution/AdminOverview.vue), [features/institution/AssessmentHistory.vue](../../../apps/frontend/src/features/institution/AssessmentHistory.vue), [features/institution/AssignedPlanPage.vue](../../../apps/frontend/src/features/institution/AssignedPlanPage.vue), [features/institution/AthleteDay.vue](../../../apps/frontend/src/features/institution/AthleteDay.vue), [features/institution/AthletePlans.vue](../../../apps/frontend/src/features/institution/AthletePlans.vue), [features/institution/ChannelEditor.vue](../../../apps/frontend/src/features/institution/ChannelEditor.vue), [features/institution/DashboardPage.vue](../../../apps/frontend/src/features/institution/DashboardPage.vue), [features/institution/EventComposer.vue](../../../apps/frontend/src/features/institution/EventComposer.vue), [features/institution/EventDetail.vue](../../../apps/frontend/src/features/institution/EventDetail.vue), [features/institution/GroupWorkoutPanel.vue](../../../apps/frontend/src/features/institution/GroupWorkoutPanel.vue), [features/institution/ScheduleCalendar.vue](../../../apps/frontend/src/features/institution/ScheduleCalendar.vue), [features/institution/ScheduledEvents.vue](../../../apps/frontend/src/features/institution/ScheduledEvents.vue), [features/institution/ServiceCatalog.vue](../../../apps/frontend/src/features/institution/ServiceCatalog.vue), [features/institution/SessionHistory.vue](../../../apps/frontend/src/features/institution/SessionHistory.vue), [features/institution/WorkoutAgenda.vue](../../../apps/frontend/src/features/institution/WorkoutAgenda.vue), [features/institution/WorkoutRuleSettings.vue](../../../apps/frontend/src/features/institution/WorkoutRuleSettings.vue), [features/notifications/NotificationPreferences.vue](../../../apps/frontend/src/features/notifications/NotificationPreferences.vue), [features/notifications/NotificationsPage.vue](../../../apps/frontend/src/features/notifications/NotificationsPage.vue), [features/nutrition/NutritionPage.vue](../../../apps/frontend/src/features/nutrition/NutritionPage.vue), [features/nutrition/NutritionPlans.vue](../../../apps/frontend/src/features/nutrition/NutritionPlans.vue), [features/platform/PlatformPage.vue](../../../apps/frontend/src/features/platform/PlatformPage.vue), [features/support/SupportPage.vue](../../../apps/frontend/src/features/support/SupportPage.vue), [features/training/WorkoutPage.vue](../../../apps/frontend/src/features/training/WorkoutPage.vue)
- **Views using it:** `/activity`, `/analytics`, `/assessment-templates`, `/assessment-templates/:editor`, `/assessments/:member`, `/dashboard`, `/deliver/:id`, `/events`, `/exercises`, `/exercises/:editor`, `/groups`, `/groups/:editor`, `/institution-settings`, `/messages/:channel?`, `/notifications`, `/nutrition`, `/people`, `/plans`, `/plans/:id`, `/platform`, `/review/:id`, `/schedule`, `/schedule/:id`, `/schedule/new`, `/support`, `/training`, `/training/:assignment`, `/workout-templates`, `/workout-templates/:id`, `/workout/:id`, `/workouts`

## PasswordField

- **Source:** [components/PasswordField.vue](../../../apps/frontend/src/components/PasswordField.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Password input with an accessible show/hide action.
- **Direct rendered consumers:** [features/account/LoginPage.vue](../../../apps/frontend/src/features/account/LoginPage.vue), [features/account/PasswordSetupPage.vue](../../../apps/frontend/src/features/account/PasswordSetupPage.vue), [features/account/SetupPage.vue](../../../apps/frontend/src/features/account/SetupPage.vue), [features/institution/InvitationPage.vue](../../../apps/frontend/src/features/institution/InvitationPage.vue)
- **Views using it:** `/invitation/:token`, `/login`, `/password-setup/:token`, `/setup`

## ResourceAsset

- **Source:** [components/ResourceAsset.vue](../../../apps/frontend/src/components/ResourceAsset.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Authorized private-media preview/download with object-URL lifecycle cleanup.
- **Direct rendered consumers:** [components/ExerciseDemo.vue](../../../apps/frontend/src/components/ExerciseDemo.vue), [features/institution/ChannelThread.vue](../../../apps/frontend/src/features/institution/ChannelThread.vue), [features/resources/ResourcesPage.vue](../../../apps/frontend/src/features/resources/ResourcesPage.vue)
- **Views using it:** `/exercises`, `/exercises/:editor`, `/messages/:channel?`, `/plans/:id`, `/resources`, `/training/:assignment`, `/workout/:id`

## ResourceUpload

- **Source:** [components/ResourceUpload.vue](../../../apps/frontend/src/components/ResourceUpload.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Institution-file upload, including batch composer mode and exact uncertain-upload retry.
- **Direct rendered consumers:** [features/coaching/ExercisesPage.vue](../../../apps/frontend/src/features/coaching/ExercisesPage.vue), [features/institution/ChannelThread.vue](../../../apps/frontend/src/features/institution/ChannelThread.vue), [features/resources/ResourcesPage.vue](../../../apps/frontend/src/features/resources/ResourcesPage.vue)
- **Views using it:** `/exercises`, `/exercises/:editor`, `/messages/:channel?`, `/resources`

## ScheduleViewSwitch

- **Source:** [components/ScheduleViewSwitch.vue](../../../apps/frontend/src/components/ScheduleViewSwitch.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Calendar/list route switch preserving query state with a short transition.
- **Direct rendered consumers:** [features/institution/ScheduleCalendar.vue](../../../apps/frontend/src/features/institution/ScheduleCalendar.vue), [features/institution/ScheduledEvents.vue](../../../apps/frontend/src/features/institution/ScheduledEvents.vue)
- **Views using it:** `/events`, `/schedule`

## SectionHeader

- **Source:** [components/SectionHeader.vue](../../../apps/frontend/src/components/SectionHeader.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Shared section heading, description and action grouping.
- **Direct rendered consumers:** [features/institution/CoachingTeam.vue](../../../apps/frontend/src/features/institution/CoachingTeam.vue), [features/institution/MemberManagement.vue](../../../apps/frontend/src/features/institution/MemberManagement.vue), [features/institution/SportsSettings.vue](../../../apps/frontend/src/features/institution/SportsSettings.vue)
- **Views using it:** `/activity`, `/dashboard`, `/institution-settings`, `/members/:member`, `/people`

## SidePanel

- **Source:** [components/SidePanel.vue](../../../apps/frontend/src/components/SidePanel.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Contextual side panel dialog for in-place tasks (scheduling, record history) with locked dismissal during writes and explicit focus return.
- **Direct rendered consumers:** [features/coaching/PlanEditor.vue](../../../apps/frontend/src/features/coaching/PlanEditor.vue), [features/institution/DelegatedWorkout.vue](../../../apps/frontend/src/features/institution/DelegatedWorkout.vue), [features/institution/EventDetail.vue](../../../apps/frontend/src/features/institution/EventDetail.vue), [features/institution/GroupWorkoutPanel.vue](../../../apps/frontend/src/features/institution/GroupWorkoutPanel.vue), [features/institution/WorkoutAgenda.vue](../../../apps/frontend/src/features/institution/WorkoutAgenda.vue)
- **Views using it:** `/activity`, `/dashboard`, `/institution-settings`, `/people`, `/plans/:id`, `/record/:session`, `/schedule/:id`, `/schedule/new`, `/training`, `/training/:assignment`

## TimezoneClock

- **Source:** [components/TimezoneClock.vue](../../../apps/frontend/src/components/TimezoneClock.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Account-timezone digital clock linking to settings, shown in the desktop header and phone navigation menu.
- **Direct rendered consumers:** [App.vue](../../../apps/frontend/src/App.vue)
- **Views using it:** Application shell; available on every route, conditional on shell state.

## TimezonePicker

- **Source:** [components/TimezonePicker.vue](../../../apps/frontend/src/components/TimezonePicker.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Searchable IANA timezone selection.
- **Direct rendered consumers:** [features/account/SettingsPage.vue](../../../apps/frontend/src/features/account/SettingsPage.vue), [features/coaching/DeliverPlan.vue](../../../apps/frontend/src/features/coaching/DeliverPlan.vue), [features/institution/EventComposer.vue](../../../apps/frontend/src/features/institution/EventComposer.vue), [features/institution/EventDetail.vue](../../../apps/frontend/src/features/institution/EventDetail.vue), [features/institution/WorkoutAgenda.vue](../../../apps/frontend/src/features/institution/WorkoutAgenda.vue), [features/institution/WorkoutRuleSettings.vue](../../../apps/frontend/src/features/institution/WorkoutRuleSettings.vue)
- **Views using it:** `/activity`, `/dashboard`, `/deliver/:id`, `/institution-settings`, `/people`, `/schedule/:id`, `/schedule/new`, `/settings`, `/training`, `/training/:assignment`

## AccessPage

- **Source:** [features/account/AccessPage.vue](../../../apps/frontend/src/features/account/AccessPage.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Membership/connection recovery with explicit refresh and sign-out.
- **Direct rendered consumers:** Router.
- **Views using it:** `/access`

## EntryPage

- **Source:** [features/account/EntryPage.vue](../../../apps/frontend/src/features/account/EntryPage.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Dispatch root to first-run setup, sign-in or the current institution dashboard.
- **Direct rendered consumers:** Router.
- **Views using it:** `/`

## HelpPage

- **Source:** [features/account/HelpPage.vue](../../../apps/frontend/src/features/account/HelpPage.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Institution workflow help, scope/privacy explanation and reference-media credits.
- **Direct rendered consumers:** Router.
- **Views using it:** `/help`

## LocalPreview

- **Source:** [features/account/LocalPreview.vue](../../../apps/frontend/src/features/account/LocalPreview.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Synthetic administrator/coach/athlete/operator entry for explicitly enabled local development.
- **Direct rendered consumers:** Router.
- **Views using it:** `/local-preview`

## LoginPage

- **Source:** [features/account/LoginPage.vue](../../../apps/frontend/src/features/account/LoginPage.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Password sign-in with safe next-path handling and current-context redirect.
- **Direct rendered consumers:** Router.
- **Views using it:** `/login`

## PasswordSetupPage

- **Source:** [features/account/PasswordSetupPage.vue](../../../apps/frontend/src/features/account/PasswordSetupPage.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Choose a password through an administrator-issued expiring single-use reset/setup token.
- **Direct rendered consumers:** Router.
- **Views using it:** `/password-setup/:token`

## SettingsPage

- **Source:** [features/account/SettingsPage.vue](../../../apps/frontend/src/features/account/SettingsPage.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Own profile/preferences, session diagnostics, updates, export, sign-out and account-deletion recovery.
- **Direct rendered consumers:** Router.
- **Views using it:** `/settings`

## SetupPage

- **Source:** [features/account/SetupPage.vue](../../../apps/frontend/src/features/account/SetupPage.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** First-run institution and initial super-admin creation.
- **Direct rendered consumers:** Router.
- **Views using it:** `/setup`

## AnalyticsPage

- **Source:** [features/analytics/AnalyticsPage.vue](../../../apps/frontend/src/features/analytics/AnalyticsPage.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Institution/coaching analytics with activity, delivery and experience tabs and scoped filters.
- **Direct rendered consumers:** Router.
- **Views using it:** `/analytics`

## ExperienceReport

- **Source:** [features/analytics/ExperienceReport.vue](../../../apps/frontend/src/features/analytics/ExperienceReport.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Separately labelled athlete session experience and coach workplace satisfaction summaries.
- **Direct rendered consumers:** [features/analytics/AnalyticsPage.vue](../../../apps/frontend/src/features/analytics/AnalyticsPage.vue)
- **Views using it:** `/analytics`

## MetricChart

- **Source:** [features/analytics/MetricChart.vue](../../../apps/frontend/src/features/analytics/MetricChart.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Responsive metrics chart with tooltip, table equivalent and optional server-authorized record links.
- **Direct rendered consumers:** [features/analytics/AnalyticsPage.vue](../../../apps/frontend/src/features/analytics/AnalyticsPage.vue), [features/analytics/ExperienceReport.vue](../../../apps/frontend/src/features/analytics/ExperienceReport.vue), [features/analytics/TrainerDelivery.vue](../../../apps/frontend/src/features/analytics/TrainerDelivery.vue), [features/institution/AdminOverview.vue](../../../apps/frontend/src/features/institution/AdminOverview.vue), [features/institution/AssessmentHistory.vue](../../../apps/frontend/src/features/institution/AssessmentHistory.vue)
- **Views using it:** `/activity`, `/analytics`, `/assessments/:member`, `/dashboard`, `/institution-settings`, `/people`

## TrainerDelivery

- **Source:** [features/analytics/TrainerDelivery.vue](../../../apps/frontend/src/features/analytics/TrainerDelivery.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Coach workload/delivery comparisons with labelled activity measures.
- **Direct rendered consumers:** [features/analytics/AnalyticsPage.vue](../../../apps/frontend/src/features/analytics/AnalyticsPage.vue)
- **Views using it:** `/analytics`

## DeliverPlan

- **Source:** [features/coaching/DeliverPlan.vue](../../../apps/frontend/src/features/coaching/DeliverPlan.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Published-program assignment, athlete selection, concurrent-plan conflict review and replacement choices.
- **Direct rendered consumers:** Router.
- **Views using it:** `/deliver/:id`

## ExercisesPage

- **Source:** [features/coaching/ExercisesPage.vue](../../../apps/frontend/src/features/coaching/ExercisesPage.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Exercise library discovery plus dedicated new/edit route modes, taxonomy and private-media authoring.
- **Direct rendered consumers:** Router.
- **Views using it:** `/exercises`, `/exercises/:editor`

## PlanEditor

- **Source:** [features/coaching/PlanEditor.vue](../../../apps/frontend/src/features/coaching/PlanEditor.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Program draft editor and immutable-version preview, prescription structure, cover, publication and assignment links.
- **Direct rendered consumers:** [features/institution/AssignedPlanPage.vue](../../../apps/frontend/src/features/institution/AssignedPlanPage.vue)
- **Views using it:** `/plans/:id`, `/training/:assignment`

## PlansPage

- **Source:** [features/coaching/PlansPage.vue](../../../apps/frontend/src/features/coaching/PlansPage.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Paginated/searchable program library and entry to create, preview or edit.
- **Direct rendered consumers:** Router.
- **Views using it:** `/plans`

## PrescriptionFields

- **Source:** [features/coaching/PrescriptionFields.vue](../../../apps/frontend/src/features/coaching/PrescriptionFields.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Measurement-aware sets, reps, load, duration, distance, effort and per-set prescription controls.
- **Direct rendered consumers:** [features/coaching/PlanEditor.vue](../../../apps/frontend/src/features/coaching/PlanEditor.vue), [features/coaching/WorkoutFields.vue](../../../apps/frontend/src/features/coaching/WorkoutFields.vue)
- **Views using it:** `/plans/:id`, `/schedule/:id`, `/training/:assignment`, `/workout-templates/:id`

## ProgramCover

- **Source:** [features/coaching/ProgramCover.vue](../../../apps/frontend/src/features/coaching/ProgramCover.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Published program-cover image with unavailable-image fallback, lazy loading and reset when the ID changes.
- **Direct rendered consumers:** [features/coaching/PlanEditor.vue](../../../apps/frontend/src/features/coaching/PlanEditor.vue), [features/coaching/PlansPage.vue](../../../apps/frontend/src/features/coaching/PlansPage.vue), [features/institution/WorkoutAgenda.vue](../../../apps/frontend/src/features/institution/WorkoutAgenda.vue)
- **Views using it:** `/activity`, `/dashboard`, `/institution-settings`, `/people`, `/plans`, `/plans/:id`, `/schedule/new`, `/training`, `/training/:assignment`

## ReviewPage

- **Source:** [features/coaching/ReviewPage.vue](../../../apps/frontend/src/features/coaching/ReviewPage.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Recorded-workout review, actual results, correction/version information and coach feedback.
- **Direct rendered consumers:** Router.
- **Views using it:** `/review/:id`

## WorkoutFields

- **Source:** [features/coaching/WorkoutFields.vue](../../../apps/frontend/src/features/coaching/WorkoutFields.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Shared single-workout prescription authoring: exercise picker, measured targets, notes and ordering.
- **Direct rendered consumers:** [features/coaching/WorkoutTemplateEditor.vue](../../../apps/frontend/src/features/coaching/WorkoutTemplateEditor.vue), [features/institution/GroupWorkoutPanel.vue](../../../apps/frontend/src/features/institution/GroupWorkoutPanel.vue)
- **Views using it:** `/schedule/:id`, `/workout-templates/:id`

## WorkoutPreview

- **Source:** [features/coaching/WorkoutPreview.vue](../../../apps/frontend/src/features/coaching/WorkoutPreview.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Read-only prescribed workout preview; no inferred readiness/load claims.
- **Direct rendered consumers:** [features/coaching/WorkoutTemplateEditor.vue](../../../apps/frontend/src/features/coaching/WorkoutTemplateEditor.vue), [features/institution/GroupWorkoutPanel.vue](../../../apps/frontend/src/features/institution/GroupWorkoutPanel.vue)
- **Views using it:** `/schedule/:id`, `/workout-templates/:id`

## WorkoutTemplateEditor

- **Source:** [features/coaching/WorkoutTemplateEditor.vue](../../../apps/frontend/src/features/coaching/WorkoutTemplateEditor.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Scoped recoverable single-workout editor and readonly preview, exact save/archive and independent imports.
- **Direct rendered consumers:** Router.
- **Views using it:** `/workout-templates/:id`

## WorkoutTemplatePicker

- **Source:** [features/coaching/WorkoutTemplatePicker.vue](../../../apps/frontend/src/features/coaching/WorkoutTemplatePicker.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Searchable paginated shared workout selection with retained identity and stale-revision warning.
- **Direct rendered consumers:** [features/coaching/PlanEditor.vue](../../../apps/frontend/src/features/coaching/PlanEditor.vue), [features/institution/EventComposer.vue](../../../apps/frontend/src/features/institution/EventComposer.vue)
- **Views using it:** `/plans/:id`, `/schedule/new`, `/training/:assignment`

## WorkoutTemplatesPage

- **Source:** [features/coaching/WorkoutTemplatesPage.vue](../../../apps/frontend/src/features/coaching/WorkoutTemplatesPage.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Institution-shared workout library, archive filter and dedicated create/preview/edit entry.
- **Direct rendered consumers:** Router.
- **Views using it:** `/workout-templates`

## ActivityLog

- **Source:** [features/institution/ActivityLog.vue](../../../apps/frontend/src/features/institution/ActivityLog.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Administrator activity log: institution audit events in plain words, grouped by day, with acting and affected member names. Administrators only.
- **Direct rendered consumers:** [features/institution/DashboardPage.vue](../../../apps/frontend/src/features/institution/DashboardPage.vue)
- **Views using it:** `/activity`, `/dashboard`, `/institution-settings`, `/people`

## AdminOverview

- **Source:** [features/institution/AdminOverview.vue](../../../apps/frontend/src/features/institution/AdminOverview.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Administrator overview: existing institution activity/attendance reporting, current roster coverage and operational navigation. No clinical data.
- **Direct rendered consumers:** [features/institution/DashboardPage.vue](../../../apps/frontend/src/features/institution/DashboardPage.vue)
- **Views using it:** `/activity`, `/dashboard`, `/institution-settings`, `/people`

## AssessmentHistory

- **Source:** [features/institution/AssessmentHistory.vue](../../../apps/frontend/src/features/institution/AssessmentHistory.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Athlete assessment result history with comparable drill charts and versioned results.
- **Direct rendered consumers:** Router.
- **Views using it:** `/assessments/:member`

## AssignedPlanPage

- **Source:** [features/institution/AssignedPlanPage.vue](../../../apps/frontend/src/features/institution/AssignedPlanPage.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Dedicated assigned-plan review, scoped workout scheduling and adaptation from the assigned immutable snapshot using the shared editor.
- **Direct rendered consumers:** Router.
- **Views using it:** `/training/:assignment`

## AthleteDay

- **Source:** [features/institution/AthleteDay.vue](../../../apps/frontend/src/features/institution/AthleteDay.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Athlete daily dashboard: own workout agenda, upcoming events, food-diary entry and assigned coach messaging.
- **Direct rendered consumers:** [features/institution/DashboardPage.vue](../../../apps/frontend/src/features/institution/DashboardPage.vue)
- **Views using it:** `/activity`, `/dashboard`, `/institution-settings`, `/people`

## AthletePlans

- **Source:** [features/institution/AthletePlans.vue](../../../apps/frontend/src/features/institution/AthletePlans.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Paginated staff assignment directory with dedicated detail routes; no embedded editor/detail below filters.
- **Direct rendered consumers:** [features/institution/TrainingRoute.vue](../../../apps/frontend/src/features/institution/TrainingRoute.vue)
- **Views using it:** `/training`

## AthleteProfile

- **Source:** [features/institution/AthleteProfile.vue](../../../apps/frontend/src/features/institution/AthleteProfile.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Person profile with real overview/plans/workouts/assessments/nutrition/participation/manage tabs according to subject role.
- **Direct rendered consumers:** Router.
- **Views using it:** `/members/:member`

## AthleteTraining

- **Source:** [features/institution/AthleteTraining.vue](../../../apps/frontend/src/features/institution/AthleteTraining.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Athlete next-workout agenda and access to unsynced device records; no arbitrary plan-day chooser.
- **Direct rendered consumers:** [features/institution/TrainingRoute.vue](../../../apps/frontend/src/features/institution/TrainingRoute.vue)
- **Views using it:** `/training`

## BrandingSettings

- **Source:** [features/institution/BrandingSettings.vue](../../../apps/frontend/src/features/institution/BrandingSettings.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Instance name, accent, theme backgrounds and logo editing with authorized capability check.
- **Direct rendered consumers:** [features/institution/DashboardPage.vue](../../../apps/frontend/src/features/institution/DashboardPage.vue)
- **Views using it:** `/activity`, `/dashboard`, `/institution-settings`, `/people`

## ChannelEditor

- **Source:** [features/institution/ChannelEditor.vue](../../../apps/frontend/src/features/institution/ChannelEditor.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Conversation participant/group editing with authorized roster selection.
- **Direct rendered consumers:** [features/institution/ChannelThread.vue](../../../apps/frontend/src/features/institution/ChannelThread.vue)
- **Views using it:** `/messages/:channel?`

## ChannelThread

- **Source:** [features/institution/ChannelThread.vue](../../../apps/frontend/src/features/institution/ChannelThread.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Message timeline, pagination, per-thread draft, attachment staging, send and participant controls.
- **Direct rendered consumers:** [features/institution/ChannelsPage.vue](../../../apps/frontend/src/features/institution/ChannelsPage.vue)
- **Views using it:** `/messages/:channel?`

## ChannelsPage

- **Source:** [features/institution/ChannelsPage.vue](../../../apps/frontend/src/features/institution/ChannelsPage.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Conversation directory, unified people/thread search and selection without a separate start page.
- **Direct rendered consumers:** Router.
- **Views using it:** `/messages/:channel?`

## CoachDesk

- **Source:** [features/institution/CoachDesk.vue](../../../apps/frontend/src/features/institution/CoachDesk.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Balanced coach dashboard: disjoint recording/due/planning queues, today events, limited primary-roster participation status and compact follow-up.
- **Direct rendered consumers:** [features/institution/DashboardPage.vue](../../../apps/frontend/src/features/institution/DashboardPage.vue)
- **Views using it:** `/activity`, `/dashboard`, `/institution-settings`, `/people`

## CoachingTeam

- **Source:** [features/institution/CoachingTeam.vue](../../../apps/frontend/src/features/institution/CoachingTeam.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Coach-first supporting selection with immediate acknowledged writes, optional filters, explicit access scope when ambiguous and revision-safe link removal.
- **Direct rendered consumers:** [features/institution/MemberManagement.vue](../../../apps/frontend/src/features/institution/MemberManagement.vue)
- **Views using it:** `/members/:member`

## DashboardPage

- **Source:** [features/institution/DashboardPage.vue](../../../apps/frontend/src/features/institution/DashboardPage.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Role dashboard and route-selected People, Activity and Institution settings sections, invitations and close-institution confirmation.
- **Direct rendered consumers:** Router.
- **Views using it:** `/activity`, `/dashboard`, `/institution-settings`, `/people`

## DelegatedWorkout

- **Source:** [features/institution/DelegatedWorkout.vue](../../../apps/frontend/src/features/institution/DelegatedWorkout.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Coach recording of an assigned athlete workout with actual measurement-aware results.
- **Direct rendered consumers:** Router.
- **Views using it:** `/record/:session`

## EventComposer

- **Source:** [features/institution/EventComposer.vue](../../../apps/frontend/src/features/institution/EventComposer.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Plan-workout scheduling through the shared agenda, plus separate custom-event and assessment creation with people, timezone and template handoff.
- **Direct rendered consumers:** Router.
- **Views using it:** `/schedule/new`

## EventDetail

- **Source:** [features/institution/EventDetail.vue](../../../apps/frontend/src/features/institution/EventDetail.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Scheduled event detail, roster attendance, assessment scores, completion, correction history and makeup links.
- **Direct rendered consumers:** Router.
- **Views using it:** `/schedule/:id`

## FeedbackPage

- **Source:** [features/institution/FeedbackPage.vue](../../../apps/frontend/src/features/institution/FeedbackPage.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Athlete session ratings or coach workplace feedback with prior submissions.
- **Direct rendered consumers:** Router.
- **Views using it:** `/feedback`

## FollowUpPanel

- **Source:** [features/institution/FollowUpPanel.vue](../../../apps/frontend/src/features/institution/FollowUpPanel.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Derived dashboard follow-ups for missed events, unreviewed workouts, overdue outcomes and unplanned athletes; no Task records.
- **Direct rendered consumers:** [features/institution/CoachDesk.vue](../../../apps/frontend/src/features/institution/CoachDesk.vue)
- **Views using it:** `/activity`, `/dashboard`, `/institution-settings`, `/people`

## GroupWorkoutPanel

- **Source:** [features/institution/GroupWorkoutPanel.vue](../../../apps/frontend/src/features/institution/GroupWorkoutPanel.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Shared event prescription, paginated participant outcomes, individual adaptation/start and explicit skip with durable command recovery.
- **Direct rendered consumers:** [features/institution/EventDetail.vue](../../../apps/frontend/src/features/institution/EventDetail.vue)
- **Views using it:** `/schedule/:id`

## InjuryStatus

- **Source:** [features/institution/InjuryStatus.vue](../../../apps/frontend/src/features/institution/InjuryStatus.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Consent-gated participation status, reporting/correction/closure, policy configuration and athlete export.
- **Direct rendered consumers:** Router.
- **Views using it:** `/injuries`

## InvitationPage

- **Source:** [features/institution/InvitationPage.vue](../../../apps/frontend/src/features/institution/InvitationPage.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Accept a seven-day institution invitation and create/sign into the invited account.
- **Direct rendered consumers:** Router.
- **Views using it:** `/invitation/:token`

## MemberManagement

- **Source:** [features/institution/MemberManagement.vue](../../../apps/frontend/src/features/institution/MemberManagement.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Profile management of identity/access, active state, coach links, sports and password reset issuance.
- **Direct rendered consumers:** [features/institution/AthleteProfile.vue](../../../apps/frontend/src/features/institution/AthleteProfile.vue)
- **Views using it:** `/members/:member`

## MemberPicker

- **Source:** [features/institution/MemberPicker.vue](../../../apps/frontend/src/features/institution/MemberPicker.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Server-searchable authorized roster picker preserving selected identities across result pages.
- **Direct rendered consumers:** [features/institution/ChannelEditor.vue](../../../apps/frontend/src/features/institution/ChannelEditor.vue), [features/institution/CoachingTeam.vue](../../../apps/frontend/src/features/institution/CoachingTeam.vue), [features/institution/EventComposer.vue](../../../apps/frontend/src/features/institution/EventComposer.vue), [features/institution/EventDetail.vue](../../../apps/frontend/src/features/institution/EventDetail.vue), [features/institution/MemberManagement.vue](../../../apps/frontend/src/features/institution/MemberManagement.vue), [features/institution/ServiceCatalog.vue](../../../apps/frontend/src/features/institution/ServiceCatalog.vue), [features/nutrition/NutritionPage.vue](../../../apps/frontend/src/features/nutrition/NutritionPage.vue), [features/nutrition/NutritionPlans.vue](../../../apps/frontend/src/features/nutrition/NutritionPlans.vue)
- **Views using it:** `/assessment-templates`, `/assessment-templates/:editor`, `/groups`, `/groups/:editor`, `/members/:member`, `/messages/:channel?`, `/nutrition`, `/schedule/:id`, `/schedule/new`

## MemberSports

- **Source:** [features/institution/MemberSports.vue](../../../apps/frontend/src/features/institution/MemberSports.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Selectable sport/specialty buttons for role-relevant institutional metadata.
- **Direct rendered consumers:** [features/institution/MemberManagement.vue](../../../apps/frontend/src/features/institution/MemberManagement.vue)
- **Views using it:** `/members/:member`

## PersonActionIcon

- **Source:** [features/institution/PersonActionIcon.vue](../../../apps/frontend/src/features/institution/PersonActionIcon.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Decorative SVG profile/message/manage action glyphs; the owning button/link supplies the accessible label.
- **Direct rendered consumers:** [features/institution/DashboardPage.vue](../../../apps/frontend/src/features/institution/DashboardPage.vue)
- **Views using it:** `/activity`, `/dashboard`, `/institution-settings`, `/people`

## RatingForm

- **Source:** [features/institution/RatingForm.vue](../../../apps/frontend/src/features/institution/RatingForm.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Reusable scored feedback form with draft recovery, save and discard.
- **Direct rendered consumers:** [features/institution/FeedbackPage.vue](../../../apps/frontend/src/features/institution/FeedbackPage.vue)
- **Views using it:** `/feedback`

## ScheduleCalendar

- **Source:** [features/institution/ScheduleCalendar.vue](../../../apps/frontend/src/features/institution/ScheduleCalendar.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Timezone-aware calendar plus selected-day booked cards, pagination, month/week/day controls and list switch.
- **Direct rendered consumers:** Router.
- **Views using it:** `/schedule`

## ScheduledEvents

- **Source:** [features/institution/ScheduledEvents.vue](../../../apps/frontend/src/features/institution/ScheduledEvents.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Paginated/searchable Schedule list for training events and assessments, paired with calendar mode.
- **Direct rendered consumers:** Router.
- **Views using it:** `/events`

## ServiceCatalog

- **Source:** [features/institution/ServiceCatalog.vue](../../../apps/frontend/src/features/institution/ServiceCatalog.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Shared group and assessment-template library with distinct list/create/edit route modes.
- **Direct rendered consumers:** Router.
- **Views using it:** `/assessment-templates`, `/assessment-templates/:editor`, `/groups`, `/groups/:editor`

## SessionHistory

- **Source:** [features/institution/SessionHistory.vue](../../../apps/frontend/src/features/institution/SessionHistory.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Searchable paginated recorded solo-workout history; separate from scheduled group events.
- **Direct rendered consumers:** Router.
- **Views using it:** `/workouts`

## SessionNote

- **Source:** [features/institution/SessionNote.vue](../../../apps/frontend/src/features/institution/SessionNote.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Institution session/event note editor with acknowledged revision and uncertain-command recovery.
- **Direct rendered consumers:** [features/institution/EventDetail.vue](../../../apps/frontend/src/features/institution/EventDetail.vue)
- **Views using it:** `/schedule/:id`

## SportsSettings

- **Source:** [features/institution/SportsSettings.vue](../../../apps/frontend/src/features/institution/SportsSettings.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Institution sport and coaching-specialty taxonomy creation, editing and archival.
- **Direct rendered consumers:** [features/institution/DashboardPage.vue](../../../apps/frontend/src/features/institution/DashboardPage.vue)
- **Views using it:** `/activity`, `/dashboard`, `/institution-settings`, `/people`

## TrainingRoute

- **Source:** [features/institution/TrainingRoute.vue](../../../apps/frontend/src/features/institution/TrainingRoute.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Role dispatcher to athlete training or staff athlete-plan index.
- **Direct rendered consumers:** Router.
- **Views using it:** `/training`

## UpcomingSessions

- **Source:** [features/institution/UpcomingSessions.vue](../../../apps/frontend/src/features/institution/UpcomingSessions.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Current role's bounded upcoming-event dashboard summary and detail links.
- **Direct rendered consumers:** [features/institution/AdminOverview.vue](../../../apps/frontend/src/features/institution/AdminOverview.vue), [features/institution/AthleteDay.vue](../../../apps/frontend/src/features/institution/AthleteDay.vue), [features/institution/CoachDesk.vue](../../../apps/frontend/src/features/institution/CoachDesk.vue)
- **Views using it:** `/activity`, `/dashboard`, `/institution-settings`, `/people`

## WorkoutAgenda

- **Source:** [features/institution/WorkoutAgenda.vue](../../../apps/frontend/src/features/institution/WorkoutAgenda.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Shared read-only next-workout projection, fixed-time scheduling/reschedule/skip and occurrence-bound start/resume with durable command recovery.
- **Direct rendered consumers:** [features/institution/AssignedPlanPage.vue](../../../apps/frontend/src/features/institution/AssignedPlanPage.vue), [features/institution/AthleteDay.vue](../../../apps/frontend/src/features/institution/AthleteDay.vue), [features/institution/AthleteTraining.vue](../../../apps/frontend/src/features/institution/AthleteTraining.vue), [features/institution/CoachDesk.vue](../../../apps/frontend/src/features/institution/CoachDesk.vue), [features/institution/EventComposer.vue](../../../apps/frontend/src/features/institution/EventComposer.vue)
- **Views using it:** `/activity`, `/dashboard`, `/institution-settings`, `/people`, `/schedule/new`, `/training`, `/training/:assignment`

## WorkoutRuleSettings

- **Source:** [features/institution/WorkoutRuleSettings.vue](../../../apps/frontend/src/features/institution/WorkoutRuleSettings.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Staff plan scheduling policy: bounded weekly appointments or opt-in day-only preparation, diagnostics, exact-command recovery and future-rule stop/edit.
- **Direct rendered consumers:** [features/institution/AssignedPlanPage.vue](../../../apps/frontend/src/features/institution/AssignedPlanPage.vue)
- **Views using it:** `/training/:assignment`

## DashboardNav

- **Source:** [features/navigation/DashboardNav.vue](../../../apps/frontend/src/features/navigation/DashboardNav.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Single role-aware sidebar/phone drawer navigation, grouped collapse and active-section highlighting.
- **Direct rendered consumers:** [App.vue](../../../apps/frontend/src/App.vue)
- **Views using it:** Application shell; available on every route, conditional on shell state.

## NotificationPreferences

- **Source:** [features/notifications/NotificationPreferences.vue](../../../apps/frontend/src/features/notifications/NotificationPreferences.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Own in-app/email preference and quiet-hour controls; configuration is distinct from delivery.
- **Direct rendered consumers:** [features/notifications/NotificationsPage.vue](../../../apps/frontend/src/features/notifications/NotificationsPage.vue)
- **Views using it:** `/notifications`

## NotificationsPage

- **Source:** [features/notifications/NotificationsPage.vue](../../../apps/frontend/src/features/notifications/NotificationsPage.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Authorized notification inbox, mark/read navigation and embedded preference editing.
- **Direct rendered consumers:** Router.
- **Views using it:** `/notifications`

## FoodPicker

- **Source:** [features/nutrition/FoodPicker.vue](../../../apps/frontend/src/features/nutrition/FoodPicker.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Source-backed food search and selection with nutrition/provenance details.
- **Direct rendered consumers:** [features/nutrition/MealFields.vue](../../../apps/frontend/src/features/nutrition/MealFields.vue), [features/nutrition/MealPlanEditor.vue](../../../apps/frontend/src/features/nutrition/MealPlanEditor.vue)
- **Views using it:** `/nutrition`

## MacroPlanner

- **Source:** [features/nutrition/MacroPlanner.vue](../../../apps/frontend/src/features/nutrition/MacroPlanner.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Nutrition target planning from source kcal and macros without treating unknown values as zero.
- **Direct rendered consumers:** [features/nutrition/NutritionPage.vue](../../../apps/frontend/src/features/nutrition/NutritionPage.vue)
- **Views using it:** `/nutrition`

## MealFields

- **Source:** [features/nutrition/MealFields.vue](../../../apps/frontend/src/features/nutrition/MealFields.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Consumed-food amount/unit/nutrient controls; keeps source and manual quantities distinct.
- **Direct rendered consumers:** [features/nutrition/NutritionPage.vue](../../../apps/frontend/src/features/nutrition/NutritionPage.vue)
- **Views using it:** `/nutrition`

## MealPlanEditor

- **Source:** [features/nutrition/MealPlanEditor.vue](../../../apps/frontend/src/features/nutrition/MealPlanEditor.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Published-guidance example-day authoring with food search, manual items and nutrient controls.
- **Direct rendered consumers:** [features/nutrition/NutritionPage.vue](../../../apps/frontend/src/features/nutrition/NutritionPage.vue)
- **Views using it:** `/nutrition`

## NutrientFields

- **Source:** [features/nutrition/NutrientFields.vue](../../../apps/frontend/src/features/nutrition/NutrientFields.vue)
- **Kind:** Reusable/domain component.
- **Purpose:** Shared numeric energy/macro input group preserving source precision and unknown values.
- **Direct rendered consumers:** [features/nutrition/MacroPlanner.vue](../../../apps/frontend/src/features/nutrition/MacroPlanner.vue), [features/nutrition/MealFields.vue](../../../apps/frontend/src/features/nutrition/MealFields.vue), [features/nutrition/MealPlanEditor.vue](../../../apps/frontend/src/features/nutrition/MealPlanEditor.vue)
- **Views using it:** `/nutrition`

## NutritionPage

- **Source:** [features/nutrition/NutritionPage.vue](../../../apps/frontend/src/features/nutrition/NutritionPage.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Athlete nutrition detail, staff guidance authoring/publication, example meals, diary sharing, actual intake and version/history recovery.
- **Direct rendered consumers:** [features/nutrition/NutritionRoute.vue](../../../apps/frontend/src/features/nutrition/NutritionRoute.vue)
- **Views using it:** `/nutrition`

## NutritionPlans

- **Source:** [features/nutrition/NutritionPlans.vue](../../../apps/frontend/src/features/nutrition/NutritionPlans.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Browse-first paginated nutrition-guidance index and selected-athlete create/open actions.
- **Direct rendered consumers:** [features/nutrition/NutritionRoute.vue](../../../apps/frontend/src/features/nutrition/NutritionRoute.vue)
- **Views using it:** `/nutrition`

## NutritionRoute

- **Source:** [features/nutrition/NutritionRoute.vue](../../../apps/frontend/src/features/nutrition/NutritionRoute.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Dispatch staff nutrition index versus own/selected-athlete detail using member/plan query state.
- **Direct rendered consumers:** Router.
- **Views using it:** `/nutrition`

## PlatformPage

- **Source:** [features/platform/PlatformPage.vue](../../../apps/frontend/src/features/platform/PlatformPage.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Local operator support queue, retention/operation retry, diagnostics and authorized audit reads.
- **Direct rendered consumers:** Router.
- **Views using it:** `/platform`

## NotFound

- **Source:** [features/public/NotFound.vue](../../../apps/frontend/src/features/public/NotFound.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Ordinary missing-route state with root recovery action.
- **Direct rendered consumers:** Router.
- **Views using it:** `/:pathMatch(.*)*`

## PrivacyPage

- **Source:** [features/public/PrivacyPage.vue](../../../apps/frontend/src/features/public/PrivacyPage.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Instance-local privacy statement and link to Help.
- **Direct rendered consumers:** Router.
- **Views using it:** `/privacy`

## ResourcesPage

- **Source:** [features/resources/ResourcesPage.vue](../../../apps/frontend/src/features/resources/ResourcesPage.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** One searchable institution upload/resource library with preview, archive and restore.
- **Direct rendered consumers:** Router.
- **Views using it:** `/resources`

## SupportPage

- **Source:** [features/support/SupportPage.vue](../../../apps/frontend/src/features/support/SupportPage.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Local support request creation, own case history and resolve/reopen; no automatic external email.
- **Direct rendered consumers:** Router.
- **Views using it:** `/support`

## WorkoutPage

- **Source:** [features/training/WorkoutPage.vue](../../../apps/frontend/src/features/training/WorkoutPage.vue)
- **Kind:** Screen or route dispatcher.
- **Purpose:** Athlete's institutional workout recorder with measured actuals, local persistence, exact sync, conflict recovery and completion summary.
- **Direct rendered consumers:** Router.
- **Views using it:** `/workout/:id`
