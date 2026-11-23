import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [migration, dbHarness, scoringEngine, roadmap, packageText, workflow] = await Promise.all([
  read("../supabase/migrations/20261122200000_evolution_phase_three_10_score_snapshot_history.sql"),
  read("./verify-evolution-phase-three-10-db.sh"),
  read("../src/lib/evolution-deterministic-scoring.ts"),
  read("../docs/evolution/EVOLUTION-PHASE-3-ROADMAP-AND-CHECKPOINT.md"),
  read("../package.json"),
  read("../.github/workflows/evolution-phase-one.yml"),
]);
const pkg = JSON.parse(packageText);

test("3.10 adds a dedicated immutable snapshot table without changing legacy score tables", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.evolution_player_score_snapshots/);
  assert.match(migration, /input_snapshot jsonb NOT NULL/);
  assert.match(migration, /input_fingerprint text NOT NULL/);
  assert.doesNotMatch(migration, /UPDATE public\.(daily_player_evaluations|player_evaluations|scrim_results)/i);
  assert.doesNotMatch(migration, /DELETE FROM public\.(daily_player_evaluations|player_evaluations|scrim_results)/i);
});

test("snapshots retain exact historical context, player, role, rubric and weight references", () => {
  for (const field of ["evaluation_context_id","player_member_id","player_user_id","role_assignment_id","role_key","rubric_version_id","weight_set_id","calculation_version","scoring_policy_version"]) {
    assert.match(migration, new RegExp("\\b" + field + "\\b"));
  }
  assert.match(migration, /role_key_snapshot/);
  assert.match(migration, /canonical_role_key_from_snapshot/);
  assert.match(migration, /effective_from/);
  assert.match(migration, /effective_to/);
});

test("raw input snapshot pins rubric criteria, definition versions, weights, assessment revisions and evidence content", () => {
  for (const field of ["dimension_definition_version","weight_basis_points","revision_number","assessment_state","rating_value","evidence_item_id","evidence_status","evidence_version_id","source_locator","observation","rating_anchors"]) {
    assert.ok(migration.includes(field), "missing raw snapshot field: " + field);
  }
  assert.match(migration, /'rubric_criteria'/);
  assert.match(migration, /'weights'/);
  assert.match(migration, /'assessments'/);
  assert.match(migration, /evidence_dimension_link_matches/);
  assert.match(migration, /evidence_dimension_link_id/);
  assert.match(migration, /coalesce\(es\.evidence_version_id,latest_ev\.id\)/);
});

test("deterministic scoring policy and coverage gate are version-pinned", () => {
  assert.match(migration, /deterministic-scoring-v1/);
  assert.match(migration, /deterministic-scoring-policy-v1/);
  assert.match(migration, /v_coverage<5000/);
  assert.match(migration, /v_weighted_rating \* 1000/);
  assert.match(migration, /round\(v_exact_numerator \/ v_exact_denominator\)/);
  assert.match(scoringEngine, /DETERMINISTIC_SCORING_POLICY_V1/);
});

test("final, provisional and insufficient outcomes cannot leak into the wrong score columns", () => {
  assert.match(migration, /score_status = 'final'[\s\S]*provisional_score_basis_points IS NULL/);
  assert.match(migration, /score_status = 'provisional'[\s\S]*score_basis_points IS NULL/);
  assert.match(migration, /score_status = 'insufficient'[\s\S]*exact_score_numerator IS NULL/);
  assert.match(migration, /v_score_status := 'insufficient'/);
  assert.match(migration, /v_score_status := 'provisional'/);
  assert.match(migration, /v_score_status := 'final'/);
  for (const reason of ['no_valid_observed_weight','coverage_below_minimum','missing_dimensions','incomplete_dimensions','rejected_or_ineligible_evidence','unverified_evidence']) assert.ok(migration.includes(reason));
});

test("Not Observed, missing, incomplete, rejected and unverified evidence stay distinct", () => {
  for (const field of ["not_observed_dimension_count","missing_dimension_count","incomplete_dimension_count","rejected_evidence_dimension_count","unverified_evidence_dimension_count"]) {
    assert.ok(migration.includes(field));
  }
  assert.match(migration, /'not_observed'/);
  assert.match(migration, /'incomplete'/);
  assert.match(migration, /'rejected_evidence'/);
  assert.match(migration, /'pending','verified','corrected'/);
});

test("evidence must match the exact evaluation context and canonical dimension version", () => {
  assert.match(migration, /evidence_context_id IS DISTINCT FROM p_evaluation_context_id/);
  assert.match(migration, /el\.dimension_key=w\.dimension_key/);
  assert.match(migration, /el\.definition_version=w\.dimension_definition_version/);
  assert.match(migration, /assessment_dimension_definition_version_mismatch/);
  assert.match(migration, /evidence_identity_reused_across_dimensions/);
  assert.match(migration, /rejected_evidence_assessment_must_reference_exact_rejected_evidence/);
});

test("private evidence is not copied into a staff snapshot by another author", () => {
  assert.match(migration, /private_evidence_not_available_to_score_calculator/);
  assert.match(migration, /e\.visibility='private'/);
  assert.match(migration, /e\.created_by IS DISTINCT FROM v_actor/);
});

test("snapshots are append-only and direct client writes are denied", () => {
  assert.match(migration, /Score snapshots are immutable/);
  assert.match(migration, /BEFORE INSERT OR UPDATE OR DELETE ON public\.evolution_player_score_snapshots/);
  assert.match(migration, /REVOKE ALL ON public\.evolution_player_score_snapshots FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /GRANT SELECT ON public\.evolution_player_score_snapshots TO authenticated/);
});

test("snapshot history is restricted to active team owners and coaches", () => {
  assert.match(migration, /membership_role IN \('owner','coach'\)/);
  assert.match(migration, /CREATE POLICY evolution_player_score_snapshot_staff_read/);
  assert.match(migration, /ALTER TABLE public\.evolution_player_score_snapshots ENABLE ROW LEVEL SECURITY/);
});

test("identical input fingerprints are idempotent and changed inputs append a linked child", () => {
  assert.match(migration, /UNIQUE \(evaluation_context_id, calculation_version, input_fingerprint\)/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /WHERE evaluation_context_id=p_evaluation_context_id[\s\S]*input_fingerprint=v_fingerprint/);
  assert.match(migration, /previous_snapshot_id/);
  assert.match(migration, /recalculation_reason_required_for_changed_inputs/);
});

test("corrections and recalculations retain actor, timestamp and reason", () => {
  assert.match(migration, /created_by uuid NOT NULL/);
  assert.match(migration, /created_at timestamptz NOT NULL/);
  assert.match(migration, /recalculation_reason text/);
  assert.match(migration, /p_recalculation_reason/);
});

test("snapshot database RPC is authenticated and explicitly granted only to authenticated users", () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.calculate_evolution_player_score_snapshot/);
  assert.match(migration, /SECURITY DEFINER[\s\S]*SET search_path = ''/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.calculate_evolution_player_score_snapshot\(uuid,text\)[\s\S]*FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.calculate_evolution_player_score_snapshot\(uuid,text\)[\s\S]*TO authenticated/);
});

test("score calculation excludes tournament results and consumes only the canonical 3.9 engine contract", () => {
  assert.doesNotMatch(migration, /kill_count|placement_points|match_points|booyah|tournament_result/i);
  assert.match(scoringEngine, /calculateDeterministicPlayerScore/);
  assert.match(migration, /deterministic-scoring-policy-v1/);
});

test("PostgreSQL acceptance replays the additive migration and verifies final, provisional, insufficient and history paths", () => {
  assert.match(dbHarness, /verify-evolution-phase-three-8-db\.sh/);
  assert.equal((dbHarness.match(/-f "\$MIGRATION"/g) || []).length, 2);
  assert.match(dbHarness, /v_status<>'final'/);
  assert.match(dbHarness, /v_status<>'provisional'/);
  assert.match(dbHarness, /v_status<>'insufficient'/);
  assert.match(dbHarness, /previous_snapshot_id/);
  assert.match(dbHarness, /idempotent snapshot/);
  assert.match(dbHarness, /Prior immutable score snapshot changed/);
});

test("Phase 3.10 source test is in the normal build chain and database test is in CI", () => {
  assert.equal(pkg.scripts["test:evolution-phase-three-10"], "node --test scripts/verify-evolution-phase-three-10.mjs");
  assert.ok(pkg.scripts.build.includes("npm run test:evolution-phase-three-9 && npm run test:evolution-phase-three-10 && npm run test:evolution-phase-three-11 && npm run test:evolution-phase-three-12 && npm run test:evolution-phase-three-13 && vite build"));
  assert.match(workflow, /Verify Evolution Phase Three\.10 score snapshot history against isolated disposable PostgreSQL/);
  assert.match(workflow, /scripts\/verify-evolution-phase-three-10-db\.sh/);
});

test("persistent roadmap records the 3.10 contract and leaves deployment outside its scope", () => {
  assert.match(roadmap, /Point 3\.10 — Score Snapshot & Calculation History/);
  assert.match(roadmap, /recalculation_reason/);
  assert.match(roadmap, /No production migration, data reset, merge to main or production deployment/);
});
