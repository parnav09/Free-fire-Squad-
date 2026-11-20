# DRG-03 — Safe Restore and Data Recovery

Status: audit complete; implementation and disposable-database verification pending.
Branch: `feat/drg-03-safe-restore-data-recovery`
Base: `feat/drg-01-complete-player-data-backup`

## Non-negotiable safety contract

A restore must never delete or overwrite a current record merely because it is absent from, or differs from, an older backup. The default operation is additive recovery. Existing records are retained; conflicts are reported and require an explicit, separately reviewed resolution. No automatic deletion is part of the safe-restore path.

Atomicity is necessary but not sufficient: a transaction can atomically delete valuable records. DRG-03 must prove both transaction rollback and preservation of post-backup data.

## Audit findings

### Production database (read-only inspection, 2026-11-21)

- The connected FF Squad Supabase project is active on PostgreSQL 17.11.
- Applied migrations include the legacy restore migrations `20261108064524`, `20261108072831`, and `20261108073010`.
- The live database currently exposes schema-version-1 backup/restore functions. The scoped and unscoped legacy restore implementations delete team-owned rows before reinserting backup rows.
- The DRG-01 v2 migration is not in the live migration history. No production schema or data was changed during this audit.

### DRG-01 PR #134 (source review)

The draft PR adds a more complete v2 export and validates the checksum, schema fingerprint, required tables, row counts, team scope, and FK dependency order before writes. Its restore function runs in one PostgreSQL transaction and restores in parent-first order.

However, it still performs a full selected-team deletion pass before insertion. Therefore it remains a destructive replace operation, not a safe merge. The current app import handler calls the restore RPC immediately after parsing the file; there is no database comparison preview or conflict confirmation.

The app also restores local-device state and uploads the team logo after the database RPC returns. Those operations are outside the database transaction: a later storage/local failure can leave the database restored while the UI reports an overall failure or the device state remains only partly updated.

## Required DRG-03 design

### 1. Preview before mutation

Add an owner-authorized, read-only preview RPC. It must validate the backup format, checksum, schema fingerprint, table manifest, row counts, team identity, and FK graph before reporting a plan.

For every table, report:
- `additions`: backup rows with no matching current primary/unique identity.
- `unchanged`: rows already present with equivalent content.
- `conflicts`: same primary/unique identity but different content, or identity ambiguity.
- `current_only_preserved`: current rows absent from the backup. These are potential deletions in a replace model, but DRG-03 must retain them.
- Parent/child dependency blockers and schema compatibility warnings.

The preview must include a digest of the relevant current-team snapshot. The restore RPC must recompute the plan under locks and reject a stale preview if current data changed after preview.

### 2. Default restore policy

- Insert only missing, unambiguous rows.
- Never delete current rows.
- Never update a current row as an implicit conflict resolution.
- Treat primary-key and unique-key collisions as conflicts; do not use blind `ON CONFLICT DO UPDATE`.
- Preserve current team metadata and the currently authenticated owner identity.
- Do not automatically reactivate historical/removed team memberships from a backup; roster restoration requires explicit review.
- Remap only fields whose semantics require remapping, and report every remap.
- Preserve original IDs when safe; if an ID collides, do not silently generate a replacement when that would break child references.

### 3. Relationships and compatibility

- Build the restore order from actual FK constraints and insert parents before children.
- If a parent row is ambiguous or cannot be restored safely, block dependent child inserts and report the dependency chain.
- Fail closed on FK cycles, unsupported descendants, missing required tables/columns, incompatible constraints, and partial schema coverage.
- Version migrations explicitly. A v1 backup must not be passed to a v2 restore function. Any v1 import path must be a separately tested, non-destructive compatibility adapter; otherwise reject it with a clear export-new-backup message.

### 4. Atomic execution and verification

- Revalidate the preview digest and all constraints inside the same transaction as restore.
- Acquire deterministic write locks for the selected team's participating tables to prevent concurrent writes from invalidating the plan during application.
- Any failed insert, FK check, validation, or post-restore assertion must raise and roll back the entire transaction.
- Return per-table before/after counts, inserted/unchanged/conflict counts, preserved-current counts, and a content/relationship verification result.
- Recompute score/evaluation aggregates from persisted source records only where the product's existing scoring model requires it; never rewrite historical evaluations to force a total to match.
- Keep object-storage and local-device restoration as separately reported stages with retryable status. Do not claim the entire restore is atomic across PostgreSQL, Storage, and the browser.

## Disposable-database acceptance matrix

1. Export a team backup, then add newer daily evaluations, feedback, training results, and scrim records. Restore the older backup. Assert every newer row remains byte-for-byte unchanged.
2. Restore a backup containing missing historical rows. Assert only those rows are added.
3. Restore the same backup twice. Assert the second restore is idempotent and creates no duplicates.
4. Create same-primary-key/different-content and unique-key/different-primary-key collisions. Assert they are reported as conflicts and current rows remain unchanged.
5. Create a parent conflict with dependent children. Assert no orphan or mis-parented rows are created; the operation blocks or reports a dependency conflict.
6. Inject a failure after at least one insert. Assert transaction rollback leaves all table counts and row checksums unchanged.
7. Change current data after preview but before restore. Assert stale-preview rejection and no writes.
8. Test missing/extra columns, schema fingerprint mismatch, incomplete manifest, checksum tampering, FK cycle, and unsupported descendants. Assert fail-closed behavior.
9. Verify team isolation: no row from another team is read, updated, or inserted.
10. Verify daily score/evaluation record counts and recomputed totals before and after restore.
11. Test the v1 compatibility decision explicitly; never silently reinterpret v1 as v2.
12. Test local-device and logo failures independently and ensure the UI reports database and external-stage outcomes accurately.

## Safety boundary

This branch is based on DRG-01 PR #134 so the v2 backup contract can be reviewed alongside DRG-03. Do not merge, deploy, apply migrations to production, or run a restore against production until the disposable PostgreSQL integration suite passes and the preview/merge implementation is independently reviewed.
