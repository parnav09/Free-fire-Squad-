# Evolution Phase 2.5 — Session Roster Snapshot

**Blueprint mapping:** Evolution Version 2, §38.5 Point 2.5 — Session Roster Snapshot  
**Branch:** `feat/evolution-phase-two-5-session-roster-snapshot`  
**Parent:** `feat/evolution-phase-two-4-session-lifecycle`  
**Scope:** immutable team/session roster identity snapshot, configurable roster policy, selection confirmation, and actual per-match participation.

## 1. Contract

Point 2.5 preserves the people who were eligible and selected for a canonical session at a specific roster-lock time. A current team roster is not a historical source of truth.

The roster is locked by an active Owner or Coach while the canonical session is Draft or Scheduled. The snapshot captures every active team member with a configured player slot within the team's roster capacity. Each entry records:

- Player UUID (`team_members.user_id`) as the stable player identity.
- Membership UUID (`team_members.id`) as provenance for the exact membership that existed at lock time.
- Display name/IGN, player slot and membership role as immutable snapshots.
- Selection state: Available, Invited, Selected or Confirmed.

The player UUID and membership UUID are stored as historical values, not foreign keys to `team_members` or `auth.users`. The existing `leave_team()` flow physically deletes a membership row; the snapshot must not cascade or disappear when that happens. A later IGN or slot edit likewise does not rewrite the captured values.

## 2. Configurable team/session policy

`canonical_session_roster_policies` stores a policy per team and session type (`scrim`, `tournament`, `training`):

- Minimum selected players.
- Maximum selected players.
- Whether the full configured roster is required.

`configure_canonical_session_roster_policy` is an Owner/Coach SECURITY DEFINER RPC; direct table INSERT/UPDATE privileges are withheld so the capacity validation cannot be bypassed. It validates the policy against the team's existing `roster_capacity` setting (with the existing fifth-player/default capacity behavior as fallback). There is no hard-coded four-player session rule.

The locked roster header stores the team capacity and session-type policy values that were effective at lock time. Later team setting or policy changes cannot rewrite that historical configuration.

## 3. Snapshot and selection APIs

Migration: `supabase/migrations/20261119180000_evolution_phase_two_5_session_roster_snapshot.sql`

- `lock_canonical_session_roster`: locks one roster per canonical session, validates selected/invited membership IDs against the active eligible roster, snapshots all eligible players, and supports idempotent retry. Reusing the idempotency key with a changed payload is rejected. A second independent lock is rejected.
- `set_canonical_session_roster_member_status`: supports Available → Invited/Selected, Invited → Selected/Confirmed, and Selected → Confirmed. Backwards or invalid transitions are rejected. Every change is reasoned and audited.
- A snapshot cannot be locked after the session starts, closes, cancels or archives. It can be locked while Draft or Scheduled.

Roster identity columns and the roster header are immutable after creation. Selection status is mutable only through the guarded RPC. Direct API writes are blocked by a private trigger guard.

## 4. Per-match participation

`canonical_session_match_participants` stores one row per player per canonical match. The composite foreign keys require the match and roster member to belong to the same team and canonical session. A unique key prevents duplicate player participation for one match.

Supported match states:

- `participated`
- `absent`
- `substituted`

`record_canonical_match_participation` records the initial state for a selected/confirmed roster member during In Progress or Awaiting Results. Retries with the same key/payload are idempotent. A second conflicting record is rejected.

`correct_canonical_match_participation` requires a reason and a new idempotency key. Corrections are append-only audited. Closed, cancelled and archived sessions are read-only. The participation record can mark a player as substituted, but does not invent the incoming/outgoing substitution relationship; the ordered substitution timeline and role transfer belong to Point 2.7.

Per-match participation is recorded only where a canonical match identity exists. The current canonical match source model has Scrim and Tournament match children; this migration does not fabricate Training match rows or attendance for legacy Training sessions.

## 5. Audit, RLS and preservation

- Active team members can read their team's roster snapshot and match participation.
- Only active Owners/Coaches can configure policies, lock rosters, change selection states, record participation or correct it.
- Roster and participation audit events are staff-readable and append-only.
- API roles cannot directly insert/update/delete audit events.
- No client DELETE grant exists for roster snapshots, roster members or participation rows.
- Private trigger functions use an empty search path and are not directly executable by API roles.
- Membership provenance survives physical membership deletion. Player UUID, captured display name and slot survive current IGN/slot changes.
- No historical roster or participation rows are fabricated during migration. Existing canonical sessions remain without a roster snapshot until an authorized explicit lock is performed.

## 6. Verification

Source-contract suite: `scripts/verify-evolution-phase-two-5.mjs`  
Disposable PostgreSQL integration: `scripts/verify-evolution-phase-two-5-db.sh`

The database harness first runs the exact Phase 2.2, 2.3 and 2.4 migration/integration chain, then applies the Point 2.5 migration. It verifies:

- No historical roster snapshot is fabricated.
- Capacity and session-type policy configuration, including a non-four-player training policy.
- Full eligible-roster capture and selected/invited/confirmed states.
- Duplicate, ineligible, cross-team and conflicting idempotency input rejection.
- Roster lock and selection transition guards.
- Per-match participation uniqueness, retry behavior and correction audit.
- Player write denial and cross-team RLS isolation.
- Historical identity/participation preservation after IGN/slot edits and physical membership deletion.
- Append-only audit privileges, private trigger ACLs and no client DELETE.
- TypeScript, all inherited source-contract suites and the production Vite bundle through the standard CI build.

The point is not marked PASS until the exact branch-head workflow completes successfully with the PostgreSQL integration, inherited Phase 2.2–2.4 integrations, Foundation contracts, Character Data checks, TypeScript and production build all green.

## 7. Scope boundaries and rollout

- Point 2.5 does not implement the role actually played; that is Point 2.6.
- Point 2.5 does not implement an ordered incoming/outgoing substitution timeline or role transfer; that is Point 2.7.
- Point 2.5 does not replace existing Scrims/Tournament/Training UI adapters; the blueprint assigns module adapter and archive/retention integration to Point 2.9.
- No live `squad-os` Supabase migration or production data backfill is performed.
- No Vercel production deployment, branch merge or production promotion is performed.
- The stacked development PR remains Draft/unmerged. Production rollout remains gated on Point 2.9 and separate rollout approval/rehearsal.
