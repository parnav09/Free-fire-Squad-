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
  assert.match(insights, /const playerAverages=active\.map\(m=>avg\(m\.user_id\)\)\.filter/);
  assert.match(insights, /Existing assignments preserved/);
  assert.match(insights, /NO NEW BATCHES/);
  assert.match(insights, /Evolution Phase Seven/);
  assert.match(insights, /Evolution Phase Eight/);
  assert.doesNotMatch(insights, /onGenerate|Generate weekly batch/);
  assert.match(app, /<PlayerWeeklyInsights members=\{teamMembers\} assignments=\{assignmentRows\} evaluations=\{evalHistory\}\/\>/);
});

test("legacy training rubric requires explicit ratings before save", () => {
  assert.match(rubric, /const \[rated,setRated\]/);
  assert.match(rubric, /const complete=dimensions\.every/);
  assert.match(rubric, /disabled=\{loading\|\|!complete\}/);
});

test("new advanced rubric records match the declared 1-10 dimension scale", () => {
  assert.match(training, /scale:"1-10",dimension_storage:"raw_1_to_10"/);
  assert.doesNotMatch(training, /draft\.ratings\.coordination\*10/);
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
});
