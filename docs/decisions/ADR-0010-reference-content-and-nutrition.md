# ADR 0010: Owned reference content and actionable nutrition

Status: accepted for the local web/API build, 23 September 2026.

## Problem

The nutrition screen hid numeric targets and required manual nutrient entry. Exercise guidance left the app through optional external links. Adding a large third-party service or copying unverified media would increase operational and licensing complexity without fixing those workflows.

## Decision

Keep the existing Vue, explicit HTTP API, Prisma/PostgreSQL and immutable snapshot model. Import a reviewed, versioned reference-content subset at maintenance time; no provider request, API key, upstream CDN or third-party user-data transfer occurs during normal use.

- USDA FoodData Central SR Legacy supplies 15 reference foods, source calories and protein/carbohydrate/fat per 100 g, verified portion weights and original record provenance. Arabic names are Rafik editorial metadata. It is a starter reference library, not a complete regional/branded food database.
- Workout Guide supplies 30 unchanged SVG poses for 10 exact shared exercise matches, under CC BY-SA 4.0. Keep full attribution, source pin, hash, dimensions and derivative lineage. Application code is separate from asset licensing. Three reference poses are not a cadence-accurate animation or technique certification.
- Backend content files are canonical. The content generator produces the web manifest, static media and credits alongside existing sample/seed outputs. The web shell precaches the bounded static illustration pack; the API exposes the same manifest/bytes for a future native client. No native implementation is claimed.
- Public catalogs contain reference content only. Private exercise uploads, coach/client records and organization content never enter these endpoints or the static cache.
- `exercises.media_ref` identifies an immutable media key. Publication and started-session snapshots capture it. Shared-plan copies preserve it. Custom exercise edits can select a reviewed illustration or an HTTPS demonstration link. Old shared starter snapshots can use the fixed first-pack mapping as reference enrichment; their stored prescriptions are not rewritten. Future replacements receive a new key and old bytes remain available.
- `nutrition_guidance.meals` is a bounded array of up to 20 food suggestions with name, meal, amount, basis, unit, nutrients and source. Suggestions are part of an immutable guidance version; they do not create actual diary entries. The trainee copies a suggestion into an editable meal draft and explicitly saves actual consumption.
- Numeric targets are visible. The optional macro allocation helper converts a coach-selected calorie budget and chosen percentages using general 4/4/9 factors. It does not estimate personal energy needs. Food calories remain the source value, because food-specific energy factors differ.
- Nutrition writes use the existing persisted command mechanism. Context-specific drafts isolate clients and dates/visibility. Unknown responses lock editing until exact replay resolves the outcome. Unit changes clear incompatible nutrient values.

## Alternatives and consequences

The user-suggested hasaneyldrm GIFs are excluded from that repository's MIT grant and require separate Gym visual rights. Untraceable scraped photos and runtime hotlinks are rejected. Wger, Liftosaur, OpenNutriTracker and similar apps inform interaction patterns; their application code is not imported. Barcode lookup, a larger localized food catalog, personalized calorie estimation, clinical diets and automatic progression are not added by this decision.

Institution exercise authoring uses the same catalog and presentation. Nutrition continues to belong to the existing independent coach/client relationship domain; these records must not be exposed as organization records. An organization nutrition service needs its own ownership/assignment/consent lifecycle and is explicitly outstanding.

See the [research synthesis](../archive/open-source-research-2026-09.md), [content maintenance guide](../reference/content-maintenance.md), [API reference](../reference/api.md) and [verification](../verification/README.md).
