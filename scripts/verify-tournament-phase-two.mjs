import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
const records = await readFile(new URL("../src/components/TournamentEventRecords.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../src/components/TournamentEventRecords.css", import.meta.url), "utf8");
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

test("Event mode renders its dedicated records workspace without altering Weekly mode", () => {
  assert.match(app, /import TournamentEventRecords from "\.\/components\/TournamentEventRecords"/);
  assert.match(app, /tournamentMode === "Weekly" \? <>/);
  assert.match(app, /<TournamentEventRecords\\b[^>]*\\/>/);
  assert.doesNotMatch(app, /Custom tournaments are coming next/);
});

test("Records workspace retains the empty state and Add Record entry point", () => {
  assert.match(records, /No Records/);
  assert.match(records, /Add Record/);
  assert.match(records, /onClick=\{openCreateModal\}/);
});

test("More and Show Less only appear when records exceed the initial page", () => {
  assert.match(records, /INITIAL_VISIBLE_RECORDS = 4/);
  assert.match(records, /const hasMore = records\.length > INITIAL_VISIBLE_RECORDS/);
  assert.match(records, /\{hasMore && \(/);
  assert.match(records, /expanded \? "Show Less"/);
  assert.match(records, /records\.slice\(0, INITIAL_VISIBLE_RECORDS\)/);
});

test("Records are read defensively and refresh across tabs and same-app events", () => {
  assert.match(records, /window\.localStorage\.getItem\(STORAGE_KEY\)/);
  assert.match(records, /window\.addEventListener\("storage"/);
  assert.match(records, /squad-os:event-records-updated/);
  assert.match(records, /Array\.isArray\(parsed\)/);
});

test("Records UI remains responsive and keyboard accessible", () => {
  assert.match(styles, /@media\(max-width:620px\)/);
  assert.match(styles, /:focus-visible/);
  assert.match(records, /aria-labelledby="tournament-event-records-title"/);
  assert.match(records, /role="status"/);
});

test("Phase 2 regression test remains in the production build chain", () => {
  assert.equal(packageJson.scripts["test:tournament-phase-two"], "node --test scripts/verify-tournament-phase-two.mjs");
  assert.match(packageJson.scripts.build, /npm run test:tournament-phase-two/);
});
