# Architecture overview — M1

## Current implementation boundary

M1 creates the web application shell and establishes project conventions. It does not implement tournament workflows, authentication screens, offline persistence, or analytics yet.

## Product invariants

1. One fixed squad workspace; no daily team creation.
2. Weekly tournament cycles run Monday–Sunday, with six scheduled tournament matches per day.
3. Sunday close-out and next-cycle registration are distinct workflows.
4. Next-week registration is a draft copied from the previous roster and requires human review and explicit submission.
5. Practice match records must never be mixed into official tournament totals.
6. Configurable, versioned scoring rules; pending/disputed match results are excluded from verified totals.
7. P1–P4 roles are fixed as previously defined; P4 is IGL. P5 remains unassigned until the organizer defines the role.
8. Reviewer-entered communication ratings only; no claim of automatic voice-chat listening or transcription.

## Planned layers

- `src/app`: app shell, routing, providers and global guards.
- `src/features`: feature-owned UI, domain logic and data access.
- `src/lib/supabase`: browser client and generated database types.
- `src/lib/database`: local database and sync primitives.
- `src/types`: shared domain types.
- `supabase/migrations`: reviewed, additive schema migrations only.
- `docs`: product decisions, schema mapping, security and release notes.

## Data ownership

- Supabase is the shared cloud source of truth after authorization and sync rules are finalized.
- IndexedDB/Dexie is the local offline store.
- Each offline mutation will need a stable ID, ownership context, timestamps, sync state and conflict strategy.
- Large VOD files should remain external links where possible; store metadata and URLs, not large binary uploads by default.

## Database change gate

The existing Supabase project is read-only during M1. First map its actual columns, constraints, indexes, policies, functions and data ownership. Then produce a target schema and migration plan for user review. Do not run migrations or alter existing data until explicit approval.
