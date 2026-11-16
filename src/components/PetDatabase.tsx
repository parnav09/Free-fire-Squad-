import { useMemo, useState } from "react";
import "./PetDatabase.css";

type PetProfile = {
  id: string; name: string; skill: string; category: string; tagline: string;
  summary: string; levels: { level: string; threshold: string; cooldown: string; effect: string }[];
  notes: string[]; source: { label: string; url: string }[];
};
const pets: PetProfile[] = [{
  id: "mr-waggor", name: "Mr. Waggor", skill: "Smooth Gloo", category: "Passive · Utility",
  tagline: "A guinea pig whose great escape became a new adventure.",
  summary: "Produces a Gloo Wall grenade when the owner is running low. The skill is passive; no manual activation button is required.",
  levels: [
    {level:"Level 1",threshold:"0 Gloo Wall grenades",cooldown:"120 seconds",effect:"Produces 1 Gloo Wall grenade"},
    {level:"Level 2",threshold:"0 Gloo Wall grenades",cooldown:"100 seconds",effect:"Produces 1 Gloo Wall grenade"},
    {level:"Level 3",threshold:"Less than 2 Gloo Wall grenades",cooldown:"100 seconds",effect:"Produces 1 Gloo Wall grenade"}
  ],
  notes:[
    "The current Garena pet page describes the skill in general terms and does not publish the level table.",
    "The level thresholds and cooldowns shown here are from Garena's 3volution patch announcement; the current official page does not restate them.",
    "In Battle Royale, the pet page/official announcement references Gloo Maker progression; Clash Squad is where the generated Gloo Wall grenade behavior is described.",
    "No pet artwork is used in this profile. All future pets will share the same neutral silhouette frame and sizing."
  ],
  source:[
    {label:"Garena · Mr.Waggor official pet profile",url:"https://ff.garena.com/en/pets/85"},
    {label:"Garena · 3volution patch notes (Smooth Gloo level values)",url:"https://ff.garena.com/en/article/299/"}
  ]
}];

export default function PetDatabase() {
  const [selected,setSelected]=useState("mr-waggor");
  const [level,setLevel]=useState("Level 3");
  const pet=useMemo(()=>pets.find(p=>p.id===selected)??pets[0],[selected]);
  const current=pet.levels.find(x=>x.level===level)??pet.levels[2];
  return <main className="pet-db" aria-label="Pet database">
    <header className="pet-db-head"><div><span className="pet-eyebrow">SQUAD OS / COMPANIONS</span><h1>Pet Database<span>.</span></h1><p>One consistent profile frame · Official-source-first skill records</p></div><span className="pet-db-count">01 <i>/</i> 24*</span></header>
    <div className="pet-db-layout">
      <aside className="pet-db-rail"><div className="pet-rail-title">CATALOGUE <span>01</span></div><button className="pet-list-card active" onClick={()=>setSelected(pet.id)} aria-pressed="true"><span className="pet-silhouette" aria-hidden="true"><svg viewBox="0 0 100 100"><path d="M25 36 18 15 40 25Q50 20 60 25L82 15 75 36Q85 48 80 65 72 84 50 84 28 84 20 65 15 48Z"/><ellipse cx="50" cy="52" rx="21" ry="25"/><circle cx="42" cy="48" r="2.5"/><circle cx="58" cy="48" r="2.5"/><path d="M46 58Q50 62 54 58M50 62V66"/></svg></span><span><strong>Mr. Waggor</strong><small>SMOOTH GLOO</small></span><span className="pet-selected-dot"/></button><div className="pet-rail-foot">*Catalogue shell is ready for future pet records.</div></aside>
      <section className="pet-profile">
        <div className="pet-profile-hero"><div className="pet-profile-art"><span className="pet-art-ring"/><svg viewBox="0 0 100 100" aria-label="Neutral pet silhouette"><path d="M25 36 18 15 40 25Q50 20 60 25L82 15 75 36Q85 48 80 65 72 84 50 84 28 84 20 65 15 48Z"/><ellipse cx="50" cy="52" rx="21" ry="25"/><circle cx="42" cy="48" r="2.5"/><circle cx="58" cy="48" r="2.5"/><path d="M46 58Q50 62 54 58M50 62V66"/></svg><span className="pet-art-label">ARTWORK OFF · COMMON FRAME</span></div>
          <div className="pet-profile-copy"><div className="pet-badges"><span>OFFICIAL-SOURCE PROFILE</span><span>PASSIVE SKILL</span></div><h2>{pet.name}</h2><p className="pet-tagline">{pet.tagline}</p><div className="pet-skill-name"><small>PET SKILL</small><strong>{pet.skill}</strong><span>↗</span></div><p>{pet.summary}</p><button className="pet-select-button" onClick={()=>setSelected(pet.id)} aria-pressed="true"><span>✓</span> Selected profile</button></div></div>
        <div className="pet-detail-grid"><article className="pet-panel pet-level-panel"><div className="pet-panel-heading"><div><span className="pet-eyebrow">SKILL BREAKDOWN</span><h3>Ability / Factor</h3></div><span className="pet-panel-index">01</span></div><div className="pet-level-tabs" role="tablist" aria-label="Pet skill level">{pet.levels.map(x=><button key={x.level} role="tab" aria-selected={level===x.level} className={level===x.level?"active":""} onClick={()=>setLevel(x.level)}>{x.level}</button>)}</div><div className="pet-value-table"><div><span>Trigger threshold</span><strong>{current.threshold}</strong></div><div><span>Cooldown</span><strong>{current.cooldown}</strong></div><div><span>Effect</span><strong>{current.effect}</strong></div></div><p className="pet-source-note">Level values: Garena patch announcement · source-linked below</p></article>
        <article className="pet-panel"><div className="pet-panel-heading"><div><span className="pet-eyebrow">SKILL DETAILS</span><h3>Ability Effects</h3></div><span className="pet-panel-index">02</span></div><div className="pet-effect-card"><span className="pet-effect-symbol">◈</span><div><strong>{pet.skill}</strong><p>{pet.summary}</p><small>Passive · Automatic effect</small></div></div><div className="pet-panel-heading pet-subheading"><div><span className="pet-eyebrow">REFERENCE</span><h3>Additional Mechanics & Notes</h3></div></div><ul className="pet-notes">{pet.notes.map((n,i)=><li key={i}>{n}</li>)}</ul></article>
        <article className="pet-panel pet-history"><div className="pet-panel-heading"><div><span className="pet-eyebrow">CHANGE LOG</span><h3>Patch History</h3></div><span className="pet-panel-index">03</span></div><div className="pet-history-row"><span>3volution</span><p>Introduced Smooth Gloo with level-based Gloo Wall generation thresholds and cooldowns.</p></div><div className="pet-history-row"><span>Current profile</span><p>Garena's live pet page retains the skill name and broad effect description; legacy level values are marked by source.</p></div></article>
        <article className="pet-panel"><div className="pet-panel-heading"><div><span className="pet-eyebrow">VERIFICATION</span><h3>Official Sources</h3></div><span className="pet-panel-index">04</span></div><div className="pet-sources">{pet.source.map(s=><a key={s.url} href={s.url} target="_blank" rel="noreferrer"><span>{s.label}</span><b>↗</b></a>)}</div><div className="pet-data-status"><i/>Source links included · artwork intentionally omitted</div></article></div>
      </section>
    </div>
  </main>;
}
