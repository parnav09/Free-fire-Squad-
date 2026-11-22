import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const migration = await readFile(
  new URL("supabase/migrations/20261122160000_evolution_phase_three_5_versioned_rubric_engine.sql", root),
  "utf8",
);
const domain = await readFile(new URL("src/lib/evolution-rubrics.ts", root), "utf8");
const dimensionRegistry = await readFile(new URL("src/lib/evolution-dimensions.ts", root), "utf8");

test("Point 3.5 creates stable rubric identities and separately versioned lifecycle records", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.evolution_rubrics/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.evolution_rubric_versions/);
  assert.match(migration, /rubric_key text NOT NULL/);
  assert.match(migration, /version_number integer NOT NULL CHECK \(version_number >= 1\)/);
  for (const state of ["draft", "active", "retired"]) assert.match(migration, new RegExp("'" + state + "'"));
});

test("rubric version numbers are sequential and cannot be reassigned", () => {
  assert.match(migration, /COALESCE\(max\(v\.version_number\), 0\) \+ 1/);
  assert.match(migration, /Next rubric version must be %/);
  assert.match(migration, /Rubric version identity and creation provenance are immutable/);
});

test("only active team owners and coaches can create or manage rubric definitions", () => {
  assert.match(migration, /membership_role IN \('owner','coach'\)/);
  assert.match(migration, /Only active team owners\/coaches may manage rubric versions/);
  assert.match(migration, /Only active team owners\/coaches may edit rubric criteria/);
});

test("published rubric versions cannot be edited and retired versions are terminal", () => {
  assert.match(migration, /Published rubric content and effective start are immutable/);
  assert.match(migration, /Retired rubric versions are immutable/);
  assert.match(migration, /Rubric criteria can be changed only while their version is a draft/);
  assert.match(migration, /evolution_rubric_versions_one_active_uidx/);
});

test("every canonical dimension criterion stores an exact definition version", () => {
  assert.match(migration, /dimension_definition_version integer NOT NULL/);
  assert.match(migration, /evolution_rubric_criteria_dimension_definition_fk/);
  assert.match(migration, /REFERENCES public\.evolution_dimension_definition_versions\(dimension_key, definition_version\)/);
  for (const key of ["communication", "coordination_trade_support", "decision_making", "positioning", "map_awareness_rotation", "role_execution"]) {
    assert.ok(dimensionRegistry.includes('key: "' + key + '"'));
  }
});

test("each dimension requires explicit text anchors for all eleven integer ratings", () => {
  assert.match(migration, /\(SELECT count\(\*\) FROM jsonb_object_keys\(NEW\.rating_anchors\)\) <> 11/);
  assert.match(migration, /'0','1','2','3','4','5','6','7','8','9','10'/);
  assert.match(migration, /Every rubric dimension must define exactly eleven rating anchors/);
  assert.match(domain, /RATING_KEYS/);
});

test("role-specific criteria are restricted to canonical roles applicable to the dimension", () => {
  assert.match(migration, /allowed_roles text\[\]/);
  assert.match(migration, /supplied_key = ANY\(allowed_roles\)/);
  assert.match(migration, /Role guidance must use applicable canonical role keys/);
  assert.match(domain, /CANONICAL_ROLE_KEYS/);
  assert.match(domain, /dimension\.applicableRoleKeys\.includes/);
});

test("activation requires a complete rubric for every active canonical dimension", () => {
  assert.match(migration, /A rubric must define criteria and all 0–10 anchors for every active canonical dimension/);
  assert.match(domain, /Missing criteria for active canonical dimension/);
  assert.match(domain, /Duplicate rubric criteria for/);
});

test("effective dates and publication metadata are enforced as a lifecycle pair", () => {
  assert.match(migration, /effective_from timestamptz/);
  assert.match(migration, /effective_to timestamptz/);
  assert.match(migration, /published_by uuid/);
  assert.match(migration, /published_at timestamptz/);
  assert.match(migration, /retired_at timestamptz/);
  assert.match(migration, /A rubric can be activated only with a valid effective start date/);
});

test("an evaluation context binds immutably to the exact effective rubric version", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.evolution_evaluation_rubric_bindings/);
  assert.match(migration, /UNIQUE \(evaluation_context_id\)/);
  assert.match(migration, /Only an active published rubric version can be bound/);
  assert.match(migration, /Rubric version was not effective when the evaluation context was created/);
  assert.match(migration, /Evaluation rubric bindings are immutable/);
});

test("rubric tables are team-scoped and protected by RLS and grants", () => {
  for (const table of ["evolution_rubrics", "evolution_rubric_versions", "evolution_rubric_dimension_criteria", "evolution_evaluation_rubric_bindings"]) {
    assert.match(migration, new RegExp("ALTER TABLE public\\." + table + " ENABLE ROW LEVEL SECURITY"));
  }
  assert.match(migration, /REVOKE ALL ON public\.evolution_rubrics[\s\S]*FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /GRANT SELECT, INSERT ON public\.evolution_rubrics TO authenticated/);
  assert.match(migration, /GRANT SELECT, INSERT ON public\.evolution_evaluation_rubric_bindings TO authenticated/);
});

test("domain validation distinguishes draft editing from immutable published versions", () => {
  assert.match(domain, /validateRubricDimensionCriteria/);
  assert.match(domain, /validateRubricForPublishing/);
  assert.match(domain, /isRubricVersionEditable/);
  assert.match(domain, /assertRubricVersionEditable/);
  assert.match(domain, /status === "draft"/);
});

test("Point 3.5 defines rubric contracts only; it does not introduce scoring or UI prematurely", () => {
  assert.doesNotMatch(migration, /weighted_average|canonical_score_100|evolution_score_snapshots/i);
  assert.doesNotMatch(migration, /DROP TABLE|TRUNCATE|DELETE FROM public\.(daily_scores|training_results)/i);
  assert.doesNotMatch(domain, /weighted_average|canonical_score_100/i);
});
