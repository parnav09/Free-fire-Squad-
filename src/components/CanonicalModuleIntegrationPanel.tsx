import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, any>;
type Member = { user_id: string; display_name: string; player_number: number | null; status?: string };
type Props = { client: SupabaseClient | null; teamId: string; members: Member[]; view: "players" | "analytics" };

const PAGE_SIZE = 500;

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

const sourceLabel = (value: unknown) => value === "scrim" ? "Scrims" : value === "tournament" ? "Tournament" : value === "training" ? "Training" : "Unlinked source";
const dateLabel = (value: unknown) => {
  if (typeof value !== "string" || !value) return "Date not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date not recorded" : date.toLocaleDateString();
};
const errorText = (value: unknown) => value && typeof value === "object" && "message" in value
  ? String((value as { message: unknown }).message)
  : "Canonical integration data could not be loaded.";

export default function CanonicalModuleIntegrationPanel({ client, teamId, members, view }: Props) {
  const [sessions, setSessions] = useState<Row[]>([]);
  const [sources, setSources] = useState<Row[]>([]);
  const [matches, setMatches] = useState<Row[]>([]);
  const [roles, setRoles] = useState<Row[]>([]);
  const [contexts, setContexts] = useState<Row[]>([]);
  const [snapshots, setSnapshots] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!client || !teamId) {
        setSessions([]); setSources([]); setMatches([]); setRoles([]); setContexts([]); setSnapshots([]);
        setLoading(false); setError("");
        return;
      }

      // Clear the previous team's data before a new request. A failed refresh must
      // never leave an old team's lineage visible under the new team heading.
      setLoading(true);
      setError("");
      setSessions([]); setSources([]); setMatches([]); setRoles([]); setContexts([]); setSnapshots([]);

      try {
        const [nextSessions, nextSources, nextMatches, nextRoles, nextContexts, nextSnapshots] = await Promise.all([
          readAllRows((from, to) => client.from("canonical_sessions")
            .select("id,team_id,session_type,title,session_date,created_at,archived_at")
            .eq("team_id", teamId)
            .order("session_date", { ascending: false, nullsFirst: false })
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .range(from, to)),
          readAllRows((from, to) => client.from("canonical_session_sources")
            .select("id,team_id,canonical_session_id,source_system,scrim_record_id,tournament_cycle_id,training_session_id,source_record_id,created_at")
            .eq("team_id", teamId)
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .range(from, to)),
          readAllRows((from, to) => client.from("canonical_session_matches")
            .select("id,team_id,canonical_session_id,match_sequence,map_name")
            .eq("team_id", teamId)
            .order("match_sequence", { ascending: true })
            .order("id", { ascending: true })
            .range(from, to)),
          readAllRows((from, to) => client.from("canonical_session_match_roles")
            .select("id,team_id,canonical_session_match_id,player_user_id,role_key_snapshot,role_name_snapshot,role_assignment_status")
            .eq("team_id", teamId)
            .order("id", { ascending: true })
            .range(from, to)),
          readAllRows((from, to) => client.from("evolution_evaluation_contexts")
            .select("id,team_id,player_member_id,player_user_id,canonical_session_id,canonical_session_match_id,role_assignment_id,created_at")
            .eq("team_id", teamId)
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .range(from, to)),
          readAllRows((from, to) => client.from("evolution_player_score_snapshots")
            .select("id,team_id,evaluation_context_id,score_status,score100,provisional_score100,coverage_percent,created_at")
            .eq("team_id", teamId)
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .range(from, to))
        ]);

        if (cancelled) return;
        setSessions(nextSessions);
        setSources(nextSources);
        setMatches(nextMatches);
        setRoles(nextRoles);
        setContexts(nextContexts);
        setSnapshots(nextSnapshots);
      } catch (loadError) {
        if (cancelled) return;
        setSessions([]); setSources([]); setMatches([]); setRoles([]); setContexts([]); setSnapshots([]);
        setError(errorText(loadError));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [client, teamId, refreshVersion]);

  const memberByUser = useMemo(() => new Map(members.map(member => [member.user_id, member])), [members]);
  const sessionById = useMemo(() => new Map(sessions.map(session => [session.id, session])), [sessions]);
  const sourceBySession = useMemo(() => new Map(sources.map(source => [source.canonical_session_id, source])), [sources]);
  const matchById = useMemo(() => new Map(matches.map(match => [match.id, match])), [matches]);
  // Phase 3.13 stores canonical_session_match_roles.id in role_assignment_id.
  const roleById = useMemo(() => new Map(roles.map(role => [role.id, role])), [roles]);
  const latestSnapshotByContext = useMemo(() => {
    const result = new Map<string, Row>();
    // Rows arrive newest-first; keep the first immutable snapshot for each context.
    for (const snapshot of snapshots) if (!result.has(snapshot.evaluation_context_id)) result.set(snapshot.evaluation_context_id, snapshot);
    return result;
  }, [snapshots]);

  const sourceRows = useMemo(() => sessions.map(session => {
    const source = sourceBySession.get(session.id);
    const sourceRecordId = source?.source_record_id || source?.scrim_record_id || source?.tournament_cycle_id || source?.training_session_id || null;
    return { session, source, sourceRecordId };
  }).sort((a, b) => String(b.session.session_date || b.session.created_at).localeCompare(String(a.session.session_date || a.session.created_at))),
  [sessions, sourceBySession]);

  const traceRows = useMemo(() => contexts.map(context => {
    const session = sessionById.get(context.canonical_session_id);
    const source = sourceBySession.get(context.canonical_session_id);
    const match = context.canonical_session_match_id ? matchById.get(context.canonical_session_match_id) : null;
    const member = memberByUser.get(context.player_user_id);
    const role = roleById.get(context.role_assignment_id);
    const snapshot = latestSnapshotByContext.get(context.id);
    const sourceRecordId = source?.source_record_id || source?.scrim_record_id || source?.tournament_cycle_id || source?.training_session_id || null;
    return { context, session, source, sourceRecordId, match, member, role, snapshot };
  }).sort((a, b) => String(b.context.created_at).localeCompare(String(a.context.created_at))),
  [contexts, sessionById, sourceBySession, matchById, memberByUser, roleById, latestSnapshotByContext]);

  const linkedSessions = sources.length;
  const evaluatedContexts = contexts.length;
  const playerCount = new Set(contexts.map(context => context.player_user_id)).size;

  return <section className="connection-panel canonical-module-integration" aria-label="Canonical module integration">
    <div className="backup-panel-head">
      <div>
        <div className="eyebrow">EVOLUTION · CANONICAL TRACE</div>
        <h3>{view === "players" ? "Player evaluation lineage" : "Cross-module evaluation lineage"}</h3>
        <p>One canonical session and match identity connects source modules to historical player-role evaluations. Competitive results and internal player scores remain separate.</p>
      </div>
      <span className="phase-pill">READ ONLY</span>
    </div>

    {loading ? <p className="muted" role="status">Loading canonical links…</p> : error ? <div className="canonical-trace-error" role="alert">
      <p>{error}</p>
      <button type="button" className="secondary-button canonical-trace-retry" onClick={() => setRefreshVersion(value => value + 1)}>Retry loading canonical links</button>
    </div> : !client || !teamId ? <p className="muted">Select a team to view canonical links.</p> : <>
      {view === "analytics" && <div className="score-forecast-grid canonical-integration-kpis">
        <article><small>Linked source sessions</small><strong>{linkedSessions}</strong></article>
        <article><small>Canonical evaluations</small><strong>{evaluatedContexts}</strong></article>
        <article><small>Players evaluated</small><strong>{playerCount}</strong></article>
      </div>}

      <section className="canonical-trace-section" aria-label="Linked source sessions">
        <div className="canonical-trace-section-head"><h4>Linked source sessions</h4><span>{sourceRows.length}</span></div>
        {sourceRows.length === 0 ? <p className="muted">No linked Scrims, Tournament or Training sessions are available yet.</p> : <div className="canonical-trace-list canonical-source-list">
          {sourceRows.map(({ session, source, sourceRecordId }) => <article className="canonical-trace-row" key={session.id}>
            <div className="canonical-trace-main">
              <strong>{sourceLabel(source?.source_system || session.session_type)}</strong>
              <span>{session.title} · {dateLabel(session.session_date || session.created_at)}</span>
              <small>{sourceRecordId ? "Source record " + String(sourceRecordId).slice(0, 8) : "Source mapping unavailable"} · Canonical session " + String(session.id).slice(0, 8)}</small>
            </div>
            {session.archived_at ? <span className="canonical-trace-archived">ARCHIVED</span> : <span className="canonical-trace-live">LINKED</span>}
          </article>)}
        </div>}
      </section>

      <section className="canonical-trace-section" aria-label="Player evaluation lineage">
        <div className="canonical-trace-section-head"><h4>Player evaluation lineage</h4><span>{traceRows.length}</span></div>
        {traceRows.length === 0 ? <p className="muted">No canonical evaluations are available yet. Linked source sessions remain visible above.</p> : <div className="canonical-trace-list canonical-evaluation-list">
          {traceRows.map(({ context, session, source, sourceRecordId, match, member, role, snapshot }) => {
            const score = snapshot?.score_status === "final" ? snapshot.score100 : snapshot?.score_status === "provisional" ? snapshot.provisional_score100 : null;
            const playerLabel = member
              ? `P${member.player_number || "—"} · ${member.display_name}${member.status && member.status !== "active" ? " · Former member" : ""}`
              : "Historical player";
            const matchLabel = context.canonical_session_match_id
              ? match ? `Match ${match.match_sequence}${match.map_name ? " · " + match.map_name : ""}` : "Match reference unavailable"
              : "Session-level context";
            return <article className="canonical-trace-row" key={context.id}>
              <div className="canonical-trace-main">
                <strong>{playerLabel}</strong>
                <span>{session?.title || "Canonical session unavailable"} · {dateLabel(session?.session_date || context.created_at)}</span>
                <small>{sourceLabel(source?.source_system)}{sourceRecordId ? " · source " + String(sourceRecordId).slice(0, 8) : " · source link unavailable"} · {matchLabel} · {role?.role_name_snapshot || role?.role_key_snapshot || "Historical role unavailable"}</small>
              </div>
              <div className="canonical-trace-result">
                <b>{snapshot ? snapshot.score_status === "insufficient" ? "Insufficient data" : score === null ? "Score unavailable" : `${score}/100` : "Not calculated"}</b>
                <small>{snapshot && snapshot.coverage_percent != null ? `${Number(snapshot.coverage_percent).toFixed(1)}% coverage` : "Coverage unavailable"}</small>
              </div>
            </article>;
          })}
        </div>}
      </section>
      <p className="muted canonical-trace-note">Historical role and rubric bindings stay attached to the evaluation context. This panel never derives player performance from kills, placement, Booyah or tournament points.</p>
    </>}
  </section>;
}
