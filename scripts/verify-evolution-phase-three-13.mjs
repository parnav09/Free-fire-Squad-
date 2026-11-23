import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [component, styles, app, roadmap] = await Promise.all([
  read("../src/components/EvolutionEvaluationWorkspace.tsx"),
  read("../src/components/EvolutionEvaluationWorkspace.css"),
  read("../src/App.tsx"),
  read("../docs/evolution/EVOLUTION-PHASE-3-ROADMAP-AND-CHECKPOINT.md"),
]);

test("Phase 3.13 uses canonical sessions, matches and immutable historical role snapshots", () => {
  assert.match(component, /from\("canonical_sessions"\)/);
  assert.match(component, /from\("canonical_session_matches"\)/);
  assert.match(component, /from\("canonical_session_match_roles"\)/);
  assert.match(component, /role_assignment_status==="assigned"/);
  assert.match(component, /role_key_snapshot/);
  assert.match(component, /player_member_id:member\.id/);
  assert.match(component, /canonical_session_match_id:match\.id/);
});

test("evaluation binds exact active rubric and role-weight versions before assessment", () => {
  assert.match(component, /evolution_rubric_versions/);
  assert.match(component, /evolution_role_weight_sets/);
  assert.match(component, /evolution_evaluation_rubric_bindings/);
  assert.match(component, /evolution_evaluation_role_weight_bindings/);
  assert.match(component, /lifecycle_status","active"/);
  assert.match(component, /effective_from/);
});

test("evidence creation, dimension linkage and assessment revisions are explicit", () => {
  assert.match(component, /evolution_evidence_items/);
  assert.match(component, /evolution_evidence_dimension_links/);
  assert.match(component, /evolution_evaluation_dimension_assessment_events/);
  assert.match(component, /revision_number:\(latest\?\.revision_number\|\|0\)\+1/);
  assert.match(component, /assessment_state:d\.state/);
  assert.match(component, /rating_value:d\.state==="observed"\?d\.rating:null/);
});

test("verification and scoring use the authoritative database RPCs", () => {
  assert.match(component, /transition_evolution_evidence_status/);
  assert.match(component, /calculate_evolution_evidence_coverage/);
  assert.match(component, /calculate_evolution_player_score_snapshot/);
  assert.match(component, /p_recalculation_reason/);
});

test("the interface exposes coverage, readiness, immutable score history and explicit failure states", () => {
  for (const text of ["ASSESSMENT READINESS","LATEST EVIDENCE COVERAGE","LATEST PLAYER SCORE","IMMUTABLE CALCULATION HISTORY","Retry","role snapshot","Provisional","UNSAVED DRAFT","vs previous snapshot"]) {
    assert.ok(component.toLowerCase().includes(text.toLowerCase()), "missing UI contract: "+text);
  }
  assert.match(component, /roleKey\(role\?\.role_key_snapshot\)/);
  assert.match(component, /No active, effective rubric/);
  assert.match(component, /No active, effective role-weight set/);
});

test("the workspace is mounted in the Evaluation module without replacing legacy records", () => {
  assert.match(app, /<EvolutionEvaluationWorkspace/);
  assert.match(app, /Legacy daily evaluation/);
  assert.match(roadmap, /### 3\.13 Scoring UI & Evaluation Experience/);
});

test("mobile controls and visible action hitboxes meet the 44px minimum", () => {
  assert.match(styles, /min-height:44px/);
  assert.match(styles, /@media\(max-width:760px\)/);
  assert.match(styles, /@media\(max-width:480px\)/);
  assert.match(styles, /grid-template-columns:1fr/);
});
