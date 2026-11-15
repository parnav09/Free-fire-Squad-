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
    introHi: "yaha Profile, Garena ke maujoodaa Official Character Page para aadhaarita hai.",
    currentEn: [
      "Projects forward in a 30m fan-shaped area and tags the first undowned enemy hit for 10 seconds.",
      "Creates a link visible within 40m only to the skill user and the tagged target.",
      "If the tagged target reaches 30 HP or below, the ability's listed instant knockdown condition is met.",
      "A tagged target being knocked down or eliminated resets the skill and restores 10 HP per second for 3 seconds.",
    ],
    currentHi: ["30m ke Fan-shaped Area men aage Effect bhejataa hai aura Hit hue pahale Undowned Enemy ko 10 seconds ke lie Tag karataa hai.","40m ke andara Link sirpha Skill User aura Tagged Target ko dikhaaee detaa hai.","Tagged Target kee HP 30 yaa usase kama hone para bataaee gaee Instant Knockdown Condition pooree ho jaatee hai.","Tagged Target ke Knockdown yaa Eliminate hone para Skill Reset hotee hai aura 3 seconds taka hara second 10 HP vaapasa milatee hai."],
    rows: [
      { en: "Forward area", hi: "aage kaa Area", value: "30m · Fan-shaped" },
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
    notesHi: ["Link sirpha Skill User aura Tagged Target ko dikhaaee detaa hai.","Skill Reset aura HP Recovery tabhee hotee hai jaba Tagged Target Knockdown yaa Eliminate ho.","Current Official Profile men 30 HP Threshold diyaa gayaa hai; puraane OB53 Announcement men 40 HP thaa. aaja kee Value ke lie Current Profile istemaala kee gaee hai."],
    historyEn: ["OB53 introduction announcement listed the threshold as 40 HP or below. The current official character profile now lists 30 HP or below."],
    historyHi: ["OB53 ke Introduction Announcement men Threshold 40 HP yaa usase kama bataayaa gayaa thaa. Current Official Character Profile men aba 30 HP yaa usase kama diyaa gayaa hai."],
    source: [
      { label: "Garena — Ray character profile", url: "https://ff.garena.com/en/chars/794" },
      { label: "Garena — OB53 Patch Notes", url: "https://ff.garena.com/en/article/1640/" },
    ],
    status: "Current profile checked · 14 Nov 2026",
  },
  {
    id: "morse", name: "Morse", image: "https://dl.dir.freefiremobile.com/common/web_event/official2.ff.garena.all/20261/87b0db20d90350d22979b03d8b65a567.png", skill: "Stealth Bytes", type: "Active · Stealth",
    introEn: "A stealth-focused ability. Current OB55 adjustments supersede older OB52 values.",
    introHi: "yaha Stealth para aadhaarita Ability hai. OB55 ke maujoodaa badalaava puraane OB52 Values kee jagaha laagoo hote hain.",
    currentEn: [
      "Enters Stealth: enemies beyond 12m have difficulty seeing Morse, and enemy detection does not detect him.",
      "Grants a 20% movement-speed bonus and 25 temporary Shield Points.",
      "Maximum Stealth duration is 13 seconds.",
      "Morse cannot fire while Stealth is active; exiting Stealth has a 0.5-second delay.",
      "Aim assist can trigger when enemies are within 12m.",
    ],
    currentHi: ["Stealth men jaane para 12m se doora maujooda Enemy ke lie Morse ko dekhanaa mushkila hotaa hai aura Enemy Detection use detect naheen kara paataa.","20% Movement Speed Bonus aura 25 Temporary Shield Points milate hain.","Maximum Stealth Duration 13 seconds hai.","Stealth active rahane para Morse Fire naheen kara sakataa; Stealth se baahara aane men 0.5-second Delay hotaa hai.","12m ke andara Enemy hone para Aim Assist Trigger ho sakataa hai."],
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
    notesHi: ["Stealth ke dauraana Firing bnda rahatee hai.","12m Aim Assist Trigger Range, Visibility Description se alaga Mechanic hai.","OB55 men Aim Assist Trigger Range 4m se badhaakara 12m aura Maximum Stealth Duration 15s se ghataakara 13s kee gaee."],
    historyEn: ["OB52 launch values included 15s duration, 4m aim-assist trigger range, and 1s exit delay. OB55 changed duration to 13s and aim-assist range to 12m. The current official profile also lists 25 temporary Shield Points and a 0.5s exit delay."],
    historyHi: ["OB52 Launch Values men 15s Duration, 4m Aim Assist Trigger Range aura 1s Exit Delay the. OB55 men Duration 13s aura Aim Assist Range 12m kee gaee. Current Official Profile men 25 Temporary Shield Points aura 0.5s Exit Delay bhee die gae hain."],
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
    introHi: "Current Official Character Profile aura puraane Patch Notes men Plushie aura Damage kee Values alaga-alaga hain; isa antara ko neeche saapha taura para bataayaa gayaa hai.",
    currentEn: [
      "The current official profile describes a plushie with 1 HP, lasting 12 seconds and able to travel up to 50m (100m in BR).",
      "It tracks the nearest enemy in sight within 8m and creates an 8m-radius area.",
      "Inside the area, neither the user nor enemies can place Gloo Walls; the profile lists 6 HP/s loss for enemies.",
      "The area disappears if the plushie is destroyed; the destroyer is marked for 5 seconds.",
    ],
    currentHi: ["Current Official Profile ke mutaabika Plushie ke paasa 1 HP hai, yaha 12 seconds taka rahataa hai aura 50m taka jaa sakataa hai (BR men 100m).","yaha 8m ke andara Line of Sight men maujooda sabase najadeekee Enemy ko Track karataa hai aura 8m Radius kaa Area banaataa hai.","Area ke andara na to user aura na hee Enemy Gloo Walls lagaa sakate hain; Profile ke mutaabika Enemy kee HP hara second 6 kama hotee hai.","Plushie Destroy hone para Area gaayaba ho jaataa hai; use Destroy karane vaalaa 5 seconds ke lie Mark hotaa hai."],
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
    notesHi: ["Current Official Character Profile men Plushie ke lie 1 HP aura Area Effect ke lie 6 HP/s diyaa gayaa hai.","OB53 Patch Notes men pahale Plushie 150 HP kaa bataayaa gayaa thaa aura Area Effect 16 se ghataakara 14 HP/s kiyaa gayaa thaa.","OB55 Notes men Plushie ke atakane se judaa Bug Fix hai, lekina naee HP yaa Damage Values naheen dee gaeen.","Official Sources men antara hone ke kaarana 1 HP aura 6 HP/s ko Current Profile Snapshot maanen, pooree taraha Reconciled Patch History kaa nishkarsha naheen. Exact Values para bharosaa karane se pahale Game men Verify karen."],
    historyEn: ["OB53 documented a 150-HP plushie and a reduction from 16 to 14 HP/s. The current official character profile now displays 1 HP and 6 HP/s. OB55 only records a stuck-plushie bug fix. This remains a source discrepancy."],
    historyHi: ["OB53 men 150-HP Plushie aura Area Effect ko 16 se ghataakara 14 HP/s karane kaa ullekha thaa. Current Official Character Profile aba 1 HP aura 6 HP/s dikhaataa hai. OB55 men sirpha Plushie ke atakane kaa Bug Fix darja hai. Sources ke beecha yaha antara abhee bhee maujooda hai."],
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
    introHi: "Garena kee soochee men dee gaee eka Passive Character Ability. isa Profile men Weapon-specific Mechanics kee Detail jaanaboojhakara shaamila naheen kee gaee hai.",
    currentEn: [
      "Gale of Kunai is listed as Rin's passive survival ability.",
      "This profile keeps the character catalogue entry and official reference, but omits weapon-use details and combat guidance.",
    ],
    currentHi: ["Gale of Kunai ko Rin kee Passive Survival Ability ke roopa men darja kiyaa gayaa hai.","isa Profile men Character Catalogue Entry aura Official Reference rakhaa gayaa hai, lekina Weapon-use Details aura Combat Guidance shaamila naheen hain."],
    rows: [
      { en: "Ability type", hi: "Ability Type", value: "Passive" },
      { en: "Official skill name", hi: "Official Skill Name", value: "Gale of Kunai" },
      { en: "Cooldown", hi: "Cooldown", value: "Not listed on official profile" },
    ],
    notesEn: [
      "Garena's official profile identifies Gale of Kunai as Rin's special survival ability.",
      "Weapon-specific effects, targeting details and damage values are intentionally omitted.",
    ],
    notesHi: ["Garena kaa Official Profile Gale of Kunai ko Rin kee Special Survival Ability bataataa hai.","Weapon-specific Effects, Targeting Details aura Damage Values jaanaboojhakara shaamila naheen kie gae hain."],
    historyEn: ["OB50 introduced Rin and named her passive ability Gale of Kunai. OB55 later listed balance adjustments to this ability; weapon-specific details are not reproduced here."],
    historyHi: ["OB50 men Rin aura usakee Passive Ability Gale of Kunai ko introduce kiyaa gayaa. OB55 men baada men isa Ability ke Balance Adjustments darja hue; Weapon-specific Details yahaan doharaaee naheen gaee hain."],
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
    introHi: "eka Active Dash, jo Gloo Walls Destroy karataa hai aura Enemy ko Knockback detaa hai.",
    currentEn: [
      "Dashes toward the target direction, detonating the first 3 Gloo Walls in the way with 25 DMG, while also dealing 25 DMG to and knocking back enemies encountered."
    ],
    currentHi: ["Target Direction men Dash karataa hai. raaste men aane vaalee pahalee 3 Gloo Walls ko 25 DMG ke saatha Detonate karataa hai aura saamane aane vaale Enemy ko 25 DMG dekara Knockback karataa hai."],
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
    notesHi: ["OB54 men Cooldown badhaayaa gayaa kyonki kama Cooldown kee vajaha se Oscar bahuta jyaadaa Situations men majaboota ho rahaa thaa. Skill Indicator dhalaana ke hisaaba se Adjust hotaa hai (OB50)."],
    historyEn: [
      "OB48 (19 Feb 2025): Introduced with a 60s cooldown.",
      "OB49 (21 May 2025): Skill Card added.",
      "OB50 (30 Jul 2025): Skill indicator adjusts to slope inclines.",
      "OB54 (23 Jun 2026): Cooldown 45s to 60s; 9th Anniversary event Skill Boosts: Phantom Dash (longer dash range) and Sustained Dash (8s dash with speed rising over time)."
    ],
    historyHi: ["OB48 (19 Feb 2025): 60s Cooldown ke saatha Introduce kiyaa gayaa.","OB49 (21 May 2025): Skill Card jodaa gayaa.","OB50 (30 Jul 2025): Skill Indicator dhalaana ke hisaaba se Adjust hone lagaa.","OB54 (23 Jun 2026): Cooldown 45s se badhaakara 60s kiyaa gayaa; 9th Anniversary Event Skill Boosts: Phantom Dash (jyaadaa Dash Range) aura Sustained Dash (8s Dash, jisamen Speed samaya ke saatha badhatee hai)."],
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
    introHi: "yaha Support para kendrita Character Profile hai. Garena ke Current English Page para Healing Values aura Link Conditions pooree Detail men dee gaee hain.",
    currentEn: [
      "Basic Therapy forms a healing bond with one teammate and restores 3 HP/s to both Kassie and that teammate; the effect does not stack.",
      "The maximum bonding range is 20m. The bond breaks automatically beyond that range and can also be canceled manually.",
      "Focused Therapy is triggered by using the skill again and restores 100 HP to the target.",
      "When the target's HP is below 50, the skill auto-releases; the automatic heal is 50% of the manual amount.",
      "The official profile lists a 60-second cooldown for Focused Therapy; Basic Therapy has no cooldown."
    ],
    currentHi: ["Basic Therapy eka Teammate ke saatha Healing Bond banaatee hai aura Kassie tathaa usa Teammate, donon ko 3 HP/s vaapasa detee hai; yaha Effect Stack naheen hotaa.","Maximum Bonding Range 20m hai. isase jyaadaa dooree hone para Bond apane aapa toota jaataa hai aura ise Manually bhee Cancel kiyaa jaa sakataa hai.","Skill dobaaraa istemaala karane para Focused Therapy Trigger hotee hai aura Target ko 100 HP vaapasa detee hai.","Target kee HP 50 se kama hone para Skill apane aapa Release hotee hai; Automatic Heal, Manual Amount kaa 50% hotaa hai.","Official Profile men Focused Therapy kaa Cooldown 60 seconds diyaa gayaa hai; Basic Therapy kaa koee Cooldown naheen hai."],
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
    notesHi: ["Healing Bond ke baare men saapha taura para bataayaa gayaa hai ki yaha Stack naheen hotaa.","20m kee Range Bond banaae rakhane kee Limit hai; isase jyaadaa dooree hone para Link toota jaataa hai.","Automatic Release Condition aura Manual Reactivation, Garena ke Description men alaga-alaga Details hain.","Current Official Page para koee atirikta Verified Hidden Mechanics naheen dee gaee hain."],
    historyEn: [
      "Kassie's introduction notes document Basic Therapy at 3 HP/s for both linked players, a 20m maximum bond range, and Focused Therapy at 100 HP with a 60s cooldown.",
      "The current official character profile retains those same listed values; no later official numeric balance change was confirmed in the sources checked for this phase."
    ],
    historyHi: ["Kassie ke Introduction Notes men Linked donon Players ke lie Basic Therapy 3 HP/s, Maximum Bond Range 20m aura Focused Therapy 100 HP ke saatha 60s Cooldown diyaa gayaa hai.","Current Official Character Profile men bhee yahee Values dee gaee hain; isa Phase men jaanche gae Sources men baada kaa koee Official Numeric Balance Change Confirm naheen huaa."],
    source: [
      { label: "Garena — Kassie character profile", url: "https://ff.garena.com/en/chars/727" },
      { label: "Garena — Kassie introduction / character notes", url: "https://ff.garena.com/en/article/1357/" }
    ],
    status: "Current English profile + introduction notes cross-checked · 14 Nov 2026"
  },
  {
    id: "kairos", name: "Kairos", image: "https://dl.dir.freefiremobile.com/common/web_event/official2.ff.garena.all/20246/ed1e34b6c47b37675eae84daffdf63b1.png", skill: "Defense Breaker", type: "Passive · EP modes",
    introEn: "A two-state passive ability driven by EP. Current English profile values are recorded separately from older short-form localized summaries.",
    introHi: "EP se chalane vaalee do Modes kee Passive Ability. Current English Profile kee Values ko puraane Short-form Localized Summaries se alaga rakhaa gayaa hai.",
    currentEn: [
      "Defense Mode automatically restores 2 EP per second until EP is full.",
      "Breaker Mode activates when EP is full and the skill user first hits a shielded or armored target.",
      "While Breaker Mode is active, 5 EP is consumed per second.",
      "The official page describes an additional reduction to Shield Points or Armor Durability equal to 120 of the damage inflicted on shielded or armored targets.",
      "When EP reaches 0, the ability returns to Defense Mode."
    ],
    currentHi: ["Defense Mode men EP Full hone taka hara second apane aapa 2 EP vaapasa milataa hai.","EP Full hone para aura Skill User ke Shielded yaa Armored Target ko pahalee baara Hit karane para Breaker Mode Activate hotaa hai.","Breaker Mode Active rahane para hara second 5 EP kharcha hotaa hai.","Official Page ke mutaabika Shielded yaa Armored Target para die gae Damage ke 120 ke baraabara atirikta Shield Points yaa Armor Durability kama hotee hai.","EP 0 hone para Ability vaapasa Defense Mode men aa jaatee hai."],
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
    notesHi: ["Skill, Defense Mode aura Breaker Mode ke beecha apane aapa Switch hotee hai; Official Page men Manual Toggle naheen diyaa gayaa hai.","English Profile men Exact 2 EP/s aura 5 EP/s Rates dee gaee hain; Short Localized Summaries men ye Values naheen hain.","'120 of the damage inflicted' Phrase ko Garena ke Original Wording ke roopa men rakhaa gayaa hai; binaa pramaana ise Percentage naheen maanaa gayaa.","Current Official Page para koee atirikta Verified Hidden Mechanics naheen dee gaee hain."],
    historyEn: [
      "Kairos was introduced with Defense Breaker as an EP-based passive. The current English profile supplies the numeric recovery and consumption rates.",
      "No later official numeric balance adjustment for Defense Breaker was confirmed in the sources checked for this phase; older short-form localized pages are not used to overwrite the current English values."
    ],
    historyHi: ["Kairos ko Defense Breaker naama kee EP-based Passive Ability ke saatha Introduce kiyaa gayaa thaa. Current English Profile men Numeric Recovery aura Consumption Rates dee gaee hain.","isa Phase men jaanche gae Sources men Defense Breaker kaa baada kaa koee Official Numeric Balance Adjustment Confirm naheen huaa; puraane Short-form Localized Pages ke aadhaara para Current English Values naheen badalee gaee hain."],
    source: [
      { label: "Garena — Kairos character profile", url: "https://ff.garena.com/en/chars/728" },
      { label: "Garena — Kairos introduction / character notes", url: "https://ff.garena.com/en/article/1332/" }
    ],
    status: "Current English profile checked; wording ambiguity explicitly retained · 14 Nov 2026"
  },
  {
    id: "ryden", name: "Ryden", image: "https://dl.dir.freefiremobile.com/common/web_event/official2.ff.garena.all/20241/fb808bb7cfc4820384c7a52fee3201ea.png", skill: "Spider Trap", type: "Active · Deployable device",
    introEn: "An inventor character whose official skill entry describes a deployable spider device. The detailed values are cross-checked against Garena's localized character page.",
    introHi: "yaha Inventor Character hai jisakee Official Skill eka Deployable Spider Device bataatee hai. Detailed Values ko Garena ke Localized Character Page se Cross-check kiyaa gayaa hai.",
    currentEn: [
      "The ability releases a destructible spider device that can remain active for up to 60 seconds.",
      "The device's movement can be stopped by activating the skill again within the first 10 seconds.",
      "Its detection radius is listed as 5m; it responds to the first opponent it detects.",
      "The listed movement reduction is 80%, and the listed HP effect is 10 HP per second for 4 seconds.",
      "The official localized profile lists a 60-second cooldown and up to 2 stored charges, with 10 seconds between uses."
    ],
    currentHi: ["Ability eka Destructible Spider Device Release karatee hai, jo maximum 60 seconds taka Active raha sakataa hai.","pahale 10 seconds ke andara Skill dobaaraa Activate karake Device kee Movement rokee jaa sakatee hai.","isakaa Detection Radius 5m diyaa gayaa hai; yaha sabase pahale Detect hue Opponent para Response karataa hai.","Movement Reduction 80% dee gaee hai aura HP Effect 4 seconds taka hara second 10 HP hai.","Official Localized Profile men 60-second Cooldown aura maximum 2 Stored Charges dee gaee hain; donon Uses ke beecha 10 seconds kaa Gap hai."],
    rows: [
      { en: "Device duration", hi: "Device Duration", value: "Up to 60 seconds" },
      { en: "Movement-stop window", hi: "Movement-stop Window", value: "First 10 seconds" },
      { en: "Detection radius", hi: "Detection Radius", value: "5m" },
      { en: "Movement reduction", hi: "Movement Reduction", value: "80%" },
      { en: "Listed HP effect", hi: "Listed HP Effect", value: "10 HP/s · 4 seconds" },
      { en: "Cooldown", hi: "Cooldown", value: "60 seconds" },
      { en: "Stored charges", hi: "Stored Charges", value: "Up to 2" },
      { en: "Interval between uses", hi: "Uses ke beecha Interval", value: "10 seconds" }
    ],
    notesEn: [
      "The spider device is destructible; this is stated in Garena's detailed localized profile.",
      "The 10-second stop window is separate from the device's 60-second maximum duration.",
      "The current English character page provides only a short summary, so exact numerical mechanics are attributed to Garena's Indonesian profile rather than presented as text from the English page.",
      "No additional verified hidden mechanics are stated in the official sources checked."
    ],
    notesHi: ["Garena ke Detailed Localized Profile ke mutaabika Spider Device ko Destroy kiyaa jaa sakataa hai.","10-second Stop Window, Device kee 60-second Maximum Duration se alaga hai.","Current English Character Page sirpha Short Summary detaa hai, isalie Exact Numeric Mechanics ko Garena ke Indonesian Profile se liyaa gayaa hai, English Page kaa Text bataakara naheen.","jaanche gae Official Sources men koee atirikta Verified Hidden Mechanics naheen dee gaee hain."],
    historyEn: [
      "The detailed official profile records a 60s device duration, 5m detection radius, 80% movement reduction, 10 HP/s for 4s, 60s cooldown and up to 2 stored charges.",
      "No later official numeric balance change was confirmed in the sources checked for this phase. The English page remains a summary and does not expose the full value set."
    ],
    historyHi: ["Detailed Official Profile men 60s Device Duration, 5m Detection Radius, 80% Movement Reduction, 4s taka 10 HP/s, 60s Cooldown aura maximum 2 Stored Charges darja hain.","isa Phase men jaanche gae Sources men baada kaa koee Official Numeric Balance Change Confirm naheen huaa. English Page abhee bhee Summary hai aura pooree Values naheen dikhaataa."],
    source: [
      { label: "Garena — Ryden character profile (English)", url: "https://ff.garena.com/en/chars/707" },
      { label: "Garena — Ryden character profile (Indonesian detailed values)", url: "https://ff.garena.com/id/chars/717" }
    ],
    status: "English summary + detailed official localized page reconciled · 14 Nov 2026"
  },
  {
    id: "ignis", name: "Ignis", image: "https://dl.dir.freefiremobile.com/common/web_event/official2.ff.garena.all/20241/a393f95f57bdaa3d2031a052b6acef24.png", skill: "Untamed Flame", type: "Active · Moving screen",
    introEn: "Ignis's current English character page uses the name Untamed Flame. Older patch notes use Flame Mirage for the earlier version of the ability.",
    introHi: "Ignis ke Current English Character Page para Skill kaa naama Untamed Flame hai. puraane Patch Notes men Ability ke pahale Version ke lie Flame Mirage naama istemaala huaa thaa.",
    currentEn: [
      "The current official profile describes a flaming screen that is 12m wide and lasts 10 seconds.",
      "The maximum deployment distance is listed as 15m.",
      "The current profile lists a 60-second cooldown.",
      "The page describes contact effects on opponents and Gloo Walls; detailed numerical effects are preserved in the current official profile's source reference."
    ],
    currentHi: ["Current Official Profile men 12m chaudee aura 10 seconds taka rahane vaalee Flaming Screen dee gaee hai.","Maximum Deployment Distance 15m dee gaee hai.","Current Profile men Cooldown 60 seconds hai.","Page Opponents aura Gloo Walls para Contact Effects bataataa hai; Detailed Numeric Effects Current Official Profile ke Source Reference men die gae hain."],
    rows: [
      { en: "Screen width", hi: "Screen Width", value: "12m" },
      { en: "Duration", hi: "Duration", value: "10 seconds" },
      { en: "Maximum deployment distance", hi: "Maximum Deployment Distance", value: "15m" },
      { en: "Cooldown", hi: "Cooldown", value: "60 seconds" },
      { en: "Skill name on current page", hi: "Current Page para Skill Name", value: "Untamed Flame" },
      { en: "Earlier patch-note name", hi: "puraane Patch Notes men Skill Name", value: "Flame Mirage" }
    ],
    notesEn: [
      "The current character page is treated as the present-day reference; the OB42 introduction values are historical and should not overwrite it.",
      "The current English profile specifies 12m width, 10s duration, 15m maximum deployment distance and 60s cooldown.",
      "The ability's naming changed in the official page from the older Flame Mirage wording to Untamed Flame.",
      "No additional verified hidden mechanics are stated on the current official page."
    ],
    notesHi: ["Current Character Page ko aaja kee Reference Value maanaa gayaa hai; OB42 kee Introduction Values puraanee hain aura unhen Current Values kee jagaha istemaala naheen kiyaa gayaa.","Current English Profile men 12m Width, 10s Duration, 15m Maximum Deployment Distance aura 60s Cooldown die gae hain.","Official Page para Ability kaa naama puraane Flame Mirage se badalakara Untamed Flame ho gayaa hai.","Current Official Page para koee atirikta Verified Hidden Mechanics naheen dee gaee hain."],
    historyEn: [
      "OB42 introduced Ignis as Flame Mirage with a 10m-wide screen lasting 8s and a 15m maximum deployment distance.",
      "A later official rework documented a 10m-wide screen lasting 10s, moving at 6m/s for up to 5s, with a 60s cooldown.",
      "The current English character page now lists Untamed Flame at 12m width, 10s duration, 15m maximum deployment distance and 60s cooldown. This current profile is used as the present snapshot."
    ],
    historyHi: ["OB42 men Ignis ko Flame Mirage naama se Introduce kiyaa gayaa thaa: 10m chaudee Screen, 8s Duration aura 15m Maximum Deployment Distance.","baada ke Official Rework men 10m chaudee Screen, 10s Duration, maximum 5s taka 6m/s Movement aura 60s Cooldown darja huaa.","Current English Character Page aba Untamed Flame ke lie 12m Width, 10s Duration, 15m Maximum Deployment Distance aura 60s Cooldown detaa hai. aaja kee Snapshot Value ke lie Current Profile istemaala kee gaee hai."],
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
    introHi: "eka Bounty-themed Passive Ability, jisamen Official Profile Marked Opponents se judaa In-match Currency Reward bataatee hai.",
    currentEn: [
      "The current official profile lists 100 in-match currency for an ally who eliminates a marked opponent.",
      "Suzy receives an additional 100 in-match currency for an elimination she earns herself.",
      "The official character page does not provide a numeric cooldown, marking duration, marking range or maximum-mark count."
    ],
    currentHi: ["Current Official Profile ke mutaabika Marked Opponent ko Eliminate karane vaale Ally ko 100 In-match Currency milatee hai.","Suzy ko apanee Elimination para atirikta 100 In-match Currency milatee hai.","Official Character Page Numeric Cooldown, Marking Duration, Marking Range yaa Maximum Mark Count naheen bataataa."],
    rows: [
      { en: "Ally reward", hi: "Ally Reward", value: "100 in-match currency" },
      { en: "Suzy's additional reward", hi: "Suzy kaa Additional Reward", value: "100 in-match currency" },
      { en: "Ability type", hi: "Ability Type", value: "Passive" },
      { en: "Cooldown", hi: "Cooldown", value: "Not listed on official profile" },
      { en: "Mark duration / range", hi: "Mark Duration / Range", value: "Not listed on official profile" }
    ],
    notesEn: [
      "The official description distinguishes the ally-team reward from Suzy's additional personal reward.",
      "The page does not state the exact trigger or duration for marking; these values are intentionally not inferred.",
      "No additional verified hidden mechanics are stated on the current official page."
    ],
    notesHi: ["Official Description, Ally-team Reward aura Suzy ke Additional Personal Reward ko alaga-alaga bataataa hai.","Page Marking kaa Exact Trigger yaa Duration naheen bataataa; ina Values kaa anumaana naheen lagaayaa gayaa hai.","Current Official Page para koee atirikta Verified Hidden Mechanics naheen dee gaee hain."],
    historyEn: [
      "Suzy's introduction notes describe the Money Mark reward as 100 in-match currency for an ally who eliminates a marked opponent, plus an extra 100 for Suzy when she earns an elimination.",
      "The current official character page retains the same reward amounts. No later official numeric change was confirmed in the sources checked for this phase."
    ],
    historyHi: ["Suzy ke Introduction Notes men Money Mark Reward isa taraha diyaa gayaa hai: Marked Opponent ko Eliminate karane vaale Ally ko 100 In-match Currency aura Suzy ko apanee Elimination para atirikta 100.","Current Official Character Page para bhee yahee Reward Amounts hain. isa Phase men jaanche gae Sources men baada kaa koee Official Numeric Change Confirm naheen huaa."],
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
