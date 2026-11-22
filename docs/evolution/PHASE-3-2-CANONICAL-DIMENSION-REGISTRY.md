# Evolution Phase 3.2 — Canonical Dimension Registry

**Status:** implementation added to the single Evolution Phase Three PR; exact-head CI pending.  
**Scope:** stable dimension identity, versioned definitions, role applicability, rating metadata, lifecycle, ordering and audited legacy aliases.

## Canonical registry

The stable IDs are independent of labels:

| Stable ID | Display label | Order |
|---|---|---:|
| `communication` | Communication | 1 |
| `coordination_trade_support` | Coordination & Trade Support | 2 |
| `decision_making` | Decision Making | 3 |
| `positioning` | Positioning | 4 |
| `map_awareness_rotation` | Map Awareness & Rotation | 5 |
| `role_execution` | Role Execution | 6 |

Each definition is version 1 initially and stores its own label, definition, applicable roles and rating metadata. The allowed roles are `primary_rusher`, `secondary_rusher`, `third_rusher_flanker`, `sniper_igl`, `substitute_flex` and `other`. Ratings are integer 0–10, step 1.

## Database guarantees

- `evolution_dimension_registry` stores stable IDs, active/retired lifecycle and ordering.
- `evolution_dimension_definition_versions` stores immutable definition versions.
- New definition versions must be sequential, apply only to active dimensions and contain unique, allowed role keys.
- Retired dimensions receive a timestamp and cannot be reactivated or reordered.
- Active dimensions have unique display order; retiring a dimension releases its active order without changing historical order.
- `evolution_dimension_aliases` permits exact-semantic aliases only and is immutable.
- Registry, definitions and aliases are readable by authenticated app users; anonymous access and client writes are denied by grants and RLS.
- The migration is standalone and additive. It does not depend on the later Evidence/Rubric model migration, which is not yet part of this PR's mainline.

## Legacy compatibility

Only these exact semantic aliases are recorded: communication, decision_making, role_execution and positioning where the audited source uses the same meaning. The partial categories `coordination`, `trade_support`, `map_awareness` and `consistency` are deliberately not mapped. No legacy score, evaluation or training record is converted, overwritten or backfilled.

## Shared application contract

`src/lib/evolution-dimensions.ts` exports the canonical registry, stable key union, role keys, rating scale, exact aliases, safe key lookup and rating validation. Future canonical scoring and evaluation consumers must import this registry instead of maintaining their own dimension arrays. Existing legacy evaluation/training models remain separate until a reviewed adapter is introduced in their relevant integration point.

## Verification

- Source contract: `npm run test:evolution-phase-three-2`.
- PostgreSQL integration: `bash scripts/verify-evolution-phase-three-2-db.sh` against a disposable PostgreSQL database.
- The database harness applies the migration twice and checks seed integrity, exact aliases, invalid keys/scales/roles, unique active order, immutable versions/aliases, retirement behavior and authenticated read-only access.
- Full CI must pass on the exact PR #131 head before this point is marked VERIFIED.

## Scope boundary

No scoring formula, evidence record model, rubric editor, score snapshot, production migration, legacy data conversion, production deployment or merge is included in Point 3.2. Those belong to later Evolution points or separately approved rollout work.
