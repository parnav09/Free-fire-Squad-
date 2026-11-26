import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
const modeComponent = await readFile(new URL("../src/components/TournamentModeFoundation.tsx", import.meta.url), "utf8");
const modeStyles = await readFile(new URL("../src/components/TournamentModeFoundation.css", import.meta.url), "utf8");

test("Tournament Phase 1 exposes independent Weekly and Event modes", () => {
  assert.match(app, /useState<TournamentMode>\("Weekly"\)/);
  assert.match(app, /<TournamentModeFoundation mode=\{tournamentMode\} onChange=\{setTournamentMode\}\/>/);
  assert.match(modeComponent, /role="group"/);
  assert.match(modeComponent, /aria-pressed=\{mode === "Weekly"\}/);
  assert.match(modeComponent, /aria-pressed=\{mode === "Event"\}/);
  assert.match(modeComponent, /onChange\("Weekly"\)/);
  assert.match(modeComponent, /onChange\("Event"\)/);
});

test("Weekly Tournament implementation remains present and selected by default", () => {
  assert.match(app, /tournamentMode === "Weekly" \? <>/);
  assert.match(app, /WEEKLY CYCLE/);
  assert.match(app, /Array\.from\(\{length:7\}/);
  assert.match(app, /Array\.from\(\{length:6\}/);
  assert.match(app, /tournament_cycles/);
  assert.match(app, /tournament_matches/);
});

test("Event mode is isolated as a Phase 1 foundation placeholder", () => {
  assert.match(app, /Custom tournaments are coming next/);
  assert.match(app, /FOUNDATION READY · PHASE 1/);
  assert.doesNotMatch(app, /tournament_event_(?:days|matches|events)/);
});

test("Mode switch has responsive and reduced-motion styling", () => {
  assert.match(modeStyles, /@media\(max-width:620px\)/);
  assert.match(modeStyles, /prefers-reduced-motion:reduce/);
  assert.match(modeStyles, /:focus-visible/);
});
