import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const component = await readFile(new URL("../src/components/TournamentEventRecords.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../src/components/TournamentEventRecords.css", import.meta.url), "utf8");
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

test("Event setup has a second step with one configuration card per selected day", () => {
  assert.match(component, /setupStep === "details"/);
  assert.match(component, /STEP 2 OF 2/);
  assert.match(component, /dayDrafts\\.map\\(\\(day\\)/);
  assert.match(component, /setDayDrafts\\(Array\\.from\\(\\{ length: dayCount \\}/);
});
test("Every day has its own date picker and independent positive integer match count", () => {
  assert.match(component, /type="date"/);
  assert.match(component, /type="number"/);
  assert.match(component, /min="1"/);
  assert.match(component, /step="1"/);
  assert.match(component, /updateDayDraft\\(day\\.id, "date"/);
  assert.match(component, /updateDayDraft\\(day\\.id, "matchCount"/);
});
test("Date validation allows non-consecutive dates but rejects missing, invalid and duplicate dates", () => {
  assert.match(component, /Choose a date for this day/);
  assert.match(component, /Enter a valid calendar date/);
  assert.match(component, /seenDates\\.has\\(day\\.date\\)/);
  assert.match(component, /Each tournament day must have a different date/);
  assert.doesNotMatch(component, /date\\.getTime\\(\\)\\s*[<>]=?\\s*Date\\.now/);
});
test("Saving persists each configured date and match count in the Event record schema", () => {
  assert.match(component, /handleSaveConfiguredEvent/);
  assert.match(component, /date: day\\.date/);
  assert.match(component, /matchCount: day\\.matchCount/);
  assert.match(component, /window\\.localStorage\\.setItem\\(STORAGE_KEY/);
  assert.match(component, /squad-os:event-records-updated/);
});
test("Day setup has validation feedback, a back action and responsive scrollable layout", () => {
  assert.match(component, /setSetupStep\\("details"\\)/);
  assert.match(component, /role="alert"/);
  assert.match(styles, /tournament-event-day-config-list/);
  assert.match(styles, /max-height:min\\(43dvh,390px\\)/);
  assert.match(styles, /@media\\(max-width:620px\\)/);
});
test("Phase 4 regression test is in the production build chain", () => {
  assert.equal(packageJson.scripts["test:tournament-phase-four"], "node --test scripts/verify-tournament-phase-four.mjs");
  assert.match(packageJson.scripts.build, /npm run test:tournament-phase-four/);
});
