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
**IMPLEMENTED AND VERIFIED — 2026-11-22.**
- Added team-scoped weight sets for an exact rubric version and canonical role, with sequential draft/active/retired versions.
- Added integer basis-point weights. Activation requires each applicable active rubric dimension exactly once and exactly 10,000 basis points total (100%); non-applicable dimensions must be omitted.
- Each weight row pins the exact canonical dimension-definition version used by the rubric. Published sets and rows are immutable; retirement closes the effective range and preserves history.
- Added immutable evaluation-context binding to the exact match role-assignment snapshot and exact rubric version. Explicit legacy role aliases are supported; unknown/unmapped role snapshots are rejected, and current team roles are never consulted.
- Weight-set effective dates cannot predate the weight-set creation time; a historical evaluation can bind a retired set only when the evaluation timestamp falls within that set's effective range.
- Added transaction-safe version allocation and serialization between draft weight edits and publication.
- Added team-scoped RLS, owner/coach administration, team-member reads of published/retired history, draft privacy, anonymous denial and direct mutation restrictions.
- Added typed validation, 17 source-contract tests, repeatable migration, disposable PostgreSQL integration harness and GitHub Actions/build-chain wiring.
- Point 3.6 adds no UI because it is a configuration/data-model point; the later evaluation UI point retains the existing dark theme/color grading, precise 44×44 CSS px hitboxes, alignment/no-collision and Android/tablet/laptop/desktop responsive gates.

**Exact-head acceptance**
- Tested PR head: `16058db847e144544ebb569f8d5853323754751a`.
- GitHub Actions run #45056896882: **SUCCESS** — https://github.com/parnav09/Free-fire-Squad-/actions/runs/45056896882.
- Phase 3.6 PostgreSQL integration, migration re-application, role/rubric versioning, exact totals, history, historical snapshot binding, RLS and ACLs: **PASS**.
- Phase 3.6 source-contract tests: **17/17 PASS**.
- Existing Phase 3.2–3.5 and Phase 2.2–2.10 database integrations, staged security checks, responsive UI/touch-target/permission/offline-write checks, screenshot upload, full regression, TypeScript typecheck and Vite production build: **PASS**.
- Existing non-fatal Vite chunk-size and dependency deprecation warnings remain; Vercel Preview separately reports a build-rate-limit failure.
- Verification fixes: qualified ambiguous dimension joins; corrected RLS-versus-trigger test expectations; fixed DELETE trigger OLD-team lookup; corrected SQL alias source assertions.
- No production migration, production deployment, data reset, merge to main or legacy backfill.

**Point 3.6 acceptance: VERIFIED.**

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
Current status: AUDIT REPORT COMPLETE — CI BLOCKED BY RUNNER STARTUP
Active branch: feat/evolution-phase-three-1-existing-evaluation-audit
Active PR: #131 — https://github.com/parnav09/Free-fire-Squad-/pull/131 (Draft, unmerged)
Latest checkpoint branch commit before this update: c015ab3f266258a2cd30db5857be53e9aacb340e; last implementation/CI-inspected commit: edeaa9ccb2624fc8263674a171f31b20bb19b524
Last successful checks: none verified on the exact PR #131 head; no workflow run is associated with checkpoint commit c015ab3f266258a2cd30db5857be53e9aacb340e
Failing/pending checks: GitHub Actions run #44736346581 (run #887) on checkpoint commit edeaa9ccb2624fc8263674a171f31b20bb19b524 completed with failure; job #136288591678 has steps: null (no runner steps). Log retrieval returned 404 BlobNotFound. Earlier run #44736214567 and #44735966399 also failed before runner steps. Vercel status remains build-rate-limit failure.
Files changed: docs/evolution/PHASE-3-1-EXISTING-EVALUATION-SYSTEM-AUDIT.md; scripts/verify-evolution-phase-three-1.mjs; package.json; this roadmap checkpoint
Migrations created/applied: none
Production changes: none
Next action: restore GitHub Actions runner availability, then rerun PR #131 on its latest head and require actual executed steps plus green audit contract/typecheck/build checks. Do not start 3.2 until 3.1 exact-head verification passes and Phase 2.12/canonical-scoring blockers are dispositioned.
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


## 8. Session update — 2026-11-22

- Re-inspected PR #131, the exact PR head, the current `main` package manifest, audit report, contract test, and GitHub Actions job metadata.
- Found and fixed a PR integration regression: the stale branch's `package.json` build script omitted the existing Evolution Phase One and Phase Two test commands present on current `main`. Restored the current `main` build/test pipeline and appended `test:evolution-phase-three-1`; no existing test commands were removed.
- Fix commit: `01cadd7e1343ffa6a7754f7aa24b5b5b806859dc`.
- Reconciled the feature branch with current `main` commit `5c2e9f6a46ec88d33059f5072acf469d032fadce` using merge commit `106ebfc43dcef632fa959a77eacfaf176d129260`. Compare result at that head: 12 commits ahead, 0 behind; only the intended four Phase 3.1 files differ from `main`.
- PR #131 remains open and Draft. No merge to `main`, no production deployment, no Supabase migration, and no data changes.
- CI remains NOT VERIFIED: prior exact-head runner jobs had zero executed steps; no workflow run is associated with merge commit `106ebfc43dcef632fa959a77eacfaf176d129260`. Do not mark 3.1 VERIFIED without a green exact-head run that executes the audit tests, all existing regression tests, typecheck and production build.
- No later Evolution point has been started. The recursive-RLS and active-role-weight immutability defects belong to the existing canonical scoring candidate and remain documented blockers for its implementation/acceptance, not changes made by read-only audit point 3.1.
- Next action: obtain a real exact-head GitHub Actions run with executed steps and green results when CI execution is permitted; otherwise keep 3.1 at AUDIT COMPLETE / CI UNVERIFIED.


## 9. Exact-head CI result — 2026-11-22

- GitHub Actions run: #45026365956 — https://github.com/parnav09/Free-fire-Squad-/actions/runs/45026365956
- Verified commit: `43f6a4c5f2e35097ab80e2f49ad79886e19642d0` (PR #131 head at run time).
- Workflow: SQUAD OS — Evolution Phase Two.1–2.12 Full Verification.
- Result: **SUCCESS**. Job completed; every listed step completed successfully.
- Completed checks included dependency installation, Chromium setup, disposable PostgreSQL startup, Phase 2.2–2.10 migration/integration checks, staged migration and ACL hardening, responsive UI/touch-target/permission/offline-write checks, screenshot upload, and the final typecheck/test/production-bundle step.
- The final build step invokes `npm run build`; the corrected `package.json` includes `npm run test:evolution-phase-three-1`, so all 9 Phase 3.1 audit contract tests were included in that successful build.
- At this exact head, 3.1's audit contract and full build pipeline passed. The separate canonical Evolution scoring candidate remains outside 3.1 and retains its separately documented recursive-RLS/role-weight immutability blockers; this run's Phase 2 PostgreSQL checks do not certify that separate candidate migration.
- This checkpoint-only update follows the verified code head and does not alter application code or test configuration. A new exact-head PR run should be observed for this final checkpoint commit before claiming the current PR head is green.


## 10. Evolution Phase 3.2 — Canonical Dimension Registry (2026-11-22)

**Status: IMPLEMENTED AND VERIFIED.**

- Active PR: #131 — https://github.com/parnav09/Free-fire-Squad-/pull/131 (single combined Evolution Phase Three PR; Draft, unmerged).
- Branch: `feat/evolution-phase-three-1-existing-evaluation-audit`.
- Exact tested code head: `203378e4664c4fe07dc738515b2a06c5860c8dbd`.
- GitHub Actions run #45027381290: **SUCCESS** — https://github.com/parnav09/Free-fire-Squad-/actions/runs/45027381290.
- Branch comparison: 24 commits ahead, 0 behind `main`; PR is mergeable.

### Implemented
- Added six stable canonical dimension IDs and a single shared TypeScript registry with versioned definitions, display labels, sort order, lifecycle state, six-role applicability and integer 0–10 rating metadata.
- Added safe key lookup and rating validation helpers.
- Added an additive, standalone PostgreSQL registry migration independent of the later Evidence/Rubric model migration.
- Added immutable definition-version and legacy-alias records, sequential version insertion, duplicate role-key rejection, active-order uniqueness, retirement timestamps, and prevention of retired-dimension reactivation/reordering.
- Added exact-semantic legacy aliases only; partial categories `coordination`, `trade_support`, `map_awareness` and `consistency` remain unmapped.
- Authenticated clients have read-only registry access; anonymous access and client writes are denied.
- Added 10 source-contract tests and a disposable PostgreSQL integration harness. The migration is applied twice in the harness to prove repeatability.
- Added the Phase 3.2 source tests to the normal `npm run build` chain and the PostgreSQL harness to GitHub Actions.

### Verification evidence
- Phase 3.2 PostgreSQL migration/invariant step: **PASS**.
- Existing Evolution Phase 2.2–2.10 PostgreSQL integration steps: **PASS**.
- Staged migration and trigger ACL checks: **PASS**.
- Responsive UI/touch-target/permission/offline-write checks: **PASS**.
- TypeScript typecheck: **PASS**.
- Existing regression/source-contract test chain: **PASS**.
- Phase 3.1 audit contract tests: **9/9 PASS**.
- Phase 3.2 registry contract tests: **10/10 PASS**.
- Vite production build: **PASS**. Existing chunk-size warning remains non-fatal (main JS chunk 383.56 kB / 95.32 kB gzip).
- All job steps completed successfully on the exact code head above.

### Problems found and resolved
1. Previous Point 3.2 PR #133 was stacked on an unmerged parent branch and its comparison with current `main` was 305 commits ahead / 15 behind. It was not safe to merge wholesale.
2. Its registry migration depended on the separate Evidence/Rubric base migration, which is not present on current `main` and belongs to a later implementation layer. Point 3.2 was isolated into a standalone registry migration.
3. The first draft's insert trigger would have rejected its own seed rows on migration re-application. The trigger now permits only an identical existing version for `ON CONFLICT DO NOTHING`; changed definitions remain rejected.
4. The PostgreSQL harness originally expected five rows after retirement even though retired rows must remain queryable. The assertion was corrected to expect all six historical registry entries.
5. The previous #133 CI failure was before runner steps and therefore supplied no test evidence. The consolidated #131 CI run executed all steps and passed.

### Safety and boundaries
- No production Supabase migration or backfill.
- No legacy evaluation/training score conversion or mutation.
- No production deployment, merge to `main`, Auth/RLS changes outside the new registry grants/policies, or data reset.
- Evidence model, provenance, rubric engine, role weights, scoring, snapshots and evaluation UI remain later points; they were not pulled into 3.2.
- Previous Point 3.1 remains verified; its tests also passed in the full run above.

**Next point:** 3.3 — Evidence Data Model. (This checkpoint is superseded by the session update below.)


## 11. Evolution Phase 3.3 — Evidence Data Model (2026-11-22)

**Status: IMPLEMENTED AND VERIFIED.**

- Active PR: #131 — https://github.com/parnav09/Free-fire-Squad-/pull/131 (single consolidated Evolution Phase Three PR; Draft, unmerged).
- Branch: feat/evolution-phase-three-1-existing-evaluation-audit.
- Point 3.3 migration: supabase/migrations/20261122140000_evolution_phase_three_3_evidence_data_model.sql.
- Added evidence context, stable identity, append-only version history and canonical dimension links.
- Evaluation contexts reference team/player membership, canonical session, canonical match and the exact player role-assignment snapshot. Session-only contexts remain valid without inventing match or role references.
- Evidence identity is immutable. Initial content creates version 1 automatically; later corrections append sequential immutable versions.
- VOD/match reference types require an HTTP(S) locator; no automatic VOD analysis or Storage attachment is implied.
- Dimension links reference exact Phase 3.2 dimension definition versions.
- RLS differentiates team-visible, coach-visible and author-private evidence; anonymous access and client update/delete privileges are denied.
- Added source-contract tests and a disposable PostgreSQL harness that runs the Phase 2.2–2.6 dependency chain, applies the Phase 3.2 registry, applies the Phase 3.3 migration twice and checks match/role linkage, version history, invalid references, team isolation, visibility and grants.
- Added Point 3.3 tests to the normal build chain and PostgreSQL integration to GitHub Actions.
- Added docs/evolution/PHASE-3-3-EVIDENCE-DATA-MODEL.md.
- No legacy score conversion/backfill, scoring engine, rubric version engine, production migration, data reset, production deployment or merge to main.
- No UI was added because Point 3.3 is a data-model point. A continuing UI acceptance standard is documented for all later UI points: preserve current dark theme/color grading; responsive Android/tablet/desktop QA; 44×44 CSS px hitboxes where practical; precise alignment; readable text/wrapping; role-aware visibility; accessible focus/names; loading/empty/error/retry/save states; automated touch-target checks and screenshot review.

**Verification state:** source and database harness have been added, but no CI run is yet associated with the latest PR head. Do not mark 3.3 VERIFIED until GitHub Actions executes all steps and passes on the exact latest head SHA. Fix all failures and rerun on the final head.

**Next action:** inspect the first exact-head CI run, fix any migration, test, RLS, typecheck, regression or build failures, update this checkpoint with the exact successful run and SHA, then mark Point 3.3 VERIFIED. Do not start 3.4 before that.


### Point 3.3 exact-head CI acceptance — 2026-11-22

- Tested code head: 5373d5e122148ff032161cebce3f10028eb8d61f.
- GitHub Actions run #45031066921: **SUCCESS** — https://github.com/parnav09/Free-fire-Squad-/actions/runs/45031066921.
- Point 3.3 PostgreSQL integration: **PASS**; the harness applied the 3.3 migration twice and verified the full Phase 2.2–2.6 canonical dependency chain, exact player/match/role references, version 1 creation, sequential immutable corrections, source-locator constraints, pending-only client creation, team/coach/private visibility, cross-team isolation and API grants.
- Point 3.3 source-contract tests: **12/12 PASS**.
- Private evidence write isolation: **PASS** — coaches cannot append content versions or dimension links to another author's private evidence.
- Point 3.2 PostgreSQL integration and 10/10 source tests: **PASS**.
- Point 3.1 audit tests: **9/9 PASS**.
- Existing Phase 2.2–2.10 PostgreSQL checks, staged migration and trigger ACL checks, responsive UI/touch-target/permission/offline-write checks, full regression chain, TypeScript typecheck and Vite production build: **PASS**.
- Non-fatal existing Vite bundle-size warning remains.
- Defects fixed before the successful run: policy migration repeatability, server-side initial version seeding, incorrect player visibility fixture, PostgreSQL DO block delimiters, expected RLS/privilege-denial handling and author-only writes for private evidence.
- No production migration, data conversion/backfill, production deployment, merge or reset occurred.

**Point 3.3 acceptance: VERIFIED.** Do not begin Point 3.4 until the checkpoint-only commit is also checked by the full workflow, then proceed one point at a time.


## 12. Evolution Phase 3.4 — Evidence Provenance & Verification (2026-11-22)

**Status: IMPLEMENTED AND VERIFIED.**

- Active PR: #131 — single consolidated Evolution Phase Three PR, Draft/unmerged.
- Migration: `supabase/migrations/20261122150000_evolution_phase_three_4_evidence_provenance_verification.sql`.
- Added an append-only provenance/adjudication event ledger. Existing Phase 3.3 evidence identity and content are not mutated.
- Existing evidence receives an initial pending event; future evidence receives the same event automatically.
- Allowed transitions: pending → verified/rejected/corrected/archived; verified → corrected/archived; rejected → corrected/archived; corrected → pending/verified/rejected/archived; archived is terminal.
- Rejection, correction and archival require a meaningful reason.
- Only active team owners/coaches may adjudicate; the evidence author cannot adjudicate their own evidence; private evidence cannot be adjudicated by another team member.
- Transitions are serialized and stale state writes are rejected. Corrections must reference the latest newly appended evidence version and cannot reuse a previously adjudicated version.
- Added current-status view with creator/verifier attribution and an advisory duplicate-candidate RPC. Duplicate candidates are never automatically merged or deleted.
- Event history inherits Phase 3.3 evidence visibility through RLS. Authenticated clients can read events but cannot write directly; the guarded RPC is the only client transition path. Anonymous RPC execution is denied.
- Added source-contract tests, disposable PostgreSQL integration, normal build-chain integration, GitHub Actions database verification and `docs/evolution/PHASE-3-4-EVIDENCE-PROVENANCE-VERIFICATION.md`.
- No score/rubric/weight/coverage/snapshot logic, new UI surface, production migration, data reset, production deployment or merge to main.

### Point 3.4 acceptance checks

- Apply Phase 3.4 migration twice after the Phase 3.3 disposable dependency chain.
- Verify initial pending-state backfill and automatic seeding for future evidence.
- Verify coach verification, author self-verification denial, player denial and private-evidence denial.
- Verify correction event links the latest appended evidence version; invalid/missing reasons and invalid transitions fail.
- Verify duplicate lookup is advisory and non-destructive.
- Verify event ledger is append-only, authenticated direct writes and anonymous RPC execution are denied.
- Run complete source-contract, PostgreSQL, typecheck, regression, responsive UI/touch-target and Vite production build checks on the exact latest PR head.

### Exact-head CI acceptance

- Tested code head: `be33196f2008127c141b93bd4bf343f9f41d31ef`.
- GitHub Actions run #45033317911: **SUCCESS** — https://github.com/parnav09/Free-fire-Squad-/actions/runs/45033317911.
- Point 3.4 disposable PostgreSQL integration: **PASS**, including migration re-application, pending event seeding, coach verification, correction version linkage, return-to-pending, rejection reason enforcement, terminal archival, private evidence denial, author self-verification denial, player denial, duplicate candidate lookup without merging, direct event write denial and anonymous ACLs.
- Point 3.4 source-contract tests: **12/12 PASS**.
- Phase 3.2 and 3.3 PostgreSQL integrations, Phase 2.2–2.10 database checks, staged migration/trigger ACL checks, responsive UI/touch-target/permission/offline-write checks, screenshot upload, full regression/source tests, TypeScript typecheck and Vite production build: **PASS**.
- Existing non-fatal Vite chunk-size warning remains.
- One source-contract assertion wording mismatch was corrected after the first run; the Phase 3.4 PostgreSQL integration passed on that first run. The final exact-head run passed all checks.

**Point 3.4 acceptance: VERIFIED.**

**Next point:** 3.5 — Versioned Rubric Engine. (Superseded by the implementation checkpoint in Section 13.)


## 13. Evolution Phase 3.5 — Versioned Rubric Engine (2026-11-22)

**Status: IMPLEMENTED AND VERIFIED.**

- Active PR: #131 — the single consolidated Evolution Phase Three PR; Draft/unmerged.
- Branch: feat/evolution-phase-three-1-existing-evaluation-audit.
- Migration: supabase/migrations/20261122160000_evolution_phase_three_5_versioned_rubric_engine.sql.
- Added stable team-scoped rubric identities and sequential rubric-version records.
- Added draft, active and retired lifecycle enforcement. Only active team owners/coaches may create or manage rubric definitions.
- Draft versions remain editable. Activation publishes an immutable version only after every active canonical dimension has complete criteria and eleven explicit 0–10 text anchors.
- Criteria reference the exact Phase 3.2 canonical dimension-definition version. Optional role guidance is checked against that definition's applicable canonical roles.
- Effective start/end dates and publication/retirement actor timestamps are retained. A rubric identity may have only one active version at a time.
- Added immutable evaluation-context-to-rubric-version bindings. A binding accepts only the active version effective when the context was created; one context cannot be rebound to another rubric version.
- Added team-scoped RLS and grants: active team members can read active and retired published rubric content for historical interpretation; active owners/coaches can manage drafts and lifecycle transitions; anonymous reads and direct mutation of published/bound records are denied.
- Added src/lib/evolution-rubrics.ts using the existing canonical dimension and role registry; no duplicate registry was introduced.
- Added scripts/verify-evolution-phase-three-5.mjs and scripts/verify-evolution-phase-three-5-db.sh. The PostgreSQL harness chains from the Phase 3.4 disposable integration, applies the new migration twice, and tests publication, version progression, immutable history, effective dates, exact binding, invalid anchors/roles, RLS and grants.
- Added the Phase 3.5 source test to npm run build and its disposable PostgreSQL harness to GitHub Actions.
- Added docs/evolution/PHASE-3-5-VERSIONED-RUBRIC-ENGINE.md.
- No scoring formula, role weights, evidence coverage calculator, score snapshots, evaluation UI, legacy conversion, production migration, production deployment, merge to main or data reset.

### Exact-head acceptance — 2026-11-22

- Tested PR head: 7fead06b13da3a937c1fff619809859c234db28a.
- GitHub Actions run #45053929515: **SUCCESS** — https://github.com/parnav09/Free-fire-Squad-/actions/runs/45053929515.
- Phase 3.5 disposable PostgreSQL integration: **PASS**. The migration was applied twice after the Phase 3.4 dependency chain.
- Database acceptance: complete six-dimension publication; all eleven 0–10 anchors; invalid anchor/role rejection; serialized sequential version creation; one active version per rubric; effective dates; immutable active/retired history; exact immutable evaluation-context binding; duplicate binding denial; team isolation; coach/player RLS; retired published rubric history remains readable; anonymous/direct-write denial.
- Point 3.5 source-contract tests: **13/13 PASS**.
- Phase 3.2–3.4 and Phase 2.2–2.10 PostgreSQL integrations: **PASS**.
- Staged migration and security-trigger ACL checks: **PASS**.
- Responsive UI/touch-target/permission/offline-write checks: **PASS**; responsive screenshots uploaded.
- Full regression/source-contract suite and TypeScript typecheck: **PASS**.
- Vite production build: **PASS**. Existing non-fatal chunk-size warning remains.
- Verification defects fixed before the successful run: corrected a PL/pgSQL trigger CASE-expression syntax error; corrected a database assertion that expected an exception where RLS correctly filtered a published-criteria update. The final test verifies zero updated rows and unchanged historical criteria.
- No production migration, data reset, merge to main or production deployment occurred.

**Point 3.5 acceptance: VERIFIED.**

**Next point:** 3.6 — Role-Based Weight Configuration. Do not begin it until explicitly requested.


---

## Point 3.7 checkpoint — Not Observed & Missing Data Rules

**IMPLEMENTED AND VERIFIED — exact PR head CI run #45059143040 succeeded.** Point 3.7 is the next Evolution Phase Three point after verified 3.6.

- Added append-only per-dimension assessment events with serialized revisions and exact context, rubric, historical role-weight and dimension-definition binding.
- Added distinct states: Observed (integer 0–10; zero is valid), Not Observed, Not Applicable, Incomplete and Rejected Evidence. A dimension with no assessment event remains Missing.
- Observed ratings require evidence linked to the same context and exact dimension; rejected/archived evidence cannot support an observed rating.
- Not Applicable is accepted only for dimensions excluded from the historical role's active weight set.
- Added current-state and readiness views. Readiness distinguishes Draft, Provisional, Insufficient and Final; Final means complete verified assessment dispositions only, not a score or score-eligibility promise.
- No weighted score, coverage percentage, score snapshot or legacy backfill is introduced. Points 3.8 and 3.9 remain separate.
- No UI controls were added because this point is data integrity only; existing dark theme/color grading, layout and responsive UI remain unchanged.

**Verification evidence (2026-11-23):** exact PR head `628934b68f8c7c16fe9cfb5736a4e9cb89a27adf`; GitHub Actions run [#45059143040](https://github.com/parnav09/Free-fire-Squad-/actions/runs/45059143040) succeeded. The disposable PostgreSQL harness reapplied the migration twice and reported `Evolution Phase 3.7 Not Observed & Missing Data PostgreSQL PASS`; all 9 Phase 3.7 source-contract tests passed (9/9); TypeScript typecheck and the full production build/test chain passed. The responsive UI/touch-target/permissions/offline-write acceptance step and screenshot upload also passed. Existing non-fatal Vite chunk-size and dependency/Actions deprecation warnings remain; no Phase 3.7 test failed.


---

## Point 3.8 checkpoint — Evidence Coverage Calculator

**IMPLEMENTED — verification intentionally deferred to the next user-requested step.**

- Added `src/lib/evolution-evidence-coverage.ts` with typed, deterministic coverage calculation.
- Denominator is the exact historical role-weight set bound to the evaluation context; numerator counts applicable dimensions with a current Observed assessment and Pending, Verified or Corrected evidence.
- Not Observed remains in the denominator; Not Applicable dimensions must already be excluded by the bound role configuration. Missing, Incomplete and Rejected Evidence remain distinct.
- Verified and unverified observed evidence are reported separately. Coverage is rounded to 0.01 percentage point using integer basis points.
- Status contract: Complete requires 100% observed coverage and all supporting evidence Verified; Partial means at least one valid observed dimension but not Complete; Insufficient means no applicable dimensions or no valid observed dimensions.
- Added calculation version `evidence-coverage-v1`, exact input snapshots, MD5 input fingerprint for idempotent retries, append-only snapshots and owner/coach-only access to raw evidence references.
- Added the Phase 3.8 PostgreSQL migration, source test, disposable database harness, npm build-chain registration, GitHub Actions database step and implementation report.
- No performance score, score snapshot, tournament metrics, legacy backfill or UI changes. Existing visual design, color grading, controls and hitboxes remain unchanged.
- No production migration, data reset, merge to main or production deployment.

**Verification status:** Not run by design in this implementation step. The next requested verification must run the Phase 3.8 source tests, apply/reapply its migration through the Phase 3.7 dependency harness, exercise snapshot idempotency/ACL/immutability, and run the complete CI/build chain.


### Point 3.8 verification checkpoint

- Phase 3.8 PostgreSQL migration replayed twice in the isolated disposable CI database: PASS.
- Database integration: `Evolution Phase 3.8 evidence coverage calculator PostgreSQL PASS`.
- Phase 3.8 source-contract tests: 8/8 PASS.
- PostgreSQL behavior checked: historical binding lookup, calculation output/count consistency, deterministic idempotent repeat, immutable snapshots, restricted insert/update/delete and anonymous read ACLs.
- Full workflow #45060071552: SUCCESS on exact PR head `e514de2d9317948fd77069cfb7a7422904ce715b`.
- Typecheck, full source-test chain, responsive UI/touch-target/permission/offline-write checks, screenshot artifact and production build: PASS.
- Non-fatal warnings: Vite 383.56 kB main JS chunk, punycode deprecation, GitHub Actions Node 20 deprecation.
- Vercel check remains separate and failed on build-rate-limit; Preview deployment is not verified.
- No main merge, production migration, production deployment or data reset.


### Point 3.8 final verification and consistency fix

Manual comparison of the TypeScript and SQL implementations found a classification mismatch for Observed assessments backed by rejected/archived/missing evidence. Fixed the TypeScript implementation to classify these in the rejected-evidence bucket, matching PostgreSQL; unknown evidence states still fail closed. Added explicit source tests for the rejected/archived/missing cases.

- Follow-up full workflow #45060733258: **SUCCESS** on code head `65c8c5daebb5d93b05916c87ba008738a853b79c`.
- Phase 3.8 source-contract tests: 8/8 PASS.
- Phase 3.8 PostgreSQL migration replay twice and integration: PASS.
- Full typecheck, all repository tests, responsive UI/touch-target/permission/offline-write checks, screenshot upload and production build: PASS.
- Remaining warnings are non-fatal: Vite main chunk 383.56 kB > 250 kB; `punycode` deprecation; GitHub Actions Node 20 action deprecation.
- Vercel Preview is not covered by this workflow and remains unverified because of the earlier build-rate-limit failure.


---

## Point 3.9 implementation checkpoint — Deterministic Scoring Engine

**Status: IMPLEMENTED AND VERIFIED.**

- Implemented the pure deterministic score engine using the Evolution v2 canonical formula: weighted average of eligible 0–10 dimension ratings, normalized to 0–100.
- Added a versioned policy v1 with a 50% minimum evidence-coverage gate, integer half-up rounding to two decimal places, and separate final/provisional/insufficient outcomes.
- Not Observed remains in the coverage denominator but is excluded from the score denominator. Missing, Incomplete, Rejected, Archived and mismatched evidence never silently become zero.
- Final score requires the coverage gate, exact historical context/rubric/role-weight binding, eligible observed evidence, and final assessment readiness. Pending/Corrected evidence may only yield a provisional candidate.
- Retained exact rational score numerator/denominator for deterministic recomputation; no tournament outcome, kills, placement or match-points are inputs.
- Added `docs/evolution/PHASE-3-9-DETERMINISTIC-SCORING-ENGINE.md`, an executable 3.9 behavior suite, npm build-chain registration and the consolidated CI workflow update.
- No database migration, score snapshot, legacy conversion/backfill, UI change, production migration, data reset, merge to main or production deployment.

**Verification status: PASS on the exact PR head.** Commit `66898956a1630c5b436d76bd53ac6113f4b3d85f`; GitHub Actions run [45071794146](https://github.com/parnav09/Free-fire-Squad-/actions/runs/45071794146) completed with `success`. The dedicated Phase 3.9 suite passed **23/23** tests (0 failures). TypeScript, the full existing regression/build chain, PostgreSQL integration checks for Phase 3.2–3.8 and the applicable Phase 2 migrations, responsive UI/touch-target/permission/offline-write acceptance, screenshot upload and Vite production build all passed on this exact commit.


---

## Point 3.10 — Score Snapshot & Calculation History

**Status: IMPLEMENTED AND VERIFIED — exact code PR head `5097e581594761b3c46ac79cd8034e2ec6aeeda1`; GitHub Actions PR workflow #45073773602 SUCCESS.**

- Added additive migration `20261122200000_evolution_phase_three_10_score_snapshot_history.sql` and immutable `evolution_player_score_snapshots`.
- Added server-side `calculate_evolution_player_score_snapshot(uuid,text)`, which persists exact evaluation/player/role-snapshot, rubric version, role-weight set, calculation/policy versions, raw assessment/evidence inputs, deterministic score/coverage/status, exact rational values, reasons, actor and timestamp.
- Raw input JSON captures rubric criteria and rating anchors, dimension-definition versions, role weights, assessment revisions/states/ratings, evidence identities, current verification state, evidence-version reference and immutable evidence content metadata.
- Final, Provisional and Insufficient outputs are stored in separate constrained score columns. Insufficient results never expose a final or provisional score.
- Identical input fingerprints return the existing snapshot. Changed inputs append a new snapshot linked to the prior one and require a 3–1000 character `recalculation_reason`; old snapshots are immutable and remain explainable.
- Added transaction-scoped per-context locking, unique idempotency constraints, composite team/context/rubric/weight/role foreign keys, owner/coach-only RLS reads and denial of direct client writes.
- Private evidence authored by another member fails closed. No tournament outcomes are score inputs.
- Added the Phase 3.10 PostgreSQL migration replay/integration harness, source-contract tests, npm build-chain test, GitHub Actions database step and implementation report.
- No legacy score backfill/conversion, production migration, data reset, UI change, merge to main or production deployment.

**Exact-head verification result**
- GitHub Actions PR workflow [#45073773602](https://github.com/parnav09/Free-fire-Squad-/actions/runs/45073773602): **SUCCESS** on exact code head `5097e581594761b3c46ac79cd8034e2ec6aeeda1`.
- GitHub Actions push workflow [#45073771107](https://github.com/parnav09/Free-fire-Squad-/actions/runs/45073771107): **SUCCESS** on the same commit.
- Phase 3.10 source-contract suite: **17/17 PASS**, 0 failures.
- Disposable PostgreSQL harness: **PASS**; migration replayed twice. Final/provisional/insufficient outcomes, idempotent retries, required recalculation reason, linked history, prior snapshot immutability, exact evidence-version/link provenance, and RLS/ACL checks passed.
- Full TypeScript, repository regression/build chain, Phase 2 and Phase 3.2–3.8 PostgreSQL integrations, responsive UI/touch-target/permission/offline-write checks, screenshot artifact and Vite production build: **PASS**.
- No production migration, production data write, legacy backfill, data reset, merge to main or production deployment occurred.



---

## Point 3.11 — Atomic Scoring RPC & Database Integrity

**Status: IMPLEMENTED AND VERIFIED — exact PR head `65e862f13f8047cd62cfcc008e0b45cbd720a394`; GitHub Actions PR workflow #45076780236 and push workflow #45076776854 both SUCCESS.**

- Added additive migration `20261122210000_evolution_phase_three_11_atomic_scoring_integrity.sql`.
- Added one shared transaction-scoped advisory lock per evaluation context. The Phase 3.10 scoring RPC and all writes that change scoring inputs now use the same lock.
- Evidence identity inserts lock before becoming visible; evidence content-version inserts, evidence verification/status events and assessment revision events serialize on the same context lock.
- The calculator holds shared row locks on the exact evaluation context/role snapshot, active owner/coach membership authorization, historical rubric version and historical role-weight-set lifecycle rows.
- The transaction lock remains held through the score snapshot insert and is released automatically on commit/rollback. Concurrent evidence or assessment writes cannot interleave with the calculation's input read and produce a mixed-state snapshot.
- Added a partial unique index that prevents two child snapshots from branching from one prior snapshot.
- Added helper/trigger ACL hardening, source-contract tests, disposable PostgreSQL concurrency harness (`scripts/verify-evolution-phase-three-11-db.sh`), npm build-chain registration and GitHub Actions integration.
- No legacy evaluation/evidence/score data rewrite, backfill, UI change, production migration, data reset, merge to main or production deployment.

**Exact-head verification result**
- Phase 3.11 source-contract suite: **19/19 PASS**, 0 failures.
- Isolated disposable PostgreSQL harness: **PASS**; migration replayed twice, all four score-input lock triggers enabled, shared lock key parity verified, historical configuration/membership row locks verified, concurrent lock blocking and transaction-end release verified, single-child history index and helper/RPC ACLs verified.
- Full TypeScript typecheck, repository regression suite, Phase 2 and Phase 3.2–3.10 database integrations, responsive UI/touch-target/permission/offline-write acceptance, screenshot upload and Vite production build: **PASS**.
- PR workflow [#45076780236](https://github.com/parnav09/Free-fire-Squad-/actions/runs/45076780236) and push workflow [#45076776854](https://github.com/parnav09/Free-fire-Squad-/actions/runs/45076776854): **SUCCESS** on exact PR head `65e862f13f8047cd62cfcc008e0b45cbd720a394`.
- Existing non-fatal Vite chunk-size, punycode and GitHub Actions Node 20 warnings remain.
- No production migration, production data write, legacy backfill, data reset, UI change, merge to main or production deployment occurred.


---

## Point 3.12 — Security, RLS & Permissions

**Implementation and verification complete on the feature branch.**

- Added a source-contract suite covering all Phase 3.2–3.11 SQL migrations: RLS and explicit policies across all 18 Phase 3-owned tables; fixed empty `search_path` on all 27 SECURITY DEFINER definitions; revoked client execution on all 24 private helpers; explicit authenticated grants and anonymous-execution denial for public SECURITY DEFINER RPCs; and caller-context security for all 3 Evolution read views.
- Added an isolated PostgreSQL catalog audit that rebuilds the Phase 3.2–3.11 dependency chain and verifies RLS, explicit policies, no anon/PUBLIC policy exposure, no anon table/view privileges, no client access to the private schema, security-invoker views, fixed definer search paths and function execution ACLs.
- Registered Phase 3.12 source tests in `npm run build` and its disposable PostgreSQL audit in the consolidated GitHub Actions workflow.
- Added `docs/evolution/PHASE-3-12-SECURITY-RLS-PERMISSIONS.md` with the security contract, scope and acceptance boundary.
- **Exact-head CI verification passed:** push run [#45084488305](https://github.com/parnav09/Free-fire-Squad-/actions/runs/45084488305) and PR run [#45084493225](https://github.com/parnav09/Free-fire-Squad-/actions/runs/45084493225), both successful on commit `8c16ab99d73d68fea203b49eedc27fa86cfdb934`. Phase 3.12 source tests (9/9), PostgreSQL security/RLS audit, full regression/build chain and production bundle all passed.
- **Important source-of-truth constraint:** the existing security review records that live Supabase migration history is not fully represented by checked-in migration files. This point deliberately does not invent a production migration baseline or mutate live policies/grants. The audit runs against a disposable CI database. Production schema/grant remediation remains blocked until live migration history and schema are reconciled.
- No production migration, data write, legacy backfill, data reset, merge to main or production deployment.

**Verification:** PASS on the exact latest PR head. Phase 3.12 is implemented and CI-verified; PR #131 remains draft/open and is not merged.


---

## Point 3.13 implementation checkpoint — Scoring UI & Evaluation Experience

**Status: IMPLEMENTED ON FEATURE BRANCH — exact-head CI verification pending.**

- Added a dedicated canonical Evaluation workspace and mounted it in the existing Evaluation module. The legacy five-dimension daily form and feedback inbox remain available in a collapsed compatibility section; no legacy records are converted or deleted.
- The creation flow selects an existing canonical session, canonical match and assigned historical match-role snapshot. Unknown/unmapped roles are excluded; the current roster role is never substituted.
- New contexts pin the exact active/effective rubric version and matching active/effective role-weight set. If no valid configuration exists, the workflow fails closed with a setup message rather than inventing a rubric or weights.
- Added dimension assessment controls for Observed (0–10, including zero), Not Observed, Incomplete and Rejected Evidence. Non-observed states require a reason; observed ratings require dimension-linked evidence.
- Added evidence creation, dimension linkage, visibility, evidence register and separate verification through the existing owner/coach verification RPC.
- Added readiness, independent evidence coverage, database-authoritative deterministic score calculation, final/provisional/insufficient states and immutable snapshot history. Recalculation requires a reason.
- Added responsive dark-theme styling with 44px minimum action/input hitboxes and narrow-phone/tablet breakpoints.
- Added scripts/verify-evolution-phase-three-13.mjs, registered it in the full build chain and added a dedicated GitHub Actions step.
- Added docs/evolution/PHASE-3-13-SCORING-UI-EVALUATION-EXPERIENCE.md.
- No new SQL migration, legacy conversion/backfill, fake score/evidence/rubric seed, production migration, live data write, merge to main or production deployment.

**Verification still required:** exact latest PR-head source tests, full typecheck/regression/build, responsive browser checks and screenshot review. Do not mark Point 3.13 VERIFIED until the exact latest commit passes GitHub Actions and any failures are fixed and rerun.


## 12. Evolution Phase 3.14 — Existing Module Integration (2026-11-23)

**Status: IMPLEMENTED AND VERIFIED — exact-head CI PASS.**

- Existing Scrims, Tournament and Training records continue to link through the Phase 2.9 server-authoritative, idempotent `integrate_canonical_source` adapter; Planning remains a plan until explicit Training promotion.
- Evaluation contexts continue to bind the exact canonical session, match and historical match-role snapshot from Phase 3.13.
- Added a shared read-only lineage panel in Player / Weekly Review / Player Trends and Analytics.
- The panel separately lists linked source sessions and player evaluation contexts. Training source sessions are therefore visible even though they do not have competitive matches or Phase 3.13 match-role evaluation contexts.
- Resolves canonical source record, session, match, player, historical role and latest immutable score snapshot. Final/provisional/insufficient score state and evidence coverage remain separate.
- Archived sessions remain visible. Reads use team-scoped RLS and stable 500-row pagination; there are no silent fixed-row cutoffs.
- The canonical session ledger and existing Scrims/Tournament/Training source-link picker also paginate, removing the prior 250-session and 100-source-row cutoffs. Their full-history lists are contained in bounded scroll regions.
- Added explicit loading, empty, error and retry states. Failed refreshes and team switches clear stale rows.
- Existing staff-only score snapshot RLS remains unchanged. Member views gracefully show source/evaluation lineage while marking restricted score history unavailable.
- Competitive results remain separate: kills, placement, Booyah and tournament points are never internal player-performance score inputs.
- Added expanded Phase 3.14 source-contract coverage for adapter wiring, exact historical role identity, paginated reads, Training source visibility, archived history, retry recovery, read-only behavior, responsive hit targets and score-domain separation.
- Updated the consolidated GitHub Actions workflow label to Phase 3.14.
- No new database migration is needed; existing Phase 2.9 source mapping and Phase 3.13 context schema already provide the required lineage. No production migration, live data write, legacy conversion/backfill, data reset, merge to main or production deployment.

**Training boundary:** the current scored evaluation context requires a canonical competitive match and its assigned historical match-role snapshot. Phase 3.14 exposes Training as a linked canonical source session without fabricating a match or role. A future training-specific scoring workflow requires an independently approved session-level role/roster binding contract.

**Exact-head verification: PASS** on implementation commit `493d2affa639abd451a208165752c61468ee2874`. GitHub Actions push run [#1640](https://github.com/parnav09/Free-fire-Squad-/actions/runs/45174525390) and PR run [#1641](https://github.com/parnav09/Free-fire-Squad-/actions/runs/45174534373) both succeeded with 40/40 steps. Dedicated Phase 3.14 contracts, the five-viewport Playwright harness, pagination/retry/member-RLS checks, screenshot upload, full repository regression chain, TypeScript and Vite production build all passed. Earlier stale assertions and exact-head environment propagation defects were fixed and rerun; no failure was waived.

**Acceptance:** a player evaluation can be traced to its player, canonical match/session, exact historical role snapshot and source module; source sessions without evaluations remain visible without being misrepresented as evaluated matches.


---

## 13. Evolution Phase 3.15 — Regression, Integration & Final Acceptance

**Implementation status: acceptance gate and report added; exact-head CI result is pending until this commit's workflow completes.**

### Acceptance gate

- Added `scripts/verify-evolution-phase-three-15.mjs` as a dedicated final acceptance contract.
- The gate checks that every Phase 3.1–3.14 source-contract suite is registered, present and executed in strict numeric order by the production build chain.
- The gate checks that all Phase 3.1–3.14 implementation reports exist and that every applicable isolated PostgreSQL migration harness is present and wired into the consolidated workflow.
- The gate checks the Phase 3.13 atomic evaluation-context database test, Phase 3.14 cross-module integration contract, and the 3.14 Playwright responsive browser harness.
- The browser acceptance contract covers 390px phone, 768px tablet portrait, 1024px tablet landscape, 1280px laptop and 1440px desktop; it verifies 502-row pagination, source lineage, archived history, retry recovery, staff-only score access and screenshot artifacts.
- The gate checks the consolidated workflow's exact PR-head SHA input. For pull requests it must match `github.event.pull_request.head.sha`; for push events it must match the pushed commit SHA. A missing or mismatched SHA fails closed.
- Registered the 3.15 contract in both `npm run build` and the consolidated GitHub Actions workflow before the production bundle step.
- Added `docs/evolution/PHASE-3-15-FINAL-ACCEPTANCE.md` as the point-specific acceptance report.

### Required acceptance layers

1. Source contracts and typecheck for the complete Phase 3.1–3.14 implementation.
2. Applicable additive migration replay and disposable PostgreSQL integration for Phase 3.2–3.8, 3.10–3.13.
3. Database constraints, immutable history, idempotency, atomic rollback/concurrency and RPC ACL checks covered by the dedicated database harnesses.
4. RLS, team isolation, anonymous denial and owner/coach/member access checks.
5. Scrims, Tournament, Training, Player, Evaluation and Analytics lineage integration.
6. Responsive browser regression, pagination, retry/error recovery, touch-target checks and screenshot artifact creation.
7. Complete repository regression chain, TypeScript typecheck and Vite production build.
8. Exact latest PR-head or push-SHA verification; stale/cancelled runs do not count.

### Explicit release boundaries

- This gate verifies repository code and disposable CI databases. It does not assert that the live Supabase schema/migration history has been reconciled; the Phase 3.12 production migration source-of-truth mismatch remains a release blocker until separately audited and explicitly authorized.
- Training source sessions are integrated and visible, but Phase 3.13 scoring still requires a canonical competitive match and historical match-role snapshot. No phantom Training match/role is created.
- Vercel Preview/deployment status is reported separately from GitHub Actions acceptance. A Vercel rate-limit or deployment failure cannot be represented as a passing preview.
- No production migration, live data write, data reset, legacy backfill, merge to main or production deployment is authorized by Phase 3.15.

**Acceptance rule:** Point 3.15 can be marked VERIFIED only when the dedicated final-acceptance suite and the complete GitHub Actions workflow succeed on the exact current PR head, all required screenshot artifacts exist, and no failure is waived or hidden.
