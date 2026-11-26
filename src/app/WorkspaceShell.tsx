import type { ReactNode } from "react";
import type { Section } from "./types";
import Button from "../components/ui/Button";

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
  showNavigation,
  onNavigate,
  children,
}: WorkspaceShellProps) {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark" aria-hidden="true"><img src="/squad-os-mark.png" alt="" /></div>
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
                  <Button
                    key={item}
                    className={"nav-item " + (active ? "nav-item-active" : "nav-item-muted")}
                    aria-current={active ? "page" : undefined}
                    onClick={() => onNavigate(item)}
                  >
                    <span className="nav-dot" aria-hidden="true" />
                    {item}
                  </Button>
                );
              })}
            </nav>
            <div className="sidebar-bottom">SQUAD OS · WORKSPACE</div>
          </>
        )}
      </aside>

      <section className="main-panel">
        <header className="topbar" aria-live="polite">
          <div className="breadcrumb">WORKSPACE <span>/</span> {section.toUpperCase()}</div>
        </header>
        <div className="content">{children}</div>
      </section>
    </main>
  );
}
