# ADR 0012 — Institution nutrition with explicit diary sharing

Date: 23 September 2026. Status: accepted for local implementation.

## Context

R14 added practical independent nutrition. The original role audit requires organization-owned service records that survive staff replacement. An independent relationship is not an organization membership. Food records additionally need a clear audience; publishing targets does not imply consent to share actual consumption.

## Decision

Use four small PostgreSQL tables accessed through one explicit organization API module. Immutable plan versions belong to a membership in its organization, with author, revision, effective date, optional expiry, targets, example foods and notes. An expired newest applicable plan does not resurrect older guidance. Later effective versions are scheduled, not changes to existing snapshots.

Actual meal snapshots and their correction/removal history belong to the same membership, separately from plans. Diary sharing defaults off and has its own optimistic revision. Staff can read actuals/history only while sharing is enabled. Only the trainee writes food/sharing. Admins publish for organizational trainees; trainers publish only for current responsibility. All permissions, including recipient responsibility, are rechecked before replay under the existing per-organization transaction lock.

## Options considered

- **Treat an organization plan as a personal independent-coaching record:** rejected because organization-owned history must survive staff reassignment without transferring private personal data.
- **Expose actual food intake whenever a plan is assigned:** rejected because publishing guidance is not consent to share the athlete's diary.
- **Keep plans organization-owned and diary sharing separate and off by default:** selected; sharing state adds an explicit workflow and staff access must be rechecked on every read/replay.

Reuse existing bounded nutrition validators, reference foods and web editing controls. Do not create an independent coaching relationship, copy personal food diaries, compute inferred calorie needs, invent adherence metrics, add a provider or create a second synchronization queue. The existing explicit durable-command mechanism handles uncertain acknowledgements.

A server-only date projection returns the membership subject's local date without exposing profiles or broadening profile-table grants. Plans and food records appear in subject export, including former membership. Existing account deletion detaches identity from retained organizational membership; it does not transfer private independent data into the organization.

## Consequences

Institution nutrition has a separate, understandable audience and staff handoff lifecycle. Stopping sharing hides all diary data on subsequent authorized reads but cannot recall copies already viewed. History is append-only through supported commands; generic browser database queries cannot access these tables. The API contract can serve the later native app, but native rendering, offline diary sync, hosting and qualified nutrition advice remain separate work.

The local UI separates plan, diary and history, with one chosen trainee and explicit publish review. Device drafts are scoped by actor, organization, role, member and date; commands retain the original request. Source-backed portions retain their basis rather than overwriting nutrient density with consumed quantities.

## Verification

See [R16 contract](../archive/implementation-phases/r16-contract.md) and the [verification record](../verification/README.md) for accepted commands and failures corrected. A local automated journey does not establish human usability or medical suitability.
