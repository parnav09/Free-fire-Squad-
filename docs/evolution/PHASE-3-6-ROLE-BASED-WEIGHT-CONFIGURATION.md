# Evolution Phase 3.6 — Role-Based Weight Configuration

**Status:** IMPLEMENTED AND VERIFIED  
**Scope:** Evolution Phase Three, Point 3.6 only  
**Repository:** parnav09/Free-fire-Squad-  
**PR:** #131 — consolidated Evolution Phase Three PR, Draft/unmerged

## Implementation

- Added `evolution_role_weight_sets`, scoped to an exact published rubric version and canonical role.
- Added sequential per-rubric/per-role versions with draft, active and retired lifecycle states.
- Added integer basis-point dimension weights. Activation requires every applicable active rubric dimension exactly once and a total of exactly 10,000 basis points (100%).
- Non-applicable dimensions are omitted rather than represented as a guessed zero. Zero is allowed only as an explicit weight for an applicable dimension.
- Each weight row pins the exact rubric dimension-definition version. A weight cannot be attached to a dimension outside that role's canonical applicability or absent from the bound rubric version.
- Published sets and their dimension rows are immutable. Retirement preserves history and closes the effective range. Only one active weight set exists for a given rubric version and role.
- Added transaction-safe parent-row locking for sequential version allocation and to serialize draft weight edits against publication.
- Added immutable evaluation-context weight bindings. A binding must match the exact evaluation context, player, match and historical role-assignment snapshot, plus the exact rubric version already bound to that context.
- Historical role labels are resolved only through explicit canonical aliases. Unknown/unmapped role snapshots fail closed; current team role is never used as a fallback.
- Added team-scoped RLS, owner/coach administration, published-history read access for team members, anonymous access denial and direct mutation restrictions.
- Added typed validation in `src/lib/evolution-role-weights.ts` and source-contract tests.
- Added repeatable additive migration, disposable PostgreSQL integration harness, normal build-chain test and GitHub Actions verification.
- No scoring formula, score snapshot, evaluation UI, legacy backfill, production migration, production deployment, data reset or merge to main is included in Point 3.6.

## Weight convention

Weights are stored as integer basis points to avoid floating-point drift:
- 10,000 basis points = 100%
- 1 basis point = 0.01%
- The sum of applicable dimension weights must equal exactly 10,000.
- Missing/non-applicable dimensions are not silently converted into zero-weight observations.

## UI and device scope

Point 3.6 is a data/configuration point and introduces no new UI controls. Existing UI is intentionally unchanged. When the configuration editor is introduced in the later scoring UI point, it must preserve the existing Squad OS dark theme/color grading, minimum 44×44 CSS px interactive targets, precise full-surface hitboxes, aligned labels, no text/control collisions, and responsive Android/mobile, tablet, laptop and desktop layouts.

## Exact-head verification — 2026-11-22

- Tested PR head: `16058db847e144544ebb569f8d5853323754751a`.
- GitHub Actions run #45056896882: **SUCCESS** — https://github.com/parnav09/Free-fire-Squad-/actions/runs/45056896882.
- Phase 3.6 disposable PostgreSQL integration: **PASS**. The migration was applied twice after the Phase 3.5 and canonical role-snapshot dependency chain.
- Database checks: sequential role/rubric-scoped versions; exact 10,000 basis-point total; missing/duplicate/invalid weights; exact dimension-definition pins; active/retired lifecycle; effective dates that cannot be retroactive; delayed binding to a historically effective retired set; exact context/player/match/role snapshot and rubric binding; role mismatch and role-less context rejection; published immutability; RLS, team scope, owner/coach writes, member historical reads, draft privacy and ACL denial.
- Phase 3.6 source-contract tests: **17/17 PASS**.
- Existing Phase 3.2–3.5 and Phase 2.2–2.10 PostgreSQL integrations, staged migration/security checks: **PASS**.
- Responsive UI, touch-target, permission and offline-write regression: **PASS**; screenshot upload: **PASS**. Point 3.6 adds no UI controls, so existing UI/layout/color grading remains unchanged.
- Full regression, TypeScript typecheck and Vite production build: **PASS**.
- Existing non-fatal Vite chunk-size warning (largest emitted app chunk 383.56 kB), dependency deprecation warnings and GitHub Actions Node 20 deprecation warning remain.
- Verification defects fixed before this successful run: qualified ambiguous dimension joins; changed the RLS test to assert zero updated rows while separately exercising immutable triggers with a privileged role; corrected DELETE trigger team lookup to use OLD; corrected source-contract SQL alias assertions.
- Vercel Preview check separately reports build-rate-limit failure; GitHub Actions is green. No production migration, production deployment, data reset or merge to main occurred.

**Point 3.6 acceptance: VERIFIED.**

No production migration or deployment is authorized by this point.
