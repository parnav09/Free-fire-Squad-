# Evolution Phase 2.12 — Regression and Final Acceptance

**Branch:** `feat/evolution-phase-two-12-final-acceptance`  
**Base:** Phase 2.11 application UI branch `feat/evolution-phase-two-11-session-ui`  
**Scope:** Evolution Version 2, Points 2.1–2.12 only  
**Automated acceptance:** RUNNING ON THIS EXACT HEAD  
**Physical-device acceptance:** OWNER QA REQUIRED  
**Production rollout:** NOT AUTHORIZED BY THIS BRANCH

## Acceptance rule

A source assertion is not a database integration pass. A successful build is not a browser interaction pass. A browser fake-data run is not a live Supabase end-to-end pass. This report keeps those evidence types separate.

## Point-by-point implementation and evidence

| Point | Implementation scope | Automated evidence | Current disposition |
|---|---|---|---|
| 2.1 | Read-only audit of Scrims, Tournament, Planning, Training, schema, RLS, data integrity and UI entry points | Existing audit contract and read-only audit report | Implemented; previously CI-verified |
| 2.2 | Canonical team-scoped session identity, source mapping, idempotent create | Disposable PostgreSQL migration/integration harness | Implemented; exact-head CI rerun pending |
| 2.3 | Canonical match identity, parent/child integrity, source mapping | Disposable PostgreSQL migration/integration harness | Implemented; exact-head CI rerun pending |
| 2.4 | Lifecycle transitions, authorization, optimistic versioning, audit and reopen | Disposable PostgreSQL transition/authorization matrix | Implemented; exact-head CI rerun pending |
| 2.5 | Immutable roster snapshots and participation state | Disposable PostgreSQL historical roster tests | Implemented; exact-head CI rerun pending |
| 2.6 | Versioned role snapshots and match-specific role history | Disposable PostgreSQL role immutability tests | Implemented; exact-head CI rerun pending |
| 2.7 | Ordered substitutions and lineup reconstruction | Disposable PostgreSQL substitution tests | Implemented; exact-head CI rerun pending |
| 2.8 | Raw result submission, verification, rejection, correction and trusted aggregates | Disposable PostgreSQL result/audit/aggregate tests | Implemented; exact-head CI rerun pending |
| 2.9 | Scrim/Tournament/Training adapters; explicit Planning promotion | Disposable PostgreSQL adapter tests plus new true parallel same-source retry test | New concurrency test added; exact-head CI pending |
| 2.10 | Team-scoped constraints, integrity guards, rollback and forward re-apply | Disposable PostgreSQL integrity, race, rollback and re-apply tests | Implemented; exact-head CI rerun pending |
| 2.11 | Canonical Sessions workspace, lifecycle/roster/role/substitution/result controls, permission/offline states | Source contracts plus Chromium Playwright visual and interaction tests at 390, 768, 1024, 1280 and 1440 widths | Earlier exact-head CI PASS; rerun included in this acceptance |
| 2.12 | Cross-point regression, migration order, CI wiring, evidence integrity and acceptance gate | This contract is part of `npm run build`; CI runs DB and Playwright suites | Exact-head acceptance pending |

## Point 2.12 — twelve required regression groups

| # | Required group | Test implementation |
|---:|---|---|
| 1 | Canonical identity uniqueness and team isolation | Point 2.2 disposable PostgreSQL harness |
| 2 | Session-to-match parent/child integrity | Point 2.3 disposable PostgreSQL harness |
| 3 | Lifecycle transition and authorization matrix | Point 2.4 disposable PostgreSQL harness |
| 4 | Historical roster immutability after roster edits | Point 2.5 disposable PostgreSQL harness |
| 5 | Role snapshot immutability and role changes across matches | Point 2.6 disposable PostgreSQL harness |
| 6 | Substitution ordering and lineup reconstruction | Point 2.7 disposable PostgreSQL harness |
| 7 | Result submission, verification, correction and aggregate eligibility | Point 2.8 disposable PostgreSQL harness |
| 8 | Idempotent retries and concurrent writes | Point 2.9 now starts two independent PostgreSQL clients, proves the second waits on the advisory lock, and asserts one canonical mapping, one session ID and the expected match set |
| 9 | Migration forward/recovery and historical reconciliation | Sequential disposable migration replay 2.2–2.10; Point 2.10 rollback and forward re-application; source mapping/backfill assertions |
| 10 | Existing Scrims/Tournament/Training/Planning regression | Point 2.9 adapter tests, Point 2.10 relationship tests, and Point 2.11 browser interaction tests |
| 11 | RLS and adversarial cross-team access tests | Disposable PostgreSQL authenticated-role, Player-denial and cross-team negative cases across Points 2.2, 2.4, 2.8–2.10 |
| 12 | Android/mobile, tablet, desktop responsive and accessibility QA | Automated Chromium viewports, overflow checks, hitbox checks, keyboard focus, permission and offline tests; physical-device QA remains owner-run |

## Browser acceptance already available

The Phase 2.11 Playwright harness uses deterministic fixtures and checks:

- 390×844 phone, 768×1024 tablet portrait, 1024×768 tablet landscape, 1280×800 laptop and 1440×900 desktop viewports
- Horizontal overflow and undersized visible controls
- Keyboard focus visibility and runtime page errors
- Owner session creation invokes the canonical RPC exactly once
- Player/member view does not expose staff-only write controls
- Offline state blocks writes and does not call any RPC
- Screenshot artifact upload for review

This is automated browser QA, not physical Android/tablet hardware certification.

## Important evidence boundary

The disposable PostgreSQL harness runs authenticated database-role tests and verifies database authorization. The Playwright harness uses deterministic test data and browser-side RPC stubs; it does not connect to a live Supabase project. Therefore no live Supabase browser-to-database E2E claim is made, and no production credentials or data are used.

## Exact-head acceptance gates

The branch CI must pass all of the following before automated acceptance is marked complete:

1. Node 22 typecheck and complete production build.
2. Every source-contract suite from Phase 2.1 through 2.12.
3. PostgreSQL 16 disposable migration/integration suites for Points 2.2–2.10.
4. The new concurrent source-integration retry test in Point 2.9.
5. Point 2.10 rollback and forward re-application.
6. Chromium Playwright interaction/responsive suite and screenshot artifact.

If a gate fails, inspect the exact failing step/log, fix the underlying issue on this branch, and rerun the full workflow. Do not convert missing evidence into PASS.

## Owner-only physical-device checklist

These checks are intentionally not represented as code-level PASS:

- Android phone: 390×844 — create/filter/select session, detail view, roster/match controls, offline warning and touch behavior.
- Tablet portrait: 768×1024 — list/detail layout, filters, clipped actions and focus.
- Tablet landscape: 1024×768 — two-column layout, detail actions and scrolling.
- Laptop: 1280×800 — complete workflow without horizontal overflow.
- Desktop: 1440×900 — filters, history, result controls and navigation.

Record actual device/browser, OS, viewport, scenario, result and screenshots for any failure.

## Production and repository boundaries

- No merge to `main`.
- No Vercel production deployment.
- No live Supabase migration, backfill, reset, or production data write.
- All new changes remain on this dedicated Phase 2 acceptance branch and its draft PR.
- Phase 2.11's prior verified branch and the existing Phase 2.12 historical branch remain untouched.
