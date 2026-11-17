# Evolution Version 2 — Master Blueprint
**Project:** Squad OS / Free Fire Squad  
**Repository:** `parnav09/Free-fire-Squad-`  
**Blueprint baseline:** 17 November 2026  
**Baseline commit reviewed:** `9d28a7471530f9472530d79833583e729d190f43`  
**Status:** Architecture and implementation plan only. No application code, Supabase schema, production data, or deployment has been changed by this document.

> This document separates verified current implementation from partial implementation and proposed Version 2 work. A blueprint item is not a claim that code has already shipped.

---

## 1. Product decision: one connected Player Development System

Evolution Version 2 should not be four disconnected dashboards. It should be the player-development layer for the complete Free Fire team workflow:

**Scrim / Tournament Match / Training Session → Match Evidence → Evaluation → Player Feedback → Improvement Task → Task Completion → Follow-up Evaluation → Weekly Review → Player Trends → Squad Analytics.**

All modules must reference the same team, player, season, match/session, map, mode, role, evaluator, rubric version, and source record IDs. A user should be able to open a player and trace a score back to the match, round, observation, note, or drill that produced it.

### Core product rules

1. One canonical evaluation model; no competing score systems.
2. A score is never invented from a default value or missing data.
3. Zero is a valid rating; missing is a separate state.
4. No negative ratings. Improvement/decline is represented by a signed trend delta, not a negative performance score.
5. Raw match, evaluation, and feedback history is retained and auditable. No automatic destructive deletion of performance history.
6. Comparison is contextual: same role, mode, map, match type, rubric version, and comparable sample size.
7. Automated recommendations may be generated; assigning a task or changing a player's official evaluation requires an authorized human action.
8. Tournament placement/elimination points remain separate from player-development ratings.
9. Every workflow transition is idempotent, permission-checked, and traceable.
10. Empty data is shown as “No verified data yet”, never as 0% performance.

---

## 2. Existing implementation audit

### 2.1 Daily Evaluation

**Implemented in current main (static code inspection):**
- Daily Evaluation page and player/date selection.
- Five 0–10 dimensions: Communication, Coordination, Decision Making, Role Execution, Map Awareness.
- Total displayed as 0–50.
- Improvement feedback fields and date-lock intent.
- Database-side date handling and evaluator anonymization were introduced.
- Score history and a separate feedback table exist.

**Partially implemented / defects to fix:**
- Player state defaults to literal `P1`, while database player IDs are Auth UUIDs. Saving without changing the selector can submit an invalid player reference.
- Five sliders initialize to 5, so an untouched form can appear to be 25/50. This is fabricated-looking data and must stop.
- Score and feedback are written in separate requests; one can succeed while the other fails.
- Anonymous evaluator IDs are NULL. The current unique index treats NULLs as distinct, so duplicate submissions can bypass the intended uniqueness rule.
- Realtime history still requests removed `improvement_notes` and `mistake_notes` columns; that stale query can fail.
- The UI subscribes to score changes but not the private feedback table, so feedback can remain stale.
- Browser-local date and Asia/Kolkata database date can disagree.
- Daily rubric has no explicit independent Positioning dimension and does not cleanly separate Positioning from Map Awareness.
- No strong evidence link to a scrim, tournament match, round, or training session is required.
- The current five-dimension score is incompatible with the advanced training rubric.

**Version 2 replacement:**
- Use empty/null unanswered fields; require deliberate ratings or an explicit “Not observed” state.
- Resolve player from authenticated team roster UUID, never a hard-coded display label.
- Save evaluation, evidence links, and private feedback atomically through a validated database RPC/transaction.
- Add idempotency key per submission and a server-enforced duplicate policy.
- Use one authoritative team timezone (Asia/Kolkata by default) for session date boundaries; display the timezone in the UI.
- Subscribe to the exact existing columns and to feedback changes with recipient/team RLS.
- Separate score from feedback. A private “What went wrong” note and “What to improve next” note are retained as feedback records with recipient visibility.
- Every rating must have source context: match/session, map, mode, role, evaluator, date, rubric version, and optional round/time evidence.
- Do not silently convert unanswered fields into zero.

### 2.2 Weekly Review

**Implemented:** A weekly insight component exists. It shows task completion/open counts, evaluation count, roster information, recent average/team pulse, improvement focus, and bulk weekly task generation.

**Partially implemented / missing:**
- Review window and trend calculations are basic.
- Bulk tasks are generic rather than tied to a specific player's repeated evidence.
- It is not a fully independent review workflow with approvals, evidence, and follow-up.
- Players with no evaluations can be counted as zero in averages, which depresses the team score incorrectly.
- No clear “insufficient sample” confidence state.
- No complete link from a weekly recommendation to the task and next evaluation that validates it.

**Version 2 replacement:**
- Weekly review is a guided review period, not just a summary card.
- Show completed sessions/matches, valid evaluations, sample coverage, task outcomes, dimension changes, recurring errors, and evidence links.
- Generate per-player recommendations from repeated verified observations; IGL/coach approves before task creation.
- Each weekly focus becomes a linked task with owner, due date, drill, expected outcome, and follow-up measurement.
- Review has draft → coach review → published → archived states. Published snapshots are immutable; corrections create a new version.
- Do not include players with no evidence in score averages. Show them separately as “Not enough data”.

### 2.3 Player Trends

**Implemented:** A trends view exists and compares latest versus previous evaluation, a recent average, and a two-record delta.

**Partially implemented / missing:**
- Weekly Review and Player Trends currently route to the same combined component.
- Only a very small recent sample is compared; no robust 7/30/season history.
- Trend is mainly total-score based, not dimension-level.
- Same-day records are ordered by date without a deterministic secondary timestamp.
- Zero delta may be styled as positive rather than neutral.
- No confidence, sample size, role/map/mode filters, or evidence drill-down.

**Version 2 replacement:**
- Separate Player Trends view from Weekly Review while sharing the same query/service layer.
- Provide 7-day, 30-day, season, and custom date ranges.
- Plot each rubric dimension separately and show overall score, sample count, confidence, and data freshness.
- Compare only compatible records; show a warning when role, map, mode, or rubric differs.
- Use `created_at` and stable event IDs as deterministic tie-breakers.
- Neutral delta is neutral; upward/downward delta describes change, not a rating.
- Clicking a trend point opens its source match/session and evaluation notes.

### 2.4 Squad Analytics

**Implemented:** Existing analytics primarily covers tournament/match statistics such as matches, points, placements, kills, and roster size.

**Partially implemented / missing:**
- It is not yet the unified player-development analytics system.
- Daily Evaluation and Team Ratings are not integrated into the squad analytics data flow.
- Tournament results and player development scores are not explicitly separated in the UI.
- No role-aware squad balance, dimension gaps, coverage, or improvement-task outcome analytics.

**Version 2 replacement:**
- Two clearly separated analytics domains:
  - **Competitive Results:** official tournament points, placement, eliminations, match count, map/mode, event.
  - **Player Development:** rubric scores, role execution, communication/coordination, positioning, map awareness, consistency, task completion, evidence coverage.
- A combined “Performance Context” view may correlate them, but must not merge their scales or claim causation from correlation.
- Show squad role coverage, repeated team errors, trade-support patterns, rotation/positioning observations, and team communication trends where evidence exists.
- Team-level score is not the average of players with missing data treated as zero.

### 2.5 Other connected systems

**Known partial/disconnected workflows from prior audits:**
- `player_drill_assignments` and `practice_tasks` are separate task systems with no guaranteed automatic synchronization.
- No complete assignment notification/acknowledgement loop.
- Completion reflection is optional/basic and is not consistently tied to a later evaluation.
- Training evaluation uses a six-dimension 1–10 rubric and a normalized 0–100 result; Daily Evaluation uses five dimensions and 0–50.
- A separate Team Ratings model has nine dimensions and currently had zero rows at the prior audit.
- Advanced rubric metadata says 1–10 while some values are multiplied by 10, creating a scale/meaning mismatch.
- Offline queue and conflict resolution are not fully implemented.
- Tournament scoring was previously identified as prototype-level; keep its official scoring engine isolated from development ratings.

---

## 3. The canonical Free Fire evaluation model

### 3.1 Recommended rubric

Use one canonical set of six observable dimensions, each rated **0–10**:

| Dimension | What it measures | Example evidence |
|---|---|---|
| Communication | Timely, clear, actionable callouts; enemy/location/resource updates | Callout observation, VOD timestamp, IGL note |
| Coordination & Trade Support | Follow-up timing, crossfire support, revive/support coordination, team spacing | Round event, teammate observation |
| Decision Making | Fight selection, disengage, resource use, timing, risk judgement | Decision + outcome + context |
| Positioning | Cover use, angle, spacing, high/low ground, exposure, safe repositioning | Map/round observation, VOD timestamp |
| Map Awareness & Rotation | Zone timing, route choice, zone-edge awareness, enemy/third-party awareness, rotation planning | Map, zone phase, route/rotation note |
| Role Execution | Role-specific execution for the player's assigned role in that session | Entry, second entry, flanker/support, sniper/IGL evidence |

**Consistency is not a seventh one-match rating.** It is a longitudinal metric derived from repeated comparable sessions. This prevents a single match from pretending to measure consistency.

Positioning and Map Awareness/Rotation are separate dimensions. Positioning asks “Was the player's location and use of cover/angles effective?” Map Awareness asks “Did the player read the map/zone and rotate at the right time?” They can influence one another but must not be collapsed into one rating.

### 3.2 Scale semantics

- `0`: observed performance was absent/unsuccessful for that dimension in the rated opportunity.
- `1–3`: major improvement needed.
- `4–6`: inconsistent / developing.
- `7–8`: effective and mostly reliable.
- `9–10`: highly effective in the observed context.
- `Not observed`: no fair opportunity or insufficient evidence; stored as NULL with a reason, not zero.
- Negative score values are forbidden by database constraints.

A zero is a real rating only when the evaluator observed the player and deliberately selected zero. A missing value is not zero.

### 3.3 One score model, not three

**Canonical session score:** average of the valid rated dimensions, weighted by the versioned rubric and role profile, normalized to 0–100.

`canonical_score_100 = weighted_average(valid_dimension_scores_0_to_10) × 10`

- No default values.
- Exclude NULL / Not observed dimensions from the denominator.
- Require a minimum evidence coverage threshold before showing a headline score.
- Show coverage (e.g. 4 of 6 dimensions rated) beside the score.
- Keep raw dimension ratings for auditability.
- Store rubric version and role weights on every evaluation; later rubric changes must not rewrite old records.

**Legacy 37/50 example:** mathematically it can be displayed as 74/100 only as a labelled legacy conversion (`37 ÷ 50 × 100`). It is not automatically equivalent to a new 74/100 because the old five dimensions do not map perfectly to the new six dimensions. Historical legacy scores should be labelled “Legacy scale — approximate conversion” and excluded from direct trend lines until a reviewed dimension-level mapping exists.

**Advanced training 82/100 example:** if it was generated from the same six canonical dimensions, it can be compared to another score with matching rubric version/context. If it came from the old rubric or a different weighting model, show it as a separate legacy metric until migrated with an explicit mapping.

**Do not show a false precision “combined score”** by averaging 37/50 and 82/100. Compare only normalized scores with compatible dimensions, weights, context, and evidence coverage.

### 3.4 Role-aware Free Fire evaluation

The session must snapshot the role actually played, not simply the player's current roster role. Role weights are configurable and versioned:

- Primary Rusher: entry timing, first-contact decisions, cover-to-cover movement, opening-space creation, survival/trade context.
- Secondary Rusher: follow-up timing, trade support, spacing, support utility, coordinated entry.
- Third Rusher / Flanker: flank timing, angle creation, suppression/support, information sharing, safe rejoin timing.
- Sniper / IGL: information quality, callout timing, angle discipline, team rotation decisions, strategic coordination.

Do not punish a sniper for not having entry-fragger kill volume. Do not reward a rusher only for kills if the engagement was strategically poor. Role weights change the relative importance of dimensions; they never change the meaning or allowed range of the 0–10 raw ratings.

---

## 4. The connected workflow and automation model

### 4.1 Main event chain

1. **Create a Scrim/Tournament/Training session.** Select team, event, date/time, mode, map, lobby, match number, roster, and each player's session role.
2. **Capture match result.** Store placement, eliminations, points, survival/context stats where available. Keep official tournament scoring separate.
3. **Add evidence.** Link round, timestamp, map/zone phase, observation, clip/VOD URL, and observer. Manual evidence is allowed; unverified automated stats are not.
4. **Evaluate players.** Evaluator selects player and session, rates observed dimensions, marks unobserved dimensions, and adds private improvement feedback.
5. **Create improvement recommendation.** System detects repeated gaps or coach-selected focus. It suggests a drill/task; it does not silently assign it.
6. **Assign task.** Coach/IGL approves player, drill, due date, priority, expected behavior, and success criteria.
7. **Player acknowledges and completes.** Record status, completion time, short reflection, and optional evidence.
8. **Follow-up session.** Next scrim/training evaluation checks the same target dimension and links back to the originating task.
9. **Weekly Review.** Summarizes the whole chain and asks whether the intervention worked.
10. **Player Trends/Squad Analytics.** Display longitudinal results, confidence, and evidence trail.

### 4.2 Single task system

Do not maintain two independent task truths. Create one canonical `development_tasks` entity and expose context-specific views in Planning, Training, Daily Evolution, and Weekly Review.

Suggested task fields:
- `id, team_id, player_id, created_by, source_type, source_id`
- `title, description, target_dimension, role_context, map/mode_context`
- `drill_id, priority, status, assigned_at, acknowledged_at, due_at, completed_at`
- `success_criteria, expected_repetitions, completion_reflection`
- `origin_evaluation_id, origin_evidence_id, weekly_review_id`
- `follow_up_evaluation_id, outcome_status, created_at, updated_at`

Statuses: Draft → Assigned → Acknowledged → In Progress → Submitted → Verified Complete / Needs Rework → Archived. Overdue is a derived flag, not a destructive status.

Existing `player_drill_assignments` and `practice_tasks` must be mapped into this model through a reviewed migration. Do not delete old tables or rows before reconciliation and backup. During transition, use one-way compatibility views/adapters; never allow two systems to independently edit the same task.

### 4.3 Safe automation

Automate:
- Reminders for assigned/overdue tasks.
- Draft recommendations from repeated verified evidence.
- Weekly review draft generation.
- Refresh/invalidation of affected trend summaries.
- Follow-up reminders after the next eligible scrim/training session.

Require human approval for:
- Official evaluation submission where evaluator authority is required.
- Task assignment or reassignment.
- Rubric changes.
- Publishing weekly reviews.
- Any data correction that changes historical scores.

Never auto-delete evaluations, evidence, feedback, or completed tasks because a timer expired.

---

## 5. Module-by-module Version 2 blueprint

### 5.1 Daily Evolution / Daily Evaluation

**Target experience:**
- “Evaluate from session” is the default path; manual standalone evaluation remains available with a reason.
- Pick a scrim/tournament/training session, then the players and roles are prefilled from that session.
- Evaluate every player independently. Evaluator can rate multiple players in one session without re-entering match context.
- Each dimension has 0–10 plus “Not observed”; no preselected score.
- Two separate required/optional note areas: “Observed mistakes / what went wrong” and “What to improve next”. Notes are private to authorized team roles and the intended player, according to privacy policy.
- Add evidence links per dimension or per observation.
- Show score, evidence coverage, role context, and rubric version before submit.
- Save atomically; show pending/saved/failed state; prevent double taps; retry safely with idempotency key.
- After submit, create an optional “Create improvement task” action prefilled with the target and evidence.
- Player sees their own feedback and can acknowledge it; no ability to silently alter evaluator score.
- Corrections use an amendment trail with reason, actor, and timestamp.

**Required safeguards:** no default 5s; no P1 label as database ID; no partial save; duplicate prevention including anonymous evaluators; server-side team membership/role validation; private notes RLS; no stale Realtime column references.

### 5.2 Weekly Review

**Target experience:**
- Week selector with explicit team timezone and start/end dates.
- Team summary: matches/scrims/training sessions, active roster, evaluation coverage, task completion, open blockers, team dimensions.
- Individual player cards: current role, valid sample count, six dimensions, recurring strengths, recurring improvement areas, task outcomes, and linked evidence.
- Compare this week to prior compatible periods only. If sample size or context differs, display “not directly comparable”.
- Coach can add a written review and approve/reject draft recommendations.
- Every improvement focus can become a development task.
- End-of-week snapshot stores exact source IDs and rubric versions; it remains reproducible even if later data is corrected.
- “No data” and “insufficient sample” states are explicit.

### 5.3 Player Trends

**Target experience:**
- Filters: player, role, map, mode, scrim vs tournament vs training, 7/30/season/custom range.
- Trend charts for each dimension, canonical overall score, consistency, sample count, evidence coverage, and task outcomes.
- Separate observed score from derived indicators.
- Show event annotations: role changed, rubric changed, patch changed, team roster changed, player returned after absence.
- Comparison choices:
  - Player vs own previous compatible period (default).
  - Player vs same-role squad median (only with enough samples and privacy permissions).
  - Player vs own season baseline.
- Never rank players by raw kills alone or compare different roles without normalization and context.
- A downward delta is a trend signal, not a negative rating. A zero delta is neutral.
- Every chart point drills into its evaluation and source session.

### 5.4 Squad Analytics

**Two independent tabs:**

**A. Competitive Results**
- Match history, placement, eliminations, points, map/mode, tournament stage, event and roster.
- Configurable scoring ruleset with version and source; preserve historical event rules.
- Team results and player match stats, with role context.
- Official tournament points must not be replaced by development scores.

**B. Player Development**
- Team six-dimension profile and role coverage.
- Team communication/coordination, trade support, decision making, positioning, map awareness/rotation, role execution.
- Repeated error categories and evidence count.
- Task completion and follow-up success.
- Player development distribution with missing-data coverage shown separately.
- Compare team periods only when roster, mode, map mix, and rubric context are sufficiently comparable.

**C. Context view (optional)**
- Place competitive outcomes next to development trends to explore relationships.
- Do not claim that one caused the other; use “associated with” and display sample size/context.

### 5.5 Scrims and Tournament integration

- Every scrim block has a parent session and individual match records.
- A six-match scrim block can link six match rows to one session, while each player evaluation references the exact match/round.
- Tournament event has stage, week, match number, map, ruleset version, roster, and official score snapshot.
- Evaluation can be done after each match or after the block, but evidence must retain which match it refers to.
- Tournament player-development observations are separate from official points.
- Match result entry should be reusable by Analytics and Evolution; do not duplicate match data in each module.
- Allow coach to mark a match “result verified” before it feeds official aggregate analytics.

### 5.6 Training / Drills / Planning integration

- A drill can be recommended by a rubric gap, weekly review, or coach.
- Drill has role tags, dimensions trained, skill level, repetitions, duration, and success criteria.
- Completion is not proof of improvement. Improvement is verified by a later evaluation with comparable evidence.
- A drill assignment links to one or more sessions and a follow-up evaluation.
- Training results use the same canonical rubric; training-specific drill completion is a separate measure.
- Bulk weekly tasks must be personalized from each player's evidence, not copied identically to everyone.

### 5.7 Feedback and notifications

- Private feedback is a first-class record with recipient, author, source evaluation, visibility, created/updated timestamps, and acknowledgement.
- “Mistakes observed” and “next improvement” remain separate fields.
- Player acknowledgement does not mean agreement and does not change score.
- Notifications: new feedback, task assigned, task due/overdue, task verified, follow-up evaluation available, weekly review published.
- Realtime subscriptions must cover both score and feedback/task events with correct RLS.
- Add a visible refresh/retry state; Realtime is a convenience, not the only source of truth. Refetch on reconnect/focus and after mutations.

---

## 6. Data architecture and integrity

### 6.1 Canonical entities

Recommended relational model (final names may be aligned to existing schema after migration inspection):

- `teams`, `team_memberships`, `players`
- `sessions` (scrim, tournament, training)
- `session_matches`, `session_roster`, `session_player_roles`
- `match_results`, `tournament_events`, `scoring_ruleset_versions`
- `evidence_items` (observation, VOD URL, timestamp, map/round context)
- `rubric_versions`, `rubric_dimensions`, `role_weight_profiles`
- `player_evaluations`, `evaluation_dimension_scores`
- `player_feedback`
- `development_tasks`, `task_events`, `task_evidence_links`
- `weekly_reviews`, `weekly_review_snapshots`
- `player_trend_snapshots` (optional cache, never source of truth)
- `audit_log`, `outbox_events` / sync queue

Use foreign keys, check constraints, unique idempotency keys, created/updated timestamps, and immutable source IDs. Store UUIDs for identity; display labels such as P1 are not primary keys.

### 6.2 Atomic write and duplicate handling

One server-side transaction/RPC should:
1. Validate authenticated user and team membership/permission.
2. Validate player belongs to team and session roster.
3. Validate rubric version and score range 0–10.
4. Validate Not observed reason and evidence requirements.
5. Insert evaluation header, dimension scores, evidence links, feedback, and audit event.
6. Enqueue downstream refresh/notification events.
7. Return canonical saved record.

Use a client-generated idempotency key with a unique constraint. Do not depend only on a unique index containing nullable evaluator ID. If anonymous evaluations are supported, store a non-null stable submission actor key or deduplication token that does not expose the evaluator identity to the recipient.

### 6.3 RLS and privacy

- Team isolation on every exposed table.
- Role-based actions: Owner/Admin, IGL/Coach, Analyst, Player, as appropriate to the existing permission model.
- Player may read own permitted evaluation and feedback; cannot alter published scores.
- Evaluator identity anonymization must not weaken duplicate prevention or audit controls.
- Private notes must not be exposed through public views or broad team-wide select policies.
- Views must preserve RLS (use security-invoker where supported); security-definer functions require strict review.
- No service-role key in browser code.
- Validate every RPC argument server-side.

### 6.4 Realtime and refresh correctness

- Subscribe only to existing columns/tables.
- Subscribe to score, feedback, task, and review state changes with authorized filters.
- On event, invalidate the relevant query key rather than blindly replacing all UI state.
- Refetch on reconnect, tab focus, and mutation success.
- Handle subscription errors and show a non-blocking stale-data indicator.
- Realtime payloads are not authoritative for permissions; database RLS remains authoritative.

### 6.5 Offline-first sync

- Local queue stores pending mutations with UUID, idempotency key, entity version, and created timestamp.
- Show Pending / Synced / Conflict / Failed states.
- Never silently overwrite server changes.
- Conflicts require deterministic policy: append-only evaluations cannot be overwritten; editable task fields use version checks and show conflict resolution.
- Retry with bounded backoff; preserve queue across app restarts.
- Offline data is marked unverified until server confirms.
- Sensitive private feedback should be stored locally only if device/session protections and logout cleanup are implemented.

---

## 7. Retention, archive, comparison, and zero baseline

### 7.1 Data retention policy

Do not use auto-delete timers for performance records. The prior concern that comparisons disappear too quickly should be solved by retention and archival, not by deleting old data.

Recommended defaults:
- Evaluations, dimension scores, feedback, evidence metadata, completed tasks, and published weekly snapshots: retained for the life of the team unless an authorized owner requests a reviewed deletion.
- VOD/clip binaries: store only when necessary and permitted; external links can expire, so retain metadata and mark unavailable rather than deleting the evaluation.
- Trend snapshots/cache: rebuildable; may be pruned because the underlying records remain.
- Audit log: append-only with a documented retention policy.
- Team deletion: explicit owner action, confirmation, export option, delayed soft-delete window, then irreversible purge according to policy and applicable requirements.

A retention setting must say exactly what it affects. It must never silently delete the source records used by comparison.

### 7.2 Comparison engine

Comparison should be a feature, but not an unrestricted “compare any two numbers” feature.

Eligibility checks:
- Same player for self-trend, or same role cohort for peer comparison.
- Same rubric version or a reviewed crosswalk.
- Same mode and comparable match type.
- Map and patch context shown; filter or stratify where needed.
- Minimum sample size and evidence coverage.
- Exclude unverified, disputed, or insufficient-evidence records from official trend calculations.
- Never turn missing data into zero.
- Show absolute score, change, sample count, period, and comparability label.

No automatic deletion is needed for comparisons. Keep the historical window; allow filters and archive views.

### 7.3 Clean zero baseline

- New Evolution Version 2 baseline starts with no fabricated player ratings.
- Empty score tables or new rubric records are represented as no score, not a numeric 0.
- Existing two historical daily score rows (previous audit: 0/50 and 37/50 dated 12 Nov 2026) must be quarantined/labelled legacy pending provenance review; do not assume they are random and do not silently delete them.
- Existing `team_ratings` was empty at the prior audit; do not seed it with sample values.
- Any demo data must live in a clearly separate demo team/database and never enter production analytics.
- Before reset/migration, export and reconcile data, produce a row-count report, and require explicit owner confirmation for destructive cleanup.

---

## 8. Ten known problem groups and their Version 2 fixes

These are the ten consolidated problem groups recoverable from prior Evolution reviews. They are grouped here for implementation tracking; they are not represented as the exact historical numbering from every older chat.

1. **Wrong player identity / P1 default:** replace display-label default with authenticated roster UUID; require a real player selection.
2. **Fabricated default scores:** sliders start unanswered; no default 5; validate deliberate input; distinguish NULL from rated zero.
3. **Duplicate anonymous submissions:** idempotency key and database uniqueness that works with anonymous evaluator mode.
4. **Partial score/feedback writes:** one transaction/RPC; rollback everything if a required insert fails.
5. **Stale Realtime query and feedback refresh:** remove references to dropped columns; subscribe to feedback; invalidate/refetch on reconnect and after save.
6. **Timezone/date mismatch:** authoritative team timezone and server-derived date boundary; explicit timezone display.
7. **Missing data treated as zero:** aggregate only valid observations; show sample coverage and “insufficient data”.
8. **Weak trend comparison:** separate Weekly Review from Player Trends; use 7/30/season ranges, deterministic ordering, dimension trends, compatible cohorts, and neutral zero delta.
9. **Disconnected task workflows:** unify drill assignments and practice tasks into one canonical development task; notifications, acknowledgement, completion, reflection, and linked follow-up.
10. **Analytics and rubric fragmentation:** one versioned six-dimension rubric, role-aware weights, separate competitive results from development analytics, and connect scrim/tournament/training evidence.

Additional issues to include in QA: positioning vs map awareness conflation; advanced rubric 1–10 metadata vs ×10 normalization; no confidence/evidence coverage; generic bulk task generation; no full offline conflict resolution; no direct evidence drill-down; small 28px advanced slider hitbox; Evolution hidden under mobile “More”; Weekly Review/Player Trends shared component; no real device/browser visual QA yet.

---

## 9. UI/UX and accessibility blueprint

### Desktop
- Evolution overview with four clear module cards and a persistent player/session context.
- Detail pages use a stable left navigation and consistent filters.
- Evaluation workspace: player list on left, dimension/evidence form center, feedback/task panel on right.
- Keep competitive and development analytics visually separated.
- Dense tables must support sorting/filtering without horizontal overflow.

### Mobile / Android
- Keep primary Evolution entry reachable without repeatedly opening “More”; consider a dedicated bottom-nav slot or a persistent shortcut based on navigation capacity.
- One-column cards, sticky action footer, collapsible evidence/notes sections.
- All sliders and controls must have at least 44–48px effective touch target; the previously observed 28px advanced slider target must be fixed.
- Avoid tiny icon-only actions; use labels/tooltips and accessible focus states.
- Keep player selector, date, score state, and submit action visible and unambiguous.
- Preserve scroll position after save/Realtime refresh.
- Use safe-area insets, keyboard-aware forms, and no horizontal overflow.

### Design system
- Continue premium dark Squad OS visual language; avoid adding decorative charts that obscure evidence.
- Use consistent status colors for Pending, Synced, Needs Review, Verified, and Error.
- Do not use green/red alone to communicate positive/negative; include text/icon labels.
- Skeleton/loading, empty, stale, error, success, and offline states must all be designed.
- No visual QA claim until tested on actual Android viewport and desktop browsers.

---

## 10. Advanced future capabilities (phased, not all required for first release)

1. **VOD review workspace:** clip links, timestamps, round tags, dimension-linked annotations, coach/player comments.
2. **Map/rotation review:** manually captured zone phase, route decision, cover/angle observations; avoid pretending to have telemetry the game does not expose.
3. **Patch-aware analytics:** store game patch/version per session and annotate trends across balance changes.
4. **Role benchmark library:** team-specific historical baselines by role, mode, and map; never use arbitrary global “pro” targets as truth.
5. **Repeated-error detection:** rules-based detection first; every alert must show the source observations and allow coach dismissal.
6. **Recommendation engine:** recommend drills from repeated dimension gaps and role context; human approves assignment.
7. **Squad synergy view:** trade-support timing, role coverage, communication/coordination patterns where manually evidenced.
8. **Tournament season reports:** immutable event snapshots, stage/week comparisons, and exportable player/team reports.
9. **Coach review queue:** pending evaluations, disputed evidence, overdue tasks, and weekly reviews needing approval.
10. **Advanced reporting/export:** player development report, squad report, event report, CSV/PDF export with privacy controls.
11. **Data quality monitor:** detect missing session roster, duplicate events, stale subscriptions, mismatched rubric versions, and score coverage anomalies.
12. **Optional assistive AI:** summarize existing notes and suggest candidate drills only; no autonomous scoring, no invented match events, no unreviewed evaluation changes.

---

## 11. Implementation phases and acceptance gates

### Phase 0 — Audit and safety baseline
- Inspect current schema, migrations, RLS, RPCs, triggers, indexes, components, and all current callers.
- Inventory both task tables and every scoring model.
- Produce data dictionary and legacy mapping plan.
- No production data deletion.

**Gate:** schema map and migration plan reviewed; all current write/read paths identified.

### Phase 1 — Canonical rubric and identity
- Introduce versioned six-dimension rubric and role-weight profiles.
- Fix P1 UUID bug and default 5 bug.
- Implement Not observed vs 0.
- Add legacy score labels and conversion metadata.

**Gate:** unit tests prove no score can be submitted from untouched form; score constraints reject negative and >10 values.

### Phase 2 — Atomic evaluation and feedback
- Transactional save RPC, idempotency, evidence links, private feedback, audit trail.
- Fix RLS and evaluator anonymity without losing deduplication.

**Gate:** fault-injection tests prove all-or-nothing writes; duplicate retry creates one evaluation.

### Phase 3 — Session / scrim / tournament integration
- Canonical session and match IDs, roster role snapshot, verified result state.
- Link evaluation to exact match/round/evidence.

**Gate:** every evaluation can be traced to a source session or an explicit manual-evaluation reason.

### Phase 4 — Unified task workflow
- Reconcile legacy task tables.
- Build one canonical development task model and adapters.
- Notifications, acknowledgement, completion, reflection, follow-up.

**Gate:** a task created from feedback appears consistently in Planning, Training, Daily Evolution, and Weekly Review without duplicate rows.

### Phase 5 — Weekly Review
- Review snapshots, evidence coverage, personalized recommendations, approval/publish lifecycle.

**Gate:** no-data players are excluded from averages; every recommendation traces to source evidence.

### Phase 6 — Player Trends
- Separate page, dimension trends, filters, cohort eligibility, confidence, evidence drill-down.

**Gate:** incompatible rubric/context comparisons are blocked or explicitly labelled.

### Phase 7 — Squad Analytics
- Separate Competitive Results and Player Development domains; contextual view only when appropriate.

**Gate:** tournament points cannot alter development score and vice versa.

### Phase 8 — Realtime and offline reliability
- Correct subscriptions, invalidation/refetch, offline queue, conflict handling.

**Gate:** stale data, reconnect, duplicate retry, and conflict scenarios pass automated tests.

### Phase 9 — UI and device QA
- Desktop, tablet, Android viewport, keyboard, safe area, touch targets, empty/error/loading states.

**Gate:** screenshot and interaction QA on supported viewport sizes; no claim of pixel-perfect before this passes.

### Phase 10 — Controlled rollout
- Feature flag, staging data, migration dry run, backup, production migration, smoke tests, monitoring, rollback plan.

**Gate:** migration verified, RLS checked, no data loss, Vercel production deployment healthy, and owner signs off.

---

## 12. Test matrix (must pass before production)

- New team with zero Evolution records.
- Player has no evaluation; trend shows “No data”, not 0.
- Evaluator leaves a dimension unanswered; save requires deliberate rating or Not observed.
- Deliberate 0 rating saves and displays as zero.
- Negative rating is rejected at UI and database.
- Player UUID is correct even when selector initially loads.
- Two rapid taps / retry / offline replay create one evaluation.
- Feedback insert failure rolls back evaluation.
- Anonymous evaluator submissions remain deduplicated.
- Player cannot read another player's private feedback unless policy permits it.
- Removed columns are never requested by Realtime.
- Feedback appears without manual full-page reload.
- India timezone date boundary works; other timezone clients cannot shift the authoritative team date.
- Player with no evaluations does not depress squad average.
- Same-day evaluations sort deterministically.
- Zero trend delta is neutral.
- Positioning and Map Awareness are rated independently.
- Different roles are not compared as if identical.
- Legacy 37/50 and old advanced 82/100 are clearly labelled and not falsely merged.
- Task from evaluation appears once across modules and links to follow-up.
- Tournament official points remain separate from development score.
- Retention/archive does not delete comparison source records.
- Offline conflicts are visible and recoverable.
- Android touch targets meet minimum size; desktop layout has no overflow.
- Owner-only destructive actions require confirmation and audit log.

---

## 13. Definition of done

Evolution Version 2 is complete only when:
- All four modules use the same canonical data and rubric.
- Scrims, tournament matches, training, evaluations, feedback, tasks, and weekly reviews are traceably connected.
- The old score models are reconciled or explicitly labelled legacy.
- Zero, missing, and negative values are handled correctly (negative scores forbidden).
- No random seed values appear in production.
- Comparisons retain historical source data and explain comparability.
- RLS, privacy, idempotency, atomic writes, Realtime, and offline behavior pass tests.
- Desktop and Android UI are tested, not merely inferred from CSS.
- The production deployment and migration are verified separately from blueprint completion.

## 14. Current status versus planned status

| Area | Current status from prior code audit | Version 2 target |
|---|---|---|
| Daily Evaluation | Implemented, but five-dimension/0–50 and has save/data bugs | Unified six-dimension rubric, evidence-linked, atomic |
| Weekly Review | Partially implemented | Full approved weekly review and snapshots |
| Player Trends | Partially implemented; latest-two comparison | Longitudinal dimension trends and contextual comparisons |
| Squad Analytics | Match/tournament analytics implemented; development link missing | Separate competitive and development analytics |
| Scrim/Tournament link | Match data exists, Evolution linkage incomplete | Session/match/evidence source of truth |
| Tasks | Two separate task paths; sync incomplete | One canonical development task workflow |
| Feedback | Separate table exists; refresh/privacy workflow incomplete | Private feedback, acknowledgement, notifications, realtime |
| Scoring | Multiple incompatible scales | One versioned canonical rubric |
| Retention | No verified complete retention/archive design | No automatic deletion of source performance data |
| Offline | Partial/absent conflict handling | Durable queue, idempotency, conflict resolution |
| Mobile/desktop QA | CSS inspected; actual device/browser QA not completed | Verified interaction and layout QA |

---

## 15. Scope boundary and implementation status

This is the **Evolution Version 2 blueprint only**. It has not implemented these features, changed database records, reset production data, run migrations, or deployed code. Existing functionality remains as it was at baseline commit `9d28a747`.

The prior reviews provide a consolidated set of ten known problem groups above. The exact original numbered 1–10 text from every older chat was not fully recoverable, so this document does not falsely claim those are verbatim historical labels. It includes all recoverable Evolution issues and the additional requirements from the current request.

**Next implementation order:** Phase 0 audit → Phase 1 canonical rubric → Phase 2 atomic evaluation → Phase 3 session integration → Phase 4 unified tasks → Phase 5–7 analytics → Phase 8–10 reliability and rollout.


---

## 16. Addendum — Anonymous Peer Evaluation Inbox in Tasks

**This is an additive requirement. The document name remains “Evolution Version 2”; do not rename or replace the blueprint.** This addendum extends Daily Evolution, Tasks, Feedback, privacy, database, Realtime, UI, and QA requirements.

### 16.1 Product behavior

The existing Tasks area already has the concept of feedback sent by a player and feedback received by a player. Version 2 must add a dedicated **Daily Peer Evaluation** card type to the recipient's **Feedback Received** area. It must be connected to the canonical Daily Evaluation record, not copied into an unrelated task or manually re-entered.

The recipient's Tasks screen should have clear tabs/filters:
- **Feedback Received** — daily peer evaluation cards and other feedback addressed to the signed-in player.
- **Feedback Sent** — the signed-in player's own submissions and status. Only the sender can see their own submitted content here.
- **Improvement Tasks** — tasks created from evaluation feedback, weekly review, or coach assignment.

Do not mix a received anonymous review with a task assignment. They are related records but different card types.

### 16.2 Daily evaluation eligibility and no self-rating

- A player can evaluate only another eligible player in the same team and the relevant daily evaluation cohort/session.
- The evaluator must never see themselves as an option in the target-player selector. Filter the authenticated player's own UUID out of the selector before rendering.
- This is not merely a frontend rule: the database transaction/RPC must independently reject `auth.uid() = target_player_id`. Direct API calls, stale clients, and modified requests must not bypass it.
- Validate team membership, active roster status, and session participation/eligibility on the server.
- Never use roster labels such as P1/P2 as identity. Use Auth UUIDs internally and display names only where the product is allowed to show them.
- A roster with N eligible participating players expects N−1 peer reviews per recipient. Do not hard-code four. If the active eligible cohort has five players, each player can receive four reviews; if it has four, each can receive three.
- A player cannot submit more than one final daily review for the same recipient and team-local date/cohort unless an explicitly audited correction flow is used.
- If a player was absent, inactive, or not eligible for the relevant session, mark them “Not eligible / Excused” rather than counting them as a missed reviewer.
- The date is assigned by the server using the team's configured timezone (Asia/Kolkata by default). No evaluator date picker and no client-supplied backdating. The date is visible as read-only context.

### 16.3 Strict recipient anonymity

The recipient must never see who submitted a review:
- No evaluator name, IGN, avatar, roster slot, role, player code, UUID, email, or stable pseudonym.
- No evaluator identity in the card title, detail screen, notification, export, Realtime payload, analytics, or player-facing API response.
- No exact submission timestamp. Show the team-local evaluation date only.
- Do not expose stable ordering that could let players track one reviewer across days. Randomize the order of anonymous review cards for each recipient/date, or use a non-persistent ordinal such as “Anonymous review 1” within that one daily batch.
- Do not include evaluator metadata in client-readable tables/views. Keep the minimum identity mapping needed for self-rating prevention, duplicate prevention, and security audit in a protected server-only structure with no player-facing read policy.
- Normal coach/IGL/player screens must not reveal evaluator identity. If a narrowly scoped security audit is ever legally/operationally required, it must be a separate break-glass process, not a normal product feature or a way to resolve team arguments.

**Important anonymity limitation:** in a small five-player squad, people may guess an evaluator from writing style, timing, or a specific incident mentioned in free text. The system can hide account identity and metadata, but cannot mathematically guarantee that a reviewer cannot be guessed from their words. The UI should warn reviewers not to identify themselves or name other teammates in notes, strip metadata, and avoid showing exact timestamps. If strict anonymity is more important than unrestricted notes, provide structured feedback prompts and a moderation/redaction step before release. Do not promise impossible anonymity.

### 16.4 What the recipient sees in Tasks

Add one premium card for each daily evaluation batch:

**Card front**
- Title: “Daily Peer Evaluation”
- Date: server-assigned team-local date, e.g. “17 Nov 2026”
- Status: “New”, “Partially received”, or “Complete”
- Progress: “3 of 4 anonymous reviews received” (only where the recipient is authorized to see their own received-review progress)
- Small summary: “Your feedback is ready” or “Reviews are still coming in”
- No evaluator identity, initials, player codes, avatars, or identifying badges.

Tap opens a dedicated detail screen, matching the existing Scrims card-to-detail interaction pattern:
- Header with date and completion status.
- A separate card/accordion for each anonymous review in randomized, non-stable order.
- Each review shows its own total score and all dimension scores, including Communication, Coordination & Trade Support, Decision Making, Positioning, Map Awareness & Rotation, and Role Execution.
- Show “Not observed” distinctly from a deliberate 0.
- Under the scores, show the reviewer's two separate feedback areas:
  1. **Mistakes observed** — what went wrong / what should be corrected.
  2. **Improvement focus** — what the player should practise or change.
- Show linked evidence only if it does not reveal the evaluator's identity or another player's private data. Redact author metadata and restrict access to the recipient.
- Do not merge all peer scores into one unexplained number. Show each anonymous review separately, then an optional aggregate summary with sample count and coverage.
- Do not expose reviewer identity through tooltips, accessibility labels, hidden DOM attributes, URLs, query parameters, client logs, or downloadable filenames.

The recipient should be able to open each review independently, read the dimension-level scores and notes, and return to the card list without losing scroll position.

### 16.5 Review completion and missed-review states

The expected review count is calculated from the eligible cohort snapshot for that date/session, excluding the recipient themselves.

- Before the daily cutoff: show “Collection in progress” / “Pending”.
- After cutoff: if the recipient has fewer reviews than expected, show “Not all peer reviews received” and the count received/expected.
- If all eligible peers submitted: show “Complete”.
- If a reviewer is excused or not eligible, remove them from the expected denominator through a recorded eligibility decision; do not label them as having missed a review.
- Do not mark a player as a missed evaluator just because they did not attend the scrim/session.
- The recipient may see their own received count, such as 3/4, but not the identities of submitters or missing submitters.
- Other players may see only a neutral collection state if the team needs a shared status. Do not show a per-reviewer submission list, missing-player list, or detailed per-target completion matrix to the whole squad; that can reveal identities by elimination in a small roster.
- If the product requires a team-wide status card, show only “Daily peer review collection open/closed” without person-level counts. Coaches may see aggregate cohort coverage, not reviewer identities.
- A missed review must not generate a public accusation or a visible “Player X failed to review Player Y” event. Remind the individual privately that they have pending peer reviews, without revealing the recipient list.

### 16.6 How anonymous reviews connect to improvement tasks

- A received evaluation can offer **Create improvement task** from a specific dimension or feedback item.
- The new task references the evaluation ID and dimension/evidence IDs internally, but the player-facing task must not contain evaluator identity or a reviewer code.
- The task title should describe the improvement, e.g. “Improve rotation timing”, not “Reviewer 2 said…”.
- The player can acknowledge the feedback, add a reflection, and mark a linked drill/task complete.
- Completion does not change the original evaluation. The next eligible scrim/training evaluation is linked as follow-up and measures whether the target improved.
- A player can report that feedback is unclear or inappropriate through a private review flag. This creates a moderation/review item without revealing the evaluator to the player.
- Feedback acknowledgement is not agreement and must not be treated as an appeal or score edit.

### 16.7 Data model additions

Align these logical entities with the existing schema during Phase 0; do not blindly create duplicate tables if equivalent tables already exist.

- `daily_review_cohorts`: team, server-derived date, optional session ID, timezone, eligible roster snapshot, cutoff, rubric version, status.
- `daily_peer_review_submissions`: cohort ID, target player UUID, protected evaluator UUID, submitted evaluation ID, idempotency key, submitted state. Evaluator UUID is never exposed to recipient-facing queries.
- `daily_peer_review_eligibility`: cohort ID, player UUID, eligible/excused reason, participation evidence, decided-at.
- `daily_peer_review_receipts` (or secure view/RPC result): recipient-scoped sanitized review payload containing evaluation ID, date, dimension scores, notes, safe evidence, and non-stable display order; no evaluator identity.
- `daily_peer_review_status`: recipient-scoped expected/received counts and collection state, with no reviewer identities.
- `feedback_tasks` / links: relation from received evaluation dimension/note to canonical `development_tasks`.

Constraints and transaction logic:
- Unique `(cohort_id, evaluator_user_id, target_player_id)` to prevent duplicate peer submissions, plus unique idempotency key.
- Check that evaluator and target are different UUIDs.
- Server-side check that both belong to the same eligible team/cohort and that target was eligible.
- Enforce one final submission per evaluator-target-cohort. Corrections are append-only amendments with reason, not silent overwrites.
- A cohort roster snapshot prevents a later roster edit from changing the expected review count retroactively.
- Store author identity separately from sanitized recipient content; do not rely on a nullable evaluator column in a unique index.
- Keep raw evaluation and notes immutable after submission; corrections create a version/amendment trail.

### 16.8 RLS, API, and privacy requirements

- The recipient-facing read RPC/view must return only the signed-in recipient's sanitized records.
- A player must not query the base submission table or infer evaluator UUIDs from foreign keys, joins, counts grouped by evaluator, error messages, or realtime payloads.
- Revoke direct client SELECT on protected evaluator mapping/submission tables. Expose only the minimal recipient-scoped sanitized response.
- Use RLS on all exposed tables. Views must be security-invoker where supported; any privileged function must be narrowly scoped, validate `auth.uid()`, use a fixed search_path, and have EXECUTE privileges explicitly restricted.
- Never put service-role credentials in the client.
- Ensure notifications and realtime events contain only recipient-safe fields. Prefer “new anonymous review received” and a refetch of the sanitized receipt; do not send raw row payloads.
- Test access as recipient, evaluator, unrelated teammate, coach/IGL, and unauthenticated user.
- Keep the sent-feedback view private to the submitting evaluator; it may show their own content because they already know they wrote it, but it must not create a path to identify other reviewers.

### 16.9 Premium UI and interaction details

- Add a “Daily Peer Evaluation” card to Feedback Received, visually consistent with existing Scrims cards and Tasks styling.
- Use clear date, progress/status, and unread indicator; avoid excessive badges and clutter.
- Detail screen uses expandable anonymous-review cards with a stable, accessible layout; labels and values remain aligned on narrow screens.
- Dimension scores use consistent 0–10 presentation; “Not observed” is text, not a zero-length bar.
- Notes are visually separated into “Mistakes observed” and “Improvement focus”.
- Add loading skeleton, empty state, partial state, complete state, failed refresh, offline/stale state, and retry behavior.
- Tapping a card opens details; back navigation returns to the same scroll position.
- Use 44–48px minimum effective touch targets, including accordion headers, tabs, and action buttons.
- On Android, ensure keyboard and safe-area handling; on desktop, use a balanced two-column review layout without exposing identity in hover states.
- Accessibility text must say “Anonymous review” and must not contain hidden author names or codes.

### 16.10 Realtime and notifications

- When a review is committed, enqueue a sanitized notification for the target player.
- Realtime notification payload contains only recipient ID, cohort ID, safe status, and event ID; never evaluator ID or raw author metadata.
- Recipient client refetches sanitized receipt data; it does not render the raw event payload as the review.
- Update received count/status immediately after successful server commit and reconcile with server on reconnect/focus.
- Update the sender's private Feedback Sent state separately.
- Avoid a global live counter that lets teammates watch individual submissions arrive; this can reveal reviewer identity by timing.

### 16.11 Acceptance tests specific to anonymous peer review

1. In a five-player eligible cohort, each player can evaluate the other four; nobody can select or submit an evaluation for themselves.
2. In a four-player cohort, expected reviews are three, not a hard-coded four.
3. Direct RPC/API self-rating attempt is rejected even if the UI is bypassed.
4. Duplicate taps, retries, and offline replay create one submission per evaluator-target-cohort.
5. Recipient can see four anonymous review cards and all six dimension scores/notes, but no author identity or stable author code.
6. The four cards are not ordered by submission time and do not preserve a cross-day reviewer pseudonym.
7. Recipient can distinguish a deliberate 0 from Not observed.
8. Recipient sees their own expected/received count; other teammates cannot inspect a reviewer-by-reviewer completion matrix.
9. A missed/late review changes collection status without revealing who missed it.
10. Absent or excused players are not counted as missed reviewers.
11. Notes, notifications, URLs, accessibility labels, browser logs, exports, and Realtime payloads contain no evaluator identity.
12. A reviewer cannot read another player's received-review inbox.
13. A recipient cannot query the protected evaluator mapping table.
14. Creating an improvement task from a received review links to the correct dimension/evidence but carries no reviewer identity.
15. Completing a task creates a follow-up path and does not rewrite the original review.
16. Realtime receipt refresh works without a full page reload and handles reconnect/stale states.
17. Small-screen layout has no clipping, overlapping labels, or undersized tap targets.
18. A note containing explicit self-identification is flagged for redaction/review before delivery when strict anonymity mode is enabled.

### 16.12 Implementation phase integration

- **Phase 0:** inspect existing Tasks feedback sent/received UI, feedback tables, daily score tables, RLS, Realtime subscriptions, roster/attendance model, and current Scrims card-detail navigation.
- **Phase 1:** implement eligible cohort snapshot, server-derived date, self-exclusion in selector, and database self-rating rejection.
- **Phase 2:** implement atomic anonymous peer-review submission, protected evaluator mapping, recipient-safe receipt query, and idempotency.
- **Phase 3:** add Daily Peer Evaluation card and detail screen in Tasks → Feedback Received; keep Feedback Sent private to sender.
- **Phase 4:** connect received feedback to canonical development tasks and follow-up evaluations.
- **Phase 5:** add sanitized notifications/Realtime, completion states, missed-review handling, and audit-safe correction workflow.
- **Phase 6:** complete RLS/privacy review, deanonymization tests, Android/desktop UI QA, and rollout behind a feature flag.

**Definition of done for this addendum:** a player can open Tasks → Feedback Received, tap today's Daily Peer Evaluation, inspect every anonymous peer's separate dimension scores and improvement/mistake notes, and create a linked improvement task—without the app exposing who submitted any review. Self-evaluation is impossible at both UI and database layers. Missing reviews are represented through privacy-safe collection status, not a public list of reviewers who failed to submit.
