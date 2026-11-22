import test from "node:test";
import assert from "node:assert/strict";
import {
  CANONICAL_DIMENSION_REGISTRY,
  CANONICAL_ROLE_KEYS,
} from "../src/lib/evolution-dimensions.ts";
import {
  assertRoleWeightSetEditable,
  isRoleWeightSetEditable,
  resolveCanonicalRoleKeyFromSnapshot,
  validateRoleWeightConfiguration,
} from "../src/lib/evolution-role-weights.ts";

const roleKey = "primary_rusher" as const;
const criteria = Object.fromEntries(
  CANONICAL_DIMENSION_REGISTRY
    .filter((dimension) => dimension.lifecycleStatus === "active")
    .map((dimension) => [dimension.key, dimension.definitionVersion]),
);

function validWeights() {
  const applicable = CANONICAL_DIMENSION_REGISTRY.filter((dimension) =>
    dimension.lifecycleStatus === "active" && dimension.applicableRoleKeys.includes(roleKey)
  );
  const base = Math.floor(10_000 / applicable.length);
  let remainder = 10_000 - base * applicable.length;
  return applicable.map((dimension) => ({
    dimensionKey: dimension.key,
    dimensionDefinitionVersion: dimension.definitionVersion,
    weightBasisPoints: base + (remainder-- > 0 ? 1 : 0),
  }));
}

test("every canonical role receives a valid exact-total configuration", () => {
  for (const role of CANONICAL_ROLE_KEYS) {
    const applicable = CANONICAL_DIMENSION_REGISTRY.filter((dimension) =>
      dimension.lifecycleStatus === "active" && dimension.applicableRoleKeys.includes(role)
    );
    const base = Math.floor(10_000 / applicable.length);
    let remainder = 10_000 - base * applicable.length;
    const weights = applicable.map((dimension) => ({
      dimensionKey: dimension.key,
      dimensionDefinitionVersion: dimension.definitionVersion,
      weightBasisPoints: base + (remainder-- > 0 ? 1 : 0),
    }));
    assert.deepEqual(validateRoleWeightConfiguration({
      roleKey: role,
      weights,
      rubricCriteriaVersions: criteria,
    }), []);
  }
});

test("weights use exact integer basis points and total exactly 10000", () => {
  assert.deepEqual(validateRoleWeightConfiguration({
    roleKey,
    weights: validWeights(),
    rubricCriteriaVersions: criteria,
  }), []);
  const weights = validWeights();
  weights[0] = { ...weights[0], weightBasisPoints: weights[0].weightBasisPoints + 1 };
  assert.ok(validateRoleWeightConfiguration({ roleKey, weights, rubricCriteriaVersions: criteria })
    .some((error) => error.includes("exactly 10000")));
});

test("missing applicable dimension is rejected rather than silently treated as zero", () => {
  const weights = validWeights().slice(1);
  const errors = validateRoleWeightConfiguration({ roleKey, weights, rubricCriteriaVersions: criteria });
  assert.ok(errors.some((error) => error.includes("Missing applicable dimension weight")));
});

test("duplicate dimension weights are rejected", () => {
  const weights = validWeights();
  weights.push({ ...weights[0] });
  assert.ok(validateRoleWeightConfiguration({ roleKey, weights, rubricCriteriaVersions: criteria })
    .some((error) => error.includes("Duplicate weight")));
});

test("negative, fractional and over-100-percent weights are rejected", () => {
  for (const invalid of [-1, 0.5, 10_001]) {
    const weights = validWeights();
    weights[0] = { ...weights[0], weightBasisPoints: invalid };
    assert.ok(validateRoleWeightConfiguration({ roleKey, weights, rubricCriteriaVersions: criteria })
      .some((error) => error.includes("integer basis points")));
  }
});

test("weights must pin the exact rubric dimension-definition version", () => {
  const weights = validWeights();
  weights[0] = { ...weights[0], dimensionDefinitionVersion: 999 };
  assert.ok(validateRoleWeightConfiguration({ roleKey, weights, rubricCriteriaVersions: criteria })
    .some((error) => error.includes("exact rubric dimension-definition version")));
});

test("every applicable rubric dimension must be present at its exact definition version", () => {
  const missing = { ...criteria } as Record<string, number>;
  delete missing.communication;
  assert.ok(validateRoleWeightConfiguration({
    roleKey,
    weights: validWeights(),
    rubricCriteriaVersions: missing,
  }).some((error) => error.includes("active rubric must contain")));
});

test("historical role labels resolve only through explicit canonical aliases", () => {
  assert.equal(resolveCanonicalRoleKeyFromSnapshot("Primary Rusher"), "primary_rusher");
  assert.equal(resolveCanonicalRoleKeyFromSnapshot("Sniper + IGL"), "sniper_igl");
  assert.equal(resolveCanonicalRoleKeyFromSnapshot("Mystery Role"), null);
  assert.equal(resolveCanonicalRoleKeyFromSnapshot(null), null);
});

test("published and retired weight sets cannot be edited", () => {
  assert.equal(isRoleWeightSetEditable("draft"), true);
  assert.equal(isRoleWeightSetEditable("active"), false);
  assert.equal(isRoleWeightSetEditable("retired"), false);
  assert.throws(() => assertRoleWeightSetEditable("active"), /immutable/);
  assert.throws(() => assertRoleWeightSetEditable("retired"), /immutable/);
});

test("unknown role snapshots never fall back to the player's current role", () => {
  assert.equal(resolveCanonicalRoleKeyFromSnapshot(""), null);
  assert.equal(resolveCanonicalRoleKeyFromSnapshot("unmapped"), null);
});
