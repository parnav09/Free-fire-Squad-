import test from "node:test";
import assert from "node:assert/strict";
import {
  CANONICAL_DIMENSION_REGISTRY,
  CANONICAL_DIMENSION_KEYS,
  CANONICAL_RATING_SCALE,
  CANONICAL_ROLE_KEYS,
  LEGACY_DIMENSION_ALIASES,
} from "../src/lib/evolution-dimensions.ts";

test("registry has six stable keys independent of display labels", () => {
  assert.deepEqual(CANONICAL_DIMENSION_KEYS, [
    "communication",
    "coordination_trade_support",
    "decision_making",
    "positioning",
    "map_awareness_rotation",
    "role_execution",
  ]);
  assert.equal(new Set(CANONICAL_DIMENSION_KEYS).size, 6);
  assert.ok(CANONICAL_DIMENSION_REGISTRY.every((dimension) => dimension.label.length > 0));
});

test("every canonical dimension has a definition and stable ordering", () => {
  assert.deepEqual(CANONICAL_DIMENSION_REGISTRY.map((dimension) => dimension.sortOrder), [1, 2, 3, 4, 5, 6]);
  assert.ok(CANONICAL_DIMENSION_REGISTRY.every((dimension) => dimension.definition.length > 20));
});

test("canonical rating scale matches the scoring engine contract", () => {
  assert.deepEqual(CANONICAL_RATING_SCALE, { minimum: 0, maximum: 10, step: 1 });
});

test("all six established roles are represented", () => {
  assert.equal(CANONICAL_ROLE_KEYS.length, 6);
  assert.equal(new Set(CANONICAL_ROLE_KEYS).size, 6);
});

test("legacy aliases include only audited exact-semantic mappings", () => {
  assert.ok(LEGACY_DIMENSION_ALIASES.every((alias) => alias.kind === "exact"));
  assert.ok(!LEGACY_DIMENSION_ALIASES.some((alias) =>
    alias.legacyKey === "coordination" || alias.legacyKey === "trade_support"
      || alias.legacyKey === "map_awareness" || alias.legacyKey === "consistency"
  ));
});
