import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const [pkgText, acceptance, audit, rollbackRegister, phaseOne, dSuite] = await Promise.all([
  read("package.json"),
  read("docs/evolution/E-PHASE-ONE-5-B-C-D-E-ACCEPTANCE.md"),
  read("docs/evolution/E-PHASE-ONE-5-E-FINAL-AUDIT.md"),
  read("docs/evolution/E-PHASE-ONE-5-C-ROLLBACK-REGISTER.md"),
  read("docs/evolution/evolution-phase-one.md"),
  read("scripts/verify-evolution-phase-one-5-d.mjs"),
]);
const pkg = JSON.parse(pkgText);
const manifest = JSON.parse(await read("docs/evolution/evolution-phase-one-5-c-rollback-manifest.json"));

test("E final audit is included in the standard build gate", () => {
  assert.equal(pkg.scripts["test:evolution-phase-one-5-e"], "node --test scripts/verify-evolution-phase-one-5-e.mjs");
  assert.ok(pkg.scripts.build.includes("npm run test:evolution-phase-one-5-d"));
  assert.ok(pkg.scripts.build.includes("npm run test:evolution-phase-one-5-e"));
  assert.ok(pkg.scripts.build.includes("vite build"));
});

test("E final audit preserves the 53-entry historical provenance and rollback evidence", () => {
  assert.equal(manifest.entries.length, 53);
  assert.equal(new Set(manifest.entries.map((entry) => entry.version)).size, 53);
  assert.deepEqual(manifest.excluded_versions, ["20261116115255", "20261116115907"]);
  assert.equal(manifest.live_rollback_statement_count, 0);
  assert.ok(rollbackRegister.includes("53/53"));
  assert.ok(rollbackRegister.includes("forward-only"));
  assert.ok(audit.includes("55 live migration rows"));
  assert.ok(audit.includes("53 in-scope"));
  assert.ok(audit.includes("0 stored rollback statements"));
});

test("E final audit carries forward the latest exact-head D CI evidence", () => {
  assert.ok(audit.includes("Run #284"));
  assert.ok(audit.includes("0de4ecc9dfd450f8cb2be87bed0cbf299965813b"));
  assert.ok(audit.includes("D suite: 6/6"));
  assert.ok(dSuite.includes("E Phase One.5-D"));
});

test("E cannot be marked PASS while isolated timezone execution and baseline replay are unverified", () => {
  assert.match(acceptance, /Isolated clean replay\s*\|\s*Not run/i);
  assert.match(acceptance, /Runtime timezone\/RLS verification\s*\|\s*Not run/i);
  assert.match(acceptance, /Full Phase One acceptance\s*\|\s*\*\*NOT PASSED\*\*/);
  assert.match(audit, /FINAL ACCEPTANCE: BLOCKED \/ NOT PASSED/);
  assert.match(audit, /pre-migration baseline is unavailable/i);
  assert.match(audit, /staged B forward\/rollback SQL has not been executed/i);
});

test("E final audit keeps production, merge and loadout scope boundaries explicit", () => {
  assert.match(acceptance, /does not authorize a production migration/i);
  assert.match(audit, /PR #115 remains open, draft, and unmerged/i);
  assert.match(audit, /No production migration or deployment was performed/i);
  assert.deepEqual(manifest.excluded_versions, ["20261116115255", "20261116115907"]);
  assert.match(phaseOne, /Phase One\.5-C historical rollback disposition is COMPLETE/i);
});
