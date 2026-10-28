import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { join } from "node:path";
import {
  verifyIsolatedRestoreAttestation,
  type IsolatedRestoreAttestation,
  type IsolatedRestoreTarget
} from "./database-maintenance.isolated-attestation.js";

type AttestationEntry = { attestation: IsolatedRestoreAttestation; signature: string };

export class IsolatedBackupVerifier {
  constructor(
    private readonly directory: string,
    private readonly key: string,
    private readonly sourceContainerId: string
  ) {
    if (!/^[a-f0-9]{64}$/u.test(sourceContainerId)) throw new Error("Invalid source container ID.");
    if (Buffer.byteLength(key, "utf8") < 32) throw new Error("Attestation key is too short.");
  }

  async verify(target: Omit<IsolatedRestoreTarget, "sourceContainerId" | "backupChecksum">) {
    const entries = await readManifest(join(this.directory, "attestations.json"));
    const matches = entries.filter(
      (entry) =>
        entry?.attestation?.scope === target.scope &&
        entry.attestation.targetKey === target.targetKey
    );
    if (matches.length !== 1)
      throw new Error("Expected exactly one isolated backup attestation for the target.");
    const backupChecksum = await hashFile(join(this.directory, "databases.sql"));
    verifyIsolatedRestoreAttestation(matches[0]!.attestation, matches[0]!.signature, this.key, {
      ...target,
      sourceContainerId: this.sourceContainerId,
      backupChecksum
    });
  }
}

async function readManifest(path: string): Promise<AttestationEntry[]> {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > 2 * 1024 * 1024)
      throw new Error("Invalid attestation manifest.");
    const manifest: unknown = JSON.parse(await file.readFile("utf8"));
    if (
      !manifest ||
      typeof manifest !== "object" ||
      !("version" in manifest) ||
      manifest.version !== 1 ||
      !("attestations" in manifest) ||
      !Array.isArray(manifest.attestations) ||
      manifest.attestations.length > 10000
    )
      throw new Error("Invalid attestation manifest.");
    return manifest.attestations as AttestationEntry[];
  } finally {
    await file.close();
  }
}

async function hashFile(path: string) {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await file.stat({ bigint: true });
    if (!before.isFile() || before.size === 0n) throw new Error("Invalid isolated backup file.");
    const hash = createHash("sha256");
    for await (const chunk of file.createReadStream({ autoClose: false })) hash.update(chunk);
    const after = await file.stat({ bigint: true });
    if (
      before.size !== after.size ||
      before.mtimeNs !== after.mtimeNs ||
      before.ctimeNs !== after.ctimeNs
    )
      throw new Error("Isolated backup changed while verifying.");
    return hash.digest("hex");
  } finally {
    await file.close();
  }
}
