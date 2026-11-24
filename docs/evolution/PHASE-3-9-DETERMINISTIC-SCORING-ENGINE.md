# Evolution Phase 3.9 — Deterministic Scoring Engine

## Scope

Point 3.9 turns the exact historical evaluation context, published rubric, role-weight set and current assessment/evidence dispositions into a reproducible internal player-performance score. It is a pure calculation layer: it does not write score snapshots, migrate production data, backfill legacy scores or add a UI. Persistent score snapshots and their history belong to the following point.

## Canonical formula

The Evolution v2 blueprint defines:

`canonical_score_100 = weighted_average(valid_dimension_scores_0_to_10) × 10`

For each eligible Observed dimension:

- The rating must be an integer from 0 through 10. Zero is a valid observed rating.
- Evidence must belong to the exact evaluation context and dimension-definition version.
- Pending, Verified and Corrected evidence can contribute to a candidate calculation. Rejected, Archived, missing or mismatched evidence cannot.
- The weighted numerator is `sum(rating × historical_weight_basis_points)`.
- The score denominator is the sum of weights for eligible Observed dimensions only. Thus weights are normalized over the dimensions actually rated.
- Not Observed stays in the coverage denominator, but is excluded from the score denominator and is never converted to zero.

The exact score fraction in hundredths is retained as `exactScoreNumerator / exactScoreDenominator`; the displayed 0–100 score is rounded to two decimal places using integer half-up rounding. This avoids floating-point drift and preserves deterministic recomputation.

## Versioned policy v1

- Minimum evidence coverage: **50.00%** (5,000 basis points) of all dimensions applicable to the exact historical role.
- Below the gate: status is Insufficient and neither a final nor provisional score is exposed.
- At or above the gate with any missing, incomplete, rejected or unverified disposition: status is Provisional. The candidate is exposed only as `provisionalScore100`; `score100` remains null.
- Final requires the coverage gate, at least one eligible observed dimension with non-zero observed weight, and Final assessment readiness. All observed evidence must be Verified; all other applicable dimensions must have an explicit valid disposition. Not Observed is permitted only with its required reason.
- Not Applicable is not accepted inside the bound weight set; the historical role-weight configuration must already exclude it.
- The policy is versioned as `deterministic-scoring-policy-v1`; a future threshold or rounding-policy change must create a new policy version rather than silently changing historical results.

## Historical integrity and fail-closed rules

- The weight set must bind the exact evaluation context, rubric version, role-assignment snapshot and historical role key.
- Rubric and weight-set versions must have been effective when the context was created. Active versions cannot have an end date; retired versions must have one.
- Every applicable rubric dimension must appear exactly once in the bound role-weight set; weights are integer basis points totaling exactly 10,000.
- Assessment and evidence dimension-definition versions must match the exact rubric criterion.
- Duplicate assessments, duplicate weights, reused evidence identities, unknown states, invalid ratings, invalid reasons and malformed bindings fail closed.
- Tournament kills, placement, Booyah, match points and match outcomes are not inputs to this engine. This is a player-development score, not a tournament result.

## Implementation

- Engine: `src/lib/evolution-deterministic-scoring.ts`.
- Tests: `scripts/verify-evolution-phase-three-9.mjs`.
- No SQL migration is required: this point is a deterministic, read-only calculation over immutable inputs. No database writes or score snapshots are introduced.
- Added the test to `npm run build` and the consolidated GitHub Actions workflow.
- Existing app UI, dark theme, layout, permissions and offline behavior are unchanged.

## Acceptance

The executable suite covers the canonical formula, 0 and 10 boundaries, Not Observed vs zero, the 50% gate, provisional vs final states, verified vs unverified evidence, missing/incomplete/rejected data, exact historical bindings, dimension versions, lifecycle dates, duplicate identities, invalid input, half-up rounding, exact rational precision and deterministic repeatability. The full PR workflow additionally runs TypeScript, the complete existing regression suite, responsive UI/touch-target/permission/offline-write acceptance and the Vite production build.
