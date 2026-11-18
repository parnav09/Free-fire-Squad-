import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const [report, app, scrims, planning, tournamentSql, planningSql, participantSql, scrimSql, tokens, scrimsCss, planningCss, pkgText, workflow] = await Promise.all([
  read("docs/evolution/PHASE-2-1-EXISTING-SYSTEM-AUDIT.md"),
  read("src/App.tsx"),
  read("src/components/ScrimsSection.tsx"),
  read("src/components/PlanningTrainingCenter.tsx"),
  read("supabase/migrations/20261107130445_weekly_tournament_cycles_and_matches.sql"),
  read("supabase/migrations/20261108170059_phase_2_3_planning_training.sql"),
  read("supabase/migrations/20261108170923_phase_2_3_session_participants.sql"),
  read("supabase/migrations/20261110181415_scrims_personal_team_review.sql"),
  read("src/styles/tokens.css"),
  read("src/components/ScrimsSection.css"),
  read("src/components/PlanningTrainingCenter.ux.css"),
  read("package.json"),
  read(".github/workflows/evolution-phase-one.yml"),
]);
const pkg = JSON.parse(pkgText);

test("Phase 2.1 is an audit-only point; no feature UI or production schema mutation is claimed", () => {
  assert.match(report, /Point 2\.1 is a discovery\/audit point/);
  assert.match(report, /No new screen, schema, migration, data write, policy change, merge, or deployment/);
  assert.match(report, /No new UI is required or authorized by Point 2\.1/);
  assert.match(report, /Point 2\.1 exit decision/);
});

test("Tournament UI and schema source are mapped", () => {
  assert.match(app, /from\("tournament_cycles"\)/);
  assert.match(app, /from\("tournament_matches"\)/);
  assert.match(app, /onConflict: "cycle_id,match_day,match_number"/);
  assert.match(tournamentSql, /unique\(team_id,cycle_start\)/i);
  assert.match(tournamentSql, /unique\(cycle_id,match_day,match_number\)/i);
  assert.match(report, /tournament_cycles/);
  assert.match(report, /tournament_matches/);
});

test("Scrims use a separate parent record with embedded JSONB matches and team reviews", () => {
  assert.match(scrims, /from\("scrim_records"\)/);
  assert.match(scrims, /from\("scrim_team_reviews"\)/);
  assert.match(scrimSql, /matches jsonb not null default '\[\]'::jsonb/i);
  assert.match(scrimSql, /unique\(team_id,owner_id,scrim_date\)/i);
  assert.match(report, /embedded JSONB array/);
});

test("Planning and Training callers and relationships are mapped", () => {
  for (const table of ["practice_plans", "practice_plan_blocks", "practice_tasks", "training_sessions", "training_session_participants", "training_results", "training_drills"]) {
    assert.ok(planning.includes(`from("${table}")`), `Missing Planning/Training caller for ${table}`);
  }
  assert.match(planningSql, /create table if not exists public\.training_sessions/i);
  assert.match(participantSql, /unique\(session_id,player_member_id\)/i);
  assert.match(report, /training_session_participants/);
});

test("Audit records identity, same-team constraint, snapshot and lifecycle gaps", () => {
  assert.match(report, /No shared canonical session identity/);
  assert.match(report, /composite team-scoped relationships/);
  assert.match(report, /historical role snapshot/);
  assert.match(report, /No substitution event table/);
  assert.match(report, /append-only correction history/);
  assert.match(report, /EV2-2\.1-01/);
  assert.match(report, /EV2-2\.1-10/);
});

test("Existing premium UI tokens and module-specific color treatments are preserved", () => {
  assert.match(tokens, /--brand-onyx-950:\s*#05060b/i);
  assert.match(tokens, /--brand-cyan-400:\s*#70d8ed/i);
  assert.match(tokens, /--brand-violet-400:\s*#9b86f4/i);
  assert.match(scrimsCss, /--sc-bg:#080c16/);
  assert.match(scrimsCss, /scrims-gold/);
  assert.match(planningCss, /--pt-bg:#070b14/);
  assert.match(planningCss, /linear-gradient\(135deg,#16365b,#20204a\)/);
  assert.match(report, /They should not be flattened into identical cards/);
});

test("Current live audit snapshot and zero-result integrity checks are documented", () => {
  for (const text of ["630", "420 draft", "210 scheduled", "102", "PostgreSQL 17.11.0.011"]) {
    assert.ok(report.includes(text), `Missing audit evidence: ${text}`);
  }
  assert.match(report, /zero current violations/);
  assert.match(report, /not proof that future writes cannot create a mismatch/);
});

test("Phase 2.1 audit contract runs in the standard build and its branch CI", () => {
  assert.equal(pkg.scripts["test:evolution-phase-two-1"], "node --test scripts/verify-evolution-phase-two-1.mjs");
  assert.ok(pkg.scripts.build.includes("npm run test:evolution-phase-two-1"));
  assert.match(workflow, /feat\/evolution-phase-two-session-foundation/);
  assert.match(workflow, /feat\/evolution-phase-one-identity-timezone/);
});
