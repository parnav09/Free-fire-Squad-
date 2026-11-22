import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [migration, dbHarness, priorMigration, priorDbHarness, packageText, workflow, roadmap] = await Promise.all([
  read("../supabase/migrations/20261122210000_evolution_phase_three_11_atomic_scoring_integrity.sql"),
  read("./verify-evolution-phase-three-11-db.sh"),
  read("../supabase/migrations/20261122200000_evolution_phase_three_10_score_snapshot_history.sql"),
  read("./verify-evolution-phase-three-10-db.sh"),
  read("../package.json"),
  read("../.github/workflows/evolution-phase-one.yml"),
  read("../docs/evolution/EVOLUTION-PHASE-3-ROADMAP-AND-CHECKPOINT.md"),
]);
const pkg = JSON.parse(packageText);

test("3.11 is additive and does not rewrite evaluation or historical score rows", () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION evolution_private\.lock_evaluation_context_for_scoring/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION evolution_private\.lock_evidence_context_for_scoring_write/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION evolution_private\.lock_assessment_context_for_scoring_write/);
  assert.doesNotMatch(migration, /UPDATE public\.(evolution_player_score_snapshots|evolution_evaluation_dimension_assessment_events|evolution_evidence_verification_events)/i);
  assert.doesNotMatch(migration, /DELETE FROM public\.(evolution_player_score_snapshots|evolution_evaluation_dimension_assessment_events|evolution_evidence_verification_events)/i);
});

test("shared transaction lock uses the exact Phase 3.10 advisory key", () => {
  assert.match(migration, /hashtextextended\(p_evaluation_context_id::text, 31010\)/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /evaluation_context_required_for_scoring_lock/);
});

test("evidence identity inserts serialize before becoming visible to scoring", () => {
  assert.match(migration, /CREATE TRIGGER evolution_evidence_items_scoring_lock\s+BEFORE INSERT ON public\.evolution_evidence_items/);
  assert.match(migration, /v_context_id := NEW\.evaluation_context_id/);
  assert.match(migration, /evidence_context_required_for_scoring_lock/);
});

test("evidence content versions serialize on their parent evaluation context", () => {
  assert.match(migration, /CREATE TRIGGER evolution_evidence_versions_scoring_lock\s+BEFORE INSERT ON public\.evolution_evidence_versions/);
  assert.match(migration, /WHERE e\.id = NEW\.evidence_item_id\s+AND e\.team_id = NEW\.team_id\s+FOR SHARE/);
});

test("evidence status transitions serialize with scoring", () => {
  assert.match(migration, /CREATE TRIGGER evolution_evidence_verification_scoring_lock\s+BEFORE INSERT ON public\.evolution_evidence_verification_events/);
});

test("assessment revisions serialize with scoring", () => {
  assert.match(migration, /CREATE TRIGGER evolution_eval_dimension_assessment_scoring_lock\s+BEFORE INSERT ON public\.evolution_evaluation_dimension_assessment_events/);
  assert.match(migration, /lock_evaluation_context_for_scoring\(NEW\.evaluation_context_id\)/);
});

test("all score-affecting write triggers call the shared lock helper", () => {
  assert.equal((migration.match(/PERFORM evolution_private\.lock_evaluation_context_for_scoring\(/g) || []).length, 3);
  assert.equal((migration.match(/EXECUTE FUNCTION evolution_private\.lock_evidence_context_for_scoring_write\(\)/g) || []).length, 3);
  assert.equal((migration.match(/EXECUTE FUNCTION evolution_private\.lock_assessment_context_for_scoring_write\(\)/g) || []).length, 1);
});

test("the assessment raw-input JSON aggregate is a valid scalar subquery", () => {
  assert.match(migration, /'assessments',\(\s*SELECT coalesce\(jsonb_agg\(jsonb_build_object\([\s\S]*?\),'\[\]'::jsonb\)\s*FROM public\.evolution_role_dimension_weights/);
});

test("the scoring RPC uses the same lock before reading inputs", () => {
  const lock = migration.indexOf("PERFORM evolution_private.lock_evaluation_context_for_scoring(p_evaluation_context_id)");
  const read = migration.indexOf("FROM public.evolution_evaluation_contexts c", lock);
  assert.ok(lock >= 0 && read > lock);
  assert.match(migration, /FOR SHARE OF c,r/);
});

test("authorization remains stable through the scoring transaction", () => {
  assert.match(migration, /active_team_owner_or_coach_required/);
  assert.match(migration, /FROM public\.team_members tm[\s\S]*?FOR SHARE/);
});

test("historical rubric and weight-set lifecycle rows stay stable during calculation", () => {
  assert.match(migration, /WHERE rv\.id=v_rubric AND rv\.team_id=v_team\s+FOR SHARE/);
  assert.match(migration, /AND ws\.rubric_version_id=v_rubric AND ws\.role_key=v_bound_role_key\s+FOR SHARE/);
});

test("history cannot fork from a prior snapshot", () => {
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS evolution_score_snapshot_single_child_uidx/);
  assert.match(migration, /ON public\.evolution_player_score_snapshots\(previous_snapshot_id\)/);
  assert.match(migration, /WHERE previous_snapshot_id IS NOT NULL/);
});

test("the RPC remains atomic and keeps authenticated-only execution", () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.calculate_evolution_player_score_snapshot/);
  assert.match(migration, /LANGUAGE plpgsql\s+SECURITY DEFINER\s+SET search_path = ''/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.calculate_evolution_player_score_snapshot\(uuid,text\)[\s\S]*FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.calculate_evolution_player_score_snapshot\(uuid,text\)[\s\S]*TO authenticated/);
  assert.match(priorMigration, /INSERT INTO public\.evolution_player_score_snapshots/);
});

test("the shared lock helper cannot be invoked directly by clients", () => {
  assert.match(migration, /REVOKE ALL ON FUNCTION evolution_private\.lock_evaluation_context_for_scoring\(uuid\)\s+FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /REVOKE ALL ON FUNCTION evolution_private\.lock_evidence_context_for_scoring_write\(\)\s+FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /REVOKE ALL ON FUNCTION evolution_private\.lock_assessment_context_for_scoring_write\(\)\s+FROM PUBLIC, anon, authenticated/);
});

test("database harness replays migration twice and checks trigger/ACL/lock behavior", () => {
  assert.match(dbHarness, /verify-evolution-phase-three-10-db\.sh/);
  assert.equal((dbHarness.match(/-f "\$MIGRATION"/g) || []).length, 2);
  for (const table of ["evolution_evidence_items","evolution_evidence_versions","evolution_evidence_verification_events","evolution_evaluation_dimension_assessment_events"]) {
    assert.ok(dbHarness.includes(table));
  }
  assert.match(dbHarness, /pg_try_advisory_xact_lock/);
  assert.match(dbHarness, /pg_sleep\(2\)/);
  assert.match(dbHarness, /AFTER_RELEASE/);
});

test("database harness validates the single-child uniqueness invariant", () => {
  assert.match(dbHarness, /evolution_score_snapshot_single_child_uidx/);
  assert.match(dbHarness, /indisunique AND i\.indisvalid/);
});

test("Phase 3.11 test is included in the full production build chain", () => {
  assert.equal(pkg.scripts["test:evolution-phase-three-11"], "node --test scripts/verify-evolution-phase-three-11.mjs");
  assert.match(pkg.scripts.build, /test:evolution-phase-three-10 && npm run test:evolution-phase-three-11 && npm run test:evolution-phase-three-12 && vite build/);
});

test("GitHub Actions runs the isolated Phase 3.11 PostgreSQL harness", () => {
  assert.match(workflow, /Verify Evolution Phase Three\.11 atomic scoring and database integrity against isolated disposable PostgreSQL/);
  assert.match(workflow, /scripts\/verify-evolution-phase-three-11-db\.sh/);
});

test("roadmap records the atomicity boundary and verification harness", () => {
  assert.match(roadmap, /Point 3\.11 — Atomic Scoring RPC & Database Integrity/);
  assert.match(roadmap, /verify-evolution-phase-three-11-db\.sh/);
});
