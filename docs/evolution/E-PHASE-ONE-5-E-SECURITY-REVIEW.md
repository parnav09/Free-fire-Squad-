# Evolution Phase One.5-E — Security Findings Disposition

**Snapshot:** 20 November 2026  
**Project:** `xaixnqvyoswcvvkydrmh`  
**Status:** PARTIAL — callable RPC authorization runtime tests passed; trigger ACL remediation remains staged; paid-only Auth setting excluded from this scope.

## 1. OTP tables: intentional private storage

Supabase Security Advisor reported RLS enabled with no policies on:

- `public.account_recovery_otps`
- `public.recovery_email_enrollment_otps`

Read-only privilege inspection confirmed both tables have RLS enabled, zero policies, and no SELECT/INSERT privileges for `anon` or `authenticated`. The `service_role` has the required SELECT/INSERT privileges. This is intentional service-only storage, not a public-table exposure. Keep the tables inaccessible to client roles; do not add broad policies just to silence the informational lint.

## 2. Four trigger-returning functions: direct API execution is unnecessary

The Security Advisor reported four SECURITY DEFINER functions callable by `anon`:

- `lock_daily_score_date_and_anonymize()`
- `log_practice_task_lifecycle()`
- `set_practice_task_lifecycle_fields()`
- `track_practice_task_lifecycle()`

Live catalog inspection confirmed the first three are attached to table triggers. The fourth is a legacy trigger-returning duplicate with no attached trigger. None is a supported PostgREST RPC. The trigger functions have fixed `search_path` settings.

A staged least-privilege migration is provided at:

`docs/evolution/staged-migrations/20261118080000_revoke_direct_trigger_function_execution.sql`

It revokes EXECUTE from PUBLIC, anon, authenticated, and service_role while preserving trigger attachment. The companion CI script verifies the API roles cannot call these functions and that the Daily Evaluation trigger still executes:

`scripts/verify-evolution-security-trigger-acls.sh`

This migration is staged only; it has not been applied to production. The Supabase advisor warnings will remain until an approved migration is applied.

## 3. Remaining authenticated SECURITY DEFINER RPCs

The 22 authenticated warnings include the four trigger-returning functions above (including the orphan legacy function), leaving 18 callable application RPC signatures after the staged ACL correction.

Read-only catalog review found all reviewed functions have a pinned `search_path` and an authorization predicate through one of:

- explicit `auth.uid()` / signed-in-user checks;
- `is_team_owner(...)` ownership checks; or
- `is_team_member(...)` membership checks.

This includes team creation/join/leave, roster assignment and join approval, backup export/restore, display-name updates, score/feedback summaries, and membership helpers. Examples: `assign_member` checks team ownership; `restore_backup` checks ownership; `daily_summary` and `team_rating_summary` require active team membership.

Adversarial runtime checks were subsequently executed under `SET LOCAL ROLE authenticated` using a synthetic non-member JWT subject and explicit transaction rollback. **All 18 callable function signatures passed**, counting both `set_display_name` overloads: team-scoped read functions returned false/empty results for a non-member; owner-only backup/restore/assignment/review operations rejected a non-owner; signed-out calls were rejected; and the team-scoped display-name overload rejected a non-member. A temporary join-request fixture was rolled back and the post-rollback row count returned to zero. Full evidence is recorded in [Adversarial RPC Tests](./E-PHASE-ONE-5-E-ADVERSARIAL-RPC-TESTS.md). Do not revoke authenticated access indiscriminately because these are intentional application RPCs.

## 4. Leaked-password protection

The advisor still reports leaked-password protection disabled. This is a Supabase Auth project setting, not a SQL privilege. It is paid-only on the current plan and is excluded from the user's requested acceptance scope. No setting was changed and no workaround is represented as equivalent.

Remediation reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Acceptance

- OTP table findings: **DISPOSITIONED — intentional service-only access**.
- Four trigger-function exposure findings: **REMEDIATION STAGED — CI proof required before production migration**.
- Remaining authenticated RPC warnings: **RUNTIME TESTED — 18/18 callable signatures passed adversarial role-level checks; Security Advisor still reports SECURITY DEFINER exposure because these RPCs intentionally remain callable**.
- Leaked-password protection: **EXCLUDED — paid-only setting, outside current acceptance scope**.

**Overall Security acceptance remains PARTIAL** because trigger-function ACL revocations are staged and not production-applied. The callable RPC authorization test gate is closed. No production ACL, RLS, function, or Auth configuration was changed by this review.


## Fresh revalidation — 22 November 2026 (supersedes stale status above)

A new read-only production catalog check confirms that the trigger-only ACL migration is no longer merely staged: the live migration ledger contains `20261118193817_revoke_direct_trigger_function_execution`, and `has_function_privilege` is false for `anon`, `authenticated`, and `service_role` on all four trigger-returning functions.

The same fresh check found a separate, actionable issue on `public.team_members`: `authenticated` has table-level UPDATE plus column-level UPDATE on all ten columns, including the identity and authorization columns. The live `tm_update_character_loadout` policy allowed self-row updates or owner updates without restricting the columns that could be changed.

PR #142 now contains a permanent migration proposal, `20261122110000_team_members_owner_rpc_only.sql`, which:
- revokes table-level and per-column UPDATE from `PUBLIC`, `anon`, and `authenticated`;
- removes the broad `tm_update_character_loadout` policy;
- introduces `assign_member_with_role`, a SECURITY DEFINER RPC that checks the active team owner, validates the role and roster capacity, and updates only the assigned role/slot/status fields;
- routes the app's roster edits through that RPC instead of direct table UPDATE.

The migration was tested against the live schema inside one explicit transaction. The owner RPC succeeded; a non-owner RPC call and direct identity-field UPDATE were rejected; table-level and all ten column-level UPDATE privilege checks passed. The transaction was rolled back. No persistent production change was made.

The PR also adds a disposable PostgreSQL test script and a GitHub Actions step for this grant/RPC boundary. Exact-head CI for this new change is still pending; do not label the new remediation CI-verified until that run passes. The migration remains unapplied permanently until the app code is merged/deployed and the database migration can be rolled out in the correct order.

The original pre-migration schema baseline remains unavailable. This cannot be recreated from a post-migration snapshot without misrepresenting historical provenance. Full 1.5-E acceptance remains blocked until the original baseline is supplied or a separately reviewed exception is approved. Physical-device QA remains owner-only; leaked-password protection remains a paid-only excluded setting.
