import { useMemo, useState } from "react";
import "./CharactersDatabase.css";

type Language = "en" | "hi-en";
type Props = { language: Language; onLanguageChange: (value: Language) => void; onBack: () => void };

const MORSE_IMAGE = "https://cdn-media.sforum.vn/storage/app/media/Bookgrinder2/nhan-vat-free-fire-moi-nhat-2.jpg";
const profileRows = [
  { en: "Stealth duration", hi: "Stealth की अवधि", value: "13 seconds" },
  { en: "Movement speed bonus", hi: "Movement Speed Bonus", value: "20%" },
  { en: "Temporary shield", hi: "Temporary Shield", value: "25 points" },
  { en: "Cooldown", hi: "Cooldown", value: "45 seconds" },
  { en: "Aim-assist trigger range", hi: "Aim-assist trigger range", value: "12 metres" },
  { en: "Exit delay", hi: "Stealth से बाहर आने का delay", value: "0.5 seconds" },
];

export default function CharactersDatabase({ language, onLanguageChange, onBack }: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(false);
  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const isHindi = language === "hi-en";
  const matches = useMemo(() => ["Morse"].filter(name => name.toLowerCase().includes(query.trim().toLowerCase()) || "stealth bytes".includes(query.trim().toLowerCase())), [query]);

  if (selected) return <main className="character-database character-profile-page">
    <div className="character-db-toolbar">
      <button type="button" className="character-back-button" onClick={() => setSelected(false)}><span aria-hidden="true">←</span> {isHindi ? "Characters पर वापस" : "Back to Characters"}</button>
      <div className="character-language-control" role="group" aria-label="Character page language">
        <button type="button" className={language === "en" ? "active" : ""} onClick={() => onLanguageChange("en")}>EN</button>
        <button type="button" className={language === "hi-en" ? "active" : ""} onClick={() => onLanguageChange("hi-en")}>HI+EN</button>
      </div>
    </div>
    <article className="character-profile">
      <header className="character-profile-identity">
        <div className="character-profile-art"><img src={MORSE_IMAGE} alt="Morse character artwork" /></div>
        <div className="character-profile-heading">
          <h2>Morse</h2>
          <span className="character-confirmed">{isHindi ? "Confirmed character · पुष्टि की गई" : "Confirmed character"}</span>
          <p className="character-skill-name"><b>Active skill:</b> Stealth Bytes</p>
          <p className="character-profile-summary">{isHindi ? "A stealth-focused character introduced in OB52. / OB52 में पेश किया गया stealth-focused character." : "New stealth-focused character, introduced in OB52."}</p>
        </div>
      </header>

      <section className="character-ability-section">
        <div className="character-section-eyebrow">{isHindi ? "CHARACTER ABILITY PROFILE" : "CHARACTER ABILITY PROFILE"}</div>
        <h1>{isHindi ? "Morse की Current OB55 Ability" : "Morse — Current OB55 Ability"}</h1>
        <p className="character-ability-intro">{isHindi ? "Garena के official OB55 character profile के अनुसार:" : "According to Garena's official OB55 character profile:"}</p>
        <div className="character-values-table" role="table" aria-label="Morse current ability values">
          <div className="character-values-row character-values-head" role="row"><span role="columnheader">{isHindi ? "Ability / Factor" : "Ability"}</span><span role="columnheader">{isHindi ? "Current value" : "Current value"}</span></div>
          {profileRows.map(row => <div className="character-values-row" role="row" key={row.en}><span role="cell">{isHindi ? row.hi : row.en}</span><strong role="cell">{row.value}</strong></div>)}
        </div>
        <section className="character-detail-block">
          <h3>{isHindi ? "Ability Effects / Skill का प्रभाव" : "Ability Effects"}</h3>
          <ul>
            <li>{isHindi ? "Enters Stealth mode; enemies beyond 12m को देखना मुश्किल होता है और enemies detect नहीं कर सकते।" : "Enters Stealth mode; enemies beyond 12m have difficulty seeing Morse, and enemies cannot detect him."}</li>
            <li>{isHindi ? "20% Movement Speed bonus और 25 temporary Shield Points मिलते हैं।" : "Grants a 20% Movement Speed bonus and 25 temporary Shield Points."}</li>
            <li>{isHindi ? "Stealth के दौरान Morse fire नहीं कर सकता।" : "Morse cannot fire while Stealth is active."}</li>
            <li>{isHindi ? "12m के भीतर enemy होने पर aim assist trigger होता है।" : "Aim assist is triggered when enemies are within 12m."}</li>
            <li>{isHindi ? "Stealth से बाहर आने में 0.5s का delay होता है।" : "Exiting Stealth has a 0.5s delay."}</li>
          </ul>
        </section>
        <section className="character-detail-block">
          <h3>{isHindi ? "Official profile details / अतिरिक्त जानकारी" : "Official profile details"}</h3>
          <div className="character-meta-grid">
            <div><span>{isHindi ? "Skill type" : "Skill type"}</span><b>Active · Stealth</b></div>
            <div><span>{isHindi ? "Cooldown" : "Cooldown"}</span><b>45 seconds</b></div>
            <div><span>{isHindi ? "Character age" : "Age"}</span><b>21</b></div>
            <div><span>{isHindi ? "Birthday" : "Birthday"}</span><b>11 November</b></div>
          </div>
        </section>
        <section className="character-detail-block character-source-block">
          <h3>{isHindi ? "Source & verification" : "Source & verification"}</h3>
          <p>{isHindi ? "Ability values Garena के current official character profile से ली गई हैं।" : "Ability values are taken from Garena's current official character profile."}</p>
          <a href="https://ff.garena.com/en/chars/785" target="_blank" rel="noreferrer">Garena Official — Morse Character Profile ↗</a>
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
    <header className="character-db-heading"><div><div className="character-db-eyebrow">OPERATIVE DATABASE · PHASE 1 TEST</div><h1>{isHindi ? "Character Database" : "Character Database"}</h1><p>{isHindi ? "Search verified character profiles and open the full ability breakdown." : "Search character profiles and open the complete ability breakdown."}</p></div><div className="character-db-count"><b>1</b><span>{isHindi ? "PROFILE READY" : "PROFILE READY"}<small> / 67 planned</small></span></div></header>
    <label className="character-search"><span aria-hidden="true">⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder={isHindi ? "Search character name or skill…" : "Search character name or skill…"} aria-label="Search characters"/>{query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search">×</button>}</label>
    <div className="character-results-head"><div><b>{isHindi ? "CHARACTER PROFILES" : "CHARACTER PROFILES"}</b><span>{matches.length} {isHindi ? "verified result" : "verified result"}{matches.length === 1 ? "" : "s"}</span></div><span className="character-sort-label">A–Z</span></div>
    {matches.length ? <button type="button" className="character-result-card" onClick={() => setSelected(true)}>
      <div className="character-result-art"><img src={MORSE_IMAGE} alt="Morse character artwork"/><span>01</span></div>
      <div className="character-result-copy"><span className="character-result-status">VERIFIED PROFILE</span><h2>Morse</h2><b>Stealth Bytes · Active</b><p>{isHindi ? "Stealth mode, speed boost, temporary shield और ability की पूरी जानकारी।" : "Stealth mode, speed boost, temporary shield and complete ability details."}</p><span className="character-result-open">{isHindi ? "Open full profile" : "Open full profile"} <span aria-hidden="true">↗</span></span></div>
      <span className="character-result-chevron" aria-hidden="true">↗</span>
    </button> : <div className="character-empty-state"><b>{isHindi ? "No matching character" : "No matching character"}</b><span>{isHindi ? "Try another name or skill." : "Try another name or skill."}</span></div>}
    <div className="character-load-more-wrap"><button type="button" className="character-load-more" onClick={() => setShowMoreInfo(value => !value)}>{isHindi ? "More characters" : "More characters"} <span>↗</span></button><p>{isHindi ? "अभी testing build में सिर्फ Morse का verified profile जोड़ा गया है। बाकी profiles verification के बाद इसी catalogue में आएँगे।" : "Only Morse is included in this test build. More profiles will appear here after verification."}</p></div>
    {showMoreInfo && <p className="character-more-note">Phase 1 test catalogue: 1 verified profile loaded.</p>}
  </main>;
}
