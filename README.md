# SQUAD OS

Free Fire squad operations, tournament tracking and player development workspace.

## Current implementation

The production web app is deployed on Vercel and connected to the **FF Squad** Supabase project.

Implemented sections:
- Overview and team workspace
- Weekly tournament ledger (7 days × 6 match slots)
- Team training checklist and shared session notes
- Player roster and role assignment
- Player evaluations with five 0–10 categories, notes and improvement targets
- Individual drill assignments and completion tracking
- Analytics from the shared tournament ledger when signed in
- Supabase email/password authentication with email OTP signup verification

## Data and permissions

- Supabase Auth identifies users; team membership and role checks govern shared records.
- The browser uses only the Supabase URL and publishable key.
- Tournament entries are writable by team owners/coaches; other members can view the shared ledger.
- Training logs, session notes, evaluations and assignments use team-scoped RLS.
- Local roster/match drafts and signed-out practice data remain browser-local.
- Analytics use cloud match rows for signed-in team members and local records otherwise.

## Not yet implemented

- Secure IGN/username-based login (requires a server-side lookup function and protected secret)
- IndexedDB offline-first queue and conflict-safe background sync
- PWA install/offline shell
- Full Supabase Realtime subscriptions; current shared views load on sign-in/date/week changes and can be manually refreshed
- Automated browser-level end-to-end tests

## Stack

- React + TypeScript + Vite
- Supabase Auth + PostgreSQL
- Vercel production deployment

## Local setup

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local`
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`
4. Run `npm run dev`

Never place a Supabase secret/service-role key in a `VITE_*` variable or browser code.

## Commands

- `npm run dev` — local development
- `npm run typecheck` — TypeScript validation
- `npm run build` — production build
- `npm run preview` — preview the production build

## Database migrations

Schema changes are applied to the connected FF Squad Supabase project through reviewed migrations. Keep migrations additive where possible and preserve existing team data.
