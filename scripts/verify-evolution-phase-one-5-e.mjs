import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const [
  pkgText,
  acceptance,
  audit,
  rollbackRegister,
  phaseOne,
  dSuite,
  securityReview,
  workflow,
  bDbScript,
  securityAclScript,
  securityAclSql,
] = await Promise.all([
  read("package.json"),
  read("docs/evolution/E-PHASE-ONE-5-B-C-D-E-ACCEPTANCE.md"),
  read("docs/evolution/E-PHASE-ONE-5-E-FINAL-AUDIT.md"),
  read("docs/evolution/E-PHASE-ONE-5-C-ROLLBACK-REGISTER.md"),
  read("docs/evolution/evolution-phase-one.md"),
  read("scripts/verify-evolution-phase-one-5-d.mjs"),
  read("docs/evolution/E-PHASE-ONE-5-E-SECURITY-REVIEW.md"),
  read(".github/workflows/evolution-phase-one.yml"),
  read("scripts/verify-evolution-phase-one-5-b-db.sh"),
  read("scripts/verify-evolution-security-trigger-acls.sh"),
  read("docs/evolution/staged-migrations/20261118080000_revoke_direct_trigger_function_execution.sql"),
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
  assert.ok(audit.includes("0 stored rollback statements"));
  assert.ok(audit.includes("53 in-scope"));
});

test("E final audit carries exact-head full CI and database evidence", () => {
  assert.match(audit, /run #352/i);
  assert.ok(audit.includes("44276950260"));
  assert.ok(audit.includes("0a24ce6fd9811ef53b0e8d39b3dbd54597fe4426"));
  assert.ok(audit.includes("44276957631"));
  assert.match(audit, /B.*PASS.*CI database verified/i);
  assert.match(audit, /E audit integrity.*PASS.*CI verified/i);
  assert.match(dSuite, /E Phase One\.5-D/);
});

test("B database forward and rollback integration checks are wired into CI", () => {
  assert.match(workflow, /Install and start disposable local PostgreSQL|image: postgres:16/);
  assert.match(workflow, /bash scripts\/verify-evolution-phase-one-5-b-db\.sh/);
  assert.match(bDbScript, /default\/legacy timezone normalization failed/);
  assert.match(bDbScript, /non-India timezone was accepted/);
  assert.match(bDbScript, /blank timezone was accepted/);
  assert.match(bDbScript, /restore-path normalization failed/);
  assert.match(bDbScript, /existing Daily Evaluation trigger was changed/);
  assert.match(bDbScript, /rollback removed the existing Daily Evaluation policy/);
  assert.ok(audit.includes("B's isolated database contract"));
});

test("security ACL fix is least-privilege and preserves trigger execution", () => {
  assert.match(workflow, /bash scripts\/verify-evolution-security-trigger-acls\.sh/);
  assert.match(securityAclSql, /FROM PUBLIC, anon, authenticated, service_role/);
  assert.match(securityAclScript, /has_function_privilege/);
  assert.match(securityAclScript, /Daily Evaluation trigger stopped working/);
  assert.match(securityReview, /intentional private storage/i);
  assert.match(securityReview, /four trigger-returning functions/i);
  assert.match(securityReview, /Leaked-password protection/i);
  assert.match(audit, /staged trigger-function ACL remediation/i);
});

test("E records the remaining clean-replay and Auth gates instead of falsely passing", () => {
  assert.match(acceptance, /Isolated clean replay\s*\|\s*Not run/i);
  assert.match(acceptance, /Full Phase One acceptance\s*\|\s*\*\*NOT PASSED\*\*/);
  assert.match(audit, /FINAL ACCEPTANCE: BLOCKED \/ NOT PASSED/);
  assert.match(audit, /no original pre-migration schema baseline/i);
  assert.match(audit, /leaked-password protection remains disabled/i);
  assert.match(securityReview, /Overall Security acceptance (?:is not PASS yet|remains PARTIAL)/i);
});

test("E final audit keeps production, merge and loadout scope boundaries explicit", () => {
  assert.match(acceptance, /does not authorize a production migration/i);
  assert.match(audit, /PR #115 remains open, draft, and unmerged/i);
  assert.match(audit, /No production deployment or merge was performed/i);
  assert.deepEqual(manifest.excluded_versions, ["20261116115255", "20261116115907"]);
  assert.match(phaseOne, /Phase One\.5-C historical rollback disposition is COMPLETE/i);
});
