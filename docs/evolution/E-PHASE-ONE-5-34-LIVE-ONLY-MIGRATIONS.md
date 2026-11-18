# E Phase One.5 — 34 live migration entries without same-name checked-in files

**Audit date:** 18 Nov 2026  
**Repository:** `parnav09/Free-fire-Squad-`  
**Branch:** `feat/evolution-phase-one-identity-timezone`  
**Scope:** Read-only provenance inventory. This is not a migration plan or approval to change the database.

## What “34 missing files” actually means

The live Supabase ledger has 55 rows. The audited branch has 23 SQL migration files. Exact name comparison represents 21 live rows through 20 distinct names (the duplicate `daily_score_feedback_private_rls` ledger name appears twice), leaving 34 live rows whose exact migration name does not occur in the branch's migration filenames.

This is a **repository provenance gap**, not proof that 34 database changes are absent or broken. Some entries have probable semantic counterparts, historical files on other branches, or prior-operation notes. None of those alone proves the exact SQL applied under the live version.

## Detailed register

| # | Live version | Live migration name | Evidence / candidate | Classification and safe next action |
|---:|---|---|---|---|
| 1 | 20261107081456 | `phase_0_security_performance` | Prior operation summary mentions security/performance work, but no exact SQL or application record. | **Unverified.** Recover original SQL and application record; keep Security review separate. |
| 2 | 20261107081539 | `phase_0_revoke_public_definer` | Prior summary mentions security/RLS fixes, but no exact SQL or application record. | **Unverified.** Recover exact SQL and approval/application evidence; do not infer from current grants. |
| 3 | 20261107130445 | `weekly_tournament_cycles_and_matches` | No same-name source or exact application record found in the inspected repository history. | **Unverified.** Recover original SQL and apply record. |
| 4 | 20261107130547 | `auto_seed_42_weekly_match_slots` | No same-name source or exact application record found in the inspected repository history. | **Unverified.** Recover original SQL and apply record. |
| 5 | 20261107133318 | `player_drill_assignments` | Prior record says the table was created on 7 Nov and references a GitHub commit, but preserves neither SQL nor migration path. | **Probable operation; SQL unverified.** Recover source from that commit/operation record. |
| 6 | 20261107153344 | `harden_assignments_and_sync_training_notes` | Prior summary mentions assignment hardening/session notes, but not the exact SQL. | **Unverified.** Recover original SQL and application record. |
| 7 | 20261107153641 | `remove_overlapping_team_settings_policy` | Prior summary mentions RLS fixes; no exact SQL/policy definition mapping. | **Unverified.** Recover SQL and application record; Security review remains separate. |
| 8 | 20261107154200 | `enable_realtime_for_squad_operations` | Prior summary mentions realtime work; no exact publication/table list or SQL. | **Unverified.** Recover original SQL and application record. |
| 9 | 20261107164949 | `unique_squad_usernames` | No same-name source or exact application record found in inspected history. | **Unverified.** Recover original SQL and application record. |
| 10 | 20261107175635 | `team_avatars_and_optional_logo` | No same-name source or exact application record found in inspected history. | **Unverified.** Recover original SQL and application record. |
| 11 | 20261108052253 | `account_recovery_email_and_otp` | Prior record reports recovery-email enrollment OTP storage applied on 8 Nov; it does not retain SQL/version/tool record. | **Probable feature mapping; SQL unverified.** Recover exact source and application record. |
| 12 | 20261108061922 | `team_join_approval_and_role_assignments` | No same-name source or exact application record found in inspected history. | **Unverified.** Recover original SQL and application record. |
| 13 | 20261108062141 | `guard_fifth_slot_in_join_approval` | No same-name source or exact application record found in inspected history. | **Unverified.** Recover original SQL and application record. |
| 14 | 20261108064303 | `team_leave_and_empty_cleanup` | No same-name source or exact application record found in inspected history. | **Unverified.** Recover original SQL and application record. |
| 15 | 20261108064524 | `team_backup_export_restore` | No same-name source or exact application record found in inspected history. | **Unverified.** Recover original SQL and application record. |
| 16 | 20261108064840 | `tighten_empty_team_cleanup_schedule` | No same-name source or exact application record found in inspected history. | **Unverified.** Recover original SQL and application record. |
| 17 | 20261108064910 | `lock_cleanup_trigger_function` | Prior summary mentions cleanup hardening, but no exact function body/application record. | **Unverified.** Recover original SQL; do not reconstruct function from live definition. |
| 18 | 20261108064937 | `restrict_join_review_rpc_to_signed_in_users` | Prior summary mentions RLS fixes, but no exact RPC SQL/application record. | **Unverified.** Recover exact SQL and application record; keep authorization review separate. |
| 19 | 20261108072713 | `scope_player_igns_to_each_team` | No same-name source or exact application record found in inspected history. | **Unverified.** Recover original SQL and application record. |
| 20 | 20261108072831 | `scope_backup_restore_to_selected_team` | No same-name source or exact application record found in inspected history. | **Unverified.** Recover original SQL and application record. |
| 21 | 20261108072846 | `scope_leave_action_to_selected_team` | No same-name source or exact application record found in inspected history. | **Unverified.** Recover original SQL and application record. |
| 22 | 20261108072905 | `remove_legacy_global_ign_check` | No same-name source or exact application record found in inspected history. | **Unverified.** Recover original SQL and application record. |
| 23 | 20261108072946 | `disable_legacy_unscoped_team_admin_rpcs` | Prior summary mentions legacy RPC restrictions, but no exact function SQL/application record. | **Unverified.** Recover exact SQL and application record; do not infer from current RPC definitions. |
| 24 | 20261108073010 | `restore_owner_team_scoped_ign_from_backup` | No same-name source or exact application record found in inspected history. | **Unverified.** Recover original SQL and application record. |
| 25 | 20261108105554 | `phase_2_configurable_roster_capacity` | Candidate file: `20261108230000_phase_2_roster_capacity.sql`. The feature is related, but both name and version differ. | **Probable semantic match only.** Compare original SQL and application record before documenting as mapped. |
| 26 | 20261108105653 | `phase_2_capacity_guard_member_assignment` | No same-name file or exact source identified. The roster-capacity file may be related but is not proof of this separate guard migration. | **Unverified.** Recover exact SQL and application record. |
| 27 | 20261108174835 | `phase_2_3_task_blocked_reason_and_category` | Candidate file: `20261109007000_phase_2_3_task_blocked_reason_category.sql`. The name differs; its timestamp prefix collides with the role-drill migration file. | **Probable semantic match only.** Preserve the duplicate-prefix defect and resolve exact SQL/version from Git and apply records before renaming anything. |
| 28 | 20261109033737 | `anonymous_daily_player_evaluation_feedback` | Candidate source family: `20261109014000_anonymous_daily_evaluation.sql`. That file includes several related behaviors, not a proven one-to-one mapping. | **Grouped candidate; exact mapping unverified.** Recover original SQL and operation sequence. |
| 29 | 20261109033815 | `enforce_daily_evaluation_date_and_anonymity` | Same candidate source family as row 28; no exact version-to-SQL mapping. | **Grouped candidate; exact mapping unverified.** Recover original SQL and operation sequence. |
| 30 | 20261109033916 | `allow_anonymous_daily_evaluation_insert` | Same candidate source family as rows 28–29; no exact version-to-SQL mapping. | **Grouped candidate; exact mapping unverified.** Recover original SQL and operation sequence. |
| 31 | 20261109094759 | `retention_settings_owner_access` | Related retention policy file exists, but no same-name source or exact SQL mapping. Destructive retention is paused. | **Unverified.** Recover original SQL; do not change retention or access policies. |
| 32 | 20261109095952 | `seed_team_retention_on_team_create` | Related team-scoped retention source exists, but no same-name source or exact SQL mapping. Destructive retention is paused. | **Unverified.** Recover original SQL; do not seed, delete, or alter retention data. |
| 33 | 20261114100112 | `create_character_profiles_table` | The `main` branch and `feat/character-catalogue-mainline` both contain `20261114100112_create_character_profiles_table.sql`. Commit `216a6edf3d1408ea49f008243cfb7ddb6ea32c76` explicitly says it is a reconstruction from the live schema because the original SQL was not retained. It is absent from this PR's current base/head trees. | **Filename/source restoration is available on main; original provenance is not.** Once this PR is legitimately retargeted to main after Phase Zero, the exact-name repository mismatch should disappear through the base branch. Do not label the reconstructed SQL as the original or replay it. Keep catalogue work separate. |
| 34 | 20261116115907 | `player_character_loadout` | A separate feature branch contains `20261116123000_player_character_loadout.sql`; its SQL adds the team-member JSONB loadout column and update policy. Version differs and no exact apply record proves it was used for this live row. | **Strong candidate, not verified.** Compare with the plural migration at live version 20261116115255 and recover the exact application record. Do not apply either file again. |

## Recovered evidence and boundaries

- The migration-path commit history retrieved for the repository does not contain original checked-in SQL for the 24 early entries dated 7–8 Nov. Prior conversation/operation notes describe broad work but do not retain exact SQL bodies or reliable version-to-SQL application records.
- The roster-capacity, task-metadata, Daily Evaluation, retention, Character Profiles, and singular loadout entries have candidate relationships described above. They remain candidates, not exact provenance mappings.
- The separate Character Profiles branch's file is explicitly a reconstruction from live schema, not the original SQL. The singular loadout file is from another feature branch and has a different timestamp than its live ledger version.
- The existing 18 same-name/different-version rows, duplicate live `daily_score_feedback_private_rls` name, and three checked-in files without direct live-name matches remain separate audit issues.
- No migration file was renamed, copied, synthesized, or applied as part of this inventory. No database schema, data, trigger, RLS, grant, function, or migration-history operation was performed.

## Safe resolution plan

1. Obtain original SQL bodies and application records from the original GitHub commits/PRs, Supabase SQL editor history or export, deployment/operator records, and any retained local migration artifacts.
2. For each recovered SQL body, record its SHA-256, source commit/artifact, live version/name, application timestamp/operator, and evidence of successful application.
3. Mark a row **verified** only when the exact SQL body and application record agree. Keep semantic candidates explicitly unverified.
4. For any unrecoverable operation, create a separately reviewed forward-reconciliation plan with a tested rollback. Never fabricate a historical migration file or edit the live migration ledger to make names line up.
5. Keep Security review separate, destructive retention paused, Phase Two unstarted, and do not access restricted combat/weapon/loadout modules or full-app previews.

**Current result:** the 34 entries are now individually inventoried and classified. The documentation gap is fixed; the database provenance gap is not yet resolved because original SQL/application evidence is missing.


## Cross-branch recovery sweep — 18 Nov 2026

- Inspected migration trees on `main`, the Phase Zero base branch, the current Evolution branch, and relevant retained feature branches. `main` has 24 migration files; this Evolution branch has 23. The additional same-name file on `main` is the explicitly documented Character Profiles schema reconstruction described in row 33, not the original SQL.
- Queried GitHub path history for representative exact filenames from the early 7–8 Nov group; GitHub returned no commits for those exact paths. The repository migration-path history and branch trees still do not expose the original SQL for the 24 early entries.
- The roster-capacity, task metadata, Daily Evaluation and retention files remain later/earlier semantic candidates only; their differing live versions do not establish the exact historical SQL or application order.
- No-op placeholder migrations, copied aliases, invented SQL, or live ledger edits were deliberately not created. They would make a clean database appear migrated while omitting required schema/function/policy behavior, or would falsely claim historical provenance.
- **Net verified correction:** one of the 34 current-branch filename mismatches is already represented on `main` by a clearly labeled reconstruction, so it is a branch-base discrepancy rather than a missing artifact across all branches. It does not close the original-provenance gap.
