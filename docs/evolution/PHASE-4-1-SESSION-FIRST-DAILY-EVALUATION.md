# Evolution Phase 4.1 — Session-first Daily Evaluation

Status: implementation complete on the isolated Phase 4.1 branch; exact-head application verification is running. This document records the scope and acceptance boundary for Point 4.1 only.

## Contract

1. Start from an existing, non-archived canonical session.
2. Match choices are restricted to that session and team.
3. Teammate choices come only from assigned canonical historical role snapshots for the selected match.
4. Only active team members are eligible; the signed-in evaluator is removed before rendering.
5. The newest role snapshot per player is authoritative. If the newest snapshot is unassigned or invalid, that player is excluded; an older assigned row is never used as a fallback.
6. The selected context displays the target and historical role; current roster roles are never substituted.
7. The evaluation date is read-only and assigned by the existing server-side date contract at submission. No date picker or backdating.
8. A session with no match records is not silently converted into a match. The manual path is a later Phase Four point.
9. Session, match and role reads paginate through all result pages; fixed row limits must not silently truncate the selector. Failed reads clear stale rows and expose a retry action.
10. This point does not write scores, feedback, evidence, assignments, or evaluation records. It does not call the Phase Three staff-only context-creation RPC or the legacy five-dimension table.

## Acceptance evidence

- Source-contract tests cover team scoping, session-to-match scoping, paginated reads, historical role eligibility, active membership, self-exclusion, latest-snapshot precedence, stale-row clearing, retry, dependent-selection reset, date lock, and absence of writes.
- Dedicated Playwright browser acceptance runs on phone (390px), tablet portrait (768px) and laptop (1280px), verifying session-to-match filtering, target eligibility/self-exclusion, latest-role precedence, all three paginated reads, session-switch resets, retry recovery, no horizontal overflow, and touch-target sizes.
- Responsive styling is also source-checked for mobile stacking, 44px minimum button targets, 46px select controls, and visible keyboard focus.
- Typecheck and full production build are required on the exact branch head.
- Phase Three's production-baseline migration replay gate remains mandatory for release. The independent application test/build job runs separately; this is diagnostic separation, not a waiver of the migration gate. Current CI reports that `SUPABASE_DB_URL` is present but malformed as a connection URI, so production-baseline verification remains blocked until the repository secret is corrected.
- No production migration, merge, data reset, or deployment is authorized by this point.

## Next points

- 4.2: standalone/manual evaluation with a mandatory reason and explicit manual source label.
- 4.3: unanswered vs deliberate zero vs Not observed; no prefilled values.
- 4.4: one atomic save for canonical evaluation, evidence, feedback, audit, and outbox.
- 4.5: stable evaluator-target assignment IDs, idempotency keys, and server-side duplicate/self-target enforcement.

Points 4.2–4.5 must not be represented as implemented by this 4.1 branch.
