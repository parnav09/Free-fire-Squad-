# Evolution Phase 2.2 — Canonical Session Identity

**Status:** BASE 2.2 SCHEMA PASS FOR LIMITED DEVELOPMENT (prior verified head) · POINT 2.2.1 EXTENSION IMPLEMENTED IN BRANCH, POSTGRESQL INTEGRATION NOT VERIFIED · production canonical migration NOT applied  
**Branch:** `feat/evolution-phase-two-2-canonical-session-identity`  
**Scope:** Point 2.2 only. No match child model, lifecycle workflow, roster/role snapshot, substitutions, result verification, module UI, production app deploy, or production session migration.

## 1. Contract

A canonical session is a team-owned record with a generated UUID. The UUID is the only stable internal identity. Display labels are descriptive metadata and are not identity keys. Title, session date, scheduled time, season label, week number, lobby label and display order remain mutable attributes.

Controlled session types:
- `scrim`
- `tournament`
- `training`

The optional season label remains descriptive. A Tournament cycle association is represented by a source mapping to its existing `tournament_cycles.id`, not by embedding a cycle/week string in the canonical UUID.

## 2. Schema deliverables

Migration: `supabase/migrations/20261119120000_evolution_phase_two_2_canonical_session_identity.sql`

### `public.canonical_sessions`
- Generated UUID primary key.
- Exactly one owning `team_id`.
- Controlled `session_type`.
- Mutable title/date/schedule/season metadata.
- Required per-team UUID idempotency key.
- Authenticated creator provenance.
- Soft archive fields; no hard-delete grant or policy. The non-destructive archive behavior keeps archived sessions stored and read-only through normal application permissions.
- Composite unique key `(id, team_id)` for tenant-safe child references.

### `public.canonical_session_sources`
- Maps canonical session UUID to one existing source UUID.
- Supports existing Scrim records, Tournament cycles and Training sessions.
- Uses source-specific nullable FK columns with an exact-one-source check.
- Composite same-team FKs prevent cross-team source attachment.
- Unique source mapping prevents one source record being mapped twice.
- Unique `(canonical_session_id, source_system)` prevents duplicate same-type mappings.
- Source mappings are append-only through the exposed API: no update/delete policy or grant.

### Create API
`create_canonical_session(...)` is a SECURITY INVOKER RPC:
- Requires a signed-in active Owner or Coach in the requested team.
- Uses a team-scoped idempotency key.
- Retries with the same payload return the existing UUID.
- Reusing a key with a different payload is rejected.
- Does not bypass RLS.

## 3. Access model

- Active team members can read their team's canonical sessions and source mappings.
- Active Owners/Coaches can create sessions and attach source mappings.
- Active Owners/Coaches can update unarchived session metadata.
- Archived sessions remain readable but cannot be updated through the table policy.
- Hard deletion is not exposed.
- Source links require the canonical session type to match the source system and all referenced records to belong to the same team.

This is the Phase 2.2 table/API access contract. It is not a substitute for the separate full Security workstream's adversarial audit of every pre-existing RPC.

## 4. Existing-system preservation

The migration is additive. It does not rewrite Scrim JSONB matches, Tournament cycles/matches, Planning plans/tasks, Training session IDs/results, historical roster values, or any existing result. Existing module adapters and broader cross-module UI wiring remain assigned to Point 2.9; match child identities remain Point 2.3. Eligible historical Training sessions receive a deterministic canonical UUID and an explicit source mapping; their legacy IDs and child references remain unchanged.

No second UI is introduced. The existing Planning/Training create action now calls the canonical RPC first, then writes the legacy training_sessions row using that same canonical UUID. Existing participant/result/task foreign-key contracts therefore continue to reference the same stable training row ID.


## 4.1 Frontend canonical RPC adapter — Point 2.2.1

PlanningTrainingCenter.tsx now:
- Calls create_canonical_session before writing a new Training session.
- Uses the database-returned canonical UUID as training_sessions.id for newly created sessions.
- Keeps the legacy Training row and its existing child references intact.
- Adds an explicit canonical_session_sources mapping from the canonical UUID to the legacy Training UUID.
- Verifies the legacy row and source mapping after writes; it never deletes a partially completed record to simulate rollback.
- Uses idempotent upserts for source mappings and participant associations so a retry can resume after a partial network failure.

### Persistent retry identity and offline recovery

src/features/training/pendingSessionRequest.ts stores a per-team pending request payload and idempotency UUID in local storage before the first network call. On reload, the existing form is restored from that payload. A retry with the same payload reuses the same key; a changed payload is blocked until the earlier request is completed. The marker is cleared only after the canonical row, legacy row, source mapping and participant associations have been verified.

This is an offline-to-online retry safeguard, not a full local session outbox: a session cannot be created while fully offline. The user must reconnect and retry the restored draft. No local temporary Session ID is treated as authoritative.

### Canonical identity write protection

Authenticated update grants are column-scoped. Only descriptive metadata (`title`, `session_date`, `scheduled_at`, `season_label`) and archive fields can be updated. Stable identity/provenance columns (`id`, `team_id`, `session_type`, `idempotency_key`, `created_by`, `created_at`) have no authenticated UPDATE privilege. The disposable harness asserts these column-level restrictions.

## 4.2 Historical source mapping

The additive migration backfills historical records from all three source systems when the source creator is present and the canonical title is valid:
- Training: existing created_by, title and scheduled_at;
- Scrim: existing owner_id and scrim_date, with a generated descriptive title;
- Tournament: existing created_by, title, cycle_start and registration_open_at.

It derives deterministic canonical UUIDs and idempotency keys from each immutable source UUID, then inserts the matching source mapping. Reapplying the migration does not create another canonical record or source mapping. Legacy source UUIDs are never updated, and no participants, results, match JSON or tasks are rewritten.

No season/cycle is inferred from title, date or other descriptive data. Historical season_label remains NULL. The Tournament cycle is represented by its source mapping; the original cycle UUID and date range remain in tournament_cycles. Rows that fail the explicit eligibility rules remain unmapped for manual evidence-based review rather than receiving fabricated provenance.

## 5. Verification plan

Disposable PostgreSQL integration harness: `scripts/verify-evolution-phase-two-2-db.sh`.

The harness creates minimal source-system fixtures, seeds a historical Training row before migration, executes the exact migration twice, and verifies:
- schema installation against PostgreSQL;
- historical Training session mapping is deterministic and replay-safe;
- legacy Training UUID and record remain unchanged;
- historical season metadata is not fabricated;
- same canonical UUID is used for new frontend-created legacy Training rows;
- same-key retry returns the same session UUID;
- payload mismatch on a reused idempotency key is rejected;
- active Owner/Coach authorization;
- Player role cannot create a session;
- team RLS hides another team's sessions;
- composite source FKs reject cross-team mapping;
- archived sessions remain readable but cannot be edited;
- API roles do not receive DELETE privileges.

Source-contract suite: `scripts/verify-evolution-phase-two-2.mjs`, wired into `npm run build`.

**Prior historical CI:** PASS on exact head `8d244f3526af5484cb52ab0a03d7420da6ad4546`, push run #395 ([44382446442](https://github.com/parnav09/Free-fire-Squad-/actions/runs/44382446442)). That run verified the earlier database-only Phase 2.2 implementation; it does not verify the frontend adapter and historical backfill added afterward.

**Latest exact-head application build: PASS** on `499a9dff9450354c85e79fcd97430c335eb48b5a` via Vercel Preview [dpl_6nRsPioapWnFTd4x8uaWomGWZqNB](https://vercel.com/parnav09/squad-os/6nRsPioapWnFTd4x8uaWomGWZqNB) (`https://squad-1piud8c1i-parnav09.vercel.app`). TypeScript typecheck, the full repository build test chain (including the legacy blueprint naming test, Phase 2.2 source-contract checks and all five pending-session retry tests), and Vite production bundle completed successfully; the previously failing legacy blueprint test now passes (10/10). This is a Preview deployment, not production. Vite still reports the existing large-chunk warning (main chunk 337.70 kB; gzip 84.66 kB); no unrelated code-splitting changes were made.

**Disposable PostgreSQL integration: BLOCKED / NOT VERIFIED.** Latest exact-head GitHub Actions run #851 (`44884502136`) failed before any job steps executed; job steps and logs are unavailable. Runs #849 (`44884402138`) and #845 (`44884230081`) show the same no-step failure. The harness fixture was strengthened in this branch to provision the `service_role` expected by the migration and to assert that stable identity/provenance columns cannot be updated. These SQL changes have not yet been executed against disposable PostgreSQL. The earlier CI pass on `8d244f...` covered the prior database-only implementation, not this frontend/backfill extension. This is not a database test pass. Production Supabase remains untouched.

## 6. Owner-approved limited-development exceptions (19 November 2026)

The owner asked to continue development without waiting for a Pro-plan upgrade or a production-scale rollout. This is a limited-development exception, not a claim that Phase 1.5-E has passed.

### 6.1 Supabase leaked-password protection
- **Disposition:** accepted outstanding limitation; leave disabled. Leaked Password Protection remains disabled until a Pro-plan upgrade is possible.
- **Reason:** the project is on the Free plan; Supabase documents leaked-password protection as Pro and above.
- **What the control does:** Supabase Auth checks new/changed passwords against the Have I Been Pwned Pwned Passwords service and rejects known-compromised passwords.
- **Residual risk:** Auth does not block a user from choosing a password already present in breach data. This increases exposure to password reuse and credential-stuffing attempts. It does not mean the project's password database has itself been leaked.
- **No bypass:** no custom client-side substitute is represented as equivalent to the hosted Auth check.
- **Free-plan mitigation:** keep a minimum password length of at least 8 characters; prefer a longer passphrase and enable the strongest password-character requirements available in the current Auth settings; encourage unique passwords and a password manager. Recheck the Security Advisor after any plan change.
- **Upgrade follow-up:** when the project moves to Pro or above, enable the control in Authentication → Sign In / Providers → Email and rerun Security Advisor.

Official references:
- https://supabase.com/docs/guides/auth/password-security
- https://supabase.com/pricing

### 6.2 Independent role-level tests
- **Disposition:** add targeted PostgreSQL role/RLS tests for the new Phase 2.2 objects in CI.
- **Remaining:** the separate broad adversarial review of all historical SECURITY DEFINER RPCs is not included in Point 2.2 and remains open. No claim is made that it is a Free/Pro plan restriction; it is a distinct test/review scope.

### 6.3 Original clean-replay baseline
- **Disposition:** not fabricated. The available evidence is not a verified original baseline.
- The repository does not contain an authoritative pre-migration schema baseline. The live migration ledger starts with historical migrations, but a migration ledger is not a schema dump.
- The connected Supabase database tools can inspect catalog metadata and execute SQL, but do not expose a schema-only `pg_dump` artifact or the database password needed for the official CLI `supabase db pull` workflow.
- Reconstructing a "baseline" from table lists or partial catalog queries would omit definitions such as policies, functions, triggers, grants, extensions and view dependencies. That would create a false clean-replay claim.
- **Required follow-up:** capture an authoritative schema-only dump from the project using the Supabase CLI with the project database password in a secure local environment; review it for secrets and environment-specific objects; commit it as a documented baseline artifact and validate a fresh disposable replay. Never put the DB password or access token in Git.
- This baseline gap remains open and is not silently waived.

## 7. Deployment and production boundary

- No canonical session migration is applied to production in Point 2.2.
- No application deployment, branch merge, production data backfill or UI rollout is performed here.
- The separate trigger-function ACL hardening was applied to the live Supabase project as migration version `20261118193817` (`revoke_direct_trigger_function_execution`). Post-apply catalog verification confirms all four trigger-only functions are no longer executable by `anon`, `authenticated` or `service_role`; the three installed trigger attachments remain present. The disposable PostgreSQL ACL harness also confirmed the Daily Evaluation trigger still executes after revocation.
- The post-apply Security Advisor no longer reports these four trigger functions as directly callable. It still reports 18 other authenticated SECURITY DEFINER functions, two RLS-enabled tables without policies, and the leaked-password-protection warning. These are not silently treated as resolved.
- The leaked-password limitation and missing original baseline remain visible in the Phase One carry-over ledger.

## 8. Exit decision

**Base Phase 2.2 schema:** PASS for limited development on its previously verified exact head `8d244f...`.

**Point 2.2.1 extension in PR #119:** IMPLEMENTED IN BRANCH, PARTIALLY VERIFIED. The latest Vercel exact-head build passes, but disposable PostgreSQL integration has not run because GitHub Actions fails before job steps start. Do not mark this extension complete until the migration replay, historical backfill, idempotency, RLS and immutable-identity assertions pass on a disposable database.

This does not imply Phase 1.5-E full security acceptance or authorize production rollout. The canonical session migration remains un-applied to production.
