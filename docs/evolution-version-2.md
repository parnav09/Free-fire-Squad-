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

## Workflow-first product map — authoritative page order

Evolution Version 2 uses one Evaluation workspace with four entry cards arranged as a two-column by two-row grid. Each card opens its own detail page. This is one connected workflow, not four disconnected data systems.

| Order | Evaluation card / page | Purpose |
|---|---|---|
| 1 | **Daily Evaluation** | Select other active teammates and submit today's peer evaluations. The signed-in evaluator is never selectable. |
| 2 | **Weekly Team Review** | Each eligible active member submits one team-level review for the current week using nine team dimensions. This is separate from the coach-led **Weekly Review** snapshot. |
| 3 | **Matches Evaluation** | Evaluate a selected match from either Scrims or Tournament, using its existing canonical match/session ID. |
| 4 | **Evaluation Activity** | Show completion and pending work. The Daily Pending Tracker shows overdue evaluator → target pairs only after a 24-hour grace period, then removes each visible item after a further 24 hours. It never shows scores or private feedback. |

### Workflow sequence

1. Open **Evolution → Evaluation** and see the four cards in the order above.
2. Open **Daily Evaluation**; today's date is supplied automatically by the existing server-side date contract. No date picker or backdated submission is available.
3. Select eligible teammates. The current user's own player record is excluded before rendering and rejected again by the server.
4. Complete the required dimensions and private feedback for each selected teammate; save each evaluator-target assignment idempotently.
5. The system tracks expected, submitted, and pending assignments. After 24 hours without submission, the exact evaluator → target pair enters Evaluation Activity for the next 24 hours.
6. Open **Weekly Team Review** to submit the current week's team-level review.
7. Open **Matches Evaluation** and choose a match from Scrims or Tournament.
8. Open **Evaluation Activity** to see workflow status and the temporary Daily Pending Tracker.

**Privacy boundary:** the temporary overdue tracker is a narrow accountability exception. It may show only evaluator name/slot, target name/slot, evaluation date, and Pending status during its 24-hour display window. It must not show submitted scores, dimension ratings, written feedback, or reviewer identity attached to completed anonymous feedback.

**Expiry boundary:** expiry removes the item from the visible tracker; it does not delete the original evaluation, feedback, assignment/audit provenance, or historical source records. This is a work-queue expiry, not destructive data retention.

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

> **Daily Evaluation selector rule:** the current evaluator is excluded from the target list at render time and rejected server-side. Each eligible evaluator-target pair has its own stable assignment ID. The date is automatic/read-only under the existing date contract; no date picker, backdating, or timezone redesign is part of this change.

### 6.1 Default path

1. Evaluator opens **Evolution → Evaluation → Daily Evaluation**.
2. Selects an existing session/match where applicable; session context, team, map/mode, and roster are prefilled.
3. The server supplies today's date using the existing date/time contract. The page has no date picker and rejects client-supplied past/future dates.
4. The eligible active teammate list is loaded from the daily cohort. The signed-in evaluator's own UUID is excluded from the selector; the server independently rejects self-target attempts.
5. Evaluator selects each teammate to review. Every evaluator-target pair receives its own stable assignment ID and idempotency key; one teammate's submission cannot mark another target complete.
6. The role/context used in the linked session is shown from the roster snapshot where applicable.
7. Evaluator rates each canonical rubric dimension or explicitly selects Not observed with a reason.
8. Adds permitted evidence and separate private notes: **Mistakes observed / what went wrong** and **What to improve next**.
9. Preview shows the evaluator's own entered values and a visibility notice. Numeric ratings are not exposed to other players through the team activity tracker or recipient feedback view.
10. Submit commits the evaluation, scores, evidence links, feedback, audit event, and outbox events atomically.
11. The recipient receives only sanitized feedback permitted by the anonymity/privacy policy. The evaluator can see their own submission status.
12. The assignment changes to Complete only after the server confirms commit. A retry reuses the same idempotency key.
13. Evaluator cannot silently rewrite a submitted evaluation; corrections use an audited amendment flow.

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

### 6.4 Daily assignment lifecycle

- For N eligible active players, each evaluator has N−1 target assignments. A five-player cohort therefore has four targets per evaluator and twenty directed assignments in total.
- Create one stable UUID per team + evaluation date + evaluator + target. Enforce uniqueness and idempotency server-side.
- Do not generate self-pairs. A self-target must never flash in the selector during loading.
- A completed assignment is marked Complete only after the server confirms the atomic save.
- Numeric ratings remain private; team-wide activity displays workflow status only.

### 6.5 Daily Pending Tracker — 24-hour grace + 24-hour visibility

- The first 24 hours after the daily evaluation window begins are the grace period. Unsubmitted assignments remain ordinary Pending and are not listed in the overdue tracker.
- If still unsubmitted after 24 hours, show the exact outstanding pair in **Evaluation → Evaluation Activity → Daily Pending Tracker**, e.g. **Player 1 → Player 4 — Pending**.
- Show only evaluator, target, evaluation date, and Pending status. Do not show scores, dimension ratings, or feedback.
- Keep the row visible for the following 24 hours. If the evaluator completes the assignment during this window, remove it immediately.
- If still incomplete, automatically remove it from the visible tracker at the end of that second 24-hour window. Do not carry it into the next day's list.
- Generate each day's cohort independently; yesterday's pending item never blocks today's assignments.
- Use server timestamps and status, not a client/device timer. Reconcile expiry on page load/focus as well as Realtime updates.
- Expiry hides only the tracker item. Preserve the underlying assignment/audit record and all submitted source records.
- Tests must cover the 24h grace boundary, the second 24h expiry boundary, completion during the visible window, no carry-forward, and no self-pairs.

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
- separate sanitized feedback cards in non-stable order;
- **Mistakes observed / what went wrong** and **What to improve next** notes;
- only safe evidence links;
- no evaluator identity, numeric rating, dimension score, or reviewer-linked score summary visible to the recipient or other players;
- no hidden author data in tooltips, accessibility labels, URLs, logs, exports, or filenames.
- Any future aggregate requires separate approval, cohort-safe thresholds, and must not reveal an individual evaluator's rating.

### 8.6 Completion states and overdue-tracker exception

- Before the first 24-hour grace period ends: Collection in progress / Pending.
- If every expected assignment is submitted: Complete.
- Excused/ineligible players are excluded from the expected denominator.
- Each evaluator can see their own outgoing assignment status; each recipient can see only their own sanitized feedback availability.
- **Evaluation Activity → Daily Pending Tracker** is the sole exception to the general no-person-level-progress rule: after the first 24 hours, it may show the exact outstanding evaluator → target pair for the next 24 hours, as specified in Section 6.5.
- The tracker shows only unsubmitted assignments. It never shows completed reviewer-target pairs, scores, dimensions, or feedback.
- At the end of the second 24-hour window, the item automatically disappears from the visible tracker and is not carried into the next day's cohort.
- Private reminders may go to the individual evaluator with pending work.
- Do not create a public blame notification or expose any submitted feedback author.

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

## 10A. Weekly Team Review — member-submitted team evaluation

This is a separate page inside the four-card Evaluation workspace. It must not be confused with Section 10's coach-led **Weekly Review**, which produces player-development summaries and immutable review snapshots.

### 10A.1 Submission model

- Each eligible active team member submits one team-level review for the current week.
- The form evaluates the team's performance as a unit, not one teammate against another.
- The review period is selected automatically as the current week under the existing date/week policy; users cannot backdate a submission.
- The page displays the week range and the member's submission state.
- A member can edit only an unsubmitted draft. A submitted review is immutable except through an audited correction process.
- Team-wide completion status may show which members have submitted and which remain Pending. It must not expose private narrative or numeric ratings to ordinary teammates unless a separately approved permission policy allows it.

### 10A.2 Canonical team dimensions

Use the existing nine-dimension team-review model where it matches the current database contract; map to existing fields before adding schema. Do not create duplicate parallel ratings if the existing team-ratings table already represents these dimensions.

1. Team Communication
2. Coordination & Trade Support
3. IGL Decision Making
4. Rotation & Zone Control
5. Role Balance & Execution
6. Fight Selection
7. Survival & Placement Management
8. Utility Management
9. Match Consistency & Replay Improvement

### 10A.3 Completion and history

- One expected submission per eligible active member per team-week.
- The activity view shows Submitted / Pending and the week identifier.
- Previous weeks remain available as history according to existing read permissions.
- A new week creates a new review period; no prior submission is silently copied forward.
- Missing submissions remain missing, not zero.
- Aggregate team results require a documented denominator and minimum sample; do not expose an individual member's rating by inference.

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

### 12.5 Matches Evaluation — Scrims and Tournament

- The Evaluation workspace page is named **Matches Evaluation**, not Tournament Evaluation.
- The user selects a match from either the existing Scrims match list or Tournament match list.
- The selected record retains its original canonical session/match ID, event type, date, map/mode, roster snapshot, and result-verification state.
- Do not create a duplicate match table or a second match identity just for Evaluation.
- A match evaluation is linked to the exact selected match and participating roster. Non-participants cannot be evaluated as match participants.
- Competitive placement/elimination points remain in the Competitive Results domain and never become development scores.
- Scrims and Tournament filters must be explicit so users know which match source they selected.
- The same match cannot receive duplicate final evaluation submissions for the same evaluator/purpose; enforce idempotency and audited amendments.
- The 24h + 24h expiry rule applies only to the Daily Pending Tracker.

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

### 20.1A Cross-device UI contract — Laptop, Tablet, Mobile

The complete Evolution and Evaluation experience must remain available and usable on all three device classes. Responsive behavior may rearrange spacing and component sizing, but must not remove features, hide required information, or change workflow behavior.

- **Laptop / desktop:** preserve the full page composition, clear hierarchy, comfortable content width, and the four Evaluation cards in a two-column × two-row grid.
- **Tablet:** adapt card width, gutters, typography, and detail-page layout to the available viewport. Keep all four cards and all controls available without clipping or horizontal page overflow.
- **Mobile:** retain the four Evaluation cards in a compact two-column × two-row grid as requested. Use readable labels, sufficiently large touch targets, and vertical scrolling for long detail pages. Do not force desktop-width tables or forms onto the screen.
- The four-card order and labels remain identical on every device: **Daily Evaluation**, **Weekly Team Review**, **Matches Evaluation**, **Evaluation Activity**.
- Detail pages must preserve all fields, statuses, privacy notices, validation messages, and actions on every viewport. If a dense table cannot fit, convert it to stacked responsive rows/cards without dropping columns or information.
- Dialogs, selectors, date labels, feedback fields, status indicators, and navigation must remain operable by touch, mouse, and keyboard as applicable.
- No feature may be mobile-only, tablet-only, or desktop-only unless a separately approved product requirement says so.
- Use responsive CSS/layout breakpoints based on available viewport width, not device-brand detection. Support portrait and landscape orientation.
- Prevent clipped cards, overlapping text, inaccessible dropdown menus, off-screen primary actions, accidental horizontal scrolling, and hover-only interactions.
- Keep existing visual identity and interaction patterns; responsive work must not introduce an unrelated redesign.
- **Acceptance gate:** verify the complete Evaluation flow and the surrounding Evolution navigation at representative laptop, tablet, and mobile viewport sizes, in both portrait and landscape where applicable. Check card grid, detail navigation, selector self-exclusion, forms, pending tracker, scroll behavior, and touch target usability. Capture screenshots or visual regression evidence for each device class before rollout.

### 20.1 Evolution navigation and Evaluation workspace

- Evolution is reachable without repeatedly opening mobile “More”; use a dedicated navigation slot or persistent shortcut based on existing nav constraints.
- The Evaluation landing page contains exactly four entry cards in a two-column × two-row grid, in this order: **Daily Evaluation**, **Weekly Team Review**, **Matches Evaluation**, **Evaluation Activity**.
- Each card opens its own detail page; a clear back path returns to the Evaluation landing page without losing relevant context.
- **Daily Evaluation** handles today's evaluator-to-teammate submissions and self-exclusion.
- **Weekly Team Review** handles each member's team-level weekly submission; it is not the coach-led Weekly Review.
- **Matches Evaluation** allows match selection from both Scrims and Tournament.
- **Evaluation Activity** contains completion states and the 24h-grace/24h-display Daily Pending Tracker.
- The four cards are separate workflows over shared canonical records, not four duplicated data stores.
- Existing **Weekly Review**, **Player Trends**, and **Squad Analytics** remain separate Evolution destinations and retain their prior scope.
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
Evolution Phase Zero: legacy code/schema audit + safe bug fixes + preserve existing workflows
                    |
Evolution Phase One: identity + active membership + existing date contract (no timezone redesign)
                    |
Evolution Phase Two: session / match / roster / role snapshots for Scrims and Tournament
                    |
Evolution Phase Three: evidence + canonical rubric + scoring/privacy contracts
                    |
Evolution Phase Four: Daily Evaluation form + atomic save + self-exclusion + stable N−1 assignments
                    |
Evolution Phase Five: anonymous recipient feedback + protected author mapping
                    |
Evolution Phase Five-B: Evaluation Activity + 24h grace / 24h visible Daily Pending Tracker
                    |
Evolution Phase Five-C: Matches Evaluation using existing Scrims/Tournament match IDs
                    |
Evolution Phase Six: canonical development tasks + drills + follow-up
                    |
Evolution Phase Seven-A: Weekly Team Review (member-submitted nine-dimension team review)
                    |
Evolution Phase Seven-B: coach-led Weekly Review snapshots and approvals
                    |
Evolution Phase Eight: Player Trends and comparability engine
                    |
Evolution Phase Nine: Squad Analytics (competitive + development domains)
                    |
Evolution Phase Ten: Realtime + offline sync + data quality
                    |
Evolution Phase Eleven: Evaluation four-card navigation + responsive UI + accessibility + regression QA
                    |
Evolution Phase Twelve: staging migration + controlled rollout + production verification
```

Security remains a separate workstream and its independent review is a prerequisite before production rollout. Tests, observability, and documentation cross-cut every phase. This sequence describes dependencies and page/workflow order; it does not authorize a production migration, merge, or deployment.

### 23.2 Why this order is mandatory

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

### Evolution Phase Five-B — Evaluation Activity and Daily Pending Tracker

**Build:**
- the fourth Evaluation workspace page and its activity summary;
- expected evaluator-target assignment status from the daily cohort;
- exact evaluator → target pending row, visible only after the first 24-hour grace period;
- automatic removal from the visible tracker after the next 24 hours;
- immediate removal from the pending list when the evaluator completes the assignment;
- no carry-forward into the next daily cohort;
- server-time expiry and refresh/reconnect behavior.

**Outputs consumed by next phase:** a reliable, expiring workflow-status view that does not expose scores or feedback.

**Gate:** tests prove the 24h grace boundary, 24h visibility boundary, completion during the visible window, automatic expiry, no self-pairs, no score/feedback leakage, and preservation of underlying audit records.

### Evolution Phase Five-C — Matches Evaluation

**Build:**
- the Matches Evaluation page;
- selection adapters for existing Scrims and Tournament matches;
- canonical match/session/roster links;
- per-match evaluation completion state and duplicate protection.

**Outputs consumed by next phase:** match-linked evaluation records over existing match identities.

**Gate:** a Scrims match and a Tournament match can each be evaluated without creating duplicate match identities or mixing competitive points into development ratings.

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

### Evolution Phase Seven-A — Weekly Team Review

**Build:**
- member-submitted weekly team review page;
- current-week-only submission window using the existing date policy;
- nine team dimensions mapped to the existing team-ratings contract where possible;
- one expected submission per eligible active member per team-week;
- Submitted/Pending completion status and historical week access.

**Outputs consumed by next phase:** versioned weekly team review records and safe completion coverage.

**Gate:** tests prove one submission per eligible member/week, no backdating, no duplicate rating model, missing is not zero, and private ratings/narratives are not exposed through the completion tracker.

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

## 34A. Phase-wise implementation and acceptance status ledger

**Status legend**

- **Implemented:** confirmed present in the earlier code audit; not a claim of current production verification.
- **Partial:** a related page/model/path exists, but required workflow or correctness conditions are incomplete.
- **Not Implemented:** no implementation was established in the referenced audit.
- **Not Verified:** current branch/live database/deployment evidence has not been freshly checked.
- **Gate: PASS** is allowed only when the phase's acceptance evidence is recorded. A feature being visible in the UI is not a pass.
- **Gate: NOT PASSED** means known required work remains. **Test result: NOT RUN / NOT VERIFIED** means no current test run is being claimed.

**Evidence baseline:** the statuses below are conservative classifications from the static code-audit reference recorded at the top of this blueprint. They are not a fresh audit of the current branch, live Supabase database, or Vercel production deployment. Phase Zero must refresh this ledger before implementation begins.

| Phase | Workflow / deliverable | App implementation status | Acceptance gate | Evidence / remaining work |
|---|---|---|---|---|
| Zero | Existing Evolution code, schema, RLS, RPC, migrations, deployment and data audit | **Partial** | **NOT PASSED · Not Verified** | Earlier static audit exists; fresh branch/live-schema/deployment inventory, provenance reconciliation and full read/write map remain. No destructive changes. |
| One | Auth UUID ↔ player ↔ team membership identity | **Partial** | **NOT PASSED · Not Verified** | Auth/team/roster structures exist; old P1-as-ID issue and membership contract need revalidation and repair. |
| One | Current server-side date contract | **Partial** | **NOT PASSED · Not Verified** | Earlier Asia/Kolkata database date enforcement exists. Preserve the existing contract; no timezone redesign. Verify all clients/RPCs use it consistently. |
| Two | Existing Scrims/Tournament session and match identity adapters | **Partial** | **NOT PASSED · Not Verified** | Competitive match records exist; complete canonical Evolution linkage was not established. |
| Two | Immutable session roster, participation and per-match role snapshots | **Not Implemented / Not Verified** | **NOT PASSED · Not Tested** | Must be proven against existing schema before adding anything; historical roles must not change with current roster edits. |
| Two | Verified match result and substitution/amendment history | **Partial / Not Verified** | **NOT PASSED · Not Tested** | Existing match/result workflows exist; canonical verified-state and audit linkage remain to be checked. |
| Three | Six-dimension canonical rubric and separate Positioning dimension | **Partial** | **NOT PASSED · Known mismatch** | Training's six-dimension rubric existed; Daily Evaluation used five dimensions. Reconcile without silently remapping history. |
| Three | Rubric versions, role weights, 0-vs-NULL, Not observed, coverage and confidence | **Partial / Not Implemented** | **NOT PASSED · Not Tested** | Existing rubric metadata was inconsistent; versioned scoring/coverage/confidence contract needs implementation and deterministic tests. |
| Three | Evidence records linked to session/match/round | **Partial** | **NOT PASSED · Not Verified** | Evidence linkage was weak; complete evidence model and privacy tests remain. |
| Four | Daily Evaluation page and basic five-dimension form | **Implemented (legacy form)** | **NOT PASSED** | Existing page/form and 0–50 display were observed. It is not the Version 2 six-dimension workflow. |
| Four | No prefilled scores; deliberate 0 vs unanswered / Not observed | **Not Implemented / Defective** | **NOT PASSED · Known defect** | Earlier form defaulted sliders to 5; untouched forms could produce a score. |
| Four | Correct Auth UUID target, atomic score + feedback + evidence save | **Partial / Not Implemented** | **NOT PASSED · Known gaps** | P1 default identity issue and separate score/feedback writes were observed; transactional RPC and idempotency need proof. |
| Four | Stable evaluator → target N−1 assignments; self-exclusion in UI and server | **Not Implemented / Not Verified** | **NOT PASSED · Not Tested** | Dynamic cohort assignments, unique keys, server-side self-target rejection and retry tests remain. |
| Five | Anonymous peer-feedback source and recipient feedback path | **Partial** | **NOT PASSED · Not Verified** | Separate feedback table/path existed; complete cohort eligibility, protected author mapping, sanitized receipt and deanonymization testing were not verified. |
| Five | Feedback Sent / Feedback Received, low-cohort privacy threshold | **Not Implemented / Not Verified** | **NOT PASSED · Not Tested** | Full inbox, cohort threshold, metadata/log/export protection and recipient-scoped views remain. |
| Five-B | Evaluation Activity landing/detail page and workflow summary | **Not Implemented** | **NOT PASSED · Not Tested** | New workflow page required. |
| Five-B | Daily Pending Tracker: 24h grace + next 24h visibility + immediate completion removal | **Not Implemented** | **NOT PASSED · Not Tested** | Server-time boundaries, exact evaluator → target pending pair, no score/feedback leakage, no next-day carry-forward and non-destructive expiry remain. |
| Five-C | Matches Evaluation from existing Scrims and Tournament records | **Not Implemented** | **NOT PASSED · Not Tested** | New page/adapters and duplicate protection required; must reuse canonical match/session IDs. |
| Six | One canonical development task model across Planning/Training/Tasks/Evolution | **Partial** | **NOT PASSED · Known gap** | Two task paths existed without guaranteed synchronization. |
| Six | Acknowledge → complete → reflect → verify → follow-up evaluation | **Partial / Not Implemented** | **NOT PASSED · Not Tested** | Full state machine, conflict handling, drill criteria and evaluation linkage remain. |
| Seven-A | Member-submitted Weekly Team Review page | **Not Implemented** | **NOT PASSED · Not Tested** | Separate nine-dimension member workflow is new. |
| Seven-A | One submission per eligible member/team/week; Submitted/Pending and history | **Not Implemented** | **NOT PASSED · Not Tested** | Current-week-only eligibility, uniqueness, privacy-safe status and history remain. Existing team_ratings model is a reuse candidate, not proof of implementation. |
| Seven-B | Coach-led Weekly Review insights | **Partial** | **NOT PASSED** | Combined weekly insight component existed; review lifecycle was incomplete. |
| Seven-B | Evidence-backed recommendations, coach approval and immutable published snapshot | **Not Implemented / Partial** | **NOT PASSED · Not Tested** | Draft/review/publish lifecycle, source manifest, no-data handling and reproducibility remain. |
| Eight | Player Trends page and latest/previous comparison | **Partial** | **NOT PASSED** | Basic latest-versus-previous and recent average existed. |
| Eight | 7/30/season/custom filters, six dimension trends, confidence and comparability | **Not Implemented / Partial** | **NOT PASSED · Not Tested** | Context-aware trend engine, sample coverage, deterministic ordering and evidence drill-down remain. |
| Nine | Competitive match analytics | **Implemented (legacy competitive domain)** | **NOT A VERSION 2 PASS** | Matches/points/placements/kills analytics existed. |
| Nine | Unified development analytics while keeping competitive and development scores separate | **Not Implemented / Partial** | **NOT PASSED · Not Tested** | Development aggregates, role coverage and separation/correlation safeguards remain. |
| Ten | Realtime subscriptions and basic refresh paths | **Partial** | **NOT PASSED · Known gaps** | Subscriptions existed; stale-column reference and feedback refresh gaps were observed. Revalidate current subscriptions and authorization. |
| Ten | Durable offline queue, idempotent replay, conflict resolution and outbox | **Not Implemented / Partial** | **NOT PASSED · Not Tested** | Offline conflict handling was incomplete; durable queue/outbox/monitoring need implementation and tests. |
| Ten | Data-quality monitor and operational alerts | **Not Implemented** | **NOT PASSED · Not Tested** | Orphan, duplicate, stale subscription, outbox and provenance monitors remain. |
| Eleven | Existing premium dark UI and legacy Evolution screens | **Partial / Implemented by area** | **NOT A VERSION 2 PASS** | Existing UI exists, but Evolution navigation was buried and some controls/layout issues were observed. |
| Eleven | Four Evaluation cards, 2×2 grid, each with its own detail page | **Not Implemented** | **NOT PASSED · Not Tested** | Blueprint requirement only; implementation not established by the audit. |
| Eleven | Responsive Laptop + Tablet + Mobile behavior, including requested mobile 2×2 card grid | **Not Verified** | **NOT PASSED · QA NOT RUN** | CSS inspection is not device QA. Need viewport screenshots and interaction checks in portrait/landscape. |
| Eleven | Accessibility, touch targets, keyboard, safe-area, loading/empty/error/offline states | **Partial / Not Verified** | **NOT PASSED · QA NOT RUN** | Prior slider target and mobile navigation issues were noted; complete interaction and accessibility QA remains. |
| Twelve | Staging migration dry-run, backup, reconciliation and rollback rehearsal | **Not Implemented / Not Verified** | **NOT PASSED · Not Tested** | No Phase Twelve rollout evidence recorded. |
| Twelve | Security sign-off, controlled production migration, deploy and smoke verification | **Not Implemented / Not Authorized** | **NOT PASSED · Not Run** | Requires separate Security workstream approval and explicit owner authorization. Blueprint edits do not authorize rollout. |

### 34A.1 Phase roll-up

| Phase | Overall status | Gate |
|---|---|---|
| Zero — Legacy audit/fixes | **Partial** | **NOT PASSED** |
| One — Identity/date contract | **Implementation closed · Acceptance pending** | **NOT PASSED · 1.5-E carry-over gates open** |
| Two — Session/match/roster/role | **OPEN · 2.1 read-only audit authorized; implementation gated** | **NOT STARTED · No implementation evidence** |
| Three — Evidence/rubric/scoring | **Partial** | **NOT PASSED** |
| Four — Daily Evaluation | **Partial (legacy form exists)** | **NOT PASSED** |
| Five — Anonymous peer feedback | **Partial** | **NOT PASSED** |
| Five-B — Evaluation Activity / Pending Tracker | **Not Implemented** | **NOT PASSED** |
| Five-C — Matches Evaluation | **Not Implemented** | **NOT PASSED** |
| Six — Unified tasks/follow-up | **Partial** | **NOT PASSED** |
| Seven-A — Weekly Team Review | **Not Implemented** | **NOT PASSED** |
| Seven-B — Coach-led Weekly Review | **Partial** | **NOT PASSED** |
| Eight — Player Trends | **Partial** | **NOT PASSED** |
| Nine — Squad Analytics | **Partial (competitive analytics exists)** | **NOT PASSED** |
| Ten — Realtime/offline/data quality | **Partial** | **NOT PASSED** |
| Eleven — UI/accessibility/responsive QA | **Partial / Not Verified** | **NOT PASSED** |
| Twelve — Controlled rollout | **Not Started** | **NOT PASSED** |

### 34A.3 Phase One detailed tracker — identity foundation

**Status as of 18 November 2026: IMPLEMENTATION CLOSED · ACCEPTANCE PENDING.** The identity/date-contract implementation work and exact-head CI are complete. Phase One is being administratively closed as an implementation workstream at the owner's direction; this is not a claim that its final acceptance gate passed. The remaining 1.5-E items are carried forward as explicit acceptance blockers and must not be silently dropped.

| Subphase | Scope | Status | Evidence / remaining work |
|---|---|---|---|
| 1.1 | Stable identity foundation: authenticated user, player identity, team identity mapping | **Implemented · CI verified** | Identity contract work completed in the Phase One branch. |
| 1.2 | Team loading and explicit active-team context | **Implemented · CI verified** | Auth → Membership → Team loading, explicit team selection, validation and sign-out cleanup; latest-head CI passed. |
| 1.3 | Async/race protection for identity and team context | **Implemented · CI verified** | Race-protection work implemented; earlier recorded GitHub Actions run #68 passed on commit `a34bfa6`. |
| 1.4 | Session eligibility and capability helpers | **Implemented · CI verified** | Authenticated-user/membership UUID/team UUID plus active eligibility, fail-closed clearing, and Owner/Coach capability helpers; recorded checks and CI passed. |
| 1.5-A | Migration provenance and schema-history reconciliation | **Complete · Verified** | Live ledger 55 rows; 53 in-scope non-loadout rows map 1:1 to active migration files by exact version/name. Direct live SQL-to-file comparison passed 53/53 with zero mismatches; zero missing/extra in-scope files and zero duplicate timestamp prefixes. Two loadout rows excluded. |
| 1.5-B | Existing date/timezone contract verification and staged migration | **Implemented · Disposable-PostgreSQL CI verified** | India-only date contract and staged timezone trigger tested against PostgreSQL 16. Seven B tests passed, including forward/rollback behavior. No production migration applied. |
| 1.5-C | Historical migration rollback disposition | **Complete · CI/source verified** | Live ledger read-only audit: 55 rows total; 53 in-scope historical rows; 0 stored rollback statements. All 53 explicitly classified forward-only/no automatic rollback with risk class and recovery rationale. No destructive inverse SQL fabricated. |
| 1.5-D | Source-contract tests and security ACL staging | **Implemented · CI verified** | Six D source-contract tests passed. Staged least-privilege ACL SQL for four trigger-returning SECURITY DEFINER functions passed disposable PostgreSQL role/trigger checks; not production-applied. |
| 1.5-E | Phase One final acceptance audit | **Blocked · NOT PASSED** | Three acceptance gates remain: (1) authoritative original pre-migration schema baseline/clean-replay proof unavailable; (2) Supabase Auth leaked-password protection remains disabled; (3) independent adversarial role-level tests for remaining authenticated SECURITY DEFINER RPCs outstanding. Trigger ACL SQL is staged and CI-verified, not production-applied. |

**Exact-head CI evidence:** commit `6b03de65e9e00c20b62d890fd343b58edc18cc2c`; push run #364 (44277415151) and pull-request run #365 (44277425324) both passed. 91 tests passed, 0 failed; typecheck and Vite production build passed.

**Carry-over acceptance register (must remain open):**
1. Obtain the authoritative pre-migration schema baseline or approve a separately reviewed, evidence-backed baseline exception. Never fabricate a baseline fixture and call it original.
2. Enable Supabase Auth leaked-password protection in the Dashboard and rerun Security Advisor.
3. Complete independent adversarial role-level authorization tests for the remaining authenticated SECURITY DEFINER RPCs.
4. Re-run the final acceptance audit and attach evidence for all three gates.
5. Keep staged trigger-function ACL remediation unapplied to production until separately reviewed and authorized.

**Delivery boundary:** PR #115 remains Draft/open and unmerged, stacked on prerequisite PR #114. No production deployment, production migration, production ACL/RLS/schema/data change, or Auth setting change is claimed. Closing the Phase One implementation workstream does not close PR #115 or waive its acceptance blockers.

### 34A.4 Phase Two detailed tracker — session foundation

**Overall status: OPEN · POINT 2.1 AUDIT PASS · POINT 2.2 PASS FOR LIMITED DEVELOPMENT.** Point 2.2 exact-head CI and disposable PostgreSQL integration are verified. The owner-approved limited-development exception keeps the Free-plan leaked-password limitation, original clean-replay baseline gap and broader legacy RPC adversarial review open. This does not waive the separate Security workstream or authorize production rollout. See `docs/evolution/PHASE-2-2-CANONICAL-SESSION-IDENTITY.md`.

| Subphase | Planned workflow | Status | Acceptance evidence required |
|---|---|---|---|
| 2.1 | Existing System Audit — inspect Scrims, Tournament, Training and Planning session/match data and all callers | **PASS · audit + exact-head CI verified** | `docs/evolution/PHASE-2-1-EXISTING-SYSTEM-AUDIT.md`; run #371 (`44363393358`) on `bbc4a600d12ecb3b9d86dc2d700d7d113849713a`; 99 tests passed, 0 failed, typecheck and Vite production build passed. |
| 2.2 | Canonical Session Identity — stable session UUID, team, session type and season association | **PASS · limited development · CI verified** | Additive canonical session/source schema, same-team composite FKs, idempotent Owner/Coach create RPC, soft archive; 107 tests passed, disposable PostgreSQL integration and Vite build passed. Exact head `8d244f3526af5484cb52ab0a03d7420da6ad4546`; push run [#395](https://github.com/parnav09/Free-fire-Squad-/actions/runs/44382446442). Report: `docs/evolution/PHASE-2-2-CANONICAL-SESSION-IDENTITY.md`. |
| 2.3 | Match Identity — individual match records under a parent session | **PASS · development implementation + exact-head CI verified; production gated on 2.9** | Canonical match UUIDs, parent/team composite FK, deterministic sequence, expected/actual/played counts, Scrim/Tournament source mapping, idempotent sync, audited sequence correction, RLS and duplicate/source-attachment rejection. Disposable PostgreSQL parent-session/match integration + staged B + trigger ACL integration passed; TypeScript, contracts and Vite build passed. Exact head `94aeeaa38be133be39afc13e978d6b8cc282a010`; [run #436](https://github.com/parnav09/Free-fire-Squad-/actions/runs/44390023164). Report: `docs/evolution/PHASE-2-3-MATCH-IDENTITY.md`. Production migration remains unapplied until Point 2.9 replaces destructive source deletion with archive/retention UX. |
| 2.4 | Session Lifecycle — Draft → Scheduled → In Progress → Awaiting Results → Verified → Closed → Archived | **Implementation on stacked branch · exact-head CI pending** | Additive canonical lifecycle, Owner/Coach guarded transitions, result-submission receipt, server timestamps/actors, append-only audit, audited reopening and cancellation/no-show branch. Report: `docs/evolution/PHASE-2-4-SESSION-LIFECYCLE.md`. Not PASS until exact-head CI is green. |
| 2.5 | Session Roster Snapshot — persist actual participants for the session | **Gated · Not started** | Historical participant set remains unchanged when current team roster changes. |
| 2.6 | Role Snapshot — preserve each player's role for the session/match | **Gated · Not started** | Historical role context is immutable and tied to the correct player/session/match. |
| 2.7 | Substitution Tracking — record substitutions and when/where they occurred | **Gated · Not started** | Audited substitution events with effective match/time context; prior roster/role history remains reconstructable. |
| 2.8 | Result Verification — Draft / Submitted / Verified result states and correction audit | **Gated · Not started** | Only verified results feed official aggregates; corrections are versioned/audited. |
| 2.9 | Existing Module Integration — connect Scrims, Tournament and Training through adapters | **PASS · development implementation + exact-head CI verified; production gated on 2.10+** | SECURITY INVOKER source adapter with source-scoped transaction advisory lock + deterministic idempotency; Scrim/Tournament match mapping; Training without phantom competitive matches; explicit Planning → Training promotion; retryable existing-record linking. Exact head `c4eb0a30ba88c0324e0755f0b1d5fe352acb617c`; push run [#601](https://github.com/parnav09/Free-fire-Squad-/actions/runs/44611571900), PR run [#602](https://github.com/parnav09/Free-fire-Squad-/actions/runs/44611591960) passed. A later run #607 had no runner steps and is not a test result. Draft PR [#127](https://github.com/parnav09/Free-fire-Squad-/pull/127); not merged. Report: `docs/evolution/PHASE-2-9-EXISTING-MODULE-INTEGRATION.md`. No live migration/backfill or production deployment. |
| 2.10 | Database Integrity — foreign keys, uniqueness, relationships, idempotency and migration tests | **PASS · development implementation + exact-head CI verified; production gated on Points 2.11–2.12** | Additive composite team-scoped FKs/checks/indexes; drill ownership and task/block guards; NULL-player attempt uniqueness; concurrent reference race, rollback/data-preservation, and forward-recovery harness. Exact head `f0fa995471c84fa9e08da1f1e5cb02df1b392df8`; PR run [#909](https://github.com/parnav09/Free-fire-Squad-/actions/runs/44913664018) and push run [#908](https://github.com/parnav09/Free-fire-Squad-/actions/runs/44913659564) passed, including inherited Point 2.2–2.9 DB gates, staged B migration, security-trigger ACL, source contracts, typecheck, character data, and production bundle. Draft PR [#128](https://github.com/parnav09/Free-fire-Squad-/pull/128), stacked on Point 2.9; not merged. No production migration/backfill or deployment. Report: `docs/evolution/PHASE-2-10-DATABASE-INTEGRITY.md`. |
| 2.11 | Application UI — session, match, roster, role and status workflows | **IMPLEMENTED · exact-head CI + responsive browser acceptance pending** | Dedicated canonical Sessions workspace; filtered session ledger; source-linking through the existing adapter; guarded training create/edit; lifecycle and roster-lock controls; match participation, role, substitution, result verification and audit surfaces; read-only member permissions; offline write guard. Deep Onyx tokens and current grading preserved. Responsive 390/768/1024/1280/1440 browser harness, 44px controls, focus and no-overflow checks added. Draft PR #129 stacked on Point 2.10. No production merge/deployment. Report: docs/evolution/PHASE-2-11-APPLICATION-UI.md. |
| 2.12 | Regression & Acceptance — historical snapshot, cross-module and device QA | **Gated · Not started** | Stable session/match IDs; roster/roles/substitutions preserved; only verified results aggregated; old sessions unchanged; database and application tests pass. |

**Phase Two dependency rule:** Point 2.1 is read-only and complete as an audit deliverable; exact-head source-contract CI passed (run #371, `44363393358`), with 99 tests passed and 0 failed. Points 2.2–2.12 must not create or apply a competing production session/match model until the Phase One acceptance gate passes or the owner separately approves a documented exception. No production schema/data change, destructive migration, merge, or deployment is authorized by opening this phase.

**Point 2.1 result:** the four existing domains use separate identities (Tournament cycle/match; Scrim record with JSONB matches; Planning plan/task; Training session/participant/result). Fifteen read-only integrity checks found zero current duplicate-slot, duplicate-participant or cross-team mismatch rows. Structural composite-FK, historical role/substitution, and common result-verification gaps are documented for later points. The existing UI has a shared Deep Onyx foundation with distinct Scrims cyan/gold and Planning/Training blue-violet treatments; no new UI belongs in this audit-only point.

### 34A.5 Phase Zero and pull-request status context

- **Phase Zero:** legacy-fix work was CI-verified in the recorded history (18 Foundation, 11 Character-data, and 10 Evolution regression tests; TypeScript/build checks passed). PR #114 remained Draft/open, unmerged and undeployed in the last recorded status; Vercel preview was blocked by a rate limit. No production schema/RLS/grant changes were recorded.
- **Phase One:** PR #115 contains the identity-foundation work. It remained Draft/unmerged/undeployed in the last recorded status. The 1.1–1.4 code/CI work should not be confused with full Phase One acceptance because 1.5-E is blocked.
- **Phase Two:** Point 2.1 existing-system audit is PASS in PR #118; exact-head push CI run #371 passed (99 tests, 0 failures, typecheck and Vite build). No feature UI or production schema change was made. Points 2.2–2.12 remain gated.
- **Production:** this ledger update is documentation only. It does not authorize or report a merge, migration, Supabase write, or Vercel deployment.

### 34A.2 What counts as PASS

A phase changes to **PASS** only after all its required workflows are implemented and the phase gate has evidence attached: migration/test output where applicable, automated test results, RLS/permission tests, manual QA screenshots or recordings where applicable, and a reviewed handoff. Until then, keep **Not Tested**, **Not Verified**, or **Not Passed** as appropriate. Never infer PASS from a successful build, an existing page, a merged PR, or a blueprint checkbox alone.

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

**Next action:** review the completed Evolution Phase Two Point 2.1 audit in `docs/evolution/PHASE-2-1-EXISTING-SYSTEM-AUDIT.md` and and its exact-head CI PASS (run #371). Then proceed to Point 2.2 only when Phase One 1.5-E acceptance passes or a separate documented exception is approved. Do not create a second identity system. Keep Phase One acceptance carry-over gates visible. Do not redesign or migrate timezone as part of the new Evaluation workspace. Authorization/RLS/grants and security hardening remain in the separate Security workstream.

---

## 38. Evolution Phase Two — detailed implementation blueprint

**Phase objective:** establish one trustworthy, immutable, auditable identity chain for every competitive or training session and each match inside it. Phase Two supplies the session/match context consumed by later Evidence, Evaluation, scoring, trends, and analytics phases. It does not build the Evaluation rubric or replace official tournament scoring.

### 38.1 Point 2.1 — Existing System Audit (read-only first)

**Purpose:** discover the real current data model before designing migrations.

Work items:
1. Inspect Scrims, Tournament, Training, and Planning UI routes, forms, hooks, services, RPCs, tables, views, triggers, and edge functions.
2. Trace every create, edit, delete/archive, result-entry, roster-selection, role-selection, and list/detail read path.
3. Inventory current identifiers: UUIDs, legacy numeric IDs, display labels, date-based keys, tournament/week labels, and any implicit match indexes.
4. Map parent/child relationships: team → session/event → match → participant/role → result/evidence.
5. Identify duplicate, orphaned, null, ambiguous, and cross-team references using read-only queries and non-production fixtures.
6. Document lifecycle semantics already used by each module; distinguish true persisted state from UI-only status.
7. Record existing access rules and identify which roles can create, edit, verify, close, archive, or correct records.
8. Capture baseline behavior and regression paths for existing Scrims, Tournament, Training, and Planning.
9. Produce a data dictionary, relationship diagram, caller/read-write matrix, compatibility matrix, and risk register.
10. Recommend reuse/adapters versus migration only after evidence is collected.

Deliverables: audit report; schema/data dictionary; relationship map; module caller matrix; duplicate/orphan report; current workflow screenshots or reproducible test notes; migration-risk register; explicit no-change confirmation.

Acceptance: every existing session/match source is accounted for; every write/read caller is mapped; no production data changed; no new schema or competing model created; ambiguous records are listed rather than guessed. **Audit evidence:** `docs/evolution/PHASE-2-1-EXISTING-SYSTEM-AUDIT.md` records the live read-only inventory, 15 integrity checks, RLS policy inventory, UI/design audit and explicit follow-up gaps. The source-contract checks run in the standard `npm run build` gate.

### 38.2 Point 2.2 — Canonical Session Identity

Purpose: define one stable parent identity for each Scrim block, Tournament event/week, or Training session.

Work items:
1. Define canonical session UUID as the internal primary identity.
2. Associate each session with exactly one team and a controlled session type.
3. Store season/tournament association where applicable without encoding it into the primary key.
4. Keep human-readable title, date, lobby label, week number, and display order as mutable attributes—not identity.
5. Define source-system references for legacy Scrims/Tournament/Training records.
6. Enforce tenant/team ownership and prevent cross-team linking.
7. Specify create idempotency so retries do not create duplicate sessions.
8. Define archive behavior without deleting historical records.

Acceptance: one canonical UUID per session; unique source mapping; team-scoped foreign keys; idempotent create; no display string used as a key; migration mapping reviewed before writes.

### 38.3 Point 2.3 — Match Identity

Purpose: represent each match as a first-class child of a session.

Work items:
1. Define stable match UUID and parent session UUID.
2. Store match sequence/order separately from match identity.
3. Support expected match count and actual played match count without fabricating missing matches.
4. Preserve mode/map/round metadata only where the source actually provides it.
5. Define uniqueness for session + match sequence while allowing audited correction of sequence metadata.
6. Map existing Scrim and Tournament match rows to canonical IDs.
7. Preserve external/source IDs for traceability.
8. Ensure one match cannot be attached to two sessions.

Acceptance: every match has one parent; duplicate match identity is rejected; ordering is deterministic; legacy references remain traceable; missing matches remain missing rather than auto-created as played records.

### 38.4 Point 2.4 — Session Lifecycle

Canonical lifecycle: **Draft → Scheduled → In Progress → Awaiting Results → Verified → Closed → Archived**.

Work items:
1. Define permitted transitions and disallowed shortcuts.
2. Define who may perform each transition (Owner/Coach/authorized organizer; member permissions only where explicitly needed).
3. Store transition timestamps and actor identity.
4. Require results to be submitted before verification; require verification before closure.
5. Define cancellation/no-show handling without mislabeling it as a played match.
6. Permit reopening only through an audited correction path.
7. Define archive as non-destructive and read-only for ordinary users.
8. Make lifecycle transitions atomic and idempotent.

Acceptance: transition matrix tested; unauthorized transitions rejected server-side; timestamps and actors recorded; archived sessions cannot be silently edited; no invalid transition can bypass result verification.

### 38.5 Point 2.5 — Session Roster Snapshot

Purpose: preserve who actually participated, not merely who is currently on the team.

Work items:
1. Snapshot eligible team members at session creation or roster lock.
2. Record actual participation per match where the source supports it.
3. Distinguish invited/selected, confirmed, participated, absent, and substituted states.
4. Preserve player UUID and team membership provenance.
5. Define handling for a player who later leaves the team or changes IGN.
6. Prevent later roster edits from rewriting historical participants.
7. Support team-size/session-type constraints as configuration, not hard-coded assumptions.

Acceptance: historical roster is reproducible after current roster changes; each participant resolves to the correct player identity; no duplicate participant per match; absent is not confused with participated.

### 38.6 Point 2.6 — Role Snapshot

Purpose: preserve the role actually played in each session/match.

Work items:
1. Snapshot role ID/name and role-definition version at session or match lock.
2. Support the team's role taxonomy without treating P1/P2/P3/P4 labels as identity.
3. Permit a player to perform different roles in different matches.
4. Record role changes with effective match/time context.
5. Keep current roster role edits separate from historical snapshots.
6. Define unknown/unassigned role handling without guessing.

Acceptance: old sessions retain the role originally played; role history is reconstructable; role changes do not overwrite prior match context; unknown role remains explicitly unknown.

### 38.7 Point 2.7 — Substitution Tracking

Purpose: record lineup changes during a session without destroying the original lineup.

Work items:
1. Record outgoing and incoming player identities.
2. Link substitution to session and, when available, match and effective time/round.
3. Record actor, reason/category if supplied, and source provenance.
4. Capture role transfer or role reassignment separately from player replacement.
5. Support multiple substitutions in order.
6. Validate that a substitution does not create overlapping active participation unless the ruleset permits it.
7. Preserve the pre- and post-substitution lineup as reconstructable snapshots.

Acceptance: substitution timeline is ordered and auditable; active lineup at any supported point can be reconstructed; no historical participant/role row is silently overwritten.

### 38.8 Point 2.8 — Result Verification and Correction Audit

Purpose: separate raw submission from trusted/official result data.

Work items:
1. Define result states: Draft, Submitted, Verified, Corrected/Amended, Rejected where applicable.
2. Store result source, submitter, verifier, and timestamps.
3. Define a verification checklist appropriate to Scrim, Tournament, and Training sources.
4. Keep raw submitted values and verified values distinguishable.
5. Require authorized verifier for trusted status.
6. Implement append-only correction/amendment history with reason and actor.
7. Prevent unverified results from entering official aggregates.
8. Never infer kills, placement, survival, or match events from incomplete data.

Acceptance: only verified results feed official competitive aggregates; corrections preserve prior values and audit history; unverified data is visibly marked; permissions are tested.

### 38.9 Point 2.9 — Existing Module Integration

Purpose: connect existing modules to canonical IDs without breaking their workflows.

Work items:
1. Define adapters for Scrims, Tournament, and Training.
2. Preserve existing screens and expected actions unless a separately approved UI change is required.
3. Resolve existing records to canonical session/match IDs through explicit mapping.
4. Avoid duplicate writes and parallel source-of-truth tables.
5. Keep Planning as a scheduling/planning surface; promote a planned item to a session through an explicit transition.
6. Ensure old deep links and route parameters resolve safely or show a recoverable not-found state.
7. Add compatibility tests for existing callers before removing any legacy path.

Acceptance: existing workflows pass regression tests; each source maps to one canonical session/match; no duplicate source of truth; Planning does not create phantom played matches.

### 38.10 Point 2.10 — Database Integrity and Migration Safety

Work items:
1. Design normalized tables and constraints only after Point 2.1 audit is accepted.
2. Add team-scoped foreign keys, unique constraints, check constraints, and indexes.
3. Define transaction boundaries for session creation, match creation, roster lock, role snapshot, substitution, and result verification.
4. Define idempotency keys for retryable writes.
5. Add RLS and server-side authorization tests for each role and team boundary.
6. Build disposable PostgreSQL/Supabase-compatible migration tests where possible.
7. Test forward migration, rollback or forward-only recovery plan, and historical-data reconciliation.
8. Prove no orphan or duplicate relationships after migration.
9. Avoid production execution until staging evidence and explicit rollout approval.

Acceptance: constraints prevent invalid relationships; retries are safe; cross-team access tests fail closed; forward and recovery paths are tested; no unexplained data loss or orphan rows.

### 38.11 Point 2.11 — Application UI

Work items:
1. Session list with filters for type, season, status, and date.
2. Session detail with matches, roster, roles, substitutions, and result status.
3. Create/edit flows constrained by lifecycle and permissions.
4. Match detail with clear parent-session context.
5. Roster and role snapshot editing before lock; audited change path after lock.
6. Result submission and verification surfaces with visible provenance.
7. Empty, loading, error, permission-denied, archived, and offline states.
8. Responsive behavior for Android/mobile, tablet, and desktop; preserve premium dark UI.
9. Accessible touch targets, keyboard focus, labels, and clear validation.
10. Avoid UI controls that imply an action the backend does not support.

Acceptance: each action matches its permission and lifecycle rule; no accidental double-submit; mobile/tablet/desktop interactions verified; no regression in Scrims, Tournament, Training, or Planning.

### 38.12 Point 2.12 — Regression and Phase Acceptance

Required test groups:
1. Canonical identity uniqueness and team isolation.
2. Session-to-match parent/child integrity.
3. Lifecycle transition and authorization matrix.
4. Historical roster immutability after roster edits.
5. Role snapshot immutability and role changes across matches.
6. Substitution ordering and lineup reconstruction.
7. Result submission, verification, correction, and aggregate eligibility.
8. Idempotent retries and concurrent writes.
9. Migration forward/recovery and historical reconciliation.
10. Existing Scrims/Tournament/Training/Planning regression.
11. RLS and adversarial cross-team access tests.
12. Android/mobile, tablet, desktop responsive and accessibility QA.

Phase Two Definition of Done:
- All twelve points have explicit implementation and acceptance evidence.
- Canonical session and match IDs are used by all integrated modules.
- Historical roster, role, substitution, and result provenance are preserved.
- Only verified results feed official competitive aggregates.
- No duplicate session/match source of truth exists.
- Database constraints, RLS, and idempotency tests pass.
- Existing workflows remain functional.
- Phase One acceptance carry-over is resolved or formally excepted without weakening security.
- No production migration/deployment occurs without separate rollout approval.

# Appendix A — Requirement preservation checklist

The following original requirements remain explicitly represented in this rewrite:

- Connected player-development system and complete session-to-improvement loop.
- Existing implementation audit and all previously observed defects.
- Six canonical dimensions and separate Positioning/Map Awareness.
- 0–10 scale, zero vs missing, Not observed, no negative ratings.
- Versioned role-aware weighted 0–100 scoring.
- Legacy 37/50 and advanced 82/100 caution.
- Daily Evaluation workflow, self-excluding teammate selector, unique evaluator-target assignments, atomic writes, and expiring overdue tracker.
- Four-card Evaluation workspace: Daily Evaluation, Weekly Team Review, Matches Evaluation, Evaluation Activity.
- Weekly Team Review as a member-submitted nine-dimension team review, separate from coach-led Weekly Review snapshots.
- Matches Evaluation for both Scrims and Tournament match records.
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
