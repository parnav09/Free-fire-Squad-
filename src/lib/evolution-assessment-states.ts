import type { CanonicalDimensionKey } from "./evolution-dimensions";

export type DimensionAssessmentState = "observed" | "not_observed" | "not_applicable" | "incomplete" | "rejected_evidence";
export type EvidenceCurrentState = "pending" | "verified" | "rejected" | "corrected" | "archived";
export type DimensionAssessmentInput = {
  dimensionKey: CanonicalDimensionKey;
  state: DimensionAssessmentState;
  ratingValue: number | null;
  evidenceItemId: string | null;
  evidenceState: EvidenceCurrentState | null;
  reason: string | null;
};
export type AssessmentReadinessInput = {
  applicableDimensionCount: number;
  observedDimensionCount: number;
  notObservedDimensionCount: number;
  incompleteDimensionCount: number;
  rejectedEvidenceDimensionCount: number;
  missingDimensionCount: number;
  unverifiedObservedDimensionCount: number;
};
export type AssessmentReadiness = "draft" | "provisional" | "insufficient" | "final";

const hasReason = (reason: string | null): boolean =>
  typeof reason === "string" && reason.trim().length >= 3 && reason.trim().length <= 1000;

/** Zero is a valid observed rating; all non-observed states remain non-numeric. */
export function validateDimensionAssessment(input: DimensionAssessmentInput, roleApplicable: boolean): string[] {
  const errors: string[] = [];
  const hasRating = input.ratingValue !== null;
  const hasEvidence = typeof input.evidenceItemId === "string" && input.evidenceItemId.trim().length > 0;
  if (input.state === "observed") {
    if (!roleApplicable) errors.push("A non-applicable dimension cannot be rated.");
    if (!Number.isInteger(input.ratingValue) || (input.ratingValue as number) < 0 || (input.ratingValue as number) > 10) {
      errors.push("An observed rating must be an integer from 0 through 10; zero is valid.");
    }
    if (!hasEvidence) errors.push("An observed rating must reference dimension-linked evidence.");
    if (!input.evidenceState || !["pending", "verified", "corrected"].includes(input.evidenceState)) {
      errors.push("Observed ratings cannot use rejected or archived evidence.");
    }
  } else {
    if (hasRating) errors.push("Non-observed states cannot contain a numeric rating.");
    if (input.state === "not_applicable" && roleApplicable) errors.push("A role-applicable dimension cannot be marked Not Applicable.");
    if (input.state !== "not_applicable" && !roleApplicable) errors.push("Only role-applicable dimensions can use this state.");
    if (input.state === "rejected_evidence") {
      if (!hasEvidence) errors.push("Rejected evidence state must reference the rejected evidence item.");
      if (input.evidenceState !== "rejected") errors.push("Rejected evidence state requires currently rejected evidence.");
    } else if (hasEvidence) errors.push("This non-observed state cannot reference evidence.");
    if (!hasReason(input.reason)) errors.push("A reason of 3–1000 characters is required.");
  }
  return errors;
}

/** Readiness describes assessment completeness, never a performance score. */
export function classifyAssessmentReadiness(input: AssessmentReadinessInput): AssessmentReadiness {
  if (Object.values(input).some((value) => !Number.isInteger(value) || value < 0)) return "insufficient";
  if (input.applicableDimensionCount === 0) return "insufficient";
  if (input.observedDimensionCount === 0 && input.notObservedDimensionCount === 0
    && input.incompleteDimensionCount === 0 && input.rejectedEvidenceDimensionCount === 0
    && input.missingDimensionCount === 0) return "draft";
  if (input.observedDimensionCount === 0) return "insufficient";
  if (input.missingDimensionCount > 0 || input.incompleteDimensionCount > 0
    || input.rejectedEvidenceDimensionCount > 0 || input.unverifiedObservedDimensionCount > 0) return "provisional";
  return "final";
}
