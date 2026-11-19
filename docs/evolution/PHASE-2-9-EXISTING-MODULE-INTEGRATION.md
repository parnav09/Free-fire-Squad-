# Evolution Phase 2.9 — Existing Module Integration

**Blueprint mapping:** Evolution Version 2, §38.9 Point 2.9  
**Branch:** `feat/evolution-phase-two-9-module-integration`  
**Parent:** `feat/evolution-phase-two-8-result-verification`  
**Status:** Implementation staged · exact-head CI and isolated PostgreSQL acceptance pending

## Scope

Connect the existing Scrims, Tournament and Training source records to the canonical session/match identity chain without replacing their existing screens or tables. Planning remains a scheduling surface and becomes a Training session only through an explicit promotion action.

## Adapter contract

One server-authoritative RPC, `public.integrate_canonical_source(team_id, source_system, source_record_id)`, handles all three source domains:

- Scrims: one canonical `scrim` session per `scrim_records.id`; each existing JSONB match sequence is mapped through the established canonical match synchronizer.
- Tournament: one canonical `tournament` session per `tournament_cycles.id`; each persisted `tournament_matches.id` is mapped to its canonical match identity.
- Training: one canonical `training` session per `training_sessions.id`; no competitive match rows are fabricated.
- Planning: `practice_plans` are not canonical sessions. The user must explicitly choose **Promote to Training**; the action creates a linked `training_sessions` row with `plan_id`, then integrates that Training source. The plan remains available as its own planning record.

The RPC is SECURITY INVOKER, checks active Owner/Coach membership, takes a source-scoped transaction advisory lock before checking its mapping, derives a deterministic team/source idempotency key, and writes the canonical session plus source mapping in one transaction. Repeated calls return the same canonical session and safely re-run the existing match synchronizer. Direct source tables remain the legacy module's editable records; no parallel result or source-of-truth table is introduced.

## Application integration

- Scrims calls the adapter after save and offers a retryable **Link canonical ID** action for existing records.
- Tournament calls the adapter after the existing weekly snapshot write and offers an explicit link action for a previously saved cycle.
- Training calls the adapter after session creation and offers a link action for existing sessions.
- Planning adds an explicit promotion action and disables duplicate promotion when a Training session already references that plan.
- A missing Point 2.9 RPC on the not-yet-migrated live database is reported as a pending canonical link; the existing legacy save path remains available during staged rollout. Other integration failures are surfaced rather than represented as success.

Existing Training player evaluations remain player/session records. Point 2.9 does not invent a session-level training metric or merge individual rubric scores into the Point 2.8 result workflow.

## Compatibility and safety

- No source module row is deleted or rewritten by the migration.
- Existing screens and legacy tables remain intact.
- The canonical adapter is additive; no production backfill is run.
- The migration is not applied to live Supabase.
- No PR merge or Vercel production deployment is part of this point.
- Existing legacy deep links/routes remain unchanged because no route identity is replaced in this point.

## Verification

- Source contract: `scripts/verify-evolution-phase-two-9.mjs`
- Isolated PostgreSQL integration: `scripts/verify-evolution-phase-two-9-db.sh`
- PostgreSQL integration replays the full Phase 2.2–2.8 chain, then verifies Scrim mapping/idempotency, Tournament cycle and match mapping, Training mapping without phantom matches, explicit Planning-to-Training promotion, team/role authorization, and RPC ACLs.
- `npm run build` includes the Phase 2.9 source contract and existing Phase 2.1–2.8 tests, typecheck and Vite production bundle.
- Phase 2.9 is not PASS until the exact branch-head GitHub Actions run is green, including the isolated PostgreSQL job and complete build.

## Known boundary

Point 2.9 connects existing source identities to canonical IDs. It does not build the session/result management UI, perform historical data backfills, or claim Phase 2.10 database-integrity acceptance. Those remain separate blueprint points.
