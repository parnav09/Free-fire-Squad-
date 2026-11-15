import { useEffect, useMemo, useState } from "react";
import extraProfiles from "../data/characterProfilesExtra.json";
import "./CharactersDatabase.css";

type Language = "en" | "hi-en";
type Props = { language: Language; onLanguageChange: (value: Language) => void; onBack: () => void };
type DetailRow = { en: string; hi: string; value: string };
type CharacterProfile = {
  id: string;
  image: string;
  artworkMode?: "cutout" | "contained" | "official-fullbody";
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
  source: { label: string; url: string }[];
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

const baseProfiles: CharacterProfile[] = [
  {
    id: "ray", name: "Ray", image: "https://dl.dir.freefiremobile.com/common/web_event/official2.ff.garena.all/20264/1a2c81cd893f6ea43a527cb3b7b2f897.png", skill: "Bond of Eclipse", type: "Active · Tag / Link",
    introEn: "A survival ability profile based on Garena's current official character page.",
    introHi: "यह Profile, Garena के मौजूदा Official Character Page पर आधारित है।",
    currentEn: [
      "Projects forward in a 30m fan-shaped area and tags the first undowned enemy hit for 10 seconds.",
      "Creates a link visible within 40m only to the skill user and the tagged target.",
      "If the tagged target reaches 30 HP or below, the ability's listed instant knockdown condition is met.",
      "A tagged target being knocked down or eliminated resets the skill and restores 10 HP per second for 3 seconds.",
    ],
    currentHi: ["30m के Fan-shaped Area में आगे Effect भेजता है और Hit हुए पहले Undowned एनिमी को 10 seconds के लिए Tag करता है।","40m के अंदर Link सिर्फ Skill User और Tagged Target को दिखाई देता है।","Tagged Target की HP 30 या उससे कम होने पर बताई गई Instant Knockdown Condition पूरी हो जाती है।","Tagged Target के Knockdown या Eliminate होने पर Skill Reset होती है और 3 seconds तक हर second 10 HP वापस मिलती है।"],
    rows: [
      { en: "Forward area", hi: "आगे का Area", value: "30m · Fan-shaped" },
      { en: "Tag duration", hi: "Tag Duration", value: "10 seconds" },
      { en: "Link visibility", hi: "Link Visibility", value: "40m" },
      { en: "Threshold condition", hi: "Threshold Condition", value: "30 HP or below" },
      { en: "HP recovery", hi: "HP Recovery", value: "10 HP/s for 3s" },
      { en: "Cooldown", hi: "Cooldown", value: "45 seconds" },
    ],
    notesEn: [
      "The link visibility is limited to the skill user and the tagged target.",
      "The reset and HP recovery are conditional on the tagged target being knocked down or eliminated.",
      "The current official profile lists a 30 HP threshold; an older OB53 announcement listed 40 HP. The current profile is used for the present-day value.",
    ],
    notesHi: ["Link सिर्फ Skill User और Tagged Target को दिखाई देता है।","Skill Reset और HP Recovery तभी होती है जब Tagged Target Knockdown या Eliminate हो।","Current Official Profile में 30 HP Threshold दिया गया है; पुराने OB53 Announcement में 40 HP था। आज की Value के लिए Current Profile इस्तेमाल की गई है।"],
    historyEn: ["OB53 introduction announcement listed the threshold as 40 HP or below. The current official character profile now lists 30 HP or below."],
    historyHi: ["OB53 के Introduction Announcement में Threshold 40 HP या उससे कम बताया गया था। Current Official Character Profile में अब 30 HP या उससे कम दिया गया है।"],
    source: [
      { label: "Garena — Ray character profile", url: "https://ff.garena.com/en/chars/794" },
      { label: "Garena — OB53 Patch Notes", url: "https://ff.garena.com/en/article/1640/" },
    ],
    status: "Current profile checked · 14 Nov 2026",
  },
  {
    id: "morse", name: "Morse", image: "https://dl.dir.freefiremobile.com/common/web_event/official2.ff.garena.all/20261/87b0db20d90350d22979b03d8b65a567.png", skill: "Stealth Bytes", type: "Active · Stealth",
    introEn: "A stealth-focused ability. Current OB55 adjustments supersede older OB52 values.",
    introHi: "यह Stealth पर आधारित Ability है। OB55 के मौजूदा बदलाव पुराने OB52 Values की जगह लागू होते हैं।",
    currentEn: [
      "Enters Stealth: enemies beyond 12m have difficulty seeing Morse, and enemy detection does not detect him.",
      "Grants a 20% movement-speed bonus and 25 temporary Shield Points.",
      "Maximum Stealth duration is 13 seconds.",
      "Morse cannot fire while Stealth is active; exiting Stealth has a 0.5-second delay.",
      "Aim assist can trigger when enemies are within 12m.",
    ],
    currentHi: ["Stealth में जाने पर 12m से दूर मौजूद एनिमी के लिए Morse को देखना मुश्किल होता है और Enemy Detection उसे detect नहीं कर पाता।","20% Movement Speed Bonus और 25 Temporary Shield Points मिलते हैं।","Maximum Stealth Duration 13 seconds है।","Stealth active रहने पर Morse Fire नहीं कर सकता; Stealth से बाहर आने में 0.5-second Delay होता है।","12m के अंदर एनिमी होने पर Aim Assist Trigger हो सकता है।"],
    rows: [
      { en: "Maximum Stealth duration", hi: "Maximum Stealth Duration", value: "13 seconds" },
      { en: "Movement-speed bonus", hi: "Movement Speed Bonus", value: "20%" },
      { en: "Temporary Shield Points", hi: "Temporary Shield Points", value: "25" },
      { en: "Aim-assist trigger range", hi: "Aim Assist Trigger Range", value: "12m" },
      { en: "Exit delay", hi: "Exit Delay", value: "0.5 seconds" },
      { en: "Cooldown", hi: "Cooldown", value: "45 seconds" },
    ],
    notesEn: [
      "Firing is disabled during Stealth.",
      "The 12m aim-assist trigger range is a counterplay change, not the same as the visibility description.",
      "OB55 changed aim-assist trigger range from 4m to 12m and maximum Stealth duration from 15s to 13s.",
    ],
    notesHi: ["Stealth के दौरान Firing बंद रहती है।","12m Aim Assist Trigger Range, Visibility Description से अलग Mechanic है।","OB55 में Aim Assist Trigger Range 4m से बढ़ाकर 12m और Maximum Stealth Duration 15s से घटाकर 13s की गई।"],
    historyEn: ["OB52 launch values included 15s duration, 4m aim-assist trigger range, and 1s exit delay. OB55 changed duration to 13s and aim-assist range to 12m. The current official profile also lists 25 temporary Shield Points and a 0.5s exit delay."],
    historyHi: ["OB52 Launch Values में 15s Duration, 4m Aim Assist Trigger Range और 1s Exit Delay थे। OB55 में Duration 13s और Aim Assist Range 12m की गई। Current Official Profile में 25 Temporary Shield Points और 0.5s Exit Delay भी दिए गए हैं।"],
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
    introHi: "Current Official Character Profile और पुराने Patch Notes में Plushie और Damage की Values अलग-अलग हैं; इस अंतर को नीचे साफ तौर पर बताया गया है।",
    currentEn: [
      "The current official profile describes a plushie with 1 HP, lasting 12 seconds and able to travel up to 50m (100m in BR).",
      "It tracks the nearest enemy in sight within 8m and creates an 8m-radius area.",
      "Inside the area, neither the user nor enemies can place Gloo Walls; the profile lists 6 HP/s loss for enemies.",
      "The area disappears if the plushie is destroyed; the destroyer is marked for 5 seconds.",
    ],
    currentHi: ["Current Official Profile के मुताबिक Plushie के पास 1 HP है, यह 12 seconds तक रहता है और 50m तक जा सकता है (BR में 100m)।","यह 8m के अंदर Line of Sight में मौजूद सबसे नजदीकी एनिमी को Track करता है और 8m Radius का Area बनाता है।","Area के अंदर न तो user और न ही एनिमी Gloo Walls लगा सकते हैं; Profile के मुताबिक एनिमी की HP हर second 6 कम होती है।","Plushie Destroy होने पर Area गायब हो जाता है; उसे Destroy करने वाला 5 seconds के लिए Mark होता है।"],
    rows: [
      { en: "Plushie HP (current profile)", hi: "Plushie HP (Current Profile)", value: "1 HP" },
      { en: "Plushie duration", hi: "Plushie Duration", value: "12 seconds" },
      { en: "Travel distance", hi: "Travel Distance", value: "50m · 100m in BR" },
      { en: "Tracking range", hi: "Tracking Range", value: "8m · line of sight" },
      { en: "Area radius", hi: "Area Radius", value: "8m" },
      { en: "Enemy HP effect (current profile)", hi: "Enemy HP Effect (Current Profile)", value: "6 HP/s" },
      { en: "Destroyer mark", hi: "Destroyer Mark", value: "5 seconds" },
      { en: "Cooldown", hi: "Cooldown", value: "45 seconds" },
    ],
    notesEn: [
      "The current official character profile says 1 HP for the plushie and 6 HP/s for the area effect.",
      "OB53 patch notes previously described a 150-HP plushie and reduced the area effect from 16 to 14 HP/s.",
      "OB55 notes mention a bug fix for the plushie getting stuck, but do not provide replacement HP or damage values.",
      "Because these official sources conflict, treat 1 HP and 6 HP/s as the current profile snapshot, not a fully reconciled patch-history conclusion. Verify in-game before relying on exact values.",
    ],
    notesHi: ["Current Official Character Profile में Plushie के लिए 1 HP और Area Effect के लिए 6 HP/s दिया गया है।","OB53 Patch Notes में पहले Plushie 150 HP का बताया गया था और Area Effect 16 से घटाकर 14 HP/s किया गया था।","OB55 Notes में Plushie के अटकने से जुड़ा Bug Fix है, लेकिन नई HP या Damage Values नहीं दी गईं।","Official Sources में अंतर होने के कारण 1 HP और 6 HP/s को Current Profile Snapshot मानें, पूरी तरह Reconciled Patch History का निष्कर्ष नहीं। Exact Values पर भरोसा करने से पहले Game में Verify करें।"],
    historyEn: ["OB53 documented a 150-HP plushie and a reduction from 16 to 14 HP/s. The current official character profile now displays 1 HP and 6 HP/s. OB55 only records a stuck-plushie bug fix. This remains a source discrepancy."],
    historyHi: ["OB53 में 150-HP Plushie और Area Effect को 16 से घटाकर 14 HP/s करने का उल्लेख था। Current Official Character Profile अब 1 HP और 6 HP/s दिखाता है। OB55 में सिर्फ Plushie के अटकने का Bug Fix दर्ज है। Sources के बीच यह अंतर अभी भी मौजूद है।"],
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
    introHi: "Garena की सूची में दी गई एक Passive Character Ability। इस Profile में Weapon-specific Mechanics की Detail जानबूझकर शामिल नहीं की गई है।",
    currentEn: [
      "Gale of Kunai is listed as Rin's passive survival ability.",
      "This profile keeps the character catalogue entry and official reference, but omits weapon-use details and combat guidance.",
    ],
    currentHi: ["Gale of Kunai को Rin की Passive Survival Ability के रूप में दर्ज किया गया है।","इस Profile में Character Catalogue Entry और Official Reference रखा गया है, लेकिन Weapon-use Details और Combat Guidance शामिल नहीं हैं।"],
    rows: [
      { en: "Ability type", hi: "Ability Type", value: "Passive" },
      { en: "Official skill name", hi: "Official Skill Name", value: "Gale of Kunai" },
      { en: "Cooldown", hi: "Cooldown", value: "Not listed on official profile" },
    ],
    notesEn: [
      "Garena's official profile identifies Gale of Kunai as Rin's special survival ability.",
      "Weapon-specific effects, targeting details and damage values are intentionally omitted.",
    ],
    notesHi: ["Garena का Official Profile Gale of Kunai को Rin की Special Survival Ability बताता है।","Weapon-specific Effects, Targeting Details और Damage Values जानबूझकर शामिल नहीं किए गए हैं।"],
    historyEn: ["OB50 introduced Rin and named her passive ability Gale of Kunai. OB55 later listed balance adjustments to this ability; weapon-specific details are not reproduced here."],
    historyHi: ["OB50 में Rin और उसकी Passive Ability Gale of Kunai को introduce किया गया। OB55 में बाद में इस Ability के Balance Adjustments दर्ज हुए; Weapon-specific Details यहाँ दोहराई नहीं गई हैं।"],
    source: [
      { label: "Garena — Rin character profile", url: "https://ff.garena.com/en/chars/767" },
      { label: "Garena — OB50 Patch Notes", url: "https://ff.garena.com/en/article/1511/" },
      { label: "Garena — OB55 Patch Notes", url: "https://ff.garena.com/en/article/1712/" },
    ],
    status: "OB55 balance note checked · 14 Nov 2026",
  },
  {
    id: "oscar", name: "Oscar", image: "https://dl.dir.freefiremobile.com/common/web_event/official2.ff.garena.all/20252/d5d04e40eb00900e96a28828decdaff0.png", skill: "Valiant Dash", type: "Active",
    badge: "Official-source profile", lastChanged: "OB54 (23 Jun 2026)",
    introEn: "Active dash that destroys Gloo Walls and knocks back enemies.",
    introHi: "एक Active Dash, जो Gloo Walls Destroy करता है और एनिमी को Knockback देता है।",
    currentEn: [
      "Dashes toward the target direction, detonating the first 3 Gloo Walls in the way with 25 DMG, while also dealing 25 DMG to and knocking back enemies encountered."
    ],
    currentHi: ["Target Direction में Dash करता है। रास्ते में आने वाली पहली 3 Gloo Walls को 25 DMG के साथ Detonate करता है और सामने आने वाले एनिमी को 25 DMG देकर Knockback करता है।"],
    rows: [
      { en: "Dash", hi: "Dash", value: "Toward the target direction" },
      { en: "Gloo Walls detonated", hi: "Gloo Walls Detonated", value: "First 3 in the way" },
      { en: "Damage to Gloo Walls", hi: "Gloo Walls को Damage", value: "25 DMG" },
      { en: "Damage to enemies", hi: "एनिमी को Damage", value: "25 DMG with knockback" },
      { en: "Cooldown", hi: "Cooldown", value: "60 seconds" }
    ],
    notesEn: [
      "The cooldown was raised in OB54 because the short cooldown made Oscar strong in too many situations. The skill indicator adjusts to slopes (OB50)."
    ],
    notesHi: ["OB54 में Cooldown बढ़ाया गया क्योंकि कम Cooldown की वजह से Oscar बहुत ज्यादा Situations में मजबूत हो रहा था। Skill Indicator ढलान के हिसाब से Adjust होता है (OB50)।"],
    historyEn: [
      "OB48 (19 Feb 2025): Introduced with a 60s cooldown.",
      "OB49 (21 May 2025): Skill Card added.",
      "OB50 (30 Jul 2025): Skill indicator adjusts to slope inclines.",
      "OB54 (23 Jun 2026): Cooldown 45s to 60s; 9th Anniversary event Skill Boosts: Phantom Dash (longer dash range) and Sustained Dash (8s dash with speed rising over time)."
    ],
    historyHi: ["OB48 (19 Feb 2025): 60s Cooldown के साथ Introduce किया गया।","OB49 (21 May 2025): Skill Card जोड़ा गया।","OB50 (30 Jul 2025): Skill Indicator ढलान के हिसाब से Adjust होने लगा।","OB54 (23 Jun 2026): Cooldown 45s से बढ़ाकर 60s किया गया; 9th Anniversary Event Skill Boosts: Phantom Dash (ज्यादा Dash Range) और Sustained Dash (8s Dash, जिसमें Speed समय के साथ बढ़ती है)।"],
    source: [
      { label: "Garena — OB54", url: "https://ff.garena.com/en/article/1673/" },
      { label: "Garena — OB50", url: "https://ff.garena.com/en/article/1511/" },
      { label: "Garena — OB49", url: "https://ff.garena.com/en/article/1473/" },
      { label: "Garena — OB48", url: "https://ff.garena.com/en/article/1456/" }
    ],
    status: "OB55 values reconciled · 15 Nov 2026",
  },
  {
    id: "kassie", name: "Kassie", image: "https://dl.dir.freefiremobile.com/common/web_event/official2.ff.garena.all/20246/8d87fe1959e300741eda601e800c0f40.png", skill: "Electro Therapy", type: "Active · Healing / Link",
    introEn: "A support-focused character profile. Garena's current English page provides the complete healing values and link conditions.",
    introHi: "यह Support पर केंद्रित Character Profile है। Garena के Current English Page पर Healing Values और Link Conditions पूरी Detail में दी गई हैं।",
    currentEn: [
      "Basic Therapy forms a healing bond with one teammate and restores 3 HP/s to both Kassie and that teammate; the effect does not stack.",
      "The maximum bonding range is 20m. The bond breaks automatically beyond that range and can also be canceled manually.",
      "Focused Therapy is triggered by using the skill again and restores 100 HP to the target.",
      "When the target's HP is below 50, the skill auto-releases; the automatic heal is 50% of the manual amount.",
      "The official profile lists a 60-second cooldown for Focused Therapy; Basic Therapy has no cooldown."
    ],
    currentHi: ["Basic Therapy एक Teammate के साथ Healing Bond बनाती है और Kassie तथा उस Teammate, दोनों को 3 HP/s वापस देती है; यह Effect Stack नहीं होता।","Maximum Bonding Range 20m है। इससे ज्यादा दूरी होने पर Bond अपने आप टूट जाता है और इसे Manually भी Cancel किया जा सकता है।","Skill दोबारा इस्तेमाल करने पर Focused Therapy Trigger होती है और Target को 100 HP वापस देती है।","Target की HP 50 से कम होने पर Skill अपने आप Release होती है; Automatic Heal, Manual Amount का 50% होता है।","Official Profile में Focused Therapy का Cooldown 60 seconds दिया गया है; Basic Therapy का कोई Cooldown नहीं है।"],
    rows: [
      { en: "Basic Therapy recovery", hi: "Basic Therapy Recovery", value: "3 HP/s · self + teammate" },
      { en: "Bond range", hi: "Bond Range", value: "20m maximum" },
      { en: "Focused Therapy recovery", hi: "Focused Therapy Recovery", value: "100 HP" },
      { en: "Auto-release threshold", hi: "Auto-release Threshold", value: "Target below 50 HP" },
      { en: "Automatic heal amount", hi: "Automatic Heal Amount", value: "50% of manual amount" },
      { en: "Focused Therapy cooldown", hi: "Focused Therapy Cooldown", value: "60 seconds" },
      { en: "Basic Therapy cooldown", hi: "Basic Therapy Cooldown", value: "None" }
    ],
    notesEn: [
      "The healing bond is explicitly non-stackable.",
      "The 20m range limit applies to maintaining the bond; exceeding it breaks the link.",
      "The automatic release condition and manual reactivation are separate details in Garena's description.",
      "No additional verified hidden mechanics are stated on the current official page."
    ],
    notesHi: ["Healing Bond के बारे में साफ तौर पर बताया गया है कि यह Stack नहीं होता।","20m की Range Bond बनाए रखने की Limit है; इससे ज्यादा दूरी होने पर Link टूट जाता है।","Automatic Release Condition और Manual Reactivation, Garena के Description में अलग-अलग Details हैं।","Current Official Page पर कोई अतिरिक्त Verified Hidden Mechanics नहीं दी गई हैं।"],
    historyEn: [
      "Kassie's introduction notes document Basic Therapy at 3 HP/s for both linked players, a 20m maximum bond range, and Focused Therapy at 100 HP with a 60s cooldown.",
      "The current official character profile retains those same listed values; no later official numeric balance change was confirmed in the sources checked for this phase."
    ],
    historyHi: ["Kassie के Introduction Notes में Linked दोनों Players के लिए Basic Therapy 3 HP/s, Maximum Bond Range 20m और Focused Therapy 100 HP के साथ 60s Cooldown दिया गया है।","Current Official Character Profile में भी यही Values दी गई हैं; इस Phase में जाँचे गए Sources में बाद का कोई Official Numeric Balance Change Confirm नहीं हुआ।"],
    source: [
      { label: "Garena — Kassie character profile", url: "https://ff.garena.com/en/chars/727" },
      { label: "Garena — Kassie introduction / character notes", url: "https://ff.garena.com/en/article/1357/" }
    ],
    status: "Current English profile + introduction notes cross-checked · 14 Nov 2026"
  },
  {
    id: "kairos", name: "Kairos", image: "https://dl.dir.freefiremobile.com/common/web_event/official2.ff.garena.all/20246/ed1e34b6c47b37675eae84daffdf63b1.png", skill: "Defense Breaker", type: "Passive · EP modes",
    introEn: "A two-state passive ability driven by EP. Current English profile values are recorded separately from older short-form localized summaries.",
    introHi: "EP से चलने वाली दो Modes की Passive Ability। Current English Profile की Values को पुराने Short-form Localized Summaries से अलग रखा गया है।",
    currentEn: [
      "Defense Mode automatically restores 2 EP per second until EP is full.",
      "Breaker Mode activates when EP is full and the skill user first hits a shielded or armored target.",
      "While Breaker Mode is active, 5 EP is consumed per second.",
      "The official page describes an additional reduction to Shield Points or Armor Durability equal to 120 of the damage inflicted on shielded or armored targets.",
      "When EP reaches 0, the ability returns to Defense Mode."
    ],
    currentHi: ["Defense Mode में EP Full होने तक हर second अपने आप 2 EP वापस मिलता है।","EP Full होने पर और Skill User के Shielded या Armored Target को पहली बार Hit करने पर Breaker Mode Activate होता है।","Breaker Mode Active रहने पर हर second 5 EP खर्च होता है।","Official Page के मुताबिक Shielded या Armored Target पर दिए गए Damage के 120 के बराबर अतिरिक्त Shield Points या Armor Durability कम होती है।","EP 0 होने पर Ability वापस Defense Mode में आ जाती है।"],
    rows: [
      { en: "Defense Mode recovery", hi: "Defense Mode Recovery", value: "2 EP/s" },
      { en: "Breaker Mode EP cost", hi: "Breaker Mode EP Cost", value: "5 EP/s" },
      { en: "Breaker Mode activation", hi: "Breaker Mode Activation", value: "EP full + qualifying hit" },
      { en: "Additional defense reduction", hi: "Additional Defense Reduction", value: "120 of damage inflicted (official wording)" },
      { en: "Return condition", hi: "Return Condition", value: "EP reaches 0" },
      { en: "Cooldown", hi: "Cooldown", value: "Not listed · passive"
      }
    ],
    notesEn: [
      "The skill switches between Defense Mode and Breaker Mode automatically; the official page does not list a manual toggle.",
      "The English profile specifies the exact 2 EP/s and 5 EP/s rates; shorter localized summaries omit those values.",
      "The phrase '120 of the damage inflicted' is preserved as Garena's wording rather than silently reinterpreted as a percentage.",
      "No additional verified hidden mechanics are stated on the current official page."
    ],
    notesHi: ["Skill, Defense Mode और Breaker Mode के बीच अपने आप Switch होती है; Official Page में Manual Toggle नहीं दिया गया है।","English Profile में Exact 2 EP/s और 5 EP/s Rates दी गई हैं; Short Localized Summaries में ये Values नहीं हैं।","'120 of the damage inflicted' Phrase को Garena के Original Wording के रूप में रखा गया है; बिना प्रमाण इसे Percentage नहीं माना गया।","Current Official Page पर कोई अतिरिक्त Verified Hidden Mechanics नहीं दी गई हैं।"],
    historyEn: [
      "Kairos was introduced with Defense Breaker as an EP-based passive. The current English profile supplies the numeric recovery and consumption rates.",
      "No later official numeric balance adjustment for Defense Breaker was confirmed in the sources checked for this phase; older short-form localized pages are not used to overwrite the current English values."
    ],
    historyHi: ["Kairos को Defense Breaker नाम की EP-based Passive Ability के साथ Introduce किया गया था। Current English Profile में Numeric Recovery और Consumption Rates दी गई हैं।","इस Phase में जाँचे गए Sources में Defense Breaker का बाद का कोई Official Numeric Balance Adjustment Confirm नहीं हुआ; पुराने Short-form Localized Pages के आधार पर Current English Values नहीं बदली गई हैं।"],
    source: [
      { label: "Garena — Kairos character profile", url: "https://ff.garena.com/en/chars/728" },
      { label: "Garena — Kairos introduction / character notes", url: "https://ff.garena.com/en/article/1332/" }
    ],
    status: "Current English profile checked; wording ambiguity explicitly retained · 14 Nov 2026"
  },
  {
    id: "ryden", name: "Ryden", image: "https://dl.dir.freefiremobile.com/common/web_event/official2.ff.garena.all/20241/fb808bb7cfc4820384c7a52fee3201ea.png", skill: "Spider Trap", type: "Active · Deployable device",
    introEn: "An inventor character whose official skill entry describes a deployable spider device. The detailed values are cross-checked against Garena's localized character page.",
    introHi: "यह Inventor Character है जिसकी Official Skill एक Deployable Spider Device बताती है। Detailed Values को Garena के Localized Character Page से Cross-check किया गया है।",
    currentEn: [
      "The ability releases a destructible spider device that can remain active for up to 60 seconds.",
      "The device's movement can be stopped by activating the skill again within the first 10 seconds.",
      "Its detection radius is listed as 5m; it responds to the first opponent it detects.",
      "The listed movement reduction is 80%, and the listed HP effect is 10 HP per second for 4 seconds.",
      "The official localized profile lists a 60-second cooldown and up to 2 stored charges, with 10 seconds between uses."
    ],
    currentHi: ["Ability एक Destructible Spider Device Release करती है, जो maximum 60 seconds तक Active रह सकता है।","पहले 10 seconds के अंदर Skill दोबारा Activate करके Device की Movement रोकी जा सकती है।","इसका Detection Radius 5m दिया गया है; यह सबसे पहले Detect हुए Opponent पर Response करता है।","Movement Reduction 80% दी गई है और HP Effect 4 seconds तक हर second 10 HP है।","Official Localized Profile में 60-second Cooldown और maximum 2 Stored Charges दी गई हैं; दोनों Uses के बीच 10 seconds का Gap है।"],
    rows: [
      { en: "Device duration", hi: "Device Duration", value: "Up to 60 seconds" },
      { en: "Movement-stop window", hi: "Movement-stop Window", value: "First 10 seconds" },
      { en: "Detection radius", hi: "Detection Radius", value: "5m" },
      { en: "Movement reduction", hi: "Movement Reduction", value: "80%" },
      { en: "Listed HP effect", hi: "Listed HP Effect", value: "10 HP/s · 4 seconds" },
      { en: "Cooldown", hi: "Cooldown", value: "60 seconds" },
      { en: "Stored charges", hi: "Stored Charges", value: "Up to 2" },
      { en: "Interval between uses", hi: "Uses के बीच Interval", value: "10 seconds" }
    ],
    notesEn: [
      "The spider device is destructible; this is stated in Garena's detailed localized profile.",
      "The 10-second stop window is separate from the device's 60-second maximum duration.",
      "The current English character page provides only a short summary, so exact numerical mechanics are attributed to Garena's Indonesian profile rather than presented as text from the English page.",
      "No additional verified hidden mechanics are stated in the official sources checked."
    ],
    notesHi: ["Garena के Detailed Localized Profile के मुताबिक Spider Device को Destroy किया जा सकता है।","10-second Stop Window, Device की 60-second Maximum Duration से अलग है।","Current English Character Page सिर्फ Short Summary देता है, इसलिए Exact Numeric Mechanics को Garena के Indonesian Profile से लिया गया है, English Page का Text बताकर नहीं।","जाँचे गए Official Sources में कोई अतिरिक्त Verified Hidden Mechanics नहीं दी गई हैं।"],
    historyEn: [
      "The detailed official profile records a 60s device duration, 5m detection radius, 80% movement reduction, 10 HP/s for 4s, 60s cooldown and up to 2 stored charges.",
      "No later official numeric balance change was confirmed in the sources checked for this phase. The English page remains a summary and does not expose the full value set."
    ],
    historyHi: ["Detailed Official Profile में 60s Device Duration, 5m Detection Radius, 80% Movement Reduction, 4s तक 10 HP/s, 60s Cooldown और maximum 2 Stored Charges दर्ज हैं।","इस Phase में जाँचे गए Sources में बाद का कोई Official Numeric Balance Change Confirm नहीं हुआ। English Page अभी भी Summary है और पूरी Values नहीं दिखाता।"],
    source: [
      { label: "Garena — Ryden character profile (English)", url: "https://ff.garena.com/en/chars/707" },
      { label: "Garena — Ryden character profile (Indonesian detailed values)", url: "https://ff.garena.com/id/chars/717" }
    ],
    status: "English summary + detailed official localized page reconciled · 14 Nov 2026"
  },
  {
    id: "ignis", name: "Ignis", image: "https://dl.dir.freefiremobile.com/common/web_event/official2.ff.garena.all/20241/a393f95f57bdaa3d2031a052b6acef24.png", skill: "Untamed Flame", type: "Active · Moving screen",
    introEn: "Ignis's current English character page uses the name Untamed Flame. Older patch notes use Flame Mirage for the earlier version of the ability.",
    introHi: "Ignis के Current English Character Page पर Skill का नाम Untamed Flame है। पुराने Patch Notes में Ability के पहले Version के लिए Flame Mirage नाम इस्तेमाल हुआ था।",
    currentEn: [
      "The current official profile describes a flaming screen that is 12m wide and lasts 10 seconds.",
      "The maximum deployment distance is listed as 15m.",
      "The current profile lists a 60-second cooldown.",
      "The page describes contact effects on opponents and Gloo Walls; detailed numerical effects are preserved in the current official profile's source reference."
    ],
    currentHi: ["Current Official Profile में 12m चौड़ी और 10 seconds तक रहने वाली Flaming Screen दी गई है।","Maximum Deployment Distance 15m दी गई है।","Current Profile में Cooldown 60 seconds है।","Page Opponents और Gloo Walls पर Contact Effects बताता है; Detailed Numeric Effects Current Official Profile के Source Reference में दिए गए हैं।"],
    rows: [
      { en: "Screen width", hi: "Screen Width", value: "12m" },
      { en: "Duration", hi: "Duration", value: "10 seconds" },
      { en: "Maximum deployment distance", hi: "Maximum Deployment Distance", value: "15m" },
      { en: "Cooldown", hi: "Cooldown", value: "60 seconds" },
      { en: "Skill name on current page", hi: "Current Page पर Skill Name", value: "Untamed Flame" },
      { en: "Earlier patch-note name", hi: "पुराने Patch Notes में Skill Name", value: "Flame Mirage" }
    ],
    notesEn: [
      "The current character page is treated as the present-day reference; the OB42 introduction values are historical and should not overwrite it.",
      "The current English profile specifies 12m width, 10s duration, 15m maximum deployment distance and 60s cooldown.",
      "The ability's naming changed in the official page from the older Flame Mirage wording to Untamed Flame.",
      "No additional verified hidden mechanics are stated on the current official page."
    ],
    notesHi: ["Current Character Page को आज की Reference Value माना गया है; OB42 की Introduction Values पुरानी हैं और उन्हें Current Values की जगह इस्तेमाल नहीं किया गया।","Current English Profile में 12m Width, 10s Duration, 15m Maximum Deployment Distance और 60s Cooldown दिए गए हैं।","Official Page पर Ability का नाम पुराने Flame Mirage से बदलकर Untamed Flame हो गया है।","Current Official Page पर कोई अतिरिक्त Verified Hidden Mechanics नहीं दी गई हैं।"],
    historyEn: [
      "OB42 introduced Ignis as Flame Mirage with a 10m-wide screen lasting 8s and a 15m maximum deployment distance.",
      "A later official rework documented a 10m-wide screen lasting 10s, moving at 6m/s for up to 5s, with a 60s cooldown.",
      "The current English character page now lists Untamed Flame at 12m width, 10s duration, 15m maximum deployment distance and 60s cooldown. This current profile is used as the present snapshot."
    ],
    historyHi: ["OB42 में Ignis को Flame Mirage नाम से Introduce किया गया था: 10m चौड़ी Screen, 8s Duration और 15m Maximum Deployment Distance।","बाद के Official Rework में 10m चौड़ी Screen, 10s Duration, maximum 5s तक 6m/s Movement और 60s Cooldown दर्ज हुआ।","Current English Character Page अब Untamed Flame के लिए 12m Width, 10s Duration, 15m Maximum Deployment Distance और 60s Cooldown देता है। आज की Snapshot Value के लिए Current Profile इस्तेमाल की गई है।"],
    source: [
      { label: "Garena — Ignis current character profile", url: "https://ff.garena.com/en/chars/716" },
      { label: "Garena — OB42 introduction notes", url: "https://ff.garena.com/en/article/1266/" },
      { label: "Garena — Ignis official rework notes", url: "https://ff.garena.com/en/article/1456/" }
    ],
    status: "Current profile reconciled against OB42 + rework history · 14 Nov 2026"
  },
  {
    id: "suzy", name: "Suzy", image: "https://dl.dir.freefiremobile.com/common/web_event/official2.ff.garena.all/20246/2cdde4e7d5010be2a35971e19f2285e4.png", skill: "Money Mark", type: "Passive · In-match currency",
    introEn: "A bounty-themed passive ability whose official profile describes an in-match currency reward connected to marked opponents.",
    introHi: "एक Bounty-themed Passive Ability, जिसमें Official Profile Marked Opponents से जुड़ा In-match Currency Reward बताती है।",
    currentEn: [
      "The current official profile lists 100 in-match currency for an ally who eliminates a marked opponent.",
      "Suzy receives an additional 100 in-match currency for an elimination she earns herself.",
      "The official character page does not provide a numeric cooldown, marking duration, marking range or maximum-mark count."
    ],
    currentHi: ["Current Official Profile के मुताबिक Marked Opponent को Eliminate करने वाले Ally को 100 In-match Currency मिलती है।","Suzy को अपनी Elimination पर अतिरिक्त 100 In-match Currency मिलती है।","Official Character Page Numeric Cooldown, Marking Duration, Marking Range या Maximum Mark Count नहीं बताता।"],
    rows: [
      { en: "Ally reward", hi: "Ally Reward", value: "100 in-match currency" },
      { en: "Suzy's additional reward", hi: "Suzy का Additional Reward", value: "100 in-match currency" },
      { en: "Ability type", hi: "Ability Type", value: "Passive" },
      { en: "Cooldown", hi: "Cooldown", value: "Not listed on official profile" },
      { en: "Mark duration / range", hi: "Mark Duration / Range", value: "Not listed on official profile" }
    ],
    notesEn: [
      "The official description distinguishes the ally-team reward from Suzy's additional personal reward.",
      "The page does not state the exact trigger or duration for marking; these values are intentionally not inferred.",
      "No additional verified hidden mechanics are stated on the current official page."
    ],
    notesHi: ["Official Description, Ally-team Reward और Suzy के Additional Personal Reward को अलग-अलग बताता है।","Page Marking का Exact Trigger या Duration नहीं बताता; इन Values का अनुमान नहीं लगाया गया है।","Current Official Page पर कोई अतिरिक्त Verified Hidden Mechanics नहीं दी गई हैं।"],
    historyEn: [
      "Suzy's introduction notes describe the Money Mark reward as 100 in-match currency for an ally who eliminates a marked opponent, plus an extra 100 for Suzy when she earns an elimination.",
      "The current official character page retains the same reward amounts. No later official numeric change was confirmed in the sources checked for this phase."
    ],
    historyHi: ["Suzy के Introduction Notes में Money Mark Reward इस तरह दिया गया है: Marked Opponent को Eliminate करने वाले Ally को 100 In-match Currency और Suzy को अपनी Elimination पर अतिरिक्त 100।","Current Official Character Page पर भी यही Reward Amounts हैं। इस Phase में जाँचे गए Sources में बाद का कोई Official Numeric Change Confirm नहीं हुआ।"],
    source: [
      { label: "Garena — Suzy character profile", url: "https://ff.garena.com/en/chars/677" },
      { label: "Garena — Suzy introduction / character notes", url: "https://ff.garena.com/en/article/1213/" }
    ],
    status: "Current official profile + introduction notes cross-checked · 14 Nov 2026"
  },

];
const profiles: CharacterProfile[] = [...baseProfiles, ...(extraProfiles as CharacterProfile[])];

// The 19 remaining ability-character entries plus the two default characters.
// These are searchable name-only entries; no unverified ability/profile data is fabricated.
const pendingCharacterNames = [
  "Steffie", "Misha", "Maxim", "Caroline", "Notora", "Kla", "Primis", "Nulla",
];

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
  if (!profile.image || failed) return monogram;
  return <img
    className={profile.artworkMode === "official-fullbody" ? "character-art-image--official-fullbody" : undefined}
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
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(profiles.length);
  const [batchSize, setBatchSize] = useState(4);
  const isHindi = language === "hi-en";
  const selected = profiles.find(profile => profile.id === selectedId);
  const shownProfile = selected;
  const matches = useMemo(() => profiles
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
    setVisibleCount(profiles.length);
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
        <div className={`character-profile-art ${shownProfile.artworkMode === "official-fullbody" ? "character-profile-art--official-fullbody" : shownProfile.artworkMode === "cutout" ? "character-profile-art--cutout" : shownProfile.artworkMode === "contained" ? "character-profile-art--contained" : ""}`}><CharacterArtwork profile={shownProfile} variant="profile" /></div>
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
          <ul>{shownProfile.source.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.label}</a></li>)}</ul>
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
    <header className="character-db-heading"><div><div className="character-db-eyebrow">OPERATIVE DATABASE · PHASE 1 + 2</div><h1>{isHindi ? "Character Database" : "Character Database"}</h1><p>{isHindi ? "Character profiles with shared profile layout, source notes and patch history." : "Character profiles with shared profile layout, source notes and patch history."}</p></div><div className="character-db-count"><b>{profiles.length}</b><span>{isHindi ? "PROFILES" : "PROFILES"}<small> / 67 target</small></span></div></header>
    <div className="character-search-wrap"><label className="character-search" role="search"><span aria-hidden="true">⌕</span><input type="search" value={query} onFocus={() => setShowSuggestions(Boolean(query.trim()))} onChange={event => { setQuery(event.target.value); setShowSuggestions(Boolean(event.target.value.trim())); setActiveSuggestionIndex(0); }} onKeyDown={event => { if (event.key === "Escape") setShowSuggestions(false); if (event.key === "ArrowDown" && showSuggestions && suggestions.length) { event.preventDefault(); setActiveSuggestionIndex(index => (index + 1) % suggestions.length); } if (event.key === "ArrowUp" && showSuggestions && suggestions.length) { event.preventDefault(); setActiveSuggestionIndex(index => (index - 1 + suggestions.length) % suggestions.length); } if (event.key === "Enter" && showSuggestions && suggestions.length) { event.preventDefault(); chooseSuggestion(suggestions[activeSuggestionIndex] || suggestions[0]); } }} placeholder={isHindi ? "Character ya ability search karein…" : "Search character or ability…"} aria-label="Search characters" aria-autocomplete="list" aria-expanded={showSuggestions && suggestions.length > 0} aria-controls="character-search-suggestions" autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="search"/>{query && <button type="button" onClick={() => { setQuery(""); setShowSuggestions(false); setActiveSuggestionIndex(0); }} aria-label="Clear search">×</button>}</label>{showSuggestions && query.trim() && suggestions.length > 0 && <div className="character-search-suggestions" id="character-search-suggestions" role="listbox" aria-label="Matching characters">{suggestions.map((suggestion, index) => <button type="button" role="option" aria-selected={index === activeSuggestionIndex} className={index === activeSuggestionIndex ? "active" : ""} key={suggestion.id} onMouseDown={event => event.preventDefault()} onClick={() => chooseSuggestion(suggestion)}><span className="character-suggestion-name">{suggestion.name}</span><span className="character-suggestion-meta">{suggestion.meta}</span><span aria-hidden="true">↗</span></button>)}</div>}</div>
    <div className="character-results-head"><div><b>{isHindi ? "CHARACTER PROFILES" : "CHARACTER PROFILES"}</b><span>{totalMatchCount} {isHindi ? "matches found" : "matches found"}</span></div><span className="character-sort-label">A–Z · Alphabetical</span></div>
    {totalMatchCount ? <div className="character-profile-grid">{(query.trim() ? matches : matches.slice(0, visibleCount)).map(profile => <button type="button" className={`character-result-card ${profile.artworkMode === "cutout" ? "character-result-card--cutout" : profile.artworkMode === "contained" ? "character-result-card--contained" : ""}`} key={profile.id} onClick={() => setSelectedId(profile.id)}>
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
