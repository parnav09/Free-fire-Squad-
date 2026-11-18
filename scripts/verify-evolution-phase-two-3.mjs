import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const [migration, harness, report, blueprint, packageText, workflow, scrimsUi, tournamentSql] = await Promise.all([
  read("supabase/migrations/20261119140000_evolution_phase_two_3_canonical_match_identity.sql"),
  read("scripts/verify-evolution-phase-two-3-db.sh"),
  read("docs/evolution/PHASE-2-3-MATCH-IDENTITY.md"),
  read("docs/evolution-version-2.md"),
  read("package.json"),
  read(".github/workflows/evolution-phase-one.yml"),
  read("src/components/ScrimsSection.tsx"),
  read("supabase/migrations/20261107130445_weekly_tournament_cycles_and_matches.sql"),
]);
const pkg = JSON.parse(packageText);

test("Phase 2.3 follows the authoritative Point 2.3 Match Identity scope", () => {
  assert.match(blueprint, /38\.3 Point 2\.3 — Match Identity/);
  assert.match(blueprint, /represent each match as a first-class child of a session/i);
  assert.match(report, /Phase Two\.3 — Canonical Match Identity/);
  assert.match(report, /It does not implement session lifecycle \(2\.4\), roster snapshots \(2\.5\)/i);
});

test("Every canonical match has a stable UUID, one parent and independent sequence metadata", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.canonical_session_matches/i);
  assert.match(migration, /id uuid PRIMARY KEY DEFAULT gen_random_uuid\(\)/i);
  assert.match(migration, /FOREIGN KEY \(canonical_session_id, team_id\)/i);
  assert.match(migration, /canonical_session_matches_session_sequence_uidx/);
  assert.match(migration, /match_sequence smallint NOT NULL/i);
});

test("Scrim source identity preserves the parent, original JSONB sequence and payload fingerprint", () => {
  assert.match(migration, /scrim_record_id uuid/i);
  assert.match(migration, /scrim_source_sequence smallint/i);
  assert.match(migration, /source_match_fingerprint text/i);
  assert.match(migration, /jsonb_array_elements\(sr\.matches\) WITH ORDINALITY/i);
  assert.match(migration, /md5\(item\.value::text\)/i);
  assert.match(report, /does not provide a native per-match UUID/i);
});

test("Tournament match UUIDs and source coordinates remain traceable and team-scoped", () => {
  assert.match(migration, /tournament_match_id uuid/i);
  assert.match(migration, /FOREIGN KEY \(tournament_match_id, team_id\)/i);
  assert.match(migration, /source_match_day smallint/i);
  assert.match(migration, /source_match_number smallint/i);
  assert.match(migration, /tm\.map_name/i);
  assert.match(migration, /UNIQUE INDEX IF NOT EXISTS canonical_session_matches_tournament_source_uidx/i);
});

test("Expected counts are source-derived and absent matches are never fabricated", () => {
  assert.match(migration, /canonical_session_match_sets/);
  assert.match(migration, /sr\.match_count/);
  assert.match(migration, /count\(tm\.id\)/i);
  assert.doesNotMatch(migration, /generate_series\s*\(/i);
  assert.match(report, /Missing source rows remain missing/i);
  assert.match(harness, /Scrim expected\/actual mismatch/);
});

test("Actual played count uses source status and source-consistent Scrim fingerprints", () => {
  assert.match(migration, /canonical_session_match_counts/i);
  assert.match(migration, /WITH \(security_invoker = true\)/i);
  assert.match(migration, /status IN \('draft', 'submitted', 'verified', 'disputed'\)/i);
  assert.match(migration, /tournament_matches\.recorded_by IS NOT NULL/i);
  assert.match(migration, /tournament_matches\.recorded_by IS NOT NULL/i);
  assert.match(migration, /actual_played_match_count/i);
  assert.match(harness, /Scheduled-only Tournament cycle must have zero played matches/);
});

test("Match sequence corrections are audited and the trigger function is private", () => {
  assert.match(migration, /canonical_session_match_sequence_events/);
  assert.match(migration, /correct_canonical_match_sequence/i);
  assert.match(migration, /SECURITY DEFINER/i);
  assert.match(migration, /SET search_path = ''/i);
  assert.match(migration, /REVOKE ALL ON FUNCTION evolution_private\.audit_canonical_match_sequence_change\(\)/i);
  assert.match(harness, /Sequence correction audit event missing/);
});

test("Sync is idempotent and source rows cannot be attached twice", () => {
  assert.match(migration, /sync_canonical_session_matches/i);
  assert.match(migration, /ON CONFLICT DO NOTHING/i);
  assert.match(migration, /canonical_session_matches_scrim_source_uidx/i);
  assert.match(migration, /canonical_session_matches_tournament_source_uidx/i);
  assert.match(harness, /Repeated source sync created duplicate child identities/);
});

test("RLS and least-privilege grants protect match data and sequence audit", () => {
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/i);
  assert.match(migration, /canonical_session_matches_team_read/i);
  assert.match(migration, /canonical_session_matches_staff_insert/i);
  assert.match(migration, /canonical_session_matches_staff_update/i);
  assert.match(migration, /canonical_session_match_sequence_events_staff_read/i);
  assert.match(migration, /REVOKE DELETE/i);
  assert.match(harness, /Cross-team canonical match visibility leaked/);
  assert.match(harness, /Authenticated role unexpectedly has canonical match DELETE/);
});

test("Backfill preserves existing Scrim and Tournament source IDs without changing source UI", () => {
  assert.match(migration, /evolution-v2-session:scrim:/);
  assert.match(migration, /evolution-v2-session:tournament:/);
  assert.match(migration, /canonical_session_sources/);
  assert.match(scrimsUi, /scrim_records/);
  assert.match(tournamentSql, /create table if not exists public\.tournament_matches/i);
  assert.match(report, /Source rows and existing JSONB payloads are not rewritten/i);
});

test("The exact Phase 2.3 PostgreSQL harness runs in the standard build and CI", () => {
  assert.equal(pkg.scripts["test:evolution-phase-two-3"], "node --test scripts/verify-evolution-phase-two-3.mjs");
  assert.ok(pkg.scripts.build.includes("npm run test:evolution-phase-two-3"));
  assert.match(workflow, /feat\/evolution-phase-two-3-match-identity/);
  assert.match(workflow, /verify-evolution-phase-two-3-db\.sh/);
  assert.match(harness, /Evolution Phase Two\.3 PostgreSQL integration PASS/);
});
