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
  rpcTestReport,
  workflow,
  bDbScript,
  securityAclScript,
  securityAclSql,
  membershipGuardMigration,
  membershipGuardScript,
  currentAcceptance,
  historicalBaseline,
] = await Promise.all([
  read("package.json"),
  read("docs/evolution/E-PHASE-ONE-5-B-C-D-E-ACCEPTANCE.md"),
  read("docs/evolution/E-PHASE-ONE-5-E-FINAL-AUDIT.md"),
  read("docs/evolution/E-PHASE-ONE-5-C-ROLLBACK-REGISTER.md"),
  read("docs/evolution/evolution-phase-one.md"),
  read("scripts/verify-evolution-phase-one-5-d.mjs"),
  read("docs/evolution/E-PHASE-ONE-5-E-SECURITY-REVIEW.md"),
  read("docs/evolution/E-PHASE-ONE-5-E-ADVERSARIAL-RPC-TESTS.md"),
  read(".github/workflows/evolution-phase-one.yml"),
  read("scripts/verify-evolution-phase-one-5-b-db.sh"),
  read("scripts/verify-evolution-security-trigger-acls.sh"),
  read("docs/evolution/staged-migrations/20261118080000_revoke_direct_trigger_function_execution.sql"),
  read("supabase/migrations/20261122000000_phase_one_membership_update_guard.sql"),
  read("scripts/verify-evolution-phase-one-membership-acl.sh"),
  read("docs/evolution/E-PHASE-ONE-CURRENT-ACCEPTANCE-ADDENDUM-2026-11-22.md"),
  read("docs/evolution/E-PHASE-ONE-5-E-HISTORICAL-BASELINE-VERIFICATION.md"),
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
  assert.match(workflow, /image: postgres:16/);
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
  assert.match(securityReview, /Overall Security acceptance remains PARTIAL/i);
});

test("historical live-project RPC checks are not misreported as isolated Gate C acceptance", () => {
  assert.match(rpcTestReport, /connected FF Squad Supabase project/);
  assert.match(rpcTestReport, /SET LOCAL ROLE authenticated/);
  assert.match(rpcTestReport, /ROLLBACK/);
  assert.match(rpcTestReport, /team_join_requests.*0 rows/s);
  assert.match(securityReview, /18 callable function signatures passed/);
  assert.match(audit, /18 callable authenticated SECURITY DEFINER signatures/);
  assert.match(currentAcceptance, /Gate C.*BLOCKED/i);
  assert.match(currentAcceptance, /has not been executed in this audit/i);
  assert.match(currentAcceptance, /isolated disposable database/i);
});

test("current baseline and external Auth blockers remain explicit", () => {
  assert.match(historicalBaseline, /PARTIAL \/ BLOCKED/i);
  assert.match(historicalBaseline, /Historical replay executed: 0\/53/);
  assert.match(currentAcceptance, /Gate A.*BLOCKED/i);
  assert.match(currentAcceptance, /Gate B.*OWNER ACTION REQUIRED/i);
  assert.match(currentAcceptance, /Gate C remains blocked/i);
  assert.match(currentAcceptance, /PHASE 1 IMPLEMENTATION COMPLETE — ACCEPTANCE PENDING/);
});

test("Phase One membership authorization migration limits UPDATE to character_loadout and adds an owner-checked RPC", () => {
  assert.match(membershipGuardMigration, /REVOKE UPDATE ON TABLE public\.team_members FROM PUBLIC, anon, authenticated/);
  assert.match(membershipGuardMigration, /GRANT UPDATE \(character_loadout\) ON TABLE public\.team_members TO authenticated/);
  assert.match(membershipGuardMigration, /SECURITY DEFINER[\s\S]*SET search_path TO 'pg_catalog', 'public'/);
  assert.match(membershipGuardMigration, /public\.is_team_owner\(v_team_id\)/);
  assert.match(membershipGuardMigration, /public\.assign_member\(p_member, p_player/);
  assert.match(membershipGuardMigration, /REVOKE ALL ON FUNCTION public\.set_member_assignment/);
  assert.match(membershipGuardScript, /membership_role update was not denied/);
  assert.match(membershipGuardScript, /non-owner assignment RPC was not denied/);
  assert.match(membershipGuardScript, /own character_loadout update was not preserved/);
  assert.match(membershipGuardScript, /owner assignment failed or changed protected membership identity/);
  assert.match(workflow, /bash scripts\/verify-evolution-phase-one-membership-acl\.sh/);
});

test("E final audit keeps production, merge and loadout scope boundaries explicit", () => {
  assert.match(acceptance, /does not authorize a production migration/i);
  assert.match(audit, /PR #115 remains open, draft, and unmerged/i);
  assert.match(audit, /No production deployment or merge was performed/i);
  assert.deepEqual(manifest.excluded_versions, ["20261116115255", "20261116115907"]);
  assert.match(phaseOne, /Phase One\.5-C historical rollback disposition is COMPLETE/i);
});

