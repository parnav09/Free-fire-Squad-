import { useEffect, useMemo, useRef, useState } from "react";
import "./TournamentEventRecords.css";
import { supabase } from "../lib/supabase/client";
import { syncTournamentEventRecords } from "../lib/tournament-event-sync";
import PlacementPicker from "./PlacementPicker";

type EventMatchRecord = { id: string; matchNumber: number; placement: number | null; placementPoints: number; kills: number; };
type EventDaySummary = {
  id?: string;
  dayNumber?: number;
  date?: string;
  matchCount?: number;
  matches?: EventMatchRecord[];
  overallStanding?: number | null;
};

type TournamentEventRecord = {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
  days?: EventDaySummary[];
  overallPlacement?: number | null;
};

type EventDayDraft = { id: string; dayNumber: number; date: string; matchCount: number; };

const STORAGE_KEY = "squad-os-event-tournament-records";
const INITIAL_VISIBLE_RECORDS = 4;
const MIN_EVENT_DAYS = 1;
const MAX_EVENT_DAYS = 60;
const MAX_EVENT_NAME_LENGTH = 80;

function readEventRecords(storageKey: string = STORAGE_KEY): TournamentEventRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is TournamentEventRecord =>
      item !== null &&
      typeof item === "object" &&
      typeof item.id === "string" &&
      typeof item.name === "string" &&
      item.name.trim().length > 0
    );
  } catch {
    return [];
  }
}

function formatDate(value?: string): string {
  if (!value) return "Dates not set";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function getEventSummary(record: TournamentEventRecord) {
  const days = Array.isArray(record.days) ? record.days : [];
  const dates = days.map((day) => day.date).filter((date): date is string => typeof date === "string" && date.length > 0).sort();
  const matchCount = days.reduce((total, day) => total + (Number.isFinite(day.matchCount) ? Math.max(0, Number(day.matchCount)) : 0), 0);
  const dateLabel = dates.length === 0
    ? "Dates not set"
    : dates.length === 1
      ? formatDate(dates[0])
      : `${formatDate(dates[0])} – ${formatDate(dates[dates.length - 1])}`;
  return { dayCount: days.length, matchCount, dateLabel };
}

function getPlacementPoints(placement: number | null): number { return placement === null ? 0 : ([12,9,8,7,6,5,4,3,2,1,0,0][Math.max(1,Math.min(12,placement))-1] ?? 0); }

function normalizeEventName(value: string): string { return value.normalize("NFC").replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim(); }
function isValidCalendarDate(value: string): boolean {
 const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value); if(!match)return false;
 const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
 if(year<1000||month<1||month>12||day<1||day>31)return false;
 const d=new Date(Date.UTC(year,month-1,day));
 return d.getUTCFullYear()===year&&d.getUTCMonth()===month-1&&d.getUTCDate()===day;
}
function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `event-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function triggerStepHaptic(): void {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(8);
    }
  } catch {
    // Haptics are optional; the control remains fully functional without device support.
  }
}

type TournamentEventRecordsProps = { teamId?: string | null; userId?: string | null; signedIn?: boolean; membershipRole?: string | null; iglUserId?: string | null; };

export default function TournamentEventRecords({ teamId = null, userId = null, signedIn = false, membershipRole = null, iglUserId = null }: TournamentEventRecordsProps) {
  const activeStorageKey = teamId ? `${STORAGE_KEY}:${teamId}` : STORAGE_KEY;
  const deletedStorageKey = `${activeStorageKey}:deleted`;
  const [records, setRecords] = useState<TournamentEventRecord[]>(() => readEventRecords(activeStorageKey));
  const [syncStatus, setSyncStatus] = useState<"local" | "syncing" | "synced" | "offline" | "error" | "conflict">("local");
  const [legacyRecords, setLegacyRecords] = useState<TournamentEventRecord[]>(() => teamId ? readEventRecords(STORAGE_KEY) : []);
  const hydratedRef = useRef(false);
  const pendingDeletedIdsRef = useRef<string[]>([]);
  const legacyImportPendingRef = useRef(false);
  const [expanded, setExpanded] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [matchDrafts, setMatchDrafts] = useState<Record<string, { placement: string; placementPoints: string; kills: string }>>({});
  const [matchSaveMessage, setMatchSaveMessage] = useState("");
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDays, setEditDays] = useState<EventDayDraft[]>([]);
  const [editError, setEditError] = useState("");
  const [managementMessage, setManagementMessage] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [eventName, setEventName] = useState("");
  const [dayCount, setDayCount] = useState(1);
  const [setupStep, setSetupStep] = useState<"details" | "days">("details");
  const [dayDrafts, setDayDrafts] = useState<EventDayDraft[]>([]);
  const [dayErrors, setDayErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [storageError, setStorageError] = useState("");
  const saveLockRef = useRef(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const refreshRecords = () => setRecords(readEventRecords(activeStorageKey));
    window.addEventListener("storage", refreshRecords);
    window.addEventListener("squad-os:event-records-updated", refreshRecords);
    return () => {
      window.removeEventListener("storage", refreshRecords);
      window.removeEventListener("squad-os:event-records-updated", refreshRecords);
    };
  }, [activeStorageKey]);


  useEffect(() => {
    if (!teamId || !signedIn || !userId || !supabase) {
      hydratedRef.current = false;
      setSyncStatus("local");
      setRecords(readEventRecords(activeStorageKey));
      setLegacyRecords(teamId ? readEventRecords(STORAGE_KEY) : []);
      return;
    }
    let active = true;
    hydratedRef.current = false;
    const cached = readEventRecords(activeStorageKey);
    try {
      const rawDeleted = window.localStorage.getItem(deletedStorageKey);
      pendingDeletedIdsRef.current = rawDeleted ? JSON.parse(rawDeleted) as string[] : [];
    } catch { pendingDeletedIdsRef.current = []; }
    setRecords(cached);
    setSyncStatus("syncing");
    void (async () => {
      try {
        const result = await syncTournamentEventRecords(supabase, teamId, userId, cached, pendingDeletedIdsRef.current);
        if (!active) return;
        if (result.conflict) {
          setSyncStatus("conflict");
          hydratedRef.current = true;
          return;
        }
        pendingDeletedIdsRef.current = result.deletedIds;
        window.localStorage.setItem(deletedStorageKey, JSON.stringify(result.deletedIds));
        window.localStorage.setItem(activeStorageKey, JSON.stringify(result.records));
        setRecords(result.records);
        setLegacyRecords(readEventRecords(STORAGE_KEY));
        if (legacyImportPendingRef.current) {
          window.localStorage.removeItem(STORAGE_KEY);
          setLegacyRecords([]);
          legacyImportPendingRef.current = false;
        }
        hydratedRef.current = true;
        setSyncStatus("synced");
      } catch {
        if (!active) return;
        hydratedRef.current = true;
        setSyncStatus(typeof navigator !== "undefined" && navigator.onLine ? "error" : "offline");
      }
    })();
    return () => { active = false; };
  }, [teamId, signedIn, userId, activeStorageKey, deletedStorageKey]);

  useEffect(() => {
    const syncClient = supabase;
    if (!teamId || !signedIn || !userId || !syncClient || !hydratedRef.current) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setSyncStatus("syncing");
      void syncTournamentEventRecords(syncClient, teamId, userId, records, pendingDeletedIdsRef.current)
        .then(result => {
          if (!active) return;
          if (result.conflict) { setSyncStatus("conflict"); return; }
          pendingDeletedIdsRef.current = result.deletedIds;
          window.localStorage.setItem(deletedStorageKey, JSON.stringify(result.deletedIds));
          window.localStorage.setItem(activeStorageKey, JSON.stringify(result.records));
          if (JSON.stringify(result.records) !== JSON.stringify(records)) setRecords(result.records);
          setSyncStatus("synced");
          if (legacyImportPendingRef.current) {
            window.localStorage.removeItem(STORAGE_KEY);
            setLegacyRecords([]);
            legacyImportPendingRef.current = false;
          }
        })
        .catch(() => { if (active) setSyncStatus(typeof navigator !== "undefined" && navigator.onLine ? "error" : "offline"); });
    }, 450);
    const retryOnline = () => setRecords(current => [...current]);
    window.addEventListener("online", retryOnline);
    return () => { active = false; window.clearTimeout(timer); window.removeEventListener("online", retryOnline); };
  }, [records, teamId, signedIn, userId, activeStorageKey, deletedStorageKey]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (modalOpen && !dialog.open) {
      dialog.showModal();
      window.requestAnimationFrame(() => nameInputRef.current?.focus());
    } else if (!modalOpen && dialog.open) {
      dialog.close();
    }
  }, [modalOpen]);

  const visibleRecords = useMemo(
    () => expanded ? records : records.slice(0, INITIAL_VISIBLE_RECORDS),
    [expanded, records]
  );
  const hasMore = records.length > INITIAL_VISIBLE_RECORDS;
  const selectedRecord = records.find((record) => record.id === selectedRecordId) ?? null;
  const canManageEvents = membershipRole === "owner" || membershipRole === "coach";
  const canEditResults = canManageEvents || (!!userId && iglUserId === userId);
  const selectedDay = selectedRecord && selectedDayId ? (selectedRecord.days || []).find((day, index) => (day.id || String(day.dayNumber || index + 1)) === selectedDayId) ?? null : null;


  function persistRecords(next: TournamentEventRecord[], changedId?: string) {
    const updatedAt = new Date().toISOString();
    const prepared = next.map(record => record.id === changedId ? { ...record, updatedAt } : record);
    window.localStorage.setItem(activeStorageKey, JSON.stringify(prepared));
    setRecords(prepared);
    window.dispatchEvent(new CustomEvent("squad-os:event-records-updated"));
  }

  function importLegacyRecords() {
    if (!canManageEvents || !teamId || !legacyRecords.length) return;
    const imported = legacyRecords.map(record => ({
      ...record,
      id: createId(),
      updatedAt: new Date().toISOString()
    }));
    legacyImportPendingRef.current = true;
    persistRecords([...imported, ...records]);
    setLegacyRecords([]);
  }
  function openCreateModal() {
    if (!canManageEvents) return;
    setEventName("");
    setDayCount(1);
    setSetupStep("details");
    setDayDrafts([]);
    setDayErrors({});
    setFormError("");
    setStorageError("");
    setModalOpen(true);
  }

  function closeCreateModal() {
    setModalOpen(false);
    setFormError("");
  }

  function changeDayCount(delta: number) {
    setDayCount((current) => Math.min(MAX_EVENT_DAYS, Math.max(MIN_EVENT_DAYS, current + delta)));
    triggerStepHaptic();
  }

  function handleCreateEvent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = normalizeEventName(eventName);
    if (!trimmedName) {
      setFormError("Enter a tournament name to continue.");
      nameInputRef.current?.focus();
      return;
    }
    if (trimmedName.length > MAX_EVENT_NAME_LENGTH) {
      setFormError(`Tournament name must be ${MAX_EVENT_NAME_LENGTH} characters or fewer.`);
      return;
    }
    if (!Number.isSafeInteger(dayCount) || dayCount < MIN_EVENT_DAYS || dayCount > MAX_EVENT_DAYS) { setFormError("Choose a valid number of tournament days."); return; }
    setEventName(trimmedName);
    setDayDrafts(Array.from({ length: dayCount }, (_, index) => ({
      id: createId(), dayNumber: index + 1, date: "", matchCount: 1
    })));
    setDayErrors({});
    setSetupStep("days");
  }

  function updateDayDraft(dayId: string, field: "date" | "matchCount", value: string) {
    setDayDrafts((current) => current.map((day) => day.id === dayId
      ? { ...day, [field]: field === "matchCount" ? (value === "" ? 0 : Number(value)) : value }
      : day
    ));
    setDayErrors((current) => { const next = { ...current }; delete next[dayId]; return next; });
  }

  function handleSaveConfiguredEvent(event: React.FormEvent<HTMLFormElement>) {
 event.preventDefault(); if(saveLockRef.current)return; saveLockRef.current=true; setStorageError("");
 const normalizedName=normalizeEventName(eventName), errors:Record<string,string>={}, dates=new Set<string>(), ids=new Set<string>(), numbers=new Set<number>(); let total=0;
 if(!normalizedName||normalizedName.length>MAX_EVENT_NAME_LENGTH){setFormError(!normalizedName?"Enter a tournament name before saving.":`Tournament name must be ${MAX_EVENT_NAME_LENGTH} characters or fewer.`);setSetupStep("details");saveLockRef.current=false;return;}
 if(!Number.isSafeInteger(dayCount)||dayCount<MIN_EVENT_DAYS||dayCount>MAX_EVENT_DAYS||dayDrafts.length!==dayCount){setStorageError("The event day configuration is incomplete. Go back and set the number of days again.");saveLockRef.current=false;return;}
 for(const day of dayDrafts){
  if(!day.id||ids.has(day.id))errors[day.id || `day-${day.dayNumber}`] = "This day configuration is duplicated."; ids.add(day.id);
  if(!Number.isSafeInteger(day.dayNumber)||day.dayNumber<1||day.dayNumber>dayCount||numbers.has(day.dayNumber))errors[day.id]="Day order is invalid."; numbers.add(day.dayNumber);
  if(!day.date)errors[day.id]="Choose a date for this day.";else if(!isValidCalendarDate(day.date))errors[day.id]="Enter a valid calendar date.";else if(dates.has(day.date))errors[day.id]="Each tournament day must have a different date."; if(day.date)dates.add(day.date);
  if(!Number.isSafeInteger(day.matchCount)||day.matchCount<1)errors[day.id]="Enter a whole-number match count of at least 1.";else{total+=day.matchCount;if(!Number.isSafeInteger(total))errors[day.id]="The combined match count is too large. Reduce the match counts.";}
 }
 if(numbers.size!==dayCount||Array.from({length:dayCount},(_,i)=>i+1).some(n=>!numbers.has(n))){setStorageError("The day sequence is incomplete. Go back and recreate the day list.");saveLockRef.current=false;return;}
 if(Object.keys(errors).length){setDayErrors(errors);saveLockRef.current=false;return;}
 try{
  const raw=window.localStorage.getItem(activeStorageKey);let existing:TournamentEventRecord[]=[];
  if(raw){const parsed:unknown=JSON.parse(raw);if(!Array.isArray(parsed))throw new Error("Invalid records");existing=parsed.filter((x):x is TournamentEventRecord=>x!==null&&typeof x==="object"&&typeof x.id==="string"&&typeof x.name==="string"&&x.name.trim().length>0);if(existing.length!==parsed.length)throw new Error("Unreadable records");}
  const used=new Set(existing.map(x=>x.id));let id=createId();while(used.has(id))id=createId();
  const record:TournamentEventRecord={id,name:normalizedName,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),days:[...dayDrafts].sort((x,y)=>x.dayNumber-y.dayNumber).map(d=>({id:d.id,dayNumber:d.dayNumber,date:d.date,matchCount:d.matchCount,matches:[]}))};
  const next=[record,...existing];persistRecords(next, record.id);setExpanded(false);window.dispatchEvent(new CustomEvent("squad-os:event-records-updated"));setModalOpen(false);setEventName("");setDayCount(1);setDayDrafts([]);setDayErrors({});setSetupStep("details");setStorageError("");
 }catch{setStorageError("Could not safely save this event. Existing records were left unchanged; check browser storage and try again.");}finally{saveLockRef.current=false;}
 }
 function returnToEventDetails(){setSetupStep("details");setDayErrors({});setStorageError("");}


  function matchDraftKey(recordId: string, dayId: string, matchNumber: number) { return recordId + ":" + dayId + ":" + matchNumber; }
  function readMatchDraft(record: TournamentEventRecord, day: EventDaySummary, matchNumber: number) {
    const saved = (day.matches || []).find(item => item.matchNumber === matchNumber);
    const key = matchDraftKey(record.id, day.id || String(day.dayNumber || 0), matchNumber);
    return matchDrafts[key] || { placement: saved?.placement == null ? "" : String(saved.placement), placementPoints: String(getPlacementPoints(saved?.placement ?? null)), kills: String(saved?.kills ?? 0) };
  }
  function updateMatchDraft(record: TournamentEventRecord, day: EventDaySummary, matchNumber: number, field: "placement" | "kills", value: string) {
    const key = matchDraftKey(record.id, day.id || String(day.dayNumber || 0), matchNumber);
    const current = readMatchDraft(record, day, matchNumber);
    const placement = field === "placement" ? (value === "" ? null : Number(value)) : (current.placement === "" ? null : Number(current.placement));
    setMatchDrafts(previous => ({ ...previous, [key]: { ...current, [field]: value, placementPoints: String(getPlacementPoints(placement)) } }));
    setMatchSaveMessage("");
  }
  function showMatchSaveToast(message: string) {
    setMatchSaveMessage(message);
    if (message.endsWith("saved.")) {
      window.setTimeout(() => setMatchSaveMessage(current => current === message ? "" : current), 1800);
      window.requestAnimationFrame(() => document.querySelector(".tournament-event-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }
  function saveDayStanding(record: TournamentEventRecord, day: EventDaySummary, value: number | null) {
    if (!canEditResults) return;
    const dayKey = day.id || String(day.dayNumber || 0);
    const next = records.map(item => item.id !== record.id ? item : { ...item, days: (item.days || []).map((entry, index) => (entry.id || String(entry.dayNumber || index + 1)) === dayKey ? { ...entry, overallStanding: value } : entry) });
    try { persistRecords(next, record.id); showMatchSaveToast("Day standing saved."); }
    catch { setMatchSaveMessage("Could not save day standing."); }
  }
  function saveEventStanding(record: TournamentEventRecord, value: number | null) {
    if (!canEditResults) return;
    try { persistRecords(records.map(item => item.id === record.id ? { ...item, overallPlacement: value } : item), record.id); showMatchSaveToast("Overall standing saved."); }
    catch { setMatchSaveMessage("Could not save overall standing."); }
  }
  function saveMatchResult(record: TournamentEventRecord, day: EventDaySummary, matchNumber: number) {
    if (!canEditResults) return;
    const key = matchDraftKey(record.id, day.id || String(day.dayNumber || 0), matchNumber), draft = matchDrafts[key] || readMatchDraft(record, day, matchNumber);
    const placement = draft.placement === "" ? null : Number(draft.placement), placementPoints = getPlacementPoints(placement), kills = Number(draft.kills);
    if (placement !== null && (!Number.isSafeInteger(placement) || placement < 1 || placement > 12)) { setMatchSaveMessage("Placement must be between 1 and 12."); return; }
    if (!Number.isSafeInteger(kills) || kills < 0) { setMatchSaveMessage("Kills must be a non-negative whole number."); return; }
    if (placement === null && kills > 0) { setMatchSaveMessage("Choose a placement before saving kills."); return; }
    try {
      const next = records.map(item => item.id !== record.id ? item : { ...item, days: (item.days || []).map(entry => {
        if ((entry.id || String(entry.dayNumber || 0)) !== (day.id || String(day.dayNumber || 0))) return entry;
        const existing = entry.matches || [], saved: EventMatchRecord = { id: existing.find(m => m.matchNumber === matchNumber)?.id || createId(), matchNumber, placement, placementPoints, kills };
        return { ...entry, matches: [...existing.filter(m => m.matchNumber !== matchNumber), saved].sort((a,b)=>a.matchNumber-b.matchNumber) };
      }) });
      persistRecords(next, record.id); window.dispatchEvent(new CustomEvent("squad-os:event-records-updated")); showMatchSaveToast("Match result saved.");
    } catch { setMatchSaveMessage("Could not save this match result."); }
  }
  function clearMatchResult(record: TournamentEventRecord, day: EventDaySummary, matchNumber: number) {
    if (!canEditResults) return;
    try {
      const next = records.map(item => item.id !== record.id ? item : { ...item, days: (item.days || []).map(entry =>
        (entry.id || String(entry.dayNumber || 0)) !== (day.id || String(day.dayNumber || 0)) ? entry : { ...entry, matches: (entry.matches || []).filter(match => match.matchNumber !== matchNumber) }
      ) });
      persistRecords(next, record.id);
      const key = matchDraftKey(record.id, day.id || String(day.dayNumber || 0), matchNumber);
      setMatchDrafts(current => { const copy={...current}; delete copy[key]; return copy; });
      window.dispatchEvent(new CustomEvent("squad-os:event-records-updated")); setMatchSaveMessage("Match result cleared.");
    } catch { setMatchSaveMessage("Could not clear this match result."); }
  }
  function beginEditRecord(record: TournamentEventRecord) {
    if (!canManageEvents) return;
    setEditingRecordId(record.id); setEditName(record.name);
    setEditDays((record.days || []).map((day,index)=>({id:day.id||createId(),dayNumber:day.dayNumber||index+1,date:day.date||"",matchCount:day.matchCount||1})));
    setEditError(""); setManagementMessage("");
  }
  function cancelEditRecord() { setEditingRecordId(null); setEditError(""); }
  function updateEditDay(dayId: string, field: "date" | "matchCount", value: string) {
    setEditDays(current=>current.map(day=>day.id===dayId?{...day,[field]:field==="matchCount"?(value===""?0:Number(value)):value}:day));
  }
  function saveEditedRecord(record: TournamentEventRecord) {
    if (!canManageEvents) return;
    const name=normalizeEventName(editName);
    if(!name||name.length>MAX_EVENT_NAME_LENGTH){setEditError("Enter a valid tournament name (maximum 80 characters).");return;}
    if(!editDays.length||editDays.length>MAX_EVENT_DAYS){setEditError("The event must contain at least one valid day.");return;}
    const dates=new Set<string>();let total=0;
    for(const day of editDays){
      if(!isValidCalendarDate(day.date)||dates.has(day.date)){setEditError("Every day needs a valid, unique date.");return;} dates.add(day.date);
      if(!Number.isSafeInteger(day.matchCount)||day.matchCount<1){setEditError("Each day needs at least one whole-number match.");return;}
      total+=day.matchCount;if(!Number.isSafeInteger(total)){setEditError("Combined match count is too large.");return;}
    }
    const originalDays = Array.isArray(record.days) ? record.days : [];
    const findOriginalDay = (draft: EventDayDraft, index: number) =>
      originalDays.find(day => day.id && day.id === draft.id) || originalDays[index] || null;
    const removal = originalDays.some((old, index) => {
      const draft = editDays.find(day => day.id && old.id === day.id) || editDays[index];
      return (old.matches || []).some(match => match.matchNumber > (draft?.matchCount ?? 0));
    });
    if(removal&&!window.confirm("Reducing match counts will remove saved results for matches beyond the new limit. Continue?"))return;
    try{
      const next=records.map(item=>item.id!==record.id?item:{...item,name,days:editDays.map((draft,index)=>{
        const old = findOriginalDay(draft,index);
        return {...draft,matches:(old?.matches||[]).filter(match=>match.matchNumber<=draft.matchCount)};
      })});
      persistRecords(next, record.id);setEditingRecordId(null);setEditError("");setManagementMessage("Tournament details updated.");window.dispatchEvent(new CustomEvent("squad-os:event-records-updated"));
    }catch{setEditError("Could not save changes. Existing tournament data was not updated.");}
  }
  function deleteEventRecord(record: TournamentEventRecord) {
    if (!canManageEvents) return;
    if(!window.confirm("Delete "+record.name+" and all its match results? This cannot be undone."))return;
    try{const next=records.filter(item=>item.id!==record.id); pendingDeletedIdsRef.current=[...new Set([...pendingDeletedIdsRef.current,record.id])]; window.localStorage.setItem(deletedStorageKey,JSON.stringify(pendingDeletedIdsRef.current)); persistRecords(next);setSelectedRecordId(null);setEditingRecordId(null);setManagementMessage("Tournament record deleted.");window.dispatchEvent(new CustomEvent("squad-os:event-records-updated"));}
    catch{setManagementMessage("Could not delete this tournament record.");}
  }

  return (
    <section className="tournament-event-records" aria-labelledby="tournament-event-records-title">

      <div className="tournament-event-sync-status" role="status" aria-live="polite">
        <span className={`tournament-event-sync-dot is-${syncStatus}`} aria-hidden="true" />
        <span>{syncStatus === "synced" ? "Synced to team" : syncStatus === "syncing" ? "Syncing…" : syncStatus === "offline" ? "Offline · saved on this device" : syncStatus === "conflict" ? "Sync conflict · local copy preserved" : syncStatus === "error" ? "Sync unavailable · local copy preserved" : "Saved on this device"}</span>
        {(syncStatus === "conflict" || syncStatus === "error" || syncStatus === "offline") && teamId && <button type="button" onClick={() => setRecords(current => [...current])}>Retry sync</button>}
      </div>
      {canManageEvents && teamId && legacyRecords.length > 0 && <div className="tournament-event-legacy-import">
        <span>{legacyRecords.length} previous local event{legacyRecords.length === 1 ? "" : "s"} found on this device. They are not assigned to a team yet.</span>
        <button type="button" onClick={importLegacyRecords}>Import to this team</button>
      </div>}

      <div className="tournament-event-records-head">
        <div>
          <div className="eyebrow">EVENT MODE · CUSTOM TOURNAMENTS</div>
          <h2 id="tournament-event-records-title">Tournament Records</h2>
          <p>Keep each custom tournament separate from your weekly cycle.</p>
        </div>
        <div className="tournament-event-records-actions">
          <span className="tournament-event-record-count">{records.length} {records.length === 1 ? "RECORD" : "RECORDS"}</span>
          {canManageEvents && <button type="button" className="tournament-event-add-button" onClick={openCreateModal}>
            <span aria-hidden="true">＋</span> Add Record
          </button>}
        </div>
      </div>

      {storageError && <p className="tournament-event-storage-error" role="alert">{storageError}</p>}

      {records.length === 0 ? (
        <div className="tournament-event-empty" role="status">
          <span className="tournament-event-empty-mark" aria-hidden="true">＋</span><strong>No Records</strong>
          <p>Your custom tournament records will appear here once you create one.</p>
        </div>
      ) : selectedRecord ? (
        <section className="tournament-event-workspace" aria-labelledby="tournament-event-workspace-title">
          <div className="tournament-event-workspace-top">
            <button type="button" className="tournament-event-back-button" onClick={() => { setSelectedRecordId(null); setSelectedDayId(null); }}><span aria-hidden="true">←</span> All Records</button>
            <span className="tournament-event-workspace-kicker">CUSTOM EVENT WORKSPACE</span>
          </div>
          <header className="tournament-event-workspace-header">
            <div><span className="tournament-event-workspace-label">TOURNAMENT OVERVIEW</span><h2 id="tournament-event-workspace-title">{selectedRecord.name}</h2><p>Review the schedule and match allocation for this event.</p></div>
            <div className="tournament-event-workspace-stats"><div><strong>{getEventSummary(selectedRecord).dayCount}</strong><span>DAYS</span></div><div><strong>{getEventSummary(selectedRecord).matchCount}</strong><span>MATCHES</span></div></div>
          </header>


          {canManageEvents && <div className="tournament-event-management-actions">
            <button type="button" onClick={() => beginEditRecord(selectedRecord)}>Edit Tournament</button>
            <button type="button" className="is-danger" onClick={() => deleteEventRecord(selectedRecord)}>Delete Tournament</button>
          </div>}
          {managementMessage && <p className="tournament-event-management-message" role="status">{managementMessage}</p>}
          {editingRecordId === selectedRecord.id && <section className="tournament-event-edit-panel" aria-label="Edit tournament details">
            <h3>Edit Tournament</h3>
            <label>Tournament name<input value={editName} maxLength={MAX_EVENT_NAME_LENGTH} onChange={e=>setEditName(e.target.value)}/></label>
            {editDays.map(day=><div className="tournament-event-edit-day" key={day.id}>
              <strong>Day {day.dayNumber}</strong>
              <label>Date<input type="date" value={day.date} onChange={e=>updateEditDay(day.id,"date",e.target.value)}/></label>
              <label>Matches<input type="number" min="1" step="1" value={day.matchCount||""} onChange={e=>updateEditDay(day.id,"matchCount",e.target.value)}/></label>
            </div>)}
            {editError && <p role="alert">{editError}</p>}
            <div className="tournament-event-edit-actions"><button type="button" onClick={()=>saveEditedRecord(selectedRecord)}>Save Changes</button><button type="button" className="is-cancel" onClick={cancelEditRecord}>Cancel</button></div>
          </section>}

          {matchSaveMessage && <p className="tournament-event-match-message" role="status" aria-live="polite">{matchSaveMessage}</p>}
          {!selectedDay ? <>
            <div className="tournament-event-workspace-section-head"><h3>Overall Tournament Report</h3><span>ALL DAYS</span></div>
            <div className="tournament-event-scoreboard">
              <div><span>TOTAL MATCHES</span><strong>{getEventSummary(selectedRecord).matchCount}</strong></div>
              <div><span>RECORDED</span><strong>{(selectedRecord.days || []).reduce((sum,d)=>sum+(Array.isArray(d.matches)?d.matches.filter(m=>m.placement!==null).length:0),0)}</strong></div>
              <div><span>TOTAL KILLS</span><strong>{(selectedRecord.days || []).reduce((sum,d)=>sum+(d.matches||[]).reduce((n,m)=>n+m.kills,0),0)}</strong></div>
              <div><span>TOTAL POINTS</span><strong>{(selectedRecord.days || []).reduce((sum,d)=>sum+(d.matches||[]).reduce((n,m)=>n+getPlacementPoints(m.placement)+m.kills,0),0)}</strong></div>
            </div>
            <section className="tournament-event-standing-panel" aria-label="Overall tournament standing">
              <div><span>FINAL OVERALL STANDING</span><strong>{selectedRecord.overallPlacement ? "#"+selectedRecord.overallPlacement : "Not set"}</strong></div>
              <label>Overall position
                <PlacementPicker value={selectedRecord.overallPlacement ?? null} disabled={!canEditResults} onChange={n=>saveEventStanding(selectedRecord,n)} onClear={()=>saveEventStanding(selectedRecord,null)}/>
              </label>
            </section>
            <div className="tournament-event-workspace-section-head"><h3>Select a Day</h3><span>{(selectedRecord.days || []).length} DAYS</span></div>
            <div className="tournament-event-day-selector">
              {(Array.isArray(selectedRecord.days) ? [...selectedRecord.days] : []).sort((x,y)=>(Number(x.dayNumber)||0)-(Number(y.dayNumber)||0)).map((day,index)=>{
                const dayNumber=Number.isSafeInteger(day.dayNumber)&&Number(day.dayNumber)>0?Number(day.dayNumber):index+1;
                const matchCount=Number.isSafeInteger(day.matchCount)&&Number(day.matchCount)>0?Number(day.matchCount):0;
                const dayMatches=Array.isArray(day.matches)?day.matches:[];
                const completed=dayMatches.filter(m=>m.placement!==null).length;
                const kills=dayMatches.reduce((n,m)=>n+m.kills,0);
                const points=dayMatches.reduce((n,m)=>n+getPlacementPoints(m.placement)+m.kills,0);
                const dayKey=day.id || String(day.dayNumber || dayNumber);
                return <button type="button" className="tournament-event-day-select" key={dayKey} onClick={()=>{setSelectedDayId(dayKey);setMatchSaveMessage("");}}>
                  <span className="tournament-event-day-select-index">{String(dayNumber).padStart(2,"0")}</span>
                  <span className="tournament-event-day-select-copy"><strong>Day {dayNumber}</strong><small>{day.date?formatDate(day.date):"Date not configured"} · {completed}/{matchCount} matches</small><small>{kills} kills · {points} total points</small></span>
                  <span className="tournament-event-day-select-standing">{day.overallStanding ? "#"+day.overallStanding : "—"}<small>Standing</small></span>
                  <span aria-hidden="true">›</span>
                </button>;
              })}
            </div>
            {(!Array.isArray(selectedRecord.days)||selectedRecord.days.length===0)&&<div className="tournament-event-workspace-legacy" role="status">This is an older event record without day details. Its original record is preserved.</div>}
          </> : <>
            <div className="tournament-event-day-detail-top">
              <button type="button" className="tournament-event-back-button" onClick={()=>{setSelectedDayId(null);setMatchSaveMessage("");}}>← Overall Tournament</button>
              <span>DAY {String(selectedDay.dayNumber || 1).padStart(2,"0")} DETAILS</span>
            </div>
            <header className="tournament-event-day-detail-header">
              <div><span className="tournament-event-workspace-label">SELECTED TOURNAMENT DAY</span><h3>Day {selectedDay.dayNumber || 1}</h3><p>{selectedDay.date ? formatDate(selectedDay.date) : "Date not configured"}</p></div>
              <div className="tournament-event-day-standing"><span>DAY STANDING</span><strong>{selectedDay.overallStanding ? "#"+selectedDay.overallStanding : "—"}</strong></div>
            </header>
            <section className="tournament-event-standing-panel" aria-label="Day overall standing">
              <div><span>DAY OVERALL POSITION</span><strong>{selectedDay.overallStanding ? "#"+selectedDay.overallStanding : "Not set"}</strong></div>
              <label>Day position
                <PlacementPicker value={selectedDay.overallStanding ?? null} disabled={!canEditResults} onChange={n=>saveDayStanding(selectedRecord,selectedDay,n)} onClear={()=>saveDayStanding(selectedRecord,selectedDay,null)}/>
              </label>
            </section>
            <div className="tournament-event-scoreboard">
              <div><span>DAY MATCHES</span><strong>{selectedDay.matchCount || 0}</strong></div>
              <div><span>RECORDED</span><strong>{(selectedDay.matches || []).filter(m=>m.placement!==null).length}</strong></div>
              <div><span>TOTAL KILLS</span><strong>{(selectedDay.matches || []).reduce((n,m)=>n+m.kills,0)}</strong></div>
              <div><span>TOTAL POINTS</span><strong>{(selectedDay.matches || []).reduce((n,m)=>n+getPlacementPoints(m.placement)+m.kills,0)}</strong></div>
            </div>
            {!canEditResults && <p className="tournament-event-readonly-note">Results are read-only. Only the designated IGL, Coach or Owner can update match results and standings.</p>}
            <div className="tournament-event-match-grid">
              {Array.from({length:Math.max(0,Number(selectedDay.matchCount)||0)},(_,i)=>{
                const matchNo=i+1, saved=(selectedDay.matches || []).find(m=>m.matchNumber===matchNo), draft=readMatchDraft(selectedRecord,selectedDay,matchNo);
                return <div className="tournament-event-match-card" key={matchNo}>
                  <div className="tournament-event-match-card-head"><strong>MATCH {String(matchNo).padStart(2,"0")}</strong><span className={saved&&saved.placement!==null?"is-recorded":"is-pending"}>{saved&&saved.placement!==null?"RECORDED":"PENDING"}</span></div>
                  <div className="tournament-event-match-fields">
                    <label>Placement<PlacementPicker value={draft.placement === "" ? null : Number(draft.placement)} disabled={!canEditResults} onChange={n=>updateMatchDraft(selectedRecord,selectedDay,matchNo,"placement",String(n))} onClear={()=>updateMatchDraft(selectedRecord,selectedDay,matchNo,"placement","")}/></label>
                    <label>Placement points<strong className="tournament-event-derived-points">{getPlacementPoints(draft.placement === "" ? null : Number(draft.placement))}</strong></label>
                    <label>Kills<input type="text" inputMode="numeric" pattern="[0-9]*" value={draft.kills} disabled={!canEditResults} onChange={e=>updateMatchDraft(selectedRecord,selectedDay,matchNo,"kills",e.target.value.replace(/[^0-9]/g,""))}/></label>
                  </div>
                  <div className="tournament-event-match-total"><span>Match points</span><strong>{getPlacementPoints(draft.placement === "" ? null : Number(draft.placement))+(Number(draft.kills)||0)}</strong></div>
                  {canEditResults && <div className="tournament-event-match-actions"><button type="button" onClick={()=>saveMatchResult(selectedRecord,selectedDay,matchNo)}>Save Result</button>{saved&&<button type="button" className="is-clear" onClick={()=>clearMatchResult(selectedRecord,selectedDay,matchNo)}>Clear</button>}</div>}
                </div>;
              })}
            </div>
          </>}
          {(!Array.isArray(selectedRecord.days)||selectedRecord.days.length===0)&&<div className="tournament-event-workspace-legacy" role="status">This is an older event record without day details. Its original record is preserved.</div>}
        </section>
      ) : (
        <>
          <div className="tournament-event-record-list">
            {visibleRecords.map((record,index)=>{const summary=getEventSummary(record);return <button type="button" className="tournament-event-record-card" key={record.id} onClick={()=>{setSelectedRecordId(record.id);setSelectedDayId(null);setExpanded(false);}} aria-label={`Open ${record.name} tournament workspace`}>
              <span className="tournament-event-record-index">{String(index+1).padStart(2,"0")}</span>
              <span className="tournament-event-record-copy"><strong>{record.name}</strong><span className="tournament-event-record-meta"><span>{summary.dateLabel}</span><span>{summary.dayCount} {summary.dayCount===1?"day":"days"}</span><span>{summary.matchCount} {summary.matchCount===1?"match":"matches"}</span></span></span>
              <span className="tournament-event-record-arrow" aria-hidden="true">↗</span>
            </button>;})}
          </div>
          {hasMore&&<div className="tournament-event-list-footer"><button type="button" className="tournament-event-more-button" onClick={()=>setExpanded(value=>!value)}>{expanded?"Show Less":`More · ${records.length-INITIAL_VISIBLE_RECORDS} more`}<span aria-hidden="true">{expanded?"↑":"↓"}</span></button></div>}
        </>
      )}

      <dialog
        ref={dialogRef}
        className="tournament-event-modal"
        aria-labelledby="tournament-event-modal-title"
        onCancel={(event) => { event.preventDefault(); closeCreateModal(); }}
        onClose={() => setModalOpen(false)}
        onClick={(event) => { if (event.target === dialogRef.current) closeCreateModal(); }}
      >
        {setupStep === "details" ? (
          <form className="tournament-event-modal-form" onSubmit={handleCreateEvent} noValidate>
            <div className="tournament-event-modal-topline">
              <span className="tournament-event-modal-kicker">NEW EVENT · STEP 1 OF 2</span>
              <button type="button" className="tournament-event-modal-close" aria-label="Close create tournament dialog" onClick={closeCreateModal}>×</button>
            </div>
            <div className="tournament-event-modal-heading">
              <span className="tournament-event-modal-icon" aria-hidden="true">✦</span>
              <div><h2 id="tournament-event-modal-title">Create Tournament</h2><p>Set up a custom event independently from your weekly tournament.</p></div>
            </div>
            <label className="tournament-event-field-label" htmlFor="tournament-event-name">Tournament Name</label>
            <input ref={nameInputRef} id="tournament-event-name" className="tournament-event-name-input" type="text" value={eventName}
              onChange={(event) => { setEventName(event.target.value); setFormError(""); }} maxLength={MAX_EVENT_NAME_LENGTH}
              placeholder="Enter tournament name" autoComplete="off" required />
            <div className="tournament-event-input-foot">
              {formError ? <span className="tournament-event-form-error" role="alert">{formError}</span> : <span>Choose a clear name for this event.</span>}
              <span>{eventName.length}/{MAX_EVENT_NAME_LENGTH}</span>
            </div>
            <div className="tournament-event-day-count-panel">
              <div><span className="tournament-event-field-label">Number of Days</span><p>Choose how many days this event will include.</p></div>
              <div className="tournament-event-stepper" aria-label="Tournament day count">
                <button type="button" aria-label="Decrease tournament days" onClick={() => changeDayCount(-1)} disabled={dayCount <= MIN_EVENT_DAYS}>−</button>
                <output aria-live="polite" aria-atomic="true">{dayCount}</output>
                <button type="button" aria-label="Increase tournament days" onClick={() => changeDayCount(1)} disabled={dayCount >= MAX_EVENT_DAYS}>＋</button>
              </div>
            </div>
            <p className="tournament-event-day-count-note">Configure a separate date and match count for every day in the next step. Maximum {MAX_EVENT_DAYS} days per event.</p>
            <div className="tournament-event-modal-footer">
              <button type="button" className="tournament-event-cancel-button" onClick={closeCreateModal}>Cancel</button>
              <button type="submit" className="tournament-event-create-button">Continue <span aria-hidden="true">→</span></button>
            </div>
          </form>
        ) : (
          <form className="tournament-event-modal-form tournament-event-days-form" onSubmit={handleSaveConfiguredEvent} noValidate>
            <div className="tournament-event-modal-topline">
              <span className="tournament-event-modal-kicker">NEW EVENT · STEP 2 OF 2</span>
              <button type="button" className="tournament-event-modal-close" aria-label="Close create tournament dialog" onClick={closeCreateModal}>×</button>
            </div>
            <div className="tournament-event-modal-heading">
              <span className="tournament-event-modal-icon" aria-hidden="true">▦</span>
              <div><h2 id="tournament-event-modal-title">Configure Event Days</h2><p><strong>{eventName.trim()}</strong> · Set a date and match count for each day.</p></div>
            </div>
            <div className="tournament-event-days-summary"><span>{dayDrafts.length} {dayDrafts.length === 1 ? "DAY" : "DAYS"} IN THIS EVENT</span><span>Dates can be non-consecutive</span></div>
            <div className="tournament-event-day-config-list">
              {dayDrafts.map((day) => (
                <section className="tournament-event-day-config-card" key={day.id} aria-labelledby={`event-day-title-${day.id}`}>
                  <div className="tournament-event-day-config-heading"><span className="tournament-event-day-number">DAY {day.dayNumber}</span><strong id={`event-day-title-${day.id}`}>Day {day.dayNumber} details</strong></div>
                  <div className="tournament-event-day-config-fields">
                    <label className="tournament-event-day-field"><span>Date</span>
                      <input type="date" value={day.date} onChange={(event) => updateDayDraft(day.id, "date", event.target.value)}
                        aria-label={`Date for day ${day.dayNumber}`} aria-invalid={Boolean(dayErrors[day.id])}
                        aria-describedby={dayErrors[day.id] ? `event-day-error-${day.id}` : undefined} />
                    </label>
                    <label className="tournament-event-day-field"><span>Matches</span>
                      <input type="number" inputMode="numeric" min="1" step="1" value={day.matchCount || ""}
                        onChange={(event) => updateDayDraft(day.id, "matchCount", event.target.value)}
                        aria-label={`Match count for day ${day.dayNumber}`} />
                    </label>
                  </div>
                  {dayErrors[day.id] && <p className="tournament-event-day-error" id={`event-day-error-${day.id}`} role="alert">{dayErrors[day.id]}</p>}
                </section>
              ))}
            </div>
            <div className="tournament-event-modal-footer tournament-event-days-footer">
              <button type="button" className="tournament-event-cancel-button" onClick={returnToEventDetails}>Back</button>
              <button type="submit" className="tournament-event-create-button">Save Event <span aria-hidden="true">→</span></button>
            </div>
          </form>
        )}
      </dialog>
    </section>
  );
}
