import { isSupabaseConfigured } from "./lib/supabase/client";

const foundationCards = [
  { label: "Squad", value: "Fixed roster", detail: "One team workspace" },
  { label: "Tournament", value: "7 days", detail: "Monday → Sunday" },
  { label: "Matchday", value: "6 matches", detail: "Per scheduled day" },
  { label: "Practice", value: "Separate", detail: "Never mixed with tournament results" },
];

export default function App() {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">S</div>
        <div className="brand-copy">
          <span className="brand-name">SQUAD OS</span>
          <span className="brand-caption">TEAM OPERATIONS</span>
        </div>
        <div className="sidebar-divider" />
        <div className="nav-label">WORKSPACE</div>
        <div className="nav-item nav-item-active"><span className="nav-dot" /> Overview</div>
        <div className="nav-item nav-item-muted">Tournament</div>
        <div className="nav-item nav-item-muted">Training</div>
        <div className="nav-item nav-item-muted">Players</div>
        <div className="nav-item nav-item-muted">Analytics</div>
        <div className="sidebar-bottom">M1 · FOUNDATION</div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div className="breadcrumb">WORKSPACE <span>/</span> OVERVIEW</div>
          <div className="system-status"><i /> SYSTEM FOUNDATION</div>
        </header>

        <div className="content">
          <div className="eyebrow">SQUAD MANAGEMENT PLATFORM</div>
          <h1>Run the team.<br /><span>Know the numbers.</span></h1>
          <p className="intro">
            A single workspace for tournament records, training, player development,
            and squad performance.
          </p>

          <div className="section-heading">
            <div>
              <div className="eyebrow">CORE STRUCTURE</div>
              <h2>Workspace foundation</h2>
            </div>
            <span className="phase-pill">M1 / IN PROGRESS</span>
          </div>

          <div className="foundation-grid">
            {foundationCards.map((card, index) => (
              <article className="foundation-card" key={card.label}>
                <div className="card-index">0{index + 1}</div>
                <div className="card-label">{card.label}</div>
                <div className="card-value">{card.value}</div>
                <div className="card-detail">{card.detail}</div>
              </article>
            ))}
          </div>

          <section className="connection-panel">
            <div>
              <div className="eyebrow">CLOUD CONNECTION</div>
              <h3>{isSupabaseConfigured ? "Supabase settings detected" : "Waiting for project configuration"}</h3>
              <p>
                {isSupabaseConfigured
                  ? "The browser-safe project URL and publishable key are present. Database access is not enabled in this foundation screen."
                  : "Add the project URL and publishable key to .env.local when the reviewed setup is ready."}
              </p>
            </div>
            <span className={isSupabaseConfigured ? "connection-badge configured" : "connection-badge pending"}>
              {isSupabaseConfigured ? "CONFIGURED" : "NOT CONNECTED"}
            </span>
          </section>

          <footer className="footer-note">
            FOUNDATION BUILD · NO LIVE MATCH DATA · EXISTING DATABASE READ-ONLY
          </footer>
        </div>
      </section>
    </main>
  );
}
