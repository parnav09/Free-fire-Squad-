import React from "react";
import ReactDOM from "react-dom/client";
import CanonicalModuleIntegrationPanel from "../../src/components/CanonicalModuleIntegrationPanel";
import "../../src/styles/tokens.css";
import "../../src/styles.css";
import "../../src/styles/foundation.css";
import "../../src/components/CanonicalModuleIntegrationPanel.css";

const teamId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const now = new Date().toISOString();
const sessionIds = {
  scrim: "11111111-1111-4111-8111-111111111111",
  tournament: "22222222-2222-4222-8222-222222222222",
  training: "33333333-3333-4333-8333-333333333333",
};
const matchId = "44444444-4444-4444-8444-444444444444";
const makeId = (prefix: string, index: number) => prefix + String(index).padStart(12, "0");
const fixtures: Record<string, any[]> = {
  canonical_sessions: [
    { id: sessionIds.scrim, team_id: teamId, session_type: "scrim", title: "Scrim Source Session", session_date: "2026-11-22", created_at: now, archived_at: null },
    { id: sessionIds.tournament, team_id: teamId, session_type: "tournament", title: "Tournament Source Session", session_date: "2026-11-21", created_at: now, archived_at: null },
    { id: sessionIds.training, team_id: teamId, session_type: "training", title: "Training Source Session", session_date: "2026-11-20", created_at: now, archived_at: now },
  ],
  canonical_session_sources: [
    { id: makeId("a", 1), team_id: teamId, canonical_session_id: sessionIds.scrim, source_system: "scrim", scrim_record_id: "scrim-record-12345678", tournament_cycle_id: null, training_session_id: null, source_record_id: "scrim-record-12345678", created_at: now },
    { id: makeId("a", 2), team_id: teamId, canonical_session_id: sessionIds.tournament, source_system: "tournament", scrim_record_id: null, tournament_cycle_id: "tournament-record-12345678", training_session_id: null, source_record_id: "tournament-record-12345678", created_at: now },
    { id: makeId("a", 3), team_id: teamId, canonical_session_id: sessionIds.training, source_system: "training", scrim_record_id: null, tournament_cycle_id: null, training_session_id: "training-record-12345678", source_record_id: "training-record-12345678", created_at: now },
  ],
  canonical_session_matches: [
    { id: matchId, team_id: teamId, canonical_session_id: sessionIds.scrim, match_sequence: 1, map_name: "Bermuda" },
  ],
  canonical_session_match_roles: [],
  evolution_evaluation_contexts: [],
  evolution_player_score_snapshots: [],
};
const members = [];
for (let i = 0; i < 502; i++) {
  const userId = "player-" + i;
  const roleId = makeId("role", i);
  const contextId = makeId("context", i);
  members.push({ user_id: userId, display_name: "Player " + i, player_number: (i % 10) + 1, status: i === 501 ? "inactive" : "active" });
  fixtures.canonical_session_match_roles.push({
    id: roleId, team_id: teamId, canonical_session_match_id: matchId, player_user_id: userId,
    role_key_snapshot: "primary-rusher", role_name_snapshot: "Primary Rusher", role_assignment_status: "assigned",
  });
  fixtures.evolution_evaluation_contexts.push({
    id: contextId, team_id: teamId, player_member_id: makeId("member", i), player_user_id: userId,
    canonical_session_id: sessionIds.scrim, canonical_session_match_id: matchId, role_assignment_id: roleId,
    created_at: new Date(Date.now() - i * 1000).toISOString(),
  });
  fixtures.evolution_player_score_snapshots.push({
    id: makeId("snapshot", i), team_id: teamId, evaluation_context_id: contextId, score_status: "final",
    score100: 82, provisional_score100: null, coverage_percent: 100,
    created_at: new Date(Date.now() - i * 1000).toISOString(),
  });
}

const params = new URLSearchParams(location.search);
const mode = params.get("mode") || "normal";
let failedOnce = false;
const queryCounts: Record<string, number> = {};
const rangeCalls: Record<string, number> = {};
const fakeClient = {
  from(table: string) {
    const filters: Array<[string, unknown]> = [];
    const orders: Array<{ column: string; ascending: boolean }> = [];
    let range: [number, number] = [0, 999];
    const query: any = {
      select() { return query; },
      eq(column: string, value: unknown) { filters.push([column, value]); return query; },
      order(column: string, options?: { ascending?: boolean }) { orders.push({ column, ascending: options?.ascending !== false }); return query; },
      range(from: number, to: number) {
        range = [from, to];
        rangeCalls[table] = (rangeCalls[table] || 0) + 1;
        return query;
      },
      then(resolve: any, reject: any) {
        queryCounts[table] = (queryCounts[table] || 0) + 1;
        if (mode === "error-once" && table === "canonical_sessions" && !failedOnce) {
          failedOnce = true;
          return Promise.resolve({ data: null, error: { message: "Temporary canonical read failure" } }).then(resolve, reject);
        }
        let rows = [...(fixtures[table] || [])];
        for (const [column, value] of filters) rows = rows.filter(row => row[column] === value);
        rows.sort((a, b) => {
          for (const order of orders) {
            const left = a[order.column] == null ? "" : String(a[order.column]);
            const right = b[order.column] == null ? "" : String(b[order.column]);
            const compared = left.localeCompare(right);
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
Object.defineProperty(window, "__phase314QA", { value: { queryCounts, rangeCalls } });
ReactDOM.createRoot(document.getElementById("root")!).render(
  <main className="main-panel">
    <div className="content">
      <CanonicalModuleIntegrationPanel client={fakeClient as any} teamId={teamId} members={members} view="analytics" />
    </div>
  </main>
);
