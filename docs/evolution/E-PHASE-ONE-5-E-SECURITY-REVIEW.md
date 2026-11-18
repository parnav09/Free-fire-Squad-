# Evolution Phase One.5-E — Security Findings Disposition

**Snapshot:** 18 November 2026  
**Project:** `xaixnqvyoswcvvkydrmh`  
**Status:** PARTIAL — staged ACL remediation and CI proof added; Auth setting remains outstanding.

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

This is a source/catalog authorization review, not a substitute for adversarial role-level tests of every RPC. Keep the remaining SECURITY DEFINER functions under separate security review; do not revoke authenticated access indiscriminately because these are intentional application RPCs.

## 4. Leaked-password protection

The advisor still reports leaked-password protection disabled. This is a Supabase Auth project setting, not a SQL privilege. No supported Auth-configuration write action is available in this execution path, so it has not been changed. Enable it in the Supabase Dashboard under Authentication password/security settings, then rerun the Security Advisor.

Remediation reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Acceptance

- OTP table findings: **DISPOSITIONED — intentional service-only access**.
- Four trigger-function exposure findings: **REMEDIATION STAGED — CI proof required before production migration**.
- Remaining authenticated RPC warnings: **REVIEWED — authorization predicates and fixed search paths observed; adversarial review remains separate**.
- Leaked-password protection: **OPEN — project Auth setting must be enabled**.

**Overall Security acceptance is not PASS yet.** No production ACL, RLS, function, or Auth configuration was changed by this review.
