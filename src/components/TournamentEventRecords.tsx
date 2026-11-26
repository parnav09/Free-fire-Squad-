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

    const newRecord: TournamentEventRecord = {
      id: createId(),
      name: trimmedName,
      createdAt: new Date().toISOString(),
      days: Array.from({ length: dayCount }, (_, index) => ({
        id: createId(),
        dayNumber: index + 1,
        date: "",
        matchCount: 0
      }))
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
      setStorageError("");
    } catch {
      setStorageError("Could not save this record on this device. Check available browser storage and try again.");
    }
  }

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
        <form className="tournament-event-modal-form" onSubmit={handleCreateEvent} noValidate>
          <div className="tournament-event-modal-topline">
            <span className="tournament-event-modal-kicker">NEW EVENT · SETUP</span>
            <button type="button" className="tournament-event-modal-close" aria-label="Close create tournament dialog" onClick={closeCreateModal}>×</button>
          </div>
          <div className="tournament-event-modal-heading">
            <span className="tournament-event-modal-icon" aria-hidden="true">✦</span>
            <div>
              <h2 id="tournament-event-modal-title">Create Tournament</h2>
              <p>Set up a custom event independently from your weekly tournament.</p>
            </div>
          </div>

          <label className="tournament-event-field-label" htmlFor="tournament-event-name">Tournament Name</label>
          <input
            ref={nameInputRef}
            id="tournament-event-name"
            className="tournament-event-name-input"
            type="text"
            value={eventName}
            onChange={(event) => { setEventName(event.target.value); setFormError(""); }}
            maxLength={MAX_EVENT_NAME_LENGTH}
            placeholder="Enter tournament name"
            autoComplete="off"
            required
          />
          <div className="tournament-event-input-foot">
            {formError ? <span className="tournament-event-form-error" role="alert">{formError}</span> : <span>Choose a clear name for this event.</span>}
            <span>{eventName.length}/{MAX_EVENT_NAME_LENGTH}</span>
          </div>

          <div className="tournament-event-day-count-panel">
            <div>
              <span className="tournament-event-field-label">Number of Days</span>
              <p>Choose how many days this event will include.</p>
            </div>
            <div className="tournament-event-stepper" aria-label="Tournament day count">
              <button type="button" aria-label="Decrease tournament days" onClick={() => changeDayCount(-1)} disabled={dayCount <= MIN_EVENT_DAYS}>−</button>
              <output aria-live="polite" aria-atomic="true">{dayCount}</output>
              <button type="button" aria-label="Increase tournament days" onClick={() => changeDayCount(1)} disabled={dayCount >= MAX_EVENT_DAYS}>＋</button>
            </div>
          </div>
          <p className="tournament-event-day-count-note">You can configure each day’s date and match count in the next setup step. Maximum {MAX_EVENT_DAYS} days per event.</p>

          <div className="tournament-event-modal-footer">
            <button type="button" className="tournament-event-cancel-button" onClick={closeCreateModal}>Cancel</button>
            <button type="submit" className="tournament-event-create-button">Create Event <span aria-hidden="true">→</span></button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
