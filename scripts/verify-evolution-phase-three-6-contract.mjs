import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const migration = await readFile(
  new URL("supabase/migrations/20261122170000_evolution_phase_three_6_role_weight_configuration.sql", root),
  "utf8",
);
const domain = await readFile(new URL("src/lib/evolution-role-weights.ts", root), "utf8");
const packageJson = JSON.parse(await readFile(new URL("package.json", root), "utf8"));

test("Point 3.6 stores separate role weight sets and exact dimension weights", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.evolution_role_weight_sets/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.evolution_role_dimension_weights/);
  assert.match(migration, /rubric_version_id uuid NOT NULL/);
  assert.match(migration, /role_key text NOT NULL/);
  assert.match(migration, /version_number integer NOT NULL/);
  assert.match(migration, /weight_basis_points integer NOT NULL CHECK \(weight_basis_points BETWEEN 0 AND 10000\)/);
});

test("weight versions are sequential, rubric-scoped and single-active per role", () => {
  assert.match(migration, /coalesce\(max\(ws\.version_number\),0\) \+ 1/);
  assert.match(migration, /FOR UPDATE/);
  assert.match(migration, /evolution_role_weight_sets_one_active_uidx/);
  assert.match(migration, /invalid_role_weight_set_lifecycle_transition/);
});

test("activation requires complete applicable dimensions and an exact 10000 basis-point total", () => {
  assert.match(migration, /v_total <> 10000/);
  assert.match(migration, /v_weight_count <> v_applicable_count/);
  assert.match(migration, /role_weight_set_contains_non_applicable_or_unrubriced_dimension/);
  assert.match(domain, /total !== BASIS_POINT_TOTAL/);
  assert.match(domain, /Missing applicable dimension weight/);
});

test("weights pin the exact rubric dimension-definition version", () => {
  assert.match(migration, /rc\.dimension_definition_version = dd\.definition_version/);
  assert.match(domain, /exact rubric dimension-definition version/);
});

test("historical bindings require the exact match role snapshot and rubric version", () => {
  assert.match(migration, /v_context\.role_assignment_id IS DISTINCT FROM NEW\.role_assignment_id/);
  assert.match(migration, /v_role\.player_user_id = v_context\.player_user_id/);
  assert.match(migration, /v_set\.rubric_version_id = v_rubric_binding\.rubric_version_id/);
  assert.match(migration, /current player role is never substituted/);
});

test("unknown and unmapped roles fail closed instead of receiving guessed weights", () => {
  assert.match(migration, /role_assignment_status NOT IN \('assigned','retired'\)/);
  assert.match(migration, /canonical_role_key_from_snapshot/);
  assert.match(domain, /return aliases\[normalized\] \?\? null/);
});

test("published and retired weight sets and evaluation bindings are immutable", () => {
  assert.match(migration, /role_weight_set_history_is_retained/);
  assert.match(migration, /published_role_dimension_weights_are_immutable/);
  assert.match(migration, /Evaluation role-weight bindings are immutable/);
  assert.match(domain, /Published or retired role weight sets are immutable/);
});

test("database policies and privileges isolate teams and restrict administration", () => {
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /active_owner_or_coach_required/);
  assert.match(migration, /REVOKE ALL ON public\.evolution_role_weight_sets/);
  assert.match(migration, /TO authenticated/);
  assert.match(migration, /FROM PUBLIC, anon, authenticated/);
});

test("role-weight checks are part of the normal production build test chain", () => {
  assert.equal(packageJson.scripts["test:evolution-phase-three-6"], "node --test scripts/verify-evolution-phase-three-6.mjs");
  assert.match(packageJson.scripts.build, /test:evolution-phase-three-6/);
});
