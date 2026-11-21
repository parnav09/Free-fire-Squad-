# Evolution Phase One.5-E — Adversarial RPC Authorization Verification

**Execution date:** 20 November 2026  
**Environment:** connected FF Squad Supabase project, PostgreSQL 17.11  
**Result:** **PASS — 18/18 callable authenticated SECURITY DEFINER signatures**

## Method

The checks used the live function definitions after explicitly executing `SET LOCAL ROLE authenticated`, with a synthetic non-member JWT subject. Every test ran inside an explicit transaction and ended with `ROLLBACK`. No production migration, policy, grant, Auth setting, or persistent application row was changed.

A temporary pending join-request fixture was inserted only inside a transaction to exercise `review_team_join_request` with a real target row. The transaction was rolled back, and a follow-up read confirmed `team_join_requests` returned to **0 rows**.

## Coverage

All 18 callable signatures reported by the Security Advisor were exercised, counting both `set_display_name` overloads separately.

| Adversarial case | RPC signatures | Expected and observed result |
|---|---|---|
| Non-member read isolation | `can_rate`, `daily_summary`, `is_team_member`, `is_team_owner`, `my_feedback`, `shares_team_with`, `team_rating_summary` | False membership/ownership predicates or empty team-scoped result sets |
| Signed-in non-owner denial | `assign_member`, `get_team_backup_for_team`, `restore_backup`, `restore_team_backup_for_team`, `review_team_join_request` | Authorization exception before protected mutation or data export |
| Signed-out denial | `create_team`, `join_team`, `request_join_team`, `leave_team_for_team`, `set_display_name(text)`, `set_display_name(text, uuid)` | `Not signed in` |
| Non-member team-scoped profile write | `set_display_name(text, uuid)` | `You are not an active member of this team` |
| Non-member leave attempt | `leave_team_for_team` | `No active team membership found` |

The overlapping checks above cover 18 distinct function signatures. The four trigger-returning functions are not callable application RPCs and remain covered separately by `scripts/verify-evolution-security-trigger-acls.sh`, which verifies API-role EXECUTE revocation while the Daily Evaluation trigger still executes in disposable PostgreSQL.

## Result and boundary

- **18/18 callable signatures:** expected authorization behavior observed.
- A non-member could not read team-scoped aggregates or membership predicates for another team.
- Owner-only backup, restore, roster assignment, and join-request review operations rejected a signed-in non-owner.
- Signed-out calls were rejected before writes.
- The team-scoped display-name overload rejected a signed-in non-member.
- Temporary fixture rollback was verified; `team_join_requests` remained at **0 rows**.
- No production data or schema changes persisted.

This closes the runtime adversarial authorization-test gate for the currently deployed RPC definitions. It does **not** create or substitute for the missing authoritative pre-migration schema baseline, and it does not prove clean replay of the historical migration chain.

Supabase Auth leaked-password protection is a paid-only setting in the current plan and is excluded from this user-approved acceptance scope. No attempt was made to bypass that plan restriction.
