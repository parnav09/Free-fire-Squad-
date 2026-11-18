# Evolution Phase One — Identity, Membership, Timezone

**Status:** IN PROGRESS — E Phase One.1–.4 implemented. E Phase One.5-B forward SQL and .5-C rollback are drafted in staged-migrations; .5-D source-contract tests are added to build. No database integration validation has run. E Phase One.5-E acceptance is NOT PASSED because active-chain disposition, historical rollback classification, and isolated replay remain open.  
**Parent:** Evolution Phase Zero — Legacy Fixes (branch chore/evolution-phase-zero-one-naming, PR #114).  
**Branch:** feat/evolution-phase-one-identity-timezone  
**Scope:** stable Auth UUID, team membership identity, active membership selection, team timezone validation/date boundaries, session eligibility primitives, and permission-test helpers. Authorization/RLS/grants remain in the separate Security workstream.

## 1. Current repository findings

- Auth user identity is available from Supabase Auth as user.id.
- Team membership is represented by team_members.id, team_members.team_id, and team_members.user_id; membership_role and status describe the relationship.
- Team IDs and membership IDs are UUIDs. P1/P2 and display IGN are labels, not identity keys.
- teams.timezone already exists in the live schema inventory.
- Team creation currently calls create_team with p_timezone: "Asia/Kolkata".
- The live lock_daily_score_date_and_anonymize() trigger currently derives score dates using a hard-coded Asia/Kolkata timezone.
- The current loadTeam path uses the saved preferred team ID and requires explicit selection when active memberships are ambiguous; it does not silently fall back to the first active membership.
- The reusable identity resolver and IANA timezone validation/date-formatting helper are implemented in E Phase One.1–.4.

## 2. First implementation slice

Added src/lib/evolution-identity.ts:
- UUID validation for Auth, membership, and team IDs.
- Explicit Auth UUID → membership UUID → team UUID mapping.
- Active-membership filtering.
- Preferred-team selection.
- Fail-closed behavior for malformed IDs, duplicate membership rows, and ambiguous multi-team selection.
- IANA timezone validation.
- Team-local date formatting for display and deterministic boundary tests.

Important: the date formatter is not an authority for persisted records. Database triggers/RPCs remain authoritative until a reviewed migration makes the configured team timezone the server-side source of truth.

Added scripts/verify-evolution-phase-one.mjs with contract tests for identity mapping, labels-vs-IDs, active membership, multiple teams, duplicate membership ambiguity, timezone validation, and date-boundary behavior.

## 3. Hard blockers before completing Phase One

1. Migration provenance: the Phase Zero audit found live migration history that does not map cleanly to the checked-in migration directory. Do not add/apply a timezone-trigger migration until the live migration provenance is reconciled and a forward/rollback plan is reviewed.
2. Server-side timezone contract: the existing date trigger is hard-coded to India time. A client-only timezone selector would create inconsistent dates, so no editable timezone UI is exposed until the server trigger/RPC contract is safely updated.
3. Application integration: E Phase One.2 is implemented and CI-verified on the current PR head. It resolves the active membership in loadTeam, requires explicit team choice for ambiguous memberships, revalidates all stable IDs, and clears scoped state on sign-out. Race protection for overlapping requests is implemented and CI-verified in E Phase One.3.
4. Session eligibility: no session roster snapshot is added here; Phase Two owns session/match/role snapshots. Phase One will provide only stable active-membership primitives.
5. Security boundary: no RLS, grants, SECURITY DEFINER functions, Auth settings, or privileged authorization changes are included in this Evolution phase. Client checks are not a security boundary.

## 4. Acceptance gate

Phase One is not complete until:
- Auth UUID, membership UUID, and team UUID are mapped consistently.
- Display labels/IGN/P1 labels are never accepted as IDs.
- Active membership is represented consistently and inactive membership is excluded.
- Multiple active teams require an explicit selection; ambiguous membership is not silently resolved.
- Configured IANA timezone is validated.
- Date-boundary tests pass for at least two different team timezones.
- Server-side persisted dates follow the configured team timezone after a reviewed migration.
- Session eligibility primitives are documented and tested.
- Separate Security workstream validates authorization independently.

## 5. Changes intentionally not made

- No Supabase schema, data, trigger, policy, grant, or function changes.
- No RLS or Auth security changes.
- No production deployment, merge, or data reset.
- No future Phase Two session/match/roster snapshot implementation.
- No unrelated app modules changed.


## 6. Numbered implementation progress

### E Phase One.1 — Stable identity and timezone contract

- Added reusable UUID validation and Auth → membership → team identity mapping.
- Rejects display labels as IDs.
- Fails closed on inactive, malformed, duplicate, or ambiguous membership rows.
- Added IANA timezone validation and team-local date formatter for display.
- Added contract tests for mapping, ambiguous teams, invalid IDs, and two timezone date boundaries.

### E Phase One.2 — Application team-loading integration

- Integrated the resolver into the real App.tsx loadTeam path.
- Active membership lookup now includes membership UUID, Auth UUID, team UUID, role, and status.
- Team data is loaded only after the resolver returns one exact active membership; the membership row is re-fetched using all three stable IDs.
- Removed the old fallback that silently selected the first active membership when a saved team preference was invalid.
- Accounts with multiple active teams and no valid saved preference are asked to explicitly choose a team.
- Duplicate/ambiguous membership options are disabled rather than silently selected.
- Team switching no longer writes the preferred team ID before validation succeeds.
- Team timezone is fetched with the selected team record, but remains informational until the server-side persisted-date contract is migrated.
- Sign-out clears active team, roster, team choices, join requests, and IGL selection.
- Added source-contract regression checks for these integration rules.

**E Phase One.2 boundary:** no RLS, grants, authorization RPCs, database migrations, or production data were changed. No session/match/roster snapshots were added; those remain Phase Two.


### E Phase One.3 — Overlapping team-load race protection

- Added a latest-request guard so a newer `loadTeam` request supersedes any older request still in flight.
- Checked freshness after asynchronous membership, team, roster-capacity fallback, and profile reads before committing state.
- Stale request errors are ignored; only the current request can surface a load error.
- Sign-out invalidates all in-flight team-load requests.
- Added deterministic overlap and sign-out invalidation tests.
- GitHub Actions run #68 (`44179015605`) passed typecheck, all configured tests, and Vite production build.
- Status: IMPLEMENTED + CI VERIFIED.


## 7. E Phase One.2 verification record

- Current PR head verified: `14f394c6479a81aabd00ea7a13f1ea170bd8acfc`.
- GitHub Actions run #62 (`44174330712`): **success**. Job “Typecheck, tests and production build” completed successfully, including typecheck, foundation tests, character tests, Evolution legacy tests, Evolution Phase One tests, and Vite production bundle build.
- Source diff reviewed for `src/App.tsx`, `src/lib/evolution-identity.ts`, and `scripts/verify-evolution-phase-one.mjs`.
- Combined commit status still reports Vercel failure due to the account's deployment-rate limit. This is not a GitHub Actions/code-test failure; no preview/device QA is claimed or required for this slice.
- PR #115 remains open and draft, based on `chore/evolution-phase-zero-one-naming`; no merge, production deployment, Supabase migration, or security-policy change was made.
- **E Phase One.2 status: IMPLEMENTED + CI VERIFIED.**
- Next implementation slice: **E Phase One.5 — migration provenance reconciliation and reviewed timezone migration design**. Do not start Phase Two.


### E Phase One.4 — Session eligibility and UI capability test helpers

- Added a pure session eligibility resolver that requires a valid Auth UUID, exact active membership UUID, matching Auth user UUID, matching team UUID, and a non-empty membership role.
- The resolver returns explicit fail-closed reasons for unauthenticated, malformed, missing, inactive, user-mismatched, or team-mismatched membership.
- Integrated the resolver into the selected-team load path after the membership re-fetch and before setting the active team.
- Added UI-only capability helpers for team settings and assignment management. They are not server authorization and do not replace RLS/RPC policy enforcement.
- Added focused tests for eligible/ineligible sessions, role capability combinations, and app integration.
- GitHub Actions run #82 (`44180351504`) passed typecheck, all configured test suites (20 Phase One checks), and Vite production build.
- Status: IMPLEMENTED + CI VERIFIED.


### E Phase One.5 — read-only migration provenance audit checkpoint

- Re-verified PR #115 and its current-head CI before the audit. GitHub Actions run #86 (`44180645838`) passed; the separate Vercel build-rate-limit failure is not a GitHub Actions failure.
- Compared the live Supabase ledger (55 entries) with the checked-in branch migration directory (23 files): 20 distinct names overlap (21 live entries due to one duplicate name); 2 have exact version+name matches; 18 shared names have timestamp mismatches; 34 live names have no same-name checked-in file; and 3 checked-in files have no direct same-name live entry.
- Found a duplicate checked-in timestamp prefix and a duplicate live migration name under two versions. These are provenance mismatches, not proof that live SQL is absent.
- Live `teams.timezone` is present. Current team values are valid `Asia/Kolkata` and `Asia/Calcutta`. The live Daily Evaluation BEFORE INSERT trigger and `ds_insert` policy both still hard-code `Asia/Kolkata`; both must be considered together in any future migration.
- The trigger also enforces evaluator anonymization and recipient-only feedback behavior. Those behaviors must be preserved. The trigger function is currently SECURITY DEFINER; Security review remains a separate gate.
- Full findings and provisional, not-approved migration direction: [E Phase One.5 Migration Audit](E-PHASE-ONE-5-MIGRATION-AUDIT.md).
- **Status: STARTED — READ-ONLY AUDIT CHECKPOINT ONLY.** No database, migration, schema, data, trigger, policy, grant, function, UI, or production changes were made.

**Next:** reconstruct the unmatched live/repository migration provenance from repository history and deployment records. Do not approve or apply the timezone migration until the mapping is complete and independently reviewed.


### E Phase One.5 — repository-history reconstruction update (18 Nov 2026)

- Reconstructed high-confidence Scrims migration filename alignment from Git history: the original personal-review file and the original owner-update filename were removed after production-aligned replacements were added. The live ledger contains the replacement versions. Do not replay or rewrite these migrations.
- Confirmed the two files sharing repository timestamp prefix 20261109007000 came from separate commits and correspond to separate live migration versions; the duplicate repository prefix is a filename defect, not a duplicate live version.
- Identified probable semantic mappings for the roster-capacity file, task-metadata file, and Daily Evaluation source files. These are not exact version/content matches.
- Found that the duplicate live daily_score_feedback_private_rls entries have only one retained checked-in source file; the exact SQL applied under each live version remains unresolved.
- Character profile creation and singular/plural loadout ledger entries also lack a complete one-to-one SQL provenance record. Prior-operation records provide partial feature context but not exact SQL/application records.
- Expanded the migration audit with commit SHAs, historical file replacements, and an evidence-classification table: [E Phase One.5 Migration Audit](E-PHASE-ONE-5-MIGRATION-AUDIT.md).
- **Status remains IN PROGRESS.** The ledger stores migration version/name metadata but not SQL bodies or content hashes, and the available project history does not recover every direct database operation. No database migration, schema change, ledger edit, or timezone migration approval was made.


## E Phase One.5 — continuation verification checkpoint (18 Nov 2026)

- Re-read the Evolution Version 2 master blueprint, this handoff, the Phase One ledger, and the existing migration provenance audit at the current PR #115 head.
- Verified PR #115 is still open and draft, targeting `chore/evolution-phase-zero-one-naming`; current head: `79044f667a1f7fdfe1f38c1eddbdad243c778583`. It remains stacked on Phase Zero PR #114. No merge or retarget was performed.
- Reviewed the current PR changed-file list and patches (9 files). The PR contains no Supabase migration SQL or schema files. No restricted combat/weapon/loadout source modules or full-app preview were opened.
- GitHub Actions run #101 (`44186482533`) for this exact head completed successfully. Its single job passed dependency setup, typecheck, configured foundation/contract/character checks, and the Vite production build.
- The combined commit status reports a separate Vercel failure due to the deployment-rate limit. This is not a GitHub Actions failure; no preview/device QA is claimed and no preview was opened.
- Re-read the live Supabase migration ledger in read-only mode: 55 version/name rows are present, matching the previously recorded count. The ledger response contains migration version/name metadata only, not original SQL bodies or content hashes. PR discussion added no original SQL/application records.
- No new exact SQL-to-ledger mappings were established. The previously documented 18 timestamp mismatches, 34 live names without same-name checked-in files, 3 unmatched checked-in files, duplicate live migration name, and unresolved direct-application records remain blockers. Existing Scrims filename replacement conclusions remain unchanged; do not replay old files.
- No Supabase schema, data, trigger, RLS/policy, grant, function, or migration-history changes were made. No migration was created or applied. Destructive retention remains paused; Security remains separate; Phase Two has not started.
- **E Phase One.5 remains IN PROGRESS.** The next required evidence is the original SQL and application record for each unresolved live migration (including direct Supabase operations). Do not reverse-engineer missing source SQL from current schema, approve a timezone migration, or apply any database change until provenance and rollback are reviewed.


## E Phase One.5 — documentation checkpoint CI verification (18 Nov 2026)

- The continuation checkpoint was recorded in two documentation-only commits: `71930753024a900b40e316dc7c0650b5c989c02c` (handoff) and `654f0efe91e03dbf10cc03316849ff482b4c480b` (Phase One ledger).
- PR #115 remained open/draft and stacked on PR #114 at head `654f0efe91e03dbf10cc03316849ff482b4c480b`; no merge, retarget, production deployment, or database change occurred.
- GitHub Actions run #104 (`44190256268`) for that exact head completed successfully. The single job and all steps passed, including typecheck, configured verification suites, and Vite production build.
- The separate Vercel status remains rate-limited; no full-app preview or device QA was accessed or claimed.
- The provenance blocker is unchanged: the live migration ledger exposes only version/name metadata, and original SQL/application records for unresolved entries remain unavailable. E Phase One.5 stays IN PROGRESS.


## E Phase One.5 — 34-entry live-only migration inventory (18 Nov 2026)

- Added [`E-PHASE-ONE-5-34-LIVE-ONLY-MIGRATIONS.md`](./E-PHASE-ONE-5-34-LIVE-ONLY-MIGRATIONS.md) with all 34 live-only version/name rows and evidence classification.
- Exact-name mismatch is not proof of missing database functionality. Semantic matches and files found on other branches are explicitly marked as candidates until original SQL and application records are verified.
- No migration source was invented, renamed, copied, or applied. No Supabase schema, data, trigger, RLS, grant, function, or migration-history change was made.
- Phase One.5 remains blocked on original SQL/application evidence and rollback review. Phase Two has not started.


### E Phase One.5 — latest verification and timezone write-path inventory (18 Nov 2026)

- Current PR #115 head ac76497c30b90464ecfb10adc9ded8e1bdfdf48a is open/draft and stacked on Phase Zero PR #114.
- GitHub Actions run #114 (44191983016) passed for the exact current head: dependency setup, lockfile pinning, typecheck, configured verification suites, and Vite production build.
- Re-read the live Supabase migration ledger: 55 version/name rows. No Supabase development branches are present. The ledger exposes version/name metadata only, not original SQL bodies or content hashes; unresolved provenance remains blocked.
- Read-only inspection expanded the timezone write-path inventory: create_team, restore_team_backup, and restore_team_backup_for_team all write teams.timezone without server-side IANA validation. Daily Evaluation date persistence remains hard-coded to Asia/Kolkata in both the BEFORE INSERT trigger and ds_insert policy.
- A complete future timezone change must validate timezone values in all three write paths and update the trigger/policy as one consistent contract. Preserve existing anonymization and recipient-only feedback semantics; do not rewrite historical scores.
- No Supabase schema/data/trigger/policy/grant/function/migration-history change, merge, production deployment, preview QA, Security implementation, retention change, or Phase Two work occurred.
- **E Phase One.5 remains IN PROGRESS / BLOCKED on original SQL/application provenance and rollback evidence.**


## E Phase One.5-B/C/D/E — implementation checkpoint (18 Nov 2026)

- Read-only Supabase inspection confirmed `teams.timezone` is NOT NULL with default UTC; current values are Asia/Kolkata (14 teams) and Asia/Calcutta (1 team), both recognized by `pg_timezone_names`.
- Confirmed the existing `daily_scores_lock_date_anonymous` BEFORE INSERT trigger sets Asia/Kolkata and also anonymizes evaluator/notes and enforces recipient-only visibility. The `ds_insert` policy independently enforces Asia/Kolkata.
- Added a staged forward migration at `docs/evolution/staged-migrations/20261118070000_team_timezone_contract.sql`. It validates all writes to `teams.timezone` with a SECURITY INVOKER trigger; adds a later-sorting Daily Evaluation date trigger that uses the selected team's timezone; and changes only the `ds_insert` date predicate while preserving `evaluator_id IS NULL` and `can_rate(team_id, player_id)`.
- Added its rollback at `docs/evolution/staged-migrations/20261118070000_team_timezone_contract.rollback.sql`. It restores the exact former Asia/Kolkata policy predicate and removes only the new trigger/functions. It does not alter historical scores or the existing anonymization trigger.
- Added `scripts/verify-evolution-phase-one-5.mjs` and wired `npm run test:evolution-phase-one-5` into `npm run build`. These are source-contract tests; they do not replace PostgreSQL execution/RLS testing.
- Added [Phase One.5-B/C/D/E acceptance record](./E-PHASE-ONE-5-B-C-D-E-ACCEPTANCE.md).
- The forward SQL remains outside `supabase/migrations/` and has not been applied. No production schema/data/RLS/function/trigger/ledger changes, Supabase branch, merge, or deployment occurred.
- **Status:** B drafted; C rollback drafted for the new B migration only; D tests added but CI/database execution pending; E acceptance NOT PASSED. Historical ledger has 0/53 rollback statements, six active-file SQL mismatches and three unmatched files still need disposition, and clean replay remains blocked by missing original baseline.
