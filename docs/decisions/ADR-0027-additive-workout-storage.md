# ADR 0027 — Additive workout storage before API cutover

Date: 23 October 2026. Status: accepted for the additive foundation.

## Context

Beta.3 combines scheduled training and workout results. Existing workout documents, correction history, feedback and Android receipts must survive. Current calendar consumers require timestamps; workout handlers require assignments.

## Options

- Replace event/workout tables: creates unnecessary identity and replay migration risk.
- Enable nullable timestamps/assignments immediately: breaks current handler assumptions before replacement services exist.
- Extend existing records in stages: preserves shipped contracts while introducing new identities.

## Decision

Use the staged extension. Add assignment cursors, bounded weekly recurrence rules and explicit sequence positions. Link workouts to scoped event participants and freeze historical sources from their documents. Preserve the existing assignment/day/date unique key. New tables remain server-only.

Keep required timestamps and assignments during this foundation slice. Do not invent appointments for historical day-based workouts or infer group links from dates. Occurrence backfill, day-only representations and assignment-free additional workouts require the coordinated API/domain-service cutover. Old completion counts do not automatically seed sequence progress.

## Trade-offs

This leaves some beta.3 storage transitions for the next slice, but avoids exposing unsupported shapes to existing clients. Constraints and row locking provide allocation foundations; transactional progression, authorization and worker concurrency still require implementation and verification. Restore matching backups for rollback rather than dropping history-bearing columns.
