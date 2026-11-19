import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const [migration, harness, report, blueprint, packageText, workflow, parentReport] = await Promise.all([
  read("supabase/migrations/20261119180000_evolution_phase_two_5_session_roster_snapshot.sql"),
  read("scripts/verify-evolution-phase-two-5-db.sh"),
  read("docs/evolution/PHASE-2-5-SESSION-ROSTER-SNAPSHOT.md"),
  read("docs/evolution-version-2.md"),
  read("package.json"),
  read(".github/workflows/evolution-phase-one.yml"),
  read("docs/evolution/PHASE-2-4-SESSION-LIFECYCLE.md"),
]);
const pkg = JSON.parse(packageText);

test("Point 2.5 maps only to the Session Roster Snapshot blueprint contract", () => {
  assert.match(blueprint, /38\.5 Point 2\.5 — Session Roster Snapshot/);
  assert.match(blueprint, /Snapshot eligible team members at session creation or roster lock/);
  assert.match(blueprint, /Record actual participation per match where the source supports it/);
  assert.match(report, /Point 2\.5 — Session Roster Snapshot/);
  assert.match(parentReport, /does not introduce roster, role, substitution/i);
});

test("The migration is additive and does not fabricate historical rosters", () => {
  assert.match(migration, /Additive only\. No historical roster\/participation is inferred/);
  assert.doesNotMatch(migration, /INSERT INTO public\.canonical_session_rosters\s+SELECT/i);
  assert.match(report, /No automatic historical roster backfill/);
  assert.match(harness, /fabricated historical roster snapshots/);
});

test("Roster identity preserves player UUID and membership provenance without live membership FKs", () => {
  assert.match(migration, /membership_id_snapshot uuid NOT NULL/);
  assert.match(migration, /player_user_id uuid NOT NULL/);
  assert.match(migration, /display_name_snapshot text NOT NULL/);
  assert.match(migration, /player_number_snapshot smallint/);
  assert.match(migration, /membership_role_snapshot text NOT NULL/);
  assert.match(migration, /UNIQUE \(canonical_session_id, player_user_id\)/);
  assert.match(report, /no FK to team_members\/auth\.users/i);
  assert.match(harness, /Historical roster changed after member leave/);
  assert.match(harness, /Historical roster changed after IGN\/slot edit/);
});

test("Team roster capacity and session-type constraints are configurable and snapshotted", () => {
  assert.match(migration, /canonical_session_roster_policies/);
  assert.match(migration, /minimum_players smallint/);
  assert.match(migration, /maximum_players smallint/);
  assert.match(migration, /require_full_roster boolean/);
  assert.match(migration, /capacity_snapshot smallint/);
  assert.match(migration, /minimum_players_snapshot smallint/);
  assert.match(migration, /maximum_players_snapshot smallint/);
  assert.match(migration, /configure_canonical_session_roster_policy/);
  assert.match(harness, /'training',1,1,true/);
  assert.match(harness, /'scrim',2,3,false/);
});

test("Roster locking captures every eligible active player and supports invited, selected and confirmed states", () => {
  assert.match(migration, /lock_canonical_session_roster/);
  for (const state of ["available", "invited", "selected", "confirmed"]) {
    assert.match(migration, new RegExp(state));
  }
  assert.match(migration, /roster_snapshot_requires_draft_or_scheduled_session/);
  assert.match(migration, /duplicate_roster_membership_id/);
  assert.match(migration, /roster_member_cannot_be_selected_and_invited/);
  assert.match(migration, /roster_members_must_be_active_eligible_team_members/);
  assert.match(migration, /canonical_session_roster_already_locked/);
  assert.match(harness, /Expected all three eligible members to be snapshotted/);
  assert.match(harness, /Changed payload reused a roster snapshot idempotency key/);
});

test("Roster selection status transitions are guarded, idempotent and audited", () => {
  assert.match(migration, /set_canonical_session_roster_member_status/);
  assert.match(migration, /invalid_roster_selection_transition/);
  assert.match(migration, /roster_status_idempotency_key_reused_with_different_payload/);
  assert.match(migration, /canonical_session_roster_member_events/);
  assert.match(migration, /canonical_session_roster_status_rpc_required/);
  assert.match(harness, /Invalid roster status transition was accepted/);
  assert.match(harness, /Expected 3 snapshot events \+ 2 selection events/);
});

test("Actual participation is recorded once per player per canonical match", () => {
  assert.match(migration, /canonical_session_match_participants/);
  assert.match(migration, /UNIQUE \(canonical_session_match_id, player_user_id\)/);
  assert.match(migration, /participation_status IN \('participated','absent','substituted'\)/);
  assert.match(migration, /record_canonical_match_participation/);
  assert.match(migration, /correct_canonical_match_participation/);
  assert.match(migration, /match_participant_must_be_selected_or_confirmed/);
  assert.match(migration, /match_participation_already_recorded_use_correction_rpc/);
  assert.match(harness, /Duplicate participant rows were created/);
  assert.match(harness, /Second participant state for the same player\/match was accepted/);
  assert.match(harness, /Participation audit event count mismatch/);
});

test("Participant corrections are reasoned, idempotent and append-only audited", () => {
  assert.match(migration, /canonical_session_match_participation_events/);
  assert.match(migration, /participation_idempotency_key_reused_with_different_payload/);
  assert.match(migration, /closed_session_participation_is_read_only/);
  assert.match(migration, /canonical_match_participation_correction_rpc_required/);
  assert.match(report, /Substitution linkage itself remains Point 2\.7/);
  assert.match(harness, /Player was replaced before match start/);
});

test("Team RLS and role checks prevent player writes and cross-team roster disclosure", () => {
  assert.match(migration, /canonical_session_roster_members_team_read/);
  assert.match(migration, /canonical_session_roster_members_staff_insert/);
  assert.match(migration, /canonical_session_match_participants_staff_insert/);
  assert.match(migration, /active_owner_or_coach_required/);
  assert.match(harness, /Player role unexpectedly recorded participation/);
  assert.match(harness, /Cross-team roster snapshot visibility leaked/);
  assert.match(harness, /Cross-team participation visibility leaked/);
});

test("Historical roster and participation audit cannot be directly mutated or deleted", () => {
  assert.match(migration, /REVOKE INSERT, UPDATE, DELETE ON public\.canonical_session_roster_member_events/);
  assert.match(migration, /REVOKE INSERT, UPDATE, DELETE ON public\.canonical_session_match_participation_events/);
  assert.match(migration, /REVOKE DELETE ON public\.canonical_session_rosters/);
  assert.match(migration, /evolution_private\.guard_canonical_session_roster_member/);
  assert.match(migration, /evolution_private\.audit_canonical_session_roster_member/);
  assert.match(migration, /evolution_private\.guard_canonical_session_match_participant/);
  assert.match(migration, /evolution_private\.audit_canonical_session_match_participation/);
  assert.match(harness, /API role can directly execute a private roster trigger function/);
  assert.match(harness, /Direct roster status update bypassed the RPC/);
});

test("The Phase 2.5 PostgreSQL integration and source audit are part of exact-head CI/build", () => {
  assert.equal(pkg.scripts["test:evolution-phase-two-5"], "node --test scripts/verify-evolution-phase-two-5.mjs");
  assert.ok(pkg.scripts.build.includes("npm run test:evolution-phase-two-5"));
  assert.match(workflow, /feat\/evolution-phase-two-5-session-roster-snapshot/);
  assert.match(workflow, /verify-evolution-phase-two-5-db\.sh/);
  assert.match(harness, /Evolution Phase Two\.5 PostgreSQL integration PASS/);
});

test("Production rollout remains gated on Point 2.9 and separate approval", () => {
  assert.match(report, /No production Supabase migration or Vercel deployment/);
  assert.match(report, /Point 2\.9/);
  assert.match(blueprint, /No production migration\/deployment occurs without separate rollout approval/i);
});
