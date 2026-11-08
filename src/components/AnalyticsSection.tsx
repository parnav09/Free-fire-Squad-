type AnalyticsSectionProps = {
  totalMatches: number;
  points: number;
  analyticsMatches: Array<{ kills: number }>;
  rosterSize: number;
};

export default function AnalyticsSection({ totalMatches, points, analyticsMatches, rosterSize }: AnalyticsSectionProps) {
  const averageKills = totalMatches
    ? (analyticsMatches.reduce((sum, match) => sum + match.kills, 0) / totalMatches).toFixed(1)
    : "0.0";

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
          <div className="eyebrow">PERFORMANCE SNAPSHOT</div>
          <h2>Current week</h2>
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
