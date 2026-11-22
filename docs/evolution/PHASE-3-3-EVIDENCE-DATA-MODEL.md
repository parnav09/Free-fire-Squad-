# Evolution Phase 3.3 — Evidence Data Model

**Status:** IMPLEMENTED — exact-head CI verification pending.  
**Active PR:** #131 (single consolidated Evolution Phase Three PR; Draft, unmerged).  
**Scope:** stable evidence identity, evaluation context, canonical player/session/match/role references, evidence source/content, dimension links and append-only evidence history.

## Design decisions

- Reuse the Phase 2 canonical session, canonical match, roster/player membership and match-role snapshot records. Do not infer a role from the player's current team assignment.
- A match-level evaluation context must reference the exact canonical match and exact player role-assignment snapshot. Session-only contexts are allowed without inventing a match or role.
- The evaluation context is a stable anchor for future evaluation/rubric work; it does not calculate a score, finalize an evaluation or introduce a competing legacy evaluation model.
- Evidence identity is separate from its content history. The evidence row is immutable; version 1 is inserted automatically from the initial submitted content, and later corrections append sequential versions.
- Dimension links reference the exact immutable (dimension_key, definition_version) from the Phase 3.2 canonical registry.
- Evidence sources are explicit: manual observation, VOD reference, round note and match reference. VOD/match references require an HTTP(S) locator. This stores a reference only; it does not claim automatic VOD analysis.
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
- Context creation and evidence creation are limited to active team owners/coaches for this initial data-model boundary.
- No policy queries the rubric tables; this point does not import the unmerged rubric candidate or repeat its recursive-RLS policy graph.
- No legacy daily_scores or training_results are backfilled, converted, rewritten or deleted.

## Verification

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
- Interactive hitboxes at least 44×44 CSS px where practical, with no clipped or overlapping targets.
- Consistent alignment for controls, labels, helper text, cards, headings and action rows.
- Clear text hierarchy, readable contrast, natural wrapping and no truncation of important actions or values.
- Role-based visibility: show only actions/data the current user is authorized to see, while backend RLS remains authoritative.
- Loading, empty, error, retry, disabled, saving and unsaved-change states where applicable.
- Keyboard/focus and accessible names for interactive controls.
- Automated responsive/touch-target checks plus screenshot review at supported breakpoints.
- No unrelated layout, color, data or permission changes outside the point's scope.

This standard is a continuing UI acceptance rule; Point 3.3 itself adds no UI because its accepted scope is the evidence data model.
