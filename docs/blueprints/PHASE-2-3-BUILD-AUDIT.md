# Phase 2–3 Build Audit (living status)
Last updated: 2026-11-08
Branch: feature/phase-2-3-planning-training
Blueprint: PHASE-2-3-PLANNING-TRAINING-MASTER.md

## Implemented in branch
- [x] Added Planning and Training navigation routes, reusing workspace auth/team context.
- [x] Added responsive premium dark UI: hero, KPI cards, tabs, cards, forms, empty/loading/error/success feedback, mobile breakpoints.
- [x] Planning CRUD: create/edit plan, date/type/focus/duration/notes, status lifecycle, duplicate-to-next-day and archive.
- [x] Weekly calendar strip with week navigation, day plan counts and date filtering.
- [x] Tactical plan fields: map, drop zone, rotation/fight notes, scrim match count and room/rules notes.
- [x] Plan agenda blocks: add/edit/delete/reorder, duration, instructions; blocks render with planned-vs-agenda minutes.
- [x] Plan review: completed plan can save review notes and move to reviewed.
- [x] Player task assignment: roster member, due date, priority, plan link, instructions.
- [x] Task board: status updates, due/priority/context; assigned player update policy.
- [x] Drill library: custom drill creation/edit, role/category/difficulty/duration/objective/setup/steps/success criteria, archive, searchable filters and expanded protocol preview.
- [x] Ten reusable competitive training templates (communication, entry/trade, backup, flank, rotation, retreat/regroup, end-zone, role execution, post-match review); copy to team library.
- [x] Training sessions: individual/squad/communication/IGL/role session, link plan/drill, date/duration/instructions, lifecycle.
- [x] Session participant selection and attendance (present/absent/excused/pending).
- [x] Training evaluation: player attempt, score /100, optional execution/communication/coordination/decision/consistency rubric, feedback, reflection, repeat attempt history.
- [x] Task completion reflection, coach feedback and review status.
- [x] Data schema/migrations: plans, agenda blocks, tasks, drills, sessions, results; team membership RLS and coach/owner write policies.
- [x] Applied schema and template seed to Supabase project xaixnqvyoswcvvkydrmh.
- [x] Build blueprint saved in GitHub docs/blueprints.
- [x] CI configured for feature branch.

## Verification status
- TypeScript/build: successful GitHub Actions typecheck + production build at commit 80afbcb3; subsequent drill/plan additions require fresh CI.
- Supabase migration apply: success (schema migration + member task update policy + templates seed).
- Data persistence/CRUD through authenticated app: not yet end-to-end manually tested.
- Mobile visual QA: not yet manually inspected on user's Android device.
- Preview deployment: latest auto-preview attempt for an earlier broken commit failed; Vercel deployment API quota reached (24-hour limit), so current commit preview is not available yet.
- Production: not merged/deployed; do not merge until preview/manual QA and final acceptance.

## Remaining Phase 2–3 work
- Weekly plan objective/review aggregation and full template-to-plan weekly recurrence.
- Plan unsaved-change protections, drag/drop reorder (currently up/down controls), and block reorder polish.
- Task blocked-state details and stronger field-level task permissions.
- Drill steps/setup inline editing, drill detail expansion, and templates with source attribution.
- Session participant self-service and attendance notification workflow.
- Detailed weighted rubric per role/category, feedback visibility and evaluation edit history.
- Player self-service task view (only their tasks; current list is team-wide in UI).
- Player profile/dashboard integration and planning/training KPI sync.
- Cross-link plan → session → results → next task/plan; timeline/audit.
- Add robust validation, retry/optimistic UI and confirm destructive actions.
- RLS tests for member, coach, owner, cross-team and archived records.
- Current PR #9 is open against feature/owner-power-toggle (not merged). Preview deploy when quota allows, Android visual QA and final phase checklist.
