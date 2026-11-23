# FF Squad — Production Migration Preflight

**Snapshot date:** 2026-11-23  
**Scope:** read-only production inspection for Evolution Phase 3 release preparation  
**Status:** PREPARED · NOT APPROVED FOR PRODUCTION APPLY

## 1. Migration-history reconciliation

The production ledger currently contains 56 version entries. The repository migration directory on `main` contains 65 SQL files. The historical filename correction in PR #150 restores the exact two remote-only historical versions and removes the later duplicate local file.

After that correction is merged, the expected inventory is:

| Inventory | Count |
|---|---:|
| Local migration files | 66 |
| Production ledger entries | 56 |
| Remote-only versions | 0 |
| Local-only pending versions | 10 |

The ten pending versions are:

1. `20261118060000_evolution_phase_1_5_performance_tuning.sql`
2. Phase 2.2 canonical session identity
3. Phase 2.3 canonical match identity
4. Phase 2.4 session lifecycle
5. Phase 2.5 session roster snapshot
6. Phase 2.6 role snapshot
7. Phase 2.7 substitution tracking
8. Phase 2.8 result verification
9. Phase 2.9 existing-module integration
10. Phase 2.10 database integrity

The two historical versions restored by PR #150 are already present in the production ledger. Restoring their exact files is a repository-history correction only; it does not execute SQL or mutate production.

## 2. Live schema inventory

Read-only inspection returned:

- PostgreSQL 17.11
- 31 public base tables
- 80 public RLS policies
- 16 teams and 16 team-member rows
- Existing Scrims, Tournament and Training source tables are present
- No canonical Evolution session/match tables or Phase 3 scoring tables exist yet

The current live schema therefore does not yet contain the Phase 2 canonical foundation or the Phase 3 evaluation model.

## 3. Phase 1.5 performance migration — separate unresolved gate

The pending Phase 1.5 performance migration is not the staged timezone B migration. It adds 25 foreign-key indexes and changes policy definitions.

Read-only preflight found:

- All 25 referenced table/column pairs exist.
- None of the 25 proposed index names is currently present.
- Its auth.uid() normalization block would rewrite 31 existing policies across its scoped tables.
- Seventeen policies exist across the seven tables whose command-specific policies are dropped/recreated by the migration.

The existing Phase 1.5-B disposable PostgreSQL test covers the staged timezone contract, not this performance migration. The performance migration therefore does not yet have equivalent isolated database evidence. Do not treat the staged-B test as proof for this migration. Its policy changes require a dedicated before/after authorization matrix and isolated replay before production application.

## 4. Phase 2.2–2.10 production data preflight

The source tables required by the canonical-session migrations exist. A read-only data-integrity query checked the 14 composite team/reference constraints introduced by Phase 2.10; all 14 violation counts were zero.

Current source counts:

| Source | Rows |
|---|---:|
| Tournament cycles | 16 |
| Tournament matches | 672 |
| Scrim records | 2 |
| Scrim JSON match entries | 12 |
| Training sessions | 1 |
| Training session participants | 1 |
| Active members with a non-empty role | 1 |

Expected migration-time backfill, based on the current source rows and the SQL's idempotent inserts:

- 18 canonical sessions: 2 Scrim records + 16 Tournament cycles.
- 18 canonical source mappings and 18 expected-match sets.
- 684 canonical matches: 672 Tournament match rows + 12 Scrim JSON entries.
- One canonical team-role definition and its import event from the one active legacy role value.

The Phase 2.2 migration does not silently turn the existing Training session into a competitive match. Training remains a linked source only when explicitly integrated through the existing adapter. No phantom match or role is created.

The Phase 2.10 preflight checks found zero current violations for tournament cycle/team links, plan/block/team links, training session/task/member links, participant/result links, Scrim review links, linked drills, or Scrim match-count bounds.

## 5. Verification boundary

The Phase 2.2–2.10 and Phase 3.2–3.13 migrations have disposable PostgreSQL harnesses wired into the consolidated GitHub Actions workflow. The isolated release branch passed exact-head GitHub Actions runs #1648 and #1649 on `bb164e2f5f58ac789e5b5f309bd879184eb4989d`, each with 40/40 successful steps.

These checks do not constitute a clean replay of the actual production database. The existing Phase 1.5-E audit records that the authoritative original pre-migration schema baseline is unavailable. No synthetic fixture is being represented as that missing baseline.

## 6. Release decision

**Do not run production `db push`, direct DDL, migration repair, data reset, or deployment yet.**

Before production apply:

1. Merge/review the historical filename correction in PR #150.
2. Add and pass a dedicated isolated PostgreSQL test for the Phase 1.5 performance migration, including before/after policy authorization assertions; otherwise explicitly defer it through a reviewed migration-chain decision.
3. Review the Phase 2.2–2.10 backfill counts and zero-violation checks against the intended production data window.
4. Resolve the missing authoritative baseline, or obtain explicit approval for a separately reviewed current-state baseline exception.
5. Use the Supabase migration workflow against production only after a dry-run inventory is reviewed and the exact ordered pending set is approved.

No production migration, migration-history repair, schema change, persistent data write, reset, merge to main, or deployment was performed during this preflight.
