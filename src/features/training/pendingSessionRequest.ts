export type PendingSessionPayload = {
  teamId: string;
  title: string;
  sessionType: string;
  planId: string | null;
  drillId: string | null;
  scheduledAt: string | null;
  sessionDate: string | null;
  durationMinutes: number;
  instructions: string;
  participantIds: string[];
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type PendingRecord = {
  idempotencyKey: string;
  payloadJson: string;
};

export function getOrCreatePendingSessionRequest(
  storage: StorageLike,
  storageKey: string,
  payload: PendingSessionPayload,
  createKey: () => string,
): PendingRecord {
  const payloadJson = JSON.stringify({
    ...payload,
    participantIds: [...payload.participantIds].sort(),
  });
  const raw = storage.getItem(storageKey);

  if (raw !== null) {
    let pending: PendingRecord;
    try {
      pending = JSON.parse(raw) as PendingRecord;
    } catch {
      throw new Error("A pending session request is unreadable. Keep it for recovery; do not start another session yet.");
    }

    if (
      typeof pending.idempotencyKey !== "string"
      || typeof pending.payloadJson !== "string"
    ) {
      throw new Error("A pending session request is incomplete. Keep it for recovery; do not start another session yet.");
    }

    if (pending.payloadJson !== payloadJson) {
      throw new Error("A previous session request is still pending. Retry the same session details before starting a different session.");
    }

    return pending;
  }

  const pending: PendingRecord = {
    idempotencyKey: createKey(),
    payloadJson,
  };
  storage.setItem(storageKey, JSON.stringify(pending));
  return pending;
}

export function clearPendingSessionRequest(storage: StorageLike, storageKey: string): void {
  storage.removeItem(storageKey);
}
