# Evolution Phase 3.12 — Security, RLS & Permissions

## Scope

Phase 3.12 closes the security acceptance gap across the Phase 3 evaluation, evidence, rubric, role-weight, assessment, coverage and score-history data model. It adds an executable security contract and a disposable PostgreSQL catalog audit; it does not broaden application access or rewrite existing policies.

## Security contract

- Every Phase 3-owned public table must have Row Level Security enabled and at least one explicit policy.
- No Phase 3 policy may directly name the `anon` role.
- SECURITY DEFINER routines in the Phase 3 namespaces must pin an empty `search_path`.
- Anonymous execution is denied for all Phase 3 SECURITY DEFINER routines.
- Functions in `evolution_private` are internal trigger/lock helpers and cannot be executed directly by `authenticated`.
- Public RPCs remain explicitly granted only where intended; this point does not blanket-revoke authenticated access or change existing owner/coach/team membership semantics.
- Existing team, owner, coach, player, author-private, team-visible and coach-visible RLS behavior remains governed by the reviewed policies already introduced with each data model point.

## Implementation

- Added `scripts/verify-evolution-phase-three-12.mjs` with source-contract checks for all Phase 3.2–3.11 migrations.
- Added `scripts/verify-evolution-phase-three-12-db.sh`, which rebuilds the Phase 3.2–3.11 dependency chain in a disposable PostgreSQL database and inspects `pg_class`, `pg_policy` and `pg_proc` for RLS, policy role exposure, SECURITY DEFINER search paths and function execution ACLs.
- Registered the suite in `npm run build` and GitHub Actions.
- No user-facing UI change is required; this is a database security/permissions acceptance point.

## Migration source-of-truth safety boundary

The repository's prior security review records a mismatch between the live Supabase migration history and the checked-in migration set. Therefore Phase 3.12 deliberately does **not** add or apply a production migration, mutate live grants/policies, change Auth dashboard settings, or assume the repository is a complete production baseline. The audit runs only against a disposable CI PostgreSQL database assembled from the checked-in Phase 3.2–3.11 chain. Production remediation remains blocked until the live schema and migration history are reconciled into a reproducible baseline.

## Explicit exclusions

No production migration, production data write, legacy backfill, data reset, merge to `main`, production deployment, Auth dashboard setting change, or broad policy consolidation.

## Verification

The source-contract suite and disposable PostgreSQL catalog audit run in the consolidated Evolution Phase Three workflow. The point is complete only when the exact latest PR head passes both the dedicated database audit and the full build/regression workflow.
