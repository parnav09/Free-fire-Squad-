import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const [migration, harness, report, blueprint, packageText, workflow, parentReport] = await Promise.all([
  read("supabase/migrations/20261120200000_evolution_phase_two_7_substitution_tracking.sql"),
  read("scripts/verify-evolution-phase-two-7-db.sh"),
  read("docs/evolution/PHASE-2-7-SUBSTITUTION-TRACKING.md"),
  read("docs/evolution-version-2.md"),
  read("package.json"),
  read(".github/workflows/evolution-phase-one.yml"),
  read("docs/evolution/PHASE-2-6-ROLE-SNAPSHOT.md"),
]);
const pkg = JSON.parse(packageText);

test("Point 2.7 implements the exact substitution-tracking blueprint point", () => {
  assert.match(blueprint, /38\.7 Point 2\.7 — Substitution Tracking/);
  assert.match(blueprint, /Record outgoing and incoming player identities/);
  assert.match(blueprint, /Capture role transfer or role reassignment separately/);
  assert.match(report, /Point 2\.7 — Substitution Tracking/);
  assert.match(parentReport, /Point 2\.6 — Role Snapshot/);
});

test("Substitution event preserves both player identities and canonical match/session context", () => {
  assert.match(migration, /canonical_session_substitutions/);
  assert.match(migration, /outgoing_player_user_id uuid NOT NULL/);
  assert.match(migration, /incoming_player_user_id uuid NOT NULL/);
  assert.match(migration, /canonical_session_match_id uuid NOT NULL/);
  assert.match(migration, /canonical_session_id uuid NOT NULL/);
  assert.match(migration, /effective_round_label text/);
  assert.match(migration, /source_provenance text NOT NULL/);
  assert.match(migration, /lineup_before jsonb NOT NULL/);
  assert.match(migration, /lineup_after jsonb NOT NULL/);
});

test("Substitution is atomic and uses existing canonical participation RPCs", () => {
  assert.match(migration, /record_canonical_session_substitution/);
  assert.match(migration, /correct_canonical_match_participation\(/);
  assert.match(migration, /record_canonical_match_participation\(/);
  assert.match(migration, /canonical_session_substitution_outgoing_must_be_active/);
  assert.match(migration, /canonical_session_substitution_incoming_already_active/);
  assert.match(migration, /canonical_session_substitution_requires_active_session/);
  assert.match(harness, /Substitution test did not mark outgoing player substituted/);
  assert.match(harness, /Substitution test did not mark incoming player participated/);
});

test("Substitution order, effective context and idempotency are enforced", () => {
  assert.match(migration, /sequence_no integer NOT NULL/);
  assert.match(migration, /canonical_session_substitutions_sequence_unique/);
  assert.match(migration, /canonical_session_substitution_effective_time_out_of_order/);
  assert.match(migration, /canonical_session_substitution_idempotency_conflict/);
  assert.match(harness, /Substitution exact retry returned a different event/);
  assert.match(harness, /Substitution idempotency conflict was accepted/);
  assert.match(harness, /Expected two ordered substitution events/);
});

test("Role transfer is an explicit, separately audited event", () => {
  assert.match(migration, /canonical_session_substitution_role_transfers/);
  assert.match(migration, /role_transfer_requested boolean NOT NULL/);
  assert.match(migration, /set_canonical_session_match_role\(/);
  assert.match(migration, /role_change_event_id uuid NOT NULL/);
  assert.match(migration, /canonical_session_substitution_role_transfer_source_unassigned/);
  assert.match(report, /Role transfer is opt-in and separate from replacement/);
  assert.match(harness, /Role transfer was not recorded separately/);
  assert.match(harness, /Incoming player did not receive the transferred role/);
});

test("Before/after snapshots reconstruct the lineup at requested times", () => {
  assert.match(migration, /get_canonical_session_match_lineup/);
  assert.match(migration, /reported_effective_at timestamptz NOT NULL/);
  assert.match(harness, /Lineup before first substitution was not reconstructable/);
  assert.match(harness, /Lineup after first substitution was not reconstructable/);
  assert.match(harness, /Lineup after second substitution was not reconstructable/);
});

test("Team authorization, RLS, append-only protection and direct-write denial are enforced", () => {
  assert.match(migration, /active_owner_or_coach_required/);
  assert.match(migration, /canonical_session_substitutions_staff_read/);
  assert.match(migration, /canonical_session_substitution_role_transfers_staff_read/);
  assert.match(migration, /REVOKE INSERT, UPDATE, DELETE ON public\.canonical_session_substitutions/);
  assert.match(migration, /canonical_session_substitution_is_append_only_rpc_required/);
  assert.match(harness, /Player was allowed to record a substitution/);
  assert.match(harness, /Player can read staff-only substitution audit/);
  assert.match(harness, /Cross-team substitution visibility leaked/);
  assert.match(harness, /Direct substitution update was accepted/);
});

test("The Phase 2.7 PostgreSQL and source-contract checks are part of exact-head CI/build", () => {
  assert.equal(pkg.scripts["test:evolution-phase-two-7"], "node --test scripts/verify-evolution-phase-two-7.mjs");
  assert.ok(pkg.scripts.build.includes("npm run test:evolution-phase-two-7"));
  assert.match(workflow, /feat\/evolution-phase-two-7-substitution-tracking/);
  assert.match(workflow, /verify-evolution-phase-two-7-db\.sh/);
  assert.match(harness, /Evolution Phase Two\.7 PostgreSQL integration PASS/);
});

test("Point 2.7 does not absorb Point 2.8 or production rollout", () => {
  assert.match(report, /Point 2\.8/);
  assert.match(report, /Point 2\.9/);
  assert.match(report, /No live Supabase migration/);
  assert.match(report, /Vercel/);
  assert.match(blueprint, /No production migration\/deployment occurs without separate rollout approval/i);
});
