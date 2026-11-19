import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Phase 2.9 exposes one server-authoritative, idempotent source adapter", async () => {
  const sql = await read("../supabase/migrations/20261120230000_evolution_phase_two_9_existing_module_integration.sql");
  assert.match(sql, /FUNCTION public\.integrate_canonical_source\(\s*p_team_id uuid,\s*p_source_system text,\s*p_source_record_id uuid/s);
  assert.match(sql, /SECURITY INVOKER/);
  assert.match(sql, /FOR UPDATE/);
  assert.match(sql, /canonical_session_sources/);
  assert.match(sql, /md5\([\s\S]*p_team_id::text[\s\S]*p_source_system[\s\S]*p_source_record_id::text[\s\S]*\)::uuid/);
  assert.match(sql, /sync_canonical_session_matches\(v_session\.id\)/);
  assert.match(sql, /p_source_system IN \('scrim','tournament'\)/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.integrate_canonical_source/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.integrate_canonical_source[\s\S]*TO authenticated/);
});

test("Scrims, Tournament and Training use the shared canonical adapter", async () => {
  const [scrims, app, training, adapter] = await Promise.all([
    read("../src/components/ScrimsSection.tsx"),
    read("../src/App.tsx"),
    read("../src/components/PlanningTrainingCenter.tsx"),
    read("../src/lib/canonical-module-integration.ts"),
  ]);
  assert.match(scrims, /integrateCanonicalSource\(supabase,teamId,"scrim",saved\.id\)/);
  assert.match(scrims, /Link canonical ID/);
  assert.match(app, /integrateCanonicalSource\(supabase!, teamSnapshot\.id, "tournament", cycle\.id\)/);
  assert.match(app, /linkCurrentTournamentCycle/);
  assert.match(training, /integrateCanonicalSource\(supabase!,teamId,"training",created\.data\.id\)/);
  assert.match(training, /promotePlanToTraining/);
  assert.match(training, /Link canonical ID/);
  assert.match(adapter, /client\.rpc\("integrate_canonical_source"/);
  assert.match(adapter, /canonicalSessionId/);
  assert.match(adapter, /PGRST202/);
});

test("Planning remains a plan until explicit Training promotion", async () => {
  const training = await read("../src/components/PlanningTrainingCenter.tsx");
  assert.match(training, /Promote to Training/);
  assert.match(training, /plan_id:plan\.id/);
  assert.match(training, /sessions\.some\(session=>session\.plan_id===plan\.id\)/);
  assert.doesNotMatch(training, /integrateCanonicalSource\([^\n]*"planning"/);
});

test("Legacy module records are not destructively rewritten by the adapter", async () => {
  const sql = await read("../supabase/migrations/20261120230000_evolution_phase_two_9_existing_module_integration.sql");
  assert.doesNotMatch(sql, /\bDELETE\s+FROM\s+public\.(scrim_records|tournament_cycles|tournament_matches|training_sessions|practice_plans)/i);
  assert.doesNotMatch(sql, /\bUPDATE\s+public\.(scrim_records|tournament_cycles|tournament_matches|training_sessions|practice_plans)/i);
});
