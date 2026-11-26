import "./TournamentModeFoundation.css";

export type TournamentMode = "Weekly" | "Event";

type TournamentModeFoundationProps = {
  mode: TournamentMode;
  onChange: (mode: TournamentMode) => void;
};

export default function TournamentModeFoundation({ mode, onChange }: TournamentModeFoundationProps) {
  return (
    <div className="tournament-mode-switch-wrap">
      <div className="tournament-mode-switch" role="group" aria-label="Tournament modes">
        <button
          type="button"
          aria-pressed={mode === "Weekly"}
          className={mode === "Weekly" ? "active" : ""}
          onClick={() => onChange("Weekly")}
        >
          <span>Weekly</span>
          <small>7-day cycle</small>
        </button>
        <button
          type="button"
          aria-pressed={mode === "Event"}
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
