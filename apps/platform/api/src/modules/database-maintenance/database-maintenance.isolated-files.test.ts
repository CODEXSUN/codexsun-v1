import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  isolatedAttestationPayload,
  type IsolatedRestoreAttestation
} from "./database-maintenance.isolated-attestation.js";
import { IsolatedBackupVerifier } from "./database-maintenance.isolated-files.js";

const key = "test-key-with-at-least-thirty-two-bytes";
const target = {
  scope: "tenant" as const,
  targetKey: "1",
  databaseName: "tenant_db",
  host: "db",
  port: 3306
};
const source = "a".repeat(64);

async function fixture(directory: string) {
  const dump = Buffer.from("test isolated dump");
  const now = new Date().toISOString();
  const attestation: IsolatedRestoreAttestation = {
    version: 1,
    ...target,
    sourceContainerId: source,
    sandboxContainerId: "b".repeat(64),
    backupChecksum: createHash("sha256").update(dump).digest("hex"),
    inventoryChecksum: "c".repeat(64),
    createdAt: now,
    restoredAt: now,
    networkNone: true,
    eventSchedulerDisabled: true
  };
  const signature = createHmac("sha256", key)
    .update("codexsun:isolated-restore-attestation:v1\n")
    .update(isolatedAttestationPayload(attestation))
    .digest("hex");
  await writeFile(join(directory, "databases.sql"), dump);
  await writeFile(
    join(directory, "attestations.json"),
    JSON.stringify({ version: 1, attestations: [{ attestation, signature }] })
  );
  return { attestation, signature };
}

test("rehashes the mounted backup and binds the expected source and tenant", async () => {
  const directory = await mkdtemp(join(tmpdir(), "codexsun-evidence-"));
  try {
    await fixture(directory);
    const verifier = new IsolatedBackupVerifier(directory, key, source);
    await verifier.verify(target);
    await assert.rejects(verifier.verify({ ...target, databaseName: "other_db" }));
    await assert.rejects(new IsolatedBackupVerifier(directory, key, "f".repeat(64)).verify(target));
    await writeFile(join(directory, "databases.sql"), "changed dump");
    await assert.rejects(verifier.verify(target));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects duplicate attestations and symlinked backup files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "codexsun-evidence-"));
  try {
    const entry = await fixture(directory);
    const verifier = new IsolatedBackupVerifier(directory, key, source);
    await writeFile(
      join(directory, "attestations.json"),
      JSON.stringify({ version: 1, attestations: [entry, entry] })
    );
    await assert.rejects(verifier.verify(target));
    await writeFile(
      join(directory, "attestations.json"),
      JSON.stringify({ version: 1, attestations: [entry] })
    );
    await rm(join(directory, "databases.sql"));
    await writeFile(join(directory, "other.sql"), "test isolated dump");
    try {
      await symlink(join(directory, "other.sql"), join(directory, "databases.sql"));
    } catch (error) {
      if (process.platform === "win32" && (error as NodeJS.ErrnoException).code === "EPERM") return;
      throw error;
    }
    await assert.rejects(verifier.verify(target));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
