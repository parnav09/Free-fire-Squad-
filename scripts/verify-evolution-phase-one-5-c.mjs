import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const manifest = JSON.parse(await readFile(new URL("../docs/evolution/evolution-phase-one-5-c-rollback-manifest.json", import.meta.url), "utf8"));
const report = await readFile(new URL("../docs/evolution/E-PHASE-ONE-5-C-ROLLBACK-REGISTER.md", import.meta.url), "utf8");

test("E Phase One.5-C: disposition manifest covers exactly 53 in-scope historical versions", () => {
  assert.equal(manifest.entries.length, 53);
  assert.equal(new Set(manifest.entries.map((entry) => entry.version)).size, 53);
  assert.equal(manifest.live_rollback_statement_count, 0);
  assert.deepEqual(manifest.excluded_versions, ["20261116115255", "20261116115907"]);
});

test("E Phase One.5-C: every historical migration has a reasoned forward-only disposition", () => {
  for (const entry of manifest.entries) {
    assert.match(entry.version, /^2026\d{10}$/);
    assert.match(entry.name, /^[a-z0-9_]+$/);
    assert.equal(entry.disposition, "forward_only_no_automatic_rollback", entry.version);
    assert.ok(entry.risk_class.length > 0, entry.version);
    assert.ok(entry.reason.length >= 30, entry.version);
  }
});

test("E Phase One.5-C: every declared risk class has an explicit recovery rule", () => {
  for (const riskClass of new Set(manifest.entries.map((entry) => entry.risk_class))) {
    assert.ok(report.includes(`\`${riskClass}\``), `Missing handling for risk class: ${riskClass}`);
  }
});

test("E Phase One.5-C: duplicate migration names remain distinct versioned records", () => {
  const duplicates = manifest.entries.filter((entry) => entry.name === "daily_score_feedback_private_rls");
  assert.deepEqual(duplicates.map((entry) => entry.version), ["20261109034550", "20261109034618"]);
});

test("E Phase One.5-C: register explicitly prohibits destructive fabricated inverses and ledger rewrites", () => {
  assert.match(report, /Never delete, rewrite, or renumber a row/);
  assert.match(report, /Never DROP TABLE/);
  assert.match(report, /Retention\/cleanup migrations are intrinsically non-restorable/);
  assert.match(report, /53\/53 in-scope historical migrations explicitly classified/);
});

test("E Phase One.5-C: loadout rows remain excluded and B staged rollback is not misreported as historical", () => {
  assert.match(report, /20261116115255/);
  assert.match(report, /20261116115907/);
  assert.match(report, /not counted as a historical rollback/);
});
