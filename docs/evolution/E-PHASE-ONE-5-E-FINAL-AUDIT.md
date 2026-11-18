# Evolution Phase One.5-E — Final Acceptance Audit

**Audit date:** 18 November 2026  
**Repository:** `parnav09/Free-fire-Squad-`  
**Branch:** `feat/evolution-phase-one-identity-timezone`  
**PR:** #115 — open, draft, unmerged  
**Exact-head full CI:** run #337 (ID `44275561389`) on `da5ca832060c30aad309f24ada929dc2499ca75f`

## Final result

**FINAL ACCEPTANCE: BLOCKED / NOT PASSED**

B's isolated database contract and the staged trigger-function ACL remediation now have passing disposable-PostgreSQL CI evidence. Full acceptance is still blocked by the missing authoritative pre-migration baseline and the outstanding Supabase Auth leaked-password setting / independent RPC review. These are real acceptance gates, not source-test failures.

## Evidence verified

- Read-only ledger verification: **55 live migration rows**; 53 in-scope; 2 excluded loadout; 55 forward SQL rows; **0 stored rollback statements**.
- Exact Git tree comparison: **55 active migration files** = 53 exact in-scope version/name matches + one excluded loadout file + one pending performance-tuning migration. Missing/extra in-scope files: 0; duplicate active timestamp prefixes: 0. The loadout SQL was not opened.
- Production read-only check: staged `teams_validate_timezone` trigger/function are absent; existing `daily_scores_lock_date_anonymous` trigger and `ds_insert` policy are present. No staged SQL has been applied to production.
- Exact-head GitHub Actions run **#337 / 44275561389** passed on `da5ca832060c30aad309f24ada929dc2499ca75f`: disposable PostgreSQL B forward/rollback suite, security trigger ACL suite, typecheck, all configured test suites, and Vite production build.

| Gate | Evidence | Result |
|---|---|---|
| 1.5-A — historical SQL provenance | Prior exact live-SQL-to-Git verification: 53/53 in-scope SQL bodies matched byte-for-byte | **PASS** |
| Live migration ledger | Read-only query: 55 rows; 53 in-scope; 2 excluded loadout; 0 stored rollback statements | **PASS** |
| 1.5-B — application contract | India-only timezone/date contract and source suite; exact staged forward + rollback SQL executed against disposable PostgreSQL in run #337 | **PASS · CI database verified** |
| 1.5-C — historical rollback disposition | 53/53 in-scope versions explicitly forward-only with risk class and recovery rule | **PASS · documented and machine-checked** |
| 1.5-D — source-contract tests | D suite 6/6; full typecheck, configured suites and Vite build passed in run #337 | **PASS · CI verified** |
| E audit integrity | E suite 6/6 included in full build on exact head run #337 | **PASS · CI verified** |
| Security trigger ACL remediation | Staged revocations deny API-role EXECUTE; existing Daily Evaluation trigger still executes after revocation in run #337 | **PASS · staged SQL + CI; not production-applied** |
| Full-chain clean replay | Authoritative pre-migration baseline is not present in repository or available evidence | **BLOCKED** |

## B isolated database evidence

The workflow now provisions a disposable PostgreSQL 16 service and runs the exact staged SQL files. Run #337 passed:

- default `UTC` and legacy `Asia/Calcutta` normalize to `Asia/Kolkata`;
- non-India and blank values are rejected;
- restore-path timezone writes are normalized;
- team timezone lookup remains canonical for join inheritance;
- the existing Daily Evaluation trigger and `ds_insert` policy survive the forward migration;
- rollback removes only `teams_validate_timezone` and `validate_team_timezone()`;
- the existing Daily Evaluation trigger and policy survive rollback.

This verifies B's staged SQL contract in a disposable PostgreSQL fixture. It does not claim that the migration has been applied to the production Supabase database.

## Security findings disposition

The read-only Security Advisor snapshot reported 2 INFO, 4 anon SECURITY DEFINER WARN, 22 authenticated SECURITY DEFINER WARN, and 1 leaked-password-protection WARN.

- OTP tables: read-only privilege checks confirm RLS enabled, no policies, and no `anon` or `authenticated` table privileges; `service_role` only. This is intentional private storage, not a client-accessible table.
- Four trigger-returning functions: live catalog inspection confirmed three are attached to triggers and one is an unattached legacy trigger-returning duplicate. Direct RPC execution is not needed. A staged ACL migration revokes API-role execution; run #337 verifies the revocations and confirms the Daily Evaluation trigger still works.
- Remaining callable authenticated SECURITY DEFINER RPCs: source/catalog review found pinned `search_path` and an explicit `auth.uid()`, `is_team_owner()`, or `is_team_member()` authorization path. This is a static review, not a substitute for adversarial role-level tests of every RPC.
- Leaked-password protection remains disabled. This is a Supabase Auth project setting and has not been changed; the available project tools in this workflow do not expose an Auth security-settings write action.

Full details: [E Security Findings Disposition](./E-PHASE-ONE-5-E-SECURITY-REVIEW.md).

## Remaining blocking gates

1. **Authoritative clean replay baseline:** no original pre-migration schema baseline or schema dump is present in the repository/evidence. The recovered migration chain begins after objects already existed. A test fixture is not a substitute for the real baseline. Do not invent a baseline or claim full-chain replay.
2. **Supabase Auth leaked-password protection:** enable the setting in the Supabase Dashboard under Authentication password/security settings, then rerun Security Advisor.
3. **Independent adversarial review:** the remaining authenticated SECURITY DEFINER RPCs have source-level auth/ownership/membership predicates and fixed search paths, but still need independent role-level tests before the full security gate can be called PASS.

## Safety and scope

- Production migration ledger and catalog checks were read-only. No production schema, policy, grant, function, trigger, data, or Auth setting was changed.
- No Supabase development branch exists; no recurring branch cost was incurred.
- The two loadout migration versions remain excluded and were not opened or modified.
- PR #115 remains open, draft, and unmerged.
- No production deployment or merge was performed.
- Historical rollback means an explicit forward-only/recovery disposition; it does not mean 53 executable rollback scripts exist.

**Conclusion:** A, B runtime, C, D, E audit integrity, and the staged trigger ACL test have evidence-backed passes. Full Evolution Phase One.5-E remains **BLOCKED / NOT PASSED** until the authoritative clean-replay baseline is supplied (or an independently reviewed scope exception is approved), Auth leaked-password protection is enabled, and the remaining RPC security review is completed.
