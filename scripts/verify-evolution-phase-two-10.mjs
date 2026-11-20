import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Phase 2.10 adds validated composite team-scoped foreign keys", async () => {
  const sql = await read("../supabase/migrations/20261121000000_evolution_phase_two_10_database_integrity.sql");
  for (const name of [
    "tournament_matches_cycle_team_fk",
    "practice_plan_blocks_plan_team_fk",
    "training_sessions_plan_team_fk",
    "practice_tasks_plan_team_fk",
    "practice_tasks_block_team_fk",
    "practice_tasks_member_team_fk",
    "practice_tasks_source_session_team_fk",
    "training_session_participants_session_team_fk",
    "training_session_participants_member_team_fk",
    "training_results_session_team_fk",
    "training_results_member_team_fk",
    "scrim_team_reviews_scrim_team_fk",
  ]) assert.match(sql, new RegExp(name));
  assert.match(sql, /VALIDATE CONSTRAINT tournament_matches_cycle_team_fk/);
  assert.match(sql, /VALIDATE CONSTRAINT training_results_member_team_fk/);
  assert.match(sql, /ON DELETE SET NULL \(plan_id\)/);
  assert.match(sql, /ON DELETE SET NULL \(player_member_id\)/);
});

test("global drill templates remain valid and cross-team custom drill links are guarded", async () => {
  const sql = await read("../supabase/migrations/20261121000000_evolution_phase_two_10_database_integrity.sql");
  assert.match(sql, /training_drill_team_mismatch/);
  assert.match(sql, /training_drill_reference_not_found/);
  assert.match(sql, /NEW\.is_template AND NEW\.team_id IS NULL/);
  assert.match(sql, /training_drills_reassignment_guard/);
  assert.match(sql, /practice_task_block_does_not_belong_to_plan/);
});

test("Scrim match counts and NULL-player Training attempts have database uniqueness", async () => {
  const sql = await read("../supabase/migrations/20261121000000_evolution_phase_two_10_database_integrity.sql");
  assert.match(sql, /scrim_records_match_count_matches_array_check/);
  assert.match(sql, /jsonb_array_length\(matches\)=match_count/);
  assert.match(sql, /training_results_session_attempt_without_player_uidx/);
  assert.match(sql, /WHERE player_member_id IS NULL/);
});

test("migration is additive and validates existing rows without data rewrites", async () => {
  const sql = await read("../supabase/migrations/20261121000000_evolution_phase_two_10_database_integrity.sql");
  assert.doesNotMatch(sql, /\b(DELETE\s+FROM|UPDATE\s+public\.(tournament_matches|scrim_records|practice_plans|practice_tasks|training_sessions|training_results))\b/i);
  assert.match(sql, /NOT VALID/);
  assert.match(sql, /VALIDATE CONSTRAINT/);
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS/);
});
