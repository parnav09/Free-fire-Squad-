# Evolution Phase 3.1 — Existing Evaluation System Audit

**Status:** Audit complete; implementation dependencies and pre-existing defects recorded  
**Track:** Evolution Phase 3 (distinct from legacy product Phase 3 numbering)  
**Repository baseline inspected:** main at f0d4f6fca76053f2bac814c5863a7e47c3fc42f1  
**Audit branch inspected:** feat/evolution-phase-two-3-evidence-rubric-scoring at 8de23472711ff4a6ce997bac6ec323e33631dee3  
**Phase 2 acceptance reference:** PR #130, head 50efd77314cd2542062fc4f91b226eea2b935800  
**Scope:** Read-only inventory and reconciliation. No schema, data, RLS, Auth, UI or production changes are made by this audit.

## 1. Executive decision

The repository is not starting from zero. It has three distinct evaluation paths in the current main source, plus an unmerged Evolution canonical rubric/evidence/scoring implementation on a separate branch.

**Do not create a second scoring system.** Reuse and repair the existing Evolution Phase Three branch as the candidate implementation, but do not call it verified or production-ready. Its database integration currently fails, and code review found additional contract gaps. The current main branch still contains legacy evaluation workflows; the canonical implementation is not merged into main.

### Point 3.1 acceptance

| Acceptance item | Status | Evidence |
|---|---|---|
| Existing Daily Evaluation, Training evaluation, Weekly Review/Trends paths inventoried | VERIFIED | Main source and migration paths below |
| Existing score dimensions and scales identified | VERIFIED | App.tsx, PlayerEvaluationRubric.tsx, PlanningTrainingCenter.tsx, PlayerWeeklyInsights.tsx |
| Existing Evolution canonical rubric/scoring branch inspected | VERIFIED | Branch commit 8de2347, report, SQL, TypeScript engine and tests |
| Older blueprint phase numbering reconciled | VERIFIED | Both legacy blueprint documents inspected |
| Canonical session/match/role dependencies traced | VERIFIED WITH BLOCKERS | Phase 2 PR chain is unmerged; Phase 2.12 acceptance is blocked |
| Duplicate sources of truth and migration/backfill risks identified | VERIFIED | Mapping matrix and risks below |
| No schema/data changes made during audit | VERIFIED | Documentation and audit-contract test only |
| CI verification of this audit change | PENDING PR CI | Must be confirmed against the exact audit PR head |

Point 3.1 is an audit deliverable, not permission to ship the later rubric/scoring engine. Its read-only discovery and reconciliation are complete; CI for this audit branch remains a separate gate.

## 2. Current main-branch evaluation inventory

### 2.1 Legacy Daily Evaluation

**Source paths**
- src/App.tsx — evaluation state, fetch, save, realtime refresh and evaluation UI.
- supabase/migrations/20261109014000_anonymous_daily_evaluation.sql
- supabase/migrations/20261109035000_daily_score_feedback_private_rls.sql
- src/components/PlayerWeeklyInsights.tsx

**Data contract observed**
- Primary table: daily_scores.
- Five stored dimensions: communication, coordination, decision_making, role_execution, map_awareness.
- Legacy aggregate: total, represented in the UI as a 0–50 five-dimension score.
- Anonymous reviewer model: evaluator_id may be NULL.
- Narrative feedback is separated into daily_score_feedback; it contains score_id, team_id, player_id, improvement target/notes, mistake notes and context notes.
- Feedback SELECT policy is recipient-only (player_id = auth.uid()); insertion is gated by can_rate and a matching score row.

**Status:** IMPLEMENTED LEGACY / PARTIAL WORKFLOW SAFETY.

**Observed risks**
1. Current main initializes the target to P1 and the five score controls to 5. This is a prefilled/default evaluation, not an explicit observation from the evaluator.
2. saveEvaluation inserts daily_scores first and then inserts daily_score_feedback separately. A feedback failure leaves the score row saved without its narrative context; the two writes are not atomic.
3. The current score and feedback paths are separate sources and have different visibility rules. Do not move private narrative back into team-readable score rows.
4. The open legacy-fix PR #114 proposes removing the hard-coded target/prefilled scores and pausing partial feedback writes until the atomic workflow is implemented. PR #114 is still Draft and unmerged; its proposed fixes are not facts about main.

### 2.2 Training Center — standard role-weighted evaluation

**Source paths**
- src/components/PlanningTrainingCenter.tsx
- supabase/migrations/20261109002000_phase_2_3_planning_training.sql

**Data contract observed**
- Results table: training_results.
- Each result references training_sessions through session_id; it can reference a player through player_member_id.
- Stored result includes a 0–100 score, JSONB rubric, attempt_number, completion state, player reflection, coach feedback, next action, submitter and timestamp.
- Standard rubric stores five raw 1–10 values: execution, communication, coordination, decision and consistency. The JSONB includes scale: "1-10" and dimension_storage: "raw_1_to_10".
- A role-weighted score is computed using the member's current assigned_role in the UI. The inspected role profiles use different five-key weights by role and normalize to 100.

**Status:** IMPLEMENTED LEGACY TRAINING / HISTORICAL ROLE CONTEXT PARTIAL.

**Observed risks**
1. The standard training rubric is a five-dimension model, not the canonical six-dimension Evolution rubric.
2. Weight selection reads the current member role, not a verified immutable historical role snapshot. It must not be used to recalculate old results after a role change.
3. Training results are attached to legacy training_sessions; main does not yet prove a complete canonical match + roster + role snapshot chain for every result.
4. Preserve the raw JSONB values and original 0–100 score. Do not overwrite historical results during a future crosswalk.

### 2.3 Training Center — advanced six-dimension evaluation

**Source paths**
- src/components/PlayerEvaluationRubric.tsx
- src/components/PlayerEvaluationRubric.css
- src/components/PlanningTrainingCenter.tsx

**Dimensions observed**
- coordination
- communication
- trade_support
- decision_making
- positioning
- consistency

The advanced component initializes all six ratings to 5, accepts integer values 1–10, calculates a simple unweighted average, and saves overall × 10 as a 0–100 training_results.score. The raw six values are stored in the rubric JSONB.

**Status:** IMPLEMENTED LEGACY TRAINING / NOT CANONICAL.

**Observed risks**
- No explicit Not Observed / Not Applicable state.
- No dimension-linked evidence record or provenance/verification workflow.
- The average is unweighted and does not use the canonical role snapshot.
- Its six dimensions differ from both the legacy Daily Evaluation and the Evolution canonical six.
- The prefilled value 5 can be mistaken for an observed rating unless the form is explicitly completed.

### 2.4 Weekly Review and Player Trends

**Source path:** src/components/PlayerWeeklyInsights.tsx

The component consumes the five-dimension Daily Evaluation shape, uses total or sums the five dimensions, and labels the result 0–50. The inspected avg helper returns 0 when a player has no rows. That can visually conflate “no evaluation data” with a real zero average.

**Status:** IMPLEMENTED LEGACY SUMMARY / DATA-QUALITY PARTIAL.

The open PR #114 proposes incomplete-row exclusion and deterministic recomputation from raw dimensions. It remains Draft/unmerged. Do not treat that fix as present on main.

### 2.5 Competitive Analytics separation

The current Evolution/Analytics product scope distinguishes competitive tournament results from player-development evaluation. Preserve this boundary: placements, kills and tournament points must not be added to an internal player-development score.

**Status:** SEPARATION PRESENT IN CURRENT PRODUCT DIRECTION; full player-development analytics remain future work.

## 3. Existing Evolution canonical rubric/scoring implementation

A separate branch already contains a substantial candidate implementation:

- Branch: feat/evolution-phase-two-3-evidence-rubric-scoring
- Exact head: 8de23472711ff4a6ce997bac6ec323e33631dee3
- Parent: c1c2cd3ce828deed55937f33d51cfa5b7bd4f051
- Report: docs/evolution/PHASE-2-3-EVIDENCE-RUBRIC-SCORING.md
- SQL: supabase/migrations/20261119130000_evolution_phase_three_evidence_rubric_scoring.sql
- Engine: src/lib/evolution-scoring.ts
- Source tests: scripts/verify-evolution-phase-three.mjs
- Disposable PostgreSQL integration: scripts/verify-evolution-phase-three-db.sh
- No pull request exists for this branch; it is not merged into main.

### 3.1 What is already implemented on that branch

The additive migration defines:
- evolution_rubric_versions
- evolution_rubric_dimensions
- evolution_role_weight_profiles
- evolution_evidence_items
- evolution_evidence_dimension_links

It seeds system rubric EV2-1.0, minimum observed dimensions = 4, six dimensions and six neutral role profiles. Team-specific rubric/weight drafts are restricted to active Owner/Coach membership. RLS is enabled, anon access is withheld, and client DELETE is revoked.

The pure TypeScript engine:
- requires an explicit state for every dimension;
- accepts integer ratings 0–10, with 0 as a real observation;
- represents Not Observed separately and requires a reason;
- rejects missing dimensions and invalid weights;
- computes a weighted average over observed dimensions and normalizes using average × 10;
- withholds the headline score below the configured observed-dimension minimum;
- returns no score when there are no observations;
- derives confidence from sample count, evidence-backed ratio and context consistency, not score magnitude;
- checks comparability by rubric, engine, role, mode and map;
- labels legacy conversion approximate and non-comparable.

**Status:** IMPLEMENTED ON UNMERGED BRANCH / NOT VERIFIED.

### 3.2 Exact CI failure — blocking defect

GitHub Actions run #44384438749 for exact head 8de23472711ff4a6ce997bac6ec323e33631dee3 failed in step 9, “Verify Evolution Phase Three evidence and rubric migration against isolated disposable PostgreSQL”.

The log reports:

ERROR: infinite recursion detected in policy for relation "evolution_rubric_versions"

The Phase 2.2 migration integration passed first. The Phase Three PostgreSQL integration then failed while activating a team rubric. The subsequent staged ACL, typecheck/source tests and production bundle steps were skipped. Therefore the source test suite and build are not proven green for this exact branch head.

The failure path is visible in the SQL policies: the rubric-version UPDATE check counts rows from evolution_rubric_dimensions, while the dimensions SELECT policy queries evolution_rubric_versions. Under RLS, this creates a policy dependency cycle.

**Required follow-up:** redesign the activation invariant so it can validate the six dimensions without recursive RLS policy evaluation; rerun the full disposable PostgreSQL chain and all downstream checks on the new exact head.

### 3.3 Additional source-review findings on that branch

1. **Active role-weight mutability:** the role-profile UPDATE policy allows rows whose status is not retired, and its WITH CHECK permits status = active. The authenticated grant includes UPDATE of weights, status and activated_at. No immutability trigger was found in this migration. This contradicts the report's claim that activated profiles are immutable. Activation must freeze a version; edits should create a new version.
2. **Evidence-to-match/role linkage is incomplete:** evidence rows reference a player and optional canonical_session_id, with a free-text round label. They do not reference a canonical match ID or the exact role-snapshot record. This is insufficient for a fully reproducible match/role-specific evaluation.
3. **Evidence verification is not present in this schema:** the evidence item has creator/time and archive metadata, but no pending/verified/rejected state or verifier identity/time. This is a later provenance/verification gap, not a reason to invent verification.
4. **No evaluation submission or score snapshot/history tables are included:** the branch explicitly excludes the Daily Evaluation submission workflow. The scoring function returns a result but does not persist immutable calculation inputs/history.
5. **Confidence policy is caller-supplied to the TypeScript function:** the inspected migration does not persist a versioned confidence-policy record. Reproducible confidence history needs an explicit policy/version contract before downstream analytics consume it.
6. **No UI is included:** there is no canonical evidence-entry or evaluation experience on this branch. Its report explicitly leaves UI and evaluation submission to later phases.

These findings are source-review findings; only the recursive-policy failure is confirmed by an executed failing database integration.

## 4. Canonical dimension reconciliation

The more detailed Evolution Version 2 blueprint on the unmerged Evolution branch specifies the canonical six dimensions and their boundaries. The Phase Three migration and engine use the same stable keys:

1. communication — Communication
2. coordination_trade_support — Coordination & Trade Support
3. decision_making — Decision Making
4. positioning — Positioning
5. map_awareness_rotation — Map Awareness & Rotation
6. role_execution — Role Execution

This is a better canonical target than the initial six-dimension proposal in the new Phase 3 roadmap (which split Coordination and Trade Support and used Consistency). The roadmap proposal was not yet implemented or a verified existing contract. The detailed Evolution blueprint also explicitly separates Positioning from Map Awareness & Rotation and requires role evaluation to use the role actually played.

### 4.1 Legacy crosswalk — do not auto-migrate

| Legacy source | Legacy dimensions | Candidate mapping | Loss / restriction |
|---|---|---|---|
| Daily Evaluation | communication, coordination, decision_making, role_execution, map_awareness | communication; coordination_trade_support; decision_making; role_execution; map_awareness_rotation | No independent trade-support observation; no positioning observation; legacy map_awareness does not prove rotation detail |
| Standard Training | execution, communication, coordination, decision, consistency | role_execution; communication; coordination_trade_support; decision_making | No independent trade-support detail; no positioning/map-awareness evidence; consistency is not a canonical dimension |
| Advanced Training | coordination, communication, trade_support, decision_making, positioning, consistency | communication; coordination_trade_support; decision_making; positioning | Coordination and trade_support collapse into one canonical dimension; no map-awareness/rotation or role-execution value |
| Existing 0–50 Daily total | Sum of five legacy dimensions | Keep as legacy 0–50 | Not equivalent to canonical weighted 0–100 |
| Existing training 0–100 score | Existing role-weighted or simple-average result | Keep as legacy training score | Different rubric/weights/context; not automatically comparable |

No historical value should be copied into a new canonical dimension unless a reviewed mapping proves semantic equivalence. Preserve source values, source IDs, original scales and provenance. Any approved display conversion must be labelled approximate and non-comparable; do not combine the old 0–50 and 0–100 series.

### 4.2 Scale and normalization decision

The detailed Evolution blueprint specifies:

canonical_score_100 = weighted_average(valid_dimension_scores_0_to_10) × 10

It also specifies that only rated dimensions enter the denominator, Not Observed is distinct from zero, and a below-threshold evaluation retains observations but withholds the headline score.

**Audit recommendation:** use this documented average × 10 contract. Do not use min-max (rating - 1) / 9 × 100; it would change the meaning of the existing 0–10 scale and is not the stated Evolution contract. The candidate TypeScript engine already uses average × 10. The source blueprint and implementation branch are not merged into main, so this is a design reconciliation, not a claim that the contract is live.

## 5. Phase 2 dependency and source-of-truth reconciliation

The canonical Evolution session/match/roster/role foundation is not accepted on main yet.

- Phase 2 PRs #119–#130 are open Draft work, not merged into main.
- PR #130 is the Phase 2.12 regression/final-acceptance gate. Its body records PostgreSQL integration, authenticated end-to-end flows, historical snapshot/runtime regression and manual Android/tablet/desktop QA as unverified.
- Exact PR #130 head 50efd77314cd2542062fc4f91b226eea2b935800 has a GitHub Actions failure in run #44722089128. Its job started and failed before any runner steps (empty steps); this is an infrastructure/runner-start failure, not a passing code test.
- The evidence/rubric branch is based on the earlier canonical-session identity branch and only references canonical_sessions; it does not prove integration with the later match, roster and role-snapshot chain.

**Dependency status:** 3.1 read-only audit can be completed now. Canonical evaluation implementation and any match/role-linked evidence integration must not be declared ready until Phase 2.12's blocked acceptance gates are resolved or explicitly dispositioned.

## 6. Legacy blueprint numbering conflict

The repository's older product blueprints use “Phase 3” for unrelated product areas:
- docs/blueprints/PHASE-2-3-PLANNING-TRAINING-MASTER.md: product Phase 3 = Training Center.
- docs/blueprints/BLUEPRINT-2-BUILD-AUDIT-AND-REMAINING.md: product Phase 3 = Tournament Ledger.

The Evolution Version 2 blueprint uses Evolution Phase Three = evidence, canonical rubric and scoring contracts. Keep these tracks explicitly separate. Never rename the old product phases or infer that their Phase 3 completion means Evolution Phase 3 is complete.

The Evolution master blueprint docs/evolution-version-2.md and the candidate Phase Three implementation report are on feature branches, not current main. They must remain visibly identified as unmerged design/implementation work.

## 7. Gap-to-target matrix

| Capability | Current main | Existing unmerged Evolution branch | 3.1 disposition |
|---|---|---|---|
| Daily evaluation | Legacy 5-dimension 0–50 | Not a submission workflow | Reuse as legacy; no destructive conversion |
| Training evaluation | Standard 5-dimension weighted + advanced 6-dimension average | Separate canonical rubric | Keep legacy isolated |
| Canonical dimension registry | Missing | Present, six stable keys | Reuse candidate after CI repair and design approval |
| Versioned rubric | Missing | Present | Implemented-unverified |
| Role weights | Legacy current-role UI weights | Neutral versioned profiles | Fix active-version immutability |
| Evidence records | Notes/replay references in legacy flows | Present, session-level | Extend match/role linkage and provenance |
| Evidence verification | Not canonical | Missing verified/rejected state | Future implementation gap |
| Not Observed | Not consistently supported in legacy forms | Present in pure TS engine | Verify UI/database integration later |
| Coverage | Not independently shown in legacy evaluation | Present as observed/6 | Verify policy/threshold and UI later |
| Deterministic score engine | Multiple legacy formulas | Present in pure TS | DB integration currently fails |
| Confidence/comparability | Not present in legacy workflow | Pure TS functions | Persist versioned policy and test context |
| Score snapshots/history | Legacy rows only | Missing evaluation snapshots | Missing |
| Atomic evaluation submission | Current Daily Evaluation writes score + feedback separately | Explicitly excluded | Later atomic workflow |
| Canonical session/match/role linkage | Not complete on main | Session FK only | Blocked by Phase 2 chain |
| Evaluation/evidence UI | Legacy forms only | Not included | Later UI point |
| Cross-team/RLS | Legacy table policies exist | New RLS policies present but integration fails | Unverified until DB suite passes |

## 8. Risks and required handoff

### P0 — must be resolved before accepting the existing canonical implementation
- Fix the recursive RLS policy dependency and rerun the disposable PostgreSQL integration.
- Freeze active role-weight versions; prevent mutation after activation.
- Obtain exact-head green CI for database integration, source tests, typecheck and build.
- Complete Phase 2.12's outstanding database and device QA gates before claiming full canonical session/match/role integration.

### P1 — must be resolved before downstream evaluation workflow
- Define canonical evidence linkage to canonical match and role snapshot.
- Add explicit evidence verification/provenance states and audit history.
- Define immutable evaluation/score snapshot and calculation-history model.
- Persist/version confidence policy if confidence is stored or compared historically.
- Design atomic Daily Evaluation + feedback submission in its designated later phase.
- Implement an explicit legacy crosswalk that never fabricates unavailable dimensions.
- Show insufficient data rather than zero in Weekly Review/Trends.

### P2 — product and QA
- Add canonical evidence/evaluation UI only in its designated point.
- Verify narrow Android, tablet and desktop interactions.
- Preserve private feedback visibility and team isolation.
- Keep competitive result metrics separate from development scores.

## 9. Audit change boundary

- No Supabase migration was created or applied by Point 3.1.
- No table, row, RLS policy, grant, Auth setting or production record was changed.
- No data backfill or conversion was run.
- No application evaluation UI or scoring logic was changed.
- The only 3.1 deliverables are this audit report, its source-contract test, the build-script registration and the roadmap/checkpoint reconciliation.
- No merge or production deployment is included.

## 10. Final 3.1 status

**3.1 Existing Evaluation System Audit: AUDIT COMPLETE — CI PENDING ON THIS AUDIT PR.**

The existing systems, data shapes, scales, visibility boundaries, unmerged candidate implementation, naming conflicts, Phase 2 dependencies, migration risks and concrete blockers are now documented. The separate canonical scoring branch is explicitly **NOT PASS**: its exact-head database integration failed with recursive RLS policy evaluation. That failure must be repaired in its own implementation scope; it is not hidden or counted as a 3.1 audit pass.

**Next point:** 3.2 Canonical Dimension Registry, after the Phase 2 acceptance dependency is resolved and the existing unmerged registry is reviewed/reused rather than duplicated.
