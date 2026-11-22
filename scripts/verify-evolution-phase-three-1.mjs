import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const report = await readFile(
  new URL("../docs/evolution/PHASE-3-1-EXISTING-EVALUATION-SYSTEM-AUDIT.md", import.meta.url),
  "utf8",
);

test("3.1 audit records all legacy evaluation stores and flows", () => {
  for (const term of ["daily_scores", "daily_score_feedback", "training_results", "PlayerEvaluationRubric.tsx", "PlayerWeeklyInsights.tsx"]) {
    assert.ok(report.includes(term), "missing inventory item: " + term);
  }
});

test("3.1 audit records the canonical Evolution rubric implementation and exact head", () => {
  for (const term of [
    "evolution_rubric_versions",
    "evolution_role_weight_profiles",
    "evolution_evidence_items",
    "evolution-scoring.ts",
    "8de23472711ff4a6ce997bac6ec323e33631dee3",
  ]) assert.ok(report.includes(term), "missing candidate implementation evidence: " + term);
});

test("3.1 audit preserves the canonical six-dimension contract", () => {
  for (const key of [
    "communication",
    "coordination_trade_support",
    "decision_making",
    "positioning",
    "map_awareness_rotation",
    "role_execution",
  ]) assert.ok(report.includes(key), "missing canonical dimension: " + key);
});

test("3.1 audit documents legacy crosswalks without destructive conversion", () => {
  assert.match(report, /do not auto-migrate/i);
  assert.match(report, /preserve source values/i);
  assert.match(report, /not automatically comparable/i);
});

test("3.1 audit records the specified score normalization and Not Observed rule", () => {
  assert.match(report, /weighted_average\(valid_dimension_scores_0_to_10\) × 10/);
  assert.match(report, /Not Observed is distinct from zero/i);
});

test("3.1 audit records the actual PostgreSQL CI failure instead of claiming PASS", () => {
  assert.ok(report.includes("44384438749"));
  assert.match(report, /infinite recursion detected in policy/i);
  assert.match(report, /IMPLEMENTED ON UNMERGED BRANCH \/ NOT VERIFIED/);
});

test("3.1 audit records the role-weight immutability defect", () => {
  assert.match(report, /Active role-weight mutability/i);
  assert.match(report, /create a new version/i);
});

test("3.1 audit records Phase 2 dependency and legacy phase-number conflicts", () => {
  assert.ok(report.includes("PR #130"));
  assert.match(report, /Phase 3 = Training Center/);
  assert.match(report, /Phase 3 = Tournament Ledger/);
});

test("3.1 audit explicitly guarantees no production mutation or deployment", () => {
  assert.match(report, /No Supabase migration was created or applied/);
  assert.match(report, /No data backfill or conversion was run/);
  assert.match(report, /No merge or production deployment is included/);
});
