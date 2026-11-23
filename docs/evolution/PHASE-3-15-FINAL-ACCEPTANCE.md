# Evolution Phase 3.15 — Regression, Integration & Final Acceptance

## Purpose

Point 3.15 is the final acceptance gate for the complete Evolution Phase Three implementation (3.1–3.14). It adds no new scoring formula, production data model, migration, or user-facing workflow. Its job is to prove that the already-built layers work together and that the evidence is tied to the exact current branch head.

## Implemented acceptance controls

- Dedicated executable contract suite: `scripts/verify-evolution-phase-three-15.mjs`.
- Registered in `npm run build` after the Phase 3.14 source contracts and before `vite build`.
- Registered as a separate GitHub Actions step before the full build.
- CI passes the exact PR source-head SHA (or pushed commit SHA) as `EVOLUTION_PHASE_THREE_EXPECTED_HEAD`. The gate validates its full SHA format and compares it with the GitHub event payload. A missing CI SHA or mismatch fails closed.
- Checks all 14 point reports and dedicated source-contract scripts.
- Checks ordered execution of Phase 3.1–3.14 in the standard build chain.
- Checks the applicable PostgreSQL integration harnesses (3.2–3.8 and 3.10–3.13) are present and wired into the consolidated workflow.
- Checks database security/ACL and atomic context rollback assertions remain in the CI harnesses.
- Checks the Phase 3.14 Playwright browser acceptance for phone, tablet portrait, tablet landscape, laptop and desktop; 502-row pagination; Training and archived source lineage; retry recovery; member-safe restricted score history; and screenshot creation.
- Checks the final acceptance gate itself runs before the production bundle build.

## Acceptance matrix

| Area | Acceptance evidence |
|---|---|
| Canonical dimensions and rubric | Phase 3.2, 3.5 suites and PostgreSQL integrations |
| Evidence provenance and status | Phase 3.3, 3.4, 3.7 suites and PostgreSQL integrations |
| Role weights and coverage | Phase 3.6, 3.8 suites and PostgreSQL integrations |
| Deterministic scoring and history | Phase 3.9, 3.10 suites and PostgreSQL integrations |
| Atomicity and concurrency | Phase 3.11 PostgreSQL harness |
| Security and team isolation | Phase 3.12 PostgreSQL catalog/RLS/ACL harness |
| Evaluation workflow | Phase 3.13 source tests and atomic context PostgreSQL harness |
| Existing-module lineage | Phase 3.14 source tests and Playwright browser harness |
| Responsive UI | 390, 768, 1024, 1280 and 1440 CSS-pixel viewports; screenshot artifacts |
| Repository quality | TypeScript typecheck, complete repository regression chain and Vite production build |
| Commit integrity | Event SHA must equal the expected PR-head/push SHA; stale or cancelled runs do not count |

## Known limitations and release boundaries

1. **Live Supabase migration source of truth:** the Phase 3.12 audit records a mismatch between checked-in migrations and live Supabase migration history. The 3.15 gate intentionally uses isolated disposable PostgreSQL databases. It does not claim that production schema or grants have been reconciled. Production migration remediation remains a separate release blocker and requires an approved live-schema/history audit.
2. **Training scoring:** Phase 3.14 links and displays Training source sessions. The Phase 3.13 scoring context still requires a canonical competitive match and its exact historical match-role snapshot. Training is not silently assigned a fake match or role; a dedicated training-session scoring contract remains future work.
3. **Vercel Preview:** Vercel deployment/preview checks are separate from GitHub Actions. A rate-limit or deployment failure must be reported separately and is not converted into a CI pass. This point does not deploy to production.
4. **Data safety:** no production migration, live Supabase write, data reset, legacy backfill/conversion, merge to main or production deployment is performed.

## Verification record

The authoritative verification record is the latest successful GitHub Actions workflow for the exact current PR head. A run on an earlier commit, a cancelled run, a partial job, or a green Vercel comment check is not sufficient.

- Exact PR head: pending this point's first CI run.
- Dedicated Phase 3.15 acceptance suite: pending.
- Full typecheck/regression/PostgreSQL/browser/build workflow: pending.
- Screenshot artifact: required from the Phase 3.14 browser step.
- Failures: must be fixed on the same feature branch, then the complete workflow must pass again on the new exact head.

## Completion rule

Point 3.15 is VERIFIED only when the dedicated final gate and the full consolidated workflow succeed on the same exact latest PR head, with no required test skipped or waived. This report must be updated with the resulting commit SHA and workflow run URL after that happens.
