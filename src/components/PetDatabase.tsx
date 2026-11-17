import { useMemo, useState } from "react";
import "./PetDatabase.css";

type PetEntry = { id: string; name: string; aliases: string[]; status: "verified" | "pending" };

const pets: PetEntry[] = [
  { id: "kitty", name: "Kitty", aliases: ["kity", "kitti", "kitty pet"], status: "verified" },
  { id: "mechanical-pup", name: "Mechanical Pup", aliases: ["mechanical puppy", "mech pup", "robot pup", "mechanical"], status: "verified" },
  { id: "night-panther", name: "Night Panther", aliases: ["night panther pet", "panther", "nite panther"], status: "verified" },
  { id: "detective-panda", name: "Detective Panda", aliases: ["panda", "detective panda pet", "detectiv panda"], status: "verified" },
  { id: "shiba", name: "Shiba", aliases: ["shiba inu", "sheba"], status: "verified" },
  { id: "spirit-fox", name: "Spirit Fox", aliases: ["spiritfox", "spirit fox pet"], status: "verified" },
  { id: "robo", name: "Robo", aliases: ["robot", "robo pet"], status: "verified" },
  { id: "poring", name: "Poring", aliases: ["poring pet"], status: "verified" },
  { id: "ottero", name: "Ottero", aliases: ["otter", "otero", "ottero pet"], status: "verified" },
  { id: "falco", name: "Falco", aliases: ["falcon", "falco pet"], status: "verified" },
  { id: "mr-waggor", name: "Mr. Waggor", aliases: ["mr waggor", "mister waggor", "waggor", "mrwagor"], status: "verified" },
  { id: "rockie", name: "Rockie", aliases: ["rocky", "rockie pet"], status: "verified" },
  { id: "beaston", name: "Beaston", aliases: ["beast on", "beaston pet"], status: "verified" },
  { id: "dreki", name: "Dreki", aliases: ["draki", "dreky", "dreki pet"], status: "verified" },
  { id: "moony", name: "Moony", aliases: ["moonny", "moony pet"], status: "verified" },
  { id: "dr-beanie", name: "Dr. Beanie", aliases: ["dr beanie", "doctor beanie", "beanie", "drbeanie"], status: "verified" },
  { id: "sensei-tig", name: "Sensei Tig", aliases: ["sensei tiger", "tig", "sensei tig pet"], status: "verified" },
  { id: "agent-hop", name: "Agent Hop", aliases: ["agenthop", "hop", "agent hope"], status: "verified" },
  { id: "yeti", name: "Yeti", aliases: ["yetti", "yeti pet"], status: "verified" },
  { id: "flash", name: "Flash", aliases: ["flash pet"], status: "verified" },
  { id: "zasil", name: "Zasil", aliases: ["zazil", "zasil pet"], status: "verified" },
  { id: "finn", name: "Finn", aliases: ["fin", "finn pet"], status: "verified" },
  { id: "hoot", name: "Hoot", aliases: ["hoot pet", "owl"], status: "verified" },
  { id: "fang", name: "Fang", aliases: ["fang pet"], status: "verified" },
  { id: "arvon", name: "Arvon", aliases: ["avron", "arwan", "arvon pet"], status: "verified" },
  { id: "kactus", name: "Kactus", aliases: ["cactus", "kaktus", "kactus pet"], status: "verified" },
  { id: "pug", name: "Pug", aliases: ["pug pet"], status: "verified" },
  { id: "unidentified-28", name: "Unidentified Pet 28", aliases: [], status: "pending" },
  { id: "unidentified-29", name: "Unidentified Pet 29", aliases: [], status: "pending" },
];

const normalize = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const old = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = old;
    }
  }
  return row[b.length];
}
function scorePet(pet: PetEntry, rawQuery: string) {
  const query = normalize(rawQuery);
  if (!query) return 0;
  const terms = [pet.name, ...pet.aliases].map(normalize);
  let best = 0;
  for (const term of terms) {
    if (term === query) best = Math.max(best, 100);
    else if (term.startsWith(query) || query.startsWith(term)) best = Math.max(best, 85);
    else if (term.includes(query) || query.includes(term)) best = Math.max(best, 72);
    else {
      const compactA = term.replace(/ /g, "");
      const compactB = query.replace(/ /g, "");
      const limit = compactB.length >= 8 ? 2 : compactB.length >= 4 ? 1 : 0;
      if (limit && distance(compactA, compactB) <= limit) best = Math.max(best, 60 - distance(compactA, compactB) * 10);
    }
  }
  return best;
}

type Props = { onBack: () => void };
function KittyArtwork() {
  return <img
    className="pet-artwork-image"
    src="https://i.ytimg.com/vi/XW9Dz-gZ2UM/maxresdefault.jpg"
    alt="Kitty, the orange-and-white Free Fire pet in its purple striped outfit, from Garena Free Fire's official Kitty pet announcement"
    loading="eager"
    decoding="async"
    referrerPolicy="no-referrer"
  />;
}

export default function PetDatabase({ onBack }: Props) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("kitty");
  const results = useMemo(() => pets.map(pet => ({ pet, score: scorePet(pet, query) }))
    .filter(result => !query.trim() || result.score > 0)
    .sort((a, b) => b.score - a.score || a.pet.name.localeCompare(b.pet.name))
    .map(result => result.pet), [query]);
  const selected = pets.find(pet => pet.id === selectedId) ?? pets[0];
  const kittySelected = selected.id === "kitty";
  const confirmedCount = pets.filter(pet => pet.status === "verified").length;

  return <main className="pet-database">
    <header className="pet-db-toolbar">
      <button type="button" onClick={onBack} className="pet-db-back">← Back to Combat Nexus</button>
      <span>SQUAD OS / COMPANION DATABASE</span>
    </header>
    <section className="pet-db-intro">
      <small>02 / COMPANION ARCHIVE</small>
      <h1>Pet <b>Database</b></h1>
      <p>Official-name index · typo-tolerant search · profile templates</p>
      <div className="pet-db-counts"><span><b>29</b> REQUESTED SLOTS</span><span><b>{confirmedCount}</b> OFFICIAL NAMES IDENTIFIED</span><span><b>2</b> NEED CONFIRMATION</span></div>
    </section>
    <section className="pet-db-search-panel">
      <label htmlFor="pet-db-search">Search pets</label>
      <input id="pet-db-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search official name or a close spelling…" autoComplete="off" />
      <p>Search supports common misspellings, short forms and name variations.</p>
    </section>
    <section className="pet-db-layout">
      <aside className="pet-db-roster">
        <div className="pet-db-roster-head"><strong>Pet roster</strong><span>{results.length} / 29</span></div>
        <div className="pet-db-grid">
          {results.map(pet => <button type="button" key={pet.id} onClick={() => setSelectedId(pet.id)} className={selectedId === pet.id ? "pet-db-card is-selected" : "pet-db-card"}>
            <span className="pet-db-card-mark">{pet.status === "verified" ? "PET" : "PENDING"}</span>
            <strong>{pet.name}</strong>
            <small>{pet.status === "verified" ? "Official name" : "Name not yet verified"}</small>
          </button>)}
        </div>
        {results.length === 0 && <p className="pet-db-empty">No close match. Try a shorter spelling.</p>}
      </aside>
      <article className="pet-db-profile">
        <div className={kittySelected ? "pet-db-art" : "pet-db-art pet-db-art--placeholder"}>
          {kittySelected ? <><div className="pet-db-art-halo"/><KittyArtwork/><span className="pet-db-art-label">FULL-BODY / CUTOUT STUDY</span></> : <div className="pet-db-art-placeholder-copy"><span>PROFILE TEMPLATE</span><strong>{selected.name}</strong><small>Official artwork and verified details pending</small></div>}
        </div>
        <div className="pet-db-profile-content">
          <div className="pet-db-badges"><span>OFFICIAL PET NAME</span><span>{kittySelected ? "PROFILE READY" : "TEMPLATE ONLY"}</span></div>
          <h2>{selected.name}</h2>
          <p className="pet-db-subtitle">{kittySelected ? "Classic companion · No gameplay skill" : "Pet profile template · Details intentionally blank"}</p>
          <div className="pet-db-rule"/>
          <h3>Profile Overview</h3>
          <dl className="pet-db-facts">
            <div><dt>Official name</dt><dd>{selected.name}</dd></div>
            <div><dt>Database category</dt><dd>Pet</dd></div>
            <div><dt>Profile state</dt><dd>{kittySelected ? "Verified basic profile" : selected.status === "verified" ? "Name verified · details pending" : "Awaiting official identification"}</dd></div>
            <div><dt>Gameplay skill</dt><dd>{kittySelected ? "None" : "Not entered"}</dd></div>
          </dl>
          <section className="pet-db-section">
            <h3>Ability / Factor | Current value</h3>
            {kittySelected ? <div className="pet-db-value-row"><span>Gameplay ability</span><strong>No active or passive skill</strong></div> : <div className="pet-db-blank-row">Reserved for verified data</div>}
          </section>
          <section className="pet-db-section"><h3>Ability Effects</h3><p>{kittySelected ? "Kitty has no gameplay ability effects. Its profile is appearance-focused." : "Section reserved — no unverified details added."}</p></section>
          <section className="pet-db-section"><h3>Additional Mechanics &amp; Notes</h3><p>{kittySelected ? "No skill level progression, activation condition or cooldown applies to Kitty." : "Section reserved — awaiting verified source material."}</p></section>
          <section className="pet-db-section"><h3>Patch History</h3><p>{kittySelected ? "No gameplay-skill changes recorded for this no-skill pet profile." : "Reserved for patch-verified updates."}</p></section>
          <section className="pet-db-section"><h3>Official Sources</h3>
            {kittySelected ? <><a href="https://ff.garena.com/en/pets" target="_blank" rel="noreferrer">Garena — Official Free Fire Pets catalogue</a><br/><a href="https://www.youtube.com/watch?v=XW9Dz-gZ2UM" target="_blank" rel="noreferrer">Garena Free Fire Indonesia — Official Kitty announcement</a></> : <span className="pet-db-source-pending">Source links will be added with each completed profile.</span>}
          </section>
          <div className={selected.status === "verified" ? "pet-db-status" : "pet-db-status is-pending"}><i/>{kittySelected ? "Kitty profile structure ready · no skill invented" : selected.status === "verified" ? "Official name indexed · profile details not entered" : "Unidentified slot · needs official name confirmation"}</div>
        </div>
      </article>
    </section>
    <footer className="pet-db-footer">SQUAD OS <span>·</span> PET DATABASE <span>·</span> {confirmedCount} IDENTIFIED NAMES / 29 REQUESTED SLOTS</footer>
  </main>;
}
