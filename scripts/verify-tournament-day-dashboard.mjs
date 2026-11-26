import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
const [component, styles, sync, app, migration, pickerStyles] = await Promise.all([
  read("src/components/TournamentEventRecords.tsx"),
  read("src/components/TournamentEventRecords.css"),
  read("src/lib/tournament-event-sync.ts"),
  read("src/App.tsx"),
  read("supabase/migrations/20261126073500_tournament_event_igl_result_permissions.sql"),
  read("src/components/PlacementPicker.css"),
]);

test("Opening a day switches to a dedicated day-detail page view", () => {
  assert.match(component, /setSelectedDayId\(dayKey\)/);
  assert.match(component, /is-day-detail/);
  assert.match(styles, /is-day-detail.*tournament-event-records-head/);
  assert.match(component, /selectedDay\.date \? formatDate\(selectedDay\.date\)/);
});

test("Day dashboard keeps date, standing, and all daily aggregate metrics", () => {
  assert.match(component, /DAY MATCHES/);
  assert.match(component, /TOTAL KILLS/);
  assert.match(component, /PLACEMENT PTS/);
  assert.match(component, /TOTAL POINTS/);
  assert.match(component, /overallStanding/);
});

test("Day result entry mirrors Tournament/Scrims champion-only gold placement", () => {
  assert.match(component, /saved\?\.placement === 1 \? " is-champion" : ""/);
  assert.doesNotMatch(component, /draft\.placement === "1" \? " is-champion" : ""/);
  assert.match(styles, /\.tournament-event-day-save-bar button\{[^}]*#2c5068[^}]*#12364b/s);
  assert.doesNotMatch(styles, /\.tournament-event-day-save-bar button\{[^}]*#d4ad5d/s);
  assert.match(pickerStyles, /\.match-card-top1 \.scrims-placement-trigger/);
  assert.match(styles, /\.tournament-event-match-card\.is-champion \.scrims-placement-trigger/);
  assert.match(styles, /\.tournament-event-match-card\.is-champion \.scrims-placement-menu button\.is-selected/);
});

test("All match results are validated and persisted together through one day save action", () => {
  assert.match(component, /function saveDayResults\(/);
  assert.match(component, /Select placement for Match/);
  assert.match(component, /const kills = draft\.kills\.trim\(\) === "" \? 0 : Number\(draft\.kills\)/);
  assert.match(component, /Save Day Results/);
  assert.doesNotMatch(component, /Save Result/);
  assert.doesNotMatch(component, /saveMatchResult\(/);
});

test("Kills start blank and blank kills are saved as zero", () => {
  assert.match(component, /kills: saved\?\.kills \? String\(saved\.kills\) : ""/);
  assert.match(component, /draft\.kills\.trim\(\) === "" \? 0 : Number\(draft\.kills\)/);
});

test("Successful save stays on the day page and scrolls to its top", () => {
  assert.match(component, /Day results saved\./);
  assert.match(component, /tournament-event-day-detail-top.*scrollIntoView/);
  assert.match(component, /setSelectedDayId\(null\)/);
});

test("Only owner, coach, or designated IGL can edit day results", () => {
  assert.match(component, /membershipRole === "owner" \|\| membershipRole === "coach"/);
  assert.match(component, /iglUserId === userId/);
  assert.match(component, /disabled=\{!canEditResults\}/);
  assert.match(app, /iglUserId=\{iglUserId\}/);
  assert.match(component, /read-only\. Only the designated IGL, Coach or Owner/);
});

test("Event standing data remains part of local/cloud synchronization", () => {
  assert.match(sync, /overallPlacement\?: number \| null/);
  assert.match(sync, /overallPlacement: record\.overallPlacement \?\? null/);
  assert.match(sync, /overallPlacement: row\.event_data\?\.overallPlacement \?\? null/);
});

test("Existing records and match IDs are reused during an all-day save", () => {
  assert.match(component, /id: existing\?\.id \|\| createId\(\)/);
  assert.match(component, /filter\(match => match\.matchNumber > matchCount\)/);
});

test("Responsive day save and golden controls remain touch and keyboard accessible", () => {
  assert.match(styles, /@media\(max-width:620px\).*tournament-event-day-save-bar/s);
  assert.match(styles, /\.tournament-event-day-save-bar button:focus-visible/);
  assert.match(styles, /@media\(prefers-reduced-motion:reduce\)/);
});
