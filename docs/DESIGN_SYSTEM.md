# Rafik design system

**Status: founder approved, implementation underway, 21 October 2026.** This is the single visual and interaction specification for the web dashboard. It distinguishes the existing foundation, implemented shared controls and remaining migrations. A guideline does not establish acceptance of every consumer. Android is a follow-up audit; this document does not establish native acceptance. The [audit and rollout plan](known-issues/ui-ux-audit.md) records findings, evidence and priorities.

## Purpose and boundaries

The coach desk has one Workouts to record collection for due and unfinished work, with status-specific Start/Resume actions, and a separate Needs scheduling collection. Do not render recording and due as duplicate panels. State changes refresh related collections in place after acknowledgment; preserve open command/recovery state. Require matching server queue identity instead of treating an older unfiltered response as valid scoped results.

Workout cards lead with the localized workout/day name; the program title belongs beneath it as context. Keep athlete identity as a separate overline in staff directories. Do not repeat a program title as every workout heading.

Coaching desk (approved 26 October): put Today’s work and a narrower Athlete status panel beside each other on desktop, stacked on phones. Keep unfinished recordings first, due workouts and group/assessment events clearly labelled, and planning below. Avoid combined task totals across overlapping record types. Compact native details/summary rows disclose primary-roster follow-up; zero queues do not consume large empty cards. Status data is factual and permission-scoped; absent shared status is unknown. Field launch is a future tablet direction, not a second web dashboard.

Status tags use `data-status` with the machine status, never translated-text inference. Green: active/completed/reviewed/resolved/published. Blue: scheduled/upcoming/in-progress/open. Amber: unscheduled/awaiting-review/pending. Yellow: draft/paused. Red: overdue/cancelled/expired/ended/replaced/unavailable. Archived, inactive and descriptive labels remain neutral. Always retain a visible text label so color is supplementary. Shared CSS adapts ink, background and border to light/dark themes.

Routine acknowledged success uses one action-specific toast; never render a duplicate success card. Keep pending/conflict/error recovery and actionable generated links visible. Staff workout summaries use bordered prescription cards; scheduling controls share aligned labels and 44px controls and stack on phones. Coach recording uses explicit athlete-style check buttons with pressed state and an accessible label; input alone must not claim a set was performed. Dashboard priorities combine workout action discovery and review/attendance follow-up, with greeting and roster/navigation controls in the page header.

Workout preview content: show real prescribed duration, exercise count, prescribed set count, bounded exercise examples and declared muscle focus. Do not invent calorie estimates, physiological load, muscle percentages or progress from missing actuals. Prefer authorized existing program covers; use a branded icon treatment when none is available. Larger cards can show examples and focus side by side. Phone layouts shorten the example list and prioritize Start/Resume before secondary details.

Assigned-plan refinement (25 October 2026): directories contain filters and result cards; substantial assigned-plan review belongs on its dedicated detail route. Adapt within that page using the shared editor and the assigned immutable snapshot. Do not silently replace an active assignment. Use one page title on athlete training, one adjacent primary/secondary toolbar and workout preview cards. Start/Resume must remain visible on touch and keyboard; hover may emphasize it but must not be the only discovery mechanism. Assigned-plan actions use consistent labelled SVG icon buttons. Cancellation uses red outlined/text controls; deletion/removal uses the shared danger treatment. Red ink adapts to light/dark surfaces; filled danger buttons retain white text. Do not color status labels or ordinary navigation as destructive actions.

Founder-validation refinements (25 October 2026): simple coach selections save on toggle with existing durable command/recovery handling; do not add a second save button. Optional coach filters stay collapsed, while permission scope remains explicit when ambiguous. New conversation contacts/groups share one collapsible directory, with a short start hint and no success toast merely for opening a conversation. Message draft persistence must not shift the composer; Enter sends and Shift+Enter inserts a newline, respecting IME composition. Food recording uses the shared bounded Reka dialog, retains recovery controls inside the dialog, starts blank entries with the food library, and groups recorded foods under meal headings. Group athlete/coach pickers use a two-column layout where space allows and stack on phones.

Rafik should feel like one university sports workspace: calm, legible, practical and recognizably Rafik. Preserve the logo, green identity, existing fonts, English/Arabic support, theme customization and role-specific navigation. Improve consistency rather than introducing a different visual identity.

Visual work must preserve API contracts, routes, permissions, one-role memberships, exact commands, revision checks, recoverable drafts, immutable program versions and offline/acknowledgment distinctions. Do not move business rules into reusable form controls. No new component library, font family or global store is required.

## Campaign identity alignment — adopted 23 October 2026

The founder supplied `rafik-campaign-round7.zip` (brand guidelines v1.0, approved 22 October) and directed future product design to align with it. The campaign explicitly leaves application controls under this document. This section is the product translation of that identity; social export geometry and publishing instructions do not become application requirements.

### Shared identity

- Name: **Rafik / رفيق**. Use sentence case, plain task-specific language, athletes/coaches/institution, and accurate saved-on-device versus synced-to-institution wording. The campaign's British English “programme” does not require renaming API fields, routes or existing localization keys.
- Keep the supplied original logo artwork, its existing outline, proportions and full opacity. Never mirror, recolor, redraw or add another decorative box/outline/shadow. Use a dark mark on a light surface and the supplied light mark on a dark surface. Preserve institution-owned branding; do not replace an institution logo with campaign artwork.
- Shared default product accent: Rafik green `#285943`. Light page: ivory `#f8f8f3`; product dark page: `#171e1a`. Campaign forest `#10291f` is a related identity color, not an instruction to replace the product's accepted dark canvas. Keep instance-configurable colors and accessible derived foregrounds.
- Supporting campaign references: ink `#18392b`, moss `#5d6c5a`, sage `#6f8a5c`, line `#d7ded2`, mist `#edf4e9`, lime `#c7dc9d`, fern grey `#b7c9b9`, pine `#17382a`. These are identity references, not a second runtime token system. Sage is unsuitable for ordinary small text on ivory; check actual text/surface contrast. Semantic errors/warnings and truthful chart categories retain their distinct meanings.
- English uses locally loaded Manrope; Arabic uses locally loaded Noto Sans Arabic with real supplied weights. Product web 400/600 Arabic is valid; campaign 400/700 does not mandate synthetic bold or advertising-size typography. Arabic tracking stays zero; URLs, emails, identifiers and mixed-language names retain appropriate direction isolation.
- Prefer warm matte surfaces, restrained green emphasis, deliberate whitespace and rounded controls. No new decorative glassmorphism, glossy/multicolor gradients, glows, noise, emoji decoration, invented dashboards or generated athlete imagery. Use the existing Phosphor SVG family for interface icons. Functional overlays retain necessary scrims, contrast, focus and opaque fallbacks.

### Product-specific requirements remain

Keep the operational type scale, 44–48px touch targets, real status badges, accessible focus/validation, pagination, disclosure and reduced-motion behavior defined below. Campaign 1080px artboards, 28px image frames, logo minimums, separate-language social posts, headline weights and “one accent per artboard” do not override adaptive product layout or semantic controls. A product page can contain bilingual user-entered names and warning/error states. Published screenshots must depict the actual product, never a repaint of these guidelines.

For beta.3 Android work, align the default palette to the product identity above, bundle the real Latin/Arabic fonts with licenses and use the original surface-appropriate logo if a logo is shown. Keep device accessibility settings, tested logical-start Android RTL treatment, offline recovery and user-selected themes. Do not copy web CSS direction assumptions into native text alignment. Verify actual phone/tablet rendering before calling the native application aligned; the source gaps and acceptance checklist are in the [audit](known-issues/ui-ux-audit.md#campaign-and-native-brand-alignment--23-october-2026).

### Source and reconciliation

| Source            | Identity / limit                                                                                                                                                                                                                                           |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supplied archive  | `rafik-campaign-round7.zip`, SHA-256 `563dded3168ac510758e9f9fc038bbebd815a9e920433382bbb7032a9d05ff06`                                                                                                                                                    |
| Visual source     | `round7/Rafik-Brand-Guidelines-v1.0.pdf`, 26 pages; SHA-256 `d86b31debd23e89265a3295984a1c2de3e19933d904259e95c7ad917600e3fbb`. PDF takes precedence over its campaign companion.                                                                          |
| Written companion | `round7/BRAND-GUIDELINES-FOR-AGENTS.md`, SHA-256 `3f94639414e9e1222cfca0d14498fcaf50c5c5e7917a72e34538c3bafc8efcb9`                                                                                                                                        |
| Existing app logo | `public/brand/rafik.png` is byte-identical to the handoff's `assets/rafik.png`; SHA-256 `d7544e73ec55d0233362d19dc180a3f8f1bf93bbfb92fdeba27519739c2d2c9d`. Larger dark and light marks in the handoff are approved variants, not newly generated artwork. |

The source bundle's old `KenseiEmam/Rafik-OpenSource` owner and release/capture references are historical. Use the canonical Rafik-Athlete-Managment repository and the actual reviewed/published revision. Future beta.3 capabilities must not be presented as already released. The campaign's photography credits point into a separate round6 folder that is absent from this handoff; inspected example photos are not imported as product assets or assumed to have a complete redistributable provenance record. Keep campaign strategy/materials in their owning project; this repository maintains product rules and the source fingerprint above.

## Existing foundation

| Area            | Current source of truth                                         | Keep                                                                               |
| --------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Theme           | `apps/frontend/src/style.css`, `src/lib/branding.ts`            | Instance-derived semantic colors, both themes and contrast-aware accent foreground |
| Fonts           | `apps/frontend/src/main.ts`                                     | Manrope Variable; Noto Sans Arabic at 400/600                                      |
| Dashboard shell | `src/App.vue`, `src/styles/dashboard.css`, workspace navigation | Role navigation, desktop workspace scroll and phone drawer                         |
| UI primitives   | Reka UI, native form controls                                   | Accessible interaction foundations; explicit direction on portaled content         |
| Icons           | `@phosphor-icons/vue`, existing local SVGs                      | SVG icons with accessible labels; original logo artwork                            |
| Feedback        | `src/lib/feedback.ts`, `PageState.vue`, `CommandStatus.vue`     | Action-specific toasts and explicit durable-write/recovery states                  |

Paths in this table are relative to `apps/frontend/` unless the full path is given. Feature layouts should consume these foundations, not compete with them.

## Color and surfaces

### Existing tokens

| Token                         | Meaning                         | Rule                                                      |
| ----------------------------- | ------------------------------- | --------------------------------------------------------- |
| `--page`                      | Application canvas              | Keep instance-configured light/dark background            |
| `--surface`                   | Raised work surface             | Forms, dialogs and meaningful grouped panels              |
| `--surface-soft`              | Subtle grouping/selection       | Restrained row emphasis, chips, secondary sections        |
| `--ink`                       | Primary content                 | Headings, field values and essential text                 |
| `--muted`                     | Secondary content               | Descriptions, timestamps and helper text; still readable  |
| `--line`                      | Borders and dividers            | One-pixel separation; not a substitute for spacing        |
| `--accent` / `--accent-hover` | Primary and selected actions    | Theme-derived Rafik green treatment                       |
| `--on-accent`                 | Text/icons on accent            | Always pair with accent backgrounds; never hardcode white |
| `--error` / `--error-bg`      | Error text/surface              | Validation and operational errors                         |
| `--radius` / `--shadow`       | Current surface shape/elevation | Consolidate usage rather than copying values              |

The original default accent is `#285943`; default page colors are `#f8f8f3` and `#171e1a`. Runtime colors can differ because installation branding and accessible theme derivation are supported. Do not replace them with fixed brand swatches throughout components.

### Proposed additions

Shared success, warning, information and danger-action colors now live in `styles/design-system.css` (`--success`, `--success-bg`, `--warning`, `--warning-bg`, `--info`, `--info-bg`, `--danger-action`, `--on-danger`). Wider consumer migration and customized-palette validation remain follow-up work. Success can use the green family; warning uses restrained amber, information a muted blue, danger a readable red. Meaning must also appear as text or an icon.

Use ordinary opaque surfaces for most content. Use a subtle gradient only for a small header, selected emphasis or onboarding highlight. Prefer opaque floating shell elements/overlays. Existing functional translucency needs an opaque fallback and verified contrast; do not introduce decorative glass treatment. Never blur a form, table, athlete record or primary reading surface.

## Typography

### Approved scale

| Purpose                              | Size                      | Weight  | English line height |
| ------------------------------------ | ------------------------- | ------- | ------------------- |
| Page title                           | 28px phone / 32px desktop | 600     | 1.2–1.3             |
| Main section heading                 | 20px                      | 600     | 1.35                |
| Panel/subsection heading             | 18px                      | 600     | 1.4                 |
| Body and field value                 | 16px                      | 400     | 1.5–1.65            |
| Dense table, label, secondary action | 14px                      | 400/600 | 1.5                 |
| Caption/metadata                     | 13px minimum              | 400     | 1.5                 |

Use `rem` implementations so browser text scaling works. Arabic body copy needs approximately 1.65 line height and headings 1.4–1.6; verify with the existing Arabic font. Do not invent unavailable Arabic font weights. Avoid English-style negative tracking on Arabic. Essential explanations must not be reduced to faint captions.

Heading level follows document structure, not desired font size. Use one page `h1`, then `h2` sections and `h3` subsections without skips. A tab label is not a heading. A proper tab panel can start with its own `h2`; do not add a redundant “Manage details” heading merely to fill a wrapper.

### Heading relationships

- Page title → description: 8px. Page header → content: 24px desktop, 20px phone.
- Section/panel title → description: 8px. Header group → fields/content: 16px.
- Field label → control: 8px. Control → helper/error: 4–8px.
- A title and description are one header group. Do not let grid row distribution or generic paragraph padding separate them.

For **Primary coach**, keep the heading, short responsibility explanation and selection controls together. Do not give the description generic `:only-of-type` padding or stretch its header rows to match another card's height.

## Spacing, shape and elevation

Approved spacing scale: **4, 8, 12, 16, 20, 24, 32, 48, 64px**. Use 24px panel padding on desktop, 16px on phone; 16px nested section spacing; 24–32px between independent sections. Dense rows can use 12px vertical and 16px inline padding.

Approved radii: 8px controls, 12px panels/dialogs, full pill only for compact tags/toggles where the shape helps recognition. Border thickness is normally 1px. Reserve stronger borders for selection, focus or an explicit warning. Use at most one restrained shadow on a floating/raised element; routine data panels do not each need a shadow.

Implementation should introduce named spacing, typography, radius, control-size, motion and elevation tokens in the existing style foundation. The implemented token names are in `styles/design-system.css`; the scale includes only the values currently consumed. Do not publish a second parallel theme system.

## Layout and information patterns

| Content/task                                   | Preferred presentation                                | Avoid                                                                          |
| ---------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| Role directory with repeated comparable fields | Desktop rows/table-like list; responsive stacked rows | A large independent card for every short value                                 |
| Program/exercise discovery                     | Existing image/content grid                           | Converting visual discovery into a dense table without a task reason           |
| Athlete details                                | True tab panels with coherent sections                | Anchor tabs, everything visible at once, unnecessary wrapper panels            |
| Editing identity/permissions                   | One labelled form section                             | A card inside a card around every input                                        |
| Primary/supporting coaching responsibility     | Clear section headers and scoped selection            | Equal visual emphasis for helper text and the action                           |
| Sports versus specialties                      | Two clearly named groups with counts and row actions  | An unstructured mixed label pile or long horizontal form at phone width        |
| Analytics                                      | Labelled chart plus readable table/summary            | Invented ratings, unlabeled axes, empty axes presented as real activity        |
| Settings                                       | Related groups in a responsive grid                   | Arbitrary half-width empty page, equal-height cards filled with stretched gaps |

Cards indicate a meaningful surface or task boundary. Inside a card, use spacing or a divider for subordinate groups. Equal-width columns do not imply that every card must have the same content height. Align top edges, keep headers compact and avoid distributing empty space between form fields.

### Containers and breakpoints

Keep the existing 1500px maximum operational workspace and its sidebar boundary. Proposed gutters: 16px phone, 24px tablet/desktop. Use a readable 720–800px column for a single long form and roughly 65–75 characters for prose. Authentication forms stay centered at approximately 440–480px. Wide editing/reporting tasks may use the full operational width.

Breakpoints are content-driven. Review at **320×640, 390×844, 768×1024, 1024×768 and 1440×1000**. Do not create one breakpoint for every component. Two-column settings become one column when labels/controls cannot fit comfortably. Use `minmax(0, 1fr)`, appropriate intrinsic minimums and logical gaps; remove obsolete conflicting rules.

Page headings, filters, tabs and pagination share the same container edges. Desktop tabs/pagination align on their bottom edge; phone controls wrap in reading order. Keep the existing conventions: People/session/event/nutrition/service lists use 10 rows; program/plan/exercise grids keep their approved defaults. Member selection can retain incremental loading with durable selected IDs.

Desktop workspace scrolling and conversation-thread scrolling have different owners. A form should scroll naturally; an open conversation may have a bounded history. Never hide document overflow globally to mask clipping.

## Components and interactions

### Buttons and icons

Use one primary action per task group, secondary outlined actions, and quiet text/icon actions for low emphasis. Danger styling is for destructive access/data actions, never routine cancellation. Preserve icon-plus-text for ambiguous operations; icon-only actions need an accessible name, visible focus and tooltip where useful.

Use consistent 18–20px SVG icons inside controls. Mirror only directional arrows/chevrons in RTL, never logos, media, numerals or all icons indiscriminately. Proposed default control height is 44–48px; compact desktop actions may be 36px where an adjacent touch-safe path exists. Routine mobile actions should have at least a 44×44px hit area.

### Inputs and selections

Keep native text/date/time inputs unless a real interaction problem justifies an accessible existing primitive. Prefer a reusable field wrapper for label/help/error spacing; it must pass through IDs, autocomplete, input mode, native constraints and focus. Error text is linked with `aria-describedby`; invalid controls use `aria-invalid` after validation.

| Choice                                 | Standard                                                                                                 |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| One of a few mutually exclusive values | Radio group, optionally styled as segmented buttons; one choice, keyboard arrows, never multiple toggles |
| Several independent values             | Checkboxes with visible checked state                                                                    |
| A binary ongoing setting               | Switch only when “on/off” is the actual meaning; state that saving is required when it is                |
| Long one-value list                    | Searchable existing combobox or labelled native select                                                   |
| Many people/items                      | Search, meaningful option details, persistent selected chips and clear removal                           |

Person selections must search the entire authorized roster, resolve names across pages and retain selections through filtering/reload. Show sports/specialties and primary/supporting responsibility where relevant. Filtered out is not deselected. Clear unavailable selections explicitly; never silently submit hidden IDs.

Search behavior must be explicit: a labelled Search action/Enter when results are server submitted; no mix of delayed and submit-only behavior without a reason. New search/filter resets list page; opening/returning from a record preserves the previous query and page. Preserve previous results during refresh with a clear busy state; accept only the latest response. **Approved change, 27 October 2026 (not yet implemented):** list searches will run as the person types, after a short debounce, and Enter submits immediately; explicit Search buttons are removed as each list migrates to the shared filter toolbar. The page-reset, preserved-results and latest-response rules above still apply. See the [coach UX revamp plan](known-issues/ui-ux-audit.md#coach-dashboard-ux-revamp--27-october-2026).

### Password visibility

**Proposed shared improvement:** add a labelled show/hide password button to sign-in, first setup, invitation and password-setup fields. It changes only `type`, not the value, validation, submission, autocomplete or password policy. Use `type="button"`, an SVG eye/eye-off icon, localized accessible names and a visible pressed/state treatment. Reveal state is local and never persisted or logged. Confirm-password controls need independent names; toggling must not clear either field or submit the form.

### Focus, motion and state

- Keep a clearly visible focus ring with approximately 2–3px outline and offset. Do not remove it for keyboard users or clip it inside a scroll container.
- Proposed motion: 150ms for color/focus feedback, 180–200ms for disclosure/overlays, consistent ease-out. No bounce, long entrance sequences or motion required to understand state.
- Under `prefers-reduced-motion`, remove spatial transitions and nonessential animation; retain text/progress meaning without animation.
- Every component needs default, hover, focus-visible, selected, disabled, busy and error treatments. Disabled must not masquerade as empty or unavailable data.
- Loading buttons keep a useful label and stable width. Durable saving, sending, uncertain acknowledgment and acknowledged success remain distinct.

### Navigation, tabs and dialogs

Keep role-specific staff navigation visible on desktop and discoverable in the phone drawer. Do not reintroduce role-switching or legacy standalone coach navigation. Use breadcrumbs/back links for location, tabs for same-record panels, and sidebar links for separate tasks.

Use existing Reka tab/dialog primitives when appropriate. Dialogs have a title, optional concise description, focus containment, safe initial focus, Escape/cancel behavior and focus return. Destructive confirmation should not initially focus the destructive action. Long dialogs scroll internally within viewport padding and keep actions reachable at short heights. Portaled content needs explicit locale direction.

Institution closure stays a red entry action followed by an exact-name confirmation dialog. Explain impact and record preservation, retain server name/revision checks, and display failures inside the dialog. A pending/uncertain command cannot become an independent new retry just because the modal closes.

### Feedback and state surfaces

Use action-specific success copy, such as “Membership updated”, with the existing short toast lifetime. Messages, checkbox changes and ordinary navigation that already show their result do not need success toasts. Errors need durable inline context and recovery; a five-second error toast alone is insufficient.

Use a skeleton for first load, a small busy indicator for refresh and a useful bounded empty state. Empty states answer: what belongs here, why it is empty if known, and the next permitted action. A filtered no-match state offers clear/reset; an authorization refusal is not an empty list. Only constrain width when the state is centered or inside a bounded reading column.

## English, Arabic and accessibility

Preserve current localization helpers and keys; this project does not need a new localization framework for design standardization. Prefer `margin-inline`, `padding-inline`, `inset-inline`, `text-align: start` and logical layout. Give portaled popups their own direction. Use `dir="auto"` for untranslated names and controlled LTR spans for email, URLs and numeric ranges where needed.

Arabic length and line height can change row/card height. Do not force one-line Arabic labels or use font-size reduction as a layout repair. Test mixed Arabic/English names, long sports/specialty labels and live resizing. Keep DOM/keyboard order aligned with visual order rather than moving whole form sections using CSS `order`.

Target WCAG 2.2 AA behavior: 4.5:1 normal text, 3:1 large text and meaningful control/focus boundaries, semantic labels, keyboard operation, visible focus and reflow at narrow widths/zoom. Automated scans are supporting evidence; they cannot establish understandable copy, correct RTL orientation or complete keyboard usability.

## Rollout and acceptance

1. Approve this document and the [prioritized plan](known-issues/ui-ux-audit.md).
2. Introduce small shared token/component changes in reviewable slices; keep compatibility styles while migrating named consumers.
3. Apply them first to People, athlete management and institution settings, then the remaining workflow families.
4. Capture baseline and changed screenshots of real authorized data, long labels, empty/search/error and open-control states.
5. Run the smallest relevant interaction checks, both engines for shared control changes, and the representative locale/theme/viewport matrix. Inspect the images, not just scan results.
6. Update this document, audit status, maintained docs and actual verification evidence in the same change. Coordinate public workflow documentation in English/Arabic after implementation is approved.

**Approved rollout:** the founder approved these guidelines and implementation on 21 October. Preserve existing product behavior and security boundaries throughout the remaining slices. Shared presentation tokens now live in `apps/frontend/src/styles/design-system.css`; `SectionHeader.vue` and `PasswordField.vue` establish reusable section and password controls. Remaining view migrations are tracked in the audit report.

## Approved workflow refinements — 21 October

Substantial entities use dedicated create/edit pages: assessment templates, training groups, exercises and tasks. Small invitation and settings controls remain inline. Save returns to the list only after acknowledgement and local pending-command cleanup; leaving during a request must not pull the person back. A back link preserves the device draft; an explicitly labelled discard action removes that editor’s draft. Drafts are scoped to account, institution, role and record. Older drafts migrate only after the new copy is durable.

A standalone panel occupies the available workspace width. Do not reserve an empty companion column. Resource details appear beside the file list only when selected; an empty support inbox does not force the new-request form into half the page. Readable prose may retain an internal character measure.

Every search input has a useful localized hint as well as its persistent label. Standalone file uploads use `FileDropzone.vue`, with requirements, a keyboard-accessible chooser, drag feedback and existing validation; message attachments retain compact photo/file actions. Subtitles explain the screen’s purpose rather than repeating the product name.

`ListPagination.vue` exposes records per page beside navigation: 10/25/50/100 for lists and 12/24/48/96 for grids. Defaults remain 10 and the established grid size. The choice is URL-persisted; changing it resets the offset. Keep old rows and their applied range until the replacement arrives. The exercise catalog remains an authorized local catalog with presentation paging; other main directories send the bounded limit to the API.

Routine success uses existing action-specific toasts. `CommandStatus` hides success notices by default, uses compact in-progress text, and retains error and uncertain-write recovery. Device-save indicators and a generated invitation/password link are task state, not redundant success confirmations.

## Empty states, loading and search conventions

Use one full-width, start-aligned empty panel for an empty primary collection. Use a compact, borderless icon-and-text state inside an existing card, tab or picker; never nest an empty card inside another card. Both variants use a decorative 28px SVG tray icon, a short heading and an explanation or permitted next action. Do not use decorative illustrations or fixed viewport-height blank areas.

Primary states use 24px padding and vertical spacing (16px padding on phones). Compact states use 16px vertical padding. The surface fills available width; explanatory text is limited to 60 characters per line approximately, using 60ch. Headings use the shared section typography. Empty states grow with their content rather than enforcing a minimum height.

Show a first-use state only after an authorized, successful read returns no records. Filtered no-results states explain how to change or clear the search; they must not claim the institution has no records. Do not display empty states during loading, on failed requests, or for hidden companion panes. Preserve existing results during refresh. Errors retain a retry action and their recovery context. A conversation list containing existing threads does not need an additional empty people panel.

First loads use the shared PageState skeleton. Skeletons pulse gently over 1.5 seconds; reduced-motion users get static placeholders. Refresh uses compact busy text instead of replacing existing content. Pulsing never implies server acknowledgement or completed persistence.

Nutrition plans and athlete programs use the same AthleteSearch control and athlete-name placeholder. Remove the duplicate expandable athlete filter; keep the plan-status selector. Historical member-filter URLs no longer silently restrict these lists. Search fills remaining toolbar space. Pagination sits alongside when space permits, wraps beneath on narrower screens, and never compresses the input into an unusable width. Program-library search follows the same width convention.

## Schedule views

Schedule is one navigation destination, represented by the existing calendar SVG. Calendar and list are alternate views selected by one navigation-style button labelled with the destination view and its SVG icon; legacy event URLs remain valid and highlight Schedule. Both group sessions and assessments share the list. Calendar opens on today’s institution-timezone date and displays at most four booking cards, with the shared previous/next controls when needed. Selecting another date or changing the period resets card pagination. Read all pages of the displayed calendar period before reporting its counts; do not silently omit today’s bookings behind an API page. Existing date/view/filter query values survive view switching.

The Schedule view button changes its label and icon to the destination view. Use a restrained 160ms opacity/3px transition for the label and standard hover transitions; reduced-motion preferences remove movement. Do not add a separate segmented navigation bar for these two views. **Approved change, 27 October 2026 (not yet implemented):** Schedule will use Month, Week and List tabs in one calendar toolbar instead of the single view button. Legacy event URLs and existing date/view/filter query values remain valid.

Calendar and list filter toolbars are unboxed wrapping flex layouts. Controls align at their lower edge; labels remain attached to inputs. Do not place a card background or border around ordinary filter/pagination controls. On narrow screens allow whole controls to wrap without shrinking touch targets.

Calendar toolbar grouping: View, period input and cancelled visibility form one aligned control group. Previous/next period buttons are adjacent in a second group, aligned to the desktop inline end with space between groups. Inputs/buttons are 44px high and lower edges align. Date-range metadata sits below the toolbar, not on a competing baseline. Phone layouts wrap the filter group and place the paired period buttons on their own row.

Previous/next are 44px chevron buttons with localized accessible names and tooltips ("Previous month"), placed either side of the visible period label ("October 2026"). Chevrons mirror in Arabic. This keeps the filter group and period group on one desktop row inside the calendar column.

On desktop the calendar toolbar occupies only the calendar column. Its adjacent previous/next buttons align to the calendar grid’s inline end, not the booking sidebar or page edge. The toolbar and calendar use the same responsive column proportions.

Search-toolbar alignment: persistent labels sit above inputs with an 8px gap. Inputs, status selectors and submit buttons share a 44px row height and zero external margins; pagination aligns with that control row rather than the labels. Athlete plans contains exactly one athlete-name search and one plan-status selector.

Simple filters are visible inline on desktop. Do not hide a single athlete-name search or a small status/type set in a disclosure. Dense advanced filter sets may use progressive disclosure, especially on phones; ordinary controls should wrap naturally. Session history shares the same athlete-name search and has no expandable athlete picker.

The Schedule list uses the same unboxed search/filter/pagination toolbar and 44px control alignment. Do not add a competing “Events” section heading above its shared collection.

Groups and assessment templates follow the shared search/pagination toolbar with their archive checkbox visible inline. Use contextual labels (Search groups/Search templates), not a generic library label.

People keeps role tabs above its search/membership/sport toolbar; pagination aligns beside those controls. Shared pagination has zero external block margin so it cannot sit above search fields in Programs or other lists. Tasks is retired in the upcoming release; its historical audit evidence is retained.

Assessment templates use an adaptive card grid because each item has a short title and drill count; place the edit action consistently at the bottom. Use 24 records by default and the shared grid-size options. Groups remain rows because membership details need horizontal room. Cards stack naturally on phones.

## Final audit conventions — 21 October

- `ListPagination` labels its size control "Per page", keeps its range and previous/next buttons together when wrapping, and renders nothing when a list has no records; the empty state explains the list instead.
- Result counts above a list use `.list-summary` (muted 14px, 16px before the results).
- Editor save rows use `.editor-footer`: a divider, the primary save action and the device-draft status on one line. Separate draft notes use `.draft-status`.
- Personal names are never shown with uppercase tracking (`.overline`); use a 14px semibold label.
- Chips (`.tag`) size to their content inside flex columns (`align-self: flex-start`).
- Disabled cells or controls that sit over a grid-line background must not rely on the global disabled opacity.
- Paginated directories scroll with the workspace; do not add a nested scroll container around a paginated list.
- Settings use one full-width section per row. Do not pair panels whose height depends on the viewer's role (the branding form is editable only for the installation super admin); lay fields out inside the wider section instead.
- Same-day events display one date with a time range; multi-day events show both ends.
- Pickers over a potentially large roster search first: list nothing until the user types, return a small top-N result set with an Add action, and keep the selection in its own section (with context, removal and undo) below the search.
- Long editors keep their save/publish actions in one top action bar, pinned below the 64px dashboard header from 601px up. Do not duplicate the same named action elsewhere on the page. Put view/copy tools (preview, Duplicate) at the start as icon + label secondary buttons, and the save/assign/publish flow at the end; never render a toolbar action as a bare text link.
- Multi-step pickers (for example program assignment) use numbered raised cards: settings first, then search and the selected list side by side (stacked below 980px), with a sticky bar for the next step. Search results are compact name cards that act on click with a plus icon; consequential per-item choices such as replacing a plan open a dialog instead of an inline dropdown.
- People pickers fetch only the 5 closest matches (never a whole roster or Load more). A short, focused choice that starts a flow (for example choosing the athlete for a new nutrition plan) opens in a shared `.ui-dialog`. Editing panels grow with their content; use a minimum height, never a fixed height with an inner scroller.

## Role-specific dashboard priorities

Approved 26 October: athlete My day places actionable workouts first, then upcoming appointments, with compact food-diary and coach-contact panels. Start/Resume remains visible without hover. Administrator Institution overview leads with period-labelled participation and activity, then current coach coverage, upcoming activity and administrative actions. Avoid clinical status or invented assessment/readiness scores. Report values retain their own date labels during refresh/errors; current roster counts are clearly current. Reuse MetricChart with accessible text/table equivalents, shared tokens and logical borders; two-column contexts stack on narrow layouts. Do not duplicate a metric as several competing action cards.

Assessment event template selection uses one visible library search and a radio list with template names/test counts. Avoid a separate search accordion plus another selection dropdown. Preserve and identify the current selection even when it is outside search results; no-match results must not silently clear it. Fetch five results per request and offer More templates, with create-in-new-tab and refresh as secondary actions. Use bilingual task-specific examples for event names.

Light-theme cards use `--surface` at 93% institution canvas and 7% institution ink, giving near-white backgrounds a visible tinted card surface. Primary ink follows institution contrast selection; `--muted` uses 78% ink and 22% canvas so supporting copy remains readable on the card and soft surfaces. Preserve dark-theme overrides. Validate text contrast on rendered surfaces when changing either token; a different background color alone is not acceptance.

Coach selectors keep checked primary/supporting coaches in the same result list rather than moving them to chips or a second list. Selected rows remain enabled for removal; retain selected identities outside a later search/page. Supporting sport/specialty scope remains explicit when several scopes are eligible.

Messaging uses Conversations, Start conversation and Groups tabs, not a disclosure for the new-contact directory. An institution-inclusion switch interleaves discoverable channels with joined channels; joining remains explicit and previews stay private before membership. Preserve the inbox shell/scroll when selecting a thread. Athlete-plan adaptation has its own Apply action and personalized-revision label; library Save/Publish and explicit copy actions are distinct.
