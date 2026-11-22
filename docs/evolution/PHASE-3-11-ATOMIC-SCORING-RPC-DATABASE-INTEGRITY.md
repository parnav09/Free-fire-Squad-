# Evolution Phase 3.11 — Atomic Scoring RPC & Database Integrity

## Scope

Phase 3.11 closes the concurrency gap between the Phase 3.10 score calculator and writes that can change its inputs. A scoring calculation and every score-affecting evidence/assessment write now serialize on the same transaction-scoped advisory lock for the exact evaluation context.

## Atomicity contract

- The RPC acquires the shared evaluation-context lock before reading the context, rubric, weights, assessments or evidence.
- Evidence identity inserts acquire the context lock before the new evidence row can become visible.
- Evidence content-version inserts and evidence verification/status events acquire the same context lock through their parent evidence identity.
- Assessment revision events acquire the same context lock through their evaluation-context ID.
- The lock is transaction-scoped. It remains held through calculation and immutable snapshot insertion, and PostgreSQL releases it automatically on commit or rollback.
- A competing input write waits until the score transaction completes; a competing score calculation waits until the input write completes. A snapshot therefore represents one serialized committed input state, not a mixture of concurrent revisions.
- The RPC holds shared row locks on the exact context/role snapshot, active team membership authorization row, rubric version and role-weight-set lifecycle rows while calculating.
- The scoring RPC and all source-write triggers use the exact same lock key: `hashtextextended(evaluation_context_id::text, 31010)`.

## History and database integrity

- Added a partial unique index allowing at most one child snapshot per previous snapshot. This prevents a forked recalculation history chain independently of application code.
- Existing snapshot immutability, exact context/team foreign keys, idempotency uniqueness, status/score shape constraints, owner/coach RLS and authenticated-only RPC permissions remain intact.
- The lock helper and trigger functions are SECURITY DEFINER with an empty search path and no direct client execute grants.
- No legacy evaluation rows, evidence rows, or score snapshots are rewritten or backfilled.

## Files

- Migration: `supabase/migrations/20261122210000_evolution_phase_three_11_atomic_scoring_integrity.sql`
- PostgreSQL harness: `scripts/verify-evolution-phase-three-11-db.sh`
- Source-contract suite: `scripts/verify-evolution-phase-three-11.mjs`
- Shared lock helper: `evolution_private.lock_evaluation_context_for_scoring(uuid)`
- Scoring RPC: `public.calculate_evolution_player_score_snapshot(uuid,text)`

## Verification acceptance

The isolated database harness rebuilds the Phase 3.2–3.10 dependency chain, replays the Phase 3.11 migration twice, verifies all four score-input mutation triggers and their function ACLs, checks the RPC's shared lock and historical row locks, validates the single-child history index, and tests that the transaction-scoped lock blocks a concurrent attempt and releases at commit.

The source-contract suite is part of the normal npm build chain. GitHub Actions runs the isolated PostgreSQL harness before the complete typecheck, regression and Vite production build.

## Explicit exclusions

No production migration, production data write, legacy backfill, data reset, UI change, merge to main or production deployment is part of Phase 3.11.
