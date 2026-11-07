# Security review and current controls

## Browser application
- Only the Supabase project URL and publishable key are used by the Vite browser client.
- Never place a secret/service-role key in frontend code, repository files or screenshots.
- RLS is enabled on all 13 current public application tables.
- Authenticated team records are scoped by team membership.
- Tournament writes are restricted to active owners/coaches.
- Drill assignments are readable by team members; only owners/coaches can create/delete them. Assigned players can update only completion fields for their own tasks.
- Trigger-only functions and the tournament slot seeder are not directly executable through the public API.
- IGN login runs in the login-with-ign Edge Function. The service-role key is used server-side only; the browser receives only the resulting user session.

## Dashboard actions still required
- Enable leaked-password protection in Supabase Auth password security.
- Verify Email Provider is enabled and Confirm Email is ON.
- Verify the Confirm Signup email template includes the {{ .Token }} variable for the six-digit OTP.
- Configure production SMTP if the default email service's testing limits are insufficient.

## Advisor findings
- 13 authenticated SECURITY DEFINER functions remain exposed. They were reviewed: team-management RPCs perform caller/owner checks; RLS helper functions return scoped membership booleans; feedback/summary/backup functions check team membership or ownership. Do not blanket-revoke these because RLS policies and app workflows depend on them.
- Performance advisor no longer reports unindexed foreign keys, auth init-plan warnings, or overlapping permissive policies. It reports unused indexes only; do not remove indexes solely from low-traffic usage counters.
- Supabase health advisor currently reports no findings.

## Remaining engineering checks
- Run role-based tests for owner, coach, assigned player and ordinary member.
- Validate OTP signup and IGN login with real test accounts.
- Add automated end-to-end tests before treating the app as fully production-verified.
