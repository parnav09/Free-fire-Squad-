import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const css = await readFile(new URL("../src/components/TournamentEventRecords.css", import.meta.url), "utf8");
const component = await readFile(new URL("../src/components/TournamentEventRecords.tsx", import.meta.url), "utf8");
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
test("Phase 10 adds tablet and mobile layout breakpoints", () => {
  assert.ok(css.includes("@media(max-width:680px)"));
  assert.ok(css.includes("@media(max-width:390px)"));
  assert.ok(css.includes("@media(max-height:620px) and (orientation:landscape)"));
});
test("Small-screen match inputs stack without horizontal overflow", () => {
  assert.ok(css.includes(".tournament-event-match-fields{grid-template-columns:minmax(0,1fr)}"));
  assert.ok(css.includes("min-width:0"));
  assert.ok(css.includes("overflow-wrap:anywhere"));
});
test("Modal respects viewport height and remains internally scrollable", () => {
  assert.ok(css.includes("max-height:min(88dvh,820px)"));
  assert.ok(css.includes("overscroll-behavior:contain"));
  assert.ok(css.includes("overflow-y:auto"));
});
test("Interactive targets meet mobile touch sizing", () => {
  assert.ok(css.includes("min-height:44px"));
});
test("Keyboard focus is visible across records, workspace and modal", () => {
  assert.ok(css.includes(":focus-visible"));
  assert.ok(css.includes("forced-colors:active"));
});
test("Reduced-motion preference is respected", () => {
  assert.ok(css.includes("prefers-reduced-motion:reduce"));
});
test("Responsive styles preserve match recording and event workflows", () => {
  for (const name of ["Save Result", "Edit Tournament", "Delete Tournament", "Add Record", "All Records"]) assert.ok(component.includes(name));
});
test("Sync and legacy import controls remain responsive", () => {
  assert.ok(css.includes(".tournament-event-legacy-import"));
  assert.ok(css.includes(".tournament-event-sync-status"));
});
test("Phase 10 verifier is included in the consolidated build chain", () => {
  assert.equal(pkg.scripts["test:tournament-phase-ten"], "node --test scripts/verify-tournament-phase-ten.mjs");
  assert.ok(pkg.scripts.build.includes("npm run test:tournament-phase-ten"));
});
