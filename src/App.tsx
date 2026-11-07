import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "./lib/supabase/client";

type Section = "Overview" | "Tournament" | "Training" | "Players" | "Analytics";
type Player = { id: string; name: string; role: string; status: string };
const initialPlayers: Player[] = [
  { id: "P1", name: "Player 1", role: "Primary Rusher", status: "Active" },
  { id: "P2", name: "Player 2", role: "Secondary Rusher", status: "Active" },
  { id: "P3", name: "Player 3", role: "Third Rusher / Flank", status: "Active" },
  { id: "P4", name: "Player 4", role: "Sniper / IGL", status: "Active" },
];

function readPlayers(): Player[] {
  try { const v = localStorage.getItem("squad-os-roster"); return v ? JSON.parse(v) : initialPlayers; }
  catch { return initialPlayers; }
}

export default function App() {
  const [section, setSection] = useState<Section>("Overview");
  const [players, setPlayers] = useState<Player[]>(readPlayers);
  const [week, setWeek] = useState("2026-W45");
  const [day, setDay] = useState(1);
  const [matches, setMatches] = useState<Record<string, { placement: number; kills: number }>>({});
  const [notice, setNotice] = useState("");
  const [connection, setConnection] = useState("Checking Supabase…");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("Substitute");
  const [drillDone, setDrillDone] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");

  useEffect(() => { localStorage.setItem("squad-os-roster", JSON.stringify(players)); }, [players]);
  useEffect(() => {
    let alive = true;
    if (!supabase) { setConnection("Missing project settings"); return; }
    supabase.auth.getSession().then(({ error }) => {
      if (alive) setConnection(error ? "Configured · auth check failed" : "Configured · API reachable");
    }).catch(() => alive && setConnection("Configured · network unavailable"));
    return () => { alive = false; };
  }, []);

  const totalMatches = Object.keys(matches).length;
  const points = Object.values(matches).reduce((sum, m) => sum + (m.placement === 1 ? 12 : m.placement === 2 ? 9 : m.placement === 3 ? 8 : m.placement === 4 ? 7 : m.placement === 5 ? 6 : m.placement === 6 ? 5 : m.placement === 7 ? 4 : m.placement === 8 ? 3 : m.placement === 9 ? 2 : m.placement === 10 ? 1 : 0) + m.kills, 0);
  const filteredPlayers = useMemo(() => players.filter(p => (p.name + p.role).toLowerCase().includes(query.toLowerCase())), [players, query]);
  const saveMatch = (slot: string, field: "placement" | "kills", value: number) => {
    setMatches(prev => ({ ...prev, [slot]: { placement: prev[slot]?.placement ?? 12, kills: prev[slot]?.kills ?? 0, [field]: value } }));
  };
  const addPlayer = () => {
    if (!newName.trim() || players.length >= 10) return;
    setPlayers(prev => [...prev, { id: "P" + (prev.length + 1), name: newName.trim(), role: newRole, status: "Active" }]);
    setNewName(""); setNotice("Player added to this device.");
  };
  const nav: Section[] = ["Overview", "Tournament", "Training", "Players", "Analytics"];
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">S</div><div className="brand-copy"><span className="brand-name">SQUAD OS</span><span className="brand-caption">TEAM OPERATIONS</span></div>
        <div className="sidebar-divider"/><div className="nav-label">WORKSPACE</div>
        {nav.map(n => <button key={n} className={"nav-item "+(section===n?"nav-item-active":"nav-item-muted")} onClick={()=>setSection(n)}><span className="nav-dot"/>{n}</button>)}
        <div className="sidebar-bottom">M2 · WORKSPACE</div>
      </aside>
      <section className="main-panel">
        <header className="topbar"><div className="breadcrumb">WORKSPACE <span>/</span> {section.toUpperCase()}</div><div className="system-status"><i/> {connection.toUpperCase()}</div></header>
        <div className="content">
          <div className="eyebrow">SQUAD MANAGEMENT PLATFORM · M2</div>
          <h1>{section==="Overview" ? <>Control the squad.<br/><span>Track every week.</span></> : <>{section}.<br/><span>Team operations.</span></>}</h1>
          <p className="intro">A focused workspace for tournament results, player development and team performance. Records below are currently stored locally on this browser.</p>
          {notice && <div className="notice">{notice}<button onClick={()=>setNotice("")}>×</button></div>}
          {section==="Overview" && <>
            <div className="section-heading"><div><div className="eyebrow">AT A GLANCE</div><h2>Squad overview</h2></div><span className="phase-pill">M2 / INTERACTIVE</span></div>
            <div className="foundation-grid">
              {[["Roster",players.length+" / 10","Configured players"],["Match records",String(totalMatches),"Current browser"],["Week points",String(points),"Placement + kills"],["Cloud",isSupabaseConfigured?"Configured":"Pending","Auth check only"]].map(([a,b,c],i)=><article className="foundation-card" key={a}><div className="card-index">0{i+1}</div><div className="card-label">{a}</div><div className="card-value">{b}</div><div className="card-detail">{c}</div></article>)}
            </div>
            <section className="connection-panel"><div><div className="eyebrow">NEXT ACTION</div><h3>Start with the tournament ledger</h3><p>Choose Tournament to record six matches per day, seven days per week. Training and roster are separate sections.</p></div><button className="primary-button" onClick={()=>setSection("Tournament")}>Open tournament →</button></section>
          </>}
          {section==="Tournament" && <>
            <div className="section-heading"><div><div className="eyebrow">WEEKLY CYCLE</div><h2>Matchday ledger</h2></div><span className="phase-pill">42 MATCH SLOTS</span></div>
            <div className="toolbar"><label>Week <input value={week} onChange={e=>setWeek(e.target.value)} placeholder="YYYY-W##"/></label><label>Day <select value={day} onChange={e=>setDay(Number(e.target.value))}>{Array.from({length:7},(_,i)=><option value={i+1} key={i}>Day {i+1} · {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i]}</option>)}</select></label></div>
            <div className="match-grid">{Array.from({length:6},(_,i)=>{const key=week+"-D"+day+"-M"+(i+1);const m=matches[key]||{placement:12,kills:0};return <article className="match-card" key={key}><div className="card-index">MATCH 0{i+1}</div><h3>Match {i+1}</h3><label>Placement<select value={m.placement} onChange={e=>saveMatch(key,"placement",Number(e.target.value))}>{Array.from({length:12},(_,j)=><option key={j} value={j+1}>{j+1===12?"12+ / Other":j+1}</option>)}</select></label><label>Kills<input type="number" min="0" value={m.kills} onChange={e=>saveMatch(key,"kills",Math.max(0,Number(e.target.value)))}/></label></article>})}</div>
            <p className="footer-note">Prototype scoring: placement 1–10 = 12,9,8,7,6,5,4,3,2,1 points; 11/12 = 0. Add kills. Not an official tournament scoring preset.</p>
          </>}
          {section==="Training" && <>
            <div className="section-heading"><div><div className="eyebrow">PRACTICE BLOCK</div><h2>Team drill checklist</h2></div><span className="phase-pill">LOCAL CHECKLIST</span></div>
            <div className="drill-list">{["IGL call clarity · short and actionable","Trade spacing · pair stays connected","Rotation timing · move before pressure","Reset discipline · regroup before re-entry","Post-match review · one fix per match"].map((d,i)=><label className="drill-row" key={d}><input type="checkbox" checked={!!drillDone[d]} onChange={e=>setDrillDone(p=>({...p,[d]:e.target.checked}))}/><span><b>0{i+1} / {d}</b><small>Mark only after the team completes and reviews it.</small></span></label>)}</div>
            <label className="notes-label">Session notes<textarea value={notes.training||""} onChange={e=>setNotes(p=>({...p,training:e.target.value}))} placeholder="Calls missed, timing issue, next session target…"/></label>
          </>}
          {section==="Players" && <>
            <div className="section-heading"><div><div className="eyebrow">ROSTER MANAGEMENT</div><h2>Squad roster</h2></div><span className="phase-pill">{players.length} / 10</span></div>
            <input className="search-input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search players or roles…"/>
            <div className="player-list">{filteredPlayers.map(p=><article className="player-row" key={p.id}><span className="player-id">{p.id}</span><div><b>{p.name}</b><small>{p.role}</small></div><span className="active-tag">{p.status}</span><button className="delete-button" onClick={()=>setPlayers(prev=>prev.filter(x=>x.id!==p.id))}>Remove</button></article>)}</div>
            <section className="connection-panel add-player"><div><div className="eyebrow">ADD PLAYER</div><h3>Roster slot</h3><p>Maximum ten roster entries in this local prototype.</p></div><div className="add-form"><input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Player name"/><select value={newRole} onChange={e=>setNewRole(e.target.value)}>{["Primary Rusher","Secondary Rusher","Third Rusher / Flank","Sniper / IGL","Substitute"].map(x=><option key={x}>{x}</option>)}</select><button className="primary-button" disabled={players.length>=10||!newName.trim()} onClick={addPlayer}>Add</button></div></section>
          </>}
          {section==="Analytics" && <>
            <div className="section-heading"><div><div className="eyebrow">PERFORMANCE SNAPSHOT</div><h2>Current week</h2></div><span className="phase-pill">BROWSER DATA</span></div>
            <div className="foundation-grid">{[["Recorded matches",totalMatches],["Placement + kills points",points],["Average kills",totalMatches?(Object.values(matches).reduce((s,m)=>s+m.kills,0)/totalMatches).toFixed(1):"0.0"],["Roster size",players.length]].map(([a,b],i)=><article className="foundation-card" key={String(a)}><div className="card-index">0{i+1}</div><div className="card-label">{a}</div><div className="card-value">{b}</div></article>)}</div>
            <section className="connection-panel"><div><div className="eyebrow">DATA WARNING</div><h3>Not yet shared across players</h3><p>These analytics are browser-local prototype data. Supabase tables, team login and realtime sync are the next integration stage.</p></div></section>
          </>}
          <footer className="footer-note">M2 WORKSPACE PROTOTYPE · LOCAL STORAGE · NO SHARED LIVE DATA YET</footer>
        </div>
      </section>
    </main>
  );
}
