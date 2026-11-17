export type MembershipRow = {
  id: string;
  team_id: string;
  user_id: string;
  membership_role: string;
  status: string;
};

export type StableTeamIdentity = {
  authUserId: string;
  membershipId: string;
  teamId: string;
  membershipRole: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isStableUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/**
 * Resolve a signed-in user to exactly one active team membership.
 * Display labels (P1/P2/IGN) are never accepted as identity values.
 * If no preferred team is supplied and multiple active memberships exist,
 * return null rather than selecting an arbitrary team.
 */
export function resolveActiveTeamIdentity(
  authUserId: string,
  rows: readonly MembershipRow[],
  preferredTeamId?: string | null,
): StableTeamIdentity | null {
  if (!isStableUuid(authUserId)) return null;
  if (preferredTeamId != null && !isStableUuid(preferredTeamId)) return null;

  const candidates = rows.filter((row) =>
    row.status === "active" &&
    row.user_id.toLowerCase() === authUserId.toLowerCase() &&
    isStableUuid(row.id) &&
    isStableUuid(row.team_id) &&
    typeof row.membership_role === "string" &&
    row.membership_role.trim().length > 0
  );

  const scoped = preferredTeamId
    ? candidates.filter((row) => row.team_id.toLowerCase() === preferredTeamId.toLowerCase())
    : candidates;

  if (scoped.length !== 1) return null;

  const membership = scoped[0];
  return {
    authUserId: authUserId.toLowerCase(),
    membershipId: membership.id.toLowerCase(),
    teamId: membership.team_id.toLowerCase(),
    membershipRole: membership.membership_role,
  };
}

/** Validate a configured IANA timezone before it is saved or displayed. */
export function isValidTeamTimezone(value: unknown): value is string {
  if (typeof value !== "string" || value.trim() !== value || value.length < 1 || value.length > 64) {
    return false;
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

/**
 * Format a date in the configured team timezone.
 * This is a client display utility only; database triggers/RPCs remain
 * authoritative for persisted score dates until their timezone contract is migrated.
 */
export function teamDateISO(date: Date, timeZone: string): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new RangeError("A valid date is required.");
  }
  if (!isValidTeamTimezone(timeZone)) {
    throw new RangeError("A valid IANA team timezone is required.");
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
