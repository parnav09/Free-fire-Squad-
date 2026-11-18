# Evolution Phase One.5-B/C/D/E — Implementation and Acceptance Record

**Date:** 18 Nov 2026  
**Branch:** `feat/evolution-phase-one-identity-timezone`  
**PR:** #115 (draft; stacked on Phase Zero PR #114)

## Scope and safety

This record covers only Evolution Phase One.5-B through .5-E. It does not authorize a production migration, migration-ledger edit, merge, deployment, security-policy redesign, retention change, or loadout work. No production migration or deployment was performed during this audit. No Supabase development branch was created.

## B — India-only automatic date/timezone contract

<badge>PASS · DISPOSABLE POSTGRESQL VERIFIED IN CI RUNS #352/#353</badge>

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

The forward SQL remains staged outside `supabase/migrations/` and has been executed against disposable PostgreSQL 16 in GitHub Actions runs #352/#353 (IDs 44276950260 and 44276957631). The test passed default/legacy normalization, invalid/blank rejection, restore-path normalization, canonical team-timezone lookup, and preservation of the existing Daily Evaluation trigger/RLS policy. The exact staged rollback also passed and removed only the new timezone trigger/function. This is B runtime proof in CI; production remains unchanged.


## C — Rollback

### Implemented for the new B migration

`docs/evolution/staged-migrations/20261118070000_team_timezone_contract.rollback.sql`

- Drops only `teams_validate_timezone` and `validate_team_timezone()`, the objects created by the B forward migration.
- Leaves the existing Daily Evaluation triggers, functions, `ds_insert` policy, and historical score rows untouched; the forward migration does not modify them.
- Leaves the one legacy team timezone normalized to `Asia/Kolkata` rather than reintroducing the deprecated alias during rollback.

### Historical rollback disposition — COMPLETE

See [E Phase One.5-C Historical Rollback Disposition Register](./E-PHASE-ONE-5-C-ROLLBACK-REGISTER.md) and its machine-checked [manifest](./evolution-phase-one-5-c-rollback-manifest.json).

- Read-only live-ledger audit: 55 rows total; 53 in-scope non-loadout historical rows; two loadout rows remain outside this phase.
- Stored rollback statements: **0/53**. No historical rollback SQL was invented from the current schema.
- All **53/53** in-scope versions now have an explicit, reasoned `forward-only / no automatic rollback` disposition, a risk class, and a concrete recovery rule.
- The duplicate name `daily_score_feedback_private_rls` remains represented as two distinct versioned entries.
- Destructive cleanup/retention changes, user-edited seed data, privacy/RLS changes, function replacements, and schema dependencies are explicitly protected from blind reversal.
- The register prohibits migration-ledger rewrites, replaying old forward migrations, and unreviewed destructive inverses.
- The B timezone rollback remains a separate staged draft; it is not a historical rollback. Forward and rollback behavior passed disposable PostgreSQL CI runs #352/#353.

**C historical disposition result: COMPLETE · DOCUMENTED · MACHINE-CHECKED.** This does not claim that historical rollback SQL exists or that production data can be restored by code alone. Any future compensation remains a new, independently reviewed migration with isolated database tests and separate release approval.

## D — Tests and validation

Added `scripts/verify-evolution-phase-one-5.mjs`, the C rollback disposition manifest/register, `scripts/verify-evolution-phase-one-5-c.mjs`, and the dedicated D validation suite `scripts/verify-evolution-phase-one-5-d.mjs`; the base, B, C, and D suites are wired into `npm run build`.

The checks cover:
- timezone validation trigger presence;
- team-local Daily Evaluation date derivation;
- preservation of the existing anonymization trigger and `can_rate`/recipient-null checks;
- rollback restoration and object cleanup;
- no historical row rewrite;
- staged SQL remaining outside the active migration directory.

**Earlier local result:** the original Node source-contract suite passed **6/6**. The new C-specific suite validates all 53 disposition records, unique version coverage, the two intentionally excluded loadout versions, duplicate-name handling, all risk-class recovery rules, and no-destructive-inverse rules. GitHub Actions run #260 (ID 44257295715) on the corrected head passed: typecheck, all configured suites (including C 6/6), and Vite production build.

**D acceptance:** the D suite cross-checks build wiring, B timezone/date test cases and staged SQL invariants, C 53-entry disposition coverage, B forward/rollback scope, and the explicit database/production evidence boundary. The suite validates the B test case names rather than relying on brittle source-text copies of runtime timezone values. D is complete when this suite and the full CI build pass on the exact head commit. **Limit:** the D suite itself is a source-contract suite, not a database integration suite. The separate disposable PostgreSQL workflow step now executes the staged B forward/rollback SQL and verifies the runtime contract.

## E — Final Phase One acceptance audit

The current-head final audit and its machine-checkable guard suite are recorded in [E Phase One.5-E Final Acceptance Audit](./E-PHASE-ONE-5-E-FINAL-AUDIT.md). B runtime execution is now verified in CI. E remains **BLOCKED / NOT PASSED** because the authoritative baseline/clean-replay evidence is unavailable and security gates remain open.

| Gate | Result |
|---|---|
| Identity/membership E Phase One.1–.4 | Implemented; prior CI verified |
| Original SQL recovery for 53 safe-scope entries | 53/53 byte/hash verified |
| Active migration-chain reconciliation | **Complete · verified: 53/53 exact in-scope matches; zero missing/extra in-scope files** |
| Historical rollback disposition | **Complete · 53/53 explicitly forward-only; 0/53 automatic rollback statements** |
| New timezone forward migration | **Disposable PostgreSQL CI PASS** · runs #352/#353; staged, not production-applied |
| New timezone rollback | **Disposable PostgreSQL CI PASS** · runs #352/#353; staged, not production-applied |
| Isolated clean replay | Not run; original pre-migration baseline unavailable |
| Runtime timezone/RLS verification | **PASS in disposable PostgreSQL CI** · runs #352/#353 |
| Full Phase One acceptance | **NOT PASSED** |

## Exact remaining blockers

1. The pre-migration baseline needed for a clean replay is unavailable; do not invent it or claim a clean replay.
2. The authoritative pre-migration baseline is unavailable, so full-chain clean replay cannot be claimed.
3. Security review is partially closed: OTP tables are verified service-only; four trigger-returning functions have staged least-privilege ACL fixes with CI proof; the remaining authenticated RPCs have static auth/ownership/membership checks but need adversarial role-level tests; leaked-password protection remains disabled and needs the Supabase Auth setting enabled.
4. Any future historical compensation must be implemented as a new reviewed migration with isolated tests; no automatic historical rollback is approved.
5. Re-run the full build/CI and Phase One acceptance checklist against the resulting exact commit.

**Current result:** C historical rollback disposition is complete (53/53). Exact-head CI runs #352/#353 passed B disposable-PostgreSQL forward/rollback tests, security trigger ACL tests, all configured suites (including D 6/6 and E 7/7), typecheck, and Vite production build. The pre-migration baseline required for full clean replay is unavailable; Auth leaked-password protection and adversarial RPC review remain open. E therefore remains **BLOCKED / NOT PASSED**. No production database or deployment changes were made.
