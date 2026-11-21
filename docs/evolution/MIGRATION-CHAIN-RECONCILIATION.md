# Evolution Phase 1.5 — migration and performance reconciliation

**Updated:** 18 Nov 2026  
**Branch:** `feat/evolution-phase-one-identity-timezone`  
**Scope:** Evolution-owned migrations and performance findings only. Loadout scope and separate Security Advisor work are excluded.

## Migration recovery

- All 53 safe-scope migration SQL bodies were recovered verbatim from the live ledger.
- The 24 foundational migrations formerly only in `docs/evolution/recovered-migrations/` have now been copied byte-for-byte into `supabase/migrations/`.
- Together with the 29 previously reconciled migrations, the active directory now represents all 53 safe-scope live ledger entries.
- The two Phase 0 security migrations are present only as historical migration provenance, so a new migration runner can reconstruct the same historical sequence. They are already recorded in production and are not being applied there again.
- The two loadout ledger entries remain excluded.

## Active dependency order

The active files sort in live-ledger order. Key dependency groups:

1. **Phase 0 and identity/roster:** baseline security/performance history; weekly tournament cycle/match schema; player drill assignments and training notes; join requests/role assignments; fifth-slot guard; team leave/cleanup; backup/restore; team-scoped IGN and team-scoped RPCs; configurable roster capacity.
2. **Planning/training base and extensions:** `08170059 phase_2_3_planning_training` creates the core plans, blocks, tasks, drills, sessions and results; later migrations add task lifecycle, participants, tactical fields, drill templates/progression, and task metadata.
3. **Daily Evaluation:** three original feedback/date/anonymity migrations followed by both separate private-feedback policy migrations.
4. **Retention/task lifecycle:** task deadlines/events/IGL management and team-scoped retention migrations.
5. **Scrims:** personal team review and owner-scope updates.
6. **Character profiles:** table creation precedes the 67-profile sync.

## Evolution performance remediation staged

A new migration was added:
`supabase/migrations/20261118060000_evolution_phase_1_5_performance_tuning.sql`

It:
- Adds covering indexes for the 25 Evolution-scope foreign keys reported by the advisor (27 total advisor findings minus the two excluded loadout foreign keys).
- Converts direct `auth.uid()` policy references to statement-level scalar subqueries on the Evolution-owned tables that produced init-plan warnings.
- Removes the 10 multiple-permissive-policy warnings by splitting staff `ALL` policies into command-specific policies and combining the overlapping practice-task/training-drill rules while preserving their original predicates.
- Does not alter loadout tables, general SECURITY DEFINER grants, Auth leaked-password settings, or retention durations/cleanup behavior.

## Verification and remaining blockers

- Source SQL for all 24 promoted foundation files is copied from the recovered archive, not regenerated or guessed.
- The new performance migration is staged in the Git branch but has **not** been applied to production or to an isolated database.
- Supabase currently has no development branch. Creating one requires a cost confirmation; the create attempt returned a confirmation requirement, so no branch was created.
- A clean replay from an empty database is still blocked by the missing original baseline schema. The recovered ledger starts after pre-existing tables/functions already existed.
- All 55 live ledger rows have zero rollback SQL. The 53 safe-scope files are complete, but no rollback bodies can be reconstructed safely from current state alone.
- Unused-index notices were not acted on: an index being unused in the current observation window is not proof it is safe to drop.
- Separate Security Advisor findings (SECURITY DEFINER execute grants and Auth leaked-password protection) remain untouched by request.
- No production SQL, schema, RLS, grants, functions, data, or migration ledger was changed. No PR merge or production deployment was performed.

**Status:** all 53 safe-scope migration files are now represented in the active chain and Evolution performance fixes are staged. Full Phase 1.5 verification remains **IN PROGRESS** until the original baseline is recovered and the staged migration passes an isolated replay/advisor check.
