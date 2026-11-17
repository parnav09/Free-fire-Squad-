import { useMemo, useState } from "react";
import "./CharactersDatabase.css";
import "./PetDatabase.css";

type PetEntry = {
  id: string;
  name: string;
  aliases: string[];
  status: "verified" | "pending";
  officialUrl?: string;
};

const pets = ([
  { id: "kitty", name: "Kitty", aliases: ["kity", "kitti", "kitty pet"], status: "verified", officialUrl: "https://ff.garena.com/en/pets/262" },
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
] as PetEntry[]).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

const normalize = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function editDistanceWithin(a: string, b: string, limit: number) {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let previousPrevious: number[] | null = null;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1] && previousPrevious) {
        value = Math.min(value, previousPrevious[j - 2] + 1);
      }
      current[j] = value;
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > limit) return limit + 1;
    previousPrevious = previous;
    previous = current;
  }
  return previous[b.length];
}

function petNameScore(pet: PetEntry, rawQuery: string) {
  const query = normalize(rawQuery);
  if (!query) return 0;
  const compactQuery = query.replace(/ /g, "");
  const terms = [pet.name, ...pet.aliases].map(normalize);
  let best = 0;
  for (const term of terms) {
    const compactTerm = term.replace(/ /g, "");
    if (term === query || compactTerm === compactQuery) best = Math.max(best, 150);
    else if (term.startsWith(query) || compactTerm.startsWith(compactQuery)) best = Math.max(best, 130);
    else if (term.includes(query) || compactTerm.includes(compactQuery)) best = Math.max(best, 118);
    else {
      const limit = compactQuery.length >= 9 ? 2 : compactQuery.length >= 3 ? 1 : 0;
      if (limit) {
        const distance = editDistanceWithin(compactQuery, compactTerm, limit);
        if (distance <= limit) best = Math.max(best, 108 - distance * 12);
      }
    }
  }
  return best;
}

type Props = { onBack: () => void };

export default function PetDatabase({ onBack }: Props) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(8);
  const batchSize = 8;
  const selected = pets.find(pet => pet.id === selectedId);
  const matches = useMemo(() => pets
    .map(pet => ({ pet, score: petNameScore(pet, query) }))
    .filter(result => !query.trim() || result.score > 0)
    .sort((a, b) => b.score - a.score || a.pet.name.localeCompare(b.pet.name, undefined, { sensitivity: "base" }))
    .map(result => result.pet), [query]);
  const suggestions = useMemo(() => pets
    .map(pet => ({ pet, score: petNameScore(pet, query) }))
    .filter(result => query.trim() && result.score > 0)
    .sort((a, b) => b.score - a.score || a.pet.name.localeCompare(b.pet.name, undefined, { sensitivity: "base" }))
    .slice(0, 6), [query]);
  const verifiedCount = pets.filter(pet => pet.status === "verified").length;

  const resetToList = () => {
    setSelectedId(null);
    setQuery("");
    setShowSuggestions(false);
    setActiveSuggestionIndex(0);
    setVisibleCount(8);
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  const selectPet = (pet: PetEntry) => {
    setSelectedId(pet.id);
    setShowSuggestions(false);
    setActiveSuggestionIndex(0);
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  const chooseSuggestion = (pet: PetEntry) => {
    setQuery(pet.name);
    setShowSuggestions(false);
    setActiveSuggestionIndex(0);
  };

  const list = (items: string[]) => <ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul>;

  if (selected) {
    const kitty = selected.id === "kitty";
    return <main className="character-database character-profile-page">
      <div className="character-db-toolbar">
        <button type="button" className="character-back-button" onClick={resetToList}><span aria-hidden="true">←</span> Back to Pets</button>
        <div className="character-language-control" role="group" aria-label="Pet profile language">
          <button type="button" className="active">EN</button>
          <button type="button" disabled>HI+EN</button>
        </div>
      </div>
      <article className="character-profile">
        <header className="character-profile-identity">
          <div className="character-profile-art pet-profile-art">
            <div className="pet-profile-art-glow" />
            <div className="character-profile-monogram pet-profile-monogram"><span>K</span><small>OFFICIAL ART PENDING</small></div>
          </div>
          <div className="character-profile-heading">
            <h2>{selected.name}</h2>
            <span className="character-confirmed">{kitty ? "Official-source profile" : selected.status === "verified" ? "Official name verified" : "Name confirmation pending"}</span>
            <p className="character-profile-subtitle">{kitty ? "Cosmetic-only pet · No gameplay skill" : "Pet profile template · Verified details pending"}</p>
            <p className="character-skill-name"><b>Ability:</b> {kitty ? "None · Cosmetic-only pet" : "Not entered"}</p>
            <p className="character-profile-summary">{kitty ? "Kitty is an appearance-focused companion. No active or passive gameplay skill is assigned to Kitty." : "This profile keeps the Character Database structure. Ability and artwork details remain blank until verified from official Garena sources."}</p>
          </div>
        </header>
        <section className="character-ability-section">
          <div className="character-values-table" role="table" aria-label={selected.name + " profile values"}>
            <div className="character-values-row character-values-head" role="row"><span role="columnheader">Ability / Factor</span><span role="columnheader">Current value</span></div>
            <div className="character-values-row" role="row"><span role="cell">Gameplay ability</span><strong role="cell">{kitty ? "None" : "Not entered"}</strong></div>
            <div className="character-values-row" role="row"><span role="cell">Skill type</span><strong role="cell">{kitty ? "No active or passive skill" : "Pending verification"}</strong></div>
            <div className="character-values-row" role="row"><span role="cell">Profile category</span><strong role="cell">Pet</strong></div>
          </div>
          <section className="character-detail-block">
            <h3>Ability Effects</h3>
            {list(kitty ? ["Kitty has no gameplay ability effects."] : ["Reserved for official, verified pet ability information."])}
          </section>
          <section className="character-detail-block">
            <h3>Additional Mechanics &amp; Notes</h3>
            {list(kitty ? ["Kitty is a cosmetic-only pet; do not assign a skill, cooldown, or combat effect.", "Cosmetic appearance and pet emotes are separate from gameplay ability data."] : ["No mechanics have been entered until official source verification is complete."])}
          </section>
          <section className="character-detail-block">
            <h3>Patch History</h3>
            {list(kitty ? ["No gameplay ability changes are recorded for Kitty because it has no gameplay skill."] : ["Reserved for official patch-note history."])}
          </section>
          <section className="character-detail-block character-source-block">
            <h3>Official Sources</h3>
            <ul>
              <li><a href="https://ff.garena.com/en/pets" target="_blank" rel="noreferrer">Garena — Official Free Fire Pets catalogue</a></li>
              {kitty && <li><a href="https://ff.garena.com/en/pets/262" target="_blank" rel="noreferrer">Garena — Kitty official pet profile</a></li>}
            </ul>
          </section>
          <div className="character-detail-block pet-artwork-note">
            <h3>Official Artwork Status</h3>
            <p>{kitty ? "Garena's official Kitty profile page is linked above. The direct original PNG asset URL is not exposed by the accessible page result yet, so no third-party image or YouTube thumbnail is being passed off as Garena PNG artwork." : "Official artwork has not been added yet."}</p>
          </div>
        </section>
      </article>
    </main>;
  }

  return <main className="character-database pet-character-catalogue">
    <div className="character-db-toolbar">
      <div><button type="button" className="character-back-button" onClick={onBack}><span aria-hidden="true">←</span> Back to Combat Nexus</button><div className="character-db-eyebrow">SQUAD OS / COMBAT NEXUS</div></div>
      <div className="character-language-control" role="group" aria-label="Pet catalogue language">
        <button type="button" className="active">EN</button>
        <button type="button" disabled>HI+EN</button>
      </div>
    </div>
    <header className="character-db-heading">
      <div><div className="character-db-eyebrow">COMPANION DATABASE</div><h1>Pet Database</h1><p>Official pet names, typo-tolerant search and Character-style individual profiles.</p></div>
      <div className="character-db-count"><b>{pets.length}</b><span>PET SLOTS<small>{verifiedCount} official names / 2 unverified</small></span></div>
    </header>
    <div className="character-search-wrap">
      <label className="character-search" role="search">
        <span aria-hidden="true">⌕</span>
        <input type="search" value={query} onFocus={() => setShowSuggestions(Boolean(query.trim()))}
          onChange={event => { setQuery(event.target.value); setShowSuggestions(Boolean(event.target.value.trim())); setActiveSuggestionIndex(0); }}
          onKeyDown={event => {
            if (event.key === "Escape") setShowSuggestions(false);
            if (event.key === "ArrowDown" && showSuggestions && suggestions.length) { event.preventDefault(); setActiveSuggestionIndex(index => (index + 1) % suggestions.length); }
            if (event.key === "ArrowUp" && showSuggestions && suggestions.length) { event.preventDefault(); setActiveSuggestionIndex(index => (index - 1 + suggestions.length) % suggestions.length); }
            if (event.key === "Enter" && showSuggestions && suggestions.length) { event.preventDefault(); chooseSuggestion(suggestions[activeSuggestionIndex]?.pet || suggestions[0].pet); }
          }}
          placeholder="Search pet name…" aria-label="Search pets" aria-autocomplete="list" aria-expanded={showSuggestions && suggestions.length > 0} aria-controls="pet-search-suggestions" autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="search" />
        {query && <button type="button" onClick={() => { setQuery(""); setShowSuggestions(false); setActiveSuggestionIndex(0); }} aria-label="Clear search">×</button>}
      </label>
      {showSuggestions && query.trim() && suggestions.length > 0 && <div className="character-search-suggestions" id="pet-search-suggestions" role="listbox" aria-label="Matching pets">
        {suggestions.map((result, index) => <button type="button" role="option" aria-selected={index === activeSuggestionIndex} className={index === activeSuggestionIndex ? "active" : ""} key={result.pet.id} onMouseDown={event => event.preventDefault()} onClick={() => chooseSuggestion(result.pet)}>
          <span className="character-suggestion-name">{result.pet.name}</span><span className="character-suggestion-meta">{result.pet.status === "verified" ? "Official name" : "Unverified slot"}</span><span aria-hidden="true">↗</span>
        </button>)}
      </div>}
    </div>
    <div className="character-results-head"><div><b>PET PROFILES</b><span>{matches.length} matches found</span></div><span className="character-sort-label">A–Z · Alphabetical</span></div>
    {matches.length ? <div className="character-profile-grid">
      {(query.trim() ? matches : matches.slice(0, visibleCount)).map(pet => <button type="button" className="character-result-card" key={pet.id} onClick={() => selectPet(pet)}>
        <div className="character-result-art">
          <div className="character-result-monogram pet-result-monogram"><span>{pet.name.split(/[- .]/).map(part => part[0]).join("").slice(0, 2).toUpperCase()}</span><small>{pet.id === "kitty" ? "PET PROFILE" : pet.status === "verified" ? "OFFICIAL NAME" : "PENDING"}</small></div>
        </div>
        <div className="character-result-copy"><span className="character-result-status">{pet.status === "verified" ? "OFFICIAL NAME VERIFIED" : "NAME CONFIRMATION PENDING"}</span><h2>{pet.name}</h2><b>{pet.id === "kitty" ? "Cosmetic-only · No skill" : pet.status === "verified" ? "Pet profile" : "Unidentified slot"}</b><p>{pet.id === "kitty" ? "Appearance-focused pet with no gameplay ability." : pet.status === "verified" ? "Official name indexed. Detailed profile awaits source verification." : "Placeholder only; official pet identity is not confirmed."}</p><span className="character-result-open">Open full profile <span aria-hidden="true">↗</span></span></div>
        <span className="character-result-chevron" aria-hidden="true">↗</span>
      </button>)}
    </div> : <div className="character-empty-state"><b>No matching pet</b><span>Try another spelling or a shorter name.</span></div>}
    <div className="character-load-more-wrap">
      {!query.trim() && visibleCount < matches.length && <button type="button" className="character-load-more" onClick={() => setVisibleCount(count => Math.min(count + batchSize, matches.length))}>More <span aria-hidden="true">↓</span></button>}
      <p>Pet catalogue uses official Garena names. Detailed pet abilities and artwork are added only after source verification.</p>
    </div>
  </main>;
}
