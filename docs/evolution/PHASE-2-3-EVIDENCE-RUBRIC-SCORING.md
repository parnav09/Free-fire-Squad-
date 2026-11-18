# Evolution Phase 2.3 — Evidence, Canonical Rubric & Scoring Engine

**Blueprint mapping:** Evolution Phase Three (dependency graph §23.1)  
**Status:** Implementation branch · CI pending  
**Branch:** feat/evolution-phase-two-3-evidence-rubric-scoring  
**Parent:** feat/evolution-phase-two-2-canonical-session-identity  
**Scope:** Evidence metadata/privacy, versioned six-dimension rubric, neutral role-weight profiles, deterministic scoring contract, coverage/confidence/comparability and legacy conversion metadata.

## 1. Dependency and scope decision

Phase 2.2 supplies canonical session UUIDs and same-team source mapping. This point builds the evidence and scoring contracts consumed by the later atomic Daily Evaluation workflow.

This point does not create an evaluation-submission workflow. That is Evolution Phase Four. It does not add the Evaluation UI, match evaluation pages, task generation, trends dashboards, production deployment, or a production migration.

The existing PlayerEvaluationRubric remains a legacy training rubric and is not silently re-labelled as the canonical Evolution rubric. Existing five-dimension Daily Scores and training results remain unchanged.

## 2. Database deliverables

Migration: supabase/migrations/20261119130000_evolution_phase_three_evidence_rubric_scoring.sql

### Versioned rubric

- evolution_rubric_versions stores version code, lifecycle state, scoring-engine version and a configurable minimum observed-dimension count.
- System rubric EV2-1.0 is seeded with six canonical dimensions.
- System rubric rows are immutable to client roles.
- Team-specific draft rubric versions can be authored by active Owner/Coach memberships. Activation requires exactly six unique canonical dimensions.
- Dimension keys are stable: communication, coordination_trade_support, decision_making, positioning, map_awareness_rotation, role_execution.

### Role weights

- evolution_role_weight_profiles stores versioned JSON weight maps per role.
- Initial system profiles use neutral 1.0 weights for all six dimensions. This intentionally avoids inventing role-specific advantages before the team approves evidence-backed weights.
- Weight maps must contain exactly the six canonical keys, finite non-negative numeric values, and a positive total.
- Team-specific profiles can be drafted by active Owner/Coach memberships against an active team rubric. Activated profiles are immutable; changes require a new version.

### Evidence

- evolution_evidence_items stores team/player/session-linked evidence metadata, source type, occurrence context and explicit visibility.
- Same-team composite foreign keys protect player membership and canonical session references.
- Visibility states are team, coaches, and private. The author can read their own evidence; other members see only team-visible items; Owner/Coach roles can read coach-visible items; private items are author-only.
- Evidence records are not hard-deleted or edited after creation. Active Owner/Coach members may soft-archive with actor and reason.
- evolution_evidence_dimension_links attaches evidence to a dimension in one exact rubric version.
- External VOD/media is referenced as metadata only; no automated observation or invented telemetry is claimed.

## 3. Scoring-engine deliverables

Pure TypeScript module: src/lib/evolution-scoring.ts.

- Six explicit dimension observation states.
- A rated value accepts integer 0–10, including a real observed zero.
- Not observed is a separate state and requires a reason.
- Missing dimensions are rejected; no automatic zero/NULL defaults.
- Weighted average is calculated only over rated dimensions and their weights, then normalized to 0–100.
- The headline score is withheld below the rubric version's configured minimum coverage.
- Zero observations return no score, not 0/100.
- Results retain rubric version, scoring-engine version, role key, observed count and coverage ratio.
- Confidence is computed only from explicit sample count, evidence-backed ratio, context consistency and a caller-supplied versioned policy; score magnitude is never used as confidence.
- Comparability requires matching rubric version, scoring engine, role, mode and map. Mismatches return explicit reasons.
- Legacy conversion is explicitly labelled “Legacy scale — approximate conversion” and always marked non-comparable.

## 4. Access-control model

- RLS is enabled on every new exposed table.
- Client grants are explicitly revoked and re-granted at the minimum required level; anon receives no access.
- Active team members can read their team's rubric and role profiles.
- Only active Owner/Coach memberships can create/activate team rubric versions and role profiles.
- Evidence access follows its explicit visibility state; cross-team evidence and rubric reads are blocked.
- No client DELETE grant or policy is provided.
- No SECURITY DEFINER function is introduced.
- Evidence archive uses column-level update grants, so clients cannot rewrite evidence content or provenance.

RLS is a database boundary, not a UI-only check. The disposable PostgreSQL integration verifies member, coach, author, and cross-team paths.

## 5. Verification

- Source contract suite: scripts/verify-evolution-phase-three.mjs.
- PostgreSQL integration: scripts/verify-evolution-phase-three-db.sh.
- Standard build includes the Phase Three source suite.
- CI applies Phase 2.2 and Phase Three migrations to an isolated disposable PostgreSQL database before the TypeScript/test/build chain.
- The tests cover six-dimension seed, team rubric activation, role-weight shape and activation, evidence visibility, same-team constraints, dimension linking, archive behavior, no-delete grants and anonymous denial.
- Scoring tests cover zero vs Not observed, missing dimensions, partial coverage, no observations, invalid ranges, role weights, confidence inputs, comparability and legacy conversion.

## 6. Explicit boundaries and follow-up

- Migration is committed to the feature branch only; it is not applied to the live Supabase project.
- No production data is modified or backfilled.
- No UI is added because the next dependent workflow owns the evaluation form and later phases own navigation/presentation.
- The existing legacy five-dimension score model remains isolated and untouched.
- Role-specific weight values remain neutral until a coach/owner approves a documented, evidence-backed profile.
- Phase 2.2's production trigger ACL remediation remains separate; the historical baseline and broad legacy SECURITY DEFINER review remain open under the Phase One security workstream.

## 7. Exit gate

Phase 2.3 can be marked PASS for limited development only after the exact branch-head CI run is green, including PostgreSQL integration, all source-contract tests, TypeScript and production build. No production rollout is implied.
