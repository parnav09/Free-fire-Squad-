import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
const [component, styles, sync, app, migration] = await Promise.all([
  read("src/components/TournamentEventRecords.tsx"),
  read("src/components/TournamentEventRecords.css"),
  read("src/lib/tournament-event-sync.ts"),
  read("src/App.tsx"),
  read("supabase/migrations/20261126073500_tournament_event_igl_result_permissions.sql"),
]);

test("Event overview opens one selected day instead of rendering every match inline", () => {
  assert.match(component, /tournament-event-day-select/);
  assert.match(component, /setSelectedDayId\(dayKey\)/);
  assert.match(component, /!selectedDay \? <>/);
  assert.match(component, /Array\.from\(\{length:Math\.max\(0,Number\(selectedDay\.matchCount\)/);
});

test("Day details show the configured date and daily match aggregates", () => {
  assert.match(component, /selectedDay\.date \? formatDate\(selectedDay\.date\)/);
  assert.match(component, /Last updated/);
  assert.match(component, /formatUpdatedAt\(selectedRecord\.updatedAt\)/);
  assert.match(component, /DAY MATCHES/);
  assert.match(component, /TOTAL KILLS/);
  assert.match(component, /PLACEMENT PTS/);
  assert.match(component, /TOTAL POINTS/);
  assert.match(component, /overallStanding/);
});

test("Overall report supports a numeric final standing and combined totals", () => {
  assert.match(component, /FINAL OVERALL STANDING/);
  assert.match(component, /overallPlacement/);
  assert.match(component, /getPlacementPoints\(m\.placement\)\+m\.kills/);
});

test("Only owner, coach, or the separately designated IGL can edit results", () => {
  assert.match(component, /membershipRole === "owner" \|\| membershipRole === "coach"/);
  assert.match(component, /iglUserId === userId/);
  assert.match(component, /disabled=\{!canEditResults\}/);
  assert.match(app, /iglUserId=\{iglUserId\}/);
  assert.match(component, /read-only\. Only the designated IGL, Coach or Owner/);
});

test("Event-level overall standing survives local/cloud synchronization", () => {
  assert.match(sync, /overallPlacement\?: number \| null/);
  assert.match(sync, /overallPlacement: record\.overallPlacement \?\? null/);
  assert.match(sync, /overallPlacement: row\.event_data\?\.overallPlacement \?\? null/);
});

test("Save feedback auto-dismisses and returns the user to the workspace top", () => {
  assert.match(component, /window\.setTimeout\(\(\) => setMatchSaveMessage/);
  assert.match(component, /scrollIntoView\(\{ behavior: "smooth", block: "start" \}\)/);
});

test("Database update policy authorizes owner, coach, or designated IGL", () => {
  assert.match(migration, /tournament_event_records_update_igl_manager/);
  assert.match(migration, /tm\.membership_role in \('owner', 'coach'\)/);
  assert.match(migration, /ts\.setting_key = 'igl_user_id'/);
  assert.match(migration, /with check/);
  assert.match(migration, /tournament_event_records_delete_manager/);
});

test("Day dashboard styling remains responsive and keyboard-visible", () => {
  assert.match(styles, /\.tournament-event-last-updated/);
  assert.match(styles, /\.tournament-event-day-select:focus-visible/);
  assert.match(styles, /@media\(max-width:520px\)/);
});
