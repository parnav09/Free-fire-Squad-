# Evolution Phase One.5-B/C/D/E — Implementation and Acceptance Record

**Date:** 18 Nov 2026  
**Branch:** `feat/evolution-phase-one-identity-timezone`  
**PR:** #115 (draft; stacked on Phase Zero PR #114)

## Scope and safety

This record covers only Evolution Phase One.5-B through .5-E. It does not authorize a production migration, migration-ledger edit, merge, deployment, security-policy redesign, retention change, or loadout work. No Supabase development branch was created.

## B — India-only automatic date/timezone contract

<badge>IN PROGRESS · ISOLATED DATABASE VERIFICATION PENDING</badge>

### Application contract implemented

- Squad OS is India-only and uses the canonical timezone `Asia/Kolkata` (IST, UTC+05:30). A member's device timezone/location never selects the app date.
- The legacy IANA alias `Asia/Calcutta` is accepted only for backward compatibility and resolves to the same India date; all other timezone identifiers are rejected.
- Team creation passes `Asia/Kolkata`. Team Join attaches the member to the selected team; timezone remains a property of that team, not of the joining member.
- Daily Evaluation date is automatically selected, locked, and not editable or backdatable.
- Date display uses English international wording, e.g. `November 18th 2026`.
- The UI refreshes at the next India midnight, not device-local midnight.
- The client date key is `YYYY-MM-DD` in IST. The existing database trigger and `ds_insert` policy remain authoritative for persisted `score_date`.
- A Daily Evaluation date is an India calendar day (00:00 to next 00:00 IST), not a rolling 24 hours from form-open time. The separate pending-notice lifecycle is outside this B-only work and was not changed.

### Staged forward migration

`docs/evolution/staged-migrations/20261118070000_team_timezone_contract.sql`

- Adds a `BEFORE INSERT OR UPDATE OF timezone` trigger on `public.teams`; its PL/pgSQL function uses PostgreSQL's default SECURITY INVOKER behavior and does not use SECURITY DEFINER.
- The physical `teams.timezone` column default remains `UTC`. The trigger intercepts that default on INSERT and stores `Asia/Kolkata`; it also normalizes `Asia/Calcutta` to `Asia/Kolkata`.
- Rejects null/blank values and every non-India timezone identifier.
- Checks existing rows before trigger installation and fails safely if an unsupported value is present.
- Normalizes the one existing legacy `Asia/Calcutta` team row to `Asia/Kolkata` when the migration is executed.
- Because the trigger guards writes to the team row, it covers team creation and restore paths that write `teams.timezone`; Team Join inherits the already-selected team's timezone and does not set a member-specific timezone.
- Does not alter `daily_scores`, its existing date/anonymization trigger, or the `ds_insert` RLS policy; it does not reinterpret historical evaluation dates.

### Live read-only facts checked

- `teams.timezone` is NOT NULL with physical column default `UTC`.
- Existing live team values: `Asia/Kolkata` (14 teams) and `Asia/Calcutta` (1 team); no other values.
- The live `create_team` function uses its `p_timezone` argument and the app already supplies `Asia/Kolkata`.
- Existing team table triggers do not currently include the new timezone-validation trigger.
- The existing Daily Evaluation trigger and `ds_insert` policy both enforce `Asia/Kolkata`.
- Read-only boundary checks around 00:00 IST pass for both the canonical timezone and legacy alias.

### Automated verification

- Updated the legacy Evolution tests that still expected the removed `kolkataDateISO()` helper.
- Updated the Phase One timezone tests to enforce India-only behavior rather than accepting arbitrary IANA zones.
- Updated the earlier 1.5-B source-contract tests to match the current B-only design: the team timezone is guarded, while the existing Daily Evaluation trigger/RLS contract is deliberately untouched.
- Dedicated B suite: **7/7 passed**.
- GitHub Actions run **#236** on commit `12b420e74fa9d7dcc802a4e96c762b0316c2ab12`: typecheck, all configured test suites, and Vite production build **passed**.
- The Vercel status check remains a separate build-rate-limit failure; no Vercel deployment is claimed.

### Remaining acceptance gate

The forward SQL is still staged outside `supabase/migrations/`. It has not yet been executed against an isolated PostgreSQL/Supabase-compatible database. Runtime verification must prove: default/legacy normalization, rejection of non-India values, restore-path behavior, Team Join inheritance, and no change to the existing Daily Evaluation trigger/RLS contract. No production migration will be applied as part of this validation.


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
