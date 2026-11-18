# Evolution Phase 2.3 — Canonical Match Identity

**Blueprint mapping:** Evolution Version 2, §38.3 Point 2.3 — Match Identity  
**Status:** Implementation branch · exact-head CI pending  
**Branch:** feat/evolution-phase-two-3-match-identity  
**Parent:** feat/evolution-phase-two-2-canonical-session-identity  
**Scope:** First-class match UUIDs, parent-session linkage, source traceability, deterministic sequence, expected-vs-played counts and audited sequence corrections.

## 1. Scope boundary

Point 2.3 represents each match as a first-class child of a canonical session. It completes only the Match Identity point.

It does not implement session lifecycle (2.4), roster snapshots (2.5), role snapshots (2.6), substitutions (2.7), result verification/correction workflow (2.8), or module UI adapters (2.9). Evidence/rubric/scoring belongs to the later Evolution Phase Three workstream. No UI or existing module behavior is rewritten in this point.

## 2. Live source audit (read-only, 19 November 2026)

The live FF Squad database was inspected using aggregate-only queries:

| Source | Existing parents | Existing match rows | Source state |
|---|---:|---:|---|
| Scrim records | 1 | 6 embedded JSONB entries | expected count 6; array count 6; 0 mismatches |
| Tournament cycles | 15 | 630 rows | 420 draft, 210 scheduled, 0 submitted/verified/disputed |
| Tournament map metadata | — | 630 rows | map_name is NULL on all 630 rows |

The Tournament source currently has 42 existing match rows per cycle. The migration does not hard-code 42; it derives expected count from each cycle's actual existing rows. The existing Scrim UI stores only placement/kills per match, so it does not provide a native per-match UUID or map/mode fields.

## 3. Schema and backfill

Migration: supabase/migrations/20261119140000_evolution_phase_two_3_canonical_match_identity.sql

### canonical_session_matches

- Generated UUID primary key for every canonical child match.
- Composite parent FK (canonical_session_id, team_id) prevents cross-team attachment.
- match_sequence is independent of match identity and unique within its parent session.
- Source-specific constraints preserve the correct source identity shape.
- Tournament rows retain the existing tournament_matches UUID, source day/number and map_name where present.
- Scrim rows retain the parent scrim_records UUID, original one-based JSONB array sequence and an MD5 fingerprint of the original JSONB element. This is explicitly a source locator/fingerprint, not a fabricated source match UUID.
- Optional map/mode/round metadata stays NULL when the source does not provide it.

### canonical_session_match_sets and counts

- Expected Scrim count comes from scrim_records.match_count.
- Expected Tournament count comes from the count of existing tournament_matches rows for that cycle.
- Actual canonical child-record count comes from rows actually mapped.
- Actual played count includes source-consistent Scrim JSONB entries and Tournament rows whose source status is submitted, verified or disputed.
- Scheduled/draft Tournament rows remain expected slots, not played matches.
- The security-invoker count view never creates placeholders. Missing source rows remain missing.

### Parent/source backfill

- Existing unmapped Scrim records and Tournament cycles receive deterministic, idempotent canonical parent sessions and source mappings.
- Existing Tournament match UUIDs are preserved.
- Existing Scrim source entries receive generated canonical UUIDs while preserving their parent record, original array index and payload fingerprint.
- Source rows and existing JSONB payloads are not rewritten.
- Re-running the source sync RPC does not create duplicate canonical children.

## 4. Sequence correction audit

- match_sequence is mutable metadata; match UUID is not.
- Unique (session, sequence) prevents duplicate ordering slots.
- Active Owner/Coach users can correct sequence through the SECURITY INVOKER RPC.
- A private, narrowly scoped trigger records old/new sequence, actor, timestamp and reason in an append-only audit table.
- Trigger function has an empty search_path, schema-qualified references, and no direct EXECUTE grant to API roles.
- Archived sessions are read-only for match-set and match-sequence writes.

## 5. Access control

- RLS is enabled on match sets, match identities and sequence audit events.
- Active team members can read only their team's match identities.
- Active Owner/Coach memberships can create/sync match identities and correct sequence.
- Sequence audit is staff-readable only.
- Client roles receive no DELETE grant or policy.
- Composite FKs enforce same-team source ownership even if an application caller supplies mismatched IDs.
- No source table is rewritten or deleted by this migration.

## 6. Verification

Source contract suite: scripts/verify-evolution-phase-two-3.mjs  
Disposable PostgreSQL integration: scripts/verify-evolution-phase-two-3-db.sh

The integration harness applies the exact Phase 2.2 parent migration followed by this Phase 2.3 migration. It verifies:
- deterministic parent/source backfill for Scrim and Tournament;
- first-class child UUIDs and one-parent/source constraints;
- expected vs actual counts, including an intentionally incomplete Scrim fixture;
- no fabricated Tournament matches or map metadata;
- Tournament played count from source statuses;
- team-scoped reads and cross-team FK/RLS denial;
- idempotent sync for both existing and newly linked sources;
- audited sequence correction and duplicate-sequence rejection;
- source delete restriction and absence of client DELETE/direct trigger execution;
- TypeScript, source-contract tests and production Vite build through the standard CI workflow.

## 7. Production compatibility gate

**Do not apply this migration to production until the Point 2.9 adapter replaces destructive source deletion with a non-destructive archive path.**

Reason: Phase 2.2 source mappings deliberately use ON DELETE RESTRICT so historical source IDs remain traceable. The current Scrims UI still exposes a Delete Record action, and existing Tournament source deletion may also be blocked after mapping. This is an intentional integrity safeguard, but it changes the outcome of those existing destructive actions. The database integration explicitly proves that deletion is blocked. Point 2.9 must provide the archive/retention UX before rollout; this is not hidden as a completed UI task.

The current live source snapshot implies a backfill of 16 parent sessions and 636 existing child match records (1 Scrim + 15 Tournament cycles; 6 Scrim entries + 630 Tournament rows). Current source statuses imply 6 played Scrim entries and 0 played Tournament rows. These are audit-time figures, not hard-coded migration assumptions.

## 8. Deployment boundary and exit gate

- The migration is committed to this feature branch only.
- It has not been applied to the live Supabase project.
- No production data backfill, app deployment, branch merge or Vercel rollout is performed.
- Point 2.3 is PASS for limited development only after the exact branch-head CI run is green across PostgreSQL integration, source contracts, TypeScript and Vite build.
- Production rollout remains gated on Point 2.9's non-destructive source archive integration.
