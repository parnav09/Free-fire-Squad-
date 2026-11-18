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

test("Phase 2.2 defines UUID identity and controlled session types", () => {
  assert.match(migration, /id uuid PRIMARY KEY DEFAULT gen_random_uuid\(\)/i);
  assert.match(migration, /session_type IN \('scrim', 'tournament', 'training'\)/i);
  assert.match(migration, /season_label text/i);
  assert.match(report, /display labels are descriptive metadata and are not identity keys/i);
});

test("Session creation is idempotent and rejects a changed retry payload", () => {
  assert.match(migration, /UNIQUE \(team_id, idempotency_key\)/i);
  assert.match(migration, /ON CONFLICT \(team_id, idempotency_key\) DO NOTHING/i);
  assert.match(migration, /idempotency_key_reused_with_different_payload/i);
  assert.match(migration, /SECURITY INVOKER/i);
  assert.match(migration, /active_owner_or_coach_required/i);
});

test("Source mappings enforce real UUID references and same-team composite foreign keys", () => {
  for (const source of ["scrim_record_id", "tournament_cycle_id", "training_session_id"]) {
    assert.match(migration, new RegExp(source, "i"));
  }
  assert.match(migration, /FOREIGN KEY \(canonical_session_id, team_id\)/i);
  assert.match(migration, /FOREIGN KEY \(scrim_record_id, team_id\)/i);
  assert.match(migration, /FOREIGN KEY \(tournament_cycle_id, team_id\)/i);
  assert.match(migration, /FOREIGN KEY \(training_session_id, team_id\)/i);
  assert.match(migration, /UNIQUE \(source_system, source_record_id\)/i);
});

test("RLS separates member reads from staff writes and denies hard deletion", () => {
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/i);
  assert.match(migration, /canonical_sessions_team_read/i);
  assert.match(migration, /canonical_sessions_staff_insert/i);
  assert.match(migration, /canonical_sessions_staff_update/i);
  assert.match(migration, /canonical_session_sources_staff_insert/i);
  assert.match(migration, /REVOKE DELETE/i);
});

test("Archive is soft and archived sessions are read-only", () => {
  assert.match(migration, /archived_at timestamptz/i);
  assert.match(migration, /archived_by uuid/i);
  assert.match(migration, /archived_at IS NULL/i);
  assert.match(report, /non-destructive archive/i);
});

test("Disposable PostgreSQL integration checks retry, RLS, source integrity and archive", () => {
  for (const phrase of [
    "idempotent retry created a second session",
    "cross-team source mapping was accepted",
    "cross-team session visibility leaked",
    "archived session remained mutable",
    "player role created a canonical session",
  ]) assert.ok(dbHarness.includes(phrase), `Missing DB assertion: ${phrase}`);
});

test("Phase 2.2 contracts are wired into the standard build and CI workflow", () => {
  assert.equal(pkg.scripts["test:evolution-phase-two-2"], "node --test scripts/verify-evolution-phase-two-2.mjs");
  assert.ok(pkg.scripts.build.includes("npm run test:evolution-phase-two-2"));
  assert.match(workflow, /feat\/evolution-phase-two-2-canonical-session-identity/);
  assert.match(workflow, /verify-evolution-phase-two-2-db\.sh/);
  assert.match(report, /CI evidence is intentionally pending/i);
});

test("Auth plan limitation and original baseline gap are recorded without false PASS claims", () => {
  assert.match(report, /Leaked Password Protection remains disabled/i);
  assert.match(report, /not fabricated/i);
  assert.match(report, /not a verified original baseline/i);
  assert.match(blueprint, /Phase One 1\.5-E/);
});
