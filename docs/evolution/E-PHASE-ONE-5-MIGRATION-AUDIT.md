# E Phase One.5 — Migration Provenance Audit Checkpoint

**Status:** IN PROGRESS — read-only audit completed for the current live migration ledger, current branch inventory, and the existing Daily Evaluation date-writing path. Migration provenance is **not reconciled**. No database migration or schema change has been applied.

**Branch:** `feat/evolution-phase-one-identity-timezone`  
**PR:** #115 (open, draft; stacked on Phase Zero PR #114)  
**Audited head:** `dbaaa00bd42657bdb01238dd447a54fc89cfd9e9`  
**Audit date:** 18 Nov 2026

## 1. Current-head verification

- PR #115 remains open and draft, with no merge.
- The audited head is `dbaaa00bd42657bdb01238dd447a54fc89cfd9e9`.
- GitHub Actions run #86 (`44180645838`) completed successfully. Its single job passed typecheck, configured tests, and the Vite production build.
- The combined commit status still reports a Vercel failure associated with the account build-rate limit. This is separate from the successful GitHub Actions run; no preview or device QA is claimed.
- No production deployment was run.

## 2. Migration inventory comparison

Read-only comparison of the live Supabase migration ledger and the audited branch tree found:

| Check | Result |
|---|---:|
| Live migration ledger entries | 55 |
| Checked-in migration files | 23 |
| Distinct migration names present in both | 20 |
| Live entries represented by those shared names | 21 |
| Shared names with exact version + name match | 2 |
| Shared names whose checked-in timestamp differs from live version | 18 |
| Live migration names with no same-name checked-in file | 34 |
| Checked-in files with no direct same-name live entry | 3 |

Additional anomalies:

- The checked-in directory contains two files with the same timestamp prefix `20261109007000`.
- The live ledger contains the same migration name, `daily_score_feedback_private_rls`, under two different versions: `20261109034550` and `20261109034618`.
- The checked-in file with that name has a different timestamp prefix.
- Git history confirms migration-directory changes and filename alignment/removal work, but that history alone does not prove which SQL was applied under each live version.

**Interpretation:** this is a provenance mismatch, not proof that the live database is missing SQL. A same-name/different-version record may reflect a rename, timestamp correction, re-application, or a migration recorded through another workflow. A missing checked-in file may have been deleted, squashed, renamed, or applied without a retained repository file. These possibilities must not be treated as equivalent.

## 3. Live timezone and Daily Evaluation write-path findings

Read-only inspection of the live schema and function definitions found:

- `public.teams.timezone` exists as `text NOT NULL DEFAULT 'UTC'`.
- The current team rows use two valid IANA names: `Asia/Kolkata` (14 teams) and `Asia/Calcutta` (1 team). The latter is a valid compatibility alias; this audit did not rewrite or canonicalize it.
- `public.create_team(p_name text, p_description text, p_timezone text)` stores the trimmed supplied timezone, falling back to `UTC` for blank input. Its current body does not validate the value against PostgreSQL's timezone catalog.
- `public.daily_scores` has a **BEFORE INSERT** trigger named `daily_scores_lock_date_anonymous`.
- The trigger function `public.lock_daily_score_date_and_anonymize()` currently sets `score_date` using hard-coded `Asia/Kolkata`, then preserves the existing anonymization/privacy behavior: clears evaluator identity and narrative fields and sets recipient-only visibility.
- The current `ds_insert` RLS policy independently checks that `score_date` equals the current `Asia/Kolkata` date. Updating only the trigger would therefore leave the insert policy inconsistent.
- The trigger is INSERT-only. No UPDATE trigger for this date lock was found.
- The trigger function is currently `SECURITY DEFINER`. This audit does not change its security mode, grants, policies, or function ownership.

## 4. Provisional migration direction — NOT APPROVED

Only after migration provenance is reconstructed and reviewed, the candidate forward migration should:

1. Resolve the timezone from the exact `teams.id = NEW.team_id` row for each new Daily Evaluation record.
2. Fail closed if the team row is missing or its timezone is not a recognized IANA timezone.
3. Set `daily_scores.score_date` from the same transaction timestamp interpreted in that team's timezone.
4. Update the `ds_insert` policy in the same migration so the policy and trigger enforce the same team-local date rule.
5. Preserve the trigger's current anonymization and recipient-privacy behavior exactly.
6. Validate timezone input on the server-side team creation/update paths; do not rely only on the client-side IANA helper.
7. Avoid rewriting historical `daily_scores.score_date` values.
8. Keep authorization/RLS hardening and independent Security review as a separate gate. Do not blanket-revoke `SECURITY DEFINER` functions or change unrelated grants.

This is a design direction, not migration SQL and not approval to apply a migration. The exact implementation depends on provenance reconstruction and a review of all relevant write paths.

## 5. Required acceptance tests for the eventual migration

- Two teams with different IANA timezones can produce different local dates for the same UTC instant.
- A timestamp immediately before and after local midnight maps to the correct team-local date.
- A daylight-saving timezone is tested across both a DST transition and an ordinary date boundary.
- The existing `Asia/Kolkata` value remains correct; the valid `Asia/Calcutta` alias is accepted unless a separately reviewed canonicalization policy is adopted.
- A missing team row or invalid timezone fails closed.
- A client-supplied `score_date` cannot override the server-derived value.
- The INSERT policy accepts the matching team-local date and rejects a mismatched date.
- Existing evaluator anonymization, narrative-field clearing, and recipient-only visibility behavior remain unchanged.
- Existing historical score dates are not rewritten.
- Rollback restores the exact pre-migration trigger function and INSERT policy definitions without modifying historical rows.

## 6. Blocking work before design approval

1. Reconstruct the 34 live entries without same-name checked-in files from repository history and deployment provenance. Identify whether each is deleted, renamed, squashed, or externally applied; do not infer SQL absence from filename mismatch.
2. Resolve the 18 same-name/different-version mappings and the duplicate live migration-name entry.
3. Resolve the duplicate checked-in timestamp prefix and the three checked-in files without direct live-name matches.
4. Inspect every safe write path that can change `teams.timezone` and `daily_scores` date values.
5. Obtain an independent Security review of the final function/policy design before any migration is applied.

## 7. Changes intentionally not made

- No SQL, schema, data, trigger, policy, grant, function, or migration-history changes.
- No migration file created or applied.
- No timezone selector exposed and no claim that persisted dates are already team-timezone-aware.
- No RLS/auth hardening or blanket SECURITY DEFINER changes.
- No retention job changes.
- No merge, production deployment, or full-app preview testing.
- No Phase Two work.
