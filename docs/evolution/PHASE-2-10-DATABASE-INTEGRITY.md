# Evolution Phase 2.10 — Database Integrity

**Blueprint mapping:** Evolution Version 2, Point 2.10  
**Branch:** feat/evolution-phase-two-10-database-integrity  
**Parent:** feat/evolution-phase-two-9-module-integration  
**Status:** Implementation and source-contract checks complete; disposable PostgreSQL integration is still blocked by GitHub runner startup failures; production rollout remains gated by Points 2.11–2.12 and explicit approval.

## Scope

Close the structural integrity gaps recorded in Phase 2.1 and preserve the canonical identity contracts from Points 2.2–2.9. The migration is additive, validates existing data, and does not backfill or rewrite module records.

## Database guarantees added

- Composite team-scoped foreign keys for Tournament match → cycle.
- Composite team-scoped foreign keys for Planning block → plan.
- Composite team-scoped foreign keys for Training session → plan, participant → session/member, and result → session/member.
- Composite team-scoped foreign keys for task → plan/block/member/source Training session.
- Composite team-scoped foreign key for Scrim review → Scrim record.
- A real FK for Planning block → linked drill, absent in the audited schema.
- Drill ownership guard: team-owned drills can only be referenced within their team; global templates (is_template = true, team_id IS NULL) remain available to every team. A referenced drill cannot be reassigned in a way that invalidates existing links.
- A task that references a block must also carry that block's owning plan; the block must belong to the task's selected plan. A NULL task plan cannot bypass this invariant. This was found during acceptance review and fixed in the migration guard and DB harness.
- Scrim JSONB array length must equal match_count.
- Session-level Training results with a NULL player are unique per session/attempt; per-player attempt uniqueness remains unchanged.
- Supporting child-side indexes and parent (id, team_id) unique indexes.

## Migration behavior and safety

Every new FK/check is added NOT VALID and then explicitly validated. PostgreSQL checks existing rows during validation; any mismatch aborts the migration transaction instead of silently repairing or deleting records. Read-only preflight on the connected Supabase project returned zero mismatches for audited team-parent relationships, zero missing linked drills, zero Scrim JSONB count mismatches, and zero duplicate Training attempt groups.

No legacy row is updated, deleted, or synthesized. Existing single-column FKs and RLS policies are retained; composite FKs add database-level tenant integrity. Optional composite references use column-scoped ON DELETE SET NULL so the owning team_id is never nulled.

## Idempotency and uniqueness

- Canonical session idempotency (team_id, idempotency_key) and source mapping uniqueness remain the guarantees from 2.2/2.9.
- Canonical match uniqueness by session sequence and source identity remains from 2.3.
- Canonical result version/event idempotency constraints remain from 2.8.
- Substitution idempotency remains from 2.7.
- Tournament slot and Training participant/per-player attempt uniqueness remain intact.
- A partial unique index closes the NULL-player Training attempt gap.

## Verification

- Source contract: scripts/verify-evolution-phase-two-10.mjs
- Disposable PostgreSQL integration: scripts/verify-evolution-phase-two-10-db.sh
- The DB harness replays Points 2.2–2.9, adds representative legacy child fixtures, applies the exact 2.10 migration, and tests cross-team rejection, global drill-template compatibility, plan/block consistency, Scrim count integrity, NULL-player attempt uniqueness, and validated constraint metadata.
- The isolated DB harness is wired into GitHub Actions using a local disposable PostgreSQL 16 instance on the hosted runner; the source contract is included in `npm run build`.
- Current source-contract/build verification passes on the latest Vercel Preview. The PostgreSQL harness has **not** executed because recent GitHub Actions jobs #642, #660, #664 and #692 each failed before their first runner step, with no step list or logs. This is a runner-startup failure, not a passing or failing database test.

## Rollback

The migration is additive and performs no data rewrite. Before later points depend on these constraints, rollback can be executed in one reviewed transaction by dropping the four triggers (training_sessions_team_drill_guard, practice_plan_blocks_team_drill_guard, practice_tasks_plan_block_guard, training_drills_reassignment_guard), the helper function evolution_private.guard_team_scoped_training_references(), all composite FKs introduced above, the Scrim count check, the NULL-player unique index, and the child/parent indexes listed in the migration. Do not drop the evolution_private schema because earlier Evolution points may own objects in it. Production rollback is never automatic and requires fresh preflight plus explicit approval.

## Production boundary

- No live Supabase migration, data backfill, PR merge, or Vercel production deployment is part of this point.
- Point 2.11 owns application UI acceptance; Point 2.12 owns final regression and device acceptance.
