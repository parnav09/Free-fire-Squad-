import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [panel, css, app, scrims, training, analytics, player, roadmap, packageJson, workflow, phaseTwoNine, phaseThreeThirteen, phaseThreeTen, visualScript, visualFixture, sessionsWorkspace, sessionsCss] = await Promise.all([
  read("../src/components/CanonicalModuleIntegrationPanel.tsx"),
  read("../src/components/CanonicalModuleIntegrationPanel.css"),
  read("../src/App.tsx"),
  read("../src/components/ScrimsSection.tsx"),
  read("../src/components/PlanningTrainingCenter.tsx"),
  read("../src/components/AnalyticsSection.tsx"),
  read("../src/components/PlayerWeeklyInsights.tsx"),
  read("../docs/evolution/EVOLUTION-PHASE-3-ROADMAP-AND-CHECKPOINT.md"),
  read("../package.json").then(JSON.parse),
  read("../.github/workflows/evolution-phase-one.yml"),
  read("../supabase/migrations/20261120230000_evolution_phase_two_9_existing_module_integration.sql"),
  read("../supabase/migrations/20261122220000_evolution_phase_three_13_atomic_context_creation.sql"),
  read("../supabase/migrations/20261122200000_evolution_phase_three_10_score_snapshot_history.sql"),
  read("./run-evolution-phase-three-14-visual.mjs"),
  read("./phase-three-14-visual/main.tsx"),
  read("../src/components/CanonicalSessionsWorkspace.tsx"),
  read("../src/components/CanonicalSessionsWorkspace.css"),
]);

test("Phase 3.14 reads the canonical source, session, match, role, context and score chain", () => {
  for (const table of [
    "canonical_session_sources",
    "canonical_sessions",
    "canonical_session_matches",
    "canonical_session_match_roles",
    "evolution_evaluation_contexts",
    "evolution_player_score_snapshots",
  ]) assert.match(panel, new RegExp('from\\("' + table + '"\\)'));
  assert.match(panel, /scrim_record_id/);
  assert.match(panel, /tournament_cycle_id/);
  assert.match(panel, /training_session_id/);
  assert.match(phaseTwoNine, /integrate_canonical_source/);
});

test("historical role assignment resolves against the exact canonical match-role row", () => {
  assert.match(phaseThreeThirteen, /WHERE r\.id = p_role_assignment_id/);
  assert.match(phaseThreeThirteen, /r\.canonical_session_match_id = p_canonical_session_match_id/);
  assert.match(panel, /new Map\(roles\.map\(role => \[role\.id, role\]\)\)/);
  assert.match(panel, /roleById\.get\(context\.role_assignment_id\)/);
});

test("Scrims, Tournament and Training retain their server-authoritative adapter", () => {
  assert.match(scrims, /integrateCanonicalSource\(supabase,teamId,"scrim",saved\.id\)/);
  assert.match(app, /integrateCanonicalSource\(supabase!, teamSnapshot\.id, "tournament", cycle\.id\)/);
  assert.match(training, /integrateCanonicalSource\(supabase!,teamId,"training",created\.data\.id\)/);
});

test("Player and Analytics expose lineage while competitive and development score domains stay separate", () => {
  assert.match(app, /<CanonicalModuleIntegrationPanel[\s\S]*view="players"/);
  assert.match(app, /<CanonicalModuleIntegrationPanel[\s\S]*view="analytics"/);
  assert.match(panel, /Competitive results and internal player scores remain separate/);
  assert.match(panel, /never derives player performance from kills, placement, Booyah or tournament points/);
  assert.match(player, /LEGACY REVIEW DATA/);
  assert.match(analytics, /COMPETITIVE RESULTS · LEGACY VIEW/);
});

test("existing-source picker and canonical session ledger paginate all history", () => {
  assert.match(sessionsWorkspace, /const readAllRows = async/);
  assert.match(sessionsWorkspace, /\.range\(from,to\)/);
  assert.match(sessionsWorkspace, /const openLinkPicker/);
  assert.match(sessionsWorkspace, /training_sessions/);
  assert.doesNotMatch(sessionsWorkspace, /\.limit\(100\)/);
  assert.doesNotMatch(sessionsWorkspace, /\.limit\(250\)/);
  assert.match(sessionsCss, /\.canonical-session-list\{max-height:720px/);
  assert.match(sessionsCss, /\.canonical-source-list\{max-height:360px/);
});

test("source sessions include Training and archived history, even without an evaluation context", () => {
  assert.match(panel, /const sourceRows = useMemo/);
  assert.match(panel, /Linked source sessions/);
  assert.match(panel, /session\.archived_at/);
  assert.doesNotMatch(panel, /\.is\("archived_at", null\)/);
  assert.match(panel, /sourceRows\.map/);
  assert.match(panel, /Linked source sessions remain visible above/);
});

test("team-scoped reads paginate instead of silently truncating at fixed limits", () => {
  assert.match(panel, /const readAllRows = async/);
  assert.match(panel, /\.range\(from, to\)/);
  assert.match(panel, /\.eq\("team_id", teamId\)/);
  assert.doesNotMatch(panel, /\.limit\(/);
  assert.match(panel, /\.order\("id"/);
  assert.doesNotMatch(panel, /\.insert\(|\.update\(|\.delete\(/);
});

test("loading failures clear stale rows and expose a working retry action", () => {
  assert.match(panel, /setError\(errorText\(loadError\)\)/);
  assert.match(panel, /setSessions\(\[\]\); setSources\(\[\]\); setMatches\(\[\]\); setRoles\(\[\]\); setContexts\(\[\]\); setSnapshots\(\[\]\)/);
  assert.match(panel, /Retry loading canonical links/);
  assert.match(panel, /setRefreshVersion\(value => value \+ 1\)/);
  assert.match(panel, /role="alert"/);
  assert.match(panel, /role="status"/);
  assert.match(css, /\.canonical-trace-retry\{[^}]*min-height:44px/);
  assert.match(css, /@media\(max-width:520px\)/);
});

test("historical player and score snapshots are rendered without recalculating competitive results", () => {
  assert.match(panel, /Historical player/);
  assert.match(panel, /Former member/);
  assert.match(panel, /Rows arrive newest-first/);
  assert.match(panel, /score_status === "insufficient"/);
  assert.match(panel, /coverage_percent/);
});


test("responsive browser harness covers pagination, mobile layout, retry and member RLS", () => {
  assert.equal(packageJson.scripts["test:evolution-phase-three-14-visual"], "node scripts/run-evolution-phase-three-14-visual.mjs");
  assert.match(workflow, /Verify Evolution Phase Three\.14 responsive browser acceptance/);
  assert.match(workflow, /evolution-phase-three-14-responsive-screenshots/);
  assert.match(visualScript, /502, viewport\.name/);
  assert.match(visualScript, /member-visible evaluation lineage/);
  assert.match(visualFixture, /mode === "member"/);
  assert.match(visualFixture, /permission denied by row-level security policy/);
  assert.match(visualFixture, /rangeCalls/);
});

test("staff-only score snapshot RLS does not hide member-visible source lineage", () => {
  assert.match(phaseThreeTen, /membership_role IN \('owner','coach'\)/);
  assert.match(panel, /const snapshotRequest = readAllRows/);
  assert.match(panel, /\.catch\(snapshotError/);
  assert.match(panel, /Score snapshots are restricted to active Owners and Coaches/);
  assert.match(panel, /source and evaluation lineage remain available/);
  assert.match(panel, /role="note"/);
});

test("Phase 3.14 is part of the normal production build and workflow", () => {
  assert.equal(packageJson.scripts["test:evolution-phase-three-14"], "node --test scripts/verify-evolution-phase-three-14.mjs");
  assert.match(packageJson.scripts.build, /test:evolution-phase-three-13 && npm run test:evolution-phase-three-14 && npm run test:evolution-phase-three-15 && vite build/);
  assert.match(workflow, /Phase Three\.14 existing module integration contracts/);
  assert.match(workflow, /Phase Three\.1–3\.15 Final Acceptance/);
});

test("roadmap records the Phase 3.14 acceptance boundary", () => {
  assert.match(roadmap, /### 3\.14 Existing Module Integration/);
  assert.match(roadmap, /evaluation can be traced from player to canonical match\/session and back/);
});
