# Evolution Phase 2.12 — Regression & Final Acceptance

**Blueprint mapping:** Evolution Version 2, Point 2.12  
**Branch:** feat/evolution-phase-two-12-regression-acceptance  
**Parent:** feat/evolution-phase-two-11-application-ui  
**OVERALL STATUS: BLOCKED** — development regression gate; final acceptance is not yet cleared.

## Scope implemented

- Registers Point 2.12 in the production build test chain.
- Adds a cross-point regression contract covering all Phase Two test registrations, migration ordering, disposable PostgreSQL CI wiring, the canonical Sessions UI RPC boundary, offline/permission fail-closed behavior, responsive/accessibility safeguards, and CI branch triggers.
- Adds explicit regression-matrix assertions mapped to all 12 acceptance groups in Blueprint Point 2.12.
- Hardens Sessions UI controls to a 44px minimum touch height and adds visible keyboard focus styling. This is source-level UI hardening, not a substitute for physical-device QA.
- Keeps Points 2.11 and 2.12 schema-free; no new migration is introduced.
- Makes the acceptance report explicit about evidence that exists versus evidence still missing.
- Keeps the database integration harness on a local disposable PostgreSQL 16 instance installed on the GitHub-hosted runner; no paid database branch or live Supabase operation is introduced.

## Regression coverage

The Point 2.12 contract is `scripts/verify-evolution-phase-two-12.mjs`, registered as `npm run test:evolution-phase-two-12` and included in `npm run build`.

It checks:
1. Every Phase Two point (2.1–2.12) remains in the build regression chain.
2. Canonical database migrations 2.2–2.10 remain present and ordered.
3. Earlier source-contract tests remain registered.
4. Disposable PostgreSQL integration harnesses for 2.2–2.10 remain wired into CI.
5. Phase 2.11 canonical UI RPC, permission, offline, and no-inferred-data safeguards remain present.
6. Responsive breakpoints, reduced-motion, and semantic accessibility states remain present.
7. CI triggers include this branch and the correct PR base branches.
8. The acceptance report cannot silently claim PASS while DB/device evidence is missing.

## Blueprint Point 2.12 — 12-group coverage matrix

| # | Required acceptance group | Existing automated coverage wired into Phase 2.12 | Runtime status |
|---|---|---|---|
| 1 | Canonical identity uniqueness and team isolation | 2.2 disposable DB harness: idempotent session creation, changed-payload rejection, cross-team mapping and RLS | **Not executed on current head** |
| 2 | Session-to-match parent/child integrity | 2.3 harness: parent/source/child backfill counts, source preservation, unique source mapping | **Not executed on current head** |
| 3 | Lifecycle transition and authorization matrix | 2.4 harness: transition ordering, optimistic version, idempotency, Player denial and audit | **Not executed on current head** |
| 4 | Historical roster immutability after roster edits | 2.5 harness: membership leave and IGN/slot edits do not rewrite snapshots | **Not executed on current head** |
| 5 | Role snapshot immutability and role changes across matches | 2.6 harness: immutable session snapshots, match-specific role changes and unknown/unmapped roles | **Not executed on current head** |
| 6 | Substitution ordering and lineup reconstruction | 2.7 harness: ordered substitution events, retry behavior and before/after lineup reconstruction | **Not executed on current head** |
| 7 | Result submission, verification, correction and aggregate eligibility | 2.8 harness: drafts excluded, verified results included, correction temporarily suspends only affected aggregate row | **Not executed on current head** |
| 8 | Idempotent retries and concurrent writes | Idempotency cases plus transaction-scoped advisory lock for source sync | **Parallel contention test still pending** |
| 9 | Migration forward/recovery and historical reconciliation | Forward migration harnesses, source/backfill reconciliation and documented reviewed rollback path | **Full-chain recovery replay pending** |
| 10 | Existing Scrims/Tournament/Training/Planning regression | 2.3/2.9/2.10 harnesses cover Scrim/Tournament mapping, Training mapping and explicit Planning-to-Training promotion | **Authenticated end-to-end regression pending** |
| 11 | RLS and adversarial cross-team access | Disposable harnesses contain negative cross-team and Player/staff permission cases | **Execution on current head pending** |
| 12 | Android/mobile, tablet, desktop responsive and accessibility QA | Responsive breakpoints, reduced motion, 44px touch controls, visible keyboard focus and semantic status alerts | **Manual device/browser QA pending** |

The new Point 2.12 source tests assert that these cases remain present. They do not claim that the database scripts have executed successfully on the current PR head.

## Acceptance evidence

| Gate | Current evidence | Status |
|---|---|---|
| Earlier source-contract suites | Historical full build completed on `271c1e3eb1764802ea6660538bf1a28eb82eb5ec`; this is not the current PR head | **Historical PASS; exact-head rerun pending** |
| TypeScript + production bundle | Historical Vercel Preview for `271c1e3eb1764802ea6660538bf1a28eb82eb5ec` reached READY; current PR head is `b228d37531727eaf2747ef4d5c014dc6d17cf30f` and has no matching Vercel deployment record | **Historical PASS; exact-head build pending** |
| Phase 2.10 source contract | 4/4 passed on exact preview commit `271c1e3eb1764802ea6660538bf1a28eb82eb5ec` | **PASS (source contract only)** |
| Phase 2.10 PostgreSQL integration | Latest associated run `44727576628` failed before runner steps; job has no step output/logs | **BLOCKED** |
| Phase 2.11 source contract | 6/6 passed on exact preview commit `271c1e3eb1764802ea6660538bf1a28eb82eb5ec` | **PASS (source contract only)** |
| Phase 2.11 browser/database end-to-end | No disposable/staging migration-backed environment was used | **NOT VERIFIED** |
| Android, tablet and desktop interaction QA | Source CSS hardening is present; manual Android, tablet and desktop interaction QA requires real device/browser interaction | **PENDING** |
| Historical snapshot and cross-module runtime regression | Requires disposable DB integration execution and representative authenticated flows | **PENDING** |

## Final acceptance blockers

1. Restore a working GitHub Actions runner execution path and obtain a successful isolated PostgreSQL replay for Points 2.2–2.10. The latest associated run #700 (ID `44727576628`) created a job but failed before runner steps; the job has no step output/logs. A failed job with no steps/logs is not evidence of database correctness. GitHub Actions is not to be rerun before the previously stated 1 December restriction expires.
2. Run authenticated end-to-end flows against a disposable/staging database using the exact staged migrations, including Owner/Coach/member permission boundaries and cross-team isolation.
3. Add and execute a true parallel-request contention test for source integration; the current advisory lock and idempotency checks are source/runtime harness guards, not proof of concurrent race behavior.
4. Complete manual Android, tablet and desktop QA by exercising the Sessions workspace on an Android phone, tablet-sized viewport, and desktop; record browser/device, viewport, scenarios, and outcomes.
5. Verify historical source mappings and snapshot immutability across existing Tournament, Scrim, Planning and Training records using disposable fixtures.

During the latest Phase 2.10 integrity review, a real gap was found: a task could reference a plan block while `plan_id` was NULL. The trigger now enforces the block's owning plan whenever `block_id` is set, and the disposable PostgreSQL harness includes a regression case for this. The source contract and full Vercel build pass; the database assertion still awaits a runner that starts.

## Production boundary

- **No production migration, backfill, merge or production deployment** is performed by this point.
- Do not apply Phase Two migrations to the live Supabase project until the Phase One acceptance gates are cleared and the full Phase Two database/device acceptance evidence is recorded.
- This document deliberately remains **BLOCKED** until all required evidence is real and attached; source-level assertions cannot substitute for PostgreSQL integration or manual device QA.
