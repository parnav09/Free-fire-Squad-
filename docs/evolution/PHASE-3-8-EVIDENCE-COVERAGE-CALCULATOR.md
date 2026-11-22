# Evolution Phase 3.8 — Evidence Coverage Calculator

**Status:** IMPLEMENTED AND VERIFIED — final full workflow #45060733258 succeeded on code head `65c8c5daebb5d93b05916c87ba008738a853b79c`  
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


## Verification evidence

- Exact PR head: `e514de2d9317948fd77069cfb7a7422904ce715b`
- GitHub Actions run #45060071552: **SUCCESS** — https://github.com/parnav09/Free-fire-Squad-/actions/runs/45060071552
- Phase 3.8 migration applied twice in the isolated disposable PostgreSQL database without error.
- Database integration result: `Evolution Phase 3.8 evidence coverage calculator PostgreSQL PASS`.
- Source-contract tests: **8/8 PASS**.
- TypeScript typecheck, full repository test/build chain, responsive UI/touch-target/permission/offline-write acceptance, screenshot artifact upload and Vite production build: **PASS**.
- PostgreSQL checks exercised idempotent repeat calculation, snapshot output, immutable update/delete rejection, and restricted table ACLs.
- Existing non-fatal Vite large-chunk warning (383.56 kB main JS chunk), `punycode` deprecation and GitHub Actions Node 20 action deprecation warnings remain.
- Separate Vercel status is **FAILURE** due build-rate-limit. This is not a GitHub Actions test failure; Vercel Preview is not verified by this run.
- No production migration, data reset, merge to main or production deployment.


### Follow-up verification and consistency fix

A manual cross-implementation review found a mismatch: PostgreSQL treated Observed assessments backed by rejected/archived (or absent) evidence as rejected-evidence coverage, while the TypeScript helper rejected the input instead of producing the same counts. The TypeScript calculator now mirrors the SQL classification; source tests cover rejected, archived and absent evidence, while unknown evidence states still fail closed.

- Follow-up full workflow #45060733258: **SUCCESS** on code head `65c8c5daebb5d93b05916c87ba008738a853b79c`.
- Phase 3.8 source-contract tests: **8/8 PASS**.
- Phase 3.8 disposable PostgreSQL migration replay and integration: **PASS**.
- Full TypeScript, all repository test suites, responsive UI/touch-target/permission/offline-write acceptance, screenshot artifact and production build: **PASS**.
- Non-fatal warnings remain: main JS bundle exceeds 250 kB (383.56 kB in the previous identical build), `punycode` deprecation, and GitHub Actions Node 20 action deprecation.
- Vercel Preview is separate from this GitHub Actions workflow and remains unverified due the earlier build-rate-limit failure.
