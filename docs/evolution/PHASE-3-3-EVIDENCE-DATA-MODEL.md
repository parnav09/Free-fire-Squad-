# Evolution Phase 3.3 — Evidence Data Model

**Status:** IMPLEMENTED AND VERIFIED.  
**Active PR:** #131 (single consolidated Evolution Phase Three PR; Draft, unmerged).  
**Scope:** stable evidence identity, evaluation context, canonical player/session/match/role references, evidence source/content, dimension links and append-only evidence history.

## Design decisions

- Reuse the Phase 2 canonical session, canonical match, roster/player membership and match-role snapshot records. Do not infer a role from the player's current team assignment.
- A match-level evaluation context must reference the exact canonical match and exact player role-assignment snapshot. Session-only contexts are allowed without inventing a match or role.
- The evaluation context is a stable anchor for future evaluation/rubric work; it does not calculate a score, finalize an evaluation or introduce a competing legacy evaluation model.
- Evidence identity is separate from its content history. The evidence row is immutable; version 1 is inserted automatically from the initial submitted content, and later corrections append sequential versions.
- Dimension links reference the exact immutable (dimension_key, definition_version) from the Phase 3.2 canonical registry.
- Evidence sources are explicit: manual observation, VOD reference, round note and match reference. VOD/match references require an HTTP(S) locator. This stores a reference only; it does not claim automatic VOD analysis.
- Every new evidence item starts with status pending. Clients cannot self-verify, reject or mark evidence corrected; provenance/verification transitions are deferred to Point 3.4.
- Visibility is explicit: team, coaches or private. The author can read their own record; team members can read team-visible records; active owners/coaches can read coach-visible records; private records remain author-only.
- Attachments are not enabled in this point. No Storage bucket, public file URL or unreviewed attachment access policy is introduced.

## Database objects

- evolution_evaluation_contexts — immutable team/player/session/match/role-snapshot anchor.
- evolution_evidence_items — stable evidence identity and visibility envelope, including initial content.
- evolution_evidence_versions — append-only content revisions with sequential version numbers.
- evolution_evidence_dimension_links — immutable links to canonical dimension definition versions.

## Integrity and security

- Composite foreign keys enforce player membership and team scope.
- Match-level context references the canonical match's team/session and the exact role assignment's team/session/match/player tuple.
- Version and dimension-link records cannot be updated or deleted.
- Evidence identity/context cannot be updated or deleted.
- Authenticated access is governed by RLS; anonymous reads are revoked.
- Evidence status is constrained to pending on client creation; status transitions require the later provenance/verification point.
- Context creation and evidence creation are limited to active team owners/coaches for this initial data-model boundary.
- No policy queries the rubric tables; this point does not import the unmerged rubric candidate or repeat its recursive-RLS policy graph.
- No legacy daily_scores or training_results are backfilled, converted, rewritten or deleted.

## Verification

**Exact tested code head:** 064fdc00d21a303f4dabd0558b3f71738e101ed9  
**GitHub Actions run:** #45030533118 — https://github.com/parnav09/Free-fire-Squad-/actions/runs/45030533118 — SUCCESS.

Targeted checks:
- npm run test:evolution-phase-three-3
- bash scripts/verify-evolution-phase-three-3-db.sh against a disposable PostgreSQL database

The disposable database harness first runs the verified Phase 2.2–2.6 dependency chain, applies the Phase 3.2 dimension registry, then applies the Phase 3.3 migration twice. It verifies exact match/role linkage, initial version creation, sequential append-only corrections, invalid locator rejection, team isolation, player/coach/private visibility, immutable history, and API grants.

## Scope boundary

No scoring formula, rubric version engine, role weights, verification workflow, score snapshots, scoring UI, storage attachments, production migration, data backfill, merge or production deployment is included. Those remain later Evolution points.

## UI quality standard for every future UI point

Whenever a later Evolution point introduces or changes UI, its acceptance gate must include:
- Preserve the existing Squad OS dark theme, color grading, component tokens and visual language.
- Responsive QA on narrow Android/mobile, tablet and desktop widths.
- All interactive touch targets at least 44×44 CSS px, with the full visible control surface clickable and no clipped, overlapping or dead hit areas.
- Consistent alignment for controls, labels, helper text, cards, headings and action rows.
- Clear text hierarchy, readable contrast, natural wrapping and no truncation of important actions or values.
- Role-based visibility: show only actions/data the current user is authorized to see, while backend RLS remains authoritative.
- Loading, empty, error, retry, disabled, saving and unsaved-change states where applicable.
- Keyboard/focus and accessible names for interactive controls.
- Automated responsive/touch-target checks plus screenshot review at supported breakpoints.
- No unrelated layout, color, data or permission changes outside the point's scope.

This standard is a continuing UI acceptance rule; Point 3.3 itself adds no UI because its accepted scope is the evidence data model.


## Exact-head CI result — 2026-11-22

- Workflow run #45030533118 completed **SUCCESS** on commit 064fdc00d21a303f4dabd0558b3f71738e101ed9.
- Point 3.3 disposable PostgreSQL integration: **PASS**, including applying the migration twice, canonical Phase 2.2–2.6 dependencies, exact match/role snapshot references, initial version seeding, append-only sequential corrections, invalid VOD locator rejection, pending-only creation, team/coach/private visibility, cross-team isolation and ACL checks.
- Point 3.3 source-contract tests: **12/12 PASS**.
- Point 3.2 PostgreSQL integration: **PASS**.
- Point 3.2 source-contract tests: **10/10 PASS**.
- Point 3.1 audit tests: **9/9 PASS**.
- Existing Phase 2.2–2.10 PostgreSQL integration, staged migration/trigger ACL checks, responsive UI/touch-target/permission/offline-write checks, complete regression chain, TypeScript typecheck and Vite production build: **PASS**.
- Existing non-fatal Vite bundle-size warning remains; it does not fail the build.

## CI defects found and fixed before final successful run

1. The first migration draft created RLS policies without dropping existing names, so the required second migration application was not repeatable. Added explicit DROP POLICY IF EXISTS before policy recreation.
2. The first version-seeding trigger depended on client-set session variables. Reworked it to copy the initial evidence fields directly from the inserted evidence row.
3. The first visibility test reused a user fixture that did not represent a member of the target team. Replaced it with explicit disposable Alpha player and coach fixtures and asserted the three visibility levels independently.
4. Corrected PostgreSQL harness DO-block delimiters and adjusted negative tests to accept the expected RLS/privilege denial paths.
5. Added pending-only client creation so clients cannot mark their own evidence verified.

All fixes are included in the exact tested head above.
