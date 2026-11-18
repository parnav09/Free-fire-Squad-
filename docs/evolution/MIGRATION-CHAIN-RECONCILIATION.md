# Migration chain reconciliation and dependency order

**Updated:** 18 Nov 2026  
**Branch:** `feat/evolution-phase-one-identity-timezone`  
**Scope:** migration provenance and ordering only; no live database changes.

## Reconciliation result

- The 53 safe-scope SQL files in `docs/evolution/recovered-migrations/` were recovered verbatim from the live migration ledger.
- The active migration directory was rebuilt from the recovered originals for the 29 migrations represented by the previous 22 active files.
- All 29 active files now match the corresponding recovered archive blobs exactly (29/29).
- The six SQL-content mismatch cases were replaced with the corresponding stored live SQL.
- The three non-canonical names were replaced with their exact live ledger version/name pairs:
  - `20261108105554_phase_2_configurable_roster_capacity.sql`
  - `20261108174835_phase_2_3_task_blocked_reason_and_category.sql`
  - the aggregate Daily Evaluation file was split into the three original entries `20261109033737`, `20261109033815`, and `20261109033916`.
- The former duplicate timestamp `20261109007000` is gone. The two `daily_score_feedback_private_rls` ledger entries remain separate, with versions `20261109034550` and `20261109034618`.
- The two scrim migrations were also replaced with the exact recovered live SQL after byte-level comparison found the checked-in copies differed.
- The two loadout migrations remain excluded from this workstream.

## Active migration order and dependencies

The files sort in live-ledger order. The main dependency edges are:

1. **Roster and identity:** `08105554 phase_2_configurable_roster_capacity` requires the pre-existing `profiles`, `team_members`, `team_join_requests`, `team_settings` tables and `is_team_owner`; `08105653 phase_2_capacity_guard_member_assignment` follows the roster-capacity migration. `08122752 fix_set_display_name_rpc_ambiguity` depends on the existing profile/team-membership model.
2. **Planning/training base:** `08170059 phase_2_3_planning_training` creates `practice_plans`, `practice_plan_blocks`, `practice_tasks`, `training_drills`, `training_sessions`, and `training_results`. All later planning/training migrations depend on these tables.
3. **Training extensions:** `08170508 player_task_updates`, `08170609 seed_drill_templates`, `08170923 session_participants`, `08171644 tactical_plan_fields`, `08174411 role_drill_templates`, `08174835 task_blocked_reason_and_category`, and `08175900 followup_task_session_link` follow the base training schema. Drill-library expansions `08193820`, `08195004`, and `08195112` follow `training_drills`.
4. **Daily Evaluation:** `09033737 anonymous_daily_player_evaluation_feedback` requires the existing `daily_scores` table; `09033815 enforce_daily_evaluation_date_and_anonymity` installs the trigger; `09033916 allow_anonymous_daily_evaluation_insert` updates the insert policy. The two private-feedback migrations `09034550` and `09034618` follow and depend on `daily_scores`, `teams`, and `can_rate`.
5. **Task lifecycle and retention:** `09093254 smart_task_deadlines_and_retention`, `09093320 fix_task_lifecycle_event_order`, and `09093531 igl_task_management_rls` require the practice-task schema. `09094759 retention_settings_owner_access` requires the original `data_retention_settings` table and team membership model; `09095926 team_scoped_retention_policies` creates the team-scoped settings and cleanup function; `09095952 seed_team_retention_on_team_create` depends on `team_data_retention_settings` and `teams`.
6. **Scrims:** `10181415 scrims_personal_team_review` and `10181550 scrims_owner_update_team_scope` require the existing scrim tables and team ownership model.
7. **Character profiles:** `14100112 create_character_profiles_table` precedes `16092206 sync_all_67_character_profiles`.

## Verification performed

- 29/29 active migration files have exact archive blob matches.
- No duplicate 14-digit migration versions remain in the active directory.
- All 29 active versions are in ascending ledger order.
- Read-only live-schema inventory confirmed the expected prerequisite tables/functions for the above groups exist in the current production database.
- No migration was applied to production; no schema, data, RLS, grants, functions, or migration ledger was modified.

## Remaining blockers — do not claim clean replay

- The recovered archive has 53/53 safe-scope SQL bodies, but the live ledger has zero rollback bodies for all 55 rows.
- The other 24 safe-scope ledger migrations are still in the recovery archive, not the active migration directory. They include foundational Phase 0/1 changes; the active 29-file set alone is therefore not a complete fresh-database chain.
- A complete replay requires a reviewed baseline for the pre-existing schema, inclusion/order review of the 24 archived foundation migrations, and an isolated database. No Supabase development branch currently exists.
- Performance advisor findings remain (unindexed foreign keys, RLS init-plan warnings, and multiple permissive policies). Security advisor findings remain a separate workstream (SECURITY DEFINER execute grants and Auth leaked-password protection). They were not altered as part of migration provenance recovery.
- No Phase Two feature work, retention-policy behavior changes, loadout work, PR merge, or production deployment was performed.

**Status:** active-file provenance and ordering for the represented 29 migrations are reconciled. Full E Phase One.5 remains **IN PROGRESS** until the 24 archived foundation migrations, baseline, rollback strategy, and isolated clean replay are resolved.
