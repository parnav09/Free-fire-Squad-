import "./TournamentModeFoundation.css";

export type TournamentMode = "Weekly" | "Event";

type TournamentModeFoundationProps = {
  mode: TournamentMode;
  onChange: (mode: TournamentMode) => void;
};

export default function TournamentModeFoundation({ mode, onChange }: TournamentModeFoundationProps) {
  return (
    <div className="tournament-mode-switch-wrap">
      <div className="tournament-mode-switch" role="tablist" aria-label="Tournament modes">
        <button
          type="button"
          role="tab"
          id="tournament-weekly-tab"
          aria-selected={mode === "Weekly"}
          aria-controls="tournament-mode-panel"
          tabIndex={mode === "Weekly" ? 0 : -1}
          className={mode === "Weekly" ? "active" : ""}
          onClick={() => onChange("Weekly")}
        >
          <span>Weekly</span>
          <small>7-day cycle</small>
        </button>
        <button
          type="button"
          role="tab"
          id="tournament-event-tab"
          aria-selected={mode === "Event"}
          aria-controls="tournament-mode-panel"
          tabIndex={mode === "Event" ? 0 : -1}
          className={mode === "Event" ? "active" : ""}
          onClick={() => onChange("Event")}
        >
          <span>Event</span>
          <small>Custom tournament</small>
        </button>
      </div>
      <span className="tournament-mode-context" aria-live="polite">
        {mode === "Weekly" ? "Existing weekly tournament" : "Separate event workspace"}
      </span>
    </div>
  );
}
