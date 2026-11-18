import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const [pkgText, forward, rollback, baseSuite, bSuite, cSuite, acceptance] = await Promise.all([
  read("package.json"),
  read("docs/evolution/staged-migrations/20261118070000_team_timezone_contract.sql"),
  read("docs/evolution/staged-migrations/20261118070000_team_timezone_contract.rollback.sql"),
  read("scripts/verify-evolution-phase-one-5.mjs"),
  read("scripts/verify-evolution-phase-one-5-b.mjs"),
  read("scripts/verify-evolution-phase-one-5-c.mjs"),
  read("docs/evolution/E-PHASE-ONE-5-B-C-D-E-ACCEPTANCE.md"),
]);
const pkg = JSON.parse(pkgText);
const manifest = JSON.parse(await read("docs/evolution/evolution-phase-one-5-c-rollback-manifest.json"));
const register = await read("docs/evolution/E-PHASE-ONE-5-C-ROLLBACK-REGISTER.md");

test("E Phase One.5-D: full build runs the base, B, C and D verification suites", () => {
  assert.equal(pkg.scripts["test:evolution-phase-one-5-d"], "node --test scripts/verify-evolution-phase-one-5-d.mjs");
  for (const script of [
    "npm run typecheck",
    "npm run test:evolution-phase-one-5",
    "npm run test:evolution-phase-one-5-b",
    "npm run test:evolution-phase-one-5-c",
    "npm run test:evolution-phase-one-5-d",
    "vite build",
  ]) assert.ok(pkg.scripts.build.includes(script), "build is missing: " + script);
});

test("E Phase One.5-D: B verification covers IST-only validation, locked evaluation date and midnight boundary", () => {
  for (const expected of [
    "India-only timezone contract accepts IST and its legacy alias only",
    "India date key flips exactly at 00:00 IST",
    "Daily Evaluation auto-selects and locks the India date without a date input",
  ]) assert.ok(bSuite.includes(expected), "B suite missing: " + expected);
  assert.ok(forward.includes("NEW.timezone IN ('UTC', 'Asia/Calcutta')"));
  assert.ok(forward.includes("Unsupported team timezone"));
  assert.ok(forward.includes("NEW.timezone := 'Asia/Kolkata'"));
});

test("E Phase One.5-D: C verification covers all 53 dispositions and the excluded loadout entries", () => {
  assert.equal(manifest.entries.length, 53);
  assert.equal(new Set(manifest.entries.map((entry) => entry.version)).size, 53);
  assert.deepEqual(manifest.excluded_versions, ["20261116115255", "20261116115907"]);
  assert.equal(manifest.live_rollback_statement_count, 0);
  assert.ok(cSuite.includes("exactly 53 in-scope historical versions"));
  assert.ok(register.includes("53/53 in-scope historical migrations explicitly classified"));
});

test("E Phase One.5-D: B forward SQL leaves Daily Evaluation data, trigger and RLS policy unchanged", () => {
  assert.doesNotMatch(forward, /UPDATE\s+public\.daily_scores/i);
  assert.doesNotMatch(forward, /CREATE\s+TRIGGER[\s\S]*?daily_scores/i);
  assert.doesNotMatch(forward, /ALTER\s+POLICY\s+ds_insert/i);
  assert.ok(forward.includes("Daily Evaluation trigger/RLS and all historical score rows remain untouched"));
});

test("E Phase One.5-D: B rollback removes only the trigger and function created by B", () => {
  assert.ok(rollback.includes("DROP TRIGGER IF EXISTS teams_validate_timezone ON public.teams"));
  assert.ok(rollback.includes("DROP FUNCTION IF EXISTS public.validate_team_timezone();"));
  assert.equal((rollback.match(/\bDROP\b/gi) ?? []).length, 2);
  assert.doesNotMatch(rollback, /daily_scores|ALTER\s+POLICY|DROP\s+TABLE/i);
});

test("E Phase One.5-D: source-contract verification never claims isolated database or production acceptance", () => {
  assert.ok(acceptance.includes("source-contract tests, not a database integration test"));
  assert.ok(acceptance.toLowerCase().includes("isolated database execution"));
  assert.ok(/No production migration or deployment was performed|No production migration will be applied|no production migration is applied/i.test(acceptance));
  assert.ok(baseSuite.includes("staged SQL is not silently promoted"));
});
