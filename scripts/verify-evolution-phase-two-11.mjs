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
