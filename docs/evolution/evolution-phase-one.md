# Evolution Phase One — Identity, Membership, Timezone

**Status:** STARTED — identity/timezone contract slice added; application integration and server-side timezone migration remain open.  
**Parent:** Evolution Phase Zero — Legacy Fixes (branch chore/evolution-phase-zero-one-naming, PR #114).  
**Branch:** feat/evolution-phase-one-identity-timezone  
**Scope:** stable Auth UUID, team membership identity, active membership selection, team timezone validation/date boundaries, session eligibility primitives, and permission-test helpers. Authorization/RLS/grants remain in the separate Security workstream.

## 1. Current repository findings

- Auth user identity is available from Supabase Auth as user.id.
- Team membership is represented by team_members.id, team_members.team_id, and team_members.user_id; membership_role and status describe the relationship.
- Team IDs and membership IDs are UUIDs. P1/P2 and display IGN are labels, not identity keys.
- teams.timezone already exists in the live schema inventory.
- Team creation currently calls create_team with p_timezone: "Asia/Kolkata".
- The live lock_daily_score_date_and_anonymize() trigger currently derives score dates using a hard-coded Asia/Kolkata timezone.
- The current loadTeam path loads active memberships and uses the saved preferred team ID; if that preference is absent/invalid, it falls back to the first active membership. The new contract helper deliberately refuses ambiguous multi-team selection without an explicit preferred team.
- The app currently has no canonical reusable identity resolver or validated team-timezone utility.

## 2. First implementation slice

Added src/lib/evolution-identity.ts:
- UUID validation for Auth, membership, and team IDs.
- Explicit Auth UUID → membership UUID → team UUID mapping.
- Active-membership filtering.
- Preferred-team selection.
- Fail-closed behavior for malformed IDs, duplicate membership rows, and ambiguous multi-team selection.
- IANA timezone validation.
- Team-local date formatting for display and deterministic boundary tests.

Important: the date formatter is not an authority for persisted records. Database triggers/RPCs remain authoritative until a reviewed migration makes the configured team timezone the server-side source of truth.

Added scripts/verify-evolution-phase-one.mjs with contract tests for identity mapping, labels-vs-IDs, active membership, multiple teams, duplicate membership ambiguity, timezone validation, and date-boundary behavior.

## 3. Hard blockers before completing Phase One

1. Migration provenance: the Phase Zero audit found live migration history that does not map cleanly to the checked-in migration directory. Do not add/apply a timezone-trigger migration until the live migration provenance is reconciled and a forward/rollback plan is reviewed.
2. Server-side timezone contract: the existing date trigger is hard-coded to India time. A client-only timezone selector would create inconsistent dates, so no editable timezone UI is exposed until the server trigger/RPC contract is safely updated.
3. Application integration: the resolver must be integrated into loadTeam and team-switch behavior with a deliberate team-choice state for accounts that have multiple active memberships. Do not silently choose the first team.
4. Session eligibility: no session roster snapshot is added here; Phase Two owns session/match/role snapshots. Phase One will provide only stable active-membership primitives.
5. Security boundary: no RLS, grants, SECURITY DEFINER functions, Auth settings, or privileged authorization changes are included in this Evolution phase. Client checks are not a security boundary.

## 4. Acceptance gate

Phase One is not complete until:
- Auth UUID, membership UUID, and team UUID are mapped consistently.
- Display labels/IGN/P1 labels are never accepted as IDs.
- Active membership is represented consistently and inactive membership is excluded.
- Multiple active teams require an explicit selection; ambiguous membership is not silently resolved.
- Configured IANA timezone is validated.
- Date-boundary tests pass for at least two different team timezones.
- Server-side persisted dates follow the configured team timezone after a reviewed migration.
- Session eligibility primitives are documented and tested.
- Separate Security workstream validates authorization independently.

## 5. Changes intentionally not made

- No Supabase schema, data, trigger, policy, grant, or function changes.
- No RLS or Auth security changes.
- No production deployment, merge, or data reset.
- No future Phase Two session/match/roster snapshot implementation.
- No unrelated app modules changed.
