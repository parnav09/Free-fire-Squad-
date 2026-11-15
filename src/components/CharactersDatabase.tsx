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
  {
    id: "kassie", name: "Kassie", image: "https://dl.dir.freefiremobile.com/common/web_event/official2.ff.garena.all/20246/8d87fe1959e300741eda601e800c0f40.png", skill: "Electro Therapy", type: "Active · Healing / Link",
    introEn: "A support-focused character profile. Garena's current English page provides the complete healing values and link conditions.",
    introHi: "Yeh support-focused character profile hai. Garena ke current English page par healing values aur link conditions detail mein listed hain.",
    currentEn: [
      "Basic Therapy forms a healing bond with one teammate and restores 3 HP/s to both Kassie and that teammate; the effect does not stack.",
      "The maximum bonding range is 20m. The bond breaks automatically beyond that range and can also be canceled manually.",
      "Focused Therapy is triggered by using the skill again and restores 100 HP to the target.",
      "When the target's HP is below 50, the skill auto-releases; the automatic heal is 50% of the manual amount.",
      "The official profile lists a 60-second cooldown for Focused Therapy; Basic Therapy has no cooldown."
    ],
    currentHi: [
      "Basic Therapy ek teammate ke saath healing bond banati hai aur Kassie aur us teammate dono ko 3 HP/s restore karti hai; effect stack nahi hota.",
      "Maximum bonding range 20m hai. Range cross hone par bond automatically break hota hai aur manually bhi cancel kiya ja sakta hai.",
      "Skill dobara use karne par Focused Therapy trigger hoti hai aur target ko 100 HP restore karti hai.",
      "Target ka HP 50 se neeche hone par skill auto-release hoti hai; automatic heal manual amount ka 50% hota hai.",
      "Official profile Focused Therapy ke liye 60-second cooldown list karta hai; Basic Therapy ka cooldown nahi hai."
    ],
    rows: [
      { en: "Basic Therapy recovery", hi: "Basic Therapy recovery", value: "3 HP/s · self + teammate" },
      { en: "Bond range", hi: "Bond range", value: "20m maximum" },
      { en: "Focused Therapy recovery", hi: "Focused Therapy recovery", value: "100 HP" },
      { en: "Auto-release threshold", hi: "Auto-release threshold", value: "Target below 50 HP" },
      { en: "Automatic heal amount", hi: "Automatic heal amount", value: "50% of manual amount" },
      { en: "Focused Therapy cooldown", hi: "Focused Therapy cooldown", value: "60 seconds" },
      { en: "Basic Therapy cooldown", hi: "Basic Therapy cooldown", value: "None" }
    ],
    notesEn: [
      "The healing bond is explicitly non-stackable.",
      "The 20m range limit applies to maintaining the bond; exceeding it breaks the link.",
      "The automatic release condition and manual reactivation are separate details in Garena's description.",
      "No additional verified hidden mechanics are stated on the current official page."
    ],
    notesHi: [
      "Healing bond officially non-stackable hai.",
      "20m range bond maintain karne ki limit hai; isse zyada distance par link toot jata hai.",
      "Automatic release condition aur manual reactivation, Garena description mein alag details hain.",
      "Current official page par koi additional verified hidden mechanics listed nahi hain."
    ],
    historyEn: [
      "Kassie's introduction notes document Basic Therapy at 3 HP/s for both linked players, a 20m maximum bond range, and Focused Therapy at 100 HP with a 60s cooldown.",
      "The current official character profile retains those same listed values; no later official numeric balance change was confirmed in the sources checked for this phase."
    ],
    historyHi: [
      "Kassie ke introduction notes mein linked dono players ke liye Basic Therapy 3 HP/s, 20m maximum bond range aur Focused Therapy 100 HP with 60s cooldown listed hai.",
      "Current official character profile mein bhi yehi values hain; is phase mein check kiye gaye sources mein baad ka koi official numeric balance change confirm nahi hua."
    ],
    source: [
      { label: "Garena — Kassie character profile", url: "https://ff.garena.com/en/chars/727" },
      { label: "Garena — Kassie introduction / character notes", url: "https://ff.garena.com/en/article/1357/" }
    ],
    status: "Current English profile + introduction notes cross-checked · 14 Nov 2026"
  },
  {
    id: "kairos", name: "Kairos", image: "https://dl.dir.freefiremobile.com/common/web_event/official2.ff.garena.all/20246/ed1e34b6c47b37675eae84daffdf63b1.png", skill: "Defense Breaker", type: "Passive · EP modes",
    introEn: "A two-state passive ability driven by EP. Current English profile values are recorded separately from older short-form localized summaries.",
    introHi: "Yeh EP-based two-state passive ability hai. Current English profile ki values ko purane short localized summaries se alag rakha gaya hai.",
    currentEn: [
      "Defense Mode automatically restores 2 EP per second until EP is full.",
      "Breaker Mode activates when EP is full and the skill user first hits a shielded or armored target.",
      "While Breaker Mode is active, 5 EP is consumed per second.",
      "The official page describes an additional reduction to Shield Points or Armor Durability equal to 120 of the damage inflicted on shielded or armored targets.",
      "When EP reaches 0, the ability returns to Defense Mode."
    ],
    currentHi: [
      "Defense Mode mein EP full hone tak automatically 2 EP per second restore hota hai.",
      "EP full hone par aur skill user ke shielded ya armored target ko pehli baar hit karne par Breaker Mode activate hota hai.",
      "Breaker Mode active rehne ke dauran 5 EP per second consume hota hai.",
      "Official page ke mutabik shielded ya armored target par inflicted damage ke 120 ke barabar additional Shield Points ya Armor Durability reduction hoti hai.",
      "EP 0 hone par ability wapas Defense Mode mein aa jati hai."
    ],
    rows: [
      { en: "Defense Mode recovery", hi: "Defense Mode recovery", value: "2 EP/s" },
      { en: "Breaker Mode EP cost", hi: "Breaker Mode EP cost", value: "5 EP/s" },
      { en: "Breaker Mode activation", hi: "Breaker Mode activation", value: "EP full + qualifying hit" },
      { en: "Additional defense reduction", hi: "Additional defense reduction", value: "120 of damage inflicted (official wording)" },
      { en: "Return condition", hi: "Return condition", value: "EP reaches 0" },
      { en: "Cooldown", hi: "Cooldown", value: "Not listed · passive"
      }
    ],
    notesEn: [
      "The skill switches between Defense Mode and Breaker Mode automatically; the official page does not list a manual toggle.",
      "The English profile specifies the exact 2 EP/s and 5 EP/s rates; shorter localized summaries omit those values.",
      "The phrase '120 of the damage inflicted' is preserved as Garena's wording rather than silently reinterpreted as a percentage.",
      "No additional verified hidden mechanics are stated on the current official page."
    ],
    notesHi: [
      "Skill Defense Mode aur Breaker Mode ke beech automatically switch hoti hai; official page manual toggle mention nahi karta.",
      "English profile exact 2 EP/s aur 5 EP/s rates deta hai; short localized summaries in values ko omit karte hain.",
      "'120 of the damage inflicted' phrase ko Garena ke original wording ke roop mein rakha gaya hai; ise bina proof percentage nahi maana gaya.",
      "Current official page par koi additional verified hidden mechanics listed nahi hain."
    ],
    historyEn: [
      "Kairos was introduced with Defense Breaker as an EP-based passive. The current English profile supplies the numeric recovery and consumption rates.",
      "No later official numeric balance adjustment for Defense Breaker was confirmed in the sources checked for this phase; older short-form localized pages are not used to overwrite the current English values."
    ],
    historyHi: [
      "Kairos ko Defense Breaker naam ki EP-based passive ability ke saath introduce kiya gaya tha. Current English profile numeric recovery aur consumption rates deta hai.",
      "Is phase mein check kiye gaye sources mein Defense Breaker ka later official numeric balance adjustment confirm nahi hua; short localized pages ko current English values ke upar preference nahi di gayi."
    ],
    source: [
      { label: "Garena — Kairos character profile", url: "https://ff.garena.com/en/chars/728" },
      { label: "Garena — Kairos introduction / character notes", url: "https://ff.garena.com/en/article/1332/" }
    ],
    status: "Current English profile checked; wording ambiguity explicitly retained · 14 Nov 2026"
  },
  {
    id: "ryden", name: "Ryden", image: "https://dl.dir.freefiremobile.com/common/web_event/official2.ff.garena.all/20241/fb808bb7cfc4820384c7a52fee3201ea.png", skill: "Spider Trap", type: "Active · Deployable device",
    introEn: "An inventor character whose official skill entry describes a deployable spider device. The detailed values are cross-checked against Garena's localized character page.",
    introHi: "Yeh inventor character hai jiska official skill ek deployable spider device describe karta hai. Detailed values Garena ke localized character page se cross-check ki gayi hain.",
    currentEn: [
      "The ability releases a destructible spider device that can remain active for up to 60 seconds.",
      "The device's movement can be stopped by activating the skill again within the first 10 seconds.",
      "Its detection radius is listed as 5m; it responds to the first opponent it detects.",
      "The listed movement reduction is 80%, and the listed HP effect is 10 HP per second for 4 seconds.",
      "The official localized profile lists a 60-second cooldown and up to 2 stored charges, with 10 seconds between uses."
    ],
    currentHi: [
      "Ability ek destructible spider device release karti hai jo maximum 60 seconds tak active reh sakta hai.",
      "Pehle 10 seconds ke andar skill dobara activate karke device ki movement roki ja sakti hai.",
      "Iska detection radius 5m listed hai; yeh sabse pehle detect hue opponent par respond karta hai.",
      "Listed movement reduction 80% hai aur listed HP effect 4 seconds tak 10 HP per second hai.",
      "Official localized profile 60-second cooldown aur maximum 2 stored charges list karta hai, jinke uses ke beech 10 seconds ka gap hai."
    ],
    rows: [
      { en: "Device duration", hi: "Device duration", value: "Up to 60 seconds" },
      { en: "Movement-stop window", hi: "Movement-stop window", value: "First 10 seconds" },
      { en: "Detection radius", hi: "Detection radius", value: "5m" },
      { en: "Movement reduction", hi: "Movement reduction", value: "80%" },
      { en: "Listed HP effect", hi: "Listed HP effect", value: "10 HP/s · 4 seconds" },
      { en: "Cooldown", hi: "Cooldown", value: "60 seconds" },
      { en: "Stored charges", hi: "Stored charges", value: "Up to 2" },
      { en: "Interval between uses", hi: "Interval between uses", value: "10 seconds" }
    ],
    notesEn: [
      "The spider device is destructible; this is stated in Garena's detailed localized profile.",
      "The 10-second stop window is separate from the device's 60-second maximum duration.",
      "The current English character page provides only a short summary, so exact numerical mechanics are attributed to Garena's Indonesian profile rather than presented as text from the English page.",
      "No additional verified hidden mechanics are stated in the official sources checked."
    ],
    notesHi: [
      "Spider device destructible hai; yeh Garena ke detailed localized profile mein stated hai.",
      "10-second stop window aur device ki 60-second maximum duration alag mechanics hain.",
      "Current English character page sirf short summary deta hai, isliye exact numerical mechanics Garena ke Indonesian profile ko attribute ki gayi hain.",
      "Check kiye gaye official sources mein koi additional verified hidden mechanics nahi mili."
    ],
    historyEn: [
      "The detailed official profile records a 60s device duration, 5m detection radius, 80% movement reduction, 10 HP/s for 4s, 60s cooldown and up to 2 stored charges.",
      "No later official numeric balance change was confirmed in the sources checked for this phase. The English page remains a summary and does not expose the full value set."
    ],
    historyHi: [
      "Detailed official profile mein 60s device duration, 5m detection radius, 80% movement reduction, 4s tak 10 HP/s, 60s cooldown aur maximum 2 stored charges record hain.",
      "Is phase mein check kiye gaye sources mein later official numeric balance change confirm nahi hua. English page abhi bhi summary hai aur full values show nahi karta."
    ],
    source: [
      { label: "Garena — Ryden character profile (English)", url: "https://ff.garena.com/en/chars/707" },
      { label: "Garena — Ryden character profile (Indonesian detailed values)", url: "https://ff.garena.com/id/chars/717" }
    ],
    status: "English summary + detailed official localized page reconciled · 14 Nov 2026"
  },
  {
    id: "ignis", name: "Ignis", image: "https://dl.dir.freefiremobile.com/common/web_event/official2.ff.garena.all/20241/a393f95f57bdaa3d2031a052b6acef24.png", skill: "Untamed Flame", type: "Active · Moving screen",
    introEn: "Ignis's current English character page uses the name Untamed Flame. Older patch notes use Flame Mirage for the earlier version of the ability.",
    introHi: "Ignis ke current English character page par skill ka naam Untamed Flame hai. Purane patch notes mein ability ke earlier version ke liye Flame Mirage naam use hua tha.",
    currentEn: [
      "The current official profile describes a flaming screen that is 12m wide and lasts 10 seconds.",
      "The maximum deployment distance is listed as 15m.",
      "The current profile lists a 60-second cooldown.",
      "The page describes contact effects on opponents and Gloo Walls; detailed numerical effects are preserved in the current official profile's source reference."
    ],
    currentHi: [
      "Current official profile 12m wide aur 10 seconds duration wali flaming screen describe karta hai.",
      "Maximum deployment distance 15m listed hai.",
      "Current profile 60-second cooldown list karta hai.",
      "Page opponents aur Gloo Walls par contact effects describe karta hai; detailed numerical effects current official profile ke source reference mein diye gaye hain."
    ],
    rows: [
      { en: "Screen width", hi: "Screen width", value: "12m" },
      { en: "Duration", hi: "Duration", value: "10 seconds" },
      { en: "Maximum deployment distance", hi: "Maximum deployment distance", value: "15m" },
      { en: "Cooldown", hi: "Cooldown", value: "60 seconds" },
      { en: "Skill name on current page", hi: "Skill name on current page", value: "Untamed Flame" },
      { en: "Earlier patch-note name", hi: "Earlier patch-note name", value: "Flame Mirage" }
    ],
    notesEn: [
      "The current character page is treated as the present-day reference; the OB42 introduction values are historical and should not overwrite it.",
      "The current English profile specifies 12m width, 10s duration, 15m maximum deployment distance and 60s cooldown.",
      "The ability's naming changed in the official page from the older Flame Mirage wording to Untamed Flame.",
      "No additional verified hidden mechanics are stated on the current official page."
    ],
    notesHi: [
      "Current character page ko present-day reference maana gaya hai; OB42 introduction values historical hain aur unhe current values ke upar use nahi kiya gaya.",
      "Current English profile 12m width, 10s duration, 15m maximum deployment distance aur 60s cooldown specify karta hai.",
      "Official page par ability ka naam purane Flame Mirage wording se Untamed Flame ho gaya hai.",
      "Current official page par koi additional verified hidden mechanics listed nahi hain."
    ],
    historyEn: [
      "OB42 introduced Ignis as Flame Mirage with a 10m-wide screen lasting 8s and a 15m maximum deployment distance.",
      "A later official rework documented a 10m-wide screen lasting 10s, moving at 6m/s for up to 5s, with a 60s cooldown.",
      "The current English character page now lists Untamed Flame at 12m width, 10s duration, 15m maximum deployment distance and 60s cooldown. This current profile is used as the present snapshot."
    ],
    historyHi: [
      "OB42 mein Ignis ko Flame Mirage ke naam se introduce kiya gaya tha: 10m-wide screen, 8s duration aur 15m maximum deployment distance.",
      "Baad ke official rework mein 10m-wide screen, 10s duration, maximum 5s tak 6m/s movement aur 60s cooldown record hua.",
      "Current English character page ab Untamed Flame ke liye 12m width, 10s duration, 15m maximum deployment distance aur 60s cooldown list karta hai. Present snapshot ke liye current profile use ki gayi hai."
    ],
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
    introHi: "Yeh bounty-themed passive ability hai jismein official profile marked opponents se linked in-match currency reward describe karta hai.",
    currentEn: [
      "The current official profile lists 100 in-match currency for an ally who eliminates a marked opponent.",
      "Suzy receives an additional 100 in-match currency for an elimination she earns herself.",
      "The official character page does not provide a numeric cooldown, marking duration, marking range or maximum-mark count."
    ],
    currentHi: [
      "Current official profile ke mutabik marked opponent ko eliminate karne wale ally ko 100 in-match currency milti hai.",
      "Suzy ko apni elimination par additional 100 in-match currency milti hai.",
      "Official character page numeric cooldown, marking duration, marking range ya maximum-mark count provide nahi karta."
    ],
    rows: [
      { en: "Ally reward", hi: "Ally reward", value: "100 in-match currency" },
      { en: "Suzy's additional reward", hi: "Suzy's additional reward", value: "100 in-match currency" },
      { en: "Ability type", hi: "Ability type", value: "Passive" },
      { en: "Cooldown", hi: "Cooldown", value: "Not listed on official profile" },
      { en: "Mark duration / range", hi: "Mark duration / range", value: "Not listed on official profile" }
    ],
    notesEn: [
      "The official description distinguishes the ally-team reward from Suzy's additional personal reward.",
      "The page does not state the exact trigger or duration for marking; these values are intentionally not inferred.",
      "No additional verified hidden mechanics are stated on the current official page."
    ],
    notesHi: [
      "Official description ally-team reward aur Suzy ke additional personal reward ko alag batata hai.",
      "Page marking ka exact trigger ya duration nahi batata; in values ka guess nahi kiya gaya.",
      "Current official page par koi additional verified hidden mechanics listed nahi hain."
    ],
    historyEn: [
      "Suzy's introduction notes describe the Money Mark reward as 100 in-match currency for an ally who eliminates a marked opponent, plus an extra 100 for Suzy when she earns an elimination.",
      "The current official character page retains the same reward amounts. No later official numeric change was confirmed in the sources checked for this phase."
    ],
    historyHi: [
      "Suzy ke introduction notes Money Mark reward ko is tarah describe karte hain: marked opponent ko eliminate karne wale ally ko 100 in-match currency, aur Suzy ki apni elimination par extra 100.",
      "Current official character page par bhi same reward amounts hain. Is phase mein check kiye gaye sources mein later official numeric change confirm nahi hua."
    ],
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
          <p className="character-skill-name">{shownProfile.abilityDisplayOnce ? `${shownProfile.skill.replace(/\\s*\\((?:Active|Passive)\\)$/i, "")} ${shownProfile.type.split(" · ")[0]}` : <><b>Ability:</b> {shownProfile.skill.replace(/\\s*\\((?:Active|Passive)\\)$/i, "")} · {shownProfile.type.split(" · ")[0]}</>}</p>
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
