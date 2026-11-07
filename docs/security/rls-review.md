# Security review gate

## Browser application

- Only the Supabase project URL and publishable key may be exposed in Vite browser environment variables.
- Never put a secret key or legacy service-role key in frontend code, repository files, screenshots or chat.
- Publishable keys do not replace authorization; every exposed table requires appropriate RLS.
- Authorization must use trusted server-controlled claims/relations, not user-editable metadata.

## Policy review

For every table, document:
- who can SELECT, INSERT, UPDATE and DELETE;
- row ownership and team-membership checks;
- whether UPDATE has both USING and WITH CHECK;
- whether UPDATE has a compatible SELECT policy;
- whether policies overlap or broaden access unexpectedly;
- whether views use security_invoker where required;
- whether privileged functions are necessary and tightly granted.

## Existing project items to inspect

- 13 SECURITY DEFINER functions reported with authenticated EXECUTE access.
- Leaked-password protection reported disabled.
- 15 policy performance notices.
- Duplicate/overlapping SELECT policies on team_settings.

Do not apply blanket fixes. Inspect the SQL definitions and intended access model first.

## Release gate

No production auth/data workflows until schema mapping, RLS tests, role tests, backup/restore plan and a reviewed migration are complete.
