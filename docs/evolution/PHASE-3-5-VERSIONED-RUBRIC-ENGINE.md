# Evolution Phase 3.5 — Versioned Rubric Engine

**Status:** IMPLEMENTED — exact-head verification pending  
**Scope:** Evolution Phase Three, Point 3.5 only  
**Repository:** parnav09/Free-fire-Squad-  
**Active PR:** #131 — consolidated Evolution Phase Three PR, Draft/unmerged

## Implementation

- Added stable team-scoped rubric identities using the evolution_rubrics table.
- Added sequential rubric versions with draft, active and retired lifecycle states.
- Draft versions are editable only by active team owners/coaches. Published active versions cannot be edited; retirement preserves their published content and ends the effective period.
- Activation requires an effective start date and complete criteria for every active canonical dimension.
- Added dimension criteria linked to the exact immutable Phase 3.2 dimension-definition version.
- Every criterion requires exactly eleven non-empty text anchors for integer ratings 0 through 10. Zero remains a valid rating; no score calculation is introduced here.
- Optional role-specific guidance is validated against the canonical role keys applicable to the referenced dimension definition.
- A rubric version can have only one active version at a time. New versions must be sequential; old versions and criteria remain retained.
- Added immutable evolution_evaluation_rubric_bindings so each evaluation context retains the exact active rubric version effective when the context was created.
- Added team-scoped RLS. Active team members can read active rubrics; active owners/coaches can manage drafts and lifecycle transitions. Anonymous access and direct mutation of published records are denied.
- Added a typed domain validator using the existing canonical dimension and role registry. No duplicate dimension registry was introduced.

## Scope boundaries

- No scoring formula, role weights, evidence coverage calculator, score snapshot, evaluation UI or legacy conversion is included; those belong to later points.
- No existing evidence, evaluation, training or player records are rewritten.
- No production migration, production deployment, merge to main, data reset or legacy backfill is performed.
- The rubric binding is a stable contract for the later evaluation/scoring workflow; it does not create a parallel evaluation record system.

## Verification required

- Apply this migration twice after the Phase 3.4 disposable dependency chain.
- Verify complete six-dimension publication and exact rubric binding.
- Verify 0–10 anchor completeness, role applicability, sequential versioning, effective dates, one-active-version constraint and lifecycle rules.
- Verify published/retired immutability, player-vs-coach RLS, team isolation and anonymous/direct-write denial.
- Run source-contract tests, disposable PostgreSQL integration, full regression, TypeScript typecheck and Vite production build on the exact latest PR head.
- Update this report and the persistent roadmap only after the exact-head run succeeds.
