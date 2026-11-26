import { useEffect, useMemo, useRef, useState } from "react";
import "./TournamentEventRecords.css";

type EventDaySummary = {
  id?: string;
  dayNumber?: number;
  date?: string;
  matchCount?: number;
};

type TournamentEventRecord = {
  id: string;
  name: string;
  createdAt?: string;
  days?: EventDaySummary[];
};

type EventDayDraft = { id: string; dayNumber: number; date: string; matchCount: number; };

const STORAGE_KEY = "squad-os-event-tournament-records";
const INITIAL_VISIBLE_RECORDS = 4;
const MIN_EVENT_DAYS = 1;
const MAX_EVENT_DAYS = 60;
const MAX_EVENT_NAME_LENGTH = 80;

function readEventRecords(): TournamentEventRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
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

export default function TournamentEventRecords() {
  const [records, setRecords] = useState<TournamentEventRecord[]>(readEventRecords);
  const [expanded, setExpanded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [eventName, setEventName] = useState("");
  const [dayCount, setDayCount] = useState(1);
  const [setupStep, setSetupStep] = useState<"details" | "days">("details");
  const [dayDrafts, setDayDrafts] = useState<EventDayDraft[]>([]);
  const [dayErrors, setDayErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [storageError, setStorageError] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const refreshRecords = () => setRecords(readEventRecords());
    window.addEventListener("storage", refreshRecords);
    window.addEventListener("squad-os:event-records-updated", refreshRecords);
    return () => {
      window.removeEventListener("storage", refreshRecords);
      window.removeEventListener("squad-os:event-records-updated", refreshRecords);
    };
  }, []);

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

  function openCreateModal() {
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
    if (!Number.isSafeInteger(dayCount) || dayCount < MIN_EVENT_DAYS || dayCount > MAX_EVENT_DAYS) { setFormError("Choose a valid number of tournament days."); return; }\n    setEventName(trimmedName);\n    setDayDrafts(Array.from({ length: dayCount }, (_, index) => ({
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
  if(!day.id||ids.has(day.id))errors[day.id||`day-${day.dayNumber}']="This day configuration is duplicated."; ids.add(day.id);
  if(!Number.isSafeInteger(day.dayNumber)||day.dayNumber<1||day.dayNumber>dayCount||numbers.has(day.dayNumber))errors[day.id]="Day order is invalid."; numbers.add(day.dayNumber);
  if(!day.date)errors[day.id]="Choose a date for this day.";else if(!isValidCalendarDate(day.date))errors[day.id]="Enter a valid calendar date.";else if(dates.has(day.date))errors[day.id]="Each tournament day must have a different date."; if(day.date)dates.add(day.date);
  if(!Number.isSafeInteger(day.matchCount)||day.matchCount<1)errors[day.id]="Enter a whole-number match count of at least 1.";else{total+=day.matchCount;if(!Number.isSafeInteger(total))errors[day.id]="The combined match count is too large. Reduce the match counts.";}
 }
 if(numbers.size!==dayCount||Array.from({length:dayCount},(_,i)=>i+1).some(n=>!numbers.has(n))){setStorageError("The day sequence is incomplete. Go back and recreate the day list.");saveLockRef.current=false;return;}
 if(Object.keys(errors).length){setDayErrors(errors);saveLockRef.current=false;return;}
 try{
  const raw=window.localStorage.getItem(STORAGE_KEY);let existing:TournamentEventRecord[]=[];
  if(raw){const parsed:unknown=JSON.parse(raw);if(!Array.isArray(parsed))throw new Error("Invalid records");existing=parsed.filter((x):x is TournamentEventRecord=>x!==null&&typeof x==="object"&&typeof x.id==="string"&&typeof x.name==="string"&&x.name.trim().length>0);if(existing.length!==parsed.length)throw new Error("Unreadable records");}
  const used=new Set(existing.map(x=>x.id));let id=createId();while(used.has(id))id=createId();
  const record:TournamentEventRecord={id,name:normalizedName,createdAt:new Date().toISOString(),days:[...dayDrafts].sort((x,y)=>x.dayNumber-y.dayNumber).map(d=>({id:d.id,dayNumber:d.dayNumber,date:d.date,matchCount:d.matchCount}))};
  const next=[record,...existing];window.localStorage.setItem(STORAGE_KEY,JSON.stringify(next));setRecords(next);setExpanded(false);window.dispatchEvent(new CustomEvent("squad-os:event-records-updated"));setModalOpen(false);setEventName("");setDayCount(1);setDayDrafts([]);setDayErrors({});setSetupStep("details");setStorageError("");
 }catch{setStorageError("Could not safely save this event. Existing records were left unchanged; check browser storage and try again.");}finally{saveLockRef.current=false;}
 }
 function returnToEventDetails(){setSetupStep("details");setDayErrors({});setStorageError("");}

  return (
    <section className="tournament-event-records" aria-labelledby="tournament-event-records-title">
      <div className="tournament-event-records-head">
        <div>
          <div className="eyebrow">EVENT MODE · CUSTOM TOURNAMENTS</div>
          <h2 id="tournament-event-records-title">Tournament Records</h2>
          <p>Keep each custom tournament separate from your weekly cycle.</p>
        </div>
        <div className="tournament-event-records-actions">
          <span className="tournament-event-record-count">{records.length} {records.length === 1 ? "RECORD" : "RECORDS"}</span>
          <button type="button" className="tournament-event-add-button" onClick={openCreateModal}>
            <span aria-hidden="true">＋</span> Add Record
          </button>
        </div>
      </div>

      {storageError && <p className="tournament-event-storage-error" role="alert">{storageError}</p>}

      {records.length === 0 ? (
        <div className="tournament-event-empty" role="status">
          <span className="tournament-event-empty-mark" aria-hidden="true">＋</span>
          <strong>No Records</strong>
          <p>Your custom tournament records will appear here once you create one.</p>
        </div>
      ) : (
        <>
          <div className="tournament-event-record-list">
            {visibleRecords.map((record, index) => {
              const summary = getEventSummary(record);
              return (
                <article className="tournament-event-record-card" key={record.id}>
                  <span className="tournament-event-record-index">{String(index + 1).padStart(2, "0")}</span>
                  <div className="tournament-event-record-copy">
                    <h3>{record.name}</h3>
                    <div className="tournament-event-record-meta">
                      <span>{summary.dateLabel}</span>
                      <span>{summary.dayCount} {summary.dayCount === 1 ? "day" : "days"}</span>
                      <span>{summary.matchCount} {summary.matchCount === 1 ? "match" : "matches"}</span>
                    </div>
                  </div>
                  <span className="tournament-event-record-arrow" aria-hidden="true">↗</span>
                </article>
              );
            })}
          </div>
          {hasMore && (
            <div className="tournament-event-list-footer">
              <button type="button" className="tournament-event-more-button" onClick={() => setExpanded((value) => !value)}>
                {expanded ? "Show Less" : `More · ${records.length - INITIAL_VISIBLE_RECORDS} more`}
                <span aria-hidden="true">{expanded ? "↑" : "↓"}</span>
              </button>
            </div>
          )}
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
