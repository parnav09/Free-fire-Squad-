import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, any>;
type Member = { user_id: string; display_name: string; player_number: number | null; status?: string };
type Props = { client: SupabaseClient | null; teamId: string; members: Member[]; view: "players" | "analytics" };

const sourceLabel = (value: unknown) => value === "scrim" ? "Scrims" : value === "tournament" ? "Tournament" : value === "training" ? "Training" : "Unlinked source";
const dateLabel = (value: unknown) => typeof value === "string" && value ? new Date(value).toLocaleDateString() : "Date not recorded";
const errorText = (value: unknown) => value && typeof value === "object" && "message" in value ? String((value as {message:unknown}).message) : "Canonical integration data could not be loaded.";

export default function CanonicalModuleIntegrationPanel({ client, teamId, members, view }: Props) {
  const [sessions, setSessions] = useState<Row[]>([]);
  const [sources, setSources] = useState<Row[]>([]);
  const [matches, setMatches] = useState<Row[]>([]);
  const [contexts, setContexts] = useState<Row[]>([]);
  const [snapshots, setSnapshots] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!client || !teamId) {
        setSessions([]); setSources([]); setMatches([]); setContexts([]); setSnapshots([]);
        setLoading(false); setError("");
        return;
      }
      setLoading(true); setError("");
      const queries = await Promise.all([
        client.from("canonical_sessions").select("id,session_type,title,session_date,created_at").eq("team_id", teamId).is("archived_at", null).order("session_date", { ascending: false, nullsFirst: false }).limit(250),
        client.from("canonical_session_sources").select("canonical_session_id,source_system,scrim_record_id,tournament_cycle_id,training_session_id").eq("team_id", teamId).limit(500),
        client.from("canonical_session_matches").select("id,canonical_session_id,match_sequence,map_name").eq("team_id", teamId).order("match_sequence").limit(2000),
        client.from("evolution_evaluation_contexts").select("id,player_member_id,player_user_id,canonical_session_id,canonical_session_match_id,role_assignment_id,created_at").eq("team_id", teamId).order("created_at", { ascending: false }).limit(500),
        client.from("evolution_player_score_snapshots").select("id,evaluation_context_id,score_status,score100,provisional_score100,coverage_percent,created_at").eq("team_id", teamId).order("created_at", { ascending: false }).limit(1000)
      ]);
      const failed = queries.find(q => q.error);
      if (cancelled) return;
      if (failed?.error) {
        setError(errorText(failed.error));
      } else {
        setSessions(queries[0].data || []);
        setSources(queries[1].data || []);
        setMatches(queries[2].data || []);
        setContexts(queries[3].data || []);
        setSnapshots(queries[4].data || []);
      }
      setLoading(false);
    };
    void load();
    return () => { cancelled = true; };
  }, [client, teamId]);

  const memberByUser = useMemo(() => new Map(members.map(member => [member.user_id, member])), [members]);
  const sessionById = useMemo(() => new Map(sessions.map(session => [session.id, session])), [sessions]);
  const sourceBySession = useMemo(() => new Map(sources.map(source => [source.canonical_session_id, source])), [sources]);
  const matchById = useMemo(() => new Map(matches.map(match => [match.id, match])), [matches]);
  const latestSnapshotByContext = useMemo(() => {
    const result = new Map<string, Row>();
    for (const snapshot of snapshots) if (!result.has(snapshot.evaluation_context_id)) result.set(snapshot.evaluation_context_id, snapshot);
    return result;
  }, [snapshots]);
  const traceRows = useMemo(() => contexts.map(context => {
    const session = sessionById.get(context.canonical_session_id);
    const source = sourceBySession.get(context.canonical_session_id);
    const match = context.canonical_session_match_id ? matchById.get(context.canonical_session_match_id) : null;
    const member = memberByUser.get(context.player_user_id);
    const snapshot = latestSnapshotByContext.get(context.id);
    const sourceRecordId = source?.scrim_record_id || source?.tournament_cycle_id || source?.training_session_id || null;
    return { context, session, source, sourceRecordId, match, member, snapshot };
  }).sort((a,b) => String(b.context.created_at).localeCompare(String(a.context.created_at))), [contexts,sessionById,sourceBySession,matchById,memberByUser,latestSnapshotByContext]);

  const visibleRows = view === "players"
    ? traceRows.filter(row => !!row.member && row.member.status !== "inactive")
    : traceRows;
  const linkedSessions = sources.length;
  const evaluatedContexts = contexts.length;
  const playerCount = new Set(contexts.map(context => context.player_user_id)).size;

  return <section className="connection-panel canonical-module-integration" aria-label="Canonical module integration">
    <div className="backup-panel-head">
      <div><div className="eyebrow">EVOLUTION · CANONICAL TRACE</div><h3>{view === "players" ? "Player evaluation lineage" : "Cross-module evaluation lineage"}</h3>
      <p>One canonical session and match identity connects source modules to historical player-role evaluations. Competitive results and internal player scores remain separate.</p></div>
      <span className="phase-pill">READ ONLY</span>
    </div>
    {loading ? <p className="muted" role="status">Loading canonical links…</p> : error ? <div className="muted" role="alert">{error}</div> : <>
      {view === "analytics" && <div className="score-forecast-grid canonical-integration-kpis">
        <article><small>Linked source sessions</small><strong>{linkedSessions}</strong></article>
        <article><small>Canonical evaluations</small><strong>{evaluatedContexts}</strong></article>
        <article><small>Players evaluated</small><strong>{playerCount}</strong></article>
      </div>}
      {visibleRows.length === 0 ? <p className="muted">{view === "players" ? "No canonical evaluations are linked to the active roster yet." : "No canonical evaluations are available for this team yet."}</p> :
        <div className="canonical-trace-list">{visibleRows.slice(0, view === "players" ? 30 : 50).map(({context,session,source,sourceRecordId,match,member,snapshot}) => {
          const score = snapshot?.score_status === "final" ? snapshot.score100 : snapshot?.score_status === "provisional" ? snapshot.provisional_score100 : null;
          return <article className="canonical-trace-row" key={context.id}>
            <div className="canonical-trace-main">
              <strong>{member ? `P${member.player_number || "—"} · ${member.display_name}` : "Player record"}</strong>
              <span>{session?.title || "Canonical session"} · {dateLabel(session?.session_date || context.created_at)}</span>
              <small>{sourceLabel(source?.source_system)}{sourceRecordId ? ` · source ${String(sourceRecordId).slice(0,8)}` : " · source link pending"} · {match ? `Match ${match.match_sequence}${match.map_name ? " · "+match.map_name : ""}` : "Session-level context"}</small>
            </div>
            <div className="canonical-trace-result">
              <b>{snapshot ? snapshot.score_status === "insufficient" ? "Insufficient data" : score === null ? "Score unavailable" : `${score}/100` : "Not calculated"}</b>
              <small>{snapshot ? `${Number(snapshot.coverage_percent || 0).toFixed(1)}% coverage` : "No score snapshot"}</small>
            </div>
          </article>;
        })}</div>}
      <p className="muted canonical-trace-note">Historical role and rubric bindings stay attached to the evaluation context. This panel never derives player performance from kills, placement, Booyah or tournament points.</p>
    </>}
  </section>;
}
