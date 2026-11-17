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
  }
};
