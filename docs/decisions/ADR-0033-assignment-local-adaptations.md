# ADR 0033 — Adapt the athlete plan without copying its library program

Date: 26 October 2026. Status: implemented on the unreleased beta.3 branch; focused verification passed, founder/release acceptance remains. Founder requested direct athlete-plan adaptation distinct from program-library editing.

## Context

The shared editor previously initialized a new program for an assigned plan and published it into the library. That preserved the source but did not perform the action labelled adaptation. Regular library editing already writes the existing program ID; explicit duplication remains a separate action.

## Decision

Store a validated current adaptation snapshot on the existing institutional assignment: title, full prescription, source version ID and adaptation revision. Keep the immutable library version and assignment ID. Reuse the current plan authority, institution/assignment locks, assignment revision and exact operation receipts. Append before/after snapshots to institutional audit history. No new public catalog program or version is created by adaptation.

Future preparation resolves the assignment-local prescription. Keep the progression cursor and scheduling policy. The next position follows the adapted non-rest order at that cursor; reordering/removing days can change that future workout. Already materialized occurrences and started/completed records retain their frozen prescriptions, even when their original day ID no longer exists in the new plan. Bound starts use the occurrence snapshot. Corrections never retroactively adopt the new prescription.

Web editing uses an explicit Apply changes to athlete plan action and personalized-revision label. Local drafts and uncertain commands stay scoped to the assignment. Capture revision/source identity with the original command; never replace them with newer props during replay. Earlier saved library-copy operations retain their old command meaning and recovery path, separate from the new adaptation command. Explicit library copies are labelled as copies. Ignore mismatched-ID recovered drafts on ordinary library editing.

Adaptation validates catalog/media authority through the existing snapshot service. Authorized current-plan private media and covers gain explicit reference checks; assignment ownership alone does not broaden institutional or pair privacy. Existing audit, assignment, program-media and private-byte identities are retained through a forward nullable-column migration.

## Trade-offs and limits

The assignment points at its source library version and carries a separately labelled personalized snapshot rather than inventing another library version. Current revision reads are direct; detailed old snapshots remain in institutional audit history, not a new undo UI. No implicit sequence reset, occurrence rewrite or adaptation-to-library publishing is introduced. Existing accidentally published copies are not automatically deleted.

This change does not implement the planned event-composer picker for existing athlete-plan workouts, custom-event distinction, group prescriptions or Android offline workout capture. These remain the following beta.3 slices.
