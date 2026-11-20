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
  assert.match(workflow, /Install and start disposable PostgreSQL 16|image: postgres:16/);
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

test("Phase 2.12 is wired into CI on its branch and PR base", async () => {
  const workflow = await read("../.github/workflows/evolution-phase-one.yml");
  const push = workflow.split("  pull_request:")[0];
  const pull = workflow.split("  pull_request:")[1].split("\n\npermissions:")[0];
  assert.ok(push.includes("feat/evolution-phase-two-12-regression-acceptance"));
  assert.ok(pull.includes("feat/evolution-phase-two-11-application-ui"));
  assert.ok(pull.includes("feat/evolution-phase-two-12-regression-acceptance"));
  assert.match(workflow, /npm run build/);
});

test("Acceptance report cannot overstate blocked database or device evidence", async () => {
  const doc = await read("../docs/evolution/PHASE-2-12-REGRESSION-ACCEPTANCE.md");
  assert.match(doc, /OVERALL STATUS: BLOCKED/);
  assert.match(doc, /Phase 2\.10 PostgreSQL integration/);
  assert.match(doc, /manual Android, tablet and desktop QA/);
  assert.match(doc, /No production migration, backfill, merge or production deployment/);
  assert.doesNotMatch(doc, /OVERALL STATUS: PASS/);
});
