import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  reusedAttestationPayload,
  verifyReusedRestoreAttestation,
  type ReusedRestoreAttestation
} from "./database-maintenance.reused-attestation.js";
// The deployment script is JavaScript and has no TypeScript declarations.
// @ts-expect-error The test checks the separate host-to-backend contract.
import { signReusedRestoreTarget } from "../../../../../../.container/codexsun-v1/local/isolated-restore.mjs";

const secret = "a-test-key-that-is-at-least-32-bytes-long";
const now = Date.parse("2026-10-28T12:00:00Z");
const evidence: ReusedRestoreAttestation = {
  version: 2,
  scope: "tenant",
  targetKey: "1",
  databaseName: "tenant_db",
  host: "db",
  port: 3306,
  sourceContainerId: "a".repeat(64),
  sandboxContainerId: "b".repeat(64),
  backupChecksum: "c".repeat(64),
  inventoryChecksum: "d".repeat(64),
  createdAt: "2026-10-28T11:00:00.000Z",
  restoredAt: "2026-10-28T11:30:00.000Z",
  networkNone: true,
  eventSchedulerDisabled: true,
  evidenceType: "reused-prior-backup",
  matchesCurrentSource: false
};
const sign = (input: ReusedRestoreAttestation) =>
  createHmac("sha256", secret)
    .update("codexsun:isolated-restore-attestation:v2\n")
    .update(reusedAttestationPayload(input))
    .digest("hex");

test("reused evidence is signed, scoped, isolated, and time limited", () => {
  assert.equal(
    verifyReusedRestoreAttestation(evidence, sign(evidence), secret, evidence, now),
    evidence
  );
  assert.throws(() =>
    verifyReusedRestoreAttestation(
      { ...evidence, databaseName: "other" },
      sign(evidence),
      secret,
      evidence,
      now
    )
  );
  assert.throws(() =>
    verifyReusedRestoreAttestation(
      evidence,
      sign(evidence),
      secret,
      { ...evidence, backupChecksum: "e".repeat(64) },
      now
    )
  );
  assert.throws(() =>
    verifyReusedRestoreAttestation(evidence, sign(evidence), secret, evidence, now + 86400000)
  );
  const lie = { ...evidence, matchesCurrentSource: true } as unknown as ReusedRestoreAttestation;
  assert.throws(() => verifyReusedRestoreAttestation(lie, sign(lie), secret, evidence, now));
  const unisolated = { ...evidence, networkNone: false } as unknown as ReusedRestoreAttestation;
  assert.throws(() =>
    verifyReusedRestoreAttestation(unisolated, sign(unisolated), secret, evidence, now)
  );
});

test("host-signed reused evidence verifies with the backend contract", () => {
  const target = {
    scope: evidence.scope,
    targetKey: evidence.targetKey,
    databaseName: evidence.databaseName,
    host: evidence.host,
    port: evidence.port
  };
  const signed = signReusedRestoreTarget(target, evidence, secret);
  assert.deepEqual(signed.attestation, evidence);
  verifyReusedRestoreAttestation(signed.attestation, signed.signature, secret, evidence, now);
});
