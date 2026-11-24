import {
  CANONICAL_DIMENSION_REGISTRY,
  CANONICAL_ROLE_KEYS,
  type CanonicalDimensionKey,
  type CanonicalRoleKey,
} from "./evolution-dimensions";

export type RubricLifecycleStatus = "draft" | "active" | "retired";
export type RubricRatingKey = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10";
export type RubricRatingAnchors = Readonly<Record<RubricRatingKey, string>>;

export type RubricDimensionCriteriaInput = {
  dimensionKey: CanonicalDimensionKey;
  dimensionDefinitionVersion: number;
  criteriaGuidance: string;
  ratingAnchors: Partial<Record<RubricRatingKey, string>>;
  applicableRoleKeys: readonly CanonicalRoleKey[];
  roleGuidance?: Partial<Record<CanonicalRoleKey, string>>;
};

const RATING_KEYS: readonly RubricRatingKey[] = [
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
];

const ROLE_KEY_SET: ReadonlySet<string> = new Set(CANONICAL_ROLE_KEYS);

export function validateRubricDimensionCriteria(
  criteria: RubricDimensionCriteriaInput,
): string[] {
  const errors: string[] = [];
  const dimension = CANONICAL_DIMENSION_REGISTRY.find(
    (entry) => entry.key === criteria.dimensionKey && entry.lifecycleStatus === "active",
  );

  if (!dimension) {
    errors.push("Criteria must reference an active canonical dimension.");
    return errors;
  }

  if (!Number.isInteger(criteria.dimensionDefinitionVersion)
    || criteria.dimensionDefinitionVersion < 1) {
    errors.push("Dimension definition version must be a positive integer.");
  }

  if (criteria.criteriaGuidance.trim().length === 0
    || criteria.criteriaGuidance.trim().length > 2000) {
    errors.push("Criteria guidance must contain 1–2000 characters.");
  }

  for (const ratingKey of RATING_KEYS) {
    const anchor = criteria.ratingAnchors[ratingKey];
    if (typeof anchor !== "string" || anchor.trim().length === 0 || anchor.trim().length > 500) {
      errors.push("Rating " + ratingKey + " requires a non-empty anchor of at most 500 characters.");
    }
  }

  for (const [roleKey, guidance] of Object.entries(criteria.roleGuidance ?? {})) {
    if (!ROLE_KEY_SET.has(roleKey)
      || !dimension.applicableRoleKeys.includes(roleKey as CanonicalRoleKey)) {
      errors.push("Role guidance contains a role that is not applicable to " + criteria.dimensionKey + ".");
    }
    if (typeof guidance !== "string" || guidance.trim().length === 0 || guidance.trim().length > 1000) {
      errors.push("Role-specific guidance must contain 1–1000 characters.");
    }
  }

  return errors;
}

export function validateRubricForPublishing(
  criteria: readonly RubricDimensionCriteriaInput[],
): string[] {
  const errors: string[] = [];
  const seen = new Set<CanonicalDimensionKey>();
  const expected = CANONICAL_DIMENSION_REGISTRY.filter(
    (dimension) => dimension.lifecycleStatus === "active",
  );

  for (const item of criteria) {
    if (seen.has(item.dimensionKey)) {
      errors.push("Duplicate rubric criteria for " + item.dimensionKey + ".");
    }
    seen.add(item.dimensionKey);
    errors.push(...validateRubricDimensionCriteria(item));
  }

  for (const dimension of expected) {
    if (!seen.has(dimension.key)) {
      errors.push("Missing criteria for active canonical dimension " + dimension.key + ".");
    }
  }

  return errors;
}

export function isRubricVersionEditable(status: RubricLifecycleStatus): boolean {
  return status === "draft";
}

export function assertRubricVersionEditable(status: RubricLifecycleStatus): void {
  if (!isRubricVersionEditable(status)) {
    throw new Error("Published or retired rubric versions are immutable; create a new draft version.");
  }
}
