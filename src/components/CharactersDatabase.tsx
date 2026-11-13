import { useEffect, useMemo, useState } from "react";
import "./CharactersDatabase.css";

type Language = "en" | "hi-en";
type Props = { language: Language; onLanguageChange: (value: Language) => void; onBack: () => void };
type DetailRow = { en: string; hi: string; value: string };
type CharacterProfile = {
  id: string;
  image: string;
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
  source: { label: string; url: string }[];
  status: string;
};

const profiles: CharacterProfile[] = [
  {
    id: "ray", name: "Ray", image: "https://dl.dir.freefiremobile.com/common/web_event/official2.ff.garena.all/20264/1a2c81cd893f6ea43a527cb3b7b2f897.png", skill: "Bond of Eclipse", type: "Active · Tag / Link",
    introEn: "A survival ability profile based on Garena's current official character page.",
    introHi: "Yeh profile Garena ke current official character page par based hai.",
    currentEn: [
      "Projects forward in a 30m fan-shaped area and tags the first undowned enemy hit for 10 seconds.",
      "Creates a link visible within 40m only to the skill user and the tagged target.",
      "If the tagged target reaches 30 HP or below, the ability's listed instant knockdown condition is met.",
      "A tagged target being knocked down or eliminated resets the skill and restores 10 HP per second for 3 seconds.",
    ],
    currentHi: [
      "30m ke fan-shaped area mein aage effect bhejta hai aur hit hue pehle undowned enemy ko 10 seconds ke liye tag karta hai.",
      "Link 40m ke andar sirf skill user aur tagged target ko dikhta hai.",
      "Tagged target ka HP 30 ya usse kam hone par listed instant knockdown condition poori hoti hai.",
      "Tagged target ke knockdown ya eliminate hone par skill reset hoti hai aur 3 seconds tak 10 HP per second restore hota hai.",
    ],
    rows: [
      { en: "Forward area", hi: "Forward area", value: "30m · Fan-shaped" },
      { en: "Tag duration", hi: "Tag duration", value: "10 seconds" },
      { en: "Link visibility", hi: "Link visibility", value: "40m" },
      { en: "Threshold condition", hi: "Threshold condition", value: "30 HP or below" },
      { en: "HP recovery", hi: "HP recovery", value: "10 HP/s for 3s" },
      { en: "Cooldown", hi: "Cooldown", value: "45 seconds" },
    ],
    notesEn: [
      "The link visibility is limited to the skill user and the tagged target.",
      "The reset and HP recovery are conditional on the tagged target being knocked down or eliminated.",
      "The current official profile lists a 30 HP threshold; an older OB53 announcement listed 40 HP. The current profile is used for the present-day value.",
    ],
    notesHi: [
      "Link sirf skill user aur tagged target ko dikhta hai.",
      "Skill reset aur HP recovery tabhi listed hain jab tagged target knockdown ya eliminate ho.",
      "Current official profile mein 30 HP threshold hai; purane OB53 announcement mein 40 HP tha. Current value ke liye latest profile use ki gayi hai.",
    ],
    historyEn: ["OB53 introduction announcement listed the threshold as 40 HP or below. The current official character profile now lists 30 HP or below."],
    historyHi: ["OB53 ke introduction announcement mein threshold 40 HP ya kam tha. Current official character profile ab 30 HP ya kam dikhata hai."],
    source: [
      { label: "Garena — Ray character profile", url: "https://ff.garena.com/en/chars/794" },
      { label: "Garena — OB53 Patch Notes", url: "https://ff.garena.com/en/article/1640/" },
    ],
    status: "Current profile checked · 14 Nov 2026",
  },
  {
    id: "morse", name: "Morse", image: "https://dl.dir.freefiremobile.com/common/web_event/official2.ff.garena.all/20261/87b0db20d90350d22979b03d8b65a567.png", skill: "Stealth Bytes", type: "Active · Stealth",
    introEn: "A stealth-focused ability. Current OB55 adjustments supersede older OB52 values.",
    introHi: "Yeh stealth-focused ability hai. Current OB55 adjustments, purani OB52 values se updated hain.",
    currentEn: [
      "Enters Stealth: enemies beyond 12m have difficulty seeing Morse, and enemy detection does not detect him.",
      "Grants a 20% movement-speed bonus and 25 temporary Shield Points.",
      "Maximum Stealth duration is 13 seconds.",
      "Morse cannot fire while Stealth is active; exiting Stealth has a 0.5-second delay.",
      "Aim assist can trigger when enemies are within 12m.",
    ],
    currentHi: [
      "Stealth mein jaane par 12m se door enemies ke liye Morse ko dekhna mushkil hota hai aur enemy detection use detect nahi karta.",
      "20% movement-speed bonus aur 25 temporary Shield Points milte hain.",
      "Maximum Stealth duration 13 seconds hai.",
      "Stealth active hone par Morse fire nahi kar sakta; Stealth se bahar aane mein 0.5-second delay hai.",
      "12m ke andar enemies hone par aim assist trigger ho sakta hai.",
    ],
    rows: [
      { en: "Maximum Stealth duration", hi: "Maximum Stealth duration", value: "13 seconds" },
      { en: "Movement-speed bonus", hi: "Movement-speed bonus", value: "20%" },
      { en: "Temporary Shield Points", hi: "Temporary Shield Points", value: "25" },
      { en: "Aim-assist trigger range", hi: "Aim-assist trigger range", value: "12m" },
      { en: "Exit delay", hi: "Exit delay", value: "0.5 seconds" },
      { en: "Cooldown", hi: "Cooldown", value: "45 seconds" },
    ],
    notesEn: [
      "Firing is disabled during Stealth.",
      "The 12m aim-assist trigger range is a counterplay change, not the same as the visibility description.",
      "OB55 changed aim-assist trigger range from 4m to 12m and maximum Stealth duration from 15s to 13s.",
    ],
    notesHi: [
      "Stealth ke dauran firing disabled rehti hai.",
      "12m aim-assist trigger range, visibility description se alag mechanic hai.",
      "OB55 mein aim-assist trigger range 4m se 12m aur maximum Stealth duration 15s se 13s ki gayi.",
    ],
    historyEn: ["OB52 launch values included 15s duration, 4m aim-assist trigger range, and 1s exit delay. OB55 changed duration to 13s and aim-assist range to 12m. The current official profile also lists 25 temporary Shield Points and a 0.5s exit delay."],
    historyHi: ["OB52 launch values mein 15s duration, 4m aim-assist trigger range aur 1s exit delay the. OB55 ne duration 13s aur aim-assist range 12m ki. Current official profile mein 25 temporary Shield Points aur 0.5s exit delay bhi listed hain."],
    source: [
      { label: "Garena — Morse character profile", url: "https://ff.garena.com/en/chars/785" },
      { label: "Garena — OB55 Patch Notes", url: "https://ff.garena.com/en/article/1712/" },
      { label: "Garena — OB52 Patch Notes", url: "https://dl.dir.freefiremobile.com/common/web_event/articles/en/1595.html" },
    ],
    status: "OB55 values reconciled · 14 Nov 2026",
  },
  {
    id: "nero", name: "Nero", image: "https://dl.dir.freefiremobile.com/common/web_event/official2.ff.garena.all/202510/5d937a0ac5fe4e67c97fb8fb8e43455e.png", skill: "Cryo Mind", type: "Active · Plushie / Area",
    introEn: "The current official character profile and older patch notes contain conflicting plushie and damage values; the conflict is explicitly flagged below.",
    introHi: "Current official character profile aur purane patch notes mein plushie aur damage values alag hain; neeche yeh difference clearly dikhaya gaya hai.",
    currentEn: [
      "The current official profile describes a plushie with 1 HP, lasting 12 seconds and able to travel up to 50m (100m in BR).",
      "It tracks the nearest enemy in sight within 8m and creates an 8m-radius area.",
      "Inside the area, neither the user nor enemies can place Gloo Walls; the profile lists 6 HP/s loss for enemies.",
      "The area disappears if the plushie is destroyed; the destroyer is marked for 5 seconds.",
    ],
    currentHi: [
      "Current official profile ke mutabik plushie ke 1 HP hain, yeh 12 seconds tak rehta hai aur 50m (BR mein 100m) tak ja sakta hai.",
      "Yeh 8m ke andar sight mein maujood nearest enemy ko track karta hai aur 8m-radius area banata hai.",
      "Area ke andar user aur enemies dono Gloo Walls place nahi kar sakte; profile enemies ke liye 6 HP/s loss batata hai.",
      "Plushie destroy hone par area khatam ho jata hai; use destroy karne wala 5 seconds ke liye mark hota hai.",
    ],
    rows: [
      { en: "Plushie HP (current profile)", hi: "Plushie HP (current profile)", value: "1 HP" },
      { en: "Plushie duration", hi: "Plushie duration", value: "12 seconds" },
      { en: "Travel distance", hi: "Travel distance", value: "50m · 100m in BR" },
      { en: "Tracking range", hi: "Tracking range", value: "8m · line of sight" },
      { en: "Area radius", hi: "Area radius", value: "8m" },
      { en: "Enemy HP effect (current profile)", hi: "Enemy HP effect (current profile)", value: "6 HP/s" },
      { en: "Destroyer mark", hi: "Destroyer mark", value: "5 seconds" },
      { en: "Cooldown", hi: "Cooldown", value: "45 seconds" },
    ],
    notesEn: [
      "The current official character profile says 1 HP for the plushie and 6 HP/s for the area effect.",
      "OB53 patch notes previously described a 150-HP plushie and reduced the area effect from 16 to 14 HP/s.",
      "OB55 notes mention a bug fix for the plushie getting stuck, but do not provide replacement HP or damage values.",
      "Because these official sources conflict, treat 1 HP and 6 HP/s as the current profile snapshot, not a fully reconciled patch-history conclusion. Verify in-game before relying on exact values.",
    ],
    notesHi: [
      "Current official character profile plushie ke liye 1 HP aur area effect ke liye 6 HP/s batata hai.",
      "OB53 patch notes mein pehle plushie 150-HP ka bataya gaya tha aur area effect 16 se 14 HP/s kiya gaya tha.",
      "OB55 notes mein plushie ke zameen mein atakne ka bug fix hai, lekin naye HP ya damage values nahi diye gaye.",
      "Official sources mein conflict hai; isliye 1 HP aur 6 HP/s ko current profile snapshot samjhein, fully reconciled patch-history conclusion nahi. Exact values ke liye in-game verification zaroori hai.",
    ],
    historyEn: ["OB53 documented a 150-HP plushie and a reduction from 16 to 14 HP/s. The current official character profile now displays 1 HP and 6 HP/s. OB55 only records a stuck-plushie bug fix. This remains a source discrepancy."],
    historyHi: ["OB53 mein 150-HP plushie aur 16 se 14 HP/s reduction record hua tha. Current official character profile ab 1 HP aur 6 HP/s dikhata hai. OB55 mein sirf stuck-plushie bug fix record hai. Yeh source discrepancy abhi bhi hai."],
    source: [
      { label: "Garena — Nero character profile", url: "https://ff.garena.com/en/chars/775" },
      { label: "Garena — OB53 Patch Notes", url: "https://ff.garena.com/en/article/1640/" },
      { label: "Garena — OB55 Patch Notes", url: "https://ff.garena.com/en/article/1712/" },
    ],
    status: "Source discrepancy flagged · 14 Nov 2026",
  },
  {
    id: "rin", name: "Rin", image: "https://dl.dir.freefiremobile.com/common/web_event/official2.ff.garena.all/20257/9aa96a782fab8633cbb57f9229e7a5e6.png", skill: "Gale of Kunai", type: "Passive · Stored charges",
    introEn: "A passive character ability listed by Garena. Weapon-specific mechanics are intentionally not detailed in this profile.",
    introHi: "Garena ki listed passive character ability. Is profile mein weapon-specific mechanics include nahi kiye gaye hain.",
    currentEn: [
      "Gale of Kunai is listed as Rin's passive survival ability.",
      "This profile keeps the character catalogue entry and official reference, but omits weapon-use details and combat guidance.",
    ],
    currentHi: [
      "Gale of Kunai, Rin ki passive survival ability ke roop mein listed hai.",
      "Is profile mein character catalogue entry aur official reference rakha gaya hai, lekin weapon-use details aur combat guidance include nahi hain.",
    ],
    rows: [
      { en: "Ability type", hi: "Ability type", value: "Passive" },
      { en: "Official skill name", hi: "Official skill name", value: "Gale of Kunai" },
      { en: "Cooldown", hi: "Cooldown", value: "Not listed on official profile" },
    ],
    notesEn: [
      "Garena's official profile identifies Gale of Kunai as Rin's special survival ability.",
      "Weapon-specific effects, targeting details and damage values are intentionally omitted.",
    ],
    notesHi: [
      "Garena ka official profile Gale of Kunai ko Rin ki special survival ability batata hai.",
      "Weapon-specific effects, targeting details aur damage values jaanbujhkar include nahi kiye gaye hain.",
    ],
    historyEn: ["OB50 introduced Rin and named her passive ability Gale of Kunai. OB55 later listed balance adjustments to this ability; weapon-specific details are not reproduced here."],
    historyHi: ["OB50 mein Rin aur uski passive ability Gale of Kunai introduce ki gayi. OB55 mein is ability ke balance adjustments record hue; weapon-specific details yahan include nahi hain."],
    source: [
      { label: "Garena — Rin character profile", url: "https://ff.garena.com/en/chars/767" },
      { label: "Garena — OB50 Patch Notes", url: "https://ff.garena.com/en/article/1511/" },
      { label: "Garena — OB55 Patch Notes", url: "https://ff.garena.com/en/article/1712/" },
    ],
    status: "OB55 balance note checked · 14 Nov 2026",
  },
  {
    id: "oscar", name: "Oscar", image: "https://dl.dir.freefiremobile.com/common/web_event/official2.ff.garena.all/20252/d5d04e40eb00900e96a28828decdaff0.png", skill: "Valiant Dash", type: "Active · Dash",
    introEn: "The base ability, cooldown adjustment and BR Skill Boost options are documented separately.",
    introHi: "Base ability, cooldown adjustment aur BR Skill Boost options ko alag-alag document kiya gaya hai.",
    currentEn: [
      "Dashes in the selected direction and detonates the first 3 Gloo Walls encountered, dealing 25 damage to each listed wall.",
      "Enemies encountered are listed as taking 25 damage and being knocked back.",
      "Current official profile cooldown is 60 seconds.",
      "In BR, OB54 documented two optional Skill Boosts: Phantom Dash increases dash range; Sustained Dash extends duration to 8 seconds, with speed initially reduced and then increasing.",
    ],
    currentHi: [
      "Selected direction mein dash karta hai aur raaste mein aane wali pehli 3 Gloo Walls ko detonate karta hai; listed wall damage 25 hai.",
      "Encounter hone wale enemies ke liye 25 damage aur knockback listed hai.",
      "Current official profile cooldown 60 seconds hai.",
      "BR mein OB54 ne do optional Skill Boosts list kiye: Phantom Dash dash range badhata hai; Sustained Dash duration 8 seconds karta hai, jismein speed pehle kam hoti hai aur phir badhti hai.",
    ],
    rows: [
      { en: "Gloo Walls affected", hi: "Gloo Walls affected", value: "First 3 in path" },
      { en: "Listed wall damage", hi: "Listed wall damage", value: "25" },
      { en: "Listed enemy effect", hi: "Listed enemy effect", value: "25 damage + knockback" },
      { en: "Base cooldown", hi: "Base cooldown", value: "60 seconds" },
      { en: "Sustained Dash boost duration", hi: "Sustained Dash boost duration", value: "8 seconds" },
    ],
    notesEn: [
      "Phantom Dash increases dash range; the patch note does not specify a numeric increase.",
      "Sustained Dash lasts 8s and begins at a lower dash speed that increases over time.",
      "The two Skill Boost options are BR progression choices; the patch notes state only one boost option can be selected.",
      "OB54 increased the base cooldown from 45s to 60s.",
    ],
    notesHi: [
      "Phantom Dash dash range badhata hai; patch note numeric increase nahi batata.",
      "Sustained Dash 8s tak rehta hai aur shuruat mein dash speed kam hoti hai, jo time ke saath badhti hai.",
      "Dono Skill Boost options BR progression choices hain; patch notes ke mutabik sirf ek option select kiya ja sakta hai.",
      "OB54 mein base cooldown 45s se 60s kiya gaya.",
    ],
    historyEn: ["Oscar's base profile lists 60s cooldown. OB54 increased it from 45s to 60s and introduced Phantom Dash and Sustained Dash as BR Skill Boost options."],
    historyHi: ["Oscar ke base profile mein 60s cooldown hai. OB54 ne ise 45s se 60s kiya aur BR Skill Boost options ke roop mein Phantom Dash aur Sustained Dash add kiye."],
    source: [
      { label: "Garena — Oscar character profile", url: "https://ff.garena.com/en/chars/769" },
      { label: "Garena — OB54 Patch Notes", url: "https://ff.garena.com/en/article/1673" },
      { label: "Garena — Original Oscar announcement", url: "https://ff.garena.com/en/article/1456" },
    ],
    status: "OB54 cooldown / boost notes checked · 14 Nov 2026",
  },
];

const normalizeSearchText = (value: string) => value.normalize("NFKD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const editDistanceWithin = (a: string, b: string, limit: number) => {
  if (Math.abs(a.length - b.length) > limit) return false;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
      rowMin = Math.min(rowMin, current[j]);
    }
    if (rowMin > limit) return false;
    previous = current;
  }
  return previous[b.length] <= limit;
};

const profileMatchesSearch = (profile: CharacterProfile, query: string) => {
  const haystack = normalizeSearchText([
    profile.name, profile.skill, profile.type, profile.introEn, profile.introHi,
    ...profile.currentEn, ...profile.currentHi, ...profile.notesEn, ...profile.notesHi,
    ...profile.historyEn, ...profile.historyHi, ...profile.rows.flatMap(row => [row.en, row.hi, row.value]),
  ].join(" "));
  const terms = normalizeSearchText(query).split(" ").filter(Boolean);
  if (!terms.length) return true;
  const words = haystack.split(" ");
  return terms.every(term => {
    if (haystack.includes(term)) return true;
    const maxDistance = term.length >= 9 ? 2 : term.length >= 5 ? 1 : 0;
    return maxDistance > 0 && words.some(word => editDistanceWithin(term, word, maxDistance));
  });
};

export default function CharactersDatabase({ language, onLanguageChange, onBack }: Props) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const isHindi = language === "hi-en";
  const selected = profiles.find(profile => profile.id === selectedId);
  const matches = useMemo(() => profiles
    .filter(profile => profileMatchesSearch(profile, query))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })), [query]);

  useEffect(() => {
    const onScroll = () => {
      const cards = Array.from(document.querySelectorAll("[data-character-letter]"));
      let current = cards.length ? cards[0].getAttribute("data-character-letter") || "A" : "A";
      cards.forEach(card => {
        if (card.getBoundingClientRect().top <= window.innerHeight * 0.34) current = card.getAttribute("data-character-letter") || current;
      });
      document.querySelectorAll("#character-alphabet-navigation button").forEach(button => { button.classList.toggle("active", button.textContent === current); (button as HTMLButtonElement).disabled = !cards.some(card => card.getAttribute("data-character-letter") === button.textContent); });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [matches.length, selectedId]);

  const backLabel = isHindi ? "Characters par wapas" : "Back to Characters";
  const sectionTitle = (en: string, hi: string) => isHindi ? hi : en;
  const list = (items: string[]) => <ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul>;

  if (selected) return <main className="character-database character-profile-page">
    <div className="character-db-toolbar">
      <button type="button" className="character-back-button" onClick={() => setSelectedId(null)}><span aria-hidden="true">←</span> {backLabel}</button>
      <div className="character-language-control" role="group" aria-label="Character page language">
        <button type="button" className={language === "en" ? "active" : ""} onClick={() => onLanguageChange("en")}>EN</button>
        <button type="button" className={language === "hi-en" ? "active" : ""} onClick={() => onLanguageChange("hi-en")}>HI+EN</button>
      </div>
    </div>
    <article className="character-profile">
      <header className="character-profile-identity">
        <div className="character-profile-art"><img src={selected.image} alt={selected.name} /></div>
        <div className="character-profile-heading">
          <h2>{selected.name}</h2>
          <span className="character-confirmed">{isHindi ? "Official-source profile" : "Official-source profile"}</span>
          <p className="character-skill-name"><b>{isHindi ? "Ability:" : "Ability:"}</b> {selected.skill}</p>
          <p className="character-profile-summary">{isHindi ? selected.introHi : selected.introEn}</p>
        </div>
      </header>

      <section className="character-ability-section">
        <div className="character-section-eyebrow">SQUAD OS / COMBAT NEXUS</div>
        <h1>{selected.name} — {sectionTitle("Ability Profile", "Ability Profile")}</h1>
        <p className="character-ability-intro">{selected.status}</p>
        <div className="character-values-table" role="table" aria-label={selected.name + " ability values"}>
          <div className="character-values-row character-values-head" role="row"><span role="columnheader">{sectionTitle("Ability / Factor", "Ability / Factor")}</span><span role="columnheader">{sectionTitle("Current value", "Current value")}</span></div>
          {selected.rows.map(row => <div className="character-values-row" role="row" key={row.en}><span role="cell">{isHindi ? row.hi : row.en}</span><strong role="cell">{row.value}</strong></div>)}
        </div>
        <section className="character-detail-block">
          <h3>{sectionTitle("Ability Effects", "Ability Effects")}</h3>
          {list(isHindi ? selected.currentHi : selected.currentEn)}
        </section>
        <section className="character-detail-block">
          <h3>{sectionTitle("Additional Mechanics & Notes", "Additional Mechanics & Notes")}</h3>
          {list(isHindi ? selected.notesHi : selected.notesEn)}
        </section>
        <section className="character-detail-block">
          <h3>{sectionTitle("Patch History", "Patch History")}</h3>
          {list(isHindi ? selected.historyHi : selected.historyEn)}
        </section>
        <section className="character-detail-block character-source-block">
          <h3>{sectionTitle("Official Sources", "Official Sources")}</h3>
          <ul>{selected.source.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.label} ↗</a></li>)}</ul>
          <p>{sectionTitle("Values are a researched snapshot, not live game data. In-game values can change with later updates.", "Yeh values researched snapshot hain, live game data nahi. Aage ke updates mein in-game values badal sakti hain.")}</p>
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
    <header className="character-db-heading"><div><div className="character-db-eyebrow">OPERATIVE DATABASE · PHASE 1 TEST</div><h1>{isHindi ? "Character Database" : "Character Database"}</h1><p>{isHindi ? "5 verified character profiles — current values, Ability Effects, additional notes aur patch history ke saath." : "Five researched character profiles with current values, Ability Effects, additional notes and patch history."}</p></div><div className="character-db-count"><b>{profiles.length}</b><span>{isHindi ? "PROFILES" : "PROFILES"}<small> / 5 researched</small></span></div></header>
    <label className="character-search" role="search"><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={isHindi ? "Character ya ability search karein…" : "Search character or ability…"} aria-label="Search characters" autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="search"/>{query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search">×</button>}</label>
    <div className="character-results-head"><div><b>{isHindi ? "CHARACTER PROFILES" : "CHARACTER PROFILES"}</b><span>{matches.length} {isHindi ? "profiles found" : "profiles found"}</span></div><span className="character-sort-label">A–Z · Alphabetical</span></div>
    {matches.length ? <div className="character-profile-grid">{matches.map(profile => <button type="button" className="character-result-card" data-character-letter={profile.name[0].toUpperCase()} key={profile.id} onClick={() => setSelectedId(profile.id)}>
      <div className="character-result-art"><img src={profile.image} alt={profile.name} loading="lazy" decoding="async" fetchPriority="low" /><span>{profile.name.toUpperCase()}</span></div>
      <div className="character-result-copy"><span className="character-result-status">OFFICIAL-SOURCE PROFILE</span><h2>{profile.name}</h2><b>{profile.skill} · {profile.type.split(" · ")[0]}</b><p>{isHindi ? profile.introHi : profile.introEn}</p><span className="character-result-open">{isHindi ? "Open full profile" : "Open full profile"} <span aria-hidden="true">↗</span></span></div>
      <span className="character-result-chevron" aria-hidden="true">↗</span>
    </button>)}</div> : <div className="character-empty-state"><b>{isHindi ? "No matching character" : "No matching character"}</b><span>{isHindi ? "Koi doosra character name ya ability search karein." : "Try another name or ability."}</span></div>}
    <div className="character-load-more-wrap"><button type="button" className="character-load-more" aria-label="Toggle alphabet navigation" onClick={() => document.getElementById("character-alphabet-navigation")?.classList.toggle("is-open")}>More <span aria-hidden="true">＋</span></button><nav id="character-alphabet-navigation" className="character-alphabet-rail" aria-label="Alphabet navigation">{ "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(letter => <button type="button" key={letter} onClick={() => document.querySelector('[data-character-letter="' + letter + '"]')?.scrollIntoView({ behavior: "smooth", block: "start" })}>{letter}</button>)}</nav><p>{isHindi ? "Values official Garena character pages aur patch notes se cross-check ki gayi hain. Nero ke liye source discrepancy clearly flag ki gayi hai." : "Values are cross-checked against official Garena character pages and patch notes. The Nero source discrepancy is explicitly flagged."}</p></div>
  </main>;
}
