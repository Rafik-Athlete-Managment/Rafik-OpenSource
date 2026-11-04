# Claude handoff: final web design audit

**Status: historical handoff prompt. Claude completed the final audit on 21 October 2026 on `codex/web-design-final`; results and remaining limits are in [verification](../verification/README.md#final-web-design-audit--21-october-2026) and the [audit report](../known-issues/ui-ux-audit.md#final-claude-audit--21-october).**

## Copyable prompt

You are taking over Rafik's web UI/UX audit and refinement from Codex. The founder prefers your design judgment. Finish a cohesive, polished university sports-management interface, preserving Rafik's established colors, fonts, architecture and behavior. This is refinement, not a product rewrite. Android is follow-up scope.

### Start from the working PR

1. Read root AGENTS.md, CONTRIBUTING.md, docs/README.md, docs/DESIGN_SYSTEM.md, docs/known-issues/ui-ux-audit.md and docs/verification/README.md.
2. Fetch application PR #138: https://github.com/Rafik-Athlete-Managment/Rafik-OpenSource/pull/138 (head codex/beta2-release). It is deliberately a temporary draft, not ready to merge or release. Start a new topic branch from its latest head, preserving all accepted functional and release-preparation changes. Do not start from main alone or merge historical pre-cleanup main history.
3. Review the actual diff and running app before changing styles. Do not assume existing tests or screenshots establish final acceptance. Do not recreate the design guidelines in another competing document.
4. Keep the existing Project tracker open: https://github.com/KenseiEmam/rafik-landing/issues/16 in https://github.com/users/KenseiEmam/projects/3.

### Founder-approved conventions to retain

- Vue 3/TypeScript with current shared components and semantic theme tokens; no new global store, UI framework or gratuitous dependency. Preserve English/Arabic, RTL and custom institutional themes.
- Admins, coaches and athletes have distinct authorized dashboards. Every role has a full profile; profile tabs switch visible content. Preserve sport-specific invitations (not for admins), coach assignment scope and health/privacy rules.
- Full-width standalone panels; no orphan half-width forms or empty companion columns. Limit prose measure inside the full-width surface. Avoid unnecessary nested cards.
- Substantial assessment-template, group and exercise forms use dedicated create/edit pages. Small settings and invitations stay inline. Natural document scrolling must work.
- Saving uses action-specific, short existing SweetAlert toasts; no duplicate success cards. Messages/navigation need no success toast. Preserve durable error/retry and uncertain-write recovery, draft status and generated invitation links.
- Back preserves a record-scoped draft; explicit discard removes it. Save navigation happens only after acknowledgement and pending-command cleanup. A delayed request must not navigate away from a newer screen or permit concurrent replay after remount.
- Lists have consistent pagination and records-per-page controls. Defaults: 10 for directories/history/nutrition; program/exercise grids retain their established grid size. Options are URL-persisted; changing size resets offset. Inputs must not be squeezed by pagination.
- Nutrition, athlete programs and session history share AthleteSearch: athlete-name search, same labels/placeholders, no second expandable athlete-picker filter. Keep plan status. Keep subject selection for creating a nutrition plan. Old member-filter URLs must not invisibly constrain the index.
- Search fills available width; search and pagination may share a row when comfortable, wrapping on phones. Search labels persist and placeholders explain what can be searched.
- Use the shared FileDropzone for standalone uploads; keep validations, keyboard chooser, file privacy and existing retry lifecycle. Program-cover upload is the visual reference. Messaging keeps compact photo/file SVG actions.
- Empty primary collections use one full-width, start-aligned icon/heading/explanation/action panel. Inside an existing card/tab use a compact borderless variant, not a nested empty card. Use a decorative SVG icon, 24px desktop/16px phone padding, readable text measure and content-driven height. Distinguish first use, no matches, errors and loading. Do not show emptiness before a successful authorized read or replace retained results during refresh.
- Initial loading uses gently pulsing skeletons; reduced motion disables animation. Do not imply successful persistence from a loading indicator.
- Headings/subtitles explain the task; do not repeat “Rafik” as a meaningless subtitle. Use SVG icons, consistent type hierarchy, focus/disabled/error states and readable chart labels.
- Schedule is one sidebar destination with a calendar icon. Existing /calendar and /events routes are alternate views. Use ONE normal navigation-style button whose label/icon indicates the destination: List view or Calendar view. No segmented switch. Keep a restrained 160ms transition, with reduced-motion support.
- Calendar initially selects today in the profile timezone. Booking cards paginate four at a time. Calendar period counts must include all API pages. Preserve useful date/filter state when changing view.
- Calendar filters are unboxed. Group View, Month/date and Show cancelled, aligned on a common lower edge at 44px control height. Previous/next month buttons are adjacent, at the inline end DIRECTLY ABOVE THE CALENDAR GRID, not the far edge above the booking sidebar. The toolbar uses the same column proportions as the calendar. Date-range metadata belongs below. On phones the groups wrap cleanly and period buttons stay together.

### Audit and refine

Inspect real populated, empty, searching, loading, error and permission states across People/profiles/settings, programs/exercises/assignment, athlete plans/history, nutrition, Schedule/events/assessments, messages/resources, reports, account and Help. Prioritize the primary/supporting coach hierarchy, sport/specialty management, list toolbars, orphan cards, substantial editors and final calendar alignment. Check all important tabs, modals, open dropdowns, upload controls and long bilingual names.

Improve spacing, typography, borders, radii, surface contrast and responsive grouping systematically through shared tokens/components. Use subtle gradients, blur and transitions only where they improve hierarchy. Preserve useful density and discoverable actions. Do not hide overflow to disguise broken layouts or remove business features for a cleaner screenshot.

### Verification and known limits

- Three focused command/draft regression tests passed. Backend and frontend handoff typechecks passed, including session-history search. Documentation checks passed (384 local links, 41 anchors, 58 docs). Final rendered acceptance remains open.
- A Chromium dedicated-editor journey passed before the latest search/calendar changes: templates, groups, task draft/retry and assignment scope, records sizing, exercise upload/save/edit. Its inspected-state coverage is limited; reuse unaffected evidence.
- Earlier shared-control and management checks passed both engines, with screenshots inspected. These are named historical results, not a certificate for the final source.
- The latest broader rollout collector has NOT passed: fixture revision/time collisions were corrected, then an isolated run ended with fetch ECONNRESET. No product root cause is established. The WebKit editor journey and final calendar/search/empty/loading visuals still need review. Fix the fixture/environment before rerunning; do not blindly repeat full suites.
- Use npm root/workspace commands and the disposable browser isolation wrapper. Never reset/reseed the founder's instance. Run browser suites serially; clean only owned fixtures/output. Inspect screenshots, not only Axe/geometry. Test English/Arabic, both themes, phone/tablet/desktop, keyboard/focus and reduced motion in Chromium and WebKit. Record exact state coverage and gaps.
- Relevant checks: npm run docs:check; npm run typecheck --workspace @rafik/frontend; npm run backend:typecheck; npm run test --workspace @rafik/frontend -- command-navigation.test.ts; focused browser files ui-standardization.e2e.ts and opt-in ui-audit.e2e.ts. The opt-in matrix uses RAFIK_UI_AUDIT=1 and RAFIK_UI_AUDIT_ROLLOUT=1. Read test comments before using their modes.
- Do not rerun native Android builds for web styling. Beta.1 is accepted/published. The existing beta.2 APK was compiled from 7705afadc0c5d66ea393f43cf0e0df3988bcd92d; preserve that provenance and private signing key. A later source tag must not falsely claim it compiled that binary.

### Deliver and coordinate

Update the existing design system/audit report, CHANGELOG, ledger and verification evidence with actual results and remaining limitations. Keep raw receipts under docs/verification/receipts. Update the documentation index for maintained files.

Once the final design audit and relevant checks pass, create a NEW release-ready PR against main containing the full candidate, referencing/superseding temporary PR #138. Explain what was improved, what was rendered and what remains unverified. Do not merge, publish a release, move tags, regenerate signing keys or push main. If anything still blocks readiness, keep the new PR draft and identify the concrete blocker instead of claiming readiness.

Coordinate the paired English/Arabic landing guidance through https://github.com/KenseiEmam/rafik-landing/pull/29; it is candidate documentation and must follow the final behavior. Replace the temporary PR reference with the final release PR when appropriate. Do not call a candidate a published release. Keep the GitHub Project issue open until the actual release is published.

## Last founder steering

Simple filters stay inline on desktop. Review final toolbar alignment in People, Programs, athlete plans, nutrition, session history, Schedule list, groups and assessment templates. People retains role tabs above its search/filter/pagination row. Shared pagination now removes inherited block margins. Tasks is retired in the upcoming release.

Assessment templates now use a responsive card grid (24-record default); groups remain rows. Inspect the final grid and all last alignment changes; they are source changes without final rendered acceptance.
