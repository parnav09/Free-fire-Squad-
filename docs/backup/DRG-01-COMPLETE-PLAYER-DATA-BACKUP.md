# DRG-01 — Complete Player Data Backup

**Branch:** `feat/drg-01-complete-player-data-backup`  
**Backup format:** `squad-os-team-backup` version 2  
**Migration:** `20261121010000_drg_01_complete_team_backup.sql`  
**Status:** Implemented on feature branch; disposable PostgreSQL integration is wired into CI and remains pending an actual successful runner result. No production migration was applied.

## 1. Audit findings

The existing version-1 backup path covered a limited legacy set and could not prove that newer Planning, Training, Scrim and canonical Evolution records were included. A successful JSON download was therefore not proof of recoverability.

A read-only inventory of the connected Supabase public schema found 25 team-scoped tables with a `team_id` column. The required inventory is:

- Team and roster: `team_members`, `team_settings`, `team_join_requests`, `team_ratings`, `team_data_retention_settings`
- Daily player work: `daily_drills`, `daily_scores`, `daily_score_feedback`, `player_drill_assignments`, `player_nicknames`, `player_character_loadouts`
- Planning: `practice_plans`, `practice_plan_blocks`, `practice_tasks`, `practice_task_events`
- Training: `training_log`, `training_session_notes`, `training_drills`, `training_sessions`, `training_session_participants`, `training_results`
- Scrims: `scrim_records`, `scrim_team_reviews`
- Tournament: `tournament_cycles`, `tournament_matches`

The Evolution Phase 2.2–2.8 migration chain adds 22 canonical tables for session identity, sources, match sets/matches, sequence history, lifecycle, roster policies/snapshots, role snapshots, participation, substitutions, result submissions, result versions and verification events. The backup requires all 22; missing any makes the backup incomplete.

Phase 3 candidate models are discovered automatically when present: `evolution_rubric_versions`, `evolution_rubric_dimensions`, `evolution_role_weight_profiles`, `evolution_evidence_items`, and `evolution_evidence_dimension_links`. If none exist, the current schema may still produce a complete Phase 2 backup. If any candidate exists but the candidate set is partial, the backup is explicitly marked incomplete.

## 2. Export contract

The v2 export includes:

- Format identifier and schema version
- Creation and export timestamps
- Team metadata and selected team identity
- Every public table discovered with `team_id`
- Direct foreign-key child tables without `team_id`
- Original row values and record IDs
- Per-table row counts and total row count
- Included-table manifest
- Schema fingerprint over columns and primary, unique, foreign-key, check and exclusion constraints
- Missing required/canonical/Phase 3 tables and unsupported child-table report
- Explicit non-team-owned/security exclusions

The inventory is schema-driven rather than a hard-coded export allowlist. New team tables are automatically considered. Any child table that cannot be safely scoped through its foreign-key path is reported as unsupported and prevents a complete status. Export can still produce a diagnostic file, but the restore endpoint rejects it.

## 3. Restore contract

Restore is owner-only and targets one explicitly selected team. It:

1. Rejects v1, incomplete, malformed, cross-team or schema-incompatible backups.
2. Validates every table array, row count, source team ID, payload column and required column before the first delete.
3. Derives dependency order from actual foreign keys and fails closed on cycles.
4. Deletes in reverse dependency order and inserts in dependency order inside one database transaction.
5. Preserves original record IDs and foreign-key relationships.
6. Remaps the historical owner membership to the authenticated owner of the target team, preserving the target account identity.
7. Restores append-only Evolution history only through a private, transaction-bound restore capability. The capability cannot be set by a client-controlled session variable alone.
8. Returns restored table names, row count, schema fingerprint and owner-remap status.

A failure rolls back the database restore transaction. The normal recovery path restores the backup to its original team ID; restoring into a newly created team with a different ID is a separate migration/transfer scenario and is not part of the current acceptance contract. Version-1 backups are deliberately rejected because their coverage cannot be proven.

## 4. Exclusions and boundaries

- `auth.users`, credentials and authentication identities are not exported.
- `profiles` and shared game catalogues are account/global data, not team-owned snapshots.
- Global `data_retention_settings` is not team data; `team_data_retention_settings` is included.
- OTP and account-recovery secrets are never exported.
- Shared `training_drills` template rows with `team_id IS NULL` are not team-owned; team-specific drill rows are included.
- Team logo bytes are embedded by the existing client export when available and within its 5 MB limit; the team avatar URL is retained in team metadata.
- Browser-local planning state is included separately under `local_device_data` with its own schema version and capture timestamp.

## 5. Player scores and evaluation history

Persisted team records include daily player drill scores, daily score evaluations and feedback, team ratings, training results/rubrics, task review history, roster/role snapshots and canonical match participation/results. These are backed up as their original rows, not recomputed during export.

A computed score that has never been persisted as a database record cannot be recovered by a database backup. Phase 3 evidence/rubric inputs are included once their schema is present; any future durable score-snapshot or evaluation-version tables will be automatically discovered if team-scoped, and should also be added to the required manifest when their schema contract is finalized.

## 6. Verification plan

- Source-contract suite: `npm run test:backup`, included in `npm run build`.
- PostgreSQL integration: `scripts/verify-drg-01-backup-db.sh`, which replays the verified disposable Phase 2.10 database chain, applies DRG-01, exports a complete team backup, validates FK-only child discovery, restores over existing rows in the same team and proves another team's rows remain untouched, checks ID/relationship preservation and owner identity, then verifies partial Phase 3 detection.
- GitHub Actions runs that integration in a separate disposable database named `squad_os_drg_01_ci`.

**Acceptance remains pending until GitHub Actions actually completes the PostgreSQL integration successfully.** A source-level test or Vercel build alone is not database restore verification.

## 7. Production boundary

This work is committed only to the DRG-01 feature branch. The connected Supabase project was queried read-only for schema inventory; no production migration, backup restore, data deletion, merge or production deployment was performed.
