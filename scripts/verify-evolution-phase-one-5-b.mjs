import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const identitySource = await readFile(new URL("../src/lib/evolution-identity.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(identitySource, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const identity = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));
const appSource = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
const migration = await readFile(new URL("../docs/evolution/staged-migrations/20261118070000_team_timezone_contract.sql", import.meta.url), "utf8");

test("India-only timezone contract accepts IST and its legacy alias only", () => {
  assert.equal(identity.isValidTeamTimezone("Asia/Kolkata"), true);
  assert.equal(identity.isValidTeamTimezone("Asia/Calcutta"), true);
  assert.equal(identity.isValidTeamTimezone("UTC"), false);
  assert.equal(identity.isValidTeamTimezone("America/Los_Angeles"), false);
  assert.equal(identity.isValidTeamTimezone("Europe/London"), false);
  assert.equal(identity.isValidTeamTimezone(" Asia/Kolkata"), false);
});

test("India date key flips exactly at 00:00 IST", () => {
  assert.equal(identity.indiaDateISO(new Date("2026-11-17T18:29:59.000Z")), "2026-11-17");
  assert.equal(identity.indiaDateISO(new Date("2026-11-17T18:30:00.000Z")), "2026-11-18");
  assert.equal(identity.teamDateISO(new Date("2026-11-17T18:30:00.000Z"), "Asia/Calcutta"), "2026-11-18");
});

test("India date display uses the requested English international format", () => {
  assert.equal(identity.indiaDateLabel(new Date("2026-11-17T18:30:00.000Z")), "November 18th 2026");
  assert.equal(identity.indiaDateLabel(new Date("2026-11-19T18:30:00.000Z")), "November 20th 2026");
  assert.equal(identity.indiaDateLabel(new Date("2026-11-20T18:30:00.000Z")), "November 21st 2026");
});

test("midnight refresh is scheduled for India midnight, not device-local midnight", () => {
  assert.equal(identity.millisecondsUntilIndiaMidnight(new Date("2026-11-17T18:29:59.000Z")), 1000);
  assert.equal(identity.millisecondsUntilIndiaMidnight(new Date("2026-11-17T18:30:00.000Z")), 24 * 60 * 60 * 1000);
  assert.throws(() => identity.indiaDateISO(new Date("invalid")), RangeError);
});

test("Daily Evaluation auto-selects and locks the India date without a date input", () => {
  assert.match(appSource, /useState\(\(\)=>\(\{iso:indiaDateISO\(\),label:indiaDateLabel\(\)\}\)\)/);
  assert.match(appSource, /millisecondsUntilIndiaMidnight\(now\)/);
  assert.match(appSource, /Today's evaluation · \{evalDateLabel\}/);
  assert.match(appSource, /India date · UTC\+05:30 · auto-selected and locked for today/);
  const start = appSource.indexOf('{section==="Evaluation" && <>');
  const end = appSource.indexOf('{section==="Assignments" && <>', start);
  const evaluation = appSource.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(evaluation, /type=["']date["']/);
  assert.match(appSource, /\.eq\("score_date",evalDate\)/);
  assert.match(appSource, /score_date:evalDate/);
});

test("staged database migration defaults new teams to IST and rejects non-India zones", () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.validate_team_timezone\(\)/);
  assert.match(migration, /CREATE TRIGGER teams_validate_timezone/);
  assert.match(migration, /NEW\.timezone IN \('UTC', 'Asia\/Calcutta'\)/);
  assert.match(migration, /NEW\.timezone := 'Asia\/Kolkata'/);
  assert.match(migration, /Unsupported team timezone/);
  assert.match(migration, /unsupported team timezone values exist/);
  assert.match(migration, /UPDATE public\.teams[\s\S]*WHERE timezone = 'Asia\/Calcutta'/);
});

test("staged migration does not rewrite daily scores or alter their existing trigger/RLS contract", () => {
  assert.doesNotMatch(migration, /UPDATE\s+public\.daily_scores/i);
  assert.doesNotMatch(migration, /ALTER\s+POLICY\s+ds_insert/i);
  assert.doesNotMatch(migration, /CREATE\s+TRIGGER.*daily_scores/is);
  assert.match(migration, /Daily Evaluation trigger\/RLS and all historical score rows remain untouched/);
});
