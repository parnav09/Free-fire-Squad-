import type { SupabaseClient } from "@supabase/supabase-js";

export type SyncedEventRecord = {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
  syncRevision?: number;
  days?: Array<{ id?: string; dayNumber?: number; date?: string; matchCount?: number; matches?: Array<{ id: string; matchNumber: number; placement: number | null; placementPoints: number; kills: number }> }>;
};
type CloudRow = {
  id: string; team_id: string; name: string; event_data: { days?: SyncedEventRecord["days"] };
  revision: number; created_at: string; updated_at: string; deleted_at: string | null;
};
export type EventSyncResult = { records: SyncedEventRecord[]; deletedIds: string[]; conflict: boolean };

export async function syncTournamentEventRecords(
  client: SupabaseClient,
  teamId: string,
  userId: string,
  localRecords: SyncedEventRecord[],
  pendingDeletedIds: string[]
): Promise<EventSyncResult> {
  const { data, error } = await client.from("tournament_event_records")
    .select("id,team_id,name,event_data,revision,created_at,updated_at,deleted_at")
    .eq("team_id", teamId);
  if (error) throw error;
  const cloudRows = (data || []) as CloudRow[];
  const cloudById = new Map(cloudRows.map(row => [row.id, row]));
  let conflict = false;

  for (const id of pendingDeletedIds) {
    const row = cloudById.get(id);
    if (!row || row.deleted_at) continue;
    const { data: updated, error: deleteError } = await client.from("tournament_event_records")
      .update({ deleted_at: new Date().toISOString(), updated_by: userId })
      .eq("id", id).eq("team_id", teamId).eq("revision", row.revision)
      .select("id").maybeSingle();
    if (deleteError) throw deleteError;
    if (!updated) conflict = true;
  }

  for (const record of localRecords) {
    if (pendingDeletedIds.includes(record.id)) continue;
    const remote = cloudById.get(record.id);
    const localTime = Date.parse(record.updatedAt || record.createdAt || "");
    const remoteTime = remote ? Date.parse(remote.updated_at) : 0;
    if (!remote) {
      const { error: insertError } = await client.from("tournament_event_records").insert({
        id: record.id, team_id: teamId, name: record.name,
        event_data: { days: record.days || [] }, revision: 1,
        created_by: userId, updated_by: userId
      });
      if (insertError && insertError.code !== "23505") throw insertError;
      if (insertError?.code === "23505") conflict = true;
      continue;
    }
    if (remote.deleted_at) {
      // A cloud tombstone wins over stale local copies; never resurrect a deleted event.
      continue;
    }
    const localData = { days: record.days || [] };
    const localDiffers = record.name !== remote.name ||
      JSON.stringify(localData) !== JSON.stringify(remote.event_data || { days: [] });
    const hasKnownRevision = Number.isSafeInteger(record.syncRevision);
    if (hasKnownRevision && record.syncRevision !== remote.revision) {
      // The local edit was based on an older cloud revision. Keep the local cache intact
      // and surface a conflict rather than silently overwriting either version.
      if (localDiffers) conflict = true;
      continue;
    }
    const shouldUpload = hasKnownRevision
      ? localDiffers
      : Number.isFinite(localTime) && localTime > remoteTime;
    if (shouldUpload) {
      const { data: updated, error: updateError } = await client.from("tournament_event_records")
        .update({ name: record.name, event_data: localData, updated_by: userId })
        .eq("id", record.id).eq("team_id", teamId).eq("revision", remote.revision)
        .select("id").maybeSingle();
      if (updateError) throw updateError;
      if (!updated) conflict = true;
    }
  }

  const { data: latest, error: reloadError } = await client.from("tournament_event_records")
    .select("id,team_id,name,event_data,revision,created_at,updated_at,deleted_at")
    .eq("team_id", teamId);
  if (reloadError) throw reloadError;
  const finalRows = (latest || []) as CloudRow[];
  const records = finalRows.filter(row => !row.deleted_at).map(row => ({
    id: row.id, name: row.name, createdAt: row.created_at, updatedAt: row.updated_at,
    syncRevision: row.revision, days: Array.isArray(row.event_data?.days) ? row.event_data.days : []
  })).sort((a,b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  const deletedIds = finalRows.filter(row => !!row.deleted_at).map(row => row.id);
  return { records, deletedIds, conflict };
}
