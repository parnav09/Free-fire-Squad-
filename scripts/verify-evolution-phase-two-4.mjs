import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const [migration, harness, report, blueprint, packageText, workflow] = await Promise.all([
  read("supabase/migrations/20261119160000_evolution_phase_two_4_session_lifecycle.sql"),
  read("scripts/verify-evolution-phase-two-4-db.sh"),
  read("docs/evolution/PHASE-2-4-SESSION-LIFECYCLE.md"),
  read("docs/evolution-version-2.md"),
  read("package.json"),
  read(".github/workflows/evolution-phase-one.yml"),
]);
const pkg = JSON.parse(packageText);

test("Point 2.4 is scoped to the canonical lifecycle and does not change source-module workflows", () => {
  assert.match(blueprint, /38\.4 Point 2\.4 — Session Lifecycle/);
  assert.match(blueprint, /Draft → Scheduled → In Progress → Awaiting Results → Verified → Closed → Archived/);
  assert.match(report, /Scope boundary/i);
  assert.match(report, /does not rewrite Scrims, Tournament or Training source rows/i);
});

test("Existing canonical sessions are non-destructively initialized to Draft", () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'draft'/i);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS lifecycle_version integer NOT NULL DEFAULT 0/i);
  assert.match(migration, /canonical_sessions_lifecycle_status_check/);
  assert.match(harness, /Existing canonical sessions were not conservatively initialized to Draft/);
});

test("Lifecycle state transitions are constrained and server-side guarded", () => {
  for (const edge of [
    "OLD.lifecycle_status = 'draft' AND NEW.lifecycle_status = 'scheduled'",
    "OLD.lifecycle_status = 'scheduled' AND NEW.lifecycle_status = 'in_progress'",
    "OLD.lifecycle_status = 'in_progress' AND NEW.lifecycle_status = 'awaiting_results'",
    "OLD.lifecycle_status = 'awaiting_results' AND NEW.lifecycle_status = 'verified'",
    "OLD.lifecycle_status = 'verified' AND NEW.lifecycle_status = 'closed'",
    "OLD.lifecycle_status IN ('closed','cancelled') AND NEW.lifecycle_status = 'archived'",
  ]) assert.ok(migration.includes(edge), `Missing lifecycle edge: ${edge}`);
  assert.match(migration, /canonical_session_lifecycle_rpc_required/);
  assert.match(migration, /invalid_canonical_session_transition/);
  assert.match(harness, /Draft skipped Scheduled and entered In Progress/);
});

test("Transitions require active Owner/Coach authorization and optimistic concurrency", () => {
  assert.match(migration, /active_owner_or_coach_required/);
  assert.match(migration, /canonical_session_lifecycle_version_conflict/);
  assert.match(migration, /FOR UPDATE/);
  assert.match(migration, /SECURITY INVOKER/);
  assert.match(harness, /Player unexpectedly transitioned a canonical session/);
});

test("Every transition records database timestamps and actor identity", () => {
  for (const field of [
    "lifecycle_scheduled_at", "lifecycle_scheduled_by", "started_at", "started_by",
    "awaiting_results_at", "awaiting_results_by", "results_verified_at", "results_verified_by",
    "closed_at", "closed_by", "cancelled_at", "cancelled_by",
  ]) assert.match(migration, new RegExp(field, "i"));
  assert.match(migration, /clock_timestamp\(\)/i);
  assert.match(migration, /canonical_session_lifecycle_events/);
  assert.match(harness, /timestamp\/actor missing/);
});

test("Verification requires an immutable result-submission receipt and closure requires verification", () => {
  assert.match(migration, /session_results_submission_required_before_verification/);
  assert.match(migration, /verified_results_required_before_closure/);
  assert.match(migration, /submit_canonical_session_results/);
  assert.match(migration, /canonical_session_result_submission_one_per_session/);
  assert.match(harness, /Verification without a result submission was accepted/);
  assert.match(harness, /Verified skipped Closed and entered Archived/);
});

test("Lifecycle retries are idempotent and changed payload reuse is rejected", () => {
  assert.match(migration, /lifecycle_idempotency_key_reused_with_different_payload/);
  assert.match(migration, /session_results_already_submitted_with_different_key/);
  assert.match(migration, /canonical_session_lifecycle_event_idempotency_unique/);
  assert.match(harness, /Transition retry created a duplicate event/);
  assert.match(harness, /Same result submission key was not idempotent/);
});

test("Cancellation and no-show are explicit terminal paths and do not fabricate played matches", () => {
  assert.match(migration, /cancellation_reason_code IN \('cancelled','no_show','other'\)/);
  assert.match(migration, /no_show_requires_scheduled_session/);
  assert.match(migration, /NEW.lifecycle_status = 'cancelled'/);
  assert.match(harness, /No-show cancellation fabricated a played match/);
  assert.match(harness, /No-show reason was not preserved in the append-only event/);
});

test("Reopening is restricted to an audited correction RPC", () => {
  assert.match(migration, /public\.reopen_canonical_session/);
  assert.match(migration, /OLD.lifecycle_status = 'closed' AND NEW.lifecycle_status = 'verified'/);
  assert.match(migration, /OLD.lifecycle_status = 'archived' AND NEW.lifecycle_status = 'closed'/);
  assert.match(migration, /event_kind <> 'reopen'/);
  assert.match(harness, /Reopen correction audit event missing/);
});

test("Lifecycle audit is append-only, team-scoped and protected from direct API writes", () => {
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /canonical_session_lifecycle_events_staff_read/);
  assert.match(migration, /REVOKE INSERT, UPDATE, DELETE ON public\.canonical_session_lifecycle_events FROM anon, authenticated/);
  assert.match(migration, /evolution_private\.guard_canonical_session_lifecycle/);
  assert.match(migration, /evolution_private\.audit_canonical_session_lifecycle/);
  assert.match(migration, /SET search_path = ''/);
  assert.match(harness, /Cross-team lifecycle audit visibility leaked/);
  assert.match(harness, /Authenticated role can delete lifecycle audit events/);
});

test("The Phase 2.4 PostgreSQL integration is wired into the standard build and exact CI workflow", () => {
  assert.equal(pkg.scripts["test:evolution-phase-two-4"], "node --test scripts/verify-evolution-phase-two-4.mjs");
  assert.ok(pkg.scripts.build.includes("npm run test:evolution-phase-two-4"));
  assert.match(workflow, /feat\/evolution-phase-two-4-session-lifecycle/);
  assert.match(workflow, /verify-evolution-phase-two-4-db\.sh/);
  assert.match(harness, /Evolution Phase Two\.4 PostgreSQL integration PASS/);
});

test("Production rollout remains explicitly blocked pending Point 2.9", () => {
  assert.match(report, /not applied to live Supabase/i);
  assert.match(report, /Point 2\.9/i);
  assert.match(report, /No production backfill or Vercel deployment/i);
  assert.match(blueprint, /Production rollout remains gated on Point 2\.9/i);
});
