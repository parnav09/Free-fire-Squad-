import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const migration = await readFile(
  new URL("supabase/migrations/20261122140000_evolution_phase_three_3_evidence_data_model.sql", root),
  "utf8",
);
const dimensionMigration = await readFile(
  new URL("supabase/migrations/20261122130000_evolution_phase_three_2_canonical_dimension_registry.sql", root),
  "utf8",
);
const roleMigration = await readFile(
  new URL("supabase/migrations/20261119200000_evolution_phase_two_6_role_snapshot.sql", root),
  "utf8",
);

test("Point 3.3 adds immutable evaluation context anchors without inventing legacy context", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.evolution_evaluation_contexts/);
  assert.match(migration, /player_member_id uuid NOT NULL/);
  assert.match(migration, /player_user_id uuid NOT NULL/);
  assert.match(migration, /canonical_session_id uuid/);
  assert.match(migration, /canonical_session_match_id uuid/);
  assert.match(migration, /role_assignment_id uuid/);
  assert.match(migration, /evolution_evaluation_context_match_role_pair/);
  assert.doesNotMatch(migration, /UPDATE public\.(daily_scores|training_results)/i);
});

test("player and team references are enforced by composite foreign keys", () => {
  assert.match(migration, /FOREIGN KEY \(player_member_id, team_id, player_user_id\)/);
  assert.match(migration, /REFERENCES public\.team_members\(id, team_id, user_id\)/);
  assert.match(migration, /FOREIGN KEY \(canonical_session_id, team_id\)/);
  assert.match(migration, /REFERENCES public\.canonical_sessions\(id, team_id\)/);
});

test("match evidence is tied to the exact canonical match and exact player role snapshot", () => {
  assert.match(migration, /FOREIGN KEY \(canonical_session_match_id, team_id, canonical_session_id\)/);
  assert.match(migration, /REFERENCES public\.canonical_session_matches\(id, team_id, canonical_session_id\)/);
  assert.match(migration, /evolution_evaluation_context_role_snapshot_fk/);
  assert.match(migration, /REFERENCES public\.canonical_session_match_roles\(/);
  assert.match(migration, /role_assignment_id, team_id, canonical_session_id,/);
  assert.match(migration, /canonical_session_match_id, player_user_id/);
  assert.match(roleMigration, /CREATE TABLE IF NOT EXISTS public\.canonical_session_match_roles/);
});

test("evidence has stable identity, explicit source types, bounded content and visibility", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.evolution_evidence_items/);
  assert.match(migration, /source_type IN \('manual_observation', 'vod_reference', 'round_note', 'match_reference'\)/);
  assert.match(migration, /title text NOT NULL CHECK/);
  assert.match(migration, /observation text NOT NULL CHECK/);
  assert.match(migration, /status text NOT NULL DEFAULT 'pending'/);
  assert.match(migration, /AND status = 'pending'/);
  assert.match(migration, /visibility IN \('team', 'coaches', 'private'\)/);
  assert.match(migration, /source_locator ~\* '\^https\?:\/\/'/);
  assert.match(migration, /source_metadata jsonb NOT NULL/);
});

test("VOD and match references require a valid external locator; no automatic VOD analysis is implied", () => {
  assert.match(migration, /source_type NOT IN \('vod_reference', 'match_reference'\) OR source_locator IS NOT NULL/);
  assert.doesNotMatch(migration, /automatic_vod_analysis|vod_ai_analysis|analyze_vod\(/i);
});

test("initial evidence content is captured as version 1 and later versions are append-only", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.evolution_evidence_versions/);
  assert.match(migration, /version_number integer NOT NULL CHECK \(version_number >= 1\)/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION evolution_private\.seed_evolution_evidence_version/);
  assert.match(migration, /NEW\.source_type, NEW\.title, NEW\.observation, NEW\.source_locator/);
  assert.match(migration, /version_number, source_type, title/);
  assert.match(migration, /Evidence versions are append-only/);
  assert.match(migration, /version_number <> expected_version/);
});

test("dimension links reference immutable canonical dimension definition versions", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.evolution_evidence_dimension_links/);
  assert.match(migration, /FOREIGN KEY \(dimension_key, definition_version\)/);
  assert.match(migration, /REFERENCES public\.evolution_dimension_definition_versions\(dimension_key, definition_version\)/);
  assert.match(dimensionMigration, /CREATE TABLE IF NOT EXISTS public\.evolution_dimension_definition_versions/);
});

test("RLS visibility differentiates team, coach-only and private evidence", () => {
  assert.match(migration, /evolution_evidence_items_visibility_read/);
  assert.match(migration, /visibility = 'team'/);
  assert.match(migration, /visibility = 'coaches'/);
  assert.match(migration, /created_by = \(SELECT auth\.uid\(\)\)/);
  assert.match(migration, /evolution_evidence_items_staff_insert/);
  assert.match(migration, /membership_role IN \('owner', 'coach'\)/);
});

test("evidence history and dimension links cannot be updated or deleted by API clients", () => {
  assert.match(migration, /evolution_evidence_identity_immutable/);
  assert.match(migration, /evolution_evidence_versions_append_only/);
  assert.match(migration, /evolution_evidence_links_immutable/);
  assert.match(migration, /REVOKE ALL ON TABLE public\.evolution_evaluation_contexts,/);
  assert.match(migration, /GRANT SELECT, INSERT ON public\.evolution_evidence_versions TO authenticated/);
  assert.match(migration, /reject_evolution_evidence_link_mutation/);
});

test("private trigger functions are not executable by anon or authenticated roles", () => {
  for (const fn of [
    "seed_evolution_evidence_version",
    "guard_evolution_evidence_version",
    "reject_evolution_evidence_identity_mutation",
    "reject_evolution_evidence_link_mutation",
  ]) {
    assert.match(migration, new RegExp("REVOKE ALL ON FUNCTION evolution_private\\." + fn + "\\(\\)[\\s\\S]*?FROM PUBLIC, anon, authenticated"));
  }
});

test("the migration is additive and independent of unmerged Phase Three rubric tables", () => {
  assert.doesNotMatch(migration, /DROP TABLE|TRUNCATE|DELETE FROM public\.(daily_scores|training_results)/i);
  assert.doesNotMatch(migration, /evolution_rubric_versions|evolution_rubric_dimensions/);
  assert.match(migration, /evolution_dimension_definition_versions/);
});

test("Point 3.3 remains a data-model point; scoring and user-interface work stay out of scope", () => {
  assert.doesNotMatch(migration, /score100|weighted_average|CREATE TABLE IF NOT EXISTS public\.evolution_score_snapshots/);
  assert.doesNotMatch(migration, /CREATE POLICY.*service_role/i);
});
