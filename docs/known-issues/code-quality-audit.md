# Monorepo code quality audit

## Follow-up execution — 31 October 2026

The founder requested closure of code-validation work before device practice validation. The unused-code follow-up clears the compiler diagnostic baseline and enforces noUnusedLocals/noUnusedParameters in every workspace. It retains fixture/authorization effects and existing public positional parameters. The findings table below describes the initial pass; follow-up outcomes here supersede its deferred status. Formatting, snapshot typing, duplicate helpers and module/CSS structure remain active work.

Reviewed 31 October 2026 on the unreleased beta.3 branch. Baseline commit: `a6fc3a09fa7a714e9ef58f218b62308ea24cfabc`. This is a source/configuration audit and a measured first refactoring pass, not a claim that every module has been rewritten or every screen rendered. No API, schema, migration, queue identity or user workflow changes are intended.

## Scope and method

Inspected the four workspace manifests, compiler configurations, CI, existing component ownership, tracked TypeScript/TSX, Vue script blocks, MJS helpers and CSS. Generated database/client code, installed dependencies and generated Android sources were excluded from edits. Existing [web inventories](../reference/frontend/README.md) and [backend inventories](../reference/backend/README.md) remain the detailed route/component/schema references; this report does not duplicate them.

A temporary AST scan counted explicit any keywords and identical function bodies; a CSS declaration scan identified candidates sharing declaration sequences and enclosing at-rules. Neither scan proves code is unused or styles interchangeable. Vue positions in the receipt are script/style-relative. Baseline per-file measurements and candidate groups are in the [audit receipt](../verification/receipts/2026-10-31-code-quality-audit.json). The temporary scan and local logs were removed after recording evidence.

| Workspace | Tracked code files scanned | Vue files | Explicit any keywords, including tests |
| --- | ---: | ---: | ---: |
| Web | 211 | 104 | 76 |
| Backend | 109 | 0 | 137 |
| Mobile | 29 | 0 | 0 |
| Shared | 2 | 0 | 0 |

These are baseline counts, not quality scores. The shared measurement module added by this pass is not included in baseline counts. In non-test sources the scan found 20 web and 54 backend explicit any keywords, including diagnostic scripts. The field-package mapper accounts for seven backend occurrences removed in this pass.

## Findings and decisions

| Priority | Evidence and impact | Action/status |
| --- | --- | --- |
| P1 | Field-workout projection accepted assignment/day/session data through seven any annotations, hiding shape drift across Prisma and native contracts. | Implemented narrow Prisma-derived inputs, prescribed-entry types and an explicit trusted JSON boundary. Server validation stays authoritative. The caller still obtains snapshot JSON through existing assertions; typing this mapper does not validate arbitrary JSON. |
| P1 | Measurement bounds repeated across web and native input; native Arabic/Persian normalization ran twice consecutively. | Implemented shared measurement facts with stable web re-exports; removed the duplicate pass. Kept blank/zero, raw decimal, integer and fractional-effort behavior. Native package validation remains an independent trust-boundary check. |
| P1 | Shared contracts were checked only through consumers. | Added a standalone shared typecheck and CI step. Strict NodeNext, explicit type imports and erasable source apply here; framework compiler settings elsewhere are preserved. |
| P2 | Native targets/actuals repeated the same whitelist projection. | Consolidated one local projector; regression verifies unrelated fields cannot persist and arrays remain independent. |
| P2 | Optional noUnused probes report 31 web, 23 backend and one mobile diagnostic, including tests and parameters. | Removed five unused backend import bindings after reference checks. Remaining diagnostics are tracked debt; do not globally enforce flags yet or delete fixture setup just because its result binding is unused. |
| P2 | Full frontend formatting baseline fails in 117 files; no ESLint command/configuration is established. | Changed source is formatted. Defer a dedicated formatting-only change with contributor coordination. Formatter success is not semantic lint or type safety. Preserve backend's existing formatter override. |
| P2 | Ten duplicate function-body groups include fixture setup, filtered calendar projections, draft callbacks and native entry projection. | Consolidated the native projector. Defer fixture/draft extraction until teardown, effect timing and command identity can be verified; identical syntax is insufficient evidence for a shared domain abstraction. |
| P2 | 88 repeated CSS declaration groups; global style.css is 3,922 lines. Shared picker focus/label rules and selected-state surfaces repeat. | No CSS changes in this pass. Scoped styles and global styles have different cascade ownership; consolidate incrementally with rendered theme/RTL/viewport evidence, using existing design tokens. |
| P2 | programming.ts is 2,094 lines; InstitutionScreen.tsx 1,061; WorkoutsScreen.tsx 966. | Defer structural extraction of agenda projections, field navigation and measurement panels. First establish component interruption/recovery coverage; do not disturb mounted editors or serialized persistence. |
| P3 | Human-written reference summaries lag current generated inventory counts. | Corrected summaries; current inventory checks pass without generated edits. |

## Dependency and removal review

No package was removed or upgraded. A zero source-import count is insufficient: @unovis/ts is @unovis/vue's exact peer; Tailwind is loaded through CSS and its Vite plugin; Swagger assets are resolved by filename; generated Prisma code uses @prisma/client; tsx/vue-tsc are CLI dependencies. Expo Router needs native peer packages even when application code does not import them directly. Type packages supply compiler environments. Do not delete any of these using a text-search result alone.

This pass did not rerun a registry vulnerability audit or a clean Linux installation. It does not replace the dated [dependency findings](README.md#dependency-review--29-october-2026) or the exact-version security patch checks. No lockfile, installed dependency, historical migration or generated file was changed. No entire source file was proven obsolete; none was deleted.

## Standards and follow-up order

The [maintainer standards](../development/maintainer-guide.md#typescript-and-refactoring-standards) define the accepted typing/import/module rules. Apply them when touching a module, with its existing framework configuration and formatter.

1. Keep the new shared-package check in CI and preserve focused projection/input/queue regressions.
2. Resolve remaining unused bindings in a dedicated pass: preserve called effects, authorization, fixture creation and component interfaces. Re-run optional probes before enabling compiler enforcement.
3. Replace snapshot any assertions in programming, templates and injury/platform views with validated shapes at their actual trust boundaries. Keep API/persisted contracts unchanged.
4. Consolidate test setup with explicit fixture ownership and cleanup contracts; retain per-test transaction/account isolation.
5. Extract native leaf controls and larger backend read projections under focused component/API coverage. Then address shared CSS with actual rendered comparisons. Do not bundle this with a visual redesign.
6. Coordinate a separate formatting-only change; evaluate semantic lint only with agreed rules and a clean baseline, rather than introducing another dependency during this refactor.

## Evidence and limits

[Verification](../verification/README.md#code-quality-audit--31-october-2026) records commands actually run, including an Android JavaScript-only Metro export to check the shared runtime import. No browser suite, native build, device test, production deployment or release merge was performed for this source-only pass. Existing native rendered/device acceptance remains open. Routine internal refactoring does not require a landing documentation PR; no public workflow or supported contract changed.
