# Evolution Phase 2.4 — Canonical Session Lifecycle

**Blueprint mapping:** Evolution Version 2, §38.4 Point 2.4 — Session Lifecycle  
**Status:** IMPLEMENTED ON STACKED DEVELOPMENT BRANCH · exact-head CI pending  
**Branch:** `feat/evolution-phase-two-4-session-lifecycle`  
**Parent:** `feat/evolution-phase-two-3-match-identity`  
**Exact parent commit:** `2a12182af435c4a523d154a7397f39655da2f360`  
**Scope:** Canonical session lifecycle, guarded transitions, result-submission prerequisite, timestamps/actors, audited reopening, cancellation/no-show and archive.

## 1. Scope boundary

Point 2.4 adds a lifecycle to the existing canonical session identity. It does not rewrite Scrims, Tournament or Training source rows, does not change Planning source records or JSONB match payloads, and does not introduce roster/role snapshots, substitutions, or the complete result-correction workflow. Those remain Points 2.5–2.9 and 2.8 respectively.

The migration is additive. Existing unarchived canonical sessions initialize to `draft` at lifecycle version zero. Any session already carrying explicit legacy `archived_at` metadata is preserved as `archived`; no synthetic prior-state audit event is invented because the historical transition is not available. No source row, canonical match UUID, match sequence or historical result is generated or rewritten.

## 2. Lifecycle contract

Persisted values are lower snake case; UI labels are the blueprint labels.

| State | Allowed normal next state | Meaning |
|---|---|---|
| Draft | Scheduled / Cancelled | Created, not yet scheduled |
| Scheduled | In Progress / Cancelled | Scheduled session |
| In Progress | Awaiting Results | Session activity completed; results pending |
| Awaiting Results | Verified | A result-submission receipt must exist |
| Verified | Closed | Verification timestamp and actor must exist |
| Closed | Archived | Non-destructive historical retention |
| Cancelled | Archived | Non-destructive retention of a cancelled/no-show session |
| Archived | None | Read-only except audited reopening |

Normal transitions cannot skip states or move backwards. Cancellation is a separate terminal branch: Draft or Scheduled can be cancelled; `no_show` is accepted only from Scheduled. A no-show does not create a played match or alter expected/actual match counts.

Reopening is not a normal transition. The dedicated correction RPC permits only Closed → Verified, Archived → Closed, or Cancelled → Scheduled, requires an explicit reason, increments the lifecycle version and writes an append-only `reopen` event. A no-show/cancellation remains visible in its original event even if a correction later reopens the session.

## 3. Database implementation

Migration: `supabase/migrations/20261119160000_evolution_phase_two_4_session_lifecycle.sql`

### Canonical session lifecycle fields

- `lifecycle_status` with a constrained state set; pre-existing sessions default to Draft.
- Monotonic `lifecycle_version` for optimistic concurrency.
- Database-generated transition timestamps and actor UUIDs for Scheduled, In Progress, Awaiting Results, Verified, Closed and Cancelled.
- Existing `archived_at`, `archived_by` and `archive_reason` are reused for Archived; no duplicate archive columns are introduced.
- The existing descriptive `scheduled_at` remains the planned schedule time. `lifecycle_scheduled_at` is the time the session entered Scheduled.

### Result submission prerequisite

`canonical_session_result_submissions` is an immutable receipt that a session's results were submitted. It is not the full result payload model. The receipt is one-per-session and idempotent; it records submitter and server timestamp. Verification is rejected until the receipt exists, and closure is rejected until verification has occurred. Full result values, correction versions and official aggregate integration remain Point 2.8.

### Audit

`canonical_session_lifecycle_events` records team, session, version, event kind, previous/new state, reason, cancellation reason code, idempotency key, actor and server timestamp. Direct client INSERT/UPDATE/DELETE is revoked. A private trigger function writes the event atomically with the state change.

### RPCs

- `transition_canonical_session`: SECURITY INVOKER; validates active Owner/Coach membership, expected version, reason, idempotency and permitted normal transition.
- `submit_canonical_session_results`: SECURITY INVOKER; creates or returns the one immutable submission receipt.
- `reopen_canonical_session`: SECURITY INVOKER; allows only the documented correction/reopen edges.

Private trigger functions use an empty search path, schema-qualified references and no direct EXECUTE grant to API roles. A guard trigger blocks lifecycle-field changes outside the RPC transaction context. RLS remains team-scoped; staff-only audit/submission reads are separate from ordinary team-member reads.

## 4. Verification added

- Source contract: `scripts/verify-evolution-phase-two-4.mjs`
- Disposable PostgreSQL integration: `scripts/verify-evolution-phase-two-4-db.sh`
- Standard `npm run build` includes the new source-contract suite.
- GitHub Actions includes a separate PostgreSQL 16 database for Point 2.4 and runs Phase 2.2, 2.3 and 2.4 integrations independently.
- The integration covers invalid shortcuts, valid transitions, actor/timestamp capture, result-before-verify, verify-before-close, idempotent retries, changed-key rejection, stale versions, player rejection, cross-team audit isolation, append-only audit privileges, archived read-only behavior, audited reopening, cancellation/no-show and no fabricated played matches.

Exact-head CI has not yet been reported as passing. The branch is not marked PASS until the full branch-head run completes successfully, including all inherited integrations, TypeScript, foundation contracts and Vite production build.

## 5. Explicit non-goals and follow-up

- No frontend lifecycle controls or existing module adapters are changed in Point 2.4.
- No Scrims Delete Record action is removed here; that remains part of the Point 2.9 archive/retention integration gate.
- No roster, role, substitution or detailed match-result verification data is invented.
- No automatic lifecycle transition is inferred from legacy module statuses. Existing status vocabularies are not equivalent to the canonical lifecycle.

## 6. Production and rollout boundary

**Not production-ready. Do not apply this migration or run a production backfill.**

- Migration is committed only to the stacked development branch.
- No live `squad-os` Supabase migration or data backfill has been run.
- No Vercel production deployment or promotion has been triggered.
- No production backfill or Vercel deployment has been triggered.
- No PR #119/#120 merge has been performed.
- Production remains blocked until Point 2.9 replaces destructive source deletion with non-destructive archive/retention behavior, and the separately required rollout approvals and rehearsals are complete.

The Phase 2.4 development gate is pending exact branch-head CI; production rollout is a separate, still-blocked gate.
