# Evolution Phase 2.7 — Substitution Tracking

**Blueprint mapping:** Evolution Version 2, §38.7 Point 2.7 — Substitution Tracking  
**Branch:** `feat/evolution-phase-two-7-substitution-tracking`  
**Parent:** `feat/evolution-phase-two-6-role-snapshot`  
**Scope:** match-level outgoing/incoming identity, ordered substitution history, immutable lineup reconstruction, and separate role-transfer audit.

## Contract

A substitution is one atomic replacement within one canonical match and one locked session roster. The outgoing participant must currently be `participated`; the incoming roster member must be selected/confirmed and must not already be active in that match. The operation changes outgoing participation to `substituted` and incoming participation to `participated` through the existing audited Point 2.5 participation RPCs.

## Stored facts

- `canonical_session_substitutions`: one append-only event per replacement, with sequence number, outgoing/incoming roster and player UUIDs, effective match/round context, reason/category, source provenance, actor, idempotency key, and before/after lineup snapshots.
- `canonical_session_substitution_role_transfers`: a separate append-only record when the caller explicitly requests role transfer. It links the outgoing and incoming role assignments to the Point 2.6 role-change event and preserves role definition ID/name/version.
- `reported_effective_at` preserves the supplied time. `effective_at` is the committed timeline time; when a role transfer is requested it is no earlier than the incoming role snapshot's creation time, so role and lineup snapshots remain temporally consistent.

## Behavior and invariants

1. The RPC is team/session/match scoped and serialized on the canonical session and match.
2. Substitutions are allowed only while the session is `in_progress` or `awaiting_results`.
3. Owner/Coach authorization is checked server-side; Player cannot record substitutions.
4. Incoming and outgoing players must be different members of the same immutable session roster.
5. No already-active incoming player is accepted; no non-active outgoing player is accepted.
6. Multiple substitutions are sequenced per match; effective times cannot move backwards.
7. Participation changes and substitution event creation occur in one database transaction. A failure rolls back all changes.
8. Exact retries return the original substitution. Reusing an idempotency key with changed input is rejected.
9. Role transfer is opt-in and separate from replacement. It requires an assigned outgoing role whose definition is still current/active; unknown, unmapped or retired roles are never guessed.
10. Before/after lineup snapshots make the active lineup reconstructable before the first substitution and after every substitution. `get_canonical_session_match_lineup` resolves the lineup at a requested timestamp.
11. Substitution and role-transfer records are append-only; direct client writes and deletes are revoked.
12. Historical participation, role snapshots, and sessions are not backfilled or rewritten.

## Verification

- Source-contract tests: `scripts/verify-evolution-phase-two-7.mjs`
- Disposable PostgreSQL integration: `scripts/verify-evolution-phase-two-7-db.sh`
- Integration chains the exact Point 2.2–2.6 parent database harness, applies the new migration, then exercises two ordered substitutions, re-entry, role transfer, as-of lineup reconstruction, idempotency/conflict, invalid overlap, authorization, RLS, direct-write denial, and closed-session immutability.
- Exact branch-head CI must pass all inherited Point 2.2–2.6 integrations, security ACL checks, typecheck, source contracts, character data checks, and production build.

## Scope boundary

Point 2.7 does not verify or correct match results (Point 2.8), integrate existing Scrims/Tournament/Training screens (Point 2.9), or add application UI. No live Supabase migration, PR merge, or Vercel production deployment is performed. Production rollout remains separately gated.
