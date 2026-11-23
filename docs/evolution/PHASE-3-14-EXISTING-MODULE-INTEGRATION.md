# Evolution Phase 3.14 — Existing Module Integration

## Scope
Connect the existing Scrims, Tournament, Training, Player, Evaluation and Analytics experiences through the existing canonical session, match, roster and historical role identity. Reuse the Phase 2.9 source adapter and Phase 3.13 evaluation context. This point adds read-only cross-module lineage surfaces; it does not create another match, player or evaluation source of truth.

## Implementation
- Scrims, Tournament and Training continue to create canonical links through the server-authoritative, idempotent `integrate_canonical_source` adapter. Planning remains a plan until explicit Training promotion.
- Evaluation contexts remain bound to the exact canonical session, canonical match and historical role snapshot.
- Added a shared read-only integration panel used by Player/Weekly Review/Player Trends and Analytics.
- The panel resolves source module records, canonical session/match identity, player context and latest score snapshot. It shows final/provisional/insufficient status and evidence coverage separately.
- Analytics explicitly keeps competitive outcome metrics separate from internal player performance scoring. No kills, placement, Booyah or tournament points are used as player score inputs.
- All reads are team-scoped, bounded and RLS-governed. No source rows, evaluation rows or score snapshots are rewritten.

## Verification
- Dedicated source-contract tests cover canonical source foreign-key mapping, all existing source adapters, Player/Analytics mounting, read-only behavior, team scoping, bounded queries, empty/error/loading states and score-domain separation.
- The full existing typecheck, regression/build chain and CI database integrations remain required on the exact latest branch head.
- No production migration, live data write, legacy conversion, merge to main or production deployment is included.

## Acceptance boundary
The UI must be able to trace a player evaluation to its canonical session, match and source module without inventing duplicate identities or mixing competitive results with player-development scores.
