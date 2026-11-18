# Evolution Phase One.5-B/C/D/E — Implementation and Acceptance Record

**Date:** 18 Nov 2026  
**Branch:** `feat/evolution-phase-one-identity-timezone`  
**PR:** #115 (draft; stacked on Phase Zero PR #114)

## Scope and safety

This record covers only Evolution Phase One.5-B through .5-E. It does not authorize a production migration, migration-ledger edit, merge, deployment, security-policy redesign, retention change, or loadout work. No Supabase development branch was created.

## B — India-only automatic date/timezone contract

<badge>IN PROGRESS · ISOLATED DATABASE VERIFICATION PENDING</badge>

### Application contract implemented

- The app is India-only and uses Asia/Kolkata (IST, UTC+05:30). Device timezone and location do not affect the evaluation date.
- Team creation and Team Join use the selected team's canonical India timezone. A member cannot choose a personal or international timezone.
- Daily Evaluation date is automatic, locked, and not editable/backdatable.
- Date display uses English international wording, e.g. November 18th 2026.
- The date refresh is scheduled for the next India midnight, not the phone's local midnight.
- The date key sent by the client is YYYY-MM-DD in IST. The existing database trigger remains authoritative for persisted score_date.
- The date is an India calendar day (00:00 to next 00:00 IST), not a rolling 24 hours from when the user opens the form. The separate pending-notice lifecycle (24-hour grace followed by a 24-hour visible pending period) is not changed in this B-only pass.

### Staged forward migration

docs/evolution/staged-migrations/20261118070000_team_timezone_contract.sql

- Adds a SECURITY INVOKER trigger on teams.timezone.
- Normalizes the existing column's UTC default and legacy Asia/Calcutta alias to Asia/Kolkata.
- Rejects all non-India timezone values.
- Checks existing rows before installing the trigger; it fails safely if unexpected timezone values are present.
- Normalizes the one existing Asia/Calcutta team row to Asia/Kolkata.
- Does not alter daily_scores, its existing anonymization/date trigger, or ds_insert RLS policy; does not reinterpret historical evaluation dates.

### Live read-only facts checked

- teams.timezone is NOT NULL with default UTC.
- Existing live team values: Asia/Kolkata (14 teams) and Asia/Calcutta (1 team); no other values.
- The app's create_team call already supplies Asia/Kolkata.
- The existing Daily Evaluation trigger and ds_insert policy both enforce Asia/Kolkata.
- Boundary checks around 00:00 IST pass for both the canonical timezone and legacy alias.

### Remaining acceptance gate

The forward SQL is still staged outside supabase/migrations/. It has not yet been executed against an isolated PostgreSQL/Supabase-compatible database. Runtime verification must prove: default/legacy normalization, rejection of non-India values, Team Join inheritance, and no change to the existing Daily Evaluation trigger/RLS contract. No production migration will be applied as part of this validation.

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
