# Phase 2–3 Build Audit (living status)
Last updated: 2026-11-08
Branch: feature/phase-2-3-planning-training
Blueprint: PHASE-2-3-PLANNING-TRAINING-MASTER.md

## Implemented in branch
- [x] Added Planning and Training navigation routes, reusing workspace auth/team context.
- [x] Added responsive premium dark UI: hero, KPI cards, tabs, cards, forms, empty/loading/error/success feedback, mobile breakpoints.
- [x] Planning CRUD: create plan, date/type/focus/duration/notes, status lifecycle.
- [x] Plan agenda blocks: add ordered block, duration, instructions; blocks render in plan.
- [x] Plan review: completed plan can save review notes and move to reviewed.
- [x] Player task assignment: roster member, due date, priority, plan link, instructions.
- [x] Task board: status updates, due/priority/context; assigned player update policy.
- [x] Drill library: custom drill creation, role/category/difficulty/duration/objective/setup/steps/success criteria, archive.
- [x] Ten reusable competitive training templates (communication, entry/trade, backup, flank, rotation, retreat/regroup, end-zone, role execution, post-match review); copy to team library.
- [x] Training sessions: individual/squad/communication/IGL/role session, link plan/drill, date/duration/instructions, lifecycle.
- [x] Training evaluation: player attempt, score /100, feedback, reflection, repeat attempt history.
- [x] Data schema/migrations: plans, agenda blocks, tasks, drills, sessions, results; team membership RLS and coach/owner write policies.
- [x] Applied schema and template seed to Supabase project xaixnqvyoswcvvkydrmh.
- [x] Build blueprint saved in GitHub docs/blueprints.
- [x] CI configured for feature branch.

## Verification status
- TypeScript/build: CI has a known successful run at commit 90868c04 before subsequent agenda/evaluation/template edits; rerun required against current HEAD.
- Supabase migration apply: success (schema migration + member task update policy + templates seed).
- Data persistence/CRUD through authenticated app: not yet end-to-end manually tested.
- Mobile visual QA: not yet manually inspected on user's Android device.
- Preview deployment: not created; Vercel deployment API quota currently exhausted for 24 hours.
- Production: not merged/deployed; do not merge until preview/manual QA and final acceptance.

## Remaining Phase 2–3 work
- Weekly plan objective/review and agenda duration aggregation.
- Plan duplicate/archive and unsaved-change protections.
- Task completion note/review feedback, blocked state details, coach review.
- Drill search/filter, drill detail and rubric editing, templates with source attribution.
- Session participant roster/attendance and squad vs individual assignment handling.
- Detailed weighted rubric per role/category, feedback visibility and evaluation edit history.
- Player self-service task view (only their tasks; current list is team-wide in UI).
- Player profile/dashboard integration and planning/training KPI sync.
- Cross-link plan → session → results → next task/plan; timeline/audit.
- Add robust validation, retry/optimistic UI and confirm destructive actions.
- RLS tests for member, coach, owner, cross-team and archived records.
- Current branch CI, preview deploy when quota allows, Android visual QA and final phase checklist.
