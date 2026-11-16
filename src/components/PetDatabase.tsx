import React from "react";
import "./PetDatabase.css";

type Props={onBack:()=>void};
export default function PetDatabase({onBack}:Props){
 return <section className="kitty-db">
  <header className="kitty-db-top"><button onClick={onBack} className="kitty-back">← Back to Combat Nexus</button><span>SQUAD OS / COMPANIONS</span></header>
  <div className="kitty-db-heading"><small>02 / PET DATABASE</small><h1>Pet <b>Database</b></h1><p>Companion profiles · official information · clean reference cards</p></div>
  <article className="kitty-profile">
   <div className="kitty-art"><div className="kitty-silhouette" aria-hidden="true"><svg viewBox="0 0 220 240"><path d="M49 80 37 20 83 48Q110 35 137 48L183 20 171 80Q190 108 181 145Q169 193 110 205Q51 193 39 145Q30 108 49 80Z" fill="currentColor"/><ellipse cx="82" cy="111" rx="10" ry="14" fill="#07111e"/><ellipse cx="138" cy="111" rx="10" ry="14" fill="#07111e"/><path d="M102 135 110 143 118 135M110 143Q98 155 88 146M110 143Q122 155 132 146" fill="none" stroke="#07111e" strokeWidth="5" strokeLinecap="round"/></svg></div><span className="kitty-art-label">PET / KITTY</span></div>
   <div className="kitty-info"><div className="kitty-badges"><span>OFFICIAL PET</span><span>COSMETIC</span></div><h2>Kitty</h2><p className="kitty-subtitle">Classic companion · No skill</p><div className="kitty-divider"/>
    <h3>Profile Overview</h3><dl><div><dt>Category</dt><dd>Pet</dd></div><div><dt>Skill</dt><dd>None</dd></div><div><dt>Gameplay effect</dt><dd>No ability effect</dd></div><div><dt>Customization</dt><dd>Pet skin / appearance</dd></div></dl>
    <section className="kitty-note"><strong>Ability / Factor · Current value</strong><p>Kitty does not have an active or passive gameplay skill. This profile is appearance-focused.</p></section>
    <h3>Additional Mechanics & Notes</h3><p className="kitty-muted">No skill levels, cooldown, activation condition, or gameplay mechanics apply to Kitty.</p>
    <h3>Profile Status</h3><div className="kitty-status"><i/> Basic pet profile · Verified skill status</div>
   </div>
  </article>
  <footer className="kitty-db-foot">SQUAD OS <span>·</span> PET CATALOGUE <span>·</span> KITTY</footer>
 </section>
}