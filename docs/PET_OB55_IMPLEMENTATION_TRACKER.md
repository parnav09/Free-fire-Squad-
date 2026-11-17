# OB55 Pet Database Implementation Tracker

## Source report
The user's comprehensive "Free Fire Pet Ecosystem up to OB55" report supplied in the conversation on 2026-11-17 is the source dataset for this staged implementation. Preserve supplied gameplay values; translation may explain wording in Roman Hinglish without changing mechanics. Do not infer or fill missing values. The report's claims still require source validation before any profile is labelled official-source verified. Keep uncertain or unsupported values explicitly marked as user-supplied / pending verification.

## Scope and counting
- 28 profiles are present in the supplied report (not 27).
- Furry Spark is excluded as non-canonical per the supplied report.
- Kitty and Gatito are one profile; Gatito is an alias/backend name, not a separate pet.
- Artwork is ON HOLD for all pets. Pet profiles and text data are NOT on hold.
- Do not add generated or third-party artwork as official Garena art. Artwork can be integrated later when the official asset is verified.
- No final production deployment until all 28 profiles have been implemented and the user explicitly requests the final production release.
- Do not create a review-ready/final-review state during batch implementation.

## Batch order
Use the exact order in the supplied report. On each user instruction "Next", implement the next five entries only. After each batch, update this tracker and report completed vs remaining. The final batch contains the remaining three.

| Batch | Pet profiles | Status |
|---|---|---|
| 1 | Agent Hop; Agumon; Arvon; Beaston; Detective Panda | Implemented · Vercel preview build READY · main merge deferred |
| 2 | Dr. Beanie; Dreki; Falco; Fang; Finn | Implemented · preview validation pending · main merge deferred |
| 3 | Flash; Hoot; Kactus; Kitty (alias: Gatito); Mechanical Pup | Implemented · preview validation pending · main merge deferred |
| 4 | Moony; Mr. Waggor; Night Panther; Ottero; Poring | Implemented · preview validation pending · main merge deferred |
| 5 | Pug; Robo; Rockie; Sensei Tig; Shiba | Implemented · preview READY confirmed · main merge deferred |
| 6 | Spirit Fox; Yeti; Zasil | Implemented · preview READY confirmed · main merge deferred |

## Profile structure
Match the existing Character Database profile layout and section order:
1. Identity / profile header
2. Ability / Factor | Current value table
3. Ability Effects
4. Additional Mechanics & Notes
5. Patch History
6. Official Sources

Use the existing Pet Database search -> alphabetical cards -> individual detail flow and existing Character Database styling. Do not redesign unrelated UI.

## Data rules
- Preserve the report's supplied skill names, skill types, values, cooldowns, release data, progression, effects, and notes.
- If the report itself says Garena does not publish a value, preserve that as an explicit unavailable/not published value; do not invent a number.
- Keep the full supplied narrative for each profile as the English source text for Ability Effects / Additional Mechanics & Notes, splitting it logically without changing its meaning.
- Pet progression / level-up / cosmetic unlock progression rows are intentionally excluded from every profile. Do not re-add them.
- Cosmetic-only pets must remain explicitly skill-less: Agumon, Kitty/Gatito, Mechanical Pup, and Pug.
- Do not invent pet details, progression, patch history, or source URLs. Use only supplied URLs when present and validate official sources separately before marking as verified.
- Do not use the sample SQL in the report as executable migration without adapting it to the actual repository/Supabase schema and checking for destructive or duplicate effects.

## Current progress
- Tracker created before profile batch implementation.
- Completed: 28 / 28 (Batches 1–6 implemented; progression rows removed and Roman Hinglish toggle wired; final review and preview validation pending)
- Batch 2 note: Finn has intentionally incomplete values, release patch/date, progression, patch history, and source URLs because these were not supplied; no values have been inferred.
- Kitty and Gatito remain a single profile under the `kitty` key; no duplicate pet record is created.
- Mechanical Pup release remains `2019 · Early Release` because no exact date or OB patch was supplied.
- Batch 3 preview: Vercel deployment reached READY; build verification completed.
- Batch 4 preview: Vercel deployment reached READY; build verification completed.
- Batch 5 preview: Vercel build was still in progress at last check; final READY state not yet confirmed.
- Batch 6 preview: latest tracker commit deployment reached READY; Batch 6 profile data is included in the preview branch.
- Batch 6: Spirit Fox +10 HP per Med Kit (OB21, 2020-04-20); Yeti 30% explosive damage reduction with 90s cooldown (OB31, 2022-01-01); Zasil 50% chance to duplicate Med Kit/Inhaler/Repair Kit with 70s cooldown (OB33, 2022-03-23).
- Zasil Lv4 unlockable name and additional patch-history entries were not supplied; no values inferred.
- Poring's exact repair amount/interval and unlockable names were not present in retrieved report details and remain explicitly unspecified.
- Pug's exact release date and patch history were not supplied; no date was inferred.
- Sensei Tig's exact unified OB39 maximum reduction and progression/unlockables were not supplied; historical 30%–40% values remain qualified, not presented as current verified values.
- Batch 5: Shiba scan interval/cooldown 120s; marker duration 30s. Robo +100 Gloo Wall HP; Rockie -15% active-skill cooldown.
- All 28 pet profile entries have been implemented across six batches; final data/source review is still required.
- Artwork: on hold for all 28
- Production release: not started / explicitly deferred

## Mobile layout, progression removal, and language follow-up
- Applied one shared responsive two-column layout to all pet profile Ability / Factor | Current value rows; labels remain on the left and values on the right, with wrapping and overflow protection at narrow phone widths.
- Wired the EN / HI+EN control on both the Pet catalogue and pet detail pages; it now switches the active state and the available catalogue/navigation UI labels.
- The earlier translation hold was superseded by the user's latest instruction: Roman Hinglish is now implemented for all 28 pet summaries, table labels/known values, Ability Effects, Additional Mechanics & Notes, and patch-history statements. Ability names and official game terms remain unchanged where appropriate.
- All 28 pets have their Progression rows and progression fields removed. Release/patch dates remain; only level-up and cosmetic unlock progression was removed.
- HI+EN toggle now switches actual Roman Hinglish profile content, not only navigation labels. No Devanagari is used.
- This is a shared component/CSS fix, so it covers all 28 profiles rather than requiring 28 separate layout edits.
- Build and device-level visual regression checks for this follow-up are pending the new Vercel preview.

## Latest pet progression and translation update
- Removed the Progression row and progression field from all 28 pet profiles. Release data and patch history are retained.
- Added Roman Hinglish translation content for all 28 profiles in `src/data/petHinglish.ts`, including summaries, effects, mechanics, row labels and known row values; patch-history notes use Hinglish wording while patch IDs/dates remain intact.
- Wired Pet Database cards and profile detail sections to the HI+EN translation data. English ability names, game-specific names, numeric values, and patch identifiers are preserved where they are canonical.
- Translation style: Roman script only, natural gaming Hinglish; difficult terms are explained in simple words (example: knockback -> peeche dhakelna), without changing the supplied mechanics.
- Character translation audit covered all 67 character records. Oscar's HI+EN copy was corrected: Knockback is now explained as "peeche dhakel deta hai"; Gloo Wall detonation is phrased as "todta hai". Garena's official skill text specifies target-direction dash, first three Gloo Walls, 25 damage and knockback, but does not state an exact knockback angle/force; no angle was invented.
- Remaining character profiles with notable hard technical terms in their HI+EN copy are listed in the user-facing audit response; they have not all been rewritten in this pass.
- Latest preview build and mobile visual check pending.
