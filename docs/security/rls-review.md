# Security review and current controls

**Snapshot:** 18 November 2026  
**Project:** FF Squad Supabase (xaixnqvyoswcvvkydrmh)  
**Database:** PostgreSQL 17.11  
**Status:** Baseline audit completed; remediation remains open where migration provenance or dashboard-only controls are required.

## Confirmed controls

- The live public schema contains 31 application tables; RLS is enabled on all 31.
- The two OTP/recovery tables have RLS enabled and no client policies. Treat these as service-only until their intended API access is confirmed; do not add broad client policies.
- The browser Supabase client reads only VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.
- .env.example contains only browser-safe placeholders. .gitignore excludes environment files except the example.
- Team-scoped access is enforced through RLS and membership-aware RPCs. Do not replace these with broad TO authenticated policies.
- Supabase health advisor returned no findings.
- The scheduled retention cleanup job was paused on 18 November 2026 to protect historical records. Job: squad-os-retention-daily (job id 3). It remains configured but inactive; no records were deleted by this action.

## Current advisor findings

### Security

- 4 trigger-only SECURITY DEFINER functions remain executable by anon: lock_daily_score_date_and_anonymize, log_practice_task_lifecycle, set_practice_task_lifecycle_fields, and track_practice_task_lifecycle. These should have client EXECUTE revoked after the migration source-of-truth is reconciled. Existing database triggers should continue to invoke their trigger functions.
- 22 SECURITY DEFINER functions are executable by authenticated. Some are deliberate team-scoped RPCs or RLS helper functions. Do not blanket-revoke or switch them to invoker mode; review each function's authorization checks, search_path, and callers before changing grants.
- Supabase Auth leaked-password protection is disabled. This is an Auth dashboard setting and is not safely changeable through the available database-only workflow. Enable it in Authentication → Settings → Password Security.

### Performance

- 27 foreign keys are reported without covering indexes.
- 30 RLS policies trigger auth/current_setting initialization-plan warnings.
- 10 multiple-permissive-policy warnings remain. These require semantic review before consolidation; policy union behavior must be preserved.
- 14 indexes are reported unused. Do not drop them based on low-traffic statistics alone.

## Migration source-of-truth risk

- Live Supabase migration history contains 55 entries.
- The repository contains 23 checked-in SQL migration files.
- The repository has no tracked supabase/config.toml in the audited tree.
- Several live migration versions and names are not represented by a matching checked-in migration file. The live database cannot safely be rebuilt from the current repository migration directory.
- Do not apply new schema, RLS, grant, or function changes until the live schema and migration history have been exported, reconciled, and committed as a reproducible baseline.

## Required remediation order

1. Reconstruct and reconcile the full live migration history and schema without altering production data.
2. Add a reviewed migration revoking client EXECUTE from the four trigger-only functions and verify the triggers still fire.
3. Review the 22 authenticated SECURITY DEFINER functions individually; retain only RPCs with explicit caller/team/owner checks and a fixed search_path.
4. Rewrite the RLS auth expressions using scalar subqueries where semantically equivalent; test owner, coach, player, and unrelated-member access.
5. Add only the missing FK indexes confirmed against current index definitions and query patterns.
6. Consolidate multiple permissive policies only after proving equivalent row visibility and write permissions.
7. Enable leaked-password protection in Supabase Auth.
8. Add automated role/RLS tests and rerun security, performance, and health advisors.

## Safety rules

- Never expose the service-role/secret key to browser code or VITE_* variables.
- Never use editable user_metadata as an authorization source.
- Every UPDATE policy needs both USING and WITH CHECK.
- Views must not accidentally bypass RLS; use security-invoker views where applicable.
- SECURITY DEFINER functions need explicit grants, caller validation, and a fixed search_path.
- Do not delete historical evaluations, feedback, completed tasks, training records, or tournament history as an automatic retention operation.
- Do not reset production data to make tests pass.
