# E Phase One.5 — Migration Provenance Audit Checkpoint

**Status:** SQL source recovery completed for 53/55 live ledger entries in the non-loadout scope. The recovered SQL is archived and hash-verified; active migration-chain reconciliation, rollback design, and clean-database replay remain incomplete. No database migration or schema change has been applied.

**Branch:** `feat/evolution-phase-one-identity-timezone`  
**PR:** #115 (open, draft; stacked on Phase Zero PR #114)  
**Audited head:** `dbaaa00bd42657bdb01238dd447a54fc89cfd9e9`  
**Audit date:** 18 Nov 2026

## 1. Current-head verification

- PR #115 remains open and draft, with no merge.
- The audited head is `dbaaa00bd42657bdb01238dd447a54fc89cfd9e9`.
- GitHub Actions run #86 (`44180645838`) completed successfully. Its single job passed typecheck, configured tests, and the Vite production build.
- The combined commit status still reports a Vercel failure associated with the account build-rate limit. This is separate from the successful GitHub Actions run; no preview or device QA is claimed.
- No production deployment was run.

## 2. Migration inventory comparison

Read-only comparison of the live Supabase migration ledger and the audited branch tree found:

| Check | Result |
|---|---:|
| Live migration ledger entries | 55 |
| Checked-in migration files | 23 |
| Distinct migration names present in both | 20 |
| Live entries represented by those shared names | 21 |
| Shared names with exact version + name match | 2 |
| Shared names whose checked-in timestamp differs from live version | 18 |
| Live migration names with no same-name checked-in file | 34 |
| Checked-in files with no direct same-name live entry | 3 |

Additional anomalies:

- The checked-in directory contains two files with the same timestamp prefix `20261109007000`.
- The live ledger contains the same migration name, `daily_score_feedback_private_rls`, under two different versions: `20261109034550` and `20261109034618`.
- The checked-in file with that name has a different timestamp prefix.
- Git history confirms migration-directory changes and filename alignment/removal work, but that history alone does not prove which SQL was applied under each live version.

**Interpretation:** this is a provenance mismatch, not proof that the live database is missing SQL. A same-name/different-version record may reflect a rename, timestamp correction, re-application, or a migration recorded through another workflow. A missing checked-in file may have been deleted, squashed, renamed, or applied without a retained repository file. These possibilities must not be treated as equivalent.

## 3. Live timezone and Daily Evaluation write-path findings

Read-only inspection of the live schema and function definitions found:

- `public.teams.timezone` exists as `text NOT NULL DEFAULT 'UTC'`.
- The current team rows use two valid IANA names: `Asia/Kolkata` (14 teams) and `Asia/Calcutta` (1 team). The latter is a valid compatibility alias; this audit did not rewrite or canonicalize it.
- `public.create_team(p_name text, p_description text, p_timezone text)` stores the trimmed supplied timezone, falling back to `UTC` for blank input. Its current body does not validate the value against PostgreSQL's timezone catalog.
- `public.daily_scores` has a **BEFORE INSERT** trigger named `daily_scores_lock_date_anonymous`.
- The trigger function `public.lock_daily_score_date_and_anonymize()` currently sets `score_date` using hard-coded `Asia/Kolkata`, then preserves the existing anonymization/privacy behavior: clears evaluator identity and narrative fields and sets recipient-only visibility.
- The current `ds_insert` RLS policy independently checks that `score_date` equals the current `Asia/Kolkata` date. Updating only the trigger would therefore leave the insert policy inconsistent.
- The trigger is INSERT-only. No UPDATE trigger for this date lock was found.
- The trigger function is currently `SECURITY DEFINER`. This audit does not change its security mode, grants, policies, or function ownership.

## 4. Provisional migration direction — NOT APPROVED

Only after migration provenance is reconstructed and reviewed, the candidate forward migration should:

1. Resolve the timezone from the exact `teams.id = NEW.team_id` row for each new Daily Evaluation record.
2. Fail closed if the team row is missing or its timezone is not a recognized IANA timezone.
3. Set `daily_scores.score_date` from the same transaction timestamp interpreted in that team's timezone.
4. Update the `ds_insert` policy in the same migration so the policy and trigger enforce the same team-local date rule.
5. Preserve the trigger's current anonymization and recipient-privacy behavior exactly.
6. Validate timezone input on the server-side team creation/update paths; do not rely only on the client-side IANA helper.
7. Avoid rewriting historical `daily_scores.score_date` values.
8. Keep authorization/RLS hardening and independent Security review as a separate gate. Do not blanket-revoke `SECURITY DEFINER` functions or change unrelated grants.

This is a design direction, not migration SQL and not approval to apply a migration. The exact implementation depends on provenance reconstruction and a review of all relevant write paths.

## 5. Required acceptance tests for the eventual migration

- Two teams with different IANA timezones can produce different local dates for the same UTC instant.
- A timestamp immediately before and after local midnight maps to the correct team-local date.
- A daylight-saving timezone is tested across both a DST transition and an ordinary date boundary.
- The existing `Asia/Kolkata` value remains correct; the valid `Asia/Calcutta` alias is accepted unless a separately reviewed canonicalization policy is adopted.
- A missing team row or invalid timezone fails closed.
- A client-supplied `score_date` cannot override the server-derived value.
- The INSERT policy accepts the matching team-local date and rejects a mismatched date.
- Existing evaluator anonymization, narrative-field clearing, and recipient-only visibility behavior remain unchanged.
- Existing historical score dates are not rewritten.
- Rollback restores the exact pre-migration trigger function and INSERT policy definitions without modifying historical rows.

## 6. Blocking work before design approval

1. Reconstruct the 34 live entries without same-name checked-in files from repository history and deployment provenance. Identify whether each is deleted, renamed, squashed, or externally applied; do not infer SQL absence from filename mismatch.
2. Resolve the 18 same-name/different-version mappings and the duplicate live migration-name entry.
3. Resolve the duplicate checked-in timestamp prefix and the three checked-in files without direct live-name matches.
4. Inspect every safe write path that can change `teams.timezone` and `daily_scores` date values.
5. Obtain an independent Security review of the final function/policy design before any migration is applied.

## 7. Changes intentionally not made

- No SQL, schema, data, trigger, policy, grant, function, or migration-history changes.
- No migration file created or applied.
- No timezone selector exposed and no claim that persisted dates are already team-timezone-aware.
- No RLS/auth hardening or blanket SECURITY DEFINER changes.
- No retention job changes.
- No merge, production deployment, or full-app preview testing.
- No Phase Two work.


## 8. Repository-history provenance reconstruction — 18 Nov 2026

This section records evidence recovered from Git commit history and prior project-operation records. It separates exact historical filename alignment from semantic similarity. A matching name or feature description is not, by itself, proof that the SQL applied under a live ledger version is byte-for-byte identical.

### 8.1 High-confidence Scrims filename alignment

- The original 20261110150000_scrims_personal_team_review.sql was added in commit cc7d2cd079de4518eab58767a790520a37afe812, then removed in 120e81f384de2b2814acec28599d95ec1ec813f2. The replacement file 20261110181415_scrims_personal_team_review.sql was added in 47a4f490ba247d66f66fa14cac0d45d4bc1ef946.
- Prior project records show the user approved applying the Scrims migration and the assistant reported the live tables created and migration history recorded as scrims_personal_team_review. The live ledger now contains exactly version 20261110181415 with that name. This supports the replacement filename as the applied migration source; the earlier 20261110150000 file is historical and must not be replayed.
- The owner-update migration was first committed as 20261110182000_scrims_owner_update_team_scope.sql in 35e874ad51dfc2ac2c75db964afcc893d21b869c. A production-aligned file 20261110181550_scrims_owner_update_team_scope.sql was added in 3da844d5c9c060204b1b776a4357c4a60c3f5121; the earlier 20261110182000 file was removed in 577bd03b304247dba23bf350ccd88d728be73583. The live ledger contains version 20261110181550 with the matching name. Do not reapply either file to “repair” history.

### 8.2 Tracked SQL with timestamp/name mismatches

- The two files sharing repository timestamp prefix 20261109007000 were introduced by separate commits: e930b82a5a3b851185ed9f5f7546e5d9ec67daca (role-drill templates) and 86ab551ef56f47cd21d31fd8c1561a57a091a135 (task metadata). The live ledger records separate versions 20261108174411 and 20261108174835 for the corresponding features. The duplicate repository prefix is a filename-ordering defect; it does not mean the live ledger has a duplicate version.
- The task-metadata file is named phase_2_3_task_blocked_reason_category, while the live ledger name is phase_2_3_task_blocked_reason_and_category. The SQL content is visible in Git history, but the naming difference must remain an explicit semantic mapping, not an exact name match.
- The roster-capacity file 20261108230000_phase_2_roster_capacity.sql and the live entry 20261108105554_phase_2_configurable_roster_capacity are semantically related but have different names and timestamps. The source file is in commit 1b61c7ec4ad6a26c4c6f194a0a7264ad3bf3fa0d; no SQL hash is stored in the migration ledger to prove exact equivalence.
- The Daily Evaluation source history is not one-to-one. Commit c8bfd087e5d5a14994a6c57bbb8ca410266947a0 introduced 20261109014000_anonymous_daily_evaluation.sql and 20261109035000_daily_score_feedback_private_rls.sql. The first file includes the anonymous date-lock trigger/policy and the recipient-feedback table transition; the second repeats the private-feedback table/policy/function portion. The live ledger has separate names for anonymous feedback, date/anonymity enforcement, anonymous insert permission, and two entries named daily_score_feedback_private_rls. The tracked files provide feature-level evidence, but do not prove the exact SQL/version mapping for all five live entries.

### 8.3 Character catalogue and loadout history

- The live entry 20261114100112_create_character_profiles_table has no same-name checked-in migration file in the audited branch tree or the retrieved migration-path history.
- The checked-in 20261116102000_sync_all_67_character_profiles.sql is present in Git history (commit 7e131b4f7d6d680fce40487d3ecee8f97b98c0a5). The live ledger has the same name at version 20261116092206; prior project records report that the 67-profile sync migration was applied on 16 Nov. This establishes a likely source relationship, but not an exact version/SQL hash match.
- The live ledger contains both player_character_loadouts (20261116115255) and player_character_loadout (20261116115907). Git history contains one plural-named file, 20261116120000_player_character_loadouts.sql, introduced with the player character assignment work. Prior records confirm the feature was merged, but do not establish whether the two live entries are separate revisions, a singular/plural rename, or distinct SQL operations. Keep both ledger rows untouched and mark the mapping unresolved.

### 8.4 Prior-operation records for migrations without retained SQL

- The recovery_email_enrollment_otps table was reported as applied on 8 Nov, while the live ledger contains account_recovery_email_and_otp at 20261108052253. The feature relationship is plausible, but the prior record contains no exact migration SQL, version, or application mechanism; classify as probable, not verified.
- player_drill_assignments was reported as created on 7 Nov and is present in the live ledger at 20261107133318. The prior record references a GitHub commit but does not preserve the SQL or a migration-file path. Exact provenance remains unverified.
- Prior records report team_scoped_retention_policies as the latest migration on 10 Nov; the live ledger records it at 20261109095926, and the repository contains a similarly named file with a different timestamp. This is a name-level match, not an exact version match.
- Prior project history also records a data reset on 8 Nov that preserved database structure, functions, and migrations. It is not migration provenance evidence and must not be interpreted as a migration-ledger reset.

### 8.5 Reconciliation status

| Evidence class | Result | Treatment |
|---|---|---|
| Exact version + name matches | 2 | Keep as exact matches |
| Same name, different live/repository version | 18 | Preserve as timestamp mismatches until exact source mapping is proven |
| Same feature, different migration name | At least 3 candidates | Record as probable mappings only; do not rename ledger rows |
| Git-confirmed historical rename/replacement | Scrims pair | Source alignment reconstructed; do not replay old filenames |
| Duplicate live migration name | 2 ledger rows, 1 tracked source file | Unresolved; no deletion, reapplication, or ledger rewrite |
| Live migrations without recoverable checked-in SQL | Remaining entries | Unresolved pending original SQL/application records |

The Git and prior-conversation evidence improves provenance coverage, but it does **not** reconcile every live migration. Supabase's migration ledger stores version/name metadata, not the SQL body or a content hash. The available project history does not preserve the original SQL/application record for every direct database operation. No migration SQL should be inferred from the current schema alone.

**E Phase One.5 remains IN PROGRESS.** The migration provenance gate is not met; the timezone design remains provisional and unapproved. No database or migration-history changes were made during this reconstruction.


### 8.6 Initial database-application records — exact SQL unavailable

Prior conversation records establish that additional Supabase migrations were applied on 7 Nov and that the assistant reported three new migrations, bringing the applied total to eight. The summary mentions security/performance work, assignment hardening, realtime, session notes, and RLS fixes, but does not retain the exact SQL blocks, exact version/name-to-SQL mapping, or a reliable application-tool record. An earlier summary in the same history reported five migrations before the later report of eight, so counts alone are not reliable provenance.

A separate 8 Nov record reports that recovery-email enrollment OTP storage was applied, but likewise lacks the exact migration SQL/version and application workflow. The live ledger's account-recovery entry is therefore only a probable feature mapping.

These records confirm that some live database changes were made outside the currently retained migration files, but they do not supply enough evidence to reconstruct the exact source SQL. They must remain unresolved rather than be reverse-engineered from the current schema and treated as original source.


## 8.7 Detailed register for all 34 live-only names — 18 Nov 2026

A dedicated row-by-row register was added at [`E-PHASE-ONE-5-34-LIVE-ONLY-MIGRATIONS.md`](./E-PHASE-ONE-5-34-LIVE-ONLY-MIGRATIONS.md). It lists every live version/name pair and separates: 24 early Nov 7–8 operations without retained SQL/application records; roster-capacity candidates; the task-metadata filename variant; three Daily Evaluation entries with a grouped candidate source; two retention entries; the Character Profiles schema reconstruction; and the singular player-loadout candidate found on a separate feature branch.

The 34 count is an exact-name repository comparison, not evidence of 34 missing database features. The inventory classifies candidates without promoting them to verified mappings. The Character Profiles file is explicitly a reconstruction, not original SQL. The singular loadout candidate has a different timestamp and no exact application record. No migration files were renamed/copied/synthesized, and no database or migration-history changes were made. Original SQL plus application evidence remains required before a provenance row can be marked verified.


## 9. Current-head continuation verification and timezone write-path coverage — 18 Nov 2026

- Current PR #115 head ac76497c30b90464ecfb10adc9ded8e1bdfdf48a is open and draft; it remains stacked on Phase Zero PR #114. No merge or retarget was performed.
- GitHub Actions run #114 (44191983016) for this exact head completed successfully. Its single job passed dependency installation, lockfile pinning, typecheck, configured verification suites, and the Vite production build. This supersedes the earlier pending status for this docs-only checkpoint.
- Re-read the live Supabase migration ledger: 55 version/name rows remain. Supabase reports no development branches for this project. The ledger still exposes no original SQL body or content hash, and no new exact SQL-to-ledger mapping was recovered.
- Read-only inspection of the live timezone-related function definitions found additional persisted-timezone write paths:
  - create_team(p_name, p_description, p_timezone) trims and stores the supplied timezone, defaulting blank input to UTC; it does not validate the value against PostgreSQL's recognized timezone catalog.
  - restore_team_backup(p_backup) and restore_team_backup_for_team(p_backup, p_team_id) restore teams.timezone from backup JSON with only a blank/null fallback; they do not validate the imported value.
  - The existing daily_scores BEFORE INSERT trigger still derives score_date using hard-coded Asia/Kolkata; the ds_insert policy independently enforces that same hard-coded date. Both must move together in any future timezone migration.
- The restore functions are part of the timezone write-path inventory, not permission to change backup behavior in this phase. No function, trigger, policy, grant, schema, data, or migration-history change was made.
- A complete timezone implementation therefore needs a single server-side IANA validation contract across team creation and both backup-restore paths, plus the Daily Evaluation trigger/policy date contract. Client-side validation alone is insufficient.
- The provenance blocker remains unchanged: the original SQL/application records for unresolved live migrations are not available in the repository or the live migration ledger. No original SQL was reconstructed from current schema.
- Vercel's separate deployment-rate-limit failure remains; no preview, device QA, or production deployment is claimed.

**E Phase One.5 status: IN PROGRESS / BLOCKED ON SOURCE PROVENANCE.** The current-head CI gate is green, but the migration provenance gate is not met. Do not approve or apply a timezone migration, alter migration history, or claim persisted dates are team-timezone-aware until original SQL/application evidence and a reviewed rollback are available.


### Cross-branch 34-entry recovery sweep — 18 Nov 2026

- Compared migration trees on `main`, the Phase Zero base, current Evolution branch, and relevant retained feature branches. `main` contains 24 migration files vs 23 on the Evolution branch. The extra exact-name Character Profiles migration is a documented reconstruction (commit `216a6edf3d1408ea49f008243cfb7ddb6ea32c76`), not the original SQL; it will already be present when the PR is eventually retargeted to `main` after Phase Zero. Thus one of the 34 current-branch filename mismatches is a base-branch artifact, not a missing artifact across all branches.
- GitHub exact-path history for representative early 7–8 Nov migrations returned no commits; the branch-tree sweep did not recover the original SQL for the early 24.
- Roster-capacity, task metadata, Daily Evaluation and retention files remain semantic candidates with mismatched live versions and unproven application order.
- No-op tombstones, guessed aliases, copied candidate SQL, or live ledger edits were not created. They could silently omit required behavior on clean builds or falsely claim historical provenance.
- This improves the branch inventory but does not resolve original SQL provenance. Keep Phase One.5 blocked pending authoritative source/application evidence and rollback review.


## 10. Verbatim SQL source recovery and content verification — 18 Nov 2026

The earlier conclusion that the live migration ledger exposed only version/name metadata was incomplete. Read-only inspection of `supabase_migrations.schema_migrations` found these columns: `version`, `statements`, `name`, `created_by`, `idempotency_key`, and `rollback`.

- All 55 live ledger rows have stored SQL statements.
- All 55 rows have zero stored rollback statements.
- Recovered 53 complete SQL entries verbatim from the live `statements` arrays into `docs/evolution/recovered-migrations/`.
- Deliberately excluded the two `player_character_loadouts` / `player_character_loadout` entries because loadout is restricted scope. Their SQL was not opened or archived.
- The archive includes a README and a manifest containing each live version/name, statement count, and SQL character count. It is outside `supabase/migrations/`, so it is not an active Supabase migration directory.
- Independent verification recomputed each Git blob SHA-1 from the exact live SQL statement bytes and compared it with the committed Git tree. **53/53 recovered SQL files matched exactly; zero mismatches.**
- Compared all 22 current non-loadout migration files against live ledger SQL by migration name: 13 files are byte-identical to a live statement; 6 same-name files differ from the live statement(s); 3 files have no same-name live ledger row. This is a content comparison, not just a timestamp/name comparison.
- The two same-prefix `20261109007000` files and the duplicate live `daily_score_feedback_private_rls` name remain explicitly unresolved in the active migration chain. Both distinct live Daily Evaluation feedback SQL statements are preserved separately in the archive.
- The current active `supabase/migrations/` directory was not renamed, deleted, overwritten, or expanded. No live database change or migration replay was performed.

### Remaining gates

1. Reconcile the 6 same-name SQL mismatches and 3 name-mismatched repository files against the exact recovered source; decide which active files should be replaced or retired only after dependency/order review.
2. Review the duplicate live migration name and duplicate repository timestamp prefix.
3. Keep the two loadout entries outside this recovery scope.
4. Design and review rollback SQL separately: the live ledger contains no rollback statements.
5. Run a clean-database replay and schema/behavior verification in an isolated development database. The project currently has no Supabase development branches; no paid/chargeable branch was created.

**Result:** original SQL source is now recovered and content-verified for 53 live migrations. E Phase One.5 is still **IN PROGRESS**, not complete: active-chain reconciliation, rollback, and clean replay remain unverified. No Phase Two implementation, Security changes, retention changes, merge, or production deployment was performed.
