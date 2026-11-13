import { useMemo, useState } from "react";
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
    introHi: "यह profile Garena के current official character page पर आधारित है।",
    currentEn: [
      "Projects forward in a 30m fan-shaped area and tags the first undowned enemy hit for 10 seconds.",
      "Creates a link visible within 40m only to the skill user and the tagged target.",
      "If the tagged target reaches 30 HP or below, the ability's listed instant knockdown condition is met.",
      "A tagged target being knocked down or eliminated resets the skill and restores 10 HP per second for 3 seconds.",
    ],
    currentHi: [
      "30m के fan-shaped area में आगे effect भेजता है और hit हुए पहले undowned enemy को 10 seconds के लिए tag करता है।",
      "Link 40m के भीतर केवल skill user और tagged target को दिखाई देता है।",
      "Tagged target का HP 30 या उससे कम होने पर listed instant knockdown condition पूरी होती है।",
      "Tagged target के knockdown या eliminate होने पर skill reset होती है और 3 seconds तक 10 HP per second restore होता है।",
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
      "Link केवल skill user और tagged target को दिखाई देता है।",
      "Skill reset और HP recovery तभी listed हैं जब tagged target knockdown या eliminate हो।",
      "Current official profile में 30 HP threshold है; पुराने OB53 announcement में 40 HP था। Current value के लिए latest profile लिया गया है।",
    ],
    historyEn: ["OB53 introduction announcement listed the threshold as 40 HP or below. The current official character profile now lists 30 HP or below."],
    historyHi: ["OB53 के introduction announcement में threshold 40 HP या कम था। Current official character profile अब 30 HP या कम दिखाता है।"],
    source: [
      { label: "Garena — Ray character profile", url: "https://ff.garena.com/en/chars/794" },
      { label: "Garena — OB53 Patch Notes", url: "https://ff.garena.com/en/article/1640/" },
    ],
    status: "Current profile checked · 14 Nov 2026",
  },
  {
    id: "morse", name: "Morse", image: "https://dl.dir.freefiremobile.com/common/web_event/official2.ff.garena.all/20261/87b0db20d90350d22979b03d8b65a567.png", skill: "Stealth Bytes", type: "Active · Stealth",
    introEn: "A stealth-focused ability. Current OB55 adjustments supersede older OB52 values.",
    introHi: "यह stealth-focused ability है। Current OB55 adjustments पुराने OB52 values से newer हैं।",
    currentEn: [
      "Enters Stealth: enemies beyond 12m have difficulty seeing Morse, and enemy detection does not detect him.",
      "Grants a 20% movement-speed bonus and 25 temporary Shield Points.",
      "Maximum Stealth duration is 13 seconds.",
      "Morse cannot fire while Stealth is active; exiting Stealth has a 0.5-second delay.",
      "Aim assist can trigger when enemies are within 12m.",
    ],
    currentHi: [
      "Stealth में जाने पर 12m से दूर enemies के लिए Morse को देखना मुश्किल होता है और enemy detection उसे detect नहीं करता।",
      "20% movement-speed bonus और 25 temporary Shield Points मिलते हैं।",
      "Maximum Stealth duration 13 seconds है।",
      "Stealth active होने पर Morse fire नहीं कर सकता; Stealth से बाहर आने में 0.5-second delay है।",
      "12m के अंदर enemies होने पर aim assist trigger हो सकता है।",
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
      "Stealth के दौरान firing disabled रहती है।",
      "12m aim-assist trigger range, visibility description से अलग mechanic है।",
      "OB55 में aim-assist trigger range 4m से 12m और maximum Stealth duration 15s से 13s की गई।",
    ],
    historyEn: ["OB52 launch values included 15s duration, 4m aim-assist trigger range, and 1s exit delay. OB55 changed duration to 13s and aim-assist range to 12m. The current official profile also lists 25 temporary Shield Points and a 0.5s exit delay."],
    historyHi: ["OB52 launch values में 15s duration, 4m aim-assist trigger range और 1s exit delay थे। OB55 ने duration 13s और aim-assist range 12m किया। Current official profile में 25 temporary Shield Points और 0.5s exit delay भी listed हैं।"],
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
    introHi: "Current official character profile और पुराने patch notes में plushie तथा damage values अलग हैं; नीचे इस अंतर को साफ़ दिखाया गया है।",
    currentEn: [
      "The current official profile describes a plushie with 1 HP, lasting 12 seconds and able to travel up to 50m (100m in BR).",
      "It tracks the nearest enemy in sight within 8m and creates an 8m-radius area.",
      "Inside the area, neither the user nor enemies can place Gloo Walls; the profile lists 6 HP/s loss for enemies.",
      "The area disappears if the plushie is destroyed; the destroyer is marked for 5 seconds.",
    ],
    currentHi: [
      "Current official profile के अनुसार plushie के 1 HP हैं, यह 12 seconds तक रहता है और 50m (BR में 100m) तक जा सकता है।",
      "यह 8m के भीतर sight में मौजूद nearest enemy को track करता है और 8m-radius area बनाता है।",
      "Area के अंदर user और enemies दोनों Gloo Walls place नहीं कर सकते; profile enemies के लिए 6 HP/s loss बताता है।",
      "Plushie destroy होने पर area खत्म हो जाता है; destroy करने वाला 5 seconds के लिए mark होता है।",
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
      "Current official character profile plushie के लिए 1 HP और area effect के लिए 6 HP/s बताता है।",
      "OB53 patch notes में पहले plushie 150-HP का बताया गया था और area effect 16 से 14 HP/s किया गया था।",
      "OB55 notes में plushie के जमीन में अटकने का bug fix है, लेकिन नए HP या damage values नहीं दिए गए।",
      "Official sources में conflict है; इसलिए 1 HP और 6 HP/s को current profile snapshot मानें, पूरी तरह reconciled patch-history conclusion नहीं। Exact values के लिए in-game verification जरूरी है।",
    ],
    historyEn: ["OB53 documented a 150-HP plushie and a reduction from 16 to 14 HP/s. The current official character profile now displays 1 HP and 6 HP/s. OB55 only records a stuck-plushie bug fix. This remains a source discrepancy."],
    historyHi: ["OB53 में 150-HP plushie और 16 से 14 HP/s reduction दर्ज था। Current official character profile अब 1 HP और 6 HP/s दिखाता है। OB55 में केवल stuck-plushie bug fix दर्ज है। यह source discrepancy अभी बनी हुई है।"],
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
    introHi: "Garena द्वारा listed passive character ability। इस profile में weapon-specific mechanics शामिल नहीं किए गए हैं।",
    currentEn: [
      "Gale of Kunai is listed as Rin's passive survival ability.",
      "This profile keeps the character catalogue entry and official reference, but omits weapon-use details and combat guidance.",
    ],
    currentHi: [
      "Gale of Kunai, Rin की passive survival ability के रूप में listed है।",
      "इस profile में character catalogue entry और official reference रखा गया है, लेकिन weapon-use details और combat guidance शामिल नहीं हैं।",
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
      "Garena का official profile Gale of Kunai को Rin की special survival ability बताता है।",
      "Weapon-specific effects, targeting details और damage values जानबूझकर शामिल नहीं किए गए हैं।",
    ],
    historyEn: ["OB50 introduced Rin and named her passive ability Gale of Kunai. OB55 later listed balance adjustments to this ability; weapon-specific details are not reproduced here."],
    historyHi: ["OB50 में Rin और उसकी passive ability Gale of Kunai पेश की गई। OB55 में इस ability के balance adjustments दर्ज हुए; weapon-specific details यहाँ शामिल नहीं हैं।"],
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
    introHi: "Base ability, cooldown adjustment और BR Skill Boost options को अलग-अलग document किया गया है।",
    currentEn: [
      "Dashes in the selected direction and detonates the first 3 Gloo Walls encountered, dealing 25 damage to each listed wall.",
      "Enemies encountered are listed as taking 25 damage and being knocked back.",
      "Current official profile cooldown is 60 seconds.",
      "In BR, OB54 documented two optional Skill Boosts: Phantom Dash increases dash range; Sustained Dash extends duration to 8 seconds, with speed initially reduced and then increasing.",
    ],
    currentHi: [
      "Selected direction में dash करता है और रास्ते में आने वाली पहली 3 Gloo Walls को detonate करता है; listed wall damage 25 है।",
      "Encounter होने वाले enemies को 25 damage और knockback listed है।",
      "Current official profile cooldown 60 seconds है।",
      "BR में OB54 ने दो optional Skill Boosts दर्ज किए: Phantom Dash dash range बढ़ाता है; Sustained Dash duration 8 seconds करता है, जिसमें speed पहले कम और फिर बढ़ती है।",
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
      "Phantom Dash dash range बढ़ाता है; patch note numeric increase नहीं बताता।",
      "Sustained Dash 8s तक रहता है और शुरुआत में कम dash speed होती है जो समय के साथ बढ़ती है।",
      "दोनों Skill Boost options BR progression choices हैं; patch notes के अनुसार केवल एक option select किया जा सकता है।",
      "OB54 में base cooldown 45s से 60s किया गया।",
    ],
    historyEn: ["Oscar's base profile lists 60s cooldown. OB54 increased it from 45s to 60s and introduced Phantom Dash and Sustained Dash as BR Skill Boost options."],
    historyHi: ["Oscar के base profile में 60s cooldown है। OB54 ने इसे 45s से 60s किया और BR Skill Boost options के रूप में Phantom Dash तथा Sustained Dash जोड़े।"],
    source: [
      { label: "Garena — Oscar character profile", url: "https://ff.garena.com/en/chars/769" },
      { label: "Garena — OB54 Patch Notes", url: "https://ff.garena.com/en/article/1673" },
      { label: "Garena — Original Oscar announcement", url: "https://ff.garena.com/en/article/1456" },
    ],
    status: "OB54 cooldown / boost notes checked · 14 Nov 2026",
  },
];

export default function CharactersDatabase({ language, onLanguageChange, onBack }: Props) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const isHindi = language === "hi-en";
  const selected = profiles.find(profile => profile.id === selectedId);
  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return profiles;
    return profiles.filter(profile =>
      [profile.name, profile.skill, profile.type, ...profile.currentEn, ...profile.notesEn]
        .join(" ").toLowerCase().includes(normalized)
    );
  }, [query]);

  const backLabel = isHindi ? "Characters पर वापस" : "Back to Characters";
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
          <h3>{sectionTitle("Ability Effects", "Ability Effects / Skill का प्रभाव")}</h3>
          {list(isHindi ? selected.currentHi : selected.currentEn)}
        </section>
        <section className="character-detail-block">
          <h3>{sectionTitle("Additional Mechanics & Notes", "Additional Mechanics & Notes / अतिरिक्त जानकारी")}</h3>
          {list(isHindi ? selected.notesHi : selected.notesEn)}
        </section>
        <section className="character-detail-block">
          <h3>{sectionTitle("Patch History", "Patch History / Update इतिहास")}</h3>
          {list(isHindi ? selected.historyHi : selected.historyEn)}
        </section>
        <section className="character-detail-block character-source-block">
          <h3>{sectionTitle("Official Sources", "Official Sources / आधिकारिक स्रोत")}</h3>
          <ul>{selected.source.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.label} ↗</a></li>)}</ul>
          <p>{sectionTitle("Values are a researched snapshot, not live game data. In-game values can change with later updates.", "ये values researched snapshot हैं, live game data नहीं। आगे के updates में in-game values बदल सकती हैं।")}</p>
        </section>
      </section>
    </article>
  </main>;

  return <main className="character-database">
    <div className="character-db-toolbar">
      <div><button type="button" className="character-back-button" onClick={onBack}><span aria-hidden="true">←</span> {isHindi ? "Combat Nexus पर वापस" : "Back to Combat Nexus"}</button><div className="character-db-eyebrow">SQUAD OS / COMBAT NEXUS</div></div>
      <div className="character-language-control" role="group" aria-label="Character page language">
        <button type="button" className={language === "en" ? "active" : ""} onClick={() => onLanguageChange("en")}>EN</button>
        <button type="button" className={language === "hi-en" ? "active" : ""} onClick={() => onLanguageChange("hi-en")}>HI+EN</button>
      </div>
    </div>
    <header className="character-db-heading"><div><div className="character-db-eyebrow">OPERATIVE DATABASE · PHASE 1 TEST</div><h1>{isHindi ? "Character Database" : "Character Database"}</h1><p>{isHindi ? "पाँच verified character profiles — current values, Ability Effects, additional notes और patch history के साथ।" : "Five researched character profiles with current values, Ability Effects, additional notes and patch history."}</p></div><div className="character-db-count"><b>{profiles.length}</b><span>{isHindi ? "PROFILES" : "PROFILES"}<small> / 5 researched</small></span></div></header>
    <label className="character-search"><span aria-hidden="true">⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder={isHindi ? "Search character या ability…" : "Search character or ability…"} aria-label="Search characters"/>{query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search">×</button>}</label>
    <div className="character-results-head"><div><b>{isHindi ? "CHARACTER PROFILES" : "CHARACTER PROFILES"}</b><span>{matches.length} {isHindi ? "profiles found" : "profiles found"}</span></div><span className="character-sort-label">A–Z</span></div>
    {matches.length ? <div className="character-profile-grid">{matches.map(profile => <button type="button" className="character-result-card" key={profile.id} onClick={() => setSelectedId(profile.id)}>
      <div className="character-result-art"><img src={profile.image} alt={profile.name} loading="lazy" /><span>{profile.name.toUpperCase()}</span></div>
      <div className="character-result-copy"><span className="character-result-status">OFFICIAL-SOURCE PROFILE</span><h2>{profile.name}</h2><b>{profile.skill} · {profile.type.split(" · ")[0]}</b><p>{isHindi ? profile.introHi : profile.introEn}</p><span className="character-result-open">{isHindi ? "Open full profile" : "Open full profile"} <span aria-hidden="true">↗</span></span></div>
      <span className="character-result-chevron" aria-hidden="true">↗</span>
    </button>)}</div> : <div className="character-empty-state"><b>{isHindi ? "No matching character" : "No matching character"}</b><span>{isHindi ? "दूसरा नाम या ability search करें।" : "Try another name or ability."}</span></div>}
    <div className="character-load-more-wrap"><p>{isHindi ? "Values official Garena character pages और patch notes से cross-check की गई हैं। Nero के लिए source discrepancy स्पष्ट रूप से flag की गई है।" : "Values are cross-checked against official Garena character pages and patch notes. The Nero source discrepancy is explicitly flagged."}</p></div>
  </main>;
}
