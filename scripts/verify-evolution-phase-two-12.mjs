import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Final build runs every Evolution regression contract through Point 2.12", async () => {
  const pkg = JSON.parse(await read("../package.json"));
  const build = pkg.scripts.build;
  assert.match(build, /npm run typecheck/);
  assert.match(build, /npm run test:foundation/);
  for (const point of ["1","2","3","4","5","6","7","8","9","10","11","12"]) {
    assert.ok(build.includes(`npm run test:evolution-phase-two-${point}`), `Point 2.${point} is missing from build`);
    assert.ok(pkg.scripts[`test:evolution-phase-two-${point}`], `Point 2.${point} test script is missing`);
  }
  assert.match(build, /vite build/);
});

test("Canonical session migrations 2.2–2.10 remain present and ordered", async () => {
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
  assert.deepEqual([...expected].sort(), expected, "migration timestamps must preserve point order");
  assert.equal(files.filter((name) => /evolution_phase_two_(11|12)/.test(name)).length, 0,
    "Points 2.11 and 2.12 must not introduce schema migrations");
});

test("All earlier regression contracts are registered", async () => {
  const pkg = JSON.parse(await read("../package.json"));
  for (const point of ["1","2","3","4","5","6","7","8","9","10","11"]) {
    const path = pkg.scripts[`test:evolution-phase-two-${point}`];
    assert.ok(path, `Missing Point 2.${point} script`);
    assert.ok(path.includes(`verify-evolution-phase-two-${point}.mjs`), `Unexpected Point 2.${point} test target`);
  }
});

test("Disposable PostgreSQL harness remains mandatory for database points 2.2–2.10", async () => {
  const workflow = await read("../.github/workflows/evolution-phase-one.yml");
  for (const point of ["2","3","4","5","6","7","8","9","10"]) {
    assert.ok(workflow.includes(`verify-evolution-phase-two-${point}-db.sh`), `Missing PostgreSQL integration for Point 2.${point}`);
  }
  assert.match(workflow, /Install and start disposable local PostgreSQL|Install and start disposable PostgreSQL 16|image: postgres:16/);
  assert.match(workflow, /DATABASE_URL: postgresql:\/\/postgres:postgres@localhost:5432\/squad_os_ci/);
  assert.match(workflow, /createdb -h localhost -U postgres squad_os_phase_two_10_ci/);
});

test("Phase 2.11 UI preserves canonical RPC boundaries and fail-closed behavior", async () => {
  const component = await read("../src/components/CanonicalSessionsWorkspace.tsx");
  for (const rpc of [
    "create_canonical_session","transition_canonical_session","reopen_canonical_session",
    "lock_canonical_session_roster","record_canonical_match_participation",
    "correct_canonical_match_participation","set_canonical_session_match_role",
    "record_canonical_session_substitution","save_canonical_session_result_draft",
    "submit_canonical_session_result","verify_canonical_session_result",
    "reject_canonical_session_result","submit_canonical_session_results"
  ]) assert.ok(component.includes(rpc), `Missing canonical RPC: ${rpc}`);
  assert.match(component, /if\(!canManage\)/);
  assert.match(component, /if\(!isOnline\)/);
  assert.match(component, /No writes are queued or silently replayed/);
  assert.match(component, /Create Scrim and Tournament sessions in their existing modules/);
  assert.match(component, /no_inferred_values/);
});

test("Responsive and accessible session UI safeguards remain in place", async () => {
  const css = await read("../src/components/CanonicalSessionsWorkspace.css");
  const component = await read("../src/components/CanonicalSessionsWorkspace.tsx");
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(css, /@media\(max-width:520px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(component, /aria-label="Canonical session list"/);
  assert.match(component, /role="alert"/);
  assert.match(component, /role="status"/);
});

test("Phase 2.12 build registration is active while GitHub Actions triggers remain explicitly held", async () => {
  const workflow = await read("../.github/workflows/evolution-phase-one.yml");
  const doc = await read("../docs/evolution/PHASE-2-12-REGRESSION-ACCEPTANCE.md");
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /verify-evolution-phase-two-10-db\.sh/);
  assert.match(doc, /GitHub Actions branch triggers remain held until 1 December/i);
  // Do not change or re-enable Actions branch triggers while the owner's hold is active.
});

test("Acceptance report cannot overstate blocked database or device evidence", async () => {
  const doc = await read("../docs/evolution/PHASE-2-12-REGRESSION-ACCEPTANCE.md");
  assert.match(doc, /OVERALL STATUS: BLOCKED/);
  assert.match(doc, /Phase 2\.10 PostgreSQL integration/);
  assert.match(doc, /manual Android, tablet and desktop QA/);
  assert.match(doc, /No production migration, backfill, merge or production deployment/);
  assert.doesNotMatch(doc, /OVERALL STATUS: PASS/);
});


test("Blueprint groups 1–3 have explicit disposable database regression cases", async () => {
  const blueprint = await read("../docs/evolution-version-2.md");
  const identity = await read("./verify-evolution-phase-two-2-db.sh");
  const matches = await read("./verify-evolution-phase-two-3-db.sh");
  const lifecycle = await read("./verify-evolution-phase-two-4-db.sh");
  assert.match(blueprint, /1\. Canonical identity uniqueness and team isolation/);
  assert.match(identity, /idempotent retry created a second session/);
  assert.match(identity, /cross-team session visibility leaked/);
  assert.match(matches, /canonical parent session backfill count mismatch/);
  assert.match(matches, /canonical child match backfill count mismatch/);
  assert.match(lifecycle, /Stale lifecycle version was accepted/);
  assert.match(lifecycle, /Player unexpectedly transitioned a canonical session/);
});

test("Blueprint groups 4–6 protect historical roster, role snapshots and substitutions", async () => {
  const blueprint = await read("../docs/evolution-version-2.md");
  const roster = await read("./verify-evolution-phase-two-5-db.sh");
  const roles = await read("./verify-evolution-phase-two-6-db.sh");
  const substitutions = await read("./verify-evolution-phase-two-7-db.sh");
  assert.match(blueprint, /4\. Historical roster immutability after roster edits/);
  assert.match(roster, /Historical roster changed after member leave/);
  assert.match(roster, /Historical roster changed after IGN\/slot edit/);
  assert.match(roles, /Role definition edit rewrote an existing session snapshot/);
  assert.match(roles, /Changing match one rewrote the player role in match two/);
  assert.match(substitutions, /Expected two ordered substitution events/);
  assert.match(substitutions, /Lineup before first substitution was not reconstructable/);
  assert.match(substitutions, /Lineup after second substitution was not reconstructable/);
});

test("Blueprint groups 7–8 protect verified aggregates, retries and serialized source sync", async () => {
  const blueprint = await read("../docs/evolution-version-2.md");
  const results = await read("./verify-evolution-phase-two-8-db.sh");
  const adapterHarness = await read("./verify-evolution-phase-two-9-db.sh");
  const adapterMigration = await read("../supabase/migrations/20261120230000_evolution_phase_two_9_existing_module_integration.sql");
  assert.match(blueprint, /7\. Result submission, verification, correction, and aggregate eligibility/);
  assert.match(results, /Draft result leaked into verified competitive aggregate/);
  assert.match(results, /Pending correction did not suspend only its own aggregate row/);
  assert.match(results, /Training evidence leaked into competitive aggregates/);
  assert.match(adapterHarness, /Scrim adapter is not idempotent or did not map all three match IDs/);
  assert.match(adapterMigration, /pg_advisory_xact_lock/);
  assert.match(adapterMigration, /hashtextextended/);
});

test("Blueprint groups 9–11 preserve migration reconciliation, module integration and RLS boundaries", async () => {
  const blueprint = await read("../docs/evolution-version-2.md");
  const matches = await read("./verify-evolution-phase-two-3-db.sh");
  const integration = await read("./verify-evolution-phase-two-9-db.sh");
  const integrity = await read("./verify-evolution-phase-two-10-db.sh");
  const results = await read("./verify-evolution-phase-two-8-db.sh");
  const rollbackNotes = await read("../docs/evolution/PHASE-2-10-DATABASE-INTEGRITY.md");
  assert.match(blueprint, /9\. Migration forward\/recovery and historical reconciliation/);
  assert.match(matches, /canonical source mapping count mismatch/);
  assert.match(matches, /Mapped Scrim source was destructively deleted/);
  assert.match(integration, /Explicitly promoted Planning item did not become a Training session identity/);
  assert.match(integration, /Planning plan itself was incorrectly promoted as a played session/);
  assert.match(integrity, /cross-team task source session accepted/);
  assert.match(results, /Cross-team result visibility leaked/);
  assert.match(rollbackNotes, /rollback can be executed in one reviewed transaction/);
});

test("Blueprint group 12 has responsive, touch-target and keyboard-focus source safeguards", async () => {
  const blueprint = await read("../docs/evolution-version-2.md");
  const css = await read("../src/components/CanonicalSessionsWorkspace.css");
  const component = await read("../src/components/CanonicalSessionsWorkspace.tsx");
  assert.match(blueprint, /12\. Android\/mobile, tablet, desktop responsive and accessibility QA/);
  assert.match(css, /@media\(max-width:1050px\)/);
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(css, /@media\(max-width:520px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /min-height:44px/);
  assert.match(css, /:focus-visible/);
  assert.match(component, /role="alert"/);
  assert.match(component, /role="status"/);
  // These are source-level safeguards only; manual device acceptance remains separate.
});

test("Phase 2.12 acceptance report keeps runtime-only evidence explicitly pending", async () => {
  const doc = await read("../docs/evolution/PHASE-2-12-REGRESSION-ACCEPTANCE.md");
  assert.match(doc, /Parallel contention test still pending/i);
  assert.match(doc, /Run authenticated end-to-end flows against a disposable\/staging database/i);
  assert.match(doc, /manual Android, tablet and desktop interaction QA requires real device\/browser interaction/i);
  assert.match(doc, /\*\*PENDING\*\*/);
  assert.match(doc, /OVERALL STATUS: BLOCKED/);
});
