import {
  CANONICAL_DIMENSION_REGISTRY,
  CANONICAL_ROLE_KEYS,
  type CanonicalDimensionKey,
  type CanonicalRoleKey,
} from "./evolution-dimensions";

export type RoleWeightLifecycleStatus = "draft" | "active" | "retired";

export type RoleDimensionWeightInput = {
  dimensionKey: CanonicalDimensionKey;
  dimensionDefinitionVersion: number;
  weightBasisPoints: number;
};

export type RoleWeightValidationInput = {
  roleKey: CanonicalRoleKey;
  weights: readonly RoleDimensionWeightInput[];
  rubricCriteriaVersions: Readonly<Partial<Record<CanonicalDimensionKey, number>>>;
};

const ROLE_KEY_SET: ReadonlySet<string> = new Set(CANONICAL_ROLE_KEYS);
const BASIS_POINT_TOTAL = 10_000;

/** Resolve only explicit historical role labels; never inspect a player's current team role. */
export function resolveCanonicalRoleKeyFromSnapshot(value: unknown): CanonicalRoleKey | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  const aliases: Readonly<Record<string, CanonicalRoleKey>> = {
    "primary rusher": "primary_rusher",
    primary_rusher: "primary_rusher",
    "secondary rusher": "secondary_rusher",
    secondary_rusher: "secondary_rusher",
    "third rusher flanker": "third_rusher_flanker",
    third_rusher_flanker: "third_rusher_flanker",
    "sniper + igl": "sniper_igl",
    "sniper igl": "sniper_igl",
    sniper_igl: "sniper_igl",
    "substitute flex": "substitute_flex",
    substitute_flex: "substitute_flex",
    other: "other",
  };
  return aliases[normalized] ?? null;
}

export function isCanonicalRoleKey(value: string): value is CanonicalRoleKey {
  return ROLE_KEY_SET.has(value);
}

/**
 * Weights are integer basis points (100 = 1%). Every applicable dimension must
 * appear exactly once; non-applicable dimensions must be omitted, not assigned
 * an arbitrary zero. The total must be exactly 10,000.
 */
export function validateRoleWeightConfiguration(input: RoleWeightValidationInput): string[] {
  const errors: string[] = [];
  if (!isCanonicalRoleKey(input.roleKey)) {
    return ["A canonical role key is required."];
  }

  const applicable = CANONICAL_DIMENSION_REGISTRY.filter((dimension) =>
    dimension.lifecycleStatus === "active" &&
    dimension.applicableRoleKeys.includes(input.roleKey)
  );
  const applicableKeys = new Set(applicable.map((dimension) => dimension.key));
  const seen = new Set<CanonicalDimensionKey>();
  let total = 0;

  for (const dimension of applicable) {
    const rubricVersion = input.rubricCriteriaVersions[dimension.key];
    if (!Number.isInteger(rubricVersion) || rubricVersion !== dimension.definitionVersion) {
      errors.push("The active rubric must contain the exact active definition for " + dimension.key + ".");
    }
  }

  for (const weight of input.weights) {
    if (seen.has(weight.dimensionKey)) {
      errors.push("Duplicate weight for " + weight.dimensionKey + ".");
      continue;
    }
    seen.add(weight.dimensionKey);

    if (!applicableKeys.has(weight.dimensionKey)) {
      errors.push("Dimension " + weight.dimensionKey + " is not applicable to role " + input.roleKey + ".");
    }
    if (!Number.isInteger(weight.weightBasisPoints)
      || weight.weightBasisPoints < 0
      || weight.weightBasisPoints > BASIS_POINT_TOTAL) {
      errors.push("Weights must be integer basis points from 0 through 10000.");
    } else {
      total += weight.weightBasisPoints;
    }
    const expectedVersion = input.rubricCriteriaVersions[weight.dimensionKey];
    if (!Number.isInteger(weight.dimensionDefinitionVersion)
      || weight.dimensionDefinitionVersion !== expectedVersion) {
      errors.push("Weight for " + weight.dimensionKey + " must pin the exact rubric dimension-definition version.");
    }
  }

  for (const dimension of applicable) {
    if (!seen.has(dimension.key)) {
      errors.push("Missing applicable dimension weight for " + dimension.key + ".");
    }
  }
  if (seen.size !== input.weights.length) {
    errors.push("Each dimension may have exactly one weight.");
  }
  if (total !== BASIS_POINT_TOTAL) {
    errors.push("Applicable role weights must total exactly 10000 basis points.");
  }

  return errors;
}

export function isRoleWeightSetEditable(status: RoleWeightLifecycleStatus): boolean {
  return status === "draft";
}

export function assertRoleWeightSetEditable(status: RoleWeightLifecycleStatus): void {
  if (!isRoleWeightSetEditable(status)) {
    throw new Error("Published or retired role weight sets are immutable; create a new version.");
  }
}
