# Evolution Phase One — Current Acceptance Audit Addendum (22 Nov 2026)

## 1. Scope and source of truth

This addendum supersedes earlier Phase One status snapshots where they conflict with the current GitHub or live Supabase evidence. Scope is Evolution Phase One only.

The master blueprint `docs/evolution-version-2.md`, section “Evolution Phase One — Identity, membership, timezone” (line 1190), defines:
- stable auth/player/team membership contract;
- team timezone setting and server-side date utilities;
- no P1-as-ID behavior;
- session eligibility primitives;
- permission test helpers.

Its gate requires stable Auth/player/team mapping, consistent active membership, display labels never used as IDs, and timezone-aware date boundaries. It explicitly places authorization/access-control testing in the separate Security workstream. The user-requested acceptance task additionally required a Phase 1-focused RLS/SECURITY DEFINER review; the security findings below are recorded as an acceptance addendum, not as a rewrite of the blueprint boundary.

The detailed handoff `docs/evolution/evolution-phase-one.md` expands this into 1.1–1.5:
- 1.1 stable identity/timezone;
- 1.2 application team-loading integration;
- 1.3 overlapping-load race protection;
- 1.4 session eligibility and UI capability helpers;
- 1.5-A migration provenance, 1.5-B timezone contract, 1.5-C rollback disposition, 1.5-D tests, 1.5-E final acceptance.

## 2. Repository and Git snapshot

- Repository: `parnav09/Free-fire-Squad-`
- Audit branch: `fix/evolution-phase-one-audit-20261122`
- Exact verified HEAD: `408324f780c1802a583caf8e3ec060d2bfa2f433`
- Historical PR #115: closed, not merged.
- Temporary continuation PR #141: closed, not merged. It was closed because its stale base produced a 221-commit / 144-file diff containing recovered Phase 0 and Phase 2 material; it was not safe to present as a Phase-One-only merge candidate. The audit branch remains available.
- No merge to main, no production deployment, no production Supabase write, and no Auth configuration change occurred.

The current branch contains 56 SQL migration files. The recovered migration manifest has 53 entries across the non-loadout historical migration set; it is not a Phase-One-only migration count. The live Supabase migration ledger currently reports 55 version/name rows. The branch also contains the separately scoped loadout migration, the pending performance-tuning migration, and the new Phase-One membership-ACL migration. The historical pre-migration baseline is still absent.

## 3. Implementation and automated verification

### 1.1 Stable identity and timezone

The identity helper validates canonical UUIDs and maps Auth UUID → membership UUID → team UUID. It rejects display labels, malformed identifiers, inactive membership, duplicate/ambiguous memberships, and unknown membership roles. The application timezone helper accepts `Asia/Kolkata` and the legacy `Asia/Calcutta` alias, normalizing to the India timezone contract. IST date keys and midnight refresh calculations are independent of device timezone. India has no daylight-saving transition; DST behavior is therefore not applicable to the supported timezone contract.

Files:
- `src/lib/evolution-identity.ts`
- `scripts/verify-evolution-phase-one.mjs`

### 1.2 Identity-based team loading and switching

`src/App.tsx` resolves active membership from the authenticated user, queries the selected team using validated UUIDs, and re-fetches the membership using membership/Auth/team IDs before accepting the selected team. It requires explicit choice for ambiguous multi-team membership, handles zero teams, and clears team-scoped state before loading a different team. Malformed membership result rows are filtered and only canonical resolved roles are used.

### 1.3 Overlapping-load race protection

`src/lib/latest-request-guard.ts` uses monotonically increasing request IDs. `loadTeam` checks freshness after asynchronous boundaries; stale responses and stale errors cannot commit. Identity/session effect cleanup invalidates pending requests. Tests cover newer request superseding older, old error after newer success, rapid switches, sign-out invalidation, unmount/invalidation, and state clearing.

### 1.4 Session eligibility and permission helpers

The session resolver requires a signed-in Auth UUID and exact active membership UUID/team UUID match. Capability helpers explicitly fail closed for unknown roles and are documented/tested as UI-only; they are not a server authorization boundary. Server-side permission findings are below.

### 1.5-A provenance / 1.5-C rollback disposition

The 53-entry recovered migration manifest and the 53-entry rollback disposition register remain available. The rollback register is a forward-only/no-automatic-rollback disposition; it does not claim 53 executable rollback scripts. The machine-check suite verifies the manifest and disposition records. The live ledger exposes version/name metadata, not the original pre-migration schema or original SQL for every historical operation.

### 1.5-B timezone contract

The staged forward SQL and rollback are under `docs/evolution/staged-migrations/`. CI runs the forward/normalization/rejection/restore-path/preservation/rollback test against disposable PostgreSQL. The live production catalog has no `teams_validate_timezone` trigger; the staged B migration has not been applied to production. Current live team timezone values are 15 `Asia/Kolkata` and 1 legacy `Asia/Calcutta`. The staged migration remains branch documentation/test material until the full migration baseline and acceptance are resolved.

### 1.5-D CI and build

GitHub Actions run #1023:
https://github.com/parnav09/Free-fire-Squad-/actions/runs/44948124085

- Exact HEAD: `408324f780c1802a583caf8e3ec060d2bfa2f433`
- Job: “Typecheck, tests and production build” — SUCCESS.
- Disposable PostgreSQL: 16.16 (Debian 16.16-1.pgdg13+1).
- Live Supabase PostgreSQL: 17.11.0.011.
- TypeScript: `tsc --noEmit` — PASS.
- Test suite counts: foundation 18/18; character 11/11; legacy Evolution 10/10; Phase One 27/27; Phase One.5 6/6; B 7/7; C 6/6; D 6/6; E 9/9. Total 100 passed, 0 failed.
- B database contract: PASS (forward, normalization, rejection, restore-path, existing trigger/RLS preservation, rollback).
- Security trigger ACL contract: PASS (API roles cannot call trigger functions directly; Daily Evaluation trigger remains functional).
- Membership ACL adversarial fixture: PASS (member self-promotion/identity/team/role/slot edits denied; cross-team and other-member loadout edits denied; non-owner RPC denied; signed-out RPC denied; malformed roles and over-capacity slots denied; legitimate owner assignment and own loadout update preserved).
- Vite production bundle: PASS (built in 284 ms).

Package scripts contain no separate lint command. `npm run build` includes typecheck, all nine test suites, and Vite build.

## 4. Fresh read-only Supabase security evidence

Current project: FF Squad, PostgreSQL 17.11, Free organization plan. All queries used for this audit were read-only catalog/advisor/migration inspections; no production test users or data were mutated.

### RLS and grants

RLS is enabled on the inspected core tables: `teams`, `team_members`, `team_settings`, `team_join_requests`, `daily_scores`, and `daily_score_feedback`.

Critical finding: `team_members` has policy `tm_update_character_loadout`, whose row predicate allows a user to update their own membership row (or an owner to update team rows). However, the live authenticated role also has UPDATE privileges on every membership column, including `membership_role`, `team_id`, `user_id`, `status`, `assigned_role`, and `player_number`. Row-level policy alone does not restrict which columns can be changed. This creates a direct membership self-promotion/identity reassignment risk.

The live function catalog also did not contain `public.set_member_assignment(uuid, smallint, text, boolean)`, although the audit branch application calls that RPC for roster assignment.

### Branch-only remediation

Added:
- `supabase/migrations/20261122000000_phase_one_membership_update_guard.sql`
- `scripts/verify-evolution-phase-one-membership-acl.sh`

The migration revokes broad UPDATE privileges, retains authenticated UPDATE only on `character_loadout`, and introduces owner-checked `set_member_assignment`. The function pins `search_path` to `pg_catalog, public`, validates `auth.uid()` and role input, checks `is_team_owner`, and delegates non-null player-slot changes to the existing capacity-aware `assign_member` RPC. The new SQL is branch-only and was tested in its own disposable CI database; it was not applied to production.

### SECURITY DEFINER functions and triggers

Security Advisor currently reports:
- 18 public SECURITY DEFINER functions executable by authenticated;
- no anon execution for those 18;
- two OTP tables with RLS enabled and no policies (INFO; documented as service-only);
- leaked-password protection disabled (WARN).

Read-only catalog inspection showed the 18 callable functions are owned by postgres and have a pinned `search_path=public`; authenticated cannot CREATE in the public schema, and anon cannot CREATE there either. Function bodies use auth.uid() directly or delegate to membership/owner helpers, but a full isolated adversarial runtime suite for all 18 has not been executed in this audit.

The live migration ledger includes version `20261118193817`, name `revoke_direct_trigger_function_execution`. Current catalog grants show the inspected trigger functions are not directly executable by anon/authenticated while their triggers remain attached. Historical docs that described this as merely staged are superseded by this live catalog observation. The exact SQL provenance/version equivalence between the live ledger entry and the differently timestamped staged file is not established here.

## 5. Phase 1.5-E acceptance gates

### Gate A — schema baseline and clean replay: BLOCKED

The authoritative schema baseline before the first recovered migration is not present in the repository or connected evidence. The recovered migration files and ledger metadata do not recreate the missing pre-migration baseline. The CI PostgreSQL jobs test targeted staged migrations/ACL fixtures, not the complete historical chain. Required next evidence: owner-held pre-2026-11-07 SQL/dump/backup or an independently reviewed baseline exception.

### Gate B — leaked-password protection: OWNER ACTION REQUIRED

Security Advisor directly reports leaked-password protection disabled. The current organization is on the Free plan. Supabase documentation states leaked-password protection is available on Pro and above:
https://supabase.com/docs/guides/auth/password-security

Owner action: decide whether to upgrade the Supabase organization to Pro or above, then enable the setting in Dashboard → Authentication → Settings / Password security (Auth settings). Re-run Security Advisor after the change. No setting was changed by this audit.

### Gate C — adversarial authenticated SECURITY DEFINER RPC tests: BLOCKED

The new disposable PostgreSQL test verifies the membership-update vulnerability and owner assignment RPC. It does not test all 18 authenticated-executable SECURITY DEFINER RPCs. Earlier 18/18 runtime evidence was against the connected project with transaction rollback; it is not accepted as a substitute for the current requirement to use isolated disposable users and teams. Required next step: build/obtain a disposable schema fixture covering all 18 RPCs and test allowed/denied cases without production users/data.

## 6. Regression and UI limits

Automated tests and the production build pass. The Phase One tests are deterministic unit/source-contract tests; the database shell scripts use disposable PostgreSQL fixtures. No live RPC behavior test was performed against production.

No browser automation, screenshots, five-viewport UI-flow verification, live-backend browser integration, or physical Android-device test was performed. Responsive UI, keyboard/focus, horizontal overflow, and end-to-end dependent-module flows (Scrims, Tournament, Planning, Training, Daily Evaluation, roster/player data) therefore remain NOT VERIFIED. No lint script is defined in `package.json`.

Adjacent risk observed but not changed: `can_rate(t,p)` checks caller team membership and target active membership but does not itself exclude `p = auth.uid()`; the current UI blocks self-evaluation. This is a Daily Evaluation/security follow-up outside this Phase One-only implementation change and should not be silently treated as server-side self-evaluation enforcement.

## 7. Final status

- 1.1: implementation and automated contract tests PASS.
- 1.2: implementation and automated source-contract tests PASS; server authorization defect addressed by branch-only migration, not production-applied.
- 1.3: implementation and deterministic race tests PASS.
- 1.4: eligibility/capability helper tests PASS; backend membership ACL acceptance awaits migration promotion and full isolated security suite.
- 1.5-A: provenance/disposition documentation verified; full clean replay BLOCKED.
- 1.5-B: staged timezone migration tests PASS; production write guard NOT APPLIED.
- 1.5-C: rollback disposition machine checks PASS; no automatic historical rollback scripts claimed.
- 1.5-D: CI/typecheck/tests/build PASS on exact HEAD.
- 1.5-E: BLOCKED by Gate A and Gate C; Gate B OWNER ACTION REQUIRED.

**Verdict: PHASE 1 IMPLEMENTATION COMPLETE — ACCEPTANCE PENDING.** This is not “Phase 1 fully accepted.” Do not merge or deploy until the original baseline issue, owner Auth action, full isolated 18-RPC suite, and responsive/browser regression verification are resolved.
