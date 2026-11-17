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
    sources: [{ label: "Garena — Official Pets catalogue", url: "https://ff.garena.com/en/pets" }],
    dataStatus: "User-supplied profile · source verification pending"
  },
  "pug": {
    skill: "None",
    skillType: "Passive (No Skill)",
    summary: "Cosmetic companion with no gameplay ability.",
    rows: [
      { label: "Primary effect", value: "Cosmetic companion" },
      { label: "Cooldown", value: "Not applicable" },
      { label: "Release data", value: "Exact release date not published by Garena" },
    ],
    effects: [
      "Pug is a cosmetic-only companion and has no gameplay ability."
    ],
    mechanics: [
      "The supplied report states that Pug has no combat or economic interface."
    ],
    patchHistory: [
      "No patch-history entry was supplied."
    ],
    releaseData: "Exact release date not published by Garena",
    sources: [{ label: "Garena — Official Pets catalogue", url: "https://ff.garena.com/en/pets" }],
    dataStatus: "User-supplied profile · source verification pending"
  },
  "robo": {
    skill: "Wall Enforcement",
    skillType: "Passive",
    summary: "Adds 100 HP to deployed Gloo Walls.",
    rows: [
      { label: "Additional Gloo Wall HP", value: "+100 HP" },
      { label: "Cooldown", value: "No cooldown" },
      { label: "Release data", value: "OB23 · 2020-07-25" },
    ],
    effects: [
      "Adds an additional 100 HP energy shield to deployed Gloo Walls."
    ],
    mechanics: [
      "The supplied report describes an additional 100 HP layer on deployed Gloo Walls."
    ],
    patchHistory: [
      "OB23 (2020-07-25): Release data stated in the supplied report."
    ],
    releaseData: "OB23 · 2020-07-25",
    sources: [{ label: "Garena — Official Pets catalogue", url: "https://ff.garena.com/en/pets" }],
    dataStatus: "User-supplied profile · source verification pending"
  },
  "rockie": {
    skill: "Stay Chill",
    skillType: "Passive",
    summary: "Reduces equipped active-skill cooldown by 15%.",
    rows: [
      { label: "Active-skill cooldown reduction", value: "15%" },
      { label: "Cooldown", value: "No cooldown" },
      { label: "Release data", value: "OB24 · 2020-10-22" },
    ],
    effects: [
      "Reduces the recovery time of the equipped active skill by 15%."
    ],
    mechanics: [
      "The supplied report describes a 15% reduction to the equipped active skill's cooldown."
    ],
    patchHistory: [
      "OB24 (2020-10-22): Release data stated in the supplied report."
    ],
    releaseData: "OB24 · 2020-10-22",
    sources: [{ label: "Garena — Official Pets catalogue", url: "https://ff.garena.com/en/pets" }],
    dataStatus: "User-supplied profile · source verification pending"
  },
  "sensei-tig": {
    skill: "Nimble Ninja",
    skillType: "Passive",
    summary: "Reduces the duration of enemy marking skills.",
    rows: [
      { label: "Effect", value: "Reduces enemy marking-skill duration" },
      { label: "Cooldown", value: "No cooldown" },
      { label: "Release data", value: "OB29 · 2021-08-28" },
      { label: "Maximum reduction", value: "Exact unified OB39 value not supplied" },
    ],
    effects: [
      "Reduces the duration of enemy marking effects."
    ],
    mechanics: [
      "The supplied report identifies Moco/Shirou-style tracking markers as affected.",
      "Historical 30%–40% reductions are mentioned in the report, but the unified OB39 maximum is omitted; no single current percentage has been inferred."
    ],
    patchHistory: [
      "OB29 (2021-08-28): Release data stated in the supplied report.",
      "Historical 30%–40% reduction values are mentioned; exact unified OB39 ceiling was not supplied."
    ],
    releaseData: "OB29 · 2021-08-28",
    sources: [{ label: "Garena — Official Pets catalogue", url: "https://ff.garena.com/en/pets" }],
    dataStatus: "User-supplied profile · source verification pending"
  },
  "shiba": {
    skill: "Mushroom Sense",
    skillType: "Passive",
    summary: "Marks ambient mushrooms on the mini-map.",
    rows: [
      { label: "Scan interval", value: "120 seconds" },
      { label: "Marker duration", value: "30 seconds" },
      { label: "Cooldown", value: "120 seconds" },
      { label: "Release data", value: "OB17 · 2019-08-26" },
    ],
    effects: [
      "Marks ambient mushrooms on the mini-map."
    ],
    mechanics: [
      "The supplied report states that the scan runs every 120 seconds and the marker persists for 30 seconds.",
      "The marker indicates a high-value mushroom."
    ],
    patchHistory: [
      "OB17 (2019-08-26): Release data stated in the supplied report."
    ],
    releaseData: "OB17 · 2019-08-26",
    sources: [{ label: "Garena — Official Pets catalogue", url: "https://ff.garena.com/en/pets" }],
    dataStatus: "User-supplied profile · source verification pending"
  },
  "spirit-fox": {
    skill: "Well Fed",
    skillType: "Passive",
    summary: "Adds 10 HP to Med Kit healing.",
    rows: [
      { label: "Additional HP", value: "+10 HP per Med Kit" },
      { label: "Cooldown", value: "No cooldown" },
      { label: "Release data", value: "OB21 · 2020-04-20" },
    ],
    effects: [
      "Adds a flat 10 HP to Med Kit healing."
    ],
    mechanics: [
      "The supplied report describes a flat +10 HP bonus applied to Med Kit healing."
    ],
    patchHistory: [
      "OB21 (2020-04-20): Release data stated in the supplied report."
    ],
    releaseData: "OB21 · 2020-04-20",
    sources: [{ label: "Garena — Official Pets catalogue", url: "https://ff.garena.com/en/pets" }],
    dataStatus: "User-supplied profile · source verification pending"
  },
  "yeti": {
    skill: "Frost Fortress",
    skillType: "Passive",
    summary: "Reduces incoming explosive damage by 30%.",
    rows: [
      { label: "Explosive damage reduction", value: "30%" },
      { label: "Cooldown", value: "90 seconds" },
      { label: "Trigger", value: "Incoming explosive hit; further trigger details not supplied" },
      { label: "Release data", value: "OB31 · 2022-01-01" },
    ],
    effects: [
      "Reduces incoming explosive damage by 30%."
    ],
    mechanics: [
      "The supplied report states that the reduction applies to incoming explosive damage.",
      "Trigger details beyond an explosive hit were not explicitly supplied."
    ],
    patchHistory: [
      "OB31 (2022-01-01): Release data stated in the supplied report."
    ],
    releaseData: "OB31 · 2022-01-01",
    sources: [{ label: "Garena — Official Pets catalogue", url: "https://ff.garena.com/en/pets" }],
    dataStatus: "User-supplied profile · source verification pending"
  },
  "zasil": {
    skill: "Extra Luck",
    skillType: "Passive",
    summary: "Has a 50% chance to duplicate consumed utility items.",
    rows: [
      { label: "Duplication chance", value: "50%" },
      { label: "Cooldown", value: "70 seconds" },
      { label: "Trigger items", value: "Med Kit · Inhaler · Repair Kit" },
      { label: "Release data", value: "OB33 · 2022-03-23" },
    ],
    effects: [
      "Has a 50% chance to duplicate a consumed utility item."
    ],
    mechanics: [
      "The supplied report lists Med Kit, Inhaler, and Repair Kit as eligible trigger items.",
      "The supplied report does not provide an unlockable name for Lv4."
    ],
    patchHistory: [
      "OB33 (2022-03-23): Release data stated in the supplied report.",
      "No additional patch-history entries were supplied."
    ],
    releaseData: "OB33 · 2022-03-23",
    sources: [{ label: "Garena — Official Pets catalogue", url: "https://ff.garena.com/en/pets" }],
    dataStatus: "User-supplied profile · source verification pending"
  },
};
