# Built-in Pet Catalogue Architecture

## Product boundary

The Pets Database is a built-in Squad OS app feature. It is not team data, player data, test-account data, or an Evolution workflow. Every team should see the same catalogue independently of team creation, membership, or evaluation records.

## Canonical app sources

- `src/data/petProfiles.ts` — canonical pet profile content (28 profile records).
- `src/data/petHinglish.ts` — Roman Hinglish localization for profile summaries, effects, mechanics, and row values. This is a language layer, not a second pet catalogue.
- `src/components/PetDatabase.tsx` — catalogue list, search, profile detail, and language selection.
- `src/components/PetDatabase.css` — pet-specific presentation, using the shared character-profile visual foundation where appropriate.
- `docs/PET_OB55_IMPLEMENTATION_TRACKER.md` — implementation history, source-review caveats, and artwork status.

## Storage and runtime rules

- Pet catalogue records ship with the app bundle and work without a Supabase connection.
- There is currently no `public.pet_profiles` table and no team-scoped pet catalogue table. Do not create one as part of team/evaluation data work.
- Do not move pet catalogue records into team, player, Auth, or test-data tables.
- Do not add a second JSON/SQL copy of the catalogue. Edit the canonical TypeScript profile record and its matching localization entry.
- Keep the pet catalogue visible as an app-level section for every team. Team reset or test-account cleanup must not remove or alter these bundled records.

## Data quality

- The implementation contains 28 profile records. Kitty and Gatito remain one canonical entry under `kitty`.
- Profile content originated from the user-supplied OB55 report. The tracker records that source verification remains incomplete for some claims; do not label all profile values as independently official-source verified.
- Artwork remains a separate review item. Do not substitute generated or third-party imagery and call it official Garena artwork.
- Keep unknown values explicitly unavailable/pending; do not infer missing values.

## Verification gates

- Pet profile count and UI index remain aligned at 28 unique IDs.
- Every catalogue ID has a profile record and a localization entry where the translated fields are required.
- Run the existing typecheck/tests/production build after changes.
- Verify mobile and desktop catalogue/detail layouts before a production release.
- No production deployment is authorized by this documentation change.

## Separation from Evolution

The Character and Pet catalogues are permanent app content. They are outside E Phase One migration provenance, identity/timezone, and team/player test-data cleanup. Catalogue changes must be reviewed and merged as their own feature work rather than being mixed into Evolution phase PRs.
