# Squad OS — E Phase One Continuation Handoff

Use this file when continuing in a new ChatGPT conversation.

## Exact resume prompt

**Continue Squad OS E Phase One.5 from PR #115. Read docs/evolution/E-PHASE-ONE-HANDOFF.md, docs/evolution/evolution-phase-one.md, and docs/evolution/E-PHASE-ONE-5-MIGRATION-AUDIT.md first. Continue migration provenance reconstruction only; do not approve or apply a timezone migration until provenance is reconciled. Preserve all roadmap and safety/scope boundaries.**

## Naming

- Evolution is shortened to **E** in conversation.
- **E Phase One** is the roadmap phase for stable identity, team membership, and timezone.
- Work is tracked as **E Phase One.1**, **E Phase One.2**, etc.
- Do not rename the existing docs/evolution-version-2.md blueprint.

## Repository and current work

- Repository: parnav09/Free-fire-Squad-
- Branch: feat/evolution-phase-one-identity-timezone
- PR: https://github.com/parnav09/Free-fire-Squad-/pull/115
- Parent Phase Zero PR: https://github.com/parnav09/Free-fire-Squad-/pull/114
- Phase One ledger: docs/evolution/evolution-phase-one.md
- Current scope: E Phase One only. Do not start Phase Two early.
- Deployment is deferred until the final planned Evolution stage, not during Phase One.

## Completed slices

### E Phase One.1
- Stable Auth UUID → membership UUID → team UUID resolver.
- UUID validation; display labels such as P1/P2 are never IDs.
- Active membership filtering and fail-closed ambiguity handling.
- IANA timezone validation and team-local date formatting helper.
- Contract tests for identity and timezone boundaries.

### E Phase One.2
- Integrated resolver into App.tsx loadTeam.
- Team membership is revalidated using membership ID, Auth user ID, team ID, and active status.
- Removed silent fallback to the first active team when a saved preference is invalid.
- Multiple active teams require explicit selection when no valid preference exists.
- Ambiguous/duplicate membership options are disabled.
- Team switching persists the selected team only after identity validation.
- Selected team timezone is fetched but not yet authoritative for persisted dates.
- Sign-out clears active team and related team-scoped UI state.
- Added source-contract regression tests.

## Verified E Phase One.2 checkpoint

- Current PR head: `14f394c6479a81aabd00ea7a13f1ea170bd8acfc`.
- GitHub Actions run #62 (`44174330712`) completed successfully: typecheck, all configured test suites, and Vite production build passed.
- Reviewed the current diff for `src/App.tsx`, identity helper and Phase One tests. No device QA or deployment is claimed.
- PR #115 remains open/draft and correctly targets `chore/evolution-phase-zero-one-naming`; do not merge before its Phase Zero dependency.
- Vercel status is separately rate-limited; it does not invalidate the successful GitHub Actions run. Do not access/share the full-app preview.

## E Phase One.3 — verified implementation checkpoint

- Added a latest-request guard for overlapping `loadTeam` calls. Every new request supersedes older requests.
- The load path checks request freshness after asynchronous boundaries before writing team choices, active team, roster, join requests, IGL, or capacity state.
- Stale request failures are ignored instead of surfacing errors over the current team selection.
- Sign-out invalidates all in-flight team-load requests.
- Added deterministic tests proving the newer response wins and sign-out invalidates pending work.
- Current PR head `a34bfa66220c8b0da8b86afee59c89b44def97fb` passed GitHub Actions run #68 (`44179015605`): typecheck, all configured tests, and Vite production build.
- E Phase One.3 is implemented and CI-verified; Phase One remains in progress because .4, .5, and final acceptance/security gates remain open.

## E Phase One.4 — implementation checkpoint

- Added `resolveTeamSessionEligibility` to verify the authenticated user, exact membership UUID, team UUID, non-empty role, and active status.
- Integrated the eligibility result into `loadTeam` after the exact membership re-fetch and before setting the active team.
- Invalid or mismatched session membership clears the selected team and team-scoped state.
- Added explicit team UI capability helpers for owner settings and coach/owner assignment controls; comments and tests state these are UI-only hints, not authorization.
- Added tests for eligible sessions, all fail-closed reasons, the role capability matrix, and app integration.
- Current PR head `a48ec0c5baec1d177e22751460bdfe7f62a14a08` passed GitHub Actions run #82 (`44180351504`): typecheck, all configured test suites (20 Phase One checks), and Vite production build.
- E Phase One.4 is implemented and CI-verified. The build still reports the existing large-chunk warning; no bundle-splitting changes were made in this slice.

## E Phase One.5 — read-only audit checkpoint (18 Nov 2026)

- Re-verified PR #115 as open/draft and still stacked on Phase Zero PR #114. Audited head before the documentation checkpoint: `dbaaa00bd42657bdb01238dd447a54fc89cfd9e9`.
- GitHub Actions run #86 (`44180645838`) passed its typecheck, configured tests, and Vite production build. Vercel separately reports a build-rate-limit failure; no preview/device QA is claimed.
- Live Supabase migration history contains 55 entries; the branch contains 23 migration files. Twenty distinct names overlap (21 live entries because one name appears twice); only 2 have exact version+name matches, 18 have timestamp mismatches, 34 live names have no same-name checked-in file, and 3 checked-in files have no direct same-name live entry.
- The repo has a duplicate migration timestamp prefix; the live history has a duplicate migration name under two versions. These are provenance anomalies, not proof that SQL is absent.
- Live `teams.timezone` exists; current teams use valid `Asia/Kolkata` and `Asia/Calcutta` values. The current Daily Evaluation insert trigger and `ds_insert` policy both hard-code `Asia/Kolkata`. The trigger also preserves anonymization and recipient-only privacy behavior that must remain intact.
- Added the read-only audit record: `docs/evolution/E-PHASE-ONE-5-MIGRATION-AUDIT.md`.
- No SQL, schema, data, trigger, policy, grant, function, or migration-history changes were made. No timezone UI was exposed.
- **E Phase One.5 is started but NOT complete:** migration provenance remains unreconciled, so no timezone migration design is approved.

## Next incomplete work

1. Reconstruct the live migration provenance, including the 34 live entries without same-name files, 18 timestamp mismatches, duplicate live name, duplicate checked-in timestamp prefix, and 3 unmatched checked-in files. Use repository history and deployment records; do not infer SQL absence from filename mismatch.
2. Inspect the remaining safe timezone/date write paths. Only after provenance is reconciled, prepare and review the forward/rollback timezone migration and acceptance tests.
3. Complete Phase One acceptance tests and independent Security validation; only then mark E Phase One complete.

## Non-negotiable boundaries

- Do not merge PR #114 or #115 without explicit user instruction.
- Do not deploy production; deployment is deferred to the end of the whole Evolution roadmap.
- Do not apply Supabase schema/data/trigger/policy/grant/function changes until migration provenance and rollback are reviewed.
- Do not re-enable the paused destructive retention job.
- Do not claim Vercel preview/device QA is ready; the earlier Vercel preview was blocked by build-rate limits.
- Keep Evolution Phase Zero legacy fixes separate from Phase One.
- Do not implement future Phase Two session/match/roster snapshots during Phase One.
- Keep the separate Security workstream separate.
- Do not access or implement restricted combat/weapon/loadout modules or use full-app previews that expose them. Work only in safe identity, membership, privacy, evaluation, analytics, tasks, tests, and documentation scope.

## Historical state to preserve

- Phase Zero PR #114 was open and draft at last check; its latest previously verified CI run #55 passed.
- Phase One PR #115 is a stacked draft branch based on `chore/evolution-phase-zero-one-naming` (confirmed from current GitHub PR metadata). Preserve this dependency and do not merge it ahead of Phase Zero.
- Historical CI runs #56 and earlier are superseded by the current-head verified runs documented above.
- No production deployment or database migration was made as part of the Phase One work so far.


## E Phase One.5 — migration-history reconstruction update (18 Nov 2026)

- Read the current live Supabase migration ledger and audited branch migration tree again. No live migration was edited or applied.
- Git history now confirms the Scrims migration filename replacements: 20261110150000 was replaced by 20261110181415 for personal/team reviews; 20261110182000 was replaced by 20261110181550 for owner-update team scoping. Both replacement versions are present in the live ledger. Do not replay the old files.
- The duplicate repository timestamp prefix 20261109007000 belongs to two distinct files introduced in separate commits and corresponds to separate live versions.
- Probable, not exact, mappings were recorded for roster capacity, task metadata, and Daily Evaluation migrations.
- Unresolved: duplicate live daily_score_feedback_private_rls entries vs one retained source file; create_character_profiles_table; singular/plural player-character loadout ledger entries; and the remaining live entries without recoverable checked-in SQL/application records.
- Full evidence and commit references are in docs/evolution/E-PHASE-ONE-5-MIGRATION-AUDIT.md.
- **E Phase One.5 remains IN PROGRESS.** The live ledger stores names/versions, not SQL bodies or content hashes. Do not claim full provenance reconciliation, approve/apply a timezone migration, alter the migration ledger, merge PR #115, or deploy.
- Next safe action: obtain the original SQL/application records for the unresolved live migration entries (including any direct Supabase operations), then compare each exact SQL body with the checked-in/historical source. Only after that can the timezone forward/rollback design be reviewed.


- Additional prior-operation search found a 7 Nov report of three migrations applied (bringing the reported total to eight), but exact SQL blocks and reliable per-migration mappings were not preserved; a separate earlier report counted five, so the count itself is not authoritative. Recovery OTP setup also lacks exact SQL/version evidence. These remain explicit provenance blockers in the audit.


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
