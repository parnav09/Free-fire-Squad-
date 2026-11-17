import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { getTeamUiCapabilities, resolveActiveTeamIdentity, resolveTeamSessionEligibility } from "./lib/evolution-identity";
import { createLatestRequestGuard } from "./lib/latest-request-guard";
import { currentISOWeekKey, initialPlayers, makeSquareTeamLogo, readPlayers, safeStorageGetItem, safeStorageRemoveItem, safeStorageSetItem, type Player } from "./app/foundation-utils";
import characterCatalogue from "./data/characterProfiles.json";

const AnalyticsSection = lazy(() => import("./components/AnalyticsSection"));
const PlanningTrainingCenter = lazy(() => import("./components/PlanningTrainingCenter"));
const PlayerWeeklyInsights = lazy(() => import("./components/PlayerWeeklyInsights"));
import "./components/PlayerWeeklyInsights.css";
const ScrimsSection = lazy(() => import("./components/ScrimsSection"));
const CharactersDatabase = lazy(() => import("./components/CharactersDatabase"));
const PetDatabase = lazy(() => import("./components/PetDatabase"));
import "./components/MatchesSectionTabs.css";



type UiIconName = "arrow-left" | "arrow-right" | "chevron-right" | "log-out" | "download" | "external-link" | "users";
function UiIcon({ name, size = 16 }: { name: UiIconName; size?: number }) {
  const paths: Record<UiIconName, React.ReactNode> = {
    "arrow-left": <><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></>,
    "arrow-right": <><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></>,
    "chevron-right": <path d="m9 18 6-6-6-6"/>,
    "log-out": <><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></>,
    "download": <><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></>,
    "external-link": <><path d="M14 3h7v7"/><path d="M10 14 21 3"/><path d="M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6"/></>,
    "users": <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>
  };
  return <svg className="ui-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}

type Section = "Overview" | "Tournament" | "StratForge" | "Training Legacy" | "Players" | "Evaluation" | "Assignments" | "Analytics" | "Weekly Review" | "Player Trends" | "Evolution" | "Profile" | "Settings";
function readLocalRecord<T extends Record<string, unknown>>(key: string, fallback: T): T {
  const raw = safeStorageGetItem(key);
  if (raw === null) return fallback;
  try {
    const value: unknown = JSON.parse(raw);
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? value as T
      : fallback;
  } catch {
    return fallback;
  }
}

function kolkataDateISO(date = new Date()): string {
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
  const part=(type:string)=>parts.find(value=>value.type===type)?.value||"";
  return `${part("year")}-${part("month")}-${part("day")}`;
}


type SupabaseInstance = NonNullable<typeof import("./lib/supabase/client")["supabase"]>;

async function fetchEvaluationHistory(client: SupabaseInstance, teamId: string, userId: string) {
  const [scoresResult, feedbackResult] = await Promise.all([
    client.from("daily_scores")
      .select("id,player_id,score_date,created_at,communication,coordination,decision_making,role_execution,map_awareness,total")
      .eq("team_id", teamId)
      .order("score_date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(100),
    client.from("daily_score_feedback")
      .select("score_id,improvement_target,improvement_notes,mistake_notes,context_notes")
      .eq("player_id", userId),
  ]);
  if (scoresResult.error) throw scoresResult.error;
  if (feedbackResult.error) throw feedbackResult.error;

  const privateByScore = new Map((feedbackResult.data || []).map((feedback) => [feedback.score_id, feedback]));
  return (scoresResult.data || []).map((score) => {
    const feedback = privateByScore.get(score.id);
    return {
      ...score,
      notes: feedback?.context_notes || null,
      improvement_target: feedback?.improvement_target || null,
      improvement_notes: feedback?.improvement_notes || null,
      mistake_notes: feedback?.mistake_notes || null,
    };
  });
}

export default function App() {
  const [supabase, setSupabase] = useState<SupabaseInstance | null>(null);
  const [supabaseReady, setSupabaseReady] = useState(false);
  const matchSyncTimerRef = useRef<number | null>(null);
  const pendingMatchSyncRef = useRef<(() => Promise<void>) | null>(null);
  const pendingMatchScopeRef = useRef("");
  const activeMatchScopeRef = useRef("");
  const [section, setSection] = useState<Section>("Players");
  const [drillLanguage,setDrillLanguage]=useState<"en"|"hi-en">(()=>safeStorageGetItem("squad-os-drill-language")==="hi-en"?"hi-en":"en");
  const changeDrillLanguage=(value:"en"|"hi-en")=>{setDrillLanguage(value);safeStorageSetItem("squad-os-drill-language",value);};
  const [matchesTab, setMatchesTab] = useState<"Scrims"|"Tournament">("Scrims");
  const [mobileMore, setMobileMore] = useState(false);
  const [players, setPlayers] = useState<Player[]>(readPlayers);
  const [week, setWeek] = useState(() => safeStorageGetItem("squad-os-week") || currentISOWeekKey());
  const [day, setDay] = useState(() => { const value=Number(safeStorageGetItem("squad-os-day")||1); return Number.isInteger(value)&&value>=1&&value<=7?value:1; });
  const [scoreboardExpanded, setScoreboardExpanded] = useState(false);
  const [matches, setMatches] = useState<Record<string, { placement: number; kills: number }>>(() => readLocalRecord("squad-os-matches", {}));
  const [killDrafts, setKillDrafts] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(""), 7000); return () => window.clearTimeout(timer); }, [notice]);
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

  const [drillDone, setDrillDone] = useState<Record<string, boolean>>(() => readLocalRecord("squad-os-drills", {}));
  const [notes, setNotes] = useState<Record<string, string>>(() => readLocalRecord("squad-os-notes", {}));
  const [displayName, setDisplayName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [teamCode, setTeamCode] = useState("");
  const [teamDescription, setTeamDescription] = useState("");
  const [teamLogoFile, setTeamLogoFile] = useState<File|null>(null);
  const [teamLogoPreview, setTeamLogoPreview] = useState("");
  const [teamLogoCropX, setTeamLogoCropX] = useState(50);
  const [teamLogoCropY, setTeamLogoCropY] = useState(50);
  const [teamScreen, setTeamScreen] = useState<"choice" | "create" | "join">("choice");
  const [team, setTeam] = useState<{id:string;membership_id:string;team_name:string;invite_code:string;avatar_url?:string|null;timezone?:string|null;membership_role:string;player_number:number|null;assigned_role:string|null}|null>(null);
  const [localDataHydratedFor,setLocalDataHydratedFor]=useState("");
  const [teamMembers, setTeamMembers] = useState<Array<{id:string;user_id:string;display_name:string;player_number:number|null;assigned_role:string|null;membership_role:string;status:string}>>([]);
  const [teamChoices,setTeamChoices]=useState<Array<{id:string;team_name:string;membership_role:string;selectable:boolean}>>([]);
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
  const [rosterCapacity,setRosterCapacity]=useState(4);
  const [ownerPowerEnabled,setOwnerPowerEnabled]=useState(true);
  const [rosterEditEnabled,setRosterEditEnabled]=useState(()=>safeStorageGetItem("squad-os-roster-edit:"+safeStorageGetItem("squad-os-active-team"))==="on");
  const [selectedRosterMember,setSelectedRosterMember]=useState<{id:string;display_name:string;player_number:number|null;assigned_role:string|null;membership_role:string;user_id:string}|null>(null);
  const [characterLoadoutDraft,setCharacterLoadoutDraft]=useState<{active:string;passives:string[];notes:string}>({active:"",passives:["","",""],notes:""});
  const [characterLoadoutBusy,setCharacterLoadoutBusy]=useState(false);
  const characterSelectOptions=(characterCatalogue as Array<{id:string;name:string;skill:string;type:string}>).map(character=><option key={character.id} value={character.id}>{character.name} · {character.skill} ({character.type})</option>);

  const [characterLoadoutMessage,setCharacterLoadoutMessage]=useState("");

  const [combatNexusView,setCombatNexusView]=useState<"characters"|"pets"|"loadouts"|null>(null);
  useEffect(()=>{
    let cancelled=false;
    setCharacterLoadoutDraft({active:"",passives:["","",""],notes:""});
    setCharacterLoadoutMessage("");
    if(!selectedRosterMember||!supabase||!team)return;
    void (async()=>{
      try{
        const {data,error}=await supabase.from("player_character_loadouts").select("active_character_id,passive_character_ids,notes").eq("team_member_id",selectedRosterMember.id).maybeSingle();
        if(error)throw error;
        if(cancelled)return;
        if(data)setCharacterLoadoutDraft({active:data.active_character_id||"",passives:[...(data.passive_character_ids||[]),"" ,""].slice(0,3),notes:data.notes||""});
      }catch(e){if(!cancelled)setCharacterLoadoutMessage(e instanceof Error?e.message:"Could not load character loadout.");}
    })();
    return()=>{cancelled=true;};
  },[selectedRosterMember?.id,supabase,team?.id]);
  const saveCharacterLoadout=async()=>{
    if(!selectedRosterMember||!team||!supabase)return;
    const passives=characterLoadoutDraft.passives.filter(Boolean);
    if(!characterLoadoutDraft.active){setCharacterLoadoutMessage("Select an active character first.");return;}
    if(passives.length!==3){setCharacterLoadoutMessage("Select all three passive character slots.");return;}
    if(new Set([characterLoadoutDraft.active,...passives]).size!==4){setCharacterLoadoutMessage("A character cannot be used in more than one slot.");return;}
    setCharacterLoadoutBusy(true);setCharacterLoadoutMessage("");
    try{
      const {error}=await supabase.from("player_character_loadouts").upsert({
        team_id:team.id,team_member_id:selectedRosterMember.id,user_id:selectedRosterMember.user_id,
        active_character_id:characterLoadoutDraft.active,passive_character_ids:passives,
        notes:characterLoadoutDraft.notes.trim()||null,updated_by:sessionUserId
      },{onConflict:"team_member_id"});
      if(error)throw error;
      setCharacterLoadoutMessage("Character & skill loadout saved.");
    }catch(e){setCharacterLoadoutMessage(e instanceof Error?e.message:"Could not save character loadout.");}
    finally{setCharacterLoadoutBusy(false);}
  };

  const [customRoleDrafts,setCustomRoleDrafts]=useState<Record<string,string>>({});
  const ownerPowerActive=team?.membership_role==="owner"&&ownerPowerEnabled;
  const teamUiCapabilities=getTeamUiCapabilities(team?.membership_role,ownerPowerEnabled);
  const [cloudTraining, setCloudTraining] = useState<Record<string, boolean>>({});
  const [cloudSessionNotes, setCloudSessionNotes] = useState("");
  const [trainingDate, setTrainingDate] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [evalPlayer,setEvalPlayer]=useState("");
  const evalDate=kolkataDateISO();
  const [evalScores,setEvalScores]=useState<Record<string,number>>({});
  const [evalSaving,setEvalSaving]=useState(false);
  const [evalHistory,setEvalHistory]=useState<Array<{id:string;player_id:string;score_date:string;created_at?:string;communication:number;coordination:number;decision_making:number;role_execution:number;map_awareness:number;total:number|null;notes:string|null;improvement_target:string|null;improvement_notes:string|null;mistake_notes:string|null}>>([]);

  const [assignmentRows,setAssignmentRows]=useState<Array<{id:string;player_id:string;drill_title:string;drill_description:string|null;due_date:string;status:string;completion_note:string|null}>>([]);
  const assignmentScopeRef=useRef("");
  const teamLoadGuardRef=useRef(createLatestRequestGuard());
  // Local-only records are isolated by immutable team UUID. Legacy data is marked migrated
  // only after every scoped copy has been persisted successfully.
  useEffect(()=>{
    if(!team?.id){setLocalDataHydratedFor("");return;}
    const id=team.id, prefix="squad-os:"+id+":";
    const migrateLegacy=safeStorageGetItem("squad-os-legacy-local-migrated")!=="1";
    let migrationComplete=true;
    const readScoped=<T,>(key:string,legacyValue:T,fallback:T):T=>{
      const raw=safeStorageGetItem(prefix+key);
      if(raw!==null){try{return JSON.parse(raw) as T;}catch{return fallback;}}
      const value=migrateLegacy?legacyValue:fallback;
      if(migrateLegacy&&!safeStorageSetItem(prefix+key,JSON.stringify(value)))migrationComplete=false;
      return value;
    };
    setPlayers(readScoped("roster",players,initialPlayers));
    setWeek(readScoped("week",week,currentISOWeekKey()));
    setDay(readScoped("day",day,1));
    setMatches(readScoped("matches",matches,{}));
    setDrillDone(readScoped("drills",drillDone,{}));
    setNotes(readScoped("notes",notes,{}));
    if(migrateLegacy&&migrationComplete)safeStorageSetItem("squad-os-legacy-local-migrated","1");
    setLocalDataHydratedFor(id);
  },[team?.id]);
  useEffect(()=>{if(team?.id&&localDataHydratedFor===team.id)safeStorageSetItem("squad-os:"+team.id+":roster",JSON.stringify(players));},[players,team?.id,localDataHydratedFor]);
  useEffect(()=>{if(team?.id&&localDataHydratedFor===team.id)safeStorageSetItem("squad-os:"+team.id+":week",JSON.stringify(week));},[week,team?.id,localDataHydratedFor]);
  useEffect(()=>{if(team?.id&&localDataHydratedFor===team.id)safeStorageSetItem("squad-os:"+team.id+":day",JSON.stringify(day));},[day,team?.id,localDataHydratedFor]);
  useEffect(()=>{if(team?.id&&localDataHydratedFor===team.id)safeStorageSetItem("squad-os:"+team.id+":matches",JSON.stringify(matches));},[matches,team?.id,localDataHydratedFor]);
  useEffect(()=>{if(team?.id&&localDataHydratedFor===team.id)safeStorageSetItem("squad-os:"+team.id+":drills",JSON.stringify(drillDone));},[drillDone,team?.id,localDataHydratedFor]);
  useEffect(()=>{if(team?.id&&localDataHydratedFor===team.id)safeStorageSetItem("squad-os:"+team.id+":notes",JSON.stringify(notes));},[notes,team?.id,localDataHydratedFor]);
  useEffect(()=>{if(!team?.id){setOwnerPowerEnabled(true);return;}setOwnerPowerEnabled(safeStorageGetItem("squad-os:"+team.id+":owner-power")!=="off");},[team?.id]);

  useEffect(() => {
    const onOnline=()=>{setIsOnline(true);setConnection("Syncing…");};
    const onOffline=()=>{setIsOnline(false);setConnection("Offline");};
    window.addEventListener("online",onOnline);
    window.addEventListener("offline",onOffline);
    return()=>{window.removeEventListener("online",onOnline);window.removeEventListener("offline",onOffline);};
  }, []);

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

  const loadAssignments=async()=>{
    if(!supabase||!team)return;
    setConnection("Syncing…");
    const {data,error}=await supabase.from("player_drill_assignments")
      .select("id,player_id,drill_title,drill_description,due_date,status,completion_note")
      .eq("team_id",team.id).order("due_date",{ascending:false}).limit(100);
    if(error){setConnection("Signed in · sync retry needed");throw error;}
    if(assignmentScopeRef.current!==team.id)return;
    setAssignmentRows(data||[]);setConnection("Signed in · cloud sync active");
  };
  useEffect(()=>{
    let active=true;
    assignmentScopeRef.current=team?.id||"";
    setAssignmentRows([]);
    if(!supabase||!signedIn||!team)return()=>{active=false};
    (async()=>{try{
      const {data,error}=await supabase.from("player_drill_assignments")
        .select("id,player_id,drill_title,drill_description,due_date,status,completion_note")
        .eq("team_id",team.id).order("due_date",{ascending:false}).limit(100);
      if(error)throw error;
      if(active)setAssignmentRows(data||[]);
    }catch(e){if(active){
      setConnection("Signed in · sync retry needed");
      setNotice(e instanceof Error?e.message:"Assignments could not be loaded.");
    }}})();
    return()=>{active=false};
  },[supabase,signedIn,team?.id]);
  const updateAssignment=async(id:string,status:"assigned"|"completed")=>{
    if(!supabase||!team||!sessionUserId)return;
    const assignment=assignmentRows.find(row=>row.id===id);
    if(!assignment){setNotice("This legacy assignment is no longer in the current team list. Refresh and try again.");return;}
    const canManageAssignments=teamUiCapabilities.canManageAssignments;
    if(assignment.player_id!==sessionUserId&&!canManageAssignments){setNotice("You can only update your own existing assignment.");return;}
    if(status!=="assigned"&&status!=="completed"){setNotice("Invalid assignment status.");return;}
    setConnection("Syncing…");
    try{
      const {data,error}=await supabase.from("player_drill_assignments")
        .update({status,completed_at:status==="completed"?new Date().toISOString():null})
        .eq("id",id).eq("team_id",team.id).select("id").maybeSingle();
      if(error)throw error;
      if(!data){setNotice("Assignment was not updated. It may have changed or is no longer available.");return;}
      await loadAssignments();
    }catch(e){
      setConnection("Signed in · sync retry needed");
      setNotice(e instanceof Error?e.message:"Assignment update failed.");
    }
  };
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
    try{const {error}=await supabase.auth.signOut();if(error)throw error;teamLoadGuardRef.current.invalidate();setConfirmAction(null);setNotice("Signed out successfully. Your team data remains saved.");}
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
    const requestId=teamLoadGuardRef.current.begin();
    const isCurrent=()=>teamLoadGuardRef.current.isCurrent(requestId);
    try {
      if (!supabase) return;
      setConnection("Syncing…");
    const {data:{user}}=await supabase.auth.getUser();
    if(!isCurrent())return;
    if(!user) {
      setTeam(null);setTeamMembers([]);setTeamChoices([]);setJoinRequests([]);setIglUserId("");
      safeStorageRemoveItem("squad-os-active-team");
      return;
    }

    const {data:allMemberships,error:allMembershipsError}=await supabase
      .from("team_members")
      .select("id,team_id,user_id,membership_role,status")
      .eq("user_id",user.id)
      .eq("status","active");
    if(!isCurrent())return;
    if(allMembershipsError)throw allMembershipsError;

    const memberships=allMemberships||[];
    const teamIds=[...new Set(memberships.map(m=>m.team_id).filter(Boolean))];
    if(teamIds.length){
      const {data:allTeams,error:allTeamsError}=await supabase
        .from("teams")
        .select("id,team_name")
        .in("id",teamIds);
      if(!isCurrent())return;
      if(allTeamsError)throw allTeamsError;
      setTeamChoices((allTeams||[]).map(t=>{
        const rows=memberships.filter(m=>m.team_id===t.id);
        const resolved=resolveActiveTeamIdentity(user.id,rows,t.id);
        return {...t,membership_role:rows[0]?.membership_role||"player",selectable:!!resolved};
      }));
    }else{
      setTeamChoices([]);
    }

    const preferred=preferredTeamId??safeStorageGetItem("squad-os-active-team");
    const identity=resolveActiveTeamIdentity(user.id,memberships,preferred||null);
    if(!identity){
      safeStorageRemoveItem("squad-os-active-team");
      setTeam(null);setTeamMembers([]);setJoinRequests([]);setIglUserId("");
      setRosterCapacity(4);
      return;
    }

    const {data:membership,error:membershipError}=await supabase
      .from("team_members")
      .select("id,team_id,user_id,display_name,player_number,assigned_role,membership_role,status")
      .eq("id",identity.membershipId)
      .eq("user_id",identity.authUserId)
      .eq("team_id",identity.teamId)
      .eq("status","active")
      .maybeSingle();
    if(!isCurrent())return;
    if(membershipError)throw membershipError;
    const sessionEligibility=resolveTeamSessionEligibility(user.id,membership,identity.teamId);
    if(!sessionEligibility.eligible||!membership){
      safeStorageRemoveItem("squad-os-active-team");
      setTeam(null);setTeamMembers([]);setJoinRequests([]);setIglUserId("");
      setRosterCapacity(4);
      return;
    }
    const eligibleIdentity=sessionEligibility.identity;

    if(team?.id!==eligibleIdentity.teamId){
      setTeam(null);setTeamMembers([]);setJoinRequests([]);setIglUserId("");
    }
    safeStorageSetItem("squad-os-active-team",eligibleIdentity.teamId);
    const {data:t,error:te}=await supabase
      .from("teams")
      .select("id,team_name,invite_code,avatar_url,timezone")
      .eq("id",eligibleIdentity.teamId)
      .single();
    if(!isCurrent())return;
    if(te)throw te;
    setTeam({...t,membership_id:eligibleIdentity.membershipId,membership_role:eligibleIdentity.membershipRole,player_number:membership.player_number,assigned_role:membership.assigned_role});
    setRosterEditEnabled(safeStorageGetItem("squad-os-roster-edit:"+t.id)==="on");
    if(membership.display_name)setDisplayName(membership.display_name);

    const [membersResult,requestsResult,iglResult,capacityResult]=await Promise.all([
      supabase.from("team_members").select("id,user_id,display_name,player_number,assigned_role,membership_role,status").eq("team_id",t.id).order("player_number"),
      supabase.from("team_join_requests").select("id,user_id,requested_at,status").eq("team_id",t.id).eq("status","pending").order("requested_at"),
      supabase.from("team_settings").select("setting_value").eq("team_id",t.id).eq("setting_key","igl_user_id").maybeSingle(),
      supabase.from("team_settings").select("setting_value").eq("team_id",t.id).eq("setting_key","roster_capacity").maybeSingle(),
    ]);
    if(!isCurrent())return;
    if(membersResult.error)throw membersResult.error;
    if(requestsResult.error)throw requestsResult.error;
    if(iglResult.error)throw iglResult.error;
    if(capacityResult.error)throw capacityResult.error;
    const capacityValue=Number(capacityResult.data?.setting_value);
    let fallbackCapacity=4;
    if(!Number.isInteger(capacityValue)||capacityValue<4||capacityValue>10){
      const {data:fifthPlayerSetting}=await supabase.from("team_settings").select("setting_value").eq("team_id",t.id).eq("setting_key","fifth_player").maybeSingle();
      if(!isCurrent())return;
      fallbackCapacity=fifthPlayerSetting?.setting_value===true?5:4;
    }
    if(!isCurrent())return;
    setRosterCapacity(Number.isInteger(capacityValue)&&capacityValue>=4&&capacityValue<=10?capacityValue:fallbackCapacity);
    setTeamMembers((membersResult.data||[]).map(x=>({...x,display_name:x.display_name||"Player"})));
    const reqs=requestsResult.data||[];
    const reqIds=reqs.map(q=>q.user_id);
    const {data:rp,error:profilesError}=reqIds.length?await supabase.from("profiles").select("id,display_name").in("id",reqIds):{data:[],error:null};
    if(!isCurrent())return;
    if(profilesError)throw profilesError;
    setJoinRequests(reqs.map(q=>({...q,display_name:rp?.find(p=>p.id===q.user_id)?.display_name||"New player"})));
    setIglUserId(String(iglResult.data?.setting_value||""));
    setConnection("Syncing…");
    } catch(error) {
      if(isCurrent())throw error;
    }
  };
  const createTeam = async () => {
    if (!supabase || !sessionUserId) { setNotice("Sign in again before creating a team."); return; }
    const cleanName = teamName.trim();
    const cleanDescription = teamDescription.trim();
    if (cleanName.length < 2 || cleanName.length > 48) { setNotice("Team name must be 2–48 characters."); return; }
    if (cleanDescription.length > 240) { setNotice("Description must be 240 characters or fewer."); return; }
    if (teamBusy) return;
    setTeamBusy(true);
    let createdTeamId: string | null = null;
    try {
      const finalIGN = (displayName.trim() || sessionUsername.trim() || "Squad Player").slice(0, 40);
      const { error: nameError } = await supabase.rpc("set_display_name", { p_name: finalIGN });
      if (nameError) {
        if (nameError.code === "PGRST203") throw new Error("Account profile RPC is ambiguous. The server schema fix is not active yet; refresh after the database migration.");
        throw new Error(nameError.message || "Could not save your player name.");
      }
      const createStartedAt = new Date().toISOString();
      const { data, error: createError } = await supabase.rpc("create_team", {
        p_name: cleanName, p_description: cleanDescription || null, p_timezone: "Asia/Kolkata"
      });
      if (createError) {
        // RPC may commit on the server and lose its response during a network timeout.
        // Reconcile before telling the user to retry, preventing accidental duplicate squads.
        const { data: recovered } = await supabase.from("teams").select("id")
          .eq("owner_id", sessionUserId).eq("team_name", cleanName)
          .gte("created_at", createStartedAt).order("created_at", { ascending: false })
          .limit(1).maybeSingle();
        if (recovered?.id) {
          createdTeamId = recovered.id;
          console.warn("Recovered team creation after ambiguous RPC response:", createError.message);
        } else {
          const msg = createError.message || "";
          if (/PGRST203/i.test(msg)) throw new Error("Server RPC schema is still refreshing. Wait a few seconds, reload, then try once.");
          if (/not signed in|jwt/i.test(msg)) throw new Error("Your session expired. Sign in again, then create the team.");
          if (/2 to 48|char_length/i.test(msg)) throw new Error("Team name must be 2–48 characters.");
          throw new Error("Team creation could not be confirmed. Check your Team panel or reload before retrying. Details: " + (msg || "network/server error"));
        }
      } else {
        createdTeamId = typeof data === "string" ? data : Array.isArray(data) ? data[0] : null;
      }
      if (!createdTeamId) throw new Error("The server returned no Team ID. Check your Team panel before retrying.");
      safeStorageSetItem("squad-os-active-team", createdTeamId);
      setTeamName(""); setTeamDescription(""); setTeamLogoFile(null); setTeamLogoPreview(""); setTeamScreen("choice");
      let logoWarning = "";
      if (teamLogoFile) {
        try {
          const ext = (teamLogoFile.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
          const path = `${sessionUserId}/${createdTeamId}.${ext}`;
          const { error: uploadError } = await supabase.storage.from("team-avatars").upload(path, teamLogoFile, { upsert: true, contentType: teamLogoFile.type });
          if (uploadError) throw uploadError;
          const { data: pub } = supabase.storage.from("team-avatars").getPublicUrl(path);
          const { error: avatarError } = await supabase.from("teams").update({ avatar_url: pub.publicUrl }).eq("id", createdTeamId);
          if (avatarError) throw avatarError;
        } catch (logoError) {
          logoWarning = " Team was created; logo upload failed. You can add the logo later in Team Settings.";
          console.error("Team logo upload failed after team creation:", logoError);
        }
      }
      try {
        await loadTeam(createdTeamId);
        setNotice("Team created successfully. Invite code is available in the Team panel." + logoWarning);
      } catch (loadError) {
        console.error("Team created but workspace refresh failed:", loadError);
        setNotice("Team was created successfully (ID: " + createdTeamId + "), but its workspace did not refresh. Reload the page; do not create it again." + logoWarning);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Team creation failed. Please retry.";
      setNotice(message);
      console.error("Team creation failed before confirmed success:", error);
    } finally {
      setTeamBusy(false);
    }
  };
  const joinTeam = async () => { if(!supabase||!teamCode.trim())return; setTeamBusy(true); try { if(!displayName.trim()){throw new Error("Enter your IGN/display name first.");} const {error:ne}=await supabase.rpc("set_display_name",{p_name:displayName.trim()});if(ne)throw ne; const {error}=await supabase.rpc("request_join_team",{p_code:teamCode.trim().toUpperCase()}); if(error)throw error; setTeamCode("");setRequestStatus("Pending owner approval · access activates after slot assignment.");setNotice("Join request sent. Wait for the owner to approve your player slot and role."); } catch(e){setNotice(e instanceof Error?e.message:"Could not join team.");} finally{setTeamBusy(false);} };
  const reviewJoinRequest=async(id:string,approve:boolean)=>{if(!supabase||team?.membership_role!=="owner")return;const slot=Number(requestSlot[id]||0),role=requestRole[id]||"Primary Rusher";if(approve&&(!slot||slot>rosterCapacity)){setNotice("Choose a player slot within the current roster capacity.");return;}try{const {error}=await supabase.rpc("review_team_join_request",{p_request:id,p_player:slot,p_role:role,p_approve:approve});if(error)throw error;await loadTeam();setNotice(approve?"Player approved and added to roster.":"Join request declined.");}catch(e){setNotice(e instanceof Error?e.message:"Request review failed.");}};
  const saveRosterCapacity=async(value:number)=>{if(!supabase||team?.membership_role!=="owner"||value<4||value>10)return;setTeamBusy(true);try{const {error}=await supabase.from("team_settings").upsert({team_id:team.id,setting_key:"roster_capacity",setting_value:value,updated_at:new Date().toISOString()},{onConflict:"team_id,setting_key"});if(error)throw error;setRosterCapacity(value);setNotice("Roster capacity saved. Existing members remain assigned; new slots are available up to P"+value+".");}catch(e){setNotice(e instanceof Error?e.message:"Roster capacity update failed.");}finally{setTeamBusy(false);}};
  const saveIGL=async(userId:string)=>{if(!supabase||team?.membership_role!=="owner")return;try{const {error}=await supabase.from("team_settings").upsert({team_id:team.id,setting_key:"igl_user_id",setting_value:userId,updated_at:new Date().toISOString()},{onConflict:"team_id,setting_key"});if(error)throw error;setIglUserId(userId);setNotice(userId?"IGL designation updated.":"IGL designation cleared.");}catch(e){setNotice(e instanceof Error?e.message:"IGL setting failed.");}};
  const saveOwnerRole=async(slot:number)=>{if(!supabase||team?.membership_role!=="owner"||!team.membership_id)return;const roleBySlot:Record<number,string>={1:"Primary Rusher",2:"Secondary Rusher",3:"Third Rusher",4:"Sniper",5:"Substitute"};const occupied=teamMembers.find(m=>m.status==="active"&&m.player_number===slot&&m.user_id!==sessionUserId);if(occupied){setNotice("That player slot is already occupied. Move or reassign that player first.");return;}try{const {error}=await supabase.rpc("assign_member",{p_member:team.membership_id,p_player:slot,p_activate:true});if(error)throw error;const {error:re}=await supabase.from("team_members").update({assigned_role:roleBySlot[slot]||"Substitute"}).eq("id",team.membership_id);if(re)throw re;await loadTeam();setNotice("Your player slot and role were updated.");}catch(e){setNotice(e instanceof Error?e.message:"Could not update owner role.");}};
  const assignMember = async (memberId:string, player:number, role:string) => { if(!supabase||team?.membership_role!=="owner")return; try { if(player>=1&&player<=rosterCapacity){const {error}=await supabase.rpc("assign_member",{p_member:memberId,p_player:player,p_activate:true});if(error)throw error;} const {error:re}=await supabase.from("team_members").update({assigned_role:role}).eq("id",memberId);if(re)throw re;await loadTeam();setNotice("Member slot and role updated."); }catch(e){setNotice(e instanceof Error?e.message:"Member assignment failed.");} };
  useEffect(()=>{if(signedIn)loadTeam().catch(e=>{setConnection("Signed in · sync retry needed");setNotice(e instanceof Error?e.message:"Could not load team.");});else{teamLoadGuardRef.current.invalidate();setTeam(null);setTeamMembers([]);setTeamChoices([]);setJoinRequests([]);setIglUserId("");setMatchesHydratedKey("");safeStorageRemoveItem("squad-os-active-team");}},[signedIn]);
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
  useEffect(()=>{ if(!supabase||!signedIn||!team)return; setConnection("Syncing…"); let cancelled=false; (async()=>{ try { const start=weekMonday(week); const {data:cycle}=await supabase.from("tournament_cycles").select("id").eq("team_id",team.id).eq("cycle_start",start).maybeSingle(); if(!cycle){if(!cancelled){setSharedMatches([]);setMatchesHydratedKey(`${team.id}:${week}`);setConnection("Signed in · cloud sync active");}return;} const {data,error}=await supabase.from("tournament_matches").select("match_day,match_number,placement,kills,points,status").eq("cycle_id",cycle.id).order("match_day").order("match_number"); if(error)throw error; if(!cancelled){setSharedMatches(data||[]);setMatches(prev=>({...prev,...Object.fromEntries((data||[]).filter(row=>row.placement!==null||(row.kills??0)>0).map(row=>[`${week}-D${row.match_day}-M${row.match_number}`,{placement:row.placement??12,kills:row.kills??0}]))}));setMatchesHydratedKey(`${team.id}:${week}`);setConnection("Signed in · cloud sync active");}}catch(e){if(!cancelled){setConnection("Signed in · sync retry needed");setNotice(e instanceof Error?e.message:"Shared scoreboard unavailable.");}} })(); return()=>{cancelled=true}; },[signedIn,team?.id,week]);
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
  useEffect(()=>{
    let cancelled=false;
    setEvalHistory([]);
    if(!supabase||!signedIn||!team||!sessionUserId)return()=>{cancelled=true};
    (async()=>{try{
      const merged=await fetchEvaluationHistory(supabase,team.id,sessionUserId);
      if(!cancelled)setEvalHistory(merged);
    }catch(e){if(!cancelled){
      setConnection("Signed in · sync retry needed");
      setNotice(e instanceof Error?e.message:"Evaluation history unavailable.");
    }}})();
    return()=>{cancelled=true};
  },[supabase,signedIn,team?.id,sessionUserId]);
  const evaluationKeys=["communication","coordination","decision_making","role_execution","map_awareness"] as const;
  const evaluationComplete=evaluationKeys.every(key=>Number.isInteger(evalScores[key])&&evalScores[key]>=0&&evalScores[key]<=10);
  const saveEvaluation=async()=>{
    if(evalSaving)return;
    if(!supabase||!team||!signedIn){setNotice("Sign in and join a team to save evaluations.");return;}
    if(!teamMembers.some(member=>member.status==="active"&&member.user_id===evalPlayer&&member.user_id!==sessionUserId)){setNotice("Choose another active player from this team. Self-evaluation is disabled in this legacy form.");return;}
    if(!evaluationComplete){setNotice("Rate all five dimensions before submitting. Unselected sliders are not saved.");return;}
    setEvalSaving(true);setConnection("Syncing…");
    try{
      if(!sessionUserId)throw new Error("Session expired.");
      const {data:existing,error:existingError}=await supabase.from("daily_scores").select("id").eq("team_id",team.id).eq("player_id",evalPlayer).eq("score_date",evalDate).limit(1).maybeSingle();
      if(existingError)throw existingError;
      if(existing){setConnection("Signed in · cloud sync active");setNotice("A legacy evaluation already exists for this player today. Duplicate submission blocked.");return;}
      const {data,error}=await supabase.from("daily_scores").insert({team_id:team.id,score_date:evalDate,player_id:evalPlayer,evaluator_id:null,...evalScores,notes:null,improvement_target:null,review_visibility:"recipient_only"}).select("id,player_id,score_date,created_at,communication,coordination,decision_making,role_execution,map_awareness,total").single();
      if(error)throw error;
      setEvalHistory(prev=>[{...data,notes:null,improvement_target:null,improvement_notes:null,mistake_notes:null},...prev].slice(0,100));
      setEvalScores({});setConnection("Signed in · cloud sync active");
      setNotice("Legacy evaluation score saved. Private feedback entry is reserved for Evolution Phase Four.");
    }catch(e){setConnection("Signed in · sync retry needed");setNotice(e instanceof Error?e.message:"Evaluation save failed.");}
    finally{setEvalSaving(false);}
  };
  const saveCloudTraining = async (activity:string,done:boolean) => {setCloudTraining(p=>({...p,[activity]:done}));if(!supabase||!team||!signedIn||!sessionUserId)return;setConnection("Syncing…");try{const {error}=await supabase.from("training_log").upsert({team_id:team.id,log_date:trainingDate,activity,done,updated_by:sessionUserId},{onConflict:"team_id,log_date,activity"});if(error)throw error;setConnection("Signed in · cloud sync active");setNotice("Training checklist saved.");}catch(e){setConnection("Signed in · sync retry needed");setNotice(e instanceof Error?e.message:"Training checklist save failed.");}};
  const saveSessionNotes = async () => { if(!supabase||!team||!signedIn||!sessionUserId)return; setConnection("Syncing…"); try { const {error}=await supabase.from("training_session_notes").upsert({team_id:team.id,note_date:trainingDate,notes:cloudSessionNotes.trim(),updated_by:sessionUserId},{onConflict:"team_id,note_date"}); if(error)throw error; setConnection("Signed in · cloud sync active");setNotice("Session notes saved."); } catch(e) { setConnection("Signed in · sync retry needed");setNotice(e instanceof Error?e.message:"Session notes save failed."); } };
  useEffect(() => {
    const client = supabase;
    if (!client || !signedIn || !team || !sessionUserId) return;
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
        try {
          const merged = await fetchEvaluationHistory(client, team.id, sessionUserId);
          if (active) setEvalHistory(merged);
        } catch (e) {
          if (active) {
            setConnection("Signed in · sync retry needed");
            setNotice(e instanceof Error ? e.message : "Evaluation history refresh failed.");
          }
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_score_feedback", filter: `team_id=eq.${team.id}` }, async () => {
        try {
          const merged = await fetchEvaluationHistory(client, team.id, sessionUserId);
          if (active) setEvalHistory(merged);
        } catch (e) {
          if (active) {
            setConnection("Signed in · sync retry needed");
            setNotice(e instanceof Error ? e.message : "Evaluation feedback refresh failed.");
          }
        }
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
  }, [signedIn, team?.id, sessionUserId, week, trainingDate]);

  const analyticsMatches = signedIn && team ? sharedMatches.filter(m=>m.placement!==null || m.kills>0) : Object.values(matches);
  const totalMatches = analyticsMatches.length;
  const points = analyticsMatches.reduce((sum, m) => sum + (m.placement === 1 ? 12 : m.placement === 2 ? 9 : m.placement === 3 ? 8 : m.placement === 4 ? 7 : m.placement === 5 ? 6 : m.placement === 6 ? 5 : m.placement === 7 ? 4 : m.placement === 8 ? 3 : m.placement === 9 ? 2 : m.placement === 10 ? 1 : 0) + m.kills, 0);
  const saveMatch = (slot: string, field: "placement" | "kills", value: number) => {
    const next = { ...(matches[slot] || { placement: 12, kills: 0 }), [field]: value };
    setMatches(prev => ({ ...prev, [slot]: next }));
  };

  const noticeTone = /fail|error|incorrect|invalid|unable|could not|not available|denied|expired/i.test(notice) ? "error" : /saved|success|assigned|approved|created|updated|sent|copied|completed|added|switched/i.test(notice) ? "success" : "info";
  const syncState = !isOnline ? "offline" : !signedIn || !team ? "error" : /retry|needs review|unavailable|failed|not configured|error/i.test(connection) ? "error" : /checking|syncing/i.test(connection) ? "syncing" : "synced";
  const syncLabel = syncState === "synced" ? "Synced" : syncState === "syncing" ? "Syncing" : syncState === "offline" ? "Offline" : "Not synced";
  const nav: Section[] = ["Players", "Tournament", "StratForge", "Assignments", "Evolution", "Evaluation", "Weekly Review", "Player Trends", "Analytics", "Profile", "Settings", "Training Legacy"];
  const mainNav: Section[] = ["Players", "Tournament", "StratForge", "Assignments"];
  const mobileNavLabel: Record<string,string> = {Players:"Players",Tournament:"Matches",StratForge:"Forge",Assignments:"Tasks",Evaluation:"Eval", "Weekly Review":"Review","Player Trends":"Trends",Analytics:"Stats",Profile:"Profile",Settings:"Settings","Training Legacy":"Legacy"};
  const navIcon: Record<string,string> = {Players:"♙",Tournament:"◷",StratForge:"◈",Assignments:"✓",Evaluation:"◎","Weekly Review":"↗","Player Trends":"⌁",Analytics:"▥",Evolution:"⌁",Profile:"♙",Settings:"⚙","Training Legacy":"◫"};
  const onboarding=!signedIn||!team;
  if (combatNexusView && !onboarding) {
    const isCharacters = combatNexusView === "characters";
    const isPets = combatNexusView === "pets";
    const pageTitle = "Loadout";
    return (
      <main className="combat-nexus-route">
        <div className="combat-nexus-route-shell">
          {isCharacters ? (
            <Suspense fallback={<div className="pt-loading">Opening character database…</div>}> <CharactersDatabase language={drillLanguage} onLanguageChange={changeDrillLanguage} onBack={() => setCombatNexusView(null)} /> </Suspense>
          ) : isPets ? (
            <Suspense fallback={<div className="pt-loading">Opening pet database…</div>}> <PetDatabase onBack={() => setCombatNexusView(null)} /> </Suspense>
          ) : (
            <section className="combat-nexus-subpage">
              <header className="combat-nexus-subpage-top">
                <button type="button" className="character-back-button" onClick={() => setCombatNexusView(null)}><span aria-hidden="true">←</span> Back to Combat Nexus</button>
                <span className="character-db-eyebrow">SQUAD OS / COMBAT NEXUS</span>
              </header>
              <div className="combat-nexus-subpage-hero">
                <span className="combat-nexus-subpage-icon" aria-hidden="true">{"⌘"}</span>
                <div className="character-db-eyebrow">{"03 / COMBAT BUILDS"}</div>
                <h1>{pageTitle}</h1>
                <p>{"A dedicated workspace for organizing and reviewing saved team configurations."}</p>
                <div className="combat-nexus-subpage-status"><i /> {"LOADOUT WORKSPACE"} <span>·</span> NEXT BUILD</div>
              </div>
              <div className="combat-nexus-subpage-panel">
                <div><span className="character-db-eyebrow">WORKSPACE STATUS</span><h2>{"Loadout workspace is being prepared"}</h2><p>{"This is now a separate full-page destination. The dedicated layout will keep saved builds, team combinations and their notes organized here."}</p></div>
                <span className="combat-nexus-panel-mark">{"LOADOUT"}</span>
              </div>
            </section>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">S</div><div className="brand-copy"><span className="brand-name">SQUAD OS</span><span className="brand-caption">TEAM OPERATIONS</span></div>
        <div className="sidebar-divider"/>{!onboarding&&<><div className="nav-label">WORKSPACE</div>
        <div className="nav-group-label">COMMAND</div>{mainNav.map(n => <button key={n} className={"nav-item "+(section===n?"nav-item-active":"nav-item-muted")} onClick={()=>setSection(n)}><span className="nav-symbol">{navIcon[n]}</span>{n==="Tournament"?"Matches":n}</button>)}<div className="nav-group-label">WORKSPACES</div><button className={"nav-item "+(["Evolution","Evaluation","Weekly Review","Player Trends","Analytics"].includes(section)?"nav-item-active":"nav-item-muted")} onClick={()=>setSection("Evolution")}><span className="nav-symbol">⌁</span>Evolution<span className="nav-count">4</span></button><div className="nav-group-label">ACCOUNT</div>{(["Profile","Settings"] as Section[]).map(n=><button key={n} className={"nav-item "+(section===n?"nav-item-active":"nav-item-muted")} onClick={()=>setSection(n)}><span className="nav-symbol">{navIcon[n]}</span>{n}</button>)}<div className="nav-group-label nav-more-label">MORE TOOLS</div>{(["Evaluation","Weekly Review","Player Trends","Analytics","Training Legacy"] as Section[]).map(n=><button key={n} className={"nav-item nav-secondary "+(section===n?"nav-item-active":"nav-item-muted")} onClick={()=>setSection(n)}><span className="nav-symbol">{navIcon[n]}</span>{n}</button>)}
        <div className="sidebar-bottom">SQUAD OS · WORKSPACE</div></>}
      </aside>
      {!onboarding&&<><nav className="mobile-bottom-nav" aria-label="Main navigation">{mainNav.map(n=><button key={n} className={section===n?"mobile-nav-active":""} aria-current={section===n?"page":undefined} onClick={()=>{setSection(n);setMobileMore(false);}}><span className="mobile-nav-icon">{navIcon[n]}</span><small>{mobileNavLabel[n]}</small></button>)}<button className={mobileMore||(!mainNav.includes(section)&&section!=="Overview")?"mobile-nav-active":""} aria-expanded={mobileMore} onClick={()=>setMobileMore(v=>!v)}><span className="mobile-nav-icon">☰</span><small>More</small></button></nav>{mobileMore&&<div className="mobile-more-backdrop" onClick={()=>setMobileMore(false)}><section className="mobile-more-sheet" aria-label="More sections" onClick={e=>e.stopPropagation()}><header><strong>All workspaces</strong><button aria-label="Close menu" onClick={()=>setMobileMore(false)}>×</button></header><div className="mobile-more-grid">{nav.filter(n=>!mainNav.includes(n)).map(n=><button key={n} className={section===n?"mobile-more-active":""} onClick={()=>{setSection(n);setMobileMore(false);}}><span>{navIcon[n]}</span>{n==="Evaluation"||n==="Weekly Review"||n==="Player Trends"||n==="Analytics"?"Evolution · "+n:n}</button>)}</div></section></div>}</>}
      <section className="main-panel">
        <header className="topbar"><div className="breadcrumb">WORKSPACE <span>/</span> {section.toUpperCase()}</div><div className={"sync-indicator sync-"+syncState} role="status" aria-live="polite" aria-label={"Team sync status: "+syncLabel} title={"Team sync status: "+syncLabel}><i/><span>{syncLabel}</span></div></header>
        <div className="content">
          {onboarding?<>
            <section className="connection-panel" style={{display:"block",maxWidth:680}}>
              {recoveryMode?<><h2>Set a new password</h2><div className="auth-card"><div className="auth-fields"><p className="auth-hint">Email verified. Choose a new password. Never share it by email.</p><label className="auth-field"><span>NEW PASSWORD</span><input type={showPassword?"text":"password"} autoComplete="new-password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="At least 8 characters"/></label><label className="auth-show"><input type="checkbox" checked={showPassword} onChange={e=>setShowPassword(e.target.checked)}/> Show password</label><button className="primary-button auth-submit" disabled={newPassword.length<8||recoveryBusy} onClick={saveRecoveredPassword}>Save new password <UiIcon name="arrow-right"/></button></div></div></>:recoveryStep==="otp"?<><h2>Verify email</h2><div className="auth-card"><div className="auth-fields"><p className="auth-hint">Enter the 6-digit code sent to {recoveryEmail}. It expires soon.</p><label className="auth-field"><span>EMAIL OTP</span><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={recoveryOtp} onChange={e=>setRecoveryOtp(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="000000"/></label><button className="primary-button auth-submit" disabled={recoveryOtp.length!==6||recoveryBusy} onClick={verifyRecoveryOtp}>{recoveryBusy?"Verifying…":<>Verify code <UiIcon name="arrow-right"/></>}</button><button className="text-button" disabled={recoveryBusy} onClick={requestPasswordReset}>Resend code</button><button className="text-button" onClick={()=>{setRecoveryStep("email");setRecoveryOtp("");setNotice("");}}>Use another email</button></div></div></>:!signedIn?<><h2>{authMode==="signup"?"Create account":"Sign in"}</h2><div className="auth-card">
                <div className="auth-switch"><button className={authMode==="signup"?"active":""} onClick={()=>{setAuthMode("signup");setNotice("");}}>Create account</button><button className={authMode==="signin"?"active":""} onClick={()=>{setAuthMode("signin");setNotice("");}}>Sign in</button></div>
                <div className="auth-fields">
                  <label className="auth-field"><span>{authMode==="signin"?"USERNAME OR GMAIL":"USERNAME"}</span><input autoComplete="username" type="text" value={sessionUsername} onChange={e=>setSessionUsername(authMode==="signup"?e.target.value.toLowerCase().replace(/[^a-z0-9.-]/g,"").slice(0,24):e.target.value.trim().slice(0,254))} placeholder={authMode==="signin"?"Your username or Gmail":"3–24 characters"}/></label>
                  <label className="auth-field"><span>PASSWORD</span><input autoComplete={authMode==="signup"?"new-password":"current-password"} type={showPassword?"text":"password"} value={sessionPassword} onChange={e=>setSessionPassword(e.target.value)} placeholder={authMode==="signup"?"Create password (8+ characters)":"Your password"}/></label>
                  <label className="auth-show"><input type="checkbox" checked={showPassword} onChange={e=>setShowPassword(e.target.checked)}/> Show password</label>
                  <button className="primary-button auth-submit" disabled={!sessionUsername.trim()||!sessionPassword} onClick={authMode==="signup"?signUp:signIn}>{authMode==="signup"?"Create account":"Sign in"} <UiIcon name="arrow-right"/></button>
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
                        <span className="team-choice-action">Continue <UiIcon name="chevron-right"/></span>
                      </button>
                      <button className="team-choice-card" onClick={()=>{setTeamScreen("join");setNotice("");}}>
                        <span className="team-choice-icon"><UiIcon name="users" size={20}/></span>
                        <span className="eyebrow">ALREADY HAVE A SQUAD?</span>
                        <strong>Join Existing Team</strong>
                        <small>Enter the invite code shared by your team owner.</small>
                        <span className="team-choice-action">Continue <UiIcon name="chevron-right"/></span>
                      </button>
                    </div>
                    <div className="team-onboarding-footer"><span>Signed in as <b>{sessionUsername}</b></span><button className="text-button" onClick={()=>setConfirmAction("logout")}>Sign out</button></div>
                  </> : teamScreen==="create" ? <>
                    <button className="text-button team-back" onClick={()=>{setTeamScreen("choice");setNotice("");}}><UiIcon name="arrow-left"/> Back to team options</button>
                    <div className="team-hero"><span className="team-step">TEAM SETUP · 01 / 02</span><h2>Create your team.</h2><p>Enter the team identity. An invite code will be generated after successful creation.</p></div>
                    <div className="team-form-card">
                      <div className="team-logo-picker">
                        <div className="team-logo-preview" aria-label="Team logo preview">{teamLogoPreview?<img src={teamLogoPreview} alt="Selected team logo"/>:<span className="team-logo-letter">{(teamName.trim()[0]||"T").toUpperCase()}</span>}<span className="logo-orbit"></span></div>
                        <div className="team-logo-copy"><span className="eyebrow">TEAM EMBLEM · OPTIONAL</span><strong>{teamLogoFile?"Custom emblem selected":"Auto-generated emblem"}</strong><small>Upload a square image from your gallery, or leave it blank to use a stylized team initial.</small><label className="team-upload-button" htmlFor="team-logo-file">＋ Choose from Gallery</label><input id="team-logo-file" className="team-file-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>5*1024*1024){setNotice("Logo must be 5 MB or smaller.");e.target.value="";return;}setTeamLogoFile(f);setTeamLogoPreview(URL.createObjectURL(f));}}/><button className="text-button" type="button" onClick={()=>{setTeamLogoFile(null);setTeamLogoPreview("");}}>Use generated emblem</button></div>
                      </div>
                      <label className="auth-field"><span>TEAM NAME <b className="required-mark">*</b></span><input value={teamName} onChange={e=>setTeamName(e.target.value)} placeholder="e.g. NOVA ESPORTS" maxLength={48}/></label>
                      <label className="auth-field"><span>TEAM DESCRIPTION · OPTIONAL</span><textarea value={teamDescription} onChange={e=>setTeamDescription(e.target.value)} placeholder="Short description of your squad (optional)" rows={3} maxLength={240}/></label>
                      <div className="team-create-hint"><span aria-hidden="true">✦</span> Team name is the only required field. Logo and description are optional.</div>
                      <button className="primary-button auth-submit" disabled={teamBusy||teamName.trim().length<2} onClick={createTeam}>{teamBusy?"Creating team…":<>Create Team <UiIcon name="arrow-right"/></>}</button>
                    </div>
                  </> : <>
                    <button className="text-button team-back" onClick={()=>{setTeamScreen("choice");setNotice("");}}><UiIcon name="arrow-left"/> Back to team options</button>
                    <div className="team-hero"><span className="team-step">TEAM SETUP · 02 / 02</span><h2>Join your squad.</h2><p>Use the invite code provided by your team owner. You will join that team's shared workspace.</p></div>
                    <div className="team-form-card">
                      <label className="auth-field"><span>YOUR IN-GAME NAME / IGN</span><input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Enter your Free Fire IGN" maxLength={32}/></label>
                      <label className="auth-field"><span>TEAM INVITE CODE</span><input value={teamCode} onChange={e=>setTeamCode(e.target.value.toUpperCase().replace(/\s/g,""))} placeholder="Enter invite code" maxLength={8} autoCapitalize="characters"/></label>
                      <button className="primary-button auth-submit" disabled={teamBusy||!displayName.trim()||teamCode.trim().length<6} onClick={joinTeam}>{teamBusy?"Joining team…":<>Join Existing Team <UiIcon name="arrow-right"/></>}</button>
                    </div>
                  </>}
                </div>
              </>}
            </section>
          </>:<>
          <div className="eyebrow">SQUAD MANAGEMENT PLATFORM · M3</div>

          <h1>{section==="Players" ? <>Team roster.<br/><span>People & roles.</span></> : <>{section}.<br/><span>Team operations.</span></>}</h1>
          <p className="intro">A focused workspace for tournament results, player development and team performance.</p>

          {(section==="StratForge") && <Suspense fallback={<div className="pt-loading">Opening StratForge workspace…</div>}><PlanningTrainingCenter teamId={team?.id||""} members={teamMembers} userId={sessionUserId} canManage={!!team&&teamUiCapabilities.canManageAssignments} canAssignTasks={!!team&&teamUiCapabilities.canManageAssignments||teamMembers.some(m=>m.user_id===sessionUserId&&/igl/i.test(m.assigned_role||""))} language={drillLanguage} onLanguageChange={changeDrillLanguage}/></Suspense>}
          {section==="Evolution"&&<><div className="section-heading"><div><div className="eyebrow">PLAYER DEVELOPMENT · EVOLUTION</div><h2>One place for improvement</h2></div><span className="phase-pill">4 MODULES</span></div><p className="intro">Evaluation, weekly review, player trends and squad analytics stay together. Use the module you need; all records remain team-shared.</p><div className="evolution-hub-grid">{[{title:"Daily Evaluation",desc:"Legacy five-dimension form. Canonical session-linked workflow is planned for Evolution Phase Four.",to:"Evaluation",icon:"◎"},{title:"Weekly Review",desc:"Legacy read-only snapshot. Full review and approvals are planned for Evolution Phase Seven.",to:"Weekly Review",icon:"↗"},{title:"Player Trends",desc:"Legacy read-only preview. Longitudinal trends are planned for Evolution Phase Eight.",to:"Player Trends",icon:"⌁"},{title:"Squad Analytics",desc:"Competitive-results snapshot. Player-development analytics are planned for Evolution Phase Nine.",to:"Analytics",icon:"▥"}].map(x=><button key={x.to} className="evolution-hub-card" onClick={()=>setSection(x.to as Section)}><span className="evolution-hub-icon">{x.icon}</span><strong>{x.title}</strong><small>{x.desc}</small><span className="evolution-hub-link">Open module →</span></button>)}</div></>}
          {section==="Tournament" && <><div className="matches-section-tabs" role="tablist" aria-label="Matches sections"><button role="tab" aria-selected={matchesTab==="Scrims"} className={matchesTab==="Scrims"?"active":""} onClick={()=>setMatchesTab("Scrims")}>Scrims</button><button role="tab" aria-selected={matchesTab==="Tournament"} className={matchesTab==="Tournament"?"active":""} onClick={()=>setMatchesTab("Tournament")}>Tournaments</button></div>{matchesTab==="Scrims"?<Suspense fallback={<div className="pt-loading">Opening scrims workspace…</div>}> <ScrimsSection supabase={supabase} teamId={team?.id||""} userId={sessionUserId} teamMembers={teamMembers as Array<{user_id:string;display_name?:string}>}/> </Suspense>:<>
            <div className="section-heading"><div><div className="eyebrow">WEEKLY CYCLE</div><h2>Matchday ledger</h2></div><span className="phase-pill">42 MATCH SLOTS</span></div>
            <div className="toolbar"><label>Week <input value={week} onChange={e=>setWeek(e.target.value)} placeholder="YYYY-W##"/></label><label>Day <select value={day} onChange={e=>setDay(Number(e.target.value))}>{Array.from({length:7},(_,i)=><option value={i+1} key={i}>Day {i+1} · {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i]}</option>)}</select></label></div>
            <div className="match-grid">{Array.from({length:6},(_,i)=>{const key=week+"-D"+day+"-M"+(i+1);const remote=sharedMatches.find(x=>x.match_day===day&&x.match_number===i+1);const m=(signedIn&&team&&remote)?{placement:remote.placement??12,kills:remote.kills??0}:(matches[key]||{placement:12,kills:0});return <article className="match-card" key={key}><div className="card-index">MATCH 0{i+1}</div><h3>Match {i+1}</h3><label>Placement<select value={m.placement} disabled={!!team&&!(team.membership_role==="coach"||(team.membership_role==="owner"&&ownerPowerActive))} onChange={e=>saveMatch(key,"placement",Number(e.target.value))}>{Array.from({length:12},(_,j)=><option key={j} value={j+1}>{j+1===12?"12+ / Other":j+1}</option>)}</select></label><label>Kills<input type="text" inputMode="numeric" pattern="[0-9]*" minLength={1} value={killDrafts[key] ?? String(m.kills)} disabled={!!team&&!(team.membership_role==="coach"||(team.membership_role==="owner"&&ownerPowerActive))} onChange={e=>{const raw=e.target.value;setKillDrafts(prev=>({...prev,[key]:raw}));}} onBlur={e=>{const raw=e.currentTarget.value;if(raw!==""){saveMatch(key,"kills",Math.max(0,Number(raw)));}setKillDrafts(prev=>{const next={...prev};delete next[key];return next;});}} onKeyDown={e=>{if(e.key==="Enter"){e.currentTarget.blur();}}}/></label></article>})}</div>
            {signedIn&&team&&<section className="connection-panel" style={{display:"block",marginTop:18}}><div className="eyebrow">TEAM SCOREBOARD</div><div className="scoreboard-head">
              <div><h3>Shared results · {sharedMatches.filter(m => m.placement != null).length}/42 scored slots</h3><p>Weekly team scoreboard · 7 days × 6 matches</p></div>
              <div className="scoreboard-actions"><button className="secondary-button score-action" onClick={refreshSharedMatches}>↻ Refresh</button><button className="score-more-button" onClick={() => setScoreboardExpanded(true)} aria-label="More scoreboard details"><span>More</span><b>⋯</b></button></div>
            </div>
            <div className="scoreboard-mini-grid">
              {Array.from({length: 7}, (_, idx) => {
                const d = idx + 1;
                const rows = sharedMatches.filter(m => m.match_day === d);
                const scored = rows.filter(m => m.placement != null).length;
                const totalKills = rows.reduce((sum, m) => sum + (m.kills || 0), 0);
                const totalPoints = rows.reduce((sum, m) => sum + (m.points || 0), 0);
                return <button className="score-day-tile" key={d} onClick={() => { setDay(d); setScoreboardExpanded(true); }}>
                  <span>DAY {String(d).padStart(2, "0")}</span><strong>{scored}/6</strong><small>{totalKills} kills · {totalPoints} pts</small><i>View matches ↗</i>
                </button>;
              })}
            </div>
            <p className="scoreboard-footnote">Tap More for the complete day-by-day match ledger.</p>
            {scoreboardExpanded && <div className="scoreboard-overlay" role="dialog" aria-modal="true" aria-label="Tournament scoreboard details">
              <div className="scoreboard-drawer">
                <header className="scoreboard-drawer-head"><div><span className="eyebrow">TOURNAMENT · FULL LEDGER</span><h2>All days & matches</h2><p>{week} · 42 match slots</p></div><button className="score-close" onClick={() => setScoreboardExpanded(false)} aria-label="Close scoreboard">×</button></header>
                <nav className="score-day-tabs" aria-label="Tournament days">
                  {Array.from({length: 7}, (_, idx) => <button key={idx + 1} className={day === idx + 1 ? "active" : ""} onClick={() => setDay(idx + 1)}>Day {idx + 1}</button>)}
                </nav>
                <div className="score-day-summary">
                  <div><span>DAY {String(day).padStart(2, "0")}</span><strong>{sharedMatches.filter(m => m.match_day === day && m.placement != null).length}/6 scored</strong></div>
                  <div><strong>{sharedMatches.filter(m => m.match_day === day).reduce((sum, m) => sum + (m.kills || 0), 0)}</strong><small>Total kills</small></div>
                  <div><strong>{sharedMatches.filter(m => m.match_day === day).reduce((sum, m) => sum + (m.points || 0), 0)}</strong><small>Total points</small></div>
                </div>
                <div className="score-match-list">
                  {Array.from({length: 6}, (_, idx) => {
                    const matchNo = idx + 1;
                    const m = sharedMatches.find(x => x.match_day === day && x.match_number === matchNo);
                    const state = m?.status || (m?.placement != null ? "Scored" : "Pending");
                    return <article className="score-match-detail" key={matchNo}>
                      <div className="score-match-title"><span>MATCH {String(matchNo).padStart(2, "0")}</span><b className={state === "completed" ? "is-complete" : "is-pending"}>{state}</b></div>
                      <div className="score-match-stats"><div><small>Placement</small><strong>{m?.placement ?? "—"}</strong></div><div><small>Kills</small><strong>{m?.kills ?? 0}</strong></div><div><small>Points</small><strong>{m?.points ?? 0}</strong></div></div>
                      <p>{m?.placement != null ? "Match result recorded" : "No result saved for this match yet"}</p>
                    </article>;
                  })}
                </div>
                <footer className="scoreboard-drawer-foot"><span>Showing Day {day} of 7</span><div><button onClick={() => setDay(Math.max(1, day - 1))} disabled={day === 1}>← Previous</button><button onClick={() => setDay(Math.min(7, day + 1))} disabled={day === 7}>Next →</button></div></footer>
              </div>
            </div>}
          </section>}
            <p className="footer-note">Prototype scoring: placement 1–10 = 12,9,8,7,6,5,4,3,2,1 points; 11/12 = 0. Add kills. Not an official tournament scoring preset.</p>
          </>}</>}
{section==="Training Legacy" && <>
            <div className="section-heading"><div><div className="eyebrow">PRACTICE BLOCK</div><h2>Team drill checklist</h2></div></div>
            <div className="toolbar"><label>Training date <input type="date" value={trainingDate} onChange={e=>setTrainingDate(e.target.value)}/></label></div><div className="drill-list">{["IGL call clarity · short and actionable","Trade spacing · pair stays connected","Rotation timing · move before pressure","Reset discipline · regroup before re-entry","Post-match review · one fix per match"].map((d,i)=><label className="drill-row" key={d}><input type="checkbox" checked={signedIn&&team?!!cloudTraining[d]:!!drillDone[d]} onChange={e=>{if(signedIn&&team)saveCloudTraining(d,e.target.checked);else setDrillDone(p=>({...p,[d]:e.target.checked}));}}/><span><b>0{i+1} / {d}</b><small>Mark only after the team completes and reviews it.</small></span></label>)}</div>
            <label className="notes-label">Session notes<textarea value={signedIn&&team?cloudSessionNotes:(notes.training||"")} onChange={e=>signedIn&&team?setCloudSessionNotes(e.target.value):setNotes(p=>({...p,training:e.target.value}))} placeholder="Calls missed, timing issue, next session target…"/></label>{signedIn&&team&&<button className="primary-button" onClick={saveSessionNotes}>Save session notes</button>}
          </>}
          {section==="Players" && <>
            <div className="section-heading"><div><div className="eyebrow">TEAM COMMAND · PLAYER MANAGEMENT</div><h2>Players & squad identity</h2><p className="intro">Team code, active players, assigned roles and owner controls in one workspace.</p></div><span className="phase-pill">{teamMembers.filter(m=>m.status==="active").length} ACTIVE</span></div>
            <section className="connection-panel" style={{display:"block",marginBottom:22}}>
              {team ? <>
                <div className="team-live-header team-identity-header"><div className="team-live-logo">{team.avatar_url?<img src={team.avatar_url} alt={team.team_name+" logo"}/>:<span>{team.team_name.slice(0,1).toUpperCase()}</span>}</div><div className="team-identity-copy"><h3>{team.team_name}</h3>{ownerPowerActive&&<div className="owner-team-code"><span>INVITE CODE</span><strong className="team-code-value">{team.invite_code}</strong><button className="secondary-button" onClick={async()=>{try{await navigator.clipboard.writeText(team.invite_code);setNotice("Invite code copied.");}catch{setNotice("Copy failed. Select the invite code manually.");}}}>Copy</button></div>}</div>{teamChoices.length>1&&<label className="team-switcher"><span>ACTIVE TEAM</span><select value={team.id} onChange={e=>{const next=e.target.value;loadTeam(next).then(()=>setNotice("Switched team workspace. Each team keeps its own roster and records.")).catch(err=>setNotice(err instanceof Error?err.message:"Could not switch team."));}}>{teamChoices.map(choice=><option key={choice.id} value={choice.id}>{choice.team_name} · {choice.membership_role}</option>)}</select></label>}</div>
                {ownerPowerActive&&<section className="connection-panel team-admin-panel"><h3>IGL designation</h3><label className="admin-setting">IGL player<select value={iglUserId} onChange={e=>saveIGL(e.target.value)}><option value="">Not assigned</option>{teamMembers.filter(m=>m.status==="active").map(m=><option value={m.user_id} key={m.user_id}>P{m.player_number||"—"} · {m.display_name} ({m.assigned_role||"Unassigned"})</option>)}</select><small>Separate designation. Shows “Role / IGL” without changing the base role.</small></label></section>}
                {ownerPowerActive&&<section className="connection-panel team-admin-panel"><div className="admin-section-title"><h3>Join requests</h3><span className="active-tag">{joinRequests.length} pending</span></div>{joinRequests.length===0?<p className="muted">No pending requests.</p>:<div className="request-list">{joinRequests.map(q=><article className="request-card" key={q.id}><div className="request-person"><b>{q.display_name}</b><small>{new Date(q.requested_at).toLocaleDateString()}</small></div><div className="request-controls"><label>Player slot<select value={requestSlot[q.id]||""} onChange={e=>setRequestSlot(p=>({...p,[q.id]:e.target.value}))}><option value="">Select slot</option>{Array.from({length:rosterCapacity},(_,i)=>i+1).filter(n=>!teamMembers.some(m=>m.status==="active"&&m.player_number===n)).map(n=><option key={n} value={n}>P{n}</option>)}</select></label><label>Role<select value={requestRole[q.id]||"Primary Rusher"} onChange={e=>setRequestRole(p=>({...p,[q.id]:e.target.value}))}>{["Primary Rusher","Secondary Rusher","Third Rusher","Sniper","Substitute"].map(role=><option key={role}>{role}</option>)}</select></label></div><div className="request-actions"><button className="primary-button" onClick={()=>reviewJoinRequest(q.id,true)}>Approve & add</button><button className="secondary-button" onClick={()=>reviewJoinRequest(q.id,false)}>Decline</button></div></article>)}</div>}</section>}
              </>:<>
                {teamChoices.length>0&&<label className="team-switcher" style={{display:"block",marginBottom:16}}><span>CHOOSE ACTIVE TEAM</span><select defaultValue="" onChange={e=>{const next=e.target.value;if(!next)return;loadTeam(next).then(()=>setNotice("Team workspace loaded.")).catch(err=>setNotice(err instanceof Error?err.message:"Could not load selected team."));}}><option value="" disabled>Select one of your active teams</option>{teamChoices.map(choice=><option key={choice.id} value={choice.id} disabled={!choice.selectable}>{choice.team_name} · {choice.membership_role}{!choice.selectable?" · needs membership review":""}</option>)}</select></label>}
                <h3 style={{marginTop:8}}>Create a team or join with code</h3><p>Team owner creates one squad. Players use the invite code from their own accounts.</p>
                <p className="team-separate-page-note">Create or join a squad from the dedicated Team Setup screen above. Team creation is not embedded here.</p>
                <div className="add-form" style={{marginTop:12}}><input value={teamCode} onChange={e=>setTeamCode(e.target.value.toUpperCase())} placeholder="8-character invite code" maxLength={8}/><button className="secondary-button" disabled={teamBusy||teamCode.trim().length<6} onClick={joinTeam}>Request to join</button></div>{requestStatus&&<p className="join-pending">{requestStatus}</p>}
              </>}
            </section>
            <section className="connection-panel player-roster-panel">
              <div className="roster-heading"><div><div className="eyebrow">TEAM LINEUP</div><h3>Player roster</h3><p>Tap any player card to open their character & skill profile.</p></div><span className="phase-pill">{teamMembers.filter(m=>m.status==="active").length} / {rosterCapacity} ACTIVE</span></div>
              <div className="player-list team-player-list">{teamMembers.filter(m=>m.status==="active").sort((a,b)=>(a.player_number||99)-(b.player_number||99)).map(m=><article className="roster-member-card" key={m.id}>
                <button type="button" className="roster-member-open" onClick={()=>setSelectedRosterMember(m)} aria-label={"Open character profile for "+m.display_name}>
                  <span className="roster-slot-mark">{m.player_number?"P"+m.player_number:"—"}</span><span className="roster-member-copy"><b>{m.display_name}</b><small>{m.assigned_role||"Role not assigned"}{m.user_id===iglUserId?" · IGL":""}</small></span>
                  <span className="roster-member-meta"><i className="roster-active-dot"/> <span>ACTIVE</span><em>{m.membership_role==="owner"?"OWNER":m.membership_role.toUpperCase()}</em></span><span className="roster-card-chevron">↗</span>
                </button>
                {ownerPowerActive&&rosterEditEnabled&&m.membership_role!=="owner"&&<div className="roster-edit-controls">
                  <label>PLAYER SLOT<select aria-label={"Assign slot for "+m.display_name} value={String(m.player_number||"")} onChange={e=>assignMember(m.id,Number(e.target.value),m.assigned_role||"Player")}><option value="">Unassigned</option>{Array.from({length:rosterCapacity},(_,i)=>i+1).filter(n=>!teamMembers.some(other=>other.id!==m.id&&other.status==="active"&&other.player_number===n)).map(n=><option value={n} key={n}>P{n}</option>)}</select></label>
                  <label>ROLE<select aria-label={"Assign role for "+m.display_name} value={m.assigned_role||""} onChange={e=>{if(e.target.value)assignMember(m.id,Number(m.player_number||0),e.target.value);}}><option value="">Select role</option>{["Primary Rusher","Secondary Rusher","Third Rusher","Sniper","Substitute","Coach","Analyst","Manager"].map(x=><option key={x}>{x}</option>)}{m.assigned_role&&!["Primary Rusher","Secondary Rusher","Third Rusher","Sniper","Substitute","Coach","Analyst","Manager"].includes(m.assigned_role)&&<option>{m.assigned_role}</option>}</select></label>
                  <label className="roster-custom-role">CUSTOM ROLE<input value={customRoleDrafts[m.id]||""} maxLength={32} placeholder="Add a role (e.g. Coach)" onChange={e=>setCustomRoleDrafts(p=>({...p,[m.id]:e.target.value}))}/></label><button type="button" className="roster-apply-role" disabled={!customRoleDrafts[m.id]?.trim()} onClick={()=>{const role=customRoleDrafts[m.id].trim();assignMember(m.id,Number(m.player_number||0),role);setCustomRoleDrafts(p=>({...p,[m.id]:""}));}}>Set role</button>
                </div>}
              </article>)}</div>
              {ownerPowerActive&&!rosterEditEnabled&&<p className="roster-view-note">Roster management is off. Turn it on in Settings only when you need to make a lineup change.</p>}
            </section>
{combatNexusView==="characters"?<Suspense fallback={<div className="pt-loading">Opening character database…</div>}> <CharactersDatabase language={drillLanguage} onLanguageChange={changeDrillLanguage} onBack={()=>setCombatNexusView(null)}/> </Suspense>:<>{<section className="connection-panel combat-nexus-panel" aria-labelledby="combat-nexus-title">
              <div className="combat-nexus-heading"><div><div className="eyebrow">SQUAD INTELLIGENCE HUB</div><h3 id="combat-nexus-title">Combat Nexus</h3><p>Characters, companion pets and tactical loadouts — one connected workspace.</p></div><span className="combat-nexus-live">FIELD DATABASE</span></div>
              <button type="button" className="combat-nexus-character-card" onClick={()=>setCombatNexusView("characters")} aria-label="Open character database">
                <span className="combat-nexus-main-copy"><span className="combat-nexus-kicker">01 / OPERATIVE DATABASE</span><strong>CHARACTERS</strong><small>Ability profiles, mechanics and cooldowns</small><span className="combat-nexus-count"><b>67</b><i>ROSTER ENTRIES</i><em>Explore database</em></span></span>
                <span className="combat-nexus-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M7 17 17 7M7 7h10v10"/></svg></span>
              </button>
              <div className="combat-nexus-secondary-grid">
                <button type="button" className="combat-nexus-square combat-nexus-pets" onClick={()=>setCombatNexusView("pets")} aria-label="Open pet database">
                  <span className="combat-nexus-square-icon" aria-hidden="true">◈</span><span className="combat-nexus-kicker">02 / COMPANIONS</span><strong>PETS</strong><span className="combat-nexus-square-count">29 <i>PET SLOTS</i></span><span className="combat-nexus-square-arrow">↗</span>
                </button>
                <button type="button" className="combat-nexus-square combat-nexus-loadouts" onClick={()=>setCombatNexusView("loadouts")} aria-label="Open loadouts">
                  <span className="combat-nexus-square-icon" aria-hidden="true">⌘</span><span className="combat-nexus-kicker">03 / COMBAT BUILDS</span><strong>LOADOUT</strong><span className="combat-nexus-square-arrow">↗</span>
                </button>
              </div>
              <p className="combat-nexus-footnote">Catalogue counts are planning totals. Individual ability records will be added only after current-version verification.</p>
            </section>}{combatNexusView&&<div className="combat-nexus-detail" role="region" aria-live="polite"><div><div className="eyebrow">COMBAT NEXUS / {combatNexusView.toUpperCase()}</div><h4>{combatNexusView==="pets"?"Pet database":"Loadout"}</h4><p>{combatNexusView==="pets"?"The pet catalogue will contain skill details, level effects, cooldowns, activation conditions and verified character interactions.":"Loadout workspace reserved for verified character, pet and weapon combinations. No unverified presets are pre-filled."}</p></div><button type="button" className="secondary-button" onClick={()=>setCombatNexusView(null)}>Close</button></div>}</>}
          </>}
          {section==="Evaluation" && <>
            <div className="section-heading"><div><div className="eyebrow">PLAYER DEVELOPMENT · LEGACY FORM</div><h2>Legacy daily evaluation</h2><p className="daily-eval-helper">This is the existing five-dimension record form. The canonical session-linked Daily Evaluation is reserved for Evolution Phase Four.</p></div></div>
            <section className="connection-panel" style={{display:"block"}}>
              <div className="daily-eval-date-lock"><span className="date-lock-mark">▣</span><div><b>Today's evaluation · {evalDate}</b><small>Locked to today's local date · cannot be edited</small></div><span className="date-lock-badge">DATE LOCK</span></div>
              <div className="daily-eval-player-select"><label>Evaluate player<select value={evalPlayer} onChange={e=>setEvalPlayer(e.target.value)}><option value="">Select another active team player</option>{teamMembers.filter(m=>m.status==="active"&&m.user_id!==sessionUserId).map(m=><option key={m.user_id} value={m.user_id}>{m.display_name} · {m.assigned_role||("P"+m.player_number)}</option>)}</select></label><span className="daily-eval-anon">◉ Anonymous · evaluator identity is not stored</span></div>
              <p className="daily-eval-helper">Rate observed actions, not reputation or match result. Each dimension is 0–10; total is out of 50. Slider positions are placeholders until selected; all five ratings are required before saving.</p>
              <div className="daily-eval-ratings">{[["communication","Communication","Clear, timely calls + confirmations"],["coordination","Coordination","Team timing, spacing and sync"],["decision_making","Decision making","Fight, reset, rotate and regroup"],["role_execution","Role execution","Player's assigned role delivered"],["map_awareness","Map awareness","Zone, enemy info and safe angles"]].map(([k,label,hint])=><div className="daily-eval-rating" key={k}><div className="daily-eval-rating-copy"><div><b>{label}</b><small>{hint}</small></div><strong>{evalScores[k]??"Not rated"}<em>/10</em></strong></div><input aria-label={label+" rating 0 to 10"} type="range" min="0" max="10" step="1" value={evalScores[k]??5} onPointerDown={()=>setEvalScores(p=>p[k]===undefined?({...p,[k]:5}):p)} onChange={e=>setEvalScores(p=>({...p,[k]:Number(e.target.value)}))}/><div className="daily-eval-ticks"><span>0</span><span>2</span><span>5</span><span>8</span><span>10</span></div></div>)}</div>
              <div className="daily-eval-total"><div><small>DAILY PLAYER SCORE</small><b>{evaluationComplete?evaluationKeys.reduce((sum,key)=>sum+evalScores[key],0):"—"}<em>/50</em></b></div><span>{evaluationKeys.filter(key=>evalScores[key]!==undefined).length}/5 dimensions rated · equally weighted</span></div>
              <div className="daily-eval-privacy"><span>◇</span><p><b>Private feedback entry is paused</b><br/>This legacy form saves scores only. Atomic score + feedback submission, improvement notes and evidence linkage are planned for Evolution Phase Four. Existing feedback history remains available in the inbox below.</p></div>
              <button className="primary-button daily-eval-submit" style={{marginTop:8}} disabled={!evalPlayer||!evaluationComplete||!signedIn||!team||evalSaving} onClick={saveEvaluation}>{evalSaving?"Saving…":"Submit anonymous evaluation"} <span>→</span></button>
            </section>
            <section className="connection-panel daily-eval-inbox" style={{display:"block",marginTop:18}}><div className="eyebrow">MY FEEDBACK INBOX · {(evalHistory.filter(e=>e.player_id===sessionUserId)).length}</div><p className="daily-eval-helper">Only feedback addressed to your signed-in player account appears here. Reviewer identity is never shown.</p><div className="player-list">{evalHistory.filter(e=>e.player_id===sessionUserId).map(e=><article className="player-row daily-eval-inbox-row" key={e.id}><span className="player-id">{e.score_date}</span><div><b>Daily score · {e.total??"—"}/50</b><small>Communication {e.communication}/10 · Coordination {e.coordination}/10 · Decision {e.decision_making}/10 · Role {e.role_execution}/10 · Map {e.map_awareness}/10</small>{e.improvement_target&&<small>Focus target: {e.improvement_target}</small>}{e.improvement_notes&&<small><strong>Improvement suggestions:</strong> {e.improvement_notes}</small>}{e.mistake_notes&&<small><strong>Mistakes / corrections:</strong> {e.mistake_notes}</small>}{e.notes&&<small><strong>Match context:</strong> {e.notes}</small>}</div></article>)}{!evalHistory.some(e=>e.player_id===sessionUserId)&&<div className="empty-state">No feedback received yet. Evaluations addressed to your account will appear here.</div>}</div></section>
          </>}
          {section==="Assignments" && <>
            <div className="section-heading"><div><div className="eyebrow">LEGACY TASK TRACKER</div><h2>Existing drill assignments</h2><p>New legacy assignments are paused. The unified development-task workflow is planned for Evolution Phase Six.</p></div><span className="phase-pill">{assignmentRows.filter(x=>x.status==="completed").length}/{assignmentRows.length} DONE</span></div>
            <section className="connection-panel" style={{display:"block"}}>
              <div className="daily-eval-privacy"><span>◇</span><p><b>Legacy creation paused</b><br/>This tracker keeps existing assignments and completion history. New assignments are paused to stop growth of the second task system. Existing members can still complete their current items; the canonical task workflow will be built in Evolution Phase Six.</p></div>
            </section>
            <section className="connection-panel" style={{display:"block",marginTop:18}}><div className="eyebrow">SQUAD TASK BOARD · {assignmentRows.length}</div><div className="player-list">{assignmentRows.map(a=><article className="player-row" key={a.id}><span className="player-id">{a.due_date}</span><div><b>{teamMembers.find(m=>m.user_id===a.player_id)?.display_name||a.player_id.slice(0,8)} · {a.drill_title}</b><small>{a.drill_description}</small><small>Status: {a.status}</small>{a.completion_note&&<small>{a.completion_note}</small>}</div>{a.player_id===sessionUserId||!!team&&(team.membership_role==="coach"||(team.membership_role==="owner"&&ownerPowerActive))?<button className="secondary-button" onClick={()=>updateAssignment(a.id,a.status==="completed"?"assigned":"completed")}>{a.status==="completed"?"Undo":"Complete"}</button>:null}</article>)}</div></section>
          </>}
          {section==="Profile" && <>
            <div className="section-heading"><div><h2>Player profile</h2></div><button className="secondary-button" type="button" onClick={()=>setSection("Settings")}><UiIcon name="arrow-left"/> Back to Settings</button></div>
            <section className="connection-panel profile-panel">
              <div className="profile-identity"><span className="profile-avatar">{(displayName||sessionUsername||"P").slice(0,1).toUpperCase()}</span><div><strong>{displayName||sessionUsername||"Player"}</strong><small>{team?.team_name||"No team selected"} · {team?.membership_role||"Account"}</small></div></div>
              <div className="profile-fields">
                <label className="auth-field"><span>IN-GAME NAME (IGN)</span><input value={displayName} maxLength={32} onChange={e=>setDisplayName(e.target.value)} placeholder="Your Free Fire IGN"/></label>
                <label className="auth-field"><span>ACCOUNT USERNAME</span><input value={sessionUsername} readOnly/></label>
                <label className="auth-field"><span>PLAYER SLOT · TEAM ASSIGNMENT</span><input value={team?.player_number?("P"+team.player_number):"Not assigned"} readOnly/><small>This is your actual team slot. Choose one below to assign it.</small></label>
                <div className="profile-role-block"><label className="auth-field"><span>MY PLAYER ROLE / SLOT</span>{ownerPowerActive?<select value={String(team.player_number??"")} onChange={e=>{if(e.target.value)saveOwnerRole(Number(e.target.value));}}><option value="">Choose team slot…</option>{Array.from({length:Math.max(rosterCapacity,players.length,teamMembers.reduce((max,m)=>Math.max(max,m.player_number||0),0))},(_,i)=>i+1).map(n=><option key={n} value={n}>{n===1?"P1 · Primary Rusher":n===2?"P2 · Secondary Rusher":n===3?"P3 · Third Rusher":n===4?"P4 · Sniper":`P${n} · Substitute`}</option>)}</select>:<input value={team?.assigned_role||"Not assigned"} readOnly/>}</label>{ownerPowerActive&&<label className="auth-field"><span>TEAM IGL · SEPARATE DESIGNATION</span><select value={iglUserId} onChange={e=>saveIGL(e.target.value)}><option value="">Select IGL player</option>{teamMembers.filter(m=>m.status==="active").map(m=><option key={m.user_id} value={m.user_id}>P{m.player_number||"—"} · {m.display_name}</option>)}</select><small>IGL selection does not change player role/slot. Select P1–P10 independently.</small></label>}</div>
              </div>
              <button className="primary-button" disabled={!signedIn||!displayName.trim()} onClick={async()=>{if(!supabase||!signedIn)return;const name=displayName.trim();const {error}=await supabase.rpc("set_display_name",{p_name:name,p_team_id:team?.id||null});if(error){setNotice(error.message.includes("team_members_team_display_name_lower_uidx")?"This IGN is already used in this team. Choose a different IGN.":error.message);return;}if(!team)await supabase.auth.updateUser({data:{display_name:name}});setDisplayName(name);setTeamMembers(rows=>rows.map(m=>m.user_id===sessionUserId?{...m,display_name:name}:m));setNotice(team?"Team IGN updated. This name is unique only inside this team.":"Default IGN updated for future team membership.");}}>Save IGN</button>
              
              {signedIn&&team&&<section className="account-danger-zone"><div><span className="eyebrow">TEAM MEMBERSHIP</span><strong>Leave this team</strong><small>Your team access ends immediately. Team records stay protected; an empty team enters a 48-hour deletion grace period.</small></div><button className="danger-button" type="button" onClick={()=>setConfirmAction("leave")}>Leave Team</button></section>}
            </section>
          </>}
          {section==="Settings" && <>
            <div className="section-heading"><div><h2>Settings</h2></div></div>
            <section className="connection-panel language-settings-panel"><div><div className="eyebrow">PREFERENCES</div><h3>Display language</h3><p>Choose English or Hindi + English for the Drill Library and Character Database. Your preference is saved on this device.</p></div><div className="pt-language-toggle settings-language-toggle" role="group" aria-label="Drill language"><button type="button" className={drillLanguage==="en"?"active":""} onClick={()=>changeDrillLanguage("en")}>EN</button><button type="button" className={drillLanguage==="hi-en"?"active":""} onClick={()=>changeDrillLanguage("hi-en")}>HI+EN</button></div></section>
            {signedIn&&teamUiCapabilities.canManageTeamSettings&&<section className="connection-panel roster-edit-settings"><div className="owner-power-head"><div><div className="eyebrow">TEAM PREFERENCES</div><h3>Roster management</h3><p>Keep the Players page in clean member-view mode by default. Enable editing only when you need to adjust slots or roles.</p></div><span className={"owner-power-status "+(rosterEditEnabled?"is-on":"is-off")}>{rosterEditEnabled?"EDITING ON":"VIEW ONLY"}</span></div><label className="owner-power-toggle-row"><span><strong>{rosterEditEnabled?"Roster editing enabled":"Roster editing hidden"}</strong><small>{rosterEditEnabled?"Owner assignment controls are visible in the Player roster.":"You see the same clean player cards as team members."}</small></span><input className="owner-power-switch" type="checkbox" role="switch" checked={rosterEditEnabled} onChange={e=>{const next=e.target.checked;setRosterEditEnabled(next);if(team?.id)safeStorageSetItem("squad-os-roster-edit:"+team.id,next?"on":"off");setNotice(next?"Roster editing enabled for this device.":"Roster returned to member view.");}}/><span className="owner-power-switch-ui" aria-hidden="true"/></label><div className="owner-power-foot"><span className="owner-power-dot"/><small>This changes only the owner’s interface. Team roles and permissions remain server-controlled.</small></div></section>}
            <section className="connection-panel profile-settings-entry">
              <div><div className="eyebrow">ACCOUNT</div><h3>Player profile</h3><p>View and update your IGN, account details, player slot, role and IGL information.</p></div>
              <button className="primary-button" type="button" onClick={()=>setSection("Profile")}>Open Profile <UiIcon name="arrow-right"/></button>
            </section>
            {signedIn&&teamUiCapabilities.canManageTeamSettings&&<section className="connection-panel owner-power-panel">
              <div className="owner-power-head"><div><div className="eyebrow">OWNER CONTROL CENTER</div><h3>Admin command power</h3><p>Switch owner command controls on or off for this device and active team.</p></div><span className={"owner-power-status "+(ownerPowerEnabled?"is-on":"is-off")}>{ownerPowerEnabled?"POWER ON":"POWER OFF"}</span></div>
              <label className="owner-power-toggle-row"><span><strong>{ownerPowerEnabled?"Owner commands enabled":"Member interface active"}</strong><small>{ownerPowerEnabled?"Owner-only controls are visible in the workspace.":"Owner controls are hidden; the workspace looks like a regular member view."}</small></span><input className="owner-power-switch" type="checkbox" role="switch" checked={ownerPowerEnabled} onChange={e=>{const next=e.target.checked;setOwnerPowerEnabled(next);if(team?.id)safeStorageSetItem("squad-os:"+team.id+":owner-power",next?"on":"off");setNotice(next?"Owner command power enabled on this device.":"Owner command power disabled. Your account remains the team owner.");}}/><span className="owner-power-switch-ui" aria-hidden="true"/></label>
              <div className="owner-power-foot"><span className="owner-power-dot"/><small>UI visibility only · Team ownership and server permissions are unchanged.</small></div>
            </section>}
            {signedIn&&<section className="connection-panel account-settings-panel">
              <div className="eyebrow">ACCOUNT & SECURITY</div><h3>Session controls</h3><p>Log out of this device. Your team records and account remain saved securely.</p>
              <button className="secondary-button settings-logout-button" type="button" onClick={()=>setConfirmAction("logout")}>Log Out</button>
            </section>}
            {!signedIn||!team?<section className="connection-panel"><h3>Team profile unavailable</h3><p>Sign in and create or join a team first.</p></section>:<>
              <section className="connection-panel team-profile-settings" style={{display:"block"}}>
                <div className="eyebrow">TEAM PROFILE</div>
                <div className="team-live-header"><div className="team-live-logo">{team.avatar_url?<img src={team.avatar_url} alt={team.team_name+" logo"}/>:<span>{team.team_name.slice(0,1).toUpperCase()}</span>}</div><div><h3>{team.team_name}</h3><p>Team logo · square 1:1 format</p></div></div>
                {ownerPowerActive?<>
                <div className="team-logo-settings-row"><div className="team-logo-preview settings-logo-preview">{teamLogoPreview?<img src={teamLogoPreview} alt="Crop preview" style={{objectFit:"cover",objectPosition:teamLogoCropX+"% "+teamLogoCropY+"%"}}/>:<span className="team-logo-letter">{team.team_name.slice(0,1).toUpperCase()}</span>}<span className="logo-orbit"/></div>
                  <div className="team-logo-copy"><strong>{teamLogoFile?"New logo selected":"Current team logo"}</strong><small>Tap + to choose an image from your phone gallery. Crop is locked to a 1:1 square (512 × 512 output).</small>
                    <label className="team-upload-button" htmlFor="settings-team-logo">＋</label><input id="settings-team-logo" className="team-file-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>5*1024*1024){setNotice("Logo must be 5 MB or smaller.");e.target.value="";return;}setTeamLogoFile(f);setTeamLogoPreview(URL.createObjectURL(f));setTeamLogoCropX(50);setTeamLogoCropY(50);}}/>
                  </div></div>
                {teamLogoFile&&<div className="crop-controls"><label>Horizontal crop <input type="range" min="0" max="100" value={teamLogoCropX} onChange={e=>setTeamLogoCropX(Number(e.target.value))}/></label><label>Vertical crop <input type="range" min="0" max="100" value={teamLogoCropY} onChange={e=>setTeamLogoCropY(Number(e.target.value))}/></label><button className="secondary-button" onClick={()=>{setTeamLogoFile(null);setTeamLogoPreview("");}}>Cancel selection</button></div>}
                <button className="primary-button" disabled={!teamLogoFile||teamBusy} onClick={async()=>{if(!supabase||!teamLogoFile)return;setTeamBusy(true);try{const cropped=await makeSquareTeamLogo(teamLogoFile,teamLogoCropX,teamLogoCropY);const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Sign in again to update the logo.");const path=user.id+"/"+team.id+".jpg";const {error:up}=await supabase.storage.from("team-avatars").upload(path,cropped,{upsert:true,contentType:"image/jpeg"});if(up)throw up;const {data:pub}=supabase.storage.from("team-avatars").getPublicUrl(path);const {error:av}=await supabase.from("teams").update({avatar_url:pub.publicUrl+"?v="+Date.now()}).eq("id",team.id);if(av)throw av;await loadTeam();setTeamLogoFile(null);setTeamLogoPreview("");setNotice("Team logo updated.");}catch(e){setNotice(e instanceof Error?e.message:"Logo update failed.");}finally{setTeamBusy(false);}}}>{teamBusy?"Saving logo…":"Save Team Logo"}</button>
                </>:<p className="muted">Team logo managed by the owner.</p>}
              </section>
            {ownerPowerActive&&<section className="connection-panel retention-settings-panel">
              <div className="backup-panel-head"><div><div className="eyebrow">DATA LIFECYCLE · PROTECTION</div><h3>Historical record protection</h3><p>Automatic deletion is paused while the Evolution Version 2 history and archival rules are being established.</p></div><span className="backup-lock">HISTORY PRESERVED</span></div>
              <p className="muted">Evaluations, private feedback, completed tasks, training records and tournament history are retained. No automatic cleanup is currently scheduled. Future archive controls will require a reviewed export, recovery and approval workflow.</p>
            </section>}
            {ownerPowerActive&&<section className="connection-panel team-admin-panel roster-capacity-panel"><div className="eyebrow">ROSTER CONFIGURATION</div><h3>Player capacity</h3><p>Default is 4 core players. Set an expanded roster from 4 up to 10; approval and slot assignment enforce this limit on the server.</p><label className="admin-setting">Maximum active player slots<select value={rosterCapacity} disabled={teamBusy} onChange={e=>saveRosterCapacity(Number(e.target.value))}>{Array.from({length:7},(_,i)=>i+4).map(n=><option key={n} value={n}>{n} players · P1–P{n}</option>)}</select><small>Changing capacity never deletes or unassigns current players. Reduce only after moving players out of higher slots.</small></label></section>}
              {ownerPowerActive&&<section className="connection-panel backup-panel">
                <div className="backup-panel-head"><div><div className="eyebrow">OWNER TOOLS · DATA PORTABILITY</div><h3>Team backup & restore</h3><p>Export roster, tournament history, training, evaluations, assignments, team settings and related records as a portable JSON backup.</p></div><span className="backup-lock">OWNER ONLY</span></div>
                {ownerPowerActive?<>
                  <div className="backup-actions"><button className="primary-button" type="button" disabled={backupBusy} onClick={downloadTeamBackup}>{backupBusy?"Preparing…":<><UiIcon name="download"/> Download Full Backup</>}</button><label className="backup-file-picker">＋ Choose Backup File<input type="file" accept=".json,application/json" onChange={e=>{setBackupFile(e.target.files?.[0]||null);setBackupStatus("");}}/></label></div>
                  {backupFile&&<div className="backup-file-selected"><span>{backupFile.name}</span><button className="text-button" type="button" onClick={()=>setBackupFile(null)}>Remove</button></div>}
                  <button className="secondary-button backup-import-button" type="button" disabled={!backupFile||backupBusy} onClick={()=>setConfirmAction("import")}>{backupBusy?"Restoring…":"Import & Restore Backup"}</button>
                  <small className="backup-warning">Restore replaces the current team roster and records with the selected backup. Your signed-in account remains the team owner. Use a backup exported by SQUAD OS.</small>
                  {backupStatus&&<div className="backup-status" role="status">{backupStatus}</div>}
                </>:<div className="backup-owner-note">Only the current team owner can export or restore team data. Ask the owner to create a backup.</div>}
              </section>}
              </>}
          </>}
          {(section==="Weekly Review"||section==="Player Trends")&&<Suspense fallback={<section className="connection-panel" role="status">Loading legacy player snapshot…</section>}><PlayerWeeklyInsights members={teamMembers} assignments={assignmentRows} evaluations={evalHistory}/></Suspense>}
          {section==="Analytics" && <Suspense fallback={<section className="connection-panel" role="status">Loading analytics…</section>}>
            <AnalyticsSection totalMatches={totalMatches} points={points} analyticsMatches={analyticsMatches} rosterSize={players.length}/>
          </Suspense>}
          {selectedRosterMember&&<div className="roster-profile-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setSelectedRosterMember(null);}}><section className="roster-profile-modal" role="dialog" aria-modal="true" aria-label={selectedRosterMember.display_name+" character profile"}><button type="button" className="roster-profile-close" aria-label="Close profile" onClick={()=>setSelectedRosterMember(null)}>×</button><div className="eyebrow">PLAYER CHARACTER PROFILE</div><span className="roster-profile-slot">{selectedRosterMember.player_number?"P"+selectedRosterMember.player_number:"PLAYER"}</span><h3>{selectedRosterMember.display_name}</h3><p>{selectedRosterMember.assigned_role||"Role not assigned"} · {selectedRosterMember.membership_role}</p><div className="roster-character-loadout">
  <div className="loadout-slot-group"><label>Active character</label><select value={characterLoadoutDraft.active} onChange={e=>setCharacterLoadoutDraft(d=>({...d,active:e.target.value}))} disabled={characterLoadoutBusy}><option value="">Choose character…</option>{characterSelectOptions}</select></div>
  <div className="loadout-slot-group"><label>Passive skill 1</label><select value={characterLoadoutDraft.passives[0]} onChange={e=>setCharacterLoadoutDraft(d=>({...d,passives:d.passives.map((v,i)=>i===0?e.target.value:v)}))} disabled={characterLoadoutBusy}><option value="">Choose character…</option>{characterSelectOptions}</select></div>
  <div className="loadout-slot-group"><label>Passive skill 2</label><select value={characterLoadoutDraft.passives[1]} onChange={e=>setCharacterLoadoutDraft(d=>({...d,passives:d.passives.map((v,i)=>i===1?e.target.value:v)}))} disabled={characterLoadoutBusy}><option value="">Choose character…</option>{characterSelectOptions}</select></div>
  <div className="loadout-slot-group"><label>Passive skill 3</label><select value={characterLoadoutDraft.passives[2]} onChange={e=>setCharacterLoadoutDraft(d=>({...d,passives:d.passives.map((v,i)=>i===2?e.target.value:v)}))} disabled={characterLoadoutBusy}><option value="">Choose character…</option>{characterSelectOptions}</select></div>
  <label className="loadout-slot-group"><span>Notes (optional)</span><textarea rows={2} maxLength={500} value={characterLoadoutDraft.notes} onChange={e=>setCharacterLoadoutDraft(d=>({...d,notes:e.target.value}))} placeholder="Synergy, role fit, or patch notes…" disabled={characterLoadoutBusy}/></label>
  <small>One active + three passive characters. The same character cannot occupy multiple slots.</small>
  {characterLoadoutMessage&&<p className="loadout-status" role="status">{characterLoadoutMessage}</p>}
  <button type="button" className="primary-button" onClick={()=>void saveCharacterLoadout()} disabled={characterLoadoutBusy}>{characterLoadoutBusy?"Saving…":"Save character loadout"}</button>
</div><button type="button" className="secondary-button" onClick={()=>setSelectedRosterMember(null)}>Close</button></section></div>}{confirmAction&&<div className="confirm-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setConfirmAction(null);}}>
            <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
              <div className={"confirm-icon "+(confirmAction==="logout"?"confirm-neutral":"confirm-danger")}>{confirmAction==="logout"?<UiIcon name="log-out" size={19}/>:confirmAction==="leave"?<UiIcon name="external-link" size={19}/>:<UiIcon name="download" size={19}/>}</div>
              <div className="eyebrow">{confirmAction==="logout"?"ACCOUNT SESSION":confirmAction==="leave"?"TEAM MEMBERSHIP":"DATA RESTORE"}</div>
              <h3 id="confirm-title">{confirmAction==="logout"?"Log out of SQUAD OS?":confirmAction==="leave"?"Leave this team?":"Restore this team backup?"}</h3>
              <p>{confirmAction==="logout"?"You will be signed out on this device. Your account and team data will remain safe.":confirmAction==="leave"?"Your membership will end immediately. If you are the last active member, the empty team will be queued for deletion after 48 hours.":"This replaces the current team roster and team records with the selected backup. Download a fresh backup first if you need a rollback point."}</p>
              {confirmAction==="leave"&&team?.membership_role==="owner"&&teamMembers.some(m=>m.status==="active"&&m.user_id!==sessionUserId)&&<label className="confirm-transfer-field">Transfer team ownership to<select value={leaveTransferTo} onChange={e=>setLeaveTransferTo(e.target.value)}><option value="">Select new owner</option>{teamMembers.filter(m=>m.status==="active"&&m.user_id!==sessionUserId).map(m=><option key={m.user_id} value={m.user_id}>P{m.player_number||"—"} · {m.display_name}</option>)}</select></label>}
              <div className="confirm-actions"><button className="secondary-button" type="button" disabled={teamBusy||backupBusy} onClick={()=>setConfirmAction(null)}>Cancel</button><button className="danger-button" type="button" disabled={teamBusy||backupBusy||(confirmAction==="leave"&&team?.membership_role==="owner"&&teamMembers.some(m=>m.status==="active"&&m.user_id!==sessionUserId)&&!leaveTransferTo)||(confirmAction==="import"&&!backupFile)} onClick={()=>confirmAction==="logout"?confirmLogout():confirmAction==="leave"?confirmLeaveTeam():importTeamBackup()}>{teamBusy||backupBusy?"Working…":confirmAction==="logout"?"Confirm Log Out":confirmAction==="leave"?"Confirm Leave":"Confirm Restore"}</button></div>
            </section>
          </div>}
          <footer className="footer-note">SQUAD OS · TEAM WORKSPACE</footer>
          </>}
        </div>
      </section>
      {notice && <div className="smart-toast-layer"><div className={"smart-toast smart-toast-"+noticeTone} role={noticeTone==="error"?"alert":"status"} aria-live={noticeTone==="error"?"assertive":"polite"}><span className="smart-toast-mark" aria-hidden="true">{noticeTone==="error"?"!":noticeTone==="success"?"✓":"i"}</span><div className="smart-toast-copy"><strong>{noticeTone==="error"?"Action needs attention":noticeTone==="success"?"Action complete":"Squad OS notice"}</strong><p>{notice}</p></div><button className="smart-toast-dismiss" onClick={()=>setNotice("")} aria-label="Dismiss notification">×</button><span className="smart-toast-progress" aria-hidden="true"/></div></div>}
    </main>
  );
}
