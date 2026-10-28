import { createHmac, timingSafeEqual } from "node:crypto";

export type IsolatedRestoreAttestation = {
  version: 1;
  scope: "master" | "tenant";
  targetKey: string;
  databaseName: string;
  host: string;
  port: number;
  sourceContainerId: string;
  sandboxContainerId: string;
  backupChecksum: string;
  inventoryChecksum: string;
  createdAt: string;
  restoredAt: string;
  networkNone: true;
  eventSchedulerDisabled: true;
};

export type IsolatedRestoreTarget = Pick<
  IsolatedRestoreAttestation,
  "scope" | "targetKey" | "databaseName" | "host" | "port" | "sourceContainerId" | "backupChecksum"
>;

const maxAgeMs = 24 * 60 * 60 * 1000;
const digestPattern = /^[a-f0-9]{64}$/u;
const domain = "codexsun:isolated-restore-attestation:v1\n";

/** Fixed field ordering is part of the host-to-backend signing contract. */
export function isolatedAttestationPayload(input: IsolatedRestoreAttestation) {
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
    eventSchedulerDisabled: input.eventSchedulerDisabled
  });
}

export function verifyIsolatedRestoreAttestation(
  input: IsolatedRestoreAttestation,
  signature: string,
  secret: string,
  target: IsolatedRestoreTarget,
  now = Date.now()
) {
  if (Buffer.byteLength(secret, "utf8") < 32) throw new Error("Attestation key is too short.");
  if (!digestPattern.test(signature)) throw new Error("Invalid attestation signature.");
  const expectedSignature = createHmac("sha256", secret)
    .update(domain)
    .update(isolatedAttestationPayload(input))
    .digest();
  if (!timingSafeEqual(Buffer.from(signature, "hex"), expectedSignature))
    throw new Error("Attestation signature does not match.");
  if (input.version !== 1) throw new Error("Invalid isolated restore attestation version.");
  validateIsolatedRestoreFields(input, target, now);
  return input;
}

/** Validate shared target, isolation and freshness fields after authenticating the evidence. */
export function validateIsolatedRestoreFields(
  input: Omit<IsolatedRestoreAttestation, "version">,
  target: IsolatedRestoreTarget,
  now = Date.now()
) {
  if (
    !["master", "tenant"].includes(input.scope) ||
    typeof input.targetKey !== "string" ||
    !input.targetKey.trim() ||
    (input.scope === "master" && input.targetKey !== "master") ||
    (input.scope === "tenant" && !/^[1-9][0-9]*$/u.test(input.targetKey)) ||
    typeof input.databaseName !== "string" ||
    !/^[A-Za-z0-9_]+$/u.test(input.databaseName) ||
    typeof input.host !== "string" ||
    !input.host.trim() ||
    !Number.isInteger(input.port) ||
    input.port < 1 ||
    input.port > 65535 ||
    !digestPattern.test(input.sourceContainerId) ||
    !digestPattern.test(input.sandboxContainerId) ||
    input.sourceContainerId === input.sandboxContainerId ||
    !digestPattern.test(input.backupChecksum) ||
    !digestPattern.test(input.inventoryChecksum) ||
    input.networkNone !== true ||
    input.eventSchedulerDisabled !== true
  )
    throw new Error("Invalid isolated restore attestation.");
  for (const key of [
    "scope",
    "targetKey",
    "databaseName",
    "host",
    "port",
    "sourceContainerId",
    "backupChecksum"
  ] as const) {
    if (input[key] !== target[key]) throw new Error(`Attestation target mismatch: ${key}.`);
  }
  const createdAt = typeof input.createdAt === "string" ? Date.parse(input.createdAt) : NaN;
  const restoredAt = typeof input.restoredAt === "string" ? Date.parse(input.restoredAt) : NaN;
  if (
    !Number.isFinite(createdAt) ||
    !Number.isFinite(restoredAt) ||
    createdAt > restoredAt ||
    restoredAt > now ||
    now - createdAt > maxAgeMs
  )
    throw new Error("Attestation is expired or has invalid timestamps.");
}
