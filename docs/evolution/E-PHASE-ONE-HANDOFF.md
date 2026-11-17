# Squad OS — E Phase One Continuation Handoff

Use this file when continuing in a new ChatGPT conversation.

## Exact resume prompt

**Continue Squad OS E Phase One from PR #115 at the next incomplete point. Read docs/evolution/E-PHASE-ONE-HANDOFF.md and docs/evolution/evolution-phase-one.md first. Preserve the existing roadmap and safety/scope boundaries.**

## Naming

- Evolution is shortened to **E** in conversation.
- **E Phase One** is the roadmap phase for stable identity, team membership, and timezone.
- Work is tracked as **E Phase One.1**, **E Phase One.2**, etc.
- Do not rename the existing docs/evolution-version-2.md blueprint.

## Repository and current work

- Repository: parnav09/Free-fire-Squad-
- Branch: feat/evolution-phase-one-identity-timezone
- PR: https://github.com/parnav09/Free-fire-Squad-/pull/115
- Parent Phase Zero PR: https://github.com/parnav09/Free-fire-Squad-/pull/114
- Phase One ledger: docs/evolution/evolution-phase-one.md
- Current scope: E Phase One only. Do not start Phase Two early.
- Deployment is deferred until the final planned Evolution stage, not during Phase One.

## Completed slices

### E Phase One.1
- Stable Auth UUID → membership UUID → team UUID resolver.
- UUID validation; display labels such as P1/P2 are never IDs.
- Active membership filtering and fail-closed ambiguity handling.
- IANA timezone validation and team-local date formatting helper.
- Contract tests for identity and timezone boundaries.

### E Phase One.2
- Integrated resolver into App.tsx loadTeam.
- Team membership is revalidated using membership ID, Auth user ID, team ID, and active status.
- Removed silent fallback to the first active team when a saved preference is invalid.
- Multiple active teams require explicit selection when no valid preference exists.
- Ambiguous/duplicate membership options are disabled.
- Team switching persists the selected team only after identity validation.
- Selected team timezone is fetched but not yet authoritative for persisted dates.
- Sign-out clears active team and related team-scoped UI state.
- Added source-contract regression tests.

## Next incomplete work

1. Check GitHub Actions for the latest PR #115 commit; fix failures before continuing.
2. Inspect the E Phase One.2 diff carefully, especially TypeScript types and team-switch UI behavior. Do not claim device QA or deployment.
3. Add/verify race protection so a slower earlier loadTeam request cannot overwrite a newer team selection.
4. Add session-eligibility primitives and focused permission-test helpers only as planned by Phase One. Keep authorization/RLS/grants in the separate Security workstream.
5. Reconcile live Supabase migration history with checked-in migration provenance before proposing any timezone trigger/RPC migration.
6. Design a reviewed forward/rollback database migration so persisted dates use each team's configured IANA timezone. Until that is safe, do not expose an editable timezone selector or claim team timezone is fully implemented.
7. Complete Phase One acceptance tests, update this ledger, and only then mark E Phase One complete.

## Non-negotiable boundaries

- Do not merge PR #114 or #115 without explicit user instruction.
- Do not deploy production; deployment is deferred to the end of the whole Evolution roadmap.
- Do not apply Supabase schema/data/trigger/policy/grant/function changes until migration provenance and rollback are reviewed.
- Do not re-enable the paused destructive retention job.
- Do not claim Vercel preview/device QA is ready; the earlier Vercel preview was blocked by build-rate limits.
- Keep Evolution Phase Zero legacy fixes separate from Phase One.
- Do not implement future Phase Two session/match/roster snapshots during Phase One.
- Keep the separate Security workstream separate.
- Do not access or implement restricted combat/weapon/loadout modules or use full-app previews that expose them. Work only in safe identity, membership, privacy, evaluation, analytics, tasks, tests, and documentation scope.

## Historical state to preserve

- Phase Zero PR #114 was open and draft at last check; its latest previously verified CI run #55 passed.
- Phase One PR #115 is a stacked draft branch created from the Phase Zero head; its base is main in GitHub metadata, so ensure the intended dependency/merge order is preserved. Do not merge it ahead of Phase Zero.
- Earlier CI run #56 was still in progress before the E Phase One.2 commits; check the latest run for the current head before reporting CI status.
- No production deployment or database migration was made as part of the Phase One work so far.
