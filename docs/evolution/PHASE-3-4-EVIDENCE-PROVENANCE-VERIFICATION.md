# Evolution Phase 3.4 — Evidence Provenance & Verification

**Status:** IMPLEMENTED AND VERIFIED.  
**PR:** #131 (single consolidated Evolution Phase Three PR; Draft/unmerged).  
**Migration:** `supabase/migrations/20261122150000_evolution_phase_three_4_evidence_provenance_verification.sql`

## Delivered

- Added an append-only `evolution_evidence_verification_events` ledger. Existing Phase 3.3 evidence identity and content rows are not updated.
- Backfilled one initial `pending` event for existing Phase 3.3 evidence, preserving its creator as the initial provenance actor; future evidence automatically receives the same initial event.
- Defined allowed transitions among `pending`, `verified`, `rejected`, `corrected` and `archived`. Rejection, correction and archival require a reason.
- Added an authenticated server-side transition RPC. Only active team owners/coaches can adjudicate; the evidence author cannot adjudicate their own item; private evidence cannot be adjudicated by another member.
- Serialized state transitions and rejected stale `from_status` values to prevent conflicting concurrent updates.
- A `corrected` event must reference the latest newly appended version of the same evidence item. Previously adjudicated versions cannot be reused.
- Added a security-invoker current-status view exposing creator and verifier attribution, verification timestamp, latest actor, reason and referenced correction version.
- Added advisory duplicate-candidate lookup by same source locator or normalized title within the same evaluation context and source type. It never merges or deletes records.
- RLS allows event history reads only when the corresponding Phase 3.3 evidence is visible. Authenticated clients have read-only event-table access; writes go through the guarded RPC. Anonymous execution is denied.

## Transition rules

| Current | Allowed next states |
|---|---|
| pending | verified, rejected, corrected, archived |
| verified | corrected, archived |
| rejected | corrected, archived |
| corrected | pending, verified, rejected, archived |
| archived | terminal |

A correction is a provenance/adjudication event, not an edit to an earlier version. Append a new Phase 3.3 evidence version first, then submit the corrected transition referencing that version. Reopening archived evidence is intentionally not supported in this point.

## Verification

- Source contract: `npm run test:evolution-phase-three-4`.
- PostgreSQL integration: `bash scripts/verify-evolution-phase-three-4-db.sh` against a disposable CI database.
- The database harness executes the verified Phase 3.3 dependency chain, applies this migration twice, then checks pending-state initialization, coach verification, correction version linkage, return to pending, required reasons, private-evidence denial, author self-verification denial, player denial, duplicate detection without destructive merging, event immutability and anonymous/direct-write ACLs.
- The workflow now runs this integration harness and the source-contract suite in the normal build chain.

No scoring, rubric, role-weight, coverage or score-snapshot logic is included. No production migration, data reset, production deployment or merge to main is performed by this point. Point 3.4 is a data/provenance workflow and does not introduce a new UI surface; existing app color grading/layout remains untouched. If a later point adds verification UI, the continuing acceptance gate applies: current dark theme, responsive Android/tablet/desktop, at least 44×44 CSS px hit targets, precise control/text alignment, no collisions, accessible focus, role-aware visibility and loading/empty/error/retry/save states.

## Exact-head CI acceptance — 2026-11-22

- Exact tested code head: `be33196f2008127c141b93bd4bf343f9f41d31ef`.
- GitHub Actions run #45033317911: **SUCCESS** — https://github.com/parnav09/Free-fire-Squad-/actions/runs/45033317911.
- Phase 3.4 disposable PostgreSQL integration: **PASS**. Migration applied twice after the Phase 3.3 dependency chain; initial pending state, coach verification, correction/version linkage, return-to-pending, rejection reason enforcement, terminal archival, private evidence denial, author self-verification denial, player denial, non-destructive duplicate detection, direct-write denial and anonymous ACLs passed.
- Phase 3.4 source-contract tests: **12/12 PASS**.
- Existing Phase 3.2 and 3.3 database integrations: **PASS**.
- Phase 2.2–2.10 PostgreSQL integration, staged migration and trigger ACL checks: **PASS**.
- Responsive UI/touch-target/permission/offline-write checks and screenshot artifact upload: **PASS**.
- Full source/regression suite, TypeScript typecheck and Vite production build: **PASS**. Existing non-fatal Vite chunk-size warning remains.
- One source-contract assertion initially expected a different wording for the correction guard; corrected the assertion to match the implemented database error message. The PostgreSQL integration itself passed on the first run.
- No production migration, merge to main, production deployment or data reset occurred.

**Point 3.4 acceptance: VERIFIED on the exact tested code head above.**
