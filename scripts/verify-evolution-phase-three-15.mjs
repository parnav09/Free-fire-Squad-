import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const phaseDocs = [
  "../docs/evolution/PHASE-3-1-EXISTING-EVALUATION-SYSTEM-AUDIT.md",
  "../docs/evolution/PHASE-3-2-CANONICAL-DIMENSION-REGISTRY.md",
  "../docs/evolution/PHASE-3-3-EVIDENCE-DATA-MODEL.md",
  "../docs/evolution/PHASE-3-4-EVIDENCE-PROVENANCE-VERIFICATION.md",
  "../docs/evolution/PHASE-3-5-VERSIONED-RUBRIC-ENGINE.md",
  "../docs/evolution/PHASE-3-6-ROLE-BASED-WEIGHT-CONFIGURATION.md",
  "../docs/evolution/PHASE-3-7-NOT-OBSERVED-MISSING-DATA-RULES.md",
  "../docs/evolution/PHASE-3-8-EVIDENCE-COVERAGE-CALCULATOR.md",
  "../docs/evolution/PHASE-3-9-DETERMINISTIC-SCORING-ENGINE.md",
  "../docs/evolution/PHASE-3-10-SCORE-SNAPSHOT-CALCULATION-HISTORY.md",
  "../docs/evolution/PHASE-3-11-ATOMIC-SCORING-RPC-DATABASE-INTEGRITY.md",
  "../docs/evolution/PHASE-3-12-SECURITY-RLS-PERMISSIONS.md",
  "../docs/evolution/PHASE-3-13-SCORING-UI-EVALUATION-EXPERIENCE.md",
  "../docs/evolution/PHASE-3-14-EXISTING-MODULE-INTEGRATION.md",
];
const phaseScripts = Array.from({ length: 14 }, (_, index) => {
  const point = index + 1;
  return `../scripts/verify-evolution-phase-three-${point}.mjs`;
});
const databaseScripts = [
  "../scripts/verify-evolution-phase-three-2-db.sh",
  "../scripts/verify-evolution-phase-three-3-db.sh",
  "../scripts/verify-evolution-phase-three-4-db.sh",
  "../scripts/verify-evolution-phase-three-5-db.sh",
  "../scripts/verify-evolution-phase-three-6-db.sh",
  "../scripts/verify-evolution-phase-three-7-db.sh",
  "../scripts/verify-evolution-phase-three-8-db.sh",
  "../scripts/verify-evolution-phase-three-10-db.sh",
  "../scripts/verify-evolution-phase-three-11-db.sh",
  "../scripts/verify-evolution-phase-three-12-db.sh",
  "../scripts/verify-evolution-phase-three-13-db.sh",
];
const [docs, scripts, dbScripts, pkg, workflow, report, roadmap, phase14Visual, phase14Fixture, phase13Db, phase12Db] = await Promise.all([
  Promise.all(phaseDocs.map(read)),
  Promise.all(phaseScripts.map(read)),
  Promise.all(databaseScripts.map(read)),
  read("../package.json").then(JSON.parse),
  read("../.github/workflows/evolution-phase-one.yml"),
  read("../docs/evolution/PHASE-3-15-FINAL-ACCEPTANCE.md"),
  read("../docs/evolution/EVOLUTION-PHASE-3-ROADMAP-AND-CHECKPOINT.md"),
  read("./run-evolution-phase-three-14-visual.mjs"),
  read("./phase-three-14-visual/main.tsx"),
  read("./verify-evolution-phase-three-13-db.sh"),
  read("./verify-evolution-phase-three-12-db.sh"),
]);

test("all Phase 3.1–3.14 point reports and dedicated source-contract suites exist", () => {
  assert.equal(docs.length, 14);
  assert.equal(scripts.length, 14);
  docs.forEach((doc, index) => {
    assert.ok(doc.trim().length > 100, `Phase 3.${index + 1} report must not be empty`);
  });
  scripts.forEach((source, index) => {
    assert.match(source, /\btest\s*\(/, `Phase 3.${index + 1} must expose executable Node tests`);
  });
});

test("the production build executes every Phase 3 suite once, in strict numeric order", () => {
  const build = pkg.scripts.build;
  const executed = [...build.matchAll(/npm run test:evolution-phase-three-(\d+)(?=\s|&&)/g)].map(match => Number(match[1]));
  assert.deepEqual(executed, Array.from({ length: 14 }, (_, index) => index + 1));
  assert.ok(build.indexOf("test:evolution-phase-three-14") < build.indexOf("test:evolution-phase-three-15"));
  assert.ok(build.endsWith("npm run test:evolution-phase-three-15 && vite build"));
  assert.equal(pkg.scripts["test:evolution-phase-three-15"], "node --test scripts/verify-evolution-phase-three-15.mjs");
});

test("earlier phase suites no longer assert a stale Phase 3.14 build-chain endpoint", () => {
  for (const [index, source] of phaseScripts.entries()) {
    assert.doesNotMatch(source, /test:evolution-phase-three-14\\s*&&\\s*vite build/, `Phase 3.${index + 1} contains a stale pre-3.15 build-chain assertion`);
  }
  assert.match(scripts[9], /test:evolution-phase-three-14 && npm run test:evolution-phase-three-15 && vite build/);
  assert.match(scripts[10], /test:evolution-phase-three-14 && npm run test:evolution-phase-three-15 && vite build/);
  assert.match(scripts[11], /test:evolution-phase-three-14 && npm run test:evolution-phase-three-15 && vite build/);
  assert.match(scripts[13], /Phase Three\\.1–3\\.15 Final Acceptance/);
});

test("all applicable Phase 3 PostgreSQL harnesses exist and are wired into CI", () => {
  const pointNumbers = [2,3,4,5,6,7,8,10,11,12,13];
  assert.equal(dbScripts.length, pointNumbers.length);
  for (const point of pointNumbers) {
    assert.match(workflow, new RegExp(`bash scripts/verify-evolution-phase-three-${point}-db\\.sh`), `Phase 3.${point} database harness missing from CI`);
  }
  assert.match(phase12Db, /pg_class/);
  assert.match(phase12Db, /has_function_privilege/);
  assert.match(phase13Db, /Invalid role snapshot unexpectedly created/);
  assert.match(phase13Db, /orphan evaluation context/);
});

test("cross-module and responsive acceptance covers the actual supported viewports and edge cases", () => {
  for (const viewport of ["390", "768", "1024", "1280", "1440"]) assert.ok(phase14Visual.includes(`width: ${viewport}`), `Missing viewport ${viewport}px`);
  assert.match(phase14Visual, /502-row pagination/);
  assert.match(phase14Visual, /Retry loading canonical links/);
  assert.match(phase14Visual, /member-visible evaluation lineage/);
  assert.match(phase14Visual, /retry-recovered\.png/);
  assert.match(phase14Visual, /member-score-access\.png/);
  assert.match(phase14Fixture, /Training Source Session/);
  assert.match(phase14Fixture, /mode === "member"/);
  assert.match(phase14Fixture, /permission denied by row-level security policy/);
});

test("the consolidated workflow runs final acceptance before the full production build", () => {
  assert.match(workflow, /Phase Three\.1–3\.15 Final Acceptance/);
  assert.match(workflow, /EVOLUTION_PHASE_THREE_EXPECTED_HEAD:/);
  assert.match(workflow, /github\.event\.pull_request\.head\.sha \|\| github\.sha/);
  const gate = workflow.indexOf("run: npm run test:evolution-phase-three-15");
  const build = workflow.indexOf("run: npm run build", gate);
  assert.ok(gate >= 0 && build > gate, "final acceptance must run before the full build");
});

test("the final gate rejects missing or stale PR/push event SHAs", async () => {
  const expectedHead = process.env.EVOLUTION_PHASE_THREE_EXPECTED_HEAD;
  if (expectedHead) {
    assert.match(expectedHead, /^[a-f0-9]{40}$/i, "expected head must be a full commit SHA");
    const eventPath = process.env.GITHUB_EVENT_PATH;
    if (eventPath) {
      const event = JSON.parse(await readFile(eventPath, "utf8"));
      const eventHead = event.pull_request?.head?.sha ?? event.after ?? event.head_commit?.id;
      if (eventHead) assert.equal(expectedHead, eventHead, "acceptance SHA must match the event's actual head");
    }
  } else if (process.env.CI === "true") {
    assert.fail("CI must provide EVOLUTION_PHASE_THREE_EXPECTED_HEAD");
  }
});

test("the report preserves production, Training and deployment boundaries", () => {
  assert.match(report, /live Supabase schema\/migration history/i);
  assert.match(report, /Training source sessions/i);
  assert.match(report, /Vercel Preview\/deployment status/i);
  assert.match(report, /No production migration/i);
  assert.match(report, /exact latest PR-head/i);
  assert.match(roadmap, /### 3\.15 Regression, Integration & Final Acceptance/);
});
