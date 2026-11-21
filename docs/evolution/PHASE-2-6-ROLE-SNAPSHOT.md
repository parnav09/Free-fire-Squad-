# Evolution Phase 2.6 — Role Snapshot

**Blueprint mapping:** Evolution Version 2, §38.6 Point 2.6 — Role Snapshot  
**Branch:** `feat/evolution-phase-two-6-role-snapshot`  
**Parent:** `feat/evolution-phase-two-5-session-roster-snapshot`  
**Scope:** team-owned versioned gameplay-role taxonomy, immutable session role snapshots, match-specific role snapshots, and an effective-time role-change audit.

## 1. Contract

Point 2.6 preserves the gameplay role a player was assigned for a particular session and the role they actually performed in each canonical match. A membership role (`owner`, `coach`, `player`) and a display slot (P1/P2/P3/P4) are not gameplay-role identity.

A player can have one role in the session roster and a different role in an individual match. A match-specific change never rewrites the session snapshot or another match's role.

## 2. Team role taxonomy

Migration: `supabase/migrations/20261119200000_evolution_phase_two_6_role_snapshot.sql`

`canonical_team_role_definitions` stores a team-owned role taxonomy with:
- Stable team-scoped `role_key`.
- Role ID, display name and optional description.
- Monotonically increasing definition version.
- Current/active state and provenance (legacy import or staff-defined).
- Creation actor and timestamp.

The migration imports only explicit, non-empty `team_members.assigned_role` labels. It does not infer a gameplay role from a player slot, membership role, character loadout, or name. Existing labels are imported as version 1 for that team. An absent assignment stays unknown; a non-empty label that has no taxonomy definition stays unmapped. The import does not infer roles from P1/P2/P3/P4 player slots.

Owner/Coach changes use `save_canonical_team_role_definition`. A change creates a new version; prior definition rows and role snapshots remain available. The RPC is reasoned, team-scoped, idempotent and audited in `canonical_team_role_definition_events`. Direct client writes are revoked.

## 3. Session role snapshot

The Point 2.5 roster-lock flow remains authoritative. A guarded trigger captures the current explicit `assigned_role` as part of each newly locked `canonical_session_roster_members` row:
- `role_definition_id_snapshot`
- `role_key_snapshot`
- `role_name_snapshot`
- `role_description_snapshot`
- `role_definition_version_snapshot`
- `role_assignment_status_snapshot`

Role states:
- `assigned`: matched to a versioned team role definition.
- `unknown`: no role was assigned.
- `unmapped`: an explicit legacy label exists but has no taxonomy definition.
- `retired`: the snapshot resolves to a role definition that is no longer active.

The snapshot is immutable. A later roster-role or taxonomy edit cannot change it.

No historical session or match role snapshots are backfilled during this migration. No historical session role is backfilled from today's roster. Existing roster snapshots receive the safe default `unknown`; this is not a claim that the player historically had no role. It means the historical role is not verified by a Point 2.6 snapshot and must not be guessed.

## 4. Match-specific role snapshot and timeline

`canonical_session_match_roles` stores at most one current role snapshot per player per canonical match. When a selected/confirmed roster member's participation is recorded as `participated`, the system copies that member's session role snapshot into the exact canonical match. If participation is corrected from `absent` to `participated`, the same snapshot process runs from the correction event. An absent or substituted-only record does not fabricate an active match role.

`set_canonical_session_match_role` lets an active Owner/Coach change the role for one player in one match. It requires:
- An existing participation record marked `participated`.
- An active session (`in_progress` or `awaiting_results`).
- A role definition that is current and active, or an explicit NULL to record unknown.
- An effective timestamp within the session's started interval.
- Optional round label, a non-empty reason and a new idempotency key.

The update preserves previous and new role IDs/names/versions in `canonical_session_match_role_events`, alongside the match, player, effective timestamp/round, actor, reason and idempotency key. Reusing a key with a changed payload is rejected. Exact retries return the original event.

A change in Match 1 does not update Match 2. Once a session is verified/closed/cancelled/archived, its role timeline is read-only. Substitution identity and incoming/outgoing linkage remain Point 2.7; role-transfer relationship remains Point 2.7; Point 2.6 does not implement a substitution timeline.

## 5. Security and integrity

- Team-scoped composite foreign keys tie role definitions, roster members, canonical matches and player identities to the same team/session.
- Active team members can read role definitions and match role snapshots for their team.
- Only active Owner/Coach members can create role definitions or change match roles.
- Role definition and match role audit events are staff-readable and append-only.
- Authenticated clients receive SELECT only; direct INSERT/UPDATE/DELETE is revoked.
- Private trigger functions are not executable by API roles.
- Historical membership/IGN/slot changes do not rewrite role snapshots.
- Role taxonomy versions are preserved; the current version is not substituted into already-locked sessions or matches.

## 6. Verification

Source-contract suite: `scripts/verify-evolution-phase-two-6.mjs`  
Disposable PostgreSQL integration: `scripts/verify-evolution-phase-two-6-db.sh`

The database harness runs the exact Phase 2.2–2.5 parent integration chain, then applies Point 2.6 to a disposable PostgreSQL database. It verifies:
- Explicit legacy role taxonomy import and version creation.
- No fabricated historical session or match role snapshots.
- Assigned, unknown and unmapped session-role snapshots.
- Role definition version updates without rewriting locked snapshots.
- Match-specific role snapshots, including absent-to-participated corrections.
- Different roles in different matches for the same player.
- Effective match/round/time context and append-only prior/new role events.
- Idempotent retries and conflicting-payload rejection.
- Owner/Coach authorization, Player denial and cross-team RLS isolation.
- Direct write/delete denial, trigger ACLs and closed-session immutability.
- Inherited PostgreSQL integrations, Foundation contracts, Character Data checks, TypeScript and production Vite build.

Point 2.6 is PASS only when the exact branch-head GitHub Actions run completes successfully with all these checks green.

## 7. Scope boundary and rollout

- This point does not implement incoming/outgoing substitutions or role transfer between players; that is Point 2.7.
- It does not verify/correct match results; that is Point 2.8.
- It does not connect Scrims/Tournament/Training module screens; that is Point 2.9.
- It does not add new application UI; the UI surface belongs to the later UI point.
- No live Supabase migration, production backfill, PR merge or Vercel production deployment is performed here.
- The migration is additive. Once role snapshots/events are written, recovery is forward-only; do not drop historical role data as a rollback shortcut.
- Production rollout remains gated on completion of Points 2.7–2.9 and separate rollout approval.
