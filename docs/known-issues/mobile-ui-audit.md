# Rafik Field UI audit — 2 November 2026

This is a source and interaction audit of the unreleased beta.3 phone app. It covers every local TSX screen/component in `apps/mobile/src/field/` and the Expo entry route. The installed phone app has not been rebuilt from this source, so this document does not claim rendered-device acceptance. The [instance walkthrough](../testing/instance-validation.md#phone-daily-workspace-and-event-steps--unreleased-beta3) is the single manual validation guide.

## Screen inventory and findings

| Screen or component | Primary action | Finding and priority | Refinement |
| --- | --- | --- | --- |
| Sign-in and loading (`Home`) | Join the institution or recover an existing session | The login form and language control are simple, but their card and light dark-surface color were visually disconnected from the field screens. Medium. | Use the shared near-black palette and preserve explicit loading and error feedback. |
| Schedule (`InstitutionScreen`) | Open today's event, assessment or individual workout | One schedule and one-tap cards already replaced separate home tabs. Large notices were reduced, but multiple collapsible help/status areas and glyph icons remained. High. | Keep five-at-a-time cards and bottom-sheet filters; use one icon family, inline status and compact dismissible notices. |
| Settings (`Home`) | Change language or sign out | Full-screen overlay preserves the mounted field editor. The X and gear were font glyphs. Medium. | Keep the full-screen state boundary; standardize icons and touch targets. |
| Event preview and attendance (`InstitutionScreen`) | Review event, mark each athlete, then Next | Attendance marks are visible without expansion. History/corrections are appropriately secondary. Assessment scores were unnecessarily hidden behind the same details toggle. High. | Show result entry directly in the results step; leave history/corrections behind one disclosure. Do not bypass server-confirmed attendance. |
| Assessment results (`InstitutionScreen`, `ScoreEditor`) | Enter required measured results | The editor has direct fields, but a nested card and routine draft-saving text add weight; error text is meaningful. Medium. | Keep input and required errors visible; remove routine success noise and reduce surrounding chrome. |
| Group workout preview and recorder (`WorkoutsScreen`, `WorkoutExercises`) | Review prescription, choose athlete, record actual sets | A shared preview and one fixed athlete selector are useful. Connection/recovery accordions below the sheet, plus repeated bordered set containers, increase vertical length. High. | Keep athlete selector; move detailed recovery to the workout options sheet, keep the optional progress send secondary, and compact set spacing without shrinking touch targets. |
| Individual workout browser/recorder/summary (`WorkoutsScreen`) | Download, record and finish a workout | One-tap list cards and measurement-specific inputs are in place. Routine download/sync notices repeat card or summary state; font glyph completion labels fragment iconography. High. | Let the opened workout and read-only summary confirm success; reserve notices for unsent or failed work. |
| History and recovery (`EventHistory`, `RecoveryPanel`) | Review old values or resolve a blocked command | These are lengthy, secondary workflows. They must remain reachable and explicit because hidden or silent replacement could lose device work. High safety constraint. | Show a compact Review saved work action when attention is needed; open detailed event recovery only on request, and do not auto-clear or auto-discard. |
| Shared phone styles and language (`ui`, `LanguageControl`) | Keep screens coherent across language and theme | Green-gray dark backgrounds are lighter and more saturated than the provided reference; symbols have unrelated stroke and baseline behavior. High. | Move dark colors to shared styles, use one icon family with shared size/stroke, preserve the light theme and Arabic direction. |

## Cross-screen rules for this pass

1. Primary information and controls stay visible: attendance marks, measured targets, editable sets, validation and Finish.
2. Keep only disclosures that protect secondary detail: athlete history, device recovery, app compatibility and the athlete switcher. Do not nest a required action inside one.
3. A warning remains until dismissed or resolved; an ordinary local save or completed set does not produce a toast. Never stack an offline reminder over a sync failure.
4. Use near-black shared dark surfaces, restrained green accent and 44 px minimum icon targets. Light mode and English/Arabic remain supported.
5. Keep existing encrypted owner scopes, exact command queue, permission checks and mounted editors. This audit authorizes presentation changes, not a storage or workflow rewrite.

## Source refinements completed

- The results step exposes score entry separately from history; the score editor no longer sits inside another card.
- A single Lucide React Native wrapper sets icon size, stroke and color. Schedule types, filter, Settings, refresh, close, navigation, disclosure and completion controls use it. The previous hand-drawn filter and font-symbol controls are gone.
- Shared dark colors use near-black page, slightly lighter card and raised surfaces, and a distinct input surface. Light colors remain in their existing branch.
- Local workout download, result enqueue and score-draft typing no longer create routine saved notices. The workout sync notice is dismissible, and the schedule shows one of its notices at a time. Pending and denied work retains its existing explicit recovery.
- The header Refresh action retries routine pending work before fetching a clean selected workout; event Refresh retries queued attendance/result commands. The workout ellipsis opens detailed recovery in a bottom sheet. Blocked workouts and events keep a visible Review saved work link, while event recovery no longer expands automatically. A locally edited event draft still blocks roster replacement until reviewed. The athlete selector, history/corrections and compatibility disclosures remain secondary. Exercise targets, measurement fields, attendance marks and Finish controls stay visible.

The installed application must be rebuilt with `react-native-svg` before testing these source changes. This file describes implementation and source findings, not an accepted visual result.

## Navigation follow-up — 3 November 2026

The source review found three different responsibilities stacked below the daily Schedule: general workout browsing, saved events, and connection diagnostics. The workout browser also put saved and online results in separate sections, which hid downloaded status on the matching online card. These are navigation problems; no new records or API endpoints are needed.

- One reusable floating bar now opens **Schedule**, **Workouts**, and **Saved**. It is hidden during event attendance, assessment results, and workout recording, and while the keyboard is open. The Schedule still includes scheduled individual workouts alongside events, assessments and group workouts. Date, type and order remain in its filter sheet.
- Workouts uses one date-ordered list of downloaded and available solo workouts, with distinct download and unsent-work labels. Saved combines owner-scoped local rosters and workout sheets in one list, classifying group workout rosters with workouts and offering All/Workouts/Events/Assessments filters. A group event appears once, even though each athlete has a separate local sheet.
- Full-screen Settings groups account and language controls. **Connection & Sync** shows only values the current store and capability check can establish: last checked server reachability, local event/sheet counts, and whether a queued upload exists. Manual sync requests the same event/workout runners used by refresh. There is no reliable last-success timestamp in the present store, so the UI does not invent one. The app bar labels the state Checking until an authenticated result, then Online or Offline. Routine offline use does not raise repeated sign-in notices. The dismissible notice has no second Refresh icon because the app bar already owns that action.
- Schedule, Workouts and Saved use one compact empty-state component. Schedule offers a date/filter choice, Saved offers All or Workouts, and Workouts offers Clear search only when a search is active. Errors remain distinct from empty results, avoiding a second prompt to repeat a failed refresh.

A general notifications inbox is deferred. Current messages are transient request errors or blocked local commands without a durable read/unread notification source. Immediate validation and permission failures remain on the active step; persistent upload status is in Connection & Sync and saved records.

## Evidence and remaining acceptance

The findings above come from the current TSX source and the founder's phone observations and references. Source inspection cannot establish touch behavior, contrast on the actual S20+, short-screen clipping, RTL rendering, or offline replay. After the code pass, test those states using the canonical walkthrough. Record any observed failure there and in [verification](../verification/README.md); do not report a passing device check from TypeScript or JSX inspection alone.
