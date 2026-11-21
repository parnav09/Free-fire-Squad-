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

export function resolveActiveTeamIdentity(authUserId: string, rows: readonly MembershipRow[], preferredTeamId?: string | null): StableTeamIdentity | null {
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

export const INDIA_TIMEZONE = "Asia/Kolkata";
const INDIA_TIMEZONE_ALIASES = new Set([INDIA_TIMEZONE, "Asia/Calcutta"]);

export function isValidTeamTimezone(value: unknown): value is string {
  return typeof value === "string" && value.trim() === value && INDIA_TIMEZONE_ALIASES.has(value);
}

function assertValidDate(date: Date): void {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new RangeError("A valid date is required.");
}

export function indiaDateISO(date = new Date()): string {
  assertValidDate(date);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: INDIA_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function indiaDateLabel(date = new Date()): string {
  assertValidDate(date);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: INDIA_TIMEZONE, year: "numeric", month: "long", day: "numeric" }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  const day = Number(part("day"));
  const suffix = day % 100 >= 11 && day % 100 <= 13 ? "th" : day % 10 === 1 ? "st" : day % 10 === 2 ? "nd" : day % 10 === 3 ? "rd" : "th";
  return `${part("month")} ${day}${suffix} ${part("year")}`;
}

export function millisecondsUntilIndiaMidnight(date = new Date()): number {
  assertValidDate(date);
  const [year, month, day] = indiaDateISO(date).split("-").map(Number);
  const nextMidnightUtc = Date.UTC(year, month - 1, day + 1) - (5 * 60 + 30) * 60_000;
  return Math.max(1_000, nextMidnightUtc - date.getTime());
}

export function teamDateISO(date: Date, timeZone: string): string {
  assertValidDate(date);
  if (!isValidTeamTimezone(timeZone)) throw new RangeError("Squad OS supports India Standard Time only.");
  return indiaDateISO(date);
}

export type TeamSessionEligibility =
  | { eligible: true; identity: StableTeamIdentity }
  | { eligible: false; reason: "unauthenticated" | "invalid-auth-user" | "missing-membership" | "invalid-membership" | "inactive-membership" | "user-mismatch" | "team-mismatch" };

export function resolveTeamSessionEligibility(authUserId: unknown, membership: MembershipRow | null | undefined, expectedTeamId: unknown): TeamSessionEligibility {
  if (authUserId == null || authUserId === "") return { eligible: false, reason: "unauthenticated" };
  if (!isStableUuid(authUserId)) return { eligible: false, reason: "invalid-auth-user" };
  if (!membership) return { eligible: false, reason: "missing-membership" };
  if (!isStableUuid(membership.id) || !isStableUuid(membership.team_id) || !isStableUuid(membership.user_id) || typeof membership.membership_role !== "string" || !membership.membership_role.trim()) {
    return { eligible: false, reason: "invalid-membership" };
  }
  if (membership.status !== "active") return { eligible: false, reason: "inactive-membership" };
  if (membership.user_id.toLowerCase() !== authUserId.toLowerCase()) return { eligible: false, reason: "user-mismatch" };
  if (!isStableUuid(expectedTeamId) || membership.team_id.toLowerCase() !== expectedTeamId.toLowerCase()) return { eligible: false, reason: "team-mismatch" };
  return { eligible: true, identity: { authUserId: authUserId.toLowerCase(), membershipId: membership.id.toLowerCase(), teamId: membership.team_id.toLowerCase(), membershipRole: membership.membership_role } };
}

export type TeamUiCapabilities = { canManageTeamSettings: boolean; canManageAssignments: boolean };

export function getTeamUiCapabilities(membershipRole: unknown, ownerPowerEnabled: boolean): TeamUiCapabilities {
  const role = typeof membershipRole === "string" ? membershipRole : "";
  return {
    canManageTeamSettings: role === "owner",
    canManageAssignments: role === "coach" || (role === "owner" && ownerPowerEnabled === true),
  };
}
