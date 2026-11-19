import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const [migration, harness, report, blueprint, packageText, workflow, parentReport] = await Promise.all([
  read("supabase/migrations/20261119200000_evolution_phase_two_6_role_snapshot.sql"),
  read("scripts/verify-evolution-phase-two-6-db.sh"),
  read("docs/evolution/PHASE-2-6-ROLE-SNAPSHOT.md"),
  read("docs/evolution-version-2.md"),
  read("package.json"),
  read(".github/workflows/evolution-phase-one.yml"),
  read("docs/evolution/PHASE-2-5-SESSION-ROSTER-SNAPSHOT.md"),
]);
const pkg = JSON.parse(packageText);

test("Point 2.6 maps only to the versioned Role Snapshot blueprint contract", () => {
  assert.match(blueprint, /38\.6 Point 2\.6 — Role Snapshot/);
  assert.match(blueprint, /Snapshot role ID\/name and role-definition version at session or match lock/);
  assert.match(blueprint, /Permit a player to perform different roles in different matches/);
  assert.match(blueprint, /Record role changes with effective match\/time context/);
  assert.match(report, /Point 2\.6 — Role Snapshot/);
  assert.match(parentReport, /Point 2\.5 — Session Roster Snapshot/);
});

test("Role taxonomy imports only explicit team role labels and versions every definition change", () => {
  assert.match(migration, /canonical_team_role_definitions/);
  assert.match(migration, /definition_version integer NOT NULL/);
  assert.match(migration, /definition_source text NOT NULL/);
  assert.match(migration, /FROM public\.team_members/);
  assert.match(migration, /lower\(btrim\(assigned_role\)\)/);
  assert.match(migration, /save_canonical_team_role_definition/);
  assert.match(migration, /canonical_team_role_definition_events/);
  assert.match(migration, /canonical_team_role_definition_idempotency_conflict/);
  assert.match(migration, /v_version := v_current\.definition_version \+ 1/);
  assert.match(report, /imports only exact, explicitly assigned role labels/i);
  assert.match(report, /does not infer roles from P1\/P2\/P3\/P4 player slots/i);
});

test("Session roster roles are immutable ID/name/version snapshots with explicit unknown handling", () => {
  assert.match(migration, /role_definition_id_snapshot uuid/);
  assert.match(migration, /role_key_snapshot text/);
  assert.match(migration, /role_name_snapshot text/);
  assert.match(migration, /role_definition_version_snapshot integer/);
  assert.match(migration, /role_assignment_status_snapshot text NOT NULL DEFAULT 'unknown'/);
  assert.match(migration, /snapshot_canonical_session_roster_member_role/);
  assert.match(migration, /role_assignment_status_snapshot := 'unknown'/);
  assert.match(migration, /role_assignment_status_snapshot := 'unmapped'/);
  assert.doesNotMatch(migration, /UPDATE public\.canonical_session_roster_members[\s\S]*?role_definition_id_snapshot\s*=/);
  assert.match(harness, /fabricated historical session role snapshots/);
  assert.match(harness, /Role definition edit rewrote an existing session snapshot/);
  assert.match(report, /No historical session or match role snapshots are backfilled/);
});

test("Each participating player receives a match-specific role snapshot", () => {
  assert.match(migration, /canonical_session_match_roles/);
  assert.match(migration, /UNIQUE \(canonical_session_match_id, player_user_id\)/);
  assert.match(migration, /assignment_source IN \('session_snapshot','manual'\)/);
  assert.match(migration, /AFTER INSERT OR UPDATE OF participation_status ON public\.canonical_session_match_participants/);
  assert.match(migration, /canonical_session_match_role_snapshot/);
  assert.match(harness, /Changing match one rewrote the player role in match two/);
  assert.match(harness, /Attendance correction confirms actual participation/);
  assert.match(report, /different roles in different matches/i);
});

test("Match role changes preserve prior/new values and effective match/round/time context", () => {
  assert.match(migration, /set_canonical_session_match_role/);
  assert.match(migration, /effective_at timestamptz NOT NULL/);
  assert.match(migration, /effective_round_label text/);
  assert.match(migration, /previous_role_definition_id/);
  assert.match(migration, /new_role_definition_id/);
  assert.match(migration, /canonical_session_match_role_events/);
  assert.match(migration, /canonical_session_match_role_effective_time_outside_session/);
  assert.match(migration, /canonical_session_match_role_requires_active_session/);
  assert.match(harness, /Role change audit did not preserve prior\/new role and effective context/);
  assert.match(harness, /Role change idempotency key accepted a changed payload/);
  assert.match(harness, /Closed-session role change was accepted/);
});

test("Unknown and unmapped roles remain explicit instead of being guessed", () => {
  assert.match(migration, /role_assignment_status IN \('assigned','unknown','unmapped','retired'\)/);
  assert.match(migration, /role_assignment_status_snapshot = 'unknown'/);
  assert.match(migration, /role_assignment_status_snapshot = 'unmapped'/);
  assert.match(harness, /Unassigned role was not preserved as explicitly unknown/);
  assert.match(harness, /Unmapped legacy role label was guessed or lost/);
  assert.match(harness, /Unknown role was not propagated to the match snapshot/);
  assert.match(harness, /Unmapped role was not propagated to the match snapshot/);
});

test("Team-scoped RLS, staff authorization and direct-write denial protect role data", () => {
  assert.match(migration, /canonical_team_role_definitions_team_read/);
  assert.match(migration, /canonical_team_role_definition_events_staff_read/);
  assert.match(migration, /canonical_session_match_roles_team_read/);
  assert.match(migration, /canonical_session_match_role_events_staff_read/);
  assert.match(migration, /active_owner_or_coach_required/);
  assert.match(migration, /REVOKE INSERT, UPDATE, DELETE ON public\.canonical_team_role_definitions/);
  assert.match(migration, /REVOKE ALL ON FUNCTION evolution_private\.guard_canonical_team_role_definition/);
  assert.match(harness, /Player role unexpectedly changed a teammate match role/);
  assert.match(harness, /Cross-team role taxonomy visibility leaked/);
  assert.match(harness, /Direct match role update bypassed the role RPC/);
  assert.match(harness, /API role can directly execute a private role trigger function/);
});

test("Role history is append-only and protected trigger functions are not client-callable", () => {
  assert.match(migration, /canonical_session_match_role_events_idempotency_unique/);
  assert.match(migration, /canonical_team_role_definition_events_idempotency_unique/);
  assert.match(migration, /canonical_session_match_role_is_non_destructive/);
  assert.match(migration, /canonical_team_role_definition_is_non_destructive/);
  assert.match(migration, /GRANT SELECT ON public\.canonical_team_role_definition_events/);
  assert.match(migration, /GRANT SELECT ON public\.canonical_session_match_role_events/);
  assert.match(harness, /Direct role audit deletion was accepted/);
  assert.match(harness, /Direct role writes changed append-only audit/);
});

test("The Phase 2.6 PostgreSQL integration and source audit are part of exact-head CI/build", () => {
  assert.equal(pkg.scripts["test:evolution-phase-two-6"], "node --test scripts/verify-evolution-phase-two-6.mjs");
  assert.ok(pkg.scripts.build.includes("npm run test:evolution-phase-two-6"));
  assert.match(workflow, /feat\/evolution-phase-two-6-role-snapshot/);
  assert.match(workflow, /verify-evolution-phase-two-6-db\.sh/);
  assert.match(harness, /Evolution Phase Two\.6 PostgreSQL integration PASS/);
});

test("Point 2.6 does not absorb Point 2.7 or production rollout", () => {
  assert.match(report, /Substitution identity and incoming\/outgoing linkage remain Point 2\.7/);
  assert.match(report, /Point 2\.9/);
  assert.match(report, /No live Supabase migration/);
  assert.match(report, /No Vercel production deployment/);
  assert.match(blueprint, /No production migration\/deployment occurs without separate rollout approval/i);
});
