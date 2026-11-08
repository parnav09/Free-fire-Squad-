import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import useAccessibleDialog from "./app/useAccessibleDialog";
import WorkspaceShell from "./app/WorkspaceShell";
import type { Section } from "./app/types";
import { makeSquareTeamLogo } from "./app/foundation-utils";
import useTeamLocalData from "./app/useTeamLocalData";

const AnalyticsSection = lazy(() => import("./components/AnalyticsSection"));


type SupabaseInstance = NonNullable<typeof import("./lib/supabase/client")["supabase"]>;

export default function App() {
  const [supabase, setSupabase] = useState<SupabaseInstance | null>(null);
  const [supabaseReady, setSupabaseReady] = useState(false);
  const matchSyncTimerRef = useRef<number | null>(null);
  const pendingMatchSyncRef = useRef<(() => Promise<void>) | null>(null);
  const pendingMatchScopeRef = useRef("");
  const activeMatchScopeRef = useRef("");
  const [section, setSection] = useState<Section>("Overview");
  const [notice, setNotice] = useState("");
  const [sharedMatches, setSharedMatches] = useState<Array<{match_day:number;match_number:number;placement:number|null;kills:number;points:number|null;status:string}>>([]);
  const [matchesHydratedKey, setMatchesHydratedKey] = useState("");
  const [connection, setConnection] = useState("Checking…");
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
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
  const [team, setTeam] = useState<{id:string;membership_id:string;team_name:string;invite_code:string;avatar_url?:string|null;membership_role:string;player_number:number|null;assigned_role:string|null}|null>(null);
  const [teamMembers, setTeamMembers] = useState<Array<{id:string;user_id:string;display_name:string;player_number:number|null;assigned_role:string|null;membership_role:string;status:string}>>([]);
  const [teamChoices,setTeamChoices]=useState<Array<{id:string;team_name:string;membership_role:string}>>([]);
  const [teamBusy, setTeamBusy] = useState(false);
  const [confirmAction,setConfirmAction]=useState<"logout"|"leave"|"import"|null>(null);
  const [leaveTransferTo,setLeaveTransferTo]=useState("");
  const [backupFile,setBackupFile]=useState<File|null>(null);
  const [backupBusy,setBackupBusy]=useState(false);
  const [backupStatus,setBackupStatus]=useState("");
  const [joinRequests,setJoinRequests]=useState<Array<{id:string;user_id:string;requested_at:string;display_name:string;status:string}>>([]);
  const [requestStatus,setRequestStatus]=useState<string>("");
  const [requestSlot,setRequestSlot]=useState<Record<string,string>>({});
  const [requestRole,setRequestRole]=useState<Record<string,string>>({});
  const [iglUserId,setIglUserId]=useState<string>("");
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
  const { players, setPlayers, week, setWeek, day, setDay, matches, setMatches, drillDone, setDrillDone, notes, setNotes } = useTeamLocalData(team?.id);
  useEffect(() => {
    let active = true;
    import("./lib/supabase/client")
      .then(({ supabase: client }) => {
        if (active) {
          setSupabase(client);
          setSupabaseReady(true);
        }
      })
      .catch(() => {
        if (active) setConnection("Offline");
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    if (!supabase) {
      if (supabaseReady) setConnection("Not configured");
      return;
    }
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
  }, [supabase, supabaseReady]);

  const loadAssignments=async()=>{if(!supabase||!team)return;setConnection("Syncing…");const {data,error}=await supabase.from("player_drill_assignments").select("id,player_id,drill_title,drill_description,due_date,status,completion_note").eq("team_id",team.id).order("due_date",{ascending:false}).limit(100);if(error){setConnection("Signed in · sync retry needed");throw error;}setAssignmentRows(data||[]);setConnection("Signed in · cloud sync active");};
  useEffect(()=>{if(signedIn&&team)loadAssignments().catch(e=>{setConnection("Signed in · sync retry needed");setNotice(e.message);});},[signedIn,team?.id]);
  const createAssignment=async()=>{if(!supabase||!team||!sessionUserId||!["owner","coach"].includes(team.membership_role)||!assignmentPlayer||!assignmentTitle.trim())return;setConnection("Syncing…");const {error}=await supabase.from("player_drill_assignments").insert({team_id:team.id,player_id:assignmentPlayer,assigned_by:sessionUserId,drill_title:assignmentTitle.trim(),drill_description:assignmentDesc.trim(),due_date:assignmentDate});if(error){setConnection("Signed in · sync retry needed");setNotice(error.message);return;}setNotice("Drill assigned.");await loadAssignments();};
  const updateAssignment=async(id:string,status:string)=>{if(!supabase||!team)return;setConnection("Syncing…");const {error}=await supabase.from("player_drill_assignments").update({status,completed_at:status==="completed"?new Date().toISOString():null}).eq("id",id);if(error){setConnection("Signed in · sync retry needed");setNotice(error.message);return;}await loadAssignments();};
  const signIn = async () => {
    if (!supabase) return setNotice("The service is unavailable right now. Please try again later.");
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
    setNotice(sessionError ? sessionError.message : "Signed in successfully.");
  };

  const requestPasswordReset = async () => {
    if (!supabase) return setNotice("The service is unavailable right now. Please try again later.");
    const email=recoveryEmail.trim().toLowerCase(), username=sessionUsername.trim();
    if(!email||!username)return setNotice("Enter username and the recovery email linked to your account.");
    setRecoveryBusy(true);
    const {data,error}=await supabase.functions.invoke("account-recovery",{body:{action:"request",username,email}});
    setRecoveryBusy(false);
    if(error||data?.error)return setNotice(data?.error||"Could not request recovery code.");
    setRecoveryStep("otp");setNotice(data.message||"If details match, OTP has been sent.");
  };

  const verifyRecoveryOtp = async () => {
    if(!supabase)return setNotice("The service is unavailable right now. Please try again later.");
    if(!/^\d{6}$/.test(recoveryOtp))return setNotice("Enter the 6-digit OTP.");
    if(newPassword.length<8||newPassword.length>128)return setNotice("New password must be 8–128 characters.");
    setRecoveryBusy(true);
    const {data,error}=await supabase.functions.invoke("account-recovery",{body:{action:"verify",username:sessionUsername.trim(),email:recoveryEmail.trim().toLowerCase(),otp:recoveryOtp,newPassword}});
    setRecoveryBusy(false);
    if(error||data?.error)return setNotice(data?.error||"Verification failed.");
    setRecoveryMode(false);setRecoveryStep("email");setRecoveryOtp("");setNewPassword("");setSessionPassword("");
    setAuthMode("signin");setNotice("Password updated. Sign in with your username and new password.");
  };

  const saveRecoveredPassword = async () => {
    if (!supabase) return setNotice("The service is unavailable right now. Please try again later.");
    if (newPassword.length < 8 || newPassword.length > 128) return setNotice("New password must be 8–128 characters.");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return setNotice(error.message);
    setRecoveryMode(false); setRecoveryStep("email"); setNewPassword(""); setSessionPassword("");
    setNotice("Password updated. Your account is ready.");
  };

  const signUp = async () => {
    if (!supabase) return setNotice("The service is unavailable right now. Please try again later.");
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
      setNotice("Account setup is unavailable right now. Please try again later.");
      return;
    }
    setSessionUsername(username);
    setDisplayName(username);
    setAuthMode("signin");
    setNotice("Account created. You are signed in.");
  };

  const downloadTeamBackup=async()=>{
    if(!supabase||team?.membership_role!=="owner")return;
    setBackupBusy(true);setBackupStatus("");
    try{
      const {data,error}=await supabase.rpc("get_team_backup_for_team",{p_team_id:team.id});if(error)throw error;
      let logoDataUrl:string|null=null;
      if(team.avatar_url){
        try{const response=await fetch(team.avatar_url);if(response.ok){const imageBlob=await response.blob();if(imageBlob.size<=5*1024*1024){logoDataUrl=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("Could not read team logo."));reader.readAsDataURL(imageBlob);});}}}catch{logoDataUrl=null;}
      }
      const backup={...data,team_logo_data_url:logoDataUrl,local_device_data:{players,week,day,matches,drillDone,notes}};
      const blob=new Blob([JSON.stringify(backup,null,2)],{type:"application/json"});
      const url=URL.createObjectURL(blob);const a=document.createElement("a");
      a.href=url;a.download="SQUAD-OS-"+team.team_name.replace(/[^a-z0-9-_]+/gi,"-")+"-"+new Date().toISOString().slice(0,10)+".json";
      document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
      setBackupStatus("Backup exported successfully. "+(logoDataUrl?"Team logo image is included. ":"Team logo image could not be embedded; the existing logo URL is retained. ")+"Keep the JSON file somewhere safe.");
    }catch(e){setBackupStatus(e instanceof Error?e.message:"Backup export failed.");}
    finally{setBackupBusy(false);}
  };
  const importTeamBackup=async()=>{
    if(!supabase||team?.membership_role!=="owner"||!backupFile)return;
    setBackupBusy(true);setBackupStatus("");
    try{
      const backup=JSON.parse(await backupFile.text());
      if(backup?.format!=="squad-os-team-backup"||backup?.schema_version!==1)throw new Error("This is not a supported SQUAD OS backup file.");
      const {data,error}=await supabase.rpc("restore_team_backup_for_team",{p_backup:backup,p_team_id:team.id});if(error)throw error;
      const local=backup.local_device_data;
      if(local&&Array.isArray(local.players))setPlayers(local.players);
      if(local&&typeof local.week==="string")setWeek(local.week);
      if(local&&Number.isFinite(local.day))setDay(local.day);
      if(local&&local.matches&&typeof local.matches==="object")setMatches(local.matches);
      if(local&&local.drillDone&&typeof local.drillDone==="object")setDrillDone(local.drillDone);
      if(local&&local.notes&&typeof local.notes==="object")setNotes(local.notes);
      if(typeof backup.team_logo_data_url==="string"&&backup.team_logo_data_url.startsWith("data:image/")){
        const imageBlob=await (await fetch(backup.team_logo_data_url)).blob();
        if(!sessionUserId)throw new Error("Sign in again to restore the team logo.");
        const ext=imageBlob.type==="image/png"?"png":imageBlob.type==="image/webp"?"webp":"jpg";
        const logoPath=sessionUserId+"/"+team.id+"."+ext;
        const {error:uploadError}=await supabase.storage.from("team-avatars").upload(logoPath,imageBlob,{upsert:true,contentType:imageBlob.type||"image/jpeg"});if(uploadError)throw uploadError;
        const {data:publicLogo}=supabase.storage.from("team-avatars").getPublicUrl(logoPath);
        const {error:logoUpdateError}=await supabase.from("teams").update({avatar_url:publicLogo.publicUrl+"?v="+Date.now()}).eq("id",team.id);if(logoUpdateError)throw logoUpdateError;
      }
      await loadTeam();await loadAssignments();setBackupFile(null);setConfirmAction(null);
      setBackupStatus("Restore complete. "+(data?.restored_rows??0)+" records restored to this team.");
      setNotice("Team backup restored successfully.");
    }catch(e){setBackupStatus(e instanceof Error?e.message:"Backup import failed.");}
    finally{setBackupBusy(false);}
  };
  const confirmLogout=async()=>{
    if(!supabase)return;setTeamBusy(true);
    try{const {error}=await supabase.auth.signOut();if(error)throw error;setConfirmAction(null);setNotice("Signed out successfully. Your team data remains saved.");}
    catch(e){setNotice(e instanceof Error?e.message:"Logout failed.");}
    finally{setTeamBusy(false);}
  };
  const confirmLeaveTeam=async()=>{
    if(!supabase||!team)return;setTeamBusy(true);
    try{
      const activeOthers=teamMembers.filter(m=>m.status==="active"&&m.user_id!==sessionUserId);
      const transfer=team.membership_role==="owner"&&activeOthers.length?leaveTransferTo||null:null;
      const {data,error}=await supabase.rpc("leave_team_for_team",{p_team_id:team.id,p_new_owner:transfer});if(error)throw error;
      setTeam(null);setTeamMembers([]);setJoinRequests([]);setIglUserId("");setConfirmAction(null);setLeaveTransferTo("");
      setNotice(data?.deletion_scheduled_at?"You left the team. Empty-team deletion is scheduled after the 48-hour recovery window.":"You left the team. Ownership has been transferred where required.");
    }catch(e){setNotice(e instanceof Error?e.message:"Could not leave team.");}
    finally{setTeamBusy(false);}
  };
  const loadTeam = async (preferredTeamId?:string) => {
    if (!supabase) return;
    setConnection("Syncing…");
    const {data:{user}}=await supabase.auth.getUser(); if(!user) {setTeam(null);setTeamMembers([]);setTeamChoices([]);return;}
    const {data:allMemberships,error:allMembershipsError}=await supabase.from("team_members").select("team_id,membership_role").eq("user_id",user.id).eq("status","active");
    if(allMembershipsError)throw allMembershipsError;
    const allTeamIds=(allMemberships||[]).map(m=>m.team_id);
    if(allTeamIds.length){const {data:allTeams,error:allTeamsError}=await supabase.from("teams").select("id,team_name").in("id",allTeamIds);if(allTeamsError)throw allTeamsError;setTeamChoices((allTeams||[]).map(t=>({...t,membership_role:allMemberships?.find(m=>m.team_id===t.id)?.membership_role||"player"})));}else setTeamChoices([]);
    const preferred=preferredTeamId||localStorage.getItem("squad-os-active-team")||"";
    let membershipQuery=supabase.from("team_members").select("id,team_id,user_id,display_name,player_number,assigned_role,membership_role,status").eq("user_id",user.id).eq("status","active");
    if(preferred)membershipQuery=membershipQuery.eq("team_id",preferred);
    let {data:membership,error}=await membershipQuery.limit(1).maybeSingle();
    if(error)throw error;
    if(!membership&&preferred){localStorage.removeItem("squad-os-active-team");const fallback=await supabase.from("team_members").select("id,team_id,user_id,display_name,player_number,assigned_role,membership_role,status").eq("user_id",user.id).eq("status","active").limit(1).maybeSingle();membership=fallback.data;error=fallback.error;if(error)throw error;}
    if(!membership){setTeam(null);setTeamMembers([]);return;}
    localStorage.setItem("squad-os-active-team",membership.team_id);
    const {data:t,error:te}=await supabase.from("teams").select("id,team_name,invite_code,avatar_url").eq("id",membership.team_id).single(); if(te)throw te;
    setTeam({...t,membership_id:membership.id,membership_role:membership.membership_role,player_number:membership.player_number,assigned_role:membership.assigned_role});if(membership.display_name)setDisplayName(membership.display_name);
    const [membersResult,requestsResult,iglResult]=await Promise.all([
      supabase.from("team_members").select("id,user_id,display_name,player_number,assigned_role,membership_role,status").eq("team_id",t.id).order("player_number"),
      supabase.from("team_join_requests").select("id,user_id,requested_at,status").eq("team_id",t.id).eq("status","pending").order("requested_at"),
      supabase.from("team_settings").select("setting_value").eq("team_id",t.id).eq("setting_key","igl_user_id").maybeSingle(),
    ]);
    if(membersResult.error)throw membersResult.error;
    if(requestsResult.error)throw requestsResult.error;
    if(iglResult.error)throw iglResult.error;
    setTeamMembers((membersResult.data||[]).map(x=>({...x,display_name:x.display_name||"Player"})));
    const reqs=requestsResult.data||[];
    const reqIds=reqs.map(q=>q.user_id);
    const {data:rp,error:profilesError}=reqIds.length?await supabase.from("profiles").select("id,display_name").in("id",reqIds):{data:[],error:null};
    if(profilesError)throw profilesError;
    setJoinRequests(reqs.map(q=>({...q,display_name:rp?.find(p=>p.id===q.user_id)?.display_name||"New player"})));
    setIglUserId(String(iglResult.data?.setting_value||""));
    setConnection("Syncing…");
  };
  const createTeam = async () => { if(!supabase||teamName.trim().length<2){setNotice("Team name must be at least 2 characters.");return;} setTeamBusy(true); try { const finalIGN=displayName.trim()||sessionUsername.trim()||"Squad Player"; const {error:ne}=await supabase.rpc("set_display_name",{p_name:finalIGN});if(ne)throw ne; const {data:createdTeamId,error}=await supabase.rpc("create_team",{p_name:teamName.trim(),p_description:teamDescription.trim()||null,p_timezone:"Asia/Kolkata"}); if(error)throw error; if(!createdTeamId)throw new Error("Team was created but its ID was not returned."); localStorage.setItem("squad-os-active-team",createdTeamId); await loadTeam(createdTeamId); if(teamLogoFile&&supabase&&sessionUserId){const ext=teamLogoFile.name.split(".").pop()?.toLowerCase()||"jpg";const path=`${sessionUserId}/${createdTeamId}.${ext}`;const {error:up}=await supabase.storage.from("team-avatars").upload(path,teamLogoFile,{upsert:true,contentType:teamLogoFile.type});if(up)throw up;const {data:pub}=supabase.storage.from("team-avatars").getPublicUrl(path);const {error:av}=await supabase.from("teams").update({avatar_url:pub.publicUrl}).eq("id",createdTeamId);if(av)throw av;await loadTeam(createdTeamId);} setTeamName("");setTeamDescription("");setTeamLogoFile(null);setTeamLogoPreview("");setTeamScreen("choice");setNotice("Team created. Invite code and teammates are now available in Team panel."); } catch(e){setNotice(e instanceof Error?e.message:"Team creation failed.");} finally{setTeamBusy(false);} };
  const joinTeam = async () => { if(!supabase||!teamCode.trim())return; setTeamBusy(true); try { if(!displayName.trim()){throw new Error("Enter your IGN/display name first.");} const {error:ne}=await supabase.rpc("set_display_name",{p_name:displayName.trim()});if(ne)throw ne; const {error}=await supabase.rpc("request_join_team",{p_code:teamCode.trim().toUpperCase()}); if(error)throw error; setTeamCode("");setRequestStatus("Pending owner approval · access activates after slot assignment.");setNotice("Join request sent. Wait for the owner to approve your player slot and role."); } catch(e){setNotice(e instanceof Error?e.message:"Could not join team.");} finally{setTeamBusy(false);} };
  const reviewJoinRequest=async(id:string,approve:boolean)=>{if(!supabase||team?.membership_role!=="owner")return;const slot=Number(requestSlot[id]||0),role=requestRole[id]||"Primary Rusher";if(approve&&(!slot||slot>5)){setNotice("Choose a player slot first.");return;}try{const {error}=await supabase.rpc("review_team_join_request",{p_request:id,p_player:slot,p_role:role,p_approve:approve});if(error)throw error;await loadTeam();setNotice(approve?"Player approved and added to roster.":"Join request declined.");}catch(e){setNotice(e instanceof Error?e.message:"Request review failed.");}};
  const saveIGL=async(userId:string)=>{if(!supabase||team?.membership_role!=="owner")return;try{const {error}=await supabase.from("team_settings").upsert({team_id:team.id,setting_key:"igl_user_id",setting_value:userId,updated_at:new Date().toISOString()},{onConflict:"team_id,setting_key"});if(error)throw error;setIglUserId(userId);setNotice(userId?"IGL designation updated.":"IGL designation cleared.");}catch(e){setNotice(e instanceof Error?e.message:"IGL setting failed.");}};
  const saveOwnerRole=async(slot:number)=>{if(!supabase||team?.membership_role!=="owner"||!team.membership_id)return;const roleBySlot:Record<number,string>={1:"Primary Rusher",2:"Secondary Rusher",3:"Third Rusher",4:"Sniper",5:"Substitute"};const occupied=teamMembers.find(m=>m.status==="active"&&m.player_number===slot&&m.user_id!==sessionUserId);if(occupied){setNotice("That player slot is already occupied. Move or reassign that player first.");return;}try{if(slot===5){const {error:fe}=await supabase.from("team_settings").upsert({team_id:team.id,setting_key:"fifth_player",setting_value:true,updated_at:new Date().toISOString()},{onConflict:"team_id,setting_key"});if(fe)throw fe;}const {error}=await supabase.rpc("assign_member",{p_member:team.membership_id,p_player:slot,p_activate:true});if(error)throw error;const {error:re}=await supabase.from("team_members").update({assigned_role:roleBySlot[slot]}).eq("id",team.membership_id);if(re)throw re;await loadTeam();setNotice("Your player slot and role were updated.");}catch(e){setNotice(e instanceof Error?e.message:"Could not update owner role.");}};
  const assignMember = async (memberId:string, player:number, role:string) => { if(!supabase||team?.membership_role!=="owner")return; try { if(player>=1&&player<=5){const {error}=await supabase.rpc("assign_member",{p_member:memberId,p_player:player,p_activate:true});if(error)throw error;} const {error:re}=await supabase.from("team_members").update({assigned_role:role}).eq("id",memberId);if(re)throw re;await loadTeam();setNotice("Member slot and role updated."); }catch(e){setNotice(e instanceof Error?e.message:"Member assignment failed.");} };
  useEffect(()=>{if(signedIn)loadTeam().catch(e=>{setConnection("Signed in · sync retry needed");setNotice(e instanceof Error?e.message:"Could not load team.");});else{setTeam(null);setTeamMembers([]);setMatchesHydratedKey("");}},[signedIn]);
  const weekMonday = (w: string) => { const m=w.match(/^(\d{4})-W(\d{2})$/); if(!m) return new Date().toISOString().slice(0,10); const y=Number(m[1]), n=Number(m[2]); const d=new Date(Date.UTC(y,0,4)); d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7)+(n-1)*7); return d.toISOString().slice(0,10); };
  const persistMatchSnapshot = async (teamSnapshot: NonNullable<typeof team>, weekSnapshot: string, matchSnapshot: typeof matches, userId: string) => {
    try {
      const start = weekMonday(weekSnapshot);
      const end = new Date(start + "T00:00:00Z");
      end.setUTCDate(end.getUTCDate() + 6);
      const { data: cycle, error: cycleErr } = await supabase!.from("tournament_cycles")
        .upsert({ team_id: teamSnapshot.id, cycle_start: start, cycle_end: end.toISOString().slice(0, 10), title: "Weekly Tournament", status: "active", created_by: userId }, { onConflict: "team_id,cycle_start" })
        .select("id").single();
      if (cycleErr || !cycle) throw cycleErr || new Error("Could not open the current tournament cycle.");
      const rows = Object.entries(matchSnapshot)
        .filter(([key]) => key.startsWith(`${weekSnapshot}-D`))
        .flatMap(([key, match]) => {
          const parsed = key.match(/-D(\d+)-M(\d+)$/);
          return parsed ? [{
            cycle_id: cycle.id, team_id: teamSnapshot.id, match_day: Number(parsed[1]), match_number: Number(parsed[2]),
            placement: match.placement, kills: match.kills,
            points: (match.placement === 1 ? 12 : match.placement === 2 ? 9 : match.placement === 3 ? 8 : match.placement === 4 ? 7 : match.placement === 5 ? 6 : match.placement === 6 ? 5 : match.placement === 7 ? 4 : match.placement === 8 ? 3 : match.placement === 9 ? 2 : match.placement === 10 ? 1 : 0) + match.kills,
            status: "draft", recorded_by: userId,
          }] : [];
        });
      if (rows.length) {
        const { error } = await supabase!.from("tournament_matches").upsert(rows, { onConflict: "cycle_id,match_day,match_number" });
        if (error) throw error;
      }
      if (activeMatchScopeRef.current === `${teamSnapshot.id}:${weekSnapshot}`) setConnection("Signed in · cloud sync active");
    } catch {
      if (activeMatchScopeRef.current === `${teamSnapshot.id}:${weekSnapshot}`) setConnection("Signed in · sync retry needed");
    }
  };

  const flushPendingMatchSync = () => {
    if (matchSyncTimerRef.current !== null) window.clearTimeout(matchSyncTimerRef.current);
    matchSyncTimerRef.current = null;
    const pending = pendingMatchSyncRef.current;
    pendingMatchSyncRef.current = null;
    pendingMatchScopeRef.current = "";
    if (pending) void pending();
  };

  const scheduleMatchSync = (matchSnapshot: typeof matches) => {
    if (!supabase || !signedIn || !team || !sessionUserId || !["owner", "coach"].includes(team.membership_role)) return;
    const scope = `${team.id}:${week}`;
    activeMatchScopeRef.current = scope;
    if (pendingMatchScopeRef.current && pendingMatchScopeRef.current !== scope) {
      flushPendingMatchSync();
    } else if (matchSyncTimerRef.current !== null) {
      window.clearTimeout(matchSyncTimerRef.current);
      matchSyncTimerRef.current = null;
    }
    const teamSnapshot = team;
    const weekSnapshot = week;
    const userId = sessionUserId;
    pendingMatchScopeRef.current = scope;
    pendingMatchSyncRef.current = () => persistMatchSnapshot(teamSnapshot, weekSnapshot, matchSnapshot, userId);
    setConnection("Syncing…");
    matchSyncTimerRef.current = window.setTimeout(() => {
      matchSyncTimerRef.current = null;
      const pending = pendingMatchSyncRef.current;
      pendingMatchSyncRef.current = null;
      pendingMatchScopeRef.current = "";
      if (pending) void pending();
    }, 500);
  };

  useEffect(() => {
    if (!supabase || !signedIn || !team || matchesHydratedKey !== `${team.id}:${week}`) return;
    activeMatchScopeRef.current = `${team.id}:${week}`;
    if (["owner", "coach"].includes(team.membership_role)) scheduleMatchSync(matches);
    else setConnection("Signed in · cloud sync active");
  }, [supabase, signedIn, team?.id, team?.membership_role, sessionUserId, matches, week, matchesHydratedKey]);

  useEffect(() => {
    const flushOnPageHide = () => flushPendingMatchSync();
    window.addEventListener("pagehide", flushOnPageHide);
    return () => {
      window.removeEventListener("pagehide", flushOnPageHide);
      flushPendingMatchSync();
    };
  }, []);
  useEffect(()=>{ if(!supabase||!signedIn||!team)return; setConnection("Syncing…"); let cancelled=false; (async()=>{ try { const start=weekMonday(week); const {data:cycle}=await supabase.from("tournament_cycles").select("id").eq("team_id",team.id).eq("cycle_start",start).maybeSingle(); if(!cycle){if(!cancelled){setSharedMatches([]);setMatchesHydratedKey(`${team.id}:${week}`);setConnection("Signed in · cloud sync active");}return;} const {data,error}=await supabase.from("tournament_matches").select("match_day,match_number,placement,kills,points,status").eq("cycle_id",cycle.id).order("match_day").order("match_number"); if(error)throw error; if(!cancelled){setSharedMatches(data||[]);setMatches(prev=>({...prev,...Object.fromEntries((data||[]).map(row=>[`${week}-D${row.match_day}-M${row.match_number}`,{placement:row.placement??12,kills:row.kills??0}]))}));setMatchesHydratedKey(`${team.id}:${week}`);setConnection("Signed in · cloud sync active");}}catch(e){if(!cancelled){setConnection("Signed in · sync retry needed");setNotice(e instanceof Error?e.message:"Shared scoreboard unavailable.");}} })(); return()=>{cancelled=true}; },[signedIn,team?.id,week]);
  const refreshSharedMatches = async () => {
    if (!supabase || !team) return;
    setConnection("Syncing…");
    try {
      const start = weekMonday(week);
      const { data: cycle, error: ce } = await supabase.from("tournament_cycles").select("id").eq("team_id", team.id).eq("cycle_start", start).maybeSingle();
      if (ce) throw ce;
      if (!cycle) { setSharedMatches([]); setConnection("Signed in · cloud sync active");setNotice("No tournament cycle exists for this week yet."); return; }
      const { data, error } = await supabase.from("tournament_matches").select("match_day,match_number,placement,kills,points,status").eq("cycle_id", cycle.id).order("match_day").order("match_number");
      if (error) throw error;
      setSharedMatches(data || []);
      setConnection("Signed in · cloud sync active");
      setNotice("Shared scoreboard refreshed.");
    } catch (e) { setConnection("Signed in · sync retry needed");setNotice(e instanceof Error ? e.message : "Refresh failed."); }
  };
  useEffect(()=>{if(!supabase||!signedIn||!team)return;let cancelled=false;(async()=>{try{const {data,error}=await supabase.from("training_log").select("activity,done").eq("team_id",team.id).eq("log_date",trainingDate);if(error)throw error;if(!cancelled)setCloudTraining(Object.fromEntries((data||[]).map(x=>[x.activity,!!x.done])));}catch(e){if(!cancelled){setConnection("Signed in · sync retry needed");setNotice(e instanceof Error?e.message:"Training checklist could not be loaded.");}}})();return()=>{cancelled=true};},[signedIn,team?.id,trainingDate]);
  useEffect(()=>{if(!supabase||!signedIn||!team)return;let cancelled=false;(async()=>{try{const {data,error}=await supabase.from("training_session_notes").select("notes").eq("team_id",team.id).eq("note_date",trainingDate).maybeSingle();if(error)throw error;if(!cancelled)setCloudSessionNotes(data?.notes||"");}catch(e){if(!cancelled){setConnection("Signed in · sync retry needed");setNotice(e instanceof Error?e.message:"Session notes could not be loaded.");}}})();return()=>{cancelled=true};},[signedIn,team?.id,trainingDate]);
  useEffect(()=>{if(!supabase||!signedIn||!team)return;let cancelled=false;(async()=>{try{const {data,error}=await supabase.from("daily_scores").select("id,player_id,score_date,communication,coordination,decision_making,role_execution,map_awareness,total,notes,improvement_target").eq("team_id",team.id).order("score_date",{ascending:false}).limit(100);if(error)throw error;if(!cancelled)setEvalHistory(data||[]);}catch(e){if(!cancelled){setConnection("Signed in · sync retry needed");setNotice(e instanceof Error?e.message:"Evaluation history unavailable.");}}})();return()=>{cancelled=true};},[signedIn,team?.id]);
  const saveEvaluation=async()=>{if(!supabase||!team||!signedIn){setNotice("Sign in and join a team to save evaluations.");return;}setConnection("Syncing…");try{if(!sessionUserId)throw new Error("Session expired.");const {data,error}=await supabase.from("daily_scores").insert({team_id:team.id,score_date:evalDate,player_id:evalPlayer,evaluator_id:sessionUserId,...evalScores,notes:evalNotes.trim()||null,improvement_target:evalTarget.trim()||null}).select("id,player_id,score_date,communication,coordination,decision_making,role_execution,map_awareness,total,notes,improvement_target").single();if(error)throw error;setEvalHistory(prev=>[data,...prev].slice(0,100));setConnection("Signed in · cloud sync active");setNotice("Player evaluation saved.");}catch(e){setConnection("Signed in · sync retry needed");setNotice(e instanceof Error?e.message:"Evaluation save failed.");}};
  const saveCloudTraining = async (activity:string,done:boolean) => {setCloudTraining(p=>({...p,[activity]:done}));if(!supabase||!team||!signedIn||!sessionUserId)return;setConnection("Syncing…");try{const {error}=await supabase.from("training_log").upsert({team_id:team.id,log_date:trainingDate,activity,done,updated_by:sessionUserId},{onConflict:"team_id,log_date,activity"});if(error)throw error;setConnection("Signed in · cloud sync active");setNotice("Training checklist saved.");}catch(e){setConnection("Signed in · sync retry needed");setNotice(e instanceof Error?e.message:"Training checklist save failed.");}};
  const saveSessionNotes = async () => { if(!supabase||!team||!signedIn||!sessionUserId)return; setConnection("Syncing…"); try { const {error}=await supabase.from("training_session_notes").upsert({team_id:team.id,note_date:trainingDate,notes:cloudSessionNotes.trim(),updated_by:sessionUserId},{onConflict:"team_id,note_date"}); if(error)throw error; setConnection("Signed in · cloud sync active");setNotice("Session notes saved."); } catch(e) { setConnection("Signed in · sync retry needed");setNotice(e instanceof Error?e.message:"Session notes save failed."); } };
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
        if (active) loadTeam().catch(e => {setConnection("Signed in · sync retry needed");setNotice(e instanceof Error ? e.message : "Team roster refresh failed.");});
      })
      .subscribe(status => {
        if (active && status === "SUBSCRIBED") setConnection("Signed in · live squad sync active");
        else if (active && ["CHANNEL_ERROR","TIMED_OUT","CLOSED"].includes(status)) setConnection("Signed in · sync retry needed");
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
  const syncState = !isOnline ? "offline" : !signedIn || !team ? "error" : /retry|needs review|unavailable|failed|not configured|error/i.test(connection) ? "error" : /checking|syncing/i.test(connection) ? "syncing" : "synced";
  const syncLabel = syncState === "synced" ? "Synced" : syncState === "syncing" ? "Syncing" : syncState === "offline" ? "Offline" : "Not synced";
  const nav: Section[] = ["Overview", "Tournament", "Training", "Players", "Evaluation", "Assignments", "Analytics", "Settings"];
  const onboarding=!signedIn||!team;
  const confirmDialogRef = useAccessibleDialog<HTMLElement>(Boolean(confirmAction), () => setConfirmAction(null));
  return (
    <WorkspaceShell
      section={section}
      nav={nav}
      syncState={syncState}
      syncLabel={syncLabel}
      showNavigation={!onboarding}
      onNavigate={setSection}
    >
          {onboarding?<>
            {notice&&<div className="notice auth-notice" role="status"><span>{notice}</span><button onClick={()=>setNotice("")} aria-label="Dismiss message">×</button></div>}
            <section className="connection-panel" style={{display:"block",maxWidth:680}}>
              {recoveryMode?<><h2>Set a new password</h2><div className="auth-card"><div className="auth-fields"><p className="auth-hint">Email verified. Choose a new password. Never share it by email.</p><label className="auth-field"><span>NEW PASSWORD</span><input type={showPassword?"text":"password"} autoComplete="new-password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="At least 8 characters"/></label><label className="auth-show"><input type="checkbox" checked={showPassword} onChange={e=>setShowPassword(e.target.checked)}/> Show password</label><button className="primary-button auth-submit" disabled={newPassword.length<8||recoveryBusy} onClick={saveRecoveredPassword}>Save new password →</button></div></div></>:recoveryStep==="otp"?<><h2>Verify email</h2><div className="auth-card"><div className="auth-fields"><p className="auth-hint">Enter the 6-digit code sent to {recoveryEmail}. It expires soon.</p><label className="auth-field"><span>EMAIL OTP</span><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={recoveryOtp} onChange={e=>setRecoveryOtp(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="000000"/></label><button className="primary-button auth-submit" disabled={recoveryOtp.length!==6||recoveryBusy} onClick={verifyRecoveryOtp}>{recoveryBusy?"Verifying…":"Verify code →"}</button><button className="text-button" disabled={recoveryBusy} onClick={requestPasswordReset}>Resend code</button><button className="text-button" onClick={()=>{setRecoveryStep("email");setRecoveryOtp("");setNotice("");}}>Use another email</button></div></div></>:!signedIn?<><h2>{authMode==="signup"?"Create account":"Sign in"}</h2><div className="auth-card">
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
                    <div className="team-onboarding-footer"><span>Signed in as <b>{sessionUsername}</b></span><button className="text-button" onClick={()=>setConfirmAction("logout")}>Sign out</button></div>
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
          <p className="intro">A focused workspace for tournament results, player development and team performance.</p>
          {notice && <div className="notice">{notice}<button onClick={()=>setNotice("")}>×</button></div>}
          {section==="Overview" && <>
            <div className="section-heading"><div><h2>Squad overview</h2></div></div>

            <section className="connection-panel" style={{display:"block",marginBottom:22}}>
              <div className="eyebrow">TEAM COLLABORATION</div>
              {team ? <>
                <div className="team-live-header"><div className="team-live-logo">{team.avatar_url?<img src={team.avatar_url} alt={team.team_name+" logo"}/>:<span>{team.team_name.slice(0,1).toUpperCase()}</span>}</div><div><h3>{team.team_name} <span className="active-tag">{team.membership_role}</span></h3><p>Squad identity · Invite code <strong style={{letterSpacing:2,fontSize:18}}>{team.invite_code}</strong></p></div><button className="secondary-button" onClick={async()=>{try{await navigator.clipboard.writeText(team.invite_code);setNotice("Invite code copied.");}catch{setNotice("Copy failed. Select the invite code manually.");}}}>Copy Code</button>{teamChoices.length>1&&<label className="team-switcher"><span>ACTIVE TEAM</span><select value={team.id} onChange={e=>{const next=e.target.value;localStorage.setItem("squad-os-active-team",next);loadTeam(next).then(()=>setNotice("Switched team workspace. Each team keeps its own roster and records.")).catch(err=>setNotice(err.message||"Could not switch team."));}}>{teamChoices.map(choice=><option key={choice.id} value={choice.id}>{choice.team_name} · {choice.membership_role}</option>)}</select></label>}</div>
                <div className="player-list">{teamMembers.map(m=><article className="player-row" key={m.id}><span className="player-id">{m.player_number?"P"+m.player_number:"—"}</span><div><b>{m.display_name}</b><small>{m.membership_role} · {m.assigned_role||"Role not assigned"}{m.user_id===iglUserId?" / IGL":""}</small></div>{team.membership_role==="owner"&&m.membership_role!=="owner"?<div className="add-form"><select defaultValue={String(m.player_number||1)} onChange={e=>assignMember(m.id,Number(e.target.value),m.assigned_role||"Player")}>{[1,2,3,4,5].map(n=><option value={n} key={n}>P{n}</option>)}</select><select defaultValue={m.assigned_role||"Player"} onChange={e=>assignMember(m.id,Number(m.player_number||0),e.target.value)}>{["Primary Rusher","Secondary Rusher","Third Rusher","Sniper","Substitute"].map(x=><option key={x}>{x}</option>)}</select></div>:null}</article>)}</div>
                {team.membership_role==="owner"&&<section className="connection-panel team-admin-panel"><h3>IGL designation</h3><label className="admin-setting">IGL player<select value={iglUserId} onChange={e=>saveIGL(e.target.value)}><option value="">Not assigned</option>{teamMembers.filter(m=>m.status==="active").map(m=><option value={m.user_id} key={m.user_id}>P{m.player_number||"—"} · {m.display_name} ({m.assigned_role||"Unassigned"})</option>)}</select><small>Separate designation. Shows “Role / IGL” without changing the base role.</small></label></section>}
                {team.membership_role==="owner"&&<section className="connection-panel team-admin-panel"><div className="admin-section-title"><h3>Join requests</h3><span className="active-tag">{joinRequests.length} pending</span></div>{joinRequests.length===0?<p className="muted">No pending requests.</p>:<div className="request-list">{joinRequests.map(q=><article className="request-card" key={q.id}><div className="request-person"><b>{q.display_name}</b><small>{new Date(q.requested_at).toLocaleDateString()}</small></div><div className="request-controls"><label>Player slot<select value={requestSlot[q.id]||""} onChange={e=>setRequestSlot(p=>({...p,[q.id]:e.target.value}))}><option value="">Select slot</option>{[1,2,3,4,5].filter(n=>!teamMembers.some(m=>m.status==="active"&&m.player_number===n)).map(n=><option key={n} value={n}>P{n}</option>)}</select></label><label>Role<select value={requestRole[q.id]||"Primary Rusher"} onChange={e=>setRequestRole(p=>({...p,[q.id]:e.target.value}))}>{["Primary Rusher","Secondary Rusher","Third Rusher","Sniper","Substitute"].map(role=><option key={role}>{role}</option>)}</select></label></div><div className="request-actions"><button className="primary-button" onClick={()=>reviewJoinRequest(q.id,true)}>Approve & add</button><button className="secondary-button" onClick={()=>reviewJoinRequest(q.id,false)}>Decline</button></div></article>)}</div>}</section>}
              </>:<>
                <h3 style={{marginTop:8}}>Create a team or join with code</h3><p>Team owner creates one squad. Players use the invite code from their own accounts.</p>
                <p className="team-separate-page-note">Create or join a squad from the dedicated Team Setup screen above. Team creation is not embedded here.</p>
                <div className="add-form" style={{marginTop:12}}><input value={teamCode} onChange={e=>setTeamCode(e.target.value.toUpperCase())} placeholder="8-character invite code" maxLength={8}/><button className="secondary-button" disabled={teamBusy||teamCode.trim().length<6} onClick={joinTeam}>Request to join</button></div>{requestStatus&&<p className="join-pending">{requestStatus}</p>}
              </>}
            </section>
            <div className="foundation-grid overview-stats">
              {[["Roster",players.length+" / 10","Configured players"],["Match records",String(totalMatches),"Current week"],["Week points",String(points),"Placement + kills"]].map(([a,b,c],i)=><article className="foundation-card" key={a}><div className="card-index">0{i+1}</div><div className="card-label">{a}</div><div className="card-value">{b}</div><div className="card-detail">{c}</div></article>)}
            </div>
            <section className="connection-panel"><div><div className="eyebrow">NEXT ACTION</div><h3>Start with the tournament ledger</h3><p>Choose Tournament to record six matches per day, seven days per week. Training and roster are separate sections.</p></div><button className="primary-button" onClick={()=>setSection("Tournament")}>Open tournament →</button></section>
          </>}
          {section==="Tournament" && <>
            <div className="section-heading"><div><div className="eyebrow">WEEKLY CYCLE</div><h2>Matchday ledger</h2></div><span className="phase-pill">42 MATCH SLOTS</span></div>
            <div className="toolbar"><label>Week <input value={week} onChange={e=>setWeek(e.target.value)} placeholder="YYYY-W##"/></label><label>Day <select value={day} onChange={e=>setDay(Number(e.target.value))}>{Array.from({length:7},(_,i)=><option value={i+1} key={i}>Day {i+1} · {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i]}</option>)}</select></label></div>
            <div className="match-grid">{Array.from({length:6},(_,i)=>{const key=week+"-D"+day+"-M"+(i+1);const remote=sharedMatches.find(x=>x.match_day===day&&x.match_number===i+1);const m=(signedIn&&team&&remote)?{placement:remote.placement??12,kills:remote.kills??0}:(matches[key]||{placement:12,kills:0});return <article className="match-card" key={key}><div className="card-index">MATCH 0{i+1}</div><h3>Match {i+1}</h3><label>Placement<select value={m.placement} disabled={!!team&&!["owner","coach"].includes(team.membership_role)} onChange={e=>saveMatch(key,"placement",Number(e.target.value))}>{Array.from({length:12},(_,j)=><option key={j} value={j+1}>{j+1===12?"12+ / Other":j+1}</option>)}</select></label><label>Kills<input type="number" min="0" value={m.kills} disabled={!!team&&!["owner","coach"].includes(team.membership_role)} onChange={e=>saveMatch(key,"kills",Math.max(0,Number(e.target.value)))}/></label></article>})}</div>
            {signedIn&&team&&<section className="connection-panel" style={{display:"block",marginTop:18}}><div className="eyebrow">TEAM SCOREBOARD</div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}><h3>Shared results · {sharedMatches.filter(m=>m.placement!=null).length}/42 scored slots</h3><button className="secondary-button" onClick={refreshSharedMatches}>Refresh</button></div><p>Shared weekly match ledger. Blank slots are ready for scores.</p><div className="player-list">{sharedMatches.map(m=><article className="player-row" key={m.match_day+"-"+m.match_number}><span className="player-id">D{m.match_day} M{m.match_number}</span><div><b>Place {m.placement??"—"} · {m.kills??0} kills · {m.points??0} pts</b><small>{m.status}</small></div></article>)}</div></section>}
            <p className="footer-note">Prototype scoring: placement 1–10 = 12,9,8,7,6,5,4,3,2,1 points; 11/12 = 0. Add kills. Not an official tournament scoring preset.</p>
          </>}
          {section==="Training" && <>
            <div className="section-heading"><div><div className="eyebrow">PRACTICE BLOCK</div><h2>Team drill checklist</h2></div></div>
            <div className="toolbar"><label>Training date <input type="date" value={trainingDate} onChange={e=>setTrainingDate(e.target.value)}/></label></div><div className="drill-list">{["IGL call clarity · short and actionable","Trade spacing · pair stays connected","Rotation timing · move before pressure","Reset discipline · regroup before re-entry","Post-match review · one fix per match"].map((d,i)=><label className="drill-row" key={d}><input type="checkbox" checked={signedIn&&team?!!cloudTraining[d]:!!drillDone[d]} onChange={e=>{if(signedIn&&team)saveCloudTraining(d,e.target.checked);else setDrillDone(p=>({...p,[d]:e.target.checked}));}}/><span><b>0{i+1} / {d}</b><small>Mark only after the team completes and reviews it.</small></span></label>)}</div>
            <label className="notes-label">Session notes<textarea value={signedIn&&team?cloudSessionNotes:(notes.training||"")} onChange={e=>signedIn&&team?setCloudSessionNotes(e.target.value):setNotes(p=>({...p,training:e.target.value}))} placeholder="Calls missed, timing issue, next session target…"/></label>{signedIn&&team&&<button className="primary-button" onClick={saveSessionNotes}>Save session notes</button>}
          </>}
          {section==="Players" && <>
            <div className="section-heading"><div><div className="eyebrow">ROSTER MANAGEMENT</div><h2>Squad roster</h2></div><span className="phase-pill">{players.length} / 10</span></div>
            <input className="search-input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search players or roles…"/>
            <div className="player-list">{filteredPlayers.map(p=><article className="player-row" key={p.id}><span className="player-id">{p.id}</span><div><b>{p.name}</b><small>{p.role}</small></div><span className="active-tag">{p.status}</span><button className="delete-button" onClick={()=>setPlayers(prev=>prev.filter(x=>x.id!==p.id))}>Remove</button></article>)}</div>
            <section className="connection-panel add-player"><div><div className="eyebrow">ADD PLAYER</div><h3>Roster slot</h3><p>Maximum ten roster entries in this local prototype.</p></div><div className="add-form"><input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Player name"/><select value={newRole} onChange={e=>setNewRole(e.target.value)}>{["Primary Rusher","Secondary Rusher","Third Rusher / Flank","Sniper / IGL","Substitute"].map(x=><option key={x}>{x}</option>)}</select><button className="primary-button" disabled={players.length>=10||!newName.trim()} onClick={addPlayer}>Add</button></div></section>
          </>}
          {section==="Evaluation" && <>
            <div className="section-heading"><div><div className="eyebrow">PLAYER DEVELOPMENT</div><h2>Daily evaluation</h2></div></div>
            <section className="connection-panel" style={{display:"block"}}>
              <div className="toolbar"><label>Player<select value={evalPlayer} onChange={e=>setEvalPlayer(e.target.value)}>{teamMembers.filter(m=>m.status==="active").map(m=><option key={m.user_id} value={m.user_id}>{m.display_name} · {m.assigned_role||("P"+m.player_number)}</option>)}{teamMembers.length===0&&players.map(p=><option key={p.id} value={p.id}>{p.id} · {p.name}</option>)}</select></label><label>Date<input type="date" value={evalDate} onChange={e=>setEvalDate(e.target.value)}/></label></div>
              <p>Rate observable performance from 0–10. Score saves to the shared team record.</p>
              <div className="drill-list">{[["communication","Communication"],["coordination","Coordination"],["decision_making","Decision Making"],["role_execution","Role Execution"],["map_awareness","Map Awareness"]].map(([k,label])=><label className="drill-row" key={k}><span><b>{label}</b><small>{evalScores[k]} / 10</small></span><input type="range" min="0" max="10" value={evalScores[k]} onChange={e=>setEvalScores(p=>({...p,[k]:Number(e.target.value)}))}/></label>)}</div>
              <div className="foundation-card" style={{marginTop:12}}><div className="card-label">TOTAL SCORE</div><div className="card-value">{Object.values(evalScores).reduce((a,b)=>a+b,0)} / 50</div></div>
              <label className="notes-label">Improvement target<input value={evalTarget} onChange={e=>setEvalTarget(e.target.value)} placeholder="One measurable focus for next session"/></label><label className="notes-label">Evaluator notes<textarea value={evalNotes} onChange={e=>setEvalNotes(e.target.value)} placeholder="What worked, what needs correction…"/></label>
              <button className="primary-button" style={{marginTop:14}} onClick={saveEvaluation}>Save evaluation</button>
            </section>
            <section className="connection-panel" style={{display:"block",marginTop:18}}><div className="eyebrow">RECENT EVALUATIONS · {evalHistory.length}</div><div className="player-list">{evalHistory.map(e=><article className="player-row" key={e.id}><span className="player-id">{e.score_date}</span><div><b>{teamMembers.find(m=>m.user_id===e.player_id)?.display_name||e.player_id.slice(0,8)} · {e.total??"—"}/50</b><small>Com {e.communication} · Coord {e.coordination} · Decisions {e.decision_making} · Role {e.role_execution} · Map {e.map_awareness}</small>{e.improvement_target&&<small>Target: {e.improvement_target}</small>}{e.notes&&<small>Notes: {e.notes}</small>}</div></article>)}</div></section>
          </>}
          {section==="Assignments" && <>
            <div className="section-heading"><div><div className="eyebrow">INDIVIDUAL PRACTICE</div><h2>Drill assignments</h2></div><span className="phase-pill">{assignmentRows.filter(x=>x.status==="completed").length}/{assignmentRows.length} DONE</span></div>
            <section className="connection-panel" style={{display:"block"}}>
              {!signedIn||!team?<p>Sign in and join/create a squad to use team assignments.</p>:!["owner","coach"].includes(team.membership_role)?<p>Only the team owner or coach can assign new drills. You can update your own assigned tasks below.</p>:<>
              <div className="toolbar"><label>Player<select value={assignmentPlayer} onChange={e=>setAssignmentPlayer(e.target.value)}><option value="">Choose player</option>{teamMembers.filter(m=>m.status==="active").map(m=><option key={m.user_id} value={m.user_id}>{m.display_name} · P{m.player_number||"—"}</option>)}</select></label><label>Due date<input type="date" value={assignmentDate} onChange={e=>setAssignmentDate(e.target.value)}/></label></div>
              <label className="notes-label">Drill title<input value={assignmentTitle} onChange={e=>setAssignmentTitle(e.target.value)}/></label><label className="notes-label">Exact task<textarea value={assignmentDesc} onChange={e=>setAssignmentDesc(e.target.value)}/></label>
              <button className="primary-button" onClick={createAssignment} disabled={!assignmentPlayer||!assignmentTitle.trim()}>Assign drill</button>
              </>}
            </section>
            <section className="connection-panel" style={{display:"block",marginTop:18}}><div className="eyebrow">SQUAD TASK BOARD · {assignmentRows.length}</div><div className="player-list">{assignmentRows.map(a=><article className="player-row" key={a.id}><span className="player-id">{a.due_date}</span><div><b>{teamMembers.find(m=>m.user_id===a.player_id)?.display_name||a.player_id.slice(0,8)} · {a.drill_title}</b><small>{a.drill_description}</small><small>Status: {a.status}</small>{a.completion_note&&<small>{a.completion_note}</small>}</div>{a.player_id===sessionUserId||!!team&&["owner","coach"].includes(team.membership_role)?<button className="secondary-button" onClick={()=>updateAssignment(a.id,a.status==="completed"?"assigned":"completed")}>{a.status==="completed"?"Undo":"Complete"}</button>:null}</article>)}</div></section>
          </>}
          {section==="Profile" && <>
            <div className="section-heading"><div><h2>Player profile</h2></div><button className="secondary-button" type="button" onClick={()=>setSection("Settings")}>← Back to Settings</button></div>
            <section className="connection-panel profile-panel">
              <div className="profile-identity"><span className="profile-avatar">{(displayName||sessionUsername||"P").slice(0,1).toUpperCase()}</span><div><strong>{displayName||sessionUsername||"Player"}</strong><small>{team?.team_name||"No team selected"} · {team?.membership_role||"Account"}</small></div></div>
              <div className="profile-fields">
                <label className="auth-field"><span>IN-GAME NAME (IGN)</span><input value={displayName} maxLength={32} onChange={e=>setDisplayName(e.target.value)} placeholder="Your Free Fire IGN"/></label>
                <label className="auth-field"><span>ACCOUNT USERNAME</span><input value={sessionUsername} readOnly/></label>
                <label className="auth-field"><span>PLAYER SLOT · P1–P5</span><input value={team?.player_number?("P"+team.player_number):"Not assigned"} readOnly/></label>
                <div className="profile-role-block"><label className="auth-field"><span>MY PLAYER ROLE / SLOT</span>{team?.membership_role==="owner"?<select value={String(team.player_number||1)} onChange={e=>saveOwnerRole(Number(e.target.value))}>{[{n:1,label:"P1 · Primary Rusher"},{n:2,label:"P2 · Secondary Rusher"},{n:3,label:"P3 · Third Rusher"},{n:4,label:"P4 · Sniper"},{n:5,label:"P5 · Substitute"}].map(x=><option key={x.n} value={x.n}>{x.label}</option>)}</select>:<input value={team?.assigned_role||"Not assigned"} readOnly/>}</label>{team?.membership_role==="owner"&&<label className="auth-field"><span>TEAM IGL · SEPARATE DESIGNATION</span><select value={iglUserId} onChange={e=>saveIGL(e.target.value)}><option value="">Select IGL player</option>{teamMembers.filter(m=>m.status==="active").map(m=><option key={m.user_id} value={m.user_id}>P{m.player_number||"—"} · {m.display_name}</option>)}</select><small>IGL selection does not change player role/slot. Select P1–P5 independently.</small></label>}</div>
              </div>
              <button className="primary-button" disabled={!signedIn||!displayName.trim()} onClick={async()=>{if(!supabase||!signedIn)return;const name=displayName.trim();const {error}=await supabase.rpc("set_display_name",{p_name:name,p_team_id:team?.id||null});if(error){setNotice(error.message.includes("team_members_team_display_name_lower_uidx")?"This IGN is already used in this team. Choose a different IGN.":error.message);return;}if(!team)await supabase.auth.updateUser({data:{display_name:name}});setDisplayName(name);setTeamMembers(rows=>rows.map(m=>m.user_id===sessionUserId?{...m,display_name:name}:m));setNotice(team?"Team IGN updated. This name is unique only inside this team.":"Default IGN updated for future team membership.");}}>Save IGN</button>
              
              {signedIn&&team&&<section className="account-danger-zone"><div><span className="eyebrow">TEAM MEMBERSHIP</span><strong>Leave this team</strong><small>Your team access ends immediately. Team records stay protected; an empty team enters a 48-hour deletion grace period.</small></div><button className="danger-button" type="button" onClick={()=>setConfirmAction("leave")}>Leave Team</button></section>}
            </section>
          </>}
          {section==="Settings" && <>
            <div className="section-heading"><div><h2>Settings</h2></div></div>
            <section className="connection-panel profile-settings-entry">
              <div><div className="eyebrow">ACCOUNT</div><h3>Player profile</h3><p>View and update your IGN, account details, player slot, role and IGL information.</p></div>
              <button className="primary-button" type="button" onClick={()=>setSection("Profile")}>Open Profile →</button>
            </section>
            {signedIn&&<section className="connection-panel account-settings-panel">
              <div className="eyebrow">ACCOUNT & SECURITY</div><h3>Session controls</h3><p>Log out of this device. Your team records and account remain saved securely.</p>
              <button className="secondary-button settings-logout-button" type="button" onClick={()=>setConfirmAction("logout")}>Log Out</button>
            </section>}
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
              </section>
              <section className="connection-panel backup-panel">
                <div className="backup-panel-head"><div><div className="eyebrow">OWNER TOOLS · DATA PORTABILITY</div><h3>Team backup & restore</h3><p>Export roster, tournament history, training, evaluations, assignments, team settings and related records as a portable JSON backup.</p></div><span className="backup-lock">OWNER ONLY</span></div>
                {team.membership_role==="owner"?<>
                  <div className="backup-actions"><button className="primary-button" type="button" disabled={backupBusy} onClick={downloadTeamBackup}>{backupBusy?"Preparing…":"↓ Download Full Backup"}</button><label className="backup-file-picker">＋ Choose Backup File<input type="file" accept=".json,application/json" onChange={e=>{setBackupFile(e.target.files?.[0]||null);setBackupStatus("");}}/></label></div>
                  {backupFile&&<div className="backup-file-selected"><span>{backupFile.name}</span><button className="text-button" type="button" onClick={()=>setBackupFile(null)}>Remove</button></div>}
                  <button className="secondary-button backup-import-button" type="button" disabled={!backupFile||backupBusy} onClick={()=>setConfirmAction("import")}>{backupBusy?"Restoring…":"Import & Restore Backup"}</button>
                  <small className="backup-warning">Restore replaces the current team roster and records with the selected backup. Your signed-in account remains the team owner. Use a backup exported by SQUAD OS.</small>
                  {backupStatus&&<div className="backup-status" role="status">{backupStatus}</div>}
                </>:<div className="backup-owner-note">Only the current team owner can export or restore team data. Ask the owner to create a backup.</div>}
              </section>
              </>}
          </>}
          {section==="Analytics" && <Suspense fallback={<section className="connection-panel" role="status">Loading analytics…</section>}>
            <AnalyticsSection totalMatches={totalMatches} points={points} analyticsMatches={analyticsMatches} rosterSize={players.length}/>
          </Suspense>}
          {confirmAction&&<div className="confirm-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setConfirmAction(null);}}>
            <section ref={confirmDialogRef} className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description" tabIndex={-1}>
              <div className={"confirm-icon "+(confirmAction==="logout"?"confirm-neutral":"confirm-danger")}>{confirmAction==="logout"?"↗":confirmAction==="leave"?"⇥":"↻"}</div>
              <div className="eyebrow">{confirmAction==="logout"?"ACCOUNT SESSION":confirmAction==="leave"?"TEAM MEMBERSHIP":"DATA RESTORE"}</div>
              <h3 id="confirm-title">{confirmAction==="logout"?"Log out of SQUAD OS?":confirmAction==="leave"?"Leave this team?":"Restore this team backup?"}</h3>
              <p id="confirm-description">{confirmAction==="logout"?"You will be signed out on this device. Your account and team data will remain safe.":confirmAction==="leave"?"Your membership will end immediately. If you are the last active member, the empty team will be queued for deletion after 48 hours.":"This replaces the current team roster and team records with the selected backup. Download a fresh backup first if you need a rollback point."}</p>
              {confirmAction==="leave"&&team?.membership_role==="owner"&&teamMembers.some(m=>m.status==="active"&&m.user_id!==sessionUserId)&&<label className="confirm-transfer-field">Transfer team ownership to<select value={leaveTransferTo} onChange={e=>setLeaveTransferTo(e.target.value)}><option value="">Select new owner</option>{teamMembers.filter(m=>m.status==="active"&&m.user_id!==sessionUserId).map(m=><option key={m.user_id} value={m.user_id}>P{m.player_number||"—"} · {m.display_name}</option>)}</select></label>}
              <div className="confirm-actions"><button className="secondary-button" type="button" disabled={teamBusy||backupBusy} onClick={()=>setConfirmAction(null)}>Cancel</button><button className="danger-button" type="button" disabled={teamBusy||backupBusy||(confirmAction==="leave"&&team?.membership_role==="owner"&&teamMembers.some(m=>m.status==="active"&&m.user_id!==sessionUserId)&&!leaveTransferTo)||(confirmAction==="import"&&!backupFile)} onClick={()=>confirmAction==="logout"?confirmLogout():confirmAction==="leave"?confirmLeaveTeam():importTeamBackup()}>{teamBusy||backupBusy?"Working…":confirmAction==="logout"?"Confirm Log Out":confirmAction==="leave"?"Confirm Leave":"Confirm Restore"}</button></div>
            </section>
          </div>}
          <footer className="footer-note">SQUAD OS · TEAM WORKSPACE</footer>
          </>}
    </WorkspaceShell>
  );
}
