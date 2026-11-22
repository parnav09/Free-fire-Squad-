import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const root = new URL("../", import.meta.url);
const domain = await readFile(new URL("src/lib/evolution-assessment-states.ts", root), "utf8");
const migration = await readFile(new URL("supabase/migrations/20261122180000_evolution_phase_three_7_not_observed_missing_data_rules.sql", root), "utf8");
const roadmap = await readFile(new URL("docs/evolution/EVOLUTION-PHASE-3-ROADMAP-AND-CHECKPOINT.md", root), "utf8");

test("zero is valid observed data and Not Observed is explicitly non-numeric", () => {
  assert.match(domain, /"observed"/); assert.match(domain, /"not_observed"/);
  assert.match(migration, /rating_value BETWEEN 0 AND 10/);
  assert.match(migration, /assessment_state = 'not_observed'[\\s\\S]*?rating_value IS NULL/);
});
test("Not Applicable, incomplete and rejected evidence remain distinct from missing", () => {
  for (const s of ["not_applicable","incomplete","rejected_evidence"]) {
    assert.ok(domain.includes('"' + s + '"')); assert.ok(migration.includes("'" + s + "'"));
  }
  assert.match(migration, /missing_dimension_count/); assert.match(migration, /assessment_state IS NULL/);
});
test("observed ratings require exact-context, exact-dimension evidence", () => {
  assert.match(migration, /e\\.evaluation_context_id = NEW\\.evaluation_context_id/);
  assert.match(migration, /dl\\.dimension_key = NEW\\.dimension_key/);
  assert.match(migration, /dl\\.definition_version = NEW\\.dimension_definition_version/);
  assert.match(migration, /Observed ratings require non-rejected, non-archived evidence/);
});
test("Not Applicable is rejected for a role-applicable dimension", () => {
  assert.match(migration, /A role-applicable dimension cannot be marked not_applicable/);
  assert.match(domain, /A role-applicable dimension cannot be marked Not Applicable/);
});
test("assessment history is append-only with serialized sequential revisions", () => {
  assert.match(migration, /Dimension assessment history is append-only/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /revision_number IS DISTINCT FROM v_expected_revision/);
});
test("only active team owners and coaches may write assessment states", () => {
  assert.match(migration, /Active team owner or coach required/);
  assert.match(migration, /membership_role IN \\('owner','coach'\\)/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
});
test("readiness distinguishes draft, provisional, insufficient and final without a score", () => {
  for (const s of ["draft","provisional","insufficient","final"]) assert.ok(migration.includes("'" + s + "'"));
  assert.match(migration, /unverified_observed_dimension_count/);
  assert.doesNotMatch(migration, /weighted_average|score_value|score_snapshot/i);
});
test("legacy evaluations are not backfilled or rewritten", () => {
  assert.match(migration, /legacy evaluation values are deliberately not backfilled or rewritten/);
  assert.doesNotMatch(migration, /UPDATE public\\.(daily|training|player)_/i);
});
test("coverage and deterministic scoring remain separate roadmap points", () => {
  assert.match(roadmap, /### 3\\.8 Evidence Coverage Calculator/);
  assert.match(roadmap, /### 3\\.9 Deterministic Scoring Engine/);
});
