import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { integrateCanonicalSource, type CanonicalSourceSystem } from "../lib/canonical-module-integration";
import "./CanonicalSessionsWorkspace.css";

type Row = Record<string, any>;
const CANONICAL_PAGE_SIZE = 500;
const readAllRows = async (queryForRange: (from: number, to: number) => any): Promise<Row[]> => {
  const rows: Row[] = [];
  for (let from = 0; ; from += CANONICAL_PAGE_SIZE) {
    const { data, error } = await queryForRange(from, from + CANONICAL_PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data || []) as Row[];
    rows.push(...page);
    if (page.length < CANONICAL_PAGE_SIZE) return rows;
  }
};
type Member = { id: string; user_id: string; display_name: string; player_number: number | null; assigned_role?: string | null; membership_role: string; status: string };
type Session = { id: string; team_id: string; session_type: "scrim"|"tournament"|"training"; title: string; session_date: string|null; scheduled_at: string|null; season_label: string|null; lifecycle_status: string; lifecycle_version: number; archived_at: string|null; created_at: string; created_by: string };
type Match = { id: string; canonical_session_id: string; match_sequence: number; source_system: string; map_name: string|null; mode: string|null; round_label: string|null };
type RosterMember = { id: string; membership_id_snapshot: string; player_user_id: string; display_name_snapshot: string; player_number_snapshot: number|null; selection_status: string; membership_role_snapshot: string };
type ResultRow = { id: string; canonical_session_id: string; canonical_session_match_id: string|null; status: string; current_version_no: number; updated_at: string };
type Props = { client: SupabaseClient|null; teamId: string; userId: string; membershipRole: string; members: Member[] };

const STATUSES = ["draft","scheduled","in_progress","awaiting_results","verified","closed","cancelled","archived"];
const STATUS: Record<string,string> = {draft:"Draft",scheduled:"Scheduled",in_progress:"In progress",awaiting_results:"Awaiting results",verified:"Verified",closed:"Closed",cancelled:"Cancelled",archived:"Archived"};
const TYPE: Record<string,string> = {scrim:"Scrim",tournament:"Tournament",training:"Training"};
const SOURCES = [["official_scorecard","Official scorecard"],["coach_report","Coach report"],["team_record","Team record"],["training_log","Training log"],["other","Other"]] as const;
const uid = () => crypto.randomUUID();
const localDateTime = () => { const d=new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,16); };
const errText = (e: unknown) => e instanceof Error ? e.message : "The action could not be completed.";
const dateText = (v: string|null) => v ? new Date(v + (v.length===10 ? "T00:00:00" : "")).toLocaleDateString() : "Date not set";
const timeText = (v: string|null) => v ? new Date(v).toLocaleString() : "Not recorded";
const jsonText = (v: unknown) => JSON.stringify(v ?? {},null,2);
const parseObject = (v: string) => { const x: unknown=JSON.parse(v); if(!x || typeof x!=="object" || Array.isArray(x) || !Object.keys(x).length) throw new Error("Enter a non-empty JSON object. Never add estimated or inferred values."); return x; };
const checklistKeys = (t: string) => t==="training" ? ["source_identity_confirmed","activity_confirmed","participants_confirmed","no_inferred_values"] : ["source_identity_confirmed","match_identity_confirmed","values_reviewed","no_inferred_values"];
const nextRosterStatuses: Record<string,string[]> = {available:["available","invited","selected"],invited:["invited","selected","confirmed"],selected:["selected","confirmed"],confirmed:["confirmed"]};

export default function CanonicalSessionsWorkspace({client,teamId,userId,membershipRole,members}:Props) {
  const canManage = membershipRole==="owner" || membershipRole==="coach";
  const [sessions,setSessions]=useState<Session[]>([]);
  const [sources,setSources]=useState<Row[]>([]);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [online,setOnline]=useState(typeof navigator==="undefined"?true:navigator.onLine);
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [selectedId,setSelectedId]=useState("");
  const [detail,setDetail]=useState<Row|null>(null);
  const [typeFilter,setTypeFilter]=useState("all");
  const [statusFilter,setStatusFilter]=useState("all");
  const [seasonFilter,setSeasonFilter]=useState("all");
  const [dateFilter,setDateFilter]=useState("");
  const [showCreate,setShowCreate]=useState(false);
  const [showLink,setShowLink]=useState(false);
  const [createTitle,setCreateTitle]=useState("");
  const [createDate,setCreateDate]=useState(new Date().toLocaleDateString("en-CA"));
  const [createTime,setCreateTime]=useState("");
  const [createSeason,setCreateSeason]=useState("");
  const [linkType,setLinkType]=useState<CanonicalSourceSystem>("scrim");
  const [linkRows,setLinkRows]=useState<Row[]>([]);
  const [linkLoading,setLinkLoading]=useState(false);
  const [sourceRows,setSourceRows]=useState<Row[]>([]);
  const [sessionReceipt,setSessionReceipt]=useState(false);
  const [matches,setMatches]=useState<Match[]>([]);
  const [roster,setRoster]=useState<RosterMember[]>([]);
  const [rosterLocked,setRosterLocked]=useState(false);
  const [selectedRosterIds,setSelectedRosterIds]=useState<string[]>([]);
  const [roles,setRoles]=useState<Row[]>([]);
  const [roleAssignments,setRoleAssignments]=useState<Row[]>([]);
  const [substitutions,setSubstitutions]=useState<Row[]>([]);
  const [participations,setParticipations]=useState<Row[]>([]);
  const [lifecycleEvents,setLifecycleEvents]=useState<Row[]>([]);
  const [resultRows,setResultRows]=useState<ResultRow[]>([]);
  const [resultVersions,setResultVersions]=useState<Row[]>([]);
  const [resultEvents,setResultEvents]=useState<Row[]>([]);
  const [activeMatchId,setActiveMatchId]=useState("");
  const [editTitle,setEditTitle]=useState("");
  const [editDate,setEditDate]=useState("");
  const [editSeason,setEditSeason]=useState("");
  const [reason,setReason]=useState("");
  const [cancelCode,setCancelCode]=useState("cancelled");
  const [resultSource,setResultSource]=useState("coach_report");
  const [resultReference,setResultReference]=useState("");
  const [resultRaw,setResultRaw]=useState("{}");
  const [verifiedRaw,setVerifiedRaw]=useState("{}");
  const [checklist,setChecklist]=useState<Record<string,boolean>>({});
  const [decisionReason,setDecisionReason]=useState("");
  const [roleChoice,setRoleChoice]=useState<Record<string,string>>({});
  const [roleReason,setRoleReason]=useState("Role recorded from session evidence");
  const [subOut,setSubOut]=useState("");
  const [subIn,setSubIn]=useState("");
  const [subCategory,setSubCategory]=useState("tactical");
  const [subProvenance,setSubProvenance]=useState("coach_report");
  const [subReason,setSubReason]=useState("");
  const [subRound,setSubRound]=useState("");
  const [subEffectiveAt,setSubEffectiveAt]=useState(localDateTime);
  const [transferRole,setTransferRole]=useState(false);
  const [rosterReason,setRosterReason]=useState("Session roster confirmed by staff");

  const loadSessions=useCallback(async(quiet=false)=>{
    if(!client||!teamId){setSessions([]);setLoading(false);return;}
    quiet?setRefreshing(true):setLoading(true); setError("");
    try{
      const [sessionRows,sourceRows]=await Promise.all([
        readAllRows((from,to)=>client.from("canonical_sessions").select("*").eq("team_id",teamId).order("session_date",{ascending:false,nullsFirst:false}).order("created_at",{ascending:false}).order("id",{ascending:false}).range(from,to)),
        readAllRows((from,to)=>client.from("canonical_session_sources").select("id,canonical_session_id,source_system,source_record_id,created_at").eq("team_id",teamId).order("created_at",{ascending:false}).order("id",{ascending:false}).range(from,to))
      ]);
      setSessions(sessionRows as Session[]);setSources(sourceRows);
    }catch(e){setError(errText(e));}finally{setLoading(false);setRefreshing(false);}
  },[client,teamId]);

  const loadDetail=useCallback(async(id:string)=>{
    if(!client||!id)return;
    setBusy("loading-detail");setError("");
    try{
      const [s,src,m,rh,rd,le,receipt,results]=await Promise.all([
        client.from("canonical_sessions").select("*").eq("team_id",teamId).eq("id",id).single(),
        client.from("canonical_session_sources").select("*").eq("team_id",teamId).eq("canonical_session_id",id),
        client.from("canonical_session_matches").select("*").eq("team_id",teamId).eq("canonical_session_id",id).order("match_sequence"),
        client.from("canonical_session_rosters").select("*").eq("team_id",teamId).eq("canonical_session_id",id).maybeSingle(),
        client.from("canonical_team_role_definitions").select("*").eq("team_id",teamId).eq("is_current",true).eq("is_active",true).order("role_name"),
        canManage?client.from("canonical_session_lifecycle_events").select("*").eq("team_id",teamId).eq("canonical_session_id",id).order("changed_at",{ascending:false}):Promise.resolve({data:[],error:null}),
        canManage?client.from("canonical_session_result_submissions").select("*").eq("team_id",teamId).eq("canonical_session_id",id).maybeSingle():Promise.resolve({data:null,error:null}),
        canManage?client.from("canonical_session_results").select("*").eq("team_id",teamId).eq("canonical_session_id",id):Promise.resolve({data:[],error:null})
      ]);
      for(const q of [s,src,m,rh,rd,le,receipt,results])if(q.error)throw q.error;
      const matchRows=(m.data||[]) as Match[];const header=rh.data as Row|null;
      const [rm,pa,ra,su]=await Promise.all([
        client.from("canonical_session_roster_members").select("*").eq("team_id",teamId).eq("canonical_session_id",id).order("player_number_snapshot"),
        canManage&&matchRows.length?client.from("canonical_session_match_participants").select("*").eq("team_id",teamId).eq("canonical_session_id",id):Promise.resolve({data:[],error:null}),
        canManage&&matchRows.length?client.from("canonical_session_match_roles").select("*").eq("team_id",teamId).eq("canonical_session_id",id):Promise.resolve({data:[],error:null}),
        canManage?client.from("canonical_session_substitutions").select("*").eq("team_id",teamId).eq("canonical_session_id",id).order("effective_at"):Promise.resolve({data:[],error:null})
      ]);
      for(const q of [rm,pa,ra,su])if(q.error)throw q.error;
      const rr=(results.data||[]) as ResultRow[];const ids=rr.map(x=>x.id);
      const [vers,events]=ids.length&&canManage?await Promise.all([
        client.from("canonical_session_result_versions").select("*").eq("team_id",teamId).in("result_id",ids).order("version_no",{ascending:false}),
        client.from("canonical_session_result_events").select("*").eq("team_id",teamId).in("result_id",ids).order("changed_at",{ascending:false})
      ]):[{data:[],error:null},{data:[],error:null}];
      if(vers.error)throw vers.error;if(events.error)throw events.error;
      setDetail(s.data as Row);setSourceRows(src.data||[]);setMatches(matchRows);setRoster(rm.data||[]);
      setRosterLocked(!!header||(rm.data||[]).length>0);setSelectedRosterIds((rm.data||[]).filter((x:Row)=>["selected","confirmed"].includes(x.selection_status)).map((x:Row)=>x.membership_id_snapshot));
      setRoles(rd.data||[]);setRoleAssignments(ra.data||[]);setParticipations(pa.data||[]);setSubstitutions(su.data||[]);
      setLifecycleEvents(le.data||[]);setSessionReceipt(!!receipt.data);setResultRows(rr);setResultVersions(vers.data||[]);setResultEvents(events.data||[]);
      setEditTitle(s.data.title||"");setEditDate(s.data.session_date||"");setEditSeason(s.data.season_label||"");
      setActiveMatchId(matchRows[0]?.id||"");
    }catch(e){setError(errText(e));}finally{setBusy("");}
  },[client,teamId,canManage]);

  useEffect(()=>{void loadSessions();},[loadSessions]);
  useEffect(()=>{const on=()=>setOnline(true);const off=()=>setOnline(false);window.addEventListener("online",on);window.addEventListener("offline",off);return()=>{window.removeEventListener("online",on);window.removeEventListener("offline",off);};},[]);
  useEffect(()=>{if(selectedId)void loadDetail(selectedId);else setDetail(null);},[selectedId,loadDetail]);

  const seasons=useMemo(()=>Array.from(new Set(sessions.map(s=>s.season_label).filter((x):x is string=>!!x))).sort(),[sessions]);
  const filtered=useMemo(()=>sessions.filter(s=>(typeFilter==="all"||s.session_type===typeFilter)&&(statusFilter==="all"||s.lifecycle_status===statusFilter)&&(seasonFilter==="all"||s.season_label===seasonFilter)&&(!dateFilter||s.session_date===dateFilter)),[sessions,typeFilter,statusFilter,seasonFilter,dateFilter]);
  const activeMatch=matches.find(m=>m.id===activeMatchId)||null;
  const activeResult=resultRows.find(r=>r.canonical_session_match_id===(activeMatch?.id||null))||null;
  const currentVersions=activeResult?resultVersions.filter(v=>v.result_id===activeResult.id):[];
  const currentEvents=activeResult?resultEvents.filter(v=>v.result_id===activeResult.id):[];
  useEffect(()=>{if(!activeResult){setResultRaw("{}");setResultReference("");return;}const version=resultVersions.find(v=>v.result_id===activeResult.id&&v.version_no===activeResult.current_version_no);if(version){setResultRaw(jsonText(version.raw_submitted_values));setResultSource(version.result_source);setResultReference(version.source_reference||"");}const verified=resultEvents.find(e=>e.result_id===activeResult.id&&e.event_kind==="verified"&&e.verified_values);if(verified)setVerifiedRaw(jsonText(verified.verified_values));},[activeResult?.id,activeResult?.current_version_no,resultVersions,resultEvents]);
  const keys=detail?checklistKeys(detail.session_type):[];
  const editable=!!detail&&canManage&&!detail.archived_at&&["draft","scheduled"].includes(detail.lifecycle_status);
  const active=!!detail&&canManage&&!detail.archived_at&&["in_progress","awaiting_results"].includes(detail.lifecycle_status);
  const availableMembers=members.filter(m=>m.status==="active"&&m.player_number!==null).sort((a,b)=>(a.player_number||99)-(b.player_number||99));
  const selectedParticipations=participations.filter(p=>p.canonical_session_match_id===activeMatchId);
  const activeRosterIds=new Set(selectedParticipations.filter(p=>p.participation_status==="participated").map(p=>p.roster_member_id));
  const subOutgoing=roster.filter(m=>activeRosterIds.has(m.id));
  const subIncoming=roster.filter(m=>["selected","confirmed"].includes(m.selection_status)&&!activeRosterIds.has(m.id));
  const sourceFor=(id:string)=>sources.find(s=>s.canonical_session_id===id);

  const runAction=async(key:string,fn:()=>Promise<void>,success:string)=>{
    if(busy)return;if(!online){setError("Offline — reconnect before changing session records.");return;}setBusy(key);setError("");setNotice("");
    try{await fn();setNotice(success);if(selectedId&&key!=="link"&&key!=="create")await loadDetail(selectedId);await loadSessions(true);}
    catch(e){setError(errText(e));}finally{setBusy("");}
  };

  const createTraining=async()=>{
    if(!client||!teamId||!userId)throw new Error("Sign in and select an active team first.");
    if(!createTitle.trim()||createTitle.trim().length>120)throw new Error("Session title must be 1–120 characters.");
    if(!createDate)throw new Error("Choose a session date.");
    const scheduled=createTime?new Date(createDate+"T"+createTime).toISOString():null;
    const {error:e}=await client.rpc("create_canonical_session",{p_team_id:teamId,p_session_type:"training",p_title:createTitle.trim(),p_idempotency_key:uid(),p_session_date:createDate,p_scheduled_at:scheduled,p_season_label:createSeason.trim()||null});
    if(e)throw e;setShowCreate(false);setCreateTitle("");setCreateSeason("");setCreateTime("");await loadSessions(true);
  };

  const openLinkPicker=async()=>{
    if(!client)return;setShowLink(true);setLinkLoading(true);setLinkRows([]);
    try{
      const table=linkType==="scrim"?"scrim_records":linkType==="tournament"?"tournament_cycles":"training_sessions";
      const data=await readAllRows((from,to)=>client.from(table).select("*").eq("team_id",teamId).order("created_at",{ascending:false}).order("id",{ascending:false}).range(from,to));
      const linked=new Set(sources.filter(s=>s.source_system===linkType).map(s=>s.source_record_id));
      setLinkRows(data.filter((x:Row)=>!linked.has(x.id)));
    }catch(e){setError(errText(e));}finally{setLinkLoading(false);}
  };
  const linkSource=async(row:Row)=>{
    if(!client)throw new Error("Database client unavailable.");
    const result=await integrateCanonicalSource(client,teamId,linkType,row.id);
    if(!result.linked)throw new Error(result.message);
    setShowLink(false);await loadSessions(true);setSelectedId(result.canonicalSessionId);
    setNotice(TYPE[linkType]+" source linked · "+result.syncedMatchCount+" match IDs synchronized.");
  };

  const saveMetadata=async()=>{
    if(!client||!detail||!editTitle.trim())throw new Error("A session title is required.");
    const {error:e}=await client.from("canonical_sessions").update({title:editTitle.trim(),session_date:editDate||null,season_label:editSeason.trim()||null}).eq("team_id",teamId).eq("id",detail.id);
    if(e)throw e;
  };
  const transition=async(target:string)=>{
    if(!client||!detail||!reason.trim())throw new Error("Enter a reason for the status change.");
    const {error:e}=await client.rpc("transition_canonical_session",{p_session_id:detail.id,p_expected_version:detail.lifecycle_version,p_target_status:target,p_reason:reason.trim(),p_idempotency_key:uid(),p_cancellation_reason_code:target==="cancelled"?cancelCode:null});
    if(e)throw e;setReason("");
  };
  const reopen=async(target:string)=>{
    if(!client||!detail||!reason.trim())throw new Error("Enter an audited reopen reason.");
    const {error:e}=await client.rpc("reopen_canonical_session",{p_session_id:detail.id,p_expected_version:detail.lifecycle_version,p_target_status:target,p_reason:reason.trim(),p_idempotency_key:uid()});
    if(e)throw e;setReason("");
  };
  const lockRoster=async()=>{
    if(!client||!detail||!selectedRosterIds.length)throw new Error("Select at least one eligible player.");
    const {error:e}=await client.rpc("lock_canonical_session_roster",{p_session_id:detail.id,p_selected_member_ids:selectedRosterIds,p_invited_member_ids:[],p_idempotency_key:uid()});
    if(e)throw e;
  };
  const setRosterStatus=async(id:string,status:string)=>{
    if(!client)throw new Error("Database client unavailable.");
    const {error:e}=await client.rpc("set_canonical_session_roster_member_status",{p_roster_member_id:id,p_target_status:status,p_reason:rosterReason.trim()||"Staff updated selection",p_idempotency_key:uid()});
    if(e)throw e;
  };
  const saveParticipation=async(matchId:string,memberId:string,status:string)=>{
    if(!client)throw new Error("Database client unavailable.");
    const existing=participations.find(p=>p.canonical_session_match_id===matchId&&p.roster_member_id===memberId);
    const {error:e}=existing?await client.rpc("correct_canonical_match_participation",{p_participant_id:existing.id,p_new_status:status,p_reason:"Staff corrected match participation",p_idempotency_key:uid()}):await client.rpc("record_canonical_match_participation",{p_match_id:matchId,p_roster_member_id:memberId,p_participation_status:status,p_reason:"Staff recorded match participation",p_idempotency_key:uid()});
    if(e)throw e;
  };
  const saveRole=async(matchId:string,member:RosterMember,roleId:string)=>{
    if(!client||!roleId)throw new Error("Choose a role first.");
    const {error:e}=await client.rpc("set_canonical_session_match_role",{p_match_id:matchId,p_roster_member_id:member.id,p_role_definition_id:roleId,p_effective_at:new Date().toISOString(),p_effective_round_label:null,p_reason:roleReason.trim()||"Role assigned from session evidence",p_idempotency_key:uid()});
    if(e)throw e;
  };
  const saveSubstitution=async(matchId:string)=>{
    if(!client||!subOut||!subIn||subOut===subIn||!subReason.trim()||!subEffectiveAt)throw new Error("Choose different outgoing/incoming players, effective time and reason.");
    const {error:e}=await client.rpc("record_canonical_session_substitution",{p_match_id:matchId,p_outgoing_roster_member_id:subOut,p_incoming_roster_member_id:subIn,p_effective_at:new Date(subEffectiveAt).toISOString(),p_effective_round_label:subRound.trim()||null,p_category:subCategory,p_source_provenance:subProvenance,p_reason:subReason.trim(),p_transfer_role:transferRole,p_idempotency_key:uid()});
    if(e)throw e;setSubOut("");setSubIn("");setSubReason("");setSubRound("");setSubEffectiveAt(localDateTime());setTransferRole(false);
  };
  const saveResult=async(matchId:string|null,submit:boolean)=>{
    if(!client||!detail)throw new Error("Select a session first.");
    const needsCorrection=!!activeResult&&activeResult.status!=="draft";
    const correction=needsCorrection?decisionReason.trim():null;
    if(submit&&needsCorrection&&!correction)throw new Error("Enter a correction reason before resubmitting this result.");
    const args={p_session_id:detail.id,p_match_id:matchId,p_result_source:resultSource,p_source_reference:resultReference.trim()||null,p_raw_values:parseObject(resultRaw),p_idempotency_key:uid()};
    const {error:e}=submit
      ?await client.rpc("submit_canonical_session_result",{...args,p_correction_reason:correction})
      :await client.rpc("save_canonical_session_result_draft",args);
    if(e)throw e;
  };
  const decideResult=async(result:ResultRow,verify:boolean)=>{
    if(!client||!decisionReason.trim())throw new Error("Enter a verification/rejection reason.");
    if(verify){
      const selected=Object.fromEntries(keys.map(k=>[k,checklist[k]===true]));
      if(Object.values(selected).some(v=>!v))throw new Error("Complete all four verification checks.");
      const {error:e}=await client.rpc("verify_canonical_session_result",{p_result_id:result.id,p_verified_values:parseObject(verifiedRaw),p_checklist:selected,p_reason:decisionReason.trim(),p_idempotency_key:uid()});
      if(e)throw e;
    }else{
      const {error:e}=await client.rpc("reject_canonical_session_result",{p_result_id:result.id,p_reason:decisionReason.trim(),p_idempotency_key:uid()});
      if(e)throw e;
    }
    setDecisionReason("");setChecklist({});
  };
  const submitReceipt=async()=>{
    if(!client||!detail)throw new Error("Select a session first.");
    if(sessionReceipt)throw new Error("The session result receipt has already been recorded.");
    if(!resultRows.length||resultRows.some(r=>!["verified","amended"].includes(r.status)))throw new Error("Verify every result before recording the session receipt.");
    const {error:e}=await client.rpc("submit_canonical_session_results",{p_session_id:detail.id,p_idempotency_key:uid()});if(e)throw e;
  };

  if(!client)return <section className="connection-panel">Connecting to the team database…</section>;
  return <section className="canonical-workspace" aria-label="Canonical sessions workspace">
    <header className="canonical-page-head"><div><span className="eyebrow">EVOLUTION · POINT 2.11</span><h2>Sessions & match control</h2><p>One canonical timeline for Scrims, Tournament and Training. Existing source records stay intact.</p></div><div className="canonical-head-actions">{canManage&&<button className="secondary-button" type="button" onClick={()=>void openLinkPicker()} disabled={!!busy}>Link existing</button>}{canManage&&<button className="primary-button" type="button" onClick={()=>setShowCreate(v=>!v)} disabled={!!busy}>＋ New training session</button>}<button className="canonical-refresh" type="button" aria-label="Refresh sessions" onClick={()=>void loadSessions(true)} disabled={refreshing||!!busy}>↻</button></div></header>
    {!online&&<div className="canonical-error" role="status"><strong>Offline mode</strong><span>Session data is read-only until the connection returns. Existing records are not changed.</span></div>}{notice&&<div className="canonical-notice" role="status">{notice}</div>}{error&&<div className="canonical-error" role="alert"><strong>Action needs attention</strong><span>{error}</span><button type="button" onClick={()=>setError("")} aria-label="Dismiss error">×</button></div>}
    {showCreate&&canManage&&<section className="canonical-panel canonical-create-panel"><div className="canonical-panel-head"><div><span className="eyebrow">NEW CANONICAL SESSION</span><h3>Create a training session</h3><p>Scrim and Tournament sessions are linked from their existing modules to preserve source and match identity.</p></div><button className="canonical-icon-button" type="button" onClick={()=>setShowCreate(false)} aria-label="Close">×</button></div><div className="canonical-form-grid"><label>Session title<input value={createTitle} onChange={e=>setCreateTitle(e.target.value)} maxLength={120} placeholder="Team coordination review"/></label><label>Session date<input type="date" value={createDate} onChange={e=>setCreateDate(e.target.value)}/></label><label>Scheduled time · optional<input type="time" value={createTime} onChange={e=>setCreateTime(e.target.value)}/></label><label>Season / cycle · optional<input value={createSeason} onChange={e=>setCreateSeason(e.target.value)} maxLength={80} placeholder="Season label"/></label></div><div className="canonical-form-actions"><button className="secondary-button" type="button" onClick={()=>setShowCreate(false)}>Cancel</button><button className="primary-button" type="button" disabled={!createTitle.trim()||!!busy} onClick={()=>void runAction("create",createTraining,"Training session created.")}>{busy==="create"?"Creating…":"Create session"}</button></div></section>}
    {showLink&&canManage&&<section className="canonical-panel"><div className="canonical-panel-head"><div><span className="eyebrow">SOURCE INTEGRATION</span><h3>Link an existing module record</h3><p>Only unlinked records are shown. Linking does not rewrite legacy source data.</p></div><button className="canonical-icon-button" type="button" onClick={()=>setShowLink(false)} aria-label="Close">×</button></div><div className="canonical-link-toolbar"><label>Source module<select value={linkType} onChange={e=>{setLinkType(e.target.value as CanonicalSourceSystem);setLinkRows([]);}}><option value="scrim">Scrims</option><option value="tournament">Tournament</option><option value="training">Training</option></select></label><button className="secondary-button" type="button" onClick={()=>void openLinkPicker()} disabled={linkLoading}>{linkLoading?"Loading…":"Find unlinked records"}</button></div>{linkLoading?<div className="canonical-state">Loading source records…</div>:linkRows.length?<div className="canonical-source-list">{linkRows.map(row=><article key={row.id}><div><strong>{row.title||row.scrim_date||TYPE[linkType]}</strong><small>{row.scrim_date||row.cycle_start||row.scheduled_at||row.created_at||"Source date not recorded"}</small></div><button className="secondary-button" type="button" disabled={!!busy} onClick={()=>void runAction("link",()=>linkSource(row),"Source linked.")}>Link session</button></article>)}</div>:<div className="canonical-state">Load records for this module. Existing links are excluded.</div>}</section>}
    <div className="canonical-filters" aria-label="Session filters"><label>Type<select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option value="all">All types</option><option value="scrim">Scrim</option><option value="tournament">Tournament</option><option value="training">Training</option></select></label><label>Status<select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">All statuses</option>{STATUSES.map(s=><option key={s} value={s}>{STATUS[s]}</option>)}</select></label><label>Season<select value={seasonFilter} onChange={e=>setSeasonFilter(e.target.value)}><option value="all">All seasons</option>{seasons.map(s=><option key={s} value={s}>{s}</option>)}</select></label><label>Date<input type="date" value={dateFilter} onChange={e=>setDateFilter(e.target.value)}/></label></div>
    <div className="canonical-layout">
      <section className="canonical-panel canonical-session-list" aria-label="Session list"><div className="canonical-list-head"><div><span className="eyebrow">TEAM SESSION LEDGER</span><h3>All sessions <span>{filtered.length}</span></h3></div><small>{sessions.length} total</small></div>{loading?<div className="canonical-state">Loading sessions…</div>:!filtered.length?<div className="canonical-empty"><span>◷</span><strong>No sessions match these filters</strong><small>Clear a filter or link an existing Scrim, Tournament or Training record.</small><button className="text-button" type="button" onClick={()=>{setTypeFilter("all");setStatusFilter("all");setSeasonFilter("all");setDateFilter("");}}>Clear filters</button></div>:filtered.map(s=>{const src=sourceFor(s.id);return <button type="button" key={s.id} className={"canonical-session-row "+(selectedId===s.id?"is-selected":"")} onClick={()=>setSelectedId(s.id)} aria-pressed={selectedId===s.id}><span className={"canonical-type-mark type-"+s.session_type}>{s.session_type==="scrim"?"S":s.session_type==="tournament"?"T":"P"}</span><span className="canonical-row-copy"><strong>{s.title}</strong><small>{TYPE[s.session_type]}{s.season_label?" · "+s.season_label:""} · {dateText(s.session_date)}</small><small>{src?"Source linked · "+src.source_system:"Canonical session · no legacy source mapping"}</small></span><span className={"canonical-status status-"+s.lifecycle_status}>{STATUS[s.lifecycle_status]||s.lifecycle_status}</span></button>;})}</section>
      <section className="canonical-detail-column" aria-label="Session detail">{!selectedId?<div className="canonical-panel canonical-detail-empty"><span>◫</span><h3>Select a session</h3><p>Inspect matches, roster, roles, substitutions, result provenance and audit history.</p></div>:busy==="loading-detail"||!detail?<div className="canonical-panel canonical-state">Loading session detail…</div>:<>
        <section className="canonical-panel canonical-detail-head"><div className="canonical-detail-top"><button className="canonical-back-link" type="button" onClick={()=>setSelectedId("")}>← All sessions</button><span className={"canonical-status status-"+detail.lifecycle_status}>{STATUS[detail.lifecycle_status]||detail.lifecycle_status}</span></div><div className="canonical-detail-title"><div><span className="eyebrow">{TYPE[detail.session_type].toUpperCase()} · CANONICAL SESSION</span><h2>{detail.title}</h2><p>{dateText(detail.session_date)}{detail.season_label?" · "+detail.season_label:""} · Version {detail.lifecycle_version}</p></div><code>{detail.id.slice(0,8).toUpperCase()}</code></div><div className="canonical-detail-meta"><span>Created {timeText(detail.created_at)}</span><span>{sourceRows.length?"Linked source: "+sourceRows[0].source_system:"No legacy source linked"}</span><span>{detail.archived_at?"Archived "+timeText(detail.archived_at):"Active record"}</span></div></section>
        {editable&&<section className="canonical-panel"><div className="canonical-panel-head"><div><span className="eyebrow">SESSION DETAILS</span><h3>Edit session metadata</h3><p>Only descriptive fields are editable; canonical identity remains stable.</p></div></div><div className="canonical-form-grid"><label>Title<input value={editTitle} onChange={e=>setEditTitle(e.target.value)} maxLength={120}/></label><label>Date<input type="date" value={editDate} onChange={e=>setEditDate(e.target.value)}/></label><label>Season<input value={editSeason} onChange={e=>setEditSeason(e.target.value)} maxLength={80}/></label></div><div className="canonical-form-actions"><button className="primary-button" type="button" disabled={!editTitle.trim()||!!busy} onClick={()=>void runAction("metadata",saveMetadata,"Session details saved.")}>Save details</button></div></section>}
        <section className="canonical-panel canonical-lifecycle-panel"><div className="canonical-panel-head"><div><span className="eyebrow">SESSION LIFECYCLE</span><h3>Controlled status workflow</h3><p>Every transition is permission-checked, versioned and audited by the server.</p></div></div><div className="canonical-lifecycle-steps">{["draft","scheduled","in_progress","awaiting_results","verified","closed"].map((s,i)=><div key={s} className={"canonical-step "+(["draft","scheduled","in_progress","awaiting_results","verified","closed"].indexOf(detail.lifecycle_status)>=i?"step-done":"")}><i>{i+1}</i><span>{STATUS[s]}</span></div>)}</div>{canManage?<div className="canonical-transition-controls"><label>Reason for status change<input value={reason} onChange={e=>setReason(e.target.value)} maxLength={500} placeholder="Why is this change needed?"/></label>{detail.lifecycle_status==="draft"&&<button className="secondary-button" disabled={!!busy||!reason.trim()} onClick={()=>void runAction("transition",()=>transition("scheduled"),"Session scheduled.")}>Schedule</button>}{detail.lifecycle_status==="scheduled"&&<button className="primary-button" disabled={!!busy||!reason.trim()||!rosterLocked} onClick={()=>void runAction("transition",()=>transition("in_progress"),"Session started.")}>Start session</button>}{detail.lifecycle_status==="in_progress"&&<button className="primary-button" disabled={!!busy||!reason.trim()} onClick={()=>void runAction("transition",()=>transition("awaiting_results"),"Session moved to awaiting results.")}>End session · Await results</button>}{detail.lifecycle_status==="awaiting_results"&&<button className="secondary-button" disabled={!!busy||sessionReceipt||!reason.trim()||!resultRows.length||resultRows.some(r=>!["verified","amended"].includes(r.status))} onClick={()=>void runAction("receipt",submitReceipt,"Session result receipt recorded.")}>{sessionReceipt?"Receipt recorded":"Record verified result receipt"}</button>}{detail.lifecycle_status==="awaiting_results"&&<button className="primary-button" disabled={!!busy||!reason.trim()||!resultRows.length||resultRows.some(r=>!["verified","amended"].includes(r.status))||!sessionReceipt} onClick={()=>void runAction("transition",()=>transition("verified"),"Session verified.")}>Verify session</button>}{detail.lifecycle_status==="verified"&&<button className="primary-button" disabled={!!busy||!reason.trim()} onClick={()=>void runAction("transition",()=>transition("closed"),"Session closed.")}>Close session</button>}{["draft","scheduled"].includes(detail.lifecycle_status)&&<><label className="canonical-inline-field">Cancellation type<select value={cancelCode} onChange={e=>setCancelCode(e.target.value)}><option value="cancelled">Cancelled</option><option value="no_show">No show</option><option value="other">Other</option></select></label><button className="canonical-danger-button" disabled={!!busy||!reason.trim()} onClick={()=>void runAction("transition",()=>transition("cancelled"),"Session cancelled.")}>Cancel session</button></>}{["closed","cancelled"].includes(detail.lifecycle_status)&&<button className="secondary-button" disabled={!!busy||!reason.trim()} onClick={()=>void runAction("reopen",()=>reopen(detail.lifecycle_status==="closed"?"verified":"scheduled"),"Session reopened.")}>Reopen session</button>}{detail.lifecycle_status==="closed"&&<button className="canonical-danger-button" disabled={!!busy||!reason.trim()} onClick={()=>void runAction("transition",()=>transition("archived"),"Session archived.")}>Archive session</button>}{detail.lifecycle_status==="archived"&&<button className="secondary-button" disabled={!!busy||!reason.trim()} onClick={()=>void runAction("reopen",()=>reopen("closed"),"Archived session reopened.")}>Reopen archive</button>}</div>:<p className="canonical-readonly-note">Read-only. Only active Owners and Coaches can change session status.</p>}</section>
        <section className="canonical-panel"><div className="canonical-panel-head"><div><span className="eyebrow">ROSTER SNAPSHOT</span><h3>Session participants</h3><p>Player identity and slot are captured once; later roster edits do not rewrite history.</p></div><span className="canonical-count">{roster.length} captured</span></div><p className="canonical-readonly-note">The lock captures current team roles. Update a player’s base role in Players before locking; after lock, match-role changes use the audited timeline.</p><label className="canonical-full-field">Roster change reason<input value={rosterReason} onChange={e=>setRosterReason(e.target.value)} maxLength={500}/></label>{!rosterLocked&&editable?<><div className="canonical-roster-picker">{availableMembers.map(m=><label className="canonical-roster-choice" key={m.id}><input type="checkbox" checked={selectedRosterIds.includes(m.id)} onChange={e=>setSelectedRosterIds(ids=>e.target.checked?[...ids,m.id]:ids.filter(x=>x!==m.id))}/><span className="canonical-slot">P{m.player_number}</span><span><strong>{m.display_name}</strong><small>{m.assigned_role||m.membership_role}</small></span></label>)}</div><div className="canonical-form-actions"><button className="primary-button" type="button" disabled={!!busy||!selectedRosterIds.length} onClick={()=>void runAction("roster",lockRoster,"Roster snapshot locked.")}>Lock roster snapshot</button></div></>:!roster.length?<div className="canonical-state">No roster snapshot exists. Lock the roster before starting the session.</div>:<div className="canonical-roster-list">{roster.map(m=><article key={m.id}><span className="canonical-slot">{m.player_number_snapshot?"P"+m.player_number_snapshot:"—"}</span><div><strong>{m.display_name_snapshot}</strong><small>{m.membership_role_snapshot}</small></div><span className={"canonical-status status-"+m.selection_status}>{m.selection_status}</span>{canManage&&editable&&<select aria-label={"Selection status for "+m.display_name_snapshot} value={m.selection_status} disabled={nextRosterStatuses[m.selection_status]?.length===1||!!busy} onChange={e=>void runAction("roster-status",()=>setRosterStatus(m.id,e.target.value),"Roster selection updated.")}>{(nextRosterStatuses[m.selection_status]||[m.selection_status]).map(status=><option key={status} value={status}>{status}</option>)}</select>}</article>)}</div>}</section>
        <section className="canonical-panel"><div className="canonical-panel-head"><div><span className="eyebrow">MATCH LEDGER</span><h3>Matches <span className="canonical-count">{matches.length}</span></h3><p>Stable match IDs remain attached to their parent session.</p></div></div>{!matches.length?<div className="canonical-state">No competitive match rows. Training sessions intentionally have no phantom matches.</div>:<><div className="canonical-match-tabs">{matches.map(m=><button type="button" key={m.id} className={activeMatchId===m.id?"active":""} onClick={()=>setActiveMatchId(m.id)}><span>MATCH {String(m.match_sequence).padStart(2,"0")}</span><strong>{m.map_name||m.round_label||"Match "+m.match_sequence}</strong></button>)}</div>{activeMatch&&<div className="canonical-match-detail"><div className="canonical-match-context"><span>SESSION / {detail.title}</span><strong>Match {activeMatch.match_sequence}</strong><small>{[activeMatch.map_name,activeMatch.mode,activeMatch.round_label].filter(Boolean).join(" · ")||"Source match context not provided"}</small></div><div className="canonical-participant-list"><h4>Match participation</h4><label className="canonical-full-field">Role change reason<input value={roleReason} onChange={e=>setRoleReason(e.target.value)} maxLength={500}/></label>{roster.filter(m=>["selected","confirmed"].includes(m.selection_status)).map(m=>{const p=selectedParticipations.find(x=>x.roster_member_id===m.id);const role=roleAssignments.find(x=>x.canonical_session_match_id===activeMatch.id&&x.roster_member_id===m.id);return <article key={m.id}><span className="canonical-slot">{m.player_number_snapshot?"P"+m.player_number_snapshot:"—"}</span><div><strong>{m.display_name_snapshot}</strong><small>{p?.participation_status||"Not recorded"}{role?.role_name_snapshot?" · "+role.role_name_snapshot:""}</small></div>{canManage&&active&&<select aria-label={"Participation for "+m.display_name_snapshot} value={p?.participation_status||""} onChange={e=>void runAction("participation",()=>saveParticipation(activeMatch.id,m.id,e.target.value),"Match participation saved.")}><option value="" disabled>Record status</option><option value="participated">Participated</option><option value="absent">Absent</option><option value="substituted">Substituted</option></select>}{canManage&&active&&p?.participation_status==="participated"&&<><select aria-label={"Role for "+m.display_name_snapshot} value={role?.role_definition_id||roleChoice[m.id]||""} onChange={e=>setRoleChoice(x=>({...x,[m.id]:e.target.value}))}><option value="">Choose role…</option>{roles.map(r=><option key={r.id} value={r.id}>{r.role_name}</option>)}</select>{roleChoice[m.id]&&<button type="button" className="secondary-button" disabled={!!busy} onClick={()=>void runAction("role",()=>saveRole(activeMatch.id,m,roleChoice[m.id]),"Role snapshot saved.")}>Save role</button>}</>}</article>;})}</div>{canManage&&active&&<div className="canonical-substitution-form"><h4>Record a substitution</h4><div className="canonical-form-grid"><label>Outgoing player<select value={subOut} onChange={e=>setSubOut(e.target.value)}><option value="">Select outgoing</option>{subOutgoing.map(m=><option key={m.id} value={m.id}>{m.display_name_snapshot}</option>)}</select></label><label>Incoming player<select value={subIn} onChange={e=>setSubIn(e.target.value)}><option value="">Select incoming</option>{subIncoming.map(m=><option key={m.id} value={m.id}>{m.display_name_snapshot}</option>)}</select></label><label>Category<select value={subCategory} onChange={e=>setSubCategory(e.target.value)}><option value="tactical">Tactical</option><option value="availability">Availability</option><option value="ruleset">Ruleset</option><option value="other">Other</option></select></label><label>Evidence source<select value={subProvenance} onChange={e=>setSubProvenance(e.target.value)}><option value="coach_report">Coach report</option><option value="official_scorecard">Official scorecard</option><option value="team_record">Team record</option><option value="other">Other</option></select></label><label>Round / phase · optional<input value={subRound} onChange={e=>setSubRound(e.target.value)} maxLength={80}/></label><label>Effective time<input type="datetime-local" value={subEffectiveAt} onChange={e=>setSubEffectiveAt(e.target.value)}/></label></div><label className="canonical-full-field">Reason<textarea rows={2} value={subReason} onChange={e=>setSubReason(e.target.value)} maxLength={500} placeholder="Factual reason and source context"/></label><label className="canonical-check"><input type="checkbox" checked={transferRole} onChange={e=>setTransferRole(e.target.checked)}/> Transfer role when the database confirms a valid match</label><button className="primary-button" type="button" disabled={!!busy||!subOut||!subIn||subOut===subIn||!subReason.trim()} onClick={()=>void runAction("substitution",()=>saveSubstitution(activeMatch.id),"Substitution recorded with lineup provenance.")}>Record substitution</button></div>}{substitutions.filter(s=>s.canonical_session_match_id===activeMatch.id).length>0&&<div className="canonical-substitution-timeline"><h4>Substitution timeline</h4>{substitutions.filter(s=>s.canonical_session_match_id===activeMatch.id).map(s=><article key={s.id}><span>#{s.sequence_no}</span><div><strong>{roster.find(m=>m.id===s.outgoing_roster_member_id)?.display_name_snapshot||"Outgoing"} → {roster.find(m=>m.id===s.incoming_roster_member_id)?.display_name_snapshot||"Incoming"}</strong><small>{s.substitution_category} · {s.source_provenance} · {s.effective_round_label||timeText(s.effective_at)}</small><p>{s.reason}</p></div></article>)}</div>}</div>}</>}</section>
        <section className="canonical-panel canonical-results-panel"><div className="canonical-panel-head"><div><span className="eyebrow">RESULT PROVENANCE</span><h3>{activeMatch?"Match result":"Training result"}</h3><p>Submitted values and verified values remain separate. No score is inferred.</p></div><span className="canonical-count">{activeResult?.status||"No result"}</span></div>{canManage&&active&&<><div className="canonical-form-grid"><label>Result source<select value={resultSource} onChange={e=>setResultSource(e.target.value)}>{SOURCES.filter(([v])=>detail.session_type==="training"?v!=="official_scorecard":v!=="training_log").map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label>Source reference · optional<input value={resultReference} onChange={e=>setResultReference(e.target.value)} maxLength={500} placeholder="Scorecard/report ID or source reference"/></label></div><label className="canonical-full-field">Raw result values · JSON<textarea rows={5} spellCheck={false} value={resultRaw} onChange={e=>setResultRaw(e.target.value)} placeholder={'{"placement": 1, "kills": 5}'}/></label>{activeResult&&["verified","amended","rejected"].includes(activeResult.status)&&<label className="canonical-full-field">Correction reason · required<input value={decisionReason} onChange={e=>setDecisionReason(e.target.value)} maxLength={500} placeholder="Explain the amendment before resubmitting"/></label>}<div className="canonical-form-actions"><button className="secondary-button" type="button" disabled={!!busy||(!!activeResult&&activeResult.status!=="draft")} onClick={()=>void runAction("result-draft",()=>saveResult(activeMatch?.id||null,false),"Result draft saved.")}>Save draft</button><button className="primary-button" type="button" disabled={!!busy||detail.lifecycle_status!=="awaiting_results"||activeResult?.status==="submitted"} onClick={()=>void runAction("result-submit",()=>saveResult(activeMatch?.id||null,true),"Result submitted for verification.")}>{activeResult&&activeResult.status!=="draft"?"Submit amendment":"Submit result"}</button></div></>}{activeResult&&<div className="canonical-result-history"><div className="canonical-result-state"><strong>{activeResult.status.toUpperCase()}</strong><small>Version {activeResult.current_version_no} · updated {timeText(activeResult.updated_at)}</small></div>{currentVersions.map(v=><article key={v.id}><div><strong>Version {v.version_no} · {v.version_kind}</strong><small>{v.result_source} · {v.source_reference||"No external reference"} · {timeText(v.recorded_at)} · Actor {String(v.recorded_by||"—").slice(0,8)}</small></div><pre>{jsonText(v.raw_submitted_values)}</pre>{v.correction_reason&&<p>Correction: {v.correction_reason}</p>}</article>)}{activeResult.status==="submitted"&&canManage&&detail.lifecycle_status==="awaiting_results"&&<div className="canonical-verify-box"><h4>Verify submitted result</h4><label className="canonical-full-field">Verified values · JSON<textarea rows={4} value={verifiedRaw} onChange={e=>setVerifiedRaw(e.target.value)} spellCheck={false}/></label><div className="canonical-checklist">{keys.map(k=><label key={k}><input type="checkbox" checked={!!checklist[k]} onChange={e=>setChecklist(x=>({...x,[k]:e.target.checked}))}/><span>{k.replaceAll("_"," ")}</span></label>)}</div><label className="canonical-full-field">Decision reason<input value={decisionReason} onChange={e=>setDecisionReason(e.target.value)} maxLength={500} placeholder="Evidence reviewed"/></label><div className="canonical-form-actions"><button className="canonical-danger-button" type="button" disabled={!!busy||!decisionReason.trim()} onClick={()=>void runAction("reject",()=>decideResult(activeResult,false),"Result rejected with reason.")}>Reject</button><button className="primary-button" type="button" disabled={!!busy||!decisionReason.trim()||keys.some(k=>!checklist[k])} onClick={()=>void runAction("verify",()=>decideResult(activeResult,true),"Result verified.")}>Verify result</button></div></div>}{currentEvents.map(e=><div className="canonical-event-line" key={e.id}><strong>{e.event_kind.replaceAll("_"," ")}</strong><span>{e.previous_status} → {e.new_status}</span><small>{e.reason||"No reason"} · Actor {String(e.changed_by||"—").slice(0,8)} · {timeText(e.changed_at)}</small></div>)}</div>}{!canManage&&<p className="canonical-readonly-note">Result provenance is restricted to active Owners and Coaches.</p>}</section>
        {canManage&&<section className="canonical-panel canonical-audit-panel"><div className="canonical-panel-head"><div><span className="eyebrow">AUDIT HISTORY</span><h3>Lifecycle events</h3><p>Server timestamp, reason and lifecycle version.</p></div></div>{lifecycleEvents.length?lifecycleEvents.map(e=><article key={e.id}><span className="canonical-event-dot"/><div><strong>{STATUS[e.previous_status]||e.previous_status} → {STATUS[e.new_status]||e.new_status}</strong><small>{e.event_kind} · {e.reason} · {timeText(e.changed_at)}</small></div><code>v{e.lifecycle_version}</code></article>):<div className="canonical-state">No lifecycle changes recorded.</div>}</section>}
      </>}
      </section>
    </div>
    {busy&&busy!=="loading-detail"&&<div className="canonical-busy" role="status" aria-live="polite">Saving changes…</div>}
  </section>;
}
