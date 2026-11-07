# Architecture overview

## Current application

SQUAD OS is a React + TypeScript + Vite web application deployed on Vercel. Supabase is the shared authentication and PostgreSQL backend.

Implemented areas:
- Team create/join and membership roles
- Weekly tournament match ledger (7 days × 6 slots)
- Shared training checklist and dated session notes
- Player evaluation history and individual drill assignments
- Shared scoreboard and cloud-backed analytics

## Data ownership

- Supabase is the shared source of truth for authenticated team records.
- The browser uses a publishable key; RLS and membership policies authorize access.
- Local browser storage currently holds local roster/match drafts and signed-out progress.
- Tournament writes are restricted to owners/coaches; team members can read shared results.
- Training notes are shared by team and date.

## Planned work

- Dexie/IndexedDB offline storage with a durable mutation queue and conflict handling.
- PWA manifest, installability and offline app shell.
- Supabase Realtime subscriptions for live scoreboard/training updates.
- Secure server-side IGN login resolver.
- Automated role/RLS and browser end-to-end tests.

## Database change practice

Use additive migrations, review policies and function grants, and re-run Supabase security/performance advisors after each database change. Never expose a service-role key in browser code.
