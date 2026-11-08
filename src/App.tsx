import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "./lib/supabase/client";

type Section = "Overview" | "Tournament" | "Training" | "Players" | "Evaluation" | "Assignments" | "Analytics" | "Settings";
type Player = { id: string; name: string; role: string; status: string };
const initialPlayers: Player[] = [
  { id: "P1", name: "Player 1", role: "Primary Rusher", status: "Active" },
  { id: "P2", name: "Player 2", role: "Secondary Rusher", status: "Active" },
  { id: "P3", name: "Player 3", role: "Third Rusher / Flank", status: "Active" },
  { id: "P4", name: "Player 4", role: "Sniper / IGL", status: "Active" },
];

async function makeSquareTeamLogo(file: File, x: number, y: number): Promise<File> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => { const img = new Image(); img.onload=()=>resolve(img); img.onerror=reject; img.src=URL.createObjectURL(file); });
  const side=Math.min(image.naturalWidth,image.naturalHeight), sx=(image.naturalWidth-side)*(x/100), sy=(image.naturalHeight-side)*(y/100);
  const canvas=document.createElement("canvas");canvas.width=512;canvas.height=512;const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Image crop is unavailable.");
  ctx.drawImage(image,sx,sy,side,side,0,0,512,512);URL.revokeObjectURL(image.src);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("Could not crop image.")),"image/jpeg",.88));
  return new File([blob],"team-logo.jpg",{type:"image/jpeg"});
}
function currentISOWeekKey(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const weekday = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function readPlayers(): Player[] {
  try { const v = localStorage.getItem("squad-os-roster"); return v ? JSON.parse(v) : initialPlayers; }
  catch { return initialPlayers; }
}

export default function App() {
  const [section, setSection] = useState<Section>("Overview");
  const [players, setPlayers] = useState<Player[]>(readPlayers);
  const [week, setWeek] = useState(() => localStorage.getItem("squad-os-week") || currentISOWeekKey());
  const [day, setDay] = useState(() => Number(localStorage.getItem("squad-os-day") || 1));
  const [matches, setMatches] = useState<Record<string, { placement: number; kills: number }>>(() => { try { return JSON.parse(localStorage.getItem("squad-os-matches") || "{}"); } catch { return {}; } });
  const [notice, setNotice] = useState("");
  const [sharedMatches, setSharedMatches] = useState<Array<{match_day:number;match_number:number;placement:number|null;kills:number;points:number|null;status:string}>>([]);
  const [matchesHydratedKey, setMatchesHydratedKey] = useState("");
  const [connection, setConnection] = useState("Checking Supabase…");
  const [sessionUsername, setSessionUsername] = useState("");
  const [sessionPassword, setSessionPassword] = useState("");
  const [authMode, setAuthMode] = useState<"signin"|"signup">("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<"email"|"otp"|"password">("email");
  const [recoveryOtp, setRecoveryOtp] = useState("");
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [sessionUserId, setSessionUserId] = useState("");

  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("Substitute");
  const [drillDone, setDrillDone] = useState<Record<string, boolean>>(() => { try { return JSON.parse(localStorage.getItem("squad-os-drills") || "{}"); } catch { return {}; } });
  const [notes, setNotes] = useState<Record<string, string>>(() => { try { return JSON.parse(localStorage.getItem("squad-os-notes") || "{}"); } catch { return {}; } });
  const [query, setQuery] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [teamCode, setTeamCode] = useState("");
  const [teamDescription, setTeamDescription] = useState("");
  const [teamLogoFile, setTeamLogoFile] = useState<File|null>(null);
  const [teamLogoPreview, setTeamLogoPreview] = useState("");
  const [teamLogoCropX, setTeamLogoCropX] = useState(50);
  const [teamLogoCropY, setTeamLogoCropY] = useState(50);
  const [teamScreen, setTeamScreen] = useState<"choice" | "create" | "join">("choice");
  const [team, setTeam] = useState<{id:string;team_name:string;invite_code:string;avatar_url?:string|null;membership_role:string;player_number:number|null;assigned_role:string|null}|null>(null);
  const [teamMembers, setTeamMembers] = useState<Array<{id:string;user_id:string;display_name:string;player_number:number|null;assigned_role:string|null;membership_role:string;status:string}>>([]);
  const [teamBusy, setTeamBusy] = useState(false);
  const [cloudTraining, setCloudTraining] = useState<Record<string, boolean>>({});
  const [cloudSessionNotes, setCloudSessionNotes] = useState("");
  const [trainingDate, setTrainingDate] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [evalPlayer,setEvalPlayer]=useState("P1");
  const [evalDate,setEvalDate]=useState(()=>new Date().toLocaleDateString("en-CA"));
  const [evalScores,setEvalScores]=useState<Record<string,number>>({communication:5,coordination:5,decision_making:5,role_execution:5,map_awareness:5});
  const [evalNotes,setEvalNotes]=useState("");
  const [evalTarget,setEvalTarget]=useState("");
  const [evalHistory,setEvalHistory]=useState<Array<{id:string;player_id:string;score_date:string;communication:number;coordination:number;decision_making:number;role_execution:number;map_awareness:number;total:number|null;notes:string|null;improvement_target:string|null}>>([]);

  const [assignmentPlayer,setAssignmentPlayer]=useState("");
  const [assignmentTitle,setAssignmentTitle]=useState("Comms: short info + confirmation");
  const [assignmentDesc,setAssignmentDesc]=useState("Practice concise enemy/location callouts, repeat IGL orders, and confirm role.");
  const [assignmentDate,setAssignmentDate]=useState(()=>new Date().toLocaleDateString("en-CA"));
  const [assignmentRows,setAssignmentRows]=useState<Array<{id:string;player_id:string;drill_title:string;drill_description:string|null;due_date:string;status:string;completion_note:string|null}>>([]);
  useEffect(() => { localStorage.setItem("squad-os-roster", JSON.stringify(players)); }, [players]);
  useEffect(() => { localStorage.setItem("squad-os-matches", JSON.stringify(matches)); }, [matches]);
  useEffect(() => { localStorage.setItem("squad-os-drills", JSON.stringify(drillDone)); }, [drillDone]);
  useEffect(() => { localStorage.setItem("squad-os-notes", JSON.stringify(notes)); }, [notes]);
  useEffect(() => {
    let alive = true;
    if (!supabase) { setConnection("Missing project settings"); return; }
    supabase.auth.getSession().then(({ data, error }) => {
      if (alive) { setSignedIn(!!data.session); setSessionUserId(data.session?.user.id || ""); setSessionUsername(data.session?.user.user_metadata?.username || data.session?.user.user_metadata?.display_name || data.session?.user.email?.split("@")[0] || ""); setDisplayName(data.session?.user.user_metadata?.display_name || data.session?.user.user_metadata?.username || ""); setConnection(error ? "Configured · auth check failed" : data.session ? "Signed in · cloud enabled" : "Configured · sign in required"); }
    }).catch(() => alive && setConnection("Configured · network unavailable"));
    const { data: authSub } = supabase.auth.onAuthStateChange((event, session) => {
      if (alive) {
        if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
        setSignedIn(!!session); setSessionUserId(session?.user.id || ""); setSessionUsername(session?.user.user_metadata?.username || session?.user.user_metadata?.display_name || session?.user.email?.split("@")[0] || ""); setDisplayName(session?.user.user_metadata?.display_name || session?.user.user_metadata?.username || ""); setConnection(session ? "Signed in · cloud enabled" : "Configured · sign in required");
      }
    });
    return () => { alive = false; authSub.subscription.unsubscribe(); };
  }, []);

  const loadAssignments=async()=>{if(!supabase||!team)return;const {data,error}=await supabase.from("player_drill_assignments").select("id,player_id,drill_title,drill_description,due_date,status,completion_note").eq("team_id",team.id).order("due_date",{ascending:false}).limit(100);if(error)throw error;setAssignmentRows(data||[]);};
  useEffect(()=>{if(signedIn&&team)loadAssignments().catch(e=>setNotice(e.message));},[signedIn,team?.id]);
  const createAssignment=async()=>{if(!supabase||!team||!["owner","coach"].includes(team.membership_role)||!assignmentPlayer||!assignmentTitle.trim())return;const {data:{user}}=await supabase.auth.getUser();const {error}=await supabase.from("player_drill_assignments").insert({team_id:team.id,player_id:assignmentPlayer,assigned_by:user?.id,drill_title:assignmentTitle.trim(),drill_description:assignmentDesc.trim(),due_date:assignmentDate});if(error){setNotice(error.message);return;}setNotice("Drill assigned.");await loadAssignments();};
  const updateAssignment=async(id:string,status:string)=>{if(!supabase||!team)return;const {error}=await supabase.from("player_drill_assignments").update({status,completed_at:status==="completed"?new Date().toISOString():null}).eq("id",id);if(error){setNotice(error.message);return;}await loadAssignments();};
  const signIn = async () => {
    if (!supabase) return setNotice("Supabase is not configured. Check Vercel environment variables.");
    const identifier = sessionUsername.trim();
    if (!identifier || !sessionPassword) return setNotice("Enter your username and password.");
    const { data, error } = await supabase.functions.invoke("login-with-ign", {
      body: { identifier, password: sessionPassword },
    });
    if (error || !data?.session?.access_token || !data?.session?.refresh_token) {
      let message = data?.error;
      const context = (error as { context?: unknown } | null)?.context;
      if (!message && context instanceof Response) {
        try { const body = await context.clone().json(); message = body?.error || body?.message; } catch { /* keep the safe fallback */ }
      }
      setNotice(message || "Login failed. Check your username/Gmail and password, or use Forgot password.");
      return;
    }
    const { error: sessionError } = await supabase.auth.setSession(data.session);
    setNotice(sessionError ? sessionError.message : "Signed in. Squad cloud sync is enabled.");
  };

  const requestPasswordReset = async () => {
    if (!supabase) return setNotice("Supabase is not configured. Check Vercel environment variables.");
    const email = recoveryEmail.trim().toLowerCase();
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) return setNotice("Enter the registered email address.");
    setRecoveryBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    setRecoveryBusy(false);
    if (error) return setNotice("OTP could not be sent. Confirm this email is registered and Supabase Email OTP is enabled.");
    setRecoveryStep("otp");
    setNotice("A verification code was sent if this email is registered. Check Inbox and Spam.");
  };

  const verifyRecoveryOtp = async () => {
    if (!supabase) return setNotice("Supabase is not configured.");
    const email = recoveryEmail.trim().toLowerCase(), token = recoveryOtp.trim();
    if (!/^\\d{6}$/.test(token)) return setNotice("Enter the 6-digit OTP.");
    setRecoveryBusy(true);
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    setRecoveryBusy(false);
    if (error || !data.session) return setNotice("OTP invalid or expired. Request a fresh code.");
    setRecoveryStep("password"); setRecoveryMode(true); setRecoveryOtp("");
    setNotice("Email verified. Set a new password.");
  };

  const saveRecoveredPassword = async () => {
    if (!supabase) return setNotice("Supabase is not configured.");
    if (newPassword.length < 8 || newPassword.length > 128) return setNotice("New password must be 8–128 characters.");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return setNotice(error.message);
    setRecoveryMode(false); setRecoveryStep("email"); setNewPassword(""); setSessionPassword("");
    setNotice("Password updated. Your account is ready.");
  };

  const signUp = async () => {
    if (!supabase) return setNotice("Supabase is not configured. Check Vercel environment variables.");
    const username = sessionUsername.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9.-]{2,23}$/.test(username)) {
      return setNotice("Username must be 3–24 characters: lowercase letters, numbers, dots or hyphens.");
    }
    if (sessionPassword.length < 8 || sessionPassword.length > 128) {
      return setNotice("Password must be between 8 and 128 characters.");
    }
    const internalEmail = `${username}@accounts.squad-os.invalid`;
    const { data, error } = await supabase.auth.signUp({
      email: internalEmail,
      password: sessionPassword,
      options: { data: { display_name: username, username } },
    });
    if (error) {
      const message = error.message || "";
      setNotice(/profiles_display_name_lower_uidx|duplicate key|already registered|already been registered/i.test(message)
        ? "That username is already taken. Choose another one."
        : message);
      return;
    }
    if (!data.session) {
      setNotice("Signup is blocked because Supabase Email Confirmation is still ON. The team admin must turn it OFF in Supabase Auth → Settings before creating username-only accounts. Do not retry this username until that setting is changed.");
      return;
    }
    setSessionUsername(username);
    setDisplayName(username);
    setAuthMode("signin");
    setNotice("Account created. You are signed in and cloud sync is ready.");
  };

  const signOut = async () => { if (supabase) { await supabase.auth.signOut(); setNotice("Signed out. Local records remain on this device."); } };
  const loadTeam = async () => {
    if (!supabase) return;
    const {data:{user}}=await supabase.auth.getUser(); if(!user) {setTeam(null);setTeamMembers([]);return;}
    const {data:membership,error}=await supabase.from("team_members").select("id,team_id,user_id,player_number,assigned_role,membership_role,status").eq("user_id",user.id).limit(1).maybeSingle();
    if(error) throw error;
    if(!membership){setTeam(null);setTeamMembers([]);return;}
    const {data:t,error:te}=await supabase.from("teams").select("id,team_name,invite_code,avatar_url").eq("id",membership.team_id).single(); if(te)throw te;
    setTeam({...t,membership_role:membership.membership_role,player_number:membership.player_number,assigned_role:membership.assigned_role});
    const {data:members,error:me}=await supabase.from("team_members").select("id,user_id,player_number,assigned_role,membership_role,status").eq("team_id",t.id).order("player_number");
    if(me)throw me;
    const ids=(members||[]).map(x=>x.user_id);
    const {data:profiles,error:pe}=await supabase.from("profiles").select("id,display_name").in("id",ids); if(pe)throw pe;
    setTeamMembers((members||[]).map(x=>({...x,display_name:profiles?.find(p=>p.id===x.user_id)?.display_name||"Player"})));
  };
  const createTeam = async () => { if(!supabase||teamName.trim().length<2){setNotice("Team name must be at least 2 characters.");return;} setTeamBusy(true); try { const finalIGN=displayName.trim()||sessionUsername.trim()||"Squad Player"; const {error:ne}=await supabase.rpc("set_display_name",{p_name:finalIGN});if(ne)throw ne; const {error}=await supabase.rpc("create_team",{p_name:teamName.trim(),p_description:teamDescription.trim()||null,p_timezone:"Asia/Kolkata"}); if(error)throw error; await loadTeam(); if(teamLogoFile&&supabase){const {data:{user}}=await supabase.auth.getUser();if(user){const {data:mem,error:me}=await supabase.from("team_members").select("team_id").eq("user_id",user.id).limit(1).single();if(me)throw me;const ext=teamLogoFile.name.split(".").pop()?.toLowerCase()||"jpg";const path=`${user.id}/${mem.team_id}.${ext}`;const {error:up}=await supabase.storage.from("team-avatars").upload(path,teamLogoFile,{upsert:true,contentType:teamLogoFile.type});if(up)throw up;const {data:pub}=supabase.storage.from("team-avatars").getPublicUrl(path);const {error:av}=await supabase.from("teams").update({avatar_url:pub.publicUrl}).eq("id",mem.team_id);if(av)throw av;await loadTeam();}} setTeamName("");setTeamDescription("");setTeamLogoFile(null);setTeamLogoPreview("");setTeamScreen("choice");setNotice("Team created. Invite code and teammates are now available in Team panel."); } catch(e){setNotice(e instanceof Error?e.message:"Team creation failed.");} finally{setTeamBusy(false);} };
  const joinTeam = async () => { if(!supabase||!teamCode.trim())return; setTeamBusy(true); try { if(!displayName.trim()){throw new Error("Enter your IGN/display name first.");} const {error:ne}=await supabase.rpc("set_display_name",{p_name:displayName.trim()});if(ne)throw ne; const {error}=await supabase.rpc("join_team",{p_code:teamCode.trim().toUpperCase()}); if(error)throw error; await loadTeam();setTeamCode("");setNotice("Joined team successfully."); } catch(e){setNotice(e instanceof Error?e.message:"Could not join team.");} finally{setTeamBusy(false);} };
  const assignMember = async (memberId:string, player:number, role:string) => { if(!supabase||team?.membership_role!=="owner")return; try { if(player>=1&&player<=5){const {error}=await supabase.rpc("assign_member",{p_member:memberId,p_player:player,p_activate:true});if(error)throw error;} const {error:re}=await supabase.from("team_members").update({assigned_role:role}).eq("id",memberId);if(re)throw re;await loadTeam();setNotice("Member slot and role updated."); }catch(e){setNotice(e instanceof Error?e.message:"Member assignment failed.");} };
  useEffect(()=>{if(signedIn)loadTeam().catch(e=>setNotice(e instanceof Error?e.message:"Could not load team."));else{setTeam(null);setTeamMembers([]);setMatchesHydratedKey("");}},[signedIn]);
  const weekMonday = (w: string) => { const m=w.match(/^(\d{4})-W(\d{2})$/); if(!m) return new Date().toISOString().slice(0,10); const y=Number(m[1]), n=Number(m[2]); const d=new Date(Date.UTC(y,0,4)); d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7)+(n-1)*7); return d.toISOString().slice(0,10); };
  useEffect(() => {
    if (!supabase || !signedIn || !team || matchesHydratedKey !== `${team.id}:${week}`) return;
    let cancelled=false;
    (async()=>{ try {
      const {data:{user}}=await supabase.auth.getUser(); if(!user) return;
      if(!["owner","coach"].includes(team.membership_role)) { setConnection("Signed in · scoreboard is read-only for this role"); return; }
      const start=weekMonday(week); const end=new Date(start+"T00:00:00Z"); end.setUTCDate(end.getUTCDate()+6);
      const {data:cycle,error:cycleErr}=await supabase.from("tournament_cycles").upsert({team_id:team.id,cycle_start:start,cycle_end:end.toISOString().slice(0,10),title:"Weekly Tournament",status:"active",created_by:user.id},{onConflict:"team_id,cycle_start"}).select("id").single();
      if(cycleErr||!cycle) {setConnection("Signed in · cycle sync needs review");return;}
      const rows=Object.entries(matches).filter(([key])=>key.startsWith(`${week}-D`)).flatMap(([key,m])=>{const mt=key.match(/-D(\d+)-M(\d+)$/);return mt?[{cycle_id:cycle.id,team_id:team.id,match_day:Number(mt[1]),match_number:Number(mt[2]),placement:m.placement,kills:m.kills,points:(m.placement===1?12:m.placement===2?9:m.placement===3?8:m.placement===4?7:m.placement===5?6:m.placement===6?5:m.placement===7?4:m.placement===8?3:m.placement===9?2:m.placement===10?1:0)+m.kills,status:"draft",recorded_by:user.id}]:[]});
      if(rows.length){const {error}=await supabase.from("tournament_matches").upsert(rows,{onConflict:"cycle_id,match_day,match_number"});if(error)throw error;}
      if(!cancelled)setConnection("Signed in · cloud sync active");
    } catch {if(!cancelled)setConnection("Signed in · sync retry needed");} })();
    return()=>{cancelled=true};
  },[signedIn,team?.id,team?.membership_role,matches,week,matchesHydratedKey]);
  useEffect(()=>{ if(!supabase||!signedIn||!team)return; let cancelled=false; (async()=>{ try { const start=weekMonday(week); const {data:cycle}=await supabase.from("tournament_cycles").select("id").eq("team_id",team.id).eq("cycle_start",start).maybeSingle(); if(!cycle){if(!cancelled){setSharedMatches([]);setMatchesHydratedKey(`${team.id}:${week}`);}return;} const {data,error}=await supabase.from("tournament_matches").select("match_day,match_number,placement,kills,points,status").eq("cycle_id",cycle.id).order("match_day").order("match_number"); if(error)throw error; if(!cancelled){setSharedMatches(data||[]);setMatches(prev=>({...prev,...Object.fromEntries((data||[]).map(row=>[`${week}-D${row.match_day}-M${row.match_number}`,{placement:row.placement??12,kills:row.kills??0}]))}));setMatchesHydratedKey(`${team.id}:${week}`);}}catch(e){if(!cancelled)setNotice(e instanceof Error?e.message:"Shared scoreboard unavailable.");} })(); return()=>{cancelled=true}; },[signedIn,team?.id,week]);
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
  useEffect(()=>{if(!supabase||!signedIn||!team)return;let cancelled=false;(async()=>{try{const {data,error}=await supabase.from("training_session_notes").select("notes").eq("team_id",team.id).eq("note_date",trainingDate).maybeSingle();if(error)throw error;if(!cancelled)setCloudSessionNotes(data?.notes||"");}catch(e){if(!cancelled)setNotice(e instanceof Error?e.message:"Cloud session notes unavailable.");}})();return()=>{cancelled=true};},[signedIn,team?.id,trainingDate]);
  useEffect(()=>{if(!supabase||!signedIn||!team)return;let cancelled=false;(async()=>{try{const {data,error}=await supabase.from("daily_scores").select("id,player_id,score_date,communication,coordination,decision_making,role_execution,map_awareness,total,notes,improvement_target").eq("team_id",team.id).order("score_date",{ascending:false}).limit(100);if(error)throw error;if(!cancelled)setEvalHistory(data||[]);}catch(e){if(!cancelled)setNotice(e instanceof Error?e.message:"Evaluation history unavailable.");}})();return()=>{cancelled=true};},[signedIn,team?.id]);
  const saveEvaluation=async()=>{if(!supabase||!team||!signedIn){setNotice("Sign in and join a team to save evaluations in cloud.");return;}try{const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Session expired.");const {error}=await supabase.from("daily_scores").insert({team_id:team.id,score_date:evalDate,player_id:evalPlayer,evaluator_id:user.id,...evalScores,notes:evalNotes.trim()||null,improvement_target:evalTarget.trim()||null});if(error)throw error;const {data,error:he}=await supabase.from("daily_scores").select("id,player_id,score_date,communication,coordination,decision_making,role_execution,map_awareness,total,notes,improvement_target").eq("team_id",team.id).order("score_date",{ascending:false}).limit(100);if(he)throw he;setEvalHistory(data||[]);setNotice("Player evaluation saved to squad cloud.");}catch(e){setNotice(e instanceof Error?e.message:"Evaluation save failed.");}};
  const saveCloudTraining = async (activity:string,done:boolean) => {setCloudTraining(p=>({...p,[activity]:done}));if(!supabase||!team||!signedIn)return;try{const {data:{user}}=await supabase.auth.getUser();if(!user)return;const {error}=await supabase.from("training_log").upsert({team_id:team.id,log_date:trainingDate,activity,done,updated_by:user.id},{onConflict:"team_id,log_date,activity"});if(error)throw error;setNotice("Training checklist synced for the squad.");}catch(e){setNotice(e instanceof Error?e.message:"Cloud training save failed.");}};
  const saveSessionNotes = async () => { if(!supabase||!team||!signedIn)return; try { const {data:{user}}=await supabase.auth.getUser(); if(!user)throw new Error("Session expired."); const {error}=await supabase.from("training_session_notes").upsert({team_id:team.id,note_date:trainingDate,notes:cloudSessionNotes.trim(),updated_by:user.id},{onConflict:"team_id,note_date"}); if(error)throw error; setNotice("Session notes saved to squad cloud."); } catch(e) { setNotice(e instanceof Error?e.message:"Session notes cloud save failed."); } };
  useEffect(() => {
    const client = supabase;
    if (!client || !signedIn || !team) return;
    let active = true;
    const channel = client.channel(`squad-os-${team.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tournament_matches", filter: `team_id=eq.${team.id}` }, async () => {
        const start = weekMonday(week);
        const { data: cycle } = await client.from("tournament_cycles").select("id").eq("team_id", team.id).eq("cycle_start", start).maybeSingle();
        if (!cycle) { if (active) setSharedMatches([]); return; }
        const { data } = await client.from("tournament_matches").select("match_day,match_number,placement,kills,points,status").eq("cycle_id", cycle.id).order("match_day").order("match_number");
        if (active) setSharedMatches(data || []);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "tournament_cycles", filter: `team_id=eq.${team.id}` }, async () => {
        const start = weekMonday(week);
        const { data: cycle } = await client.from("tournament_cycles").select("id").eq("team_id", team.id).eq("cycle_start", start).maybeSingle();
        if (!cycle) { if (active) setSharedMatches([]); return; }
        const { data } = await client.from("tournament_matches").select("match_day,match_number,placement,kills,points,status").eq("cycle_id", cycle.id).order("match_day").order("match_number");
        if (active) setSharedMatches(data || []);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "training_log", filter: `team_id=eq.${team.id}` }, async () => {
        const { data } = await client.from("training_log").select("activity,done").eq("team_id", team.id).eq("log_date", trainingDate);
        if (active) setCloudTraining(Object.fromEntries((data || []).map(x => [x.activity, !!x.done])));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "training_session_notes", filter: `team_id=eq.${team.id}` }, async () => {
        const { data } = await client.from("training_session_notes").select("notes").eq("team_id", team.id).eq("note_date", trainingDate).maybeSingle();
        if (active) setCloudSessionNotes(data?.notes || "");
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_scores", filter: `team_id=eq.${team.id}` }, async () => {
        const { data } = await client.from("daily_scores").select("id,player_id,score_date,communication,coordination,decision_making,role_execution,map_awareness,total,notes,improvement_target").eq("team_id", team.id).order("score_date", { ascending: false }).limit(100);
        if (active) setEvalHistory(data || []);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "player_drill_assignments", filter: `team_id=eq.${team.id}` }, () => {
        if (active) loadAssignments().catch(e => setNotice(e.message));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "team_members", filter: `team_id=eq.${team.id}` }, () => {
        if (active) loadTeam().catch(e => setNotice(e instanceof Error ? e.message : "Team roster refresh failed."));
      })
      .subscribe(status => {
        if (active && status === "SUBSCRIBED") setConnection("Signed in · live squad sync active");
      });
    return () => { active = false; void client.removeChannel(channel); };
  }, [signedIn, team?.id, week, trainingDate]);

  const analyticsMatches = signedIn && team ? sharedMatches.filter(m=>m.placement!==null || m.kills>0) : Object.values(matches);
  const totalMatches = analyticsMatches.length;
  const points = analyticsMatches.reduce((sum, m) => sum + (m.placement === 1 ? 12 : m.placement === 2 ? 9 : m.placement === 3 ? 8 : m.placement === 4 ? 7 : m.placement === 5 ? 6 : m.placement === 6 ? 5 : m.placement === 7 ? 4 : m.placement === 8 ? 3 : m.placement === 9 ? 2 : m.placement === 10 ? 1 : 0) + m.kills, 0);
  const filteredPlayers = useMemo(() => players.filter(p => (p.name + p.role).toLowerCase().includes(query.toLowerCase())), [players, query]);
  const saveMatch = (slot: string, field: "placement" | "kills", value: number) => {
    setMatches(prev => ({ ...prev, [slot]: { placement: prev[slot]?.placement ?? 12, kills: prev[slot]?.kills ?? 0, [field]: value } }));
  };
  const addPlayer = () => {
    if (!newName.trim() || players.length >= 10) return;
    setPlayers(prev => [...prev, { id: "P" + (prev.length + 1), name: newName.trim(), role: newRole, status: "Active" }]);
    setNewName(""); setNotice("Player added to this device.");
  };
  const nav: Section[] = ["Overview", "Tournament", "Training", "Players", "Evaluation", "Assignments", "Analytics", "Settings"];
  const onboarding=!signedIn||!team;
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">S</div><div className="brand-copy"><span className="brand-name">SQUAD OS</span><span className="brand-caption">TEAM OPERATIONS</span></div>
        <div className="sidebar-divider"/>{!onboarding&&<><div className="nav-label">WORKSPACE</div>
        {nav.map(n => <button key={n} className={"nav-item "+(section===n?"nav-item-active":"nav-item-muted")} onClick={()=>setSection(n)}><span className="nav-dot"/>{n}</button>)}
        <div className="sidebar-bottom">SQUAD OS · WORKSPACE</div></>}
      </aside>
      <section className="main-panel">
        <header className="topbar"><div className="breadcrumb">WORKSPACE <span>/</span> {section.toUpperCase()}</div><div className="system-status"><i/> {connection.toUpperCase()}</div></header>
        <div className="content">
          {onboarding?<>
            {notice&&<div className="notice auth-notice" role="status"><span>{notice}</span><button onClick={()=>setNotice("")} aria-label="Dismiss message">×</button></div>}
            <section className="connection-panel" style={{display:"block",maxWidth:680}}>
              {recoveryMode?<><h2>Set a new password</h2><div className="auth-card"><div className="auth-fields"><p className="auth-hint">Email verified. Choose a new password. Never share it by email.</p><label className="auth-field"><span>NEW PASSWORD</span><input type={showPassword?"text":"password"} autoComplete="new-password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="At least 8 characters"/></label><label className="auth-show"><input type="checkbox" checked={showPassword} onChange={e=>setShowPassword(e.target.checked)}/> Show password</label><button className="primary-button auth-submit" disabled={newPassword.length<8||recoveryBusy} onClick={saveRecoveredPassword}>Save new password →</button></div></div></>:recoveryStep==="otp"?<><h2>Verify email</h2><div className="auth-card"><div className="auth-fields"><p className="auth-hint">Enter the 6-digit code sent to {recoveryEmail}. It expires soon.</p><label className="auth-field"><span>EMAIL OTP</span><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={recoveryOtp} onChange={e=>setRecoveryOtp(e.target.value.replace(/\\D/g,"").slice(0,6))} placeholder="000000"/></label><button className="primary-button auth-submit" disabled={recoveryOtp.length!==6||recoveryBusy} onClick={verifyRecoveryOtp}>{recoveryBusy?"Verifying…":"Verify code →"}</button><button className="text-button" disabled={recoveryBusy} onClick={requestPasswordReset}>Resend code</button><button className="text-button" onClick={()=>{setRecoveryStep("email");setRecoveryOtp("");setNotice("");}}>Use another email</button></div></div></>:!signedIn?<><h2>{authMode==="signup"?"Create account":"Sign in"}</h2><div className="auth-card">
                <div className="auth-switch"><button className={authMode==="signup"?"active":""} onClick={()=>{setAuthMode("signup");setNotice("");}}>Create account</button><button className={authMode==="signin"?"active":""} onClick={()=>{setAuthMode("signin");setNotice("");}}>Sign in</button></div>
                <div className="auth-fields">
                  <label className="auth-field"><span>{authMode==="signin"?"USERNAME OR GMAIL":"USERNAME"}</span><input autoComplete="username" type="text" value={sessionUsername} onChange={e=>setSessionUsername(authMode==="signup"?e.target.value.toLowerCase().replace(/[^a-z0-9.-]/g,"").slice(0,24):e.target.value.trim().slice(0,254))} placeholder={authMode==="signin"?"Your username or Gmail":"3–24 characters"}/></label>
                  <label className="auth-field"><span>PASSWORD</span><input autoComplete={authMode==="signup"?"new-password":"current-password"} type={showPassword?"text":"password"} value={sessionPassword} onChange={e=>setSessionPassword(e.target.value)} placeholder={authMode==="signup"?"Create password (8+ characters)":"Your password"}/></label>
                  <label className="auth-show"><input type="checkbox" checked={showPassword} onChange={e=>setShowPassword(e.target.checked)}/> Show password</label>
                  <button className="primary-button auth-submit" disabled={!sessionUsername.trim()||!sessionPassword} onClick={authMode==="signup"?signUp:signIn}>{authMode==="signup"?"Create account":"Sign in"} <span>→</span></button>
                  {authMode==="signin"&&<div className="auth-reset"><label className="auth-field"><span>REGISTERED EMAIL FOR RECOVERY</span><input type="email" autoComplete="email" value={recoveryEmail} onChange={e=>setRecoveryEmail(e.target.value)} placeholder="Enter account email"/></label><button className="text-button" disabled={recoveryBusy} onClick={requestPasswordReset}>{recoveryBusy?"Sending OTP…":"Forgot password? Send OTP"}</button></div>}
                  {authMode==="signup"&&<p className="auth-foot">Existing accounts can sign in with username or Gmail. Use the Gmail reset link if you no longer know the password.</p>}
                </div><div className="auth-foot">SQUAD OS · Username/Gmail + password</div></div></>:<>
                <div className="team-onboarding">
                  <div className="eyebrow">STEP 02 · TEAM SETUP</div>
                  {teamScreen==="choice" ? <>
                    <div className="team-hero">
                      <span className="team-step">ACCOUNT READY</span>
                      <h2>Choose your team path.</h2>
                      <p>Your login is complete. Now create a new squad or join one that already exists. These are separate steps and separate screens.</p>
                    </div>
                    <div className="team-choice-grid">
                      <button className="team-choice-card" onClick={()=>{setTeamScreen("create");setNotice("");}}>
                        <span className="team-choice-icon">＋</span>
                        <span className="eyebrow">START A NEW SQUAD</span>
                        <strong>Create New Team</strong>
                        <small>Set up your team space and become its owner.</small>
                        <span className="team-choice-action">Continue <b>→</b></span>
                      </button>
                      <button className="team-choice-card" onClick={()=>{setTeamScreen("join");setNotice("");}}>
                        <span className="team-choice-icon">↗</span>
                        <span className="eyebrow">ALREADY HAVE A SQUAD?</span>
                        <strong>Join Existing Team</strong>
                        <small>Enter the invite code shared by your team owner.</small>
                        <span className="team-choice-action">Continue <b>→</b></span>
                      </button>
                    </div>
                    <div className="team-onboarding-footer"><span>Signed in as <b>{sessionUsername}</b></span><button className="text-button" onClick={signOut}>Sign out</button></div>
                  </> : teamScreen==="create" ? <>
                    <button className="text-button team-back" onClick={()=>{setTeamScreen("choice");setNotice("");}}>← Back to team options</button>
                    <div className="team-hero"><span className="team-step">TEAM SETUP · 01 / 02</span><h2>Create your team.</h2><p>Enter the team identity. An invite code will be generated after successful creation.</p></div>
                    <div className="team-form-card">
                      <div className="team-logo-picker">
                        <div className="team-logo-preview" aria-label="Team logo preview">{teamLogoPreview?<img src={teamLogoPreview} alt="Selected team logo"/>:<span className="team-logo-letter">{(teamName.trim()[0]||"T").toUpperCase()}</span>}<span className="logo-orbit"></span></div>
                        <div className="team-logo-copy"><span className="eyebrow">TEAM EMBLEM · OPTIONAL</span><strong>{teamLogoFile?"Custom emblem selected":"Auto-generated emblem"}</strong><small>Upload a square image from your gallery, or leave it blank to use a stylized team initial.</small><label className="team-upload-button" htmlFor="team-logo-file">＋ Choose from Gallery</label><input id="team-logo-file" className="team-file-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>5*1024*1024){setNotice("Logo must be 5 MB or smaller.");e.target.value="";return;}setTeamLogoFile(f);setTeamLogoPreview(URL.createObjectURL(f));}}/><button className="text-button" type="button" onClick={()=>{setTeamLogoFile(null);setTeamLogoPreview("");}}>Use generated emblem</button></div>
                      </div>
                      <label className="auth-field"><span>TEAM NAME <b className="required-mark">*</b></span><input value={teamName} onChange={e=>setTeamName(e.target.value)} placeholder="e.g. NOVA ESPORTS" maxLength={50}/></label>
                      <label className="auth-field"><span>TEAM DESCRIPTION · OPTIONAL</span><textarea value={teamDescription} onChange={e=>setTeamDescription(e.target.value)} placeholder="Short description of your squad (optional)" rows={3}/></label>
                      <div className="team-create-hint"><span aria-hidden="true">✦</span> Team name is the only required field. Logo and description are optional.</div>
                      <button className="primary-button auth-submit" disabled={teamBusy||teamName.trim().length<2} onClick={createTeam}>{teamBusy?"Creating team…":"Create Team →"}</button>
                    </div>
                  </> : <>
                    <button className="text-button team-back" onClick={()=>{setTeamScreen("choice");setNotice("");}}>← Back to team options</button>
                    <div className="team-hero"><span className="team-step">TEAM SETUP · 02 / 02</span><h2>Join your squad.</h2><p>Use the invite code provided by your team owner. You will join that team's shared workspace.</p></div>
                    <div className="team-form-card">
                      <label className="auth-field"><span>YOUR IN-GAME NAME / IGN</span><input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Enter your Free Fire IGN" maxLength={32}/></label>
                      <label className="auth-field"><span>TEAM INVITE CODE</span><input value={teamCode} onChange={e=>setTeamCode(e.target.value.toUpperCase().replace(/\s/g,""))} placeholder="Enter invite code" maxLength={8} autoCapitalize="characters"/></label>
                      <button className="primary-button auth-submit" disabled={teamBusy||!displayName.trim()||teamCode.trim().length<6} onClick={joinTeam}>{teamBusy?"Joining team…":"Join Existing Team →"}</button>
                    </div>
                  </>}
                </div>
              </>}
            </section>
          </>:<>
          <div className="eyebrow">SQUAD MANAGEMENT PLATFORM · M3</div>

          <h1>{section==="Overview" ? <>Control the squad.<br/><span>Track every week.</span></> : <>{section}.<br/><span>Team operations.</span></>}</h1>
          <p className="intro">A focused workspace for tournament results, player development and team performance. Match entries and training notes are browser-local; team membership and weekly match rows use Supabase.</p>
          {notice && <div className="notice">{notice}<button onClick={()=>setNotice("")}>×</button></div>}
          {section==="Overview" && <>
            <div className="section-heading"><div><div className="eyebrow">AT A GLANCE</div><h2>Squad overview</h2></div><span className="phase-pill">M2 / INTERACTIVE</span></div>            <section className="connection-panel"><div><div className="eyebrow">SUPABASE AUTH</div><h3>{signedIn ? "Cloud account connected" : "Sign in to sync"}</h3><p>{signedIn ? sessionUsername+" · squad cloud sync is enabled" : "Username/password account access. Local progress remains available offline."}</p></div>{signedIn?<button className="primary-button" onClick={signOut}>Sign out</button>:<div className="add-form"><input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Display / IGN name"/><input type="text" autoComplete="username" value={sessionUsername} onChange={e=>setSessionUsername(e.target.value)} placeholder="Email or IGN"/><input type="password" value={sessionPassword} onChange={e=>setSessionPassword(e.target.value)} placeholder="Password"/><button className="primary-button" onClick={signIn}>Sign in</button><button className="secondary-button" onClick={signUp}>Create account</button></div>}</section>

            {signedIn && <div className="add-form" style={{marginBottom:12}}><input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Your IGN / display name"/><button className="secondary-button" onClick={async()=>{if(!supabase)return;const {error}=await supabase.rpc("set_display_name",{p_name:displayName.trim()});setNotice(error?error.message:"Display name saved.");}}>Save IGN</button></div>}
            <section className="connection-panel" style={{display:"block",marginBottom:22}}>
              <div className="eyebrow">TEAM COLLABORATION · SUPABASE</div>
              {team ? <>
                <div className="team-live-header"><div className="team-live-logo">{team.avatar_url?<img src={team.avatar_url} alt={team.team_name+" logo"}/>:<span>{team.team_name.slice(0,1).toUpperCase()}</span>}</div><div><h3>{team.team_name} <span className="active-tag">{team.membership_role}</span></h3><p>Squad identity · Invite code <strong style={{letterSpacing:2,fontSize:18}}>{team.invite_code}</strong></p></div><button className="secondary-button" onClick={async()=>{try{await navigator.clipboard.writeText(team.invite_code);setNotice("Invite code copied.");}catch{setNotice("Copy failed. Select the invite code manually.");}}}>Copy Code</button></div>
                <div className="player-list">{teamMembers.map(m=><article className="player-row" key={m.id}><span className="player-id">{m.player_number?"P"+m.player_number:"—"}</span><div><b>{m.display_name}</b><small>{m.membership_role} · {m.assigned_role||"Role not assigned"}</small></div>{team.membership_role==="owner"&&m.membership_role!=="owner"?<div className="add-form"><select defaultValue={String(m.player_number||1)} onChange={e=>assignMember(m.id,Number(e.target.value),m.assigned_role||"Player")}>{[1,2,3,4,5].map(n=><option value={n} key={n}>P{n}</option>)}</select><select defaultValue={m.assigned_role||"Player"} onChange={e=>assignMember(m.id,Number(m.player_number||0),e.target.value)}>{["Primary Rusher","Secondary Rusher","Third Rusher / Flank","Sniper / IGL","Substitute","Player"].map(x=><option key={x}>{x}</option>)}</select></div>:null}</article>)}</div>
              </>:<>
                <h3 style={{marginTop:8}}>Create a team or join with code</h3><p>Team owner creates one squad. Players use the invite code from their own accounts.</p>
                <p className="team-separate-page-note">Create or join a squad from the dedicated Team Setup screen above. Team creation is not embedded here.</p>
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
            <div className="match-grid">{Array.from({length:6},(_,i)=>{const key=week+"-D"+day+"-M"+(i+1);const remote=sharedMatches.find(x=>x.match_day===day&&x.match_number===i+1);const m=(signedIn&&team&&remote)?{placement:remote.placement??12,kills:remote.kills??0}:(matches[key]||{placement:12,kills:0});return <article className="match-card" key={key}><div className="card-index">MATCH 0{i+1}</div><h3>Match {i+1}</h3><label>Placement<select value={m.placement} disabled={!!team&&!["owner","coach"].includes(team.membership_role)} onChange={e=>saveMatch(key,"placement",Number(e.target.value))}>{Array.from({length:12},(_,j)=><option key={j} value={j+1}>{j+1===12?"12+ / Other":j+1}</option>)}</select></label><label>Kills<input type="number" min="0" value={m.kills} disabled={!!team&&!["owner","coach"].includes(team.membership_role)} onChange={e=>saveMatch(key,"kills",Math.max(0,Number(e.target.value)))}/></label></article>})}</div>
            {signedIn&&team&&<section className="connection-panel" style={{display:"block",marginTop:18}}><div className="eyebrow">TEAM CLOUD SCOREBOARD</div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}><h3>Shared results · {sharedMatches.filter(m=>m.placement!=null).length}/42 scored slots</h3><button className="secondary-button" onClick={refreshSharedMatches}>Refresh</button></div><p>Team-wide weekly match ledger. Blank slots are seeded; scores sync from the owner/coach browser.</p><div className="player-list">{sharedMatches.map(m=><article className="player-row" key={m.match_day+"-"+m.match_number}><span className="player-id">D{m.match_day} M{m.match_number}</span><div><b>Place {m.placement??"—"} · {m.kills??0} kills · {m.points??0} pts</b><small>{m.status}</small></div></article>)}</div></section>}
            <p className="footer-note">Prototype scoring: placement 1–10 = 12,9,8,7,6,5,4,3,2,1 points; 11/12 = 0. Add kills. Not an official tournament scoring preset.</p>
          </>}
          {section==="Training" && <>
            <div className="section-heading"><div><div className="eyebrow">PRACTICE BLOCK</div><h2>Team drill checklist</h2></div><span className="phase-pill">{signedIn&&team?"SQUAD CLOUD":"LOCAL CHECKLIST"}</span></div>
            <div className="toolbar"><label>Training date <input type="date" value={trainingDate} onChange={e=>setTrainingDate(e.target.value)}/></label><span className="phase-pill">{signedIn&&team?"SQUAD CLOUD":"LOCAL ONLY"}</span></div><div className="drill-list">{["IGL call clarity · short and actionable","Trade spacing · pair stays connected","Rotation timing · move before pressure","Reset discipline · regroup before re-entry","Post-match review · one fix per match"].map((d,i)=><label className="drill-row" key={d}><input type="checkbox" checked={signedIn&&team?!!cloudTraining[d]:!!drillDone[d]} onChange={e=>{if(signedIn&&team)saveCloudTraining(d,e.target.checked);else setDrillDone(p=>({...p,[d]:e.target.checked}));}}/><span><b>0{i+1} / {d}</b><small>Mark only after the team completes and reviews it.</small></span></label>)}</div>
            <label className="notes-label">Session notes<textarea value={signedIn&&team?cloudSessionNotes:(notes.training||"")} onChange={e=>signedIn&&team?setCloudSessionNotes(e.target.value):setNotes(p=>({...p,training:e.target.value}))} placeholder="Calls missed, timing issue, next session target…"/></label>{signedIn&&team&&<button className="primary-button" onClick={saveSessionNotes}>Save session notes to cloud</button>}
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
          {section==="Assignments" && <>
            <div className="section-heading"><div><div className="eyebrow">INDIVIDUAL PRACTICE</div><h2>Drill assignments</h2></div><span className="phase-pill">{assignmentRows.filter(x=>x.status==="completed").length}/{assignmentRows.length} DONE</span></div>
            <section className="connection-panel" style={{display:"block"}}>
              {!signedIn||!team?<p>Sign in and join/create a squad to use cloud assignments.</p>:!["owner","coach"].includes(team.membership_role)?<p>Only the team owner or coach can assign new drills. You can update your own assigned tasks below.</p>:<>
              <div className="toolbar"><label>Player<select value={assignmentPlayer} onChange={e=>setAssignmentPlayer(e.target.value)}><option value="">Choose player</option>{teamMembers.filter(m=>m.status==="active").map(m=><option key={m.user_id} value={m.user_id}>{m.display_name} · P{m.player_number||"—"}</option>)}</select></label><label>Due date<input type="date" value={assignmentDate} onChange={e=>setAssignmentDate(e.target.value)}/></label></div>
              <label className="notes-label">Drill title<input value={assignmentTitle} onChange={e=>setAssignmentTitle(e.target.value)}/></label><label className="notes-label">Exact task<textarea value={assignmentDesc} onChange={e=>setAssignmentDesc(e.target.value)}/></label>
              <button className="primary-button" onClick={createAssignment} disabled={!assignmentPlayer||!assignmentTitle.trim()}>Assign drill</button>
              </>}
            </section>
            <section className="connection-panel" style={{display:"block",marginTop:18}}><div className="eyebrow">SQUAD TASK BOARD · {assignmentRows.length}</div><div className="player-list">{assignmentRows.map(a=><article className="player-row" key={a.id}><span className="player-id">{a.due_date}</span><div><b>{teamMembers.find(m=>m.user_id===a.player_id)?.display_name||a.player_id.slice(0,8)} · {a.drill_title}</b><small>{a.drill_description}</small><small>Status: {a.status}</small>{a.completion_note&&<small>{a.completion_note}</small>}</div>{a.player_id===sessionUserId||!!team&&["owner","coach"].includes(team.membership_role)?<button className="secondary-button" onClick={()=>updateAssignment(a.id,a.status==="completed"?"assigned":"completed")}>{a.status==="completed"?"Undo":"Complete"}</button>:null}</article>)}</div></section>
          </>}
          {section==="Settings" && <>
            <div className="section-heading"><div><div className="eyebrow">SQUAD CONFIGURATION</div><h2>Settings</h2></div><span className="phase-pill">TEAM PROFILE</span></div>
            {!signedIn||!team?<section className="connection-panel"><h3>Team profile unavailable</h3><p>Sign in and create or join a team first.</p></section>:<>
              <section className="connection-panel team-profile-settings" style={{display:"block"}}>
                <div className="eyebrow">TEAM PROFILE</div>
                <div className="team-live-header"><div className="team-live-logo">{team.avatar_url?<img src={team.avatar_url} alt={team.team_name+" logo"}/>:<span>{team.team_name.slice(0,1).toUpperCase()}</span>}</div><div><h3>{team.team_name}</h3><p>Team logo · square 1:1 format</p></div></div>
                <div className="team-logo-settings-row"><div className="team-logo-preview settings-logo-preview">{teamLogoPreview?<img src={teamLogoPreview} alt="Crop preview" style={{objectFit:"cover",objectPosition:teamLogoCropX+"% "+teamLogoCropY+"%"}}/>:<span className="team-logo-letter">{team.team_name.slice(0,1).toUpperCase()}</span>}<span className="logo-orbit"/></div>
                  <div className="team-logo-copy"><strong>{teamLogoFile?"New logo selected":"Current team logo"}</strong><small>Tap + to choose an image from your phone gallery. Crop is locked to a 1:1 square (512 × 512 output).</small>
                    <label className="team-upload-button" htmlFor="settings-team-logo">＋</label><input id="settings-team-logo" className="team-file-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>5*1024*1024){setNotice("Logo must be 5 MB or smaller.");e.target.value="";return;}setTeamLogoFile(f);setTeamLogoPreview(URL.createObjectURL(f));setTeamLogoCropX(50);setTeamLogoCropY(50);}}/>
                  </div></div>
                {teamLogoFile&&<div className="crop-controls"><label>Horizontal crop <input type="range" min="0" max="100" value={teamLogoCropX} onChange={e=>setTeamLogoCropX(Number(e.target.value))}/></label><label>Vertical crop <input type="range" min="0" max="100" value={teamLogoCropY} onChange={e=>setTeamLogoCropY(Number(e.target.value))}/></label><button className="secondary-button" onClick={()=>{setTeamLogoFile(null);setTeamLogoPreview("");}}>Cancel selection</button></div>}
                <button className="primary-button" disabled={!teamLogoFile||teamBusy} onClick={async()=>{if(!supabase||!teamLogoFile)return;setTeamBusy(true);try{const cropped=await makeSquareTeamLogo(teamLogoFile,teamLogoCropX,teamLogoCropY);const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Sign in again to update the logo.");const path=user.id+"/"+team.id+".jpg";const {error:up}=await supabase.storage.from("team-avatars").upload(path,cropped,{upsert:true,contentType:"image/jpeg"});if(up)throw up;const {data:pub}=supabase.storage.from("team-avatars").getPublicUrl(path);const {error:av}=await supabase.from("teams").update({avatar_url:pub.publicUrl+"?v="+Date.now()}).eq("id",team.id);if(av)throw av;await loadTeam();setTeamLogoFile(null);setTeamLogoPreview("");setNotice("Team logo updated.");}catch(e){setNotice(e instanceof Error?e.message:"Logo update failed.");}finally{setTeamBusy(false);}}}>{teamBusy?"Saving logo…":"Save Team Logo"}</button>
              </section></>}
          </>}
          {section==="Analytics" && <>
            <div className="section-heading"><div><div className="eyebrow">PERFORMANCE SNAPSHOT</div><h2>Current week</h2></div><span className="phase-pill">BROWSER DATA</span></div>
            <div className="foundation-grid">{[["Recorded matches",totalMatches],["Placement + kills points",points],["Average kills",totalMatches?(analyticsMatches.reduce((s,m)=>s+m.kills,0)/totalMatches).toFixed(1):"0.0"],["Roster size",players.length]].map(([a,b],i)=><article className="foundation-card" key={String(a)}><div className="card-index">0{i+1}</div><div className="card-label">{a}</div><div className="card-value">{b}</div></article>)}</div>
            <section className="connection-panel"><div><div className="eyebrow">ANALYTICS SOURCE</div><h3>{signedIn&&team?"Shared squad records":"This device’s local records"}</h3><p>{signedIn&&team?"Metrics are calculated from the shared tournament match ledger in Supabase.":"Sign in and join your squad to see shared team tournament metrics."}</p></div></section>
          </>}
          <footer className="footer-note">M3 · CLOUD MATCHES + TRAINING + EVALUATION + PLAYER DRILLS</footer>
          </>}
        </div>
      </section>
    </main>
  );
}
