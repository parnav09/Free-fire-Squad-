# Evolution Phase 2.11 — Application UI

**Blueprint mapping:** Evolution Version 2, Point 2.11  
**Branch:** feat/evolution-phase-two-11-application-ui  
**Parent:** feat/evolution-phase-two-10-database-integrity  
**Status:** Development implementation; production rollout remains gated.

## Delivered UI

- Evolution → Sessions workspace with filters for type, season, lifecycle status, date, title and canonical ID.
- Database-generated canonical session creation and descriptive metadata editing while draft/scheduled.
- Lifecycle transitions with expected-version concurrency checks, audit reason, cancellation reason codes, archive and audited reopen.
- Session detail with canonical matches, parent-session context, source mappings and result state.
- Roster selection before lock; the database snapshots active membership, player slot and display name. Supported selection confirmation is available before session start.
- Match participation record/correction, per-match role assignment and substitution event capture through canonical RPCs.
- Result draft, submission, verification and rejection with raw values, source provenance, explicit four-item verification checklist and audit history.
- Training results remain session-level; no competitive matches are fabricated for Training.
- Loading, empty, migration-unavailable, permission-denied, archived and offline read-only states.
- Responsive Deep Onyx UI for desktop/tablet/mobile, semantic labels, visible focus and reduced-motion support.

## Safety and correctness

- Privileged actions use existing server RPCs. The UI does not write to append-only event/result tables directly.
- Lifecycle transitions send the current lifecycle_version; stale concurrent edits surface a conflict.
- The UI never fabricates missing match rows, result values or roster records.
- Only Owner/Coach controls are rendered; server-side RLS/RPC authorization remains authoritative.
- Offline mode is read-only; no unsupported queue/replay behavior is implied.
- Team changes clear the prior team list immediately; list/detail requests use generation guards so stale responses cannot overwrite a newer team or selected session.
- Result verification requires a non-empty verified JSON object, all four server-defined checklist keys and a reason.
- Session verification is disabled until every expected match (or the single Training session result) is verified/amended; the session-level result receipt is submitted before the verified lifecycle transition.
- No schema migration or live Supabase write is part of this UI point.

## Verification

- Source contract: scripts/verify-evolution-phase-two-11.mjs (includes stale-request and team-isolation regression assertions)
- npm run test:evolution-phase-two-11 is included in the production build test chain.
- Vercel Preview build checks TypeScript, the source-contract test chain and production bundle.
- GitHub Actions PostgreSQL integration is currently failing before any runner steps start. Phase 2.10 remains unverified until isolated database tests can execute.
- Manual Android device, tablet and desktop interaction QA remains an acceptance requirement and is not inferred from a successful bundle build.

## Production boundary

- No PR merge, production migration, backfill or Vercel production deployment.
- Phase 2.12 owns cross-module regression, historical snapshot validation and device acceptance.
