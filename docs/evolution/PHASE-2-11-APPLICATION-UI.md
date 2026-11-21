# Evolution Phase 2.11 — Application UI

**Status:** Implementation present on the Phase 2.10 stacked branch; exact-head CI and browser acceptance are pending. This is not a production rollout.

## Scope implemented

- Dedicated Sessions workspace reachable from the existing Squad OS navigation without replacing Scrims, Tournament, Training, Planning/StratForge, or their existing entry points.
- Canonical session ledger with type, lifecycle status, season and date filters; loading, empty, error and offline states.
- Staff-only source linking for existing Scrim, Tournament and Training records through the existing server-authoritative integrate_canonical_source adapter. The picker excludes already-linked records.
- Canonical training-session creation through create_canonical_session; Scrim and Tournament remain source-module-owned so the UI does not create orphan competitive sessions or phantom matches.
- Session metadata edits limited to descriptive fields while Draft/Scheduled; stable canonical IDs are never edited.
- Lifecycle controls use version-checked transition_canonical_session and reopen_canonical_session RPCs with reason capture and cancellation reason codes.
- Roster selection and one-time roster lock; role identity is captured from the existing team roster before lock. The UI explains that base roles must be changed in Players before lock; after lock, match-role changes use the audited role RPC.
- Match detail preserves parent-session context and exposes match participation, role assignments, effective-time substitutions, lineup history and role-transfer controls.
- Result draft/submission/verification/rejection/amendment surfaces keep raw values, verified values, source references, versions, actors, timestamps and event history separate. Required source-specific checklist keys are enforced in the UI and again by the database.
- Session-level result receipt is distinct from per-match verification and gates the lifecycle transition to Verified.
- Active Owner/Coach write controls only; other team members receive read-only session views.
- Offline write guard prevents RPC actions while offline and clearly marks the workspace read-only.

## Design and responsive contract

- Existing Deep Onyx tokens and current application typography, surfaces, cyan/violet accents and premium dark grading are reused; no global theme rewrite.
- Layout uses a two-column desktop ledger/detail view and collapses to a single-column session list/detail layout at tablet widths.
- Responsive CSS targets 390px phone, 768px tablet portrait, 1024px tablet landscape, 1280px laptop and 1440px desktop.
- Session workspace buttons and form controls have a 44px minimum target height, visible keyboard focus, explicit labels and constrained overflow.
- Existing Scrims/Tournament/Training/Planning styles and routes are left intact.

## Acceptance harness

- Static contract tests cover the session APIs, lifecycle permissions, roster, roles, substitutions, result provenance, offline guard, navigation and responsive tokens.
- A dedicated isolated Vite harness supplies deterministic fake session data to the real React workspace; it does not connect to or mutate Supabase.
- Playwright acceptance checks five viewport sizes, horizontal overflow, button/field hitboxes, keyboard focus, training creation, Owner-vs-member controls and offline write prevention.
- Screenshots are uploaded as a GitHub Actions artifact for review.
- Exact-head CI must pass typecheck, all inherited Phase 2.2–2.10 database integration gates, static contracts, responsive browser acceptance and the Vite production bundle before this point is marked verified.

## Boundaries and risks

- No live Supabase schema/data/RLS/function changes.
- No production merge or deployment.
- No legacy source tables rewritten; no source IDs fabricated.
- Session role snapshot before lock intentionally uses the existing Players roster role because the database roster-lock RPC snapshots the live assigned role; after lock, the UI uses the audited match-role RPC.
- Device/browser acceptance in CI is Chromium-based; final cross-browser/manual device checks belong to Point 2.12.
