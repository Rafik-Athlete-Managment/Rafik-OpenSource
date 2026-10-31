# Monorepo code quality audit

Reviewed 31 October 2026 on the unreleased beta.3 branch. Baseline: a6fc3a09fa7a714e9ef58f218b62308ea24cfabc. The founder requested code validation before phone practice validation; the follow-up closes the actionable source findings below. Release approval and native device acceptance remain separate.

## Scope and baseline

Reviewed all four workspace manifests/configurations, CI, active tracked TypeScript/TSX, Vue scripts, MJS helpers and CSS. Generated/third-party code and historical migrations were not refactored. The [frontend](../reference/frontend/README.md) and [backend](../reference/backend/README.md) references remain the component/route/schema catalogs. Derived references were regenerated through their canonical generators when source ownership changed.

| Baseline workspace | Code files scanned | Explicit any keywords, including tests |
| --- | ---: | ---: |
| Frontend | 211 | 76 |
| Backend | 109 | 137 |
| Mobile | 29 | 0 |
| Shared | 2 | 0 |

These counts are not quality scores. The [initial receipt](../verification/receipts/2026-10-31-code-quality-audit.json) preserves per-file counts, duplicate candidates and initial diagnostics. Vue positions are relative to script/style blocks. The [follow-up receipt](../verification/receipts/2026-10-31-code-quality-followup.json) records final source metrics and actual checks.

## Findings and resolutions

| Finding | Resolution |
| --- | --- |
| Unused state, helpers, imports and positional parameters | Removed verified dead bindings/functions while retaining authorization calls, setup effects and public positional signatures. All four workspaces enforce noUnusedLocals/noUnusedParameters. |
| 117 frontend formatter warnings | Predominantly CRLF/LF mismatches. Code Git attributes now enforce LF; actual formatting changes are isolated. Full frontend format check passes and runs in CI. Package-specific formatter conventions remain intact. |
| Shared package checked only through consumers | Standalone strict shared typecheck runs in CI. Its NodeNext/verbatim/erasable configuration does not replace Vue/Vite or Expo configurations. |
| Unnecessary any in application projections and snapshots | Active frontend/backend runtime source has no explicit any annotations. Shared workout types replace repeated shapes; SQL results have typed projections. Untrusted authoring data remains unknown until existing checks run. Assertions on SQL-validated stored JSON describe storage contracts, not new runtime validation. |
| Repeated measurement facts and normalization | One shared measurement module, stable web re-exports and one native normalization pass. Zero load, missing values, integer rules and raw decimal input remain distinct. |
| Repeated prescribed-entry construction | One backend prescribedEntries helper serves individual/group creation and field targets. Defaults stay unfinished; SQL validation, immutable baselines and sequence services remain authoritative. |
| Large programming module mixes reads/writes | Read-only agenda moved to workout-agenda.ts. HTTP routes, role scopes, queue identity/count/pagination and command services are preserved. No extra allocator or new dependency cycle was introduced. |
| Native controller mixes recording state with repeated JSX | WorkoutExercises is controlled presentation. WorkoutsScreen retains draft/raw values, selection, writes, effects and replay. Host-stub tests cover editing/toggles/disabled controls and strength/timed/distance fields; they are not a native renderer. |
| Duplicated calendar redaction and plan-draft callbacks | Shared calendar person projection preserves omitted nested membership data. Both draft watchers reuse one callback while retaining their original watch sources/timing. |
| Four copies of institution test setup | A shared helper receives caller-owned identity/institution registries and preserves original request bytes/creation order. Teardown remains in each test file; it introduces no shared mutable registry or connection lifecycle. |
| Obsolete validation runners | Removed five scripts tied to superseded navigation. The two existing npm layout aliases now use maintained isolated browser specs. Archived historical references remain clearly historical. |
| Dead legacy model declarations | Removed five unreferenced frontend-only interfaces: Assignment, Relationship, Invitation, ClientContext and ScheduledDay. Transpiled JavaScript before/after is identical. Current versions, session fields, owner hydration and durable types are retained. |
| Stale platform institution count | Typed view exposed a wrong section name/legacy count key. The institution list now reads its actual institution_members count; a focused operator browser regression covers it. |
| Repeated CSS declarations | Merged the one safe adjacent toolbar rule group without changing selector specificity/order. Most of the 88 candidate groups are short declarations in different scoped/cascade contexts; moving them globally would add coupling rather than remove a defect. Existing shared tokens/components remain the convention. |
| Backend inventory line-ending sensitivity | Normalize source before AST analysis and output comparison. Regression generates/checks LF and CRLF fixtures and confirms genuinely stale references still fail; no database is required. |
| Documentation duplication | Removed the duplicate native testing section and refreshed module ownership, commands and current audit status. Manual walkthroughs remain in their single canonical document. |

## Deliberate retention and limits

InstitutionScreen remains the mounted owner of schedule/assessment/navigation state. Its line count alone is not a defect; splitting its effects and owner checks without a specific behavioral benefit would increase recovery risk. This pass extracts pure presentation/read/default-projection boundaries instead of moving durable controllers for a size target.

Integration tests still contain broad JSON/negative-fixture types. These are not application boundary validators. Do not replace them with generic casts simply to claim an any-free repository; server/API assertions remain necessary. Generated database types, deployed migrations, stored snapshots, receipt/owner keys and operational compatibility stay intact.

No dependency was upgraded or removed. Zero direct imports are not evidence that CLI, peer, generated-client or plugin dependencies are dead: Unovis, Tailwind, Swagger, Prisma and Expo examples are documented in the initial receipt/maintainer guide. No new dependency was introduced. Existing [security findings](README.md#dependency-review--29-october-2026) remain separate; this pass does not claim a fresh registry audit or a clean Linux install.

No semantic lint dependency was added. Strict compiler checks, unused-code enforcement, formatter, contract/unit/API checks and current CI are the code gates. A future lint policy should have a concrete benefit rather than duplicate these checks.

## Verification

See [verification](../verification/README.md) and the follow-up receipt for actual completed checks and scope. Native host-stub/Metro evidence does not establish Android rendering, SQLCipher on hardware, process-death recovery or physical offline acceptance. The [canonical walkthrough](../testing/instance-validation.md#native-individual-workouts--unreleased-beta3) remains the next human/device gate. No release merge, APK or landing documentation PR is part of this internal refactor.
