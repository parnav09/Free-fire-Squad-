import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const component = await readFile(new URL("../src/components/TournamentEventRecords.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../src/components/TournamentEventRecords.css", import.meta.url), "utf8");
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

test("Event setup has a second step with one configuration card per selected day", () => {
  assert.ok(component.includes('setupStep === "details"'));
  assert.ok(component.includes("STEP 2 OF 2"));
  assert.ok(component.includes("dayDrafts.map((day)"));
  assert.ok(component.includes("Array.from({ length: dayCount }"));
});
test("Every day has its own date picker and independent positive integer match count", () => {
  assert.ok(component.includes('type="date"'));
  assert.ok(component.includes('type="number"'));
  assert.ok(component.includes('min="1"'));
  assert.ok(component.includes('step="1"'));
  assert.ok(component.includes('updateDayDraft(day.id, "date"'));
  assert.ok(component.includes('updateDayDraft(day.id, "matchCount"'));
});
test("Date validation permits non-consecutive dates but rejects missing, invalid and duplicate dates", () => {
  assert.ok(component.includes("Choose a date for this day."));
  assert.ok(component.includes("Enter a valid calendar date."));
  assert.ok(component.includes("dates.has(day.date)"));
  assert.ok(component.includes("Each tournament day must have a different date."));
  assert.ok(!component.includes("date.getTime() < Date.now()"));
});
test("Saving persists each configured date and match count in the Event record schema", () => {
  assert.ok(component.includes("handleSaveConfiguredEvent"));
  assert.ok(component.includes("date:d.date"));
  assert.ok(component.includes("matchCount:d.matchCount"));
  assert.ok(component.includes("window.localStorage.setItem(activeStorageKey"));
  assert.ok(component.includes("squad-os:event-records-updated"));
});
test("Day setup has validation feedback, a back action and responsive scrollable layout", () => {
  assert.ok(component.includes('setSetupStep("details")'));
  assert.ok(component.includes('role="alert"'));
  assert.ok(styles.includes("tournament-event-day-config-list"));
  assert.ok(styles.includes("max-height:min(43dvh,390px)"));
  assert.ok(styles.includes("@media(max-width:620px)"));
});
test("Phase 4 regression test is included in the production build chain", () => {
  assert.equal(packageJson.scripts["test:tournament-phase-four"], "node --test scripts/verify-tournament-phase-four.mjs");
  assert.ok(packageJson.scripts.build.includes("npm run test:tournament-phase-four"));
});
