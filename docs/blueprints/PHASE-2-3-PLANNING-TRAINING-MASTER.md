# SQUAD OS — Main Gameplay Blueprint (Phase 2 & 3)
Status: Build specification / living document
Scope: Free Fire Global BR competitive squad workflow. Gameplay-only; security checklist deferred.
Target: Premium mobile-first web app, English UI, Deep Onyx + restrained blue/violet, accessible controls, consistent spacing, clear feedback.
Branch: feature/phase-2-3-planning-training

## Product principles
- Every screen is backed by persisted data; no UI-only placeholders presented as completed.
- Single source of truth for team, roster, player assignments, plans, drills and completion records.
- All writes scoped to active team and authorized membership; respect Supabase RLS.
- Clear loading, empty, error, validation, success, retry and destructive-confirmation states.
- Mobile first (small Android widths), keyboard/accessibility semantics, visible focus, adequate tap targets.
- Keep existing app behavior stable; build additive, modular features and test regression.
- Never claim automatic gameplay/VOD detection. User-entered analysis is explicit.

## Phase 2 — Planning Center (complete scope)
### 2.1 Planning overview
- Plan list/calendar: Today, upcoming, past; status Draft / Scheduled / In progress / Completed / Reviewed.
- Summary cards: today's plan, completion %, assigned players, next session, overdue tasks.
- Filters by date range, plan type, status, player; search and sort.
- Empty state with create-plan CTA; loading skeleton; retryable errors.
### 2.2 Daily practice plan
- Create/edit/duplicate/archive plan; date, title, focus, goals, session duration, notes, author, status.
- Agenda blocks with order, start/duration, category, instructions, expected outcome, linked drill/match/map.
- Reorder agenda, add/remove blocks, prevent negative/invalid durations; total duration calculated.
- Templates: scrim day, communication day, role mechanics day, mixed practice; editable copies.
- Lifecycle: draft → scheduled → in progress → completed → reviewed; controlled transitions and timestamps.
### 2.3 Weekly plan
- Week overview, objectives, daily focus, target practice volume, key weakness priorities.
- Link daily plans; weekly review with wins, recurring issues, next-week priorities.
- Avoid duplicate dates and conflicting active plans; allow deliberate duplicates with confirmation.
### 2.4 Player task assignments
- Assign tasks to one/multiple roster players and role/slot; task title, instructions, priority, due date, estimate, success criteria, linked drill/plan.
- States: assigned, accepted/in-progress, completed, reviewed, blocked; completion note/evidence optional.
- Player view: My Tasks, due/overdue, progress, plan context; owner/coach view: assignments and completion.
- Reassign, edit, cancel with audit metadata; no silently deleting history.
### 2.5 Squad practice & scrim preparation
- Practice type: mechanics, team coordination, communication, rotations, custom room, scrim, tournament prep.
- Session checklist: lobby/settings confirmation, lineup/sub, roles, map/drop, objective, comms protocol, review owner.
- Scrim prep links expected maps, match count, rules/room notes, objectives and assigned focus.
### 2.6 Map strategy assignment
- Select map and playbook; drop zone, loot path, rotation checkpoints, avoid/fight zones, end-zone notes.
- Assign map responsibilities and IGL call reminders; notes are manual and editable.
### 2.7 Tournament prep
- Event name, format/rules reference, schedule, roster/backup, match objectives, prep plan.
- Rules stored as user-provided notes/reference, not assumed current.
### 2.8 Plan review & history
- Completion summary, actual vs planned duration, completed/blocked tasks, lessons, carry-forward actions.
- Immutable created/updated/completed/reviewed timestamps; history retained when plan archived.
### 2.9 Planning UX
- Responsive tab/section navigation, compact cards, sticky primary CTA on mobile where appropriate.
- Consistent forms, field hints, inline validation, unsaved-change warning, cancel/save feedback.
- No modal overload; use sheets/dialogs for focused actions, page forms for complex plans.
- Cross-links: plan ↔ tasks ↔ drills ↔ player profile ↔ scrim/match.

## Phase 3 — Training Center (complete scope)
### 3.1 Drill library
- Categories: individual mechanics, role, entry/trade, backup, flank, positioning, communication, IGL, rotations, endgame, squad coordination.
- Drill schema: name, category, difficulty, duration, objective, setup, steps, success criteria, scoring rubric, role applicability, tags, creator, active/archive.
- Search/filter by category, role, difficulty, duration, tags; create/edit/duplicate/archive custom drills.
- Seeded drills are examples/templates, not falsely labeled official Free Fire drills.
### 3.2 Individual training
- Player-specific drill assignment, attempts, score, notes, completion time, evidence/replay reference.
- Repeat attempts and history; improvement trend; avoid treating completion as mastery.
- Player sees own queue, instructions, timer/duration guidance, criteria and submit result.
### 3.3 Squad training
- Group drill with roster participants, assigned sub-roles, objective, sequence, coach/IGL notes.
- Attendance/participation and team result; individual observations attached separately.
- Team drills: synchronized push, trade/backup, regroup, crossfire, controlled retreat, zone rotation.
### 3.4 Role-based drills
- P1 Primary Rusher: entry timing, first contact, information, controlled aggression, survival.
- P2 Secondary Rusher: trade window, backup distance, synchronized entry, rescue/cover.
- P3 Third Rusher/Flanker: flank timing, pressure, angle discipline, backline info, regroup.
- P4 Sniper + IGL: macro call, information clarity, rotation timing, fight/retreat decision, endgame.
- Substitute/other roles: role chosen per assignment; avoid hard-coded four-player assumption.
### 3.5 Communication training
- Protocol: Information → Confirmation → Decision/Call → Acknowledgement → Execution → Update.
- Drills for concise callouts, enemy count/location/damage, resources, regroup, retreat, zone and endgame.
- Evaluate clarity, timeliness, accuracy, acknowledgement and execution; not voice recording/transcription by default.
### 3.6 IGL training
- Scenario practice: drop choice, early rotation, contested drop, third-party risk, zone shift, fight/retreat, split/regroup, endgame.
- Decision log: situation, information available, call, team acknowledgement, execution, outcome, alternative, review.
- Score decision process and communication separately from outcome (avoid hindsight-only grading).
### 3.7 Training schedule
- Assign to date/session, player/team, duration and coach; recurring schedule optional only if supported.
- Calendar/list, conflict warning, reminders shown in-app (no notification promises without implementation).
- Reschedule/cancel with history; time-zone-safe local display.
### 3.8 Results & evaluation
- Completion, attempts, score, rubric dimensions, coach feedback, player reflection, next action.
- Individual and team scorecards; trend by drill/category/role.
- Completion ≠ improvement; require criteria/attempts to infer progress.
- Feedback visibility and edit permissions defined; prevent score overwrites without history.
### 3.9 Training UX
- Drill detail with objective, setup, steps, success criteria and submit result.
- Start/finish flow, elapsed/estimated time, pause/resume only if functional.
- Player dashboard: assigned, due, completed, feedback, recent trend.
- Coach dashboard: schedule, attendance, completion, evaluation, weak categories.
- Empty/error/loading and network failure behavior.
- Mobile tap targets, no dense tables on small screens, consistent premium visual system.

## Shared data & integration contract
- team_id required on team-owned records; roster/player foreign keys validated.
- Use stable IDs, created_at/updated_at, created_by where relevant; status timestamps.
- Soft archive where historical reports depend on records.
- RLS must enforce team membership and write roles; frontend checks are not authorization.
- Avoid duplicated player names as joins; use player IDs and roster membership.
- Dashboard reads planning/training summaries from persisted records.
- Player profile shows assigned tasks, drills, results and feedback.
- Analytics only derive from actual saved records; no fabricated counts.
- Plan→task→training→result→review→next plan flow is traceable.

## Acceptance gates (do not mark phase complete until all pass)
1. TypeScript (npm run typecheck) and production build (npm run build) pass.
2. CRUD works against real backend for every implemented entity; verify reload persistence.
3. Team isolation and permission behavior checked (including non-owner/member views).
4. Loading/empty/error/success/validation states have usable UI.
5. Mobile layout checked at narrow Android width; no clipped forms/buttons/overflows.
6. Plan, task, drill and result links resolve; dashboard/profile reflects changes.
7. Regression check login, roster, settings, owner power toggle and existing pages.
8. CI and Vercel preview READY; manually inspect preview on device before production merge.
9. Explicitly list remaining limitation; no "complete" claims for untested behavior.

## Implementation order
A. inspect existing schema/UI and reuse working foundations.
B. establish data model/migrations and RLS if missing.
C. shared UI primitives/forms/feedback.
D. Phase 2 planning CRUD + assignments + review.
E. Phase 3 drill library + player/squad sessions + results.
F. connect dashboard/player profiles and cross-links.
G. typecheck/build/CI, fix issues, preview deploy, visual QA.
H. feature audit checklist with built/partial/missing/verified status.
