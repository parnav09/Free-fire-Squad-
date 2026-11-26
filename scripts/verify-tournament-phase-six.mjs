import test from "node:test";import assert from "node:assert/strict";import{readFile}from"node:fs/promises";
const c=await readFile(new URL("../src/components/TournamentEventRecords.tsx",import.meta.url),"utf8"),css=await readFile(new URL("../src/components/TournamentEventRecords.css",import.meta.url),"utf8"),p=JSON.parse(await readFile(new URL("../package.json",import.meta.url),"utf8"));
const app=await readFile(new URL("../src/App.tsx",import.meta.url),"utf8"),shell=await readFile(new URL("../src/app/WorkspaceShell.tsx",import.meta.url),"utf8"),scrims=await readFile(new URL("../src/components/ScrimsSection.tsx",import.meta.url),"utf8"),pets=await readFile(new URL("../src/components/PetDatabase.tsx",import.meta.url),"utf8"),characters=await readFile(new URL("../src/components/CharactersDatabase.tsx",import.meta.url),"utf8"),planning=await readFile(new URL("../src/components/PlanningTrainingCenter.tsx",import.meta.url),"utf8");
test("records open an individual detail workspace",()=>{assert.ok(c.includes("selectedRecordId"));assert.ok(c.includes("setSelectedRecordId(record.id)"));assert.ok(c.includes("CUSTOM EVENT WORKSPACE"));});
test("workspace returns to records list",()=>{assert.ok(c.includes("All Records"));assert.ok(c.includes("setSelectedRecordId(null)"));});
test("workspace summarizes event and day schedule",()=>{assert.ok(c.includes("TOURNAMENT OVERVIEW"));assert.ok(c.includes("tournament-event-workspace-stats"));assert.ok(c.includes("Review the schedule and match allocation"));});
test("days are sorted and show date and match count",()=>{assert.ok(c.includes(".sort((x,y)=>(Number(x.dayNumber)||0)-(Number(y.dayNumber)||0))"));assert.ok(c.includes("formatDate(day.date)"));});
test("legacy records without day details remain viewable",()=>{assert.ok(c.includes("This is an older event record without day details."));assert.ok(c.includes("Date not configured"));});
test("responsive accessible record cards and workspace styles",()=>{assert.ok(css.includes("@media(max-width:620px)"));assert.ok(css.includes(".tournament-event-record-card:focus-visible"));assert.ok(c.includes('className={`tournament-event-record-card${record.overallPlacement === 1 ? " is-overall-champion" : ""}`}'));});
test("Phase 6 verifier is in consolidated build chain",()=>{assert.equal(p.scripts["test:tournament-phase-six"],"node --test scripts/verify-tournament-phase-six.mjs");assert.ok(p.scripts.build.includes("npm run test:tournament-phase-six"));});

test("mobile event match cards remain separate and fit narrow Android screens",()=>{
  assert.ok(css.includes(".tournament-event-match-grid{\n  display:grid;\n  grid-template-columns:minmax(0,1fr)"));
  assert.ok(css.includes("@media(max-width:620px){\n  .tournament-event-match-grid{grid-template-columns:minmax(0,1fr);gap:12px}"));
  assert.ok(css.includes(".tournament-event-match-card:has(.scrims-placement-picker.is-open){z-index:20}"));
});
test("overall champion card shows date, TOP 1, and event-wide metrics",()=>{
  assert.ok(c.includes("tournament-event-record-champion-date"));
  assert.ok(c.includes("TOP 1"));
  assert.ok(c.includes("TOTAL MATCHES"));
  assert.ok(c.includes("TOTAL KILLS"));
  assert.ok(c.includes("PLACEMENT PTS"));
  assert.ok(c.includes("OVERALL STANDING"));
  assert.ok(c.includes("getEventMetrics(record).placementPoints"));
});
test("event-wide champion styling reaches selected-day inputs but preserves blue save action",()=>{
  assert.ok(css.includes(".tournament-event-workspace.is-overall-champion .tournament-event-day-detail-header"));
  assert.ok(css.includes(".tournament-event-workspace.is-overall-champion .tournament-event-derived-points"));
  assert.ok(css.includes(".tournament-event-workspace.is-overall-champion .tournament-event-match-fields input"));
  assert.ok(css.includes(".tournament-event-workspace.is-overall-champion .tournament-event-day-save-bar button"));
});


test("placement controls stay blue until the selected value is #1 in every event placement field",()=>{
  assert.ok(c.includes('selectedRecord.overallPlacement === 1 ? " is-top1" : ""'));
  assert.ok(c.includes('selectedDay.overallStanding === 1 ? " is-top1" : ""'));
  assert.ok(c.includes('draft.placement === "1" ? " is-champion" : ""'));
  assert.ok(css.includes(".tournament-event-standing-panel:not(.is-top1) .scrims-placement-trigger"));
  assert.ok(css.includes(".tournament-event-match-card:not(.is-champion) .scrims-placement-trigger"));
  assert.ok(css.includes(".tournament-event-standing-panel.is-top1 .scrims-placement-trigger"));
  assert.ok(scrims.includes('m.placement===1?" scrims-match-top1":""'));
});
test("original compact team sync indicator is preserved without event-level diagnostics",()=>{
  assert.doesNotMatch(c,/Synced to team|Syncing…|Offline · saved on this device|tournament-event-sync-status/);
  assert.match(app,/sync-indicator sync-/);
  assert.match(app,/const syncState = serverStatus === "offline"/);
  assert.match(app,/const syncLabel = syncState/);
  assert.match(app,/checkSupabaseServer\(\)/);
  assert.match(app,/window\.setTimeout\(checkServer, 15000\)/);
  assert.match(shell,/sync-indicator sync-/);
});
test("decorative diagonal arrows are removed from interactive app surfaces",()=>{
  for(const source of [c,app,scrims,pets,characters,planning]) assert.doesNotMatch(source,/↗/);
});
test("event workspace resets its own scroll position on record and day navigation",()=>{
  assert.ok(c.includes("recordsRootRef.current?.scrollTo"));
  assert.ok(c.includes("ref={recordsRootRef}"));
  assert.ok(c.includes("scrollRecordsToTop();"));
});
test("champion event cards use a prominent trophy emblem",()=>{
  assert.ok(c.includes("tournament-event-record-trophy"));
  assert.ok(css.includes(".tournament-event-record-trophy svg"));
});
