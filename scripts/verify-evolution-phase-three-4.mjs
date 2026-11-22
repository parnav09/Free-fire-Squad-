import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const migration = await readFile(
  new URL("supabase/migrations/20261122150000_evolution_phase_three_4_evidence_provenance_verification.sql", root),
  "utf8",
);
const evidenceMigration = await readFile(
  new URL("supabase/migrations/20261122140000_evolution_phase_three_3_evidence_data_model.sql", root),
  "utf8",
);

test("Point 3.4 uses an append-only provenance event ledger without mutating evidence identity", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.evolution_evidence_verification_events/);
  assert.match(migration, /actor_user_id uuid NOT NULL/);
  assert.match(migration, /from_status text/);
  assert.match(migration, /to_status text NOT NULL/);
  assert.match(migration, /created_at timestamptz NOT NULL/);
  assert.match(migration, /Evidence verification history is append-only/);
  assert.doesNotMatch(migration, /UPDATE public\.evolution_evidence_items\s+SET\s+status/i);
});

test("initial pending state is backfilled without rewriting Phase 3.3 evidence rows", () => {
  assert.match(migration, /INSERT INTO public\.evolution_evidence_verification_events/);
  assert.match(migration, /WHERE NOT EXISTS/);
  assert.match(migration, /Initial state recorded from immutable evidence creation/);
  assert.match(evidenceMigration, /created_by uuid NOT NULL/);
});

test("status transition matrix explicitly constrains pending, verified, rejected, corrected and archived", () => {
  for (const state of ["pending", "verified", "rejected", "corrected", "archived"]) {
    assert.match(migration, new RegExp("'" + state + "'"));
  }
  assert.match(migration, /evolution_evidence_verification_transition_valid/);
  assert.match(migration, /from_status = 'pending' AND to_status IN \('verified','rejected','corrected','archived'\)/);
  assert.match(migration, /from_status = 'verified' AND to_status IN \('corrected','archived'\)/);
  assert.match(migration, /from_status = 'rejected' AND to_status IN \('corrected','archived'\)/);
});

test("verification RPC is authenticated, team-scoped and prevents author self-verification", () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.transition_evolution_evidence_status/);
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /membership_role IN \('owner','coach'\)/);
  assert.match(migration, /v_actor = v_evidence\.created_by/);
  assert.match(migration, /Evidence author cannot verify or adjudicate their own evidence/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.transition_evolution_evidence_status/);
});

test("rejection, correction and archival require an audit reason", () => {
  assert.match(migration, /to_status NOT IN \('rejected', 'corrected', 'archived'\)/);
  assert.match(migration, /char_length\(btrim\(COALESCE\(reason, ''\)\)\) BETWEEN 3 AND 1000/);
});

test("corrections reference an existing evidence version and never erase prior history", () => {
  assert.match(migration, /evidence_version_id uuid/);
  assert.match(migration, /FOREIGN KEY \(evidence_version_id, evidence_item_id, team_id\)/);
  assert.match(migration, /Correction must reference a version belonging to this evidence/);
  assert.match(migration, /Correction must reference a newly appended evidence version/);
});

test("current status is derived from the latest immutable event", () => {
  assert.match(migration, /CREATE OR REPLACE VIEW public\.evolution_evidence_current_status/);
  assert.match(migration, /DISTINCT ON \(v\.evidence_item_id\)/);
  assert.match(migration, /ORDER BY v\.evidence_item_id, v\.created_at DESC, v\.id DESC/);
  assert.match(migration, /WITH \(security_invoker = true\)/);
});

test("duplicate detection is advisory and does not merge or delete evidence", () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.find_evolution_evidence_duplicate_candidates/);
  assert.match(migration, /same_source_locator/);
  assert.match(migration, /same_context_source_and_title/);
  assert.match(migration, /LIMIT 20/);
  assert.doesNotMatch(migration, /DELETE FROM public\.evolution_evidence_items|UPDATE public\.evolution_evidence_items/i);
});

test("event reads inherit evidence visibility and anonymous/direct writes are denied", () => {
  assert.match(migration, /ALTER TABLE public\.evolution_evidence_verification_events ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /evolution_evidence_verification_visibility_read/);
  assert.match(migration, /REVOKE ALL ON TABLE public\.evolution_evidence_verification_events FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /GRANT SELECT ON public\.evolution_evidence_verification_events TO authenticated/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.transition_evolution_evidence_status[\s\S]*?FROM PUBLIC, anon/);
});

test("verification trigger serializes concurrent transitions and rejects stale status", () => {
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /NEW\.from_status IS DISTINCT FROM latest_status/);
  assert.match(migration, /USING ERRCODE = '40001'/);
});

test("Point 3.4 does not add score calculation, rubric or evaluation UI prematurely", () => {
  assert.doesNotMatch(migration, /weighted_average|canonical_score_100|evolution_score_snapshots/i);
  assert.doesNotMatch(migration, /DROP TABLE|TRUNCATE|DELETE FROM public\.(daily_scores|training_results)/i);
});
