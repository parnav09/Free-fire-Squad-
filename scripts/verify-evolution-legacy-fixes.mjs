import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [app, insights, rubric, training, analytics, blueprint] = await Promise.all([
  read("../src/App.tsx"),
  read("../src/components/PlayerWeeklyInsights.tsx"),
  read("../src/components/PlayerEvaluationRubric.tsx"),
  read("../src/components/PlanningTrainingCenter.tsx"),
  read("../src/components/AnalyticsSection.tsx"),
  read("../docs/evolution-version-2.md"),
]);

test("legacy Daily Evaluation has no P1 or fabricated score defaults", () => {
  assert.match(app, /const \[evalPlayer,setEvalPlayer\]=useState\(""/);
  assert.match(app, /const \[evalScores,setEvalScores\]=useState<Record<string,number>>\(\{\}\)/);
  assert.doesNotMatch(app, /useState\("P1"\)/);
  assert.doesNotMatch(app, /evalScores,setEvalScores\]=useState<Record<string,number>>\(\{communication:5/);
  assert.match(app, /evaluationComplete=evaluationKeys\.every/);
  assert.match(app, /function kolkataDateISO/);
  assert.ok(app.includes('timeZone:"Asia/Kolkata"'));
  assert.ok(app.includes("const evalDate=kolkataDateISO()"));
  assert.match(app, /disabled=\{!evalPlayer\|\|!evaluationComplete/);
});

test("evaluation history refresh reads score and private feedback from their own tables", () => {
  const start = app.indexOf("async function fetchEvaluationHistory");
  const end = app.indexOf("\n}", start);
  assert.ok(start >= 0 && end > start);
  const loader = app.slice(start, end);
  assert.match(loader, /from\("daily_scores"\)/);
  assert.match(loader, /from\("daily_score_feedback"\)/);
  assert.match(loader, /order\("created_at"/);
  assert.doesNotMatch(loader, /improvement_notes.*from\("daily_scores"\)/);
  assert.match(app, /table: "daily_score_feedback"/);
  assert.match(app, /fetchEvaluationHistory\(client, team\.id, sessionUserId\)/);
});

test("legacy Weekly Review and Player Trends are read-only and missing scores are excluded", () => {
  assert.match(insights, /const valid=ordered\.filter\(e=>score\(e\)!==null\)/);
  assert.match(insights, /if\(!values\.every\(v=>Number\.isInteger\(v\)&&v!==null&&v>=0&&v<=10\)\)return null/);
  assert.match(insights, /return values\.reduce<number>/);
  assert.doesNotMatch(insights, /if\(e\.total!==null&&Number\.isFinite\(e\.total\)\)return e\.total/);
  assert.match(insights, /const playerAverages=active\.map\(m=>avg\(m\.user_id\)\)\.filter/);
  assert.match(insights, /Existing assignments preserved/);
  assert.match(insights, /NO NEW BATCHES/);
  assert.match(insights, /Evolution Phase Seven/);
  assert.match(insights, /Evolution Phase Eight/);
  assert.doesNotMatch(insights, /onGenerate|Generate weekly batch/);
  assert.doesNotMatch(app, /const createAssignment=/);
  assert.match(app, /Legacy creation paused/);
  assert.match(app, /const updateAssignment=/);
  assert.match(app, /<PlayerWeeklyInsights members=\{teamMembers\} assignments=\{assignmentRows\} evaluations=\{evalHistory\}\/\>/);
});

test("legacy training rubric requires explicit ratings before save", () => {
  assert.match(rubric, /const \[rated,setRated\]/);
  assert.match(rubric, /const complete=dimensions\.every/);
  assert.match(rubric, /disabled=\{loading\|\|!complete\}/);
  assert.match(rubric, /onPointerDown=\{\(\)=>set\(d\.key,ratings\[d\.key\]\)\}/);
});

test("new standard and advanced rubric records match the declared 1-10 dimension scale", () => {
  assert.match(training, /scale:"1-10",dimension_storage:"raw_1_to_10"/);
  assert.doesNotMatch(training, /draft\.ratings\.coordination\*10/);
  const standardStart=training.indexOf("const saveResult=");
  const advancedStart=training.indexOf("const saveAdvancedEvaluation=",standardStart);
  assert.ok(standardStart>=0&&advancedStart>standardStart);
  const standard=training.slice(standardStart,advancedStart);
  assert.match(standard, /scale:"1-10",dimension_storage:"raw_1_to_10"/);
  assert.match(training, /const weightedScore=rubricValues\.every/);
  assert.doesNotMatch(training, /Number\(rubricExecution\)\/10/);
  assert.doesNotMatch(training, /Number\(e\.target\.value\)\*10/);
});

test("legacy Analytics is clearly separated from future player-development analytics", () => {
  assert.match(analytics, /COMPETITIVE RESULTS · LEGACY VIEW/);
  assert.match(analytics, /Evolution Phase Nine/);
});

test("the master blueprint consistently names every Evolution phase", () => {
  const phaseNames = ["Zero","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve"];
  for (const name of phaseNames) {
    assert.match(blueprint, new RegExp("Evolution Phase " + name));
  }
  assert.doesNotMatch(blueprint, /Phase [0-9]/);
});

test("legacy Daily Evaluation cannot create a non-atomic score/feedback partial write", () => {
  const start = app.indexOf("const saveEvaluation=");
  const end = app.indexOf("const saveCloudTraining", start);
  assert.ok(start >= 0 && end > start);
  const save = app.slice(start, end);
  assert.doesNotMatch(save, /daily_score_feedback|privatePayload/);
  assert.match(app, /Private feedback entry is paused/);
  assert.match(app, /Atomic score \+ feedback submission.*Evolution Phase Four/);
  assert.match(save, /if\(evalSaving\)return/);
  assert.match(save, /member\.user_id!==sessionUserId/);
  assert.match(save, /\.eq\("player_id",evalPlayer\)\.eq\("score_date",evalDate\)/);
  assert.match(app, /teamMembers\.filter\(m=>m\.status==="active"&&m\.user_id!==sessionUserId\)/);
});


test("team changes and sign-out clear prior-team Evolution records", () => {
  assert.match(app, /setEvalHistory\(\[\]\)/);
  assert.match(app, /setAssignmentRows\(\[\]\)/);
  assert.match(app, /assignmentScopeRef\.current!==team\.id/);
  assert.match(app, /\[supabase,signedIn,team\?\.id,sessionUserId\]/);
  assert.match(app, /\[supabase,signedIn,team\?\.id\]/);
});

test("legacy assignment updates stay inside the selected team and respect the current actor", () => {
  assert.match(app, /assignment\.player_id!==sessionUserId&&!canManageAssignments/);
  assert.match(app, /\.eq\("id",id\)\.eq\("team_id",team\.id\)/);
  assert.match(app, /\.select\("id"\)\.maybeSingle\(\)/);
  assert.match(app, /status:"assigned"|"completed"/);
});