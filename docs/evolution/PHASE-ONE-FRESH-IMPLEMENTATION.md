# Evolution Phase One — Fresh Implementation

**PR target:** `feat/evolution-phase-two-12-final-acceptance` (the current latest development PR line)
**Working branch:** `feat/evolution-phase-one-next-pr-rebuild`
**Status:** Implementation in progress. This document is scope control, not a completion claim.

## Scope

Implement Evolution Phase One from its point definitions, independently on this PR branch. Do not merge or copy commits from the historical Phase One branches or PR #115. Historical Phase One records may be consulted only to recover requirements and acceptance criteria.

The complete scope is Points 1.1, 1.2, 1.3, 1.4, and 1.5-A through 1.5-E.

## Acceptance requirements

- 1.1–1.4: rebuild the identity, membership, authorization, and timezone foundations specified by the Phase One blueprint; preserve existing product behavior outside this scope.
- 1.5-A: establish a reproducible migration/provenance baseline and verify historical schema/data assumptions. Do not call a source assertion a clean replay.
- 1.5-B: implement and test timezone behavior and migration ordering in an isolated database. Production application is a separate rollout decision.
- 1.5-C: provide evidence-backed rollback/recovery dispositions for every relevant migration; distinguish executable rollback from documented/manual recovery.
- 1.5-D: register all Phase One checks in the required CI/build chain and run them against the exact PR head.
- 1.5-E: run adversarial authorization/RLS/RPC tests, migration replay/recovery checks, and automated responsive/browser regression. Record external prerequisites and owner-only physical-device checks separately.

## Verification rules

1. Every point must link to implementation files and executable tests.
2. Run the full production build and all Phase One tests on the final PR head SHA.
3. Run disposable PostgreSQL tests for migration, role, authorization, and rollback behavior where supported.
4. Keep automated browser checks distinct from physical Android/tablet/laptop QA.
5. Keep disposable test evidence distinct from live Supabase production evidence.
6. Never report a point as fully implemented and verified while an acceptance gate is pending.
7. Do not merge this PR or apply production migrations as part of implementation.

## Completion checklist

- [ ] Point 1.1 implemented and verified
- [ ] Point 1.2 implemented and verified
- [ ] Point 1.3 implemented and verified
- [ ] Point 1.4 implemented and verified
- [ ] Point 1.5-A implemented and verified
- [ ] Point 1.5-B implemented and verified
- [ ] Point 1.5-C implemented and verified
- [ ] Point 1.5-D implemented and verified
- [ ] Point 1.5-E implemented and verified
- [ ] Exact-head CI, tests, and production build pass
- [ ] Remaining owner-only checks and rollout boundaries documented
