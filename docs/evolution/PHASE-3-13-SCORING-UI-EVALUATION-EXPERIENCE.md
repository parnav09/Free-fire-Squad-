# Evolution Phase 3.13 — Scoring UI & Evaluation Experience

## Scope

This point adds the canonical, staff-operated evaluation workflow on top of the Phase 3.2–3.12 data and authorization contracts. It does not replace the legacy daily-evaluation form or convert historical rows.

## Workflow

1. Select an existing canonical session, canonical match and assigned historical player-role snapshot. Unknown/unmapped roles are not inferred from the current roster.
2. Create an immutable evaluation context and bind the exact active/effective rubric version and matching active/effective role-weight set.
3. Record a dimension assessment against the exact rubric definition version. An Observed rating requires dimension-linked evidence; Not Observed, Incomplete and Rejected Evidence require a reason. Zero remains a valid observed rating.
4. Record evidence provenance and visibility. Verification is a separate owner/coach RPC action; an author cannot verify their own evidence, and private evidence cannot be adjudicated by another member.
5. Calculate evidence coverage and the deterministic score through the existing database RPCs. The UI does not calculate or override a score locally.
6. Display readiness, coverage, final/provisional/insufficient score state and immutable calculation history. Recalculation requires a reason.

## Safety and data boundaries

- No tournament placement, kills, Booyah or match points enter the internal player score.
- No current roster role is used in place of the exact historical match-role snapshot.
- No legacy evaluation data is converted, deleted or backfilled.
- No fake rubric, sample score, evidence or default production data is seeded.
- Missing active rubric/weight configuration blocks creation with an actionable message.
- Database RLS, immutable event triggers and RPC authorization remain authoritative.
- No production migration, live data write, merge to main or production deployment is performed by this UI point.

## Verification

The dedicated source-contract suite verifies canonical match/role binding, version-pinned rubric/weights, evidence linkage, append-only assessments, verification/scoring RPC usage, history/readiness UI and responsive hitbox rules. The consolidated build also runs the existing typecheck, all regression tests, responsive UI acceptance and production bundle build. The point is VERIFIED only on the exact latest PR head after GitHub Actions succeeds.
