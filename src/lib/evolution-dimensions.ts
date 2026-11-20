export const CANONICAL_ROLE_KEYS = [
  "primary_rusher",
  "secondary_rusher",
  "third_rusher_flanker",
  "sniper_igl",
  "substitute_flex",
  "other",
] as const;

export const CANONICAL_RATING_SCALE = {
  minimum: 0,
  maximum: 10,
  step: 1,
} as const;

export const CANONICAL_DIMENSION_REGISTRY = [
  {
    key: "communication",
    label: "Communication",
    definition: "Timely, clear, accurate and actionable information; usefulness matters more than callout volume.",
    sortOrder: 1,
    lifecycleStatus: "active",
    applicableRoleKeys: CANONICAL_ROLE_KEYS,
  },
  {
    key: "coordination_trade_support",
    label: "Coordination & Trade Support",
    definition: "Team timing, spacing, acknowledgement and support behavior; not simply an outcome or elimination count.",
    sortOrder: 2,
    lifecycleStatus: "active",
    applicableRoleKeys: CANONICAL_ROLE_KEYS,
  },
  {
    key: "decision_making",
    label: "Decision Making",
    definition: "Decision quality in its observed context, independent of hindsight or outcome alone.",
    sortOrder: 3,
    lifecycleStatus: "active",
    applicableRoleKeys: CANONICAL_ROLE_KEYS,
  },
  {
    key: "positioning",
    label: "Positioning",
    definition: "Cover, angles, spacing, exposure and safe repositioning in the observed context.",
    sortOrder: 4,
    lifecycleStatus: "active",
    applicableRoleKeys: CANONICAL_ROLE_KEYS,
  },
  {
    key: "map_awareness_rotation",
    label: "Map Awareness & Rotation",
    definition: "Reading map/zone information, timing and route context; distinct from positioning.",
    sortOrder: 5,
    lifecycleStatus: "active",
    applicableRoleKeys: CANONICAL_ROLE_KEYS,
  },
  {
    key: "role_execution",
    label: "Role Execution",
    definition: "Execution of the role actually recorded for that session, not a mutable current roster label.",
    sortOrder: 6,
    lifecycleStatus: "active",
    applicableRoleKeys: CANONICAL_ROLE_KEYS,
  },
] as const;

export const CANONICAL_DIMENSION_KEYS = CANONICAL_DIMENSION_REGISTRY.map(
  (dimension) => dimension.key,
) as readonly (typeof CANONICAL_DIMENSION_REGISTRY)[number]["key"][];

export type CanonicalDimensionKey = (typeof CANONICAL_DIMENSION_REGISTRY)[number]["key"];
export type DimensionLifecycleStatus = "active" | "retired";

export const LEGACY_DIMENSION_ALIASES = [
  { source: "daily_evaluation", legacyKey: "communication", canonicalKey: "communication", kind: "exact" },
  { source: "daily_evaluation", legacyKey: "decision_making", canonicalKey: "decision_making", kind: "exact" },
  { source: "daily_evaluation", legacyKey: "role_execution", canonicalKey: "role_execution", kind: "exact" },
  { source: "standard_training", legacyKey: "communication", canonicalKey: "communication", kind: "exact" },
  { source: "advanced_training", legacyKey: "communication", canonicalKey: "communication", kind: "exact" },
  { source: "advanced_training", legacyKey: "decision_making", canonicalKey: "decision_making", kind: "exact" },
  { source: "advanced_training", legacyKey: "positioning", canonicalKey: "positioning", kind: "exact" },
] as const;
