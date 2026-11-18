export const CANONICAL_DIMENSIONS = [
  "communication",
  "coordination_trade_support",
  "decision_making",
  "positioning",
  "map_awareness_rotation",
  "role_execution",
] as const;

export type CanonicalDimension = (typeof CANONICAL_DIMENSIONS)[number];
export type DimensionObservation =
  | { status: "rated"; value: number }
  | { status: "not_observed"; reason: string };
export type DimensionObservations = Record<CanonicalDimension, DimensionObservation>;
export type RoleWeights = Record<CanonicalDimension, number>;

export type CanonicalScoreInput = {
  rubricVersionId: string;
  scoringEngineVersion: string;
  roleKey: string;
  observations: DimensionObservations;
  weights: RoleWeights;
  minimumObservedDimensions: number;
};

export type CanonicalScoreResult = {
  rubricVersionId: string;
  scoringEngineVersion: string;
  roleKey: string;
  score100: number | null;
  weightedAverage10: number | null;
  observedDimensions: number;
  totalDimensions: 6;
  coverageRatio: number;
  minimumObservedDimensions: number;
  status: "scored" | "insufficient_coverage" | "no_observations";
};

function assertNonBlank(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${label} must be a non-empty string.`);
  }
}

function assertRatio(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${label} must be between 0 and 1.`);
  }
}

/**
 * Deterministic, version-labelled weighted scoring.
 * Zero is a valid rating. Not observed is represented separately with a reason.
 * Missing dimensions are rejected rather than silently converted to zero/NULL.
 */
export function calculateCanonicalScore(input: CanonicalScoreInput): CanonicalScoreResult {
  assertNonBlank(input.rubricVersionId, "rubricVersionId");
  assertNonBlank(input.scoringEngineVersion, "scoringEngineVersion");
  assertNonBlank(input.roleKey, "roleKey");
  if (!Number.isInteger(input.minimumObservedDimensions)
    || input.minimumObservedDimensions < 1
    || input.minimumObservedDimensions > CANONICAL_DIMENSIONS.length) {
    throw new RangeError("minimumObservedDimensions must be an integer from 1 to 6.");
  }

  let observedDimensions = 0;
  let weightedTotal = 0;
  let observedWeightTotal = 0;

  for (const key of CANONICAL_DIMENSIONS) {
    const observation = input.observations?.[key];
    const weight = input.weights?.[key];
    if (!observation || (observation.status !== "rated" && observation.status !== "not_observed")) {
      throw new TypeError(`Every canonical dimension requires an explicit observation state: ${key}.`);
    }
    if (!Number.isFinite(weight) || weight < 0) {
      throw new RangeError(`Weight for ${key} must be a finite non-negative number.`);
    }
    if (observation.status === "rated") {
      if (!Number.isInteger(observation.value) || observation.value < 0 || observation.value > 10) {
        throw new RangeError(`Rating for ${key} must be an integer from 0 to 10.`);
      }
      observedDimensions += 1;
      weightedTotal += observation.value * weight;
      observedWeightTotal += weight;
    } else if (typeof observation.reason !== "string" || observation.reason.trim().length === 0) {
      throw new TypeError(`Not observed requires a reason for ${key}.`);
    }
  }

  const coverageRatio = observedDimensions / CANONICAL_DIMENSIONS.length;
  if (observedDimensions === 0) {
    return {
      rubricVersionId: input.rubricVersionId,
      scoringEngineVersion: input.scoringEngineVersion,
      roleKey: input.roleKey,
      score100: null,
      weightedAverage10: null,
      observedDimensions,
      totalDimensions: CANONICAL_DIMENSIONS.length,
      coverageRatio,
      minimumObservedDimensions: input.minimumObservedDimensions,
      status: "no_observations",
    };
  }

  if (observedWeightTotal <= 0) {
    throw new RangeError("At least one observed dimension must have a positive role weight.");
  }

  const weightedAverage10 = weightedTotal / observedWeightTotal;
  const meetsCoverage = observedDimensions >= input.minimumObservedDimensions;
  return {
    rubricVersionId: input.rubricVersionId,
    scoringEngineVersion: input.scoringEngineVersion,
    roleKey: input.roleKey,
    score100: meetsCoverage ? weightedAverage10 * 10 : null,
    weightedAverage10,
    observedDimensions,
    totalDimensions: CANONICAL_DIMENSIONS.length,
    coverageRatio,
    minimumObservedDimensions: input.minimumObservedDimensions,
    status: meetsCoverage ? "scored" : "insufficient_coverage",
  };
}

export type ConfidencePolicy = {
  minimumSampleCount: number;
  strongSampleCount: number;
  minimumEvidenceRatio: number;
  strongEvidenceRatio: number;
  minimumContextConsistency: number;
  strongContextConsistency: number;
};

/** Confidence is based on sample/evidence/context inputs, never on the score value. */
export function deriveEvidenceConfidence(input: {
  sampleCount: number;
  evidenceBackedRatio: number;
  contextConsistency: number;
  policy: ConfidencePolicy;
}): "insufficient" | "moderate" | "strong" {
  const { policy } = input;
  if (!Number.isInteger(input.sampleCount) || input.sampleCount < 0
    || !Number.isInteger(policy.minimumSampleCount) || policy.minimumSampleCount < 1
    || !Number.isInteger(policy.strongSampleCount) || policy.strongSampleCount < policy.minimumSampleCount) {
    throw new RangeError("Sample counts and confidence policy are invalid.");
  }
  assertRatio(input.evidenceBackedRatio, "evidenceBackedRatio");
  assertRatio(input.contextConsistency, "contextConsistency");
  assertRatio(policy.minimumEvidenceRatio, "minimumEvidenceRatio");
  assertRatio(policy.strongEvidenceRatio, "strongEvidenceRatio");
  assertRatio(policy.minimumContextConsistency, "minimumContextConsistency");
  assertRatio(policy.strongContextConsistency, "strongContextConsistency");
  if (policy.strongEvidenceRatio < policy.minimumEvidenceRatio
    || policy.strongContextConsistency < policy.minimumContextConsistency) {
    throw new RangeError("Strong confidence thresholds cannot be lower than minimum thresholds.");
  }

  if (input.sampleCount < policy.minimumSampleCount
    || input.evidenceBackedRatio < policy.minimumEvidenceRatio
    || input.contextConsistency < policy.minimumContextConsistency) {
    return "insufficient";
  }
  if (input.sampleCount >= policy.strongSampleCount
    && input.evidenceBackedRatio >= policy.strongEvidenceRatio
    && input.contextConsistency >= policy.strongContextConsistency) {
    return "strong";
  }
  return "moderate";
}

export type ComparabilityContext = {
  rubricVersionId: string;
  scoringEngineVersion: string;
  roleKey: string;
  mode: string;
  map: string;
};

/** Exact-context comparison only; unknown or different contexts fail closed. */
export function compareEvaluationContexts(
  left: ComparabilityContext,
  right: ComparabilityContext,
): { comparable: boolean; reasons: string[] } {
  const reasons: string[] = [];
  for (const key of ["rubricVersionId", "scoringEngineVersion", "roleKey", "mode", "map"] as const) {
    if (!left[key] || !right[key] || left[key] !== right[key]) reasons.push(key);
  }
  return { comparable: reasons.length === 0, reasons };
}

export function convertLegacyScoreToApproximate100(
  score: number,
  originalScaleMax: number,
): { value: number; label: "Legacy scale — approximate conversion"; comparable: false; originalScaleMax: number } {
  if (!Number.isFinite(originalScaleMax) || originalScaleMax <= 0
    || !Number.isFinite(score) || score < 0 || score > originalScaleMax) {
    throw new RangeError("Legacy score must be within its declared original scale.");
  }
  return {
    value: (score / originalScaleMax) * 100,
    label: "Legacy scale — approximate conversion",
    comparable: false,
    originalScaleMax,
  };
}
