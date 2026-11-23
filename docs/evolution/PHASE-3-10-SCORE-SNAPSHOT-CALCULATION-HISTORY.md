# Evolution Phase 3.10 — Score Snapshot & Calculation History

## Scope

Phase 3.10 persists the output of the Phase 3.9 deterministic scoring contract as an immutable, versioned historical snapshot. It does not replace the 3.9 calculator, modify legacy score records, add an evaluation UI, or deploy a production migration.

## Snapshot contract

Each snapshot stores:

- Exact evaluation context, team, player membership/user, historical role-assignment snapshot and canonical role key.
- Exact rubric version and historical role-weight-set version.
- Calculation engine version (`deterministic-scoring-v1`) and policy version (`deterministic-scoring-policy-v1`).
- Canonical raw input JSON: context and role snapshot, rubric lifecycle/effective dates and criteria, dimension-definition versions, rating anchors, role weights, current assessment revisions/states/ratings/reasons, evidence identities/statuses/current evidence-version references and the corresponding immutable evidence content metadata.
- Final/provisional/insufficient status, score/coverage values, exact rational score numerator/denominator where a candidate is eligible, dimension/evidence counts and machine-readable reasons.
- Calculation actor and timestamp.
- For recalculations, the immediately previous snapshot ID and a required 3–1000 character reason.

## Determinism and history

- The server RPC recalculates from the exact context, rubric, role-weight set, current assessment revisions and current evidence verification/version state.
- The input fingerprint is generated from canonical JSONB. An identical fingerprint returns the existing snapshot (idempotent retry).
- A changed input creates a new immutable row linked to the previous snapshot. Recalculation requires an explicit reason.
- A transaction-scoped advisory lock serializes calculation attempts for one evaluation context; the unique context/version/fingerprint constraint is the final duplicate-side-effect guard.
- Historical rows never update in place. A correction cannot rewrite the prior score or its raw input snapshot.
- Final scores populate only final-score columns. Provisional candidates populate only provisional columns. Insufficient inputs populate neither.
- The 50% coverage gate, 0–10 weighted average × 10 normalization, integer half-up rounding and evidence eligibility are pinned to the Phase 3.9 policy version.
- Not Observed, Missing, Incomplete, Rejected Evidence and unverified evidence remain distinct. Tournament kills, placement, Booyah and match outcomes are not inputs.

## Security and data integrity

- Additive migration creates a dedicated snapshot table; it does not rewrite or backfill legacy evaluation or score tables.
- Team and entity ownership are enforced by composite foreign keys to the exact context, rubric, weight set and role snapshot.
- Only active team owners/coaches can read score snapshots.
- Authenticated clients have no direct insert/update/delete privileges. The guarded SECURITY DEFINER RPC is the only insert path.
- A trigger rejects snapshot updates/deletes and verifies that a previous snapshot belongs to the same team and evaluation context.
- Private evidence authored by another member causes the calculation to fail closed; the RPC does not copy inaccessible private content into a snapshot.

## Files

- Migration: `supabase/migrations/20261122200000_evolution_phase_three_10_score_snapshot_history.sql`
- PostgreSQL integration: `scripts/verify-evolution-phase-three-10-db.sh`
- Source-contract tests: `scripts/verify-evolution-phase-three-10.mjs`
- RPC: `public.calculate_evolution_player_score_snapshot(uuid, text)`
- Snapshot table: `public.evolution_player_score_snapshots`

## Verification acceptance

The disposable PostgreSQL harness replays the additive migration twice and verifies:

1. A fully verified context persists a final score with exact historical raw inputs.
2. Repeating identical inputs returns the same snapshot ID.
3. Correcting an assessment without a reason is rejected.
4. A reasoned correction creates a child snapshot with a different score while the original snapshot remains unchanged.
5. At/above-threshold pending evidence produces a provisional candidate only.
6. No observed evidence produces an insufficient snapshot with no final or provisional score.
7. Snapshot update/delete and direct authenticated insert are denied; anonymous reads are denied.
8. Team, context, rubric, role-weight and role-snapshot bindings remain exact.

The normal npm build chain includes the Phase 3.10 source-contract suite. GitHub Actions runs the disposable PostgreSQL acceptance harness before the complete typecheck/regression/production-build chain.

## Explicit exclusions

No production migration, production data write, legacy backfill, score conversion, data reset, merge to main, production deployment or new UI surface is part of Phase 3.10.


## Verification result

**IMPLEMENTED AND VERIFIED — exact code PR head `5097e581594761b3c46ac79cd8034e2ec6aeeda1`.**

- GitHub Actions PR workflow [#45073773602](https://github.com/parnav09/Free-fire-Squad-/actions/runs/45073773602): **SUCCESS** on the exact code head.
- GitHub Actions push workflow [#45073771107](https://github.com/parnav09/Free-fire-Squad-/actions/runs/45073771107): **SUCCESS** on the same commit.
- Phase 3.10 source-contract suite: **17/17 PASS**, 0 failures.
- Phase 3.10 disposable PostgreSQL harness: **PASS**. The migration applied twice; final score persistence, same-input idempotency, required reason for changed inputs, linked recalculation history, prior-snapshot immutability, provisional-only score, insufficient/no-score output, and snapshot write/visibility ACLs passed.
- Phase 3.2–3.8 database integrations, applicable Phase 2 database/security checks, responsive UI/touch-target/permission/offline-write acceptance, TypeScript typecheck, full repository regression suite and Vite production build: **PASS**.
- No production migration, production data write, legacy backfill, data reset, merge to main or production deployment occurred.
