import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("All Phase 2 point contracts 2.1–2.12 are registered in the production build", async () => {
  const pkg = JSON.parse(await read("../package.json"));
  for (let point = 1; point <= 12; point++) {
    const key = `test:evolution-phase-two-${point}`;
    assert.ok(pkg.scripts[key], `Missing npm script ${key}`);
    assert.ok(pkg.scripts.build.includes(`npm run ${key}`), `Build omits Point 2.${point}`);
  }
  assert.match(pkg.scripts.build, /npm run typecheck/);
  assert.match(pkg.scripts.build, /vite build/);
});

test("Canonical schema migrations 2.2–2.10 exist in strict chronological order", async () => {
  const files = await readdir(new URL("../supabase/migrations/", import.meta.url));
  const expected = [
    "20261119120000_evolution_phase_two_2_canonical_session_identity.sql",
    "20261119140000_evolution_phase_two_3_canonical_match_identity.sql",
    "20261119160000_evolution_phase_two_4_session_lifecycle.sql",
    "20261119180000_evolution_phase_two_5_session_roster_snapshot.sql",
    "20261119200000_evolution_phase_two_6_role_snapshot.sql",
    "20261120200000_evolution_phase_two_7_substitution_tracking.sql",
    "20261120220000_evolution_phase_two_8_result_verification.sql",
    "20261120230000_evolution_phase_two_9_existing_module_integration.sql",
    "20261121000000_evolution_phase_two_10_database_integrity.sql"
  ];
  for (const name of expected) assert.ok(files.includes(name), `Missing migration: ${name}`);
  assert.deepEqual([...expected].sort(), expected);
  assert.equal(files.filter((name) => /evolution_phase_two_(11|12)/.test(name)).length, 0);
});

test("Every database point has its disposable PostgreSQL harness wired into CI", async () => {
  const workflow = await read("../.github/workflows/evolution-phase-one.yml");
  for (let point = 2; point <= 10; point++) {
    assert.ok(workflow.includes(`verify-evolution-phase-two-${point}-db.sh`), `CI omits DB point 2.${point}`);
  }
  assert.match(workflow, /Install and start disposable local PostgreSQL/);
  assert.match(workflow, /DATABASE_URL=postgresql:\/\/postgres:postgres@localhost:5432/);
});

test("Phase 2.9 exercises actual simultaneous retries behind the source advisory lock", async () => {
  const harness = await read("./verify-evolution-phase-two-9-db.sh");
  const migration = await read("../supabase/migrations/20261120230000_evolution_phase_two_9_existing_module_integration.sql");
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /hashtextextended/);
  assert.match(harness, /PGAPPNAME=phase29-integrate-a/);
  assert.match(harness, /PGAPPNAME=phase29-integrate-b/);
  assert.match(harness, /wait_event='PgSleep'/);
  assert.match(harness, /wait_event_type='Lock'/);
  assert.match(harness, /Concurrent retries did not return the same canonical session ID/);
  assert.match(harness, /Concurrent source integration created % source mappings instead of one/);
});

test("Phase 2.10 verifies forward migration, rollback, and forward re-application", async () => {
  const harness = await read("./verify-evolution-phase-two-10-db.sh");
  assert.match(harness, /Verify the documented rollback against this disposable database only/);
  assert.match(harness, /Phase 2\.10 rollback left a new constraint behind/);
  assert.match(harness, /Re-apply after rollback to prove the forward path is recoverable and repeatable/);
  assert.match(harness, /Forward re-apply did not restore all 14 validated constraints/);
});

test("Phase 2.11 UI source contracts and real Chromium visual harness are present", async () => {
  const pkg = JSON.parse(await read("../package.json"));
  const sourceContract = await read("./verify-evolution-phase-two-11.mjs");
  const visual = await read("./run-evolution-phase-two-11-visual.mjs");
  assert.ok(pkg.scripts["test:evolution-phase-two-11-visual"]);
  assert.match(sourceContract, /session ledger filters canonical sessions/);
  assert.match(sourceContract, /permission-denied and empty\/loading\/error states/);
  for (const size of ["390","768","1024","1280","1440"]) assert.ok(visual.includes(`width:${size}`));
  assert.match(visual, /horizontal document overflow/);
  assert.match(visual, /undersized button hitboxes/);
  assert.match(visual, /keyboard focus outline missing/);
  assert.match(visual, /offline write must not call any RPC/);
  assert.match(visual, /staff\/member permissions/);
});

test("CI executes responsive Chromium tests and preserves screenshot artifacts", async () => {
  const workflow = await read("../.github/workflows/evolution-phase-one.yml");
  assert.match(workflow, /npx playwright install --with-deps chromium/);
  assert.match(workflow, /npm run test:evolution-phase-two-11-visual/);
  assert.match(workflow, /evolution-phase-two-11-responsive-screenshots/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
});

test("Canonical Sessions UI uses the authoritative RPC boundary and preserves fail-closed controls", async () => {
  const ui = await read("../src/components/CanonicalSessionsWorkspace.tsx");
  for (const rpc of [
    "create_canonical_session","transition_canonical_session","reopen_canonical_session",
    "lock_canonical_session_roster","record_canonical_match_participation",
    "correct_canonical_match_participation","set_canonical_session_match_role",
    "record_canonical_session_substitution","save_canonical_session_result_draft",
    "submit_canonical_session_result","verify_canonical_session_result",
    "reject_canonical_session_result","submit_canonical_session_results"
  ]) assert.ok(ui.includes(rpc), `Missing canonical RPC ${rpc}`);
  assert.match(ui, /online/);
  assert.match(ui, /if\(busy\)return;if\(!online\)/);
  assert.match(ui, /Offline — reconnect before changing session records/);
  assert.match(ui, /canManage/);
  assert.match(ui, /no_inferred_values/);
});

test("Blueprint preserves all twelve Point 2.12 acceptance groups", async () => {
  const blueprint = await read("../docs/evolution-version-2.md");
  const groups = [
    "Canonical identity uniqueness and team isolation",
    "Session-to-match parent/child integrity",
    "Lifecycle transition and authorization matrix",
    "Historical roster immutability after roster edits",
    "Role snapshot immutability and role changes across matches",
    "Substitution ordering and lineup reconstruction",
    "Result submission, verification, correction, and aggregate eligibility",
    "Idempotent retries and concurrent writes",
    "Migration forward/recovery and historical reconciliation",
    "Existing Scrims/Tournament/Training/Planning regression",
    "RLS and adversarial cross-team access tests",
    "Android/mobile, tablet, desktop responsive and accessibility QA"
  ];
  for (let i = 0; i < groups.length; i++) {
    assert.ok(blueprint.includes(`${i + 1}. ${groups[i]}`), `Blueprint acceptance group ${i + 1} missing`);
  }
});

test("CI branch filters include this acceptance branch and its Phase 2.11 base", async () => {
  const workflow = await read("../.github/workflows/evolution-phase-one.yml");
  assert.match(workflow, /feat\/evolution-phase-two-12-final-acceptance/);
  assert.match(workflow, /pull_request:[\s\S]*feat\/evolution-phase-two-11-session-ui/);
});

test("No stale December 1 execution hold remains in the Phase 2 acceptance path", async () => {
  const workflow = await read("../.github/workflows/evolution-phase-one.yml");
  const report = await read("../docs/evolution/PHASE-2-12-REGRESSION-ACCEPTANCE.md");
  assert.doesNotMatch(workflow, /hold until 1 December|held until 1 December|do not dispatch/i);
  assert.doesNotMatch(report, /hold until 1 December|held until 1 December|do not dispatch/i);
});

test("All database harnesses retain team-isolation, authorization, and provenance assertions", async () => {
  const identity = await read("./verify-evolution-phase-two-2-db.sh");
  const matches = await read("./verify-evolution-phase-two-3-db.sh");
  const lifecycle = await read("./verify-evolution-phase-two-4-db.sh");
  const roster = await read("./verify-evolution-phase-two-5-db.sh");
  const roles = await read("./verify-evolution-phase-two-6-db.sh");
  const substitutions = await read("./verify-evolution-phase-two-7-db.sh");
  const results = await read("./verify-evolution-phase-two-8-db.sh");
  const integration = await read("./verify-evolution-phase-two-9-db.sh");
  const integrity = await read("./verify-evolution-phase-two-10-db.sh");
  assert.match(identity, /cross-team session visibility leaked/);
  assert.match(matches, /canonical child match backfill count mismatch/);
  assert.match(lifecycle, /Player unexpectedly transitioned a canonical session/);
  assert.match(roster, /Historical roster changed after IGN\/slot edit/);
  assert.match(roles, /Changing match one rewrote the player role in match two/);
  assert.match(substitutions, /Expected two ordered substitution events/);
  assert.match(results, /Draft result leaked into verified competitive aggregate/);
  assert.match(integration, /Player unexpectedly integrated a staff-managed canonical source/);
  assert.match(integrity, /cross-team task source session accepted/);
});

test("Phase 2.11 responsive source safeguards cover breakpoints, focus, and reduced motion", async () => {
  const css = await read("../src/components/CanonicalSessionsWorkspace.css");
  assert.match(css, /@media\(max-width:1050px\)/);
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(css, /@media\(max-width:520px\)/);
  assert.match(css, /min-height:44px/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
});

test("Acceptance report explicitly separates automated evidence from owner device QA and rollout", async () => {
  const report = await read("../docs/evolution/PHASE-2-12-REGRESSION-ACCEPTANCE.md");
  assert.match(report, /Automated acceptance/);
  assert.match(report, /physical Android\/tablet\/desktop QA remains owner-run/i);
  assert.match(report, /No merge to `main`/);
  assert.match(report, /No production deployment/);
});
