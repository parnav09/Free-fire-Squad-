# RESET-01 — Clean Restart: Protected Scope and Reset Plan

Status: preparation in progress. No production database rows, tables, functions, storage objects, Auth users, or protected source files have been deleted by this document.

## Objective

Keep the current Squad OS interface and all product blueprints intact. Pause legacy workflows outside Characters and Pets, mark the paused workspaces as **Coming Soon**, and rebuild the non-catalogue backend from a clean foundation.

## Protected repository scope — do not edit, move, overwrite, or delete

### Character catalogue
- `src/components/CharactersDatabase.tsx`
- `src/components/CharactersDatabase.css`
- `src/data/characterProfiles.json`
- `src/data/characterProfilesExtra.json`
- Character artwork URLs and profile payloads embedded in those files
- `scripts/verify-character-profile.mjs`

### Pet catalogue
- `src/components/PetDatabase.tsx`
- `src/components/PetDatabase.css`
- `src/data/petProfiles.ts`
- `src/data/petHinglish.ts`
- Pet artwork references and profile payloads embedded in those files

### Protected database data
- `public.character_profiles` and all 67 current rows.
- The character-profile table creation and seed migrations:
  - `20261114100112_create_character_profiles_table.sql`
  - `20261116102000_sync_all_67_character_profiles.sql`

Pet profiles are currently source-controlled in the repository; the live database inventory did not show a separate public pets table.

### Blueprints, roadmaps, evolution history
- Preserve the entire `docs/**` tree, including all blueprint, phase, evolution, architecture, security, backup, and recovered-migration documents.
- Preserve `.github/workflows/evolution-phase-one.yml` and all `scripts/verify-evolution*` verification assets.
- Preserve the complete Git commit history and existing branches. Do not delete the repository, commits, PRs, or documentation history.

## UI preservation rules

- Keep the current shell, navigation, layout, spacing, colors, typography, and existing section markup.
- Keep Characters and Pets reachable and fully functional.
- For other workspaces, block legacy actions and show a small **COMING SOON** status marker. Their visual layout remains present while their old workflows are paused.
- Do not replace the existing UI with a new placeholder screen.
- Do not modify the protected Character or Pet components while pausing other app workflows.

## Read-only baseline observed on 2026-11-21

Supabase project: `FF Squad` (`xaixnqvyoswcvvkydrmh`), status `ACTIVE_HEALTHY`.

- Auth users: 16 (user confirmed these are disposable testing accounts).
- `public.character_profiles`: 67 rows (protected).
- Other public app tables observed: teams, profiles, team_members, team_settings, retention settings, tournament cycles/matches, training drills/logs/sessions/results, daily evaluations/feedback, scrim records/reviews, assignments/tasks, recovery/join request tables, and character loadouts.
- `team-avatars` storage bucket: 1 object.
- Legacy Edge Functions: `login-with-ign`, `account-recovery`.
- Public schema has legacy RPCs, triggers, and policies associated with the old app workflows.

## Planned reset scope — only after integrity checks

1. Delete all 16 disposable Auth testing users and their dependent account/team records.
2. Remove non-protected public app tables and their associated policies/triggers/functions, while preserving `public.character_profiles`.
3. Remove the old `team-avatars` object/bucket if no protected catalogue asset depends on it.
4. Retire the legacy login and account-recovery Edge Functions.
5. Archive historical backend migrations before removing old active migration files from the implementation path; keep their history in Git and the evolution/recovered-migration documentation.
6. Keep Supabase project settings and publishable client configuration required for the protected Character catalogue. Do not expose or rotate secret/service-role keys.
7. Do not delete Supabase system schemas, extensions, platform tables, or project infrastructure.

## Required post-reset verification

- Character profile count remains exactly 67 and a checksum/content comparison matches the pre-reset snapshot.
- Character and Pet source files retain their original blob hashes.
- Every protected blueprint/evolution document remains present.
- Characters can still load their profiles; Pets still load from source-controlled data.
- All non-protected workspaces show Coming Soon and do not issue legacy writes.
- Auth user count is zero; no non-protected legacy app records remain.
- New backend work starts only in a new, separately versioned implementation phase.

## Current implementation branch

`reset/01-clean-restart-preserve-blueprints`, based on `feat/drg-03-safe-restore-data-recovery` so the evolution documents and the DRG-03 audit/spec are retained. This branch contains the initial Coming Soon gate; production has not been changed.


## Deployment gate

A preview deployment was requested for the reset branch but Vercel rejected it with the account's `api-deployments-free-per-day` limit (retry window: 24 hours). The Git commit status also reports the Vercel check as failed with `build-rate-limit`. Therefore the reset branch has not passed a build, and no destructive production database/Auth/storage/Edge Function changes will run until a build can be verified and the Coming Soon UI can be safely released.
