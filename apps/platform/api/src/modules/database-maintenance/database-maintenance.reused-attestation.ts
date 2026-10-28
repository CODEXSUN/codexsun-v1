import { createHmac, timingSafeEqual } from "node:crypto";
import {
  validateIsolatedRestoreFields,
  type IsolatedRestoreAttestation,
  type IsolatedRestoreTarget
} from "./database-maintenance.isolated-attestation.js";

export type ReusedRestoreAttestation = Omit<IsolatedRestoreAttestation, "version"> & {
  version: 2;
  evidenceType: "reused-prior-backup";
  matchesCurrentSource: false;
};

export function reusedAttestationPayload(input: ReusedRestoreAttestation) {
  return JSON.stringify({
    version: input.version,
    scope: input.scope,
    targetKey: input.targetKey,
    databaseName: input.databaseName,
    host: input.host,
    port: input.port,
    sourceContainerId: input.sourceContainerId,
    sandboxContainerId: input.sandboxContainerId,
    backupChecksum: input.backupChecksum,
    inventoryChecksum: input.inventoryChecksum,
    createdAt: input.createdAt,
    restoredAt: input.restoredAt,
    networkNone: input.networkNone,
    eventSchedulerDisabled: input.eventSchedulerDisabled,
    evidenceType: input.evidenceType,
    matchesCurrentSource: input.matchesCurrentSource
  });
}

export function verifyReusedRestoreAttestation(
  input: ReusedRestoreAttestation,
  signature: string,
  secret: string,
  target: IsolatedRestoreTarget,
  now = Date.now()
) {
  if (Buffer.byteLength(secret, "utf8") < 32 || !/^[a-f0-9]{64}$/u.test(signature))
    throw new Error("Invalid reused attestation key or signature.");
  const signed = createHmac("sha256", secret)
    .update("codexsun:isolated-restore-attestation:v2\n")
    .update(reusedAttestationPayload(input))
    .digest();
  if (!timingSafeEqual(Buffer.from(signature, "hex"), signed))
    throw new Error("Reused attestation signature does not match.");
  if (
    input.version !== 2 ||
    input.evidenceType !== "reused-prior-backup" ||
    input.matchesCurrentSource !== false
  )
    throw new Error("Invalid reused backup attestation.");
  validateIsolatedRestoreFields(input, target, now);
  return input;
}
