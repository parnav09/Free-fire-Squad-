import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync("src/App.tsx", "utf8");
const ui = readFileSync("src/components/CanonicalSessionsWorkspace.tsx", "utf8");
const css = readFileSync("src/components/CanonicalSessionsWorkspace.css", "utf8");
const tokens = readFileSync("src/styles/tokens.css", "utf8");
const legacyScrims = readFileSync("src/components/ScrimsSection.tsx", "utf8");
const legacyPlanning = readFileSync("src/components/PlanningTrainingCenter.tsx", "utf8");

test("Point 2.11 workspace is reachable without replacing legacy workspaces", () => {
  assert.match(app, /CanonicalSessionsWorkspace/);
  assert.match(app, /section==="Sessions"/);
  assert.match(app, /const nav: Section\[\] = \[[^\]]*"Sessions"/s);
  assert.match(legacyScrims, /integrate_canonical_source|integrateCanonicalSource/);
  assert.match(legacyPlanning, /integrate_canonical_source|integrateCanonicalSource/);
});

test("session ledger filters canonical sessions by type, status, season and date", () => {
  for (const token of ["canonical_sessions", "canonical_session_sources", "typeFilter", "statusFilter", "seasonFilter", "dateFilter"]) {
    assert.ok(ui.includes(token), "missing session ledger contract: " + token);
  }
  assert.match(ui, /order\("session_date"/);
  assert.match(ui, /limit\(250\)/);
});

test("create and source-link actions preserve module ownership and canonical IDs", () => {
  assert.match(ui, /create_canonical_session/);
  assert.match(ui, /integrateCanonicalSource/);
  assert.match(ui, /canonical_session_matches/);
  assert.match(ui, /Only unlinked records are shown/);
  assert.match(ui, /Scrim and Tournament sessions are linked from their existing modules/);
});

test("lifecycle actions use server RPCs, optimistic version and explicit reasons", () => {
  assert.match(ui, /transition_canonical_session/);
  assert.match(ui, /reopen_canonical_session/);
  assert.match(ui, /p_expected_version:detail\.lifecycle_version/);
  assert.match(ui, /p_reason:reason\.trim\(\)/);
  assert.match(ui, /active_owner_or_coach_required|membershipRole==="owner"/);
});

test("roster, role, participation and substitution actions use audited RPC contracts", () => {
  for (const rpc of [
    "lock_canonical_session_roster",
    "set_canonical_session_roster_member_status",
    "record_canonical_match_participation",
    "correct_canonical_match_participation",
    "set_canonical_session_match_role",
    "record_canonical_session_substitution",
  ]) assert.ok(ui.includes(rpc), "missing RPC: " + rpc);
  assert.match(ui, /subOutgoing/);
  assert.match(ui, /subIncoming/);
  assert.match(ui, /datetime-local/);
});

test("result workflow keeps raw versions, verification checklist and receipt separate", () => {
  for (const rpc of [
    "save_canonical_session_result_draft",
    "submit_canonical_session_result",
    "verify_canonical_session_result",
    "reject_canonical_session_result",
    "submit_canonical_session_results",
  ]) assert.ok(ui.includes(rpc), "missing result RPC: " + rpc);
  assert.match(ui, /no_inferred_values/);
  assert.match(ui, /sessionReceipt/);
  assert.match(ui, /result_versions/);
  assert.match(ui, /result_events/);
});

test("permission-denied and empty/loading/error states are explicit", () => {
  for (const phrase of ["Read-only", "Loading sessions", "No sessions match", "No competitive match rows", "Action needs attention"]) {
    assert.ok(ui.includes(phrase), "missing UI state: " + phrase);
  }
  assert.match(ui, /membershipRole==="owner" \|\| membershipRole==="coach"/);
});

test("Tournament and Scrims share the same scrollable PlacementPicker", () => {
  const picker = readFileSync("src/components/PlacementPicker.tsx", "utf8");
  const pickerCss = readFileSync("src/components/PlacementPicker.css", "utf8");
  assert.match(app, /import PlacementPicker from "\.\/components\/PlacementPicker"/);
  assert.match(app, /<PlacementPicker value=\{m\.placement\}[^>]*onChange=\{n=>saveMatch\(key,"placement",n\)\}/);
  assert.match(legacyScrims, /import PlacementPicker from "\.\/PlacementPicker"/);
  assert.match(legacyScrims, /<PlacementPicker value=\{m\.placement\}/);
  assert.match(picker, /role="listbox"/);
  assert.match(picker, /role="option"/);
  assert.match(pickerCss, /max-height:245px;overflow-y:auto/);
  assert.match(pickerCss, /scrims-placement-menu button\.is-selected/);
});

test("Tournament match ledger keeps results editable and hides zero-valued kill placeholders", () => {
  assert.match(app, /const m=matches\[key\]\?\?\(\(signedIn&&team&&remote\)/);
  assert.equal((app.match(/disabled=\{!!team&&\!\(team\.membership_role==="coach"\|\|team\.membership_role==="owner"\)\}/g) || []).length, 2);
  assert.match(app, /value=\{killDrafts\[key\] \?\? \(m\.kills > 0 \? String\(m\.kills\) : ""\)\}/);
  assert.match(app, /if\(raw===""\)\{if\(m\.kills>0\)saveMatch\(key,"kills",0\);\}else\{saveMatch\(key,"kills",Math\.max\(0,Number\(raw\)\)\);\}/);
  assert.doesNotMatch(app, /42 MATCH SLOTS|42 match slots|Link canonical IDs/);
});

test("responsive UI retains the existing dark design tokens and accessible hitboxes", () => {
  assert.match(css, /@media\(max-width:1050px\)/);
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(css, /@media\(max-width:520px\)/);
  assert.match(css, /@media\(orientation:landscape\)/);
  assert.match(css, /min-height:44px/);
  assert.match(css, /:focus-visible/);
  assert.match(tokens, /--tap-min:\s*44px/);
  assert.match(tokens, /--color-canvas:\s*var\(--brand-onyx-950\)/);
  assert.match(css, /var\(--color-surface-raised\)/);
  assert.match(css, /var\(--brand-cyan-300\)/);
});
