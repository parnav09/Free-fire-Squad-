# Evolution Phase 3 — Evidence, Rubric & Scoring Engine
Status: ROADMAP / NOT IMPLEMENTED BY THIS DOCUMENT
Track: Evolution roadmap (distinct from legacy product blueprint phase numbering)
Repository: parnav09/Free-fire-Squad-
Created: 2026-11-20
Branch: docs/evolution-phase-three-roadmap-checkpoint

> This document is the persistent source of truth for the proposed Evolution Phase 3 scope and continuation protocol. It is not proof that any feature is implemented. Every point must be audited against the current repository and the completed Evolution Phase 2 foundation before implementation.

## 0. Critical naming and reconciliation guard

The repository already contains older product blueprints in `docs/blueprints/PHASE-2-3-PLANNING-TRAINING-MASTER.md` and `docs/blueprints/BLUEPRINT-2-BUILD-AUDIT-AND-REMAINING.md`. Those use their own product Phase 2/3 numbering (including Planning/Training and Tournament Ledger). Do not overwrite, silently rename, or conflate those older phase labels with this Evolution roadmap.

This document's “Evolution Phase 3” means the next phase after Evolution Phase 2 (canonical session/match/lifecycle/roster/role snapshot work). During point 3.1, inspect the existing blueprints, code, schemas, migrations, PRs and current main/feature branches. Reconcile overlapping features. Reuse working implementations; do not build duplicate evaluation, training or scoring systems. If the proposed scope conflicts with a more authoritative approved blueprint, report the conflict and recommend a resolution before destructive or duplicative implementation.

## 1. Phase objective

Build a traceable, evidence-based player performance evaluation and deterministic scoring capability on top of Evolution Phase 2's canonical session, match, roster and role snapshots.

The complete feature should make it possible to:
- record observations against a player and the relevant canonical session/match;
- attach provenance and verification state to evidence;
- evaluate using a versioned rubric and the role configuration that applied at the time;
- represent Not Observed separately from zero;
- calculate evidence coverage independently from performance score;
- calculate reproducible weighted scores from explicit inputs;
- preserve immutable/historically reproducible score snapshots;
- enforce database integrity, authorization and team isolation;
- expose the complete workflow in responsive app UI;
- integrate with existing Scrims, Tournament, Training, Player and Evaluation modules without competing sources of truth.

## 2. Canonical dimensions — reconciled by Point 3.1 audit

The initial six-dimension suggestion in this roadmap is superseded by the more detailed Evolution Version 2 canonical rubric already specified on the unmerged Evolution blueprint and implemented as a candidate on branch `feat/evolution-phase-two-3-evidence-rubric-scoring`.

Canonical stable keys:
1. `communication` — Communication.
2. `coordination_trade_support` — Coordination & Trade Support.
3. `decision_making` — Decision Making.
4. `positioning` — Positioning.
5. `map_awareness_rotation` — Map Awareness & Rotation.
6. `role_execution` — Role Execution.

The source blueprint explicitly separates Positioning from Map Awareness & Rotation and requires role scoring to use the role actually played. This replaces the earlier proposal that split Coordination and Trade Support and used Consistency as a standalone dimension. Consistency remains a longitudinal trend/derived measure, not a canonical per-evaluation dimension, unless a future approved rubric version changes this.

Scoring normalization is reconciled to the existing Evolution blueprint: `weighted_average(valid 0–10 ratings) × 10`. Zero is a valid observed rating; Not Observed is a separate explicit state with a reason and is excluded from the observed-weight denominator. No min-max remapping is authorized.

Legacy Daily Evaluation (five dimensions), standard Training (five dimensions), and advanced Training (six dimensions) remain separate historical models. Point 3.1 documents a candidate crosswalk but does not authorize automatic backfill, conversion, or comparability claims. Preserve all original values and source provenance.

The detailed blueprint and candidate implementation are not merged into main. Treat this as the canonical Evolution design to reuse after review, not as a production/live contract.

## 3. Detailed implementation points

### 3.1 Existing Evaluation System Audit
- Inspect current main and relevant Evolution feature branches/PRs; establish actual repository state and latest commits.
- Inspect all existing Evaluation, Daily Evaluation, Advanced Evaluation, Training results, scorecards, review, player profile and analytics flows.
- Inventory tables, columns, constraints, indexes, RPCs/functions, triggers, RLS policies, migrations, TypeScript types, hooks, components and routes.
- Identify existing dimensions, score scales, rubric definitions, weights, evidence fields, historical records and calculation logic.
- Trace current data relationships to canonical Evolution Phase 2 session, match, roster and role snapshots.
- Inspect older blueprints and audit docs; reconcile legacy product phase numbering with Evolution phase numbering.
- Mark every relevant capability IMPLEMENTED / PARTIAL / MISSING / UNKNOWN / BROKEN, with source paths, migration names, commits and test evidence.
- Identify duplicate sources of truth and migration/backfill risks.
- Preserve all existing player/team historical data.
- Deliver an audit report and a gap-to-target matrix before implementation.
Acceptance: no schema or data change is made until existing behavior and overlap are understood; no duplicate system is introduced.

### 3.2 Canonical Dimension Registry
- Define stable dimension IDs independent of display labels.
- Store canonical names, definitions, descriptions and applicability.
- Define rating scale and validation boundaries.
- Define active/retired state and ordering.
- Provide aliases/mappings for legacy category names only when semantically equivalent.
- Keep database, API and UI definitions aligned.
- Version dimension definitions if historical interpretation can change.
Acceptance: all evaluations refer to stable IDs; no module invents a competing dimension list.

### 3.3 Evidence Data Model
- Define stable evidence identity and schema.
- Support player, team, canonical session, canonical match, dimension and evaluation references as applicable.
- Store evidence type, concise observation, source, creator, timestamp and status.
- Support replay/reference URL or external locator where appropriate; do not imply automatic VOD analysis.
- Support evidence attachments only through approved storage/access policies.
- Link evidence to the exact evaluation/rubric context.
- Validate team membership and referenced entities.
- Preserve evidence version/history.
Acceptance: every evidence record is traceable to its origin and relevant player/session/match/dimension.

### 3.4 Evidence Provenance & Verification
- Track source attribution, created_by, verified_by, created_at and verified_at.
- Define explicit states (e.g. pending, verified, rejected, corrected) with allowed transitions.
- Separate observation author from verifier.
- Prevent unauthorized verification or mutation.
- Detect likely duplicate evidence without destructive automatic merging.
- Retain correction/rejection history and reasons.
- Define archival/retention behavior.
Acceptance: user can inspect who recorded and who verified evidence, when, and what changed.

### 3.5 Versioned Rubric Engine
- Define rubric identity, version, title, description and lifecycle (draft/active/retired).
- Define criteria and scoring guidance for every applicable dimension.
- Define what each rating level means; avoid vague unanchored numbers.
- Support role-specific criteria where justified.
- Define effective dates and immutable published versions.
- Ensure an evaluation references the exact rubric version used.
- Prevent edits to published rubric versions; changes create a new version.
Acceptance: historical evaluation can be interpreted using the exact rubric that existed when it was scored.

### 3.6 Role-Based Weight Configuration
- Define explicit weights by role and rubric version.
- Validate non-negative weights and valid totals.
- Define behavior for dimensions not applicable to a role.
- Use the canonical role snapshot that applied to the evaluated session/match.
- Never apply a player's current role retroactively to an old evaluation.
- Version weight sets and preserve their history.
- Define safe behavior for missing/invalid role configuration.
Acceptance: score is reproducible from the role snapshot and weight-set version that applied at evaluation time.

### 3.7 Not Observed & Missing Data Rules
- Represent Not Observed as an explicit state, distinct from numeric zero.
- Distinguish not observed, not applicable, missing due to incomplete entry, and rejected evidence.
- Exclude Not Observed dimensions from the weighted denominator according to the approved rubric rule.
- Never silently convert null/missing into zero.
- Define when incomplete evaluations are draft, provisional, insufficient or final.
- Define minimum evidence/coverage gates.
- Migrate legacy nulls carefully and preserve original raw values.
Acceptance: absence of observation cannot unfairly lower a player's score or be misrepresented as a zero rating.

### 3.8 Evidence Coverage Calculator
- Calculate applicable dimensions, observed dimensions and Not Observed dimensions.
- Count verified and unverified evidence separately.
- Calculate coverage independently from performance score.
- Define the denominator based on role/rubric applicability.
- Define rounding and status thresholds explicitly.
- Support Complete / Partial / Insufficient (or approved equivalents).
- Store calculation version and inputs for reproducibility.
- Do not allow high performance score to imply high evidence coverage.
Proposed formula, subject to rubric audit:
Coverage % = observed applicable dimensions / total applicable dimensions × 100.
Acceptance: coverage is transparent, reproducible and displayed separately from performance score.

### 3.9 Deterministic Scoring Engine
- Consume validated ratings, Not Observed states, rubric version, role snapshot, weight-set version and eligible evidence.
- Apply explicit role/rubric weights.
- Exclude Not Observed dimensions only under approved denominator rules.
- Normalize applicable weights deterministically.
- Define minimum coverage/evidence requirements before final scoring.
- Define provisional/insufficient state when gates are not met.
- Define precision, rounding, null handling and error codes.
- Ensure same inputs and calculation version always produce same output.
- Do not mix official tournament points/placement/kills with internal player performance score.
- Do not infer performance from match outcome alone.
- Define 1–10 and 0–100 conversion explicitly before coding.
Important unresolved decision: a 1–10 rating mapped to 0–100 could use rating×10 or min-max mapping (rating−1)/9×100; these are not equivalent. Audit existing app conventions and get a documented decision before shipping.
Acceptance: deterministic tests prove identical output for identical versioned inputs; insufficient data never produces a misleading final score.

### 3.10 Score Snapshot & Calculation History
- Persist raw inputs, observed states, weights, rubric/dimension versions and evidence references.
- Persist role snapshot reference, coverage, score, normalized score and calculation version.
- Store timestamp and actor.
- Preserve prior snapshots when recalculating after corrections.
- Make historical results reproducible without relying on mutable current configuration.
- Record reason and actor for corrections/recalculation.
Acceptance: old score remains explainable after future rubric or role-weight changes.

### 3.11 Atomic Scoring RPC & Database Integrity
- Define transaction-safe calculation/save path.
- Add required foreign keys, checks, unique constraints and indexes.
- Ensure team and entity ownership consistency.
- Prevent duplicate submissions and duplicate calculation side effects.
- Use idempotency keys where appropriate.
- Handle concurrent edits/version conflicts.
- Roll back fully on failure; no partial score/evaluation state.
- Restrict direct table writes if RPC is the intended invariant boundary.
- Add database-level tests for constraints and transaction behavior.
Acceptance: scoring write is atomic, idempotent where specified, and cannot create inconsistent partial records.

### 3.12 Security, RLS & Permissions
- Define owner/coach/evaluator/player permissions explicitly.
- Enforce team isolation at database/RPC level, not only in UI.
- Restrict evidence creation, verification, editing and visibility by role.
- Restrict rubric/weight-set administration.
- Protect immutable historical snapshots.
- Validate RPC caller identity and search_path/security-definer behavior.
- Test signed-out, unrelated-team, team-member, player, coach and owner scenarios.
- Avoid exposing service-role secrets or bypassing RLS.
Acceptance: unauthorized reads/writes and cross-team access are denied in automated tests.

### 3.13 Scoring UI & Evaluation Experience
- Build a responsive evaluation workflow using existing design system.
- Show player, canonical session/match, role snapshot and rubric version.
- Render dimension criteria and rating controls.
- Provide explicit Not Observed / Not Applicable states where permitted.
- Add evidence creation, viewing and verification status.
- Show validation, coverage and provisional/insufficient states.
- Show weighted score only when eligible.
- Provide calculation history and prior evaluation comparison.
- Include loading, empty, error, retry, save and unsaved-change states.
- Support narrow Android, tablet and desktop.
- No hardcoded sample scores or fake evidence in production UI.
Acceptance: full real-data workflow works; UI cannot bypass backend validation.

### 3.14 Existing Module Integration
- Integrate with Evolution canonical session/match/roster/role snapshots.
- Integrate existing Scrims, Tournament, Training, Player, Evaluation and Analytics modules.
- Reuse existing data where semantics match; build explicit adapters/mappings where they do not.
- Keep official tournament result metrics separate from internal player evaluation scores.
- Avoid duplicate player/match/evaluation sources of truth.
- Preserve existing routes, permissions and behavior.
- Ensure historical evaluation uses historical role/session context.
Acceptance: an evaluation can be traced from player to canonical match/session and back without conflicting duplicate records.

### 3.15 Regression, Integration & Final Acceptance
- Unit tests for dimension validation, rubric versions, weights, Not Observed, coverage and deterministic scoring.
- Database migration, constraints, RPC and rollback tests.
- RLS and cross-team access tests.
- Evidence provenance and verification tests.
- Historical snapshot and recalculation tests.
- Integration tests across Scrims, Tournament, Training, Players and Evaluation.
- UI tests for loading/empty/error/validation/save states.
- Mobile/tablet/desktop regression.
- Typecheck and production build as CI checks only; no production deployment unless separately authorized.
- Verify latest branch head and exact commit for all checks.
- Record known limitations and unresolved decisions.
- Produce final acceptance report with test evidence.
Acceptance: every critical test passes; no feature is called complete based only on code presence or successful migration.

## 4. Completion protocol for each point

Default execution unit: one implementation point at a time.

For each point:
1. Inspect repository state and dependencies.
2. Confirm the point's exact scope and acceptance criteria.
3. Reuse existing code/schema where possible.
4. Implement all required layers (database, types, services, UI, permissions, tests, docs) that belong to that point.
5. Run relevant targeted tests, typecheck/build and regression checks.
6. Inspect changed files and migration safety.
7. Fix failures; do not call a failed check passed.
8. Verify the exact latest commit/branch, not a stale prior run.
9. Update this roadmap's progress/checkpoint section in the working feature branch.
10. Only then mark the point VERIFIED and begin the next dependent point.

Two small independent points may be combined only when their dependencies are already satisfied, changes remain reviewable, and all acceptance checks can be independently reported. Default remains one point per implementation cycle.

## 5. Global project guardrails

- Work in the existing Squad OS repository; do not create a replacement app.
- Do not use AppDeploy.
- Do not expose secrets or service-role keys.
- Preserve existing user/team/evaluation data.
- Prefer additive, reviewed migrations; never reset production data to simplify implementation.
- No production deployment, production promotion, or live production migration unless the user explicitly authorizes it.
- Do not bypass failed or missing required CI checks.
- Keep UI/data/permission behavior unchanged outside the point's approved scope.
- Do not claim tests, builds, migrations, PR merges or deployments that were not actually verified.
- Distinguish source implementation, local/CI verification, preview QA and production release.
- Use free-tier-compatible solutions unless the user approves paid services.

## 6. Persistent progress checkpoint (update after every work session)

Current Evolution Phase: 3
Current point: 3.1 Existing Evaluation System Audit
Current subtask: Read-only inventory, legacy crosswalk, branch/CI audit, gap-to-target report
Last verified completed point: 3.1 audit deliverables authored; CI pending exact audit PR head
Current status: AUDIT REPORT COMPLETE — CI PENDING
Active branch: feat/evolution-phase-three-1-existing-evaluation-audit
Active PR: to be created after audit contract and build registration
Last known commit: f5b81ecd39478a24d0b0f25e9f26c491431c90c3 (audit contract test; audit report commit 52e6f2f6b13ad94b55c48534311c777054e8f2b3)
Last successful checks: audit source-contract tests are registered; exact PR CI not yet run
Failing/pending checks: none recorded for this roadmap document
Files changed: docs/evolution/PHASE-3-1-EXISTING-EVALUATION-SYSTEM-AUDIT.md; scripts/verify-evolution-phase-three-1.mjs; package.json; this roadmap checkpoint
Migrations created/applied: none
Production changes: none
Next action: obtain exact-head CI for the 3.1 audit PR; then resolve Phase 2.12 and the pre-existing canonical scoring branch blockers before 3.2 implementation
Open blockers/decisions:
- Legacy product Phase 3 numbering is explicitly separated from Evolution Phase Three.
- Canonical six dimensions are reconciled to the Evolution Version 2 blueprint: communication, coordination_trade_support, decision_making, positioning, map_awareness_rotation, role_execution.
- Normalization is specified as weighted average × 10; minimum observed-dimension threshold is currently 4 in the unmerged candidate rubric and remains subject to final rubric acceptance.
- Existing legacy models remain non-comparable unless a reviewed mapping proves equivalence.
- Existing candidate Phase Three database integration fails due recursive RLS policy evaluation; active role-weight immutability and match/role evidence linkage also need correction.
- Phase 2.12 acceptance remains blocked; canonical downstream implementation must not be treated as fully integrated until its DB and device QA gates are resolved.

Update this checkpoint with exact facts after each implementation session. Never infer completion from a plan, commit title, PR title or code presence alone.

## 7. New-chat continuation prompt (copy all text below)

You are continuing work on Squad OS / Free Fire Squad, repository `parnav09/Free-fire-Squad-`, Evolution Phase 3.

AUTHORITATIVE ROADMAP:
Read `docs/evolution/EVOLUTION-PHASE-3-ROADMAP-AND-CHECKPOINT.md` from the latest branch/PR that contains it. This document defines all 15 Evolution Phase 3 points, scope, acceptance criteria, safety constraints and checkpoint protocol. Do not rely only on chat history.

MANDATORY RESUME PROCEDURE — DO THIS BEFORE ASKING THE USER ANYTHING:
1. Inspect the GitHub repository, open/closed PRs, relevant branches, latest commits, changed files and migration history.
2. Find the latest roadmap/checkpoint document and read its current progress section.
3. Identify the exact in-progress point and subtask from actual evidence: branch, PR, commit SHA, file diffs, TODOs, test output, workflow runs and review comments.
4. Verify whether the latest commit is actually present on the expected branch and whether later commits supersede it.
5. Check CI runs for the exact latest head SHA. Distinguish passed, failed, cancelled, skipped, pending and never-started jobs. Never treat a runner-start failure as a code test pass.
6. Inspect uncommitted/unmerged work and avoid overwriting or duplicating it.
7. Compare implementation with the point's acceptance checklist. Classify each item VERIFIED / IMPLEMENTED-UNVERIFIED / PARTIAL / MISSING / BLOCKED.
8. If work stopped mid-point, continue from the first incomplete item. Do not restart completed work and do not jump to the next point until the current point is fully implemented and verified.
9. If the prior point is actually complete, independently verify its evidence and then proceed to the next sequential point.
10. If evidence is unavailable, say exactly what cannot be verified and use repository evidence; do not invent a checkpoint or ask the user to repeat information already stored in GitHub.
11. Update the roadmap checkpoint after meaningful work and at the end of each session, including exact branch, PR, commit SHA, files, migrations, tests, CI run IDs/results, blockers and next action.
12. Report clearly what was done, what passed, what failed, what remains and the exact resume point.

EXECUTION RULE:
Work one implementation point at a time by default. Finish the point end-to-end (audit, schema, application code, permissions, tests, UI if in scope, docs and regression) before moving on. Combining two points is allowed only if they are small, independent and fully verifiable separately. Do not split work into superficial partial commits and call it complete.

NON-NEGOTIABLE:
- Do not use AppDeploy.
- Do not reset or delete existing production data.
- Do not deploy/promote to production or apply production migrations unless explicitly authorized.
- Do not bypass required CI or conceal failures.
- Do not expose secrets.
- Preserve existing app behavior outside the approved scope.
- Do not claim an implementation, test, migration, merge or deployment succeeded without tool evidence.
- Reconcile the Evolution Phase 3 naming with older product blueprints before coding; do not conflate their phase numbers.
- Audit existing five-category/nine-category evaluations before finalizing the proposed six dimensions; avoid duplicate systems.
- Keep internal tournament result points separate from player performance scores.

START HERE:
Perform the mandatory resume procedure. The roadmap currently records Phase 3 as roadmap-only and point 3.1 as not started unless newer repository evidence proves otherwise. Start/continue Evolution Phase 3.1 Existing Evaluation System Audit. Do not ask the user where work stopped until you have exhausted repository/PR/commit/CI/checkpoint evidence.
