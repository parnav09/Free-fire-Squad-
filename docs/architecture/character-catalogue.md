# Character Catalogue Architecture

## Canonical source
- `src/data/characterProfiles.json` is the single version-controlled source of all 67 profiles (10 base + 57 additional).
- Each record keeps its stable `id`, name, existing artwork URL/mode, ability text, current values, history, source links and review notes.
- The migration from split TypeScript/JSON inputs is structural only: profile values and image references are copied as-is. No artwork regeneration or visual redesign is part of this change.

## Runtime flow
1. The app imports the complete JSON catalogue and renders it immediately (offline-safe baseline).
2. It may refresh records from `public.character_profiles` in Supabase.
3. Remote rows are accepted only when identity matches the canonical local ID/name and required fields are valid; otherwise local data wins.
4. Network/database failure leaves the local catalogue intact.

## Future character/skill updates
- Add a character: add one record with a stable slug ID to the canonical JSON; add its row to Supabase through an idempotent migration/upsert; add official source citations; run catalogue validation and build.
- Ability/patch change: edit only affected ability fields, append a dated patch-history entry, update official source references and reconciliation/review notes. Preserve artwork fields unless artwork itself changed officially or the user explicitly requests a redesign.
- Supabase is the synchronized runtime mirror, not an undocumented hand-edited source of truth. Keep canonical changes in Git first, then synchronize to Supabase.
- Avoid overwriting unknown DB metadata: sync uses JSONB merge semantics. Review any legacy-only fields before removing them.
- Do not treat a patch note as a current value without reconciling current official character data; mark uncertain values for review instead of guessing.

## Release gates
- Exactly 67 unique IDs until an intentional new-character PR changes the count.
- Every profile must have identity, image, artwork mode, skill/type, non-empty ability rows and source references.
- Automated character tests, TypeScript, production build and CI must pass.
- Review artwork diff and compare screenshots at mobile/desktop before production promotion.
- Supabase row count/unique IDs and required fields must match the canonical catalogue.
- Production deploy must point to the merged commit and be verified READY; GitHub CI success alone is not a production deployment.
