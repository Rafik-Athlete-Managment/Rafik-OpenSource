# ADR 0021: Institution workspaces are the supported web experience

Date: 17 October 2026  
Status: Accepted

## Context

The founder has confirmed that Rafik's web product now serves institutions. The standalone `/coach` workspace, independent account choice in local preview, and independent workspace setup expose the superseded gym-first experience and split coaching workflows across two navigation models.

## Decision

- Institution workspaces are the supported coaching, administration and athlete experience.
- Retire the standalone `/coach` route tree. Old `/coach` URLs redirect to the closest organization staff page, preferring a trainer context and then an administrator context. If no organization context exists, send the user to organization setup.
- Workspace setup creates organizations only. Local preview offers organization roles and the separate platform operator, not independent coach/client identities.
- Preserve legacy independent APIs and stored data during this UI transition. This decision does not migrate, merge or delete existing independent records. Any later data retirement requires a scoped migration and recovery plan.

## Consequences and trade-offs

- The application has one active tenant navigation model, and old links do not expose the retired coach screens.
- Old resource IDs are not carried into organization routes because independent and organization identifiers have different ownership and authorization. The user lands on the corresponding organization list instead.
- Existing standalone data remains stored but has no supported standalone web interface. Data migration or deletion remains a separate decision.
