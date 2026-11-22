# Evolution Phase 3.8 — Evidence Coverage Calculator

**Status:** Implemented; verification intentionally not run yet  
**PR:** #131 — consolidated Evolution Phase Three PR

## Calculation contract

- **Denominator:** every dimension in the exact historical role-weight set bound to the evaluation context. Current player role, current rubric, and non-applicable dimensions are never substituted.
- **Numerator:** applicable dimensions whose latest assessment is Observed and whose linked evidence is currently Pending, Verified, or Corrected. Rejected/archived evidence is not counted as observed coverage.
- **Formula:** observed applicable dimensions ÷ all applicable dimensions × 100.
- **Not Observed:** remains in the denominator and is not in the numerator. It is never changed into a numeric zero.
- **Not Applicable:** must already be excluded by the bound role-weight set; a coverage input cannot silently remove it.
- **Missing, Incomplete and Rejected Evidence:** remain separately counted and reduce coverage.
- **Evidence verification:** Verified and unverified (Pending/Corrected) observed dimensions are counted separately. Coverage can be 100% while status remains Partial if any evidence is unverified.

## Precision and status

- Coverage is rounded to the nearest 0.01 percentage point using integer basis points (10,000 = 100.00%); PostgreSQL and TypeScript use the same half-up integer rounding.
- **Complete:** all applicable dimensions are observed and every supporting evidence item is Verified.
- **Partial:** at least one applicable dimension is observed, but coverage is not Complete.
- **Insufficient:** no applicable dimensions exist or no applicable dimension has a valid Observed assessment.
- The percentage and status describe evidence coverage only. They are not a performance score, score eligibility promise, or tournament result.

## Reproducibility and integrity

- Calculation version: `evidence-coverage-v1`.
- Each snapshot stores exact dimension keys/definition versions, latest assessment revision/state, evidence IDs/statuses, denominator/numerator semantics, counts, percentage, status, and calculation version.
- Snapshots are append-only and team-scoped. Identical inputs are idempotent; a changed assessment/evidence state creates a new immutable snapshot.
- Only active team owners/coaches can request a calculation. Team members can read snapshots under RLS. Clients cannot directly insert, update, or delete snapshots.
- No score formula, score snapshot, tournament metric, UI control, or legacy backfill is introduced. Existing visual design and hitboxes are untouched.

## Implementation files

- `src/lib/evolution-evidence-coverage.ts`
- `supabase/migrations/20261122190000_evolution_phase_three_8_evidence_coverage_calculator.sql`
- `scripts/verify-evolution-phase-three-8.mjs`
- `scripts/verify-evolution-phase-three-8-db.sh`

## Verification

Not run in this implementation step by explicit instruction. Run the dedicated source and disposable PostgreSQL checks plus the full CI chain in the next verification step.
