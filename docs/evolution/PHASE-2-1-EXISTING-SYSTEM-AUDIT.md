# Evolution Phase 2.1 — Existing System Audit

**Status:** Audit findings complete · source-contract CI pending  
**Audit date:** 18 November 2026  
**Code ref inspected:** `feat/evolution-phase-two-session-foundation` at `6b03de65e9e00c20b62d890fd343b58edc18cc2c`  
**Live database inspected:** Supabase project `FF Squad` (PostgreSQL 17.11.0.011; read-only inspection)  
**Scope:** Scrims, Tournament, Planning, Training, existing session/match data, callers, schema relationships, RLS policy inventory, existing UI and design tokens.

> Point 2.1 is a discovery/audit point, not a feature UI point. No new screen, schema, migration, data write, policy change, merge, or deployment is part of 2.1. The next point (2.2) designs canonical identity only after this report is reviewed and Phase One's acceptance dependency is resolved or explicitly excepted.

## 1. Executive finding

The application already has working, separate data models for Tournament matches, personal Scrim records, Planning plans/tasks, and Training sessions/results. They are not yet one connected session/match identity chain.

**The most important architectural finding:** the four modules use different parent identities and different match/result representations:

- Tournament: `tournament_cycles.id` → `tournament_matches.id`.
- Scrims: `scrim_records.id` with all match rows embedded in `matches JSONB`; no per-match relational identity.
- Planning: `practice_plans.id` → optional plan blocks/tasks.
- Training: `training_sessions.id` → participants/results; optional `plan_id` and `drill_id`.
- Tasks can optionally point to a Training session through `practice_tasks.source_session_id`, but no equivalent shared link connects Tournament and Scrims.

Do not build another parallel session system. Point 2.2 must design a canonical identity layer with explicit adapters/mappings to these existing records and preserve their history.

## 2. Repository and UI caller map

### 2.1 Tournament

**UI entry:** `src/App.tsx`, section `Tournament`, tabs `Scrims` / `Tournaments`.

**Existing Tournament UI behavior:**
- Week key and day selection.
- Six match slots per day; seven days per weekly cycle (42 slots).
- Match placement and kills are editable for Owner/Coach according to the app's current capability check.
- Local match drafts are stored by week/day/match key.
- Signed-in team data is synchronized to Supabase.
- `persistMatchSnapshot` upserts `tournament_cycles` by `(team_id, cycle_start)`, then upserts `tournament_matches` by `(cycle_id, match_day, match_number)`.
- Analytics reads the synchronized match snapshot when available.

**Tables:** `tournament_cycles`, `tournament_matches`.

**Important semantics:** the cycle is the current parent identity; each match has a UUID and a unique slot within the cycle. Match statuses include scheduled, draft, submitted, verified and disputed. The row stores `recorded_by`, `verified_by`, `verified_at` and `version`.

### 2.2 Scrims

**UI entry:** `src/App.tsx` Tournament section → Scrims tab → lazy-loaded `src/components/ScrimsSection.tsx`.

**Existing Scrims UI behavior:**
- Personal Scrim record history and create/detail views.
- Selectable match count (3, 4 or 6), placement and kills.
- Personal review stored with the Scrim record.
- Shared team review contributions are separate records.
- A record can be edited/deleted by its owner; team members can read shared team records and contribute reviews.

**Tables:** `scrim_records`, `scrim_team_reviews`.

**Important semantics:** match data is an embedded JSONB array, not child rows. The database checks only that `matches` is an array and that `match_count` is one of 3/4/6; the DB does not enforce array length equals match_count or validate every embedded object's shape. The one live record inspected currently has match_count 6 and array length 6.

**Date observation:** the Scrims component initializes its date with `new Date().toISOString().slice(0, 10)`. That is UTC-derived, not explicitly the team timezone. This can disagree with the India calendar date around local midnight and should be handled in a later date-contract task, not silently changed during this audit.

### 2.3 Planning

**UI entry:** `src/App.tsx`, section `StratForge`, lazy-loaded `src/components/PlanningTrainingCenter.tsx`.

**Existing Planning UI behavior:**
- Plans, agenda blocks, weekly planning/review and duplication.
- Plan fields include title, plan date/type, focus, objectives, duration, map, drop zone, rotation notes, Scrim match count and rules notes.
- Plans support draft, scheduled, in-progress, completed, reviewed and archived states.
- Blocks are ordered under a plan.
- Tasks can link to a plan/block, assigned roster member and optional Training session.

**Tables:** `practice_plans`, `practice_plan_blocks`, `practice_tasks`, `practice_task_events`.

**Important semantics:** `practice_plans.id` is its own identity. Planning is not currently a canonical session record. The UI's `today()` uses the device's local date; it is not explicitly bound to the team's timezone.

### 2.4 Training

**UI entry:** same `PlanningTrainingCenter`, Sessions tab.

**Existing Training UI behavior:**
- Drill library and role/difficulty/category filters.
- Individual, squad, communication, IGL, role and custom sessions.
- Session scheduling/status and duration.
- Participant attendance and notes.
- Training result submission with attempts, score/rubric, player reflection, coach feedback and next action.
- Optional link from a session to a plan and/or drill.

**Tables:** `training_drills`, `training_sessions`, `training_session_participants`, `training_results`.

**Important semantics:** `training_sessions.id` is a separate UUID identity. Participants store `player_member_id` and attendance, but no historical role snapshot. Results have session/player/attempt uniqueness, but no independent verification state or append-only correction history.

## 3. Live database inventory (read-only snapshot)

The live Supabase project was inspected using table metadata, migration ledger, catalog queries and aggregate-only data checks. No player names, notes, auth data or other user content was read.

| Table | Live rows | Role in current model |
|---|---:|---|
| `tournament_cycles` | 15 | Weekly tournament parent |
| `tournament_matches` | 630 | 42 match slots per cycle |
| `scrim_records` | 1 | Personal Scrim parent; matches embedded as JSONB |
| `scrim_team_reviews` | 0 | Shared team observations |
| `practice_plans` | 0 | Planning parent |
| `practice_plan_blocks` | 0 | Plan agenda children |
| `practice_tasks` | 0 | Assignments / tasks |
| `practice_task_events` | 0 | Task lifecycle events |
| `training_drills` | 102 | Shared templates/team drills |
| `training_sessions` | 1 | Training session parent |
| `training_session_participants` | 1 | Session participant/attendance |
| `training_results` | 0 | Training attempts/results |

### 3.1 Status distribution

- Tournament cycles: 15 active.
- Tournament matches: 420 draft, 210 scheduled.
- Training sessions: 1 scheduled.
- Scrim record: 1; its six JSONB match objects agree with match_count 6.

### 3.2 Data-integrity checks

The following read-only checks returned **zero current violations**:

- Tournament match cycle/team mismatch.
- Duplicate Tournament match slot `(cycle_id, match_day, match_number)`.
- Plan-block/plan team mismatch.
- Training session/plan team mismatch.
- Training session/drill team mismatch.
- Participant/session team mismatch.
- Participant/member team mismatch.
- Duplicate participant `(session_id, player_member_id)`.
- Training result/session team mismatch.
- Training result/member team mismatch.
- Task/plan team mismatch.
- Task/block team mismatch.
- Task/member team mismatch.
- Task/source-session team mismatch.
- Scrim-review/parent-record team mismatch.

**Interpretation:** current data is clean for these checks. This is not proof that future writes cannot create a mismatch; the schema has structural gaps described below.

## 4. Identity, relationships and integrity findings

### 4.1 Existing identity model

| Domain | Parent identity | Child identity | Current cross-module link |
|---|---|---|---|
| Tournament | `tournament_cycles.id` | `tournament_matches.id` | None to Scrims/Training |
| Scrims | `scrim_records.id` | Embedded JSONB item; no child UUID | None to Tournament/Training |
| Planning | `practice_plans.id` | `practice_plan_blocks.id`, `practice_tasks.id` | Training session may reference plan |
| Training | `training_sessions.id` | `training_session_participants.id`, `training_results.id` | Task can reference session |

### 4.2 Structural integrity gaps (future-write risks)

The current live schema uses separate single-column foreign keys for team and parent references in several tables. It does not consistently enforce composite team-scoped relationships. Current data mismatch checks are zero, but an authorized write path could potentially combine a valid team_id with a parent/member ID belonging to another team unless every write path and policy rejects it.

Examples:
- `tournament_matches.team_id` and `cycle_id` each have separate foreign keys; there is no composite FK proving that the cycle belongs to the same team.
- `training_session_participants.team_id`, `session_id` and `player_member_id` are individually referenced; the DB does not enforce all three belong to one team.
- `training_results` has independent team/session/player references.
- `training_sessions` has independent team/plan/drill references.
- `practice_tasks` has independent team/plan/block/member/source-session references.
- `practice_plan_blocks.linked_drill_id` has no foreign key in the inspected live constraints.
- `scrim_team_reviews` has separate team and parent-record foreign keys. Its insert RLS predicate checks that the Scrim parent has the same team, but this is not a composite FK.

These are findings for Points 2.2 and 2.10. Do not add constraints in 2.1; first define a reviewed migration and data-reconciliation plan.

### 4.3 Snapshot and history gaps

- Tournament cycles have a `roster_snapshot JSONB`, but there is no per-match role snapshot.
- `team_members.assigned_role` is the current assignment and must not be treated as historical role evidence.
- Training participants preserve membership ID and attendance, not the role played at the time.
- Scrim records do not preserve a session roster/role snapshot.
- No substitution event table was found in the inspected model.
- Tournament match `version` is present, but no append-only match amendment/history table was found in the audited scope.
- Training results have attempt numbers but no result verification lifecycle.
- Scrim record has no submitted/verified lifecycle; the personal owner saves the record directly.

## 5. Lifecycle and result-state map

| Entity | Current states / behavior | Gap against Evolution target |
|---|---|---|
| Tournament cycle | draft, registration, active, completed, archived | Not the shared lifecycle; no common transition/audit record |
| Tournament match | scheduled, draft, submitted, verified, disputed | Verification fields exist, but no append-only correction history was found |
| Scrim record | Create/edit/delete; no explicit lifecycle | No submit/verify/close/archive state |
| Practice plan | draft, scheduled, in_progress, completed, reviewed, archived | Plan lifecycle is not session lifecycle |
| Training session | scheduled, in_progress, completed, cancelled | No awaiting-results/verified/closed/archived states |
| Training result | attempt number, optional score, completed flag | No verified/corrected/rejected state |

## 6. RLS and permission inventory

All audited session/match/planning/training tables have RLS enabled in the live database.

| Domain | Read | Write | Notes |
|---|---|---|---|
| Tournament cycles/matches | Active team members via `is_team_member(team_id)` | Active Owner/Coach | Member reads; staff manages |
| Practice plans/blocks | Active team members | Active Owner/Coach | Team-scoped predicates |
| Practice tasks | Active team members | Owner/Coach; IGL management policy; assigned player update of own task | More complex policy overlap; role-level adversarial tests are not part of 2.1 |
| Training drills | Active team members; global templates where `is_template=true` and team_id is null | Active Owner/Coach | Template read is separate |
| Training sessions/participants/results | Active team members | Active Owner/Coach | Participant/result write is staff-scoped |
| Scrim records | Active team members | Owner creates/updates/deletes own record | Current update/delete policies check owner_id; they do not also repeat active-membership predicate |
| Scrim team reviews | Active team members | Active member insert; author can delete own | Insert policy checks parent Scrim team equality; no update policy found |

**Boundary:** this is a catalog/policy-source inventory, not an adversarial permission test. Phase One 1.5-E's outstanding role-level security tests remain open. No permission policy was modified.

## 7. Existing UI and design-system audit

### 7.1 Shared design foundation

`src/styles/tokens.css` defines the product-wide visual language:
- Deep Onyx canvas: `#05060b`; raised surfaces `#080b14`, `#0b1020`, `#10182a`.
- Restrained blue `#183451`, cyan `#70d8ed`, violet `#9b86f4`.
- Semantic text, border, success/warning/danger tokens.
- Minimum interaction target `44px`, focus ring, consistent radius and motion tokens.

### 7.2 Module-specific treatments already present

- **Tournament:** app-level match ledger and shared section tabs; compact match cards and week/day toolbar.
- **Scrims:** separate component stylesheet, dark blue/onyx surfaces, cyan performance accent, gold only for Top 1/champion treatment; responsive card/form grids and mobile single-column layout.
- **Planning/Training (StratForge):** dedicated workspace stylesheet, deep onyx panels with blue/violet active tab gradient, sticky four-tab navigation, 44px controls, mobile two-column tabs and single-column forms.

These are distinct module treatments on top of the shared dark foundation. They should not be flattened into identical cards or forced into identical accent colors. Shared semantics, typography, spacing and accessibility should remain consistent.

### 7.3 UI scope decision for Point 2.1

**No new UI is required or authorized by Point 2.1.** This point is the existing-system audit. Building a new Session UI now would invent the target data model before Point 2.2. The existing UI was inspected at source/CSS level; no browser screenshot, live visual comparison, Android device QA, or pixel-perfect claim is made. Actual new UI belongs to Point 2.11 after identity and lifecycle contracts are approved.

## 8. Date/time and offline observations

- Scrims date defaults to UTC ISO date via `toISOString().slice(0, 10)`.
- Planning/Training `today()` uses the browser device's local timezone.
- Tournament week identity is computed using UTC ISO-week arithmetic.
- The codebase already has Phase One India date helpers, but these module-specific date entry points are not all visibly using the same helper in the inspected components.
- Tournament match state is locally drafted and synchronized through a debounced upsert. The audit did not establish a durable offline mutation queue or conflict-resolution ledger for these modules.

These observations should be carried into the date/offline design decisions; no date code was changed in 2.1.

## 9. Migration ledger and production boundary

- Live Supabase migration ledger was read without writes. Its latest listed migration version is `20261116115907`.
- The audited application schema already contains the existing Tournament, Scrims, Planning and Training tables described above.
- No Evolution Phase Two canonical session/match migration is present in the inspected live ledger.
- No production migration, schema, RLS, grants, data, Auth setting or deployment was changed during this audit.

## 10. Findings and severity

| ID | Finding | Severity | Disposition |
|---|---|---|---|
| EV2-2.1-01 | No shared canonical session identity across Tournament, Scrims, Planning and Training | **Critical architectural dependency** | Design in 2.2 |
| EV2-2.1-02 | Scrim match items are JSONB, not stable relational match records | High | Map/adapter strategy in 2.2–2.3 |
| EV2-2.1-03 | Team and parent/member references are not consistently enforced as composite same-team constraints | High | Design constraints and migration tests in 2.10 |
| EV2-2.1-04 | Historical role snapshots and substitution history are missing | High | 2.5–2.7 |
| EV2-2.1-05 | Result verification/correction models differ by module | High | 2.8 |
| EV2-2.1-06 | Module date helpers are not consistently team-timezone based | Medium | Carry into date contract |
| EV2-2.1-07 | Scrim JSONB shape/array length is not fully constrained | Medium | 2.3/2.10 |
| EV2-2.1-08 | Plan block linked_drill_id lacks FK | Medium | 2.10 |
| EV2-2.1-09 | UI uses distinct module accent treatments; actual device QA not done | Observation | Preserve differentiation; QA in 2.11–2.12 |
| EV2-2.1-10 | Offline sync is debounced but durable queue/conflict handling not evidenced | Medium | Later offline workstream |

## 11. Point 2.1 acceptance checklist

- [x] Scrims, Tournament, Planning and Training UI entry points mapped.
- [x] Existing create/read/update/delete and synchronization callers inspected.
- [x] Live table/column/PK/FK inventory collected.
- [x] RLS enabled state and relevant policy inventory collected.
- [x] Live aggregate record counts and lifecycle status distributions collected.
- [x] Duplicate and cross-team mismatch queries executed read-only.
- [x] Current data integrity results recorded without exposing user content.
- [x] UI design tokens and module-specific styles inspected.
- [x] Existing workflow preservation requirements recorded.
- [x] No production write/schema/policy/deployment performed.
- [x] Source-contract audit test added to standard CI build.
- [ ] Exact-head GitHub Actions CI passes on the Phase Two.1 branch.
- [ ] Review the audit report and authorize transition to Point 2.2 separately.

## 12. Point 2.1 exit decision

**Audit outcome: PASS WITH FOLLOW-UP FINDINGS.** The current source and live schema are mapped sufficiently to design Point 2.2 without guessing. The findings are not defects silently fixed in this audit; they are explicit requirements for subsequent identity, integrity, snapshot and result-verification work.

Point 2.1 does not claim the Evolution Phase Two session system is implemented. It closes discovery only. Phase One 1.5-E acceptance gates remain open and are not waived by this audit.
