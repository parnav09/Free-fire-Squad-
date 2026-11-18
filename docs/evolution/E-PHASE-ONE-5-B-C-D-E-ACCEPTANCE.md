# Evolution Phase One.5-B/C/D/E — Implementation and Acceptance Record

**Date:** 18 Nov 2026  
**Branch:** `feat/evolution-phase-one-identity-timezone`  
**PR:** #115 (draft; stacked on Phase Zero PR #114)

## Scope and safety

This record covers only Evolution Phase One.5-B through .5-E. It does not authorize a production migration, migration-ledger edit, merge, deployment, security-policy redesign, retention change, or loadout work. No Supabase development branch was created.

## B — Team timezone server contract

### Implemented as a staged forward migration

`docs/evolution/staged-migrations/20261118070000_team_timezone_contract.sql`

- Adds a SECURITY INVOKER trigger function validating every inserted/updated `teams.timezone` against PostgreSQL's recognized timezone catalog. This covers `create_team`, both backup-restore functions, and direct timezone updates without rewriting those existing SECURITY DEFINER functions.
- Adds a second Daily Evaluation BEFORE INSERT trigger. PostgreSQL fires same-kind triggers alphabetically; `trg_daily_scores_team_timezone_date` follows the existing `daily_scores_lock_date_anonymous` trigger, so it replaces only the hard-coded date after the existing anonymization behavior runs.
- Updates only the `ds_insert` date predicate to use the selected team's timezone. It retains `evaluator_id IS NULL` and `can_rate(team_id, player_id)`.
- Does not rewrite historical Daily Evaluation rows or change the existing anonymization function.

### Live read-only facts checked

- `teams.timezone` is NOT NULL with default `UTC`.
- Existing live team values: `Asia/Kolkata` (14 teams) and `Asia/Calcutta` (1 team); both are present in `pg_timezone_names`.
- Existing Daily Evaluation trigger is `daily_scores_lock_date_anonymous`; it currently sets Asia/Kolkata and also anonymizes evaluator/notes and sets recipient-only visibility.
- Existing `ds_insert` policy independently enforces Asia/Kolkata.

### Not yet accepted

The SQL is staged outside `supabase/migrations/` because it has not been executed against an isolated PostgreSQL/Supabase-compatible database. A static test cannot prove trigger ordering, policy parsing, RLS visibility, or runtime behavior. Do not apply it yet.

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
