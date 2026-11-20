# Evolution Phase 3.2 — Canonical Dimension Registry

**Scope:** stable dimension identity, versioned canonical definitions, applicability, rating-scale metadata, lifecycle state, ordering and audited legacy aliases.

## Design

- Stable IDs are the six canonical keys: communication, coordination_trade_support, decision_making, positioning, map_awareness_rotation and role_execution.
- Display labels and definitions are versioned separately from the stable key.
- Each definition version records applicable role keys and the integer 0–10 scale (step 1), matching the existing scoring engine.
- Registry lifecycle supports active and retired dimensions; new rubric rows are constrained to known registry keys.
- Rubric dimension rows retain the registry definition version they were authored against.
- Legacy aliases are exact-semantic only. Coordination, trade_support, map_awareness and consistency are deliberately not mapped because the audit found they do not independently represent the canonical dimensions.

## Files

- Migration: supabase/migrations/20261120170000_evolution_phase_three_2_canonical_dimension_registry.sql
- TypeScript registry: src/lib/evolution-dimensions.ts
- Source contract: scripts/verify-evolution-phase-three-2.mjs
- PostgreSQL integration: scripts/verify-evolution-phase-three-db.sh
- Scoring engine consumes the registry key list instead of maintaining a duplicate dimension array.

## Safety

- Additive migration only; no legacy score conversion or backfill.
- Feature branch only. No live Squadwise migration, production data mutation, merge or deployment.
- Existing rubric labels/definitions remain intact as rubric-specific snapshots.
- CI and PostgreSQL integration must pass on the exact branch head before this point is called VERIFIED.
