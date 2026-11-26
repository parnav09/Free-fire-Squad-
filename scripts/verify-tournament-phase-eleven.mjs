import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const pkg = JSON.parse(await read("package.json"));
const app = await read("src/App.tsx");
const component = await read("src/components/TournamentEventRecords.tsx");
const sync = await read("src/lib/tournament-event-sync.ts");
const migration = await read("supabase/migrations/20261126005159_tournament_event_records_cloud_sync.sql");
const indexMigration = await read("supabase/migrations/20261126005619_tournament_event_records_fk_indexes.sql");
const css = await read("src/components/TournamentEventRecords.css");

const phases = Array.from({ length: 10 }, (_, index) => index + 1);
test("All ten completed phase verifiers are present and wired into the release build", async () => {
  for (const phase of phases) {
    const key = `test:tournament-phase-${phase === 1 ? "one" : phase === 2 ? "two" : phase === 3 ? "three" : phase === 4 ? "four" : phase === 5 ? "five" : phase === 6 ? "six" : phase === 7 ? "seven" : phase === 8 ? "eight" : phase === 9 ? "nine" : "ten"}`;
    assert.ok(pkg.scripts[key], `Missing npm script: ${key}`);
    assert.ok(pkg.scripts.build.includes(`npm run ${key}`), `Build does not run ${key}`);
    const file = `scripts/verify-tournament-phase-${["one","two","three","four","five","six","seven","eight","nine","ten"][phase - 1]}.mjs`;
    await read(file);
  }
});
test("Phase 11 runs after Phases 1–10 and before the production bundler", () => {
  const build = pkg.scripts.build;
  const phaseTen = build.indexOf("npm run test:tournament-phase-ten");
  const phaseEleven = build.indexOf("npm run test:tournament-phase-eleven");
  const vite = build.indexOf("vite build");
  assert.ok(phaseTen >= 0 && phaseEleven > phaseTen && vite > phaseEleven);
});
test("Tournament records remain mounted in the main application", () => {
  assert.ok(app.includes('import TournamentEventRecords from "./components/TournamentEventRecords"'));
  assert.ok(app.includes("<TournamentEventRecords"));
});
test("Event creation retains normalized names and strict calendar-date validation", () => {
  assert.ok(component.includes("function normalizeEventName"));
  assert.ok(component.includes("function isValidCalendarDate"));
  assert.ok(component.includes("saveLockRef"));
  assert.ok(component.includes("MAX_EVENT_DAYS"));
});
test("Match recording retains validated placement, points and kill totals", () => {
  assert.ok(component.includes("function saveDayResults"));
  assert.ok(component.includes("placement < 1 || placement > 12"));
  assert.ok(component.includes("placementPoints: getPlacementPoints(placement), kills") && component.includes("getPlacementPoints(placement)"));
  assert.ok(component.includes("Save Day Results"));
});
test("Editing and deletion preserve event-level data safety", () => {
  assert.ok(component.includes("function saveEditedRecord"));
  assert.ok(component.includes("findOriginalDay(draft,index)"));
  assert.ok(component.includes("Reducing match counts will remove saved results"));
  assert.ok(component.includes("function deleteEventRecord"));
  assert.ok(component.includes("This cannot be undone."));
});
test("Team-scoped cloud sync retains revision conflict and deletion safeguards", () => {
  assert.ok(component.includes("${STORAGE_KEY}:${teamId}"));
  assert.ok(sync.includes(".eq(\"revision\", remote.revision)"));
  assert.ok(sync.includes("record.syncRevision !== remote.revision"));
  assert.ok(sync.includes("if (remote.deleted_at)"));
  assert.ok(component.includes("pendingDeletedIdsRef"));
});
test("Cloud persistence remains protected by team membership RLS and indexed foreign keys", () => {
  assert.ok(migration.includes("enable row level security"));
  assert.ok(migration.includes("is_team_member(team_id)"));
  assert.ok(indexMigration.includes("tournament_event_records_created_by_idx"));
  assert.ok(indexMigration.includes("tournament_event_records_updated_by_idx"));
});
test("Offline fallback and explicit legacy import remain available", () => {
  assert.ok(component.includes("Offline · saved on this device"));
  assert.ok(component.includes("Import to this team"));
  assert.ok(component.includes("legacyImportPendingRef"));
});
test("Mobile, keyboard and reduced-motion safeguards remain in the tournament UI", () => {
  assert.ok(css.includes("@media(max-width:680px)"));
  assert.ok(css.includes("@media(max-width:390px)"));
  assert.ok(css.includes("min-height:44px"));
  assert.ok(css.includes(":focus-visible"));
  assert.ok(css.includes("prefers-reduced-motion:reduce"));
});
test("Phase 11 regression gate is itself part of the production build", () => {
  assert.equal(pkg.scripts["test:tournament-phase-eleven"], "node --test scripts/verify-tournament-phase-eleven.mjs");
  assert.ok(pkg.scripts.build.includes("npm run test:tournament-phase-eleven"));
});
