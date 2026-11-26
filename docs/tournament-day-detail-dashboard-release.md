# Tournament Day Detail Dashboard

## Overview
The tournament event workspace now opens with an all-days overview. Selecting a day opens a dedicated result page for that date; the page no longer expands every day's match inputs inline.

## Day detail
- Selected calendar date and the record's last-updated timestamp.
- Numeric day standing.
- Match count, saved-result count, kills, placement points, and combined points.
- One result card for every scheduled match, with placement, derived placement points, kills, and combined match points.
- Successful saves show brief feedback, dismiss automatically, and return the workspace to its top.

## Overall report
- Combined match, recorded-result, kill, placement-point, and total-point summaries across all configured days.
- Numeric final overall standing.
- A day selector to open each day's detailed result page.

## Permissions and persistence
- Existing team IGL designation is reused; it does not replace the player's roster role.
- Active Owner and Coach manage event records. Active Owner, Coach, and designated IGL update match results and standings. Other members are read-only.
- Event-level standing remains in the existing JSONB sync payload. The visible last-updated value uses the record update timestamp.
- The accompanying additive RLS migration replaces broad member write policies without resetting tournament data.

## Release checks
The production build includes the tournament day dashboard regression suite and the existing event scoring/alignment verifiers.