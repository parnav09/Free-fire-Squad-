# E Phase One.5-C — Historical Rollback Disposition Register

**Status:** 53/53 in-scope historical migrations explicitly classified · **FORWARD-ONLY / NO AUTOMATIC ROLLBACK**.  
**Audit date:** 18 Nov 2026  
**Source:** live `supabase_migrations.schema_migrations` ledger plus the exact recovered/active SQL files.  
**Scope:** 53 non-loadout historical migrations. The two loadout migrations remain outside this phase's approved scope.

## Why this register exists

The live ledger contains 55 rows, including two out-of-scope loadout rows. All 53 in-scope rows have one forward SQL statement and **zero stored rollback statements**. The absence of rollback SQL is not permission to invent destructive inverses.

For every in-scope version, this register records an explicit no-automatic-rollback disposition and the reason. This satisfies the historical disposition requirement without pretending that a reverse script exists. A forward-only classification is not a claim that a change can never be compensated; it means compensation must be a separately reviewed, additive migration or operational recovery plan.

## Non-negotiable rollback rules

1. Never delete, rewrite, or renumber a row in `supabase_migrations.schema_migrations` to simulate rollback.
2. Never replay an old forward migration against production to repair history.
3. Never `DROP TABLE`, truncate, bulk-delete seed rows, or remove columns merely because a feature is being reverted.
4. For data changes, preserve user-created or user-edited rows. Prefer a targeted, append-only compensating migration that preserves IDs and auditability.
5. For policies, grants, functions, and triggers, restore a prior definition only when the exact pre-change definition and ACL are independently captured and security-reviewed. Do not broaden access as a rollback shortcut.
6. Retention/cleanup migrations are intrinsically non-restorable for rows already deleted. A code rollback cannot recreate deleted data; restore only from a verified backup with explicit owner approval and a tested restore procedure.
7. Schema rollback requires dependency inventory, row-count/backup verification, and proof that no live code or data depends on the object.
8. Test every proposed compensation against a clean isolated database and a representative data-bearing clone before production. Production execution is a separate release approval.

## Per-migration disposition

| Version | Migration | Risk class | Disposition |
|---|---|---|---|
| `20261107081456` | `phase_0_security_performance` | MIXED_STATE | Forward-only · no automatic rollback |
| `20261107081539` | `phase_0_revoke_public_definer` | SECURITY_STATE | Forward-only · no automatic rollback |
| `20261107130445` | `weekly_tournament_cycles_and_matches` | SCHEMA_STATE | Forward-only · no automatic rollback |
| `20261107130547` | `auto_seed_42_weekly_match_slots` | FUNCTION_AND_DATA | Forward-only · no automatic rollback |
| `20261107133318` | `player_drill_assignments` | SCHEMA_AND_DATA | Forward-only · no automatic rollback |
| `20261107153344` | `harden_assignments_and_sync_training_notes` | MIXED_STATE | Forward-only · no automatic rollback |
| `20261107153641` | `remove_overlapping_team_settings_policy` | SECURITY_STATE | Forward-only · no automatic rollback |
| `20261107154200` | `enable_realtime_for_squad_operations` | EXTERNAL_STATE | Forward-only · no automatic rollback |
| `20261107164949` | `unique_squad_usernames` | SCHEMA_STATE | Forward-only · no automatic rollback |
| `20261107175635` | `team_avatars_and_optional_logo` | MIXED_STATE | Forward-only · no automatic rollback |
| `20261108052253` | `account_recovery_email_and_otp` | SECURITY_AND_DATA | Forward-only · no automatic rollback |
| `20261108061922` | `team_join_approval_and_role_assignments` | MIXED_STATE | Forward-only · no automatic rollback |
| `20261108062141` | `guard_fifth_slot_in_join_approval` | FUNCTION_AND_SECURITY | Forward-only · no automatic rollback |
| `20261108064303` | `team_leave_and_empty_cleanup` | DESTRUCTIVE_FUNCTION | Forward-only · no automatic rollback |
| `20261108064524` | `team_backup_export_restore` | DESTRUCTIVE_FUNCTION | Forward-only · no automatic rollback |
| `20261108064840` | `tighten_empty_team_cleanup_schedule` | DESTRUCTIVE_FUNCTION | Forward-only · no automatic rollback |
| `20261108064910` | `lock_cleanup_trigger_function` | SECURITY_STATE | Forward-only · no automatic rollback |
| `20261108064937` | `restrict_join_review_rpc_to_signed_in_users` | SECURITY_STATE | Forward-only · no automatic rollback |
| `20261108072713` | `scope_player_igns_to_each_team` | MIXED_STATE | Forward-only · no automatic rollback |
| `20261108072831` | `scope_backup_restore_to_selected_team` | SECURITY_STATE | Forward-only · no automatic rollback |
| `20261108072846` | `scope_leave_action_to_selected_team` | SECURITY_STATE | Forward-only · no automatic rollback |
| `20261108072905` | `remove_legacy_global_ign_check` | FUNCTION_AND_DATA | Forward-only · no automatic rollback |
| `20261108072946` | `disable_legacy_unscoped_team_admin_rpcs` | SECURITY_STATE | Forward-only · no automatic rollback |
| `20261108073010` | `restore_owner_team_scoped_ign_from_backup` | FUNCTION_STATE | Forward-only · no automatic rollback |
| `20261108105554` | `phase_2_configurable_roster_capacity` | SCHEMA_AND_DATA | Forward-only · no automatic rollback |
| `20261108105653` | `phase_2_capacity_guard_member_assignment` | FUNCTION_AND_SECURITY | Forward-only · no automatic rollback |
| `20261108122752` | `fix_set_display_name_rpc_ambiguity` | FUNCTION_AND_SECURITY | Forward-only · no automatic rollback |
| `20261108170059` | `phase_2_3_planning_training` | SCHEMA_STATE | Forward-only · no automatic rollback |
| `20261108170508` | `phase_2_3_player_task_updates` | SECURITY_STATE | Forward-only · no automatic rollback |
| `20261108170609` | `phase_2_3_seed_drill_templates` | SEEDED_DATA | Forward-only · no automatic rollback |
| `20261108170923` | `phase_2_3_session_participants` | SCHEMA_STATE | Forward-only · no automatic rollback |
| `20261108171644` | `phase_2_3_tactical_plan_fields` | SCHEMA_STATE | Forward-only · no automatic rollback |
| `20261108174411` | `phase_2_3_role_drill_templates` | SEEDED_DATA | Forward-only · no automatic rollback |
| `20261108174835` | `phase_2_3_task_blocked_reason_and_category` | SCHEMA_STATE | Forward-only · no automatic rollback |
| `20261108175900` | `phase_2_3_followup_task_session_link` | SCHEMA_STATE | Forward-only · no automatic rollback |
| `20261108193820` | `expand_drill_library_to_50` | SEEDED_DATA | Forward-only · no automatic rollback |
| `20261108195004` | `role_specific_drill_progression` | SEEDED_DATA | Forward-only · no automatic rollback |
| `20261108195112` | `complete_role_drill_library_to_100` | SEEDED_DATA | Forward-only · no automatic rollback |
| `20261109033737` | `anonymous_daily_player_evaluation_feedback` | SCHEMA_AND_PRIVACY | Forward-only · no automatic rollback |
| `20261109033815` | `enforce_daily_evaluation_date_and_anonymity` | FUNCTION_AND_PRIVACY | Forward-only · no automatic rollback |
| `20261109033916` | `allow_anonymous_daily_evaluation_insert` | SECURITY_STATE | Forward-only · no automatic rollback |
| `20261109034550` | `daily_score_feedback_private_rls` | MIXED_STATE | Forward-only · no automatic rollback |
| `20261109034618` | `daily_score_feedback_private_rls` | MIXED_STATE | Forward-only · no automatic rollback |
| `20261109093254` | `smart_task_deadlines_and_retention` | DESTRUCTIVE_MIXED | Forward-only · no automatic rollback |
| `20261109093320` | `fix_task_lifecycle_event_order` | FUNCTION_AND_DATA | Forward-only · no automatic rollback |
| `20261109093531` | `igl_task_management_rls` | SECURITY_STATE | Forward-only · no automatic rollback |
| `20261109094759` | `retention_settings_owner_access` | SECURITY_STATE | Forward-only · no automatic rollback |
| `20261109095926` | `team_scoped_retention_policies` | DESTRUCTIVE_MIXED | Forward-only · no automatic rollback |
| `20261109095952` | `seed_team_retention_on_team_create` | FUNCTION_AND_DATA | Forward-only · no automatic rollback |
| `20261110181415` | `scrims_personal_team_review` | SCHEMA_AND_PRIVACY | Forward-only · no automatic rollback |
| `20261110181550` | `scrims_owner_update_team_scope` | SECURITY_STATE | Forward-only · no automatic rollback |
| `20261114100112` | `create_character_profiles_table` | SCHEMA_AND_CATALOGUE | Forward-only · no automatic rollback |
| `20261116092206` | `sync_all_67_character_profiles` | SEEDED_CATALOGUE_DATA | Forward-only · no automatic rollback |

## Risk-class handling

| Risk class | Required recovery strategy |
|---|---|
| `SECURITY_STATE`, `SECURITY_AND_DATA`, `SECURITY_AND_PRIVACY` | Keep current restrictive posture. Any permission reversal requires exact old ACL/policy source, access-path review, and independent Security approval. |
| `FUNCTION_STATE`, `FUNCTION_AND_SECURITY`, `FUNCTION_AND_DATA` | Capture current function/trigger definitions and grants; write a new compensating migration only after reviewing callers, dependencies, and behavior. |
| `SCHEMA_STATE`, `SCHEMA_AND_DATA`, `SCHEMA_AND_PRIVACY`, `SCHEMA_AND_CATALOGUE` | Preserve tables/columns and existing rows. Deprecate/compatibly migrate first; drop only after a separate verified data-retention and dependency gate. |
| `SEEDED_DATA`, `SEEDED_CATALOGUE_DATA` | Never delete or overwrite the seed batch blindly. Preserve later user edits and stable IDs; use versioned updates or explicit deprecation. |
| `DESTRUCTIVE_FUNCTION`, `DESTRUCTIVE_MIXED` | No data rollback exists for already-deleted rows. Stop the destructive job first, then recover only from a verified backup; code reversal alone is insufficient. |
| `EXTERNAL_STATE` | Capture current publication membership and dependent subscriptions before any change; reconcile state explicitly rather than blindly removing publication entries. |
| `MIXED_STATE`, `DESTRUCTIVE_MIXED` | Split compensation by object/data/security concern; one blanket inverse is not acceptable. |

## Special cases and integrity checks

- Versions `20261109034550` and `20261109034618` share a migration name but are distinct live versions with distinct forward SQL. Both are listed separately; neither is collapsed or removed.
- The two loadout versions `20261116115255` and `20261116115907` are intentionally not included or inspected by this register.
- The staged B timezone rollback is a separate draft rollback for an unapplied migration. It is not counted as a historical rollback and must not be represented as database-tested.
- No live SQL, schema, data, RLS policy, grant, trigger, function, migration ledger row, or production deployment was changed while preparing this register.

## Acceptance

- [x] Read-only ledger count: 55 rows.
- [x] In-scope historical set: 53 versions.
- [x] Stored rollback statements: 0/53.
- [x] Each of the 53 versions has a unique version key and an explicit forward-only disposition.
- [x] Every disposition has a risk class and a concrete recovery rule.
- [x] Duplicate migration name retained as two versioned entries.
- [x] Two out-of-scope loadout rows remain untouched.
- [x] No destructive inverse SQL was fabricated or executed.
- [ ] Any future compensating migration must pass independent review, isolated DB tests, and its own release approval.

**C result:** Historical rollback disposition is complete and auditable. There are still zero automatic historical rollback scripts; that is an explicit safety classification, not an unresolved omission. Production rollback/compensation execution is not authorized by this register.
