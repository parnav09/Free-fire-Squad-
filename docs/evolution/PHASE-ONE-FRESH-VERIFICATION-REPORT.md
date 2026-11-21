# Evolution Phase One — Fresh Implementation Verification Report

**PR:** #142  
**Working branch:** `feat/evolution-phase-one-next-pr-rebuild`  
**Base:** `feat/evolution-phase-two-12-final-acceptance`  
**Review date:** 22 November 2026  
**Status:** IN PROGRESS — Phase One 1.1–1.5-D passed the full GitHub Actions run on code head `1932582bc9e4cccd048658119a5eafd4e8056920` (run #1041); 1.5-E remains PARTIAL / NOT PASSED because the authoritative historical pre-migration baseline is unavailable.

## Blueprint read and authoritative scope

The repository's `docs/evolution-version-2.md` master blueprint and `docs/evolution/evolution-phase-one.md` implementation ledger were read on the PR base. Evolution Phase One is the identity, active-membership, and existing date/timezone foundation. Its implementation points are 1.1–1.4; the acceptance work is 1.5-A through 1.5-E.

The existing implementation in the base already contains the identity resolver, App team-loading integration, latest-request race guard, session eligibility/UI capability helpers, and Phase One A–E verification suites. This PR does not pretend those inherited files are new diff hunks. It adds a dedicated Phase One acceptance path and ensures the full CI workflow actually runs for this PR's base/head.

## Point-by-point implementation and evidence

| Point | Required outcome | Current evidence | Status |
|---|---|---|---|
| 1.1 | Stable Auth UUID → membership UUID → team UUID mapping; labels never act as IDs; active membership and ambiguous-team fail-closed behavior | `src/lib/evolution-identity.ts`; `scripts/verify-evolution-phase-one.mjs`; this PR adds runtime guards for null/malformed membership rows and regression coverage | Implemented + hardened in this PR; exact-head CI pending |
| 1.2 | Real app team-loading uses the selected stable identity; no arbitrary first-team fallback; sign-out clears scoped state | `src/App.tsx`; Phase One verifier | Implemented in base; exact-head CI pending |
| 1.3 | Latest team-load request wins; stale async results/errors cannot overwrite newer state; sign-out invalidates requests | `src/lib/latest-request-guard.ts`; Phase One verifier | Implemented in base; exact-head CI pending |
| 1.4 | Session eligibility requires exact active membership; role affordances fail closed and are explicitly UI-only | `src/lib/evolution-identity.ts`; `src/App.tsx`; Phase One verifier | Implemented in base; exact-head CI pending |
| 1.5-A | Migration provenance reconciled against the live ledger and checked-in SQL | Existing manifest and audit report 53/53 historical in-scope matches; current live ledger read returned 56 rows (53 in-scope + 2 excluded loadout + 1 separate trigger-ACL migration) | Prior evidence exists; exact-head suite pending |
| 1.5-B | India timezone contract, server-side write guard, forward/rollback execution in disposable PostgreSQL; preserve Daily Evaluation date/anonymity behavior | Staged forward/rollback SQL and `scripts/verify-evolution-phase-one-5-b-db.sh`; prior CI database run documented | Disposable test evidence exists; production application is intentionally not part of this PR |
| 1.5-C | Evidence-backed disposition for each in-scope historical migration; no fabricated inverse SQL | 53-entry version-keyed rollback manifest and register; source verifier | Documented/machine-checked in base; exact-head suite pending |
| 1.5-D | All Phase One checks wired into the full build and CI | Package build includes Phase One 1.1–1.5-E suites; workflow trigger corrected in this PR | Exact-head workflow running |
| 1.5-E | Adversarial authorization/RPC tests, replay/recovery and browser regression; honest external-gate reporting | Existing report documents 18/18 callable RPC runtime tests; clean replay baseline is unavailable; independent security/production gates remain | PARTIAL / NOT PASSED |

## Fresh read-only Supabase snapshot

Project `FF Squad` (`xaixnqvyoswcvvkydrmh`), PostgreSQL 17.11, was inspected read-only on 21 November 2026.

- Migration ledger: 56 rows; first version `20261107081456`, latest `20261118193817`.
- Team timezone values: 15 rows `Asia/Kolkata`, 1 row `Asia/Calcutta`.
- `teams` currently has no `teams_validate_timezone` trigger. The staged B migration has not been applied to production; this is an explicit rollout boundary, not a claim that live production already enforces B.
- `daily_scores_lock_date_anonymous` remains installed as a BEFORE INSERT trigger.
- `team_members` grants include broad table-level UPDATE for `authenticated`, along with other table privileges. This is a security-workstream finding; Phase One client-side identity checks are not a substitute for database authorization.
- The previously staged trigger-function ACL migration is not represented as production-applied merely because its disposable CI test passed.

No production SQL, migration, schema, data, RLS, grants, triggers, or Auth settings were changed during this read-only inspection.

## Acceptance blockers — must not be hidden

1. **Authoritative clean-replay baseline:** the repository/evidence still lacks the original pre-migration schema baseline. A synthetic fixture or current schema snapshot cannot be described as historical clean replay. Full 1.5-E acceptance remains blocked unless the authoritative baseline is supplied or an independently reviewed baseline exception is approved.
2. **Security boundary:** broad authenticated UPDATE grants on `team_members` require separate security review/remediation. Do not treat UI capability helpers as authorization, and do not silently change production grants in this Phase One PR.
3. **Physical-device QA:** GitHub browser automation is not the same as owner-run Android/tablet/laptop QA. Record those checks separately if they are required for final release acceptance.

## Exact-head CI evidence\n\nGitHub Actions run #1041 (`44954150550`) completed successfully on code head `1932582bc9e4cccd048658119a5eafd4e8056920`. It passed dependency installation, all disposable PostgreSQL integration checks (Phase Two.2–2.10), Phase One.5-B forward/rollback verification, staged trigger ACL verification, responsive Chromium checks, the full configured test/build chain, and Vite production build. The Phase One identity suite passed 21/21; Phase One.5 A/B/C/D/E source suites passed 6/6, 7/7, 6/6, 6/6, and 8/8 respectively. The separate Vercel status was failure due to the account build-rate limit; this is not a GitHub Actions test/build failure.\n\nThe subsequent PR checklist-only commit does not change application code; final PR head still requires the current workflow rerun before calling the final head verified.\n\n## CI trigger correction

The existing workflow did not include this PR's Phase Two.12 base in its `pull_request.branches` list. This PR adds the Phase One implementation branch to push triggers and the Phase Two.12 base to pull-request triggers so the complete configured build/test suite runs for PR #142.

## Rollout boundary

This PR does not merge to `main`, apply the staged timezone or ACL migrations to production, change live grants/RLS, or deploy production. A passing disposable CI run proves only the tested disposable contract. Final completion requires exact-head CI success and closure or explicit independent disposition of every blocker above.
