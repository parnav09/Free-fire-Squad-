import { useEffect, useMemo, useState } from "react";
import "./TournamentEventRecords.css";

type EventDaySummary = {
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

export default function TournamentEventRecords() {
  const [records, setRecords] = useState<TournamentEventRecord[]>(readEventRecords);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const refreshRecords = () => setRecords(readEventRecords());
    window.addEventListener("storage", refreshRecords);
    window.addEventListener("squad-os:event-records-updated", refreshRecords);
    return () => {
      window.removeEventListener("storage", refreshRecords);
      window.removeEventListener("squad-os:event-records-updated", refreshRecords);
    };
  }, []);

  const visibleRecords = useMemo(
    () => expanded ? records : records.slice(0, INITIAL_VISIBLE_RECORDS),
    [expanded, records]
  );
  const hasMore = records.length > INITIAL_VISIBLE_RECORDS;

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
          <button type="button" className="tournament-event-add-button" disabled aria-describedby="tournament-event-add-hint">
            <span aria-hidden="true">＋</span> Add Record
          </button>
          <small id="tournament-event-add-hint">Record creation unlocks in Phase 3.</small>
        </div>
      </div>

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
    </section>
  );
}
