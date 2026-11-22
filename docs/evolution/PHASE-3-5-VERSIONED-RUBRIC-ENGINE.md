# Evolution Phase 3.5 — Versioned Rubric Engine

**Status:** IMPLEMENTED AND VERIFIED  
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
- Added team-scoped RLS. Active team members can read active and retired published rubrics for historical interpretation; active owners/coaches can read/manage drafts and lifecycle transitions. Anonymous access and direct mutation of published records are denied.
- Added a typed domain validator using the existing canonical dimension and role registry. No duplicate dimension registry was introduced.

## Scope boundaries

- No scoring formula, role weights, evidence coverage calculator, score snapshot, evaluation UI or legacy conversion is included; those belong to later points.
- No existing evidence, evaluation, training or player records are rewritten.
- No production migration, production deployment, merge to main, data reset or legacy backfill is performed.
- The rubric binding is a stable contract for the later evaluation/scoring workflow; it does not create a parallel evaluation record system.

## Exact-head verification — 2026-11-22

- Tested PR head: 7fead06b13da3a937c1fff619809859c234db28a.
- GitHub Actions run #45053929515: **SUCCESS** — https://github.com/parnav09/Free-fire-Squad-/actions/runs/45053929515.
- Point 3.5 disposable PostgreSQL integration: **PASS**. Migration applied twice after the Phase 3.4 dependency chain.
- Database checks: complete six-dimension publication; eleven 0–10 anchors per dimension; invalid anchor and role rejection; sequential, serialized version creation; one-active-version constraint; effective dates; immutable published and retired versions; exact immutable evaluation-context binding; duplicate binding denial; team isolation; coach/player RLS; historical visibility of retired published rubric versions; anonymous and direct-write privilege denial.
- Point 3.5 source-contract tests: **13/13 PASS**.
- Existing Phase 3.2–3.4 and Phase 2.2–2.10 disposable PostgreSQL integrations: **PASS**.
- Existing responsive UI, touch-target, permission and offline-write regression: **PASS**; responsive screenshots uploaded.
- Full regression/source-contract chain and TypeScript typecheck: **PASS**.
- Vite production build: **PASS**. Existing non-fatal chunk-size warning remains; this point adds no UI bundle or new image assets.
- Two defects found during verification were fixed before the successful run: a PL/pgSQL trigger CASE-expression syntax error, and a database test that expected an exception where RLS correctly filtered the published-criteria update. The final test verifies zero updated rows and unchanged historical criteria.
- No production migration, production deployment, merge to main, data reset or legacy backfill occurred.

**Point 3.5 acceptance: VERIFIED.**

The next point is 3.6 — Role-Specific Weight Configuration. Do not begin it until explicitly requested.
