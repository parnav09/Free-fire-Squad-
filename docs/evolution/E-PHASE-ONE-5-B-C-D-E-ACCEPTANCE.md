# Evolution Phase One.5-B/C/D/E — Implementation and Acceptance Record

**Date:** 18 Nov 2026  
**Branch:** `feat/evolution-phase-one-identity-timezone`  
**PR:** #115 (draft; stacked on Phase Zero PR #114)

## Scope and safety

This record covers only Evolution Phase One.5-B through .5-E. It does not authorize a production migration, migration-ledger edit, merge, deployment, security-policy redesign, retention change, or loadout work. No Supabase development branch was created.

## B — Existing date/timezone contract verification

### Implemented as a staged forward migration

`docs/evolution/staged-migrations/20261118070000_team_timezone_contract.sql`

- Adds a SECURITY INVOKER trigger function validating every inserted/updated `teams.timezone` against PostgreSQL's recognized IANA timezone catalog.
- Covers `create_team`, both backup-restore paths, and direct timezone updates without rewriting existing SECURITY DEFINER functions.
- Preserves the existing persisted Daily Evaluation date contract: `daily_scores.score_date` remains derived from `Asia/Kolkata` by the existing `daily_scores_lock_date_anonymous` trigger.
- Leaves the existing `ds_insert` RLS predicate unchanged; it continues to require `evaluator_id IS NULL`, `can_rate(team_id, player_id)`, and the Asia/Kolkata date.
- Does not add a second Daily Evaluation trigger, change trigger ordering, change the `ds_insert` policy, or rewrite historical rows.
- Does not change timezone defaults or the existing app's team-creation argument (`Asia/Kolkata`).

### Live read-only facts checked

- `teams.timezone` is `NOT NULL` with default `UTC`.
- Existing live team values: `Asia/Kolkata` (14 teams) and `Asia/Calcutta` (1 team); both are recognized by PostgreSQL's timezone catalog.
- The current app calls `create_team` with `p_timezone: 'Asia/Kolkata'`.
- The live `daily_scores_lock_date_anonymous` trigger sets `score_date` using `Asia/Kolkata`, and also nulls evaluator/notes and sets recipient-only visibility.
- The live `ds_insert` policy independently enforces the same Asia/Kolkata date and retains the evaluator-null and `can_rate` checks.

### Not yet accepted

The SQL remains staged outside `supabase/migrations/`. It has not yet been executed against an isolated PostgreSQL/Supabase-compatible database. A source review and live read-only inspection cannot prove DDL execution, invalid-timezone rejection, valid alias acceptance, or that existing date trigger/RLS behavior remains unchanged at runtime. Do not apply it to production.
## C — Rollback

### Implemented for the new B migration

`docs/evolution/staged-migrations/20261118070000_team_timezone_contract.rollback.sql`

- Restores the exact previous `ds_insert` Asia/Kolkata predicate.
- Drops only the two new triggers and their two new functions.
- Does not delete or rewrite historical rows.
- Does not replace or drop the pre-existing anonymization trigger/function.

### Historical rollback remains unavailable

The 53 recovered safe-scope historical ledger entries contain zero stored rollback statements. A rollback for those old migrations cannot safely be fabricated from today's schema. Each historical migration needs a separately reviewed compensating migration or an explicit “forward-only / no automatic rollback” classification. Therefore C is not globally complete.

## D — Tests and validation

Added `scripts/verify-evolution-phase-one-5.mjs` and `npm run test:evolution-phase-one-5`, wired into `npm run build`.

The checks cover:
- timezone validation trigger presence;
- team-local Daily Evaluation date derivation;
- preservation of the existing anonymization trigger and `can_rate`/recipient-null checks;
- rollback restoration and object cleanup;
- no historical row rewrite;
- staged SQL remaining outside the active migration directory.

**Local result:** the new Node source-contract suite was executed against the staged forward/rollback files in an isolated temporary workspace: **6 passed, 0 failed**. The current PR head has no reported GitHub Actions run available through the workflow lookup; the combined commit status shows only Vercel's build-rate-limit failure. A full repository build has not been verified on this head.

**Limit:** these are source-contract tests, not a database integration test. CI must pass on the new head, and the forward/rollback SQL must still pass isolated database execution before D can be marked complete.

## E — Final Phase One acceptance audit

| Gate | Result |
|---|---|
| Identity/membership E Phase One.1–.4 | Implemented; prior CI verified |
| Original SQL recovery for 53 safe-scope entries | 53/53 byte/hash verified |
| Active migration-chain reconciliation | Incomplete: six same-name content mismatches and three unmatched active files still require disposition |
| Historical rollback coverage | Incomplete: 0/53 rollback statements in live ledger |
| New timezone forward migration | Drafted and staged; not DB-executed |
| New timezone rollback | Drafted; not DB-executed |
| Isolated clean replay | Not run; original pre-migration baseline unavailable |
| Runtime timezone/RLS verification | Not run |
| Full Phase One acceptance | **NOT PASSED** |

## Exact remaining blockers

1. Reconcile the six active-file SQL mismatches and three unmatched files against the recovered archive, preserving dependency order and not replaying already-applied production migrations.
2. Recover or formally classify the pre-existing baseline required for clean replay.
3. Validate the staged forward migration and rollback in an isolated PostgreSQL/Supabase-compatible database, including authenticated RLS behavior and at least two timezones around date boundaries.
4. Review rollback/compensation strategy for historical forward-only migrations.
5. Re-run the full build/CI and the Phase One acceptance checklist against the resulting exact commit.

**Current result:** B's forward SQL and C's rollback for that new migration are drafted; D's automated source-contract checks are added. E correctly remains **BLOCKED / NOT COMPLETE** until database validation and historical migration disposition pass. No production database or deployment changes were made.
