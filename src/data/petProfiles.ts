export type PetProfileRow = { label: string; value: string };
export type PetProfile = {
  skill: string;
  skillType: string;
  summary: string;
  rows: PetProfileRow[];
  effects: string[];
  mechanics: string[];
  patchHistory: string[];
  releaseData: string;
  progression: string;
  sources: { label: string; url: string }[];
  dataStatus: string;
};

export const petProfiles: Record<string, PetProfile> = {
  "agent-hop": {
    skill: "Bouncing Bonus",
    skillType: "Passive",
    summary: "Restores 50 EP upon safe zone shrinkage.",
    rows: [
      { label: "Primary effect", value: "Restores 50 EP upon safe zone shrinkage" },
      { label: "Cooldown", value: "No cooldown" },
      { label: "Release data", value: "OB30 · 2021-09-28" },
      { label: "Progression", value: "Lv2: Celebrate · Lv3: Play · Lv4: Bullseye Agent Hop" }
    ],
    effects: [
      "Triggers when the safe zone shrinks and restores 50 EP to the owner.",
      "The supplied report states that the trigger works regardless of the player's physical location on the map."
    ],
    mechanics: [
      "The supplied analysis describes EP as a secondary regenerative health pool and frames this pet as a passive resource-generation option.",
      "The report estimates up to 250 EP across a standard Battle Royale match cycle. Treat this as a report-supplied estimate, not an independently verified match guarantee."
    ],
    patchHistory: [
      "OB30 (2021-09-28): Release date stated in the supplied report.",
      "The report states that no balance changes have been recorded since introduction; this has not yet been independently source-checked."
    ],
    releaseData: "OB30 · 2021-09-28",
    progression: "Lv2: Celebrate · Lv3: Play · Lv4: Bullseye Agent Hop",
    sources: [
      { label: "Garena — Official Pets catalogue", url: "https://ff.garena.com/en/pets" },
      { label: "User-supplied report reference — Agent Hop", url: "https://ff.garena.com/en/pets/2" }
    ],
    dataStatus: "User-supplied profile · source verification pending"
  },
  "agumon": {
    skill: "None",
    skillType: "Passive · No gameplay skill",
    summary: "Purely cosmetic companion.",
    rows: [
      { label: "Primary effect", value: "Purely cosmetic companion" },
      { label: "Cooldown", value: "Not applicable" },
      { label: "Release data", value: "OB52 · 2025-12-02" },
      { label: "Progression", value: "Exact unlockables not published in the supplied report" }
    ],
    effects: [
      "The supplied report identifies Agumon as a cosmetic-only companion with no combat, resource-generation, or mobility ability."
    ],
    mechanics: [
      "The report associates Agumon with the Digimon collaboration.",
      "No gameplay skill or combat modifier is assigned in the supplied data."
    ],
    patchHistory: [
      "OB52 (2025-12-02): Release data stated in the supplied report; official collaboration and release details remain to be checked."
    ],
    releaseData: "OB52 · 2025-12-02",
    progression: "Garena does not publish exact unlockables (as stated in supplied report)",
    sources: [{ label: "Garena — Official Pets catalogue", url: "https://ff.garena.com/en/pets" }],
    dataStatus: "User-supplied profile · source verification pending"
  },
  "arvon": {
    skill: "Dinoculars",
    skillType: "Passive",
    summary: "Detects enemy density in a 50m radius.",
    rows: [
      { label: "Detection radius", value: "50m" },
      { label: "Detection duration", value: "6 seconds" },
      { label: "Maximum uses", value: "3 uses per match" },
      { label: "Cooldown", value: "Maximum 3 uses per match (no separate timer supplied)" },
      { label: "Release data", value: "OB37 · 2022-11-16" },
      { label: "Progression", value: "Lv2: Celebrate · Lv3: Play · Lv4: Ash Arvon" }
    ],
    effects: [
      "Sends a radar pulse that detects the numerical count of enemies within a 50m radius for six seconds.",
      "The supplied report says the count is shared instantly with all living teammates."
    ],
    mechanics: [
      "The report says detection penetrates obstacles and terrain geometry, including vertical and horizontal separation.",
      "The report distinguishes numerical enemy density from exact coordinate tracking.",
      "The report attributes a mini-map activation option to an OB41 interface optimization; this detail remains pending source verification."
    ],
    patchHistory: [
      "OB37 (2022-11-16): Release data stated in the supplied report.",
      "OB41: Mini-map activation optimization stated in the supplied report; exact patch wording remains to be checked."
    ],
    releaseData: "OB37 · 2022-11-16",
    progression: "Lv2: Celebrate · Lv3: Play · Lv4: Ash Arvon",
    sources: [{ label: "Garena — Official Pets catalogue", url: "https://ff.garena.com/en/pets" }],
    dataStatus: "User-supplied profile · source verification pending"
  },
  "beaston": {
    skill: "Helping Hand",
    skillType: "Passive",
    summary: "Increases throwing distance by 30%.",
    rows: [
      { label: "Throwing-distance increase", value: "30%" },
      { label: "Affected items", value: "Grenades, Gloo Walls, Flash Freeze, and other throwables (as stated in supplied report)" },
      { label: "Cooldown", value: "No cooldown" },
      { label: "Release data", value: "OB25 · 2021-01-01" },
      { label: "Progression", value: "Lv2: Celebrate · Lv3: Play · Lv4: Great White Beaston" }
    ],
    effects: [
      "Increases the throwing distance of throwables by 30%."
    ],
    mechanics: [
      "The supplied report describes the skill as changing projectile trajectory and throwable placement distance.",
      "The report specifically mentions Grenades, Gloo Walls, and Flash Freeze."
    ],
    patchHistory: [
      "OB25 (2021-01-01): Release data stated in the supplied report.",
      "The supplied report does not list a later balance change."
    ],
    releaseData: "OB25 · 2021-01-01",
    progression: "Lv2: Celebrate · Lv3: Play · Lv4: Great White Beaston",
    sources: [{ label: "Garena — Official Pets catalogue", url: "https://ff.garena.com/en/pets" }],
    dataStatus: "User-supplied profile · source verification pending"
  },
  "detective-panda": {
    skill: "Panda's Blessings",
    skillType: "Passive",
    summary: "Restores 10 HP upon securing an elimination.",
    rows: [
      { label: "HP restored", value: "10 HP" },
      { label: "Trigger", value: "Securing an elimination" },
      { label: "Cooldown", value: "No cooldown" },
      { label: "Release data", value: "OB16 · 2019-06-22" },
      { label: "Progression", value: "Lv2: Celebrate · Lv3: Play · Lv4: Wild Panda" }
    ],
    effects: [
      "Restores 10 HP to the owner immediately after an elimination."
    ],
    mechanics: [
      "The supplied report describes this as a small immediate sustain effect after a successful elimination.",
      "The report's percentage comparison assumes a 200 HP pool; that comparison is contextual rather than a separate pet parameter."
    ],
    patchHistory: [
      "OB16 (2019-06-22): Release data stated in the supplied report.",
      "The supplied report lists no later balance change."
    ],
    releaseData: "OB16 · 2019-06-22",
    progression: "Lv2: Celebrate · Lv3: Play · Lv4: Wild Panda",
    sources: [{ label: "Garena — Official Pets catalogue", url: "https://ff.garena.com/en/pets" }],
    dataStatus: "User-supplied profile · source verification pending"
  },
  "dr-beanie": {
    skill: "Dashy Duckwalk",
    skillType: "Passive",
    summary: "Increases movement speed while crouching by 60%.",
    rows: [
      { label: "Crouching movement-speed increase", value: "60%" },
      { label: "Trigger", value: "While crouching" },
      { label: "Cooldown", value: "No cooldown" },
      { label: "Release data", value: "OB27 · 2021-03-31" },
      { label: "Progression", value: "Lv2: Celebrate · Lv3: Play · Lv4: Sgt. Beanie" }
    ],
    effects: [
      "Increases the owner's movement speed by 60% while crouching."
    ],
    mechanics: [
      "The supplied report identifies crouching as the activation condition.",
      "No additional range, duration, restriction, or interaction values were supplied."
    ],
    patchHistory: [
      "OB27 (2021-03-31): Release date stated in the supplied report."
    ],
    releaseData: "OB27 · 2021-03-31",
    progression: "Lv2: Celebrate · Lv3: Play · Lv4: Sgt. Beanie",
    sources: [{ label: "Garena — Official Pets catalogue", url: "https://ff.garena.com/en/pets" }],
    dataStatus: "User-supplied profile · source verification pending"
  },
  "dreki": {
    skill: "Dragon Glare",
    skillType: "Passive",
    summary: "Reveals opponents recovering behind structures.",
    rows: [
      { label: "Detection effect", value: "Exposes opponents recovering behind structures" },
      { label: "Cooldown", value: "No cooldown" },
      { label: "Release data", value: "OB27 · 2021-04-14" },
      { label: "Progression", value: "Unlockable nomenclature not published" }
    ],
    effects: [
      "Exposes opponents who are recovering behind structures."
    ],
    mechanics: [
      "The supplied report does not provide a verified detection radius or reveal duration.",
      "Unlockable nomenclature was not published in the supplied report; no names or levels have been inferred."
    ],
    patchHistory: [
      "OB27 (2021-04-14): Release date stated in the supplied report."
    ],
    releaseData: "OB27 · 2021-04-14",
    progression: "Unlockable nomenclature not published",
    sources: [{ label: "Garena — Official Pets catalogue", url: "https://ff.garena.com/en/pets" }],
    dataStatus: "User-supplied profile · source verification pending"
  },
  "falco": {
    skill: "Skyline Spree",
    skillType: "Passive",
    summary: "Disables enemy auto-aim during the parachute phase.",
    rows: [
      { label: "Effect", value: "Disables enemy auto-aim during the parachute phase" },
      { label: "Cooldown", value: "No cooldown" },
      { label: "Release data", value: "OB22 · 2020-06-14" },
      { label: "Progression", value: "Lv2: Celebrate · Lv3: Play · Lv4: Evergreen Falco" }
    ],
    effects: [
      "Disables enemy auto-aim against the owner during the parachute phase."
    ],
    mechanics: [
      "The supplied report limits the stated effect to the parachute phase.",
      "No separate range, duration, or post-landing effect was supplied."
    ],
    patchHistory: [
      "OB22 (2020-06-14): Release date stated in the supplied report."
    ],
    releaseData: "OB22 · 2020-06-14",
    progression: "Lv2: Celebrate · Lv3: Play · Lv4: Evergreen Falco",
    sources: [{ label: "Garena — Official Pets catalogue", url: "https://ff.garena.com/en/pets" }],
    dataStatus: "User-supplied profile · source verification pending"
  },
  "fang": {
    skill: "Wolf Pact",
    skillType: "Passive",
    summary: "Grants 30 EP or 15 HP when a teammate is downed.",
    rows: [
      { label: "EP restored", value: "30 EP" },
      { label: "HP restored", value: "15 HP" },
      { label: "Trigger", value: "A teammate is downed" },
      { label: "Cooldown", value: "25 seconds" },
      { label: "Release data", value: "OB36 · 2022-10-18" },
      { label: "Progression", value: "Lv2: Celebrate · Lv3: Play · Lv4: Artic Fang" }
    ],
    effects: [
      "When a teammate is downed, grants the owner 30 EP or 15 HP."
    ],
    mechanics: [
      "The supplied report specifies the alternative recovery values as 30 EP or 15 HP.",
      "The supplied report gives a 25-second cooldown."
    ],
    patchHistory: [
      "OB36 (2022-10-18): Release date stated in the supplied report."
    ],
    releaseData: "OB36 · 2022-10-18",
    progression: "Lv2: Celebrate · Lv3: Play · Lv4: Artic Fang",
    sources: [{ label: "Garena — Official Pets catalogue", url: "https://ff.garena.com/en/pets" }],
    dataStatus: "User-supplied profile · source verification pending"
  },
  "finn": {
    skill: "Survival (Designation)",
    skillType: "Passive",
    summary: "Survival-focused utility; exact numerical skill parameters are unpublished in the supplied data.",
    rows: [
      { label: "Numerical skill values", value: "Not published in the supplied report" },
      { label: "Cooldown parameters", value: "Not published in the supplied report" },
      { label: "Release data", value: "2022 · exact patch/date not supplied" },
      { label: "Progression", value: "Exact unlockables not published" }
    ],
    effects: [
      "The supplied report identifies Finn's utility as survival-focused but does not provide an exact numerical effect."
    ],
    mechanics: [
      "The supplied report says the utility centers on positional survival metrics.",
      "Precise numerical values, cooldown triggers, and percentage buffs were omitted; these remain unpopulated pending game-client data."
    ],
    patchHistory: [
      "No specific patch-history entry was supplied."
    ],
    releaseData: "2022 · exact patch/date not supplied",
    progression: "Exact unlockables not published",
    sources: [],
    dataStatus: "Incomplete user-supplied profile · source verification pending"
  },
  "flash": {
    skill: "Steel Shell",
    skillType: "Passive",
    summary: "Reduces damage received from behind by 25%.",
    rows: [
      { label: "Rear damage reduction", value: "25%" },
      { label: "Cooldown", value: "90 seconds" },
      { label: "Mitigation cap", value: "150 durability points" },
      { label: "Trigger", value: "Damage received from behind" },
      { label: "Release data", value: "OB32 · 2022-01-20" },
      { label: "Progression", value: "Lv3: Play · Lv4: Gamer Flash" }
    ],
    effects: [
      "Reduces damage received from behind by 25%."
    ],
    mechanics: [
      "The supplied report states that rear-damage mitigation is capped at 150 durability points.",
      "The report's stated coverage caveat refers to ballistic firearms and tactical knives when attacks come from behind."
    ],
    patchHistory: [
      "OB32 (2022-01-20): Release data stated in the supplied report."
    ],
    releaseData: "OB32 · 2022-01-20",
    progression: "Lv3: Play · Lv4: Gamer Flash",
    sources: [{ label: "Garena — Official Pets catalogue", url: "https://ff.garena.com/en/pets" }],
    dataStatus: "User-supplied profile · source verification pending"
  },
  "hoot": {
    skill: "Far-sighted",
    skillType: "Passive",
    summary: "Amplifies scanning skill distance and reveal duration.",
    rows: [
      { label: "Scan radius increase", value: "+10m" },
      { label: "Scan feed duration increase", value: "+2.5 seconds" },
      { label: "Cooldown", value: "No cooldown" },
      { label: "Release data", value: "OB35 · 2022-08-10" },
      { label: "Progression", value: "Lv2: Celebrate · Lv3: Play · Lv4: Frosty Hoot" }
    ],
    effects: [
      "Increases scanning skill distance by 10m and scanning feed duration by 2.5 seconds."
    ],
    mechanics: [
      "The supplied report describes interaction with Clu's scanning ability and UAV scans.",
      "The report states that scan information is shared with teammates."
    ],
    patchHistory: [
      "OB35 (2022-08-10): Release data stated in the supplied report."
    ],
    releaseData: "OB35 · 2022-08-10",
    progression: "Lv2: Celebrate · Lv3: Play · Lv4: Frosty Hoot",
    sources: [{ label: "Garena — Official Pets catalogue", url: "https://ff.garena.com/en/pets" }],
    dataStatus: "User-supplied profile · source verification pending"
  },
  "kactus": {
    skill: "Self-Sufficient",
    skillType: "Passive",
    summary: "Restores 10 EP per second while the owner remains stationary.",
    rows: [
      { label: "EP restoration", value: "10 EP per second" },
      { label: "Activation delay", value: "6 seconds motionless" },
      { label: "EP ceiling", value: "100 EP" },
      { label: "Cooldown", value: "No cooldown" },
      { label: "Release data", value: "OB38 · 2023-01-11" },
      { label: "Progression", value: "Lv2: Celebrate · Lv3: Play · Lv4: Ghost Kactus" }
    ],
    effects: [
      "Restores 10 EP per second after the owner has remained motionless for six seconds."
    ],
    mechanics: [
      "The effect stops when the owner moves or jumps.",
      "EP restoration stops when the owner reaches 100 EP."
    ],
    patchHistory: [
      "OB38 (2023-01-11): Release data stated in the supplied report."
    ],
    releaseData: "OB38 · 2023-01-11",
    progression: "Lv2: Celebrate · Lv3: Play · Lv4: Ghost Kactus",
    sources: [{ label: "Garena — Official Pets catalogue", url: "https://ff.garena.com/en/pets" }],
    dataStatus: "User-supplied profile · source verification pending"
  },
  "kitty": {
    skill: "None",
    skillType: "Passive · No Skill",
    summary: "Cosmetic companion.",
    rows: [
      { label: "Primary effect", value: "Cosmetic companion" },
      { label: "Cooldown", value: "Not applicable" },
      { label: "Release data", value: "2019-01-22" },
      { label: "Progression", value: "Garena does not publish exact unlockables" }
    ],
    effects: [
      "Kitty is a cosmetic-only companion with no gameplay ability."
    ],
    mechanics: [
      "The supplied report states that Kitty has no tactical skills, algorithms, or gameplay modifiers.",
      "Gatito is an alias/backend name for this same pet, not a separate profile."
    ],
    patchHistory: [
      "2019-01-22: Release date stated in the supplied report."
    ],
    releaseData: "2019-01-22",
    progression: "Garena does not publish exact unlockables",
    sources: [{ label: "Garena — Official Pets catalogue", url: "https://ff.garena.com/en/pets" }],
    dataStatus: "User-supplied profile · source verification pending"
  },
  "mechanical-pup": {
    skill: "None",
    skillType: "Passive · No Skill",
    summary: "Cosmetic companion.",
    rows: [
      { label: "Primary effect", value: "Cosmetic companion" },
      { label: "Cooldown", value: "Not applicable" },
      { label: "Release data", value: "2019 · Early Release" },
      { label: "Progression", value: "Lv2: Celebrate · Lv3: Play 1 / Play 2 / Scared · Lv4: Lightning Pup" }
    ],
    effects: [
      "Mechanical Pup is a cosmetic-only companion with no combat or utility skill."
    ],
    mechanics: [
      "The supplied report states that Mechanical Pup has no combat scripts or gameplay utility."
    ],
    patchHistory: [
      "2019 · Early Release: release period stated in the supplied report; exact date and patch were not supplied."
    ],
    releaseData: "2019 · Early Release",
    progression: "Lv2: Celebrate · Lv3: Play 1 / Play 2 / Scared · Lv4: Lightning Pup",
    sources: [{ label: "Garena — Official Pets catalogue", url: "https://ff.garena.com/en/pets" }],
    dataStatus: "User-supplied profile · source verification pending"
  },
  "moony": {
    skill: "Paranormal Protection",
    skillType: "Passive",
    summary: "Reduces damage received by 35% during interaction animations.",
    rows: [
      { label: "Damage reduction", value: "35%" },
      { label: "Trigger", value: "During interaction animations" },
      { label: "Cooldown", value: "No cooldown" },
      { label: "Release data", value: "OB27 · 2021-05-25" },
      { label: "Progression", value: "Lv2: Celebrate · Lv3: Play · Lv4: Hipster Moony" }
    ],
    effects: [
      "Reduces damage received by 35% while the owner is performing interaction animations."
    ],
    mechanics: [
      "The supplied report limits the protection to interaction animations.",
      "No separate range or additional duration value was supplied."
    ],
    patchHistory: [
      "OB27 (2021-05-25): Release data stated in the supplied report."
    ],
    releaseData: "OB27 · 2021-05-25",
    progression: "Lv2: Celebrate · Lv3: Play · Lv4: Hipster Moony",
    sources: [{ label: "Garena — Official Pets catalogue", url: "https://ff.garena.com/en/pets" }],
    dataStatus: "User-supplied profile · source verification pending"
  },
  "mr-waggor": {
    skill: "Smooth Gloo",
    skillType: "Passive",
    summary: "Generates a Gloo Wall when the owner's Gloo Wall inventory is below two.",
    rows: [
      { label: "Trigger", value: "Gloo Wall inventory below 2" },
      { label: "Cooldown", value: "100 seconds" },
      { label: "Gloo Maker EXP", value: "200 EXP in the first 200 seconds (as stated in supplied report)" },
      { label: "Release data", value: "OB23 · 2020-07-25" },
      { label: "Progression", value: "Lv2: Celebrate · Lv3: Play · Lv4: Party Waggor" }
    ],
    effects: [
      "Generates a Gloo Wall when the owner's inventory contains fewer than two Gloo Walls."
    ],
    mechanics: [
      "The supplied report describes an autonomous Gloo Wall generation cycle every 100 seconds.",
      "The supplied report also states 200 Gloo Maker EXP in the first 200 seconds; this value is preserved as report-supplied and remains pending verification."
    ],
    patchHistory: [
      "OB23 (2020-07-25): Release data stated in the supplied report."
    ],
    releaseData: "OB23 · 2020-07-25",
    progression: "Lv2: Celebrate · Lv3: Play · Lv4: Party Waggor",
    sources: [{ label: "Garena — Official Pets catalogue", url: "https://ff.garena.com/en/pets" }],
    dataStatus: "User-supplied profile · source verification pending"
  },
  "night-panther": {
    skill: "Weight Training",
    skillType: "Passive",
    summary: "Increases inventory capacity by 45 slots.",
    rows: [
      { label: "Additional inventory capacity", value: "+45 slots" },
      { label: "Cooldown", value: "No cooldown" },
      { label: "Release data", value: "OB15 · 2019-05-24" },
      { label: "Progression", value: "Lv2: Celebrate · Lv3: Play · Lv4: Captain" }
    ],
    effects: [
      "Increases the owner's inventory capacity by 45 slots."
    ],
    mechanics: [
      "The supplied report describes this as an inventory-capacity increase.",
      "No separate activation trigger or duration was supplied."
    ],
    patchHistory: [
      "OB15 (2019-05-24): Release data stated in the supplied report."
    ],
    releaseData: "OB15 · 2019-05-24",
    progression: "Lv2: Celebrate · Lv3: Play · Lv4: Captain",
    sources: [{ label: "Garena — Official Pets catalogue", url: "https://ff.garena.com/en/pets" }],
    dataStatus: "User-supplied profile · source verification pending"
  },
  "ottero": {
    skill: "Double Blubber",
    skillType: "Passive",
    summary: "Converts 65% of HP healed into EP.",
    rows: [
      { label: "HP-to-EP conversion", value: "65% of HP healed" },
      { label: "Cooldown", value: "No cooldown" },
      { label: "Release data", value: "OB21 · 2020-05-13" },
      { label: "Progression", value: "Lv2: Celebrate · Lv3: Play · Lv4: Radioactive Ottero" }
    ],
    effects: [
      "Converts 65% of HP healed into EP."
    ],
    mechanics: [
      "The supplied report describes the effect as an EP conversion tied to HP recovery.",
      "No additional cap or separate activation delay was supplied."
    ],
    patchHistory: [
      "OB21 (2020-05-13): Release data stated in the supplied report."
    ],
    releaseData: "OB21 · 2020-05-13",
    progression: "Lv2: Celebrate · Lv3: Play · Lv4: Radioactive Ottero",
    sources: [{ label: "Garena — Official Pets catalogue", url: "https://ff.garena.com/en/pets" }],
    dataStatus: "User-supplied profile · source verification pending"
  },
  "poring": {
    skill: "Stitch and Patch",
    skillType: "Passive",
    summary: "Repairs armor and prevents high-tier armor destruction.",
    rows: [
      { label: "Effect", value: "Repairs armor durability" },
      { label: "Protection", value: "Prevents high-tier armor destruction" },
      { label: "Cooldown", value: "No cooldown stated in supplied report" },
      { label: "Release data", value: "OB20 · 2020-03-20" },
      { label: "Progression", value: "Unlockable details not supplied" }
    ],
    effects: [
      "Repairs armor and prevents high-tier armor from being destroyed."
    ],
    mechanics: [
      "The supplied report identifies armor repair and high-tier armor preservation as the core effects.",
      "Exact repair amount, interval, and unlockable names were not available in the retrieved report details and have not been inferred."
    ],
    patchHistory: [
      "OB20 (2020-03-20): Release data stated in the supplied report."
    ],
    releaseData: "OB20 · 2020-03-20",
    progression: "Unlockable details not supplied",
    sources: [{ label: "Garena — Official Pets catalogue", url: "https://ff.garena.com/en/pets" }],
    dataStatus: "User-supplied profile · source verification pending"
  },
};
