import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  isolatedAttestationPayload,
  verifyIsolatedRestoreAttestation,
  type IsolatedRestoreAttestation
} from "./database-maintenance.isolated-attestation.js";

const key = "a-test-key-that-is-at-least-32-bytes-long";
const now = Date.parse("2026-10-28T12:00:00Z");
const evidence: IsolatedRestoreAttestation = {
  version: 1,
  scope: "tenant",
  targetKey: "1",
  databaseName: "codexsun_db",
  host: "codexsun-mariadb",
  port: 3306,
  sourceContainerId: "a".repeat(64),
  sandboxContainerId: "b".repeat(64),
  backupChecksum: "c".repeat(64),
  inventoryChecksum: "d".repeat(64),
  createdAt: "2026-10-28T11:50:00.000Z",
  restoredAt: "2026-10-28T11:55:00.000Z",
  networkNone: true,
  eventSchedulerDisabled: true
};

function signature(input: IsolatedRestoreAttestation) {
  return createHmac("sha256", key)
    .update("codexsun:isolated-restore-attestation:v1\n")
    .update(isolatedAttestationPayload(input))
    .digest("hex");
}

test("accepts authentic evidence for the exact source and backup", () => {
  assert.equal(
    verifyIsolatedRestoreAttestation(evidence, signature(evidence), key, evidence, now),
    evidence
  );
});

test("rejects tampering, wrong key, target and backup checksum", () => {
  assert.throws(() =>
    verifyIsolatedRestoreAttestation(
      { ...evidence, host: "other" },
      signature(evidence),
      key,
      evidence,
      now
    )
  );
  assert.throws(() =>
    verifyIsolatedRestoreAttestation(
      evidence,
      signature(evidence),
      "wrong-key-that-is-at-least-32-bytes-long",
      evidence,
      now
    )
  );
  assert.throws(() =>
    verifyIsolatedRestoreAttestation(
      evidence,
      signature(evidence),
      key,
      { ...evidence, databaseName: "other" },
      now
    )
  );
  assert.throws(() =>
    verifyIsolatedRestoreAttestation(
      evidence,
      signature(evidence),
      key,
      { ...evidence, backupChecksum: "e".repeat(64) },
      now
    )
  );
  assert.throws(() => verifyIsolatedRestoreAttestation(evidence, "invalid", key, evidence, now));
});

test("rejects expired, future or nonisolated signed evidence", () => {
  assert.throws(() =>
    verifyIsolatedRestoreAttestation(evidence, signature(evidence), key, evidence, now + 86400000)
  );
  const future = { ...evidence, restoredAt: "2026-10-29T00:00:00.000Z" };
  assert.throws(() =>
    verifyIsolatedRestoreAttestation(future, signature(future), key, evidence, now)
  );
  const sameContainer = { ...evidence, sandboxContainerId: evidence.sourceContainerId };
  assert.throws(() =>
    verifyIsolatedRestoreAttestation(sameContainer, signature(sameContainer), key, evidence, now)
  );
  const unisolated = { ...evidence, networkNone: false } as unknown as IsolatedRestoreAttestation;
  assert.throws(() =>
    verifyIsolatedRestoreAttestation(unisolated, signature(unisolated), key, evidence, now)
  );
  const events = {
    ...evidence,
    eventSchedulerDisabled: false
  } as unknown as IsolatedRestoreAttestation;
  assert.throws(() =>
    verifyIsolatedRestoreAttestation(events, signature(events), key, evidence, now)
  );
});
