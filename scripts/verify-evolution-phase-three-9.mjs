import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const root = new URL("../", import.meta.url);
async function compileModule(path, replacements = {}) {
  const source = await readFile(new URL(path, root), "utf8");
  let output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [specifier, replacement] of Object.entries(replacements)) {
    output = output.replaceAll('from "' + specifier + '"', 'from "' + replacement + '"');
  }
  return "data:text/javascript;base64," + Buffer.from(output).toString("base64");
}
const assessmentUrl = await compileModule("src/lib/evolution-assessment-states.ts");
const coverageUrl = await compileModule("src/lib/evolution-evidence-coverage.ts");
const scoringUrl = await compileModule("src/lib/evolution-deterministic-scoring.ts", {
  "./evolution-assessment-states": assessmentUrl,
  "./evolution-evidence-coverage": coverageUrl,
});
const { calculateDeterministicPlayerScore, DETERMINISTIC_SCORING_POLICY_V1 } = await import(scoringUrl);

const DIMENSIONS = ["communication","coordination_trade_support","decision_making","positioning","map_awareness_rotation","role_execution"];
const ROLE = "primary_rusher";
const DEFAULT_WEIGHTS = [2000,2000,1000,1500,1500,2000];
function buildInput({states=DIMENSIONS.map(()=>"observed"),ratings=[8,7,6,10,0,9],evidenceStatuses={},weights=DEFAULT_WEIGHTS}={}) {
  const context={id:"context-001",createdAt:"2026-11-23T10:00:00.000Z",roleAssignmentSnapshotId:"role-snapshot-001",roleKey:ROLE};
  const rubric={id:"rubric-version-001",version:1,status:"active",effectiveFrom:"2026-11-01T00:00:00.000Z",effectiveUntil:null,criteria:DIMENSIONS.map(dimensionKey=>({dimensionKey,dimensionDefinitionVersion:1,applicableRoleKeys:[ROLE]}))};
  const weightSet={id:"weight-set-001",version:1,evaluationContextId:context.id,rubricVersionId:rubric.id,roleAssignmentSnapshotId:context.roleAssignmentSnapshotId,roleKey:ROLE,status:"active",effectiveFrom:"2026-11-01T00:00:00.000Z",effectiveUntil:null,dimensions:DIMENSIONS.map((dimensionKey,index)=>({dimensionKey,dimensionDefinitionVersion:1,weightBasisPoints:weights[index]}))};
  const assessments=[];
  for(let index=0;index<DIMENSIONS.length;index+=1){
    const state=states[index]??"missing";
    if(state==="missing") continue;
    if(state==="observed") assessments.push({dimensionKey:DIMENSIONS[index],dimensionDefinitionVersion:1,state,ratingValue:ratings[index],evidence:{id:"evidence-"+index,evaluationContextId:context.id,dimensionKey:DIMENSIONS[index],dimensionDefinitionVersion:1,status:evidenceStatuses[index]??"verified"},reason:null});
    else if(state==="rejected_evidence") assessments.push({dimensionKey:DIMENSIONS[index],dimensionDefinitionVersion:1,state,ratingValue:null,evidence:{id:"evidence-"+index,evaluationContextId:context.id,dimensionKey:DIMENSIONS[index],dimensionDefinitionVersion:1,status:"rejected"},reason:"Evidence was rejected"});
    else assessments.push({dimensionKey:DIMENSIONS[index],dimensionDefinitionVersion:1,state,ratingValue:null,evidence:null,reason:"No fair observation was available"});
  }
  return {context,rubric,weightSet,assessments};
}
const threeObserved=["observed","observed","observed","not_observed","not_observed","not_observed"];

test("versioned policy defines the 50% coverage gate and canonical 0–10 to 0–100 scale",()=>{
  assert.equal(DETERMINISTIC_SCORING_POLICY_V1.version,"deterministic-scoring-policy-v1");
  assert.equal(DETERMINISTIC_SCORING_POLICY_V1.minimumCoverageBasisPoints,5000);
  assert.equal(DETERMINISTIC_SCORING_POLICY_V1.ratingScaleMinimum,0);
  assert.equal(DETERMINISTIC_SCORING_POLICY_V1.ratingScaleMaximum,10);
  assert.equal(DETERMINISTIC_SCORING_POLICY_V1.normalizedScoreMultiplier,10);
  assert.equal(DETERMINISTIC_SCORING_POLICY_V1.rounding,"half-up");
});
test("all six verified dimensions produce weighted average × 10 with exact rational precision",()=>{
  const r=calculateDeterministicPlayerScore(buildInput());
  assert.equal(r.status,"final"); assert.equal(r.score100,69); assert.equal(r.scoreBasisPoints,6900);
  assert.equal(r.coverageBasisPoints,10000); assert.equal(r.observedDimensionCount,6);
  assert.equal(r.verifiedEvidenceDimensionCount,6); assert.equal(r.exactScoreNumerator,69000000);
  assert.equal(r.exactScoreDenominator,10000);
});
test("Not Observed remains in coverage denominator but is excluded from score denominator",()=>{
  const r=calculateDeterministicPlayerScore(buildInput({states:threeObserved}));
  assert.equal(r.status,"final"); assert.equal(r.coverageBasisPoints,5000); assert.equal(r.notObservedDimensionCount,3);
  assert.equal(r.observedWeightBasisPoints,5000); assert.equal(r.score100,72); assert.equal(r.scoreBasisPoints,7200);
});
test("coverage gate with missing dimensions is provisional, not final",()=>{
  const r=calculateDeterministicPlayerScore(buildInput({states:["observed","observed","observed","missing","missing","missing"]}));
  assert.equal(r.coverageBasisPoints,5000); assert.equal(r.status,"provisional"); assert.equal(r.score100,null);
  assert.equal(r.provisionalScore100,72); assert.ok(r.reasons.includes("missing_dimensions"));
});
test("pending evidence may create a provisional candidate but never a final score",()=>{
  const r=calculateDeterministicPlayerScore(buildInput({states:threeObserved,evidenceStatuses:{1:"pending"}}));
  assert.equal(r.status,"provisional"); assert.equal(r.score100,null); assert.equal(r.provisionalScore100,72);
  assert.equal(r.verifiedEvidenceDimensionCount,2); assert.equal(r.unverifiedEvidenceDimensionCount,1);
  assert.ok(r.reasons.includes("unverified_evidence"));
});
test("coverage below minimum suppresses final and provisional score output",()=>{
  const r=calculateDeterministicPlayerScore(buildInput({states:["observed","observed","not_observed","not_observed","not_observed","not_observed"]}));
  assert.equal(r.coverageBasisPoints,3333); assert.equal(r.status,"insufficient");
  assert.equal(r.score100,null); assert.equal(r.provisionalScore100,null); assert.ok(r.reasons.includes("coverage_below_minimum"));
});
test("all Not Observed is insufficient and never becomes a zero score",()=>{
  const r=calculateDeterministicPlayerScore(buildInput({states:DIMENSIONS.map(()=>"not_observed")}));
  assert.equal(r.status,"insufficient"); assert.equal(r.score100,null); assert.equal(r.provisionalScore100,null);
  assert.equal(r.observedDimensionCount,0); assert.equal(r.notObservedDimensionCount,6);
});
test("a deliberate observed zero remains a valid final rating",()=>{
  const r=calculateDeterministicPlayerScore(buildInput({states:threeObserved,ratings:[0,0,0,10,10,10]}));
  assert.equal(r.status,"final"); assert.equal(r.score100,0); assert.equal(r.scoreBasisPoints,0);
});
test("rating ten normalizes to 100, not 10",()=>{
  const r=calculateDeterministicPlayerScore(buildInput({ratings:[10,10,10,10,10,10]}));
  assert.equal(r.score100,100); assert.equal(r.scoreBasisPoints,10000);
});
test("half-up rounding is deterministic at half a hundredth and retains exact fraction",()=>{
  const r=calculateDeterministicPlayerScore(buildInput({states:threeObserved,ratings:[1,0,0,0,0,0],weights:[1,1998,1,1000,1000,6000]}));
  assert.equal(r.status,"final"); assert.equal(r.exactScoreNumerator,1000); assert.equal(r.exactScoreDenominator,2000);
  assert.equal(r.scoreBasisPoints,1); assert.equal(r.score100,0.01);
});
test("negative, fractional, above-range and null observed ratings are rejected",()=>{
  for(const invalid of [-1,1.5,11,null]){
    const input=buildInput(); input.assessments[0].ratingValue=invalid;
    assert.throws(()=>calculateDeterministicPlayerScore(input),/Observed rating must be an integer/);
  }
});
test("Not Observed and Incomplete require a reason and cannot contain rating/evidence",()=>{
  const noReason=buildInput({states:threeObserved}); noReason.assessments[3].reason="  ";
  assert.throws(()=>calculateDeterministicPlayerScore(noReason),/requires a reason/);
  const rating=buildInput({states:threeObserved}); rating.assessments[3].ratingValue=0;
  assert.throws(()=>calculateDeterministicPlayerScore(rating),/cannot contain a rating or evidence/);
  const evidence=buildInput({states:threeObserved}); evidence.assessments[3].evidence={id:"extra",evaluationContextId:evidence.context.id,dimensionKey:DIMENSIONS[3],dimensionDefinitionVersion:1,status:"verified"};
  assert.throws(()=>calculateDeterministicPlayerScore(evidence),/cannot contain a rating or evidence/);
});
test("rejected evidence is separately counted and cannot contribute to score",()=>{
  const r=calculateDeterministicPlayerScore(buildInput({states:["observed","observed","observed","rejected_evidence","not_observed","not_observed"]}));
  assert.equal(r.status,"provisional"); assert.equal(r.rejectedEvidenceDimensionCount,1);
  assert.equal(r.coverageBasisPoints,5000); assert.equal(r.score100,null); assert.equal(r.provisionalScore100,72);
});
test("mismatched context evidence fails closed and is classified as rejected",()=>{
  const input=buildInput({states:threeObserved}); input.assessments[0].evidence.evaluationContextId="another-context";
  const r=calculateDeterministicPlayerScore(input);
  assert.equal(r.rejectedEvidenceDimensionCount,1); assert.equal(r.coverageBasisPoints,3333);
  assert.equal(r.status,"insufficient"); assert.equal(r.score100,null);
});
test("unknown evidence states fail closed",()=>{
  const input=buildInput(); input.assessments[0].evidence.status="unrecognized";
  assert.throws(()=>calculateDeterministicPlayerScore(input),/Unknown evidence state/);
});
test("an evidence identity cannot be reused across dimensions",()=>{
  const input=buildInput(); input.assessments[1].evidence.id=input.assessments[0].evidence.id;
  assert.throws(()=>calculateDeterministicPlayerScore(input),/cannot be reused across dimensions/);
});
test("context, rubric, role and historical role-snapshot bindings must match exactly",()=>{
  const mutations=[
    i=>{i.weightSet.evaluationContextId="other";},
    i=>{i.weightSet.rubricVersionId="other";},
    i=>{i.weightSet.roleAssignmentSnapshotId="other";},
    i=>{i.weightSet.roleKey="sniper_igl";},
  ];
  for(const mutate of mutations){const i=buildInput();mutate(i);assert.throws(()=>calculateDeterministicPlayerScore(i),/not bound|does not match/);}
});
test("weights must include every applicable dimension once and total 10000 basis points",()=>{
  const total=buildInput();total.weightSet.dimensions[0].weightBasisPoints-=1;
  assert.throws(()=>calculateDeterministicPlayerScore(total),/total exactly 10000/);
  const missing=buildInput();missing.weightSet.dimensions.pop();
  assert.throws(()=>calculateDeterministicPlayerScore(missing),/every applicable rubric dimension/);
  const duplicate=buildInput();duplicate.weightSet.dimensions[1].dimensionKey=duplicate.weightSet.dimensions[0].dimensionKey;
  assert.throws(()=>calculateDeterministicPlayerScore(duplicate),/Duplicate role weight/);
});
test("dimension-definition versions must match rubric, weights and assessments",()=>{
  const assessment=buildInput();assessment.assessments[0].dimensionDefinitionVersion=2;
  assert.throws(()=>calculateDeterministicPlayerScore(assessment),/exact rubric dimension-definition version/);
  const weight=buildInput();weight.weightSet.dimensions[0].dimensionDefinitionVersion=2;
  assert.throws(()=>calculateDeterministicPlayerScore(weight),/exact rubric dimension-definition version/);
});
test("Not Applicable is rejected inside the bound role-weight set",()=>{
  const i=buildInput({states:threeObserved});i.assessments[3].state="not_applicable";
  assert.throws(()=>calculateDeterministicPlayerScore(i),/Not Applicable cannot be supplied/);
});
test("rubric and weight lifecycle dates must be valid for the historical context",()=>{
  const outside=buildInput();outside.rubric.effectiveFrom="2026-12-01T00:00:00.000Z";
  assert.throws(()=>calculateDeterministicPlayerScore(outside),/not effective/);
  const activeEnd=buildInput();activeEnd.weightSet.effectiveUntil="2026-12-01T00:00:00.000Z";
  assert.throws(()=>calculateDeterministicPlayerScore(activeEnd),/active version cannot have an effective end date/);
  const retired=buildInput();retired.rubric.status="retired";
  assert.throws(()=>calculateDeterministicPlayerScore(retired),/retired version must have an effective end date/);
});
test("identical inputs produce byte-identical deterministic results",()=>{
  const i=buildInput({states:threeObserved});
  assert.equal(JSON.stringify(calculateDeterministicPlayerScore(i)),JSON.stringify(calculateDeterministicPlayerScore(i)));
});
test("engine excludes tournament outcomes and consumes canonical coverage/readiness",async()=>{
  const source=await readFile(new URL("src/lib/evolution-deterministic-scoring.ts",root),"utf8");
  assert.doesNotMatch(source,/kill_count|placement_points|match_points|tournament_result|booyah/i);
  assert.match(source,/calculateEvidenceCoverage/);assert.match(source,/classifyAssessmentReadiness/);
  assert.match(source,/exactScoreNumerator/);assert.match(source,/minimumCoverageBasisPoints/);
});
