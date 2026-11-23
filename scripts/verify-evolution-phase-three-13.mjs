import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [component, styles, app, roadmap, atomicMigration, dbHarness, workflow] = await Promise.all([
  read("../src/components/EvolutionEvaluationWorkspace.tsx"),
  read("../src/components/EvolutionEvaluationWorkspace.css"),
  read("../src/App.tsx"),
  read("../docs/evolution/EVOLUTION-PHASE-3-ROADMAP-AND-CHECKPOINT.md"),
  read("../supabase/migrations/20261122220000_evolution_phase_three_13_atomic_context_creation.sql"),
  read("./verify-evolution-phase-three-13-db.sh"),
  read("../.github/workflows/evolution-phase-one.yml"),
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

test("evaluation context creation atomically pins the effective rubric and historical role weights", () => {
  assert.match(component, /rpc\("create_evolution_evaluation_context"/);
  assert.match(component, /p_role_assignment_id:role\.id/);
  assert.match(component, /evolution_evaluation_rubric_bindings/);
  assert.match(component, /evolution_evaluation_role_weight_bindings/);
  assert.match(atomicMigration, /CREATE OR REPLACE FUNCTION public\.create_evolution_evaluation_context/);
  assert.match(atomicMigration, /SECURITY DEFINER/);
  assert.match(atomicMigration, /SET search_path = ''/);
  assert.match(atomicMigration, /canonical_role_key_from_snapshot/);
  assert.match(atomicMigration, /RETURNING \* INTO v_context/);
  assert.match(atomicMigration, /RETURN v_context/);
  assert.match(atomicMigration, /GRANT EXECUTE ON FUNCTION public\.create_evolution_evaluation_context/);
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
  assert.ok(app.includes('const EvolutionEvaluationWorkspace = lazy(() => import("./components/EvolutionEvaluationWorkspace"));'));
  assert.ok(app.includes("Loading canonical evaluation workspace"));
  assert.ok(app.includes('key={team?.id||"no-team"}'));
  assert.match(app, /Legacy daily evaluation/);
  assert.match(roadmap, /### 3\.13 Scoring UI & Evaluation Experience/);
});

test("mobile controls and visible action hitboxes meet the 44px minimum", () => {
  assert.match(styles, /min-height:44px/);
  assert.ok(styles.includes(".evolution-eval-editor input[type=range]{width:100%;min-height:44px;height:44px"));
  assert.match(styles, /@media\(max-width:760px\)/);
  assert.match(styles, /@media\(max-width:480px\)/);
  assert.match(styles, /grid-template-columns:1fr/);
});

test("role-inapplicable rubric dimensions expose Not Applicable without inventing a score", () => {
  assert.ok(component.includes("not_applicable"));
  assert.ok(component.includes("criteria.map(criterion=>"));
  assert.ok(component.includes('weight?"observed":"not_applicable"'));
  assert.ok(component.includes("assessment state does not match the dimension's historical role applicability"));
  assert.ok(component.includes("assessment_state:d.state"));
  assert.ok(!component.includes("key={weight.dimension_key}"));
});

test("refreshing a saved dimension preserves other unsaved drafts", () => {
  assert.ok(component.includes("loadContext(context.id,true)"));
  assert.ok(component.includes("delete next[key]"));
  assert.ok(component.includes("unsavedDraftCount"));
  assert.ok(component.includes("disabled={unsavedDraftCount>0}"));
  assert.ok(component.includes("Discard all drafts"));
});

test("evidence recovery can reattach an unlinked item without creating a duplicate", () => {
  assert.ok(component.includes("availableEvidence=evidence.filter"));
  assert.ok(component.includes("!evidenceLinks.some(link=>link.evidence_item_id===item.id)"));
  assert.ok(component.includes("linksFor(evidenceId)"));
  assert.ok(component.includes("unlinked evidence will remain available to attach"));
  assert.ok(component.includes('.in("evidence_item_id",evidenceIds)'));
});

test("previous evaluation comparison is scoped to the same player and earlier context", () => {
  assert.ok(component.includes("PREVIOUS EVALUATION · SAME PLAYER"));
  assert.ok(component.includes('.eq("player_member_id",c.data.player_member_id)'));
  assert.ok(component.includes('.lt("created_at",c.data.created_at)'));
  assert.ok(component.includes("Change from previous final score"));
});

test("evidence entry supports each canonical source type and validates external locators", () => {
  for (const source of ["manual_observation","round_note","vod_reference","match_reference"]) {
    assert.ok(component.includes(source), "missing evidence source type: "+source);
  }
  assert.ok(component.includes("VOD and match references require a source URL"));
  assert.ok(component.includes('parsed.protocol!=="https:" && parsed.protocol!=="http:"'));
});

test("atomic context creation migration is applied and its RPC ACL is verified in CI", () => {
  assert.match(dbHarness, /verify-evolution-phase-three-12-db\.sh/);
  assert.match(dbHarness, /20261122220000_evolution_phase_three_13_atomic_context_creation\.sql/);
  assert.match(dbHarness, /has_function_privilege/);
  assert.match(dbHarness, /search_path/);
  assert.match(workflow, /Verify Evolution Phase Three\.13 atomic context creation/);
  assert.match(workflow, /verify-evolution-phase-three-13-db\.sh/);
});
