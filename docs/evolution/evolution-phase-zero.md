# Evolution Phase Zero — Legacy Fixes

**Review date:** 18 November 2026  
**Repository:** `parnav09/Free-fire-Squad-`  
**Blueprint:** `docs/evolution-version-2.md` on this PR branch (master roadmap included with all 13 renamed Evolution phases)  
**Code baseline:** `main` at the current audited source snapshot  
**Live data snapshot:** FF Squad Supabase project, read-only inspection  
**Baseline audit:** **COMPLETE — Evolution scope only**  
**Legacy-fix status:** **IMPLEMENTED ON PR BRANCH · CI VERIFIED · NOT MERGED**  
**Implementation boundary:** this phase repairs existing Evolution regressions and marks incomplete modules for their future phases. It does not build the planned Version 2 feature set.

## 1. Scope

This document is the Evolution Phase Zero — Legacy Fixes ledger. The baseline inventory is complete; current work repairs existing defects only and keeps future feature work in its assigned phase:

- Evolution routes, components, hooks, and their callers;
- existing evaluation, feedback, task, planning, training, session, trend, and analytics data paths;
- live Evolution-related table/column inventory and foreign-key relationships;
- current rubric/task models and legacy incompatibilities;
- aggregate live row counts;
- read-only duplicate and relationship-integrity checks;
- code paths that must be preserved during later phases;
- build/CI evidence and remaining non-feature verification limits.

**Separate workstream:** Security implementation and security remediation are intentionally excluded. Do not mix RLS, grants, SECURITY DEFINER, Auth controls, or security-advisor remediation into Evolution feature work. The separate security review remains at `docs/security/rls-review.md`.

No production records, schemas, policies, grants, or settings were changed during this Evolution audit. All Supabase queries in this review were read-only metadata, aggregate-count, or integrity checks.

## 2. Existing application architecture

| Area | Current implementation path | Current source of truth |
|---|---|---|
| Daily Evaluation | `src/App.tsx` — Evaluation section and `saveEvaluation` | `daily_scores` |
| Private evaluation feedback | `src/App.tsx` — feedback load/save alongside evaluation history | `daily_score_feedback` |
| Legacy drill assignments | `src/App.tsx` — `loadAssignments`, `createAssignment`, `updateAssignment` | `player_drill_assignments` |
| Planning and training | `src/components/PlanningTrainingCenter.tsx` | `practice_plans`, `practice_plan_blocks`, `practice_tasks`, `training_drills`, `training_sessions`, `training_session_participants`, `training_results` |
| Weekly Review and Player Trends | `src/components/PlayerWeeklyInsights.tsx`, rendered by `src/App.tsx` for both sections | In-memory combination of evaluation history and legacy drill assignments |
| Squad Analytics | `src/components/AnalyticsSection.tsx` | Selected competitive match history passed by `src/App.tsx` |
| Competitive match ledger | Tournament module in `src/App.tsx` | `tournament_matches` and related tournament-cycle records |
| Scrim review | Scrim module and its review records | `scrim_records` / `scrim_team_reviews` |

The app currently has multiple connected-looking screens, but they do not yet form the single canonical Evolution development loop described in the blueprint.

## 3. Live Evolution data inventory

The following is the live public-schema inventory observed on 18 November 2026. This section documents Evolution data structures only; it is not a permissions or security review.

| Table | Relevant fields / purpose |
|---|---|
| `daily_scores` | UUID id, team_id, score_date, player_id, nullable evaluator_id, five nullable integer dimensions, nullable total, notes/improvement_target, review_visibility |
| `daily_score_feedback` | score_id, team_id, player_id, improvement_target, improvement_notes, mistake_notes, context_notes |
| `player_drill_assignments` | player_id, assigned_by, drill_title/description, due_date, status, completion_note, completed_at |
| `practice_plans` | team_id, title, plan_date/type, focus, objectives, planned/actual minutes, notes/review_notes, status, map/drop/rotation fields |
| `practice_plan_blocks` | plan_id, team_id, title, category, instructions, expected_outcome, duration, sort_order, linked_drill_id |
| `practice_tasks` | team_id, plan_id, block_id, player_member_id, source_session_id, title, instructions, status, due_date/due_at, priority, completion/review fields |
| `practice_task_events` | task_id, team_id, task lifecycle event history |
| `training_drills` | team_id/template flag, title, category, difficulty, role_tags, duration, objective, setup, steps, success_criteria, scoring_rubric |
| `training_sessions` | team_id, plan_id, drill_id, title/type, scheduled_at, duration, status, instructions |
| `training_session_participants` | session_id, team_id, player_member_id, attendance, participation_notes |
| `training_results` | session_id, team_id, player_member_id, attempt_number, score, JSON rubric, completion, reflection, coach_feedback, next_action |
| `training_session_notes` | team_id, note_date, notes |
| `team_ratings` | nine legacy team-level dimensions, total, notes, next_focus |
| `scrim_team_reviews` | scrim_id, team_id and review record |
| `tournament_matches` | cycle_id, team_id, match day/number, placement, kills, points, verification and version fields |

### 3.1 Relationship map

- `daily_scores` → `daily_score_feedback` through `score_id`.
- `practice_plans` → `practice_plan_blocks` → `practice_tasks`.
- `training_sessions` can reference a plan and a drill.
- `training_sessions` → `training_session_participants` and `training_results`.
- `practice_tasks` can reference a plan, block, and source training session; `practice_task_events` references the task.
- `player_drill_assignments` is a separate assignment path; it is not represented as a child or synchronized projection of `practice_tasks`.
- `tournament_matches` belongs to a tournament cycle and team. No direct session/evaluation/evidence relationship was found in the inspected Evolution paths.
- `scrim_team_reviews` belongs to a scrim record and team. It is not yet part of the canonical player-evaluation chain.

No live table with a peer-evaluation inbox, peer cohort, evidence-item, canonical evaluation-dimension, weekly-review snapshot, or canonical development-task name was found in the inspected table-name inventory. Treat those Version 2 capabilities as **not yet verified/implemented**, not as completed features.

### 3.2 Column-level dictionary

The following column inventory was read from `information_schema.columns`. It is included so later phases can map existing fields before proposing new ones.

- `teams`: id, team_name, team_description, owner_id, timezone, invite_code, created_at, updated_at, avatar_url, deletion_scheduled_at, deletion_reason
- `team_members`: id, team_id, user_id, player_number, assigned_role, membership_role, status, joined_at, display_name, character_loadout
- `daily_scores`: id, team_id, score_date, player_id, evaluator_id, communication, coordination, decision_making, role_execution, map_awareness, total, notes, improvement_target, created_at, updated_at, review_visibility
- `daily_score_feedback`: id, score_id, team_id, player_id, improvement_target, improvement_notes, mistake_notes, context_notes, created_at
- `player_drill_assignments`: id, team_id, player_id, assigned_by, drill_title, drill_description, due_date, status, completion_note, completed_at, created_at
- `practice_plans`: id, team_id, title, plan_date, plan_type, focus, objectives, notes, status, planned_minutes, actual_minutes, review_notes, created_by, created_at, updated_at, completed_at, reviewed_at, map_name, drop_zone, rotation_notes, scrim_matches, rules_notes
- `practice_plan_blocks`: id, team_id, plan_id, title, category, instructions, expected_outcome, duration_minutes, sort_order, linked_drill_id, created_at
- `practice_tasks`: id, team_id, plan_id, block_id, player_member_id, title, instructions, priority, status, due_date, estimated_minutes, success_criteria, completion_note, review_feedback, assigned_by, created_at, updated_at, completed_at, reviewed_at, blocked_reason, task_category, source_session_id, due_at, completion_submitted_by, completion_acknowledged_at
- `practice_task_events`: id, task_id, team_id, actor_id, event_type, from_status, to_status, note, created_at
- `training_drills`: id, team_id, is_template, title, category, difficulty, role_tags, duration_minutes, objective, setup, steps, success_criteria, scoring_rubric, tags, archived, created_by, created_at, updated_at
- `training_sessions`: id, team_id, plan_id, drill_id, title, session_type, scheduled_at, duration_minutes, status, instructions, coach_notes, created_by, created_at, updated_at, completed_at
- `training_session_participants`: id, team_id, session_id, player_member_id, attendance, participation_notes, created_at
- `training_results`: id, team_id, session_id, player_member_id, attempt_number, score, rubric, completed, player_reflection, coach_feedback, next_action, replay_reference, submitted_by, created_at
- `training_session_notes`: id, team_id, note_date, notes, updated_by, updated_at
- `team_ratings`: id, team_id, week_start, evaluator_id, communication_quality, team_coordination, igl_decision_making, rotation_management, role_consistency, map_adaptation, match_consistency, survival_decisions, replay_improvement, total, notes_worked, notes_wrong, next_focus, created_at, updated_at
- `scrim_records`: id, team_id, owner_id, scrim_date, match_count, matches, overall_rank, total_teams, personal_review, created_at, updated_at
- `scrim_team_reviews`: id, scrim_id, team_id, author_id, category, match_number, title, detail, solution, created_at
- `tournament_cycles`: id, team_id, cycle_start, cycle_end, title, registration_open_at, registration_close_at, status, roster_snapshot, created_by, created_at, updated_at
- `tournament_matches`: id, cycle_id, team_id, match_day, match_number, map_name, drop_location, placement, kills, points, status, notes, recorded_by, verified_by, verified_at, version, created_at, updated_at

## 4. Live aggregate data snapshot

Exact read-only row counts returned on 18 November 2026:

| Table | Rows |
|---|---:|
| `daily_scores` | 2 |
| `daily_score_feedback` | 2 |
| `player_drill_assignments` | 2 |
| `practice_plans` | 0 |
| `practice_plan_blocks` | 0 |
| `practice_tasks` | 0 |
| `practice_task_events` | 0 |
| `training_drills` | 102 |
| `training_sessions` | 1 |
| `training_session_participants` | 1 |
| `training_results` | 0 |
| `training_session_notes` | 0 |
| `scrim_team_reviews` | 0 |
| `team_ratings` | 0 |
| `tournament_matches` | 630 |

These counts show that the competitive match ledger and drill library have records, while the newer plan/task/result/review path has little or no live usage in this snapshot. Counts are a point-in-time baseline, not a product-quality score.

## 5. Verified Evolution findings

### EV2-AUD-001 — Two task systems are active (future unification)

- Weekly Review batch generation in `src/App.tsx` previously wrote to `player_drill_assignments`; Phase Zero has now paused this generic creation path.
- The Planning/Training center creates and updates `practice_tasks`.
- The two paths have different identifiers, fields, lifecycle states, and completion data.
- No synchronization adapter or canonical cross-reference was found.
- The Weekly Review batch currently creates a fixed generic task rather than a task derived from an approved player-specific evidence/review item.

**Impact:** task counts, completion, follow-up, and player development can disagree depending on which screen is read.  
**Phase Zero fix:** both generic Weekly Review batch creation and new manual writes to `player_drill_assignments` are paused. Existing assignments remain readable; members can still update completion state on already assigned items. The Planning/Training `practice_tasks` path remains the existing active planning task flow, but it is not claimed to be synchronized with the legacy assignment table.  
**Future build:** Evolution Phase Six will define one canonical task contract, map both legacy sources, preserve IDs/history, and migrate through a reviewed compatibility plan. Do not delete either table in this phase.

### EV2-AUD-002 — Evaluation models are incompatible

- Daily Evaluation stores five dimensions: communication, coordination, decision making, role execution, and map awareness; total is on a 0–50 scale.
- The training advanced rubric uses six dimensions: coordination, communication, trade support, decision making, positioning, and consistency.
- The canonical Version 2 rubric specifies six dimensions, including independent Positioning and Map Awareness & Rotation, with Not observed/coverage semantics.
- The current models do not share the same dimensions or calculation contract.

**Impact:** scores from Daily Evaluation, training results, and future trends cannot safely be combined or compared as one player-development rating.  
**Future build:** Evolution Phase Three defines the canonical six-dimension rubric, evidence/coverage semantics, versioning, and historical crosswalk. Phase Zero does not silently convert old scores.

### EV2-AUD-003 — Default evaluation values could look like observations (fixed on PR branch)

- Before the fix, Daily Evaluation initialized the selected player as the display string `P1`, although the persisted player identity is a UUID.
- Before the fix, its five score fields initialized to 5.
- Before the fix, `PlayerEvaluationRubric` initialized all six ratings to 5 and allowed saving without requiring explicit interaction.

**Impact:** a reviewer could save untouched defaults as if they were observed; the player selector also began with a display label instead of a canonical UUID.  
**Phase Zero fix on this PR branch:** removed the P1 default, removed prefilled score values, require another active roster UUID (self-target excluded), require all five ratings to be explicitly selected, show an incomplete total as unavailable, and disable submission until the form is complete. A duplicate preflight blocks a second score for the same team/player/date, and a busy guard prevents repeated taps. This is a legacy-form guard only; the new session-linked evaluation workflow remains Evolution Phase Four.

### EV2-AUD-004 — Evaluation and feedback are separate writes (atomic fix deferred)

- Before the Phase Zero fix, `saveEvaluation` inserted the `daily_scores` row first and then separately inserted private feedback into `daily_score_feedback`.
- If the second write failed, a score could remain without its intended feedback.
- **Phase Zero fix on this PR branch:** private feedback entry is paused in the legacy form; the current form saves scores only. Existing private feedback remains visible in the recipient inbox. This removes the non-atomic two-write path without adding schema/API work or deleting history. The UI also blocks duplicate same-player/same-day submissions and self-target selection; a server-side idempotency/unique constraint remains part of the future phase contract.
- **Future build:** Evolution Phase Four will restore private feedback as part of one atomic score + feedback transaction with idempotency and fault-injection tests.

### EV2-AUD-005 — Realtime evaluation refresh selected columns absent from the live table (fixed on PR branch)

Before the fix, the initial load read base score columns from `daily_scores` and loaded private feedback separately. The Realtime callback selected `improvement_notes` and `mistake_notes` directly from `daily_scores`. The live `daily_scores` column inventory does not contain those two columns; they belong to `daily_score_feedback`.

**Impact:** the Realtime refresh query could fail and the callback did not surface that query error before updating local history. This could leave the displayed evaluation history stale or replace it with an empty result.  
**Phase Zero fix on this PR branch:** the shared `fetchEvaluationHistory` loader reads valid score columns, merges private feedback from its own table, orders same-day records deterministically, subscribes to both source tables, and reports refresh errors. This change is not merged or production-deployed.

### EV2-AUD-006 — Weekly Review and Player Trends are not separate experiences (legacy view corrected)

Both navigation entries still render the same `PlayerWeeklyInsights` component. Before the Phase Zero fix, it presented a team pulse, task totals, latest/previous evaluation comparison, and a generic bulk-task form as though it were a finished review/trends workflow.

Observed pre-fix calculation and scope limitations:
- no explicit review-window filter in the component;
- latest/previous relied on array ordering and had no same-day deterministic tie-breaker;
- recent average took up to four rows without a documented comparable-period rule;
- players with no evaluations returned 0 from the average helper and were included in the roster average;
- the batch duplicate guard checked from the start of the due-date year through the due date, rather than a clearly defined same-week window;
- the generated focus was generic rather than linked to an approved review snapshot.

**Impact:** team averages could be depressed by missing data, trend comparisons could be inconsistent, and the two navigation items did not deliver distinct workflows.  
**Phase Zero fix on this PR branch:** a record is valid only when all five stored dimensions are integers from 0–10; the displayed 0–50 total is recomputed from those raw dimensions rather than trusting a stale cached `total`. Missing/incomplete evaluations are excluded rather than treated as zero; same-day ordering uses score date, creation timestamp, and stable ID; no-data players are shown as insufficient data; the shared screen is labelled a read-only legacy snapshot; generic weekly task generation is paused. The separate Weekly Review and Player Trends builds remain Evolution Phases Seven and Eight.

### EV2-AUD-007 — Training rubric storage did not match its scale label (new writes fixed on PR branch)

Before the Phase Zero fix, both the standard role rubric and advanced rubric converted each displayed 1–10 dimension to a 10–100 value before storing it in the JSON rubric, while the advanced rubric also declared `scale: "1-10"`. The overall result score is a separate 0–100 value.

**Impact:** downstream readers could interpret dimension values on the wrong scale, and a stored scale label did not describe the actual values.  
**Phase Zero fix on this PR branch:** new standard and advanced rubric rows store raw 1–10 dimension values and include `scale: "1-10"` plus `dimension_storage: "raw_1_to_10"`. The standard rubric's role-weighted score is normalized separately to 0–100. Both legacy rubric forms require explicit dimension selection before saving. Historical rows are not rewritten. Evolution Phase Three will version the canonical rubric and add a crosswalk for old rows.

### EV2-AUD-008 — Squad Analytics is competitive-only (future development analytics)

`AnalyticsSection` calculates match count, points, average kills, and a recent six-match points estimate from the competitive match records passed to it. It does not currently provide the canonical player-development analytics described in Version 2.

**Impact:** do not label competitive match metrics as player-development progress or combine them with evaluation scores.  
**Phase Zero boundary:** the current screen is explicitly labelled a competitive-results legacy view. Player-development analytics remain planned for Evolution Phase Nine.

### EV2-AUD-009 — Session and evidence chain is incomplete

Training sessions, participants, and training results exist, but the inspected Evolution path does not establish the full immutable session roster/role snapshot → match/round → evidence → evaluation chain. The current Daily Evaluation is date/player based rather than session-first.

**Impact:** historical role/context and score provenance are not sufficiently linked for reliable role-aware comparison.  
**Future build:** Evolution Phase Two introduces session/match/roster/role snapshots; Evolution Phase Three connects evidence to the versioned rubric. Phase Zero preserves the existing date/player records.

### EV2-AUD-010 — Offline-first and peer-review capabilities remain unverified

- The repository README explicitly lists IndexedDB offline queue/conflict-safe background sync and browser-level end-to-end tests as not yet implemented.
- The live table-name inventory did not surface peer cohort/submission/inbox tables.
- The inspected navigation/components did not establish a complete anonymous peer-review workflow.

**Impact:** do not advertise durable offline writes, conflict-safe sync, or completed anonymous peer reviews as existing capabilities.  
**Future build:** anonymous peer cohorts/inbox belong to Evolution Phase Five; durable offline queue, conflict resolution, and complete Realtime data-quality handling belong to Evolution Phase Ten.

### EV2-AUD-011 — Team switching could retain stale Evolution records (fixed on PR branch)

Before the scoped follow-up fix, evaluation and legacy-assignment arrays were not cleared immediately when the signed-in user or selected team changed. A late assignment refresh started under the previous team could also finish after a team switch and replace the new team's list. Legacy assignment completion updates filtered by assignment ID without also constraining the selected team.

**Impact:** a player could briefly see a previous team's legacy evaluation/assignment information after changing team or account, and a late refresh could repopulate stale rows.

**Phase Zero fix on this PR branch:** evaluation and assignment state is cleared on sign-out/team change; initial fetches are cancelled on scope change; assignment refreshes verify the active team scope before updating state; completion updates require both assignment ID and team ID and check that the actor is the assignee or an active team manager. This is a client-side data-correctness guard, not an RLS/grant remediation; the separate Security workstream remains responsible for server authorization.

### EV2-AUD-012 — Daily Evaluation client date could disagree with the live database date (fixed to current contract)

The live `lock_daily_score_date_and_anonymize()` trigger assigns `score_date` using `(now() at time zone 'Asia/Kolkata')::date`. The legacy client previously calculated the date using the browser's local timezone. A device configured to another timezone could therefore preflight a duplicate against a different date from the one the database would persist. The live team timezone inventory currently contains 14 `Asia/Kolkata` rows and one `Asia/Calcutta` alias.

**Impact:** the displayed/preflight evaluation date could disagree with the server-assigned date around timezone boundaries, weakening the legacy same-day duplicate guard.

**Phase Zero fix on this PR branch:** the legacy Daily Evaluation date now uses the same explicit `Asia/Kolkata` timezone as the live trigger. This aligns the current implementation contract without changing the trigger or any schema. **Future build:** Evolution Phase One must replace the hard-coded timezone with a team-timezone contract and update server-side date assignment and client display together; do not assume all future teams use India time.

## 6. Data-integrity checks

The following read-only aggregate checks were run against the current live records. Each returned **0 findings**:

- feedback rows without a matching score/team/player;
- Daily Evaluation rows without a matching team membership;
- legacy drill assignments without a matching team membership;
- practice task plan/block/session team mismatches;
- plan block parent/team mismatches;
- training participant/session team mismatches;
- training result/session team mismatches;
- duplicate feedback per score;
- duplicate Daily Evaluation per team/player/date;
- duplicate legacy assignment per team/player/title/due date;
- duplicate participant per session/player;
- duplicate training result per session/player/attempt.

**Interpretation:** no orphan or duplicate groups were detected by these specific checks in this small snapshot. This does not prove all business invariants, historical correctness, or authorization behavior. It is not a security audit.

## 7. Evolution Phase Zero foundation work already present

These behavior-preserving baseline changes are present on `main`:

- guarded browser storage helpers and safe fallback for malformed local records;
- retry-safe legacy team-local data migration, with the completion marker written only after successful copies;
- validated local day and roster data;
- bounded team-logo crop coordinates and object-URL cleanup on success/failure;
- historical automatic cleanup paused so Evolution history is not silently deleted;
- foundation regression tests for storage, migration ordering, crop cleanup, and history-preservation UI.

No Evolution Version 2 scoring, peer-review, task-unification, evidence, trend-snapshot, or analytics schema has been implemented by these foundation changes.

### 7.1 Legacy fixes delivered on this PR branch

- **Daily Evaluation:** removed the P1 default and prefilled ratings; the existing five-dimension form now requires another active team roster UUID, excludes self-targets, requires explicit selection of every rating, and blocks duplicate same-player/day submissions. Its date now follows the live database trigger's Asia/Kolkata date contract. The form is labelled legacy and saves scores only; private feedback entry is paused to avoid partial writes. The session-linked atomic replacement remains Evolution Phase Four.
- **Evaluation Realtime:** one shared loader reads valid score columns and private feedback from their correct tables; score and feedback updates both trigger refetch; same-day ordering is deterministic; refresh errors are surfaced.
- **Weekly/Trends legacy view:** only complete five-dimension records (each integer 0–10) contribute; the 0–50 total is recomputed from raw dimensions; missing/incomplete records are not treated as zero; no-data players show insufficient data; records sort by date, creation time, and ID; generic weekly batch creation is paused; historical assignments remain visible and unchanged.
- **Training rubric:** both standard role and advanced six-dimension forms require explicit selection; new dimension values are stored as raw 1–10 with an explicit storage marker; standard role-weighted overall scores are separately normalized to 0–100. Historical rubric rows remain untouched.
- **Team-scope correctness:** evaluation and legacy assignment state clears on sign-out/team switch; late assignment refreshes cannot repopulate the previous team's rows; legacy completion writes are constrained by assignment ID and team ID and guard the current actor.
- **Analytics boundary:** the current screen is labelled competitive-results-only; player-development analytics remain Evolution Phase Nine.
- **Regression coverage:** `scripts/verify-evolution-legacy-fixes.mjs` now contains ten Evolution regression-contract tests, covering score completeness, both rubric storage paths, stale team data, scoped assignment updates, and the legacy partial score/feedback boundary.


## 8. Build and delivery evidence

- GitHub Actions run #49 for PR head commit `eaffa945bb50de149c6b40bb040cc72a9e7ec39b` completed successfully.
- The workflow passed dependency installation, lockfile artifact export, TypeScript typecheck, 18 foundation tests, 11 character-data tests, all 10 Evolution legacy regression-contract tests, and the Vite production build.
- The build completed with a non-blocking Vite chunk-size warning: the main JavaScript chunk is approximately 334.13 kB minified, above the configured 250 kB warning threshold. No build error occurred. This general bundle-size follow-up is not a reason to expand Phase Zero into unrelated app-wide performance work.
- This CI run verifies the code and regression tests at commit `eaffa945`. The subsequent audit-document update is documentation-only; any later source or workflow change requires a new successful run.
- The workflow still generates a run-local lockfile because the repository does not yet commit `package-lock.json`; reproducible dependency pinning remains a repository follow-up.
- The latest Vercel Preview check on this PR head is **blocked/failed with a Vercel build-rate-limit response** (`upgradeToPro=build-rate-limit`). This is a platform build quota result, not a TypeScript or Vite build failure.
- No Vercel Preview was available for approved-scope browser smoke tests; Android/tablet/desktop interaction QA is not claimed and remains assigned to Evolution Phase Eleven.
- No production deployment or promotion was performed as part of this audit.

## 9. Code/data paths to preserve

Until a later phase provides a reviewed migration and compatibility plan, preserve:

- existing `daily_scores` and `daily_score_feedback` rows and their original IDs;
- both legacy task tables and all completion/history fields;
- training plans, plan blocks, drills, sessions, participants, results, and notes;
- tournament match records and scrim review records;
- the existing team membership/player UUID relationships;
- the current local-storage migration behavior and history-preservation controls.

Do not reset production data, merge legacy task tables destructively, silently convert historical scores, or overwrite historical role/context.

## 10. Evolution migration and rollback plan

No Evolution schema migration is authorized or required to complete this audit. The following is the required safe sequence for later implementation:

1. Freeze the current source-to-table map in this audit and export a schema/data backup before any Evolution migration.
2. Reconcile migration provenance and the live schema against the checked-in migration directory before creating a new migration. Do not assume the current migration folder can recreate production.
3. Prefer additive tables/columns and compatibility views/adapters first. Do not rename/drop either legacy task table or rewrite historical score values during the first cutover.
4. Backfill only through an idempotent, reviewed script that records source table, source row ID, mapping version, and outcome. Compare source/target counts and relationship checks before enabling reads from the new model.
5. Use a controlled dual-read or compatibility adapter during transition; avoid dual-write unless the operation is atomic and retry-safe.
6. Switch one consumer at a time behind a reversible feature flag. Keep the old read path available until parity checks pass.
7. Roll back by disabling the new consumer/flag and returning reads to the preserved legacy source. Do not roll back by deleting migrated or historical rows.
8. Remove legacy paths only in a later, separately approved phase after export, parity, retention, and rollback windows have been proven.

Security-specific migration/grant work remains in the separate Security workstream.

## 11. Evolution Phase Zero — Legacy Fixes decision

**BASELINE AUDIT COMPLETE · LEGACY FIXES IMPLEMENTED · CI VERIFIED**

The baseline inventory, live Evolution data dictionary, relationships, task/rubric mapping, aggregate row counts, integrity-check results, implementation gaps, and preservation/migration requirements are documented. The scoped legacy fixes on this PR branch now cover the P1/default-score defect, self-target and duplicate submission paths, stale Realtime refresh, incomplete/cached-total trend calculations, duplicate legacy task creation, standard and advanced rubric scale mismatch, partial score/feedback writes, stale cross-team legacy data refresh, and browser/database date disagreement in the legacy Daily Evaluation form.

The scoped legacy-fix code and ten Evolution regression tests passed GitHub Actions run #49 at commit `eaffa945`. This is not a Version 2 feature build and does not mean the app is ready for production. Future functionality remains assigned to Evolution Phases One through Twelve. No schema changes, production data edits, merge, or production deployment are part of this phase. Device/browser interaction QA remains assigned to Evolution Phase Eleven; the restricted full-app preview was not used for testing.

Separate Security work remains outside this Evolution audit and is tracked independently in `docs/security/rls-review.md`.
