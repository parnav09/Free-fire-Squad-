type AnalyticsSectionProps = {
  totalMatches: number;
  points: number;
  analyticsMatches: Array<{ kills: number; placement?: number | null }>;
  rosterSize: number;
};

export default function AnalyticsSection({ totalMatches, points, analyticsMatches, rosterSize }: AnalyticsSectionProps) {
  const averageKills = totalMatches
    ? (analyticsMatches.reduce((sum, match) => sum + match.kills, 0) / totalMatches).toFixed(1)
    : "0.0";
  const scored = analyticsMatches.filter(m => m.placement != null && Number.isFinite(m.placement));
  const perMatch = scored.map(m => (m.placement === 1 ? 12 : m.placement === 2 ? 9 : m.placement === 3 ? 8 : m.placement === 4 ? 7 : m.placement === 5 ? 6 : m.placement === 6 ? 5 : m.placement === 7 ? 4 : m.placement === 8 ? 3 : m.placement === 9 ? 2 : m.placement === 10 ? 1 : 0) + Math.max(0, m.kills));
  const recent = perMatch.slice(-6);
  const avg = recent.length ? recent.reduce((a,b)=>a+b,0)/recent.length : 0;
  const variance = recent.length ? recent.reduce((a,b)=>a+(b-avg)**2,0)/recent.length : 0;
  const spread = Math.sqrt(variance);
  const projected = Math.round(avg*6);
  const low = Math.max(0,Math.round((avg-spread*.75)*6));
  const high = Math.round((avg+spread*.75)*6);
  const forecastLabel = recent.length>=6 ? "Recent-form estimate" : recent.length>=3 ? "Early estimate" : "Not enough match data";
  const metrics: Array<[string, string | number]> = [
    ["Recorded matches", totalMatches],
    ["Placement + kills points", points],
    ["Average kills", averageKills],
    ["Roster size", rosterSize],
  ];

  return (
    <>
      <div className="section-heading">
        <div>
          <div className="eyebrow">COMPETITIVE RESULTS · LEGACY VIEW</div>
          <h2>Competitive results</h2>
          <p>These metrics describe match outcomes only. Player-development analytics are planned for Evolution Phase Nine.</p>
        </div>
        <span className="phase-pill">WEEKLY SUMMARY</span>
      </div>
      <div className="foundation-grid">
        {metrics.map(([label, value], index) => (
          <article className="foundation-card" key={label}>
            <div className="card-index">0{index + 1}</div>
            <div className="card-label">{label}</div>
            <div className="card-value">{value}</div>
          </article>
        ))}
      </div>
      <section className="connection-panel score-forecast-panel">
        <div className="backup-panel-head"><div><div className="eyebrow">MODEL · LAST {recent.length} SCORED MATCHES</div><h3>Score level prediction</h3><p>Six-match projection based on your recent placement + kill points. This is an estimate, not a guaranteed result.</p></div><span className="phase-pill">{forecastLabel}</span></div>
        {recent.length>=3 ? <div className="score-forecast-grid"><article><small>Projected 6-match points</small><strong>{projected}</strong></article><article><small>Expected range</small><strong>{low}–{high}</strong></article><article><small>Average / match</small><strong>{avg.toFixed(1)}</strong></article></div> : <p className="muted">Record at least 3 completed matches with placement to unlock a meaningful forecast. Kills-only entries are excluded.</p>}
        <small className="muted">Confidence improves with more complete matches. Forecast recalculates from this active team’s own match history.</small>
      </section>
      <section className="connection-panel">
        <div>
          <div className="eyebrow">SQUAD PERFORMANCE</div>
          <h3>Current team records</h3>
          <p>Metrics are calculated from the selected team’s match history.</p>
        </div>
      </section>
    </>
  );
}
