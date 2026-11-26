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
    const trimmedName = eventName.trim();
    if (!trimmedName) {
      setFormError("Enter a tournament name to continue.");
      nameInputRef.current?.focus();
      return;
    }
    if (trimmedName.length > MAX_EVENT_NAME_LENGTH) {
      setFormError(`Tournament name must be ${MAX_EVENT_NAME_LENGTH} characters or fewer.`);
      return;
    }
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
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    const seenDates = new Set<string>();
    for (const day of dayDrafts) {
      if (!day.date) nextErrors[day.id] = "Choose a date for this day.";
      else if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(day.date) || Number.isNaN(new Date(`${day.date}T00:00:00`).getTime())) nextErrors[day.id] = "Enter a valid calendar date.";
      else if (seenDates.has(day.date)) nextErrors[day.id] = "Each tournament day must have a different date.";
      else if (!Number.isSafeInteger(day.matchCount) || day.matchCount < 1) nextErrors[day.id] = "Enter at least 1 match.";
      if (day.date) seenDates.add(day.date);
    }
    if (Object.keys(nextErrors).length) { setDayErrors(nextErrors); return; }

    const newRecord: TournamentEventRecord = {
      id: createId(),
      name: eventName.trim(),
      createdAt: new Date().toISOString(),
      days: dayDrafts.map((day) => ({ id: day.id, dayNumber: day.dayNumber, date: day.date, matchCount: day.matchCount }))
    };
    try {
      const nextRecords = [newRecord, ...readEventRecords()];
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRecords));
      setRecords(nextRecords);
      setExpanded(false);
      window.dispatchEvent(new CustomEvent("squad-os:event-records-updated"));
      setModalOpen(false);
      setEventName("");
      setDayCount(1);
      setDayDrafts([]);
      setDayErrors({});
      setSetupStep("details");
      setStorageError("");
    } catch {
      setStorageError("Could not save this record on this device. Check available browser storage and try again.");
    }
  }

  function returnToEventDetails() { setSetupStep("details"); setDayErrors({}); }

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
