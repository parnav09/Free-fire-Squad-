import { useEffect, useMemo, useState } from "react";
import characterCatalogue from "../data/characterProfiles.json";
import { supabase } from "../lib/supabase/client";
import "./CharactersDatabase.css";

type Language = "en" | "hi-en";
type Props = { language: Language; onLanguageChange: (value: Language) => void; onBack: () => void };
type DetailRow = { en: string; hi: string; value: string };
type CharacterProfile = {
  id: string;
  image: string;
  artworkMode?: "cutout" | "contained" | "shared-current" | "official-fullbody" | "centered-cutout" | "alok-match-cutout" | "blackout-silhouette" | "blackout-image";
  abilityDisplayOnce?: boolean;
  name: string;
  skill: string;
  type: string;
  introEn: string;
  introHi: string;
  currentEn: string[];
  currentHi: string[];
  rows: DetailRow[];
  notesEn: string[];
  notesHi: string[];
  historyEn: string[];
  historyHi: string[];
  source: { label: string; url?: string }[];
  status: string;
  subtitle?: string;
  subtitleHi?: string;
  badge?: string;
  lastChanged?: string;
  hiddenMechanics?: { text: string; status: "official" | "tested" }[];
  needsRecheck?: string[];
  tacticalEn?: string[];
  tacticalHi?: string[];
  strengthsEn?: string[];
  strengthsHi?: string[];
  limitationsEn?: string[];
  limitationsHi?: string[];
  awakened?: {
    label: string;
    name?: string;
    lastChanged?: string;
    badge?: string;
    skill: string;
    type: string;
    introEn: string;
    introHi: string;
    currentEn: string[];
    currentHi: string[];
    rows: DetailRow[];
    notesEn: string[];
    notesHi: string[];
    historyEn: string[];
    historyHi: string[];
    source: { label: string; url: string }[];
    status: string;
  };
};

const profiles: CharacterProfile[] = characterCatalogue as CharacterProfile[];

// Only characters without a complete profile remain in the name-only index.
// Never index a name twice when its full profile already exists.
const pendingCharacterNames = ["Primis", "Nulla"].filter(name => !profiles.some(profile => profile.name.toLowerCase() === name.toLowerCase()));

type CharacterArtworkProps = { profile: CharacterProfile; variant: "card" | "profile" };
function CharacterArtwork({ profile, variant }: CharacterArtworkProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [profile.id, profile.image]);
  const monogram = <div className={variant === "card"
    ? `character-result-monogram monogram-${profile.id.replace(/[^a-z0-9-]/g, "")}`
    : `character-profile-monogram monogram-${profile.id.replace(/[^a-z0-9-]/g, "")}`} aria-label={profile.name}>
    <span>{profile.name.split(/[- ]/).map(part => part[0]).join("").slice(0,2).toUpperCase()}</span>
    <small>{variant === "card" ? "PROFILE" : "CHARACTER PROFILE"}</small>
  </div>;
  if (profile.artworkMode === "blackout-silhouette") {
    const female = profile.id === "nulla";
    return <svg className={`character-blackout-silhouette character-blackout-silhouette--${variant} ${female ? "is-female" : "is-male"}`} viewBox="0 0 240 420" role="img" aria-label={`${profile.name} full-body black silhouette`} focusable="false">
      <defs><linearGradient id={`silhouette-edge-${profile.id}-${variant}`} x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#20242c"/><stop offset=".5" stopColor="#050608"/><stop offset="1" stopColor="#171a20"/></linearGradient></defs>
      {female ? <g fill={`url(#silhouette-edge-${profile.id}-${variant})`} stroke="#30343c" strokeWidth="1.2" strokeLinejoin="round">
        <path d="M120 28c-29 0-44 22-43 51 1 18 6 29 13 39-4 12-18 20-31 29-12 13-17 33-20 57l-8 102 27 3 15-86 5 79-7 93h34l15-93 15 93h34l-7-93 5-79 15 86 27-3-8-102c-3-24-8-44-20-57-13-9-27-17-31-29 7-10 12-21 13-39 1-29-14-51-43-51z"/>
        <path d="M78 48c-18 13-22 37-17 60l10 31-18 25 13 12 23-26-8-45 7-49zm84 0c18 13 22 37 17 60l-10 31 18 25-13 12-23-26 8-45-7-49z" />
      </g> : <g fill={`url(#silhouette-edge-${profile.id}-${variant})`} stroke="#30343c" strokeWidth="1.2" strokeLinejoin="round">
        <path d="M120 27c-27 0-43 19-43 47 0 24 9 39 21 50l-2 15-40 17c-16 7-24 22-27 43l-10 94 30 4 18-79 5 91-8 88h37l19-89 19 89h37l-8-88 5-91 18 79 30-4-10-94c-3-21-11-36-27-43l-40-17-2-15c12-11 21-26 21-50 0-28-16-47-43-47z"/>
        <path d="M78 51c-12 7-18 20-17 36l4 25 15-9 6-40zm84 0c12 7 18 20 17 36l-4 25-15-9-6-40z"/>
      </g>}
      <ellipse cx="120" cy="405" rx="67" ry="8" fill="#000" opacity=".72"/>
    </svg>;
  }
  if (!profile.image || failed) return monogram;
  return <img
    className={profile.artworkMode === "blackout-image" ? "character-art-image--blackout" : profile.artworkMode === "official-fullbody" ? "character-art-image--official-fullbody" : profile.artworkMode === "alok-match-cutout" ? "character-art-image--alok-match-cutout" : profile.artworkMode === "cutout" ? "character-art-image--cutout" : profile.artworkMode === "contained" ? "character-art-image--contained-current" : profile.artworkMode === "shared-current" ? "character-art-image--shared-current" : profile.artworkMode === "centered-cutout" ? "character-art-image--centered-cutout" : undefined}
    src={profile.image}
    alt={profile.name}
    loading={variant === "card" ? "lazy" : "eager"}
    decoding="async"
    onError={() => setFailed(true)}
  />;
}

const cardAbilityLabel = (profile: CharacterProfile) => `${profile.skill.replace(/\s*\((?:Active|Passive)\)$/i, "")} · ${profile.type.split(" · ")[0]}`;

const normalizeSearchText = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Optimal-string-alignment distance handles substitutions, missing/extra letters,
// and adjacent swaps such as "irse" -> "iris".
const editDistanceWithin = (a: string, b: string, limit: number) => {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let previousPrevious: number[] | null = null;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let distance = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1] && previousPrevious) {
        distance = Math.min(distance, previousPrevious[j - 2] + 1);
      }
      current[j] = distance;
      rowMin = Math.min(rowMin, distance);
    }
    if (rowMin > limit) return limit + 1;
    previousPrevious = previous;
    previous = current;
  }
  return previous[b.length];
};

const nameTypoLimitFor = (term: string) => term.length >= 9 ? 2 : term.length >= 3 ? 1 : 0;
const skillTypoLimitFor = (term: string) => term.length >= 9 ? 2 : term.length >= 4 ? 1 : 0;

const characterNameTermScore = (rawName: string, term: string) => {
  const name = normalizeSearchText(rawName);
  const nameWords = name.split(" ").filter(Boolean);
  const compactName = name.split(" ").join("");
  const compactTerm = term.split(" ").join("");
  if (name === term || compactName === compactTerm) return 150;
  if (name.startsWith(term) || nameWords.some(word => word.startsWith(term)) || compactName.startsWith(compactTerm)) return 130;
  if (name.includes(term) || compactName.includes(compactTerm)) return 118;
  const limit = nameTypoLimitFor(compactTerm);
  const distance = limit
    ? Math.min(
        editDistanceWithin(compactTerm, compactName, limit),
        ...nameWords.map(word => editDistanceWithin(compactTerm, word, limit)),
        limit + 1,
      )
    : limit + 1;
  return distance <= limit ? 108 - distance * 12 : 0;
};

const characterNameSearchScore = (name: string, query: string) => {
  const terms = normalizeSearchText(query).split(" ").filter(Boolean);
  if (!terms.length) return -1;
  const scores = terms.map(term => characterNameTermScore(name, term));
  return scores.every(score => score > 0) ? scores.reduce((total, score) => total + score, 0) : -1;
};

const profileSearchScore = (profile: CharacterProfile, query: string) => {
  const terms = normalizeSearchText(query).split(" ").filter(Boolean);
  if (!terms.length) return 0;

  const skill = normalizeSearchText(profile.skill);
  const skillWords = skill.split(" ").filter(Boolean);
  const content = normalizeSearchText([
    profile.type, profile.introEn, profile.introHi,
    ...profile.currentEn, ...profile.currentHi, ...profile.notesEn, ...profile.notesHi,
    ...profile.historyEn, ...profile.historyHi,
    ...(profile.tacticalEn || []), ...(profile.tacticalHi || []),
    ...(profile.strengthsEn || []), ...(profile.strengthsHi || []),
    ...(profile.limitationsEn || []), ...(profile.limitationsHi || []),
    ...profile.rows.flatMap(row => [row.en, row.hi, row.value]),
  ].join(" "));

  const scoreTerm = (term: string) => {
    const nameScore = characterNameTermScore(profile.name, term);
    if (nameScore > 0) return nameScore;
    if (skill.includes(term)) return 75;
    const skillLimit = skillTypoLimitFor(term);
    const skillDistance = skillLimit
      ? Math.min(...skillWords.map(word => editDistanceWithin(term, word, skillLimit)), skillLimit + 1)
      : skillLimit + 1;
    if (skillDistance <= skillLimit) return 62 - skillDistance * 8;
    if (content.includes(term)) return 35;
    return 0;
  };

  const scores = terms.map(scoreTerm);
  return scores.every(score => score > 0) ? scores.reduce((total, score) => total + score, 0) : -1;
};

export default function CharactersDatabase({ language, onLanguageChange, onBack }: Props) {
  // Render version-controlled profiles immediately; refresh from Supabase in the background.
  // The static catalogue remains available offline or whenever the network/database is unavailable.
  const [characterProfiles, setCharacterProfiles] = useState<CharacterProfile[]>(profiles);
  useEffect(() => {
    let cancelled = false;
    if (!supabase) return;
    void (async () => {
      try {
        const { data, error } = await supabase.from("character_profiles").select("id, data");
        if (cancelled || error || !data?.length) return;
        const remoteById = new Map(data.map(row => [row.id, row.data as CharacterProfile]));
        const refreshed = profiles.map(localProfile => {
          const remoteProfile = remoteById.get(localProfile.id);
          if (!remoteProfile || remoteProfile.id !== localProfile.id || remoteProfile.name !== localProfile.name
            || typeof remoteProfile.image !== "string" || !Array.isArray(remoteProfile.rows)) return localProfile;
          return { ...localProfile, ...remoteProfile, id: localProfile.id };
        });
        if (!cancelled) setCharacterProfiles(refreshed);
      } catch {
        // Keep the static catalogue if the request fails.
      }
    })();
    return () => { cancelled = true; };
  }, []);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(characterProfiles.length);
  const [batchSize, setBatchSize] = useState(4);
  const isHindi = language === "hi-en";
  const selected = characterProfiles.find(profile => profile.id === selectedId);
  const shownProfile = selected;
  const matches = useMemo(() => characterProfiles
    .map(profile => ({ profile, score: profileSearchScore(profile, query) }))
    .filter(result => result.score >= 0)
    .sort((a, b) => b.score - a.score || a.profile.name.localeCompare(b.profile.name, undefined, { sensitivity: "base" }))
    .map(result => result.profile), [query]);
  const pendingNameMatches = useMemo(() => {
    if (!query.trim()) return [];
    return pendingCharacterNames
      .map(name => ({ name, score: characterNameSearchScore(name, query) }))
      .filter(result => result.score >= 0)
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [query]);
  const suggestions = [
    ...matches.map(profile => ({
      id: profile.id,
      name: profile.name,
      score: profileSearchScore(profile, query),
      meta: `${profile.skill} · ${profile.type.split(" · ")[0]}`,
    })),
    ...pendingNameMatches.map(result => ({
      id: `pending-${result.name}`,
      name: result.name,
      score: result.score,
      meta: "Name-only index · detailed profile pending",
    })),
  ].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, undefined, { sensitivity: "base" })).slice(0, 6);
  const totalMatchCount = matches.length + pendingNameMatches.length;
  const chooseSuggestion = (suggestion: { name: string }) => {
    setQuery(suggestion.name);
    setShowSuggestions(false);
    setActiveSuggestionIndex(0);
  };
  const returnToList = () => {
    setSelectedId(null);
    setQuery("");
    setShowSuggestions(false);
    setActiveSuggestionIndex(0);
    setVisibleCount(characterProfiles.length);
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  useEffect(() => {
    const updateBatchSize = () => {
      const width = window.innerWidth;
      const nextBatch = width <= 640 ? 4 : width <= 1024 ? 6 : 8;
      setBatchSize(nextBatch);
      setVisibleCount(current => current < nextBatch ? nextBatch : current);
    };
    updateBatchSize();
    window.addEventListener("resize", updateBatchSize, { passive: true });
    return () => window.removeEventListener("resize", updateBatchSize);
  }, []);



  const backLabel = isHindi ? "Characters par wapas" : "Back to Characters";
  const sectionTitle = (en: string, hi: string) => isHindi ? hi : en;
  const list = (items: string[]) => <ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul>;

  if (shownProfile) return <main className="character-database character-profile-page">
    <div className="character-db-toolbar">
      <button type="button" className="character-back-button" onClick={returnToList}><span aria-hidden="true">←</span> {backLabel}</button>
      <div className="character-language-control" role="group" aria-label="Character page language">
        <button type="button" className={language === "en" ? "active" : ""} onClick={() => onLanguageChange("en")}>EN</button>
        <button type="button" className={language === "hi-en" ? "active" : ""} onClick={() => onLanguageChange("hi-en")}>HI+EN</button>
      </div>
    </div>
    <article className="character-profile">
      <header className="character-profile-identity">
        <div className={`character-profile-art ${shownProfile.artworkMode === "official-fullbody" ? "character-profile-art--official-fullbody" : shownProfile.artworkMode === "cutout" ? "character-profile-art--cutout" : shownProfile.artworkMode === "shared-current" ? "character-profile-art--shared-current" : shownProfile.artworkMode === "contained" ? "character-profile-art--contained" : shownProfile.artworkMode === "centered-cutout" ? "character-profile-art--centered-cutout" : shownProfile.artworkMode === "alok-match-cutout" ? "character-profile-art--alok-match-cutout" : shownProfile.artworkMode === "blackout-silhouette" ? "character-profile-art--blackout-silhouette" : shownProfile.artworkMode === "blackout-image" ? "character-profile-art--blackout-image" : ""}`}><CharacterArtwork profile={shownProfile} variant="profile" /></div>
        <div className="character-profile-heading">
          <h2>{shownProfile.name}</h2>
          <span className="character-confirmed">{shownProfile.badge || "Official-source profile"}</span>
          <p className="character-profile-subtitle">{isHindi ? (shownProfile.subtitleHi || shownProfile.subtitle || shownProfile.status) : (shownProfile.subtitle || shownProfile.status)}</p>
          {shownProfile.lastChanged && <p className="character-last-changed">Last changed in <b>{shownProfile.lastChanged}</b></p>}
          <p className="character-skill-name">{shownProfile.abilityDisplayOnce ? `${shownProfile.skill.replace(/\\s*\\((?:Active|Passive)\\)$/i, "")} · ${shownProfile.type.split(" · ")[0]}` : <><b>Ability:</b> {shownProfile.skill.replace(/\\s*\\((?:Active|Passive)\\)$/i, "")} · {shownProfile.type.split(" · ")[0]}</>}</p>
          <p className="character-profile-summary">{isHindi ? shownProfile.introHi : shownProfile.introEn}</p>
        </div>
      </header>


      <section className="character-ability-section">
        <div className="character-values-table" role="table" aria-label={shownProfile.name + " ability values"}>
          <div className="character-values-row character-values-head" role="row"><span role="columnheader">{sectionTitle("Ability / Factor", "Ability / Factor")}</span><span role="columnheader">{sectionTitle("Current value", "Current value")}</span></div>
          {shownProfile.rows.map(row => <div className="character-values-row" role="row" key={row.en}><span role="cell">{isHindi ? row.hi : row.en}</span><strong role="cell">{row.value}</strong></div>)}
        </div>
        <section className="character-detail-block">
          <h3>{sectionTitle("Ability Effects", "Ability Effects")}</h3>
          {list(isHindi ? shownProfile.currentHi : shownProfile.currentEn)}
        </section>
        <section className="character-detail-block">
          <h3>{sectionTitle("Additional Mechanics & Notes", "Additional Mechanics & Notes")}</h3>
          {list(isHindi ? shownProfile.notesHi : shownProfile.notesEn)}
        </section>
        {shownProfile.tacticalEn?.length ? <section className="character-detail-block">
          <h3>{sectionTitle("Tactical Applications", "Tactical Applications")}</h3>
          {list(isHindi ? (shownProfile.tacticalHi || shownProfile.tacticalEn) : shownProfile.tacticalEn)}
        </section> : null}
        {shownProfile.strengthsEn?.length ? <section className="character-detail-block">
          <h3>{sectionTitle("Strengths", "Strengths")}</h3>
          {list(isHindi ? (shownProfile.strengthsHi || shownProfile.strengthsEn) : shownProfile.strengthsEn)}
        </section> : null}
        {shownProfile.limitationsEn?.length ? <section className="character-detail-block">
          <h3>{sectionTitle("Limitations", "Limitations")}</h3>
          {list(isHindi ? (shownProfile.limitationsHi || shownProfile.limitationsEn) : shownProfile.limitationsEn)}
        </section> : null}
        {shownProfile.hiddenMechanics?.length ? <section className="character-detail-block">
          <h3>{sectionTitle("Hidden Mechanics", "Hidden Mechanics")}</h3>
          <ul>{shownProfile.hiddenMechanics.map((item, index) => <li key={index}>{item.text} <b className="character-mechanic-status">{item.status}</b></li>)}</ul>
        </section> : null}
        {shownProfile.needsRecheck?.length ? <section className="character-detail-block character-verify-block">
          <h3>{sectionTitle("To verify in game", "To verify in game")}</h3>
          {list(shownProfile.needsRecheck)}
        </section> : null}
        <section className="character-detail-block">
          <h3>{sectionTitle("Patch History", "Patch History")}</h3>
          {list(isHindi ? shownProfile.historyHi : shownProfile.historyEn)}
        </section>
        <section className="character-detail-block character-source-block">
          <h3>{sectionTitle("Official Sources", "Official Sources")}</h3>
          <ul>{shownProfile.source.map(source => <li key={source.url || source.label}>{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.label}</a> : source.label}</li>)}</ul>
        </section>
      </section>
    </article>
  </main>;

  return <main className="character-database">
    <div className="character-db-toolbar">
      <div><button type="button" className="character-back-button" onClick={onBack}><span aria-hidden="true">←</span> {isHindi ? "Combat Nexus par wapas" : "Back to Combat Nexus"}</button><div className="character-db-eyebrow">SQUAD OS / COMBAT NEXUS</div></div>
      <div className="character-language-control" role="group" aria-label="Character page language">
        <button type="button" className={language === "en" ? "active" : ""} onClick={() => onLanguageChange("en")}>EN</button>
        <button type="button" className={language === "hi-en" ? "active" : ""} onClick={() => onLanguageChange("hi-en")}>HI+EN</button>
      </div>
    </div>
    <header className="character-db-heading"><div><div className="character-db-eyebrow">OPERATIVE DATABASE · PHASE 1 + 2</div><h1>{isHindi ? "Character Database" : "Character Database"}</h1><p>{isHindi ? "Character profiles with shared profile layout, source notes and patch history." : "Character profiles with shared profile layout, source notes and patch history."}</p></div><div className="character-db-count"><b>{characterProfiles.length}</b><span>{isHindi ? "PROFILES" : "PROFILES"}<small> / 67 target</small></span></div></header>
    <div className="character-search-wrap"><label className="character-search" role="search"><span aria-hidden="true">⌕</span><input type="search" value={query} onFocus={() => setShowSuggestions(Boolean(query.trim()))} onChange={event => { setQuery(event.target.value); setShowSuggestions(Boolean(event.target.value.trim())); setActiveSuggestionIndex(0); }} onKeyDown={event => { if (event.key === "Escape") setShowSuggestions(false); if (event.key === "ArrowDown" && showSuggestions && suggestions.length) { event.preventDefault(); setActiveSuggestionIndex(index => (index + 1) % suggestions.length); } if (event.key === "ArrowUp" && showSuggestions && suggestions.length) { event.preventDefault(); setActiveSuggestionIndex(index => (index - 1 + suggestions.length) % suggestions.length); } if (event.key === "Enter" && showSuggestions && suggestions.length) { event.preventDefault(); chooseSuggestion(suggestions[activeSuggestionIndex] || suggestions[0]); } }} placeholder={isHindi ? "Character ya ability search karein…" : "Search character or ability…"} aria-label="Search characters" aria-autocomplete="list" aria-expanded={showSuggestions && suggestions.length > 0} aria-controls="character-search-suggestions" autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="search"/>{query && <button type="button" onClick={() => { setQuery(""); setShowSuggestions(false); setActiveSuggestionIndex(0); }} aria-label="Clear search">×</button>}</label>{showSuggestions && query.trim() && suggestions.length > 0 && <div className="character-search-suggestions" id="character-search-suggestions" role="listbox" aria-label="Matching characters">{suggestions.map((suggestion, index) => <button type="button" role="option" aria-selected={index === activeSuggestionIndex} className={index === activeSuggestionIndex ? "active" : ""} key={suggestion.id} onMouseDown={event => event.preventDefault()} onClick={() => chooseSuggestion(suggestion)}><span className="character-suggestion-name">{suggestion.name}</span><span className="character-suggestion-meta">{suggestion.meta}</span><span aria-hidden="true">↗</span></button>)}</div>}</div>
    <div className="character-results-head"><div><b>{isHindi ? "CHARACTER PROFILES" : "CHARACTER PROFILES"}</b><span>{totalMatchCount} {isHindi ? "matches found" : "matches found"}</span></div><span className="character-sort-label">A–Z · Alphabetical</span></div>
    {totalMatchCount ? <div className="character-profile-grid">{(query.trim() ? matches : matches.slice(0, visibleCount)).map(profile => <button type="button" className={`character-result-card ${profile.artworkMode === "cutout" ? "character-result-card--cutout" : profile.artworkMode === "shared-current" ? "character-result-card--shared-current" : profile.artworkMode === "contained" ? "character-result-card--contained" : profile.artworkMode === "centered-cutout" ? "character-result-card--centered-cutout" : profile.artworkMode === "alok-match-cutout" ? "character-result-card--alok-match-cutout" : profile.artworkMode === "blackout-silhouette" ? "character-result-card--blackout-silhouette" : profile.artworkMode === "blackout-image" ? "character-result-card--blackout-image" : ""}`} key={profile.id} onClick={() => setSelectedId(profile.id)}>
      <div className="character-result-art"><CharacterArtwork profile={profile} variant="card" /></div>
      <div className="character-result-copy"><span className="character-result-status">{profile.badge || "OFFICIAL-SOURCE PROFILE"}</span><h2>{profile.name}</h2><b>{cardAbilityLabel(profile)}</b><p>{isHindi ? profile.introHi : profile.introEn}</p><span className="character-result-open">{isHindi ? "Open full profile" : "Open full profile"} <span aria-hidden="true">↗</span></span></div>
      <span className="character-result-chevron" aria-hidden="true">↗</span>
    </button>)}{pendingNameMatches.map(result => <div className="character-result-card character-result-card--pending" key={`pending-${result.name}`}>
      <div className="character-result-art"><div className="character-result-monogram"><span>{result.name.split(/[- ]/).map(part => part[0]).join("").slice(0, 2).toUpperCase()}</span><small>NAME INDEX</small></div></div>
      <div className="character-result-copy"><span className="character-result-status">NAME-ONLY SEARCH</span><h2>{result.name}</h2><b>Detailed profile pending</b><p>This character name supports typo-tolerant search. Ability details and artwork have not been added yet.</p><span className="character-result-open">Searchable name · no profile page yet</span></div>
      <span className="character-result-chevron" aria-hidden="true">⌕</span>
    </div>)}</div> : <div className="character-empty-state"><b>{isHindi ? "No matching character" : "No matching character"}</b><span>{isHindi ? "Koi doosra character name ya ability search karein." : "Try another name or ability."}</span></div>}
    <div className="character-load-more-wrap">{!query.trim() && visibleCount < matches.length && <button type="button" className="character-load-more" onClick={() => setVisibleCount(count => Math.min(count + batchSize, matches.length))}>More <span aria-hidden="true">↓</span></button>}<p>{isHindi ? "Values official Garena character pages aur patch notes se cross-check ki gayi hain. Jahan current English page aur localized details differ karte hain, source limitation clearly flag ki gayi hai." : "Values are cross-checked against official Garena character pages and patch notes. Source limitations and conflicting values are explicitly flagged."}</p></div>
  </main>;
}
