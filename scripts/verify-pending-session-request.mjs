import assert from "node:assert/strict";
import test from "node:test";
import {
  clearPendingSessionRequest,
  getOrCreatePendingSessionRequest,
  readPendingSessionPayload,
} from "../src/features/training/pendingSessionRequest.ts";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
}

const payload = {
  teamId: "team-1",
  title: "Squad communication",
  sessionType: "communication",
  planId: null,
  drillId: "drill-1",
  scheduledAt: "2026-11-21T06:30:00.000Z",
  sessionDate: "2026-11-21",
  durationMinutes: 30,
  instructions: "Call rotations clearly",
  participantIds: ["player-b", "player-a"],
};

test("pending session idempotency key is persisted before the network request", () => {
  const storage = memoryStorage();
  let generated = 0;
  const first = getOrCreatePendingSessionRequest(storage, "pending:team-1", payload, () => {
    generated += 1;
    return "key-1";
  });

  assert.equal(first.idempotencyKey, "key-1");
  assert.equal(generated, 1);
  assert.ok(storage.getItem("pending:team-1"));
});

test("retry reuses the same key after reload and normalizes participant ordering", () => {
  const storage = memoryStorage();
  const first = getOrCreatePendingSessionRequest(storage, "pending:team-1", payload, () => "key-1");
  const retry = getOrCreatePendingSessionRequest(
    storage,
    "pending:team-1",
    { ...payload, participantIds: ["player-a", "player-b"] },
    () => "key-2",
  );

  assert.equal(retry.idempotencyKey, first.idempotencyKey);
});

test("changed payload cannot silently reuse an in-flight idempotency key", () => {
  const storage = memoryStorage();
  getOrCreatePendingSessionRequest(storage, "pending:team-1", payload, () => "key-1");

  assert.throws(
    () => getOrCreatePendingSessionRequest(
      storage,
      "pending:team-1",
      { ...payload, title: "Different session" },
      () => "key-2",
    ),
    /previous session request is still pending/i,
  );
});

test("successful completion clears only the matching team's pending request", () => {
  const storage = memoryStorage();
  getOrCreatePendingSessionRequest(storage, "pending:team-1", payload, () => "key-1");
  clearPendingSessionRequest(storage, "pending:team-1");

  assert.equal(storage.getItem("pending:team-1"), null);
});

test("pending draft payload is restored after reload for offline-to-online retry", () => {
  const storage = memoryStorage();
  getOrCreatePendingSessionRequest(storage, "pending:team-1", payload, () => "key-1");
  const restored = readPendingSessionPayload(storage, "pending:team-1");

  assert.deepEqual(restored, {
    ...payload,
    participantIds: ["player-a", "player-b"],
  });
});
