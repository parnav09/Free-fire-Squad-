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
7. The Phase 2.12 contract is in the build chain. GitHub Actions branch triggers remain held until 1 December under the owner's earlier instruction; no workflow was edited to bypass that hold.
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

## Manual device/browser execution sheet

Run these scenarios only after the build and disposable database gates are available. Record browser/device, OS, viewport, tester, date, and a screenshot or video for every failure.

| Target | Viewport | Required checks | Status |
|---|---:|---|---|
| Android phone | 390 × 844 | No horizontal page overflow; create/filter/select a session; open details; use roster and match controls; verify 44px touch targets; test offline read-only warning | **Pending physical-device run** |
| Tablet portrait | 768 × 1024 | List/detail stack correctly; filters remain usable; no clipped actions; keyboard/accessibility focus remains visible | **Pending device/browser run** |
| Tablet landscape | 1024 × 768 | Two-column layout remains usable; no hidden detail actions; scroll regions do not trap content | **Pending browser run** |
| Laptop | 1280 × 800 | Full session workflow fits without horizontal overflow; forms and result panels remain readable | **Pending browser run** |
| Desktop | 1440 × 900 | Full workflow, audit history, filters and result controls remain aligned and reachable | **Pending browser run** |

Functional scenarios on each available target:
1. Owner/Coach can create a Training session and perform allowed lifecycle actions; Player cannot.
2. Search and each filter update the visible session list without stale selection or stale request results.
3. Roster selection/lock, participation, role assignment and substitution preserve the selected session/match context.
4. Result draft, submission, verification, rejection and correction expose the right states; unverified values never appear as official aggregates.
5. Offline mode is read-only, with no queued or silently replayed writes.
6. Keyboard-only navigation reaches every action in a logical order; focus remains visible; status/error messages are announced semantically.

No result is marked PASS until a real run and its evidence are attached.

## Acceptance evidence

| Gate | Current evidence | Status |
|---|---|---|
| Earlier source-contract suites | Full `npm run build` completed on exact PR head `18e65c418b9909c90a5c92d30b21b7841deb268c`; Vercel Preview reached READY | **PASS · exact-head source/build layer** |
| TypeScript + production bundle | Exact-head Vercel Preview `https://squad-aqzwijhu6-parnav09.vercel.app` reached READY; `tsc --noEmit` and Vite production bundle completed | **PASS · exact PR head** |
| Phase 2.10 source contract | Included in successful exact-head `npm run build`; source-level assertions only | **PASS (source contract only)** |
| Phase 2.10 PostgreSQL integration | Latest associated run `44727576628` failed before runner steps; job has no step output/logs | **BLOCKED** |
| Phase 2.11 source contract | Included in successful exact-head `npm run build`; source-level assertions only | **PASS (source contract only)** |
| Phase 2.12 regression source contract | 14/14 tests are registered in the exact-head build chain; full `npm run build` completed | **PASS (source/build layer only)** |
| Phase 2.11 browser/database end-to-end | No disposable/staging migration-backed environment was used | **NOT VERIFIED** |
| Android, tablet and desktop interaction QA | Source CSS hardening is present; manual Android, tablet and desktop interaction QA requires real device/browser interaction | **PENDING** |
| Historical snapshot and cross-module runtime regression | Requires disposable DB integration execution and representative authenticated flows | **PENDING** |

## Final acceptance blockers

1. Restore a working GitHub Actions runner execution path and obtain a successful isolated PostgreSQL replay for Points 2.2–2.10. The latest associated run #700 (ID `44727576628`) created a job but failed before runner steps; the job has no step output/logs. A failed job with no steps/logs is not evidence of database correctness. GitHub Actions branch triggers and executions remain held until 1 December under the previously stated restriction. No workflow edit or manual Actions dispatch was made.
2. Run authenticated end-to-end flows against a disposable/staging database using the exact staged migrations, including Owner/Coach/member permission boundaries and cross-team isolation.
3. After the Actions hold expires, enable the intended branch triggers through an approved workflow change and run the full database integration suite. Add and execute a true parallel-request contention test for source integration; the current advisory lock and idempotency checks are source/runtime harness guards, not proof of concurrent race behavior.
4. Complete manual Android, tablet and desktop QA by exercising the Sessions workspace on an Android phone, tablet-sized viewport, and desktop; record browser/device, viewport, scenarios, and outcomes.
5. Verify historical source mappings and snapshot immutability across existing Tournament, Scrim, Planning and Training records using disposable fixtures.

During the latest Phase 2.10 integrity review, a real gap was found: a task could reference a plan block while `plan_id` was NULL. The trigger now enforces the block's owning plan whenever `block_id` is set, and the disposable PostgreSQL harness includes a regression case for this. The earlier source contract and Vercel build passed on historical commits only. The newly added 12-group source assertions and UI focus/touch-target hardening require a fresh preview build; PostgreSQL assertions still await an allowed runner execution.

## Production boundary

- **No production migration, backfill, merge or production deployment** is performed by this point.
- Do not apply Phase Two migrations to the live Supabase project until the Phase One acceptance gates are cleared and the full Phase Two database/device acceptance evidence is recorded.
- This document deliberately remains **BLOCKED** until all required evidence is real and attached; source-level assertions cannot substitute for PostgreSQL integration or manual device QA.
