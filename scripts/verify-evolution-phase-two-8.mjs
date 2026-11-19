import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const [migration, harness, report, blueprint, packageText, workflow, parentReport] = await Promise.all([
  read("supabase/migrations/20261120220000_evolution_phase_two_8_result_verification.sql"),
  read("scripts/verify-evolution-phase-two-8-db.sh"),
  read("docs/evolution/PHASE-2-8-RESULT-VERIFICATION.md"),
  read("docs/evolution-version-2.md"),
  read("package.json"),
  read(".github/workflows/evolution-phase-one.yml"),
  read("docs/evolution/PHASE-2-7-SUBSTITUTION-TRACKING.md"),
]);
const pkg = JSON.parse(packageText);

test("Point 2.8 implements the exact result-verification blueprint point", () => {
  assert.match(blueprint, /38\.8 Point 2\.8 — Result Verification and Correction Audit/);
  for (const requirement of [
    /Define result states: Draft, Submitted, Verified, Corrected\/Amended, Rejected/,
    /Store result source, submitter, verifier, and timestamps/,
    /Keep raw submitted values and verified values distinguishable/,
    /append-only correction\/amendment history/,
    /Prevent unverified results from entering official aggregates/,
    /Never infer kills, placement, survival, or match events/,
  ]) assert.match(blueprint, requirement);
  assert.match(parentReport, /Point 2\.7 — Substitution Tracking/);
  assert.match(report, /Point 2\.8 — Result Verification and Correction Audit/);
});

test("Raw submissions and verified values are stored separately with append-only versions/events", () => {
  assert.match(migration, /canonical_session_result_versions/);
  assert.match(migration, /raw_submitted_values jsonb NOT NULL/);
  assert.match(migration, /recorded_by uuid NOT NULL/);
  assert.match(migration, /submitted_at timestamptz/);
  assert.match(migration, /version_kind='draft' AND submitted_by IS NULL AND submitted_at IS NULL/);
  assert.match(migration, /verified_values jsonb/);
  assert.match(migration, /canonical_session_result_events/);
  assert.match(migration, /version_kind IN \('draft','submission','amendment'\)/);
  assert.match(migration, /status IN \('draft','submitted','verified','amended','rejected'\)/);
  assert.match(migration, /canonical_session_result_history_is_append_only/);
  assert.match(harness, /Prior and corrected raw versions were not both preserved/);
});

test("First-time direct submissions authorize the guarded result-root insert", () => {
  const submissionRpc = migration
    .split("CREATE OR REPLACE FUNCTION public.submit_canonical_session_result(")[1]
    .split("$function$;")[0];
  const rootAuthorization = submissionRpc.indexOf("set_config('app.evolution_result_write','root',true)");
  const resultInsert = submissionRpc.indexOf("INSERT INTO public.canonical_session_results");
  assert.ok(rootAuthorization >= 0, "submission RPC must set the guarded root-write context");
  assert.ok(resultInsert >= 0, "submission RPC must create a canonical result when no draft exists");
  assert.ok(rootAuthorization < resultInsert, "root-write context must be set before the guarded insert");
  assert.match(harness, /v_result1:=public\.submit_canonical_session_result\(/);
});

test("Source-specific checklists and explicit no-inference assertions are mandatory", () => {
  assert.match(migration, /source_identity_confirmed/);
  assert.match(migration, /match_identity_confirmed/);
  assert.match(migration, /activity_confirmed/);
  assert.match(migration, /participants_confirmed/);
  assert.match(migration, /no_inferred_values/);
  assert.match(migration, /canonical_result_verification_checklist_incomplete/);
  assert.match(harness, /Incomplete verification checklist was accepted/);
});

test("Only current verified competitive records are exposed to aggregate consumers", () => {
  assert.match(migration, /canonical_verified_competitive_match_results/);
  assert.match(migration, /r\.status IN \('verified','amended'\)/);
  assert.match(migration, /canonical_verified_training_results/);
  assert.match(harness, /Draft result leaked into verified competitive aggregate/);
  assert.match(harness, /Training evidence leaked into competitive aggregates/);
  assert.match(harness, /Pending correction did not suspend only its own aggregate row/);
});

test("Canonical lifecycle cannot be verified while any result remains unverified", () => {
  assert.match(migration, /canonical_session_requires_verified_result_records/);
  assert.match(migration, /canonical_session_has_unverified_result_records/);
  assert.match(migration, /OLD.lifecycle_status = 'verified' AND NEW.lifecycle_status = 'awaiting_results'/);
  assert.match(migration, /canonical_result_rejection_session_state_invalid/);
  assert.match(harness, /Session verified while match results were still unverified/);
});

test("Submission, verification, rejection and amendments use authorized idempotent RPCs", () => {
  for (const rpc of [
    /save_canonical_session_result_draft/,
    /submit_canonical_session_result/,
    /verify_canonical_session_result/,
    /reject_canonical_session_result/,
  ]) assert.match(migration, rpc);
  assert.match(migration, /canonical_result_idempotency_conflict/);
  assert.match(migration, /canonical_result_correction_reason_required/);
  assert.match(migration, /active_owner_or_coach_required/);
  assert.match(harness, /Player was allowed to submit a trusted result/);
});

test("Team isolation, private trigger ACLs and direct-write denial are tested", () => {
  assert.match(migration, /canonical_session_results_staff_read/);
  assert.match(migration, /canonical_session_result_versions_staff_read/);
  assert.match(migration, /canonical_session_result_events_staff_read/);
  assert.match(migration, /REVOKE INSERT,UPDATE,DELETE ON public\.canonical_session_results/);
  assert.match(harness, /Cross-team result visibility leaked/);
  assert.match(harness, /Authenticated role can directly mutate result records/);
  assert.match(harness, /API role can execute private result trigger function/);
});

test("Point 2.8 integration and contracts are part of exact-head CI/build", () => {
  assert.equal(pkg.scripts["test:evolution-phase-two-8"], "node --test scripts/verify-evolution-phase-two-8.mjs");
  assert.ok(pkg.scripts.build.includes("npm run test:evolution-phase-two-8"));
  assert.match(workflow, /feat\/evolution-phase-two-8-result-verification/);
  assert.match(workflow, /verify-evolution-phase-two-8-db\.sh/);
  assert.match(harness, /Evolution Phase Two\.8 PostgreSQL integration PASS/);
});

test("Point 2.8 does not absorb Point 2.9 or production rollout", () => {
  assert.match(report, /Point 2\.9/);
  assert.match(report, /no live Supabase migration\\/backfill/i);
  assert.match(report, /deploy\\/promote Vercel production/i);
  assert.match(blueprint, /No production migration\/deployment occurs without separate rollout approval/i);
});
