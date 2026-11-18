# Recovered Supabase migration SQL archive

**Source:** verbatim `statements` arrays from `supabase_migrations.schema_migrations` in live project `xaixnqvyoswcvvkydrmh`, read on 2026-11-18.

**Purpose:** provenance recovery and offline review only. These files are deliberately outside `supabase/migrations/`; Supabase CLI will not treat this archive as the active migration directory. Do not copy or apply them until the active migration chain, dependencies, clean-database replay, and rollback plan have been independently reviewed.

- Recovered entries: 53
- Entries with stored SQL: 53/53
- Entries with stored rollback SQL: 0/53
- Excluded from this archive: both `player_character_loadouts` and `player_character_loadout` ledger entries (restricted loadout scope).

The live migration ledger's `statements` field is the source of each SQL file. No SQL was inferred from the current schema. Existing active migration files were not renamed, deleted, or overwritten. No database migration was applied. This is historical source recovery, not proof that all migrations replay successfully on a fresh database.

See `manifest.json` for exact versions, names, and source statement counts.
