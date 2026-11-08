# Phase 2–3 Build Audit (living status)
Last updated: 2026-11-08
Branch: feature/phase-2-3-planning-training
Blueprint: PHASE-2-3-PLANNING-TRAINING-MASTER.md

## Implemented in branch
- [x] Added Planning and Training navigation routes, reusing workspace auth/team context.
- [x] Added responsive premium dark UI: hero, KPI cards, tabs, cards, forms, empty/loading/error/success feedback, mobile breakpoints.
- [x] Planning CRUD: create/edit plan, date/type/focus/duration/notes, status lifecycle, duplicate-to-next-day and archive.
- [x] Weekly calendar strip with week navigation, day plan counts and date filtering; next-day/next-week plan duplication.\n- [x] Multi-objective plans (line-based objectives), editable objectives, actual-vs-planned duration capture and review.\n- [x] Planning KPIs: active plans, open tasks, library, sessions, completion ratio and average evaluation score.
- [x] Tactical plan fields: map, drop zone, rotation/fight notes, scrim match count and room/rules notes.
- [x] Plan agenda blocks: add/edit/delete/reorder, category, duration, instructions, expected outcome and linked drill; blocks render with metadata and planned-vs-agenda minutes.
- [x] Plan review: completed plan can save review notes and move to reviewed.
- [x] Player task assignment: roster member, due date, priority, category, estimated minutes, success criteria, plan + agenda-block link, instructions.\n- [x] Task blocked workflow requires a blocker/unblock reason; completion requires reflection; coach review feedback and player-specific task filtering.
- [x] Task board: status updates, due/priority/context; assigned player update policy.
- [x] Drill library: custom drill creation/edit, role/category/difficulty/duration/objective/setup/steps/success criteria, archive, searchable filters and expanded protocol preview.
- [x] Eighteen reusable competitive training templates (communication, entry/trade, backup, flank, rotation, retreat/regroup, end-zone, role execution, post-match review); copy to team library.
- [x] Training sessions: individual/squad/communication/IGL/role session, link plan/drill, date/duration/instructions, lifecycle.
- [x] Session participant selection and attendance (present/absent/excused/pending), individual participation notes and incomplete-session rollback on participant insert failure.
- [x] Training evaluation: player attempt, score /100, role-weighted execution/communication/coordination/decision/consistency rubric, feedback, reflection, next action, repeat attempt history.\n- [x] Evaluation next action can generate a linked follow-up player task tied to the originating training session.
- [x] Task completion reflection, coach feedback and review status.
- [x] Data schema/migrations: plans, agenda blocks, tasks, drills, sessions, results; team membership RLS and coach/owner write policies.
- [x] Applied schema and template seed to Supabase project xaixnqvyoswcvvkydrmh.
- [x] Build blueprint saved in GitHub docs/blueprints.
- [x] CI configured for feature branch.

## Verification status
- TypeScript/build: GitHub Actions typecheck + production build passed at commit 4511e121; newer agenda/follow-up additions are awaiting latest CI at commit bf6b568d.
- Supabase migration apply: success (schema migration + member task update policy + templates seed).
- Data persistence/CRUD through authenticated app: not yet end-to-end manually tested.
- Mobile visual QA: not yet manually inspected on user's Android device.
- Preview deployment: latest known READY preview is commit 12f0fcf8 at https://squad-7428j5icb-parnav09.vercel.app; newer feature commits are not deployed. Vercel deployment API quota exceeded (100/day; 24-hour retry), so deployment must resume after quota reset or use available Git-linked automatic preview. This is not current HEAD.
- Production: not merged/deployed; do not merge until preview/manual QA and final acceptance.

## Remaining Phase 2–3 work
- Weekly objective/review roll-up dashboard and one-click bulk week generation (currently duplicate next-week per plan).
- Plan unsaved-change protections and drag/drop reorder (agenda reorder currently explicit up/down controls).
- Stronger field-level task permissions and task status transition validation.
- Drill steps/setup inline editing, drill detail expansion, and templates with source attribution.
- Session participant self-service attendance and notification workflow.
- Detailed weighted rubric per role/category, feedback visibility and evaluation edit history.
- Player self-service task view (only their tasks; current list is team-wide in UI).
- Player profile/dashboard integration and planning/training KPI sync; mobile device visual QA and authenticated CRUD smoke tests.
- Cross-link plan → session → results → next task/plan; timeline/audit.
- Add robust validation, retry/optimistic UI and confirm destructive actions.
- RLS tests for member, coach, owner, cross-team and archived records.
- Current PR #9 is open against feature/owner-power-toggle (not merged). Preview deploy when quota allows, Android visual QA and final phase checklist. Supabase drill seed count verified: 18 templates.
