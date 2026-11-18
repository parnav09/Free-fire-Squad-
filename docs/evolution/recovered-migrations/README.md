# Recovered Supabase migration SQL archive

**Source:** verbatim `statements` arrays from `supabase_migrations.schema_migrations` in live project `xaixnqvyoswcvvkydrmh`, read on 2026-11-18.

**Purpose:** immutable provenance/reference archive. The recovered SQL is also copied into the active migration directory under `supabase/migrations/` for the 53 safe-scope ledger entries. The archive remains outside the CLI migration directory so it is not replayed twice.

- Recovered safe-scope entries: 53
- Entries with stored SQL: 53/53
- Entries with stored rollback SQL: 0/53
- Promoted into active `supabase/migrations/`: 24 foundational entries, in addition to the 29 previously reconciled entries
- Excluded from both active work and this archive: the two `player_character_loadouts` / `player_character_loadout` ledger entries (restricted loadout scope)

The live migration ledger's `statements` field is the source of each SQL file. No SQL was inferred from the current schema. The two Phase 0 security migrations are included as historical migrations to preserve ledger order; they are not being newly applied to production. The new Evolution Phase 1.5 performance remediation is a separate, not-yet-applied migration.

This does not prove clean replay from an empty database. The original pre-migration baseline is still missing, the live ledger contains no rollback SQL, and no isolated Supabase development branch exists yet.

See `manifest.json` for exact versions, names, and source statement counts.
