# ADR 0035: Guarded Expo tooling security backports

Date: 2026-10-29. Status: accepted for the unreleased beta.3 branch.

## Context

Expo CLI 58.1.11 uses Zod 3.25.76, and Expo config uses deepmerge 4.3.1. Neither compatible line has a published fix for the current collection-allocation and prototype-poisoning advisories. An SDK downgrade or an untested Zod 4 override would risk native tooling compatibility. The founder requested remediation before continuing feature work.

## Decision

Keep official package versions and lockfile integrity values. Apply small, reviewable backports after installation using [the installer](../../scripts/tooling-security.mjs) and its [patch manifest](../../scripts/tooling-security-patches.json). The manifest records exact versions, original/patched SHA-256 hashes and replacement hunks. All files are checked before writes; unknown versions/content stop installation. Application is idempotent. The manifest includes the original MIT license texts and copyright notices for its third-party snippets; installed package notices also remain intact.

- deepmerge source, CommonJS and UMD entry points reject `__proto__`, `constructor` and `prototype` in both target/source copying, use own data-property writes, and reject uninspectable targets. Ordinary array concatenation, symbols and custom merge callbacks remain supported. Basis: [upstream issue 273](https://github.com/TehShrike/deepmerge/issues/273).
- Zod 3 CommonJS, ESM and TypeScript-source array/set validators reject over-limit inputs before parsing children. Exact-length arrays retain their lower-bound behavior. This follows the [upstream early-bound fix](https://github.com/colinhacks/zod/pull/6652), adapted to v3. Unbounded schemas are not made safe by this change alone.
- Expo's actual plugin schema bounds environments to 2, command definitions to 128, parameters per command to 64 and output records to 1,024. Its result collector limits cumulative input to 1 MiB of UTF-8 and 1,024 output records plus at most one truncation diagnostic, with an explicit truncation/error result. Direct parsing checks bytes before JSON parsing; plain-text splitting is also bounded. These are development-plugin limits, not athlete-data limits.

Root `npm ci` runs the patcher through `postinstall`. If lifecycle scripts are deliberately disabled, run `npm run security:patch`, then `npm run security:check` before Expo. Metro start and maintained Android build/release entry points check the hashes. CI runs the focused regressions. Container Dockerfiles copy the installer before scoped installs; installations without Expo skip these patches.

## Alternatives and trade-offs

Waiting alone leaves the observed call paths exposed. Forcing a Zod major or replacing deepmerge changes more behavior than the reviewed patches. Vendoring entire forks would add release/registry maintenance. The selected approach adds a small local maintenance burden and intentionally blocks upgrades until reviewed. Remove each patch when its compatible upstream fix is verified, update the manifest and rerun the focused tests.

Npm/GitHub scanners inspect published version metadata, so they still report the original advisories. Do not falsify versions, suppress alerts or describe this as a clean root audit. The local fixes cover Expo's currently identified call paths; unused bundled Zod v4 entry points are not patched or approved for new use. Keep project/plugins trusted and development servers private: these fixes do not sandbox plugin execution or protect arbitrary unbounded user schemas. Reassess this scope whenever Expo consumers change.

## Verification

Use `npm run security:check` and `npm run test:tooling-security` from the root. Tests cover malicious keys in source/target/null-prototype merges, normal/custom merges, sync/async bounded parsing in CommonJS/ESM, actual Expo plugin/MCP schemas, output budgets and install failure/idempotence. See [verification](../verification/README.md) for executed results and remaining evidence limits. No native rebuild or public API change is required by these JavaScript tooling patches.
