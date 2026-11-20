import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/evolution-scoring.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const scoring = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));

const keys = scoring.CANONICAL_DIMENSIONS;
const equalWeights = Object.fromEntries(keys.map((key) => [key, 1]));
const observations = Object.fromEntries(keys.map((key) => [key, { status: "rated", value: 8 }]));
const input = (overrides = {}) => ({
  rubricVersionId: "EV2-1.0",
  scoringEngineVersion: "score-1.0",
  roleKey: "primary_rusher",
  observations,
  weights: equalWeights,
  minimumObservedDimensions: 4,
  ...overrides,
});

test("six canonical dimensions are stable and ordered", () => {
  assert.deepEqual(keys, [
    "communication", "coordination_trade_support", "decision_making",
    "positioning", "map_awareness_rotation", "role_execution",
  ]);
});

test("equal weights produce deterministic 80/100 from six ratings of 8", () => {
  const result = scoring.calculateCanonicalScore(input());
  assert.equal(result.score100, 80);
  assert.equal(result.weightedAverage10, 8);
  assert.equal(result.coverageRatio, 1);
  assert.equal(result.status, "scored");
  assert.equal(result.rubricVersionId, "EV2-1.0");
  assert.equal(result.scoringEngineVersion, "score-1.0");
});

test("zero is a valid observed score and is not confused with Not observed", () => {
  const mixed = { ...observations, communication: { status: "rated", value: 0 } };
  const result = scoring.calculateCanonicalScore(input({ observations: mixed }));
  assert.equal(result.score100, 66.66666666666666);
  assert.equal(result.observedDimensions, 6);
});

test("Not observed requires a reason and is excluded from numerator and denominator", () => {
  const partial = {
    ...observations,
    communication: { status: "not_observed", reason: "No fair opportunity was visible." },
    positioning: { status: "not_observed", reason: "Insufficient context." },
  };
  const result = scoring.calculateCanonicalScore(input({ observations: partial }));
  assert.equal(result.score100, 80);
  assert.equal(result.observedDimensions, 4);
  assert.equal(result.coverageRatio, 4 / 6);
});

test("coverage below the configured minimum preserves observations but suppresses headline score", () => {
  const partial = {
    ...observations,
    communication: { status: "not_observed", reason: "No opportunity." },
    positioning: { status: "not_observed", reason: "No opportunity." },
    role_execution: { status: "not_observed", reason: "Role context missing." },
  };
  const result = scoring.calculateCanonicalScore(input({ observations: partial }));
  assert.equal(result.score100, null);
  assert.equal(result.weightedAverage10, 8);
  assert.equal(result.status, "insufficient_coverage");
});

test("no observations yields no score, never a numeric zero", () => {
  const none = Object.fromEntries(keys.map((key) => [key, { status: "not_observed", reason: "Not seen." }]));
  const result = scoring.calculateCanonicalScore(input({ observations: none }));
  assert.equal(result.score100, null);
  assert.equal(result.weightedAverage10, null);
  assert.equal(result.status, "no_observations");
});

test("missing dimensions are rejected rather than defaulted", () => {
  const incomplete = { ...observations };
  delete incomplete.communication;
  assert.throws(() => scoring.calculateCanonicalScore(input({ observations: incomplete })), /explicit observation state/);
});

test("ratings outside 0–10, fractional ratings and negative weights are rejected", () => {
  assert.throws(() => scoring.calculateCanonicalScore(input({
    observations: { ...observations, communication: { status: "rated", value: 11 } },
  })), /integer from 0 to 10/);
  assert.throws(() => scoring.calculateCanonicalScore(input({
    observations: { ...observations, communication: { status: "rated", value: 2.5 } },
  })), /integer from 0 to 10/);
  assert.throws(() => scoring.calculateCanonicalScore(input({
    weights: { ...equalWeights, communication: -1 },
  })), /non-negative/);
});

test("role weights affect the score only through the explicit versioned weight map", () => {
  const weights = { ...equalWeights, communication: 5, role_execution: 0 };
  const varied = { ...observations, communication: { status: "rated", value: 10 } };
  const result = scoring.calculateCanonicalScore(input({ weights, observations: varied }));
  assert.equal(result.score100, (10 * 5 + 8 * 4) / 9 * 10);
});

test("zero total observed weight is rejected", () => {
  const zero = Object.fromEntries(keys.map((key) => [key, 0]));
  assert.throws(() => scoring.calculateCanonicalScore(input({ weights: zero })), /positive role weight/);
});

test("confidence uses evidence, sample count and context—not the score", () => {
  const policy = {
    minimumSampleCount: 3, strongSampleCount: 8,
    minimumEvidenceRatio: 0.5, strongEvidenceRatio: 0.9,
    minimumContextConsistency: 0.6, strongContextConsistency: 0.9,
  };
  assert.equal(scoring.deriveEvidenceConfidence({
    sampleCount: 2, evidenceBackedRatio: 1, contextConsistency: 1, policy,
  }), "insufficient");
  assert.equal(scoring.deriveEvidenceConfidence({
    sampleCount: 4, evidenceBackedRatio: 0.7, contextConsistency: 0.8, policy,
  }), "moderate");
  assert.equal(scoring.deriveEvidenceConfidence({
    sampleCount: 10, evidenceBackedRatio: 1, contextConsistency: 1, policy,
  }), "strong");
});

test("confidence policy rejects inverted thresholds and invalid ratios", () => {
  const policy = {
    minimumSampleCount: 3, strongSampleCount: 2,
    minimumEvidenceRatio: 0.8, strongEvidenceRatio: 0.5,
    minimumContextConsistency: 0.6, strongContextConsistency: 0.9,
  };
  assert.throws(() => scoring.deriveEvidenceConfidence({
    sampleCount: 4, evidenceBackedRatio: 0.9, contextConsistency: 0.9, policy,
  }), /Sample counts/);
});

test("context comparability requires identical rubric, engine, role, mode and map", () => {
  const context = {
    rubricVersionId: "EV2-1.0", scoringEngineVersion: "score-1.0",
    roleKey: "primary_rusher", mode: "BR", map: "Bermuda",
  };
  assert.deepEqual(scoring.compareEvaluationContexts(context, { ...context }), { comparable: true, reasons: [] });
  const changed = scoring.compareEvaluationContexts(context, { ...context, roleKey: "sniper_igl" });
  assert.equal(changed.comparable, false);
  assert.deepEqual(changed.reasons, ["roleKey"]);
});

test("legacy conversion is explicit and never marked directly comparable", () => {
  assert.deepEqual(scoring.convertLegacyScoreToApproximate100(37, 50), {
    value: 74, label: "Legacy scale — approximate conversion", comparable: false, originalScaleMax: 50,
  });
  assert.throws(() => scoring.convertLegacyScoreToApproximate100(51, 50), /original scale/);
});
