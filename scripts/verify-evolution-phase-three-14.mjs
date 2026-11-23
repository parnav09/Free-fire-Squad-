import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [panel, app, scrims, training, analytics, player, roadmap] = await Promise.all([
  read("../src/components/CanonicalModuleIntegrationPanel.tsx"),
  read("../src/App.tsx"),
  read("../src/components/ScrimsSection.tsx"),
  read("../src/components/PlanningTrainingCenter.tsx"),
  read("../src/components/AnalyticsSection.tsx"),
  read("../src/components/PlayerWeeklyInsights.tsx"),
  read("../docs/evolution/EVOLUTION-PHASE-3-ROADMAP-AND-CHECKPOINT.md"),
]);

test("Phase 3.14 traces source modules through one canonical session identity", () => {
  assert.match(panel, /from\("canonical_session_sources"\)/);
  assert.match(panel, /from\("canonical_sessions"\)/);
  assert.match(panel, /from\("canonical_session_matches"\)/);
  assert.match(panel, /from\("evolution_evaluation_contexts"\)/);
  assert.match(panel, /from\("evolution_player_score_snapshots"\)/);
  assert.match(panel, /scrim_record_id/);
  assert.match(panel, /tournament_cycle_id/);
  assert.match(panel, /training_session_id/);
});

test("legacy source modules retain their server-authoritative canonical adapter", () => {
  assert.match(scrims, /integrateCanonicalSource\(supabase,teamId,"scrim",saved\.id\)/);
  assert.match(app, /integrateCanonicalSource\(supabase!, teamSnapshot\.id, "tournament", cycle\.id\)/);
  assert.match(training, /integrateCanonicalSource\(supabase!,teamId,"training",created\.data\.id\)/);
});

test("Player and Analytics expose canonical evaluation lineage without merging score domains", () => {
  assert.match(app, /<CanonicalModuleIntegrationPanel[\s\S]*view="players"/);
  assert.match(app, /<CanonicalModuleIntegrationPanel[\s\S]*view="analytics"/);
  assert.match(panel, /Competitive results and internal player scores remain separate/);
  assert.match(panel, /never derives player performance from kills, placement, Booyah or tournament points/);
  assert.match(player, /LEGACY REVIEW DATA/);
  assert.match(analytics, /COMPETITIVE RESULTS · LEGACY VIEW/);
});

test("canonical lineage is read-only, team-scoped and bounded", () => {
  assert.match(panel, /\.eq\("team_id", teamId\)/);
  assert.match(panel, /\.limit\(250\)/);
  assert.match(panel, /\.limit\(1000\)/);
  assert.doesNotMatch(panel, /\.insert\(|\.update\(|\.delete\(/);
  assert.match(panel, /role and rubric bindings stay attached/);
});

test("integration panel handles missing client, loading, errors and empty data", () => {
  assert.match(panel, /if \(!client \|\| !teamId\)/);
  assert.match(panel, /Loading canonical links/);
  assert.match(panel, /role="alert"/);
  assert.match(panel, /No canonical evaluations/);
});

test("roadmap records the Phase 3.14 acceptance boundary", () => {
  assert.match(roadmap, /### 3\.14 Existing Module Integration/);
  assert.match(roadmap, /evaluation can be traced from player to canonical match\/session and back/);
});
