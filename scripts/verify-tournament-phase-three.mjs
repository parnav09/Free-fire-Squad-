import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const component = await readFile(new URL("../src/components/TournamentEventRecords.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../src/components/TournamentEventRecords.css", import.meta.url), "utf8");
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

test("Add Record opens a native accessible dialog with a named tournament input", () => {
  assert.match(component, /onClick=\{openCreateModal\}/);
  assert.match(component, /<dialog/);
  assert.match(component, /showModal\(\)/);
  assert.match(component, /aria-labelledby="tournament-event-modal-title"/);
  assert.match(component, /id="tournament-event-name"/);
  assert.match(component, /maxLength=\{MAX_EVENT_NAME_LENGTH\}/);
});

test("Day stepper supports bounded plus/minus controls and optional subtle haptics", () => {
  assert.match(component, /MIN_EVENT_DAYS = 1/);
  assert.match(component, /MAX_EVENT_DAYS = 60/);
  assert.match(component, /changeDayCount\(-1\)/);
  assert.match(component, /changeDayCount\(1\)/);
  assert.match(component, /navigator\.vibrate\(8\)/);
  assert.match(component, /typeof navigator\.vibrate === "function"/);
});

test("Phase 3 validates the tournament name and initializes the selected number of day drafts", () => {
  assert.match(component, /const trimmedName = eventName\\.trim\\(\\)/);
  assert.match(component, /if \\(!trimmedName\\)/);
  assert.match(component, /Array\\.from\\(\\{ length: dayCount \\}/);
  assert.match(component, /setSetupStep\\("days"\\)/);
});

test("Modal supports cancel, Escape, focus, error reporting and reduced motion", () => {
  assert.match(component, /onCancel=/);
  assert.match(component, /onClose=/);
  assert.match(component, /nameInputRef\.current\?\.focus\(\)/);
  assert.match(component, /role="alert"/);
  assert.match(styles, /prefers-reduced-motion:reduce/);
  assert.match(styles, /:focus-visible/);
});

test("Modal layout is responsive and controls have touch-friendly hit targets", () => {
  assert.match(styles, /@media\(max-width:620px\)/);
  assert.match(styles, /min-height:42px/);
  assert.match(styles, /touch-action:manipulation/);
  assert.match(styles, /\.tournament-event-modal::backdrop/);
});

test("Phase 3 regression test is included in the production build chain", () => {
  assert.equal(packageJson.scripts["test:tournament-phase-three"], "node --test scripts/verify-tournament-phase-three.mjs");
  assert.match(packageJson.scripts.build, /npm run test:tournament-phase-three/);
});
