import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import "./CanonicalSessionsWorkspace.css";

type Member = { id:string; user_id:string; display_name:string; player_number:number|null; assigned_role:string|null; membership_role:string; status:string };
type SessionRow = { id:string; team_id:string; session_type:"scrim"|"tournament"|"training"; title:string; session_date:string|null; season_label:string|null; lifecycle_status:string; lifecycle_version:number; archived_at:string|null; created_at:string };
type MatchRow = { id:string; canonical_session_id:string; match_sequence:number; source_system:string; source_match_day:number|null; source_match_number:number|null; map_name:string|null; mode:string|null; round_label:string|null };
type RosterMember = { id:string; player_user_id:string; display_name_snapshot:string; player_number_snapshot:number|null; membership_role_snapshot:string; selection_status:string };
type RoleDefinition = { id:string; role_key:string; role_name:string; role_description:string|null };
type Participant = { id:string; canonical_session_match_id:string; roster_member_id:string; participation_status:string };
type MatchRole = { id:string; canonical_session_match_id:string; roster_member_id:string; role_name_snapshot:string|null; role_key_snapshot:string|null; role_assignment_status:string };
type Substitution = { id:string; canonical_session_match_id:string; sequence_no:number; outgoing_roster_member_id:string; incoming_roster_member_id:string; effective_at:string; effective_round_label:string|null; substitution_category:string; reason:string };
type SessionResult = { id:string; canonical_session_match_id:string|null; current_version_no:number; status:string };
type ResultVersion = { id:string; result_id:string; version_no:number; result_source:string; source_reference:string|null; raw_submitted_values:Record<string,unknown>; submitted_at:string|null };
type ResultEvent = { id:string; result_id:string; event_kind:string; previous_status:string; new_status:string; reason:string|null; changed_at:string };
type LifecycleEvent = { id:string; lifecycle_version:number; previous_status:string; new_status:string; reason:string; changed_at:string };
type Detail = {
  matches:MatchRow[]; roster:{id:string;locked_at:string;selected_member_count:number;eligible_member_count:number}|null;
  rosterMembers:RosterMember[]; roleDefinitions:RoleDefinition[]; participants:Participant[]; roles:MatchRole[];
  substitutions:Substitution[]; results:SessionResult[]; versions:ResultVersion[]; resultEvents:ResultEvent[];
  lifecycleEvents:LifecycleEvent[]; sources:{source_system:string;source_record_id:string}[];
  expectedMatchCount:number|null; sessionResultSubmitted:boolean;
};
const key = () => globalThis.crypto?.randomUUID?.() ?? "00000000-0000-4000-8000-" + Math.random().toString(16).slice(2).padEnd(12,"0").slice(0,12);
const label = (value:string) => value.replaceAll("_"," ");
const dateLabel = (value:string|null) => value ? new Date(value.slice(0,10)+"T12:00:00").toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}) : "Date not set";
const verified = (value:string) => value === "verified" || value === "amended";
const errorText = (error:unknown) => {
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : "Action failed. Refresh and retry.";
  if (/relation .* does not exist|could not find the table/i.test(message)) return "Evolution Phase Two migrations are not available in this environment yet. No legacy data was changed.";
  if (/permission denied|row-level security|active_owner_or_coach_required/i.test(message)) return "This action is restricted by the team's server-side permissions.";
  if (/canonical_session_lifecycle_version_conflict/i.test(message)) return "This session changed in another request. Refresh and retry.";
  return message;
};

export default function CanonicalSessionsWorkspace({supabase,teamId,members,canManage,isOnline}:{supabase:SupabaseClient|null;teamId:string;members:Member[];canManage:boolean;isOnline:boolean}) {
  const [sessions,setSessions]=useState<SessionRow[]>([]);
  const listRequestRef=useRef(0),detailRequestRef=useRef(0);
  const [sources,setSources]=useState<Record<string,{source_system:string;source_record_id:string}[]>>({});
  const [matchCounts,setMatchCounts]=useState<Record<string,number>>({});
  const [selectedId,setSelectedId]=useState("");
  const [detail,setDetail]=useState<Detail|null>(null);
  const [loading,setLoading]=useState(true),[detailLoading,setDetailLoading]=useState(false),[busy,setBusy]=useState("");
  const [error,setError]=useState(""),[detailError,setDetailError]=useState(""),[notice,setNotice]=useState("");
  const [typeFilter,setTypeFilter]=useState("all"),[statusFilter,setStatusFilter]=useState("all"),[seasonFilter,setSeasonFilter]=useState("all"),[dateFilter,setDateFilter]=useState(""),[search,setSearch]=useState("");
  const [showCreate,setShowCreate]=useState(false),[newType,setNewType]=useState<"scrim"|"tournament"|"training">("training"),[newTitle,setNewTitle]=useState(""),[newDate,setNewDate]=useState(""),[newSeason,setNewSeason]=useState("");
  const [editTitle,setEditTitle]=useState(""),[editDate,setEditDate]=useState(""),[editSeason,setEditSeason]=useState("");
  const [reason,setReason]=useState(""),[cancelCode,setCancelCode]=useState("cancelled");
  const [selectedMembers,setSelectedMembers]=useState<string[]>([]),[rosterReason,setRosterReason]=useState("Roster selection update");
  const [matchId,setMatchId]=useState(""),[participationReason,setParticipationReason]=useState("Match participation recorded by staff");
  const [roleMember,setRoleMember]=useState(""),[roleId,setRoleId]=useState(""),[roleReason,setRoleReason]=useState("Pre-match role assignment"),[roleRound,setRoleRound]=useState("");
  const [subOut,setSubOut]=useState(""),[subIn,setSubIn]=useState(""),[subReason,setSubReason]=useState(""),[subRound,setSubRound]=useState(""),[subCategory,setSubCategory]=useState("tactical"),[subSource,setSubSource]=useState("coach_report");
  const [resultSource,setResultSource]=useState("team_record"),[resultRef,setResultRef]=useState(""),[rawValues,setRawValues]=useState("{\n  \n}"),[correctionReason,setCorrectionReason]=useState("");
  const [verifiedValues,setVerifiedValues]=useState("{\n  \n}"),[verifyReason,setVerifyReason]=useState(""),[verifyChecks,setVerifyChecks]=useState<Record<string,boolean>>({}),[rejectReason,setRejectReason]=useState("");

  const selected=useMemo(()=>sessions.find((s)=>s.id===selectedId)||null,[sessions,selectedId]);
  const activeMembers=useMemo(()=>members.filter((m)=>m.status==="active"&&m.player_number!=null&&m.player_number>=1&&m.player_number<=10),[members]);
  const seasons=useMemo(()=>Array.from(new Set(sessions.map((s)=>s.season_label||"Unlabelled"))).sort(),[sessions]);
  const filtered=useMemo(()=>sessions.filter((s)=>{
    if(typeFilter!=="all"&&s.session_type!==typeFilter)return false;
    if(statusFilter!=="all"&&s.lifecycle_status!==statusFilter)return false;
    if(seasonFilter!=="all"&&(s.season_label||"Unlabelled")!==seasonFilter)return false;
    if(dateFilter&&(s.session_date||s.created_at.slice(0,10))!==dateFilter)return false;
    if(search&&!(s.title+" "+(s.season_label||"")+" "+s.id).toLowerCase().includes(search.toLowerCase()))return false;
    return true;
  }),[sessions,typeFilter,statusFilter,seasonFilter,dateFilter,search]);

  const refreshList=useCallback(async()=>{
    const requestId=++listRequestRef.current;
    if(!supabase||!teamId){
      setSessions([]);setSources({});setMatchCounts({});setSelectedId("");setDetail(null);setLoading(false);
      return;
    }
    setLoading(true);setError("");
    try{
      const q=await supabase.from("canonical_sessions").select("*").eq("team_id",teamId).order("created_at",{ascending:false}).limit(100);
      if(requestId!==listRequestRef.current)return;
      if(q.error)throw q.error;
      const rows=(q.data||[]) as SessionRow[];
      const ids=rows.map((s)=>s.id);
      const [src,sets]=ids.length?await Promise.all([
        supabase.from("canonical_session_sources").select("canonical_session_id,source_system,source_record_id").eq("team_id",teamId).in("canonical_session_id",ids),
        supabase.from("canonical_session_match_sets").select("canonical_session_id,expected_match_count").eq("team_id",teamId).in("canonical_session_id",ids),
      ]):[{data:[],error:null},{data:[],error:null}];
      if(requestId!==listRequestRef.current)return;
      if(src.error)throw src.error;if(sets.error)throw sets.error;
      const sourceMap:Record<string,{source_system:string;source_record_id:string}[]>={};
      (src.data||[]).forEach((r:any)=>{sourceMap[r.canonical_session_id]||=[];sourceMap[r.canonical_session_id].push({source_system:r.source_system,source_record_id:r.source_record_id});});
      const countMap:Record<string,number>={};(sets.data||[]).forEach((r:any)=>{countMap[r.canonical_session_id]=r.expected_match_count;});
      setSessions(rows);setSources(sourceMap);setMatchCounts(countMap);
      setSelectedId(current=>!rows.length?"":(!current||!rows.some((s)=>s.id===current)?rows[0].id:current));
      if(!rows.length){setDetail(null);detailRequestRef.current++;}
    }catch(e){if(requestId===listRequestRef.current)setError(errorText(e));}
    finally{if(requestId===listRequestRef.current)setLoading(false);}
  },[supabase,teamId]);

  const refreshDetail=useCallback(async(id:string)=>{
    const requestId=++detailRequestRef.current;
    if(!supabase||!teamId||!id){setDetail(null);setDetailLoading(false);return;}
    setDetailLoading(true);setDetailError("");
    try{
      const queries=await Promise.all([
        supabase.from("canonical_session_matches").select("*").eq("team_id",teamId).eq("canonical_session_id",id).order("match_sequence"),
        supabase.from("canonical_session_rosters").select("*").eq("team_id",teamId).eq("canonical_session_id",id).maybeSingle(),
        supabase.from("canonical_session_roster_members").select("*").eq("team_id",teamId).eq("canonical_session_id",id).order("player_number_snapshot"),
        supabase.from("canonical_team_role_definitions").select("id,role_key,role_name,role_description").eq("team_id",teamId).eq("is_current",true).eq("is_active",true).order("role_name"),
        supabase.from("canonical_session_match_roles").select("*").eq("team_id",teamId).eq("canonical_session_id",id),
        supabase.from("canonical_session_match_participants").select("*").eq("team_id",teamId).eq("canonical_session_id",id),
        supabase.from("canonical_session_substitutions").select("*").eq("team_id",teamId).eq("canonical_session_id",id).order("sequence_no"),
        supabase.from("canonical_session_results").select("*").eq("team_id",teamId).eq("canonical_session_id",id),
        supabase.from("canonical_session_lifecycle_events").select("*").eq("team_id",teamId).eq("canonical_session_id",id).order("lifecycle_version"),
        supabase.from("canonical_session_sources").select("source_system,source_record_id").eq("team_id",teamId).eq("canonical_session_id",id),
        supabase.from("canonical_session_match_sets").select("expected_match_count").eq("team_id",teamId).eq("canonical_session_id",id).maybeSingle(),
        supabase.from("canonical_session_result_submissions").select("id").eq("team_id",teamId).eq("canonical_session_id",id).maybeSingle(),
      ]);
      if(requestId!==detailRequestRef.current)return;
      const [matches,roster,rosterMembers,roleDefs,roles,participants,subs,results,life,src,sets,submission]=queries;
      for(const q of queries)if(q.error)throw q.error;
      const resultRows=(results.data||[]) as SessionResult[], resultIds=resultRows.map((r)=>r.id);
      let versions:ResultVersion[]=[],events:ResultEvent[]=[];
      if(resultIds.length){
        const [v,e]=await Promise.all([
          supabase.from("canonical_session_result_versions").select("*").eq("team_id",teamId).in("result_id",resultIds).order("version_no",{ascending:false}),
          supabase.from("canonical_session_result_events").select("*").eq("team_id",teamId).in("result_id",resultIds).order("changed_at",{ascending:false}),
        ]);
        if(requestId!==detailRequestRef.current)return;
        if(v.error)throw v.error;if(e.error)throw e.error;versions=(v.data||[]) as ResultVersion[];events=(e.data||[]) as ResultEvent[];
      }
      if(requestId!==detailRequestRef.current)return;
      setDetail({
        matches:(matches.data||[]) as MatchRow[],roster:roster.data as Detail["roster"],
        rosterMembers:(rosterMembers.data||[]) as RosterMember[],roleDefinitions:(roleDefs.data||[]) as RoleDefinition[],
        roles:(roles.data||[]) as MatchRole[],participants:(participants.data||[]) as Participant[],
        substitutions:(subs.data||[]) as Substitution[],results:resultRows,versions,resultEvents:events,
        lifecycleEvents:(life.data||[]) as LifecycleEvent[],sources:(src.data||[]) as Detail["sources"],
        expectedMatchCount:sets.data?.expected_match_count??null,sessionResultSubmitted:!!submission.data,
      });
    }catch(e){if(requestId===detailRequestRef.current){setDetailError(errorText(e));setDetail(null);}}
    finally{if(requestId===detailRequestRef.current)setDetailLoading(false);}
  },[supabase,teamId]);

  useEffect(()=>{
    setSessions([]);setSources({});setMatchCounts({});setSelectedId("");setDetail(null);setDetailError("");
    void refreshList();
    return()=>{listRequestRef.current++;detailRequestRef.current++;};
  },[refreshList]);
  useEffect(()=>{
    if(selectedId)void refreshDetail(selectedId);
    else{detailRequestRef.current++;setDetail(null);setDetailLoading(false);}
    return()=>{detailRequestRef.current++;};
  },[selectedId,refreshDetail]);
  useEffect(()=>{if(selected){setEditTitle(selected.title);setEditDate(selected.session_date||"");setEditSeason(selected.season_label||"");setReason("");}},[selected?.id,selected?.title,selected?.session_date,selected?.season_label]);
  useEffect(()=>{setMatchId("");setSelectedMembers([]);setRoleMember("");setRoleId("");setSubOut("");setSubIn("");},[selectedId]);
  useEffect(()=>{setRawValues("{\\n  \\n}");setResultRef("");setCorrectionReason("");setVerifiedValues("{\\n  \\n}");setVerifyReason("");setVerifyChecks({});setRejectReason("");setSubOut("");setSubIn("");},[selectedId,matchId]);

  const perform=async(labelText:string,action:()=>Promise<void>)=>{
    if(!isOnline){setError("Offline mode is read-only. Reconnect before changing records.");return;}
    if(!supabase||!canManage)return;
    setBusy(labelText);setError("");setDetailError("");setNotice("");
    try{await action();setNotice(labelText+" completed.");await refreshList();if(selectedId)await refreshDetail(selectedId);}
    catch(e){setError(errorText(e));}
    finally{setBusy("");}
  };

  const createSession=()=>perform("Session created",async()=>{
    if(!newTitle.trim())throw new Error("Enter a session title.");
    const {data,error:rpcError}=await supabase!.rpc("create_canonical_session",{p_team_id:teamId,p_session_type:newType,p_title:newTitle.trim(),p_idempotency_key:key(),p_session_date:newDate||null,p_scheduled_at:null,p_season_label:newSeason.trim()||null});
    if(rpcError)throw rpcError;const row=Array.isArray(data)?data[0]:data;if(!row?.id)throw new Error("The create RPC returned no canonical ID.");
    setSelectedId(row.id);setShowCreate(false);setNewTitle("");setNewDate("");setNewSeason("");
  });

  const saveMetadata=()=>selected&&perform("Session details saved",async()=>{
    const {error:e}=await supabase!.from("canonical_sessions").update({title:editTitle.trim(),session_date:editDate||null,season_label:editSeason.trim()||null}).eq("id",selected.id).eq("team_id",teamId);
    if(e)throw e;
  });

  const transition=(target:string)=>selected&&perform("Lifecycle updated",async()=>{
    if(reason.trim().length<3)throw new Error("Enter an audit reason.");
    if(target==="verified"){
      const expected=selected.session_type==="training"?1:(detail?.matches.length||0);
      if((detail?.results.length||0)!==expected||!detail?.results.every((r)=>verified(r.status)))throw new Error("Verify every expected result before verifying this session.");
      if(!detail?.sessionResultSubmitted){const {error:e}=await supabase!.rpc("submit_canonical_session_results",{p_session_id:selected.id,p_idempotency_key:key()});if(e)throw e;}
    }
    const {error:e}=await supabase!.rpc("transition_canonical_session",{p_session_id:selected.id,p_expected_version:selected.lifecycle_version,p_target_status:target,p_reason:reason.trim(),p_idempotency_key:key(),p_cancellation_reason_code:target==="cancelled"?cancelCode:null});
    if(e)throw e;setReason("");
  });

  const reopen=()=>selected&&perform("Session reopened",async()=>{
    if(reason.trim().length<3)throw new Error("Enter an audited reopen reason.");
    const {error:e}=await supabase!.rpc("reopen_canonical_session",{p_session_id:selected.id,p_expected_version:selected.lifecycle_version,p_target_status:"closed",p_reason:reason.trim(),p_idempotency_key:key()});
    if(e)throw e;setReason("");
  });

  const lockRoster=()=>selected&&perform("Roster snapshot locked",async()=>{
    if(!selectedMembers.length)throw new Error("Select at least one active player.");
    const {error:e}=await supabase!.rpc("lock_canonical_session_roster",{p_session_id:selected.id,p_selected_member_ids:selectedMembers,p_invited_member_ids:[],p_idempotency_key:key()});
    if(e)throw e;setSelectedMembers([]);
  });

  const setRosterStatus=(id:string,target:string)=>perform("Roster status updated",async()=>{
    if(rosterReason.trim().length<3)throw new Error("Enter a reason for the roster change.");
    const {error:e}=await supabase!.rpc("set_canonical_session_roster_member_status",{p_roster_member_id:id,p_target_status:target,p_reason:rosterReason.trim(),p_idempotency_key:key()});
    if(e)throw e;
  });

  const participation=(mId:string,rId:string,current:Participant|undefined,target:string)=>perform("Participation saved",async()=>{
    if(participationReason.trim().length<3)throw new Error("Enter a participation reason.");
    if(current){const {error:e}=await supabase!.rpc("correct_canonical_match_participation",{p_participant_id:current.id,p_new_status:target,p_reason:participationReason.trim(),p_idempotency_key:key()});if(e)throw e;}else{const {error:e}=await supabase!.rpc("record_canonical_match_participation",{p_match_id:mId,p_roster_member_id:rId,p_participation_status:target,p_reason:participationReason.trim(),p_idempotency_key:key()});if(e)throw e;}
  });

  const assignRole=()=>matchId&&perform("Role assigned",async()=>{
    if(!roleMember||!roleId||roleReason.trim().length<3)throw new Error("Choose a player and role and enter a reason.");
    const {error:e}=await supabase!.rpc("set_canonical_session_match_role",{p_match_id:matchId,p_roster_member_id:roleMember,p_role_definition_id:roleId,p_effective_at:new Date().toISOString(),p_effective_round_label:roleRound.trim()||null,p_reason:roleReason.trim(),p_idempotency_key:key()});
    if(e)throw e;
  });

  const substitute=()=>matchId&&perform("Substitution recorded",async()=>{
    if(!subOut||!subIn||subOut===subIn||subReason.trim().length<3)throw new Error("Choose different players and enter a reason.");
    const {error:e}=await supabase!.rpc("record_canonical_session_substitution",{p_match_id:matchId,p_outgoing_roster_member_id:subOut,p_incoming_roster_member_id:subIn,p_effective_at:new Date().toISOString(),p_effective_round_label:subRound.trim()||null,p_category:subCategory,p_source_provenance:subSource,p_reason:subReason.trim(),p_transfer_role:false,p_idempotency_key:key()});
    if(e)throw e;setSubReason("");setSubOut("");setSubIn("");
  });

  const parseObject=(raw:string,name:string)=>{
    let value:unknown;try{value=JSON.parse(raw);}catch{throw new Error(name+" must be valid JSON.");}
    if(!value||typeof value!=="object"||Array.isArray(value)||Object.keys(value).length===0)throw new Error(name+" must be a non-empty JSON object.");
    return value as Record<string,unknown>;
  };
  const saveDraft=(mId:string|null)=>perform("Result draft saved",async()=>{
    const {error:e}=await supabase!.rpc("save_canonical_session_result_draft",{p_session_id:selected!.id,p_match_id:mId,p_result_source:selected!.session_type==="training"?"training_log":resultSource,p_source_reference:resultRef.trim()||null,p_raw_values:parseObject(rawValues,"Raw values"),p_idempotency_key:key()});
    if(e)throw e;
  });
  const submitResult=(mId:string|null)=>perform("Result submitted",async()=>{
    if(selected?.lifecycle_status!=="awaiting_results")throw new Error("The session must be Awaiting Results before submission.");
    const {error:e}=await supabase!.rpc("submit_canonical_session_result",{p_session_id:selected!.id,p_match_id:mId,p_result_source:selected!.session_type==="training"?"training_log":resultSource,p_source_reference:resultRef.trim()||null,p_raw_values:parseObject(rawValues,"Raw values"),p_idempotency_key:key(),p_correction_reason:correctionReason.trim()||null});
    if(e)throw e;setCorrectionReason("");
  });
  const verifyResult=(id:string)=>perform("Result verified",async()=>{
    if(!verifyReason.trim()||Object.values(verifyChecks).filter(Boolean).length!==4)throw new Error("Complete all four checks and enter a reason.");
    const checklist=selected?.session_type==="training"?{source_identity_confirmed:true,activity_confirmed:true,participants_confirmed:true,no_inferred_values:true}:{source_identity_confirmed:true,match_identity_confirmed:true,values_reviewed:true,no_inferred_values:true};
    const {error:e}=await supabase!.rpc("verify_canonical_session_result",{p_result_id:id,p_verified_values:parseObject(verifiedValues,"Verified values"),p_checklist:checklist,p_reason:verifyReason.trim(),p_idempotency_key:key()});
    if(e)throw e;setVerifyReason("");setVerifyChecks({});
  });
  const rejectResult=(id:string)=>perform("Result returned",async()=>{
    if(rejectReason.trim().length<3)throw new Error("Enter a rejection reason.");
    const {error:e}=await supabase!.rpc("reject_canonical_session_result",{p_result_id:id,p_reason:rejectReason.trim(),p_idempotency_key:key()});
    if(e)throw e;setRejectReason("");
  });

  const activeRoster=detail?.rosterMembers.filter((m)=>m.selection_status==="selected"||m.selection_status==="confirmed")||[];
  const resultFor=(id:string|null)=>detail?.results.find((r)=>r.canonical_session_match_id===id);
  const versionFor=(id:string)=>detail?.versions.find((v)=>v.result_id===id);
  const verifyKeys=selected?.session_type==="training"?["source_identity_confirmed","activity_confirmed","participants_confirmed","no_inferred_values"]:["source_identity_confirmed","match_identity_confirmed","values_reviewed","no_inferred_values"];
  const transitions:Record<string,string[]>={draft:["scheduled","cancelled"],scheduled:["in_progress","cancelled"],in_progress:["awaiting_results"],awaiting_results:["verified"],verified:["closed"],closed:["archived"],cancelled:["archived"]};

  if(!canManage)return <section className="canonical-workspace"><div className="canonical-access-panel"><span className="canonical-eyebrow">EVOLUTION · PHASE TWO</span><h2>Sessions workspace</h2><p>Session lifecycle, roster snapshots, role changes, substitutions and result verification are restricted to active Owner/Coach staff.</p></div></section>;

  return <section className="canonical-workspace">
    <header className="canonical-workspace-head"><div><span className="canonical-eyebrow">EVOLUTION · PHASE TWO · POINT 2.11</span><h2>Sessions & match control</h2><p>One canonical timeline across Scrims, Tournament and Training. Original module records remain intact.</p></div><div className="canonical-head-actions"><span className={"canonical-connection "+(isOnline?"is-online":"is-offline")}>{isOnline?"ONLINE":"OFFLINE · READ ONLY"}</span><button className="canonical-secondary" type="button" onClick={()=>{void refreshList();if(selectedId)void refreshDetail(selectedId);}} disabled={loading||detailLoading}>↻ Refresh</button><button className="canonical-primary" type="button" onClick={()=>setShowCreate((v)=>!v)} disabled={!isOnline||!!busy}>＋ New session</button></div></header>
    {error&&<div className="canonical-alert canonical-alert-error" role="alert">{error}</div>}{notice&&<div className="canonical-alert canonical-alert-success" role="status">{notice}</div>}
    {!isOnline&&<div className="canonical-alert canonical-alert-warn" role="status">Offline mode is read-only. No writes are queued or silently replayed.</div>}
    {showCreate&&<section className="canonical-panel"><div className="canonical-panel-heading"><div><span className="canonical-eyebrow">CREATE CANONICAL IDENTITY</span><h3>New session</h3></div><button type="button" className="canonical-icon-button" onClick={()=>setShowCreate(false)} aria-label="Close create form">×</button></div><div className="canonical-form-grid">
      <label>Type<select value={newType} onChange={(e)=>setNewType(e.target.value as typeof newType)}><option value="training">Training</option></select></label>
      <label>Title<input value={newTitle} onChange={(e)=>setNewTitle(e.target.value)} maxLength={120} placeholder="e.g. Sunday scrim block"/></label>
      <label>Date<input type="date" value={newDate} onChange={(e)=>setNewDate(e.target.value)}/></label>
      <label>Season / cycle<input value={newSeason} onChange={(e)=>setNewSeason(e.target.value)} maxLength={80} placeholder="e.g. 2026 · Week 47"/></label>
    </div><p className="canonical-hint">The database generates the canonical ID. Create Scrim and Tournament sessions in their existing modules; those records link through the adapter. This form creates standalone Training sessions only.</p><button type="button" className="canonical-primary" onClick={()=>void createSession()} disabled={!isOnline||!!busy||!newTitle.trim()}>Create session</button></section>}

    <div className="canonical-filter-bar">
      <label>Search<input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Title or canonical ID"/></label>
      <label>Type<select value={typeFilter} onChange={(e)=>setTypeFilter(e.target.value)}><option value="all">All</option><option value="scrim">Scrim</option><option value="tournament">Tournament</option><option value="training">Training</option></select></label>
      <label>Status<select value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)}><option value="all">All</option>{["draft","scheduled","in_progress","awaiting_results","verified","closed","cancelled","archived"].map((s)=><option key={s} value={s}>{label(s)}</option>)}</select></label>
      <label>Season<select value={seasonFilter} onChange={(e)=>setSeasonFilter(e.target.value)}><option value="all">All</option>{seasons.map((s)=><option key={s} value={s}>{s}</option>)}</select></label>
      <label>Date<input type="date" value={dateFilter} onChange={(e)=>setDateFilter(e.target.value)}/></label>
      <button type="button" className="canonical-clear-filter" onClick={()=>{setSearch("");setTypeFilter("all");setStatusFilter("all");setSeasonFilter("all");setDateFilter("");}}>Clear filters</button>
    </div>

    <div className="canonical-session-layout">
      <aside className="canonical-session-list" aria-label="Canonical session list"><div className="canonical-list-head"><strong>Sessions</strong><span>{filtered.length} / {sessions.length}</span></div>
        {loading?<div className="canonical-state">Loading sessions…</div>:filtered.length===0?<div className="canonical-state"><strong>No sessions found</strong><span>Clear filters or create a session. No sample records are fabricated.</span></div>:filtered.map((s)=><button type="button" key={s.id} className={"canonical-session-item "+(selectedId===s.id?"is-selected":"")} onClick={()=>setSelectedId(s.id)}>
          <span className="canonical-session-item-top"><i className={"canonical-type-dot type-"+s.session_type}/><b>{s.session_type}</b><small>{dateLabel(s.session_date)}</small></span><strong>{s.title}</strong>
          <span className="canonical-session-item-bottom"><span className={"canonical-status status-"+s.lifecycle_status}>{label(s.lifecycle_status)}</span><small>{matchCounts[s.id]??0} matches</small></span><code>{s.id}</code>
          {(sources[s.id]||[]).length>0&&<small className="canonical-source-pill">Linked: {(sources[s.id]||[]).map((x)=>x.source_system).join(", ")}</small>}
        </button>)}
      </aside>

      <main className="canonical-session-detail">
        {!selected?<div className="canonical-empty-detail"><span>◷</span><h3>Select a session</h3><p>Canonical matches, roster, roles, substitutions and result provenance appear here.</p></div>:
        detailLoading?<div className="canonical-state">Loading session details…</div>:
        detailError?<div className="canonical-state canonical-state-error" role="alert">{detailError}</div>:
        !detail?<div className="canonical-state">No detail data is available.</div>:
        <>
          <header className="canonical-detail-header"><div><span className="canonical-eyebrow">{selected.session_type.toUpperCase()} · CANONICAL SESSION</span><h3>{selected.title}</h3><p>{dateLabel(selected.session_date)}{selected.season_label?" · "+selected.season_label:""}</p><code>{selected.id}</code></div><span className={"canonical-status status-"+selected.lifecycle_status}>{label(selected.lifecycle_status)}</span></header>
          <div className="canonical-metadata-grid"><div><small>Lifecycle version</small><strong>v{selected.lifecycle_version}</strong></div><div><small>Matches</small><strong>{detail.matches.length}{detail.expectedMatchCount!=null?" / "+detail.expectedMatchCount:""}</strong></div><div><small>Roster</small><strong>{detail.roster?detail.roster.selected_member_count+" selected":"Not locked"}</strong></div><div><small>Result receipt</small><strong>{detail.sessionResultSubmitted?"Submitted":"Pending"}</strong></div></div>

          <section className="canonical-panel"><div className="canonical-panel-heading"><div><span className="canonical-eyebrow">SESSION CONTROL</span><h4>Lifecycle & details</h4></div></div>
            {["draft","scheduled"].includes(selected.lifecycle_status)&&<div className="canonical-form-grid"><label>Title<input value={editTitle} onChange={(e)=>setEditTitle(e.target.value)} maxLength={120}/></label><label>Date<input type="date" value={editDate} onChange={(e)=>setEditDate(e.target.value)}/></label><label>Season<input value={editSeason} onChange={(e)=>setEditSeason(e.target.value)} maxLength={80}/></label><button type="button" className="canonical-secondary" onClick={()=>void saveMetadata()} disabled={!isOnline||!!busy||!editTitle.trim()}>Save details</button></div>}
            <label className="canonical-wide-label">Audit reason<input value={reason} onChange={(e)=>setReason(e.target.value)} maxLength={500} placeholder="Required for lifecycle change"/></label>
            <div className="canonical-action-row">
              {(transitions[selected.lifecycle_status]||[]).map((target)=><ReactLifecycleButton key={target} target={target} disabled={!isOnline||!!busy||reason.trim().length<3||(target==="verified"&&(!detail.results.length||!detail.results.every((r)=>verified(r.status))))} onClick={()=>void transition(target)}/>)}
              {selected.lifecycle_status==="draft"&&<><select aria-label="Cancellation reason" value={cancelCode} onChange={(e)=>setCancelCode(e.target.value)}><option value="cancelled">Cancelled</option><option value="other">Other</option></select><button type="button" className="canonical-danger" onClick={()=>void transition("cancelled")} disabled={!isOnline||!!busy||reason.trim().length<3}>Cancel</button></>}
              {selected.lifecycle_status==="scheduled"&&<><select aria-label="Cancellation reason" value={cancelCode} onChange={(e)=>setCancelCode(e.target.value)}><option value="cancelled">Cancelled</option><option value="no_show">No show</option><option value="other">Other</option></select><button type="button" className="canonical-danger" onClick={()=>void transition("cancelled")} disabled={!isOnline||!!busy||reason.trim().length<3}>Cancel</button></>}
              {selected.lifecycle_status==="archived"&&<button type="button" className="canonical-secondary" onClick={()=>void reopen()} disabled={!isOnline||!!busy||reason.trim().length<3}>Audited reopen to Closed</button>}
            </div>
            {selected.archived_at&&<p className="canonical-hint">Archived history is retained. Reopen records an audit event and does not recreate the session.</p>}
          </section>

          <section className="canonical-panel"><div className="canonical-panel-heading"><div><span className="canonical-eyebrow">ROSTER SNAPSHOT</span><h4>Players & participation</h4></div><span className="canonical-inline-meta">{detail.roster?"Locked "+new Date(detail.roster.locked_at).toLocaleString():"Not locked"}</span></div>
            {!detail.roster&&["draft","scheduled"].includes(selected.lifecycle_status)?<>
              <p className="canonical-hint">Select the active team members. Locking snapshots their membership ID, player slot and display name.</p>
              <div className="canonical-roster-pick-list">{activeMembers.map((m)=><label className="canonical-roster-pick" key={m.id}><input type="checkbox" checked={selectedMembers.includes(m.id)} onChange={(e)=>setSelectedMembers((old)=>e.target.checked?[...old,m.id]:old.filter((x)=>x!==m.id))}/><span><b>P{m.player_number} · {m.display_name}</b><small>{m.assigned_role||m.membership_role}</small></span></label>)}</div>
              <button type="button" className="canonical-primary" onClick={()=>void lockRoster()} disabled={!isOnline||!!busy||!selectedMembers.length}>Lock roster snapshot ({selectedMembers.length})</button>
            </>:detail.roster?<><div className="canonical-roster-grid">{detail.rosterMembers.map((m)=><article className="canonical-roster-card" key={m.id}><div><b>{m.player_number_snapshot?"P"+m.player_number_snapshot+" · ":""}{m.display_name_snapshot}</b><small>{m.membership_role_snapshot}</small></div><span className={"canonical-status status-"+m.selection_status}>{label(m.selection_status)}</span>
              {["draft","scheduled"].includes(selected.lifecycle_status)&&<div className="canonical-roster-actions">{m.selection_status==="selected"&&<button type="button" className="canonical-mini-button" onClick={()=>void setRosterStatus(m.id,"confirmed")} disabled={!isOnline||!!busy}>Confirm</button>}{m.selection_status==="invited"&&<button type="button" className="canonical-mini-button" onClick={()=>void setRosterStatus(m.id,"selected")} disabled={!isOnline||!!busy}>Select</button>}</div>}</article>)}</div>
              <label className="canonical-wide-label">Roster change reason<input value={rosterReason} onChange={(e)=>setRosterReason(e.target.value)} maxLength={500}/></label>
            </>:<p className="canonical-hint">Roster cannot be locked in the current lifecycle state.</p>}
          </section>

          <section className="canonical-panel"><div className="canonical-panel-heading"><div><span className="canonical-eyebrow">MATCH IDENTITY</span><h4>Matches in this session</h4></div><span className="canonical-inline-meta">{detail.matches.length} canonical IDs</span></div>
            {selected.session_type==="training"?<p className="canonical-hint">Training does not create competitive match rows. Its result is attached to the session.</p>:detail.matches.length===0?<p className="canonical-hint">No canonical matches are linked. The module adapter must link existing Scrim/Tournament records; this UI will not fabricate missing matches.</p>:
              <div className="canonical-match-list">{detail.matches.map((m)=><button type="button" key={m.id} className={"canonical-match-item "+(matchId===m.id?"is-active":"")} onClick={()=>setMatchId(m.id)}><span className="canonical-match-number">MATCH {String(m.match_sequence).padStart(2,"0")}</span><b>{m.source_system==="tournament"?"Tournament · Day "+m.source_match_day+" · Slot "+m.source_match_number:"Scrim · Source match "+m.match_sequence}</b><small>{[m.map_name,m.mode,m.round_label].filter(Boolean).join(" · ")||"No source metadata"}</small><code>{m.id}</code></button>)}</div>}
            {matchId&&detail.matches.some((m)=>m.id===matchId)&&<div className="canonical-match-detail">
              <div className="canonical-panel-heading"><div><span className="canonical-eyebrow">PARENT SESSION CONTEXT</span><h4>{selected.title} · Match {detail.matches.find((m)=>m.id===matchId)?.match_sequence}</h4></div><button type="button" className="canonical-clear-filter" onClick={()=>setMatchId("")}>Close match</button></div>
              <div className="canonical-mini-grid"><div><small>Session ID</small><code>{selected.id}</code></div><div><small>Match ID</small><code>{matchId}</code></div></div>
              {detail.roster&&<>
                <div className="canonical-subsection"><h5>Match participation</h5><label className="canonical-wide-label">Participation reason<input value={participationReason} onChange={(e)=>setParticipationReason(e.target.value)} maxLength={500}/></label><div className="canonical-roster-grid">{activeRoster.map((m)=>{const p=detail.participants.find((x)=>x.canonical_session_match_id===matchId&&x.roster_member_id===m.id);return <article className="canonical-roster-card" key={m.id}><div><b>{m.display_name_snapshot}</b><small>{label(p?.participation_status||"not recorded")}</small></div><select aria-label={"Participation for "+m.display_name_snapshot} value={p?.participation_status||""} onChange={(e)=>{if(e.target.value)void participation(matchId,m.id,p,e.target.value);}} disabled={!isOnline||!!busy||!["in_progress","awaiting_results"].includes(selected.lifecycle_status)}><option value="">Not recorded</option><option value="participated">Participated</option><option value="absent">Absent</option></select></article>;})}</div></div>
                <div className="canonical-subsection"><h5>Role snapshot</h5><div className="canonical-form-grid"><label>Player<select value={roleMember} onChange={(e)=>setRoleMember(e.target.value)}><option value="">Choose player</option>{activeRoster.filter((m)=>detail.participants.some((p)=>p.canonical_session_match_id===matchId&&p.roster_member_id===m.id&&p.participation_status==="participated")).map((m)=><option key={m.id} value={m.id}>{m.display_name_snapshot}</option>)}</select></label><label>Role<select value={roleId} onChange={(e)=>setRoleId(e.target.value)}><option value="">Choose role</option>{detail.roleDefinitions.map((r)=><option key={r.id} value={r.id}>{r.role_name}</option>)}</select></label><label>Round label<input value={roleRound} onChange={(e)=>setRoleRound(e.target.value)} maxLength={80}/></label><label>Reason<input value={roleReason} onChange={(e)=>setRoleReason(e.target.value)} maxLength={500}/></label></div><button type="button" className="canonical-secondary" onClick={()=>void assignRole()} disabled={!isOnline||!!busy||!roleMember||!roleId||!["in_progress","awaiting_results"].includes(selected.lifecycle_status)}>Save role</button><div className="canonical-history-list">{detail.roles.filter((r)=>r.canonical_session_match_id===matchId).map((r)=><div key={r.id}><b>{detail.rosterMembers.find((m)=>m.id===r.roster_member_id)?.display_name_snapshot||"Player"}</b><span>{r.role_name_snapshot||r.role_key_snapshot||r.role_assignment_status}</span></div>)}</div></div>
                {selected.lifecycle_status==="in_progress"&&<div className="canonical-subsection"><h5>Substitution event</h5><div className="canonical-form-grid"><label>Outgoing<select value={subOut} onChange={(e)=>setSubOut(e.target.value)}><option value="">Active player</option>{activeRoster.filter((m)=>detail.participants.some((p)=>p.canonical_session_match_id===matchId&&p.roster_member_id===m.id&&p.participation_status==="participated")).map((m)=><option key={m.id} value={m.id}>{m.display_name_snapshot}</option>)}</select></label><label>Incoming<select value={subIn} onChange={(e)=>setSubIn(e.target.value)}><option value="">Replacement</option>{activeRoster.filter((m)=>m.id!==subOut&&!detail.participants.some((p)=>p.canonical_session_match_id===matchId&&p.roster_member_id===m.id&&p.participation_status==="participated")).map((m)=><option key={m.id} value={m.id}>{m.display_name_snapshot}</option>)}</select></label><label>Category<select value={subCategory} onChange={(e)=>setSubCategory(e.target.value)}><option value="tactical">Tactical</option><option value="availability">Availability</option><option value="ruleset">Ruleset</option><option value="other">Other</option></select></label><label>Source<select value={subSource} onChange={(e)=>setSubSource(e.target.value)}><option value="coach_report">Coach report</option><option value="official_scorecard">Official scorecard</option><option value="team_record">Team record</option><option value="other">Other</option></select></label><label>Round label<input value={subRound} onChange={(e)=>setSubRound(e.target.value)} maxLength={80}/></label><label>Reason<input value={subReason} onChange={(e)=>setSubReason(e.target.value)} maxLength={500}/></label></div><button type="button" className="canonical-primary" onClick={()=>void substitute()} disabled={!isOnline||!!busy||!subOut||!subIn||subReason.trim().length<3}>Record substitution</button></div>}
              </>}
              <div className="canonical-subsection"><h5>Result provenance & verification</h5>{(()=>{const result=resultFor(matchId),version=result?versionFor(result.id):undefined,event=result?detail.resultEvents.find((e)=>e.result_id===result.id):undefined;return <div className="canonical-result-card">
                <div className="canonical-result-head"><span className={"canonical-status status-"+(result?.status||"draft")}>{label(result?.status||"no result")}</span><small>{version?"Version "+version.version_no+" · "+version.result_source:"No result record"}</small></div>
                {version&&<><p className="canonical-hint">Source: {version.result_source}{version.source_reference?" · "+version.source_reference:""}{version.submitted_at?" · "+new Date(version.submitted_at).toLocaleString():""}</p><pre className="canonical-json-preview">{JSON.stringify(version.raw_submitted_values,null,2)}</pre></>}
                {(!result||result.status==="draft"||result.status==="rejected")&&<div className="canonical-form-grid"><label>Result source<select value={resultSource} onChange={(e)=>setResultSource(e.target.value)}><option value="official_scorecard">Official scorecard</option><option value="coach_report">Coach report</option><option value="team_record">Team record</option><option value="other">Other</option></select></label><label>Source reference<input value={resultRef} onChange={(e)=>setResultRef(e.target.value)} maxLength={500}/></label><label className="canonical-full-span">Raw result values (JSON)<textarea rows={5} value={rawValues} onChange={(e)=>setRawValues(e.target.value)} spellCheck={false}/></label>{result&&<label className="canonical-full-span">Correction reason<input value={correctionReason} onChange={(e)=>setCorrectionReason(e.target.value)} maxLength={500}/></label>}<div className="canonical-action-row canonical-full-span"><button type="button" className="canonical-secondary" onClick={()=>void saveDraft(matchId)} disabled={!isOnline||!!busy||!["in_progress","awaiting_results"].includes(selected.lifecycle_status)}>Save draft</button><button type="button" className="canonical-primary" onClick={()=>void submitResult(matchId)} disabled={!isOnline||!!busy||selected.lifecycle_status!=="awaiting_results"}>Submit for verification</button></div></div>}
                {result?.status==="submitted"&&<div className="canonical-form-grid"><label className="canonical-full-span">Verified values (JSON)<textarea rows={5} value={verifiedValues} onChange={(e)=>setVerifiedValues(e.target.value)} spellCheck={false}/></label><div className="canonical-checklist canonical-full-span">{verifyKeys.map((k)=><label key={k}><input type="checkbox" checked={!!verifyChecks[k]} onChange={(e)=>setVerifyChecks((old)=>({...old,[k]:e.target.checked}))}/><span>{label(k)}</span></label>)}</div><label className="canonical-full-span">Verification reason<input value={verifyReason} onChange={(e)=>setVerifyReason(e.target.value)} maxLength={500}/></label><div className="canonical-action-row canonical-full-span"><button type="button" className="canonical-primary" onClick={()=>void verifyResult(result.id)} disabled={!isOnline||!!busy||verifyKeys.some((k)=>!verifyChecks[k])||!verifyReason.trim()}>Verify result</button><input aria-label="Rejection reason" value={rejectReason} onChange={(e)=>setRejectReason(e.target.value)} placeholder="Reason to return for correction"/><button type="button" className="canonical-danger" onClick={()=>void rejectResult(result.id)} disabled={!isOnline||!!busy||rejectReason.trim().length<3}>Reject</button></div></div>}
                {event&&<p className="canonical-hint">Latest event: {event.event_kind} · {event.previous_status} → {event.new_status} · {new Date(event.changed_at).toLocaleString()}{event.reason?" · "+event.reason:""}</p>}
              </div>;})()}</div>
            </div>}
          </section>

          {selected.session_type==="training"&&<section className="canonical-panel"><div className="canonical-panel-heading"><div><span className="canonical-eyebrow">TRAINING RESULT</span><h4>Session-level result</h4></div></div>{(()=>{const result=resultFor(null),version=result?versionFor(result.id):undefined;return <div className="canonical-result-card"><div className="canonical-result-head"><span className={"canonical-status status-"+(result?.status||"draft")}>{label(result?.status||"no result")}</span><small>{version?"Version "+version.version_no:"No result record"}</small></div>{version&&<pre className="canonical-json-preview">{JSON.stringify(version.raw_submitted_values,null,2)}</pre>}{(!result||result.status==="draft"||result.status==="rejected")&&<><label className="canonical-wide-label">Training result values (JSON)<textarea rows={5} value={rawValues} onChange={(e)=>setRawValues(e.target.value)} spellCheck={false}/></label><div className="canonical-action-row"><button type="button" className="canonical-secondary" onClick={()=>void saveDraft(null)} disabled={!isOnline||!!busy||!["in_progress","awaiting_results"].includes(selected.lifecycle_status)}>Save draft</button><button type="button" className="canonical-primary" onClick={()=>void submitResult(null)} disabled={!isOnline||!!busy||selected.lifecycle_status!=="awaiting_results"}>Submit training result</button></div></>}{result?.status==="submitted"&&<><label className="canonical-wide-label">Verified training values (JSON)<textarea rows={5} value={verifiedValues} onChange={(e)=>setVerifiedValues(e.target.value)} spellCheck={false}/></label><div className="canonical-checklist">{verifyKeys.map((k)=><label key={k}><input type="checkbox" checked={!!verifyChecks[k]} onChange={(e)=>setVerifyChecks((old)=>({...old,[k]:e.target.checked}))}/><span>{label(k)}</span></label>)}</div><label className="canonical-wide-label">Verification reason<input value={verifyReason} onChange={(e)=>setVerifyReason(e.target.value)}/></label><div className="canonical-action-row"><button type="button" className="canonical-primary" onClick={()=>void verifyResult(result.id)} disabled={!isOnline||!!busy||verifyKeys.some((k)=>!verifyChecks[k])||!verifyReason.trim()}>Verify training result</button><button type="button" className="canonical-danger" onClick={()=>void rejectResult(result.id)} disabled={!isOnline||!!busy||rejectReason.trim().length<3}>Reject</button></div></>}</div>;})()}</section>}

          <section className="canonical-panel"><div className="canonical-panel-heading"><div><span className="canonical-eyebrow">AUDIT PROVENANCE</span><h4>Lifecycle & substitution history</h4></div></div>
            {detail.lifecycleEvents.length===0?<p className="canonical-hint">No lifecycle changes have been recorded yet.</p>:<div className="canonical-history-list">{detail.lifecycleEvents.map((e)=><div key={e.id}><b>v{e.lifecycle_version} · {label(e.previous_status)} → {label(e.new_status)}</b><span>{e.reason} · {new Date(e.changed_at).toLocaleString()}</span></div>)}</div>}
            {detail.substitutions.length>0&&<div className="canonical-history-list">{detail.substitutions.map((e)=><div key={e.id}><b>Match {detail.matches.find((m)=>m.id===e.canonical_session_match_id)?.match_sequence} · #{e.sequence_no}</b><span>{detail.rosterMembers.find((m)=>m.id===e.outgoing_roster_member_id)?.display_name_snapshot||"Outgoing"} → {detail.rosterMembers.find((m)=>m.id===e.incoming_roster_member_id)?.display_name_snapshot||"Incoming"} · {e.substitution_category} · {e.reason}</span></div>)}</div>}
            <h5>Linked source records</h5>{detail.sources.length?<div className="canonical-source-list">{detail.sources.map((s)=><div key={s.source_system+s.source_record_id}><b>{s.source_system}</b><code>{s.source_record_id}</code></div>)}</div>:<p className="canonical-hint">No legacy source record linked yet.</p>}
          </section>
        </>}
      </main>
    </div>
  </section>;
}

function ReactLifecycleButton({target,disabled,onClick}:{target:string;disabled:boolean;onClick:()=>void}) {
  return <button type="button" className={target==="archived"?"canonical-danger":"canonical-primary"} disabled={disabled} onClick={onClick}>{target==="in_progress"?"Start session":target==="awaiting_results"?"Await results":target==="verified"?"Mark verified":target==="closed"?"Close session":target==="archived"?"Archive session":target==="scheduled"?"Schedule session":label(target)}</button>;
}
