# SQUAD OS — Blueprint 2 (Build Audit + Remaining Implementation)

Audit date: 2026-11-08
Repository: https://github.com/parnav09/Free-fire-Squad-
Supabase: FF Squad / xaixnqvyoswcvvkydrmh
Vercel project: squad-os

## Status legend
- IMPLEMENTED: source/schema exists; still subject to QA.
- PARTIAL: foundation exists, but the full user-facing workflow or validation is incomplete.
- NOT IMPLEMENTED: not present/verified in current source.
- VERIFY: configuration or real-world behavior must be tested.

## Executive status
The project is a functioning React + TypeScript + Vite team workspace with Supabase Auth/Postgres and Vercel deployments. This is not a blank scaffold. Core team, roster, weekly tournament, training, assignments, evaluation, analytics and account workflows are present. The latest inspected Vercel deployment is ERROR (commit 88cdb438); preceding deployment f075c17c is READY. Do not call latest production source healthy until deployment is repaired and tested.

## Phase 0 — Repository, Architecture, Delivery
Status: IMPLEMENTED / VERIFY
- GitHub main contains React+TS+Vite app, App.tsx, AnalyticsSection, Supabase client, styles, docs, env example.
- npm scripts: dev, typecheck, build, preview.
- Production Vercel project and domains exist.
- Keep AppDeploy excluded; work only through GitHub/Supabase/Vercel.
Acceptance: clean install, typecheck, build, deployment READY, smoke test on mobile.

## Phase 1 — Foundation UI
Status: IMPLEMENTED
- Overview, Tournament, Training, Players, Evaluation, Assignments, Analytics, Settings.
- Profile entry is inside Settings (latest change).
- Responsive dark esports workspace.
Acceptance: each navigation section opens; mobile layout has no clipped controls; empty/loading/error states are clear.

## Phase 2 — Accounts, Team Workspace, Roster
Status: IMPLEMENTED core / PARTIAL QA
- Email/password sign-in; signup email OTP verification and resend.
- IGN/password login through server-side Edge Function (service-role stays server-side).
- Account recovery OTP/email workflow.
- Team create/join, team choice, join approval.
- Team logo/avatar upload and crop.
- Profile, player slot and assigned role.
- Configurable roster capacity P1–P10; membership owner/coach/player.
- Leave team, empty-team cleanup, backup export/restore.
- Team-scoped IGN uniqueness (not global).
Acceptance/remaining:
- Real account OTP and IGN login test.
- Verify recovery OTP expiry, rate limits and error messages.
- Verify owner/coach/player permission matrix.
- Decide if global IGN uniqueness is truly required; current design is team-scoped.

## Phase 3 — Tournament Ledger
Status: IMPLEMENTED core / PARTIAL competitive validation
- Weekly cycle; 7 days × 6 match slots = 42 records.
- Match day/number, placement, kills, points/status.
- Shared cloud records; owner/coach write restrictions.
- Analytics reads shared ledger.
Remaining:
- Confirm exact points formula and configurable scoring profiles.
- Explicit tournament/event presets (FFWS/EWC/Showdown) only after rulebook verification.
- Scrim block/session metadata: first block 6 matches, second block 4 matches, map per match, session date, opponent/custom-room notes.
- Validate empty, incomplete, cancelled and corrected match states.
Acceptance: 42 slots per week are stable, no duplicate writes, edits persist and unauthorized writes are rejected.

## Phase 4 — Training, Drills, Evaluation
Status: IMPLEMENTED core / PARTIAL requested squad system
Already present:
- Training checklist and dated shared session notes.
- Player drill assignments, due date/status/completion note.
- Evaluation history and notes/improvement target fields.
- Five 0–10 evaluation categories (verify exact UI and stored scale).
Required extension:
- Six-hour daily schedule template (360 min).
- Scrim 1: 6 × 20 min / 120 min; six maps logged.
- Scrim 2: 4 × 20 min / 80 min.
- Breaks, communication drills, map planning, quick review, replay review and final evaluation.
- P1 Primary Rusher drill library; P2 Secondary Rusher; P3 Third Rusher/Flanker; P4 Sniper+IGL.
- Each drill: title, instructions, duration, owner/player, repetitions, success criteria, evidence/note, score.
- Daily Improvement Target: one primary measurable target/player, baseline, assigned drill, target metric, result, achieved/partial/not achieved.
- Notes distinction: observations/evidence, good moments, mistakes, context; not duplicate score or target.
- 9-category team evaluation: communication, coordination, IGL decisions, rotation, role execution, map adaptation, consistency, survival/decision discipline, replay improvement (0–10 each; 90 max).
Acceptance: coach assigns; player sees own tasks and records completion; coach evaluates evidence; history retains prior target and score.

## Phase 5 — Players & Role Profiles
Status: IMPLEMENTED core / PARTIAL advanced
- Player list/search, profile, slot, assigned role and membership.
- Roles can be assigned to roster members.
Remaining:
- Canonical role profiles P1/P2/P3/P4 and responsibilities.
- Backup IGL assignment (P1 default, P2 alternate configurable).
- Role-specific evaluation metrics and drill presets.
- Team composition snapshot per scrim (do not silently alter fixed roles/characters).
Acceptance: each member sees current role and responsibilities; historical evaluation uses role at that time.

## Phase 6 — Analytics & Reports
Status: IMPLEMENTED basic / PARTIAL
- Shared ledger analytics.
- Evaluation history and cloud-backed records.
Remaining:
- Player trend charts: weekly score, category, target completion.
- Team communication/coordination trend.
- Scrim 1 vs Scrim 2 comparison.
- Map-wise results and mistakes.
- Sunday Showdown event report, only using actual event rules.
- Export CSV/PDF or printable report (optional).
Acceptance: analytics derives from stored data, handles missing data, and never fabricates totals.

## Phase 7 — Realtime, Offline & PWA
Status: PARTIAL / NOT IMPLEMENTED core offline
- Realtime table publication/configuration exists; app still refreshes shared views on sign-in/date/week/manual refresh.
- Online/offline indicator exists.
Not implemented:
- Supabase Realtime subscriptions with cleanup/reconnect.
- IndexedDB/Dexie local database.
- Durable mutation queue, retry/backoff, idempotency.
- Conflict strategy (server version/timestamp + user resolution for conflicting edits).
- PWA manifest, icons, service worker/offline shell/install prompt.
Acceptance: offline edits survive reload; queued changes sync once; conflict is visible; no silent data loss.

## Phase 8 — Security & Data Governance
Status: IMPLEMENTED baseline / VERIFY
- RLS enabled on all 16 observed public tables.
- Team membership scoping; owner/coach restrictions; assignment self-completion guard.
- IGN lookup server-side.
- Migration history applied; 27 migrations observed.
- Security review docs exist; advisor had no health findings in prior review.
Remaining:
- Enable Supabase leaked-password protection.
- Confirm Email Provider + Confirm Email and OTP template contains {{ .Token }}.
- Production SMTP if default limits are insufficient.
- Run tests as owner, coach, player, unassigned user, signed-out user.
- Review all SECURITY DEFINER function grants/search_path/caller checks; do not blanket revoke functions required by policies.
- Re-run Security and Performance advisors after changes.
Acceptance: cross-team reads/writes denied; no service-role secret in Vite/browser/GitHub; auth recovery and OTP rate-limited.

## Phase 9 — QA & Production Release
Status: PARTIAL
- Vercel READY deployments exist; latest deployment ERROR.
- Supabase project ACTIVE_HEALTHY.
Required:
1. Fix latest deployment error and obtain READY.
2. Run npm install, npm run typecheck, npm run build.
3. Browser smoke test all sections at mobile width.
4. Test signup OTP, email login, IGN login, recovery, team create/join/approval/leave.
5. Test tournament 42-slot save/edit and permissions.
6. Test drills, assignment completion, evaluation, notes and analytics.
7. Test owner/coach/player access matrix.
8. Add automated E2E (Playwright) and regression tests.
9. Check Vercel protection/domain access and confirm public intended URL.
10. Record release commit, deployment ID, QA checklist and known issues.
Release gate: latest deployment READY + all critical auth/data/permission checks pass.

## Phase 10 — Product Polish (future, not assumed built)
Status: NOT IMPLEMENTED / backlog
- Better onboarding and team invite UX.
- Empty/loading/error states across all screens.
- Search/filter/sort for players, assignments, match records.
- Accessibility, keyboard navigation, reduced-motion option.
- Error telemetry and user-visible support diagnostics.
- Data retention/export/delete controls.
- Optional notifications/reminders only after explicit scope.
- Avoid paid dependencies; prioritize free-tier-compatible choices.

## Actual Supabase snapshot (2026-11-08)
Project ACTIVE_HEALTHY, PostgreSQL 17, region ap-southeast-1.
16 public tables observed, all RLS enabled:
profiles, teams, team_members, team_settings, daily_scores, team_ratings, player_nicknames, daily_drills, training_log, tournament_cycles, tournament_matches, player_drill_assignments, training_session_notes, account_recovery_otps, recovery_email_enrollment_otps, team_join_requests.
27 migrations observed through 20261108122752.
Observed counts are point-in-time only: 42 tournament_matches, 1 tournament_cycle, 2 teams/profiles in current API snapshot; do not treat as production data quality proof.

## Vercel snapshot
Project squad-os, Vite, Node 26.x. Domains include squad-os-parnav09.vercel.app and squad-os-two.vercel.app. Latest deployment ERROR at commit 88cdb438; preceding f075c17c READY. Inspect deployment logs before promoting.

## Recommended implementation order (Blueprint 2)
B2-A: Deployment repair + build/typecheck + smoke test.
B2-B: Finish real Auth and permissions QA; Auth dashboard settings.
B2-C: Scrim session model + 6-match/4-match blocks + map tracking.
B2-D: P1–P4 drill templates and 6-hour schedule.
B2-E: Daily targets, notes evidence and 9-category squad evaluation.
B2-F: Player/team analytics and reports.
B2-G: Realtime subscriptions.
B2-H: IndexedDB offline queue + PWA.
B2-I: Automated E2E/security regression and release gate.

## Non-negotiable constraints
- Do not use AppDeploy.
- Do not expose Supabase service-role/secret in frontend or repository.
- Preserve existing FF Squad data; migrations additive and reviewed.
- Mark feature IMPLEMENTED only after source/schema evidence; mark COMPLETE only after test evidence.
- Sunday Showdown rules/scoring/map order must be sourced from its exact rulebook, not guessed.
