import {
  calculateEvidenceCoverage,
  type CoverageDimensionState,
  type CoverageEvidenceState,
} from "./evolution-evidence-coverage";
import {
  classifyAssessmentReadiness,
  type AssessmentReadinessInput,
  type EvidenceCurrentState,
} from "./evolution-assessment-states";
import type { CanonicalDimensionKey, CanonicalRoleKey } from "./evolution-dimensions";

export const DETERMINISTIC_SCORING_ENGINE_VERSION = "deterministic-scoring-v1" as const;
export const DETERMINISTIC_SCORING_POLICY_V1 = {
  version: "deterministic-scoring-policy-v1",
  minimumCoverageBasisPoints: 5_000,
  ratingScaleMinimum: 0,
  ratingScaleMaximum: 10,
  normalizedScoreMultiplier: 10,
  scorePrecisionDecimalPlaces: 2,
  rounding: "half-up" as const,
  notObservedPolicy: "exclude-from-score-denominator-but-retain-in-coverage-denominator" as const,
};

export type ScoringEvidence = {
  id: string;
  evaluationContextId: string;
  dimensionKey: CanonicalDimensionKey;
  dimensionDefinitionVersion: number;
  status: EvidenceCurrentState;
};

export type ScoringAssessment = {
  dimensionKey: CanonicalDimensionKey;
  dimensionDefinitionVersion: number;
  state: "observed" | "not_observed" | "not_applicable" | "incomplete" | "rejected_evidence";
  ratingValue: number | null;
  evidence: ScoringEvidence | null;
  reason: string | null;
};

export type ScoringRubric = {
  id: string;
  version: number;
  status: "active" | "retired";
  effectiveFrom: string;
  effectiveUntil: string | null;
  criteria: readonly {
    dimensionKey: CanonicalDimensionKey;
    dimensionDefinitionVersion: number;
    applicableRoleKeys: readonly CanonicalRoleKey[];
  }[];
};

export type ScoringWeightSet = {
  id: string;
  version: number;
  evaluationContextId: string;
  rubricVersionId: string;
  roleAssignmentSnapshotId: string;
  roleKey: CanonicalRoleKey;
  status: "active" | "retired";
  effectiveFrom: string;
  effectiveUntil: string | null;
  dimensions: readonly {
    dimensionKey: CanonicalDimensionKey;
    dimensionDefinitionVersion: number;
    weightBasisPoints: number;
  }[];
};

export type DeterministicScoringInput = {
  context: {
    id: string;
    createdAt: string;
    roleAssignmentSnapshotId: string;
    roleKey: CanonicalRoleKey;
  };
  rubric: ScoringRubric;
  weightSet: ScoringWeightSet;
  assessments: readonly ScoringAssessment[];
};

export type ScoringResultStatus = "final" | "provisional" | "insufficient";

export type DeterministicScoringResult = {
  calculationVersion: typeof DETERMINISTIC_SCORING_ENGINE_VERSION;
  scoringPolicyVersion: typeof DETERMINISTIC_SCORING_POLICY_V1.version;
  status: ScoringResultStatus;
  /** Final, trusted 0–100 score. Null unless every final-score gate passes. */
  score100: number | null;
  /** Diagnostic candidate shown only to a later review workflow; never a final score. */
  provisionalScore100: number | null;
  /** Integer hundredths of a point (e.g. 8750 = 87.50). */
  scoreBasisPoints: number | null;
  provisionalScoreBasisPoints: number | null;
  coverageBasisPoints: number | null;
  coveragePercent: number | null;
  applicableDimensionCount: number;
  observedDimensionCount: number;
  notObservedDimensionCount: number;
  missingDimensionCount: number;
  incompleteDimensionCount: number;
  rejectedEvidenceDimensionCount: number;
  verifiedEvidenceDimensionCount: number;
  unverifiedEvidenceDimensionCount: number;
  observedWeightBasisPoints: number;
  reasons: readonly string[];
};

const ELIGIBLE_EVIDENCE_STATES = new Set<EvidenceCurrentState>(["pending", "verified", "corrected"]);
const KNOWN_EVIDENCE_STATES = new Set<EvidenceCurrentState>(["pending", "verified", "rejected", "corrected", "archived"]);

function assertNonEmpty(value: string, label: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(label + " is required.");
  }
}

function timestamp(value: string, label: string): number {
  assertNonEmpty(value, label);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new RangeError(label + " must be a valid timestamp.");
  return parsed;
}

function assertEffectiveAtContext(
  contextCreatedAt: number,
  effectiveFrom: string,
  effectiveUntil: string | null,
  label: string,
): void {
  const from = timestamp(effectiveFrom, label + " effectiveFrom");
  const until = effectiveUntil === null ? null : timestamp(effectiveUntil, label + " effectiveUntil");
  if (until !== null && until <= from) throw new RangeError(label + " effective range must be positive.");
  if (contextCreatedAt < from || (until !== null && contextCreatedAt >= until)) {
    throw new RangeError(label + " was not effective when the evaluation context was created.");
  }
}

function assertReason(reason: string | null, label: string): void {
  if (typeof reason !== "string" || reason.trim().length < 3 || reason.trim().length > 1000) {
    throw new TypeError(label + " requires a reason of 3–1000 characters.");
  }
}

function roundHalfUp(numerator: number, denominator: number): number {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator <= 0) {
    throw new RangeError("Score rounding requires safe non-negative integer arithmetic.");
  }
  return Math.floor((numerator + Math.floor(denominator / 2)) / denominator);
}

/**
 * Pure, deterministic score calculation. It consumes only the exact historical
 * context/rubric/role-weight snapshots and evidence states supplied by the caller.
 * Tournament placement, points, kills and match outcomes are intentionally absent.
 */
export function calculateDeterministicPlayerScore(
  input: DeterministicScoringInput,
): DeterministicScoringResult {
  const { context, rubric, weightSet } = input;
  assertNonEmpty(context.id, "Evaluation context ID");
  assertNonEmpty(context.roleAssignmentSnapshotId, "Historical role-assignment snapshot ID");
  assertNonEmpty(rubric.id, "Rubric version ID");
  assertNonEmpty(weightSet.id, "Role weight-set ID");

  const contextTime = timestamp(context.createdAt, "Evaluation context createdAt");
  if (weightSet.evaluationContextId !== context.id) {
    throw new Error("Role weight set is not bound to this exact evaluation context.");
  }
  if (weightSet.rubricVersionId !== rubric.id) {
    throw new Error("Role weight set is not bound to this exact rubric version.");
  }
  if (weightSet.roleAssignmentSnapshotId !== context.roleAssignmentSnapshotId
    || weightSet.roleKey !== context.roleKey) {
    throw new Error("Role weight set does not match the historical role-assignment snapshot.");
  }
  if (!Number.isInteger(rubric.version) || rubric.version < 1
    || !Number.isInteger(weightSet.version) || weightSet.version < 1) {
    throw new RangeError("Rubric and weight-set versions must be positive integers.");
  }
  assertEffectiveAtContext(contextTime, rubric.effectiveFrom, rubric.effectiveUntil, "Rubric");
  assertEffectiveAtContext(contextTime, weightSet.effectiveFrom, weightSet.effectiveUntil, "Role weight set");

  const criteriaByKey = new Map<CanonicalDimensionKey, ScoringRubric["criteria"][number]>();
  for (const criterion of rubric.criteria) {
    if (criteriaByKey.has(criterion.dimensionKey)) {
      throw new Error("Duplicate rubric criterion for " + criterion.dimensionKey + ".");
    }
    if (!Number.isInteger(criterion.dimensionDefinitionVersion) || criterion.dimensionDefinitionVersion < 1) {
      throw new RangeError("Rubric dimension-definition versions must be positive integers.");
    }
    if (!criterion.applicableRoleKeys.includes(context.roleKey)) {
      continue;
    }
    criteriaByKey.set(criterion.dimensionKey, criterion);
  }

  if (criteriaByKey.size === 0) throw new Error("Rubric has no dimensions applicable to the historical role.");

  const weightByKey = new Map<CanonicalDimensionKey, number>();
  let totalWeight = 0;
  for (const weight of weightSet.dimensions) {
    if (weightByKey.has(weight.dimensionKey)) {
      throw new Error("Duplicate role weight for " + weight.dimensionKey + ".");
    }
    const criterion = criteriaByKey.get(weight.dimensionKey);
    if (!criterion) throw new Error("Weight references a dimension not applicable to the historical role.");
    if (weight.dimensionDefinitionVersion !== criterion.dimensionDefinitionVersion) {
      throw new Error("Role weight must pin the exact rubric dimension-definition version.");
    }
    if (!Number.isInteger(weight.weightBasisPoints) || weight.weightBasisPoints < 0 || weight.weightBasisPoints > 10_000) {
      throw new RangeError("Role weights must be integer basis points from 0 through 10000.");
    }
    weightByKey.set(weight.dimensionKey, weight.weightBasisPoints);
    totalWeight += weight.weightBasisPoints;
  }
  if (weightByKey.size !== criteriaByKey.size) {
    throw new Error("Role weight set must contain every applicable rubric dimension exactly once.");
  }
  if (totalWeight !== 10_000) {
    throw new Error("Applicable role weights must total exactly 10000 basis points.");
  }

  const assessmentByKey = new Map<CanonicalDimensionKey, ScoringAssessment>();
  for (const assessment of input.assessments) {
    if (assessmentByKey.has(assessment.dimensionKey)) {
      throw new Error("Duplicate assessment for " + assessment.dimensionKey + ".");
    }
    if (!weightByKey.has(assessment.dimensionKey)) {
      throw new Error("Assessment references a dimension outside the bound historical role-weight set.");
    }
    const expectedVersion = criteriaByKey.get(assessment.dimensionKey)!.dimensionDefinitionVersion;
    if (assessment.dimensionDefinitionVersion !== expectedVersion) {
      throw new Error("Assessment must pin the exact rubric dimension-definition version.");
    }
    assessmentByKey.set(assessment.dimensionKey, assessment);
  }

  let weightedRatingNumerator = 0;
  let observedWeight = 0;
  let observedCount = 0;
  let verifiedCount = 0;
  let unverifiedCount = 0;
  let notObservedCount = 0;
  let incompleteCount = 0;
  let rejectedCount = 0;
  let missingCount = 0;
  const coverageInputs: {
    dimensionKey: string;
    assessmentState: CoverageDimensionState;
    evidenceState: CoverageEvidenceState;
  }[] = [];

  for (const [dimensionKey, weightBasisPoints] of weightByKey) {
    const assessment = assessmentByKey.get(dimensionKey);
    if (!assessment) {
      missingCount += 1;
      coverageInputs.push({ dimensionKey, assessmentState: null, evidenceState: null });
      continue;
    }

    if (assessment.state === "not_applicable") {
      throw new Error("Not Applicable cannot be supplied for a dimension in the bound role-weight set.");
    }

    if (assessment.state === "not_observed" || assessment.state === "incomplete") {
      assertReason(assessment.reason, assessment.state);
      if (assessment.ratingValue !== null || assessment.evidence !== null) {
        throw new Error("Non-observed assessment states cannot contain a rating or evidence reference.");
      }
      if (assessment.state === "not_observed") notObservedCount += 1;
      else incompleteCount += 1;
      coverageInputs.push({
        dimensionKey,
        assessmentState: assessment.state as CoverageDimensionState,
        evidenceState: null,
      });
      continue;
    }

    if (assessment.state === "rejected_evidence") {
      assertReason(assessment.reason, "Rejected evidence assessment");
      if (assessment.ratingValue !== null || !assessment.evidence || assessment.evidence.status !== "rejected") {
        throw new Error("Rejected evidence assessments must reference currently rejected evidence and no rating.");
      }
      if (!KNOWN_EVIDENCE_STATES.has(assessment.evidence.status)) {
        throw new Error("Unknown evidence state cannot be scored.");
      }
      if (assessment.evidence.evaluationContextId !== context.id
        || assessment.evidence.dimensionKey !== dimensionKey
        || assessment.evidence.dimensionDefinitionVersion !== assessment.dimensionDefinitionVersion) {
        throw new Error("Rejected evidence must match the exact context and dimension version.");
      }
      rejectedCount += 1;
      coverageInputs.push({ dimensionKey, assessmentState: "rejected_evidence", evidenceState: null });
      continue;
    }

    if (assessment.state !== "observed") {
      throw new Error("Unknown assessment state cannot be scored.");
    }
    if (!Number.isInteger(assessment.ratingValue)
      || (assessment.ratingValue as number) < 0 || (assessment.ratingValue as number) > 10) {
      throw new RangeError("Observed rating must be an integer from 0 through 10; zero is valid.");
    }

    const evidence = assessment.evidence;
    const evidenceState = evidence?.status ?? null;
    if (evidenceState !== null && !KNOWN_EVIDENCE_STATES.has(evidenceState)) {
      throw new Error("Unknown evidence state cannot be scored.");
    }
    const evidenceMatches = evidence !== null
      && evidence.evaluationContextId === context.id
      && evidence.dimensionKey === dimensionKey
      && evidence.dimensionDefinitionVersion === assessment.dimensionDefinitionVersion
      && evidence.id.trim().length > 0;
    const evidenceEligible = evidenceMatches && evidenceState !== null && ELIGIBLE_EVIDENCE_STATES.has(evidenceState);

    if (!evidenceEligible) {
      rejectedCount += 1;
      coverageInputs.push({ dimensionKey, assessmentState: "observed", evidenceState: evidenceState as CoverageEvidenceState });
      continue;
    }

    observedCount += 1;
    weightedRatingNumerator += (assessment.ratingValue as number) * weightBasisPoints;
    observedWeight += weightBasisPoints;
    if (evidenceState === "verified") verifiedCount += 1;
    else unverifiedCount += 1;
    coverageInputs.push({ dimensionKey, assessmentState: "observed", evidenceState: evidenceState as CoverageEvidenceState });
  }

  const coverage = calculateEvidenceCoverage(coverageInputs);
  const readinessInput: AssessmentReadinessInput = {
    applicableDimensionCount: weightByKey.size,
    observedDimensionCount: observedCount,
    notObservedDimensionCount: notObservedCount,
    incompleteDimensionCount: incompleteCount,
    rejectedEvidenceDimensionCount: rejectedCount,
    missingDimensionCount: missingCount,
    unverifiedObservedDimensionCount: unverifiedCount,
  };
  const readiness = classifyAssessmentReadiness(readinessInput);
  const reasons: string[] = [];

  if (observedCount === 0 || observedWeight === 0) reasons.push("no_valid_observed_weight");
  if ((coverage.coverageBasisPoints ?? 0) < DETERMINISTIC_SCORING_POLICY_V1.minimumCoverageBasisPoints) {
    reasons.push("coverage_below_minimum");
  }
  if (missingCount > 0) reasons.push("missing_dimensions");
  if (incompleteCount > 0) reasons.push("incomplete_dimensions");
  if (rejectedCount > 0) reasons.push("rejected_or_ineligible_evidence");
  if (unverifiedCount > 0) reasons.push("unverified_evidence");

  const canCalculateCandidate = observedCount > 0 && observedWeight > 0;
  // score100 has two decimal places. Integer arithmetic and half-up rounding
  // avoid floating-point drift and make repeated inputs byte-for-byte stable.
  const candidateScoreBasisPoints = canCalculateCandidate
    ? roundHalfUp(weightedRatingNumerator * 1_000, observedWeight)
    : null;
  const candidateScore100 = candidateScoreBasisPoints === null ? null : candidateScoreBasisPoints / 100;
  const coveragePasses = (coverage.coverageBasisPoints ?? 0)
    >= DETERMINISTIC_SCORING_POLICY_V1.minimumCoverageBasisPoints;

  let status: ScoringResultStatus = "insufficient";
  if (coveragePasses && canCalculateCandidate) {
    status = readiness === "final" ? "final" : "provisional";
  }

  return {
    calculationVersion: DETERMINISTIC_SCORING_ENGINE_VERSION,
    scoringPolicyVersion: DETERMINISTIC_SCORING_POLICY_V1.version,
    status,
    score100: status === "final" ? candidateScore100 : null,
    provisionalScore100: status === "provisional" ? candidateScore100 : null,
    scoreBasisPoints: status === "final" ? candidateScoreBasisPoints : null,
    provisionalScoreBasisPoints: status === "provisional" ? candidateScoreBasisPoints : null,
    coverageBasisPoints: coverage.coverageBasisPoints,
    coveragePercent: coverage.coveragePercent,
    applicableDimensionCount: weightByKey.size,
    observedDimensionCount: observedCount,
    notObservedDimensionCount: notObservedCount,
    missingDimensionCount: missingCount,
    incompleteDimensionCount: incompleteCount,
    rejectedEvidenceDimensionCount: rejectedCount,
    verifiedEvidenceDimensionCount: verifiedCount,
    unverifiedEvidenceDimensionCount: unverifiedCount,
    observedWeightBasisPoints: observedWeight,
    reasons,
  };
}
