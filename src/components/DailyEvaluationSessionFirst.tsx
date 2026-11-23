import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CANONICAL_ROLE_KEYS, type CanonicalRoleKey } from "../lib/evolution-dimensions";
import "./DailyEvaluationSessionFirst.css";

type Row = Record<string, any>;
type Member = {
  id: string;
  user_id: string;
  display_name: string;
  player_number: number | null;
  assigned_role?: string | null;
  membership_role: string;
  status: string;
};
type Props = {
  client: SupabaseClient | null;
  teamId: string;
  userId: string;
  members: Member[];
};

type Target = {
  userId: string;
  displayName: string;
  playerNumber: number | null;
  roleKey: CanonicalRoleKey;
  roleName: string;
  assignmentId: string;
};

const roleAliases: Record<string, CanonicalRoleKey> = {
  "primary rusher": "primary_rusher",
  "primary-rusher": "primary_rusher",
  "secondary rusher": "secondary_rusher",
  "secondary-rusher": "secondary_rusher",
  "third rusher flanker": "third_rusher_flanker",
  "third-rusher-flanker": "third_rusher_flanker",
  "sniper + igl": "sniper_igl",
  "sniper igl": "sniper_igl",
  "sniper-igl": "sniper_igl",
  "substitute flex": "substitute_flex",
  "substitute-flex": "substitute_flex",
  other: "other",
};

function canonicalRole(value: unknown): CanonicalRoleKey | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if ((CANONICAL_ROLE_KEYS as readonly string[]).includes(normalized)) {
    return normalized as CanonicalRoleKey;
  }
  return roleAliases[normalized] ?? null;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "The session context could not be loaded. Please retry.";
}

const PAGE_SIZE = 250;

const readAllRows = async (queryForRange: (from: number, to: number) => any): Promise<Row[]> => {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await queryForRange(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data || []) as Row[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
};

export default function DailyEvaluationSessionFirst({ client, teamId, userId, members }: Props) {
  const [sessions, setSessions] = useState<Row[]>([]);
  const [matches, setMatches] = useState<Row[]>([]);
  const [roleRows, setRoleRows] = useState<Row[]>([]);
  const [selectedSession, setSelectedSession] = useState("");
  const [selectedMatch, setSelectedMatch] = useState("");
  const [selectedTarget, setSelectedTarget] = useState("");
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [error, setError] = useState("");
  const [retryNonce, setRetryNonce] = useState(0);

  const loadSessions = useCallback(async () => {
    if (!client || !teamId || !userId) {
      setSessions([]);
      setMatches([]);
      setRoleRows([]);
      setSelectedSession("");
      setSelectedMatch("");
      setSelectedTarget("");
      setLoadingSessions(false);
      return;
    }
    setLoadingSessions(true);
    setError("");
    try {
      const rows = await readAllRows((from, to) => client
        .from("canonical_sessions")
        .select("id,team_id,session_type,title,session_date,created_at,archived_at")
        .eq("team_id", teamId)
        .is("archived_at", null)
        .order("session_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to));
      setSessions(rows);
    } catch (cause) {
      setSessions([]);
      setMatches([]);
      setRoleRows([]);
      setSelectedSession("");
      setSelectedMatch("");
      setSelectedTarget("");
      setError(errorMessage(cause));
    } finally {
      setLoadingSessions(false);
    }
  }, [client, teamId, userId]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions, retryNonce]);

  useEffect(() => {
    if (selectedSession && !sessions.some((row) => row.id === selectedSession)) {
      setSelectedSession("");
      setSelectedMatch("");
      setSelectedTarget("");
    }
  }, [sessions, selectedSession]);

  useEffect(() => {
    let active = true;
    setMatches([]);
    setRoleRows([]);
    setSelectedMatch("");
    setSelectedTarget("");
    if (!client || !teamId || !selectedSession) {
      setLoadingMatches(false);
      return () => { active = false; };
    }
    setError("");
    setLoadingMatches(true);
    void (async () => {
      try {
        const rows = await readAllRows((from, to) => client
          .from("canonical_session_matches")
          .select("id,team_id,canonical_session_id,match_sequence,map_name")
          .eq("team_id", teamId)
          .eq("canonical_session_id", selectedSession)
          .order("match_sequence", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to));
        if (active) setMatches(rows);
      } catch (cause) {
        if (active) {
          setMatches([]);
          setRoleRows([]);
          setSelectedMatch("");
          setSelectedTarget("");
          setError(errorMessage(cause));
        }
      } finally {
        if (active) setLoadingMatches(false);
      }
    })();
    return () => { active = false; };
  }, [client, teamId, selectedSession, retryNonce]);

  useEffect(() => {
    let active = true;
    setRoleRows([]);
    setSelectedTarget("");
    if (!client || !teamId || !selectedMatch) {
      setLoadingRoles(false);
      return () => { active = false; };
    }
    setError("");
    setLoadingRoles(true);
    void (async () => {
      try {
        const rows = await readAllRows((from, to) => client
          .from("canonical_session_match_roles")
          .select("id,team_id,canonical_session_id,canonical_session_match_id,player_user_id,role_key_snapshot,role_name_snapshot,role_assignment_status,changed_at")
          .eq("team_id", teamId)
          .eq("canonical_session_match_id", selectedMatch)
          .order("changed_at", { ascending: false, nullsFirst: false })
          .order("id", { ascending: false })
          .range(from, to));
        if (active) setRoleRows(rows);
      } catch (cause) {
        if (active) {
          setRoleRows([]);
          setSelectedTarget("");
          setError(errorMessage(cause));
        }
      } finally {
        if (active) setLoadingRoles(false);
      }
    })();
    return () => { active = false; };
  }, [client, teamId, selectedMatch, retryNonce]);

  const targets = useMemo(() => {
    const seen = new Set<string>();
    const result: Target[] = [];
    for (const row of roleRows) {
      const targetUserId = typeof row.player_user_id === "string" ? row.player_user_id : "";
      if (!targetUserId || seen.has(targetUserId)) continue;
      // The newest snapshot wins even when it is unassigned; never fall back to an older assigned role.
      seen.add(targetUserId);
      const roleKey = canonicalRole(row.role_key_snapshot);
      if (
        row.role_assignment_status !== "assigned" ||
        targetUserId.toLowerCase() === userId.toLowerCase() ||
        !roleKey
      ) continue;
      const member = members.find((candidate) =>
        candidate.status === "active" && candidate.user_id.toLowerCase() === targetUserId.toLowerCase()
      );
      if (!member) continue;
      result.push({
        userId: targetUserId,
        displayName: member.display_name || "Team member",
        playerNumber: member.player_number,
        roleKey,
        roleName: typeof row.role_name_snapshot === "string" && row.role_name_snapshot.trim()
          ? row.role_name_snapshot
          : roleKey.replaceAll("_", " "),
        assignmentId: row.id,
      });
    }
    return result;
  }, [roleRows, members, userId]);

  const session = sessions.find((row) => row.id === selectedSession) || null;
  const match = matches.find((row) => row.id === selectedMatch) || null;
  const target = targets.find((row) => row.userId === selectedTarget) || null;

  const resetSelection = () => {
    setSelectedSession("");
    setSelectedMatch("");
    setSelectedTarget("");
    setError("");
  };

  return (
    <section className="daily-session-first" aria-labelledby="daily-session-first-title">
      <header className="daily-session-first-header">
        <div>
          <span className="daily-session-first-eyebrow">EVOLUTION PHASE 4.1 · DAILY EVALUATION</span>
          <h2 id="daily-session-first-title">Start with the session</h2>
          <p>Choose the real session and match first. Teammate context comes only from that match's historical role snapshot.</p>
        </div>
        <button type="button" className="daily-session-first-refresh" onClick={() => setRetryNonce((value) => value + 1)} disabled={loadingSessions || loadingMatches || loadingRoles}>
          Refresh
        </button>
      </header>

      {!client || !teamId || !userId ? (
        <div className="daily-session-first-state" role="status">Sign in and select an active team to start a daily evaluation.</div>
      ) : null}

      {error ? (
        <div className="daily-session-first-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setRetryNonce((value) => value + 1)}>Retry</button>
        </div>
      ) : null}


      {client && teamId && userId ? (
        <>
          <div className="daily-session-first-date" role="note">
            <span aria-hidden="true">▣</span>
            <div>
              <strong>Evaluation date is locked</strong>
              <small>The existing server-side date rule assigns the date when a submission is saved. No date picker or backdating is available.</small>
            </div>
          </div>

          <div className="daily-session-first-fields">
            <label>
              <span>1 · Canonical session</span>
              <select value={selectedSession} onChange={(event) => {
                setSelectedSession(event.target.value);
                setSelectedMatch("");
                setSelectedTarget("");
                        }} disabled={loadingSessions}>
                <option value="">Select a session</option>
                {sessions.map((row) => (
                  <option key={row.id} value={row.id}>
                    {(row.title || "Untitled session") + " · " + (row.session_type || "session") + (row.session_date ? " · " + row.session_date : "")}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>2 · Match in this session</span>
              <select value={selectedMatch} onChange={(event) => {
                setSelectedMatch(event.target.value);
                setSelectedTarget("");
              }} disabled={!selectedSession || loadingMatches}>
                <option value="">Select a match</option>
                {matches.map((row) => (
                  <option key={row.id} value={row.id}>
                    {"Match " + row.match_sequence + (row.map_name ? " · " + row.map_name : "")}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>3 · Teammate to evaluate</span>
              <select value={selectedTarget} onChange={(event) => {
                setSelectedTarget(event.target.value);
              }} disabled={!selectedMatch || loadingRoles}>
                <option value="">Select another active teammate</option>
                {targets.map((row) => (
                  <option key={row.assignmentId} value={row.userId}>
                    {row.displayName + (row.playerNumber ? " · P" + row.playerNumber : "") + " · " + row.roleName}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {loadingSessions ? <div className="daily-session-first-state" role="status">Loading canonical sessions…</div> : null}
          {!loadingSessions && sessions.length === 0 ? (
            <div className="daily-session-first-state">No canonical sessions are available. Create or link a Scrim, Tournament, or Training session first.</div>
          ) : null}
          {selectedSession && !loadingMatches && matches.length === 0 ? (
            <div className="daily-session-first-state">This session has no canonical match records. Standalone/manual evaluation is handled in Phase 4.2; no match will be invented.</div>
          ) : null}
          {selectedMatch && loadingRoles ? <div className="daily-session-first-state" role="status">Loading historical player-role snapshots…</div> : null}
          {selectedMatch && !loadingRoles && targets.length === 0 ? (
            <div className="daily-session-first-state">No eligible active teammate has an assigned canonical role snapshot for this match. Current roster roles are not substituted for historical roles.</div>
          ) : null}

          {target && session && match ? (
            <div className="daily-session-first-context" aria-live="polite">
              <div>
                <span className="daily-session-first-context-label">SELECTED EVALUATION CONTEXT</span>
                <strong>{target.displayName}</strong>
                <small>{session.title || "Canonical session"} · Match {match.match_sequence}{match.map_name ? " · " + match.map_name : ""}</small>
              </div>
              <span className="daily-session-first-role">{target.roleName}</span>
            </div>
          ) : null}

          <footer className="daily-session-first-footer">
            <span>Self-evaluation is excluded from the visible target list. Server-side rejection is added with the submission contract. No evaluation data is written here; submission belongs to the atomic-save point.</span>
            <button type="button" className="daily-session-first-clear" onClick={resetSelection} disabled={!selectedSession && !selectedMatch && !selectedTarget}>Clear selection</button>
          </footer>
        </>
      ) : null}
    </section>
  );
}
