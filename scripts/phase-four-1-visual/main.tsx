import React from "react";
import ReactDOM from "react-dom/client";
import DailyEvaluationSessionFirst from "../../src/components/DailyEvaluationSessionFirst";
import "../../src/styles/tokens.css";
import "../../src/styles.css";
import "../../src/styles/foundation.css";
import "../../src/components/DailyEvaluationSessionFirst.css";

const teamId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const userId = "11111111-1111-4111-8111-111111111111";
const sessionA = "22222222-2222-4222-8222-222222222222";
const sessionB = "33333333-3333-4333-8333-333333333333";
const matchA = "44444444-4444-4444-8444-444444444444";
const matchB = "55555555-5555-4555-8555-555555555555";
const now = "2026-11-23T10:00:00.000Z";
const makeId = (prefix: string, index: number) => prefix + String(index).padStart(8, "0");

const sessions: Record<string, any>[] = [
  { id: "archived-session", team_id: teamId, session_type: "scrim", title: "Archived Session", session_date: "2026-11-24", created_at: now, archived_at: now },
  { id: "foreign-session", team_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", session_type: "scrim", title: "Foreign Team Session", session_date: "2026-11-25", created_at: now, archived_at: null },
  { id: sessionA, team_id: teamId, session_type: "scrim", title: "Session Alpha", session_date: "2026-11-23", created_at: now, archived_at: null },
  { id: sessionB, team_id: teamId, session_type: "training", title: "Session Beta", session_date: "2026-11-22", created_at: now, archived_at: null },
];
for (let i = 0; i < 249; i++) {
  sessions.push({
    id: makeId("session-", i),
    team_id: teamId,
    session_type: "scrim",
    title: "Older session " + i,
    session_date: "2026-01-" + String((i % 28) + 1).padStart(2, "0"),
    created_at: now,
    archived_at: null,
  });
}

const matches: Record<string, any>[] = [
  { id: "foreign-match", team_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", canonical_session_id: sessionA, match_sequence: 0, map_name: "Foreign Map" },
  { id: matchA, team_id: teamId, canonical_session_id: sessionA, match_sequence: 1, map_name: "Bermuda" },
  { id: matchB, team_id: teamId, canonical_session_id: sessionB, match_sequence: 1, map_name: "Purgatory" },
];
for (let i = 0; i < 250; i++) {
  matches.push({
    id: makeId("match-", i),
    team_id: teamId,
    canonical_session_id: sessionA,
    match_sequence: i + 2,
    map_name: "Map " + i,
  });
}

const roles: Record<string, any>[] = [
  { id: "role-foreign", team_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", canonical_session_id: sessionA, canonical_session_match_id: matchA, player_user_id: "player-foreign", role_key_snapshot: "primary_rusher", role_name_snapshot: "Primary Rusher", role_assignment_status: "assigned", changed_at: "2026-11-23T11:00:00.000Z" },
  { id: "role-a-new", team_id: teamId, canonical_session_id: sessionA, canonical_session_match_id: matchA, player_user_id: "player-a", role_key_snapshot: "primary_rusher", role_name_snapshot: "Primary Rusher", role_assignment_status: "assigned", changed_at: "2026-11-23T09:00:00.000Z" },
  { id: "role-self", team_id: teamId, canonical_session_id: sessionA, canonical_session_match_id: matchA, player_user_id: userId, role_key_snapshot: "sniper_igl", role_name_snapshot: "Sniper + IGL", role_assignment_status: "assigned", changed_at: "2026-11-23T08:00:00.000Z" },
  { id: "role-b-new", team_id: teamId, canonical_session_id: sessionA, canonical_session_match_id: matchA, player_user_id: "player-b", role_key_snapshot: "primary_rusher", role_name_snapshot: "Primary Rusher", role_assignment_status: "unassigned", changed_at: "2026-11-23T07:00:00.000Z" },
  { id: "role-a-old", team_id: teamId, canonical_session_id: sessionA, canonical_session_match_id: matchA, player_user_id: "player-a", role_key_snapshot: "secondary_rusher", role_name_snapshot: "Secondary Rusher", role_assignment_status: "assigned", changed_at: "2026-11-22T09:00:00.000Z" },
  { id: "role-b-old", team_id: teamId, canonical_session_id: sessionA, canonical_session_match_id: matchA, player_user_id: "player-b", role_key_snapshot: "secondary_rusher", role_name_snapshot: "Secondary Rusher", role_assignment_status: "assigned", changed_at: "2026-11-22T08:00:00.000Z" },
  { id: "role-inactive", team_id: teamId, canonical_session_id: sessionA, canonical_session_match_id: matchA, player_user_id: "player-inactive", role_key_snapshot: "third_rusher_flanker", role_name_snapshot: "Third Rusher / Flanker", role_assignment_status: "assigned", changed_at: "2026-11-22T07:00:00.000Z" },
  { id: "role-invalid", team_id: teamId, canonical_session_id: sessionA, canonical_session_match_id: matchA, player_user_id: "player-invalid", role_key_snapshot: "not-a-canonical-role", role_name_snapshot: "Unverified Role", role_assignment_status: "assigned", changed_at: "2026-11-22T06:00:00.000Z" },
  { id: "role-c", team_id: teamId, canonical_session_id: sessionB, canonical_session_match_id: matchB, player_user_id: "player-c", role_key_snapshot: "third_rusher_flanker", role_name_snapshot: "Third Rusher / Flanker", role_assignment_status: "assigned", changed_at: "2026-11-23T06:00:00.000Z" },
];
for (let i = 0; i < 245; i++) {
  roles.push({
    id: makeId("role-fill-", i),
    team_id: teamId,
    canonical_session_id: sessionA,
    canonical_session_match_id: matchA,
    player_user_id: "unlisted-player-" + i,
    role_key_snapshot: "primary_rusher",
    role_name_snapshot: "Primary Rusher",
    role_assignment_status: "unassigned",
    changed_at: new Date(Date.parse("2026-11-21T00:00:00.000Z") - i * 60_000).toISOString(),
  });
}

const fixtures: Record<string, any[]> = {
  canonical_sessions: sessions,
  canonical_session_matches: matches,
  canonical_session_match_roles: roles,
};
const members = [
  { user_id: userId, display_name: "Current User", player_number: 1, membership_role: "member", status: "active" },
  { user_id: "player-a", display_name: "Player A", player_number: 2, membership_role: "member", status: "active" },
  { user_id: "player-b", display_name: "Player B", player_number: 3, membership_role: "member", status: "active" },
  { user_id: "player-inactive", display_name: "Inactive Player", player_number: 4, membership_role: "member", status: "inactive" },
  { user_id: "player-invalid", display_name: "Invalid Role Player", player_number: 5, membership_role: "member", status: "active" },
  { user_id: "player-c", display_name: "Player C", player_number: 6, membership_role: "member", status: "active" },
  { user_id: "player-foreign", display_name: "Foreign Player", player_number: 7, membership_role: "member", status: "active" },
];

const params = new URLSearchParams(location.search);
const mode = params.get("mode") || "normal";
let failedOnce = false;
const rangeCalls: Record<string, number> = {};
const queryCounts: Record<string, number> = {};
const fakeClient = {
  from(table: string) {
    const filters: Array<[string, unknown]> = [];
    const orders: Array<{ column: string; ascending: boolean; nullsFirst?: boolean }> = [];
    let range: [number, number] = [0, 249];
    const query: any = {
      select() { return query; },
      eq(column: string, value: unknown) { filters.push([column, value]); return query; },
      is(column: string, value: unknown) { filters.push([column, value]); return query; },
      order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
        orders.push({ column, ascending: options?.ascending !== false, nullsFirst: options?.nullsFirst });
        return query;
      },
      range(from: number, to: number) {
        range = [from, to];
        rangeCalls[table] = (rangeCalls[table] || 0) + 1;
        return query;
      },
      then(resolve: any, reject: any) {
        queryCounts[table] = (queryCounts[table] || 0) + 1;
        if (mode === "error-once" && table === "canonical_sessions" && !failedOnce) {
          failedOnce = true;
          return Promise.resolve({ data: null, error: { message: "Temporary session read failure" } }).then(resolve, reject);
        }
        let rows = [...(fixtures[table] || [])];
        for (const [column, value] of filters) rows = rows.filter(row => row[column] === value);
        rows.sort((a, b) => {
          for (const order of orders) {
            const leftValue = a[order.column];
            const rightValue = b[order.column];
            if (leftValue == null || rightValue == null) {
              if (leftValue == null && rightValue == null) continue;
              const nullsFirst = order.nullsFirst ?? !order.ascending;
              return leftValue == null ? (nullsFirst ? -1 : 1) : (nullsFirst ? 1 : -1);
            }
            const compared = String(leftValue).localeCompare(String(rightValue));
            if (compared) return order.ascending ? compared : -compared;
          }
          return 0;
        });
        return Promise.resolve({ data: rows.slice(range[0], range[1] + 1), error: null }).then(resolve, reject);
      },
    };
    return query;
  },
};

Object.defineProperty(window, "__phase41QA", { value: { rangeCalls, queryCounts } });
ReactDOM.createRoot(document.getElementById("root")!).render(
  <main className="main-panel">
    <div className="content">
      <DailyEvaluationSessionFirst client={fakeClient as any} teamId={teamId} userId={userId} members={members as any} />
    </div>
  </main>
);
