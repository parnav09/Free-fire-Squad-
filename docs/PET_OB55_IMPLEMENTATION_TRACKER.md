# OB55 Pet Database Implementation Tracker

## Source report
The user's comprehensive "Free Fire Pet Ecosystem up to OB55" report supplied in the conversation on 2026-11-17 is the source dataset for this staged implementation. Preserve the supplied profile wording and values during data entry; do not silently rewrite, infer, or fill missing values. The report's claims still require source validation before any profile is labelled official-source verified. Keep uncertain or unsupported values explicitly marked as user-supplied / pending verification.

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
| 2 | Dr. Beanie; Dreki; Falco; Fang; Finn | Pending |
| 3 | Flash; Hoot; Kactus; Kitty (alias: Gatito); Mechanical Pup | Pending |
| 4 | Moony; Mr. Waggor; Night Panther; Ottero; Poring | Pending |
| 5 | Pug; Robo; Rockie; Sensei Tig; Shiba | Pending |
| 6 | Spirit Fox; Yeti; Zasil | Pending |

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
- Keep the full supplied narrative for each profile as the source text for Ability Effects / Additional Mechanics & Notes, splitting it logically without changing its meaning.
- Cosmetic-only pets must remain explicitly skill-less: Agumon, Kitty/Gatito, Mechanical Pup, and Pug.
- Do not invent pet details, progression, patch history, or source URLs. Use only supplied URLs when present and validate official sources separately before marking as verified.
- Do not use the sample SQL in the report as executable migration without adapting it to the actual repository/Supabase schema and checking for destructive or duplicate effects.

## Current progress
- Tracker created before profile batch implementation.
- Completed: 5 / 28 (Batch 1 implemented; preview build READY)
- Artwork: on hold for all 28
- Production release: not started / explicitly deferred
