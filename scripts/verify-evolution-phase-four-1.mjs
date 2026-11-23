import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const component = readFileSync("src/components/DailyEvaluationSessionFirst.tsx", "utf8");
const app = readFileSync("src/App.tsx", "utf8");
const styles = readFileSync("src/components/DailyEvaluationSessionFirst.css", "utf8");
const workflow = readFileSync(".github/workflows/evolution-phase-one.yml", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

test("Phase 4.1 loads only non-archived canonical sessions scoped to the active team", () => {
  assert.match(component, /from\("canonical_sessions"\)/);
  assert.match(component, /\.eq\("team_id", teamId\)/);
  assert.match(component, /\.is\("archived_at", null\)/);
});

test("session, match and role reads paginate all rows without fixed-result truncation", () => {
  assert.match(component, /const PAGE_SIZE = 250/);
  assert.match(component, /const readAllRows = async/);
  assert.match(component, /queryForRange\(from, from \+ PAGE_SIZE - 1\)/);
  assert.equal((component.match(/readAllRows\(/g) || []).length, 3);
  assert.equal((component.match(/\.range\(from, to\)/g) || []).length, 3);
  assert.doesNotMatch(component, /\.limit\(/);
});

test("match selection is constrained to the selected canonical session", () => {
  assert.match(component, /from\("canonical_session_matches"\)/);
  assert.match(component, /\.eq\("canonical_session_id", selectedSession\)/);
  assert.match(component, /\.eq\("team_id", teamId\)/);
});

test("targets come from assigned historical match roles and active team members", () => {
  assert.match(component, /from\("canonical_session_match_roles"\)/);
  assert.match(component, /role_assignment_status !== "assigned"/);
  assert.match(component, /candidate\.status === "active"/);
  assert.match(component, /canonicalRole\(row\.role_key_snapshot\)/);
});

test("failed reads clear stale session, match and role rows and expose a real retry", () => {
  assert.match(component, /setSessions\(\[\]\);\s*setMatches\(\[\]\);\s*setRoleRows\(\[\]\);/);
  assert.match(component, /setRetryNonce\(\(value\) => value \+ 1\)/);
  assert.match(component, /role="alert"/);
});

test("the signed-in evaluator is excluded and duplicate historical rows cannot duplicate a target", () => {
  assert.ok(component.includes("targetUserId.toLowerCase() === userId.toLowerCase()"));
  assert.match(component, /seen\.has\(targetUserId\)/);
  assert.match(component, /seen\.add\(targetUserId\)/);
});

test("the newest role snapshot wins; an unassigned latest snapshot cannot fall back to an older assigned row", () => {
  assert.match(component, /\.order\("changed_at", \{ ascending: false, nullsFirst: false \}\)/);
  const seen = component.indexOf("seen.add(targetUserId)");
  const assignedCheck = component.indexOf('row.role_assignment_status !== "assigned"');
  assert.ok(seen >= 0 && assignedCheck > seen, "deduplication must happen before the assigned-status filter");
});

test("session changes clear dependent match and target selections", () => {
  assert.match(component, /setSelectedSession\(event\.target\.value\);\s*setSelectedMatch\(""\);\s*setSelectedTarget\(""\)/);
});

test("the Phase 4.1 selector does not write legacy scores or call the staff-only Phase 3 context RPC", () => {
  assert.doesNotMatch(component, /from\("daily_scores"\)\s*\.insert/);
  assert.doesNotMatch(component, /create_evolution_evaluation_context/);
  assert.match(component, /no evaluation data is written here/i);
});

test("the date is locked with no client date picker or backdating control", () => {
  assert.match(component, /server-side date rule/);
  assert.doesNotMatch(component, /type=["']date["']/i);
  assert.doesNotMatch(component, /setEvaluationDate|setEvalDate/);
});

test("Phase 4.1 remains mobile responsive and uses accessible touch/focus targets", () => {
  assert.match(styles, /@media\(max-width:760px\)/);
  assert.match(styles, /grid-template-columns:1fr/);
  assert.match(styles, /min-height:44px/);
  assert.match(styles, /min-height:46px/);
  assert.match(styles, /:focus-visible/);
});

test("the new workflow is integrated into the Evaluation route", () => {
  assert.match(app, /DailyEvaluationSessionFirst/);
  assert.match(app, /DailyEvaluationSessionFirst[\s\S]*?section==="Evaluation"/);
});

test("Phase 4.1 Playwright browser acceptance is wired into CI with screenshot artifacts", () => {
  assert.equal(packageJson.scripts["test:evolution-phase-four-1-visual"], "node scripts/run-evolution-phase-four-1-visual.mjs");
  assert.match(workflow, /Verify Evolution Phase Four\.1 responsive browser acceptance/);
  assert.match(workflow, /run: npm run test:evolution-phase-four-1-visual/);
  assert.match(workflow, /path: test-results\/phase-four-1\//);
});

test("Phase 4.1 verifier is part of the production build gate", () => {
  assert.equal(packageJson.scripts["test:evolution-phase-four-1"], "node --test scripts/verify-evolution-phase-four-1.mjs");
  assert.match(packageJson.scripts.build, /test:evolution-phase-four-1/);
});
