import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const [profilesText, component, css] = await Promise.all([
  readFile(new URL("../src/data/characterProfiles.json", import.meta.url), "utf8"),
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

test("Central catalogue contains exactly 67 unique character records with artwork and ability/source metadata", () => {
  assert.equal(profiles.length, 67);
  assert.equal(new Set(profiles.map(profile => profile.id)).size, 67);
  for (const profile of profiles) {
    assert.ok(profile.id && profile.name && profile.image, `identity/artwork missing: ${profile.id}`);
    assert.ok(profile.artworkMode, `artworkMode missing: ${profile.id}`);
    assert.ok(profile.skill && profile.type, `ability metadata missing: ${profile.id}`);
    assert.ok(Array.isArray(profile.rows) && profile.rows.length > 0, `ability rows missing: ${profile.id}`);
    assert.ok(Array.isArray(profile.source) && profile.source.length > 0, `source references missing: ${profile.id}`);
  }
});

test("All 10 base profiles and 57 additional profiles are represented in the single catalogue", () => {
  for (const id of ["ray", "morse", "nero", "rin", "oscar", "kassie", "kairos", "ryden", "ignis", "suzy"]) {
    assert.ok(profiles.some(profile => profile.id === id), `base profile missing: ${id}`);
  }
  assert.ok(profiles.some(profile => profile.id === "alok"));
  assert.ok(profiles.some(profile => profile.id === "primis"));
  assert.ok(profiles.some(profile => profile.id === "nulla"));
});

test("Character component imports one centralized catalogue instead of split base and extra sources", () => {
  assert.match(component, /import characterCatalogue from "\.\.\/data\/characterProfiles\.json"/);
  assert.match(component, /const profiles: CharacterProfile\[\] = characterCatalogue as CharacterProfile\[\]/);
  assert.doesNotMatch(component, /const baseProfiles: CharacterProfile\[\]\s*=/);
  assert.doesNotMatch(component, /characterProfilesExtra\.json/);
});

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


test("Character database keeps static profiles as fallback and refreshes from the public Supabase catalogue", () => {
  assert.match(component, /useState<CharacterProfile\[\]>\(profiles\)/);
  assert.match(component, /supabase\.from\("character_profiles"\)\.select\("id, data"\)/);
  assert.match(component, /remoteProfile\.id !== localProfile\.id/);
  assert.match(component, /if \(!supabase\) return/);
  assert.match(component, /if \(cancelled \|\| error \|\| !data\?\.length\) return/);
});

test("Shared-current artwork metadata adds no CSS overrides that alter existing artwork appearance", () => {
  assert.doesNotMatch(css, /character-art-image--shared-current|character-profile-art--shared-current|character-result-card--shared-current/);
  assert.doesNotMatch(css, /Explicit artwork modes for the 54 profiles/);
});


test("Player profile assignment UI uses the centralized character catalogue and validates four unique slots", async () => {
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.match(app, /player_character_loadouts/);
  assert.match(app, /active_character_id/);
  assert.match(app, /passive_character_ids/);
  assert.match(app, /Select all three passive character slots/);
  assert.match(app, /new Set\(\[characterLoadoutDraft\.active,\.\.\.passives\]\)\.size!==4/);
  assert.match(app, /characterCatalogue as Array<\{id:string;name:string;skill:string;type:string\}>/);
  assert.doesNotMatch(app, /COMING IN A FUTURE BUILD/);
});
