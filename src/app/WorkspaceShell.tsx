import type { ReactNode } from "react";
import type { Section } from "./types";

type WorkspaceShellProps = {
  section: Section;
  nav: Section[];
  syncState: "synced" | "syncing" | "offline" | "error";
  syncLabel: string;
  showNavigation: boolean;
  onNavigate: (section: Section) => void;
  children: ReactNode;
};

export default function WorkspaceShell({
  section,
  nav,
  syncState,
  syncLabel,
  showNavigation,
  onNavigate,
  children,
}: WorkspaceShellProps) {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark" aria-hidden="true">S</div>
        <div className="brand-copy">
          <span className="brand-name">SQUAD OS</span>
          <span className="brand-caption">TEAM OPERATIONS</span>
        </div>
        <div className="sidebar-divider" />
        {showNavigation && (
          <>
            <div className="nav-label">WORKSPACE</div>
            <nav className="workspace-nav" aria-label="Workspace">
              {nav.map((item) => {
                const active = section === item || (item === "Settings" && section === "Profile");
                return (
                  <button
                    key={item}
                    type="button"
                    className={"nav-item " + (active ? "nav-item-active" : "nav-item-muted")}
                    aria-current={active ? "page" : undefined}
                    onClick={() => onNavigate(item)}
                  >
                    <span className="nav-dot" aria-hidden="true" />
                    {item}
                  </button>
                );
              })}
            </nav>
            <div className="sidebar-bottom">SQUAD OS · WORKSPACE</div>
          </>
        )}
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div className="breadcrumb">WORKSPACE <span>/</span> {section.toUpperCase()}</div>
          <div
            className={"sync-indicator sync-" + syncState}
            role="status"
            aria-live="polite"
            aria-label={"Team sync status: " + syncLabel}
            title={"Team sync status: " + syncLabel}
          >
            <i aria-hidden="true" />
            <span>{syncLabel}</span>
          </div>
        </header>
        <div className="content">{children}</div>
      </section>
    </main>
  );
}
