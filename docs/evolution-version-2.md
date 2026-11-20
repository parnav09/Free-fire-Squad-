# Evolution Version 2 — Master Blueprint

**Project:** Squad OS / Free Fire Squad  
**Repository:** `parnav09/Free-fire-Squad-`  
**Blueprint baseline:** 18 November 2026  
**Reviewed document:** Existing Evolution Version 2 master blueprint, Sections 1–16 (841 lines)  
**Code-audit reference:** `9d28a7471530f9472530d79833583e729d190f43`  
**Blueprint branch:** `docs/evolution-version-2-blueprint`  
**Status:** Architecture, product specification, dependency plan, and implementation contract only. This rewrite does not implement application code, alter Supabase schema/data, run migrations, merge branches, or deploy.

> **Preservation rule:** This is a complete rewrite and upgrade of the existing Evolution Version 2 blueprint, not a replacement product. All original requirements remain in scope: the connected Player Development System; the six-dimension canonical rubric; role-aware scoring; Daily Evaluation; Weekly Review; Player Trends; Squad Analytics; scrim/tournament/training integration; one task system; feedback; data integrity; RLS/privacy; Realtime/offline; retention; zero baseline; all ten known problem groups; responsive premium UI; future capabilities; implementation phases; test matrix; current-vs-target status; scope boundary; and the complete anonymous peer-evaluation inbox requirements from the former Section 16. No existing requirement is intentionally removed.

> **Evidence boundary:** The implementation-status statements below refer to the earlier static inspection of the stated code-audit commit. They are not a claim that the current production deployment or database was re-audited on 18 November. Every implementation phase starts with a fresh inspection of the actual repository, Supabase schema, RLS, and deployment state.

---

# Part I — Product foundation and non-negotiable rules

## 1. Product definition

Evolution Version 2 is the connected player-development system for Squad OS. It is not four independent dashboards and it is not a second match-statistics engine.

Its job is to turn verified competitive/training activity into fair observations, useful feedback, measurable practice, and traceable improvement—without fabricating scores, leaking private information, or breaking existing Scrims, Tournament, Training, Planning, Tasks, or Analytics workflows.

### 1.1 The complete development loop

**Team / Roster → Session → Session Roster & Role Snapshot → Match Result → Evidence → Evaluation → Feedback → Improvement Task → Practice / Drill → Follow-up Evaluation → Weekly Review → Player Trends → Squad Analytics → Next Improvement Cycle.**

Each stage must use stable IDs and explicit relationships from the previous stage. A later module must consume the earlier module's records; it must not recreate them in a parallel table or calculate a competing version of the same fact.

### 1.2 Product outcomes

1. A player can understand what was observed, in which session, in which role, and what to practise next.
2. A coach/IGL can see whether an improvement task was completed and whether a later comparable evaluation supports improvement.
3. A team can identify recurring squad-level issues without turning individual performance into public blame.
4. A reviewer can trace every displayed metric to source records and its calculation version.
5. A player can receive anonymous peer reviews without the application exposing evaluator identity through data, UI, notifications, logs, URLs, or metadata.
6. Existing competitive results remain intact and separate from development scores.
7. The system remains usable on Android/mobile, tablet, and desktop, including poor connectivity.
8. A change to one module does not silently change the meaning of data in another module.

### 1.3 Non-negotiable product rules

- One canonical player-development evaluation model.
- One canonical task source of truth.
- One canonical session/match/evidence identity chain.
- One versioned rubric and one documented scoring engine.
- Zero is a valid observed rating; missing and Not observed are separate states.
- Negative dimension scores are forbidden. Positive/negative change belongs only in trend deltas.
- No prefilled ratings, demo values, invented observations, inferred match events, or fabricated sample records in production.
- Tournament placement/elimination points are never merged into player-development ratings.
- Role played in a session is snapshotted; the current roster role must not rewrite historical context.
- No-data players are excluded from numeric averages and shown as “No verified data” or “Insufficient sample”.
- Every write is permission-checked, validated server-side, idempotent, auditable, and atomic where multiple records form one action.
- Historical source records are retained; corrections are append-only amendments, not silent overwrites.
- Automated recommendations may be drafted; a human with the correct permission approves assignments, official score corrections, and publication.
- Anonymity claims must match what can actually be guaranteed for the cohort size and the content shown.
- Blueprint completion, implementation completion, QA completion, and production rollout are separate statuses.

## 2. Existing implementation baseline — what is known and what is not

This section preserves the previous audit findings as the starting hypothesis for Evolution Phase Zero. It must be revalidated against the branch and live schema before implementation.

### 2.1 Daily Evaluation

**Previously observed as implemented:**
- Daily Evaluation page with player/date selection.
- Five 0–10 dimensions: Communication, Coordination, Decision Making, Role Execution, Map Awareness.
- Total shown as 0–50.
- Improvement feedback fields and date-lock intent.
- Database-side date handling and evaluator anonymization had been introduced.
- Score history and a separate feedback table existed.

**Previously observed defects / partial implementation:**
- Player state defaulted to literal `P1`, while database player identity uses Auth UUIDs.
- Five sliders initialized to 5, allowing an untouched form to look like 25/50.
- Score and feedback were separate writes and could partially succeed.
- Nullable anonymous evaluator IDs could bypass ordinary unique-index duplicate protection.
- A Realtime query still referenced removed `improvement_notes` and `mistake_notes` columns.
- Feedback changes were not reliably included in Realtime refresh.
- Browser-local date and Asia/Kolkata database date could disagree.
- Positioning was not independent from Map Awareness.
- Evidence linkage to exact scrim/tournament/training match or round was weak.
- The five-dimension 0–50 model was incompatible with the advanced training rubric.

**Version 2 target:** unanswered inputs; real roster UUID; server-authoritative team timezone; six-dimension rubric; evidence links; atomic write; idempotency; strict authorization; private feedback; correct subscriptions; and no silent conversion of missing to zero.

### 2.2 Weekly Review

**Previously observed:** a combined weekly insight component showed task counts, evaluation counts, roster information, recent average/team pulse, improvement focus, and bulk task generation.

**Previously observed gaps:**
- Basic review window and trend calculations.
- Generic rather than evidence-personalized bulk tasks.
- No complete draft/review/publish/immutable-snapshot lifecycle.
- Players with no evaluation could depress averages as zero.
- No clear confidence/sample-coverage state.
- Weak link between recommendation, task, and follow-up evaluation.

**Version 2 target:** guided review period, evidence-backed player cards, comparable-period checks, coach approval, published immutable snapshot, individualized tasks, and explicit no-data states.

### 2.3 Player Trends

**Previously observed:** latest-versus-previous score, recent average, and a small delta.

**Previously observed gaps:**
- Weekly Review and Player Trends pointed to the same combined component.
- Small samples; no robust 7-day/30-day/season trend.
- Mainly total score, not dimension trends.
- Same-day ordering lacked a deterministic tie-breaker.
- Zero delta could be styled as positive.
- No confidence, coverage, role/map/mode filters, or evidence drill-down.

**Version 2 target:** separate route and experience using shared services; contextual filters; six dimension trends; confidence and coverage; event annotations; evidence drill-down; compatible comparisons only.

### 2.4 Squad Analytics

**Previously observed:** tournament/match statistics such as matches, points, placements, kills, and roster size.

**Previously observed gaps:** development evaluations and Team Ratings were not unified into the same data flow; official results and development scores were not clearly separated; no evidence-backed role balance, dimension gaps, or task-outcome analytics.

**Version 2 target:** separate Competitive Results and Player Development domains, with an optional context view that does not imply causation.

### 2.5 Connected systems and historical issues

- `player_drill_assignments` and `practice_tasks` were separate task paths without guaranteed synchronization.
- Assignment acknowledgement, completion reflection, and follow-up were incomplete.
- Training used a six-dimension 1–10 rubric and normalized 0–100 score, while Daily Evaluation used five dimensions and 0–50.
- A separate nine-dimension Team Ratings model existed and had zero rows at the earlier audit.
- Advanced rubric metadata described 1–10 while some values were multiplied by 10.
- Offline queue/conflict handling was incomplete.
- Tournament scoring was previously considered prototype-level; it must remain isolated from development scoring.
- Advanced rubric slider hitbox was previously about 28px.
- Evolution navigation was buried under mobile “More”.
- No actual Android and desktop visual QA had been completed at that audit.

### 2.6 What the baseline does not prove

The earlier audit does not prove current production row counts, current RLS correctness, current deployment health, or current UI behavior. Evolution Phase Zero must re-check all of these. Do not turn an old audit note into an unverified current-state claim.

---

# Part II — Canonical domain model

## 3. Canonical six-dimension rubric

All player-development evaluations use these six observable dimensions, each rated 0–10.

| Dimension | Measures | Typical evidence |
|---|---|---|
| Communication | Timely, clear, actionable callouts; enemy/location/resource updates | Callout observation, VOD timestamp, IGL note |
| Coordination & Trade Support | Follow-up timing, crossfire support, revive/support coordination, spacing | Round event, teammate observation |
| Decision Making | Fight selection, disengage, resource use, timing, risk judgement | Decision + context + outcome |
| Positioning | Cover use, angles, spacing, high/low ground, exposure, safe repositioning | Map/round observation, VOD timestamp |
| Map Awareness & Rotation | Zone timing, route choice, zone-edge awareness, enemy/third-party awareness, rotation planning | Map, zone phase, route note |
| Role Execution | Execution of the role actually played in that session | Entry, second entry, flank/support, sniper/IGL evidence |

### 3.1 Dimension boundaries

- **Positioning** asks whether the player's location, cover, angle, spacing, and exposure were effective.
- **Map Awareness & Rotation** asks whether the player read the map/zone, information, timing, and route correctly.
- They can influence each other but must be rated independently.
- **Coordination & Trade Support** measures team interaction and timing, not simply whether a teammate got a kill.
- **Communication** measures quality and usefulness of information, not callout volume.
- **Decision Making** measures decision quality in context, not outcome alone.
- **Role Execution** must use the role snapshot for that session, not a mutable current roster label.

### 3.2 Scale semantics

- 0: a fair opportunity was observed and execution was absent/unsuccessful for that dimension.
- 1–3: major improvement needed.
- 4–6: inconsistent / developing.
- 7–8: effective and mostly reliable.
- 9–10: highly effective in the observed context.
- Not observed: no fair opportunity or insufficient evidence; stored as NULL with a reason.
- Negative values and values above 10 are invalid.
- A blank answer is not automatically Not observed. The evaluator must explicitly select a rating or Not observed.
- A deliberate 0 must be distinguishable from missing in the UI, database, exports, and charts.

### 3.3 Evidence quality and fair scoring

Each rating should be supported by one or more of:
- linked session/match and round;
- direct structured observation;
- VOD/clip reference with timestamp where available;
- map/zone phase and relevant context;
- a permitted observer note.

Do not require VOD for every evaluation because the team may not record every match. Instead, require enough contextual evidence to explain why a rating is fair. A dimension marked Not observed must not be treated as a poor performance. A score without sufficient evidence may be saved as a draft or flagged for review, but must not silently enter trusted analytics.

### 3.4 Canonical score calculation

Canonical overall score is a weighted average of valid dimension scores, normalized to 0–100:

`canonical_score_100 = weighted_average(valid_dimension_scores_0_to_10) × 10`

Rules:
- Only rated dimensions contribute to numerator and denominator.
- NULL / Not observed dimensions are excluded from the denominator.
- The role-weight profile and rubric version are stored with the evaluation.
- Weights are normalized over the dimensions actually rated.
- If no dimensions are rated, no score exists.
- If coverage is below the configured minimum, retain the raw observations but show “Insufficient coverage” instead of a headline score.
- Always show coverage beside the score (for example, 4/6 dimensions observed).
- Round only for display; preserve calculation precision in stored derived values or deterministic recomputation.
- Store the scoring-engine version and weight-profile version so historical calculations can be reproduced.
- A later rubric change never rewrites an old score silently.

### 3.5 Coverage, confidence, and comparability

These are separate concepts:
- **Coverage:** proportion/count of dimensions observed in one evaluation.
- **Sample size:** number of eligible evaluations/sessions in the selected period.
- **Confidence:** derived indicator based on sample count, evidence quality, and context consistency; never a claim of statistical certainty unless a documented statistical model supports it.
- **Comparability:** whether two samples share compatible rubric, role, mode, match type, and sufficiently similar context.

A high score with low coverage must not look equivalent to a high score with full coverage. Confidence must not be inferred from the score itself.

### 3.6 Role-aware weights

The session snapshots the role played. Configurable, versioned weights may emphasize:
- Primary Rusher: entry timing, first-contact decisions, cover-to-cover movement, opening-space creation, survival/trade context.
- Secondary Rusher: follow-up timing, trade support, spacing, support utility, coordinated entry.
- Third Rusher / Flanker: flank timing, angle creation, suppression/support, information sharing, safe rejoin timing.
- Sniper / IGL: information quality, callout timing, angle discipline, team rotation decisions, strategic coordination.

Weights change relative importance, never raw rating meaning or range. Do not penalize a sniper for low entry-fragger kill volume. Do not reward a rusher only for kills when the fight decision was poor. Role profiles must be reviewed, versioned, and tested before activation.

### 3.7 Legacy score policy

- Historical 37/50 can be mathematically displayed as 74/100 only with the label **Legacy scale — approximate conversion**. It is not directly equivalent to the new six-dimension model.
- Historical advanced 82/100 is comparable only if it can be proven to use compatible dimensions, weights, and context. Otherwise it remains a separate legacy metric.
- Do not average legacy 37/50 and advanced 82/100 into one number.
- Legacy dimension mapping requires a reviewed crosswalk and provenance. Unknown dimensions remain unknown; do not invent them.
- Old records retain original values and original source IDs.

## 4. Canonical identities, team membership, and session context

### 4.1 Identity rules

- Auth UUID is the internal identity key for authenticated users.
- Team membership is an explicit relationship with status, role, and effective dates.
- Player profile ID, auth user ID, and display IGN must not be conflated.
- Roster labels such as P1/P2/P3/P4 are display/order metadata only, never database identity.
- Display name/IGN can change; historical records must remain linked to stable identity.
- Do not trust user-editable profile metadata for authorization.
- All sensitive operations validate membership and permission on the server.

### 4.2 Session as the shared source of truth

A session is a scrim block, tournament session/event stage, or training session. A session contains:
- team and season;
- type and status;
- start/end time and authoritative team timezone;
- mode, map(s), lobby/event context;
- roster snapshot and each player's role for that session;
- child match records;
- ruleset version where relevant;
- creator and audit metadata.

A six-match scrim block may have one parent session and six child match records. Each evaluation must link to the precise match/round where possible. If it is a manual standalone evaluation, the evaluator must choose a reason and the UI must label it as manual context.

### 4.3 Session and match lifecycle

Recommended session states:
- Draft
- Scheduled
- In Progress
- Awaiting Results
- Results Entered
- Verified
- Closed
- Archived

Only permitted transitions are allowed. Closing a session does not delete it. A correction after verification creates an amendment/version and audit event. Match results must be marked verified before entering official competitive aggregates.

### 4.4 Roster and role snapshots

- Snapshot eligible players and roles when the session begins or when the roster is finalized.
- A later roster edit must not rewrite past session membership or role.
- Substitutions are explicit session roster events with effective match/time.
- A player who did not participate must not receive a session evaluation as if they did.
- Eligibility for peer evaluation is based on the cohort/session snapshot, not today's roster alone.

---

# Part III — Evidence, evaluation, feedback, and peer anonymity

## 5. Evidence architecture

Evidence is a reusable domain object, not free text copied into every module.

Suggested evidence fields:
- ID, team ID, session ID, match ID, optional round ID;
- evidence type (structured observation, note, VOD/clip URL, map/zone event, drill result);
- dimension association(s);
- timestamp/round/zone phase when known;
- observer/creator identity in protected audit fields;
- privacy classification and permitted viewers;
- verification state, source URL metadata, created/updated timestamps.

Rules:
- Evidence belongs to a team/session context and is permission-checked.
- External VOD links may expire; retain source metadata and mark link unavailable rather than deleting the evaluation.
- Do not claim automated game telemetry if the game does not expose it.
- Evidence attached to anonymous peer feedback must be sanitized so it does not identify the evaluator or expose another player's private information.
- A correction does not erase the original observation; create an amendment with reason and actor.

## 6. Daily Evaluation workflow

### 6.1 Default path

1. Evaluator opens Daily Evolution.
2. Selects an existing session/match; session context, team, map/mode, and roster are prefilled.
3. Selects an eligible player from the session roster.
4. The role used in that session is shown and locked unless an authorized correction is made.
5. Evaluator rates each of six dimensions or explicitly selects Not observed with a reason.
6. Adds dimension-linked or overall evidence.
7. Adds separate notes: **Mistakes observed / what went wrong** and **What to improve next**.
8. Preview shows score (if eligible), coverage, context, rubric version, and privacy visibility.
9. Submit commits evaluation, dimension scores, evidence links, feedback, audit event, and outbox events atomically.
10. Player receives permitted feedback and may acknowledge it.
11. Evaluator cannot silently rewrite a submitted evaluation; corrections use an amendment flow.

### 6.2 Manual evaluation path

A standalone/manual evaluation remains available only with a reason. It must not pretend to be linked to a match. It receives a source type such as manual practice observation, and it is labelled as such in trends.

### 6.3 Form and save safeguards

- No default 5s or any default score.
- No hard-coded P1.
- No save until player, context, and every required dimension state are valid.
- Prevent double-submit visually, but rely on server idempotency for correctness.
- A retry uses the same idempotency key for the same intended action.
- If a required child insert fails, the entire transaction rolls back.
- Return the saved canonical record and version to the client.
- Show Pending / Saved / Failed / Conflict states.
- Do not show success until the server confirms commit.
- Offline submission is queued and marked Pending; it is not considered official until server validation succeeds.

## 7. Feedback model

Feedback is a first-class record linked to an evaluation and recipient.

Required concepts:
- recipient;
- author (protected where anonymity applies);
- source evaluation;
- feedback type and visibility;
- mistakes observed;
- improvement focus;
- safe evidence references;
- acknowledgement state;
- created/updated times;
- amendment/moderation state.

Rules:
- Feedback visibility is explicit, not implied by team membership.
- A player may acknowledge feedback; acknowledgement is not agreement.
- A player cannot alter evaluator scores by acknowledging or commenting.
- A player can flag feedback as unclear/inappropriate through a private moderation path.
- Private notes must not leak through broad team-wide queries, exports, notifications, or logs.
- Feedback changes must refresh without requiring a full page reload.
- Feedback and evaluation are committed atomically when they form one submission.

## 8. Anonymous peer evaluation inbox — preserved and strengthened

This section preserves the former Section 16 in full intent and makes the anonymity limits explicit.

### 8.1 Product behavior in Tasks

Tasks has three distinct areas:
- **Feedback Received:** Daily Peer Evaluation cards and other feedback addressed to the signed-in player.
- **Feedback Sent:** the signed-in player's own submissions and their status; only the sender sees their submitted content here.
- **Improvement Tasks:** tasks created from peer feedback, evaluation, weekly review, or coach assignment.

A Daily Peer Evaluation is a feedback/evaluation card type, not itself an improvement task. It links to canonical evaluation records and must not be manually re-entered or duplicated.

### 8.2 No self-evaluation

- Remove the authenticated user's own UUID from the target-player selector before rendering.
- Server/RPC must independently reject `auth.uid() = target_player_id`.
- Validate same team, active eligible cohort, roster snapshot, and session participation.
- Do not rely on UI filtering.
- Test direct API/RPC attempts and stale clients.
- A five-person eligible cohort means each player can review up to four other players. A four-person cohort means three. Expected count is dynamic N−1; never hard-code four.
- No player can submit more than one final review per evaluator-target-cohort, except through an audited correction/amendment process.

### 8.3 Eligibility and cohort rules

A daily review cohort records:
- team;
- server-derived team-local date;
- optional session ID;
- timezone;
- eligible roster snapshot;
- eligibility/excusal decisions;
- cutoff;
- rubric version;
- cohort state.

Eligibility:
- Active participating players are included.
- Absence, excused status, inactive roster, or non-participation must be recorded and excluded from expected counts.
- Roster edits after cohort creation do not rewrite the cohort denominator.
- Date is generated by server using team timezone (Asia/Kolkata default unless configured otherwise).
- No evaluator date picker or client-supplied backdating.
- A player cannot review themselves.
- Eligibility must be frozen at the documented cohort-finalization point; later corrections are append-only and audited.

### 8.4 Strict anonymity contract

Recipient must not receive:
- evaluator name, IGN, avatar, roster slot, role, player code, UUID, email;
- stable pseudonym or persistent reviewer identifier;
- exact submission timestamp;
- author metadata in URLs, filenames, accessibility labels, hidden DOM attributes, analytics, logs, notifications, Realtime payloads, or exports.

The protected server-side mapping may retain the minimum evaluator identity needed for self-rating prevention, duplicate prevention, eligibility, and security audit. It must not be client-readable. Recipient-facing APIs return only sanitized review payloads. Review order must be randomized or non-persistent per recipient/cohort; it must not reveal submission order or let a player track one reviewer across days.

Normal coach/IGL/player screens do not expose evaluator identity. A break-glass security process, if ever required, is outside normal product UI, separately authorized, audited, and not a tool for resolving team arguments.

**Anonymity limitation:** the application can hide account identity and metadata, but cannot guarantee that a reviewer will never be guessed from writing style, incident details, timing, or cohort size. In a two-person cohort, the recipient can infer the only possible reviewer. Small cohorts create high inference risk even if IDs are hidden. The UI must never promise mathematical anonymity.

**Cohort privacy policy:** before enabling anonymous peer reviews, calculate the eligible cohort size and show a privacy notice. The product owner must choose and document a minimum anonymity threshold. Below that threshold, either (a) defer release until the cohort can be safely grouped, (b) collect structured ratings and release only an aggregate, or (c) explicitly label the review as confidential rather than anonymous. Do not display separate anonymous reviewer cards when the cohort makes identity trivially inferable unless the product owner explicitly accepts that limitation and the recipient is warned. This policy must be tested, not left as a vague UI disclaimer.

### 8.5 What recipient sees

Daily Peer Evaluation card:
- title: Daily Peer Evaluation;
- server-assigned team-local date;
- New / Partially received / Complete / Not all received status;
- recipient-only progress, e.g. 3 of 4 anonymous reviews received;
- neutral summary such as “Your feedback is ready” or “Reviews are still coming in”;
- no evaluator identity, initials, avatars, codes, or identifying badge.

Detail screen:
- separate review cards in non-stable order;
- each review's total score where valid and all six dimension scores;
- Not observed visibly distinct from deliberate 0;
- separate Mistakes observed and Improvement focus notes;
- only safe evidence links;
- optional aggregate summary only with sample count and coverage;
- no unexplained merged score;
- no hidden author data in tooltips, accessibility labels, URLs, logs, exports, or filenames.

Card-to-detail navigation should follow the existing Scrims interaction pattern. Returning to the list preserves scroll position.

### 8.6 Completion and missed-review states

- Before cutoff: Collection in progress / Pending.
- After cutoff with fewer than expected: Not all peer reviews received.
- All eligible peers submitted: Complete.
- Excused/ineligible players are excluded from expected denominator.
- Recipient may see their own expected/received count.
- Other teammates see only neutral collection open/closed status; no person-level matrix, reviewer list, missing-player list, or other target's progress count.
- Coaches may see aggregate cohort coverage only, without reviewer identity.
- Private reminders go only to the individual with pending work.
- No public accusation or “Player X failed to review Player Y” event.

### 8.7 Link feedback to tasks

- Create improvement task from a specific dimension or feedback item.
- Internally link evaluation/dimension/evidence IDs.
- Player-facing task title describes the behavior, not the reviewer (for example, “Improve rotation timing”).
- Do not put reviewer code or identity in task metadata returned to the player.
- Player can acknowledge, reflect, practise, and complete.
- Completion never rewrites the original review.
- A later eligible evaluation links as follow-up.
- A private flag/moderation workflow must not reveal evaluator identity.

### 8.8 Data model and constraints

Align with existing schema; do not blindly create duplicates.

Logical entities:
- `daily_review_cohorts`;
- `daily_peer_review_eligibility`;
- protected `daily_peer_review_submissions`;
- recipient-scoped sanitized `daily_peer_review_receipts` or RPC result;
- recipient-scoped `daily_peer_review_status`;
- link from evaluation/dimension feedback to `development_tasks`.

Constraints:
- unique evaluator-target-cohort tuple;
- unique idempotency key within its defined scope;
- evaluator UUID differs from target UUID;
- server validates both users belong to eligible team/cohort;
- one final submission per evaluator-target-cohort;
- amendments append with reason and actor;
- cohort roster snapshot freezes denominator;
- protected evaluator mapping is separate from sanitized receipt content;
- nullable evaluator columns must not be the only duplicate defense.

### 8.9 RLS/API/Realtime privacy

- Recipient read operation returns only the signed-in recipient's sanitized records.
- Revoke direct client SELECT on protected evaluator mapping/submission tables.
- Apply RLS to all exposed tables.
- Views must use security-invoker where supported or be kept in a protected schema with explicit grants.
- Any privileged function requires fixed search_path, strict auth.uid()/team permission validation, minimal EXECUTE grants, and security review.
- Never expose service-role credentials in the browser.
- Notifications contain only safe recipient/cohort/status/event identifiers.
- Realtime event triggers recipient refetch of sanitized data; never render raw author rows.
- Do not expose reviewer identity via error messages, grouped counts, joins, foreign keys, logs, URL query params, or export metadata.
- Test as recipient, evaluator, unrelated teammate, coach/IGL, and unauthenticated user.

### 8.10 Peer review acceptance tests

1. Five-player eligible cohort: each player may review the other four; self-target absent from UI and rejected server-side.
2. Four-player cohort: expected count is three.
3. Two-player cohort: product follows the explicit low-anonymity threshold policy; it does not falsely promise anonymity.
4. Excused/absent player is not counted as missed.
5. Duplicate taps/retries/offline replay produce one final review per target/cohort.
6. Recipient sees sanitized review cards and all six dimensions where allowed.
7. No author identity in API payload, UI, notifications, exports, URLs, logs, accessibility text, hidden DOM, or Realtime.
8. Review order is not submission-time order and has no cross-day stable pseudonym.
9. 0 and Not observed remain distinct.
10. Recipient sees own received count; other teammates cannot see per-person progress.
11. Missed review changes neutral status only.
12. Recipient cannot query protected evaluator mapping.
13. Reviewer cannot read another player's inbox.
14. Improvement task links to dimension/evidence but not evaluator identity.
15. Follow-up evaluation does not rewrite original feedback.
16. Realtime refresh and reconnect work.
17. Small-screen layout has no clipping and has 44–48px effective touch targets.
18. Self-identifying notes are flagged for redaction/moderation under strict mode.

---

# Part IV — Canonical tasks and the complete improvement loop

## 9. One development task system

Do not maintain independent task truths in Planning, Training, Daily Evolution, Weekly Review, or Tasks.

Create one canonical `development_tasks` model and expose filtered views/adapters in each module.

### 9.1 Suggested task fields

- identity: `id, team_id, player_id, created_by`;
- origin: `source_type, source_id, origin_evaluation_id, origin_evidence_id, weekly_review_id`;
- definition: `title, description, target_dimension, role_context, map_context, mode_context`;
- practice: `drill_id, expected_repetitions, duration, success_criteria`;
- workflow: `priority, status, assigned_at, acknowledged_at, due_at, completed_at`;
- outcome: `completion_reflection, completion_evidence_id, follow_up_evaluation_id, outcome_status`;
- integrity: `version, idempotency_key, created_at, updated_at, archived_at`.

### 9.2 Task state machine

Draft → Assigned → Acknowledged → In Progress → Submitted → Verified Complete / Needs Rework → Archived.

- Overdue is a derived flag, not a destructive state.
- Cancelled/reassigned tasks require reason and audit event.
- A player may submit completion; authorized coach/IGL verifies when required.
- Completion is not proof of skill improvement.
- Follow-up evaluation is the evidence of whether the target behavior changed.
- Task status changes use version checks to prevent stale overwrites.

### 9.3 Legacy task migration

- Inventory every caller of `player_drill_assignments` and `practice_tasks`.
- Map fields and statuses before changing schema.
- Reconcile duplicates using source IDs and deterministic rules; ambiguous rows go to manual review.
- Preserve original IDs in a migration mapping table.
- Back up and report row counts before migration.
- Use one-way compatibility adapters/views during transition.
- Never allow both legacy paths and the canonical model to independently mutate the same logical task.
- Do not drop legacy tables until all callers are migrated, data reconciled, rollback window passed, and explicit approval obtained.

### 9.4 Task generation and approval

System may draft suggestions from repeated evidence, but:
- recommendation must cite source evaluations/evidence;
- target dimension and role context must be clear;
- suggested drill must match that dimension and role;
- expected behavior and success criteria must be measurable;
- coach/IGL approval is required before assignment unless an explicitly configured low-risk self-practice flow is approved;
- bulk task generation must be individualized, not identical boilerplate for every player.

### 9.5 Cross-module consistency

A task created from Feedback Received must appear once in canonical Tasks and in relevant Planning/Training views. A task must never be duplicated just because multiple modules display it. Every module reads the same task ID and state.

---

# Part V — Reviews and analytics

## 10. Weekly Review

Weekly Review is a guided review workflow, not a summary widget.

### 10.1 Review period

- Week start/end are computed using team timezone and documented week-start policy.
- UI displays exact date range and timezone.
- Sessions that cross midnight follow session start/team-local policy documented in the session record.
- Late-arriving records are handled by an explicit reopen/amendment policy; published snapshots are not silently rewritten.

### 10.2 Team overview

Show:
- completed scrims/tournament matches/training sessions;
- active roster and participation coverage;
- evaluation coverage and valid sample count;
- six team dimensions where evidence supports them;
- task completion, overdue blockers, follow-up outcomes;
- recurring team patterns and evidence links;
- missing/insufficient data separately.

### 10.3 Player review cards

For each eligible player:
- session role/context;
- valid sample count and coverage;
- six dimension summary;
- recurring strengths and improvement areas;
- source evidence;
- tasks assigned/completed/blocked;
- follow-up result;
- confidence/comparability warning.

Players with no valid observations appear as “Not enough data”, never as 0. They are excluded from score averages.

### 10.4 Review lifecycle

Draft → Coach Review → Approved → Published → Archived.

- Draft can be recalculated from source records.
- Coach review can edit narrative/recommendations, not silently change source scores.
- Published snapshot records source IDs, rubric versions, calculation version, and publication actor/time.
- Published snapshots are immutable; corrections create a new version with reason.
- Archive is non-destructive and searchable.
- Every actionable focus can become a linked development task.

## 11. Player Trends

### 11.1 Views and filters

Separate Player Trends route from Weekly Review while sharing query/service logic.

Filters:
- player;
- role actually played;
- map;
- mode;
- scrim/tournament/training;
- 7-day, 30-day, season, custom date range;
- rubric version and patch context.

### 11.2 Metrics

- canonical overall score;
- six dimension trends;
- consistency derived longitudinally;
- sample count and coverage;
- confidence/data quality;
- task outcomes and follow-up;
- role/context annotations;
- data freshness.

Consistency is not a seventh one-match rating. It is a derived longitudinal metric requiring repeated comparable sessions.

### 11.3 Comparison rules

Default: player against their own previous compatible period.

Optional:
- own season baseline;
- same-role squad median if enough samples and privacy permissions permit;
- team period comparison with roster/mode/map mix controls.

Never compare incompatible rubrics as if identical. Never compare a sniper and rusher on raw kill volume. Show “Not directly comparable” when context differs. A zero delta is neutral. A negative delta is a trend signal, not a negative score.

### 11.4 Determinism

Order by event/session date, created_at, and stable record ID. The same query/version must return reproducible results. Every chart point drills into its evaluation and source session.

## 12. Squad Analytics

Keep two independent domains.

### 12.1 Competitive Results

- match history;
- official placement, eliminations, points, map/mode, tournament stage/event;
- ruleset version and source;
- team/player match statistics with role context;
- verified result state.

Official scoring engine is independent from development scoring. A ruleset change applies to future event records or explicit recalculation versions; it does not silently rewrite historical event snapshots.

### 12.2 Player Development

- six-dimension team profile;
- role coverage;
- communication/coordination/trade-support patterns;
- decision making, positioning, map awareness/rotation, role execution;
- repeated error categories and evidence counts;
- task completion and follow-up success;
- player distribution with missing-data coverage.

### 12.3 Context view

May place competitive outcomes beside development trends to explore relationships. Use “associated with”, not “caused by”. Show sample count, time window, roster and context. Do not merge scales or claim causation from correlation.

### 12.4 Team aggregation rules

- No missing-as-zero.
- No double-counting a player/session.
- State whether average is player-weighted, session-weighted, or role-weighted.
- Display denominator and coverage.
- Exclude disputed/unverified records from official aggregates, but retain them in audit/history.
- Small-sample aggregates are labelled insufficient.

---

# Part VI — Architecture and engineering contracts

## 13. System architecture boundaries

The implementation must use clear layers. Exact folder names can follow the existing app after Evolution Phase Zero, but the responsibilities cannot be blurred.

### 13.1 Domain layer

Owns:
- canonical types/enums;
- rubric definitions and versions;
- scoring and comparability rules;
- state machines;
- validation rules;
- permission concepts.

Must not depend on React components or UI-specific state.

### 13.2 Data-access layer

Owns:
- typed database queries;
- RPC calls;
- query keys/invalidation;
- mapping database rows to domain types;
- error normalization.

Components must not scatter raw Supabase table writes across screens.

### 13.3 Application/use-case layer

Owns workflows:
- create/finalize session;
- submit evaluation;
- receive sanitized peer reviews;
- create/complete task;
- publish weekly review;
- build trends/analytics query.

A workflow coordinates domain validation and data access; it does not duplicate scoring logic.

### 13.4 UI layer

Owns:
- forms, cards, charts, tabs, navigation;
- loading/empty/error/offline states;
- accessibility and responsive layout.

UI may guide input but cannot be the only enforcement point for identity, permissions, score range, anonymity, or duplicate prevention.

### 13.5 Database layer

Owns:
- foreign keys and constraints;
- transaction boundaries;
- authorization/RLS;
- unique/idempotency constraints;
- immutable audit/event records;
- server-authoritative dates and cohort eligibility;
- safe RPC contracts.

Do not move security-critical validation exclusively into frontend code.

## 14. Stable contracts between phases

Before a phase is considered complete, it must publish and freeze these contracts for downstream phases:

1. **Identity contract:** stable IDs, team membership, role permissions, session roster snapshots.
2. **Session contract:** session/match IDs, lifecycle, timezone, roster/role snapshot.
3. **Evidence contract:** evidence IDs, privacy classification, source references.
4. **Rubric contract:** dimension IDs, version, allowed values, Not observed semantics, weights.
5. **Evaluation contract:** evaluation header, dimension scores, context, score calculation version, evidence links.
6. **Feedback contract:** recipient, visibility, notes, acknowledgement, privacy state.
7. **Peer-review contract:** cohort snapshot, eligibility, protected author mapping, sanitized recipient payload.
8. **Task contract:** canonical task ID, state machine, source links, versioning.
9. **Review contract:** week window, immutable snapshot, source manifest.
10. **Analytics contract:** metric definitions, cohort filters, denominator, data freshness, comparability labels.
11. **Sync contract:** idempotency key, entity version, outbox event, retry/conflict semantics.
12. **UI contract:** shared components, navigation, accessibility, responsive behavior, error/empty states.

A downstream phase must consume these contracts. If a contract needs changing, use a versioned migration and compatibility plan; do not silently alter the meaning.

## 15. Database architecture and integrity

### 15.1 Canonical logical entities

Align names to existing schema only after inventory. Suggested entities:
- `teams`, `team_memberships`, `players`;
- `seasons`;
- `sessions`, `session_matches`, `session_roster`, `session_player_roles`;
- `match_results`, `tournament_events`, `scoring_ruleset_versions`;
- `evidence_items`;
- `rubric_versions`, `rubric_dimensions`, `role_weight_profiles`;
- `player_evaluations`, `evaluation_dimension_scores`;
- `player_feedback`;
- `development_tasks`, `task_events`, `task_evidence_links`;
- peer cohort/submission/eligibility/sanitized receipt entities;
- `weekly_reviews`, `weekly_review_snapshots`;
- optional rebuildable `player_trend_snapshots`;
- `audit_log`, `outbox_events`, sync/idempotency records.

Do not create a second table when an equivalent table already exists. Evolution Phase Zero maps existing schema to these logical concepts.

### 15.2 Keys and constraints

- UUIDs for identity.
- Foreign keys for all durable relationships.
- Check constraints for rating ranges, legal states, and self-review prevention.
- Unique idempotency key scoped to actor/action/entity.
- Unique constraints for cohort/evaluator/target.
- Non-null stable actor/dedup key where anonymous submission needs uniqueness.
- Explicit version columns for mutable task/session/review state.
- Append-only audit and amendment events.
- Indexes for team/date/player/session queries and RLS access patterns.
- Avoid storing derived values as a second source of truth unless they include calculation version and can be rebuilt.

### 15.3 Atomic evaluation transaction

A single transaction/RPC should:
1. validate authenticated user and current team membership;
2. validate permission for action;
3. validate target player belongs to team and session/cohort;
4. validate session roster and role snapshot;
5. validate rubric version and dimension values;
6. validate Not observed reason/evidence policy;
7. validate peer self-rating and duplicate rules where applicable;
8. insert evaluation header;
9. insert dimension scores;
10. insert evidence links;
11. insert feedback;
12. insert audit event;
13. insert sanitized outbox event(s);
14. return canonical saved record.

Any required failure rolls back the entire operation. Use a client idempotency key; retries return the original committed result rather than duplicating records.

### 15.4 RLS and authorization

- Enable RLS on every exposed table.
- Team isolation plus role/ownership predicates; `TO authenticated` alone is not authorization.
- Player reads only permitted own records.
- Player cannot edit published evaluation scores.
- Private feedback and peer author mapping use stricter access than general team data.
- Views must not accidentally bypass RLS; use security-invoker where supported or keep views in protected schemas with explicit grants.
- Prefer SECURITY INVOKER. If a narrowly scoped privileged function is unavoidable, keep it in a non-exposed schema, validate auth.uid/team permission, fix search_path, revoke default PUBLIC execute, grant only required roles, and audit it.
- Never expose service-role credentials in browser/client.
- Do not use user-editable auth metadata for authorization decisions.
- UPDATE policies require correct USING and WITH CHECK.
- Test actual access paths, not only policy text.

### 15.5 RPC contracts

Every write RPC must define:
- input schema and version;
- authenticated actor source;
- authorization checks;
- idempotency scope;
- transaction behavior;
- validation errors;
- safe output shape;
- audit/outbox side effects.

Every recipient-facing peer-review RPC must return sanitized fields only. It must not expose evaluator identity through nested JSON, joins, counts, or error details.

## 16. Event, Realtime, and notification architecture

### 16.1 Transactional outbox

A committed domain transaction writes an outbox event in the same transaction. A worker/consumer delivers notifications and refresh signals. This avoids a saved evaluation with a missing notification or a notification for a rolled-back evaluation.

### 16.2 Event names and payload principles

Possible event types:
- session.created / session.verified / session.closed;
- evaluation.submitted / evaluation.amended;
- feedback.received / feedback.acknowledged;
- peer_review.received / peer_cohort.closed;
- task.assigned / task.acknowledged / task.submitted / task.verified;
- weekly_review.published;
- trend_snapshot.invalidated.

Payloads contain only what the receiving client is authorized to know. Peer review events never include evaluator ID, raw author metadata, or raw protected submission rows.

### 16.3 Client refresh behavior

- Realtime is a notification mechanism, not the source of truth.
- Invalidate the relevant query key and refetch authorized data.
- Refetch on reconnect, tab/app focus, and after successful mutation.
- Show stale-data state if subscription fails.
- Do not blindly replace all local state from an event.
- Avoid global counters/timing displays that expose peer-review submission patterns.
- Subscribe only to real columns/tables and correct team/recipient filters.

## 17. Offline-first and conflict model

### 17.1 Local queue

Each queued mutation stores:
- client mutation UUID;
- idempotency key;
- entity type/ID;
- expected entity version;
- payload schema version;
- created time;
- retry count/state.

### 17.2 Sync states

Pending → Syncing → Synced / Conflict / Failed.

- Pending is not official server truth.
- Retry with bounded backoff.
- Preserve queue across app restart.
- Logout must clear or securely isolate sensitive local data according to device/session policy.
- Private feedback is cached locally only if the app has appropriate session protection and cleanup.

### 17.3 Conflict rules

- Submitted evaluations and published reviews are append-only; never last-write-wins overwrite.
- Task edits use optimistic version checks.
- Conflicting changes show the server version and local attempted change; user/authorized role resolves.
- Session roster corrections create audited amendments.
- Peer review retries preserve the original idempotency key and cannot create duplicate submissions.
- Failed writes remain visible and retryable; never silently discard them.

---

# Part VII — Retention, privacy, and data quality

## 18. Retention, archive, export, and zero baseline

### 18.1 Retention

No auto-delete timer for performance source records.

Recommended default:
- evaluations, dimension scores, feedback, evidence metadata, completed tasks, and published weekly snapshots retained for the life of the team unless an authorized owner requests a reviewed deletion;
- VOD binaries stored only when necessary/permitted; keep metadata if external link expires;
- trend caches may be pruned because they are rebuildable;
- audit log append-only with documented retention;
- team deletion requires owner action, confirmation, export option, delayed soft-delete window, and explicit irreversible purge policy.

A retention setting must name exactly which data it affects. It must not silently delete comparison source records.

### 18.2 Clean zero baseline

- New Evolution baseline begins with no fabricated ratings.
- Empty tables mean no data, not numeric zero.
- Earlier audit found two historical daily score rows (0/50 and 37/50 dated 12 Nov 2026); provenance must be rechecked. Quarantine/label as legacy pending review; do not assume random and do not silently delete.
- Earlier audit found zero Team Ratings rows; do not seed examples into production.
- Demo data belongs in a separate demo team/database and must never enter production analytics.
- Before reset/migration: export, reconcile, row-count report, backup, dry run, explicit owner approval for destructive cleanup.

### 18.3 Privacy and access lifecycle

- Data visibility is defined per entity and role.
- Exports apply the same privacy rules as UI.
- Logs must avoid raw private notes and evaluator identity where unnecessary.
- Notifications show minimal safe previews.
- Access revocation must be considered for cached/offline data.
- Moderation flags do not reveal protected author identity to the recipient.
- Data deletion requests require a documented policy that preserves legally/operationally required audit integrity without exposing data to ordinary users.

## 19. Data quality and observability

Build a data-quality monitor before relying on advanced analytics.

Detect:
- evaluation with missing/invalid player/session;
- session roster mismatch;
- duplicate idempotency submissions;
- invalid score range;
- dimension/rubric version mismatch;
- low evidence coverage;
- stale or failed Realtime subscriptions;
- outbox delivery backlog;
- orphaned feedback/task/evidence links;
- duplicate legacy tasks;
- impossible task state transitions;
- weekly snapshot whose source manifest cannot be reproduced;
- peer cohort denominator mismatch;
- unauthorized peer-review payload fields;
- offline queue items stuck beyond threshold.

Every alert must point to a repairable record/process. Do not auto-correct historical scores silently.

---

# Part VIII — UI, navigation, and accessibility

## 20. Premium Squad OS UI contract

Keep the existing premium dark Squad OS design language. Do not add decorative charts or hero blocks that displace useful workflow content.

### 20.1 Evolution navigation

- Four main areas: Daily Evaluation, Weekly Review, Player Trends, Squad Analytics.
- Evolution must be reachable without repeatedly opening mobile “More”; use a dedicated navigation slot or persistent shortcut based on existing nav constraints.
- Keep Tasks feedback and improvement tasks accessible from their existing Tasks area.
- Shared filters/context should be consistent across pages.

### 20.2 Desktop

- Overview with four clear module cards and persistent player/session context.
- Stable left navigation.
- Evaluation workspace may use player list, dimension/evidence form, and feedback/task panel.
- Dense tables must sort/filter without horizontal overflow.
- Competitive and development analytics remain visually distinct.

### 20.3 Android/mobile/tablet

- Mobile one-column cards, sticky action footer, collapsible evidence/notes.
- 44–48px minimum effective touch targets, including sliders, tabs, accordion headers, and action buttons.
- Fix prior 28px slider target.
- No tiny icon-only critical actions.
- Keyboard-aware forms, safe-area insets, no horizontal overflow.
- Preserve scroll position after save, navigation back, and Realtime refresh.
- Ensure player selector, score state, context, and submit status are clear.
- Tablet layout may use two columns only where it preserves readable labels and touch targets.

### 20.4 Component and state consistency

Every data screen defines:
- initial loading skeleton;
- empty/no-data state;
- insufficient sample state;
- stale data state;
- offline pending state;
- permission denied state;
- validation error;
- server failure/retry;
- success/verified state;
- partial collection state where relevant.

Status must not rely on color alone. Use label + icon/text. Use consistent Pending, Synced, Conflict, Needs Review, Verified, Error states.

### 20.5 Peer review UI

- Daily Peer Evaluation card in Tasks → Feedback Received.
- Separate anonymous review detail cards.
- Scores and labels align on narrow screens.
- Not observed is text, not a zero-length bar.
- Notes separate mistakes and improvement focus.
- No identity in hover, hidden DOM, accessibility, URL, filename, or analytics.
- Back navigation restores list scroll.
- Low-cohort privacy warning appears before the player assumes anonymity.

### 20.6 QA honesty

CSS inspection is not device QA. Do not claim responsive correctness until actual viewport and interaction checks are completed on Android-sized, tablet, and desktop layouts. Do not claim pixel-perfect unless screenshot comparison has actually been performed.

---

# Part IX — Safe automation and future capabilities

## 21. Automation permissions

Automate:
- reminders for assigned/overdue tasks;
- draft recommendations from repeated verified evidence;
- weekly review draft generation;
- trend cache invalidation/rebuild;
- follow-up reminders after next eligible session;
- sanitized recipient notifications.

Require authorized human approval for:
- official evaluation submission where evaluator authority applies;
- task assignment/reassignment;
- rubric/weight changes;
- publishing weekly reviews;
- historical score correction;
- session result verification;
- destructive retention/deletion operations.

Never auto-delete evaluations, evidence, feedback, or completed tasks because a timer expired.

## 22. Advanced capabilities — later phases, not first-release dependencies

1. VOD review workspace with clips, timestamps, round tags, dimension-linked annotations, coach/player comments.
2. Map/rotation review with manually captured zone phase, route, cover, and angle observations; no invented telemetry.
3. Patch-aware analytics with game patch/version annotations.
4. Role benchmark library using team-specific history by role/mode/map; no arbitrary “pro” target treated as truth.
5. Repeated-error detection, rules-based first, with source evidence and coach dismissal.
6. Recommendation engine from repeated dimension gaps and role context; human approves assignments.
7. Squad synergy view for trade-support, role coverage, communication/coordination where evidenced.
8. Tournament season reports with immutable snapshots and exports.
9. Coach review queue for pending evaluations, disputed evidence, overdue tasks, and weekly approvals.
10. Advanced CSV/PDF reports with privacy controls.
11. Data-quality monitor.
12. Optional assistive AI to summarize existing notes and suggest candidate drills only. No autonomous scoring, invented events, or unreviewed evaluation changes.

These are not prerequisites for the first working vertical slice. They must consume the same canonical contracts.

---

# Part X — Implementation strategy: every phase becomes the next phase's foundation

## 23. Dependency-first build order

The implementation must be built as a sequence of complete, testable vertical slices. Do not build all screens first and connect data later. Do not build four modules independently and attempt to merge their schemas at the end.

### 23.1 Dependency graph

```text
Evolution Phase Zero: legacy code audit + safe bug fixes + future-phase boundary
                    |
Evolution Phase One: Identity, team membership, timezone
                    |
Evolution Phase Two: Session / match / roster / role snapshot
                    |
Evolution Phase Three: Evidence model + canonical rubric + scoring engine
                    |
Evolution Phase Four: Atomic Daily Evaluation + feedback + audit/outbox
                    |
Evolution Phase Five: Peer-review cohorts + anonymity + recipient inbox
                    |
Evolution Phase Six: Canonical development tasks + drills + follow-up
                    |
Evolution Phase Seven: Weekly Review snapshots and approvals
                    |
Evolution Phase Eight: Player Trends and comparability engine
                    |
Evolution Phase Nine: Squad Analytics (competitive + development domains)
                    |
Evolution Phase Ten: Realtime + offline sync + data quality
                    |
Evolution Phase Eleven: Responsive UI hardening + accessibility + regression QA
                    |
Evolution Phase Twelve: Staging migration + controlled rollout + production verification
```

Security is a separate workstream and is not implemented inside the Evolution phases. Its independent review is a prerequisite before production rollout. Tests, observability, and documentation cross-cut every Evolution phase. The diagram is the dependency order, not a claim that each phase is a separate deploy or that no safe parallel work is possible.

### 23.2 Why this order is mandatory

- Identity must exist before player/session/evaluator relationships can be trusted.
- Session roster and role snapshots must exist before evidence and evaluation can be correctly contextualized.
- Rubric and evidence contracts must exist before score storage and analytics.
- Atomic evaluation must exist before peer inbox or task generation consumes it.
- Peer cohort eligibility depends on team membership, session participation, and server date.
- Tasks depend on feedback/evidence and must be unified before weekly review can count them reliably.
- Weekly snapshots depend on stable evaluations/tasks.
- Trends depend on versioned score and comparability definitions.
- Squad Analytics depends on both the competitive results source and the development domain, but keeps them separate.
- Offline/realtime reliability is designed early but fully validated once workflows exist.
- UI polish is not a substitute for correct domain/data contracts.

## 24. Phase-by-phase implementation contracts and gates

### Evolution Phase Zero — Legacy Fixes

**Inspect:**
- current Git branch, main branch, latest commits, and open PRs;
- app routes/components/hooks and all Evolution/Tasks/Training/Planning/Analytics callers;
- Evolution-related Supabase tables, columns, foreign keys, indexes, constraints, triggers, RPCs, and views;
- current Auth/team membership/roster/attendance/timezone models;
- task tables and migration history;
- score models, rubric metadata, historical rows, and data provenance;
- Vercel build/deployment status and environment separation.

**Deliverables:**
- current-state architecture map;
- table/column/data dictionary;
- read/write path inventory;
- task/rubric legacy mapping;
- row counts and orphan/duplicate report;
- migration/rollback plan;
- list of code paths to preserve.

**Gate:** every current read/write path and source of truth is identified. No production data is deleted or changed.

### Evolution Phase One — Identity, membership, timezone

**Build:**
- stable auth/player/team membership contract;
- team timezone setting and server-side date utilities;
- no P1-as-ID behavior;
- session eligibility primitives;
- permission test helpers.

**Outputs consumed by next phase:** trusted team/player IDs, active membership state, and timezone policy.

**Gate:** tests prove stable player/team identity mapping, active membership is represented consistently, display labels cannot be used as IDs, and date boundaries follow the configured team timezone. Authorization and access-control tests belong to the separate Security workstream.

### Evolution Phase Two — Session, match, roster, and role snapshots

**Build:**
- canonical session and match IDs;
- session lifecycle;
- roster participation snapshot;
- per-match role snapshot and substitution events;
- verified result state;
- links to existing Scrims/Tournament/Training records through adapters where possible.

**Outputs consumed by next phase:** immutable session/match/roster/role context.

**Gate:** every participating player has a stable session role/context; a later roster edit does not rewrite historical session membership.

### Evolution Phase Three — Evidence, rubric, and scoring engine

**Build:**
- evidence item model and privacy classification;
- six canonical dimensions;
- rubric versions and role weights;
- 0–10 semantics, Not observed, coverage, confidence, and score calculation;
- legacy conversion metadata;
- deterministic calculation tests.

**Outputs consumed by next phase:** stable dimension IDs, score API, evidence links, versioned score calculation.

**Gate:** tests prove 0 vs NULL, role weights, partial coverage, invalid ranges, rubric versioning, and reproducible score results.

### Evolution Phase Four — Atomic Daily Evaluation and feedback

**Build:**
- session-first evaluation form;
- manual evaluation with reason;
- no prefilled values;
- atomic save transaction;
- idempotency and duplicate protection;
- evidence/feedback linkage;
- audit amendments;
- private recipient visibility;
- safe outbox event.

**Outputs consumed by next phase:** canonical evaluation/feedback records and safe event contract.

**Gate:** fault-injection tests prove all-or-nothing writes; retries create one record; unauthorized access fails; no score can be submitted from untouched inputs.

### Evolution Phase Five — Peer cohorts and anonymous Feedback Received

**Build:**
- cohort snapshot and eligibility;
- dynamic N−1;
- self-exclusion in UI and server rejection;
- protected author mapping;
- recipient-sanitized receipt RPC/view;
- low-cohort anonymity threshold policy;
- Tasks → Feedback Received card/detail;
- Feedback Sent private to sender;
- privacy-safe progress and missed-review states.

**Outputs consumed by next phase:** safe recipient feedback references that can create tasks without author identity.

**Gate:** access tests and deanonymization checks pass; no identity leak in payloads/logs/URLs/exports; cohort denominator is reproducible.

### Evolution Phase Six — Unified development tasks and follow-up

**Build:**
- legacy task reconciliation;
- canonical task entity/state machine;
- Planning/Training/Tasks/Evolution adapters;
- task acknowledgement, completion, reflection, verification;
- drill links and success criteria;
- evaluation/task/follow-up relationship.

**Outputs consumed by next phase:** one task source of truth with outcome history.

**Gate:** task created in any supported workflow appears once across modules; status/version conflicts are handled; follow-up evaluation links to the correct task.

### Evolution Phase Seven — Weekly Review

**Build:**
- timezone-aware week window;
- evidence coverage and task outcome aggregation;
- individualized draft recommendations;
- coach review/approval/publish;
- immutable snapshot and source manifest.

**Outputs consumed by next phase:** reproducible weekly history and approved review records.

**Gate:** no-data players are not counted as zero; every recommendation traces to evidence; published snapshot is reproducible and corrections create a new version.

### Evolution Phase Eight — Player Trends

**Build:**
- separate route and query layer;
- 7-day/30-day/season/custom filters;
- six dimension trends;
- consistency derivation;
- sample size/coverage/confidence;
- comparability engine;
- event annotations and evidence drill-down.

**Outputs consumed by next phase:** canonical trend metrics with documented denominators and comparability.

**Gate:** incompatible records are blocked or clearly labelled; results are deterministic; every point drills to source.

### Evolution Phase Nine — Squad Analytics

**Build:**
- Competitive Results domain integration;
- Player Development domain integration;
- role coverage and team dimensions;
- recurring team patterns;
- optional context view with correlation caveat.

**Gate:** tournament points cannot alter development score and development score cannot alter official tournament points; all aggregates show sample/coverage.

### Evolution Phase Ten — Realtime, offline sync, and data quality

**Build:**
- transactional outbox delivery;
- authorized subscriptions and query invalidation;
- reconnect/focus refetch;
- durable offline queue;
- idempotent replay;
- conflict UI and resolution;
- data-quality monitor and operational alerts.

**Gate:** reconnect, stale state, duplicate replay, permission revocation, stuck queue, outbox retry, and conflicting task update tests pass.

### Evolution Phase Eleven — UI, accessibility, and regression hardening

**Build/verify:**
- premium dark responsive layout;
- 44–48px effective touch targets;
- Android safe-area/keyboard handling;
- tablet/desktop layout;
- all loading/empty/error/offline/permission states;
- keyboard navigation and screen-reader labels;
- regression tests across Scrims, Tournament, Training, Planning, Tasks, Settings, and Analytics.

**Gate:** actual screenshots and interaction tests at defined viewport sizes; no clipped text, broken navigation, horizontal overflow, or undersized critical controls.

### Evolution Phase Twelve — Controlled rollout

**Build/execute:**
- staging feature flag;
- migration dry run and backup;
- legacy reconciliation report;
- production migration only after Evolution validation and separate Security workstream approval;
- smoke tests and monitoring;
- rollback plan;
- production deployment verification.

**Gate:** data integrity, security, app health, and owner sign-off all pass. Blueprint completion alone is not production completion.

## 25. Vertical-slice rule

Each phase must deliver a usable, tested slice—not just schema or static UI.

A phase is not complete until it has:
1. domain contract;
2. database/API implementation;
3. authorization tests;
4. unit/integration tests;
5. UI workflow where relevant;
6. empty/error/offline states;
7. migration/rollback note;
8. observability and support notes;
9. documented outputs for the next phase;
10. acceptance gate evidence.

Do not start downstream feature implementation on an unstable contract. Small preparatory work may proceed in parallel only if it does not create competing data models or force a premature contract.

---

# Part XI — Full regression and acceptance matrix

## 26. Core data and scoring tests

- New team with zero Evolution records shows no score, not 0.
- Unanswered dimension cannot silently save.
- Deliberate 0 saves and displays as 0.
- Not observed is NULL plus reason and displays distinctly.
- Negative and >10 ratings rejected at UI and database.
- No default 5 values.
- P1 display label never used as database identity.
- Correct UUID resolves after roster load.
- Positioning and Map Awareness rated independently.
- Role weights apply only to normalized score and preserve raw ratings.
- Partial coverage shows count and threshold state.
- Score calculation reproducible by rubric/scoring-engine version.
- Legacy 37/50 and old 82/100 not falsely merged.
- Same-day records order deterministically.

## 27. Session and evidence tests

- Six-match scrim block links child matches to one parent session.
- Evaluation points to exact match/round where available.
- Manual evaluation requires reason and is labelled.
- Session roster changes do not rewrite historical roles.
- Substitute role changes are effective-dated.
- Unverified result excluded from official aggregates.
- Expired VOD link does not delete evaluation metadata.
- Evidence privacy prevents cross-player leakage.

## 28. Evaluation, feedback, and transaction tests

- Atomic evaluation/feedback/evidence transaction rolls back on required insert failure.
- Duplicate taps/retries create one record.
- Offline replay uses same idempotency key.
- Evaluator permission checked server-side.
- Player cannot edit published score.
- Amendment requires reason and creates audit record.
- Feedback appears after save/refetch/Realtime.
- Stale dropped columns are never queried.
- Private feedback inaccessible to unauthorized teammates.

## 29. Peer anonymity tests

Run the full 18 tests in Section 8.10, including N=5, N=4, low-cohort threshold, self-rating, no stable pseudonym, no exact timestamps, no identity in hidden metadata, and recipient-scoped counts.

## 30. Task and follow-up tests

- Legacy task mapping is deterministic and auditable.
- One logical task appears once across modules.
- Invalid state transition rejected.
- Concurrent stale update produces conflict, not overwrite.
- Player completion does not equal verified improvement.
- Follow-up evaluation links to originating task.
- Task source/evidence remains available after archive.
- No duplicate tasks from repeated recommendation generation.

## 31. Weekly, trends, and analytics tests

- No-evaluation player excluded from numeric average.
- Insufficient sample labelled.
- Published weekly snapshot is reproducible.
- Late data uses explicit amendment/reopen policy.
- Trend filters respect team timezone.
- Incompatible rubric/role/mode/match type is blocked or labelled.
- Zero trend delta neutral.
- Chart points open source records.
- Competitive points never affect development score.
- Development scores never affect official tournament points.
- Correlation is not labelled causation.
- Aggregate denominator and coverage are visible.

## 32. Security, offline, and UI tests

- RLS tested as owner, coach/IGL, player, unrelated teammate, and unauthenticated user.
- Views do not bypass RLS.
- Privileged RPC grants and search_path reviewed.
- No service-role secret in client bundle.
- Access revocation invalidates/refuses sensitive fetches.
- Realtime payload contains only permitted fields.
- Outbox retry does not duplicate notifications.
- Offline pending/synced/conflict/failed states work.
- App restart preserves queue safely.
- Android touch targets meet 44–48px effective size.
- Mobile keyboard/safe-area works.
- Tablet/desktop no overflow/clipping.
- Navigation regression across all existing modules passes.
- Loading/empty/error/stale/permission/offline states are present.
- Actual device/browser QA recorded; no unsupported “pixel-perfect” claim.

---

# Part XII — Definition of done, status, and governance

## 33. Definition of done for Evolution Version 2

Evolution Version 2 is complete only when:
- all modules use the same canonical identity/session/evidence/rubric/task contracts;
- Daily Evaluation is six-dimension, evidence-linked, atomic, and permission-safe;
- anonymous peer feedback works within a truthful cohort privacy policy;
- feedback and tasks form one traceable improvement loop;
- Weekly Review has approved immutable snapshots;
- Player Trends are contextual and reproducible;
- Squad Analytics separates competitive results from player development;
- legacy scoring/task systems are reconciled or explicitly labelled legacy;
- zero, missing, and Not observed are handled correctly;
- no fabricated production data exists;
- retention preserves comparison source records;
- RLS, idempotency, atomic writes, Realtime, offline conflict behavior, and privacy tests pass;
- Android, tablet, and desktop UI are actually tested;
- migration and production deployment are verified independently;
- rollback and monitoring are ready.

## 34. Current status versus target

This table preserves the earlier audit's status. Evolution Phase Zero revalidates the existing implementation and fixes safe legacy defects; future feature builds remain assigned to their named phases.

| Area | Previously observed baseline | Version 2 target |
|---|---|---|
| Daily Evaluation | Implemented, five dimensions/0–50, save/data defects | Six dimensions, evidence-linked, atomic |
| Weekly Review | Partial insight component | Full review, approval, immutable snapshots |
| Player Trends | Partial latest-two comparison | Longitudinal dimension trends and comparability |
| Squad Analytics | Competitive match analytics | Separate competitive and development domains |
| Scrim/Tournament link | Match data exists; Evolution linkage incomplete | Shared session/match/evidence source |
| Tasks | Two task paths; sync incomplete | One canonical development task model |
| Feedback | Separate feedback path; refresh/privacy incomplete | Private feedback, acknowledgement, safe Realtime |
| Peer reviews | Requirements specified; implementation not verified | Dynamic N−1, self-rating blocked, sanitized inbox |
| Scoring | Multiple incompatible scales | One versioned canonical rubric |
| Retention | Complete policy not verified | No automatic deletion of source performance data |
| Offline | Partial/absent conflict handling | Durable queue, idempotency, conflict resolution |
| Mobile/desktop QA | CSS inspection; actual device/browser QA incomplete | Verified responsive interaction QA |

## 35. Ten consolidated problem groups — preserved

These are the ten consolidated groups recoverable from prior Evolution reviews, not a claim that every older chat used identical numbering.

1. **Wrong player identity / P1 default:** authenticated roster UUID, no hard-coded display-label ID.
2. **Fabricated default scores:** unanswered inputs, no default 5, deliberate rating or Not observed.
3. **Duplicate anonymous submissions:** idempotency and non-null deduplication identity/token.
4. **Partial score/feedback writes:** one transaction/RPC and all-or-nothing commit.
5. **Stale Realtime query/feedback refresh:** valid columns, feedback subscriptions, invalidation/refetch.
6. **Timezone/date mismatch:** authoritative team timezone and server-derived date.
7. **Missing data treated as zero:** valid observation aggregation, coverage, insufficient-data states.
8. **Weak trend comparison:** separate Weekly Review/Trends, dimension trends, deterministic ordering, context filters, neutral zero delta.
9. **Disconnected task workflows:** one canonical task, notification, acknowledgement, completion, reflection, follow-up.
10. **Analytics/rubric fragmentation:** versioned six-dimension rubric, role-aware weights, competitive/development separation, session evidence.

Additional QA issues remain in scope: Positioning vs Map Awareness; rubric scale mismatch; confidence/coverage; generic bulk tasks; offline conflict handling; evidence drill-down; small slider hitbox; mobile navigation; shared Weekly Review/Trends component; and missing actual device/browser QA.

## 36. Governance and change control

- Keep the blueprint name and path: `docs/evolution-version-2.md`.
- This document is the master specification; implementation tickets/PRs reference section numbers rather than creating competing specs.
- Every requirement gets an ID in implementation tracking (for example EV2-DATA-001, EV2-PRIV-001) and links to tests.
- A requirement is not complete because UI exists; it must pass its acceptance gate.
- Schema/API contract changes require versioning, migration notes, compatibility impact, and test updates.
- Do not silently drop a requirement. If a requirement is infeasible or conflicts with another, document the conflict and decision in this same blueprint with rationale.
- No destructive migration, production reset, branch merge, or production deployment occurs merely because this blueprint is updated.
- The owner approves rollout after staging evidence and rollback readiness.

## 37. Scope boundary and next action

This document is the **Evolution Version 2 master blueprint**. This rewrite changes documentation only. It does not implement features, modify Supabase tables/data, reset production data, run migrations, merge the documentation branch, or deploy the app.

**Next implementation action:** complete Evolution Phase Zero — Legacy Fixes against the actual current repository and live Evolution data. Repair existing Evolution regressions, preserve historical records, and clearly mark incomplete future modules without building their planned functionality. Then begin Evolution Phase One for stable identity, team membership, and timezone. Authorization/RLS/grants and security hardening remain in the separate Security workstream.

---

# Appendix A — Requirement preservation checklist

The following original requirements remain explicitly represented in this rewrite:

- Connected player-development system and complete session-to-improvement loop.
- Existing implementation audit and all previously observed defects.
- Six canonical dimensions and separate Positioning/Map Awareness.
- 0–10 scale, zero vs missing, Not observed, no negative ratings.
- Versioned role-aware weighted 0–100 scoring.
- Legacy 37/50 and advanced 82/100 caution.
- Daily Evaluation workflow and atomic writes.
- Weekly Review workflow and immutable snapshots.
- Player Trends with 7/30/season/custom periods and comparability.
- Squad Analytics with separate competitive/development domains.
- Scrims, tournament matches, training, drills, and Planning integration.
- One canonical development task system and legacy task migration.
- Feedback sent/received, acknowledgement, notification, and follow-up.
- Anonymous Daily Peer Evaluation card in Tasks → Feedback Received.
- Dynamic N−1 peer review eligibility and no self-evaluation.
- Protected evaluator mapping, sanitized recipient response, privacy-safe progress.
- Anonymous review dimension scores and separate mistake/improvement notes.
- Low-cohort anonymity limitation and privacy threshold.
- Data architecture, atomic transaction, RLS, RPC, Realtime, outbox, offline sync.
- Retention, archive, export, zero baseline, historical row caution.
- Ten consolidated problem groups and all additional QA issues.
- Premium dark UI, Android/mobile/tablet/desktop, touch targets, accessibility.
- VOD, map/rotation, patch-aware, benchmarks, repeated-error, recommendation, synergy, reports, coach queue, data quality, assistive AI future capabilities.
- Implementation phases, acceptance gates, full regression test matrix, definition of done, status table, and scope boundary.

# Appendix B — Implementation discipline

For every phase, maintain:
- a phase checklist;
- a contract/version note;
- a migration and rollback note;
- automated test results;
- manual QA evidence where relevant;
- unresolved risks;
- explicit next-phase dependencies.

A phase handoff must answer:
1. What exact data contract now exists?
2. Which APIs/RPCs are authoritative?
3. Which roles can read/write each record?
4. What is the failure/retry behavior?
5. What test evidence proves the gate?
6. What does the next phase consume without rebuilding?
7. What legacy paths remain and how are they prevented from becoming a second source of truth?

If any answer is unknown, the phase is not ready to hand off.
