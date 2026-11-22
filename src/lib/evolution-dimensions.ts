export const CANONICAL_ROLE_KEYS = [
  "primary_rusher",
  "secondary_rusher",
  "third_rusher_flanker",
  "sniper_igl",
  "substitute_flex",
  "other",
] as const;

export type CanonicalRoleKey = (typeof CANONICAL_ROLE_KEYS)[number];

export const CANONICAL_RATING_SCALE = {
  minimum: 0,
  maximum: 10,
  step: 1,
} as const;

export type CanonicalDimensionKey =
  | "communication"
  | "coordination_trade_support"
  | "decision_making"
  | "positioning"
  | "map_awareness_rotation"
  | "role_execution";

export type CanonicalDimensionDefinition = {
  readonly key: CanonicalDimensionKey;
  readonly definitionVersion: number;
  readonly label: string;
  readonly definition: string;
  readonly sortOrder: number;
  readonly lifecycleStatus: "active" | "retired";
  readonly applicableRoleKeys: readonly CanonicalRoleKey[];
  readonly ratingScale: typeof CANONICAL_RATING_SCALE;
};

export const CANONICAL_DIMENSION_REGISTRY = [
  {
    key: "communication",
    definitionVersion: 1,
    label: "Communication",
    definition: "Timely, clear, accurate and actionable information; usefulness matters more than callout volume.",
    sortOrder: 1,
    lifecycleStatus: "active",
    applicableRoleKeys: CANONICAL_ROLE_KEYS,
    ratingScale: CANONICAL_RATING_SCALE,
  },
  {
    key: "coordination_trade_support",
    definitionVersion: 1,
    label: "Coordination & Trade Support",
    definition: "Team timing, spacing, acknowledgement and support behavior; not simply an outcome or elimination count.",
    sortOrder: 2,
    lifecycleStatus: "active",
    applicableRoleKeys: CANONICAL_ROLE_KEYS,
    ratingScale: CANONICAL_RATING_SCALE,
  },
  {
    key: "decision_making",
    definitionVersion: 1,
    label: "Decision Making",
    definition: "Decision quality in its observed context, independent of hindsight or outcome alone.",
    sortOrder: 3,
    lifecycleStatus: "active",
    applicableRoleKeys: CANONICAL_ROLE_KEYS,
    ratingScale: CANONICAL_RATING_SCALE,
  },
  {
    key: "positioning",
    definitionVersion: 1,
    label: "Positioning",
    definition: "Cover, angles, spacing, exposure and safe repositioning in the observed context.",
    sortOrder: 4,
    lifecycleStatus: "active",
    applicableRoleKeys: CANONICAL_ROLE_KEYS,
    ratingScale: CANONICAL_RATING_SCALE,
  },
  {
    key: "map_awareness_rotation",
    definitionVersion: 1,
    label: "Map Awareness & Rotation",
    definition: "Reading map/zone information, timing and route context; distinct from positioning.",
    sortOrder: 5,
    lifecycleStatus: "active",
    applicableRoleKeys: CANONICAL_ROLE_KEYS,
    ratingScale: CANONICAL_RATING_SCALE,
  },
  {
    key: "role_execution",
    definitionVersion: 1,
    label: "Role Execution",
    definition: "Execution of the role actually recorded for that session, not a mutable current roster label.",
    sortOrder: 6,
    lifecycleStatus: "active",
    applicableRoleKeys: CANONICAL_ROLE_KEYS,
    ratingScale: CANONICAL_RATING_SCALE,
  },
] as const satisfies readonly CanonicalDimensionDefinition[];

export const CANONICAL_DIMENSION_KEYS = CANONICAL_DIMENSION_REGISTRY.map(
  (dimension) => dimension.key,
) as readonly CanonicalDimensionKey[];

export const LEGACY_DIMENSION_ALIASES = [
  { source: "daily_evaluation", legacyKey: "communication", canonicalKey: "communication", kind: "exact" },
  { source: "daily_evaluation", legacyKey: "decision_making", canonicalKey: "decision_making", kind: "exact" },
  { source: "daily_evaluation", legacyKey: "role_execution", canonicalKey: "role_execution", kind: "exact" },
  { source: "standard_training", legacyKey: "communication", canonicalKey: "communication", kind: "exact" },
  { source: "advanced_training", legacyKey: "communication", canonicalKey: "communication", kind: "exact" },
  { source: "advanced_training", legacyKey: "decision_making", canonicalKey: "decision_making", kind: "exact" },
  { source: "advanced_training", legacyKey: "positioning", canonicalKey: "positioning", kind: "exact" },
] as const;

const CANONICAL_DIMENSION_KEY_SET: ReadonlySet<string> = new Set(CANONICAL_DIMENSION_KEYS);

export function isCanonicalDimensionKey(value: string): value is CanonicalDimensionKey {
  return CANONICAL_DIMENSION_KEY_SET.has(value);
}

export function getCanonicalDimension(
  key: CanonicalDimensionKey,
): (typeof CANONICAL_DIMENSION_REGISTRY)[number] {
  const dimension = CANONICAL_DIMENSION_REGISTRY.find((entry) => entry.key === key);
  if (!dimension) throw new RangeError(`Unknown canonical dimension: ${key}`);
  return dimension;
}

export function assertCanonicalRating(value: number): void {
  if (!Number.isInteger(value)
    || value < CANONICAL_RATING_SCALE.minimum
    || value > CANONICAL_RATING_SCALE.maximum) {
    throw new RangeError("Canonical rating must be an integer from 0 through 10.");
  }
}
