# Evolution Phase 2.8 — Result Verification and Correction Audit

**Blueprint mapping:** Evolution Version 2, §38.8 Point 2.8  
**Branch:** `feat/evolution-phase-two-8-result-verification`  
**Parent:** `feat/evolution-phase-two-7-substitution-tracking`  
**Scope:** separate raw result submissions from trusted values, source-aware verification, immutable correction history, and verified-only aggregate eligibility.

## Contract

Point 2.8 creates one result workflow per canonical Scrim/Tournament match, and one session-level result workflow for Training. It deliberately does not invent a competitive match for Training. Existing Phase 2.4 `canonical_session_result_submissions` remains the one-per-session receipt; it is not repurposed as the result payload.

## Stored facts

- `canonical_session_results`: current state and pointer for one match result or one Training session result. States are `draft`, `submitted`, `verified`, `amended`, and `rejected`.
- `canonical_session_result_versions`: append-only raw submissions, source/provenance, recorder and recording timestamp; actual submissions additionally carry submitter and submission timestamp. Drafts, initial submissions and amendments are distinct version kinds.
- `canonical_session_result_events`: append-only draft, submission, verification and rejection events. A verification event stores verified values separately from raw values, the source-specific checklist, verifier, server timestamp and reason.
- `canonical_verified_competitive_match_results`: a security-invoker view containing only the current verified/amended Scrim/Tournament match version.
- `canonical_verified_training_results`: separate verified Training evidence; it is never exposed as competitive match aggregate input.

No kills, placement, survival, match event or Training metric is inferred or defaulted. Raw and verified JSON objects contain only values explicitly submitted. Missing keys stay missing. A verifier must explicitly supply the values being trusted.

## Workflow and invariants

1. Owner/Coach can save a draft while the session is active; a draft is not aggregate-eligible.
2. Submission is allowed in `awaiting_results`, records the submitter and server timestamp, and creates/reuses the existing one-per-session submission receipt.
3. Scrim/Tournament result records target a canonical match. Training result records target the canonical session; no phantom match is generated.
4. Verification requires an active Owner/Coach, a submitted result, explicit verified values, a non-empty reason, and exactly the required source-specific checklist keys set to true.
5. Competitive checklist: source identity, match identity, values reviewed, and no inferred values. Training checklist: source identity, activity, participants, and no inferred values.
6. Rejection is an append-only decision with actor, timestamp and reason. A rejected result is excluded from trusted aggregates.
7. Corrections create a new immutable version and require a correction reason. Until that version is verified, the affected result is excluded from the trusted aggregate view; the previous raw version and verification event remain preserved.
8. Verification of a correction moves the current state to `amended`. Only the current verified/amended version is exposed to its corresponding trusted view.
9. Session lifecycle transition to `verified` requires at least one result record and every result record for that session to be verified/amended. Pending, draft or rejected result records block that transition.
10. Team-scoped RLS, Owner/Coach authorization, idempotency, append-only triggers and revoked direct writes protect all result history.

## Authoritative RPCs

- `save_canonical_session_result_draft`
- `submit_canonical_session_result`
- `verify_canonical_session_result`
- `reject_canonical_session_result`
- Existing `submit_canonical_session_results` continues to issue the session submission receipt.
- Existing `transition_canonical_session` now checks result verification before allowing the `verified` lifecycle state.

## Migration and recovery

- Additive migration: `20261120220000_evolution_phase_two_8_result_verification.sql`.
- No historical result backfill is performed because legacy Scrim JSONB, Tournament rows and Training results have different provenance and incomplete shapes. No values are inferred.
- No existing result rows or source module records are rewritten.
- Recovery is forward-only: preserve append-only history and use a new corrected version/decision; do not delete or rewrite result history. If deployment is halted before migration, leave the migration unapplied and repair the branch; do not partially run it manually.
- The migration is tested against disposable PostgreSQL 16 after the complete Phase 2.2–2.7 integration chain.

## Verification

- Source contract: `scripts/verify-evolution-phase-two-8.mjs`
- Disposable PostgreSQL integration: `scripts/verify-evolution-phase-two-8-db.sh`
- Test coverage: draft exclusion, Scrim match-level submission, receipt reuse, incomplete checklist rejection, premature lifecycle verification rejection, source-specific verification, verified aggregate eligibility, reopen-and-amend history, pending-correction aggregate exclusion, Training session-level verification, Player write/read denial, cross-team isolation, direct-write denial and private trigger ACLs.
- Exact branch-head CI must pass all inherited Phase 2.2–2.7 PostgreSQL integrations, Phase 2.8 PostgreSQL integration, staged security ACL checks, typecheck, all source contracts, character data and production Vite build.

## Scope boundary

Point 2.8 implements backend data contracts and verification workflows. It does not integrate existing Scrims/Tournament/Training screens (Point 2.9), add the result UI (Point 2.11), merge any PR, run a live Supabase migration/backfill, or deploy/promote Vercel production. Production rollout remains separately gated.
