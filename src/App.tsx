import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "./lib/supabase/client";

type Section = "Overview" | "Tournament" | "Training" | "Players" | "Evaluation" | "Analytics";
type Player = { id: string; name: string; role: string; status: string };
const initialPlayers: Player[] = [
  { id: "P1", name: "Player 1", role: "Primary Rusher", status: "Active" },
  { id: "P2", name: "Player 2", role: "Secondary Rusher", status: "Active" },
  { id: "P3", name: "Player 3", role: "Third Rusher / Flank", status: "Active" },
  { id: "P4", name: "Player 4", role: "Sniper / IGL", status: "Active" },
];

function readPlayers(): Player[] {
  try { const v = localStorage.getItem("squad-os-roster"); return v ? JSON.parse(v) : initialPlayers; }
  catch { return initialPlayers; }
}

export default function App() {
  const [section, setSection] = useState<Section>("Overview");
  const [players, setPlayers] = useState<Player[]>(readPlayers);
  const [week, setWeek] = useState(() => localStorage.getItem("squad-os-week") || "2026-W45");
  const [day, setDay] = useState(() => Number(localStorage.getItem("squad-os-day") || 1));
  const [matches, setMatches] = useState<Record<string, { placement: number; kills: number }>>(() => { try { return JSON.parse(localStorage.getItem("squad-os-matches") || "{}"); } catch { return {}; } });
  const [notice, setNotice] = useState("");
  const [sharedMatches, setSharedMatches] = useState<Array<{match_day:number;match_number:number;placement:number;kills:number;points:number;status:string}>>([]);
  const [connection, setConnection] = useState("Checking Supabase…");
  const [sessionEmail, setSessionEmail] = useState("");
  const [sessionPassword, setSessionPassword] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("Substitute");
  const [drillDone, setDrillDone] = useState<Record<string, boolean>>(() => { try { return JSON.parse(localStorage.getItem("squad-os-drills") || "{}"); } catch { return {}; } });
  const [notes, setNotes] = useState<Record<string, string>>(() => { try { return JSON.parse(localStorage.getItem("squad-os-notes") || "{}"); } catch { return {}; } });
  const [query, setQuery] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [teamCode, setTeamCode] = useState("");
  const [teamDescription, setTeamDescription] = useState("");
  const [team, setTeam] = useState<{id:string;team_name:string;invite_code:string;membership_role:string;player_number:number|null;assigned_role:string|null}|null>(null);
  const [teamMembers, setTeamMembers] = useState<Array<{id:string;user_id:string;display_name:string;player_number:number|null;assigned_role:string|null;membership_role:string;status:string}>>([]);
  const [teamBusy, setTeamBusy] = useState(false);
  const [cloudTraining, setCloudTraining] = useState<Record<string, boolean>>({});
  const [trainingDate, setTrainingDate] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [evalPlayer,setEvalPlayer]=useState("P1");
  const [evalDate,setEvalDate]=useState(()=>new Date().toLocaleDateString("en-CA"));
  const [evalScores,setEvalScores]=useState<Record<string,number>>({communication:5,coordination:5,decision_making:5,role_execution:5,map_awareness:5});
  const [evalNotes,setEvalNotes]=useState("");
  const [evalTarget,setEvalTarget]=useState("");
  const [evalHistory,setEvalHistory]=useState<Array<{id:string;player_id:string;score_date:string;communication:number;coordination:number;decision_making:number;role_execution:number;map_awareness:number;total:number|null;notes:string|null;improvement_target:string|null}>>([]);

  useEffect(() => { localStorage.setItem("squad-os-roster", JSON.stringify(players)); }, [players]);
  useEffect(() => { localStorage.setItem("squad-os-matches", JSON.stringify(matches)); }, [matches]);
  useEffect(() => { localStorage.setItem("squad-os-drills", JSON.stringify(drillDone)); }, [drillDone]);
  useEffect(() => { localStorage.setItem("squad-os-notes", JSON.stringify(notes)); }, [notes]);
  useEffect(() => {
    let alive = true;
    if (!supabase) { setConnection("Missing project settings"); return; }
    supabase.auth.getSession().then(({ data, error }) => {
      if (alive) { setSignedIn(!!data.session); setSessionEmail(data.session?.user.email || ""); setConnection(error ? "Configured · auth check failed" : data.session ? "Signed in · cloud enabled" : "Configured · sign in required"); }
    }).catch(() => alive && setConnection("Configured · network unavailable"));
    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive) { setSignedIn(!!session); setSessionEmail(session?.user.email || ""); setConnection(session ? "Signed in · cloud enabled" : "Configured · sign in required"); }
    });
    return () => { alive = false; authSub.subscription.unsubscribe(); };
  }, []);

  const signIn = async () => { if (!supabase) return; const { error } = await supabase.auth.signInWithPassword({ email: sessionEmail.trim(), password: sessionPassword }); setNotice(error ? error.message : "Signed in. Cloud sync is enabled."); };
  const signUp = async () => { if (!supabase) return; if (!displayName.trim()) { setNotice("Enter your in-game/display name before creating account."); return; } const { error } = await supabase.auth.signUp({ email: sessionEmail.trim(), password: sessionPassword, options: { data: { display_name: displayName.trim() } } }); setNotice(error ? error.message : "Account created. If email verification is enabled, verify email then sign in."); };
  const signOut = async () => { if (supabase) { await supabase.auth.signOut(); setNotice("Signed out. Local records remain on this device."); } };
  const loadTeam = async () => {
    if (!supabase) return;
    const {data:{user}}=await supabase.auth.getUser(); if(!user) {setTeam(null);setTeamMembers([]);return;}
    const {data:membership,error}=await supabase.from("team_members").select("id,team_id,user_id,player_number,assigned_role,membership_role,status").eq("user_id",user.id).limit(1).maybeSingle();
    if(error) throw error;
    if(!membership){setTeam(null);setTeamMembers([]);return;}
    const {data:t,error:te}=await supabase.from("teams").select("id,team_name,invite_code").eq("id",membership.team_id).single(); if(te)throw te;
    setTeam({...t,membership_role:membership.membership_role,player_number:membership.player_number,assigned_role:membership.assigned_role});
    const {data:members,error:me}=await supabase.from("team_members").select("id,user_id,player_number,assigned_role,membership_role,status").eq("team_id",t.id).order("player_number");
    if(me)throw me;
    const ids=(members||[]).map(x=>x.user_id);
    const {data:profiles,error:pe}=await supabase.from("profiles").select("id,display_name").in("id",ids); if(pe)throw pe;
    setTeamMembers((members||[]).map(x=>({...x,display_name:profiles?.find(p=>p.id===x.user_id)?.display_name||"Player"})));
  };
  const createTeam = async () => { if(!supabase||!teamName.trim())return; setTeamBusy(true); try { if(displayName.trim()){const {error:ne}=await supabase.rpc("set_display_name",{p_name:displayName.trim()});if(ne)throw ne;} const {error}=await supabase.rpc("create_team",{p_name:teamName.trim(),p_description:teamDescription.trim(),p_timezone:"Asia/Kolkata"}); if(error)throw error; await loadTeam();setTeamName("");setTeamDescription("");setNotice("Team created. Share the Invite Code with your squad."); } catch(e){setNotice(e instanceof Error?e.message:"Team creation failed.");} finally{setTeamBusy(false);} };
  const joinTeam = async () => { if(!supabase||!teamCode.trim())return; setTeamBusy(true); try { if(!displayName.trim()){throw new Error("Enter your IGN/display name first.");} const {error:ne}=await supabase.rpc("set_display_name",{p_name:displayName.trim()});if(ne)throw ne; const {error}=await supabase.rpc("join_team",{p_code:teamCode.trim().toUpperCase()}); if(error)throw error; await loadTeam();setTeamCode("");setNotice("Joined team successfully."); } catch(e){setNotice(e instanceof Error?e.message:"Could not join team.");} finally{setTeamBusy(false);} };
  const assignMember = async (memberId:string, player:number, role:string) => { if(!supabase||team?.membership_role!=="owner")return; try { if(player>=1&&player<=5){const {error}=await supabase.rpc("assign_member",{p_member:memberId,p_player:player,p_activate:true});if(error)throw error;} const {error:re}=await supabase.from("team_members").update({assigned_role:role}).eq("id",memberId);if(re)throw re;await loadTeam();setNotice("Member slot and role updated."); }catch(e){setNotice(e instanceof Error?e.message:"Member assignment failed.");} };
  useEffect(()=>{if(signedIn)loadTeam().catch(e=>setNotice(e instanceof Error?e.message:"Could not load team."));else{setTeam(null);setTeamMembers([]);}},[signedIn]);
  const weekMonday = (w: string) => { const m=w.match(/^(\\d{4})-W(\\d{2})$/); if(!m) return new Date().toISOString().slice(0,10); const y=Number(m[1]), n=Number(m[2]); const d=new Date(Date.UTC(y,0,4)); d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7)+1+(n-1)*7); return d.toISOString().slice(0,10); };
  useEffect(() => {
    if (!supabase || !signedIn) return;
    let cancelled=false;
    (async()=>{ try {
      const {data:{user}}=await supabase.auth.getUser(); if(!user) return;
      const {data:team}=await supabase.from("teams").select("id").eq("owner_id",user.id).limit(1).maybeSingle(); if(!team) {setConnection("Signed in · no owned team found");return;}
      const start=weekMonday(week); const end=new Date(start+"T00:00:00Z"); end.setUTCDate(end.getUTCDate()+6);
      const {data:cycle,error:cycleErr}=await supabase.from("tournament_cycles").upsert({team_id:team.id,cycle_start:start,cycle_end:end.toISOString().slice(0,10),title:"Weekly Tournament",status:"active",created_by:user.id},{onConflict:"team_id,cycle_start"}).select("id").single();
      if(cycleErr||!cycle) {setConnection("Signed in · cycle sync needs review");return;}
      const rows=Object.entries(matches).flatMap(([key,m])=>{const mt=key.match(/-D(\\d+)-M(\\d+)$/);return mt?[{cycle_id:cycle.id,team_id:team.id,match_day:Number(mt[1]),match_number:Number(mt[2]),placement:m.placement,kills:m.kills,points:(m.placement===1?12:m.placement===2?9:m.placement===3?8:m.placement===4?7:m.placement===5?6:m.placement===6?5:m.placement===7?4:m.placement===8?3:m.placement===9?2:m.placement===10?1:0)+m.kills,status:"draft",recorded_by:user.id}]:[]});
      if(rows.length){const {error}=await supabase.from("tournament_matches").upsert(rows,{onConflict:"cycle_id,match_day,match_number"});if(error)throw error;}
      if(!cancelled)setConnection("Signed in · cloud sync active");
    } catch {if(!cancelled)setConnection("Signed in · sync retry needed");} })();
    return()=>{cancelled=true};
  },[signedIn,matches,week]);
  useEffect(()=>{ if(!supabase||!signedIn||!team)return; let cancelled=false; (async()=>{ try { const start=weekMonday(week); const {data:cycle}=await supabase.from("tournament_cycles").select("id").eq("team_id",team.id).eq("cycle_start",start).maybeSingle(); if(!cycle){if(!cancelled)setSharedMatches([]);return;} const {data,error}=await supabase.from("tournament_matches").select("match_day,match_number,placement,kills,points,status").eq("cycle_id",cycle.id).order("match_day").order("match_number"); if(error)throw error; if(!cancelled)setSharedMatches(data||[]); }catch(e){if(!cancelled)setNotice(e instanceof Error?e.message:"Shared scoreboard unavailable.");} })(); return()=>{cancelled=true}; },[signedIn,team?.id,week]);
  const refreshSharedMatches = async () => {
    if (!supabase || !team) return;
    try {
      const start = weekMonday(week);
      const { data: cycle, error: ce } = await supabase.from("tournament_cycles").select("id").eq("team_id", team.id).eq("cycle_start", start).maybeSingle();
      if (ce) throw ce;
      if (!cycle) { setSharedMatches([]); setNotice("No tournament cycle exists for this week yet."); return; }
      const { data, error } = await supabase.from("tournament_matches").select("match_day,match_number,placement,kills,points,status").eq("cycle_id", cycle.id).order("match_day").order("match_number");
      if (error) throw error;
      setSharedMatches(data || []);
      setNotice("Shared scoreboard refreshed.");
    } catch (e) { setNotice(e instanceof Error ? e.message : "Refresh failed."); }
  };
  useEffect(()=>{if(!supabase||!signedIn||!team)return;let cancelled=false;(async()=>{try{const {data,error}=await supabase.from("training_log").select("activity,done").eq("team_id",team.id).eq("log_date",trainingDate);if(error)throw error;if(!cancelled)setCloudTraining(Object.fromEntries((data||[]).map(x=>[x.activity,!!x.done])));}catch(e){if(!cancelled)setNotice(e instanceof Error?e.message:"Cloud training load failed.");}})();return()=>{cancelled=true};},[signedIn,team?.id,trainingDate]);
  useEffect(()=>{if(!supabase||!signedIn||!team)return;let cancelled=false;(async()=>{try{const {data,error}=await supabase.from("daily_scores").select("id,player_id,score_date,communication,coordination,decision_making,role_execution,map_awareness,total,notes,improvement_target").eq("team_id",team.id).order("score_date",{ascending:false}).limit(100);if(error)throw error;if(!cancelled)setEvalHistory(data||[]);}catch(e){if(!cancelled)setNotice(e instanceof Error?e.message:"Evaluation history unavailable.");}})();return()=>{cancelled=true};},[signedIn,team?.id]);
  const saveEvaluation=async()=>{if(!supabase||!team||!signedIn){setNotice("Sign in and join a team to save evaluations in cloud.");return;}try{const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Session expired.");const {error}=await supabase.from("daily_scores").insert({team_id:team.id,score_date:evalDate,player_id:evalPlayer,evaluator_id:user.id,...evalScores,notes:evalNotes.trim()||null,improvement_target:evalTarget.trim()||null});if(error)throw error;const {data,error:he}=await supabase.from("daily_scores").select("id,player_id,score_date,communication,coordination,decision_making,role_execution,map_awareness,total,notes,improvement_target").eq("team_id",team.id).order("score_date",{ascending:false}).limit(100);if(he)throw he;setEvalHistory(data||[]);setNotice("Player evaluation saved to squad cloud.");}catch(e){setNotice(e instanceof Error?e.message:"Evaluation save failed.");}};
  const saveCloudTraining = async (activity:string,done:boolean) => {setCloudTraining(p=>({...p,[activity]:done}));if(!supabase||!team||!signedIn)return;try{const {data:{user}}=await supabase.auth.getUser();if(!user)return;const {error}=await supabase.from("training_log").upsert({team_id:team.id,log_date:trainingDate,activity,done,updated_by:user.id},{onConflict:"team_id,log_date,activity"});if(error)throw error;setNotice("Training checklist synced for the squad.");}catch(e){setNotice(e instanceof Error?e.message:"Cloud training save failed.");}};
  const totalMatches = Object.keys(matches).length;
  const points = Object.values(matches).reduce((sum, m) => sum + (m.placement === 1 ? 12 : m.placement === 2 ? 9 : m.placement === 3 ? 8 : m.placement === 4 ? 7 : m.placement === 5 ? 6 : m.placement === 6 ? 5 : m.placement === 7 ? 4 : m.placement === 8 ? 3 : m.placement === 9 ? 2 : m.placement === 10 ? 1 : 0) + m.kills, 0);
  const filteredPlayers = useMemo(() => players.filter(p => (p.name + p.role).toLowerCase().includes(query.toLowerCase())), [players, query]);
  const saveMatch = (slot: string, field: "placement" | "kills", value: number) => {
    setMatches(prev => ({ ...prev, [slot]: { placement: prev[slot]?.placement ?? 12, kills: prev[slot]?.kills ?? 0, [field]: value } }));
  };
  const addPlayer = () => {
    if (!newName.trim() || players.length >= 10) return;
    setPlayers(prev => [...prev, { id: "P" + (prev.length + 1), name: newName.trim(), role: newRole, status: "Active" }]);
    setNewName(""); setNotice("Player added to this device.");
  };
  const nav: Section[] = ["Overview", "Tournament", "Training", "Players", "Evaluation", "Analytics"];
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">S</div><div className="brand-copy"><span className="brand-name">SQUAD OS</span><span className="brand-caption">TEAM OPERATIONS</span></div>
        <div className="sidebar-divider"/><div className="nav-label">WORKSPACE</div>
        {nav.map(n => <button key={n} className={"nav-item "+(section===n?"nav-item-active":"nav-item-muted")} onClick={()=>setSection(n)}><span className="nav-dot"/>{n}</button>)}
        <div className="sidebar-bottom">M2 · WORKSPACE</div>
      </aside>
      <section className="main-panel">
        <header className="topbar"><div className="breadcrumb">WORKSPACE <span>/</span> {section.toUpperCase()}</div><div className="system-status"><i/> {connection.toUpperCase()}</div></header>
        <div className="content">
          <div className="eyebrow">SQUAD MANAGEMENT PLATFORM · M2</div>
          <h1>{section==="Overview" ? <>Control the squad.<br/><span>Track every week.</span></> : <>{section}.<br/><span>Team operations.</span></>}</h1>
          <p className="intro">A focused workspace for tournament results, player development and team performance. Match entries and training notes are browser-local; team membership and weekly match rows use Supabase.</p>
          {notice && <div className="notice">{notice}<button onClick={()=>setNotice("")}>×</button></div>}
          {section==="Overview" && <>
            <div className="section-heading"><div><div className="eyebrow">AT A GLANCE</div><h2>Squad overview</h2></div><span className="phase-pill">M2 / INTERACTIVE</span></div>            <section className="connection-panel"><div><div className="eyebrow">SUPABASE AUTH</div><h3>{signedIn ? "Cloud account connected" : "Sign in to sync"}</h3><p>{signedIn ? sessionEmail+" · tournament match records sync to TITAN BOLD" : "Email/password account access. Local progress remains available offline."}</p></div>{signedIn?<button className="primary-button" onClick={signOut}>Sign out</button>:<div className="add-form"><input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Display / IGN name"/><input type="email" value={sessionEmail} onChange={e=>setSessionEmail(e.target.value)} placeholder="Email"/><input type="password" value={sessionPassword} onChange={e=>setSessionPassword(e.target.value)} placeholder="Password"/><button className="primary-button" onClick={signIn}>Sign in</button><button className="secondary-button" onClick={signUp}>Create account</button></div>}</section>

            {signedIn && <div className="add-form" style={{marginBottom:12}}><input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Your IGN / display name"/><button className="secondary-button" onClick={async()=>{if(!supabase)return;const {error}=await supabase.rpc("set_display_name",{p_name:displayName.trim()});setNotice(error?error.message:"Display name saved.");}}>Save IGN</button></div>}
            <section className="connection-panel" style={{display:"block",marginBottom:22}}>
              <div className="eyebrow">TEAM COLLABORATION · SUPABASE</div>
              {team ? <>
                <h3 style={{marginTop:8}}>{team.team_name} <span className="active-tag">{team.membership_role}</span></h3>
                <p>Invite code <strong style={{letterSpacing:2,fontSize:18}}>{team.invite_code}</strong> · share this code privately with teammates.</p>
                <div className="player-list">{teamMembers.map(m=><article className="player-row" key={m.id}><span className="player-id">{m.player_number?"P"+m.player_number:"—"}</span><div><b>{m.display_name}</b><small>{m.membership_role} · {m.assigned_role||"Role not assigned"}</small></div>{team.membership_role==="owner"&&m.membership_role!=="owner"?<div className="add-form"><select defaultValue={String(m.player_number||1)} onChange={e=>assignMember(m.id,Number(e.target.value),m.assigned_role||"Player")}>{[1,2,3,4,5].map(n=><option value={n} key={n}>P{n}</option>)}</select><select defaultValue={m.assigned_role||"Player"} onChange={e=>assignMember(m.id,Number(m.player_number||0),e.target.value)}>{["Primary Rusher","Secondary Rusher","Third Rusher / Flank","Sniper / IGL","Substitute","Player"].map(x=><option key={x}>{x}</option>)}</select></div>:null}</article>)}</div>
              </>:<>
                <h3 style={{marginTop:8}}>Create a team or join with code</h3><p>Team owner creates one squad. Players use the invite code from their own accounts.</p>
                <div className="add-form"><input value={teamName} onChange={e=>setTeamName(e.target.value)} placeholder="Team name"/><input value={teamDescription} onChange={e=>setTeamDescription(e.target.value)} placeholder="Description (optional)"/><button className="primary-button" disabled={teamBusy||!teamName.trim()} onClick={createTeam}>{teamBusy?"Working…":"Create team"}</button></div>
                <div className="add-form" style={{marginTop:12}}><input value={teamCode} onChange={e=>setTeamCode(e.target.value.toUpperCase())} placeholder="8-character invite code" maxLength={8}/><button className="secondary-button" disabled={teamBusy||teamCode.trim().length<6} onClick={joinTeam}>Join team</button></div>
              </>}
            </section>
            <div className="foundation-grid">
              {[["Roster",players.length+" / 10","Configured players"],["Match records",String(totalMatches),"Current browser"],["Week points",String(points),"Placement + kills"],["Cloud",isSupabaseConfigured?"Configured":"Pending","Auth check only"]].map(([a,b,c],i)=><article className="foundation-card" key={a}><div className="card-index">0{i+1}</div><div className="card-label">{a}</div><div className="card-value">{b}</div><div className="card-detail">{c}</div></article>)}
            </div>
            <section className="connection-panel"><div><div className="eyebrow">NEXT ACTION</div><h3>Start with the tournament ledger</h3><p>Choose Tournament to record six matches per day, seven days per week. Training and roster are separate sections.</p></div><button className="primary-button" onClick={()=>setSection("Tournament")}>Open tournament →</button></section>
          </>}
          {section==="Tournament" && <>
            <div className="section-heading"><div><div className="eyebrow">WEEKLY CYCLE</div><h2>Matchday ledger</h2></div><span className="phase-pill">42 MATCH SLOTS</span></div>
            <div className="toolbar"><label>Week <input value={week} onChange={e=>setWeek(e.target.value)} placeholder="YYYY-W##"/></label><label>Day <select value={day} onChange={e=>setDay(Number(e.target.value))}>{Array.from({length:7},(_,i)=><option value={i+1} key={i}>Day {i+1} · {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i]}</option>)}</select></label></div>
            <div className="match-grid">{Array.from({length:6},(_,i)=>{const key=week+"-D"+day+"-M"+(i+1);const m=matches[key]||{placement:12,kills:0};return <article className="match-card" key={key}><div className="card-index">MATCH 0{i+1}</div><h3>Match {i+1}</h3><label>Placement<select value={m.placement} onChange={e=>saveMatch(key,"placement",Number(e.target.value))}>{Array.from({length:12},(_,j)=><option key={j} value={j+1}>{j+1===12?"12+ / Other":j+1}</option>)}</select></label><label>Kills<input type="number" min="0" value={m.kills} onChange={e=>saveMatch(key,"kills",Math.max(0,Number(e.target.value)))}/></label></article>})}</div>
            {signedIn&&team&&<section className="connection-panel" style={{display:"block",marginTop:18}}><div className="eyebrow">TEAM CLOUD SCOREBOARD</div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}><h3>Shared results · {sharedMatches.filter(m=>m.placement!=null).length}/42 scored slots</h3><button className="secondary-button" onClick={refreshSharedMatches}>Refresh</button></div><p>Team-wide weekly match ledger. Blank slots are seeded; scores sync from the owner/coach browser.</p><div className="player-list">{sharedMatches.map(m=><article className="player-row" key={m.match_day+"-"+m.match_number}><span className="player-id">D{m.match_day} M{m.match_number}</span><div><b>Place {m.placement??"—"} · {m.kills??0} kills · {m.points??0} pts</b><small>{m.status}</small></div></article>)}</div></section>}
            <p className="footer-note">Prototype scoring: placement 1–10 = 12,9,8,7,6,5,4,3,2,1 points; 11/12 = 0. Add kills. Not an official tournament scoring preset.</p>
          </>}
          {section==="Training" && <>
            <div className="section-heading"><div><div className="eyebrow">PRACTICE BLOCK</div><h2>Team drill checklist</h2></div><span className="phase-pill">LOCAL CHECKLIST</span></div>
            <div className="toolbar"><label>Training date <input type="date" value={trainingDate} onChange={e=>setTrainingDate(e.target.value)}/></label><span className="phase-pill">{signedIn&&team?"SQUAD CLOUD":"LOCAL ONLY"}</span></div><div className="drill-list">{["IGL call clarity · short and actionable","Trade spacing · pair stays connected","Rotation timing · move before pressure","Reset discipline · regroup before re-entry","Post-match review · one fix per match"].map((d,i)=><label className="drill-row" key={d}><input type="checkbox" checked={signedIn&&team?!!cloudTraining[d]:!!drillDone[d]} onChange={e=>{if(signedIn&&team)saveCloudTraining(d,e.target.checked);else setDrillDone(p=>({...p,[d]:e.target.checked}));}}/><span><b>0{i+1} / {d}</b><small>Mark only after the team completes and reviews it.</small></span></label>)}</div>
            <label className="notes-label">Session notes<textarea value={notes.training||""} onChange={e=>setNotes(p=>({...p,training:e.target.value}))} placeholder="Calls missed, timing issue, next session target…"/></label>
          </>}
          {section==="Players" && <>
            <div className="section-heading"><div><div className="eyebrow">ROSTER MANAGEMENT</div><h2>Squad roster</h2></div><span className="phase-pill">{players.length} / 10</span></div>
            <input className="search-input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search players or roles…"/>
            <div className="player-list">{filteredPlayers.map(p=><article className="player-row" key={p.id}><span className="player-id">{p.id}</span><div><b>{p.name}</b><small>{p.role}</small></div><span className="active-tag">{p.status}</span><button className="delete-button" onClick={()=>setPlayers(prev=>prev.filter(x=>x.id!==p.id))}>Remove</button></article>)}</div>
            <section className="connection-panel add-player"><div><div className="eyebrow">ADD PLAYER</div><h3>Roster slot</h3><p>Maximum ten roster entries in this local prototype.</p></div><div className="add-form"><input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Player name"/><select value={newRole} onChange={e=>setNewRole(e.target.value)}>{["Primary Rusher","Secondary Rusher","Third Rusher / Flank","Sniper / IGL","Substitute"].map(x=><option key={x}>{x}</option>)}</select><button className="primary-button" disabled={players.length>=10||!newName.trim()} onClick={addPlayer}>Add</button></div></section>
          </>}
          {section==="Evaluation" && <>
            <div className="section-heading"><div><div className="eyebrow">PLAYER DEVELOPMENT</div><h2>Daily evaluation</h2></div><span className="phase-pill">{signedIn&&team?"SUPABASE":"CLOUD LOGIN REQUIRED"}</span></div>
            <section className="connection-panel" style={{display:"block"}}>
              <div className="toolbar"><label>Player<select value={evalPlayer} onChange={e=>setEvalPlayer(e.target.value)}>{teamMembers.filter(m=>m.status==="active").map(m=><option key={m.user_id} value={m.user_id}>{m.display_name} · {m.assigned_role||("P"+m.player_number)}</option>)}{teamMembers.length===0&&players.map(p=><option key={p.id} value={p.id}>{p.id} · {p.name}</option>)}</select></label><label>Date<input type="date" value={evalDate} onChange={e=>setEvalDate(e.target.value)}/></label></div>
              <p>Rate observable performance from 0–10. Score saves to the shared team record.</p>
              <div className="drill-list">{[["communication","Communication"],["coordination","Coordination"],["decision_making","Decision Making"],["role_execution","Role Execution"],["map_awareness","Map Awareness"]].map(([k,label])=><label className="drill-row" key={k}><span><b>{label}</b><small>{evalScores[k]} / 10</small></span><input type="range" min="0" max="10" value={evalScores[k]} onChange={e=>setEvalScores(p=>({...p,[k]:Number(e.target.value)}))}/></label>)}</div>
              <div className="foundation-card" style={{marginTop:12}}><div className="card-label">TOTAL SCORE</div><div className="card-value">{Object.values(evalScores).reduce((a,b)=>a+b,0)} / 50</div></div>
              <label className="notes-label">Improvement target<input value={evalTarget} onChange={e=>setEvalTarget(e.target.value)} placeholder="One measurable focus for next session"/></label><label className="notes-label">Evaluator notes<textarea value={evalNotes} onChange={e=>setEvalNotes(e.target.value)} placeholder="What worked, what needs correction…"/></label>
              <button className="primary-button" style={{marginTop:14}} onClick={saveEvaluation}>Save evaluation to cloud</button>
            </section>
            <section className="connection-panel" style={{display:"block",marginTop:18}}><div className="eyebrow">RECENT EVALUATIONS · {evalHistory.length}</div><div className="player-list">{evalHistory.map(e=><article className="player-row" key={e.id}><span className="player-id">{e.score_date}</span><div><b>{teamMembers.find(m=>m.user_id===e.player_id)?.display_name||e.player_id.slice(0,8)} · {e.total??"—"}/50</b><small>Com {e.communication} · Coord {e.coordination} · Decisions {e.decision_making} · Role {e.role_execution} · Map {e.map_awareness}</small>{e.improvement_target&&<small>Target: {e.improvement_target}</small>}{e.notes&&<small>Notes: {e.notes}</small>}</div></article>)}</div></section>
          </>}
          {section==="Analytics" && <>
            <div className="section-heading"><div><div className="eyebrow">PERFORMANCE SNAPSHOT</div><h2>Current week</h2></div><span className="phase-pill">BROWSER DATA</span></div>
            <div className="foundation-grid">{[["Recorded matches",totalMatches],["Placement + kills points",points],["Average kills",totalMatches?(Object.values(matches).reduce((s,m)=>s+m.kills,0)/totalMatches).toFixed(1):"0.0"],["Roster size",players.length]].map(([a,b],i)=><article className="foundation-card" key={String(a)}><div className="card-index">0{i+1}</div><div className="card-label">{a}</div><div className="card-value">{b}</div></article>)}</div>
            <section className="connection-panel"><div><div className="eyebrow">DATA WARNING</div><h3>Analytics are still browser-local</h3><p>Tournament match rows are shared in Supabase; these summary metrics still calculate from this browser’s local entries.</p></div></section>
          </>}
          <footer className="footer-note">M2 · TEAM CLOUD MATCH LEDGER + LOCAL TRAINING / ANALYTICS</footer>
        </div>
      </section>
    </main>
  );
}
