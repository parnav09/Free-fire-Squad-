# Security review and current controls

## Browser application
- Only the Supabase project URL and publishable key are used by the Vite browser client.
- Never place a secret/service-role key in frontend code, repository files or screenshots.
- RLS is enabled on the current public application tables.
- Authenticated team records are scoped by team membership.
- Tournament writes are restricted to active owners/coaches.
- Drill assignments are readable by team members; only owners/coaches can create/delete them. Assigned players can update completion fields for their own tasks.
- Trigger-only functions and the tournament slot seeder are not directly executable through the public API.

## Remaining dashboard action
- Supabase Auth leaked-password protection is a project-level dashboard setting and must be enabled by a project administrator.
- Email Provider enablement, Confirm Email, OTP template, and production SMTP are also dashboard-level configuration and require a manual check.

## Remaining engineering checks
- Review intentionally exposed SECURITY DEFINER RPCs and retain only those needed by app flows or RLS policies.
- Run role-based tests for owner, coach, assigned player and ordinary member.
- Validate OTP signup against the actual Supabase email template and SMTP delivery.
- Add automated end-to-end tests before treating the app as fully production-verified.
