# Phase 0 — Existing System Audit and Hardening

**Review date:** 18 November 2026  
**Target:** SQUAD OS / Free Fire Squad  
**Implementation branch:** main  
**Audit status:** Code hardening in progress; Phase 0 sign-off is blocked by database migration drift and remaining security controls.

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

## 3. Code changes implemented on main

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

## 4. Supabase live audit

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

### 4.3 Why database policy/function changes were not mass-applied

The live migration history contains 55 entries, while the repository contains only 23 checked-in SQL migration files. The checked-in filenames and live migration versions do not provide a complete one-to-one source history. The repository also has no tracked supabase/config.toml.

Applying new RLS/function/index migrations before reconciling this gap could make the live database even less reproducible. Therefore:
- No new schema migration was applied in this pass.
- No SECURITY DEFINER grants were mass-revoked.
- No RLS policies were mass-rewritten.
- No foreign-key indexes were blindly added.
- No unused indexes were dropped.

The exact remediation backlog is recorded in docs/security/rls-review.md.

### 4.4 Auth setting requiring dashboard access

Leaked-password protection is a Supabase Auth configuration setting, not a PostgreSQL table setting. It remains open for the project owner to enable in Authentication → Settings → Password Security.

## 5. Vercel and deployment boundary

- The project is linked to the main branch and automatically creates production deployment attempts on main pushes.
- The first build after these changes failed because of the test regex issue; it did not become a successful production release.
- A subsequent queued production attempt was canceled.
- A temporary ignore-build command is configured to skip production Git builds while allowing Preview builds during this Phase 0 validation. Restore the original project setting after the preview is verified.
- The project Node runtime was configured as 26.x while CI used Node 22.12.0. Aligning the Vercel project runtime to Node 22.x is required before preview sign-off.
- No production promotion or intentional production deployment is part of this task.

## 6. Verification still required

Phase 0 is not signed off until all of the following are true:

1. Latest GitHub Actions run passes typecheck, foundation tests, character tests, and Vite production build.
2. A Vercel Preview deployment from the exact main commit reaches READY.
3. Preview smoke tests confirm the app loads, sign-in shell initializes, local persistence hydrates, team switching does not cross-contaminate records, and Settings no longer advertises destructive retention.
4. Manual viewport QA covers 320px, 360px, 390px, tablet portrait/landscape, 1366px, and 1920px.
5. Migration history/schema is exported and reconciled with checked-in migrations.
6. Four trigger-only function grants are safely revoked through a reviewed migration, with trigger behavior verified.
7. Authenticated SECURITY DEFINER functions are individually reviewed.
8. RLS policy performance warnings and missing FK indexes are addressed only after semantic and index-definition review.
9. Leaked-password protection is enabled in Supabase Auth.
10. A committed package-lock.json is added and CI switches to a strictly reproducible npm ci install.

## 7. Phase 0 completion decision

**Code safety improvements:** implemented on main.  
**Historical auto-cleanup:** paused and verified inactive.  
**Automated build verification:** pending the latest CI run.  
**Vercel Preview verification:** pending.  
**Database security/migration baseline:** audited, not yet remediated because source migration history is incomplete.  
**Overall Phase 0:** NOT COMPLETE until the verification and database gates above pass.

This status is intentional. A documentation audit or green production deployment alone is not sufficient evidence that Phase 0 is complete.
