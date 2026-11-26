# SQUAD OS — Evolution Version 2.1 Independent Delivery Blueprint

**Document type:** New implementation and release blueprint  
**Supersedes for future planning:** The dependency-first delivery strategy in `docs/evolution-version-2.md`  
**Preserves:** Existing product scope, phase names, domain rules, data integrity requirements, and historical implementation records  
**Delivery model:** Every phase is an independently buildable, testable, mergeable, and deployable vertical slice.

---

## 1. Core delivery decision

Evolution will no longer be delivered as one long chain in which Phase N must wait for Phase N−1 to be completed, merged, or deployed.

Each phase must be treated as a separate product increment with its own:

- scope and user-visible outcome;
- isolated implementation branch and one primary PR;
- database migration(s), if required, that are additive and independently applicable;
- API/RPC and UI changes included in the same phase;
- feature flag or safe activation switch;
- tests, regression coverage, observability, and rollback instructions;
- independent staging verification and production release decision.

**A phase must not require another new Evolution phase to be deployed first.** It may integrate with an existing app capability through a stable adapter, but it must also handle that capability being absent, unavailable, or disabled. It must not invent records or silently change the meaning of existing data to simulate a missing capability.

This changes delivery coupling, not product correctness. Identity checks, team scoping, privacy, authorization, transactional integrity, and data provenance remain mandatory inside every phase that handles them.

## 2. What “independent” means

Independent does not mean duplicating every table or creating competing identity systems. It means each phase owns its complete vertical slice and can safely run against the currently released app.

Every phase must follow these rules:

1. **Self-contained scope:** all schema, server logic, UI, tests, and documentation required for that phase are included in its PR.
2. **Existing-baseline compatibility:** use the currently deployed Auth, team membership, and existing module records through adapters. If a canonical optional source is unavailable, show an explicit unavailable/unsupported state.
3. **No phase-to-phase runtime dependency:** Phase 6 must not require Phase 5 UI to be deployed; Phase 9 must not require Phase 8 screens; and so on.
4. **Versioned contracts:** shared payloads and database interfaces have explicit versions and backward-compatible readers.
5. **Additive migrations:** no destructive rewrite, rename, drop, or bulk backfill as a hidden side effect of a feature PR. Any exceptional data migration is separately planned, reversible where possible, and owner-approved.
6. **Feature isolation:** each phase can be enabled/disabled independently. Disabled features must not break existing navigation or workflows.
7. **Graceful integration:** integration with another phase is optional and adapter-based. If the other phase is absent, the current phase still works using its own supported inputs and clearly reports unavailable enhancements.
8. **No phantom data:** never fabricate a session, match, role snapshot, evidence item, review, task, or score to satisfy another feature.
9. **No silent data reinterpretation:** legacy values remain identifiable as legacy. Conversion is explicit, versioned, traceable, and tested.
10. **Independent release gate:** a phase can be deployed without waiting for unrelated Evolution PRs. Existing app-wide release blockers and critical security incidents still apply.

## 3. Shared platform contracts — not phase dependencies

These are stable interfaces to the existing application, not sequential feature deliverables. A phase must consume them through a small adapter and include compatibility tests. If a contract is missing in a deployment, that phase must fail closed or operate in its documented standalone mode.

### Identity and team context

- Authenticated user identity is the immutable Auth UUID.
- Team identity is the real team UUID.
- Active membership is resolved from the existing membership source.
- Display names, player numbers, IGN, and P1/P2 labels are presentation only and never identifiers.
- Every read and write is scoped to the selected active team and authorized user.
- No phase may create a second player identity or membership source.

### Time and date

- Use the app's existing server-side date contract and configured team timezone.
- Do not introduce a competing timezone system.
- Client device time is not authoritative for eligibility, deadlines, or audit timestamps.
- Each phase documents the date/time semantics it uses.

### Existing module adapters

- Scrims, Tournament, Training, Planning, and Tasks are accessed through adapters.
- An adapter maps existing records to the phase's local read model without requiring another feature phase to be deployed.
- Unsupported source types are labelled unsupported; they are not converted into fake records.
- Competitive results and player-development scores remain separate domains.

### Shared engineering requirements

- TypeScript typecheck and production build.
- Focused phase acceptance tests and app-wide regression tests.
- Team isolation, authorization, privacy, and data-integrity tests for affected operations.
- Mobile, tablet, and desktop interaction coverage for changed UI.
- Structured errors, safe logs, retry behavior, and migration rollback notes.
- A feature flag or equivalent safe activation mechanism.

---

# 4. Independent phase catalogue

## Phase Zero — Legacy Fixes and Existing-System Stabilization

**Purpose:** Stabilize the currently shipped Evolution and adjacent workflows without requiring any new Evolution phase.

**What this phase delivers:**

- Audit existing Evolution routes, components, data tables, RPCs, and write paths.
- Identify current sources of truth for player, team, score, feedback, task, and match data.
- Fix legacy identity mistakes, including display-label IDs being used as real IDs.
- Prevent untouched inputs from being submitted as fabricated default scores.
- Keep missing, deliberate zero, and unobserved data distinct.
- Correct legacy score aggregation and scale inconsistencies without silently rewriting historical meaning.
- Fix stale team context and cross-team display defects.
- Preserve character, pet, Scrims, Tournament, Training, and existing team data.
- Produce a current-state architecture and integrity report.

**Independent behavior:** This phase only audits and repairs existing behavior. It does not wait for a new identity, session, rubric, or analytics phase.

**Acceptance:** Existing workflows still work; known legacy defects have regression tests; no destructive data changes; all changed paths have verified team scoping.

## Phase One — Identity, Membership, and Date Contract

**Purpose:** Make identity and team context reliable for any Evolution feature, while remaining independently releasable.

**What this phase delivers:**

- Resolve the authenticated user to the correct active team membership.
- Separate Auth UUID, team UUID, membership identity, and display labels.
- Handle multiple teams and membership changes safely.
- Provide reusable identity and active-membership adapters.
- Apply the existing server-side team date/time contract consistently.
- Define eligibility helpers without creating a second identity model.
- Provide explicit states for no active team, inactive membership, and ambiguous context.

**Independent behavior:** The phase can ship against the existing Auth and team membership tables. It does not require Sessions, Rubrics, Daily Evaluation, or any future Evolution feature.

**Acceptance:** Identity mapping, active membership, team switching, timezone boundaries, and cross-team isolation pass. Existing team and player records remain unchanged.

## Phase Two — Session and Match Context Adapter

**Purpose:** Provide a reliable way for any feature to refer to existing Scrims, Tournament, and Training activity without requiring those modules to be rebuilt first.

**What this phase delivers:**

- Read existing session and match records through source adapters.
- Normalize source identity into a stable context envelope.
- Capture the roster and role context available from the source at the time of activity.
- Represent substitutions and role changes where the source supports them.
- Mark missing historical role data as unavailable instead of guessing current roles.
- Verify competitive results before they are used as official results.
- Link existing source records without duplicating or replacing them.
- Provide a read-only context picker that other features can embed.

**Independent behavior:** It must work with the current Scrims/Tournament/Training data. A source adapter may be enabled independently. If canonical session infrastructure is not deployed, the phase reads supported existing records and clearly labels their provenance; it does not invent canonical sessions.

**Acceptance:** Source mappings, stable IDs, historical context, missing-data states, duplicate linking, and cross-team isolation pass. No existing match or tournament identity is replaced.

## Phase Three — Evidence, Rubric, and Scoring Engine

**Purpose:** Deliver a standalone, versioned evaluation calculation service that can be used by current and future evaluation screens.

**What this phase delivers:**

- Six canonical player-development dimensions: Communication, Coordination & Trade Support, Decision Making, Positioning, Map Awareness & Rotation, and Role Execution.
- Versioned rubric definitions and explicit scoring semantics.
- Role-weight profiles with version and provenance.
- 0–10 dimension scale.
- Separate states for unanswered, deliberate zero, and Not observed.
- Coverage, confidence, and sample-size calculations.
- Evidence records and privacy classifications.
- Deterministic score calculation and legacy conversion metadata.
- A compatibility adapter for legacy five-dimension records.

**Independent behavior:** The scoring engine can be tested and used with its own input contract and a local/manual evaluation context. It does not require Phase Two's new session UI or Phase Four's evaluation form to be deployed.

**Acceptance:** Deterministic calculations, role weights, rubric versioning, missing-value semantics, invalid ranges, evidence privacy, and legacy compatibility pass.

## Phase Four — Daily Evaluation Workspace

**Purpose:** Deliver the complete Daily Evaluation experience as one independently releasable feature, rather than a chain of dependent sub-phases.

**What this phase delivers:**

- Session-first evaluation when a supported real session/match context is available.
- Standalone/manual evaluation when a session is not available or is not relevant.
- Mandatory reason for manual evaluation and an explicit immutable Manual source label.
- Target selection limited to eligible active teammates; self-evaluation is rejected in the server contract.
- Historical role context when a trusted source provides it; otherwise show role unavailable rather than guessing.
- Six-dimension input states with no fabricated prefilled ratings.
- Evidence and private feedback linkage.
- Atomic save of the evaluation and all records owned by this workflow.
- Idempotent submission and duplicate protection.
- Audited correction/amendment behavior.
- Clear saved, pending, retry, and failure states.

**Independent behavior:** The entire phase ships in one vertical slice. Its manual path works even if the session/match adapter is unavailable. Its session-first path uses an existing supported source adapter and degrades to a clear unavailable state if that source is absent. It does not wait for Phase Five feedback inbox or Phase Six tasks.

**Acceptance:** Manual and session-first flows, mandatory reason, source provenance, unanswered/zero/Not observed states, atomic rollback, duplicate retry, self-target rejection, role-unavailable handling, and responsive UI pass.

## Phase Five — Peer Feedback and Anonymous Receipt

**Purpose:** Let teammates exchange structured feedback with recipient privacy protected, independently of the Daily Evaluation UI release.

**What this phase delivers:**

- Build a peer cohort from current eligible team membership and a documented evaluation window.
- Calculate eligible N−1 reviewer/recipient pairs.
- Reject self-pairs on the server.
- Keep reviewer identity in a protected author mapping, separate from recipient-visible content.
- Provide sanitized Feedback Received records.
- Provide private Feedback Sent history for the sender.
- Define a minimum cohort/anonymity policy and explain when anonymity cannot be guaranteed.
- Prevent author identity leakage through API responses, logs, URLs, exports, and notifications.
- Support a standalone feedback submission path using the phase's own input contract.

**Independent behavior:** It can accept feedback through its own submission workflow and existing team membership context. It does not require Phase Four's screen or Phase Six's task system. Linking feedback to a Daily Evaluation is an optional adapter.

**Acceptance:** Self-review rejection, cohort reproducibility, author/recipient access separation, small-cohort policy, payload sanitization, and deanonymization tests pass.

## Phase Five-B — Evaluation Activity and Daily Pending Tracker

**Purpose:** Deliver a standalone workflow-status tracker for daily evaluation assignments.

**What this phase delivers:**

- Calculate expected evaluator-to-target assignments for a defined daily cohort.
- Show pending assignment status without exposing score or feedback content.
- Apply the 24-hour grace period before an item becomes visible.
- Keep an eligible pending item visible for the documented next 24-hour window.
- Remove the item immediately when the assignment is completed.
- Expire visible tracker entries automatically using server time.
- Avoid carrying old pending items into a new daily cohort.
- Preserve underlying audit/assignment records after tracker expiry.
- Refresh correctly after reconnect, app focus, and date boundary changes.

**Independent behavior:** The tracker owns its assignment-status projection and can use its own cohort adapter. If a feedback/evaluation provider is unavailable, it shows a provider-unavailable state rather than blocking or fabricating completion.

**Acceptance:** Exact 24-hour boundaries, expiry, completion removal, no self-pairs, no sensitive payload leakage, and reconnect behavior pass.

## Phase Five-C — Matches Evaluation

**Purpose:** Provide match-specific player evaluation as a separate independently releasable feature.

**What this phase delivers:**

- Select a supported existing Scrims or Tournament match.
- Read match participants and historical roles when available.
- Evaluate players against the match context.
- Preserve source match IDs and provenance.
- Track per-match evaluation completion.
- Prevent duplicate match evaluations.
- Keep competitive placement/kills separate from development ratings.
- Support a documented standalone match-context fallback only when the source can safely identify the match.

**Independent behavior:** It uses existing source adapters and its own evaluation workflow. It does not require Phase Four's Daily Evaluation screen or Phase Five's anonymous feedback inbox.

**Acceptance:** Scrims and Tournament source mapping, participant eligibility, missing-role behavior, duplicate protection, and competitive/development separation pass.

## Phase Six — Unified Development Tasks

**Purpose:** Provide one task workflow for player improvement without requiring feedback or evaluation modules to be deployed first.

**What this phase delivers:**

- Canonical development task identity and lifecycle.
- Create tasks manually or from a supported source reference.
- Link optional evaluation, feedback, evidence, drill, or weekly-review references.
- Acknowledge, start, submit, reflect, verify, complete, or return for rework.
- Define measurable success criteria and optional due dates.
- Preserve task history and status transitions.
- Provide adapters for Planning, Training, and existing task records.
- Avoid duplicate task copies across modules.

**Independent behavior:** Manual task creation, assignment, progress, and completion work without Phase Four or Five. Source links are optional metadata; unavailable sources do not block the task.

**Acceptance:** One task identity, lifecycle transitions, concurrency handling, legacy adapter behavior, and follow-up traceability pass.

## Phase Seven-A — Weekly Team Review

**Purpose:** Give each eligible member an independent way to submit a weekly review of team performance.

**What this phase delivers:**

- Member-submitted weekly team review.
- Nine team dimensions: Team Communication, Coordination & Trade Support, IGL Decision Making, Rotation & Zone Control, Role Balance & Execution, Fight Selection, Survival & Placement Management, Utility Management, and Match Consistency & Replay Improvement.
- One eligible submission per member/team/week.
- Current-week submission window using the existing date contract.
- Submitted/Pending status without exposing private ratings or narratives.
- Historical week access and explicit missing-submission states.

**Independent behavior:** Members can submit the weekly review using the phase's own form and team membership adapter. It does not require Phase Seven-B coach review or Phase Nine Squad Analytics.

**Acceptance:** Eligibility, one-submission rule, date boundaries, no backdating, privacy, and missing-versus-zero semantics pass.

## Phase Seven-B — Coach-led Weekly Review

**Purpose:** Provide a coach/IGL weekly review and immutable publication history independently of member-submitted Team Review.

**What this phase delivers:**

- Weekly review draft for each eligible player/team.
- Optional adapters for match results, evaluations, tasks, evidence, and member team reviews.
- Explicit source coverage showing which providers were available.
- Recommendations that identify their evidence and confidence.
- Coach editing, approval, publishing, and versioned correction.
- Immutable published snapshots and source manifests.
- A no-data state instead of treating missing sources as zero performance.

**Independent behavior:** A coach can create and publish a review using manually entered observations and whichever source adapters are available. Missing Phase Four, Six, or Seven-A data reduces coverage but does not prevent the workflow.

**Acceptance:** Snapshot immutability, source traceability, no-data handling, approval permissions, and deterministic regeneration pass.

## Phase Eight — Player Trends and Comparability

**Purpose:** Deliver longitudinal player trends as a standalone analytics feature.

**What this phase delivers:**

- 7-day, 30-day, season, and custom date filters.
- Six-dimension trend views.
- Role-aware comparisons.
- Sample size, coverage, and confidence indicators.
- Rubric-version comparability rules.
- Consistency measures and event annotations.
- Drill-down to available source records.
- Explicit incompatible/insufficient-data states.
- Optional task and weekly-review context.

**Independent behavior:** The trend engine can analyze any supported existing score source and its own imported/read model. Missing evaluation or weekly-review providers are represented as unavailable; they do not block the trend page.

**Acceptance:** Deterministic aggregation, denominator correctness, role/rubric comparability, sparse-data behavior, and source drill-down pass.

## Phase Nine — Squad Analytics

**Purpose:** Give the team an independent analytics dashboard across competitive performance and player development without mixing the two.

**What this phase delivers:**

- Competitive domain: verified placements, kills, tournament points, maps, and match history.
- Development domain: available dimension scores, role coverage, evidence, and improvement patterns.
- Team-level recurring patterns and coverage.
- Filters by date, tournament, map, role, and available context.
- Optional contextual comparisons with clear correlation caveats.
- Sample counts and data-quality labels on every aggregate.

**Independent behavior:** Competitive analytics works from existing verified Scrims/Tournament records. Development analytics works from whichever supported score records exist. Either domain can be shown without the other.

**Acceptance:** Competitive points never alter development scores; development scores never alter official competitive points; aggregates show sample/coverage; team isolation passes.

## Phase Ten — Realtime, Offline Queue, and Data Quality

**Purpose:** Deliver reusable reliability infrastructure as a standalone platform improvement.

**What this phase delivers:**

- Durable local queue for supported offline writes.
- Transactional outbox pattern where server-side events are emitted.
- Idempotent replay and duplicate suppression.
- Authorized realtime subscriptions.
- Reconnect/focus refetch and stale-state invalidation.
- Conflict detection and explicit resolution states.
- Stuck queue and failed outbox monitoring.
- Data-quality checks and operational alerts.
- Per-feature opt-in adapters so existing workflows are not forced onto offline writes before they are ready.

**Independent behavior:** The queue and sync monitor can ship with a demo/test adapter and then be adopted by existing modules one at a time. No other Evolution phase must be deployed first.

**Acceptance:** Offline/reconnect, replay, duplicate delivery, conflict, permission revocation, stuck queue, retry, and observability tests pass.

## Phase Eleven — UI, Accessibility, and Regression Quality

**Purpose:** Deliver an independently usable design/accessibility quality increment without waiting for all Evolution features to exist.

**What this phase delivers:**

- Premium dark responsive design consistency.
- Android/mobile, tablet, and laptop/desktop layouts.
- Effective touch targets of 44–48px for primary controls.
- Safe-area, virtual keyboard, and scrolling behavior.
- Keyboard navigation, visible focus, and screen-reader labels.
- Loading, empty, error, offline, and permission states.
- Navigation and responsive QA for whichever Evolution modules are currently enabled.
- Regression coverage for existing Scrims, Tournament, Training, Planning, Tasks, Settings, and Analytics workflows.

**Independent behavior:** QA is feature-presence aware. It tests enabled/current routes and skips absent optional modules without failing the whole phase. It never requires all future Evolution pages to exist.

**Acceptance:** Real browser/device viewport checks, interaction tests, accessibility checks, no horizontal overflow, and existing-workflow regression pass.

## Phase Twelve — Independent Release and Production Verification

**Purpose:** Provide a reusable controlled release process that can be run for any single phase or a selected group of phases.

**What this phase delivers:**

- Per-phase staging feature flag.
- Per-phase migration dry run and backup/recovery notes.
- Migration compatibility and ordering checks for that phase only.
- Data reconciliation report limited to the phase's owned records.
- Production smoke tests for that phase.
- Monitoring and rollback/disable procedure.
- Release record with exact commit, migration versions, test results, and deployment URL.
- Owner approval for each production activation.

**Independent behavior:** Phase Twelve is a release toolkit, not a final gate that blocks all earlier phases. Any phase can use the same release procedure as soon as its own checks pass. One phase's release does not wait for all other Evolution phases.

**Acceptance:** A single selected phase can be staged, enabled, monitored, disabled/rolled back, and verified without requiring other new Evolution phases.

---

# 5. How phases integrate without depending on each other

Integration is by optional adapters, not by deployment order.

| Consumer capability | If provider feature exists | If provider feature is absent |
|---|---|---|
| Session/match context | Read through the source adapter | Use supported manual context or show unavailable; never invent a match |
| Rubric/scoring | Use the declared rubric version | Use only a bundled, explicitly versioned local contract or disable scoring; never guess |
| Feedback | Attach feedback reference | Keep the workflow standalone without feedback |
| Pending tracker | Read assignment status | Show provider unavailable; do not fabricate completion |
| Development tasks | Link task to source record | Create a standalone task |
| Weekly review | Include available evidence and coverage | Use manual coach observations and mark missing sources |
| Player trends | Aggregate compatible records | Show sparse/insufficient data |
| Squad analytics | Render each available domain separately | Render the available domain; label the other unavailable |
| Realtime/offline | Adopt the shared sync adapter | Keep existing online behavior; do not block the feature |
| UI regression | Test enabled routes | Skip absent optional routes and test current app flows |

## 6. PR and deployment model

Each phase gets one primary implementation PR. A phase may contain multiple commits and migrations, but it must be reviewable and releasable as one coherent vertical slice.

**Branch naming:**

- `feat/evolution-phase-zero-independent`
- `feat/evolution-phase-one-independent`
- `feat/evolution-phase-two-independent`
- Continue the same pattern for each named phase/sub-phase.

**PR requirements:**

- Target the current production integration branch, normally `main`, unless the owner explicitly selects another base.
- Do not stack a phase PR on an unmerged feature PR.
- Include all phase-owned UI, server logic, migrations, tests, and docs.
- Include a list of existing contracts/adapters used.
- Include exact-head test evidence.
- Include migration forward/rollback notes.
- Include screenshots or browser artifacts for user-visible changes.
- State which optional integrations are unavailable and how the feature behaves without them.
- Do not merge or deploy merely because CI is green; the phase's own data and release gates must pass.

**Deployment requirements:**

- Deploy one phase at a time when desired.
- Enable it with its own feature flag.
- Verify its production smoke tests.
- Monitor errors, sync, and data integrity.
- Keep unrelated phase flags unchanged.
- If the phase fails, disable or roll back that phase without rolling back unrelated modules.

## 7. Definition of Done — required for every phase

A phase is complete only when all applicable conditions are met:

- [ ] Scope is implemented end-to-end, not just a screen or schema.
- [ ] Its own migrations are additive, tested, and independently applicable.
- [ ] Existing production data and workflows are preserved.
- [ ] Team scoping, authorization, and privacy are tested for affected operations.
- [ ] Missing/optional providers have explicit fallback states.
- [ ] No fabricated or duplicate records are created.
- [ ] Idempotency and retry behavior are tested for writes.
- [ ] Typecheck, focused tests, regression tests, and production build pass on the exact PR head.
- [ ] Responsive browser acceptance passes for changed UI.
- [ ] Logs and errors do not leak private data.
- [ ] Rollback/disable procedure is documented and tested where applicable.
- [ ] PR is merged only after review and release gates.
- [ ] Production deployment is verified separately from merge.

## 8. Status reporting rules

Use these labels precisely:

- **Planned:** no implementation evidence yet.
- **In progress:** implementation is underway.
- **Implemented:** code exists, but acceptance is not fully verified.
- **Verified:** exact-head tests and required acceptance evidence pass.
- **Merged:** PR is merged into the target integration branch.
- **Deployed:** production deployment is confirmed.
- **Released:** deployed, enabled, smoke-tested, and monitored successfully.

A passing typecheck, an open PR, a preview URL, or a successful build alone does not mean a phase is complete or released.

## 9. Historical scope and naming preserved

This independent-delivery model retains the Evolution roadmap's full phase catalogue:

- Phase Zero
- Phase One
- Phase Two
- Phase Three
- Phase Four
- Phase Five
- Phase Five-B
- Phase Five-C
- Phase Six
- Phase Seven-A
- Phase Seven-B
- Phase Eight
- Phase Nine
- Phase Ten
- Phase Eleven
- Phase Twelve

The phase names and feature goals remain recognizable. The change is that their implementation and release are no longer chained to one another. Any cross-phase enhancement is optional and must be delivered through a backward-compatible adapter.

## 10. Explicit non-goals

This blueprint does not authorize:

- deleting or resetting production data;
- replacing the existing Auth/team identity model;
- inventing sessions, matches, roles, evidence, scores, or task records;
- silently migrating historical scores;
- bypassing RLS, authorization, privacy, or security review;
- merging or deploying any implementation PR;
- claiming existing phases are complete without current evidence.

**Master rule:** Build each phase as a complete independent product slice. Integrate when another capability is available, but never make its deployment a prerequisite for this phase to work safely.
