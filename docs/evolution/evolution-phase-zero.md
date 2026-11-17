# Evolution Phase Zero — Existing System Audit and Hardening

**Review date:** 18 November 2026  
**Target:** SQUAD OS / Free Fire Squad  
**Implementation branch:** main  
**Audit status:** Evolution Phase Zero is not signed off; code hardening is committed, while migration provenance, remaining security controls, and end-to-end verification remain open.

## 1. Scope and safety boundary

This review covers the existing repository, build/test pipeline, local persistence foundation, Vercel project behavior, and the connected Supabase schema/security posture. The goal is to make the existing system safe and reproducible before Evolution Version 2 phases build on it.

No feature module was redesigned as part of this pass. No production data was reset, rewritten, or deleted. No new Evolution scoring, peer-review, task, trend, or analytics schema was introduced.

## 2. Repository baseline

- Repository: parnav09/Free-fire-Squad-
- Default branch: main
- Starting commit inspected: 9d28a7471530f9472530d79833583e729d190f43
- Stack: React 19, TypeScript, Vite 8, Supabase JS 2, Vercel
- Package versions in package.json are exact direct dependencies.
- package-lock.json is absent from the repository.
- .nvmrc and CI runtime were not previously aligned with Vercel's configured Node 26.x runtime.
- Two CI workflows were running overlapping build/test work; the older Phase 2 workflow also used a different Node major and npm install behavior.

## 3. Evolution Phase Zero — code changes already implemented on main

### 3.1 Browser storage resilience

- Added safeStorageGetItem, safeStorageSetItem, and safeStorageRemoveItem wrappers. They handle unavailable browser storage without crashing render or effects.
- App.tsx now uses guarded storage access rather than direct localStorage calls.
- Malformed or non-object persisted match/drill/note records fall back to safe empty records.
- Invalid roster JSON or invalid roster shapes fall back to the known initial roster.
- The selected local day is validated to the supported 1–7 range.

### 3.2 Legacy team-data migration

The previous one-time migration marker was written before the scoped records were persisted by later effects. If the app closed or storage failed between those operations, the marker could prevent a later retry.

The migration now:
1. Reads existing team-scoped data first.
2. Copies legacy data into each missing team-scoped key.
3. Checks whether each write succeeded.
4. Writes the one-time migration marker only after all required scoped copies have been persisted.
5. Leaves the marker unset on storage failure so a later mount can retry.

The same retry-safe behavior was applied to the shared team-local hook to prevent the dormant helper from retaining the old migration behavior.

### 3.3 Image-processing resource cleanup

- Team-logo crop coordinates are clamped to the supported range.
- Invalid image MIME types and zero-dimension images are rejected with readable errors.
- The generated object URL is released in a finally block, including image decode/canvas failures.
- Canvas and blob failures remain surfaced as errors rather than returning an invalid file.

### 3.4 Historical data protection

The old Settings controls advertised automatic deletion of evaluations, tournament archives, completed tasks, and training history. The live cleanup function did delete these records.

- The Supabase cron job squad-os-retention-daily (job id 3, 21:30 UTC / 03:00 IST) was paused and verified inactive.
- No records were deleted by this action.
- The owner Settings panel now explains that historical records are retained and automatic deletion is paused.
- The old retention controls were removed from the active UI; the database retention tables and cleanup function were not dropped or rewritten.
- A future archival feature must include export, recovery, authorization, audit, and explicit approval before any deletion is reintroduced.

### 3.5 CI hardening

- Consolidated the duplicate CI workflow into SQUAD OS Foundation CI.
- Removed the stale duplicate Phase 2 CI workflow.
- CI now runs on main pushes and pull requests targeting main.
- Workflow permissions are read-only.
- Added concurrency cancellation and a 15-minute timeout.
- CI uses Node 22.12.0 and runs the full build command, which includes typecheck, foundation tests, character-data tests, and Vite build.
- Because package-lock.json is not yet committed, CI currently generates a run-local lockfile before npm ci. This is not a substitute for a committed lockfile and remains a reproducibility task.

### 3.6 Foundation regression tests

Added checks for:
- Guarded storage access and invalid persisted data fallback.
- Retry-safe team-local migration ordering.
- Object URL cleanup and crop bounds.
- Historical retention controls remaining disabled.

The first test run exposed a regex syntax error in the newly added test code. That was corrected in commit 2f9e27f718a496250965abbbc17f53e9718b883b. The new CI run must finish successfully before this audit can claim build verification.

## 4. Evolution Phase Zero — Supabase live audit

Project: FF Squad  
Database: PostgreSQL 17.11  
Project status at audit: ACTIVE_HEALTHY

### 4.1 Table security

- 31 public application tables were found.
- RLS is enabled on all 31.
- The two OTP/recovery tables have RLS enabled with no policies. Keep them inaccessible to ordinary clients unless a documented server-side flow requires otherwise.
- No public views were found in the public schema during this snapshot.

### 4.2 Current advisor findings

Security:
- 4 trigger-only SECURITY DEFINER functions are executable by anon.
- 22 SECURITY DEFINER functions are executable by authenticated. Some are intentional team-scoped RPCs or RLS helpers; each must be reviewed individually.
- Leaked-password protection is disabled in Supabase Auth.

Performance:
- 27 unindexed foreign-key findings.
- 30 RLS auth/current_setting initialization-plan findings.
- 10 multiple-permissive-policy findings.
- 14 unused-index notices. These are not grounds for dropping indexes without query-plan and workload evidence.

Health:
- No health advisor findings.

### 4.3 Migration reconciliation snapshot (read-only, 18 November 2026)

A fresh comparison of the live migration list and the repository migration directory confirmed:

- Live Supabase migration history: 55 entries.
- Checked-in repository migration files: 23.
- Exact migration-name matches: 21 live entries. Their timestamp prefixes do not consistently match the live version values.
- Live entries without a same-name checked-in file: 34.
- Repository files without a direct live migration-name match: 3.
- The repository has a duplicate timestamp prefix on two different migration files.
- The live history contains the same migration name, daily_score_feedback_private_rls, twice under two distinct versions.
- The repository has no tracked supabase/config.toml.

This is not proof that all unmatched SQL is missing from the live schema: some entries may have been squashed, renamed, or applied under different timestamps. It does mean the current migration directory is not a reliable replay source without a provenance reconstruction.

Applying new RLS/function/index migrations before reconciling this gap could make the live database even less reproducible. Therefore:
- No new schema migration was applied in this pass.
- No SECURITY DEFINER grants were mass-revoked.
- No RLS policies were mass-rewritten.
- No foreign-key indexes were blindly added.
- No unused indexes were dropped.

The exact remediation backlog is recorded in docs/security/rls-review.md.

### 4.4 Auth setting requiring dashboard access

Leaked-password protection is a Supabase Auth configuration setting, not a PostgreSQL table setting. It remains open for the project owner to enable in Authentication → Settings → Password Security.

## 5. Evolution Phase Zero — Vercel and deployment boundary

- The project is linked to the main branch and automatically creates production deployment attempts on main pushes.
- The first build after these changes failed because of the test regex issue; it did not become a successful production release.
- A subsequent queued production attempt was canceled.
- The temporary Vercel ignore-build setting used during an earlier check has since been restored to its original null value. A Vercel Preview was subsequently auto-created for the naming pull request and reported READY by the Vercel GitHub integration. It has not been smoke-tested or accepted as Phase Zero verification. No Production promotion was performed as part of this PR.
- The project Node runtime was aligned to Node 22.x to match the CI Node 22.12.0 runtime.
- No production promotion or intentional production deployment is part of this task.

## 6. Evolution Phase Zero — verification still required

Phase 0 is not signed off until all of the following are true:

1. Latest GitHub Actions run passes typecheck, foundation tests, character tests, and Vite production build.
2. The Vercel Preview created for the naming PR is smoke-tested within an approved, safe feature scope.
3. Smoke tests confirm the app shell, sign-in initialization, local persistence, team isolation, and history-preservation Settings state.
4. Manual viewport QA covers 320px, 360px, 390px, tablet portrait/landscape, 1366px, and 1920px.
5. Full migration history/schema provenance is reconstructed and reconciled with checked-in migrations.
6. Four trigger-only function grants are safely revoked through a reviewed migration, with trigger behavior verified.
7. Authenticated SECURITY DEFINER functions are individually reviewed.
8. RLS policy performance warnings and missing FK indexes are addressed only after semantic and index-definition review.
9. Leaked-password protection is enabled in Supabase Auth.
10. A committed package-lock.json is added and CI switches to a strictly reproducible npm ci install.

## 7. Evolution Phase Zero — completion decision

**Code safety improvements:** implemented on main.  
**Historical auto-cleanup:** paused and verified inactive.  
**Automated build verification:** pending the latest CI run.  
**Vercel Preview verification:** pending.  
**Database security/migration baseline:** audited, not yet remediated because source migration history is incomplete.  
**Overall Evolution Phase Zero:** NOT COMPLETE until the verification and database gates above pass. Evolution Phase One is the next implementation stage and must not be treated as complete merely because its CI workflow exists.

This status is intentional. A documentation audit or green production deployment alone is not sufficient evidence that Phase 0 is complete.


## 8. Latest validation note — 18 November 2026

- The naming change is held in draft PR #114; it has not been merged to main.
- Vercel's PR integration reported a Preview deployment as READY. This is a deployment status only, not a smoke-test result or Phase Zero sign-off.
- The PR is documentation/workflow naming only. No database schema, RLS, grants, production data, or production deployment was changed by the PR.
- The migration comparison above was read-only. No schema migrations or permission changes were applied.
- The automatic historical cleanup job remains paused; no historical records were deleted.
- Evolution Phase Zero remains **NOT COMPLETE**. Do not mark it complete until every gate in section 6 is verified.
