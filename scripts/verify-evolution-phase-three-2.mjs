import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const registrySource = await readFile(new URL("src/lib/evolution-dimensions.ts", root), "utf8");
const migrationSource = await readFile(
  new URL("supabase/migrations/20261122130000_evolution_phase_three_2_canonical_dimension_registry.sql", root),
  "utf8",
);

const keys = [
  "communication",
  "coordination_trade_support",
  "decision_making",
  "positioning",
  "map_awareness_rotation",
  "role_execution",
];
const labels = [
  "Communication",
  "Coordination & Trade Support",
  "Decision Making",
  "Positioning",
  "Map Awareness & Rotation",
  "Role Execution",
];
const roles = [
  "primary_rusher",
  "secondary_rusher",
  "third_rusher_flanker",
  "sniper_igl",
  "substitute_flex",
  "other",
];

test("registry has exactly six stable IDs and does not use labels as identifiers", () => {
  for (const key of keys) assert.match(registrySource, new RegExp('key: "' + key + '"'));
  assert.match(registrySource, /CanonicalDimensionKey/);
  assert.match(registrySource, /CANONICAL_DIMENSION_KEYS/);
});

test("every canonical dimension has a versioned label, definition and explicit order", () => {
  for (let index = 0; index < labels.length; index += 1) {
    assert.ok(registrySource.includes('label: "' + labels[index] + '"'));
    assert.match(registrySource, new RegExp('definitionVersion: 1'));
    assert.ok(registrySource.includes('sortOrder: ' + (index + 1)));
  }
  assert.match(registrySource, /lifecycleStatus: "active"/);
});

test("all six established roles and integer 0–10 rating metadata are explicit", () => {
  for (const role of roles) assert.ok(registrySource.includes('"' + role + '"'));
  assert.match(registrySource, /minimum: 0/);
  assert.match(registrySource, /maximum: 10/);
  assert.match(registrySource, /step: 1/);
  assert.match(registrySource, /ratingScale: CANONICAL_RATING_SCALE/);
});

test("only semantically exact legacy aliases are declared", () => {
  assert.match(registrySource, /kind: "exact"/);
  for (const unsafe of ["coordination", "trade_support", "map_awareness", "consistency"]) {
    assert.doesNotMatch(registrySource, new RegExp('legacyKey: "' + unsafe + '"'));
  }
});

test("registry exports safe key lookup and rating validation helpers", () => {
  assert.match(registrySource, /function isCanonicalDimensionKey/);
  assert.match(registrySource, /function getCanonicalDimension/);
  assert.match(registrySource, /function assertCanonicalRating/);
  assert.match(registrySource, /Number\.isInteger\(value\)/);
});

test("database registry persists stable IDs, versioned definitions and exact aliases", () => {
  for (const table of [
    "evolution_dimension_registry",
    "evolution_dimension_definition_versions",
    "evolution_dimension_aliases",
  ]) assert.ok(migrationSource.includes('public.' + table));
  for (const key of keys) assert.ok(migrationSource.includes("'" + key + "'"));
  assert.match(migrationSource, /mapping_kind text NOT NULL DEFAULT 'exact' CHECK \(mapping_kind = 'exact'\)/);
});

test("database enforces 0–10 integer rating metadata and allowed role applicability", () => {
  assert.match(migrationSource, /rating_min = 0 AND rating_max = 10 AND rating_step = 1/);
  for (const role of roles) assert.ok(migrationSource.includes("'" + role + "'"));
});

test("active ordering is unique and retired dimensions cannot be reactivated", () => {
  assert.match(migrationSource, /WHERE lifecycle_status = 'active'/);
  assert.match(migrationSource, /Retired canonical dimensions cannot be reactivated or reordered/);
  assert.match(migrationSource, /retired_at := COALESCE\(NEW\.retired_at, now\(\)\)/);
});

test("definition versions and legacy aliases are immutable", () => {
  assert.match(migrationSource, /reject_evolution_dimension_version_mutation/);
  assert.match(migrationSource, /reject_evolution_dimension_alias_mutation/);
  assert.match(migrationSource, /BEFORE UPDATE OR DELETE ON public\.evolution_dimension_definition_versions/);
  assert.match(migrationSource, /BEFORE UPDATE OR DELETE ON public\.evolution_dimension_aliases/);
});

test("registry tables are read-only to authenticated clients and hidden from anon", () => {
  assert.match(migrationSource, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migrationSource, /REVOKE ALL ON public\.evolution_dimension_registry/);
  assert.match(migrationSource, /GRANT SELECT ON public\.evolution_dimension_registry/);
  assert.match(migrationSource, /TO authenticated USING \(true\)/);
});
