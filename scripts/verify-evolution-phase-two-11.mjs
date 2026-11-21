import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Phase 2.11 exposes the canonical session workspace from Evolution navigation", async () => {
  const app = await read("../src/App.tsx");
  const component = await read("../src/components/CanonicalSessionsWorkspace.tsx");
  assert.match(app, /CanonicalSessionsWorkspace/);
  assert.match(app, /"Sessions"/);
  assert.match(app, /to:"Sessions"/);
  assert.match(component, /canonical_sessions/);
  assert.match(component, /canonical_session_matches/);
});
test("Session lifecycle uses server RPC, optimistic version and audited reason", async () => {
  const component = await read("../src/components/CanonicalSessionsWorkspace.tsx");
  assert.match(component, /transition_canonical_session/);
  assert.match(component, /p_expected_version:selected\.lifecycle_version/);
  assert.match(component, /p_reason:reason\.trim\(\)/);
  assert.match(component, /reopen_canonical_session/);
  assert.match(component, /create_canonical_session/);
  assert.match(component, /Create Scrim and Tournament sessions in their existing modules/);
});
test("Roster, role, participation and substitution use canonical server RPCs", async () => {
  const component = await read("../src/components/CanonicalSessionsWorkspace.tsx");
  for (const rpc of ["lock_canonical_session_roster","set_canonical_session_roster_member_status","record_canonical_match_participation","correct_canonical_match_participation","set_canonical_session_match_role","record_canonical_session_substitution"]) {
    assert.match(component, new RegExp(rpc));
  }
});
test("Result workflow preserves draft, submission, verification and rejection provenance", async () => {
  const component = await read("../src/components/CanonicalSessionsWorkspace.tsx");
  for (const rpc of ["save_canonical_session_result_draft","submit_canonical_session_result","verify_canonical_session_result","reject_canonical_session_result","submit_canonical_session_results"]) assert.match(component,new RegExp(rpc));
  assert.match(component,/no_inferred_values/);
  assert.match(component,/p\.participation_status==="participated"/);
  assert.match(component,/!\["in_progress","awaiting_results"\]\.includes\(selected\.lifecycle_status\)/);
  assert.match(component,/raw_submitted_values/);
});
test("UI fails closed for staff-only actions and offline writes", async () => {
  const component = await read("../src/components/CanonicalSessionsWorkspace.tsx");
  assert.match(component,/if\(!canManage\)/);
  assert.match(component,/if\(!isOnline\)/);
  assert.match(component,/disabled=\{!isOnline/);
  assert.match(component,/No writes are queued or silently replayed/);
  assert.match(component,/setVerifyChecks\(\{\}\)/);
  assert.ok(component.includes('setSubOut("");setSubIn("")'));
});
test("Responsive UI and accessibility states are present", async () => {
  const css = await read("../src/components/CanonicalSessionsWorkspace.css");
  const component = await read("../src/components/CanonicalSessionsWorkspace.tsx");
  assert.match(css,/@media\(max-width:760px\)/);
  assert.match(css,/@media\(max-width:520px\)/);
  assert.match(css,/prefers-reduced-motion/);
  assert.match(component,/aria-label="Canonical session list"/);
  assert.match(component,/role="alert"/);
  assert.match(component,/role="status"/);
});


test("Session list and detail requests cannot publish stale data after team or selection changes", async () => {
  const app = await read("../src/App.tsx");
  assert.match(app, /<CanonicalSessionsWorkspace key=\{team\?\.id\|\|"no-team"\}/);
  const component = await read("../src/components/CanonicalSessionsWorkspace.tsx");
  assert.match(component, /listRequestRef=useRef\(0\),detailRequestRef=useRef\(0\)/);
  assert.match(component, /requestId!==listRequestRef\.current/);
  assert.match(component, /requestId!==detailRequestRef\.current/);
  assert.match(component, /return\(\)=>\{listRequestRef\.current\+\+;detailRequestRef\.current\+\+;\}/);
  assert.ok(component.includes('setSessions([]);setSources({});setMatchCounts({});setSelectedId("")'));
});

test("Expected match coverage blocks premature session verification", async () => {
  const component = await read("../src/components/CanonicalSessionsWorkspace.tsx");
  assert.match(component, /expectedMatchCount/);
  assert.match(component, /allExpectedResultsVerified/);
  assert.match(component, /Link every expected match and verify every result/);
  assert.match(component, /Session verification is blocked:/);
  assert.match(component, /will not create placeholder matches or results/);
});
test("Training rejection and correction paths remain usable", async () => {
  const component = await read("../src/components/CanonicalSessionsWorkspace.tsx");
  assert.match(component, /Correction reason · required/);
  assert.match(component, /Reason to return for correction/);
  assert.match(component, /existing\?\.status==="rejected"&&correctionReason\.trim\(\)\.length<3/);
});
test("Substitutions capture an explicit effective timestamp", async () => {
  const component = await read("../src/components/CanonicalSessionsWorkspace.tsx");
  assert.match(component, /type="datetime-local" value=\{subEffectiveAt\}/);
  assert.match(component, /new Date\(subEffectiveAt\)\.toISOString\(\)/);
});
test("Result audit events and version history are visible", async () => {
  const component = await read("../src/components/CanonicalSessionsWorkspace.tsx");
  assert.match(component, /Result audit history/);
  assert.match(component, /Version history/);
  assert.match(component, /event\.changed_by/);
  assert.match(component, /v\{v\.version_no\}/);
});
test("All interactive controls meet the 44px target and retain focus visibility", async () => {
  const css = await read("../src/components/CanonicalSessionsWorkspace.css");
  assert.match(css, /\.canonical-workspace button\{min-height:44px/);
  assert.match(css, /\.canonical-workspace \.canonical-icon-button\{width:44px;height:44px/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media\(max-width:820px\)/);
  assert.match(css, /@media\(max-width:520px\)/);
  assert.match(css, /prefers-reduced-motion/);
});
