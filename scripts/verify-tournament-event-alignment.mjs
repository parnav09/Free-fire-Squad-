import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const event = await readFile(new URL("../src/components/TournamentEventRecords.tsx", import.meta.url), "utf8");
const picker = await readFile(new URL("../src/components/PlacementPicker.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../src/components/TournamentEventRecords.css", import.meta.url), "utf8");
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

test("Event match editor reuses the weekly placement picker", () => {
  assert.ok(event.includes('import PlacementPicker from "./PlacementPicker"'));
  assert.ok(event.includes("<PlacementPicker value={draft.placement === \"\" ? null : Number(draft.placement)}"));
  assert.ok(picker.includes('value:number|null'));
  assert.ok(picker.includes('onClear?:()=>void'));
});
test("Placement scoring matches the weekly scoreboard mapping", () => {
  assert.ok(event.includes("function getPlacementPoints(placement: number | null)"));
  assert.ok(event.includes("[12,9,8,7,6,5,4,3,2,1,0,0]"));
  assert.ok(event.includes("placementPoints = getPlacementPoints(placement)"));
});
test("Placement points are derived and no longer manually editable", () => {
  assert.ok(event.includes('getPlacementPoints(draft.placement === "" ? null : Number(draft.placement))'));
  assert.doesNotMatch(event, /label>Placement points<input/);
  assert.ok(event.includes("tournament-event-derived-points"));
});
test("Kills input follows the weekly numeric-entry behavior", () => {
  assert.ok(event.includes('type="text" inputMode="numeric" pattern="[0-9]*"'));
  assert.ok(event.includes('replace(/[^0-9]/g,"")'));
});
test("Unset placement can be selected and cleared safely", () => {
  assert.ok(picker.includes('onClear?.()'));
  assert.ok(event.includes('onClear={()=>updateMatchDraft(selectedRecord,day,matchNo,"placement","")}'));
  assert.ok(event.includes('placement === null && kills > 0'));
});
test("Match total and day summary use derived placement points plus kills", () => {
  assert.ok(event.includes("getPlacementPoints(draft.placement === \"\" ? null : Number(draft.placement))+(Number(draft.kills)||0)"));
  assert.ok(event.includes("m.placementPoints+m.kills"));
});
test("Event match alignment test is part of the production build", () => {
  assert.equal(pkg.scripts["test:tournament-event-alignment"], "node --test scripts/verify-tournament-event-alignment.mjs");
  assert.ok(pkg.scripts.build.includes("npm run test:tournament-event-alignment"));
});
