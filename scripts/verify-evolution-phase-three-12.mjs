import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const migrationPaths = [
  "../supabase/migrations/20261122130000_evolution_phase_three_2_canonical_dimension_registry.sql",
  "../supabase/migrations/20261122140000_evolution_phase_three_3_evidence_data_model.sql",
  "../supabase/migrations/20261122150000_evolution_phase_three_4_evidence_provenance_verification.sql",
  "../supabase/migrations/20261122160000_evolution_phase_three_5_versioned_rubric_engine.sql",
  "../supabase/migrations/20261122170000_evolution_phase_three_6_role_weight_configuration.sql",
  "../supabase/migrations/20261122180000_evolution_phase_three_7_not_observed_missing_data_rules.sql",
  "../supabase/migrations/20261122190000_evolution_phase_three_8_evidence_coverage_calculator.sql",
  "../supabase/migrations/20261122200000_evolution_phase_three_10_score_snapshot_history.sql",
  "../supabase/migrations/20261122210000_evolution_phase_three_11_atomic_scoring_integrity.sql",
];
const [migrations, dbHarness, packageText, workflow, roadmap, report] = await Promise.all([
  Promise.all(migrationPaths.map(read)),
  read("./verify-evolution-phase-three-12-db.sh"),
  read("../package.json"),
  read("../.github/workflows/evolution-phase-one.yml"),
  read("../docs/evolution/EVOLUTION-PHASE-3-ROADMAP-AND-CHECKPOINT.md"),
  read("../docs/evolution/PHASE-3-12-SECURITY-RLS-PERMISSIONS.md"),
]);
const combined = migrations.join("\n");
const pkg = JSON.parse(packageText);

test("every Phase 3-owned table enables RLS and declares an explicit policy", () => {
  const tables = [...combined.matchAll(/CREATE TABLE IF NOT EXISTS public\.(evolution_[a-z0-9_]+)/gi)].map((m) => m[1]);
  assert.ok(tables.length >= 15, `Expected the complete Phase 3 table inventory; found ${tables.length}`);
  for (const table of tables) {
    const escaped = table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(combined, new RegExp(`ALTER TABLE(?: IF EXISTS)? public\\.${escaped} ENABLE ROW LEVEL SECURITY`, "i"), `${table} must enable RLS`);
    assert.match(combined, new RegExp(`CREATE POLICY [^;]+\\s+ON public\\.${escaped}`, "i"), `${table} must declare an explicit policy`);
  }
});

test("every Phase 3 SECURITY DEFINER function pins an empty search_path", () => {
  const definitions = [...combined.matchAll(/CREATE OR REPLACE FUNCTION\s+([\w.]+)\s*\(([\s\S]*?)\)\s*RETURNS[\s\S]*?AS \$function\$/gi)];
  const privileged = definitions.filter((m) => /SECURITY DEFINER/i.test(m[0].slice(0, m[0].indexOf("AS $function$"))));
  assert.ok(privileged.length >= 20, `Expected trigger/RPC security-definer inventory; found ${privileged.length}`);
  for (const definition of privileged) {
    const header = definition[0].slice(0, definition[0].indexOf("AS $function$"));
    assert.match(header, /SET search_path\s*=\s*''/i, `${definition[1]} must pin search_path`);
  }
});

test("private trigger and lock functions revoke every client execution grant", () => {
  const definitions = [...combined.matchAll(/CREATE OR REPLACE FUNCTION\s+(evolution_private\.[\w]+)\s*\(/gi)];
  const names = [...new Set(definitions.map((m) => m[1]))];
  for (const name of names) {
    const at = combined.indexOf(`REVOKE ALL ON FUNCTION ${name}`);
    assert.ok(at >= 0, `${name} must revoke client execution`);
    assert.match(combined.slice(at, at + 260), /FROM PUBLIC,\s*anon,\s*authenticated/i, `${name} must deny PUBLIC, anon and authenticated direct execution`);
  }
});

test("public SECURITY DEFINER RPCs deny PUBLIC and anon while explicit grants stay deliberate", () => {
  const definitions = [...combined.matchAll(/CREATE OR REPLACE FUNCTION\s+(public\.[\w]+)\s*\(([\s\S]*?)\)\s*RETURNS[\s\S]*?AS \$function\$/gi)];
  const privileged = definitions.filter((m) => /SECURITY DEFINER/i.test(m[0].slice(0, m[0].indexOf("AS $function$"))));
  assert.ok(privileged.length >= 3);
  for (const definition of privileged) {
    const name = definition[1];
    const revokeAt = combined.indexOf(`REVOKE ALL ON FUNCTION ${name}`);
    assert.ok(revokeAt >= 0, `${name} must revoke default execution`);
    assert.match(combined.slice(revokeAt, revokeAt + 320), /FROM PUBLIC,\s*anon/i, `${name} must deny PUBLIC and anon`);
    assert.match(combined, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${name.split(".")[1]}\\([\\s\\S]*?TO authenticated`, "i"), `${name} must have an explicit authenticated grant`);
  }
});

test("Evolution read views run as the caller so underlying RLS remains effective", () => {
  const views = [...combined.matchAll(/CREATE OR REPLACE VIEW\s+public\.(evolution_[\w]+)\s+WITH\s*\(\s*security_invoker\s*=\s*true\s*\)/gi)];
  assert.ok(views.length >= 3, `Expected the complete security-invoker view inventory; found ${views.length}`);
  for (const view of views) {
    assert.match(combined, new RegExp(`GRANT SELECT ON public\\.${view[1]} TO authenticated`, "i"), `${view[1]} must grant read access only to authenticated users`);
  }
});

test("security acceptance rebuilds the isolated Phase 3.2–3.11 dependency chain", () => {
  assert.match(dbHarness, /verify-evolution-phase-three-11-db\.sh/);
  assert.match(dbHarness, /pg_class/);
  assert.match(dbHarness, /relrowsecurity/);
  assert.match(dbHarness, /pg_policies|pg_policy/);
  assert.match(dbHarness, /has_function_privilege/);
  assert.match(dbHarness, /has_function_privilege[(]'authenticated'/);
  assert.match(dbHarness, /anon/);
});

test("security tests reject anonymous policy grants and unsafe definer routines at database level", () => {
  assert.match(dbHarness, /anon.*policy|policy.*anon/i);
  assert.match(dbHarness, /search_path/);
  assert.match(dbHarness, /SECURITY DEFINER/);
  assert.match(dbHarness, /evolution_private/);
  assert.match(dbHarness, /has_table_privilege/);
  assert.match(dbHarness, /has_schema_privilege/);
  assert.match(dbHarness, /security_invoker=true/);
});

test("Phase 3.12 checks are part of the normal build and GitHub Actions workflow", () => {
  assert.equal(pkg.scripts["test:evolution-phase-three-12"], "node --test scripts/verify-evolution-phase-three-12.mjs");
  assert.match(pkg.scripts.build, /test:evolution-phase-three-11 && npm run test:evolution-phase-three-12 && npm run test:evolution-phase-three-13 && npm run test:evolution-phase-three-14 && npm run test:evolution-phase-three-15 && npm run test:evolution-phase-four-1 && vite build/);
  assert.match(workflow, /Verify Evolution Phase Three\.12 security, RLS and permissions against isolated disposable PostgreSQL/);
  assert.match(workflow, /verify-evolution-phase-three-12-db\.sh/);
});

test("the Phase 3.12 report records source-of-truth and production-safety boundaries", () => {
  assert.match(report, /migration source-of-truth/i);
  assert.match(report, /no production migration/i);
  assert.match(report, /RLS/);
  assert.match(roadmap, /Point 3\.12 — Security, RLS & Permissions/);
});
