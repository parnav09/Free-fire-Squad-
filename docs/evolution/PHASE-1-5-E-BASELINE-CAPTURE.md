# Supabase schema baseline — acquisition record

**Status:** current-state schema dump not yet captured; original pre-migration baseline remains unavailable  
**Project:** FF Squad (`xaixnqvyoswcvvkydrmh`)  
**Last inspected:** 19 November 2026

## What is known

- The live project is PostgreSQL 17.11.
- The remote migration ledger has been read-only inspected; its latest listed version is `20261116115907`.
- The repository's Phase One.5 audit found no authoritative original pre-migration schema dump in the available evidence.
- A migration ledger is not a schema baseline. A list of tables/columns is also not enough to replay policies, indexes, triggers, functions, grants and view dependencies.

## Why an original baseline cannot be recreated from the current snapshot

The database has already received historical migrations. The current schema does not contain the deleted/overwritten pre-migration definitions needed to reproduce the exact original starting point. Reconstructing those definitions from current catalog metadata would be guesswork and could produce a false clean-replay PASS.

## Safe current-state capture path

A schema-only capture helper is committed at `scripts/capture-supabase-schema-baseline.sh`.

It requires `SUPABASE_DB_URL` to be supplied through a secure local environment or a protected CI secret. Do not paste a database password or connection string into chat, source code, issue comments, or committed files.

Run it in a secure environment with the Supabase CLI installed:

```bash
SUPABASE_DB_URL="$SUPABASE_DB_URL" bash scripts/capture-supabase-schema-baseline.sh
```

The helper uses `supabase db dump` without data-only or role-only flags. Review the output before committing. Supabase's CLI dump filters managed schemas such as Auth and Storage; if the project has customizations in those schemas, capture and review those separately using the official CLI `db pull --schema auth` / `db pull --schema storage` workflow.

Official references:
- https://supabase.com/docs/guides/local-development/cli-workflows
- https://supabase.com/docs/reference/cli/supabase-db-dump
- https://supabase.com/docs/reference/cli/supabase-db-pull

## Required acceptance after capture

1. Confirm the dump contains the application-owned schema and all required custom objects.
2. Check that no production rows, secrets, passwords, tokens or personal data are present.
3. Restore/replay against a fresh disposable PostgreSQL/Supabase-compatible environment.
4. Verify tables, constraints, indexes, RLS policies, functions, triggers and grants.
5. Keep this current-state snapshot clearly distinguished from the missing historical pre-migration baseline.

**No production reset or replay has been attempted.** Never run `supabase db reset --linked` against the production project.
