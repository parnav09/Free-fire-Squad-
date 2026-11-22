# Evolution Phase 3.7 — Not Observed & Missing Data Rules

**Status:** Implemented; exact-head CI verification pending  
**PR:** #131 — consolidated Evolution Phase Three PR

## State contract
- **Observed:** integer rating 0–10 plus evidence linked to the same evaluation context and exact dimension-definition version. **0 is valid.**
- **Not Observed:** explicit reason, no rating and no evidence. It is not zero and is not included as a numeric rating.
- **Not Applicable:** explicit reason; accepted only when the dimension is not applicable to the historical role-weight configuration.
- **Incomplete:** explicit reason; distinct from a dimension with no assessment row.
- **Rejected Evidence:** references evidence whose current provenance state is rejected; never treated as an observed rating.
- **Missing:** no assessment event exists for an applicable dimension. No default rating is synthesized.

Non-observed states are non-numeric and require a reason. Observed entries require evidence and a 0–10 integer rating. Rejected/archived evidence cannot support an observed rating. Pending/corrected evidence is unverified and keeps the evaluation provisional.

## Readiness semantics
- **Draft:** no dimension assessment has been recorded.
- **Insufficient:** no applicable dimension has a valid observed rating.
- **Provisional:** an observed rating exists, but an applicable dimension is missing/incomplete/rejected or observed evidence is unverified.
- **Final:** at least one observed rating exists; every applicable dimension has an explicit disposition (Observed or Not Observed); all observed evidence is verified.

Final means assessment completeness only. It does not mean a performance score exists or that the evaluation is score-eligible. Point 3.8 calculates evidence coverage separately; Point 3.9 defines deterministic score gates. This point adds no weighted denominator, coverage percentage or score snapshot.

## Integrity and security
Append-only per-dimension revisions, serialized revision numbering, exact context/rubric/role-weight/dimension binding, role applicability checks, evidence-context matching, team-scoped RLS, owner/coach writes, and no direct update/delete or anonymous access. No legacy backfill or conversion.

## UI / visual treatment
This is a data-integrity point and adds no visible controls. Existing Squad OS dark theme, color grading, typography, spacing and layout remain untouched. Future evaluation UI must keep 44×44 CSS px minimum hitboxes, precise full-surface click areas, no text/control collisions, and responsive Android/mobile, tablet, laptop and desktop behavior.

## Verification
Repeatable migration; PostgreSQL integration for valid zero, null rejection, Not Observed, Not Applicable guard, rejected evidence, provisional/final readiness, append-only history, RLS and ACLs; source contracts; normal build and GitHub Actions chain.
