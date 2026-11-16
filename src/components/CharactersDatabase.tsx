import { useEffect, useMemo, useState } from "react";
import extraProfiles from "../data/characterProfilesExtra.json";
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

const baseProfiles: CharacterProfile[] = [
  {
    id: "ray", name: "Ray", image: "https://dl.dir.freefiremobile.com/common/web_event/official2.ff.garena.all/20264/1a2c81cd893f6ea43a527cb3b7b2f897.png", artworkMode: "shared-current", skill: "Bond of Eclipse", type: "Active · Tag / Link",
    introEn: "A survival ability profile based on Garena's current official character page.",
    introHi: "Ye Profile Garena ke current Official Character Page par di gayi information par based hai.",
    currentEn: [
      "Projects forward in a 30m fan-shaped area and tags the first undowned enemy hit for 10 seconds.",
      "Creates a link visible within 40m only to the skill user and the tagged target.",
      "If the tagged target reaches 30 HP or below, the ability's listed instant knockdown condition is met.",
      "A tagged target being knocked down or eliminated resets the skill and restores 10 HP per second for 3 seconds.",
    ],
    currentHi: ["30m ke Fan-shaped Area mein aage Effect bhejataa hai aur Hit hue pahale Undowned Enemy ko 10 seconds ke liye Tag karta hai.","40m ke andar Link sirph Skill User aur Tagged Target ko dikhaai deta hai.","Tagged Target ki HP 30 yaa usase kam hone par bataai gai Instant Knockdown Condition puri ho jaati hai.","Tagged Target ke Knockdown yaa Eliminate hone par Skill Reset hoti hai aur 3 seconds tak har second 10 HP wapas milti hai."],
    rows: [
      { en: "Forward area", hi: "aage ka Area", value: "30m · Fan-shaped" },
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
    notesHi: ["Link sirph Skill User aur Tagged Target ko dikhaai deta hai.","Skill Reset aur HP Recovery tabhi hoti hai jab Tagged Target Knockdown yaa Eliminate ho.","Current Official Profile mein 30 HP Threshold diya gaya hai; purane OB53 Announcement mein 40 HP tha. aaj ki Value ke liye Current Profile istemaal ki gai hai."],
    historyEn: ["OB53 introduction announcement listed the threshold as 40 HP or below. The current official character profile now lists 30 HP or below."],
    historyHi: ["OB53 ke Introduction Announcement mein Threshold 40 HP yaa usase kam bataya gaya tha. Current Official Character Profile mein ab 30 HP yaa usase kam diya gaya hai."],
    source: [
      { label: "Garena — Ray character profile", url: "https://ff.garena.com/en/chars/794" },
      { label: "Garena — OB53 Patch Notes", url: "https://ff.garena.com/en/article/1640/" },
    ],
    status: "Current profile checked · 14 Nov 2026",
  },
  {
    id: "morse", name: "Morse", image: "https://dl.dir.freefiremobile.com/common/web_event/official2.ff.garena.all/20261/87b0db20d90350d22979b03d8b65a567.png", artworkMode: "shared-current", skill: "Stealth Bytes", type: "Active · Stealth",
    introEn: "A stealth-focused ability. Current OB55 adjustments supersede older OB52 values.",
    introHi: "Ye Stealth-focused Ability hai. OB55 ke current changes, purane OB52 values ki jagah apply hote hain.",
    currentEn: [
      "Enters Stealth: enemies beyond 12m have difficulty seeing Morse, and enemy detection does not detect him.",
      "Grants a 20% movement-speed bonus and 25 temporary Shield Points.",
      "Maximum Stealth duration is 13 seconds.",
      "Morse cannot fire while Stealth is active; exiting Stealth has a 0.5-second delay.",
      "Aim assist can trigger when enemies are within 12m.",
    ],
    currentHi: ["Stealth mein jaane par 12m se dur maujood Enemy ke liye Morse ko dekhanaa mushkil hota hai aur Enemy Detection use detect nahi kar paataa.","20% Movement Speed Bonus aur 25 Temporary Shield Points milate hain.","Maximum Stealth Duration 13 seconds hai.","Stealth active rehne par Morse Fire nahi kar sakataa; Stealth se baahar aane mein 0.5-second Delay hota hai.","12m ke andar Enemy hone par Aim Assist Trigger ho sakataa hai."],
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
    notesHi: ["Stealth ke dauraan Firing bnd rehti hai.","12m Aim Assist Trigger Range, Visibility Description se alag Mechanic hai.","OB55 mein Aim Assist Trigger Range 4m se badhaakar 12m aur Maximum Stealth Duration 15s se ghataakar 13s ki gai."],
    historyEn: ["OB52 launch values included 15s duration, 4m aim-assist trigger range, and 1s exit delay. OB55 changed duration to 13s and aim-assist range to 12m. The current official profile also lists 25 temporary Shield Points and a 0.5s exit delay."],
    historyHi: ["OB52 Launch Values mein 15s Duration, 4m Aim Assist Trigger Range aur 1s Exit Delay the. OB55 mein Duration 13s aur Aim Assist Range 12m ki gai. Current Official Profile mein 25 Temporary Shield Points aur 0.5s Exit Delay bhi die gae hain."],
    source: [
      { label: "Garena — Morse character profile", url: "https://ff.garena.com/en/chars/785" },
      { label: "Garena — OB55 Patch Notes", url: "https://ff.garena.com/en/article/1712/" },
      { label: "Garena — OB52 Patch Notes", url: "https://dl.dir.freefiremobile.com/common/web_event/articles/en/1595.html" },
    ],
    status: "OB55 values reconciled · 14 Nov 2026",
  },
  {
    id: "nero", name: "Nero", image: "https://dl.dir.freefiremobile.com/common/web_event/official2.ff.garena.all/202510/5d937a0ac5fe4e67c97fb8fb8e43455e.png", artworkMode: "shared-current", skill: "Cryo Mind", type: "Active · Plushie / Area",
    introEn: "The current official character profile and older patch notes contain conflicting plushie and damage values; the conflict is explicitly flagged below.",
    introHi: "Current Official Character Profile aur purane Patch Notes mein Plushie aur Damage ki Values alag hain. Is difference ko neeche clearly flag kiya gaya hai.",
    currentEn: [
      "The current official profile describes a plushie with 1 HP, lasting 12 seconds and able to travel up to 50m (100m in BR).",
      "It tracks the nearest enemy in sight within 8m and creates an 8m-radius area.",
      "Inside the area, neither the user nor enemies can place Gloo Walls; the profile lists 6 HP/s loss for enemies.",
      "The area disappears if the plushie is destroyed; the destroyer is marked for 5 seconds.",
    ],
    currentHi: ["Current Official Profile ke mutabik Plushie ke paas 1 HP hai, yah 12 seconds tak rehta hai aur 50m tak ja sakta hai (BR mein 100m).","yah 8m ke andar Line of Sight mein maujood sabse nazdeeki Enemy ko Track karta hai aur 8m Radius ka Area banata hai.","Area ke andar n to user aur n hi Enemy Gloo Walls lagaa sakate hain; Profile ke mutabik Enemy ki HP har second 6 kam hoti hai.","Plushie Destroy hone par Area gaayab ho jata hai; use Destroy karne vaalaa 5 seconds ke liye Mark hota hai."],
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
    notesHi: ["Current Official Character Profile mein Plushie ke liye 1 HP aur Area Effect ke liye 6 HP/s diya gaya hai.","OB53 Patch Notes mein pahale Plushie 150 HP ka bataya gaya tha aur Area Effect 16 se ghataakar 14 HP/s kiya gayaa tha.","OB55 Notes mein Plushie ke atakane se judaa Bug Fix hai, lekin nai HP yaa Damage Values nahi di gain.","Official Sources mein antar hone ke kaaran 1 HP aur 6 HP/s ko Current Profile Snapshot maanen, puri tarah Reconciled Patch History ka nishkarsh nahi. Exact Values par bharosaa karne se pahale Game mein Verify karen."],
    historyEn: ["OB53 documented a 150-HP plushie and a reduction from 16 to 14 HP/s. The current official character profile now displays 1 HP and 6 HP/s. OB55 only records a stuck-plushie bug fix. This remains a source discrepancy."],
    historyHi: ["OB53 mein 150-HP Plushie aur Area Effect ko 16 se ghataakar 14 HP/s karne ka ullekh tha. Current Official Character Profile ab 1 HP aur 6 HP/s dikhaataa hai. OB55 mein sirph Plushie ke atakane ka Bug Fix darj hai. Sources ke bich yah antar abhi bhi maujood hai."],
    source: [
      { label: "Garena — Nero character profile", url: "https://ff.garena.com/en/chars/775" },
      { label: "Garena — OB53 Patch Notes", url: "https://ff.garena.com/en/article/1640/" },
      { label: "Garena — OB55 Patch Notes", url: "https://ff.garena.com/en/article/1712/" },
    ],
    status: "Source discrepancy flagged · 14 Nov 2026",
  },
  {
    id: "rin", name: "Rin", image: "https://dl.dir.freefiremobile.com/common/web_event/official2.ff.garena.all/20257/9aa96a782fab8633cbb57f9229e7a5e6.png", artworkMode: "shared-current", skill: "Gale of Kunai", type: "Passive · Stored charges",
    introEn: "A passive character ability listed by Garena. Weapon-specific mechanics are intentionally not detailed in this profile.",
    introHi: "Garena ne Rin ki is Passive Character Ability ko list kiya hai. Is Profile mein Weapon-specific Mechanics ki details jaanbujhkar nahi di gayi hain.",
    currentEn: [
      "Gale of Kunai is listed as Rin's passive survival ability.",
      "This profile keeps the character catalogue entry and official reference, but omits weapon-use details and combat guidance.",
    ],
    currentHi: ["Gale of Kunai ko Rin ki Passive Survival Ability ke rup mein darj kiya gayaa hai.","is Profile mein Character Catalogue Entry aur Official Reference rakhaa gayaa hai, lekin Weapon-use Details aur Combat Guidance shaamil nahi hain."],
    rows: [
      { en: "Ability type", hi: "Ability Type", value: "Passive" },
      { en: "Official skill name", hi: "Official Skill Name", value: "Gale of Kunai" },
      { en: "Cooldown", hi: "Cooldown", value: "Not listed on official profile" },
    ],
    notesEn: [
      "Garena's official profile identifies Gale of Kunai as Rin's special survival ability.",
      "Weapon-specific effects, targeting details and damage values are intentionally omitted.",
    ],
    notesHi: ["Garena ka Official Profile Gale of Kunai ko Rin ki Special Survival Ability bataataa hai.","Weapon-specific Effects, Targeting Details aur Damage Values jaanabujhakar shaamil nahi kie gae hain."],
    historyEn: ["OB50 introduced Rin and named her passive ability Gale of Kunai. OB55 later listed balance adjustments to this ability; weapon-specific details are not reproduced here."],
    historyHi: ["OB50 mein Rin aur usaki Passive Ability Gale of Kunai ko introduce kiya gayaa. OB55 mein baad mein is Ability ke Balance Adjustments darj hue; Weapon-specific Details yahaan doharaai nahi gai hain."],
    source: [
      { label: "Garena — Rin character profile", url: "https://ff.garena.com/en/chars/767" },
      { label: "Garena — OB50 Patch Notes", url: "https://ff.garena.com/en/article/1511/" },
      { label: "Garena — OB55 Patch Notes", url: "https://ff.garena.com/en/article/1712/" },
    ],
    status: "OB55 balance note checked · 14 Nov 2026",
  },
  {
    id: "oscar", name: "Oscar", image: "https://dl.dir.freefiremobile.com/common/web_event/official2.ff.garena.all/20252/d5d04e40eb00900e96a28828decdaff0.png", artworkMode: "shared-current", skill: "Valiant Dash", type: "Active",
    badge: "Official-source profile", lastChanged: "OB54 (23 Jun 2026)",
    introEn: "Active dash that destroys Gloo Walls and knocks back enemies.",
    introHi: "Oscar ki Active Dash Skill Gloo Walls destroy karti hai aur saamne aane wale Enemies ko Knockback deti hai.",
    currentEn: [
      "Dashes toward the target direction, detonating the first 3 Gloo Walls in the way with 25 DMG, while also dealing 25 DMG to and knocking back enemies encountered."
    ],
    currentHi: ["Target Direction mein Dash karta hai. raaste mein aane vaali pahali 3 Gloo Walls ko 25 DMG ke saath Detonate karta hai aur saamane aane vaale Enemy ko 25 DMG dekar Knockback karta hai."],
    rows: [
      { en: "Dash", hi: "Dash", value: "Toward the target direction" },
      { en: "Gloo Walls detonated", hi: "Gloo Walls Detonated", value: "First 3 in the way" },
      { en: "Damage to Gloo Walls", hi: "Gloo Walls ko Damage", value: "25 DMG" },
      { en: "Damage to enemies", hi: "Enemy ko Damage", value: "25 DMG with knockback" },
      { en: "Cooldown", hi: "Cooldown", value: "60 seconds" }
    ],
    notesEn: [
      "The cooldown was raised in OB54 because the short cooldown made Oscar strong in too many situations. The skill indicator adjusts to slopes (OB50)."
    ],
    notesHi: ["OB54 mein Cooldown badhaayaa gayaa kyonki kam Cooldown ki vajah se Oscar bahut jyaadaa Situations mein majabut ho rahaa tha. Skill Indicator dhalaan ke hisaab se Adjust hota hai (OB50)."],
    historyEn: [
      "OB48 (19 Feb 2025): Introduced with a 60s cooldown.",
      "OB49 (21 May 2025): Skill Card added.",
      "OB50 (30 Jul 2025): Skill indicator adjusts to slope inclines.",
      "OB54 (23 Jun 2026): Cooldown 45s to 60s; 9th Anniversary event Skill Boosts: Phantom Dash (longer dash range) and Sustained Dash (8s dash with speed rising over time)."
    ],
    historyHi: ["OB48 (19 Feb 2025): 60s Cooldown ke saath Introduce kiya gayaa.","OB49 (21 May 2025): Skill Card jodaa gayaa.","OB50 (30 Jul 2025): Skill Indicator dhalaan ke hisaab se Adjust hone lagaa.","OB54 (23 Jun 2026): Cooldown 45s se badhaakar 60s kiya gayaa; 9th Anniversary Event Skill Boosts: Phantom Dash (jyaadaa Dash Range) aur Sustained Dash (8s Dash, jisamen Speed samay ke saath badhati hai)."],
    source: [
      { label: "Garena — OB54", url: "https://ff.garena.com/en/article/1673/" },
      { label: "Garena — OB50", url: "https://ff.garena.com/en/article/1511/" },
      { label: "Garena — OB49", url: "https://ff.garena.com/en/article/1473/" },
      { label: "Garena — OB48", url: "https://ff.garena.com/en/article/1456/" }
    ],
    status: "OB55 values reconciled · 15 Nov 2026",
  },
  {
    id: "kassie", name: "Kassie", image: "https://dl.dir.freefiremobile.com/common/web_event/official2.ff.garena.all/20246/8d87fe1959e300741eda601e800c0f40.png", artworkMode: "shared-current", skill: "Electro Therapy", type: "Active · Healing / Link",
    introEn: "A support-focused character profile. Garena's current English page provides the complete healing values and link conditions.",
    introHi: "Ye Support-focused Character Profile hai. Garena ka current English Page Healing Values aur Link Conditions ki complete details deta hai.",
    currentEn: [
      "Basic Therapy forms a healing bond with one teammate and restores 3 HP/s to both Kassie and that teammate; the effect does not stack.",
      "The maximum bonding range is 20m. The bond breaks automatically beyond that range and can also be canceled manually.",
      "Focused Therapy is triggered by using the skill again and restores 100 HP to the target.",
      "When the target's HP is below 50, the skill auto-releases; the automatic heal is 50% of the manual amount.",
      "The official profile lists a 60-second cooldown for Focused Therapy; Basic Therapy has no cooldown."
    ],
    currentHi: ["Basic Therapy ek Teammate ke saath Healing Bond banati hai aur Kassie tathaa us Teammate, donon ko 3 HP/s wapas deti hai; yah Effect Stack nahi hota.","Maximum Bonding Range 20m hai. isase jyaadaa doori hone par Bond apane aap tut jata hai aur ise Manually bhi Cancel kiya ja sakta hai.","Skill dobaaraa istemaal karne par Focused Therapy Trigger hoti hai aur Target ko 100 HP wapas deti hai.","Target ki HP 50 se kam hone par Skill apane aap Release hoti hai; Automatic Heal, Manual Amount ka 50% hota hai.","Official Profile mein Focused Therapy ka Cooldown 60 seconds diya gaya hai; Basic Therapy ka koi Cooldown nahi hai."],
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
    notesHi: ["Healing Bond ke baare mein saaf taur par bataya gaya hai ki yah Stack nahi hota.","20m ki Range Bond banaae rakhane ki Limit hai; isase jyaadaa doori hone par Link tut jata hai.","Automatic Release Condition aur Manual Reactivation, Garena ke Description mein alag-alag Details hain.","Current Official Page par koi atirikt Verified Hidden Mechanics nahi di gai hain."],
    historyEn: [
      "Kassie's introduction notes document Basic Therapy at 3 HP/s for both linked players, a 20m maximum bond range, and Focused Therapy at 100 HP with a 60s cooldown.",
      "The current official character profile retains those same listed values; no later official numeric balance change was confirmed in the sources checked for this phase."
    ],
    historyHi: ["Kassie ke Introduction Notes mein Linked donon Players ke liye Basic Therapy 3 HP/s, Maximum Bond Range 20m aur Focused Therapy 100 HP ke saath 60s Cooldown diya gaya hai.","Current Official Character Profile mein bhi yahi Values di gai hain; is Phase mein jaanche gae Sources mein baad ka koi Official Numeric Balance Change Confirm nahi hua."],
    source: [
      { label: "Garena — Kassie character profile", url: "https://ff.garena.com/en/chars/727" },
      { label: "Garena — Kassie introduction / character notes", url: "https://ff.garena.com/en/article/1357/" }
    ],
    status: "Current English profile + introduction notes cross-checked · 14 Nov 2026"
  },
  {
    id: "kairos", name: "Kairos", image: "https://dl.dir.freefiremobile.com/common/web_event/official2.ff.garena.all/20246/ed1e34b6c47b37675eae84daffdf63b1.png", artworkMode: "shared-current", skill: "Defense Breaker", type: "Passive · EP modes",
    introEn: "A two-state passive ability driven by EP. Current English profile values are recorded separately from older short-form localized summaries.",
    introHi: "Ye EP se chalne wali two-mode Passive Ability hai. Current English Profile ki Values ko purane short-form localized summaries se alag rakha gaya hai.",
    currentEn: [
      "Defense Mode automatically restores 2 EP per second until EP is full.",
      "Breaker Mode activates when EP is full and the skill user first hits a shielded or armored target.",
      "While Breaker Mode is active, 5 EP is consumed per second.",
      "The official page describes an additional reduction to Shield Points or Armor Durability equal to 120 of the damage inflicted on shielded or armored targets.",
      "When EP reaches 0, the ability returns to Defense Mode."
    ],
    currentHi: ["Defense Mode mein EP Full hone tak har second apane aap 2 EP wapas milta hai.","EP Full hone par aur Skill User ke Shielded yaa Armored Target ko pahali baar Hit karne par Breaker Mode Activate hota hai.","Breaker Mode Active rehne par har second 5 EP kharch hota hai.","Official Page ke mutabik Shielded yaa Armored Target par die gae Damage ke 120 ke baraabar atirikt Shield Points yaa Armor Durability kam hoti hai.","EP 0 hone par Ability wapas Defense Mode mein aa jaati hai."],
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
    notesHi: ["Skill, Defense Mode aur Breaker Mode ke bich apane aap Switch hoti hai; Official Page mein Manual Toggle nahi diya gaya hai.","English Profile mein Exact 2 EP/s aur 5 EP/s Rates di gai hain; Short Localized Summaries mein ye Values nahi hain.","'120 of the damage inflicted' Phrase ko Garena ke Original Wording ke rup mein rakhaa gayaa hai; binaa pramaan ise Percentage nahi maanaa gayaa.","Current Official Page par koi atirikt Verified Hidden Mechanics nahi di gai hain."],
    historyEn: [
      "Kairos was introduced with Defense Breaker as an EP-based passive. The current English profile supplies the numeric recovery and consumption rates.",
      "No later official numeric balance adjustment for Defense Breaker was confirmed in the sources checked for this phase; older short-form localized pages are not used to overwrite the current English values."
    ],
    historyHi: ["Kairos ko Defense Breaker naam ki EP-based Passive Ability ke saath Introduce kiya gayaa tha. Current English Profile mein Numeric Recovery aur Consumption Rates di gai hain.","is Phase mein jaanche gae Sources mein Defense Breaker ka baad ka koi Official Numeric Balance Adjustment Confirm nahi hua; purane Short-form Localized Pages ke aadhaar par Current English Values nahi badali gai hain."],
    source: [
      { label: "Garena — Kairos character profile", url: "https://ff.garena.com/en/chars/728" },
      { label: "Garena — Kairos introduction / character notes", url: "https://ff.garena.com/en/article/1332/" }
    ],
    status: "Current English profile checked; wording ambiguity explicitly retained · 14 Nov 2026"
  },
  {
    id: "ryden", name: "Ryden", image: "https://dl.dir.freefiremobile.com/common/web_event/official2.ff.garena.all/20241/fb808bb7cfc4820384c7a52fee3201ea.png", artworkMode: "shared-current", skill: "Spider Trap", type: "Active · Deployable device",
    introEn: "An inventor character whose official skill entry describes a deployable spider device. The detailed values are cross-checked against Garena's localized character page.",
    introHi: "Ryden ek Inventor Character hai. Uski Official Skill ek deployable Spider Device describe karti hai. Detailed Values ko Garena ke localized character page se cross-check kiya gaya hai.",
    currentEn: [
      "The ability releases a destructible spider device that can remain active for up to 60 seconds.",
      "The device's movement can be stopped by activating the skill again within the first 10 seconds.",
      "Its detection radius is listed as 5m; it responds to the first opponent it detects.",
      "The listed movement reduction is 80%, and the listed HP effect is 10 HP per second for 4 seconds.",
      "The official localized profile lists a 60-second cooldown and up to 2 stored charges, with 10 seconds between uses."
    ],
    currentHi: ["Ability ek Destructible Spider Device Release karti hai, jo maximum 60 seconds tak Active rah sakataa hai.","pahale 10 seconds ke andar Skill dobaaraa Activate karake Device ki Movement roki ja sakti hai.","iska Detection Radius 5m diya gaya hai; yah sabse pahale Detect hue Opponent par Response karta hai.","Movement Reduction 80% di gai hai aur HP Effect 4 seconds tak har second 10 HP hai.","Official Localized Profile mein 60-second Cooldown aur maximum 2 Stored Charges di gai hain; donon Uses ke bich 10 seconds ka Gap hai."],
    rows: [
      { en: "Device duration", hi: "Device Duration", value: "Up to 60 seconds" },
      { en: "Movement-stop window", hi: "Movement-stop Window", value: "First 10 seconds" },
      { en: "Detection radius", hi: "Detection Radius", value: "5m" },
      { en: "Movement reduction", hi: "Movement Reduction", value: "80%" },
      { en: "Listed HP effect", hi: "Listed HP Effect", value: "10 HP/s · 4 seconds" },
      { en: "Cooldown", hi: "Cooldown", value: "60 seconds" },
      { en: "Stored charges", hi: "Stored Charges", value: "Up to 2" },
      { en: "Interval between uses", hi: "Uses ke bich Interval", value: "10 seconds" }
    ],
    notesEn: [
      "The spider device is destructible; this is stated in Garena's detailed localized profile.",
      "The 10-second stop window is separate from the device's 60-second maximum duration.",
      "The current English character page provides only a short summary, so exact numerical mechanics are attributed to Garena's Indonesian profile rather than presented as text from the English page.",
      "No additional verified hidden mechanics are stated in the official sources checked."
    ],
    notesHi: ["Garena ke Detailed Localized Profile ke mutabik Spider Device ko Destroy kiya ja sakta hai.","10-second Stop Window, Device ki 60-second Maximum Duration se alag hai.","Current English Character Page sirph Short Summary deta hai, isalie Exact Numeric Mechanics ko Garena ke Indonesian Profile se liyaa gayaa hai, English Page ka Text bataakar nahi.","jaanche gae Official Sources mein koi atirikt Verified Hidden Mechanics nahi di gai hain."],
    historyEn: [
      "The detailed official profile records a 60s device duration, 5m detection radius, 80% movement reduction, 10 HP/s for 4s, 60s cooldown and up to 2 stored charges.",
      "No later official numeric balance change was confirmed in the sources checked for this phase. The English page remains a summary and does not expose the full value set."
    ],
    historyHi: ["Detailed Official Profile mein 60s Device Duration, 5m Detection Radius, 80% Movement Reduction, 4s tak 10 HP/s, 60s Cooldown aur maximum 2 Stored Charges darj hain.","is Phase mein jaanche gae Sources mein baad ka koi Official Numeric Balance Change Confirm nahi hua. English Page abhi bhi Summary hai aur puri Values nahi dikhaataa."],
    source: [
      { label: "Garena — Ryden character profile (English)", url: "https://ff.garena.com/en/chars/707" },
      { label: "Garena — Ryden character profile (Indonesian detailed values)", url: "https://ff.garena.com/id/chars/717" }
    ],
    status: "English summary + detailed official localized page reconciled · 14 Nov 2026"
  },
  {
    id: "ignis", name: "Ignis", image: "https://dl.dir.freefiremobile.com/common/web_event/official2.ff.garena.all/20241/a393f95f57bdaa3d2031a052b6acef24.png", artworkMode: "shared-current", skill: "Untamed Flame", type: "Active · Moving screen",
    introEn: "Ignis's current English character page uses the name Untamed Flame. Older patch notes use Flame Mirage for the earlier version of the ability.",
    introHi: "Ignis ke current English Character Page par Skill ka naam Untamed Flame hai. Purane Patch Notes mein Ability ke earlier version ko Flame Mirage kaha gaya tha.",
    currentEn: [
      "The current official profile describes a flaming screen that is 12m wide and lasts 10 seconds.",
      "The maximum deployment distance is listed as 15m.",
      "The current profile lists a 60-second cooldown.",
      "The page describes contact effects on opponents and Gloo Walls; detailed numerical effects are preserved in the current official profile's source reference."
    ],
    currentHi: ["Current Official Profile mein 12m chaudi aur 10 seconds tak rehne vaali Flaming Screen di gai hai.","Maximum Deployment Distance 15m di gai hai.","Current Profile mein Cooldown 60 seconds hai.","Page Opponents aur Gloo Walls par Contact Effects bataataa hai; Detailed Numeric Effects Current Official Profile ke Source Reference mein die gae hain."],
    rows: [
      { en: "Screen width", hi: "Screen Width", value: "12m" },
      { en: "Duration", hi: "Duration", value: "10 seconds" },
      { en: "Maximum deployment distance", hi: "Maximum Deployment Distance", value: "15m" },
      { en: "Cooldown", hi: "Cooldown", value: "60 seconds" },
      { en: "Skill name on current page", hi: "Current Page par Skill Name", value: "Untamed Flame" },
      { en: "Earlier patch-note name", hi: "purane Patch Notes mein Skill Name", value: "Flame Mirage" }
    ],
    notesEn: [
      "The current character page is treated as the present-day reference; the OB42 introduction values are historical and should not overwrite it.",
      "The current English profile specifies 12m width, 10s duration, 15m maximum deployment distance and 60s cooldown.",
      "The ability's naming changed in the official page from the older Flame Mirage wording to Untamed Flame.",
      "No additional verified hidden mechanics are stated on the current official page."
    ],
    notesHi: ["Current Character Page ko aaj ki Reference Value maanaa gayaa hai; OB42 ki Introduction Values puraani hain aur unhen Current Values ki jagah istemaal nahi kiya gayaa.","Current English Profile mein 12m Width, 10s Duration, 15m Maximum Deployment Distance aur 60s Cooldown die gae hain.","Official Page par Ability ka naam purane Flame Mirage se badalakar Untamed Flame ho gayaa hai.","Current Official Page par koi atirikt Verified Hidden Mechanics nahi di gai hain."],
    historyEn: [
      "OB42 introduced Ignis as Flame Mirage with a 10m-wide screen lasting 8s and a 15m maximum deployment distance.",
      "A later official rework documented a 10m-wide screen lasting 10s, moving at 6m/s for up to 5s, with a 60s cooldown.",
      "The current English character page now lists Untamed Flame at 12m width, 10s duration, 15m maximum deployment distance and 60s cooldown. This current profile is used as the present snapshot."
    ],
    historyHi: ["OB42 mein Ignis ko Flame Mirage naam se Introduce kiya gayaa tha: 10m chaudi Screen, 8s Duration aur 15m Maximum Deployment Distance.","baad ke Official Rework mein 10m chaudi Screen, 10s Duration, maximum 5s tak 6m/s Movement aur 60s Cooldown darj hua.","Current English Character Page ab Untamed Flame ke liye 12m Width, 10s Duration, 15m Maximum Deployment Distance aur 60s Cooldown deta hai. aaj ki Snapshot Value ke liye Current Profile istemaal ki gai hai."],
    source: [
      { label: "Garena — Ignis current character profile", url: "https://ff.garena.com/en/chars/716" },
      { label: "Garena — OB42 introduction notes", url: "https://ff.garena.com/en/article/1266/" },
      { label: "Garena — Ignis official rework notes", url: "https://ff.garena.com/en/article/1456/" }
    ],
    status: "Current profile reconciled against OB42 + rework history · 14 Nov 2026"
  },
  {
    id: "suzy", name: "Suzy", image: "https://dl.dir.freefiremobile.com/common/web_event/official2.ff.garena.all/20246/2cdde4e7d5010be2a35971e19f2285e4.png", artworkMode: "shared-current", skill: "Money Mark", type: "Passive · In-match currency",
    introEn: "A bounty-themed passive ability whose official profile describes an in-match currency reward connected to marked opponents.",
    introHi: "Ye Bounty-themed Passive Ability hai. Official Profile ke mutabik marked Opponents se In-match Currency Reward milta hai.",
    currentEn: [
      "The current official profile lists 100 in-match currency for an ally who eliminates a marked opponent.",
      "Suzy receives an additional 100 in-match currency for an elimination she earns herself.",
      "The official character page does not provide a numeric cooldown, marking duration, marking range or maximum-mark count."
    ],
    currentHi: ["Current Official Profile ke mutabik Marked Opponent ko Eliminate karne vaale Ally ko 100 In-match Currency milti hai.","Suzy ko apni Elimination par atirikt 100 In-match Currency milti hai.","Official Character Page Numeric Cooldown, Marking Duration, Marking Range yaa Maximum Mark Count nahi bataataa."],
    rows: [
      { en: "Ally reward", hi: "Ally Reward", value: "100 in-match currency" },
      { en: "Suzy's additional reward", hi: "Suzy ka Additional Reward", value: "100 in-match currency" },
      { en: "Ability type", hi: "Ability Type", value: "Passive" },
      { en: "Cooldown", hi: "Cooldown", value: "Not listed on official profile" },
      { en: "Mark duration / range", hi: "Mark Duration / Range", value: "Not listed on official profile" }
    ],
    notesEn: [
      "The official description distinguishes the ally-team reward from Suzy's additional personal reward.",
      "The page does not state the exact trigger or duration for marking; these values are intentionally not inferred.",
      "No additional verified hidden mechanics are stated on the current official page."
    ],
    notesHi: ["Official Description, Ally-team Reward aur Suzy ke Additional Personal Reward ko alag-alag bataataa hai.","Page Marking ka Exact Trigger yaa Duration nahi bataataa; in Values ka anumaan nahi lagaayaa gayaa hai.","Current Official Page par koi atirikt Verified Hidden Mechanics nahi di gai hain."],
    historyEn: [
      "Suzy's introduction notes describe the Money Mark reward as 100 in-match currency for an ally who eliminates a marked opponent, plus an extra 100 for Suzy when she earns an elimination.",
      "The current official character page retains the same reward amounts. No later official numeric change was confirmed in the sources checked for this phase."
    ],
    historyHi: ["Suzy ke Introduction Notes mein Money Mark Reward is tarah diya gaya hai: Marked Opponent ko Eliminate karne vaale Ally ko 100 In-match Currency aur Suzy ko apni Elimination par atirikt 100.","Current Official Character Page par bhi yahi Reward Amounts hain. is Phase mein jaanche gae Sources mein baad ka koi Official Numeric Change Confirm nahi hua."],
    source: [
      { label: "Garena — Suzy character profile", url: "https://ff.garena.com/en/chars/677" },
      { label: "Garena — Suzy introduction / character notes", url: "https://ff.garena.com/en/article/1213/" }
    ],
    status: "Current official profile + introduction notes cross-checked · 14 Nov 2026"
  },

];
const profiles: CharacterProfile[] = [...baseProfiles, ...(extraProfiles as CharacterProfile[])];

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
    <header className="character-db-heading"><div><div className="character-db-eyebrow">OPERATIVE DATABASE · PHASE 1 + 2</div><h1>{isHindi ? "Character Database" : "Character Database"}</h1><p>{isHindi ? "Character profiles with shared profile layout, source notes and patch history." : "Character profiles with shared profile layout, source notes and patch history."}</p></div><div className="character-db-count"><b>{profiles.length}</b><span>{isHindi ? "PROFILES" : "PROFILES"}<small> / 67 target</small></span></div></header>
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
