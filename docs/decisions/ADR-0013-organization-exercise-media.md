# ADR 0013: Institution exercise ownership and private media

Date: 28 September 2026. Status: implemented locally; acceptance is recorded separately in the ledger.

## Context

The university product needs organization-scoped exercise authoring, direct demonstrations, reusable staff resources and private attachments. An organization-wide exercise means that organization only. A trainer's exercise is private until explicitly included in a published program for an authorized recipient. Existing published prescriptions must remain unchanged.

## Decision

Keep exercise metadata in the existing `organization_exercises.data` JSON document. Add `scope`, `body_parts`, `muscles`, `equipment_items` and immutable `media_asset` references. The server filters trainer-private catalog entries before publication and rejects edits by other members, including admins. New admin-created exercises default to organization scope; new trainer-created exercises are private. Existing exercises with no scope retain their previous organization visibility. Publication copies all authorized metadata into the existing immutable prescription; there is no second exercise-version service.

One `organization_assets` registry stores immutable file identity, owner membership, organization, purpose, MIME, size, digest and optional conversation ID. Bytes use the existing private file store. Uploads accept PNG/JPEG/WebP/GIF/MP4 (plus PDF for messages), validate signatures, reject executable formats, cap requests at 25 MB and use immutable IDs for safe uncertain retries. GET checks current authorization before serving bytes with no-store and nosniff. MP4 supports byte ranges for later native clients. No public storage URL or Supabase dependency.

Exercise assets are readable by their owner and by currently authorized organization library or published-version/session audiences. Resources lists only owned or organization-shared exercise assets. Archive stops new selections without breaking references already captured in exercises or published plans. Restore and archive are revision-checked durable commands. Message assets never appear in Resources.

## Options considered

- **Use public storage URLs or share assets across all organizations:** rejected because it would bypass current tenant and lifecycle authority.
- **Make every staff-created exercise organization-wide:** rejected because trainer-owned drafts and private material need a narrower scope.
- **Keep private immutable bytes behind the API and explicit owner/organization/published audiences:** selected; each byte read rechecks current authorization, and downloaded copies cannot be remotely erased.

Two-participant conversations have a permanent private-pair flag and fixed membership. Nonparticipant organization admins cannot discover, join, edit or read them. Group conversations retain explicit admin discovery/join; their UI describes this distinction. Message uploads are bound to one conversation and sender. A recipient cannot read an unsent upload; send verifies the exact conversation, sender and asset. Existing two-person organization conversations are backfilled as pairs. Existing independent-coaching resource sharing remains a separate compatibility contract.

## Consequences and maintenance

- Media remains server-authorized, not end-to-end encrypted. Downloaded bytes cannot be remotely erased from recipients' devices.
- Native clients can consume the same IDs and byte endpoint; native rendering, offline downloads and physical devices are not verified here.
- Do not overwrite assets or rewrite published prescription JSON when editing a library entry.
- Backup and orphan detection include every organization asset path/digest. Cross-reference foreign keys defer checks until the end of a workspace deletion transaction.
- The permission tests cover tenant isolation, creator-only library access, immutable upload retries, publication/assignment reads, pair-admin exclusion, unsent attachments, wrong-channel attempts and membership revocation.
- No remote upload provider, transcoder, general CMS or parallel messaging system is introduced. Production scanning, quotas and hosted storage belong to the hosting gate.
