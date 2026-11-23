import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const domainSource = await readFile(new URL("src/lib/evolution-evidence-coverage.ts", new URL("../", import.meta.url)), "utf8");
const compiledDomain = ts.transpileModule(domainSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiledDomain).toString("base64")}`;
const { calculateEvidenceCoverage } = await import(moduleUrl);

const root = new URL("../", import.meta.url);
const migration = await readFile(new URL("supabase/migrations/20261122190000_evolution_phase_three_8_evidence_coverage_calculator.sql", root), "utf8");

test("coverage uses the historical applicable-dimension denominator and excludes Not Observed from numerator only", () => {
  const result = calculateEvidenceCoverage([
    { dimensionKey: "communication", assessmentState: "observed", evidenceState: "verified" },
    { dimensionKey: "positioning", assessmentState: "not_observed", evidenceState: null },
    { dimensionKey: "role_execution", assessmentState: null, evidenceState: null },
  ]);
  assert.equal(result.applicableDimensionCount, 3);
  assert.equal(result.observedDimensionCount, 1);
  assert.equal(result.notObservedDimensionCount, 1);
  assert.equal(result.missingDimensionCount, 1);
  assert.equal(result.coverageBasisPoints, 3333);
  assert.equal(result.coveragePercent, 33.33);
  assert.equal(result.status, "partial");
});

test("verified and unverified evidence are reported separately", () => {
  const result = calculateEvidenceCoverage([
    { dimensionKey: "communication", assessmentState: "observed", evidenceState: "verified" },
    { dimensionKey: "positioning", assessmentState: "observed", evidenceState: "pending" },
    { dimensionKey: "role_execution", assessmentState: "observed", evidenceState: "corrected" },
  ]);
  assert.equal(result.verifiedEvidenceDimensionCount, 1);
  assert.equal(result.unverifiedEvidenceDimensionCount, 2);
  assert.equal(result.coveragePercent, 100);
  assert.equal(result.status, "partial");
});

test("complete requires all applicable dimensions observed with verified evidence", () => {
  const result = calculateEvidenceCoverage([
    { dimensionKey: "communication", assessmentState: "observed", evidenceState: "verified" },
    { dimensionKey: "positioning", assessmentState: "observed", evidenceState: "verified" },
  ]);
  assert.equal(result.coveragePercent, 100);
  assert.equal(result.status, "complete");
});

test("zero observed dimensions and empty applicability are insufficient, never zero-rated scores", () => {
  const none = calculateEvidenceCoverage([{ dimensionKey: "communication", assessmentState: "not_observed", evidenceState: null }]);
  const empty = calculateEvidenceCoverage([]);
  assert.equal(none.coveragePercent, 0);
  assert.equal(none.status, "insufficient");
  assert.equal(empty.coveragePercent, null);
  assert.equal(empty.status, "insufficient");
});

test("incomplete, rejected and missing states remain distinct", () => {
  const result = calculateEvidenceCoverage([
    { dimensionKey: "a", assessmentState: "incomplete", evidenceState: null },
    { dimensionKey: "b", assessmentState: "rejected_evidence", evidenceState: null },
    { dimensionKey: "c", assessmentState: null, evidenceState: null },
  ]);
  assert.equal(result.incompleteDimensionCount, 1);
  assert.equal(result.rejectedEvidenceDimensionCount, 1);
  assert.equal(result.missingDimensionCount, 1);
  assert.equal(result.status, "insufficient");
});

test("duplicate dimensions, role-inapplicable states and unknown evidence states fail closed", () => {
  assert.throws(() => calculateEvidenceCoverage([
    { dimensionKey: "a", assessmentState: null, evidenceState: null },
    { dimensionKey: "a", assessmentState: null, evidenceState: null },
  ]), /Duplicate coverage dimension/);
  assert.throws(() => calculateEvidenceCoverage([
    { dimensionKey: "a", assessmentState: "not_applicable", evidenceState: null },
  ]), /excluded by the bound role-weight set/);
  const rejected = calculateEvidenceCoverage([
    { dimensionKey: "a", assessmentState: "observed", evidenceState: "rejected" },
    { dimensionKey: "b", assessmentState: "observed", evidenceState: "archived" },
    { dimensionKey: "c", assessmentState: "observed", evidenceState: null },
  ]);
  assert.equal(rejected.observedDimensionCount, 0);
  assert.equal(rejected.rejectedEvidenceDimensionCount, 3);
  assert.equal(rejected.coveragePercent, 0);
  assert.equal(rejected.status, "insufficient");
  assert.throws(() => calculateEvidenceCoverage([
    { dimensionKey: "a", assessmentState: "observed", evidenceState: "unknown" },
  ]), /Unknown evidence state/);
});

test("coverage precision is deterministic integer basis-point rounding", () => {
  const result = calculateEvidenceCoverage([
    { dimensionKey: "a", assessmentState: "observed", evidenceState: "verified" },
    { dimensionKey: "b", assessmentState: "not_observed", evidenceState: null },
    { dimensionKey: "c", assessmentState: "not_observed", evidenceState: null },
  ]);
  assert.equal(result.coverageBasisPoints, 3333);
  assert.equal(result.coveragePercent, 33.33);
  assert.equal(result.calculationVersion, "evidence-coverage-v1");
});

test("database stores immutable versioned inputs and idempotent snapshots without score fields", () => {
  assert.match(migration, /evolution_evidence_coverage_snapshots/);
  assert.match(migration, /input_snapshot jsonb NOT NULL/);
  assert.match(migration, /input_fingerprint/);
  assert.match(migration, /UNIQUE\s*\(evaluation_context_id, calculation_version, input_fingerprint\)/);
  assert.match(migration, /Evidence coverage snapshots are immutable/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.calculate_evolution_evidence_coverage/);
  assert.match(migration, /active_team_owner_or_coach_required/);
  assert.match(migration, /round\(\(v_observed::numeric \* 10000\) \/ v_applicable\)/);
  assert.doesNotMatch(migration, /weighted_average|score_snapshot|match_placement|kill_count/i);
});
