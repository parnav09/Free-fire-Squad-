# Evolution Phase 2.2 — Canonical Session Identity

**Status:** PASS for limited development · exact-head CI verified · production trigger ACL hardening applied  
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

The migration is additive. It does not rewrite Scrim JSONB matches, Tournament cycles/matches, Planning plans/tasks, Training sessions/results, historical roster values, or any existing result. Existing module adapters and UI wiring remain assigned to Point 2.9; match child identities remain Point 2.3.

No new UI is required by Point 2.2. Building a second session UI before the later integration point would create a competing workflow.

## 5. Verification plan

Disposable PostgreSQL integration harness: `scripts/verify-evolution-phase-two-2-db.sh`.

The harness creates minimal source-system fixtures and executes the exact migration. It verifies:
- schema installation against PostgreSQL;
- same-key retry returns the same session UUID;
- payload mismatch on a reused idempotency key is rejected;
- active Owner/Coach authorization;
- Player role cannot create a session;
- team RLS hides another team's sessions;
- composite source FKs reject cross-team mapping;
- archived sessions remain readable but cannot be edited;
- API roles do not receive DELETE privileges.

Source-contract suite: `scripts/verify-evolution-phase-two-2.mjs`, wired into `npm run build`.

**Exact-head CI: PASS**  
Head: `8d244f3526af5484cb52ab0a03d7420da6ad4546`  
Push run #395: [44382446442](https://github.com/parnav09/Free-fire-Squad-/actions/runs/44382446442)

- 107 automated tests passed; 0 failed.
- TypeScript typecheck passed.
- Phase 2.2 disposable PostgreSQL integration passed.
- Phase 1.5-B forward/rollback integration passed.
- Trigger-function ACL integration passed, including the trigger smoke test.
- Vite production build passed.

The push run is tied to the exact branch head above. Earlier failed runs were superseded by this passing run; they are retained as diagnostic history.

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

Point 2.2 is **PASS for limited development**: the exact-head CI and disposable PostgreSQL gates are green, team isolation and retry behavior are tested, and the blueprint/PR carry the verification evidence.

This does not imply Phase 1.5-E full security acceptance or authorize production rollout. The canonical session migration remains un-applied to production.
