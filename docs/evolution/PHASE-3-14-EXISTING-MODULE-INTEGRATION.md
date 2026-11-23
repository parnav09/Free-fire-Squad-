# Evolution Phase 3.14 — Existing Module Integration

## Scope

Connect existing Scrims, Tournament, Training, Player, Evaluation and Analytics experiences through the existing canonical session, match, roster and historical role identity. Reuse the Phase 2.9 source adapter and Phase 3.13 evaluation context. This point adds read-only cross-module lineage surfaces; it does not create another match, player or evaluation source of truth.

## Implementation

- Scrims, Tournament and Training source records continue to link through the server-authoritative, idempotent `integrate_canonical_source` adapter. Planning remains a plan until an explicit Training session is created.
- Evaluation contexts remain bound to the exact canonical session, match and historical match-role snapshot created by the Phase 3.13 workflow.
- Added a shared read-only lineage panel mounted in Player / Weekly Review / Player Trends and Analytics.
- The panel displays linked source sessions separately from player evaluation contexts. This makes Training sessions visible even when they have no competitive match or evaluation context; it does not invent a phantom match or infer a player role.
- The panel resolves source record identity, canonical session identity, canonical match, player, exact historical role snapshot and latest immutable score snapshot.
- Final, provisional and insufficient score states remain distinct. Evidence coverage is displayed independently and is never derived from match outcomes.
- Archived canonical sessions remain visible in historical lineage.
- Reads are team-scoped and RLS-governed. All six datasets are read in stable 500-row pages; no fixed row limit silently truncates older team history.
- Loading, empty, error and retry states are implemented. A team switch or failed refresh clears previously loaded rows so stale data cannot appear under another team.
- Competitive results remain separate: kills, placement, Booyah and tournament points are never used as internal player-development score inputs.
- No source records, evaluation contexts or score snapshots are mutated by the lineage panel.

## Training boundary

The current canonical scoring context requires an assigned historical match-role snapshot. Phase 3.13 therefore creates scored contexts for Scrim/Tournament matches, not Training sessions. Phase 3.14 surfaces Training source sessions through the canonical source/session list without fabricating a match or role assignment. A future training-specific evaluation workflow would need its own approved session-level role/roster binding and scoring contract; it is not silently emulated here.

## Verification

- Dedicated source-contract tests cover source adapters, canonical foreign-key mapping, exact historical role identity, Player/Analytics mounting, read-only behavior, team scoping, paginated reads, archived history, Training source visibility, error/retry recovery and score-domain separation.
- The consolidated GitHub Actions workflow runs the dedicated Phase 3.14 suite, applicable disposable PostgreSQL migration/security integrations, TypeScript, the complete repository regression chain, responsive UI/touch-target/permission/offline-write acceptance, screenshot artifact upload and the Vite production build.
- Verification is valid only for the exact latest PR head after an uninterrupted successful workflow.
- No production migration, live data write, legacy conversion, data reset, merge to main or production deployment is included.

## Acceptance boundary

A player evaluation can be traced to its player, canonical match/session, exact historical role snapshot and source module without duplicate identities or mixing competitive results with player-development scores. Source sessions without an evaluation (including Training) remain visible as source lineage rather than being misrepresented as evaluated matches.
