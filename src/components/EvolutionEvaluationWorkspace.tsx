import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CANONICAL_DIMENSION_REGISTRY } from "../lib/evolution-dimensions";
import "./EvolutionEvaluationWorkspace.css";

type Row = Record<string, any>;
type Member = { id: string; user_id: string; display_name: string; player_number: number | null; assigned_role?: string | null; membership_role: string; status: string };
type Props = { client: SupabaseClient | null; teamId: string; userId: string; membershipRole: string; members: Member[] };
type Draft = { state: "observed" | "not_observed" | "not_applicable" | "incomplete" | "rejected_evidence"; rating: number; evidenceId: string; title: string; observation: string; visibility: "team" | "coaches" | "private"; sourceLocator: string; reason: string };
const blankDraft = (): Draft => ({ state: "observed", rating: 5, evidenceId: "", title: "", observation: "", visibility: "coaches", sourceLocator: "", reason: "" });
const roleKey = (value: unknown): string | null => {
  const key = typeof value === "string" ? value.trim().toLowerCase() : "";
  const aliases: Record<string,string> = {
    "primary rusher":"primary_rusher","primary-rusher":"primary_rusher","primary_rusher":"primary_rusher",
    "secondary rusher":"secondary_rusher","secondary-rusher":"secondary_rusher","secondary_rusher":"secondary_rusher",
    "third rusher flanker":"third_rusher_flanker","third-rusher-flanker":"third_rusher_flanker","third_rusher_flanker":"third_rusher_flanker",
    "sniper + igl":"sniper_igl","sniper igl":"sniper_igl","sniper-igl":"sniper_igl","sniper_igl":"sniper_igl",
    "substitute flex":"substitute_flex","substitute-flex":"substitute_flex","substitute_flex":"substitute_flex","other":"other"
  };
  return aliases[key] ?? null;
};
const messageOf = (error: unknown) => error instanceof Error ? error.message : "The evaluation action could not be completed.";
const dateLabel = (value: string | null | undefined) => value ? new Date(value).toLocaleString() : "Not recorded";

export default function EvolutionEvaluationWorkspace({ client, teamId, userId, membershipRole, members }: Props) {
  const canManage = membershipRole === "owner" || membershipRole === "coach";
  const [sessions,setSessions] = useState<Row[]>([]);
  const [matches,setMatches] = useState<Row[]>([]);
  const [roles,setRoles] = useState<Row[]>([]);
  const [contexts,setContexts] = useState<Row[]>([]);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState("");
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [selectedSession,setSelectedSession] = useState("");
  const [selectedMatch,setSelectedMatch] = useState("");
  const [selectedRole,setSelectedRole] = useState("");
  const [selectedContext,setSelectedContext] = useState("");
  const [context,setContext] = useState<Row|null>(null);
  const [rubric,setRubric] = useState<Row|null>(null);
  const [criteria,setCriteria] = useState<Row[]>([]);
  const [weightSet,setWeightSet] = useState<Row|null>(null);
  const [weights,setWeights] = useState<Row[]>([]);
  const [assessments,setAssessments] = useState<Row[]>([]);
  const [evidence,setEvidence] = useState<Row[]>([]);
  const [evidenceStatuses,setEvidenceStatuses] = useState<Row[]>([]);
  const [evidenceLinks,setEvidenceLinks] = useState<Row[]>([]);
  const [readiness,setReadiness] = useState<Row|null>(null);
  const [scoreSnapshots,setScoreSnapshots] = useState<Row[]>([]);
  const [coverageSnapshots,setCoverageSnapshots] = useState<Row[]>([]);
  const [previousEvaluation,setPreviousEvaluation] = useState<Row|null>(null);
  const [drafts,setDrafts] = useState<Record<string,Draft>>({});
  const [recalculationReason,setRecalculationReason] = useState("");

  const loadIndex = useCallback(async () => {
    if (!client || !teamId) { setLoading(false); setSessions([]); setMatches([]); setRoles([]); setContexts([]); return; }
    setLoading(true); setError("");
    try {
      const [s,m,r,c] = await Promise.all([
        client.from("canonical_sessions").select("*").eq("team_id",teamId).is("archived_at",null).order("session_date",{ascending:false,nullsFirst:false}).order("created_at",{ascending:false}).limit(250),
        client.from("canonical_session_matches").select("*").eq("team_id",teamId).order("match_sequence"),
        client.from("canonical_session_match_roles").select("*").eq("team_id",teamId).order("changed_at",{ascending:false}),
        client.from("evolution_evaluation_contexts").select("*").eq("team_id",teamId).order("created_at",{ascending:false}).limit(100)
      ]);
      for (const q of [s,m,r,c]) if (q.error) throw q.error;
      setSessions(s.data||[]); setMatches(m.data||[]); setRoles(r.data||[]); setContexts(c.data||[]);
      if (!selectedSession && s.data?.length) setSelectedSession(s.data[0].id);
    } catch (e) { setError(messageOf(e)); }
    finally { setLoading(false); }
  },[client,teamId,selectedSession]);

  const loadContext = useCallback(async (id: string, preserveDrafts = false) => {
    if (!client || !id) return;
    setBusy("loading"); setError(""); setNotice("");
    try {
      const c = await client.from("evolution_evaluation_contexts").select("*").eq("team_id",teamId).eq("id",id).single();
      if (c.error) throw c.error;
      const [rb,wb] = await Promise.all([
        client.from("evolution_evaluation_rubric_bindings").select("*").eq("team_id",teamId).eq("evaluation_context_id",id).maybeSingle(),
        client.from("evolution_evaluation_role_weight_bindings").select("*").eq("team_id",teamId).eq("evaluation_context_id",id).maybeSingle()
      ]);
      if (rb.error) throw rb.error; if (wb.error) throw wb.error;
      if (!rb.data || !wb.data) throw new Error("This evaluation context is missing its immutable rubric or historical role-weight binding. No score can be calculated until its original binding is restored by an authorized administrator.");
      const [rv,ws] = await Promise.all([
        client.from("evolution_rubric_versions").select("*").eq("team_id",teamId).eq("id",rb.data.rubric_version_id).single(),
        client.from("evolution_role_weight_sets").select("*").eq("team_id",teamId).eq("id",wb.data.weight_set_id).single()
      ]);
      if (rv.error) throw rv.error; if (ws.error) throw ws.error;
      const [cr,w,a,e,rd,ss,cs] = await Promise.all([
        client.from("evolution_rubric_dimension_criteria").select("*").eq("team_id",teamId).eq("rubric_version_id",rv.data.id).order("sort_order"),
        client.from("evolution_role_dimension_weights").select("*").eq("team_id",teamId).eq("weight_set_id",ws.data.id).order("dimension_key"),
        client.from("evolution_evaluation_current_dimension_assessments").select("*").eq("team_id",teamId).eq("evaluation_context_id",id),
        client.from("evolution_evidence_items").select("*").eq("team_id",teamId).eq("evaluation_context_id",id).order("created_at",{ascending:false}),
        client.from("evolution_evaluation_assessment_readiness").select("*").eq("team_id",teamId).eq("evaluation_context_id",id).maybeSingle(),
        client.from("evolution_player_score_snapshots").select("*").eq("team_id",teamId).eq("evaluation_context_id",id).order("created_at",{ascending:false}),
        client.from("evolution_evidence_coverage_snapshots").select("*").eq("team_id",teamId).eq("evaluation_context_id",id).order("created_at",{ascending:false})
      ]);
      for (const q of [cr,w,a,e,rd,ss,cs]) if (q.error) throw q.error;
      const evidenceIds = (e.data||[]).map((x:Row)=>x.id);
      const [es,dl] = evidenceIds.length ? await Promise.all([
        client.from("evolution_evidence_current_status").select("*").eq("team_id",teamId).in("evidence_item_id",evidenceIds),
        client.from("evolution_evidence_dimension_links").select("*").eq("team_id",teamId).in("evidence_item_id",evidenceIds)
      ]) : [{data:[],error:null},{data:[],error:null}];
      if (es.error) throw es.error; if (dl.error) throw dl.error;
      setContext(c.data); setRubric(rv.data); setWeightSet(ws.data); setCriteria(cr.data||[]); setWeights(w.data||[]);
      setAssessments(a.data||[]); setEvidence(e.data||[]);
      setEvidenceStatuses(es.data||[]);
      setEvidenceLinks(dl.data||[]);
      setReadiness(rd.data||null); setScoreSnapshots(ss.data||[]); setCoverageSnapshots(cs.data||[]);
      if (!preserveDrafts) setDrafts({});
      setPreviousEvaluation(null);
      if (canManage) {
        const prior = await client.from("evolution_player_score_snapshots")
          .select("id,evaluation_context_id,score_status,score100,provisional_score100,coverage_percent,created_at")
          .eq("team_id",teamId).eq("player_member_id",c.data.player_member_id)
          .lt("created_at",c.data.created_at).neq("evaluation_context_id",id).order("created_at",{ascending:false}).limit(1).maybeSingle();
        if (!prior.error) setPreviousEvaluation(prior.data||null);
      }
    } catch (e) { setContext(null); setError(messageOf(e)); }
    finally { setBusy(""); }
  },[client,teamId,canManage]);

  useEffect(()=>{void loadIndex();},[loadIndex]);
  useEffect(()=>{if(selectedContext)void loadContext(selectedContext);else{setContext(null);setRubric(null);setWeightSet(null);}},[selectedContext,loadContext]);

  const selectedSessionRow = sessions.find(x=>x.id===selectedSession);
  const sessionMatches = useMemo(()=>matches.filter(x=>x.canonical_session_id===selectedSession),[matches,selectedSession]);
  const matchRoles = useMemo(()=>roles.filter(x=>x.canonical_session_match_id===selectedMatch && x.role_assignment_status==="assigned" && !!roleKey(x.role_key_snapshot)),[roles,selectedMatch]);
  const currentRole = roles.find(x=>x.id===context?.role_assignment_id);
  const currentMember = members.find(m=>m.user_id===context?.player_user_id);
  const statusFor = (id:string) => evidenceStatuses.find(x=>x.evidence_item_id===id);
  const linksFor = (id:string) => evidenceLinks.filter(x=>x.evidence_item_id===id);
  const currentAssessment = (key:string) => assessments.find(x=>x.dimension_key===key);
  const activeEvidenceFor = (key:string) => evidence.filter(x=>linksFor(x.id).some(link=>link.dimension_key===key));

  const startEvaluation = async () => {
    if (!client || !teamId || !userId || !canManage) return;
    const role = matchRoles.find(x=>x.id===selectedRole);
    const member = role ? members.find(x=>x.user_id===role.player_user_id && x.status==="active") : null;
    const canonicalKey = roleKey(role?.role_key_snapshot);
    const match = matches.find(x=>x.id===selectedMatch);
    if (!selectedSessionRow || !match || !role || !member || !canonicalKey) { setError("Select a canonical session, its match and a player with an assigned historical role snapshot."); return; }
    setBusy("create"); setError(""); setNotice("");
    try {
      const now = new Date().toISOString();
      const [rubricRows,weightRows] = await Promise.all([
        client.from("evolution_rubric_versions").select("*").eq("team_id",teamId).eq("lifecycle_status","active"),
        client.from("evolution_role_weight_sets").select("*").eq("team_id",teamId).eq("lifecycle_status","active").eq("role_key",canonicalKey)
      ]);
      if (rubricRows.error) throw rubricRows.error; if (weightRows.error) throw weightRows.error;
      const effective = (row:Row) => !!row.effective_from && new Date(row.effective_from).getTime()<=Date.parse(now) && (!row.effective_to || Date.parse(row.effective_to)>Date.parse(now));
      const rubricOptions = (rubricRows.data||[]).filter(effective);
      if (!rubricOptions.length) throw new Error("No active, effective rubric is configured for this team. An owner/coach must publish a versioned rubric before an evaluation can start.");
      const compatible = (weightRows.data||[]).filter((x:Row)=>rubricOptions.some((r:Row)=>r.id===x.rubric_version_id) && effective(x));
      if (!compatible.length) throw new Error("No active, effective role-weight set exists for this historical role. Publish a complete 100% weight set for the selected rubric and role before starting.");
      const compatiblePairs = compatible.map((weight:Row)=>({weight,rubric:rubricOptions.find((row:Row)=>row.id===weight.rubric_version_id)})).filter((pair:any)=>!!pair.rubric);
      compatiblePairs.sort((a:any,b:any)=>Date.parse(b.rubric.effective_from)-Date.parse(a.rubric.effective_from)||b.weight.version_number-a.weight.version_number);
      const chosenPair = compatiblePairs[0];
      if (!chosenPair) throw new Error("The active rubric has no matching active role-weight set. Select a rubric/role pair with a complete published weight set.");
      const chosenRubric = chosenPair.rubric;
      const chosenWeight = chosenPair.weight;
      const ctx = await client.from("evolution_evaluation_contexts").insert({
        team_id:teamId,player_member_id:member.id,player_user_id:member.user_id,
        canonical_session_id:selectedSessionRow.id,canonical_session_match_id:match.id,
        role_assignment_id:role.id,created_by:userId
      }).select("*").single();
      if (ctx.error) throw ctx.error;
      const rubricBinding = await client.from("evolution_evaluation_rubric_bindings").insert({
        team_id:teamId,evaluation_context_id:ctx.data.id,rubric_version_id:chosenRubric.id,bound_by:userId
      });
      if (rubricBinding.error) throw rubricBinding.error;
      const weightBinding = await client.from("evolution_evaluation_role_weight_bindings").insert({
        team_id:teamId,evaluation_context_id:ctx.data.id,role_assignment_id:role.id,
        weight_set_id:chosenWeight.id,role_key:canonicalKey,bound_by:userId
      });
      if (weightBinding.error) throw weightBinding.error;
      setSelectedContext(ctx.data.id); await loadIndex();
      setNotice("Evaluation context created and pinned to the exact match role, rubric and weight-set versions.");
    } catch(e) { setError(messageOf(e)); }
    finally { setBusy(""); }
  };

  const updateDraft = (key:string, patch:Partial<Draft>) => setDrafts(old=>({ ...old,[key]:{...(old[key]||blankDraft()),...patch} }));
  const saveDimension = async (key:string) => {
    if (!client || !context || !userId || !canManage) return;
    const criterion = criteria.find(x=>x.dimension_key===key);
    const weight = weights.find(x=>x.dimension_key===key);
    const d = drafts[key] || {...blankDraft(),state:weight?"observed":"not_applicable"};
    if (!criterion || (!weight && d.state!=="not_applicable") || (weight && d.state==="not_applicable")) {
      setError("This assessment state does not match the dimension's historical role applicability."); return;
    }
    setBusy("save:"+key); setError(""); setNotice("");
    try {
      let evidenceId: string|null = null;
      if (d.state==="observed" || d.state==="rejected_evidence") {
        evidenceId = d.evidenceId || null;
        if (d.state==="observed" && !evidenceId) {
          if (d.title.trim().length<1 || d.observation.trim().length<1) throw new Error("Evidence title and observation are required before recording a rating.");
          if (d.sourceLocator.trim()) {
            let parsed:URL;
            try { parsed = new URL(d.sourceLocator.trim()); } catch { throw new Error("Source reference must be a valid HTTP or HTTPS URL."); }
            if (parsed.protocol!=="https:" && parsed.protocol!=="http:") throw new Error("Source reference must use HTTP or HTTPS.");
          }
          const item = await client.from("evolution_evidence_items").insert({
            team_id:teamId,evaluation_context_id:context.id,visibility:d.visibility,
            source_type:"manual_observation",title:d.title.trim(),observation:d.observation.trim(),
            source_locator:d.sourceLocator.trim()||null,created_by:userId
          }).select("*").single();
          if (item.error) throw item.error;
          evidenceId=item.data.id;
        }
        if (!evidenceId) throw new Error("Choose evidence for this assessment.");
        if (d.state==="observed" && !linksFor(evidenceId).some(link=>link.dimension_key===key)) {
          const existingLinks = linksFor(evidenceId);
          if (existingLinks.length>0) throw new Error("This evidence is already linked to another dimension. Create a separate observation for this dimension.");
          const link = await client.from("evolution_evidence_dimension_links").insert({
            team_id:teamId,evidence_item_id:evidenceId,dimension_key:key,
            definition_version:criterion.dimension_definition_version,created_by:userId
          });
          if (link.error) throw new Error("Evidence was saved, but its dimension link failed: "+link.error.message+". Refresh; the unlinked evidence will remain available to attach without recreating it.");
        }
        if (d.state==="rejected_evidence" && statusFor(evidenceId)?.status!=="rejected") throw new Error("Rejected Evidence requires an item whose current verification status is Rejected.");
        if (d.state==="observed" && !["pending","verified","corrected"].includes(statusFor(evidenceId)?.status || "")) {
          throw new Error("Observed ratings require pending, verified or corrected evidence.");
        }
      }
      const latest = currentAssessment(key);
      const insert = await client.from("evolution_evaluation_dimension_assessment_events").insert({
        team_id:teamId,evaluation_context_id:context.id,dimension_key:key,
        dimension_definition_version:criterion.dimension_definition_version,
        revision_number:(latest?.revision_number||0)+1,assessment_state:d.state,
        rating_value:d.state==="observed"?d.rating:null,evidence_item_id:evidenceId,
        reason:d.state==="observed"?null:d.reason.trim(),actor_user_id:userId
      });
      if (insert.error) throw insert.error;
      await loadContext(context.id,true);
      setDrafts(old=>{const next={...old};delete next[key];return next;});
      setNotice("Assessment revision saved. Earlier revisions remain in the audit history.");
    } catch(e) { await loadContext(context.id,true); setError(messageOf(e)); }
    finally { setBusy(""); }
  };

  const verifyEvidence = async (item:Row) => {
    if (!client || !canManage) return;
    setBusy("verify:"+item.id); setError(""); setNotice("");
    try {
      const result = await client.rpc("transition_evolution_evidence_status",{
        p_evidence_item_id:item.id,p_to_status:"verified",p_reason:null,p_evidence_version_id:null
      });
      if (result.error) throw result.error;
      if (context) await loadContext(context.id,true);
      setNotice("Evidence verification recorded in the append-only event history.");
    } catch(e) { setError(messageOf(e)); }
    finally { setBusy(""); }
  };

  const calculate = async () => {
    if (!client || !context || !canManage) return;
    if (scoreSnapshots.length>0 && recalculationReason.trim().length<3) {
      setError("A 3–1000 character reason is required before recalculating an existing score snapshot."); return;
    }
    setBusy("calculate"); setError(""); setNotice("");
    try {
      const coverage = await client.rpc("calculate_evolution_evidence_coverage",{p_evaluation_context_id:context.id});
      if (coverage.error) throw coverage.error;
      const score = await client.rpc("calculate_evolution_player_score_snapshot",{
        p_evaluation_context_id:context.id,p_recalculation_reason:scoreSnapshots.length?recalculationReason.trim():null
      });
      if (score.error) throw score.error;
      setRecalculationReason("");
      await loadContext(context.id,true);
      setNotice("Coverage and score calculation completed. The database returned an immutable, versioned snapshot.");
    } catch(e) { setError(messageOf(e)); }
    finally { setBusy(""); }
  };

  const sessionTitle = (id:string) => sessions.find(x=>x.id===id)?.title || "Canonical session";
  const matchTitle = (id:string) => { const m=matches.find(x=>x.id===id); return m ? "Match "+m.match_sequence+(m.map_name?" · "+m.map_name:"") : "Canonical match"; };
  const score = scoreSnapshots[0];
  const coverage = coverageSnapshots[0];
  const scoreValue = (snapshot:Row|undefined) => snapshot?.score_status==="final" ? Number(snapshot.score100) : snapshot?.score_status==="provisional" ? Number(snapshot.provisional_score100) : null;
  const scoreDelta = scoreValue(score)===null || scoreValue(scoreSnapshots[1])===null ? null : Number((scoreValue(score)!-scoreValue(scoreSnapshots[1])!).toFixed(2));
  const canCreate = !!client && !!teamId && canManage && sessions.length>0 && matches.length>0 && roles.length>0;
  const unsavedDraftCount = Object.keys(drafts).length;
  const discardDrafts = () => setDrafts({});

  return <section className="evolution-eval-workspace" aria-labelledby="evolution-eval-title">
    <header className="evolution-eval-heading">
      <div><span className="evolution-eval-eyebrow">EVOLUTION PHASE 3.13 · CANONICAL WORKFLOW</span><h2 id="evolution-eval-title">Player evaluation</h2><p>Evidence first. Historical role and rubric stay pinned to the exact match context.</p></div>
      <button type="button" className="evolution-eval-quiet" onClick={()=>void loadIndex()} disabled={loading||!!busy}>↻ Refresh</button>
    </header>
    {!client || !teamId ? <div className="evolution-eval-empty">Sign in and select a team to use canonical evaluations.</div> : null}
    {error && <div className="evolution-eval-error" role="alert"><span>{error}</span><button type="button" onClick={()=>{setError("");if(selectedContext)void loadContext(selectedContext,unsavedDraftCount>0);else void loadIndex();}}>Retry</button></div>}
    {notice && <div className="evolution-eval-notice" role="status">{notice}</div>}
    {loading ? <div className="evolution-eval-empty" role="status">Loading canonical evaluation records…</div> : <>
      <div className="evolution-eval-create-grid">
        <div className="evolution-eval-panel">
          <div className="evolution-eval-panel-top"><span className="evolution-eval-kicker">NEW EVALUATION</span><span className="evolution-eval-role-lock">STAFF ONLY</span></div>
          <label>Canonical session<select value={selectedSession} onChange={e=>{setSelectedSession(e.target.value);setSelectedMatch("");setSelectedRole("");}} disabled={!canManage}><option value="">Select session</option>{sessions.map(s=><option key={s.id} value={s.id}>{s.title} · {s.session_type}</option>)}</select></label>
          <label>Canonical match<select value={selectedMatch} onChange={e=>{setSelectedMatch(e.target.value);setSelectedRole("");}} disabled={!canManage||!selectedSession}><option value="">Select match</option>{sessionMatches.map(m=><option key={m.id} value={m.id}>Match {m.match_sequence}{m.map_name?" · "+m.map_name:""}</option>)}</select></label>
          <label>Player & historical role<select value={selectedRole} onChange={e=>setSelectedRole(e.target.value)} disabled={!canManage||!selectedMatch}><option value="">Select player role snapshot</option>{matchRoles.map(r=>{const p=members.find(m=>m.user_id===r.player_user_id);return <option key={r.id} value={r.id}>{p?.display_name||"Player"} · {r.role_name_snapshot||r.role_key_snapshot}</option>;})}</select></label>
          {!canManage && <p className="evolution-eval-muted">Only active owners and coaches can create or score evaluations. Members retain the access granted by database RLS.</p>}
          <button type="button" className="evolution-eval-primary" disabled={!canCreate||!selectedSession||!selectedMatch||!selectedRole||!!busy||unsavedDraftCount>0} onClick={startEvaluation}>{busy==="create"?"Creating context…":"Start canonical evaluation"}</button>
          {!sessions.length && <p className="evolution-eval-muted">No canonical sessions are available yet. Link a Scrim or Tournament source and create canonical match/role snapshots first.</p>}
          {selectedMatch && !matchRoles.length && <p className="evolution-eval-muted">This match has no assigned historical player-role snapshots. Do not infer roles from the current roster.</p>}
        </div>
        <div className="evolution-eval-panel">
          <span className="evolution-eval-kicker">EXISTING EVALUATIONS</span>
          <label>Open evaluation<select value={selectedContext} disabled={unsavedDraftCount>0} onChange={e=>setSelectedContext(e.target.value)}><option value="">Choose a saved evaluation</option>{contexts.map(c=>{const p=members.find(m=>m.id===c.player_member_id);return <option key={c.id} value={c.id}>{p?.display_name||"Player"} · {sessionTitle(c.canonical_session_id)} · {matchTitle(c.canonical_session_match_id)} · {new Date(c.created_at).toLocaleDateString()}</option>;})}</select></label>
          <p className="evolution-eval-muted">Historical contexts are immutable. Reopening one loads its exact match, role, rubric, weight-set and assessment history.</p>
          {unsavedDraftCount>0 && <p className="evolution-eval-muted" role="status">{unsavedDraftCount} unsaved dimension draft(s). Save them or discard drafts before switching evaluations. <button type="button" className="evolution-eval-secondary" onClick={discardDrafts}>Discard all drafts</button></p>}
          <div className="evolution-eval-counts"><span><b>{contexts.length}</b> contexts</span><span><b>{sessions.length}</b> sessions</span><span><b>{matches.length}</b> matches</span></div>
        </div>
      </div>
    </>}
    {context && rubric && weightSet && <div className="evolution-eval-detail">
      <section className="evolution-eval-context-card">
        <div><span className="evolution-eval-kicker">PINNED EVALUATION CONTEXT</span><h3>{currentMember?.display_name||"Player"}</h3><p>{sessionTitle(context.canonical_session_id)} · {matchTitle(context.canonical_session_match_id)}</p><small>{currentRole?.role_name_snapshot||currentRole?.role_key_snapshot||"Historical role"} · Context created {dateLabel(context.created_at)}</small></div>
        <div className="evolution-eval-version-tags"><span>Rubric v{rubric.version_number}</span><span>Weights v{weightSet.version_number}</span><span>{weightSet.role_key}</span></div>
      </section>
      {readiness && <section className="evolution-eval-readiness">
        <div className="evolution-eval-readiness-head"><div><span className="evolution-eval-kicker">ASSESSMENT READINESS</span><b>{String(readiness.assessment_status||"draft").toUpperCase()}</b></div><small>{readiness.observed_dimension_count||0}/{readiness.applicable_dimension_count||weights.length} observed · {readiness.missing_dimension_count||0} missing · {readiness.unverified_observed_dimension_count||0} unverified</small></div>
        <div className="evolution-eval-progress"><i style={{width:String(Math.max(0,Math.min(100,((readiness.observed_dimension_count||0)/Math.max(1,readiness.applicable_dimension_count||weights.length))*100)))+"%"}}/></div>
      </section>}
      <section className="evolution-eval-panel">
        <div className="evolution-eval-section-head"><div><span className="evolution-eval-kicker">RUBRIC · {rubric.title}</span><h3>Dimension assessment</h3><p>{rubric.description}</p></div><span className="evolution-eval-role-lock">VERSIONED</span></div>
        <div className="evolution-eval-dimensions">
          {criteria.map(criterion=>{
            const weight=weights.find(w=>w.dimension_key===criterion.dimension_key);
            const definition=CANONICAL_DIMENSION_REGISTRY.find(d=>d.key===criterion.dimension_key);
            if(!definition)return null;
            const applicable=!!weight;
            const saved=currentAssessment(criterion.dimension_key);
            const draft=drafts[criterion.dimension_key]||{...blankDraft(),state:weight?"observed":"not_applicable"};
            const linked=activeEvidenceFor(criterion.dimension_key);
            const availableEvidence=evidence.filter(item=>linksFor(item.id).some(link=>link.dimension_key===criterion.dimension_key)||!evidenceLinks.some(link=>link.evidence_item_id===item.id));
            const anchors=criterion.rating_anchors||{};
            const roleGuidance=criterion.role_guidance?.[weightSet.role_key];
            return <article className="evolution-eval-dimension" key={criterion.dimension_key}>
              <header><div><span>{String(criterion.sort_order).padStart(2,"0")} / 06</span><h4>{definition.label}</h4><p>{criterion.criteria_guidance}</p><small>{definition.definition}</small>{roleGuidance&&<small className="evolution-eval-role-guidance">Role guidance: {String(roleGuidance)}</small>}</div><strong>{weight?(weight.weight_basis_points/100).toFixed(2):"N/A"}<small>{weight?"%":"· role"}</small></strong></header>
              <div className="evolution-eval-anchor"><b>Rating anchors</b><div>{[0,1,2,3,4,5,6,7,8,9,10].map(n=><span key={n}><b>{n}</b> {String(anchors[String(n)]||"—")}</span>)}</div></div>
              {drafts[criterion.dimension_key] && <div className="evolution-eval-unsaved" role="status">UNSAVED DRAFT · Save this revision or reset it before leaving.</div>}
              {saved && <div className="evolution-eval-saved">Current: <b>{saved.assessment_state==="observed"?String(saved.rating_value)+"/10":String(saved.assessment_state).replaceAll("_"," ")}</b> · Revision {saved.revision_number} · {dateLabel(saved.created_at)}</div>}
              <div className="evolution-eval-editor">
                <label>Assessment state<select value={draft.state} onChange={e=>updateDraft(criterion.dimension_key,{state:e.target.value as Draft["state"],evidenceId:""})}>{applicable?<><option value="observed">Observed</option><option value="not_observed">Not Observed</option><option value="incomplete">Incomplete</option><option value="rejected_evidence">Rejected Evidence</option></>:<option value="not_applicable">Not Applicable · excluded by historical role</option>}</select></label>
                {draft.state==="observed" && <>
                  <label>Observed rating <output>{draft.rating}/10</output><input type="range" min="0" max="10" step="1" value={draft.rating} onChange={e=>updateDraft(criterion.dimension_key,{rating:Number(e.target.value)})}/></label>
                  <label>Existing evidence<select value={draft.evidenceId} onChange={e=>updateDraft(criterion.dimension_key,{evidenceId:e.target.value})}><option value="">Create new evidence below</option>{availableEvidence.filter(x=>["pending","verified","corrected"].includes(statusFor(x.id)?.status||"pending")).map(x=><option key={x.id} value={x.id}>{x.title} · {statusFor(x.id)?.status||"pending"}</option>)}</select></label>
                  {!draft.evidenceId && <div className="evolution-eval-evidence-form"><label>Evidence title<input maxLength={160} value={draft.title} onChange={e=>updateDraft(criterion.dimension_key,{title:e.target.value})} placeholder="Specific observed behavior"/></label><label>Observation<textarea maxLength={4000} value={draft.observation} onChange={e=>updateDraft(criterion.dimension_key,{observation:e.target.value})} placeholder="Describe what happened, without inferring intent or match outcome."/></label><div className="evolution-eval-form-row"><label>Visibility<select value={draft.visibility} onChange={e=>updateDraft(criterion.dimension_key,{visibility:e.target.value as Draft["visibility"]})}><option value="coaches">Coaches</option><option value="team">Team</option><option value="private">Private to author</option></select></label><label>Source link (optional)<input type="url" value={draft.sourceLocator} onChange={e=>updateDraft(criterion.dimension_key,{sourceLocator:e.target.value})} placeholder="https://…"/></label></div></div>}
                </>}
                {draft.state==="rejected_evidence" && <label>Rejected evidence<select value={draft.evidenceId} onChange={e=>updateDraft(criterion.dimension_key,{evidenceId:e.target.value})}><option value="">Select rejected evidence</option>{linked.filter(x=>statusFor(x.id)?.status==="rejected").map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select></label>}
                {draft.state!=="observed" && <label>Reason (required)<textarea maxLength={1000} minLength={3} value={draft.reason} onChange={e=>updateDraft(criterion.dimension_key,{reason:e.target.value})} placeholder="Explain why this dimension is not currently rated."/></label>}
                <div className="evolution-eval-dimension-actions"><button type="button" className="evolution-eval-secondary" disabled={!!busy||!canManage} onClick={()=>setDrafts(old=>{const next={...old};delete next[criterion.dimension_key];return next;})}>Reset draft</button><button type="button" className="evolution-eval-primary" disabled={!!busy||!canManage||(applicable&&draft.state==="not_applicable")||(!applicable&&draft.state!=="not_applicable")||(draft.state==="observed"&&!draft.evidenceId&&(!draft.title.trim()||!draft.observation.trim()))||(draft.state!=="observed"&&draft.reason.trim().length<3)||(draft.state==="rejected_evidence"&&!draft.evidenceId)} onClick={()=>saveDimension(criterion.dimension_key)}>{busy==="save:"+criterion.dimension_key?"Saving…":"Save assessment revision"}</button></div>
              </div>
            </article>;
          })}
        </div>
        {!weights.length && <p className="evolution-eval-muted">No applicable dimensions are bound to this role-weight set. Scoring is blocked; do not fill missing dimensions with zero.</p>}
      </section>
      <section className="evolution-eval-panel">
        <div className="evolution-eval-section-head"><div><span className="evolution-eval-kicker">EVIDENCE REGISTER</span><h3>Evidence & verification</h3><p>Evidence remains append-only; status changes are recorded by the verification event ledger.</p></div></div>
        <div className="evolution-eval-evidence-list">
          {evidence.map(item=>{const status=statusFor(item.id);const canVerify=canManage&&item.created_by!==userId&&item.visibility!=="private"&&status?.status!=="verified"&&["pending","corrected"].includes(status?.status||"pending");return <article key={item.id}><div><b>{item.title}</b><p>{item.observation}</p><small>{item.source_type.replaceAll("_"," ")} · {item.visibility} · {status?.status||"pending"} · {dateLabel(item.created_at)}</small>{item.source_locator&&<a href={item.source_locator} target="_blank" rel="noreferrer">Open source reference ↗</a>}</div>{canVerify&&<button type="button" className="evolution-eval-secondary" disabled={!!busy} onClick={()=>verifyEvidence(item)}>Verify evidence</button>}</article>;})}
          {!evidence.length&&<p className="evolution-eval-muted">No evidence has been recorded for this evaluation yet.</p>}
        </div>
      </section>
      {previousEvaluation && <section className="evolution-eval-result-card evolution-eval-previous"><span className="evolution-eval-kicker">PREVIOUS EVALUATION · SAME PLAYER</span><strong>{previousEvaluation.score_status==="final"?String(previousEvaluation.score100)+"/100":previousEvaluation.score_status==="provisional"?String(previousEvaluation.provisional_score100)+"/100 · provisional":"Insufficient"}</strong><small>Coverage {previousEvaluation.coverage_percent??"—"}% · {dateLabel(previousEvaluation.created_at)}</small>{score?.score_status==="final"&&previousEvaluation.score_status==="final"&&<small>Change from previous final score: {Number(score.score100)-Number(previousEvaluation.score100)>0?"+":""}{(Number(score.score100)-Number(previousEvaluation.score100)).toFixed(2)} points</small>}</section>}
      <section className="evolution-eval-results">
        <div className="evolution-eval-result-card"><span className="evolution-eval-kicker">LATEST EVIDENCE COVERAGE</span><strong>{coverage?.coverage_percent!=null?String(coverage.coverage_percent)+"%":"—"}</strong><small>{coverage?.coverage_status||"Not calculated"} · independent of performance score</small></div>
        <div className="evolution-eval-result-card"><span className="evolution-eval-kicker">LATEST PLAYER SCORE</span><strong>{score?.score_status==="final"?String(score.score100)+"/100":score?.score_status==="provisional"?String(score.provisional_score100)+"/100*":"—"}</strong><small>{score?.score_status||"Not calculated"} · {score?.calculation_version||"No snapshot"}</small><small>{scoreDelta===null?"No comparable prior score": "vs previous snapshot: "+(scoreDelta>0?"+":"")+scoreDelta.toFixed(2)+" points"}</small></div>
      </section>
      {scoreSnapshots.length>0 && <label className="evolution-eval-reason">Recalculation reason (required for a new snapshot)<input value={recalculationReason} onChange={e=>setRecalculationReason(e.target.value)} maxLength={1000} placeholder="Explain which evidence or assessment changed"/></label>}
      <div className="evolution-eval-calc-actions"><button type="button" className="evolution-eval-primary" disabled={!canManage||!!busy||!weights.length} onClick={calculate}>{busy==="calculate"?"Calculating…":scoreSnapshots.length?"Recalculate & append history":"Calculate coverage & score"}</button><span>Final score appears only when the database policy gates pass. Provisional scores are clearly marked.</span></div>
      <section className="evolution-eval-panel">
        <div className="evolution-eval-section-head"><div><span className="evolution-eval-kicker">IMMUTABLE CALCULATION HISTORY</span><h3>Prior snapshots</h3></div></div>
        <div className="evolution-eval-history">
          {scoreSnapshots.map((snap,index)=><article key={snap.id}><span>#{scoreSnapshots.length-index}</span><div><b>{snap.score_status==="final"?String(snap.score100)+"/100":snap.score_status==="provisional"?String(snap.provisional_score100)+"/100 · provisional":"Insufficient"}</b><small>Coverage {snap.coverage_percent}% · {dateLabel(snap.created_at)}</small>{snap.recalculation_reason&&<small>Reason: {snap.recalculation_reason}</small>}</div><small>{snap.calculation_version}</small></article>)}
          {!scoreSnapshots.length&&<p className="evolution-eval-muted">No score snapshots yet. Calculations are appended only after the required assessment/evidence gates pass.</p>}
        </div>
      </section>
    </div>}
    {selectedContext && busy==="loading" && <div className="evolution-eval-empty" role="status">Loading pinned rubric, evidence and score history…</div>}
  </section>;
}
