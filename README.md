# SQUAD OS

Free Fire squad management and performance platform.

## Project status

**M1 — Foundation scaffold.** This repository is the clean implementation workspace. The previous `ff-squad` repository and the existing Supabase project are separate and have not been modified.

## Product rules captured

- One fixed squad, with weekly roster snapshots.
- Weekly tournament cycle: Monday through Sunday.
- Six scheduled tournament matches per day (42 per full cycle).
- Sunday finalization and next-week registration are separate workflows.
- Scoring rules are configurable and versioned; no unofficial points are hard-coded as official.
- Practice matches are stored separately from tournament matches.
- Player feedback distinguishes private evaluator notes from player-visible feedback.
- Offline-first local persistence and safe cloud synchronization are planned.

## Stack

- React + TypeScript + Vite
- Supabase Auth / PostgreSQL / Realtime (client uses publishable key only)
- Dexie + IndexedDB (to be added with the offline-data phase)
- PWA support (to be added after the application shell is stable)

## Requirements

- Node.js 22.12 or newer
- npm 10 or newer

## Local setup

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local`
3. Add the Supabase project URL and **publishable** key to `.env.local`
4. Start the development server: `npm run dev`

Do not put a Supabase secret/service-role key in any `VITE_*` variable or browser code.

## Commands

- `npm run dev` — local development
- `npm run typecheck` — TypeScript validation
- `npm run build` — production build
- `npm run preview` — preview the production build

## Safety boundary for database work

The existing Supabase project is currently treated as **read-only**. No migrations, SQL writes, policy changes, function changes, data edits, or destructive operations are part of this scaffold. A target schema and migration plan must be reviewed before any database mutation.

See `docs/architecture/` and `docs/security/` for the current decisions and legacy audit notes.
