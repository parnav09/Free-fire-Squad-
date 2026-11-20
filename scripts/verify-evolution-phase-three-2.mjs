import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const registrySource = await readFile(
  new URL("../src/lib/evolution-dimensions.ts", import.meta.url),
  "utf8",
);

test("registry defines six stable IDs independently of labels", () => {
  for (const key of [
    "communication",
    "coordination_trade_support",
    "decision_making",
    "positioning",
    "map_awareness_rotation",
    "role_execution",
  ]) assert.match(registrySource, new RegExp('key: "' + key + '"'));
});

test("each dimension has a canonical label, definition and explicit order", () => {
  for (const label of [
    "Communication",
    "Coordination & Trade Support",
    "Decision Making",
    "Positioning",
    "Map Awareness & Rotation",
    "Role Execution",
  ]) assert.ok(registrySource.includes('label: "' + label + '"'));
  assert.match(registrySource, /sortOrder: 6/);
  assert.match(registrySource, /definition:/);
});

test("rating scale is integer 0 through 10 with step 1", () => {
  assert.match(registrySource, /minimum: 0/);
  assert.match(registrySource, /maximum: 10/);
  assert.match(registrySource, /step: 1/);
});

test("registry applicability covers the six established team roles", () => {
  for (const role of [
    "primary_rusher",
    "secondary_rusher",
    "third_rusher_flanker",
    "sniper_igl",
    "substitute_flex",
    "other",
  ]) assert.ok(registrySource.includes('"' + role + '"'));
});

test("legacy aliases are exact-only and omit semantically partial categories", () => {
  assert.match(registrySource, /kind: "exact"/);
  for (const unsafe of ["coordination", "trade_support", "map_awareness", "consistency"]) {
    assert.doesNotMatch(registrySource, new RegExp('legacyKey: "' + unsafe + '"'));
  }
});
