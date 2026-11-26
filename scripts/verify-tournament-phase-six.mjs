import test from "node:test";import assert from "node:assert/strict";import{readFile}from"node:fs/promises";
const c=await readFile(new URL("../src/components/TournamentEventRecords.tsx",import.meta.url),"utf8"),css=await readFile(new URL("../src/components/TournamentEventRecords.css",import.meta.url),"utf8"),p=JSON.parse(await readFile(new URL("../package.json",import.meta.url),"utf8"));
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
