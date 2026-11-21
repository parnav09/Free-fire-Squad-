import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/evolution-identity.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const identity = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));

const userA = "11111111-1111-4111-8111-111111111111";
const userB = "22222222-2222-4222-8222-222222222222";
const teamA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const teamB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const memberA = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const row = (overrides = {}) => ({
  id: memberA, team_id: teamA, user_id: userA, membership_role: "player", status: "active", ...overrides,
});

test("stable identity maps auth UUID to membership UUID and team UUID", () => {
  assert.deepEqual(identity.resolveActiveTeamIdentity(userA, [row()]), {
    authUserId: userA, membershipId: memberA, teamId: teamA, membershipRole: "player",
  });
});

test("display labels and malformed IDs can never resolve as identity", () => {
  assert.equal(identity.resolveActiveTeamIdentity("P1", [row()]), null);
  assert.equal(identity.resolveActiveTeamIdentity(userA, [row({ id: "P1" })]), null);
  assert.equal(identity.resolveActiveTeamIdentity(userA, [row({ team_id: "P2" })]), null);
});

test("malformed membership records and unknown membership roles fail closed", () => {
  assert.equal(identity.resolveActiveTeamIdentity(userA, null), null);
  assert.equal(identity.resolveActiveTeamIdentity(userA, [null]), null);
  assert.equal(identity.resolveActiveTeamIdentity(userA, [row({ user_id: null })]), null);
  assert.equal(identity.resolveActiveTeamIdentity(userA, [row({ user_id: "P1" })]), null);
  assert.equal(identity.resolveActiveTeamIdentity(userA, [row({ membership_role: "superadmin" })]), null);
  assert.equal(identity.resolveActiveTeamIdentity(userA, [row({ membership_role: " owner " })]), null);
});

test("inactive and other-user memberships are excluded", () => {
  assert.equal(identity.resolveActiveTeamIdentity(userA, [
    row({ status: "inactive" }), row({ user_id: userB }),
  ]), null);
});

test("multiple active teams require an explicit preferred team", () => {
  const rows = [row(), row({ id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", team_id: teamB })];
  assert.equal(identity.resolveActiveTeamIdentity(userA, rows), null);
  assert.equal(identity.resolveActiveTeamIdentity(userA, rows, teamB)?.teamId, teamB);
});

test("duplicate active memberships for the same team are treated as ambiguous", () => {
  assert.equal(identity.resolveActiveTeamIdentity(userA, [
    row(), row({ id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" }),
  ], teamA), null);
});

test("team timezone validation accepts India Standard Time and its legacy alias only", () => {
  assert.equal(identity.isValidTeamTimezone("Asia/Kolkata"), true);
  assert.equal(identity.isValidTeamTimezone("Asia/Calcutta"), true);
  assert.equal(identity.isValidTeamTimezone("America/Los_Angeles"), false);
  assert.equal(identity.isValidTeamTimezone("UTC"), false);
  assert.equal(identity.isValidTeamTimezone("Not/A_Zone"), false);
  assert.equal(identity.isValidTeamTimezone(" Asia/Kolkata"), false);
});

test("date boundaries use India Standard Time independent of device timezone", () => {
  const instant = new Date("2026-11-17T19:00:00.000Z");
  assert.equal(identity.teamDateISO(instant, "Asia/Kolkata"), "2026-11-18");
  assert.equal(identity.teamDateISO(instant, "Asia/Calcutta"), "2026-11-18");
  assert.throws(() => identity.teamDateISO(instant, "America/Los_Angeles"), RangeError);
});

test("invalid dates and unsupported timezones fail closed", () => {
  assert.throws(() => identity.teamDateISO(new Date("invalid"), "Asia/Kolkata"), RangeError);
  assert.throws(() => identity.teamDateISO(new Date(), "Invalid/Zone"), RangeError);
  assert.throws(() => identity.teamDateISO(new Date(), "UTC"), RangeError);
});


const appSource = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");

test("E Phase One.2 resolves the active team through the stable identity contract", () => {
  assert.match(appSource, /resolveActiveTeamIdentity\(user\.id,memberships,preferred\|\|null\)/);
  assert.match(appSource, /\.eq\("id",identity\.membershipId\)/);
  assert.match(appSource, /\.eq\("user_id",identity\.authUserId\)/);
  assert.match(appSource, /\.eq\("team_id",identity\.teamId\)/);
});

test("E Phase One.2 does not silently fall back to the first active membership", () => {
  const loadStart = appSource.indexOf("const loadTeam = async");
  const loadEnd = appSource.indexOf("const createTeam = async", loadStart);
  const loadBlock = appSource.slice(loadStart, loadEnd);
  assert.ok(loadStart >= 0 && loadEnd > loadStart);
  assert.match(loadBlock, /if\(!identity\)\{/);
  assert.doesNotMatch(loadBlock, /\.limit\(1\)\.maybeSingle\(\)/);
  assert.match(loadBlock, /setTeam\(null\);setTeamMembers\(\[\]\)/);
});

test("E Phase One.2 exposes an explicit team choice when identity is ambiguous", () => {
  assert.match(appSource, /CHOOSE ACTIVE TEAM/);
  assert.match(appSource, /disabled=\{!choice\.selectable\}/);
  assert.match(appSource, /teamChoices\.map\(choice/);
});

test("E Phase One.2 clears active team state on sign-out", () => {
  assert.ok(appSource.includes('setTeamChoices([]);setJoinRequests([]);setIglUserId("");'));
});


const identitySource = source;

const guardSource = await readFile(new URL("../src/lib/latest-request-guard.ts", import.meta.url), "utf8");
const guardCompiled = ts.transpileModule(guardSource, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const guardModule = await import("data:text/javascript;base64," + Buffer.from(guardCompiled).toString("base64"));

test("E Phase One.3: a newer team-load request invalidates an older request", async () => {
  const guard = guardModule.createLatestRequestGuard();
  let resolveOlder;
  let resolveNewer;
  const olderResult = new Promise((resolve) => { resolveOlder = resolve; });
  const newerResult = new Promise((resolve) => { resolveNewer = resolve; });
  const committed = [];
  const olderId = guard.begin();
  const older = olderResult.then((value) => { if (guard.isCurrent(olderId)) committed.push(value); });
  const newerId = guard.begin();
  const newer = newerResult.then((value) => { if (guard.isCurrent(newerId)) committed.push(value); });
  resolveNewer("new-team");
  await newer;
  resolveOlder("old-team");
  await older;
  assert.deepEqual(committed, ["new-team"]);
});

test("E Phase One.3: sign-out invalidates every in-flight team-load request", () => {
  const guard = guardModule.createLatestRequestGuard();
  const requestId = guard.begin();
  guard.invalidate();
  assert.equal(guard.isCurrent(requestId), false);
});

test("E Phase One.3: an old request failure cannot replace a newer successful team load", async () => {
  const guard = guardModule.createLatestRequestGuard();
  let rejectOlder;
  let resolveNewer;
  const state = { team: null, error: null };
  const olderId = guard.begin();
  const olderResult = new Promise((_, reject) => { rejectOlder = reject; });
  const older = olderResult.catch((error) => {
    if (guard.isCurrent(olderId)) state.error = error.message;
  });
  const newerId = guard.begin();
  const newerResult = new Promise((resolve) => { resolveNewer = resolve; });
  const newer = newerResult.then((team) => {
    if (guard.isCurrent(newerId)) { state.team = team; state.error = null; }
  });
  resolveNewer("team-B");
  await newer;
  rejectOlder(new Error("stale-team-A-error"));
  await older;
  assert.deepEqual(state, { team: "team-B", error: null });
});

test("E Phase One.3: multiple rapid team switches commit only the last valid selection", async () => {
  const guard = guardModule.createLatestRequestGuard();
  const pending = [];
  const committed = [];
  for (const teamId of ["team-A", "team-B", "team-C"]) {
    const requestId = guard.begin();
    let resolve;
    const promise = new Promise((done) => { resolve = done; });
    pending.push({ requestId, promise, resolve, teamId });
  }
  pending[2].resolve(pending[2].teamId);
  await pending[2].promise.then((value) => { if (guard.isCurrent(pending[2].requestId)) committed.push(value); });
  pending[0].resolve(pending[0].teamId);
  await pending[0].promise.then((value) => { if (guard.isCurrent(pending[0].requestId)) committed.push(value); });
  pending[1].resolve(pending[1].teamId);
  await pending[1].promise.then((value) => { if (guard.isCurrent(pending[1].requestId)) committed.push(value); });
  assert.deepEqual(committed, ["team-C"]);
});

test("E Phase One.3: invalidation prevents a cancelled or unmounted request from committing", async () => {
  const guard = guardModule.createLatestRequestGuard();
  let resolve;
  const result = new Promise((done) => { resolve = done; });
  const requestId = guard.begin();
  const committed = [];
  const pending = result.then((value) => { if (guard.isCurrent(requestId)) committed.push(value); });
  guard.invalidate();
  resolve("late-result");
  await pending;
  assert.deepEqual(committed, []);
});

test("E Phase One.3: loadTeam checks request freshness after async boundaries and ignores stale errors", () => {
  const loadStart = appSource.indexOf("const loadTeam = async");
  const loadEnd = appSource.indexOf("const createTeam = async", loadStart);
  const loadBlock = appSource.slice(loadStart, loadEnd);
  assert.match(appSource, /teamLoadGuardRef=useRef\(createLatestRequestGuard\(\)\)/);
  assert.match(loadBlock, /const requestId=teamLoadGuardRef\.current\.begin\(\)/);
  assert.ok((loadBlock.match(/if\(!isCurrent\(\)\)return;/g) || []).length >= 6);
  assert.match(loadBlock, /catch\(error\)\s*\{\s*if\(isCurrent\(\)\)throw error;/);
  assert.match(appSource, /teamLoadGuardRef\.current\.invalidate\(\);setTeam\(null\)/);
});

test("E Phase One.3: identity changes and component unmount invalidate pending team loads", () => {
  assert.match(appSource, /return\s*\(\)\s*=>\s*\{\s*teamLoadGuardRef\.current\.invalidate\(\);\s*\};/);
  assert.match(appSource, /\},\[signedIn,sessionUserId\]\);/);
});

test("E Phase One.2/1.3: team switch clears old scoped data before the first network wait", () => {
  const loadStart = appSource.indexOf("const loadTeam = async");
  const loadEnd = appSource.indexOf("const createTeam = async", loadStart);
  const loadBlock = appSource.slice(loadStart, loadEnd);
  const clearIndex = loadBlock.indexOf("if(preferredTeamId&&team?.id!==preferredTeamId){");
  const authReadIndex = loadBlock.indexOf("await supabase.auth.getUser()");
  assert.ok(clearIndex >= 0 && authReadIndex > clearIndex);
  assert.match(loadBlock, /setTeam\(null\);setTeamMembers\(\[\]\);setJoinRequests\(\[\]\)/);
});

test("E Phase One.4: owner roster assignments use the owner-checked RPC, not direct table updates", () => {
  assert.match(appSource, /rpc\("set_member_assignment"/);
  assert.doesNotMatch(appSource, /from\("team_members"\)\.update\(\{assigned_role/);
});


test("E Phase One.4: session eligibility requires a signed-in user and exact active membership", () => {
  const eligible = identity.resolveTeamSessionEligibility(userA, row(), teamA);
  assert.deepEqual(eligible, {
    eligible: true,
    identity: { authUserId: userA, membershipId: memberA, teamId: teamA, membershipRole: "player" },
  });
});

test("E Phase One.4: session eligibility fails closed for missing, inactive, malformed or mismatched identity", () => {
  assert.deepEqual(identity.resolveTeamSessionEligibility(null, row(), teamA), { eligible: false, reason: "unauthenticated" });
  assert.deepEqual(identity.resolveTeamSessionEligibility("P1", row(), teamA), { eligible: false, reason: "invalid-auth-user" });
  assert.deepEqual(identity.resolveTeamSessionEligibility(userA, null, teamA), { eligible: false, reason: "missing-membership" });
  assert.deepEqual(identity.resolveTeamSessionEligibility(userA, row({ id: "P1" }), teamA), { eligible: false, reason: "invalid-membership" });
  assert.deepEqual(identity.resolveTeamSessionEligibility(userA, row({ status: "inactive" }), teamA), { eligible: false, reason: "inactive-membership" });
  assert.deepEqual(identity.resolveTeamSessionEligibility(userA, row({ membership_role: "superadmin" }), teamA), { eligible: false, reason: "invalid-role" });
  assert.deepEqual(identity.resolveTeamSessionEligibility(userB, row(), teamA), { eligible: false, reason: "user-mismatch" });
  assert.deepEqual(identity.resolveTeamSessionEligibility(userA, row({ team_id: teamB }), teamA), { eligible: false, reason: "team-mismatch" });
});

test("E Phase One.4: team UI capability matrix is explicit and fails closed for unknown roles", () => {
  assert.deepEqual(identity.getTeamUiCapabilities("owner", true), { canManageTeamSettings: true, canManageAssignments: true });
  assert.deepEqual(identity.getTeamUiCapabilities("owner", false), { canManageTeamSettings: true, canManageAssignments: false });
  assert.deepEqual(identity.getTeamUiCapabilities("coach", false), { canManageTeamSettings: false, canManageAssignments: true });
  assert.deepEqual(identity.getTeamUiCapabilities("player", true), { canManageTeamSettings: false, canManageAssignments: false });
  assert.deepEqual(identity.getTeamUiCapabilities("unknown", true), { canManageTeamSettings: false, canManageAssignments: false });
});

test("E Phase One.4: app revalidates selected session eligibility before setting active team", () => {
  assert.match(appSource, /resolveTeamSessionEligibility\(user\.id,membership,identity\.teamId\)/);
  assert.match(appSource, /if\(!sessionEligibility\.eligible\|\|!membership\)\{/);
  assert.match(appSource, /const eligibleIdentity=sessionEligibility\.identity/);
  assert.match(appSource, /membership_id:eligibleIdentity\.membershipId,membership_role:eligibleIdentity\.membershipRole/);
});

test("E Phase One.4: team management capability helpers are explicitly UI-only", () => {
  assert.match(identitySource, /UI visibility\/affordance hints only/);
  assert.match(identitySource, /not an authorization boundary/);
  assert.match(appSource, /teamUiCapabilities=getTeamUiCapabilities\(team\?\.membership_role,ownerPowerEnabled\)/);
  assert.match(appSource, /canManage=\{!!team&&teamUiCapabilities\.canManageAssignments\}/);
});
