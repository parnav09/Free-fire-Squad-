# Evolution Phase 3.4 — Evidence Provenance & Verification

**Status:** IMPLEMENTED; awaiting exact-head GitHub Actions verification.  
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
