# Existing Supabase project — read-only inventory

Project previously identified: `FF Squad` (region `ap-southeast-1`, PostgreSQL 17). This note records the prior read-only audit and is not a schema export.

## Tables observed

| Table | Observed rows | RLS |
|---|---:|---|
| profiles | 5 | enabled |
| teams | 1 | enabled |
| team_members | 5 | enabled |
| team_settings | 1 | enabled |
| daily_scores | 11 | enabled |
| team_ratings | 0 | enabled |
| player_nicknames | 1 | enabled |
| daily_drills | 0 | enabled |
| training_log | 11 | enabled |

Counts are point-in-time snapshots. They may include seed, test or real records; classify ownership before migration or cleanup.

## Not yet mapped

The following must be read from the live schema before writing a target mapping: exact columns and types, primary/foreign keys, unique/check constraints, indexes, enum definitions, triggers, views, grants, policies, function definitions and row ownership.

## Prior advisor observations

- 13 SECURITY DEFINER functions were reported as executable by authenticated users; each function needs authorization, search_path and grant review.
- Leaked-password protection was reported disabled.
- 15 RLS policy performance notices were reported, including per-row auth/current_setting evaluation patterns.
- Duplicate/overlapping permissive SELECT policies were reported on `team_settings`.
- 9 unused-index notices were reported. Do not drop indexes solely from that notice.

These observations are review items, not proof of a breach. Re-run current advisors and inspect definitions before any remediation.

## Change policy

No SQL writes, migrations, policy changes, function changes, data edits or destructive operations have been performed from this repository scaffold.
