import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const [profilesText, component, css] = await Promise.all([
  readFile(new URL("../src/data/characterProfilesExtra.json", import.meta.url), "utf8"),
  readFile(new URL("../src/components/CharactersDatabase.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/CharactersDatabase.css", import.meta.url), "utf8"),
]);
const profiles = JSON.parse(profilesText);
const kla = profiles.find(profile => profile.id === "kla");
assert.ok(kla, "Kla profile must exist");

const helperStart = component.indexOf("const normalizeSearchText =");
const helperEnd = component.indexOf("export default function CharactersDatabase", helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, "Search helpers must remain available in the character component");
const helperSource = component.slice(helperStart, helperEnd);
const searchContext = {};
const helperJavaScript = ts.transpile(helperSource, { target: ts.ScriptTarget.ES2022 });
runInNewContext(`${helperJavaScript}\nglobalThis.__characterSearch = { normalizeSearchText, editDistanceWithin, characterNameTermScore, profileSearchScore };`, searchContext);
const { normalizeSearchText, characterNameTermScore, profileSearchScore } = searchContext.__characterSearch;

test("Kla profile has one ability label, official artwork and the required profile metadata", () => {
  assert.equal(kla.skill, "Muay Thai");
  assert.equal(kla.type, "Passive");
  assert.equal(kla.abilityDisplayOnce, true);
  assert.equal(kla.badge, "Official-source profile");
  assert.equal(kla.subtitle, "OB55 values reconciled · 15 Nov 2026");
  assert.equal(kla.lastChanged, "OB8 (28 Jun 2018)");
  assert.equal(kla.artworkMode, "official-fullbody");
  assert.equal(kla.image, "https://freefiremobile-a.akamaihd.net/common/web_event/official2.ff.garena.all/img/20228/1655985bf74931458766921ee6bb6e0a.png");
});

test("Kla ability values and supplied English wording remain unchanged", () => {
  assert.deepEqual(kla.rows.map(row => row.value), ["+400%", "Unarmed melee attacks", "No cooldown"]);
  assert.equal(kla.introEn, "Passive that drastically amplifies the damage output of unarmed melee attacks.");
  assert.deepEqual(kla.currentEn, ["Increases fist and unarmed melee damage by 400%."]);
  assert.equal(kla.historyEn[0], "OB8 (28 Jun 2018): Introduced.");
  assert.equal(kla.historyEn[1], "OB39 (Mar 2023): Character system overhaul permanently unlocked maximum level values (400%) for all players.");
  assert.ok(kla.source.some(source => source.label === "In-game screenshot verification (21170.png)"));
  assert.ok(kla.source.some(source => source.url === "https://ff.garena.com/en/chars/8"));
});

test("Kla fuzzy search tolerates common spelling variants and adjacent letter swaps", () => {
  assert.equal(normalizeSearchText("KLA"), "kla");
  assert.ok(characterNameTermScore("Kla", "kla") > 0);
  assert.ok(characterNameTermScore("Kla", "klaa") > 0);
  assert.ok(characterNameTermScore("Kla", "kal") > 0);
  assert.ok(characterNameTermScore("Kla", "Kla") > 0);
});

test("Kla ability search resolves both English and Roman Hinglish terms", () => {
  assert.ok(profileSearchScore(kla, "muay") > 0);
  assert.ok(profileSearchScore(kla, "thai") > 0);
  assert.ok(profileSearchScore(kla, "fist damage") > 0);
  assert.ok(profileSearchScore(kla, "unarmed melee") > 0);
});

test("Kla official full-body artwork has dedicated non-cropping styles across responsive layouts", () => {
  assert.match(component, /character-art-image--official-fullbody/);
  assert.match(css, /object-fit:\s*contain\s*!important/);
  assert.match(css, /character-profile-art--official-fullbody/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)/);
  assert.match(css, /@media\s*\(max-width:\s*760px\)/);
  assert.match(css, /@media\s*\(max-width:\s*420px\)/);
});
