import type { SupabaseClient } from "@supabase/supabase-js";

export type CanonicalSourceSystem = "scrim" | "tournament" | "training";

export type CanonicalSourceIntegration =
  | {
      linked: true;
      canonicalSessionId: string;
      syncedMatchCount: number;
      sourceSystem: CanonicalSourceSystem;
    }
  | {
      linked: false;
      code: string | null;
      message: string;
    };

/**
 * Resolve an existing module record to its one canonical session.
 * The database RPC owns idempotency, source locking, team authorization and
 * match synchronization; the client never fabricates canonical IDs.
 *
 * A missing RPC on an older live database is reported as a pending link so
 * legacy module writes can continue during the staged rollout.
 */
export async function integrateCanonicalSource(
  client: SupabaseClient,
  teamId: string,
  sourceSystem: CanonicalSourceSystem,
  sourceRecordId: string,
): Promise<CanonicalSourceIntegration> {
  if (!teamId || !sourceRecordId) {
    return { linked: false, code: "invalid_arguments", message: "Team and source record IDs are required." };
  }

  const { data, error } = await client.rpc("integrate_canonical_source", {
    p_team_id: teamId,
    p_source_system: sourceSystem,
    p_source_record_id: sourceRecordId,
  });

  if (error) {
    return {
      linked: false,
      code: error.code ?? null,
      message: error.message || "Canonical integration could not be completed.",
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const canonicalSessionId =
    row && typeof row === "object" && "canonical_session_id" in row
      ? (row as { canonical_session_id?: unknown }).canonical_session_id
      : null;
  const syncedMatchCount =
    row && typeof row === "object" && "synced_match_count" in row
      ? (row as { synced_match_count?: unknown }).synced_match_count
      : 0;

  if (typeof canonicalSessionId !== "string" || canonicalSessionId.length === 0) {
    return {
      linked: false,
      code: "invalid_rpc_response",
      message: "The canonical integration RPC returned no session ID.",
    };
  }

  return {
    linked: true,
    canonicalSessionId,
    syncedMatchCount: typeof syncedMatchCount === "number" ? syncedMatchCount : 0,
    sourceSystem,
  };
}

export function isCanonicalIntegrationUnavailable(result: CanonicalSourceIntegration): boolean {
  return !result.linked && (result.code === "PGRST202" || result.code === "42883");
}
