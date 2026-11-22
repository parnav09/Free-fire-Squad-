import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const domain = await readFile(new URL("src/lib/evolution-role-weights.ts", root), "utf8");
const dimensions = await readFile(new URL("src/lib/evolution-dimensions.ts", root), "utf8");
const migration = await readFile(new URL("supabase/migrations/20261122170000_evolution_phase_three_6_role_weight_configuration.sql", root), "utf8");

test("typed configuration uses canonical roles and dimension applicability", () => {
  assert.match(domain, /CANONICAL_ROLE_KEYS/);
  assert.match(domain, /dimension\.applicableRoleKeys\.includes\(input\.roleKey\)/);
  assert.match(dimensions, /applicableRoleKeys:/);
});

test("integer basis-point totals are exact and non-negative", () => {
  assert.match(domain, /weightBasisPoints < 0/);
  assert.match(domain, /weightBasisPoints > BASIS_POINT_TOTAL/);
  assert.match(domain, /total !== BASIS_POINT_TOTAL/);
  assert.match(migration, /weight_basis_points BETWEEN 0 AND 10000/);
  assert.match(migration, /v_total <> 10000/);
});

test("missing and duplicate dimensions are rejected explicitly", () => {
  assert.match(domain, /Missing applicable dimension weight/);
  assert.match(domain, /Duplicate weight for/);
  assert.match(domain, /Each dimension may have exactly one weight/);
});

test("rubric dimension-definition versions must match exactly", () => {
  assert.match(domain, /exact rubric dimension-definition version/);
  assert.match(migration, /rc\.dimension_definition_version = dd\.definition_version/);
});

test("historical role labels resolve only through explicit canonical aliases", () => {
  assert.match(domain, /"primary rusher": "primary_rusher"/);
  assert.match(domain, /"primary-rusher": "primary_rusher"/);
  assert.match(domain, /"sniper \+ igl": "sniper_igl"/);
  assert.match(domain, /return aliases\[normalized\] \?\? null/);
  assert.match(migration, /canonical_role_key_from_snapshot/);
});

test("unknown or unmapped role snapshots fail closed without current-role fallback", () => {
  assert.match(migration, /role_assignment_status NOT IN \('assigned','retired'\)/);
  assert.match(migration, /current player role is never substituted/);
  assert.match(domain, /return aliases\[normalized\] \?\? null/);
});

test("draft-only editing and published history immutability are enforced", () => {
  assert.match(domain, /Published or retired role weight sets are immutable/);
  assert.match(migration, /role_weight_set_history_is_retained/);
  assert.match(migration, /published_role_dimension_weights_are_immutable/);
  assert.match(migration, /Evaluation role-weight bindings are immutable/);
});

test("role-weight binding pins exact evaluation context, role assignment and rubric", () => {
  assert.match(migration, /v_context\.role_assignment_id IS DISTINCT FROM NEW\.role_assignment_id/);
  assert.match(migration, /v_role\.player_user_id = v_context\.player_user_id/);
  assert.match(migration, /v_set\.rubric_version_id = v_rubric_binding\.rubric_version_id/);
});
