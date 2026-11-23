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
  assert.match(component, /\[0,1,2,3,4,5,6,7,8,9,10\]/);
  assert.match(component, /roleGuidance/);
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

test("role-inapplicable rubric dimensions expose Not Applicable without inventing a score", () => {
  assert.match(component, /not_applicable/);
  assert.match(component, /criteria\\.map\\(criterion/);
  assert.match(component, /weight\\?"observed":"not_applicable"/);
  assert.match(component, /assessment state does not match the dimension's historical role applicability/);
  assert.match(component, /assessment_state:d\\.state/);
  assert.doesNotMatch(component, /key=\\{weight\\.dimension_key\\}/);
});

test("refreshing a saved dimension preserves other unsaved drafts", () => {
  assert.match(component, /loadContext\\(context\\.id,true\\)/);
  assert.match(component, /delete next\\[key\\]/);
  assert.match(component, /unsavedDraftCount/);
  assert.match(component, /disabled=\\{unsavedDraftCount>0\\}/);
  assert.match(component, /Discard all drafts/);
});

test("evidence recovery can reattach an unlinked item without creating a duplicate", () => {
  assert.match(component, /availableEvidence=evidence\\.filter/);
  assert.match(component, /!evidenceLinks\\.some\\(link=>link\\.evidence_item_id===item\\.id\\)/);
  assert.match(component, /linksFor\\(evidenceId\\)/);
  assert.match(component, /unlinked evidence will remain available to attach/);
  assert.match(component, /\\.in\\("evidence_item_id",evidenceIds\\)/);
});

test("previous evaluation comparison is scoped to the same player and earlier context", () => {
  assert.match(component, /PREVIOUS EVALUATION · SAME PLAYER/);
  assert.match(component, /eq\\("player_member_id",c\\.data\\.player_member_id\\)/);
  assert.match(component, /lt\\("created_at",c\\.data\\.created_at\\)/);
  assert.match(component, /Change from previous final score/);
});

test("evidence entry supports each canonical source type and validates external locators", () => {
  for (const source of ["manual_observation","round_note","vod_reference","match_reference"]) {
    assert.ok(component.includes(source), "missing evidence source type: "+source);
  }
  assert.match(component, /VOD and match references require a source URL/);
  assert.match(component, /parsed\.protocol!=="https:" && parsed\.protocol!=="http:"/);
});
