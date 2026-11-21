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

## Fresh 22 November 2026 security revalidation and remediation

The connected live Supabase project was rechecked after the earlier audit. This section supersedes older security statements where they conflict.

### Confirmed already fixed in live database
- Live migration ledger contains `20261118193817_revoke_direct_trigger_function_execution`.
- Read-only `has_function_privilege` checks returned **false** for `anon`, `authenticated`, and `service_role` on all four trigger-returning functions: `lock_daily_score_date_and_anonymize`, `log_practice_task_lifecycle`, `set_practice_task_lifecycle_fields`, and `track_practice_task_lifecycle`.
- Therefore the older statement that trigger-function ACL remediation is only staged is stale; direct API execution is already revoked in production.

### Confirmed live issue now fixed in PR code, migration pending rollout
- `authenticated` has table-level UPDATE on `public.team_members` and column-level UPDATE grants on all ten columns, including `id`, `team_id`, `user_id`, `membership_role`, `status`, `player_number`, and `assigned_role`.
- The live `tm_update_character_loadout` policy allowed a user to update their own membership row or an owner to update a team row. Since it did not restrict writable columns, this was too broad for identity-bearing fields.
- PR #142 now adds `supabase/migrations/20261122110000_team_members_owner_rpc_only.sql`: it revokes table and column UPDATE grants from API roles, drops the broad update policy, and exposes a narrowly scoped owner-checked `assign_member_with_role` RPC.
- `src/App.tsx` now routes both owner self-role and roster assignment through that RPC; it contains no direct `team_members` UPDATE call.
- The migration was applied inside a transaction against the live catalog for a runtime check. Owner RPC update succeeded; non-owner RPC and direct identity-field UPDATE were rejected; table/column privilege checks passed. The transaction was rolled back. **No production change persisted.**
- CI now includes `scripts/verify-evolution-phase-one-5-e-security.sh` against disposable PostgreSQL. The new exact-head CI run has not yet been observed, so the committed test suite is pending CI confirmation.

### Remaining true acceptance blockers
1. **Authoritative historical baseline:** the original pre-migration schema baseline is absent. No current snapshot or synthetic fixture can prove the original clean replay. This cannot be honestly fabricated or repaired from the post-migration database alone. Supply the original dump/backup, or approve a separately reviewed current-state-baseline exception.
2. **Production rollout:** the new `team_members` grant-revocation migration is in PR #142 but intentionally not applied permanently while the application change is not yet merged/deployed. Until coordinated rollout, the live broad UPDATE grant remains.
3. **Physical-device QA:** browser automation does not prove actual Android/tablet/laptop behavior. Owner-run device checks remain separate.
4. **Leaked-password protection:** paid-only Supabase Auth setting, explicitly excluded from this acceptance scope; no equivalent workaround is claimed.


## Exact-head CI evidence

GitHub Actions run #1041 (`44954150550`) completed successfully on code head `1932582bc9e4cccd048658119a5eafd4e8056920`. It passed dependency installation, all disposable PostgreSQL integration checks (Phase Two.2–2.10), Phase One.5-B forward/rollback verification, staged trigger ACL verification, responsive Chromium checks, the full configured test/build chain, and Vite production build. The Phase One identity suite passed 21/21; Phase One.5 A/B/C/D/E source suites passed 6/6, 7/7, 6/6, 6/6, and 8/8 respectively. The separate Vercel status was failure due to the account build-rate limit; this is not a GitHub Actions test/build failure.

The subsequent PR checklist-only commit does not change application code; final PR head still requires the current workflow rerun before calling the final head verified.

## CI trigger correction

The existing workflow did not include this PR's Phase Two.12 base in its `pull_request.branches` list. This PR adds the Phase One implementation branch to push triggers and the Phase Two.12 base to pull-request triggers so the complete configured build/test suite runs for PR #142.

## Rollout boundary

This PR does not merge to `main`, apply the staged timezone or ACL migrations to production, change live grants/RLS, or deploy production. A passing disposable CI run proves only the tested disposable contract. Final completion requires exact-head CI success and closure or explicit independent disposition of every blocker above.

### Latest CI attempt and correction

GitHub Actions run #1066 (ID `44955380068`) reached the new team-member authorization step after all preceding disposable PostgreSQL steps and the staged trigger ACL step passed. The new security test script failed because its SQL fixture passed integer literals to an RPC parameter typed `smallint`. The test fixture was corrected to cast the slot literals explicitly to `smallint`; the application migration and RPC design were not changed by this correction. The live-schema transaction check was repeated with explicit `smallint` slot values and passed owner RPC, non-owner denial, and all privilege checks, then rolled back. A fresh exact-head CI run is still required before the disposable CI gate can be marked passed.
