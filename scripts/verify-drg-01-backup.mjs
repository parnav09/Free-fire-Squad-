import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("DRG-01 exports the required team, player, Planning, Training, Scrim and Evolution tables", async () => {
  const sql = await read("../supabase/migrations/20261121010000_drg_01_complete_team_backup.sql");
  for (const table of [
    "daily_drills","daily_scores","daily_score_feedback","team_ratings",
    "practice_plans","practice_plan_blocks","practice_tasks","practice_task_events",
    "training_sessions","training_session_participants","training_results",
    "scrim_records","scrim_team_reviews","tournament_cycles","tournament_matches",
    "canonical_sessions","canonical_session_sources","canonical_session_match_sets","canonical_session_matches",
    "canonical_session_match_sequence_events","canonical_session_lifecycle_events",
    "canonical_session_roster_policies","canonical_session_rosters","canonical_session_roster_members",
    "canonical_session_roster_member_events","canonical_session_match_participants",
    "canonical_session_match_participation_events","canonical_team_role_definitions",
    "canonical_team_role_definition_events","canonical_session_match_roles",
    "canonical_session_match_role_events","canonical_session_substitutions",
    "canonical_session_substitution_role_transfers","canonical_session_results",
    "canonical_session_result_versions","canonical_session_result_events",
    "canonical_session_result_submissions"
  ]) assert.ok(sql.includes(`'${table}'`), `Missing required backup table contract: ${table}`);
});

test("Backup inventory discovers team_id tables and FK-only child records without silent omission", async () => {
  const sql = await read("../supabase/migrations/20261121010000_drg_01_complete_team_backup.sql");
  assert.match(sql, /a\.attname = 'team_id'/);
  assert.match(sql, /direct_children AS/);
  assert.match(sql, /parent\.relname = 'teams'/);
  assert.match(sql, /CASE WHEN parent\.relname = 'teams' THEN 'id' ELSE 'team_id' END/);
  assert.match(sql, /team_backup_unsupported_child_tables/);
  assert.match(sql, /unsupported_child_tables/);
  assert.match(sql, /v_exported_tables = v_table_names/);
  assert.match(sql, /'complete',v_complete/);
  assert.match(sql, /'content_checksum',v_content_checksum/);
  assert.match(sql, /backup_content_checksum_mismatch/);
  assert.match(sql, /jsonb_build_object\('team',v_team,'tables',v_tables\)/);
  assert.match(sql, /jsonb_build_object\('team',p_backup->'team','tables',v_tables\)/);
});

test("Backup completeness fails closed for partially present Phase 3 schemas", async () => {
  const sql = await read("../supabase/migrations/20261121010000_drg_01_complete_team_backup.sql");
  assert.match(sql, /phase_three_schema_present/);
  assert.match(sql, /NOT v_phase_three_present OR pg_catalog\.cardinality\(v_missing_phase_three\) = 0/);
  assert.match(sql, /missing_phase_three_candidate_tables/);
});

test("Restore validates schema, payload rows, team identity, owner and FK dependency order before deletion", async () => {
  const sql = await read("../supabase/migrations/20261121010000_drg_01_complete_team_backup.sql");
  for (const contract of [
    "schema_fingerprint_mismatch_export_a_new_backup",
    "backup_schema_table_set_mismatch_export_a_new_backup",
    "backup_row_count_mismatch",
    "cross_team_row_detected_in_backup",
    "backup_must_contain_exactly_one_original_owner_membership",
    "team_backup_foreign_key_cycle_blocks_dependency_safe_restore",
    "current_owner_membership_restore_failed",
    "unsupported_team_child_table_blocks_safe_restore"
  ]) assert.ok(sql.includes(contract), `Missing restore safety check: ${contract}`);
  assert.match(sql, /v_delete_order/);
  assert.match(sql, /v_insert_order/);
  assert.match(sql, /OVERRIDING SYSTEM VALUE/);
});

test("Append-only Evolution history is bypassed only with a private transaction capability", async () => {
  const sql = await read("../supabase/migrations/20261121010000_drg_01_complete_team_backup.sql");
  assert.match(sql, /team_backup_restore_capabilities/);
  assert.match(sql, /pg_backend_pid\(\)/);
  assert.match(sql, /pg_current_xact_id\(\)/);
  assert.match(sql, /app\.squad_os_backup_restore_token/);
  assert.match(sql, /REVOKE ALL ON TABLE evolution_private\.team_backup_restore_capabilities FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /IF evolution_private\.is_team_backup_restore\(\) THEN RETURN NEW; END IF;/);
});

test("Schema fingerprint includes columns and primary, unique, foreign-key, check and exclusion constraints", async () => {
  const sql = await read("../supabase/migrations/20261121010000_drg_01_complete_team_backup.sql");
  assert.match(sql, /information_schema\.columns/);
  assert.match(sql, /constraint_row\.contype IN \('p','u','f','c','x'\)/);
  assert.match(sql, /pg_get_constraintdef/);
});

test("App exports v2 coverage details and refuses unsafe v1 or incomplete restores", async () => {
  const app = await read("../src/App.tsx");
  assert.match(app, /get_team_backup_for_team/);
  assert.match(app, /restore_team_backup_for_team/);
  assert.match(app, /schema_version!==2/);
  assert.match(app, /Legacy version 1 backups are incomplete/);
  assert.match(app, /Complete v2 backup/);
  assert.match(app, /missing_required_tables/);
  assert.match(app, /missing_canonical_evolution_tables/);
  assert.match(app, /restored_tables/);
});

test("Disposable PostgreSQL integration verifies export, restore, same-team restore and FK-only children", async () => {
  const script = await read("../scripts/verify-drg-01-backup-db.sh");
  assert.match(script, /verify-evolution-phase-two-10-db\.sh/);
  assert.match(script, /DRG-01 expected complete export/);
  assert.match(script, /FK-only child discovery or team scoping failed/);
  assert.match(script, /direct teams\(id\) child was not restored/);
  assert.match(script, /unsupported descendant was silently omitted/);
  assert.match(script, /restore_team_backup_for_team/);
  assert.match(script, /corrupted payload was not rejected/);
  assert.match(script, /current team owner identity was not retained/);
  assert.match(script, /persisted player scoring\/evaluation history was not exported/);
  assert.match(script, /persisted player scoring\/evaluation history did not survive restore/);
  assert.match(script, /partial Phase 3 schema was silently reported complete/);
  assert.match(script, /DRG-01 complete team backup export\/restore PostgreSQL integration PASS/);
});
