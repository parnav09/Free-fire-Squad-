export type CoverageDimensionState =
  | "observed"
  | "not_observed"
  | "not_applicable"
  | "incomplete"
  | "rejected_evidence"
  | null;

export type CoverageEvidenceState = "pending" | "verified" | "rejected" | "corrected" | "archived" | null;

export type EvidenceCoverageDimensionInput = {
  dimensionKey: string;
  assessmentState: CoverageDimensionState;
  evidenceState: CoverageEvidenceState;
};

export type EvidenceCoverageStatus = "complete" | "partial" | "insufficient";

export type EvidenceCoverageResult = {
  calculationVersion: "evidence-coverage-v1";
  applicableDimensionCount: number;
  observedDimensionCount: number;
  notObservedDimensionCount: number;
  incompleteDimensionCount: number;
  rejectedEvidenceDimensionCount: number;
  missingDimensionCount: number;
  verifiedEvidenceDimensionCount: number;
  unverifiedEvidenceDimensionCount: number;
  coverageBasisPoints: number | null;
  coveragePercent: number | null;
  status: EvidenceCoverageStatus;
};

const knownEvidence = new Set<CoverageEvidenceState>([null, "pending", "verified", "corrected", "rejected", "archived"]);
const countableEvidence = new Set<CoverageEvidenceState>(["pending", "verified", "corrected"]);

/**
 * Coverage is observed applicable dimensions / all historically applicable
 * dimensions. Not Observed remains in the denominator; it is never a rating.
 * Percentages are rounded to two decimal places using integer basis points.
 */
export function calculateEvidenceCoverage(
  dimensions: readonly EvidenceCoverageDimensionInput[],
): EvidenceCoverageResult {
  const seen = new Set<string>();
  for (const item of dimensions) {
    if (!item.dimensionKey.trim()) throw new Error("Coverage dimension key is required.");
    if (seen.has(item.dimensionKey)) throw new Error(`Duplicate coverage dimension: ${item.dimensionKey}`);
    seen.add(item.dimensionKey);
    if (item.assessmentState === "not_applicable") {
      throw new Error("Not Applicable dimensions must be excluded by the bound role-weight set.");
    }
    if (!knownEvidence.has(item.evidenceState)) {
      throw new Error("Unknown evidence state cannot be used in coverage.");
    }
    if (item.assessmentState !== "observed" && item.evidenceState !== null) {
      throw new Error("Only observed dimensions may contribute an evidence verification state.");
    }
    if (item.assessmentState === "rejected_evidence" && item.evidenceState !== null) {
      throw new Error("Rejected evidence is represented by the rejected assessment state, not observed evidence.");
    }
  }

  const applicableDimensionCount = dimensions.length;
  // Match the database calculator: an Observed assessment whose evidence is
  // rejected, archived or absent is not valid observed coverage; it is counted
  // in the rejected-evidence bucket instead of being silently accepted.
  const observed = dimensions.filter((item) =>
    item.assessmentState === "observed" && countableEvidence.has(item.evidenceState)
  );
  const observedDimensionCount = observed.length;
  const notObservedDimensionCount = dimensions.filter((item) => item.assessmentState === "not_observed").length;
  const incompleteDimensionCount = dimensions.filter((item) => item.assessmentState === "incomplete").length;
  const rejectedEvidenceDimensionCount = dimensions.filter((item) =>
    item.assessmentState === "rejected_evidence"
    || (item.assessmentState === "observed" && !countableEvidence.has(item.evidenceState))
  ).length;
  const missingDimensionCount = dimensions.filter((item) => item.assessmentState === null).length;
  const verifiedEvidenceDimensionCount = observed.filter((item) => item.evidenceState === "verified").length;
  const unverifiedEvidenceDimensionCount = observed.filter((item) => item.evidenceState === "pending" || item.evidenceState === "corrected").length;
  const coverageBasisPoints = applicableDimensionCount === 0
    ? null
    : Math.round((observedDimensionCount * 10000) / applicableDimensionCount);
  const coveragePercent = coverageBasisPoints === null ? null : coverageBasisPoints / 100;
  const status: EvidenceCoverageStatus = applicableDimensionCount === 0 || observedDimensionCount === 0
    ? "insufficient"
    : observedDimensionCount === applicableDimensionCount && unverifiedEvidenceDimensionCount === 0
      ? "complete"
      : "partial";

  return {
    calculationVersion: "evidence-coverage-v1",
    applicableDimensionCount,
    observedDimensionCount,
    notObservedDimensionCount,
    incompleteDimensionCount,
    rejectedEvidenceDimensionCount,
    missingDimensionCount,
    verifiedEvidenceDimensionCount,
    unverifiedEvidenceDimensionCount,
    coverageBasisPoints,
    coveragePercent,
    status,
  };
}
