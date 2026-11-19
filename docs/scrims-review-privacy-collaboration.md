# Scrims Review Privacy & Team Collaboration

## Scope

This change completes the Scrims post-match review workflow without changing the existing Tournament scoring preset.

- Personal reflections remain private to the player who owns the Scrim record.
- Shared team observations remain visible to active teammates.
- Teammates can add threaded comments to shared observations.
- Owners, coaches, and active IGLs can create action items and assign them to active team members.
- Assigned players can update the status of their own action items.
- Team-level Scrim analytics summarize recorded match volume, kills, average placement, and Top-1 standings.

## Data privacy migration

The existing `scrim_records.personal_review` JSONB field is readable by every active team member because the parent Scrim record is team-readable. Hiding the field in React alone does not protect the data.

Migration `20261120190000_scrims_private_reviews_team_collaboration.sql` therefore:

1. Creates `scrim_personal_reviews` with an owner-scoped RLS policy.
2. Copies every existing `personal_review` JSON value into the new table before dropping the old shared column.
3. Creates team-scoped `scrim_team_review_comments` and `scrim_review_tasks` tables with author/manager/assignee policies.
4. Restricts action item assignment to active team members and validates linked review/session scope.

The client reads only explicit non-private columns from `scrim_records` and separately queries the signed-in user's personal-review rows.

## Tournament match entry

A Tournament slot may now have a null placement while kills are recorded. Such a slot contributes kills-only points but is not counted as a scored placement. A slot with null placement and zero kills is removed from the cloud ledger when explicitly cleared. Placement and kills changes update the visible shared scoreboard optimistically while the existing debounced sync runs.

The current placement scoring remains the existing prototype preset: placements 1–10 score 12, 9, 8, 7, 6, 5, 4, 3, 2, 1; placements 11–12 score 0; kills add one point each. It is not represented as an official tournament ruleset.

## Authorization

- Personal review read/write/delete: only the owning user while an active team member.
- Team review comments: active team members may read and add; authors may delete their own.
- Team action item creation/deletion: active owner, coach, or IGL.
- Team action item status update: active owner, coach, IGL, or the assigned active teammate.
- Assignee choices in the UI are limited to active teammates.

## Verification and rollout gate

The branch adds `scripts/verify-scrims-review.mjs` to the normal build. GitHub Actions runs typecheck, foundation contracts, Scrims regression contracts, and the Vite production bundle.

This migration has **not** been applied to Supabase. The repository's live migration history and checked-in SQL history must first be reconciled into a reproducible baseline. Do not apply the migration, merge the PR, or deploy production as part of this branch-only task.
