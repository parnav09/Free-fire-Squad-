# Evolution Phase 2.12 — Regression & Final Acceptance

**Blueprint mapping:** Evolution Version 2, Point 2.12  
**Branch:** feat/evolution-phase-two-12-regression-acceptance  
**Parent:** feat/evolution-phase-two-11-application-ui  
**OVERALL STATUS: BLOCKED** — development regression gate; final acceptance is not yet cleared.

## Scope implemented

- Registers Point 2.12 in the production build test chain.
- Adds a cross-point regression contract covering all Phase Two test registrations, migration ordering, disposable PostgreSQL CI wiring, the canonical Sessions UI RPC boundary, offline/permission fail-closed behavior, responsive/accessibility safeguards, and CI branch triggers.
- Keeps Points 2.11 and 2.12 schema-free; no new migration is introduced.
- Makes the acceptance report explicit about evidence that exists versus evidence still missing.
- Keeps the database integration harness on a disposable PostgreSQL 16 service; no paid database branch or live Supabase operation is introduced.

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

## Acceptance evidence

| Gate | Current evidence | Status |
|---|---|---|
| Earlier source-contract suites | Full `npm run build` completed on exact preview commit `6f3dfd4436f0772d715ce91c7445c7e3d5c631d4`; all registered commands completed without stopping the build | **PASS (source/build layer)** |
| TypeScript + production bundle | Vercel Preview for exact commit `6f3dfd4436f0772d715ce91c7445c7e3d5c631d4` reached READY; `tsc --noEmit` and Vite production build completed | **PASS** |
| Phase 2.10 source contract | 4/4 passed on the preceding preview; rerun is part of the successful full build chain on this commit | **PASS (source contract only)** |
| Phase 2.10 PostgreSQL integration | GitHub Actions job fails before runner steps; no DB test output exists | **BLOCKED** |
| Phase 2.11 source contract | 6/6 passed on the preceding preview; rerun is part of the successful full build chain on this commit | **PASS (source contract only)** |
| Phase 2.11 browser/database end-to-end | No live/staging migration-backed environment was used | **NOT VERIFIED** |
| Android, tablet and desktop interaction QA | Manual Android, tablet and desktop QA requires real device/browser interaction; a bundle build is not device QA | **PENDING** |
| Historical snapshot and cross-module runtime regression | Requires disposable DB integration execution and representative authenticated flows | **PENDING** |

## Final acceptance blockers

1. Restore a working free GitHub Actions runner execution path and obtain a successful isolated PostgreSQL replay for Points 2.2–2.10. A failed job with no steps/logs is not evidence of database correctness.
2. Run authenticated end-to-end flows against a disposable/staging database using the exact staged migrations, including Owner/Coach/member permission boundaries and cross-team isolation.
3. Complete manual Android, tablet and desktop QA by exercising the Sessions workspace on an Android phone, tablet-sized viewport, and desktop; record browser/device, viewport, scenarios, and outcomes.
4. Verify historical source mappings and snapshot immutability across existing Tournament, Scrim, Planning and Training records using disposable fixtures.

## Production boundary

- **No production migration, backfill, merge or production deployment** is performed by this point.
- Do not apply Phase Two migrations to the live Supabase project until the Phase One acceptance gates are cleared and the full Phase Two database/device acceptance evidence is recorded.
- This document deliberately remains **BLOCKED** until all required evidence is real and attached; source-level assertions cannot substitute for PostgreSQL integration or manual device QA.
