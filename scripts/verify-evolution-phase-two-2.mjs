import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const [migration, dbHarness, report, blueprint, packageText, workflow] = await Promise.all([
  read("supabase/migrations/20261119120000_evolution_phase_two_2_canonical_session_identity.sql"),
  read("scripts/verify-evolution-phase-two-2-db.sh"),
  read("docs/evolution/PHASE-2-2-CANONICAL-SESSION-IDENTITY.md"),
  read("docs/evolution-version-2.md"),
  read("package.json"),
  read(".github/workflows/evolution-phase-one.yml"),
]);
const pkg = JSON.parse(packageText);

test("Phase 2.2 creates a UUID identity with controlled session types and mutable display metadata", () => {
  assert.match(migration, /id uuid PRIMARY KEY DEFAULT gen_random_uuid\(\)/i);
  assert.match(migration, /session_type IN \('scrim', 'tournament', 'training'\)/i);
  assert.match(migration, /title text NOT NULL/i);
  assert.match(migration, /season_label text/i);
  assert.match(report, /display labels are not identity/i);
});

test("Session idempotency is enforced by a team-scoped key and server-side create function", () => {
  assert.match(migration, /UNIQUE \(team_id, idempotency_key\)/i);
  assert.match(migration, /ON CONFLICT \(team_id, idempotency_key\) DO NOTHING/i);
  assert.match(migration, /idempotency_key_reused_with_different_payload/i);
  assert.match(migration, /SECURITY INVOKER/i);
  assert.match(migration, /active_owner_or_coach_required/i);
});

test("Legacy source mappings use real source UUIDs and composite same-team foreign keys", () => {
  for (const source of ["scrim_record_id", "tournament_cycle_id", "training_session_id"]) {
    assert.match(migration, new RegExp(source, "i"));
  }
  assert.match(migration, /FOREIGN KEY \(canonical_session_id, team_id\)/i);
  assert.match(migration, /FOREIGN KEY \(scrim_record_id, team_id\)/i);
  assert.match(migration, /FOREIGN KEY \(tournament_cycle_id, team_id\)/i);
  assert.match(migration, /FOREIGN KEY \(training_session_id, team_id\)/i);
  assert.match(migration, /UNIQUE \(source_system, source_record_id\)/i);
});

test("Team RLS separates member reads from owner/coach writes and prevents hard deletes", () => {
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/i);
  assert.match(migration, /canonical_sessions_team_read/i);
  assert.match(migration, /canonical_sessions_staff_insert/i);
  assert.match(migration, /canonical_sessions_staff_update/i);
  assert.match(migration, /REVOKE DELETE/i);
  assert.match(migration, /canonical_session_sources_staff_insert/i);
});

test("Archive is soft and archived sessions are no longer mutable through the update policy", () => {
  assert.match(migration, /archived_at timestamptz/i);
  assert.match(migration, /archived_by uuid/i);
  assert.match(migration, /archived_at IS NULL/i);
  assert.match(report, /non-destructive archive/i);
});

test("Database integration harness covers retry, payload mismatch, RLS, source integrity and archive", () => {
  for (const phrase of [
    "idempotent retry created a second session",
    "idempotency_key_reused_with_different_payload",
    "cross-team source mapping was accepted",
    "cross-team session visibility leaked",
    "archived session remained mutable",
    "player role created a canonical session",
  ]) assert.ok(dbHarness.includes(phrase), `Missing DB assertion: ${phrase}`);
});

test("Point 2.2 is tracked as complete only when exact-head CI evidence is attached", () => {
  assert.match(blueprint, /2\.2 \| Canonical Session Identity/);
  assert.match(report, /CI verification/i);
  assert.equal(pkg.scripts["test:evolution-phase-two-2"], "node --test scripts/verify-evolution-phase-two-2.mjs");
  assert.ok(pkg.scripts.build.includes("npm run test:evolution-phase-two-2"));
  assert.match(workflow, /feat\/evolution-phase-two-2-canonical-session-identity/);
});

test("Paid-plan Auth limitation and clean-replay baseline gap are not misrepresented as passed", () => {
  assert.match(report, /Leaked Password Protection remains disabled/i);
  assert.match(report, /clean-replay baseline/i);
  assert.match(report, /not a verified original baseline/i);
});
